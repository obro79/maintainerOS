import { buildSandboxExecutionsForIssue } from './daytona';
import type {
  ArtifactSourceState,
  IssueDetailViewModel,
  IssueTraceEventViewModel,
  PullRequestViewModel,
  SandboxExecutionViewModel,
} from './types';

export interface AiSandboxAttemptResult {
  status: 'recorded' | 'blocked';
  blocked: boolean;
  reason: string | null;
  attempts: SandboxExecutionViewModel[];
  pullRequest: PullRequestViewModel | null;
  traceEvents: IssueTraceEventViewModel[];
}

export function buildAiSandboxAttemptResult(
  issue: IssueDetailViewModel,
  repositoryId: string,
  sourceState: ArtifactSourceState,
): AiSandboxAttemptResult {
  if (!isAutomationOwnedAiRoute(issue)) {
    const reason = blockedAttemptReason(issue);
    return {
      status: 'blocked',
      blocked: true,
      reason,
      attempts: [],
      pullRequest: null,
      traceEvents: [buildBlockedAttemptTraceEvent(issue, sourceState, reason)],
    };
  }

  const attempts = buildSandboxExecutionsForIssue(issue, repositoryId, sourceState);
  const pullRequest = issue.pullRequest ?? buildPullRequestFromAttempt(issue, repositoryId, attempts);
  const prTraceEvent = pullRequest && !issue.pullRequest
    ? buildAutomationPullRequestTraceEvent(issue, pullRequest, sourceState)
    : null;

  return {
    status: 'recorded',
    blocked: false,
    reason: null,
    attempts,
    pullRequest,
    traceEvents: prTraceEvent ? [prTraceEvent] : [],
  };
}

function isAutomationOwnedAiRoute(issue: IssueDetailViewModel) {
  return issue.route === 'agent-solvable' && issue.routePolicy.automationAllowed === true;
}

function blockedAttemptReason(issue: IssueDetailViewModel) {
  if (issue.route !== 'agent-solvable') {
    return `${issue.routePolicy.executionMode.toUpperCase()} route is not automation-owned; no AI sandbox attempt is created.`;
  }
  return issue.routePolicy.reasons.join(' ') || 'AI route policy blocked sandbox execution.';
}

function buildBlockedAttemptTraceEvent(issue: IssueDetailViewModel, sourceState: ArtifactSourceState, reason: string): IssueTraceEventViewModel {
  return {
    id: `${issue.id}-ai-attempt-blocked`,
    at: new Date(Date.UTC(2026, 4, 8, 21, issue.number % 55, 0)).toISOString(),
    actor: 'AI attempt gate',
    provider: 'daytona',
    sourceState,
    route: issue.route,
    title: 'AI sandbox attempt blocked',
    detail: reason,
    status: 'blocked',
    relatedId: issue.workOrder.generatedAt ?? issue.id,
  };
}

function buildPullRequestFromAttempt(
  issue: IssueDetailViewModel,
  repositoryId: string,
  attempts: SandboxExecutionViewModel[],
): PullRequestViewModel | null {
  const passedAttempt = [...attempts].reverse().find((attempt) => attempt.status === 'passed' && attempt.pullRequestUrl);
  if (!passedAttempt?.pullRequestUrl) return null;
  const number = parsePullRequestNumber(passedAttempt.pullRequestUrl) ?? 900 + issue.number;
  return {
    provider: 'github',
    id: `${issue.id}-ai-pr-${number}`,
    sourceState: passedAttempt.sourceState,
    issueId: issue.id,
    workOrderId: issue.workOrder.generatedAt ?? issue.id,
    number,
    title: `AI fix for #${issue.number}: ${issue.title}`,
    baseBranch: 'main',
    branchName: passedAttempt.branchName,
    headSha: stableSyntheticSha(`${repositoryId}-${issue.number}-${passedAttempt.id}`),
    status: 'open',
    htmlUrl: passedAttempt.pullRequestUrl,
    authorLogin: 'maintaineros-ai',
    authorOwnerType: 'automation',
    automationOwned: true,
    linkedAt: new Date(Date.UTC(2026, 4, 8, 21, issue.number % 55, 1)).toISOString(),
  };
}

function buildAutomationPullRequestTraceEvent(
  issue: IssueDetailViewModel,
  pullRequest: PullRequestViewModel,
  sourceState: ArtifactSourceState,
): IssueTraceEventViewModel {
  return {
    id: `${issue.id}-ai-pr-${pullRequest.number}`,
    at: pullRequest.linkedAt ?? new Date().toISOString(),
    actor: 'AI PR artifact recorder',
    provider: 'github',
    sourceState,
    route: issue.route,
    title: `Automation PR #${pullRequest.number} recorded`,
    detail: `${pullRequest.authorLogin} opened ${pullRequest.branchName}; owner=${pullRequest.authorOwnerType}; automationOwned=${pullRequest.automationOwned}. Greptile verification is still required before completion.`,
    status: 'succeeded',
    artifactUrl: pullRequest.htmlUrl,
    relatedId: pullRequest.headSha,
  };
}

function parsePullRequestNumber(url: string) {
  const match = url.match(/\/pull\/(\d+)(?:$|[/?#])/);
  return match ? Number(match[1]) : null;
}

function stableSyntheticSha(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(40, '0').slice(0, 40);
}
