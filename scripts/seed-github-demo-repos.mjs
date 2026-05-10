import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const repoMap = new Map([
  ["maintaineros-demo-large", "obro79/maintaineros-demo-ledgerkit"],
  ["maintaineros-demo-medium", "obro79/maintaineros-demo-hooksmith"]
]);

const maxIssues = Number(process.env.MAINTAINEROS_GITHUB_SEED_LIMIT || "0");

function gh(args, input) {
  const result = spawnSync("gh", args, {
    input,
    encoding: "utf8",
    stdio: input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function ensureLabel(repo, name, color, description) {
  const result = spawnSync("gh", [
    "label",
    "create",
    name,
    "--repo",
    repo,
    "--color",
    color,
    "--description",
    description,
    "--force"
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(`Failed to create label ${name} in ${repo}:\n${result.stderr || result.stdout}`);
}

function existingIssueCount(repo) {
  const output = gh(["issue", "list", "--repo", repo, "--state", "all", "--limit", "1000", "--json", "number"]);
  const parsed = output ? JSON.parse(output) : [];
  return parsed.reduce((max, issue) => Math.max(max, issue.number), 0);
}

const labelColors = new Map([
  ["agent-solvable", ["2da44e", "MaintainerOS route: safe to dispatch to agent"]],
  ["maintainer-review", ["bf8700", "MaintainerOS route: needs maintainer judgment"]],
  ["bounty-worthy", ["8250df", "MaintainerOS route: bounded paid work"]],
  ["close-or-clarify", ["57606a", "MaintainerOS route: clarify, reproduce, or close"]],
  ["maintaineros-demo", ["0969da", "Seeded MaintainerOS demo issue"]],
  ["allscale-bounty", ["a371f7", "AllScale payout lane demo issue"]],
  ["greptile-verify", ["1f883d", "Greptile verification lane demo issue"]],
  ["clod-routed", ["0a7ea4", "CLOD model-routing demo issue"]]
]);

const defaultLabel = ["d0d7de", "Seeded source label from the demo backlog"];

for (const [fixtureId, githubRepo] of repoMap) {
  const fixture = JSON.parse(readFileSync(`data/mock-repos/${fixtureId}.json`, "utf8"));
  const existingCount = process.env.MAINTAINEROS_GITHUB_RESEED === "true" ? 0 : existingIssueCount(githubRepo);
  const targetCount = maxIssues > 0 ? Math.min(maxIssues, fixture.issues.length) : fixture.issues.length;

  for (const [label, [color, description]] of labelColors) {
    ensureLabel(githubRepo, label, color, description);
  }

  const allLabels = new Set();
  for (const issue of fixture.issues.slice(existingCount, targetCount)) {
    allLabels.add(issue.classification.route);
    allLabels.add("maintaineros-demo");
    allLabels.add("clod-routed");
    for (const label of issue.labels) allLabels.add(label);
    if (issue.classification.route === "bounty-worthy") {
      allLabels.add("allscale-bounty");
      allLabels.add("greptile-verify");
    }
    if (issue.classification.route === "agent-solvable") {
      allLabels.add("greptile-verify");
    }
  }

  for (const label of allLabels) {
    const [color, description] = labelColors.get(label) ?? defaultLabel;
    ensureLabel(githubRepo, label, color, description);
  }

  const issues = fixture.issues.slice(existingCount, targetCount);
  if (issues.length === 0) {
    console.log(`${githubRepo} already has ${existingCount} issues; target is ${targetCount}.`);
    continue;
  }

  for (const issue of issues) {
    const route = issue.classification.route;
    const labels = [
      "maintaineros-demo",
      "clod-routed",
      route,
      ...issue.labels
    ];

    if (route === "bounty-worthy") labels.push("allscale-bounty", "greptile-verify");
    if (route === "agent-solvable") labels.push("greptile-verify");

    const body = [
      issue.body,
      "",
      "## MaintainerOS Seed",
      `- Fixture ID: \`${issue.id}\``,
      `- Route: \`${route}\``,
      `- Complexity: ${issue.classification.complexityScore}/10`,
      `- Risk: ${issue.classification.riskScore}/10`,
      `- Confidence: ${issue.classification.confidence}`,
      `- CLOD model: \`${issue.modelRun.model}\``,
      issue.bounty ? `- AllScale bounty: $${(issue.bounty.amountCents / 100).toFixed(2)} ${issue.bounty.currency}` : "- AllScale bounty: none",
      "",
      "## Acceptance Checks",
      ...issue.workOrder.acceptanceChecks.map((check) => `- [ ] ${check}`),
      "",
      "## Suggested Files",
      ...issue.workOrder.suggestedFiles.map((file) => `- \`${file}\``)
    ].join("\n");

    gh([
      "issue",
      "create",
      "--repo",
      githubRepo,
      "--title",
      issue.title,
      "--body",
      body,
      "--label",
      Array.from(new Set(labels)).join(",")
    ]);
  }

  console.log(`Seeded ${issues.length} issues into ${githubRepo}; target count is ${targetCount}.`);
}
