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
      add column if not exists closed_at timestamptz
  `);

  await client.query(`
    create table if not exists maintaineros_import_runs (
      id text primary key,
      provider text not null default 'github',
      owner text not null,
      repo text not null,
      requested_limit integer not null,
      imported_issue_count integer not null default 0,
      imported_pull_request_count integer not null default 0,
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
      add column if not exists imported_pull_request_count integer not null default 0,
      add column if not exists skipped_pull_request_count integer not null default 0,
      add column if not exists status text not null default 'pending',
      add column if not exists source_state text not null default 'live',
      add column if not exists started_at timestamptz not null default now(),
      add column if not exists finished_at timestamptz,
      add column if not exists error_message text
  `);

  await client.query(`
    create table if not exists maintaineros_pull_requests (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      number integer not null,
      title text not null,
      body text not null default '',
      author text not null default 'unknown',
      branch_name text not null default '',
      head_sha text,
      base_branch text not null default '',
      html_url text not null,
      state text not null default 'open',
      draft boolean not null default false,
      merged_at timestamptz,
      linked_issue_number integer,
      created_at timestamptz,
      updated_at timestamptz,
      closed_at timestamptz,
      unique(repository_id, number)
    )
  `);

  await client.query(`
    alter table maintaineros_pull_requests
      add column if not exists body text not null default '',
      add column if not exists author text not null default 'unknown',
      add column if not exists branch_name text not null default '',
      add column if not exists head_sha text,
      add column if not exists base_branch text not null default '',
      add column if not exists state text not null default 'open',
      add column if not exists draft boolean not null default false,
      add column if not exists merged_at timestamptz,
      add column if not exists linked_issue_number integer,
      add column if not exists closed_at timestamptz
  `);

  await client.query(`
    create table if not exists maintaineros_pull_request_comments (
      id text primary key,
      repository_id text not null references maintaineros_repositories(id) on delete cascade,
      pull_request_number integer not null,
      provider text not null default 'greptile',
      author text not null default 'unknown',
      body text not null default '',
      html_url text not null,
      path text,
      line integer,
      created_at timestamptz,
      updated_at timestamptz,
      unique(repository_id, pull_request_number, id)
    )
  `);

  await client.query(`
    create index if not exists idx_maintaineros_pull_requests_repository
    on maintaineros_pull_requests(repository_id, updated_at desc, number desc)
  `);

  await client.query(`
    create index if not exists idx_maintaineros_pull_request_comments_pr
    on maintaineros_pull_request_comments(repository_id, pull_request_number)
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
}
