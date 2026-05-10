import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createDemoSessionId, DEMO_SCENARIO_COOKIE, DEMO_SESSION_COOKIE, DEFAULT_DEMO_SCENARIO_ID } from '@/lib/maintaineros/demo-scenarios';
import { deleteRehearsalTraceEvents } from '@/lib/maintaineros/trace-events';

export async function POST() {
  const cookieStore = await cookies();
  const previousSessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  const deletedEvents = previousSessionId ? await deleteRehearsalTraceEvents(previousSessionId) : 0;

  cookieStore.set(DEMO_SESSION_COOKIE, createDemoSessionId(), { path: '/', sameSite: 'lax' });
  cookieStore.set(DEMO_SCENARIO_COOKIE, DEFAULT_DEMO_SCENARIO_ID, { path: '/', sameSite: 'lax' });

  return NextResponse.json({
    ok: true,
    deletedEvents,
    message: deletedEvents > 0 ? `Reset rehearsal state and removed ${deletedEvents} replay event(s).` : 'Reset local demo state.',
  });
}
