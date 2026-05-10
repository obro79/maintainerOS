import { readFileSync } from 'node:fs';

const files = {
  routing: readFileSync('lib/maintaineros/routing.ts', 'utf8'),
  types: readFileSync('lib/maintaineros/types.ts', 'utf8'),
  workOrders: readFileSync('lib/maintaineros/work-orders.ts', 'utf8'),
  nia: readFileSync('lib/maintaineros/nia-context.ts', 'utf8'),
  daytona: readFileSync('lib/maintaineros/daytona.ts', 'utf8'),
  neonRepository: readFileSync('lib/maintaineros/neon-repository.ts', 'utf8'),
  postgres: readFileSync('lib/maintaineros/postgres.ts', 'utf8'),
  workflowState: readFileSync('lib/maintaineros/workflow-state.ts', 'utf8'),
  greptile: readFileSync('lib/maintaineros/greptile.ts', 'utf8'),
  payments: readFileSync('lib/maintaineros/payments.ts', 'utf8'),
  verification: readFileSync('lib/maintaineros/verification.ts', 'utf8'),
  payout: readFileSync('lib/maintaineros/payout.ts', 'utf8'),
  linkPrRoute: readFileSync('app/api/maintaineros/link-pr/route.ts', 'utf8'),
  verifyPrRoute: readFileSync('app/api/maintaineros/verify-pr/route.ts', 'utf8'),
  runAgentRoute: readFileSync('app/api/maintaineros/run-agent/route.ts', 'utf8'),
  clustlyReleaseRoute: readFileSync('app/api/maintaineros/clustly/release/route.ts', 'utf8'),
  prGates: readFileSync('lib/maintaineros/pr-gates.ts', 'utf8'),
  clod: readFileSync('lib/maintaineros/clod.ts', 'utf8'),
  clodRunEvidence: readFileSync('lib/maintaineros/clod-run-evidence.ts', 'utf8'),
  aiAttempts: readFileSync('lib/maintaineros/ai-attempts.ts', 'utf8'),
  agentExecution: readFileSync('lib/maintaineros/agent-execution.ts', 'utf8'),
};

assertIncludes(files.routing, 'evaluateRoutePolicy', 'routing exports the central route policy evaluator');
assertIncludes(files.routing, 'AI_CONFIDENCE_THRESHOLD', 'AI routing has a confidence gate');
assertIncludes(files.routing, 'HARD_BLOCK_LABELS', 'AI routing has hard-block labels');
assertIncludes(files.routing, 'SAFE_AGENT_LABELS', 'AI routing has explicit safe-label signals');
assertIncludes(files.routing, 'decision-needed', 'AI routing treats decision-needed as a hard blocker');
assertIncludes(files.routing, "route = 'maintainer-review'", 'unsafe AI candidates reroute to DEV/maintainer review');

assertIncludes(files.workOrders, 'buildDeterministicWorkOrder', 'deterministic work-order builder exists');
assertIncludes(files.workOrders, 'AI execution allowed', 'AI-safe work orders expose executable automation path');
assertIncludes(files.workOrders, 'DEV route: autonomous AI execution is blocked.', 'DEV briefs block autonomous AI execution');
assertIncludes(files.workOrders, 'Paid-work route: no autonomous AI sandbox dispatch.', 'CLUSTLY briefs block autonomous AI execution');

assertIncludes(files.types, "export type ContextMode = 'baseline' | 'nia-enriched'", 'shared context mode contract exists');
assertIncludes(files.types, 'providerRunId?: string', 'Nia context packs can carry provider run evidence');
assertIncludes(files.types, 'query?: string', 'Nia context packs preserve retrieval query');
assertIncludes(files.types, 'sourceIds?: string[]', 'Nia context packs preserve source identifiers');
assertIncludes(files.types, 'sourceUrl?: string', 'Nia citations can carry source URLs');
assertIncludes(files.types, 'score?: number', 'Nia citations can carry source scores');
assertIncludes(files.nia, 'DEFAULT_NIA_BASE_URL', 'Nia provider has a default API base URL');
assertIncludes(files.nia, "mode: 'query'", 'Nia provider uses the unified query search mode');
assertIncludes(files.nia, "search_mode: 'unified'", 'Nia provider uses unified search');
assertIncludes(files.nia, 'buildFixtureContextPackForIssue', 'Nia provider keeps deterministic fixture fallback');
assertIncludes(files.nia, 'recordProviderRun', 'Nia context requests record provider-run evidence when possible');
assertIncludes(files.nia, 'normalizeNiaCitations', 'Nia live responses are normalized into MaintainerOS citations');

