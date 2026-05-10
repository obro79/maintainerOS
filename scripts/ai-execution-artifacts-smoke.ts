import { equal, ok } from 'node:assert/strict';
import { buildAiSandboxAttemptResult } from '../lib/maintaineros/ai-attempts';
import { buildClodRunEvidenceMeta } from '../lib/maintaineros/clod-run-evidence';
import { evaluateRoutePolicy, selectClodModel, type RouteDecision } from '../lib/maintaineros/routing';
import type { ExecutionRoute, IssueDetailViewModel, ModelRunViewModel } from '../lib/maintaineros/types';

const cheapDecision: RouteDecision = {
  route: 'agent-solvable',
  complexityScore: 2,
  riskScore: 2,
  confidence: 0.93,
  rationale: 'low-risk AI issue',
};
const balancedDecision: RouteDecision = { ...cheapDecision, complexityScore: 6, confidence: 0.79 };
const deepDecision: RouteDecision = { ...cheapDecision, riskScore: 8 };

equal(selectClodModel(cheapDecision).tier, 'cheap-open');
equal(selectClodModel(balancedDecision).tier, 'balanced');
equal(selectClodModel(deepDecision).tier, 'deep');
equal(selectClodModel(cheapDecision, { fallbackReason: 'provider unavailable' }).tier, 'premium-fallback');

const modelRun: ModelRunViewModel = {
  provider: 'clod',
  runId: 'clod-run-1',
  createdAt: '2026-05-10T20:00:00.000Z',
  sourceState: 'live',
  model: 'DeepSeek V3',
  tier: 'cheap-open',
  purpose: 'work-order',
  status: 'succeeded',
  selectionReason: 'Low-risk route.',
  latencyMs: 120,
  inputTokens: 200,
  outputTokens: 100,
  estimatedCostCents: 1,
  premiumBaselineCents: 3,
  fallbackReason: null,
};
const runEvidence = buildClodRunEvidenceMeta({
  issue: { id: 'issue-41', number: 41, route: 'agent-solvable' },
  modelRun,
  routeConfidence: cheapDecision.confidence,
  routeComplexityScore: cheapDecision.complexityScore,
  routeRiskScore: cheapDecision.riskScore,
});
equal(runEvidence.model, 'DeepSeek V3');
equal(runEvidence.tier, 'cheap-open');
equal(runEvidence.estimatedCostCents, 1);
equal(runEvidence.premiumBaselineCents, 3);
equal(runEvidence.fallbackReason, null);

const aiIssue = issue('agent-solvable', 41);
const aiAttemptResult = buildAiSandboxAttemptResult(aiIssue, 'maintaineros-demo-large', 'fixture');
equal(aiAttemptResult.status, 'recorded');
equal(aiAttemptResult.blocked, false);
equal(aiAttemptResult.attempts.length, 2);
ok(aiAttemptResult.attempts.some((attempt) => attempt.commandResults.length > 0));
equal(aiAttemptResult.pullRequest?.automationOwned, true);
equal(aiAttemptResult.pullRequest?.authorOwnerType, 'automation');

const devIssue = issue('maintainer-review', 42);
const blockedAttemptResult = buildAiSandboxAttemptResult(devIssue, 'maintaineros-demo-large', 'fixture');
equal(blockedAttemptResult.status, 'blocked');
equal(blockedAttemptResult.attempts.length, 0);
equal(blockedAttemptResult.pullRequest, null);
equal(blockedAttemptResult.traceEvents[0]?.status, 'blocked');

console.log('MaintainerOS AI execution artifacts smoke passed.');

function issue(route: ExecutionRoute, number: number): IssueDetailViewModel {
  const routePolicy = evaluateRoutePolicy({
    route,
    complexityScore: route === 'agent-solvable' ? 3 : 7,
    riskScore: route === 'agent-solvable' ? 2 : 6,
    confidence: route === 'agent-solvable' ? 0.92 : 0.72,
    labels: route === 'agent-solvable' ? ['bug'] : ['architecture'],
  });
  return {
    id: `issue-${number}`,
    number,
    title: route === 'agent-solvable' ? 'Fix scoped bug' : 'Review architecture migration',
    lane: route === 'agent-solvable' ? 'agent' : 'maintainer',
    route,
    confidence: route === 'agent-solvable' ? 92 : 72,
    risk: route === 'agent-solvable' ? 'low' : 'medium',
    complexity: route === 'agent-solvable' ? 'low' : 'high',
    rationale: 'test issue',
    routeDelay: 0,
    body: 'Test body',
    htmlUrl: `https://github.com/obro79/maintainerOSS/issues/${number}`,
    author: 'maintaineros',
    labels: route === 'agent-solvable' ? ['bug'] : ['architecture'],
    modelRun,
    workOrder: {
      title: `Work order ${number}`,
      status: route === 'agent-solvable' ? 'ready' : 'blocked',
      assigneeKind: route === 'agent-solvable' ? 'agent' : 'maintainer',
      generatedAt: '2026-05-10T20:00:00.000Z',
      acceptanceChecks: ['Run checks before completion.'],
      suggestedFiles: ['lib/maintaineros/'],
      suggestedCommands: ['npm run backend:check', 'npm run lint'],
      automationSummary: route === 'agent-solvable' ? 'AI execution allowed' : 'DEV route: autonomous AI execution is blocked.',
    },
    routePolicy,
    contextPack: null,
    sandboxExecutions: [],
    pullRequest: null,
    verification: null,
    bounty: null,
    paymentArtifact: null,
    routeHistory: [],
    trace: [],
    payoutGate: {
      canRelease: false,
      reasons: [],
      reasonCodes: [],
      reasonDetails: [],
    },
  };
}
