import type { ArtifactSourceState, ProviderKey, SponsorProofViewModel } from './types';
import type { ProviderCallResult, ProviderRunStatus } from './provider-runtime';
import { buildSponsorProofFromProviderRun, SPONSOR_PROOF_PROVIDERS } from './sponsor-proof';
import { hasNeonConnection, withPostgres, type PgClient } from './postgres';

export interface ProviderRunInput {
  provider: ProviderKey;
  status: ProviderRunStatus;
  sourceState: string;
  purpose: string;
  repositoryId?: string | null;
  issueNumber?: number | null;
  runId?: string | null;
  artifactUrl?: string | null;
  logUrl?: string | null;
  screenshotUrl?: string | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  requestMeta?: Record<string, unknown> | null;
  responseMeta?: Record<string, unknown> | null;
}

export async function recordProviderRun(input: ProviderRunInput) {
  if (!hasNeonConnection()) return null;
  const id = `${input.provider}-${input.purpose}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const occurredAt = new Date().toISOString();

  try {
    await withPostgres(async (client) => {
      await client.query(
        `insert into maintaineros_provider_runs
          (id, provider, purpose, status, source_state, repository_id, issue_number, run_id, artifact_url, log_url, screenshot_url, latency_ms, error_message, request_meta, response_meta, occurred_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16)`,
        [
          id,
          input.provider,
          input.purpose,
          input.status,
          input.sourceState,
          input.repositoryId ?? null,
          input.issueNumber ?? null,
          input.runId ?? null,
          input.artifactUrl ?? null,
          input.logUrl ?? null,
          input.screenshotUrl ?? null,
          input.latencyMs ?? null,
          input.errorMessage ?? null,
          JSON.stringify(input.requestMeta ?? {}),
          JSON.stringify(input.responseMeta ?? {}),
          occurredAt,
        ],
      );
    });
    return { id, occurredAt };
  } catch {
    return null;
  }
}

export async function recordProviderCallResult<TArtifact>(
  purpose: string,
  result: ProviderCallResult<TArtifact>,
  meta: Omit<ProviderRunInput, 'provider' | 'status' | 'sourceState' | 'purpose' | 'latencyMs' | 'errorMessage'> = {},
) {
  return recordProviderRun({
    ...meta,
    provider: result.provider,
    purpose,
    status: result.status,
    sourceState: result.sourceState,
    latencyMs: result.latencyMs,
    errorMessage: result.errorMessage,
    runId: meta.runId ?? result.runId ?? null,
    artifactUrl: meta.artifactUrl ?? result.artifactUrl ?? null,
    logUrl: meta.logUrl ?? result.logUrl ?? null,
    screenshotUrl: meta.screenshotUrl ?? result.screenshotUrl ?? null,
  });
}

interface ProviderRunProofRow {
  id: string;
  provider: ProviderKey;
  purpose: string;
  status: ProviderRunStatus;
  source_state: ArtifactSourceState;
  run_id: string | null;
  artifact_url: string | null;
  log_url: string | null;
  screenshot_url: string | null;
  error_message: string | null;
  response_meta: Record<string, unknown> | string | null;
  occurred_at: Date | string;
}

export async function listSponsorProofRuns(client: PgClient, repositoryId?: string | null): Promise<SponsorProofViewModel[]> {
  const result = await client.query<ProviderRunProofRow>(
    `select distinct on (provider)
        id, provider, purpose, status, source_state, run_id, artifact_url, log_url, screenshot_url, error_message, response_meta, occurred_at
       from maintaineros_provider_runs
      where provider in ('github', 'neon', 'clod', 'nia', 'daytona', 'greptile', 'clustly')
        and ($1::text is null or repository_id = $1 or repository_id is null)
      order by provider, (repository_id = $1) desc, occurred_at desc`,
    [repositoryId ?? null],
  );

  const byProvider = new Map(result.rows.map((row) => [row.provider, row]));
  return SPONSOR_PROOF_PROVIDERS
    .map((provider) => byProvider.get(provider))
    .filter((row): row is ProviderRunProofRow => Boolean(row))
    .map((row) =>
      buildSponsorProofFromProviderRun({
        id: row.id,
        provider: row.provider,
        purpose: row.purpose,
        status: row.status,
        sourceState: row.source_state,
        runId: row.run_id,
        artifactUrl: row.artifact_url,
        logUrl: row.log_url,
        screenshotUrl: row.screenshot_url,
        errorMessage: row.error_message,
        responseMeta: normalizeResponseMeta(row.response_meta),
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString(),
      }),
    );
}

function normalizeResponseMeta(value: ProviderRunProofRow['response_meta']) {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
