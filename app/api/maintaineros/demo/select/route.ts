import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createDemoSessionId, DEMO_SCENARIO_COOKIE, DEMO_SESSION_COOKIE, getDemoScenario, isDemoScenarioId } from '@/lib/maintaineros/demo-scenarios';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scenarioId = typeof body.scenarioId === 'string' ? body.scenarioId : '';
  if (!isDemoScenarioId(scenarioId)) {
    return NextResponse.json({ ok: false, error: 'Unknown demo scenario.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  if (!cookieStore.get(DEMO_SESSION_COOKIE)?.value) {
    cookieStore.set(DEMO_SESSION_COOKIE, createDemoSessionId(), { path: '/', sameSite: 'lax' });
  }
  cookieStore.set(DEMO_SCENARIO_COOKIE, scenarioId, { path: '/', sameSite: 'lax' });

  return NextResponse.json({
    ok: true,
    scenario: getDemoScenario(scenarioId),
    message: 'Scenario selected.',
  });
}
