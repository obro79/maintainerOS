import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = new URL("../data/mock-repos", import.meta.url);
mkdirSync(outDir, { recursive: true });

const repos = [
  {
    id: "maintaineros-demo-large",
    owner: "maintaineros",
    name: "ledgerkit",
    fullName: "maintaineros/ledgerkit",
    issueCount: Number(process.env.MAINTAINEROS_LARGE_FIXTURE_COUNT ?? 400),
    description: "Payment ledger library with a long-lived maintainer backlog."
  },
  {
    id: "maintaineros-demo-medium",
    owner: "maintaineros",
    name: "hooksmith",
    fullName: "maintaineros/hooksmith",
    issueCount: Number(process.env.MAINTAINEROS_MEDIUM_FIXTURE_COUNT ?? 200),
    description: "React hooks utility repo with mixed bugs, docs gaps, and feature requests."
  }
];

const templates = [
  {
    kind: "bug",
    title: "Incorrect cache invalidation when {area} changes",
    labels: ["bug", "cache"],
    complexity: 3,
    risk: 3
  },
  {
    kind: "docs",
    title: "Document {area} setup for new contributors",
    labels: ["documentation", "good first issue"],
    complexity: 1,
    risk: 1
  },
  {
    kind: "test",
    title: "Add regression coverage for {area} edge cases",
    labels: ["tests", "help wanted"],
    complexity: 2,
    risk: 2
  },
  {
    kind: "refactor",
    title: "Untangle {area} dependency boundary",
    labels: ["refactor", "maintainer-review"],
    complexity: 7,
    risk: 7
  },
  {
    kind: "feature",
    title: "Support configurable {area} policies",
    labels: ["enhancement", "needs design"],
    complexity: 8,
    risk: 6
  },
  {
    kind: "security",
    title: "Review {area} permissions after dependency upgrade",
    labels: ["security", "priority"],
    complexity: 6,
    risk: 9
  },
  {
    kind: "bounty",
    title: "Implement {area} adapter with acceptance test suite",
    labels: ["bounty", "integration"],
    complexity: 6,
    risk: 5
  },
  {
    kind: "triage",
    title: "Clarify vague report about {area} failures",
    labels: ["needs reproduction", "triage"],
    complexity: 4,
    risk: 4
  }
];

const areas = [
  "webhook replay",
  "invoice sync",
  "pagination",
  "rate limits",
  "token refresh",
  "branch previews",
  "schema migrations",
  "worker retries",
  "error reporting",
  "typed exports",
  "CLI bootstrap",
  "fixture loading",
  "authorization",
  "search indexing",
  "queue draining",
  "dependency scanning"
];

function routeFor(template) {
  if (template.labels.includes("bounty")) return "bounty-worthy";
  if (template.labels.includes("needs reproduction")) return "close-or-clarify";
  if (template.risk >= 7 || template.labels.includes("needs design")) return "maintainer-review";
  return "agent-solvable";
}

function amountFor(template, index) {
  if (routeFor(template) !== "bounty-worthy") return null;
  return 15000 + ((index % 8) * 5000);
}

