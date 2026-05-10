import { ROUTE_LABEL, type ExecutionRoute, type IssueDetailViewModel, type IssueTraceEventViewModel, type RouteAttemptViewModel } from './types';

export function buildInitialRouteAttempt(issue: Pick<IssueDetailViewModel, 'id' | 'route' | 'rationale' | 'modelRun'>, occurredAt: string, evidenceEventIds: string[] = []): RouteAttemptViewModel {
  return {
    id: `${issue.id}-route-attempt-1`,
    sequence: 1,
    fromRoute: null,
    toRoute: issue.route,
    trigger: 'initial-route',
    status: 'selected',
    reason: issue.rationale,
    occurredAt,
    sourceState: issue.modelRun.sourceState,
    model: issue.modelRun.model,
    costCents: issue.modelRun.estimatedCostCents ?? undefined,
    evidenceEventIds,
  };
}

export function buildRouteHistoryFromTrace(issue: Pick<IssueDetailViewModel, 'id' | 'route' | 'rationale' | 'modelRun'>, trace: IssueTraceEventViewModel[]): RouteAttemptViewModel[] {
  const sorted = [...trace].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const routeEvents = sorted.filter(isRouteHistoryEvent);
  const attempts: RouteAttemptViewModel[] = [];
  let lastRoute: ExecutionRoute | null = null;
  let failedRoute: ExecutionRoute | null = null;

  for (const event of routeEvents) {
    const toRoute = event.route ?? issue.route;
    const isFailure = event.status === 'failed';
    const isEscalation = event.status === 'escalated';
    const status: RouteAttemptViewModel['status'] = isFailure ? 'failed' : isEscalation ? 'superseded' : 'selected';

    attempts.push({
      id: `${event.id}-route-attempt`,
      sequence: attempts.length + 1,
      fromRoute: isEscalation ? failedRoute ?? lastRoute : null,
      toRoute,
      trigger: isEscalation ? 'reroute' : isFailure ? 'retry' : attempts.length === 0 ? 'initial-route' : 'reroute',
      status,
      reason: event.detail || `${ROUTE_LABEL[toRoute]} route selected.`,
      occurredAt: event.at,
      sourceState: event.sourceState,
      model: event.model,
      costCents: event.costCents,
      evidenceEventIds: [event.id],
    });

    if (isFailure) {
      failedRoute = toRoute;
    } else {
      lastRoute = toRoute;
      failedRoute = null;
    }
  }

  if (attempts.length === 0) {
    attempts.push(buildInitialRouteAttempt(issue, issue.modelRun.createdAt ?? new Date().toISOString()));
  }

  return attempts;
}

export function mergeRouteHistory(base: RouteAttemptViewModel[], next: RouteAttemptViewModel[]) {
  const byId = new Map<string, RouteAttemptViewModel>();
  for (const attempt of [...base, ...next]) byId.set(attempt.id, attempt);
  return Array.from(byId.values())
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((attempt, index) => ({ ...attempt, sequence: index + 1 }));
}

function isRouteHistoryEvent(event: IssueTraceEventViewModel) {
  if (event.status === 'routed') return true;
  if (event.status === 'escalated' && event.actor.toLowerCase().includes('escalation')) return true;
  if (event.status !== 'failed') return false;

  const title = event.title.toLowerCase();
  const actor = event.actor.toLowerCase();
  return title.includes('attempt') || actor.includes('agent') || event.provider === 'daytona' || event.provider === 'clod';
}
