import { strict as assert } from 'node:assert';
import { FixtureClustlyProvider } from '../lib/maintaineros/payments.js';
import { canReleasePayout } from '../lib/maintaineros/payout.js';
import { evaluateSafeSquashMerge, planFailedPrReroute } from '../lib/maintaineros/pr-gates.js';
import { isVerificationStale } from '../lib/maintaineros/verification.js';
import type { IssueDetailViewModel, VerificationViewModel } from '../lib/maintaineros/types.js';

function verification(overrides: Partial<VerificationViewModel> = {}): VerificationViewModel {
  return {
    provider: 'greptile',
    sourceState: 'fixture',
    status: 'passed',
    summary: 'Passed against acceptance checks.',
    criteria: ['Tests pass'],
    filesTouched: ['lib/example.ts'],
    filesInspected: ['lib/example.ts'],
    verifiedSha: 'sha-current',
    currentSha: 'sha-current',
    blockingFindingsCount: 0,
    blockingFindings: [],
    riskSummary: 'No blocking risk.',
    failureReason: null,
    verifiedAt: '2026-05-08T21:12:00.000Z',
    isStale: false,
    ...overrides,
  };
}

function issue(overrides: Partial<IssueDetailViewModel> = {}): IssueDetailViewModel {
  return {
    id: 'issue-1',
    number: 1,
    title: 'Fixture payout test issue',
    lane: 'bounty',
    route: 'bounty-worthy',
    confidence: 91,
    risk: 'medium',
    complexity: 'medium',
    rationale: 'Bounty-worthy fixture.',
    routeDelay: 0,
    body: 'Fixture body',
    htmlUrl: 'https://github.com/acme/repo/issues/1',
    author: 'owen',
    labels: ['bounty'],
    modelRun: {
      provider: 'clod',
      sourceState: 'fixture',
      model: 'fixture-model',
      tier: 'balanced',
      purpose: 'routing',
      status: 'succeeded',
      selectionReason: 'Fixture',
      latencyMs: 1,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCents: 2,
      premiumBaselineCents: 9,
    },
    workOrder: {
      title: 'Fix issue',
      status: 'ready',
      assigneeKind: 'contributor',
      acceptanceChecks: ['Tests pass'],
      suggestedFiles: ['lib/example.ts'],
    },
    routePolicy: {
      executionMode: 'clustly',
      automationAllowed: false,
      sandboxAllowed: false,
      requiresHumanReview: true,
      requiresPaidWork: true,
      reasons: ['Paid-work route.'],
      safetyChecks: ['Verification and maintainer acceptance required.'],
    },
    contextPack: null,
    sandboxExecutions: [],
    pullRequest: {
      provider: 'github',
      number: 44,
      title: 'Fix issue',
      baseBranch: 'main',
      branchName: 'fix/issue',
      headSha: 'sha-current',
      status: 'open',
      htmlUrl: 'https://github.com/acme/repo/pull/44',
      authorLogin: 'codex-agent',
      authorOwnerType: 'automation',
      automationOwned: true,
    },
    verification: verification(),
    bounty: {
      status: 'funded',
      amountCents: 45000,
      currency: 'USD',
      rationale: 'Fixture bounty.',
      maintainerAccepted: true,
    },
    paymentArtifact: null,
    routeHistory: [],
    trace: [],
    payoutGate: {
      canRelease: false,
      reasons: [],
      reasonCodes: [],
      reasonDetails: [],
    },
    ...overrides,
  };
}

const releasable = issue();
assert.equal(isVerificationStale(releasable.verification!), false);
assert.deepEqual(canReleasePayout(releasable).reasonCodes, []);
assert.equal(canReleasePayout(releasable).canRelease, true);

const stale = issue({ verification: verification({ verifiedSha: 'sha-old', currentSha: 'sha-current', isStale: false }) });
assert.equal(isVerificationStale(stale.verification!), true);
assert.deepEqual(canReleasePayout(stale).reasonCodes, ['verification_stale']);

const missingPr = issue({ pullRequest: null });
assert.ok(canReleasePayout(missingPr).reasonCodes.includes('missing_pull_request'));

const missingVerification = issue({ verification: null });
assert.ok(canReleasePayout(missingVerification).reasonCodes.includes('missing_verification'));

