import { isVerificationStale } from './verification';
import type { ExecutionRoute, IssueDetailViewModel, PullRequestViewModel, VerificationViewModel } from './types';

export type RequiredCheckStatus = 'passed' | 'failed' | 'pending';

export interface RequiredCheckResult {
  name: string;
  status: RequiredCheckStatus;
}

export type MergeBlockReasonCode =
  | 'missing_pull_request'
  | 'not_automation_owned'
  | 'pull_request_not_open'
  | 'draft_pull_request'
  | 'missing_verification'
  | 'verification_not_passed'
  | 'verification_stale'
  | 'required_checks_missing'
  | 'required_checks_not_passed'
  | 'branch_not_current'
  | 'human_commits_present'
  | 'branch_protection_blocks_squash';

export interface SafeSquashMergeInput {
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel | null;
  requiredChecks: RequiredCheckResult[];
  branchCurrent: boolean;
  hasHumanCommits: boolean;
  branchProtectionAllowsSquash: boolean;
  dryRun?: boolean;
}

export interface SafeSquashMergeDecision {
  action: 'squash-merge' | 'blocked';
  canSquashMerge: boolean;
  dryRun: boolean;
  reasonCodes: MergeBlockReasonCode[];
  reasons: string[];
  summary: string;
}

export type FailedPrRerouteReasonCode =
  | 'missing_pull_request'
  | 'human_pr_untouched'
  | 'verification_not_failed'
  | 'close_automation_pr'
  | 'preserve_trace'
  | 'delete_branch_allowed'
  | 'delete_branch_blocked'
  | 'reroute_dev'
  | 'reroute_clustly';

export interface FailedPrRerouteInput {
  issue: Pick<IssueDetailViewModel, 'number' | 'route' | 'verification' | 'workOrder'>;
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel | null;
  branchDeletionAllowed: boolean;
}

export interface FailedPrRerouteDecision {
  action: 'close-and-reroute' | 'untouched' | 'no-op';
  shouldClosePullRequest: boolean;
  shouldDeleteBranch: boolean;
  rerouteTo: ExecutionRoute | null;
  reasonCodes: FailedPrRerouteReasonCode[];
  reasons: string[];
  traceTitle: string;
}

export function evaluateSafeSquashMerge(input: SafeSquashMergeInput): SafeSquashMergeDecision {
  const reasonCodes: MergeBlockReasonCode[] = [];
  const reasons: string[] = [];

  const block = (code: MergeBlockReasonCode, reason: string) => {
    reasonCodes.push(code);
    reasons.push(reason);
  };

  if (!input.pullRequest) {
    block('missing_pull_request', 'No pull request is linked.');
  } else {
    if (!input.pullRequest.automationOwned || input.pullRequest.authorOwnerType !== 'automation') {
      block('not_automation_owned', 'Human or unknown-owner PRs are not eligible for automatic merge.');
    }
    if (input.pullRequest.status === 'draft') block('draft_pull_request', 'Draft PRs cannot be auto-merged.');
    if (input.pullRequest.status !== 'open') {
      block('pull_request_not_open', `PR status is ${input.pullRequest.status}; only open PRs can be auto-merged.`);
    }
  }

  if (!input.verification) {
    block('missing_verification', 'No Greptile verification is linked.');
  } else if (isVerificationStale(input.verification)) {
    block('verification_stale', 'Greptile verification is stale for the current PR head.');
  } else if (input.verification.status !== 'passed') {
    block('verification_not_passed', `Greptile verification is ${input.verification.status}, not passed.`);
  }

  if (input.requiredChecks.length === 0) {
    block('required_checks_missing', 'No required check results were supplied.');
  } else {
    const failedChecks = input.requiredChecks.filter((check) => check.status !== 'passed');
    if (failedChecks.length > 0) {
      block('required_checks_not_passed', `Required checks not passed: ${failedChecks.map((check) => `${check.name}=${check.status}`).join(', ')}.`);
    }
  }

  if (!input.branchCurrent) block('branch_not_current', 'PR branch is not current with the base branch.');
  if (input.hasHumanCommits) block('human_commits_present', 'Human commits are present on the automation PR branch.');
  if (!input.branchProtectionAllowsSquash) block('branch_protection_blocks_squash', 'Branch protection does not allow squash merge.');

  const canSquashMerge = reasonCodes.length === 0;
  const dryRun = input.dryRun ?? true;
  return {
    action: canSquashMerge ? 'squash-merge' : 'blocked',
    canSquashMerge,
    dryRun,
    reasonCodes,
    reasons: canSquashMerge
      ? ['All gates passed in dry-run; safe squash merge may proceed.']
      : reasons,
    summary: canSquashMerge
      ? 'Automation-owned PR passed Greptile, required checks, branch currency, human-commit, and branch-protection gates.'
      : `Safe squash merge blocked by ${reasonCodes.length} gate(s).`,
  };
}

