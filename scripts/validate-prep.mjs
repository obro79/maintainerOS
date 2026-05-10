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

console.log("MaintainerOS prep check passed.");
