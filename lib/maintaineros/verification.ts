import type { ArtifactSourceState, IssueDetailViewModel, PullRequestViewModel, VerificationQueueItemViewModel, VerificationViewModel } from './types';

export interface VerificationObserver {
  getVerification(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel): Promise<VerificationViewModel>;
}

export class FixtureGreptileObserver implements VerificationObserver {
  async getVerification(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel): Promise<VerificationViewModel> {
    return buildGreptileVerification(issue, pullRequest, issue.verification?.sourceState ?? 'fixture');
  }
}

export function isVerificationStale(verification: VerificationViewModel) {
  if (!verification.verifiedSha || !verification.currentSha) return false;
  return verification.isStale || verification.verifiedSha.replace('-verified', '') !== verification.currentSha;
}

export function parsePullRequestReference(input: string) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: Number(urlMatch[3]) };
  }
  const shorthandMatch = trimmed.match(/^([^/\s#]+)\/([^/\s#]+)#(\d+)$/);
  if (shorthandMatch) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2], number: Number(shorthandMatch[3]) };
  }
  return null;
}

export function buildGreptileVerification(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel, sourceState: ArtifactSourceState): VerificationViewModel {
  const currentSha = pullRequest.headSha;
  const base = issue.verification;
  const forcedStatus = forcedVerificationStatus(issue);
  const status = forcedStatus ?? base?.status ?? 'pending';
  const verifiedSha = status === 'pending' ? null : status === 'stale' ? `${currentSha}-old` : currentSha;
  const isStale = status === 'stale' || Boolean(verifiedSha && verifiedSha !== currentSha);
  const blockingFindings = status === 'failed'
    ? ['Missing regression coverage for the failing path.', 'Acceptance criteria were not demonstrated in the PR.']
    : status === 'stale'
      ? ['PR head changed after verification; rerun Greptile before completion.']
      : [];

  return {
    provider: 'greptile',
    sourceState,
    status: isStale ? 'stale' : status,
    summary: summaryFor(issue, status),
    criteria: issue.workOrder.acceptanceChecks,
    filesTouched: issue.workOrder.suggestedFiles,
    filesInspected: Array.from(new Set([...(issue.workOrder.suggestedFiles ?? []), ...(issue.contextPack?.citations.map((citation) => citation.pathOrUrl ?? citation.title) ?? [])])).slice(0, 6),
    verifiedSha,
    currentSha,
    blockingFindingsCount: blockingFindings.length,
    blockingFindings,
    riskSummary: riskFor(status),
    failureReason: blockingFindings[0] ?? null,
    verifiedAt: status === 'pending' ? null : '2026-05-08T21:12:00.000Z',
    isStale,
  };
}

export function toVerificationQueueItem(repositoryId: string, issue: IssueDetailViewModel): VerificationQueueItemViewModel {
  const verification = issue.pullRequest ? buildGreptileVerification(issue, issue.pullRequest, issue.verification?.sourceState ?? 'fixture') : issue.verification ?? pendingWithoutPr(issue);
  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    route: issue.route,
    detailUrl: `/${repositoryId}/issues/${issue.number}`,
    traceUrl: `/${repositoryId}/issues/${issue.number}/trace`,
    pullRequest: issue.pullRequest,
    verification,
    blockingReason: blockingReason(verification, issue.pullRequest),
  };
}

function pendingWithoutPr(issue: IssueDetailViewModel): VerificationViewModel {
  return {
    provider: 'greptile',
    sourceState: issue.modelRun.sourceState ?? 'fixture',
    status: 'pending',
    summary: 'No pull request is linked for verification yet.',
    criteria: issue.workOrder.acceptanceChecks,
    filesTouched: [],
    filesInspected: [],
    verifiedSha: null,
    currentSha: null,
    blockingFindingsCount: 0,
    blockingFindings: [],
    riskSummary: 'Verification cannot run until a PR is linked.',
    failureReason: 'No pull request linked.',
    verifiedAt: null,
    isStale: false,
  };
}

function forcedVerificationStatus(issue: IssueDetailViewModel): VerificationViewModel['status'] | null {
  if (issue.number === 41) return 'stale';
  if (issue.number === 1) return 'pending';
  if (issue.number === 17) return 'failed';
  return null;
}

function summaryFor(issue: IssueDetailViewModel, status: VerificationViewModel['status']) {
  if (status === 'passed') return `Greptile proof passed for #${issue.number}; acceptance checks were satisfied.`;
  if (status === 'failed') return `Greptile proof failed for #${issue.number}; blocking findings require retry or escalation.`;
  if (status === 'stale') return `Greptile proof is stale for #${issue.number}; PR head changed after verification.`;
  return `Greptile verification is pending for #${issue.number}.`;
}

function riskFor(status: VerificationViewModel['status']) {
  if (status === 'passed') return 'No blocking risk found against acceptance checks.';
  if (status === 'failed') return 'Blocking proof gaps remain.';
  if (status === 'stale') return 'Proof must be rerun against the current PR head before completion or payout.';
  return 'Verification has not completed.';
}

function blockingReason(verification: VerificationViewModel, pullRequest: PullRequestViewModel | null) {
  if (!pullRequest) return 'No linked PR.';
  if (verification.status === 'passed' && !isVerificationStale(verification)) return 'Ready for maintainer acceptance.';
  if (isVerificationStale(verification)) return 'Stale SHA blocks completion and payout.';
  if (verification.status === 'failed') return verification.failureReason ?? 'Blocking findings remain.';
  return 'Verification pending.';
}
