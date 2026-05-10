import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  ".env.example",
  "infra/neon/001_init.sql",
  "infra/neon/002_optional_auth_rls.sql",
  "infra/neon/003_seed_demo.sql",
  "data/mock-repos/index.json",
  "data/mock-repos/maintaineros-demo-large.json",
  "data/mock-repos/maintaineros-demo-medium.json"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required prep file: ${file}`);
  }
}

const schema = readFileSync("infra/neon/001_init.sql", "utf8");
const runtimeSchema = readFileSync("lib/maintaineros/postgres.ts", "utf8");
const tables = [
  "repositories",
  "demo_maintainers",
  "issues",
  "issue_classifications",
  "work_orders",
  "pull_requests",
  "verification_runs",
  "bounties",
  "payment_artifacts",
  "model_runs"
];

for (const table of tables) {
  if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`Schema missing table: ${table}`);
  }
}

const providerRunColumns = [
  "run_id text",
  "artifact_url text",
  "log_url text",
  "screenshot_url text",
  "status text not null",
  "source_state text not null",
  "occurred_at timestamptz not null"
];

const importRunColumns = [
  "requested_limit integer not null",
  "imported_issue_count integer not null",
  "skipped_pull_request_count integer not null",
  "status text not null",
  "source_state text not null",
  "started_at timestamptz not null",
  "finished_at timestamptz",
  "error_message text"
];

const issueColumns = [
  "repository_id text not null",
  "number integer not null",
  "title text not null",
  "body text not null",
  "author text not null",
  "labels jsonb not null",
  "comments_count integer not null",
  "html_url text not null",
  "state text not null",
  "closed_at timestamptz"
];

const pullRequestContractColumns = [
  "head_sha text",
  "author_owner_type text not null",
  "automation_owned boolean not null",
  "linked_at timestamptz",
  "closed_at timestamptz"
];

const verificationContractColumns = [
  "criteria jsonb not null",
  "files_inspected jsonb not null",
  "blocking_findings jsonb not null",
  "verified_sha text",
  "current_sha text",
  "failure_reason text",
  "source_state text not null"
];

for (const column of providerRunColumns) {
  if (!runtimeSchema.toLowerCase().includes(column)) {
    throw new Error(`Provider run schema missing proof column: ${column}`);
  }
}

for (const column of importRunColumns) {
  if (!runtimeSchema.toLowerCase().includes(column)) {
    throw new Error(`Import run schema missing persistence column: ${column}`);
  }
}

for (const column of issueColumns) {
  if (!runtimeSchema.toLowerCase().includes(column)) {
    throw new Error(`Issue schema missing persistence column: ${column}`);
  }
}

const staticSchema = schema.toLowerCase();
for (const column of pullRequestContractColumns) {
  if (!staticSchema.includes(column)) {
    throw new Error(`Static PR schema missing PR gate column: ${column}`);
  }
}

for (const column of verificationContractColumns) {
  if (!staticSchema.includes(column)) {
    throw new Error(`Static verification schema missing Greptile column: ${column}`);
  }
}

for (const alterTable of ["maintaineros_provider_runs", "maintaineros_import_runs", "maintaineros_issues"]) {
  if (!runtimeSchema.includes(`alter table ${alterTable}`)) {
    throw new Error(`${alterTable} schema must include ALTER TABLE backfill for existing Neon databases`);
  }
}

const typeContracts = readFileSync("lib/maintaineros/types.ts", "utf8");
for (const contract of ["ExecutionRouteOwner", "RouteContract", "ROUTE_CONTRACTS", "owner: 'ai'", "owner: 'dev'", "owner: 'clustly'"]) {
  if (!typeContracts.includes(contract)) {
    throw new Error(`Shared route/artifact contracts missing ${contract}`);
  }
}

if (!runtimeSchema.includes("alter table maintaineros_provider_runs")) {
  throw new Error("Provider run schema must include ALTER TABLE backfill for existing Neon databases");
}

for (const field of ["sourceState: ArtifactSourceState", "artifactUrl?: string", "screenshotUrl?: string", "logUrl?: string", "occurredAt?: string"]) {
  if (!typeContracts.includes(field)) {
    throw new Error(`Sponsor proof type missing ${field}`);
  }
}

const payoutGate = readFileSync("lib/maintaineros/payout.ts", "utf8");
for (const guard of [
  "No pull request is linked.",
  "No verification run is linked.",
  "Verification has not passed.",
  "Verification is stale after PR changes.",
  "Maintainer has not accepted the verified work."
]) {
  if (!payoutGate.includes(guard)) {
    throw new Error(`Payout release gate missing guard: ${guard}`);
  }
}

const fixtureRepository = readFileSync("lib/maintaineros/fixture-repository.ts", "utf8");
if (!fixtureRepository.includes("costEvidence: 'known'") || !fixtureRepository.includes("costEvidence: 'unknown'")) {
  throw new Error("Fixture eval data must include both known and unknown cost evidence");
}

const clodProvider = readFileSync("lib/maintaineros/clod.ts", "utf8");
if (!clodProvider.includes("premiumBaselineCents: null")) {
  throw new Error("Live CLōD pricing must keep unknown premium baseline costs null");
}

const repository = readFileSync("lib/maintaineros/repository.ts", "utf8");
for (const fallbackCall of [
  ".getDashboard(repositoryId)",
  ".getIssueDetail(repositoryId, issueNumber)",
  ".getIssueTrace(repositoryId, issueNumber)",
  ".getSandboxAttempts(repositoryId)",
  ".getVerificationQueue(repositoryId)",
  ".getBountyTasks(repositoryId)"
]) {
  if (!repository.includes(fallbackCall)) {
    throw new Error(`Live repository fallback must preserve requested repository id for ${fallbackCall}`);
  }
}

const daytona = readFileSync("lib/maintaineros/daytona.ts", "utf8");
for (const preservedAttempt of ["Sandbox attempt failed", "Failed sandbox attempt preserved", "Escalation policy"]) {
  if (!daytona.includes(preservedAttempt)) {
    throw new Error(`Sandbox trace must preserve failed attempt evidence: ${preservedAttempt}`);
  }
}

const routeHistory = readFileSync("lib/maintaineros/route-history.ts", "utf8");
for (const historyGuard of ["status === 'failed'", "status === 'escalated'", "mergeRouteHistory"]) {
  if (!routeHistory.includes(historyGuard)) {
    throw new Error(`Route history must preserve failed/escalated attempts: ${historyGuard}`);
  }
}

const fixtureIndex = JSON.parse(readFileSync("data/mock-repos/index.json", "utf8"));
const expectedCounts = new Map(
  fixtureIndex.repositories.map((repo) => [repo.id, repo.issueCount])
);

for (const [repoId, expectedCount] of expectedCounts) {
  const fixture = JSON.parse(readFileSync(`data/mock-repos/${repoId}.json`, "utf8"));
  if (fixture.repository.id !== repoId) {
    throw new Error(`Fixture ${repoId} has wrong repository id`);
  }
  if (fixture.issues.length !== expectedCount) {
    throw new Error(`Fixture ${repoId} expected ${expectedCount} issues, got ${fixture.issues.length}`);
  }
  for (const issue of fixture.issues) {
    if (!issue.classification?.route || !issue.workOrder || !issue.modelRun) {
      throw new Error(`Issue ${issue.id} is missing route/workOrder/modelRun data`);
    }
  }
}

const largeFixture = JSON.parse(readFileSync("data/mock-repos/maintaineros-demo-large.json", "utf8"));
const nonClustlyArtifactIssue = largeFixture.issues.find(
  (issue) => issue.classification?.route !== "bounty-worthy" && issue.paymentArtifact
);

if (!nonClustlyArtifactIssue) {
  throw new Error("Expected a non-bounty fixture issue with a raw payment artifact for payout suppression coverage");
}

console.log("MaintainerOS prep check passed.");
