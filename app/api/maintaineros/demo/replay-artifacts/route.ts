import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createDemoSessionId, DEMO_SESSION_COOKIE, getDemoScenario } from '@/lib/maintaineros/demo-scenarios';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scenario = getDemoScenario(typeof body.scenarioId === 'string' ? body.scenarioId : null);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? createDemoSessionId();
  cookieStore.set(DEMO_SESSION_COOKIE, sessionId, { path: '/', sameSite: 'lax' });

  const now = Date.now();
  const base = {
    repositoryId: scenario.repositoryId,
    issueNumber: scenario.targetIssueNumber,
    sourceState: 'rehearsal' as const,
    route: scenario.expectedRoute,
    payload: { demoSessionId: sessionId, scenarioId: scenario.id },
  };
  const events = replayEventsForScenario(scenario.id).map((event, index) => ({
    ...base,
    ...event,
    id: `${scenario.repositoryId}-${scenario.targetIssueNumber}-${scenario.id}-${event.id}-${sessionId}`,
    at: new Date(now + index * 1000).toISOString(),
  }));

  const recorded = await Promise.all(events.map((event) => recordTraceEvent(event)));
  return NextResponse.json({
    ok: true,
    recordedCount: recorded.filter(Boolean).length,
    message: `Replayed ${events.length} provider artifact event(s).`,
  });
}

function replayEventsForScenario(scenarioId: string) {
  const common = [
    {
      id: 'clod-work-order',
      actor: 'CLōD model router',
      provider: 'clod' as const,
      title: 'CLōD work order replayed',
      detail: 'Rehearsal replay restored the route rationale and work-order artifact for the selected scenario.',
      status: 'passed' as const,
      model: 'DeepSeek V3',
      costCents: 2,
    },
    {
      id: 'nia-context',
      actor: 'Nia context pack',
      provider: 'nia' as const,
      title: 'Nia context pack replayed',
      detail: 'Rehearsal replay attached source snippets, citations, and suggested commands.',
      status: 'succeeded' as const,
      relatedId: 'nia-rehearsal-context',
    },
  ];

  if (scenarioId === 'failed-cheap-attempt') {
    return [
      ...common,
      {
        id: 'sandbox-failed',
        actor: 'Daytona-style sandbox',
        provider: 'daytona' as const,
        title: 'Cheap sandbox attempt failed',
        detail: 'The first low-cost attempt failed tests; logs and touched files remain preserved.',
        status: 'failed' as const,
        filesTouched: ['src/webhook-replay.ts'],
      },
      {
        id: 'reroute',
        actor: 'Escalation policy',
        title: 'Rerouted after failed attempt',
        detail: 'MaintainerOS preserved the failed attempt and escalated the issue for a stronger retry.',
        status: 'escalated' as const,
      },
    ];
  }

  if (scenarioId === 'stale-verification') {
    return [
      ...common,
      {
        id: 'pr-linked',
        actor: 'GitHub pull request',
        provider: 'github' as const,
        title: 'PR linked',
        detail: 'A PR artifact is linked to the issue and ready for verification checks.',
        status: 'succeeded' as const,
        relatedId: 'sha-rehearsal-new',
      },
      {
        id: 'greptile-stale',
        actor: 'Greptile verification',
        provider: 'greptile' as const,
        title: 'Verification marked stale',
        detail: 'The verified SHA differs from the current PR head; completion and payout remain blocked.',
        status: 'stale' as const,
        relatedId: 'sha-rehearsal-old',
      },
    ];
  }

  if (scenarioId === 'bounty-release-blocked' || scenarioId === 'bounty-released') {
    return [
      ...common,
      {
        id: 'clustly-task',
        actor: 'Clustly task',
        provider: 'clustly' as const,
        title: 'Clustly task replayed',
        detail: 'A bounded paid-work task is attached to the bounty-worthy issue.',
        status: 'succeeded' as const,
        costCents: 25000,
      },
      {
        id: 'release-gate',
        actor: 'Clustly release gate',
        provider: 'clustly' as const,
        title: scenarioId === 'bounty-released' ? 'Release gate passed' : 'Release gate blocked',
        detail: scenarioId === 'bounty-released'
          ? 'Fresh verification and maintainer acceptance are present, so release can proceed.'
          : 'Release remains blocked until fresh verification and maintainer acceptance are present.',
        status: scenarioId === 'bounty-released' ? 'passed' as const : 'blocked' as const,
      },
    ];
  }

  return [
    ...common,
    {
      id: 'greptile-passed',
      actor: 'Greptile verification',
      provider: 'greptile' as const,
      title: 'Verification passed',
      detail: 'The current PR head satisfies the work-order acceptance checks.',
      status: 'passed' as const,
      relatedId: 'sha-rehearsal-pass',
    },
  ];
}
