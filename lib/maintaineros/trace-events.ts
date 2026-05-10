import type { ArtifactSourceState, ExecutionRoute, IssueTraceEventViewModel, ProviderKey } from './types';
import { hasNeonConnection, withPostgres } from './postgres';

interface TraceEventInput {
  id?: string;
  repositoryId: string;
  issueNumber: number;
  actor: string;
  provider?: ProviderKey;
  sourceState: ArtifactSourceState;
  route?: ExecutionRoute;
  title: string;
  detail: string;
  status: IssueTraceEventViewModel['status'];
  artifactUrl?: string | null;
  relatedId?: string | null;
  model?: string | null;
  costCents?: number | null;
  filesTouched?: string[];
  at?: string;
  payload?: Record<string, unknown>;
}

interface TraceEventRow {
  id: string;
  provider: ProviderKey | null;
  source_state: ArtifactSourceState;
  status: IssueTraceEventViewModel['status'];
  title: string;
  detail: string;
  artifact_url: string | null;
  related_id: string | null;
  payload: Record<string, unknown> | string | null;
  occurred_at: Date | string;
}

export function buildTraceEvent(input: TraceEventInput): IssueTraceEventViewModel {
  const at = input.at ?? new Date().toISOString();
  return {
    id: input.id ?? stableTraceId(input, at),
    at,
    actor: input.actor,
    provider: input.provider,
    sourceState: input.sourceState,
    route: input.route,
    title: input.title,
    detail: input.detail,
    status: input.status,
    artifactUrl: input.artifactUrl ?? undefined,
    relatedId: input.relatedId ?? undefined,
    model: input.model ?? undefined,
    costCents: input.costCents ?? undefined,
    filesTouched: input.filesTouched,
  };
}

export async function recordTraceEvent(input: TraceEventInput) {
  if (!hasNeonConnection()) return null;
  const event = buildTraceEvent(input);
  const payload = {
    ...(input.payload ?? {}),
    actor: event.actor,
    route: event.route,
    model: event.model,
    costCents: event.costCents,
    filesTouched: event.filesTouched,
  };

  try {
    await withPostgres(async (client) => {
      await client.query(
        `insert into maintaineros_trace_events
          (id, repository_id, issue_number, provider, source_state, status, title, detail, artifact_url, related_id, payload, occurred_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
         on conflict (id) do nothing`,
        [
          event.id,
          input.repositoryId,
          input.issueNumber,
          event.provider ?? null,
          event.sourceState ?? input.sourceState,
          event.status,
          event.title,
          event.detail,
          event.artifactUrl ?? null,
          event.relatedId ?? null,
          JSON.stringify(payload),
          event.at,
        ],
      );
    });
    return event;
  } catch {
    return null;
  }
}

export async function listPersistedTraceEvents(repositoryId: string, issueNumber: number): Promise<IssueTraceEventViewModel[]> {
  if (!hasNeonConnection()) return [];
  try {
    return await withPostgres(async (client) => {
      const result = await client.query<TraceEventRow>(
        `select id, provider, source_state, status, title, detail, artifact_url, related_id, payload, occurred_at
         from maintaineros_trace_events
         where repository_id = $1 and issue_number = $2
         order by occurred_at asc`,
        [repositoryId.toLowerCase(), issueNumber],
      );
      return result.rows.map(toTraceEvent);
    });
  } catch {
    return [];
  }
}

export async function deleteRehearsalTraceEvents(sessionId: string) {
  if (!hasNeonConnection()) return 0;
  try {
    return await withPostgres(async (client) => {
      const result = await client.query(
        `delete from maintaineros_trace_events
         where source_state = 'rehearsal' and payload->>'demoSessionId' = $1`,
        [sessionId],
      );
      return result.rowCount ?? 0;
    });
  } catch {
    return 0;
  }
}

export function mergeTraceEvents(derived: IssueTraceEventViewModel[], persisted: IssueTraceEventViewModel[]) {
  const seen = new Set<string>();
  return [...persisted, ...derived]
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function toTraceEvent(row: TraceEventRow): IssueTraceEventViewModel {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    at: toIso(row.occurred_at),
    actor: stringPayload(payload.actor) ?? row.provider ?? 'MaintainerOS',
    provider: row.provider ?? undefined,
    sourceState: row.source_state,
    route: routePayload(payload.route),
    title: row.title,
    detail: row.detail,
    status: row.status,
    artifactUrl: row.artifact_url ?? undefined,
    relatedId: row.related_id ?? undefined,
    model: stringPayload(payload.model),
    costCents: numberPayload(payload.costCents),
    filesTouched: Array.isArray(payload.filesTouched) ? payload.filesTouched.filter((item): item is string => typeof item === 'string') : undefined,
  };
}

function stableTraceId(input: TraceEventInput, at: string) {
  const base = `${input.repositoryId}-${input.issueNumber}-${input.provider ?? 'maintaineros'}-${input.status}-${input.title}-${at}`;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

function parsePayload(payload: TraceEventRow['payload']): Record<string, unknown> {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return payload;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function stringPayload(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function numberPayload(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function routePayload(value: unknown): ExecutionRoute | undefined {
  if (
    value === 'agent-solvable' ||
    value === 'maintainer-review' ||
    value === 'bounty-worthy' ||
    value === 'close-or-clarify'
  ) {
    return value;
  }
  return undefined;
}
