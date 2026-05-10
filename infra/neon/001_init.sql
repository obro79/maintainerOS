-- MaintainerOS Neon schema.
-- Apply with a database-owner connection string before running live imports.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS repositories (
  id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'github',
  owner text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL UNIQUE,
  default_branch text NOT NULL DEFAULT 'main',
  visibility text NOT NULL DEFAULT 'public',
  html_url text NOT NULL,
  description text,
  owner_user_id text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_maintainers (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
  id text PRIMARY KEY,
  repository_id text NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'github',
  provider_issue_id text,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text NOT NULL DEFAULT 'open',
  author_login text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments_count integer NOT NULL DEFAULT 0,
  html_url text NOT NULL,
  github_created_at timestamptz,
  github_updated_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, number)
);

CREATE INDEX IF NOT EXISTS idx_issues_repository_state ON issues(repository_id, state);
CREATE INDEX IF NOT EXISTS idx_issues_labels ON issues USING gin(labels);

CREATE TABLE IF NOT EXISTS issue_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  route text NOT NULL CHECK (route IN ('agent-solvable', 'maintainer-review', 'bounty-worthy', 'close-or-clarify')),
  complexity_score integer NOT NULL CHECK (complexity_score BETWEEN 1 AND 10),
  risk_score integer NOT NULL CHECK (risk_score BETWEEN 1 AND 10),
  confidence numeric(4, 3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  rationale text NOT NULL,
  model_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id)
);

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  title text NOT NULL,
  route text NOT NULL CHECK (route IN ('agent-solvable', 'maintainer-review', 'bounty-worthy', 'close-or-clarify')),
  summary text NOT NULL,
  acceptance_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'dispatched', 'blocked', 'completed', 'canceled')),
  assignee_kind text NOT NULL DEFAULT 'unassigned' CHECK (assignee_kind IN ('unassigned', 'agent', 'maintainer', 'contributor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github',
  number integer,
  title text NOT NULL,
  base_branch text,
  branch_name text,
  head_sha text,
  html_url text NOT NULL,
  author_login text,
  author_owner_type text NOT NULL DEFAULT 'unknown' CHECK (author_owner_type IN ('automation', 'human', 'unknown')),
  automation_owned boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'draft', 'merged', 'closed')),
  linked_at timestamptz,
  merged_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id uuid NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'greptile',
  status text NOT NULL CHECK (status IN ('pending', 'passed', 'failed', 'stale')),
  summary text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  files_touched jsonb NOT NULL DEFAULT '[]'::jsonb,
  files_inspected jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocking_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_sha text,
  current_sha text,
  risk_summary text NOT NULL DEFAULT '',
  failure_reason text,
  artifact_url text,
  source_state text NOT NULL DEFAULT 'live',
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'funded', 'claimed', 'submitted', 'approved', 'paid', 'canceled')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  rationale text NOT NULL,
  funded_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id)
);

CREATE TABLE IF NOT EXISTS payment_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'allscale',
  status text NOT NULL CHECK (status IN ('draft', 'ready', 'released', 'failed')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  artifact_url text,
  external_id text,
  release_reason text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id text REFERENCES issues(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'clod',
  model text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('triage', 'routing', 'work-order', 'verification-summary', 'bounty-pricing')),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  estimated_cost_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed', 'fallback')),
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'issue_classifications_model_run_fk'
  ) THEN
    ALTER TABLE issue_classifications
      ADD CONSTRAINT issue_classifications_model_run_fk
      FOREIGN KEY (model_run_id)
      REFERENCES model_runs(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS repositories_set_updated_at ON repositories;
CREATE TRIGGER repositories_set_updated_at
BEFORE UPDATE ON repositories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS demo_maintainers_set_updated_at ON demo_maintainers;
CREATE TRIGGER demo_maintainers_set_updated_at
BEFORE UPDATE ON demo_maintainers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS issues_set_updated_at ON issues;
CREATE TRIGGER issues_set_updated_at
BEFORE UPDATE ON issues
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS issue_classifications_set_updated_at ON issue_classifications;
CREATE TRIGGER issue_classifications_set_updated_at
BEFORE UPDATE ON issue_classifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS work_orders_set_updated_at ON work_orders;
CREATE TRIGGER work_orders_set_updated_at
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS pull_requests_set_updated_at ON pull_requests;
CREATE TRIGGER pull_requests_set_updated_at
BEFORE UPDATE ON pull_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS verification_runs_set_updated_at ON verification_runs;
CREATE TRIGGER verification_runs_set_updated_at
BEFORE UPDATE ON verification_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bounties_set_updated_at ON bounties;
CREATE TRIGGER bounties_set_updated_at
BEFORE UPDATE ON bounties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS payment_artifacts_set_updated_at ON payment_artifacts;
CREATE TRIGGER payment_artifacts_set_updated_at
BEFORE UPDATE ON payment_artifacts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