assertIncludes(files.types, 'commandResults: SandboxCommandResultViewModel[]', 'sandbox attempts carry command results');
assertIncludes(files.types, "contextMode: ContextMode", 'sandbox attempts carry baseline vs Nia enriched mode');
assertIncludes(files.daytona, 'commandResults:', 'sandbox builder populates command results');
assertIncludes(files.daytona, "contextPackId: issue.contextPack?.id ?? null", 'sandbox attempts retain context pack id');
assertIncludes(files.daytona, "contextMode: issue.contextPack?.id ? 'nia-enriched' : 'baseline'", 'sandbox attempts derive context mode from context pack presence');
assertIncludes(files.daytona, 'routePolicy?.sandboxAllowed', 'sandbox dispatch uses route policy gate');
assertIncludes(files.daytona, 'Sandbox command runner', 'sandbox command results generate trace events');
assertIncludes(files.neonRepository, "contextMode: 'baseline'", 'live eval rows include baseline mode');
assertIncludes(files.neonRepository, "contextMode: 'nia-enriched'", 'live eval rows include Nia-enriched mode');
assertIncludes(files.neonRepository, "comparisonKind: 'planned'", 'live evals do not claim lift without verification evidence');
assertIncludes(files.neonRepository, 'buildNiaProviderStatus', 'live provider status reflects Nia runtime configuration');

assertIncludes(files.verification, 'verification.verifiedSha !== verification.currentSha', 'stale verification compares exact SHA mismatch');
assertIncludes(files.verification, "verification.status === 'stale'", 'explicit stale verification status remains blocking');
assertIncludes(files.verification, "effectiveStatus = isStale ? 'stale' : status", 'stale verification forces stale effective status');
assertIncludes(files.payout, 'isVerificationStale(issue.verification)', 'payout gate blocks stale verification');
for (const table of ['maintaineros_pull_requests', 'maintaineros_verification_runs', 'maintaineros_bounties', 'maintaineros_payment_artifacts']) {
  assertIncludes(files.postgres, table, `runtime schema includes ${table}`);
}
assertIncludes(files.workflowState, 'getWorkflowArtifacts', 'live repository can hydrate durable workflow artifacts');
assertIncludes(files.neonRepository, 'getWorkflowArtifacts', 'live issue detail reads durable workflow artifacts');
assertIncludes(files.linkPrRoute, 'persistPullRequest', 'PR linking persists a durable PR artifact');
assertIncludes(files.linkPrRoute, 'authorizeWorkflowMutation', 'PR linking requires workflow mutation authorization');
assertIncludes(files.linkPrRoute, 'must belong to the requested repositoryId', 'PR linking rejects cross-repository PR references');
assertIncludes(files.verifyPrRoute, 'verifyPullRequestWithGreptile', 'verification endpoint uses the Greptile provider adapter');
assertIncludes(files.verifyPrRoute, 'persistVerification', 'verification endpoint persists Greptile results');
assertIncludes(files.verifyPrRoute, 'authorizeWorkflowMutation', 'verification endpoint requires workflow mutation authorization');
assertIncludes(files.greptile, 'GREPTILE_API_KEY', 'Greptile adapter blocks when credentials are missing');
assertIncludes(files.payments, 'LiveClustlyProvider', 'Clustly live provider exists');
assertIncludes(files.clustlyReleaseRoute, 'authorizeWorkflowMutation', 'Clustly release endpoint requires workflow mutation authorization');
assertIncludes(files.clustlyReleaseRoute, 'canReleasePayout', 'Clustly release endpoint checks payout gate before provider release');
assertIncludes(files.clustlyReleaseRoute, 'blocked: true', 'Clustly release endpoint returns blocked state without release when gate fails');

