import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createDemoSessionId, DEMO_SESSION_COOKIE, getDemoScenario } from '@/lib/maintaineros/demo-scenarios';
import { importGitHubIssues } from '@/lib/maintaineros/github-import';
import { recordTraceEvent } from '@/lib/maintaineros/trace-events';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scenario = getDemoScenario(typeof body.scenarioId === 'string' ? body.scenarioId : null);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? createDemoSessionId();
  cookieStore.set(DEMO_SESSION_COOKIE, sessionId, { path: '/', sameSite: 'lax' });

  const target = githubTargetForScenario(scenario.repositoryId);
  try {
    const run = await importGitHubIssues({ ...target, limit: 40 });
    await recordTraceEvent({
      id: `${scenario.repositoryId}-${scenario.targetIssueNumber}-demo-rerun-import-${sessionId}`,
      repositoryId: scenario.repositoryId,
      issueNumber: scenario.targetIssueNumber,
      actor: 'Demo reset',
      provider: 'github',
      sourceState: 'rehearsal',
      route: scenario.expectedRoute,
      title: 'Rehearsal GitHub import rerun',
      detail: `Reran GitHub import for ${target.owner}/${target.repo}; ${run.importedIssueCount} issue(s) imported.`,
      status: run.status === 'failed' ? 'failed' : 'succeeded',
      relatedId: run.id,
      at: run.finishedAt ?? new Date().toISOString(),
      payload: { demoSessionId: sessionId, scenarioId: scenario.id },
    });
    return NextResponse.json({ ok: true, run, message: 'GitHub import rerun completed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub import rerun failed.';
    await recordTraceEvent({
      id: `${scenario.repositoryId}-${scenario.targetIssueNumber}-demo-rerun-import-failed-${sessionId}`,
      repositoryId: scenario.repositoryId,
      issueNumber: scenario.targetIssueNumber,
      actor: 'Demo reset',
      provider: 'github',
      sourceState: 'rehearsal',
      route: scenario.expectedRoute,
      title: 'Rehearsal GitHub import failed',
      detail: message,
      status: 'failed',
      payload: { demoSessionId: sessionId, scenarioId: scenario.id },
    });
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('GITHUB_TOKEN') ? 401 : 500 });
  }
}

function githubTargetForScenario(repositoryId: string) {
  if (repositoryId.includes('/')) {
    const [owner, repo] = repositoryId.split('/');
    return { owner, repo };
  }
  if (repositoryId.includes('medium')) return { owner: 'maintaineros', repo: 'hooksmith' };
  return { owner: 'maintaineros', repo: 'ledgerkit' };
}
