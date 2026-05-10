import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { verifyPullRequestWithGreptile } from '@/lib/maintaineros/greptile';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { persistVerification } from '@/lib/maintaineros/workflow-state';
import { recordProviderRun } from '@/lib/maintaineros/provider-runs';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';
import { authorizeWorkflowMutation } from '@/lib/maintaineros/auth';

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
    if (!issue.pullRequest) return NextResponse.json({ ok: false, error: 'A linked pull request is required before Greptile verification can run.' }, { status: 409 });

    const result = await verifyPullRequestWithGreptile(issue, issue.pullRequest);
    await recordProviderRun({
      provider: 'greptile',
      purpose: 'verify-pr',
      status: result.blocked ? 'blocked' : result.ok ? 'succeeded' : 'failed',
      sourceState: result.verification.sourceState ?? 'live',
      repositoryId,
      issueNumber,
      runId: result.runId ?? undefined,
      artifactUrl: result.artifactUrl ?? undefined,
      logUrl: result.logUrl ?? undefined,
      latencyMs: result.latencyMs,
      errorMessage: result.errorMessage ?? null,
      responseMeta: {
        status: result.verification.status,
        verifiedSha: result.verification.verifiedSha,
        currentSha: result.verification.currentSha,
      },
    });

    if (result.blocked) {
      await recordTraceEvent({
        repositoryId,
        issueNumber,
        actor: 'Greptile verification',
        provider: 'greptile',
        sourceState: result.verification.sourceState ?? 'planned',
        route: issue.route,
        title: 'Greptile verification blocked',
        detail: result.errorMessage ?? result.verification.summary,
        status: 'blocked',
        relatedId: issue.pullRequest.headSha,
      });
      return NextResponse.json({ ok: false, blocked: true, verification: result.verification, error: result.errorMessage }, { status: 424 });
    }

    const persisted = await withPostgres((client) => persistVerification(client, {
      repositoryId,
      issueNumber,
      verification: result.verification,
      artifactUrl: result.artifactUrl,
      logUrl: result.logUrl,
      rawResponse: result.rawResponse,
    }));

    await recordTraceEvent({
      repositoryId,
      issueNumber,
      actor: 'Greptile verification',
      provider: 'greptile',
      sourceState: result.verification.sourceState ?? 'live',
      route: issue.route,
      title: `Greptile ${result.verification.status}`,
      detail: result.verification.summary,
      status: result.verification.status === 'passed' ? 'passed' : result.verification.status === 'stale' ? 'stale' : 'failed',
      artifactUrl: result.artifactUrl,
      relatedId: result.verification.verifiedSha ?? issue.pullRequest.headSha,
      filesTouched: result.verification.filesTouched,
    });

    return NextResponse.json({ ok: result.ok, verification: persisted.viewModel, error: result.errorMessage ?? null }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Greptile verification error.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
