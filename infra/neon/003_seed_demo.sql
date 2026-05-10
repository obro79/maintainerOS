-- MaintainerOS deterministic demo seed.
-- Safe to re-run. It resets only the seeded MaintainerOS demo rows.

INSERT INTO demo_maintainers (id, email, name, role)
VALUES ('demo-maintainer', 'demo@maintaineros.dev', 'MaintainerOS Demo Maintainer', 'owner')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO repositories (
  id,
  owner,
  name,
  full_name,
  default_branch,
  visibility,
  html_url,
  description,
  owner_user_id
)
VALUES
  (
    'maintaineros-demo-large',
    'maintaineros',
    'ledgerkit',
    'maintaineros/ledgerkit',
    'main',
    'public',
    'https://github.com/maintaineros/ledgerkit',
    'Payment ledger library with a long-lived maintainer backlog.',
    'demo-maintainer'
  ),
  (
    'maintaineros-demo-medium',
    'maintaineros',
    'hooksmith',
    'maintaineros/hooksmith',
    'main',
    'public',
    'https://github.com/maintaineros/hooksmith',
    'React hooks utility repo with mixed bugs, docs gaps, and feature requests.',
    'demo-maintainer'
  )
ON CONFLICT (id) DO UPDATE
SET owner = EXCLUDED.owner,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    html_url = EXCLUDED.html_url,
    description = EXCLUDED.description,
    owner_user_id = EXCLUDED.owner_user_id;

DELETE FROM issues
WHERE repository_id IN ('maintaineros-demo-large', 'maintaineros-demo-medium');

