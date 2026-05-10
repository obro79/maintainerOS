import { NextResponse } from 'next/server';
import { authorizeWorkflowMutation } from '@/lib/maintaineros/auth';
import { runAgentExecution } from '@/lib/maintaineros/agent-execution';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { persistPullRequest } from '@/lib/maintaineros/workflow-state';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authError = authorizeWorkflowMutation(request);
    if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const repositoryId = stringBody(body.repositoryId);
    const issueNumber = Number(body.issueNumber);
    if (!repositoryId || !Number.isInteger(issueNumber) || issueNumber < 1) {
      return NextResponse.json({ ok: false, error: 'repositoryId and positive issueNumber are required.' }, { status: 400 });
    }

    const issue = await getMaintainerOSRepository().getIssueDetail(repositoryId, issueNumber);
    if (!issue) return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 });

    const result = await runAgentExecution(issue, repositoryId);
    if (result.blocked) {
      await recordTraceEvent({
        repositoryId,
        issueNumber,
        actor: 'AI attempt gate',
        provider: 'daytona',
        sourceState: 'live',
        route: issue.route,
        title: 'AI sandbox attempt blocked',
        detail: result.error ?? 'Route policy blocked autonomous agent execution.',
        status: 'blocked',
        relatedId: issue.workOrder.generatedAt ?? issue.id,
      });
      return NextResponse.json({ ok: false, blocked: true, error: result.error }, { status: 409 });
    }

    if (result.attempt) {
      await recordTraceEvent({
        repositoryId,
        issueNumber,
        actor: 'Daytona sandbox',
        provider: 'daytona',
        sourceState: 'live',
        route: issue.route,
        title: result.attempt.status === 'passed' ? 'Agent sandbox completed' : 'Agent sandbox failed',
        detail: result.attempt.logSummary,
        status: result.attempt.status === 'passed' ? 'passed' : 'failed',
        artifactUrl: result.pullRequest?.htmlUrl ?? null,
        relatedId: result.attempt.sandboxId,
        filesTouched: result.attempt.filesTouched,
        payload: {
          commandResults: result.attempt.commandResults,
          branchName: result.attempt.branchName,
          contextMode: result.attempt.contextMode,
        },
      });
    }

    let persistedPullRequest = null;
    if (result.pullRequest) {
      const persisted = await withPostgres((client) => persistPullRequest(client, {
        repositoryId,
        issueNumber,
        number: result.pullRequest!.number,
        title: result.pullRequest!.title,
        baseBranch: result.pullRequest!.baseBranch ?? 'main',
        branchName: result.pullRequest!.branchName,
        headSha: result.pullRequest!.headSha,
        status: result.pullRequest!.status,
        htmlUrl: result.pullRequest!.htmlUrl,
        authorLogin: result.pullRequest!.authorLogin,
        authorOwnerType: 'automation',
        automationOwned: true,
        linkedAt: result.pullRequest!.linkedAt,
      }));
      persistedPullRequest = persisted.viewModel;
      await recordTraceEvent({
        repositoryId,
        issueNumber,
        actor: 'AI PR artifact recorder',
        provider: 'github',
        sourceState: 'live',
        route: issue.route,
        title: `Automation PR #${result.pullRequest.number} recorded`,
        detail: `${result.pullRequest.authorLogin} opened ${result.pullRequest.branchName}; Greptile verification is required before completion.`,
        status: 'succeeded',
        artifactUrl: result.pullRequest.htmlUrl,
        relatedId: result.pullRequest.headSha,
      });
    }

    return NextResponse.json({
      ok: result.ok,
      blocked: false,
      error: result.error,
      patchPackage: result.patchPackage,
      attempt: result.attempt,
      pullRequest: persistedPullRequest ?? result.pullRequest,
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown agent execution error.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
