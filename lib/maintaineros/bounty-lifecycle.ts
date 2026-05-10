import type { BountyLifecycleStatus, ClustlyTaskViewModel } from './types';

const FUNDED_OR_LATER = new Set<BountyLifecycleStatus>(['funded', 'claimed', 'submitted', 'approved', 'paid']);

export function isBountyFundedOrLater(status: BountyLifecycleStatus) {
  return FUNDED_OR_LATER.has(status);
}

export function deriveClustlyTaskStatus(
  bountyStatus: BountyLifecycleStatus,
  canRelease: boolean,
  currentStatus?: ClustlyTaskViewModel['status'],
): ClustlyTaskViewModel['status'] {
  if (bountyStatus === 'canceled') return currentStatus === 'refunded' ? 'refunded' : 'failed';
  if (canRelease) return bountyStatus === 'paid' ? 'released' : 'approved';
  if (currentStatus && ['funded', 'claimed', 'submitted', 'approved', 'posted', 'draft'].includes(currentStatus)) {
    return currentStatus;
  }
  if (bountyStatus === 'proposed') return 'posted';
  return bountyStatus;
}