const failedVerification = issue({ verification: verification({ status: 'failed', blockingFindingsCount: 1 }) });
assert.ok(canReleasePayout(failedVerification).reasonCodes.includes('verification_not_passed'));

const unfunded = issue({ bounty: { ...issue().bounty!, status: 'proposed' } });
assert.ok(canReleasePayout(unfunded).reasonCodes.includes('bounty_not_funded'));

const noMaintainerAcceptance = issue({ bounty: { ...issue().bounty!, maintainerAccepted: false } });
assert.ok(canReleasePayout(noMaintainerAcceptance).reasonCodes.includes('maintainer_not_accepted'));

const mergeReady = evaluateSafeSquashMerge({
  pullRequest: releasable.pullRequest,
  verification: releasable.verification,
  requiredChecks: [{ name: 'ci', status: 'passed' }],
  branchCurrent: true,
  hasHumanCommits: false,
  branchProtectionAllowsSquash: true,
});
assert.equal(mergeReady.canSquashMerge, true);
assert.equal(mergeReady.action, 'squash-merge');

const humanPr = issue({
  pullRequest: {
    ...issue().pullRequest!,
    authorLogin: 'human-maintainer',
    authorOwnerType: 'human',
    automationOwned: false,
  },
});
const humanMerge = evaluateSafeSquashMerge({
  pullRequest: humanPr.pullRequest,
  verification: humanPr.verification,
  requiredChecks: [{ name: 'ci', status: 'passed' }],
  branchCurrent: true,
  hasHumanCommits: false,
  branchProtectionAllowsSquash: true,
});
assert.ok(humanMerge.reasonCodes.includes('not_automation_owned'));

const staleMerge = evaluateSafeSquashMerge({
  pullRequest: stale.pullRequest,
  verification: stale.verification,
  requiredChecks: [{ name: 'ci', status: 'passed' }],
  branchCurrent: true,
  hasHumanCommits: false,
  branchProtectionAllowsSquash: true,
});
assert.ok(staleMerge.reasonCodes.includes('verification_stale'));

const failedPrReroute = planFailedPrReroute({
  issue: failedVerification,
  pullRequest: failedVerification.pullRequest,
  verification: failedVerification.verification,
  branchDeletionAllowed: true,
});
assert.equal(failedPrReroute.action, 'close-and-reroute');
assert.equal(failedPrReroute.shouldClosePullRequest, true);
assert.ok(failedPrReroute.reasonCodes.includes('preserve_trace'));

const humanReroute = planFailedPrReroute({
  issue: humanPr,
  pullRequest: humanPr.pullRequest,
  verification: verification({ status: 'failed', blockingFindings: ['Human PR failed checks.'], blockingFindingsCount: 1 }),
  branchDeletionAllowed: true,
});
assert.equal(humanReroute.action, 'untouched');
assert.equal(humanReroute.shouldClosePullRequest, false);
assert.ok(humanReroute.reasonCodes.includes('human_pr_untouched'));

async function main() {
  const provider = new FixtureClustlyProvider();
  const releasedTask = await provider.createTask(releasable);
  assert.equal(releasedTask?.taskId, 'fixture-clustly-1');
  assert.equal(releasedTask?.amountCents, 45000);
  assert.equal(releasedTask?.sourceState, 'fixture');
  assert.equal(releasedTask?.status, 'approved');
  assert.match(releasedTask?.releaseReason ?? '', /Release allowed/);

  const approvedClaim = await provider.approveClaim('fixture-clustly-1', 'claim-override', releasable);
  assert.equal(approvedClaim?.claimId, 'claim-override');
  assert.equal(approvedClaim?.status, 'released');

  const blockedTask = await provider.getTask('fixture-clustly-1', stale);
  assert.equal(blockedTask?.status, 'funded');
  assert.match(blockedTask?.releaseReason ?? '', /Verification is stale/);

  const nonBounty = issue({
    lane: 'agent',
    route: 'agent-solvable',
    bounty: null,
    paymentArtifact: null,
  });
  assert.equal(await provider.createTask(nonBounty), null);

  console.log('Verification and payout smoke checks passed.');
}

void main();
