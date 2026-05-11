import type { GreptileCommentViewModel, IssueDetailViewModel, PullRequestViewModel, VerificationViewModel } from './types';
import { getProviderHealth } from './provider-runtime';
import {
  buildGreptileHeaders,
  buildGreptileQueryRequest,
  buildGreptileRepositoryRequest,
  buildGreptileRepositoryStatusPath,
  GREPTILE_DEFAULT_BASE_URL,
  greptileExpectedFiles,
  type GreptileRepositoryStatusPayload,
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

    const indexStatus = await waitForRepositoryIndex(baseUrl, headers, repositoryId, pullRequest.branchName);
    if (!indexStatus.ready) {
      const message = indexStatus.error
        ?? `Greptile repository index is ${indexStatus.status ?? 'not ready'}; retry verification after indexing completes.`;
      return failedResult(issue, pullRequest, message, { index: indexPayload, indexStatus: indexStatus.payload ?? {} }, Date.now() - startedAt, requestMeta);
    }

    const queryResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryRequest),
    });
    const queryPayload = await queryResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!queryResponse.ok) {
      if (queryResponse.status === 404) {
        return verifyFromGitHubReviewEvidence(issue, pullRequest, githubToken, {
          index: indexPayload,
          indexStatus: indexStatus.payload ?? {},
          query: queryPayload,
        }, Date.now() - startedAt, requestMeta);
      }
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

async function verifyFromGitHubReviewEvidence(
  issue: IssueDetailViewModel,
  pullRequest: PullRequestViewModel,
  githubToken: string,
  rawResponse: Record<string, unknown>,
  latencyMs: number,
  requestMeta: Record<string, unknown>,
): Promise<GreptileVerificationResult> {
  const repositoryId = repositoryIdFrom(issue, pullRequest);
  const [owner, repo] = repositoryId.split('/');
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const [issueComments, reviewComments, checkRuns] = await Promise.all([
    fetchGitHubJson<Array<GitHubComment>>(`https://api.github.com/repos/${owner}/${repo}/issues/${pullRequest.number}/comments`, headers),
    fetchGitHubJson<Array<GitHubReviewComment>>(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequest.number}/comments`, headers),
    fetchGitHubJson<GitHubCheckRunsResponse>(`https://api.github.com/repos/${owner}/${repo}/commits/${pullRequest.headSha}/check-runs`, headers),
  ]);
  const comments = [
    ...issueComments.flatMap((comment) => toGreptileComment(comment)),
    ...reviewComments.flatMap((comment) => toGreptileComment(comment)),
  ];
  const greptileChecks = (checkRuns.check_runs ?? []).filter(isGreptileCheckRun);
  const completedChecks = greptileChecks.filter((check) => check.status === 'completed');
  const failedChecks = completedChecks.filter((check) => check.conclusion && check.conclusion !== 'success' && check.conclusion !== 'neutral');
  const passedChecks = completedChecks.filter((check) => check.conclusion === 'success' || check.conclusion === 'neutral');
  const status: VerificationViewModel['status'] = failedChecks.length > 0 || comments.length > 0
    ? 'failed'
    : passedChecks.length > 0
      ? 'passed'
      : 'pending';
  const summary = status === 'pending'
    ? 'Greptile has not posted GitHub review evidence for this PR yet. Comment @greptileai to force a review, then rerun verification.'
    : status === 'passed'
      ? 'Greptile GitHub check evidence passed for this PR.'
      : `Greptile reported ${comments.length || failedChecks.length} blocking review signal${(comments.length || failedChecks.length) === 1 ? '' : 's'}.`;
  const blockingFindings = status === 'failed'
    ? [
      ...comments.map((comment) => comment.body).filter(Boolean),
      ...failedChecks.map((check) => `${check.name}: ${check.conclusion ?? 'failed'}`),
    ].slice(0, 8)
    : [];
  const verification: VerificationViewModel = {
    provider: 'greptile',
    sourceState: 'live',
    status,
    summary,
    criteria: issue.workOrder.acceptanceChecks,
    filesTouched: greptileExpectedFiles(issue),
    filesInspected: comments.flatMap((comment) => comment.path ? [comment.path] : []).slice(0, 12),
    verifiedSha: status === 'pending' ? null : pullRequest.headSha,
    currentSha: pullRequest.headSha,
    blockingFindingsCount: blockingFindings.length,
    blockingFindings,
    comments,
    riskSummary: status === 'passed' ? 'Greptile GitHub check completed successfully.' : summary,
    failureReason: status === 'passed' ? null : summary,
    verifiedAt: status === 'pending' ? null : new Date().toISOString(),
    isStale: false,
  };
  return {
    ok: status === 'passed',
    blocked: false,
    verification,
    runId: `github-greptile-${repositoryId}-${pullRequest.number}-${Date.now()}`,
    artifactUrl: pullRequest.htmlUrl,
    logUrl: pullRequest.htmlUrl,
    rawResponse: {
      ...rawResponse,
      githubEvidence: {
        issueCommentsCount: issueComments.length,
        reviewCommentsCount: reviewComments.length,
        greptileCommentsCount: comments.length,
        greptileChecks,
      },
    },
    requestMeta,
    errorMessage: status === 'passed' ? null : summary,
    latencyMs,
  };
}

async function waitForRepositoryIndex(baseUrl: string, headers: HeadersInit, repositoryId: string, branch: string) {
  const attempts = Number(process.env.GREPTILE_INDEX_POLL_ATTEMPTS || '6');
  const delayMs = Number(process.env.GREPTILE_INDEX_POLL_DELAY_MS || '2000');
  let lastPayload: GreptileRepositoryStatusPayload | null = null;
  let lastStatus: string | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    const response = await fetch(`${baseUrl}${buildGreptileRepositoryStatusPath(repositoryId, branch)}`, {
      method: 'GET',
      headers,
    });
    const payload = await response.json().catch(() => ({})) as GreptileRepositoryStatusPayload;
    lastPayload = payload;
    lastStatus = statusValue(payload.status);

    if (!response.ok) {
      return {
        ready: false,
        status: lastStatus,
        payload,
        error: errorFromPayload(payload as Record<string, unknown>) ?? `Greptile repository status failed with ${response.status}.`,
      };
    }
    if (lastStatus === 'completed' && typeof payload.sha === 'string' && payload.sha.trim()) {
      return { ready: true, status: lastStatus, payload };
    }
    if (lastStatus === 'failed' || lastStatus === 'error') {
      return { ready: false, status: lastStatus, payload, error: `Greptile repository indexing ${lastStatus}.` };
    }
  }

  return { ready: false, status: lastStatus, payload: lastPayload };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GitHubComment {
  id: number;
  body?: string | null;
  html_url: string;
  user?: { login?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GitHubReviewComment extends GitHubComment {
  path?: string | null;
  line?: number | null;
}

interface GitHubCheckRun {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  app?: { slug?: string | null; name?: string | null } | null;
}

interface GitHubCheckRunsResponse {
  check_runs?: GitHubCheckRun[];
}

async function fetchGitHubJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) return [] as T;
  return await response.json().catch(() => [] as T) as T;
}

function toGreptileComment(comment: GitHubComment | GitHubReviewComment): GreptileCommentViewModel[] {
  const author = comment.user?.login ?? 'unknown';
  if (!author.toLowerCase().includes('greptile')) return [];
  return [{
    id: String(comment.id),
    authorLogin: author,
    body: comment.body ?? '',
    htmlUrl: comment.html_url,
    path: 'path' in comment ? comment.path ?? null : null,
    line: 'line' in comment ? comment.line ?? null : null,
    createdAt: comment.created_at ?? new Date().toISOString(),
  }];
}

function isGreptileCheckRun(checkRun: GitHubCheckRun) {
  const haystack = [checkRun.name, checkRun.app?.slug, checkRun.app?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes('greptile');
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

function statusValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
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