WITH repo_specs AS (
  SELECT 'maintaineros-demo-large'::text AS repository_id, 'maintaineros/ledgerkit'::text AS full_name, 400::integer AS issue_count
  UNION ALL
  SELECT 'maintaineros-demo-medium'::text, 'maintaineros/hooksmith'::text, 200::integer
),
seed_issues AS (
  SELECT
    repo_specs.repository_id,
    repo_specs.full_name,
    issue_number,
    CASE issue_number % 8
      WHEN 0 THEN 'Incorrect cache invalidation when webhook replay changes'
      WHEN 1 THEN 'Document invoice sync setup for new contributors'
      WHEN 2 THEN 'Add regression coverage for pagination edge cases'
      WHEN 3 THEN 'Untangle rate limits dependency boundary'
      WHEN 4 THEN 'Support configurable token refresh policies'
      WHEN 5 THEN 'Review branch previews permissions after dependency upgrade'
      WHEN 6 THEN 'Implement schema migrations adapter with acceptance test suite'
      ELSE 'Clarify vague report about worker retries failures'
    END AS title,
    CASE issue_number % 8
      WHEN 0 THEN '["bug", "cache"]'::jsonb
      WHEN 1 THEN '["documentation", "good first issue"]'::jsonb
      WHEN 2 THEN '["tests", "help wanted"]'::jsonb
      WHEN 3 THEN '["refactor", "maintainer-review"]'::jsonb
      WHEN 4 THEN '["enhancement", "needs design"]'::jsonb
      WHEN 5 THEN '["security", "priority"]'::jsonb
      WHEN 6 THEN '["bounty", "integration"]'::jsonb
      ELSE '["needs reproduction", "triage"]'::jsonb
    END AS labels,
    CASE issue_number % 8
      WHEN 6 THEN 'bounty-worthy'
      WHEN 7 THEN 'close-or-clarify'
      WHEN 3 THEN 'maintainer-review'
      WHEN 4 THEN 'maintainer-review'
      WHEN 5 THEN 'maintainer-review'
      ELSE 'agent-solvable'
    END AS route
  FROM repo_specs
  CROSS JOIN LATERAL generate_series(1, repo_specs.issue_count) AS issue_number
),
inserted_issues AS (
  INSERT INTO issues (
    id,
    repository_id,
    provider_issue_id,
    number,
    title,
    body,
    state,
    author_login,
    labels,
    comments_count,
    html_url,
    github_created_at,
    github_updated_at
  )
  SELECT
    repository_id || '-' || issue_number,
    repository_id,
    repository_id || '-gh-' || issue_number,
    issue_number,
    title,
    'Seeded demo issue. MaintainerOS route target: ' || route || '.',
    'open',
    'contributor-' || ((issue_number % 37) + 1),
    labels,
    (issue_number * 7) % 23,
    'https://github.com/' || full_name || '/issues/' || issue_number,
    now() - ((issue_number % 90) || ' days')::interval,
    now() - ((issue_number % 30) || ' days')::interval
  FROM seed_issues
  RETURNING id, number, repository_id
),
inserted_model_runs AS (
  INSERT INTO model_runs (
    issue_id,
    provider,
    model,
    purpose,
    input_tokens,
    output_tokens,
    latency_ms,
    estimated_cost_cents,
    status,
    rationale
  )
  SELECT
    seed_issues.repository_id || '-' || seed_issues.issue_number,
    'clod',
    CASE
      WHEN seed_issues.issue_number % 8 IN (1, 2) THEN 'fast-small'
      WHEN seed_issues.issue_number % 8 IN (0, 6, 7) THEN 'balanced'
      ELSE 'deep-reasoner'
    END,
    'routing',
    900 + seed_issues.issue_number,
    220 + (seed_issues.issue_number % 80),
    450 + ((seed_issues.issue_number % 8) * 140),
    CASE
      WHEN seed_issues.issue_number % 8 IN (1, 2) THEN 1
      WHEN seed_issues.issue_number % 8 IN (0, 6, 7) THEN 4
      ELSE 12
    END,
    'succeeded',
    'CLOD selected model tier from fixture complexity and risk.'
  FROM seed_issues
  RETURNING id, issue_id
),
inserted_classifications AS (
  INSERT INTO issue_classifications (
    issue_id,
    route,
    complexity_score,
    risk_score,
    confidence,
    rationale,
    model_run_id
  )
  SELECT
    seed_issues.repository_id || '-' || seed_issues.issue_number,
    seed_issues.route,
    CASE seed_issues.route
      WHEN 'agent-solvable' THEN 2 + (seed_issues.issue_number % 3)
      WHEN 'bounty-worthy' THEN 6
      WHEN 'close-or-clarify' THEN 4
      ELSE 7
    END,
    CASE seed_issues.route
      WHEN 'agent-solvable' THEN 2 + (seed_issues.issue_number % 2)
      WHEN 'bounty-worthy' THEN 5
      WHEN 'close-or-clarify' THEN 4
      ELSE 8
    END,
    0.82,
    'Seeded classification for demo route: ' || seed_issues.route || '.',
    inserted_model_runs.id
  FROM seed_issues
  JOIN inserted_model_runs
    ON inserted_model_runs.issue_id = seed_issues.repository_id || '-' || seed_issues.issue_number
  RETURNING issue_id
),
inserted_work_orders AS (
  INSERT INTO work_orders (
    issue_id,
    title,
    route,
    summary,
    acceptance_checks,
    suggested_files,
    status,
    assignee_kind
  )
  SELECT
    seed_issues.repository_id || '-' || seed_issues.issue_number,
    'Work order for #' || seed_issues.issue_number,
    seed_issues.route,
    'Generated demo work order for ' || seed_issues.route || '.',
    '["Reproduce or explain the issue.", "Make the smallest scoped change.", "Attach proof artifact."]'::jsonb,
    '["src/demo-target.ts", "tests/demo-target.test.ts"]'::jsonb,
    CASE WHEN seed_issues.route = 'close-or-clarify' THEN 'blocked' ELSE 'ready' END,
    CASE seed_issues.route
      WHEN 'agent-solvable' THEN 'agent'
      WHEN 'bounty-worthy' THEN 'contributor'
      WHEN 'maintainer-review' THEN 'maintainer'
      ELSE 'unassigned'
    END
  FROM seed_issues
  RETURNING id, issue_id
),
hero_prs AS (
  INSERT INTO pull_requests (
    issue_id,
    work_order_id,
    number,
    title,
    branch_name,
    html_url,
    author_login,
    status,
    merged_at
  )
  SELECT
    inserted_work_orders.issue_id,
    inserted_work_orders.id,
    9000 + row_number() OVER (),
    'Fix seeded MaintainerOS issue ' || inserted_work_orders.issue_id,
    'maintaineros/' || inserted_work_orders.issue_id,
    'https://github.com/maintaineros/demo/pull/' || (9000 + row_number() OVER ()),
    CASE WHEN seed_issues.route = 'agent-solvable' THEN 'codex-agent' ELSE 'bounty-contributor' END,
    'merged',
    now()
  FROM inserted_work_orders
  JOIN seed_issues
    ON inserted_work_orders.issue_id = seed_issues.repository_id || '-' || seed_issues.issue_number
  WHERE seed_issues.issue_number IN (1, 7)
  RETURNING id, issue_id
),
hero_verifications AS (
  INSERT INTO verification_runs (
    pull_request_id,
    provider,
    status,
    summary,
    checks,
    source_sha,
    completed_at
  )
  SELECT
    hero_prs.id,
    'greptile',
    'passed',
    'Seeded Greptile verification passed acceptance checks.',
    '["tests passed", "acceptance checks matched", "no risky diff detected"]'::jsonb,
    'demo-sha-' || hero_prs.issue_id,
    now()
  FROM hero_prs
  RETURNING id
),
inserted_bounties AS (
  INSERT INTO bounties (
    issue_id,
    status,
    amount_cents,
    currency,
    rationale,
    funded_at,
    approved_at,
    paid_at
  )
  SELECT
    seed_issues.repository_id || '-' || seed_issues.issue_number,
    CASE WHEN seed_issues.issue_number = 7 THEN 'paid' ELSE 'funded' END,
    15000 + ((seed_issues.issue_number % 8) * 5000),
    'USD',
    'Integration-shaped issue with bounded acceptance checks.',
    now(),
    CASE WHEN seed_issues.issue_number = 7 THEN now() ELSE NULL END,
    CASE WHEN seed_issues.issue_number = 7 THEN now() ELSE NULL END
  FROM seed_issues
  WHERE seed_issues.route = 'bounty-worthy'
  RETURNING id, issue_id, amount_cents, currency
)
INSERT INTO payment_artifacts (
  bounty_id,
  provider,
  status,
  amount_cents,
  currency,
  artifact_url,
  external_id,
  release_reason,
  released_at
)
SELECT
  inserted_bounties.id,
  'clustly',
  CASE WHEN inserted_bounties.issue_id LIKE '%-7' THEN 'released' ELSE 'ready' END,
  inserted_bounties.amount_cents,
  inserted_bounties.currency,
  'https://clustly.ai/tasks/' || inserted_bounties.issue_id,
  'clustly-demo-' || inserted_bounties.issue_id,
  CASE WHEN inserted_bounties.issue_id LIKE '%-7' THEN 'Merged PR passed verification and maintainer accepted bounty.' ELSE NULL END,
  CASE WHEN inserted_bounties.issue_id LIKE '%-7' THEN now() ELSE NULL END
FROM inserted_bounties;
