import { strict as assert } from 'node:assert';
import { buildIssueWorkflowSnapshot } from '../lib/maintaineros/issue-workflow.js';
import type { IssueDetailViewModel, VerificationViewModel } from '../lib/maintaineros/types.js';

function verification(overrides: Partial<VerificationViewModel> = {}): VerificationViewModel {
  return {
    provider: 'greptile',
    sourceState: 'fixture',
    status: 'passed',
    summary: 'Accepted by Greptile.',
    criteria: ['Tests pass'],
    filesTouched: ['lib/example.ts'],
    filesInspected: ['lib/example.ts'],
    verifiedSha: 'sha-current',
    currentSha: 'sha-current',
    blockingFindingsCount: 0,
    blockingFindings: [],
    riskSummary: 'No blocking findings.',
    failureReason: null,
    verifiedAt: '2026-05-10T18:00:00.000Z',
    isStale: false,
    ...overrides,
  };
}

function issue(overrides: Partial<IssueDetailViewModel> = {}): IssueDetailViewModel {
  return {
    id: 'issue-41',
    number: 41,
    title: 'Fix flaky queue drain',
    lane: 'agent',
    route: 'agent-solvable',
    confidence: 91,
    risk: 'medium',
    complexity: 'medium',
    rationale: 'Clear acceptance criteria and bounded code surface.',
    routeDelay: 1200,
    body: 'Fixture issue body',
    htmlUrl: 'https://github.com/acme/repo/issues/41',
    author: 'owen',
    labels: ['bug'],
    modelRun: {
      provider: 'clod',
      sourceState: 'fixture',
      model: 'fixture-model',
      tier: 'balanced',
      purpose: 'routing',
      status: 'succeeded',
      selectionReason: 'Fixture route.',
      latencyMs: 80,
      inputTokens: 1000,
      outputTokens: 240,
      estimatedCostCents: 2,
      premiumBaselineCents: 9,
    },
    workOrder: {
      title: 'Fix flaky queue drain',
      status: 'ready',
      assigneeKind: 'agent',
      acceptanceChecks: ['Queue drain test passes'],
      suggestedFiles: ['lib/queue.ts'],
    },
    routePolicy: {
      executionMode: 'ai',
      automationAllowed: true,
      sandboxAllowed: true,
      requiresHumanReview: false,
      requiresPaidWork: false,
      reasons: ['Agent route.'],
      safetyChecks: ['Run tests.'],
    },
    contextPack: {
      provider: 'nia',
      sourceState: 'fixture',
      id: 'context-41',
      status: 'passed',
      summary: 'Relevant queue files and tests found.',
      sourceCount: 3,
      confidence: 0.88,
      citations: [],
      suggestedCommands: ['npm test'],
    },
    sandboxExecutions: [{
      provider: 'daytona',
      sourceState: 'fixture',
      id: 'sandbox-41',
      status: 'passed',
      sandboxId: 'sbx-41',
      imageOrTemplate: 'node',
      repoRef: 'main',
      branchName: 'codex/fix-queue',
      contextMode: 'nia-enriched',
      contextPackId: 'context-41',
      requestedCommands: ['npm test'],
      completedCommands: ['npm test'],
      durationMs: 12000,
      exitCode: 0,
      commandResults: [{ command: 'npm test', status: 'passed', exitCode: 0, durationMs: 12000, summary: 'Passed.' }],
      logSummary: 'Tests passed in sandbox.',
      filesTouched: ['lib/queue.ts'],
      pullRequestUrl: 'https://github.com/acme/repo/pull/44',
      failureReason: null,
    }],
    pullRequest: {
      provider: 'github',
      sourceState: 'fixture',
      number: 44,
      title: 'Fix flaky queue drain',
      baseBranch: 'main',
      branchName: 'codex/fix-queue',
      headSha: 'sha-current',
      status: 'merged',
      htmlUrl: 'https://github.com/acme/repo/pull/44',
      authorLogin: 'codex-agent',
      authorOwnerType: 'automation',
      automationOwned: true,
    },
    verification: verification(),
    bounty: null,
    paymentArtifact: null,
    routeHistory: [],
    trace: [
      {
        id: 'issue-41-github',
        at: '2026-05-10T17:00:00.000Z',
        actor: 'github',
        provider: 'github',
        sourceState: 'fixture',
        route: 'agent-solvable',
        title: 'Issue imported',
        detail: 'Imported from GitHub.',
        status: 'passed',
      },
      {
        id: 'issue-41-clod',
        at: '2026-05-10T17:01:00.000Z',
        actor: 'clod',
        provider: 'clod',
        sourceState: 'fixture',
        route: 'agent-solvable',
        title: 'Route selected',
        detail: 'Agent route selected.',
        status: 'routed',
      },
      {
        id: 'issue-41-verification',
        at: '2026-05-10T17:03:00.000Z',
        actor: 'greptile',
        provider: 'greptile',
        sourceState: 'fixture',
        route: 'agent-solvable',
        title: 'Verification passed',
        detail: 'Accepted.',
        status: 'passed',
      },
    ],
    payoutGate: {
      canRelease: false,
      reasons: [],
      reasonCodes: [],
      reasonDetails: [],
    },
    ...overrides,
  };
}

