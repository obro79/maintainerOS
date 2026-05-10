import type { ClustlyBountyListItemViewModel, IssueDetailViewModel, PaymentArtifactViewModel } from './types';
import { canReleasePayout, isClustlyEligibleRoute } from './payout';

export interface PaymentProvider {
  createArtifact(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null>;
}

export interface ClustlyProvider {
  createTask(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null>;
  getTask(taskId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null>;
  approveClaim(taskId: string, claimId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null>;
}

export class FixtureClustlyProvider implements PaymentProvider, ClustlyProvider {
  async createArtifact(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    return this.createTask(issue);
  }

  async createTask(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    const gate = canReleasePayout(issue);
    if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;

    return {
      provider: 'clustly',
      sourceState: 'fixture',
      status: gate.canRelease ? issue.bounty.status === 'paid' ? 'released' : 'approved' : issue.paymentArtifact?.status ?? 'funded',
      taskId: issue.paymentArtifact?.taskId ?? `fixture-clustly-${issue.number}`,
      taskUrl: issue.paymentArtifact?.taskUrl ?? `https://clustly.ai/tasks/fixture-clustly-${issue.number}`,
      claimId: issue.paymentArtifact?.claimId ?? `claim-${issue.number}`,
      amountCents: issue.bounty.amountCents,
      currency: 'USDC',
      artifactUrl: issue.paymentArtifact?.artifactUrl,
      fundingMode: issue.paymentArtifact?.fundingMode ?? 'manual-browser',
      claimerKind: 'human',
      releaseReason: gate.canRelease
        ? 'Release allowed: funded task, linked PR, fresh passed Greptile verification, and maintainer acceptance are present.'
        : `Release blocked: ${gate.reasons.join(' ')}`,
    };
  }

  async getTask(_taskId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    return this.createTask(issue);
  }

  async approveClaim(_taskId: string, claimId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    const task = await this.createTask(issue);
    return task ? { ...task, claimId, status: canReleasePayout(issue).canRelease ? 'released' : task.status } : null;
  }
}

export function toClustlyBountyListItem(repositoryId: string, issue: IssueDetailViewModel): ClustlyBountyListItemViewModel | null {
  if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;
  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    route: issue.route,
    detailUrl: `/${repositoryId}/issues/${issue.number}`,
    traceUrl: `/${repositoryId}/issues/${issue.number}/trace`,
    bounty: issue.bounty,
    task: issue.paymentArtifact,
    gate: issue.payoutGate,
  };
}
