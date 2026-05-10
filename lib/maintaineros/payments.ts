import type { ClustlyBountyListItemViewModel, IssueDetailViewModel, PaymentArtifactViewModel } from './types';
import { deriveClustlyTaskStatus } from './bounty-lifecycle';
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
    return buildFixtureClustlyTask(issue, 'fixture');
  }

  async getTask(_taskId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    return this.createTask(issue);
  }

  async approveClaim(_taskId: string, claimId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    const task = await this.createTask(issue);
    return task ? { ...task, claimId, status: canReleasePayout(issue).canRelease ? 'released' : task.status } : null;
  }
}

type FetchLike = typeof fetch;

export class LiveClustlyProvider implements PaymentProvider, ClustlyProvider {
  constructor(private readonly fetcher: FetchLike = fetch) {}

  async createArtifact(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    return this.createTask(issue);
  }

  async createTask(issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;
    if (!process.env.CLUSTLY_AGENT_KEY) throw new Error('CLUSTLY_AGENT_KEY is not configured.');

    const response = await this.fetcher(`${clustlyBaseUrl()}/tasks`, {
      method: 'POST',
      headers: clustlyHeaders(),
      body: JSON.stringify({
        title: issue.title,
        description: issue.workOrder.summary ?? issue.body,
        issueUrl: issue.htmlUrl,
        amountCents: issue.bounty.amountCents,
        currency: 'USDC',
        acceptanceChecks: issue.workOrder.acceptanceChecks,
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(errorFromPayload(payload) ?? `Clustly task creation failed with ${response.status}.`);
    return normalizeClustlyTask(issue, payload, 'posted');
  }

  async getTask(taskId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;
    const response = await this.fetcher(`${clustlyBaseUrl()}/tasks/${encodeURIComponent(taskId)}`, {
      headers: clustlyHeaders(),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(errorFromPayload(payload) ?? `Clustly task sync failed with ${response.status}.`);
    return normalizeClustlyTask(issue, payload, issue.paymentArtifact?.status ?? 'posted');
  }

  async approveClaim(taskId: string, claimId: string, issue: IssueDetailViewModel): Promise<PaymentArtifactViewModel | null> {
    if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;
    const gate = canReleasePayout(issue);
    if (!gate.canRelease) throw new Error(`Clustly release blocked: ${gate.reasons.join(' ')}`);
    const response = await this.fetcher(`${clustlyBaseUrl()}/tasks/${encodeURIComponent(taskId)}/claims/${encodeURIComponent(claimId)}/release`, {
      method: 'POST',
      headers: clustlyHeaders(),
      body: JSON.stringify({
        issueUrl: issue.htmlUrl,
        pullRequestUrl: issue.pullRequest?.htmlUrl,
        verifiedSha: issue.verification?.verifiedSha,
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(errorFromPayload(payload) ?? `Clustly release failed with ${response.status}.`);
    return normalizeClustlyTask(issue, payload, 'released', claimId);
  }
}

export function buildFixtureClustlyTask(issue: IssueDetailViewModel, sourceState = issue.paymentArtifact?.sourceState ?? 'fixture'): PaymentArtifactViewModel | null {
  const gate = canReleasePayout(issue);
  if (!isClustlyEligibleRoute(issue) || !issue.bounty) return null;
  const status = deriveClustlyTaskStatus(issue.bounty.status, gate.canRelease, issue.paymentArtifact?.status);

  return {
    provider: 'clustly',
    sourceState,
    status,
    taskId: issue.paymentArtifact?.taskId ?? `fixture-clustly-${issue.number}`,
    taskUrl: issue.paymentArtifact?.taskUrl ?? `https://clustly.ai/tasks/fixture-clustly-${issue.number}`,
    claimId: issue.paymentArtifact?.claimId ?? (issue.bounty.status === 'proposed' ? undefined : `claim-${issue.number}`),
    amountCents: issue.bounty.amountCents,
    currency: issue.paymentArtifact?.currency ?? 'USDC',
    artifactUrl: issue.paymentArtifact?.artifactUrl,
    fundingMode: issue.paymentArtifact?.fundingMode ?? 'manual-browser',
    claimerKind: issue.paymentArtifact?.claimerKind ?? (issue.bounty.status === 'proposed' ? null : 'human'),
    releaseReason: gate.canRelease
      ? 'Release allowed: funded task, linked PR, fresh passed Greptile verification, and maintainer acceptance are present.'
      : `Release blocked: ${gate.reasons.join(' ')}`,
  };
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

function normalizeClustlyTask(issue: IssueDetailViewModel, payload: Record<string, unknown>, fallbackStatus: PaymentArtifactViewModel['status'], claimId?: string): PaymentArtifactViewModel {
  const gate = canReleasePayout(issue);
  const status = normalizeClustlyStatus(stringValue(payload.status), fallbackStatus);
  return {
    provider: 'clustly',
    sourceState: 'live',
    status,
    taskId: stringValue(payload.taskId) ?? stringValue(payload.id) ?? issue.paymentArtifact?.taskId,
    taskUrl: stringValue(payload.taskUrl) ?? stringValue(payload.url) ?? issue.paymentArtifact?.taskUrl,
    claimId: claimId ?? stringValue(payload.claimId) ?? issue.paymentArtifact?.claimId,
    claimerKind: normalizeClaimerKind(stringValue(payload.claimerKind)) ?? issue.paymentArtifact?.claimerKind ?? null,
    fundingMode: 'api',
    amountCents: numberValue(payload.amountCents) ?? issue.bounty?.amountCents ?? issue.paymentArtifact?.amountCents ?? 0,
    currency: normalizeCurrency(stringValue(payload.currency)) ?? issue.paymentArtifact?.currency ?? 'USDC',
    artifactUrl: stringValue(payload.artifactUrl) ?? issue.paymentArtifact?.artifactUrl,
    releaseReason: gate.canRelease
      ? 'Release allowed: funded task, linked PR, fresh passed Greptile verification, and maintainer acceptance are present.'
      : `Release blocked: ${gate.reasons.join(' ')}`,
  };
}

function clustlyBaseUrl() {
  return (process.env.CLUSTLY_BASE_URL || 'https://clustly.ai/api/v1').replace(/\/$/, '');
}

function clustlyHeaders(): HeadersInit {
  return {
    'x-agent-key': process.env.CLUSTLY_AGENT_KEY || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function normalizeClustlyStatus(value: string | undefined, fallback: PaymentArtifactViewModel['status']): PaymentArtifactViewModel['status'] {
  const status = value?.toLowerCase();
  if (
    status === 'draft' ||
    status === 'posted' ||
    status === 'funded' ||
    status === 'claimed' ||
    status === 'submitted' ||
    status === 'approved' ||
    status === 'paid' ||
    status === 'released' ||
    status === 'refunded' ||
    status === 'failed'
  ) {
    return status;
  }
  return fallback;
}

function normalizeClaimerKind(value: string | undefined): PaymentArtifactViewModel['claimerKind'] | undefined {
  if (value === 'agent' || value === 'human') return value;
  return undefined;
}

function normalizeCurrency(value: string | undefined): PaymentArtifactViewModel['currency'] | undefined {
  if (value === 'USD' || value === 'USDC') return value;
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function errorFromPayload(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return stringValue(payload.message);
}
