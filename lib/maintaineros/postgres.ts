import { createRequire } from 'node:module';

export type PgClient = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

type PgPoolClient = PgClient & {
  release(): void;
};

type PgPool = {
  connect(): Promise<PgPoolClient>;
};

type PgPoolConstructor = new (options: { connectionString: string; ssl?: { rejectUnauthorized: boolean }; connectionTimeoutMillis?: number }) => PgPool;

const require = createRequire(import.meta.url);
let pool: PgPool | null = null;
let schemaReady: Promise<void> | null = null;

export function getDatabaseUrl() {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
}

export function hasNeonConnection() {
  return Boolean(getDatabaseUrl());
}

export async function withPostgres<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await ensureSchemaReady(client);
    return await fn(client);
  } finally {
    client.release();
  }
}

function getPool() {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL or DATABASE_URL is required for live MaintainerOS data.');
  }

  const { Pool } = require('pg') as { Pool: PgPoolConstructor };
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=disable') ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: Number(process.env.MAINTAINEROS_POSTGRES_CONNECTION_TIMEOUT_MS || '3000'),
  });
  return pool;
}

async function ensureSchemaReady(client: PgClient) {
  schemaReady ??= ensureMaintainerSchema(client);
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

async function ensureMaintainerSchema(client: PgClient) {
  await client.query(`
    create table if not exists maintaineros_repositories (
      id text primary key,
      provider text not null default 'github',
      owner text not null,
      name text not null,
      full_name text not null,
      html_url text not null,
      open_issue_count integer not null default 0,
      imported_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists maintaineros_issues (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      number integer not null,
      title text not null,
      body text not null default '',
      author text not null,
      labels jsonb not null default '[]'::jsonb,
      comments_count integer not null default 0,
      html_url text not null,
      state text not null default 'open',
      created_at timestamptz,
      updated_at timestamptz,
      closed_at timestamptz,
      unique(repository_id, number)
    )
  `);

  await client.query(`
    alter table maintaineros_issues
      add column if not exists provider text not null default 'github',
      add column if not exists body text not null default '',
      add column if not exists author text not null default 'unknown',
      add column if not exists labels jsonb not null default '[]'::jsonb,
      add column if not exists comments_count integer not null default 0,
      add column if not exists state text not null default 'open',
      add column if not exists closed_at timestamptz,
      add column if not exists provider_issue_id text,
      add column if not exists node_id text,
      add column if not exists author_metadata jsonb not null default '{}'::jsonb,
      add column if not exists author_association text,
      add column if not exists assignees jsonb not null default '[]'::jsonb,
      add column if not exists milestone jsonb,
      add column if not exists labels_full jsonb not null default '[]'::jsonb,
      add column if not exists reactions jsonb,
      add column if not exists comments_url text,
      add column if not exists events_url text,
      add column if not exists timeline_url text,
      add column if not exists repository_url text,
      add column if not exists api_url text,
      add column if not exists state_reason text,
      add column if not exists locked boolean not null default false,
      add column if not exists active_lock_reason text,
      add column if not exists raw_payload jsonb not null default '{}'::jsonb
  `);

  await client.query(`
    create table if not exists maintaineros_import_runs (
      id text primary key,
      provider text not null default 'github',
      owner text not null,
      repo text not null,
      requested_limit integer not null,
      imported_issue_count integer not null default 0,
      skipped_pull_request_count integer not null default 0,
      status text not null,
      source_state text not null default 'live',
      started_at timestamptz not null,
      finished_at timestamptz,
      error_message text
    )
  `);

  await client.query(`
    alter table maintaineros_import_runs
      add column if not exists provider text not null default 'github',
      add column if not exists requested_limit integer not null default 0,
      add column if not exists imported_issue_count integer not null default 0,
      add column if not exists skipped_pull_request_count integer not null default 0,
      add column if not exists status text not null default 'pending',
      add column if not exists source_state text not null default 'live',
      add column if not exists started_at timestamptz not null default now(),
      add column if not exists finished_at timestamptz,
      add column if not exists error_message text
  `);

  await client.query(`
    create table if not exists maintaineros_provider_runs (
      id text primary key,
      provider text not null,
      purpose text not null,
      status text not null,
      source_state text not null,
      repository_id text,
      issue_number integer,
      run_id text,
      artifact_url text,
      log_url text,
      screenshot_url text,
      latency_ms integer,
      error_message text,
      request_meta jsonb not null default '{}'::jsonb,
      response_meta jsonb not null default '{}'::jsonb,
      occurred_at timestamptz not null default now()
    )
  `);

  await client.query(`
    alter table maintaineros_provider_runs
      add column if not exists run_id text,
      add column if not exists log_url text,
      add column if not exists screenshot_url text
  `);

  await client.query(`
    create index if not exists idx_maintaineros_provider_runs_provider
    on maintaineros_provider_runs(provider, occurred_at desc)
  `);

  await client.query(`
    create table if not exists maintaineros_pull_requests (
      id text primary key,
      repository_id text not null,
      issue_number integer not null,
      issue_id text,
      work_order_id text,
      provider text not null default 'github',
      number integer not null,
      title text not null,
      base_branch text,
      branch_name text not null,
      head_sha text not null,
      html_url text not null,
      author_login text not null,
      author_owner_type text not null default 'unknown',
      automation_owned boolean not null default false,
      status text not null default 'open',
      linked_at timestamptz,
      merged_at timestamptz,
      closed_at timestamptz,
      source_state text not null default 'live',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(repository_id, number)
    )
  `);

  await client.query(`
    alter table maintaineros_pull_requests
      add column if not exists issue_id text,
      add column if not exists work_order_id text,
      add column if not exists base_branch text,
      add column if not exists head_sha text not null default 'unknown',
      add column if not exists author_owner_type text not null default 'unknown',
      add column if not exists automation_owned boolean not null default false,
      add column if not exists linked_at timestamptz,
      add column if not exists merged_at timestamptz,
      add column if not exists closed_at timestamptz,
      add column if not exists source_state text not null default 'live'
  `);

  await client.query(`
    create index if not exists idx_maintaineros_pull_requests_issue
    on maintaineros_pull_requests(repository_id, issue_number, updated_at desc)
  `);

  await client.query(`
    create table if not exists maintaineros_verification_runs (
      id text primary key,
      pull_request_id text not null,
      provider text not null default 'greptile',
      status text not null,
      summary text not null,
      criteria jsonb not null default '[]'::jsonb,
      files_touched jsonb not null default '[]'::jsonb,
      files_inspected jsonb not null default '[]'::jsonb,
      blocking_findings jsonb not null default '[]'::jsonb,
      verified_sha text,
      current_sha text,
      risk_summary text not null default '',
      failure_reason text,
      verified_at timestamptz,
      artifact_url text,
      source_state text not null default 'live',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    alter table maintaineros_verification_runs
      add column if not exists criteria jsonb not null default '[]'::jsonb,
      add column if not exists files_touched jsonb not null default '[]'::jsonb,
      add column if not exists files_inspected jsonb not null default '[]'::jsonb,
      add column if not exists blocking_findings jsonb not null default '[]'::jsonb,
      add column if not exists verified_sha text,
      add column if not exists current_sha text,
      add column if not exists risk_summary text not null default '',
      add column if not exists failure_reason text,
      add column if not exists verified_at timestamptz,
      add column if not exists artifact_url text,
      add column if not exists source_state text not null default 'live'
  `);

  await client.query(`
    create index if not exists idx_maintaineros_verification_runs_pr
    on maintaineros_verification_runs(pull_request_id, updated_at desc)
  `);

  await client.query(`
    create table if not exists maintaineros_trace_events (
      id text primary key,
      repository_id text not null,
      issue_number integer,
      provider text,
      source_state text not null,
      status text not null,
      title text not null,
      detail text not null,
      artifact_url text,
      related_id text,
      payload jsonb not null default '{}'::jsonb,
      occurred_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create index if not exists idx_maintaineros_trace_events_issue
    on maintaineros_trace_events(repository_id, issue_number, occurred_at desc)
  `);

  await client.query(`
    create table if not exists maintaineros_bounties (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      issue_number integer not null,
      status text not null default 'proposed',
      amount_cents integer not null,
      currency text not null default 'USD',
      rationale text not null,
      maintainer_accepted boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(repository_id, issue_number)
    )
  `);

  await client.query(`
    create table if not exists maintaineros_payment_artifacts (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      issue_number integer not null,
      bounty_id text not null references maintaineros_bounties(id) on delete cascade,
      provider text not null default 'clustly',
      source_state text not null default 'live',
      status text not null,
      task_id text,
      task_url text,
      claim_id text,
      claimer_kind text,
      funding_mode text,
      amount_cents integer not null,
      currency text not null default 'USDC',
      artifact_url text,
      release_reason text not null,
      raw_response jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(repository_id, issue_number)
    )
  `);
}