export function planFailedPrReroute(input: FailedPrRerouteInput): FailedPrRerouteDecision {
  if (!input.pullRequest) {
    return {
      action: 'no-op',
      shouldClosePullRequest: false,
      shouldDeleteBranch: false,
      rerouteTo: null,
      reasonCodes: ['missing_pull_request'],
      reasons: ['No pull request is linked.'],
      traceTitle: 'No PR reroute action required',
    };
  }

  if (!input.pullRequest.automationOwned || input.pullRequest.authorOwnerType !== 'automation') {
    return {
      action: 'untouched',
      shouldClosePullRequest: false,
      shouldDeleteBranch: false,
      rerouteTo: null,
      reasonCodes: ['human_pr_untouched'],
      reasons: ['Human PRs are untouched by failed-AI reroute automation.'],
      traceTitle: 'Human PR left untouched',
    };
  }

  const verification = input.verification;
  if (!verification || (verification.status !== 'failed' && verification.status !== 'stale' && !isVerificationStale(verification))) {
    return {
      action: 'no-op',
      shouldClosePullRequest: false,
      shouldDeleteBranch: false,
      rerouteTo: null,
      reasonCodes: ['verification_not_failed'],
      reasons: ['PR reroute requires failed or stale Greptile verification.'],
      traceTitle: 'PR reroute not triggered',
    };
  }

  const rerouteTo = chooseRerouteTarget(input.issue, verification);
  const reasonCodes: FailedPrRerouteReasonCode[] = [
    'close_automation_pr',
    'preserve_trace',
    input.branchDeletionAllowed ? 'delete_branch_allowed' : 'delete_branch_blocked',
    rerouteTo === 'bounty-worthy' ? 'reroute_clustly' : 'reroute_dev',
  ];

  return {
    action: 'close-and-reroute',
    shouldClosePullRequest: true,
    shouldDeleteBranch: input.branchDeletionAllowed,
    rerouteTo,
    reasonCodes,
    reasons: [
      'Automation-owned PR should be closed after failed or stale Greptile verification.',
      'Trace evidence must preserve the failed PR, verification state, and reroute decision.',
      input.branchDeletionAllowed ? 'Branch can be deleted because it is automation-owned and safe.' : 'Branch deletion is blocked; preserve branch for investigation.',
      rerouteTo === 'bounty-worthy' ? 'Failure reason suggests bounded paid work through CLUSTLY.' : 'Failure reason requires DEV/maintainer review.',
    ],
    traceTitle: rerouteTo === 'bounty-worthy' ? 'Failed AI PR rerouted to CLUSTLY' : 'Failed AI PR rerouted to DEV',
  };
}

function chooseRerouteTarget(
  issue: Pick<IssueDetailViewModel, 'number' | 'route' | 'verification' | 'workOrder'>,
  verification: VerificationViewModel,
): ExecutionRoute {
  const text = [
    verification.failureReason,
    verification.riskSummary,
    ...(verification.blockingFindings ?? []),
    ...issue.workOrder.acceptanceChecks,
  ].join(' ').toLowerCase();

  if (text.includes('scope') || text.includes('large') || text.includes('migration') || text.includes('architecture')) {
    return 'bounty-worthy';
  }
  return 'maintainer-review';
}
