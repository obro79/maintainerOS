import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { LiveClustlyProvider } from '@/lib/maintaineros/payments';
import { canReleasePayout } from '@/lib/maintaineros/payout';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { bountyId, persistPaymentArtifact, updateBountyStatus } from '@/lib/maintaineros/workflow-state';
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
    const claimId = stringBody(body.claimId);
    if (!repositoryId || !Number.isInteger(issueNumber) || issueNumber < 1) {
      return NextResponse.json({ ok: false, error: 'repositoryId and positive issueNumber are required.' }, { status: 400 });
    }

    const issue = await getMaintainerOSRepository().getIssueDetail(repositoryId, issueNumber);
    if (!issue) return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 });
    const gate = canReleasePayout(issue);
    if (!gate.canRelease) {
      await recordTraceEvent({
        repositoryId,
        issueNumber,
        actor: 'MaintainerOS payout gate',
        provider: 'clustly',
        sourceState: 'live',
        route: issue.route,
        title: 'Payout gate blocked',
        detail: gate.reasons.join(' '),
        status: 'blocked',
        artifactUrl: issue.paymentArtifact?.taskUrl ?? issue.paymentArtifact?.artifactUrl,
        relatedId: issue.paymentArtifact?.taskId,
        costCents: issue.paymentArtifact?.amountCents,
      });
      return NextResponse.json({ ok: false, blocked: true, gate }, { status: 409 });
    }

    const taskId = issue.paymentArtifact?.taskId;
    const releaseClaimId = claimId || issue.paymentArtifact?.claimId;
    if (!taskId || !releaseClaimId) {
      return NextResponse.json({ ok: false, error: 'taskId and claimId are required before release.' }, { status: 409 });
    }

    const provider = new LiveClustlyProvider();
    const startedAt = Date.now();
    const task = await provider.approveClaim(taskId, releaseClaimId, issue);
    if (!task) return NextResponse.json({ ok: false, error: 'Clustly release did not return a task artifact.' }, { status: 502 });

    const [persisted, bounty] = await withPostgres(async (client) => {
      const persistedTask = await persistPaymentArtifact(client, {
        repositoryId,
        issueNumber,
        bountyId: bountyId(repositoryId, issueNumber),
        artifact: task,
        rawResponse: { taskId: task.taskId, taskUrl: task.taskUrl, status: task.status, claimId: task.claimId },
      });
      const persistedBounty = await updateBountyStatus(client, repositoryId, issueNumber, 'paid', true);
      return [persistedTask, persistedBounty] as const;
    });

    await recordProviderRun({
      provider: 'clustly',
      purpose: 'release',
      status: 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber,
      runId: task.taskId,
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      latencyMs: Date.now() - startedAt,
      responseMeta: { status: task.status, claimId: task.claimId },
    });
    await recordTraceEvent({
      repositoryId,
      issueNumber,
      actor: 'Clustly task rail',
      provider: 'clustly',
      sourceState: 'live',
      route: issue.route,
      title: 'Clustly payout released',
      detail: task.releaseReason,
      status: 'passed',
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      relatedId: task.taskId,
      costCents: task.amountCents,
    });

    return NextResponse.json({ ok: true, bounty, task: persisted.viewModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Clustly release error.';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('blocked') ? 409 : 502 });
  }
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
