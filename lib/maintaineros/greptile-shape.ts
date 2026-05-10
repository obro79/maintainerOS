import type { IssueDetailViewModel, PullRequestViewModel, VerificationViewModel } from './types';

export const GREPTILE_DEFAULT_BASE_URL = 'https://api.greptile.com/v2';

export interface GreptileRepositoryRequest {
  remote: 'github';
  repository: string;
  branch: string;
  reload: boolean;
  notify: boolean;
}

export interface GreptileQueryRequest {
  messages: Array<{ id: string; role: 'user'; content: string }>;
  repositories: Array<{ remote: 'github'; repository: string; branch: string }>;
  sessionId: string;
  stream: false;
  genius: true;
}

export interface GreptileQueryPayload {
  message?: unknown;
  sources?: unknown;
}

export function buildGreptileHeaders(apiKey: string, githubToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-GitHub-Token': githubToken,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function buildGreptileRepositoryRequest(repositoryId: string, branch: string): GreptileRepositoryRequest {
  return {
    remote: 'github',
    repository: repositoryId,
    branch,
    reload: false,
    notify: false,
  };
}

export function buildGreptileQueryRequest(input: {
  sessionId: string;
  repositoryId: string;
  issue: IssueDetailViewModel;
  pullRequest: PullRequestViewModel;
}): GreptileQueryRequest {
  return {
    messages: [
      {
        id: `${input.issue.id}-verify-${input.pullRequest.number}`,
        role: 'user',
        content: [
          'Verify whether this pull request satisfies the GitHub issue and MaintainerOS work order.',
          'Return a concise answer that starts with exactly one line: VERDICT: passed or VERDICT: failed.',
          'Only use VERDICT: passed when the referenced branch satisfies every acceptance check. If evidence is incomplete, use VERDICT: failed.',
          '',
          `Repository: ${input.repositoryId}`,
          `Issue: #${input.issue.number} ${input.issue.title}`,
          `Issue URL: ${input.issue.htmlUrl}`,
          `Issue body:\n${input.issue.body}`,
          '',
          `Pull request: #${input.pullRequest.number} ${input.pullRequest.title}`,
          `PR URL: ${input.pullRequest.htmlUrl}`,
          `Branch: ${input.pullRequest.branchName}`,
          `Head SHA: ${input.pullRequest.headSha}`,
          '',
          `Acceptance checks:\n${input.issue.workOrder.acceptanceChecks.map((check) => `- ${check}`).join('\n')}`,
          `Touched or expected files:\n${greptileExpectedFiles(input.issue).map((file) => `- ${file}`).join('\n')}`,
          '',
          'After the verdict, include SUMMARY, BLOCKING FINDINGS, and FILES INSPECTED sections.',
        ].join('\n'),
      },
    ],
    repositories: [
      {
        remote: 'github',
        repository: input.repositoryId,
        branch: input.pullRequest.branchName,
      },
    ],
    sessionId: input.sessionId,
    stream: false,
    genius: true,
  };
}

export function normalizeGreptileQueryVerification(
  issue: IssueDetailViewModel,
  pullRequest: PullRequestViewModel,
  payload: GreptileQueryPayload,
): VerificationViewModel {
  const message = typeof payload.message === 'string' ? payload.message : '';
  const sources = normalizeSources(payload.sources);
  const explicitVerdict = verdictFromMessage(message);
  const blockingFindings = explicitVerdict === 'passed' ? [] : blockingFindingsFromMessage(message);
  const verifiedSha = shaFromMessage(message) ?? pullRequest.headSha;
  const currentSha = pullRequest.headSha;
  const isStale = verifiedSha !== currentSha;
  const status: VerificationViewModel['status'] = isStale
    ? 'stale'
    : explicitVerdict === 'passed'
      ? 'passed'
      : 'failed';
  const effectiveFindings = status === 'passed'
    ? []
    : blockingFindings.length
      ? blockingFindings
      : [explicitVerdict ? 'Greptile reported a failing verdict.' : 'Greptile response did not include an explicit passing verdict.'];

  return {
    provider: 'greptile',
    sourceState: 'live',
    status,
    summary: summaryFromMessage(message) ?? summaryFor(issue, status),
    criteria: issue.workOrder.acceptanceChecks,
    filesTouched: greptileExpectedFiles(issue),
    filesInspected: sources.map((source) => source.filepath).slice(0, 12),
    verifiedSha,
    currentSha,
    blockingFindingsCount: effectiveFindings.length,
    blockingFindings: effectiveFindings,
    riskSummary: status === 'passed' ? 'No blocking risk found against acceptance checks.' : effectiveFindings[0],
    failureReason: status === 'passed' ? null : effectiveFindings[0],
    verifiedAt: new Date().toISOString(),
    isStale,
  };
}

export function greptileExpectedFiles(issue: IssueDetailViewModel) {
  return Array.from(new Set([
    ...(issue.workOrder.suggestedFiles ?? []),
    ...(issue.sandboxExecutions.flatMap((attempt) => attempt.filesTouched) ?? []),
  ].filter(Boolean))).slice(0, 24);
}

function verdictFromMessage(message: string): 'passed' | 'failed' | null {
  const verdict = message.match(/^\s*VERDICT:\s*(passed|failed)\b/im)?.[1]?.toLowerCase();
  return verdict === 'passed' || verdict === 'failed' ? verdict : null;
}

function blockingFindingsFromMessage(message: string) {
  const section = message.match(/BLOCKING FINDINGS:?([\s\S]*?)(?:\n[A-Z][A-Z ]{2,}:|$)/i)?.[1] ?? '';
  return section
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function summaryFromMessage(message: string) {
  const summary = message.match(/SUMMARY:?([\s\S]*?)(?:\n[A-Z][A-Z ]{2,}:|$)/i)?.[1]?.trim();
  if (summary) return summary.split('\n').map((line) => line.trim()).filter(Boolean).join(' ').slice(0, 500);
  return message.trim().split('\n').find((line) => line.trim() && !/^VERDICT:/i.test(line))?.trim().slice(0, 500) ?? null;
}

function shaFromMessage(message: string) {
  return message.match(/\b[0-9a-f]{40}\b/i)?.[0] ?? null;
}

function normalizeSources(value: unknown): Array<{ filepath: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source) => {
    if (!source || typeof source !== 'object') return [];
    const filepath = 'filepath' in source && typeof source.filepath === 'string' ? source.filepath : null;
    return filepath ? [{ filepath }] : [];
  });
}

function summaryFor(issue: IssueDetailViewModel, status: VerificationViewModel['status']) {
  if (status === 'passed') return `Greptile proof passed for #${issue.number}; acceptance checks were satisfied.`;
  if (status === 'stale') return `Greptile proof is stale for #${issue.number}; PR head changed after verification.`;
  return `Greptile proof failed for #${issue.number}; blocking findings require retry or escalation.`;
}
