import type { IssueDetailViewModel, PayoutBlockReasonCode, PayoutGateReasonViewModel, PayoutGateViewModel } from './types';
import { isBountyFundedOrLater } from './bounty-lifecycle';
import { isVerificationStale } from './verification';

export const NON_CLUSTLY_ROUTE_REASON = 'Clustly payout artifacts are hidden because this issue is not routed to the bounty lane.';

export function isClustlyEligibleRoute(issue: Pick<IssueDetailViewModel, 'route'>) {
  return issue.route === 'bounty-worthy';
}

const REASON_MESSAGES: Record<PayoutBlockReasonCode, string> = {
  not_bounty_route: 'Issue is not routed to the bounty lane.',
  missing_bounty: 'No bounty exists.',
  bounty_canceled: 'Bounty was canceled.',
  bounty_not_funded: 'Bounty is not funded.',
  missing_pull_request: 'No pull request is linked.',
  missing_verification: 'No verification run is linked.',
  verification_not_passed: 'Verification has not passed.',
  verification_stale: 'Verification is stale after PR changes.',
  maintainer_not_accepted: 'Maintainer has not accepted the verified work.',
};

export function payoutReasonMessage(code: PayoutBlockReasonCode) {
  return REASON_MESSAGES[code];
}

export function canReleasePayout(issue: Pick<IssueDetailViewModel, 'route' | 'bounty' | 'pullRequest' | 'verification'>): PayoutGateViewModel {
  const reasonDetails: PayoutGateReasonViewModel[] = [];
  const addReason = (code: PayoutBlockReasonCode) => {
    reasonDetails.push({ code, message: REASON_MESSAGES[code] });
  };

  if (issue.route !== 'bounty-worthy') addReason('not_bounty_route');
  if (!issue.bounty) {
    addReason('missing_bounty');
  } else {
    if (issue.bounty.status === 'canceled') addReason('bounty_canceled');
    else if (!isBountyFundedOrLater(issue.bounty.status)) addReason('bounty_not_funded');
  }
  if (!issue.pullRequest) addReason('missing_pull_request');
  if (!issue.verification) {
    addReason('missing_verification');
  } else if (isVerificationStale(issue.verification)) {
    addReason('verification_stale');
  } else if (issue.verification.status !== 'passed') {
    addReason('verification_not_passed');
  }
  if (issue.bounty && !issue.bounty.maintainerAccepted) addReason('maintainer_not_accepted');

  return {
    canRelease: reasonDetails.length === 0,
    reasons: reasonDetails.map((reason) => reason.message),
    reasonCodes: reasonDetails.map((reason) => reason.code),
    reasonDetails,
  };
}

export function hidePayoutArtifactsForNonClustlyRoutes(issue: IssueDetailViewModel): IssueDetailViewModel {
  if (isClustlyEligibleRoute(issue)) return issue;

  return {
    ...issue,
    bounty: null,
    paymentArtifact: null,
    payoutGate: {
      canRelease: false,
      reasons: [NON_CLUSTLY_ROUTE_REASON],
      reasonCodes: ['not_bounty_route'],
      reasonDetails: [{ code: 'not_bounty_route', message: NON_CLUSTLY_ROUTE_REASON }],
    },
  };
}
