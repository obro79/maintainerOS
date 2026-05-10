import type { ProviderKey } from './types';
import type { ProviderCallResult, ProviderRunStatus } from './provider-runtime';
import { hasNeonConnection, withPostgres } from './postgres';

export interface ProviderRunInput {
  provider: ProviderKey;
  status: ProviderRunStatus;
  sourceState: string;
  purpose: string;
  repositoryId?: string | null;
  issueNumber?: number | null;
  artifactUrl?: string | null;
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
          (id, provider, purpose, status, source_state, repository_id, issue_number, artifact_url, latency_ms, error_message, request_meta, response_meta, occurred_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)`,
        [
          id,
          input.provider,
          input.purpose,
          input.status,
          input.sourceState,
          input.repositoryId ?? null,
          input.issueNumber ?? null,
          input.artifactUrl ?? null,
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
  });
}
