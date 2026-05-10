import type { IssueDetailViewModel, PullRequestViewModel, VerificationViewModel } from './types';
import { getProviderHealth } from './provider-runtime';

export interface GreptileVerificationResult {
  ok: boolean;
  blocked: boolean;
  verification: VerificationViewModel;
  runId?: string | null;
  artifactUrl?: string | null;
  logUrl?: string | null;
  rawResponse: Record<string, unknown>;
  errorMessage?: string | null;
  latencyMs: number;
}

export async function verifyPullRequestWithGreptile(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel): Promise<GreptileVerificationResult> {
  const startedAt = Date.now();
  const health = getProviderHealth('greptile');
  if (!health?.configured) {
    const detail = health?.detail ?? 'GREPTILE_API_KEY is not configured.';
    return {
      ok: false,
      blocked: true,
      verification: blockedVerification(issue, pullRequest, detail),
      rawResponse: {},
      errorMessage: detail,
      latencyMs: Date.now() - startedAt,
    };
  }

  const baseUrl = (process.env.GREPTILE_VERIFY_URL || process.env.GREPTILE_BASE_URL || 'https://api.greptile.com/v2/verify').replace(/\/$/, '');
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GREPTILE_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        repository: issue.htmlUrl.split('/issues/')[0],
        issue: {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          acceptanceChecks: issue.workOrder.acceptanceChecks,
        },
        pullRequest: {
          number: pullRequest.number,
          url: pullRequest.htmlUrl,
          headSha: pullRequest.headSha,
          branchName: pullRequest.branchName,
        },
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = errorFromPayload(payload) ?? `Greptile verification failed with ${response.status}.`;
      return failedResult(issue, pullRequest, message, payload, Date.now() - startedAt);
    }
    return {
      ok: true,
      blocked: false,
      verification: normalizeGreptileVerification(issue, pullRequest, payload),
      runId: stringValue(payload.runId) ?? stringValue(payload.id) ?? null,
      artifactUrl: stringValue(payload.artifactUrl) ?? stringValue(payload.url) ?? null,
      logUrl: stringValue(payload.logUrl) ?? null,
      rawResponse: payload,
      errorMessage: null,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Greptile verification error.';
    return failedResult(issue, pullRequest, message, {}, Date.now() - startedAt);
  }
}

function normalizeGreptileVerification(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel, payload: Record<string, unknown>): VerificationViewModel {
  const status = normalizeStatus(stringValue(payload.status) ?? stringValue(payload.conclusion));
  const findings = stringArray(payload.blockingFindings ?? payload.findings);
  const verifiedSha = stringValue(payload.verifiedSha) ?? stringValue(payload.headSha) ?? pullRequest.headSha;
  const currentSha = pullRequest.headSha;
  const isStale = verifiedSha !== currentSha;
  const effectiveStatus = isStale ? 'stale' : findings.length > 0 && status === 'passed' ? 'failed' : status;
  return {
    provider: 'greptile',
    sourceState: 'live',
    status: effectiveStatus,
    summary: stringValue(payload.summary) ?? summaryFor(issue, effectiveStatus),
    criteria: stringArray(payload.criteria).length ? stringArray(payload.criteria) : issue.workOrder.acceptanceChecks,
    filesTouched: stringArray(payload.filesTouched).length ? stringArray(payload.filesTouched) : issue.workOrder.suggestedFiles,
    filesInspected: stringArray(payload.filesInspected ?? payload.files).slice(0, 12),
    verifiedSha,
    currentSha,
    blockingFindingsCount: numberValue(payload.blockingFindingsCount) ?? findings.length,
    blockingFindings: findings,
    riskSummary: stringValue(payload.riskSummary) ?? riskFor(effectiveStatus),
    failureReason: effectiveStatus === 'passed' ? null : findings[0] ?? stringValue(payload.failureReason) ?? riskFor(effectiveStatus),
    verifiedAt: stringValue(payload.verifiedAt) ?? new Date().toISOString(),
    isStale,
  };
}

function blockedVerification(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel, detail: string): VerificationViewModel {
  return {
    provider: 'greptile',
    sourceState: 'planned',
    status: 'pending',
    summary: detail,
    criteria: issue.workOrder.acceptanceChecks,
    filesTouched: issue.workOrder.suggestedFiles,
    filesInspected: [],
    verifiedSha: null,
    currentSha: pullRequest.headSha,
    blockingFindingsCount: 0,
    blockingFindings: [],
    riskSummary: 'Verification is blocked until Greptile is configured.',
    failureReason: detail,
    verifiedAt: null,
    isStale: false,
  };
}

function failedResult(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel, message: string, rawResponse: Record<string, unknown>, latencyMs: number): GreptileVerificationResult {
  return {
    ok: false,
    blocked: false,
    verification: {
      provider: 'greptile',
      sourceState: 'live',
      status: 'failed',
      summary: `Greptile verification failed for #${issue.number}.`,
      criteria: issue.workOrder.acceptanceChecks,
      filesTouched: issue.workOrder.suggestedFiles,
      filesInspected: [],
      verifiedSha: pullRequest.headSha,
      currentSha: pullRequest.headSha,
      blockingFindingsCount: 1,
      blockingFindings: [message],
      riskSummary: 'Verification provider failed before a passing proof was recorded.',
      failureReason: message,
      verifiedAt: new Date().toISOString(),
      isStale: false,
    },
    rawResponse,
    errorMessage: message,
    latencyMs,
  };
}

function normalizeStatus(value: string | undefined): VerificationViewModel['status'] {
  const status = value?.toLowerCase();
  if (status === 'passed' || status === 'pass' || status === 'success' || status === 'succeeded') return 'passed';
  if (status === 'stale') return 'stale';
  if (status === 'pending' || status === 'running') return 'pending';
  return 'failed';
}

function summaryFor(issue: IssueDetailViewModel, status: VerificationViewModel['status']) {
  if (status === 'passed') return `Greptile proof passed for #${issue.number}; acceptance checks were satisfied.`;
  if (status === 'stale') return `Greptile proof is stale for #${issue.number}; PR head changed after verification.`;
  if (status === 'pending') return `Greptile verification is pending for #${issue.number}.`;
  return `Greptile proof failed for #${issue.number}; blocking findings require retry or escalation.`;
}

function riskFor(status: VerificationViewModel['status']) {
  if (status === 'passed') return 'No blocking risk found against acceptance checks.';
  if (status === 'stale') return 'Proof must be rerun against the current PR head before completion or payout.';
  if (status === 'pending') return 'Verification has not completed.';
  return 'Blocking proof gaps remain.';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object' && 'message' in item && typeof item.message === 'string') return [item.message];
    if (item && typeof item === 'object' && 'path' in item && typeof item.path === 'string') return [item.path];
    return [];
  });
}

function errorFromPayload(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return stringValue(payload.message);
}
