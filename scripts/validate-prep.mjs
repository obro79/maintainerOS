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

for (const column of providerRunColumns) {
  if (!runtimeSchema.toLowerCase().includes(column)) {
    throw new Error(`Provider run schema missing proof column: ${column}`);
  }
}

if (!runtimeSchema.includes("alter table maintaineros_provider_runs")) {
  throw new Error("Provider run schema must include ALTER TABLE backfill for existing Neon databases");
}

const sponsorProofTypes = readFileSync("lib/maintaineros/types.ts", "utf8");
for (const field of ["sourceState: ArtifactSourceState", "artifactUrl?: string", "screenshotUrl?: string", "logUrl?: string", "occurredAt?: string"]) {
  if (!sponsorProofTypes.includes(field)) {
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