assertIncludes(files.types, 'authorOwnerType', 'PR link model distinguishes automation, human, and unknown owners');
assertIncludes(files.types, 'automationOwned: boolean', 'PR link model exposes automation ownership');
assertIncludes(files.postgres, 'maintaineros_pull_requests', 'runtime schema stores durable PR links');
assertIncludes(files.postgres, 'author_owner_type text not null default', 'runtime PR schema stores owner type');
assertIncludes(files.postgres, 'automation_owned boolean not null default false', 'runtime PR schema stores automation ownership');
assertIncludes(files.postgres, 'maintaineros_verification_runs', 'runtime schema stores durable Greptile verification runs');
assertIncludes(files.postgres, 'files_inspected jsonb not null default', 'Greptile schema stores inspected files');
assertIncludes(files.postgres, 'blocking_findings jsonb not null default', 'Greptile schema stores findings');
assertIncludes(files.verification, 'buildGreptileVerificationAdapterResult', 'Greptile adapter normalizes durable verification runs');
assertIncludes(files.neonRepository, 'getLatestPullRequest', 'live repository hydrates persisted PR links');
assertIncludes(files.neonRepository, 'getLatestVerification', 'live repository hydrates persisted Greptile runs');

assertIncludes(files.prGates, 'evaluateSafeSquashMerge', 'safe squash merge decision helper exists');
assertIncludes(files.prGates, 'not_automation_owned', 'safe merge blocks human and unknown PRs');
assertIncludes(files.prGates, 'required_checks_not_passed', 'safe merge explains required check failures');
assertIncludes(files.prGates, 'human_commits_present', 'safe merge blocks human commits on automation branches');
assertIncludes(files.prGates, 'branch_protection_blocks_squash', 'safe merge respects branch protection');
assertIncludes(files.prGates, 'planFailedPrReroute', 'failed PR reroute decision helper exists');
assertIncludes(files.prGates, 'human_pr_untouched', 'failed PR reroute leaves human PRs untouched');
assertIncludes(files.prGates, 'preserve_trace', 'failed PR reroute preserves trace evidence');
assertIncludes(files.prGates, 'reroute_clustly', 'failed PR reroute can target CLUSTLY');
assertIncludes(files.prGates, 'reroute_dev', 'failed PR reroute can target DEV');

assertIncludes(files.routing, 'fallbackReason?: string | null', 'CLŌD model policy has explicit fallback selection input');
assertIncludes(files.routing, "tier: 'premium-fallback'", 'premium fallback tier is explicit, not default');
assertIncludes(files.clodRunEvidence, 'buildClodRunEvidenceMeta', 'CLŌD run metadata builder exists');
assertIncludes(files.clodRunEvidence, 'estimatedCostCents', 'CLŌD run evidence includes estimated cost');
assertIncludes(files.clodRunEvidence, 'premiumBaselineCents', 'CLŌD run evidence includes premium baseline');
assertIncludes(files.clodRunEvidence, 'inputTokens', 'CLŌD run evidence includes token counts');
assertIncludes(files.aiAttempts, 'buildAiSandboxAttemptResult', 'AI sandbox attempt recorder exists');
assertIncludes(files.aiAttempts, "status: 'blocked'", 'AI attempt recorder returns structured blocked results');
assertIncludes(files.aiAttempts, 'automationOwned: true', 'AI attempt recorder creates automation-owned PR artifacts');
assertIncludes(files.neonRepository, 'buildAiSandboxAttemptResult', 'live repository uses AI attempt recorder');
assertIncludes(files.runAgentRoute, 'authorizeWorkflowMutation', 'agent execution endpoint requires workflow mutation authorization');
assertIncludes(files.runAgentRoute, 'persistPullRequest', 'agent execution endpoint persists opened PR artifacts');
assertIncludes(files.agentExecution, 'parseAgentPatchPackage', 'agent execution validates CLŌD patch packages');
assertIncludes(files.agentExecution, 'DAYTONA_API_KEY', 'agent execution uses Daytona credentials');
assertIncludes(files.agentExecution, 'GITHUB_TOKEN', 'agent execution uses server-side GitHub token');
assertIncludes(files.agentExecution, 'process/execute', 'agent execution runs commands through Daytona toolbox');

console.log('MaintainerOS backend policy check passed.');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Backend policy check failed: ${label}`);
  }
}
