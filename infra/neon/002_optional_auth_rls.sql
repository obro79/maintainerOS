-- Optional Neon Auth / RLS layer.
-- Use this only if the demo needs signed-in users. The hackathon MVP can run
-- server-side with DATABASE_URL and no RLS.

CREATE EXTENSION IF NOT EXISTS pg_session_jwt;

ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner_user_id text;

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY repositories_owner_all ON repositories
  FOR ALL
  USING (owner_user_id IS NULL OR owner_user_id = auth.user_id())
  WITH CHECK (owner_user_id IS NULL OR owner_user_id = auth.user_id());

CREATE POLICY issues_repo_owner_all ON issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM repositories
      WHERE repositories.id = issues.repository_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repositories
      WHERE repositories.id = issues.repository_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

-- Keep the remaining tables protected through their issue relationship.
CREATE POLICY issue_classifications_repo_owner_all ON issue_classifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM issues
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE issues.id = issue_classifications.issue_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY work_orders_repo_owner_all ON work_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM issues
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE issues.id = work_orders.issue_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY pull_requests_repo_owner_all ON pull_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM issues
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE issues.id = pull_requests.issue_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY verification_runs_repo_owner_all ON verification_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pull_requests
      JOIN issues ON issues.id = pull_requests.issue_id
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE pull_requests.id = verification_runs.pull_request_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY bounties_repo_owner_all ON bounties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM issues
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE issues.id = bounties.issue_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY payment_artifacts_repo_owner_all ON payment_artifacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bounties
      JOIN issues ON issues.id = bounties.issue_id
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE bounties.id = payment_artifacts.bounty_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );

CREATE POLICY model_runs_repo_owner_all ON model_runs
  FOR ALL USING (
    issue_id IS NULL OR EXISTS (
      SELECT 1 FROM issues
      JOIN repositories ON repositories.id = issues.repository_id
      WHERE issues.id = model_runs.issue_id
        AND (repositories.owner_user_id IS NULL OR repositories.owner_user_id = auth.user_id())
    )
  );