function makeIssue(repo, index) {
  const template = templates[index % templates.length];
  const area = areas[index % areas.length];
  const route = routeFor(template);
  const number = index + 1;
  const id = `${repo.id}-${number}`;
  const complexity = Math.min(10, template.complexity + (index % 3));
  const risk = Math.min(10, template.risk + (index % 2));
  const confidence = Number((0.72 + ((index % 20) / 100)).toFixed(2));
  const amountCents = amountFor(template, index);
  const staleNonClustlyPaymentArtifact = repo.id === "maintaineros-demo-large" && number === 5;

  return {
    id,
    repositoryId: repo.id,
    number,
    title: template.title.replace("{area}", area),
    body: [
      `Seeded issue for ${repo.fullName}.`,
      `Area: ${area}.`,
      `MaintainerOS route target: ${route}.`,
      "This record is deterministic fixture data for backlog-scale demos."
    ].join("\n"),
    state: "open",
    author: `contributor-${(index % 37) + 1}`,
    labels: template.labels,
    commentsCount: (index * 7) % 23,
    htmlUrl: `https://github.com/${repo.fullName}/issues/${number}`,
    createdAt: new Date(Date.UTC(2026, 0, 1 + (index % 90))).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 3, 1 + (index % 30))).toISOString(),
    classification: {
      route,
      complexityScore: complexity,
      riskScore: risk,
      confidence,
      rationale: `${route} because complexity=${complexity}, risk=${risk}, labels=${template.labels.join(", ")}.`
    },
    workOrder: {
      title: `Work order for #${number}`,
      status: route === "close-or-clarify" ? "blocked" : "ready",
      assigneeKind:
        route === "agent-solvable"
          ? "agent"
          : route === "bounty-worthy"
            ? "contributor"
            : route === "maintainer-review"
              ? "maintainer"
              : "unassigned",
      acceptanceChecks: [
        "Reproduce or explain the issue from the fixture description.",
        "Make the smallest scoped change that satisfies the route rationale.",
        "Add or update at least one acceptance check artifact."
      ],
      suggestedFiles: [
        `src/${area.replaceAll(" ", "-")}.ts`,
        `tests/${area.replaceAll(" ", "-")}.test.ts`
      ]
    },
    bounty: amountCents
      ? {
          status: index % 16 === 6 ? "paid" : "funded",
          amountCents,
          currency: "USD",
          rationale: "Integration-shaped work with bounded acceptance checks."
        }
      : null,
    verification: route === "agent-solvable" || route === "bounty-worthy"
      ? {
          provider: "greptile",
          status: index % 11 === 0 ? "pending" : "passed",
          summary: "Fixture verification result for demo proof panel."
        }
      : null,
    paymentArtifact: amountCents || staleNonClustlyPaymentArtifact
      ? {
          provider: "clustly",
          status: amountCents && index % 16 === 6 ? "released" : staleNonClustlyPaymentArtifact ? "failed" : "ready",
          amountCents: amountCents ?? 25000,
          currency: "USDC",
          artifactUrl: `https://clustly.ai/tasks/${id}`,
          releaseReason: staleNonClustlyPaymentArtifact
            ? "Stale external artifact retained in raw fixture data to verify MaintainerOS hides payouts for non-CLUSTLY routes."
            : undefined
        }
      : null,
    modelRun: {
      provider: "clod",
      model: complexity <= 3 ? "fast-small" : complexity <= 6 ? "balanced" : "deep-reasoner",
      purpose: "routing",
      estimatedCostCents: complexity <= 3 ? 1 : complexity <= 6 ? 4 : 12,
      latencyMs: 400 + complexity * 130,
      status: "succeeded"
    }
  };
}

const index = [];

for (const repo of repos) {
  const issues = Array.from({ length: repo.issueCount }, (_, issueIndex) => makeIssue(repo, issueIndex));
  const payload = {
    repository: {
      id: repo.id,
      provider: "github",
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      defaultBranch: "main",
      visibility: "public",
      htmlUrl: `https://github.com/${repo.fullName}`,
      description: repo.description,
      generatedAt: new Date("2026-05-07T00:00:00.000Z").toISOString()
    },
    summary: {
      issueCount: issues.length,
      routes: issues.reduce((counts, issue) => {
        counts[issue.classification.route] = (counts[issue.classification.route] ?? 0) + 1;
        return counts;
      }, {})
    },
    issues
  };

  const fileName = `${repo.id}.json`;
  writeFileSync(join(outDir.pathname, fileName), `${JSON.stringify(payload, null, 2)}\n`);
  index.push({
    id: repo.id,
    file: `data/mock-repos/${fileName}`,
    fullName: repo.fullName,
    issueCount: repo.issueCount
  });
}

writeFileSync(join(outDir.pathname, "index.json"), `${JSON.stringify({ repositories: index }, null, 2)}\n`);
console.log(`Generated ${index.length} mock repositories with ${index.reduce((sum, repo) => sum + repo.issueCount, 0)} issues.`);