const agentSuccess = buildIssueWorkflowSnapshot(issue());
assert.equal(agentSuccess.currentNodeId, 'terminal');
assert.equal(agentSuccess.nodes.find((node) => node.id === 'terminal')?.status, 'succeeded');
assert.equal(agentSuccess.nodes.find((node) => node.id === 'clustly')?.status, 'skipped');

const staleVerification = buildIssueWorkflowSnapshot(issue({
  verification: verification({ isStale: true, verifiedSha: 'sha-old', currentSha: 'sha-current' }),
}));
assert.equal(staleVerification.currentNodeId, 'greptile');
assert.equal(staleVerification.nodes.find((node) => node.id === 'greptile')?.status, 'stale');
assert.equal(staleVerification.nodes.find((node) => node.id === 'terminal')?.status, 'blocked');

const bountyBlocked = buildIssueWorkflowSnapshot(issue({
  lane: 'bounty',
  route: 'bounty-worthy',
  routePolicy: {
    executionMode: 'clustly',
    automationAllowed: false,
    sandboxAllowed: false,
    requiresHumanReview: true,
    requiresPaidWork: true,
    reasons: ['Paid contributor route.'],
    safetyChecks: ['Require verification before payout.'],
  },
  contextPack: null,
  sandboxExecutions: [],
  pullRequest: null,
  verification: null,
  bounty: {
    status: 'funded',
    amountCents: 45000,
    currency: 'USD',
    rationale: 'High value issue.',
    maintainerAccepted: true,
  },
  payoutGate: {
    canRelease: false,
    reasons: ['Missing pull request.'],
    reasonCodes: ['missing_pull_request'],
    reasonDetails: [{ code: 'missing_pull_request', message: 'A PR is required before release.' }],
  },
}));
assert.equal(bountyBlocked.currentNodeId, 'clustly');
assert.equal(bountyBlocked.nodes.find((node) => node.id === 'clustly')?.status, 'blocked');

const clarify = buildIssueWorkflowSnapshot(issue({
  lane: 'clarify',
  route: 'close-or-clarify',
  routePolicy: {
    executionMode: 'clarify',
    automationAllowed: false,
    sandboxAllowed: false,
    requiresHumanReview: true,
    requiresPaidWork: false,
    reasons: ['Needs clarification.'],
    safetyChecks: [],
  },
  contextPack: null,
  sandboxExecutions: [],
  pullRequest: null,
  verification: null,
}));
assert.equal(clarify.currentNodeId, 'terminal');
assert.equal(clarify.nodes.find((node) => node.id === 'nia')?.status, 'skipped');
assert.equal(clarify.nodes.find((node) => node.id === 'daytona')?.status, 'skipped');
assert.equal(clarify.nodes.find((node) => node.id === 'greptile')?.status, 'skipped');

console.log('Issue workflow projection smoke checks passed.');
