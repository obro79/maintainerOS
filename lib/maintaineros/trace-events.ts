import { hasNeonConnection, withPostgres, type PgClient } from './postgres';
import type { ArtifactSourceState, ExecutionRoute, IssueTraceEventViewModel, ProviderKey } from './types';

interface TraceEventRow {
  id: string;
  provider: ProviderKey | null;
  source_state: ArtifactSourceState;
  status: IssueTraceEventViewModel['status'];
  title: string;
  detail: string;
  artifact_url: string | null;
  related_id: string | null;
  payload: string | Record<string, unknown>;
  occurred_at: Date | string;
}

export async function recordTraceEvent(repositoryId: string, issueNumber: number, event: IssueTraceEventViewModel) {
  if (!hasNeonConnection()) return null;
  try {
    await withPostgres(async (client) => {
      await client.query(
        `insert into maintaineros_trace_events
          (id, repository_id, issue_number, provider, source_state, status, title, detail, artifact_url, related_id, payload, occurred_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
         on conflict (id) do nothing`,
        [
          event.id,
          repositoryId,
          issueNumber,
          event.provider ?? null,
          event.sourceState ?? 'live',
          event.status,
          event.title,
          event.detail,
          event.artifactUrl ?? null,
          event.relatedId ?? null,
          JSON.stringify({
            actor: event.actor,
            route: event.route,
            model: event.model,
            costCents: event.costCents,
            filesTouched: event.filesTouched,
          }),
          event.at,
        ],
      );
    });
    return event.id;
  } catch {
    return null;
  }
}

export async function listTraceEvents(client: PgClient, repositoryId: string, issueNumber: number) {
  const result = await client.query<TraceEventRow>(
    `select id, provider, source_state, status, title, detail, artifact_url, related_id, payload, occurred_at
     from maintaineros_trace_events
     where repository_id = $1 and issue_number = $2
     order by occurred_at asc`,
    [repositoryId, issueNumber],
  );
  return result.rows.map(toTraceEvent);
}

function toTraceEvent(row: TraceEventRow): IssueTraceEventViewModel {
  const payload = normalizePayload(row.payload);
  return {
    id: row.id,
    at: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString(),
    actor: typeof payload.actor === 'string' ? payload.actor : row.provider ?? 'MaintainerOS',
    provider: row.provider ?? undefined,
    sourceState: row.source_state,
    route: isExecutionRoute(payload.route) ? payload.route : undefined,
    title: row.title,
    detail: row.detail,
    status: row.status,
    artifactUrl: row.artifact_url ?? undefined,
    relatedId: row.related_id ?? undefined,
    model: typeof payload.model === 'string' ? payload.model : undefined,
    costCents: typeof payload.costCents === 'number' ? payload.costCents : undefined,
    filesTouched: Array.isArray(payload.filesTouched) ? payload.filesTouched.filter((file): file is string => typeof file === 'string') : undefined,
  };
}

function normalizePayload(payload: TraceEventRow['payload']) {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isExecutionRoute(value: unknown): value is ExecutionRoute {
  return value === 'agent-solvable' || value === 'maintainer-review' || value === 'bounty-worthy' || value === 'close-or-clarify';
}
