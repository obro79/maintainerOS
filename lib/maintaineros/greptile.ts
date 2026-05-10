import type { IssueDetailViewModel, PullRequestViewModel, VerificationViewModel } from './types';
import { getProviderHealth } from './provider-runtime';
import {
  buildGreptileHeaders,
  buildGreptileQueryRequest,
  buildGreptileRepositoryRequest,
  GREPTILE_DEFAULT_BASE_URL,
  greptileExpectedFiles,
  normalizeGreptileQueryVerification,
} from './greptile-shape';

export interface GreptileVerificationResult {
  ok: boolean;
  blocked: boolean;
  verification: VerificationViewModel;
  runId?: string | null;
  artifactUrl?: string | null;
  logUrl?: string | null;
  rawResponse: Record<string, unknown>;
  requestMeta?: Record<string, unknown>;
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
      requestMeta: {},
      errorMessage: detail,
      latencyMs: Date.now() - startedAt,
    };
  }

  const apiKey = process.env.GREPTILE_API_KEY;
  const githubToken = process.env.GREPTILE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!apiKey || !githubToken) {
    const detail = !apiKey ? 'GREPTILE_API_KEY is not configured.' : 'GREPTILE_GITHUB_TOKEN or GITHUB_TOKEN is required for Greptile repository access.';
    return {
      ok: false,
      blocked: true,
      verification: blockedVerification(issue, pullRequest, detail),
      rawResponse: {},
      requestMeta: {},
      errorMessage: detail,
      latencyMs: Date.now() - startedAt,
    };
  }

  const baseUrl = (process.env.GREPTILE_BASE_URL || GREPTILE_DEFAULT_BASE_URL).replace(/\/$/, '');
  const repositoryId = repositoryIdFrom(issue, pullRequest);
  const sessionId = `maintaineros-${repositoryId.replace(/[^a-z0-9]+/gi, '-')}-${issue.number}-${Date.now()}`;
  const repositoryRequest = buildGreptileRepositoryRequest(repositoryId, pullRequest.branchName);
  const queryRequest = buildGreptileQueryRequest({ sessionId, repositoryId, issue, pullRequest });
  const headers = buildGreptileHeaders(apiKey, githubToken);
  const requestMeta = {
    repositoryId,
    branch: pullRequest.branchName,
    pullRequestUrl: pullRequest.htmlUrl,
    headSha: pullRequest.headSha,
    acceptanceCheckCount: issue.workOrder.acceptanceChecks.length,
    filesTouched: greptileExpectedFiles(issue),
  };

  try {
    const indexResponse = await fetch(`${baseUrl}/repositories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(repositoryRequest),
    });
    const indexPayload = await indexResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!indexResponse.ok) {
      const message = errorFromPayload(indexPayload) ?? `Greptile repository indexing failed with ${indexResponse.status}.`;
      return failedResult(issue, pullRequest, message, { index: indexPayload }, Date.now() - startedAt, requestMeta);
    }

    const queryResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryRequest),
    });
    const queryPayload = await queryResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!queryResponse.ok) {
      const message = errorFromPayload(queryPayload) ?? `Greptile verification query failed with ${queryResponse.status}.`;
      return failedResult(issue, pullRequest, message, { index: indexPayload, query: queryPayload }, Date.now() - startedAt, requestMeta);
    }

    const verification = normalizeGreptileQueryVerification(issue, pullRequest, queryPayload);
    return {
      ok: verification.status === 'passed',
      blocked: false,
      verification,
      runId: sessionId,
      artifactUrl: stringValue(indexPayload.statusEndpoint) ?? null,
      logUrl: stringValue(indexPayload.statusEndpoint) ?? null,
      rawResponse: { index: indexPayload, query: queryPayload },
      requestMeta,
      errorMessage: verification.status === 'passed' ? null : verification.failureReason,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Greptile verification error.';
    return failedResult(issue, pullRequest, message, {}, Date.now() - startedAt, requestMeta);
  }
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

function failedResult(
  issue: IssueDetailViewModel,
  pullRequest: PullRequestViewModel,
  message: string,
  rawResponse: Record<string, unknown>,
  latencyMs: number,
  requestMeta: Record<string, unknown> = {},
): GreptileVerificationResult {
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
    requestMeta,
    errorMessage: message,
    latencyMs,
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function errorFromPayload(payload: Record<string, unknown>) {
  const error = payload.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return stringValue(payload.message);
}

function repositoryIdFrom(issue: IssueDetailViewModel, pullRequest: PullRequestViewModel) {
  const urlMatch = pullRequest.htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/\d+/i)
    ?? issue.htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/\d+/i);
  if (!urlMatch) throw new Error('Could not infer GitHub repository from issue or pull request URL.');
  return `${urlMatch[1]}/${urlMatch[2]}`;
}
