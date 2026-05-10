import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';
import { LiveClustlyProvider } from '@/lib/maintaineros/payments';
import { isClustlyEligibleRoute } from '@/lib/maintaineros/payout';
import { withPostgres } from '@/lib/maintaineros/postgres';
import { ensureBounty, persistPaymentArtifact } from '@/lib/maintaineros/workflow-state';
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
    if (!isClustlyEligibleRoute(issue)) {
      return NextResponse.json({ ok: false, error: 'Only bounty-worthy issues can create Clustly tasks.' }, { status: 409 });
    }

    const bounty = await withPostgres((client) => ensureBounty(client, {
      repositoryId,
      issueNumber,
      amountCents: numberBody(body.amountCents) ?? issue.bounty?.amountCents ?? 15000,
      rationale: stringBody(body.rationale) || issue.bounty?.rationale || 'MaintainerOS routed this issue to bounded paid work.',
    }));
    const issueWithBounty = { ...issue, bounty: bounty.viewModel };
    const provider = new LiveClustlyProvider();
    const startedAt = Date.now();
    const task = await provider.createTask(issueWithBounty);
    if (!task) return NextResponse.json({ ok: false, error: 'Clustly task was not created.' }, { status: 409 });

    const persisted = await withPostgres((client) => persistPaymentArtifact(client, {
      repositoryId,
      issueNumber,
      bountyId: bounty.id,
      artifact: task,
      rawResponse: { taskId: task.taskId, taskUrl: task.taskUrl, status: task.status },
    }));

    await recordProviderRun({
      provider: 'clustly',
      purpose: 'create-task',
      status: 'succeeded',
      sourceState: 'live',
      repositoryId,
      issueNumber,
      runId: task.taskId,
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      latencyMs: Date.now() - startedAt,
      responseMeta: { status: task.status, amountCents: task.amountCents },
    });
    await recordTraceEvent({
      repositoryId,
      issueNumber,
      actor: 'Clustly task rail',
      provider: 'clustly',
      sourceState: 'live',
      route: issue.route,
      title: 'Clustly task posted',
      detail: `${task.currency} ${(task.amountCents / 100).toFixed(0)} bounty task created.`,
      status: 'succeeded',
      artifactUrl: task.taskUrl ?? task.artifactUrl,
      relatedId: task.taskId,
      costCents: task.amountCents,
    });

    return NextResponse.json({ ok: true, bounty: bounty.viewModel, task: persisted.viewModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Clustly task creation error.';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('CLUSTLY') ? 424 : 502 });
  }
}

function stringBody(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberBody(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}
