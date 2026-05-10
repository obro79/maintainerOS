import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { LiveClustlyProvider } from '@/lib/maintaineros/payments';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { bountyId, persistPaymentArtifact, updateBountyStatus } from '@/lib/maintaineros/workflow-state';
import { recordProviderRun } from '@/lib/maintaineros/provider-runs';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';
import type { BountyLifecycleStatus, PaymentArtifactViewModel } from '@/lib/maintaineros/types';
import { authorizeWorkflowMutation } from '@/lib/maintaineros/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const authError = authorizeWorkflowMutation(request);
    if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const repositoryId = stringBody(body.repositoryId);
    const issueNumber = Number(body.issueNumber);
    const requestedTaskId = stringBody(body.taskId);
    if (!repositoryId || !Number.isInteger(issueNumber) || issueNumber < 1) {
      return NextResponse.json({ ok: false, error: 'repositoryId and positive issueNumber are required.' }, { status: 400 });
    }

    const issue = await getMaintainerOSRepository().getIssueDetail(repositoryId, issueNumber);
    if (!issue) return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 });
    const taskId = requestedTaskId || issue.paymentArtifact?.taskId;
    if (!taskId || !issue.bounty) return NextResponse.json({ ok: false, error: 'A persisted Clustly task is required before sync.' }, { status: 409 });

    const provider = new LiveClustlyProvider();
    const startedAt = Date.now();
    const task = await provider.getTask(taskId, issue);
    if (!task) return NextResponse.json({ ok: false, error: 'Clustly task was not found.' }, { status: 404 });

    const status = bountyStatusFromTask(task.status);
    const [persisted, bounty] = await withPostgres(async (client) => {
      const persistedTask = await persistPaymentArtifact(client, {
        repositoryId,
        issueNumber,
        bountyId: bountyId(repositoryId, issueNumber),
        artifact: task,
        rawResponse: { taskId: task.taskId, taskUrl: task.taskUrl, status: task.status },
      });
      const persistedBounty = status ? await updateBountyStatus(client, repositoryId, issueNumber, status) : issue.bounty;
      return [persistedTask, persistedBounty] as const;
    });

    await recordProviderRun({
      provider: 'clustly',
      purpose: 'sync-task',
      status: 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber,
      runId: task.taskId,
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      latencyMs: Date.now() - startedAt,
      responseMeta: { status: task.status },
    });
    await recordTraceEvent({
      repositoryId,
      issueNumber,
      actor: 'Clustly task rail',
      provider: 'clustly',
      sourceState: 'live',
      route: issue.route,
      title: `Clustly task ${task.status}`,
      detail: task.releaseReason,
      status: task.status === 'failed' ? 'failed' : 'succeeded',
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      relatedId: task.taskId,
      costCents: task.amountCents,
    });

    return NextResponse.json({ ok: true, bounty, task: persisted.viewModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Clustly task sync error.';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('CLUSTLY') ? 424 : 502 });
  }
}

function bountyStatusFromTask(status: PaymentArtifactViewModel['status']): BountyLifecycleStatus | null {
  if (status === 'funded' || status === 'claimed' || status === 'submitted' || status === 'approved' || status === 'paid') return status;
  if (status === 'released') return 'paid';
  if (status === 'failed' || status === 'refunded') return 'canceled';
  return null;
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}
