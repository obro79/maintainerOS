import type { IssueDetailViewModel } from './types';
import { isVerificationStale } from './verification';

export function canReleasePayout(issue: Pick<IssueDetailViewModel, 'route' | 'bounty' | 'pullRequest' | 'verification'>) {
  const reasons: string[] = [];

  if (issue.route !== 'bounty-worthy') reasons.push('Issue is not routed to the bounty lane.');
  if (!issue.bounty) reasons.push('No bounty exists.');
  if (issue.bounty && !['funded', 'approved', 'paid'].includes(issue.bounty.status)) reasons.push('Bounty is not funded.');
  if (!issue.pullRequest) reasons.push('No pull request is linked.');
  if (!issue.verification) reasons.push('No verification run is linked.');
  if (issue.verification?.status !== 'passed') reasons.push('Verification has not passed.');
  if (issue.verification && isVerificationStale(issue.verification)) reasons.push('Verification is stale after PR changes.');
  if (issue.bounty && !issue.bounty.maintainerAccepted) reasons.push('Maintainer has not accepted the verified work.');

  return {
    canRelease: reasons.length === 0,
    reasons,
  };
}
