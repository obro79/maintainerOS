import {
  ROUTE_LABEL,
  ROUTE_TO_LANE,
  type ClustlyBountyListItemViewModel,
  type DashboardViewModel,
  type EvaluationSummaryViewModel,
  type ExecutionRoute,
  type ImportRunViewModel,
  type IssueCardViewModel,
  type IssueDetailViewModel,
  type IssueTraceEventViewModel,
  type GreptileCommentViewModel,
  type MaintainerOSRepository,
  type PullRequestViewModel,
  type RouteBucketViewModel,
  type SandboxAttemptListItemViewModel,
  type VerificationQueueItemViewModel,
  type VerificationViewModel,
} from './types';
import { classifyComplexity, classifyRisk, estimatePremiumBaselineCents, evaluateRoutePolicy, scoreIssue, selectClodModel } from './routing';
import { withPostgres, type PgClient } from './postgres';
import { applyStoredClodArtifact } from './clod-artifacts';
import { buildContextPackForIssue, buildNiaTraceEvent } from './nia-context';
import { buildSandboxExecutionsForIssue, buildSandboxTraceEvents, toSandboxAttemptListItems } from './daytona';
import { toVerificationQueueItem } from './verification';
import { toClustlyBountyListItem } from './payments';
import { listSponsorProofRuns } from './provider-runs';
import { mergeSponsorProof } from './sponsor-proof';
import { canReleasePayout, hidePayoutArtifactsForNonClustlyRoutes } from './payout';
import { listPersistedTraceEvents, mergeTraceEvents } from './trace-events';
import { buildDeterministicWorkOrder } from './work-orders';
import { buildRouteHistoryFromTrace } from './route-history';
import { getProviderHealth } from './provider-runtime';
import { ROUTED_ISSUE_DISPLAY_LIMIT } from './limits';

interface RepositoryRow {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  html_url: string;
  open_issue_count: number;
  imported_at: Date | string | null;
}

interface IssueRow {
  id: string;
  repository_id: string;
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[] | string;
  comments_count: number;
  html_url: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface ImportRunRow {
  id: string;
  owner: string;
  repo: string;
  requested_limit: number;
  imported_issue_count: number;
  imported_pull_request_count: number;
  skipped_pull_request_count: number;
  status: ImportRunViewModel['status'];
  source_state: ImportRunViewModel['sourceState'];
  started_at: Date | string;
  finished_at: Date | string | null;
  error_message: string | null;
}

interface PullRequestRow {
  id: string;
  repository_id: string;
  number: number;
  title: string;
  body: string;
  author: string;
  branch_name: string;
  head_sha: string | null;
  base_branch: string;
  html_url: string;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  merged_at: Date | string | null;
  linked_issue_number: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface PullRequestCommentRow {
  id: string;
  pull_request_number: number;
  author: string;
  body: string;
  html_url: string;
  path: string | null;
  line: number | null;
  created_at: Date | string | null;
}

interface PullRequestEvidenceMaps {
  pullRequestsByIssue: Map<number, PullRequestRow>;
  commentsByPullRequest: Map<number, GreptileCommentViewModel[]>;
}

export class NeonMaintainerOSRepository implements MaintainerOSRepository {
  async getDashboard(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || ''): Promise<DashboardViewModel> {
    return withPostgres(async (client) => {
      const repository = await findRepository(client, repositoryId);
      const issues = await client.query<IssueRow>(
        `select * from maintaineros_issues where repository_id = $1 order by updated_at desc nulls last, number desc limit $2`,
        [repository.id, ROUTED_ISSUE_DISPLAY_LIMIT],
      );
      const evidence = await loadPullRequestEvidence(client, repository.id);
      const cards = issues.rows.map(toIssueCard);
      const details = await Promise.all(issues.rows.map((issue) => toIssueDetailWithPersistedTrace(client, repository.id, issue, evidence)));
      const selectedIssue = details[0] ?? emptyIssueDetail(repository.id);
      const latestImportRun = await getLatestImportRun(client, repository.owner, repository.name);
      const sponsorProof = mergeSponsorProof(await listSponsorProofRuns(client, repository.id));

      return {
        repository: {
          id: repository.id,
          provider: 'github',
          owner: repository.owner,
          name: repository.name,
          fullName: repository.full_name,
          htmlUrl: repository.html_url,
          openIssueCount: repository.open_issue_count,
          dataMode: 'live',
          importedAt: toIso(repository.imported_at),
          latestImportRun,
          dataSource: {
            mode: 'live',
            sourceState: 'live',
            provider: 'neon',
            checkedAt: new Date().toISOString(),
          },
        },
        demo: {
          step: 'messy_backlog',
          isAutoPlaying: false,
        },
        buckets: buildBuckets(cards),
        issues: cards,
        issueDetails: details,
        selectedIssue,
        evaluation: liveEvaluation(cards.length),
        providerStatuses: [
          { provider: 'github', sourceState: 'live', status: 'connected', label: 'GitHub', lastRunAt: latestImportRun?.finishedAt ?? undefined, detail: latestImportRun ? `${latestImportRun.importedIssueCount} issues and ${latestImportRun.importedPullRequestCount ?? 0} PRs imported.` : 'Ready for GitHub import.' },
          { provider: 'neon', sourceState: 'live', status: 'connected', label: 'Neon', lastRunAt: latestImportRun?.finishedAt ?? undefined, detail: 'Reading imported issues from Neon.' },
          { provider: 'clod', sourceState: 'planned', status: 'planned', label: 'CLōD', detail: 'Routing artifacts land in Phase 2.' },
          buildNiaProviderStatus(),
          { provider: 'daytona', sourceState: 'planned', status: 'planned', label: 'Daytona', detail: 'Sandbox dispatch lands in Phase 4.' },
          { provider: 'greptile', sourceState: 'planned', status: 'planned', label: 'Greptile', detail: 'Verification lands in Phase 5.' },
          { provider: 'clustly', sourceState: 'planned', status: 'planned', label: 'Clustly', detail: 'Bounty rail lands in Phase 6.' },
        ],
        sponsorProof,
      };
    });
  }

  async getIssueDetail(repositoryId: string, issueNumber: number): Promise<IssueDetailViewModel | null> {
    return withPostgres(async (client) => {
      const repository = await findRepository(client, repositoryId);
      const result = await client.query<IssueRow>(
        `select * from maintaineros_issues where repository_id = $1 and number = $2 limit 1`,
        [repository.id, issueNumber],
      );
      return result.rows[0] ? toIssueDetailWithPersistedTrace(client, repository.id, result.rows[0]) : null;
    });
  }

  async getIssueTrace(repositoryId: string, issueNumber: number): Promise<IssueTraceEventViewModel[]> {
    const issue = await this.getIssueDetail(repositoryId, issueNumber);
    return issue?.trace ?? [];
  }

  async getEvaluationSummary(repositoryId?: string): Promise<EvaluationSummaryViewModel> {
    const dashboard = await this.getDashboard(repositoryId);
    return dashboard.evaluation;
  }

  async getSandboxAttempts(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || ''): Promise<SandboxAttemptListItemViewModel[]> {
    const dashboard = await this.getDashboard(repositoryId);
    return dashboard.issueDetails.flatMap((issue) => toSandboxAttemptListItems(dashboard.repository.id, issue));
  }

  async getVerificationQueue(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || ''): Promise<VerificationQueueItemViewModel[]> {
    const dashboard = await this.getDashboard(repositoryId);
    const linkedPullRequestNumbers = new Set(dashboard.issueDetails.flatMap((issue) => issue.pullRequest ? [issue.pullRequest.number] : []));
    const pullRequestItems = await withPostgres(async (client) => {
      const repository = await findRepository(client, repositoryId);
      const pullRequests = await listPullRequests(client, repository.id);
      const comments = await listGreptileComments(client, repository.id);
      return pullRequests
        .filter((pullRequest) => !linkedPullRequestNumbers.has(pullRequest.number))
        .map((pullRequest) => toPullRequestVerificationItem(pullRequest, comments.get(pullRequest.number) ?? []));
    });
    return [
      ...dashboard.issueDetails.map((issue) => toVerificationQueueItem(dashboard.repository.id, issue)),
      ...pullRequestItems,
    ];
  }

  async getBountyTasks(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || ''): Promise<ClustlyBountyListItemViewModel[]> {
    const dashboard = await this.getDashboard(repositoryId);
    return dashboard.issueDetails
      .map((issue) => toClustlyBountyListItem(dashboard.repository.id, issue))
      .filter((item): item is ClustlyBountyListItemViewModel => Boolean(item));
  }
}

async function toIssueDetailWithPersistedTrace(client: PgClient, repositoryId: string, issue: IssueRow, evidence?: PullRequestEvidenceMaps) {
  const detail = applyStoredClodArtifact(repositoryId, await toIssueDetail(issue));
  let pullRequest = evidence?.pullRequestsByIssue.get(issue.number) ?? null;
  pullRequest ??= await findPullRequestForIssue(client, repositoryId, issue.number);
  let comments: GreptileCommentViewModel[] = [];
  if (pullRequest) {
    comments = evidence?.commentsByPullRequest.get(pullRequest.number) ?? [];
    if (comments.length === 0 && !evidence) {
      comments = await listGreptileCommentsForPullRequest(client, repositoryId, pullRequest.number);
    }
  }
  const detailWithPullRequest = pullRequest ? attachPullRequestEvidence(detail, pullRequest, comments) : detail;
  const persisted = await listPersistedTraceEvents(repositoryId, detail.number);
  if (persisted.length === 0) return detailWithPullRequest;
  return {
    ...detailWithPullRequest,
    trace: mergeTraceEvents(detailWithPullRequest.trace, persisted),
  };
}

function attachPullRequestEvidence(detail: IssueDetailViewModel, pullRequest: PullRequestRow, comments: GreptileCommentViewModel[]): IssueDetailViewModel {
  const pullRequestView = toPullRequestViewModel(pullRequest);
  const verification = buildLiveGreptileVerification(pullRequestView, comments);
  const withEvidence = hidePayoutArtifactsForNonClustlyRoutes({
    ...detail,
    pullRequest: pullRequestView,
    verification,
  });
  return {
    ...withEvidence,
    payoutGate: canReleasePayout(withEvidence),
  };
}

async function findRepository(client: PgClient, repositoryId: string): Promise<RepositoryRow> {
  const normalized = repositoryId.toLowerCase();
  const result = await client.query<RepositoryRow>(
    `select * from maintaineros_repositories
     where lower(id) = $1 or lower(full_name) = $1
     order by imported_at desc nulls last
     limit 1`,
    [normalized],
  );
  if (!result.rows[0]) {
    throw new Error(`No imported Neon repository found for ${repositoryId}. Run /api/maintaineros/import-github first.`);
  }
  return result.rows[0];
}

async function getLatestImportRun(client: PgClient, owner: string, repo: string): Promise<ImportRunViewModel | null> {
  const result = await client.query<ImportRunRow>(
    `select * from maintaineros_import_runs
     where lower(owner) = lower($1) and lower(repo) = lower($2)
     order by started_at desc
     limit 1`,
    [owner, repo],
  );
  return result.rows[0] ? toImportRun(result.rows[0]) : null;
}

async function loadPullRequestEvidence(client: PgClient, repositoryId: string): Promise<PullRequestEvidenceMaps> {
  const pullRequests = await listPullRequests(client, repositoryId);
  const commentsByPullRequest = await listGreptileComments(client, repositoryId);
  const pullRequestsByIssue = new Map<number, PullRequestRow>();
  for (const pullRequest of pullRequests) {
    if (pullRequest.linked_issue_number == null) continue;
    if (pullRequestsByIssue.has(pullRequest.linked_issue_number)) continue;
    pullRequestsByIssue.set(pullRequest.linked_issue_number, pullRequest);
  }
  return { pullRequestsByIssue, commentsByPullRequest };
}

async function findPullRequestForIssue(client: PgClient, repositoryId: string, issueNumber: number): Promise<PullRequestRow | null> {
  const result = await client.query<PullRequestRow>(
    `select * from maintaineros_pull_requests
     where repository_id = $1 and linked_issue_number = $2
     order by updated_at desc nulls last, number desc
     limit 1`,
    [repositoryId, issueNumber],
  );
  return result.rows[0] ?? null;
}

async function listPullRequests(client: PgClient, repositoryId: string): Promise<PullRequestRow[]> {
  const result = await client.query<PullRequestRow>(
    `select * from maintaineros_pull_requests
     where repository_id = $1
     order by updated_at desc nulls last, number desc
     limit 5000`,
    [repositoryId],
  );
  return result.rows;
}

async function listGreptileCommentsForPullRequest(client: PgClient, repositoryId: string, pullRequestNumber: number): Promise<GreptileCommentViewModel[]> {
  const result = await client.query<PullRequestCommentRow>(
    `select * from maintaineros_pull_request_comments
     where repository_id = $1 and pull_request_number = $2
     order by created_at asc nulls last`,
    [repositoryId, pullRequestNumber],
  );
  return result.rows.map(toGreptileComment);
}

async function listGreptileComments(client: PgClient, repositoryId: string): Promise<Map<number, GreptileCommentViewModel[]>> {
  const result = await client.query<PullRequestCommentRow>(
    `select * from maintaineros_pull_request_comments
     where repository_id = $1
     order by pull_request_number asc, created_at asc nulls last`,
    [repositoryId],
  );
  const comments = new Map<number, GreptileCommentViewModel[]>();
  for (const row of result.rows) {
    const pullRequestComments = comments.get(row.pull_request_number) ?? [];
    pullRequestComments.push(toGreptileComment(row));
    comments.set(row.pull_request_number, pullRequestComments);
  }
  return comments;
}

function toPullRequestViewModel(row: PullRequestRow): PullRequestViewModel {
  return {
    provider: 'github',
    number: row.number,
    title: row.title,
    branchName: row.branch_name,
    headSha: row.head_sha,
    status: row.draft ? 'draft' : row.merged_at ? 'merged' : row.state === 'closed' ? 'closed' : 'open',
    htmlUrl: row.html_url,
    authorLogin: row.author,
    linkedAt: toIso(row.created_at),
  };
}

function toGreptileComment(row: PullRequestCommentRow): GreptileCommentViewModel {
  return {
    id: row.id,
    authorLogin: row.author,
    body: row.body,
    htmlUrl: row.html_url,
    path: row.path,
    line: row.line,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function buildLiveGreptileVerification(pullRequest: PullRequestViewModel, comments: GreptileCommentViewModel[]): VerificationViewModel {
  const hasBlockingFinding = comments.some((comment) => /block|fail|unresolved|incorrect|regression/i.test(comment.body));
  const status: VerificationViewModel['status'] = comments.length === 0 ? 'pending' : hasBlockingFinding ? 'failed' : 'passed';
  const summary = comments.length === 0
    ? `PR #${pullRequest.number} is imported, but no Greptile comments were found yet.`
    : `Greptile left ${comments.length} comment${comments.length === 1 ? '' : 's'} on PR #${pullRequest.number}.`;
  const findings = comments.map((comment) => summarizeComment(comment.body));

  return {
    provider: 'greptile',
    sourceState: 'live',
    status,
    summary,
    criteria: ['Review imported Greptile PR comments.', 'Confirm blocking comments are resolved before merge or payout.'],
    filesTouched: comments.flatMap((comment) => comment.path ? [comment.path] : []),
    filesInspected: comments.flatMap((comment) => comment.path ? [comment.path] : []),
    verifiedSha: status === 'pending' ? null : pullRequest.headSha,
    currentSha: pullRequest.headSha,
    blockingFindingsCount: hasBlockingFinding ? comments.length : 0,
    blockingFindings: hasBlockingFinding ? findings : [],
    comments,
    riskSummary: comments.length > 0
      ? 'Live Greptile comment evidence was imported from GitHub PR discussion and review threads.'
      : 'No live Greptile evidence has been imported for this PR yet.',
    failureReason: hasBlockingFinding ? 'Greptile comments appear to contain blocking findings.' : null,
    verifiedAt: comments.at(-1)?.createdAt ?? null,
    isStale: false,
  };
}

function toPullRequestVerificationItem(pullRequest: PullRequestRow, comments: GreptileCommentViewModel[]): VerificationQueueItemViewModel {
  const pullRequestView = toPullRequestViewModel(pullRequest);
  const verification = buildLiveGreptileVerification(pullRequestView, comments);
  return {
    issueNumber: pullRequest.linked_issue_number,
    issueTitle: pullRequest.linked_issue_number ? `Linked issue #${pullRequest.linked_issue_number}` : 'No linked issue detected',
    route: 'maintainer-review',
    detailUrl: pullRequest.html_url,
    traceUrl: pullRequest.html_url,
    pullRequest: pullRequestView,
    verification,
    blockingReason: verification.status === 'passed'
      ? 'Greptile comments imported.'
      : verification.status === 'failed'
        ? verification.failureReason ?? 'Greptile comments need review.'
        : 'No Greptile comments imported yet.',
  };
}

function summarizeComment(body: string) {
  return body.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function toIssueCard(issue: IssueRow): IssueCardViewModel {
  const decision = scoreIssue({
    title: issue.title,
    body: issue.body,
    labels: normalizeLabels(issue.labels),
    commentsCount: issue.comments_count,
  });

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    lane: ROUTE_TO_LANE[decision.route],
    route: decision.route,
    confidence: Math.round(decision.confidence * 100),
    risk: classifyRisk(decision.riskScore),
    complexity: classifyComplexity(decision.complexityScore),
    rationale: decision.rationale,
    routeDelay: 0,
  };
}

async function toIssueDetail(issue: IssueRow, persistedTrace: IssueTraceEventViewModel[] = []): Promise<IssueDetailViewModel> {
  const card = toIssueCard(issue);
  const labels = normalizeLabels(issue.labels);
  const decision = scoreIssue({
    title: issue.title,
    body: issue.body,
    labels,
    commentsCount: issue.comments_count,
  });
  const modelSelection = selectClodModel(decision);
  const suggestedFiles = suggestedFilesFor(issue);
  const routePolicy = evaluateRoutePolicy({
    route: decision.route,
    complexityScore: decision.complexityScore,
    riskScore: decision.riskScore,
    confidence: decision.confidence,
    labels,
  });
  const modelRun = {
    provider: 'clod' as const,
    sourceState: 'planned' as const,
    model: modelSelection.model,
    tier: modelSelection.tier,
    purpose: 'routing' as const,
    status: 'fallback' as const,
    selectionReason: `Derived locally from imported GitHub labels until Phase 2 writes CLōD artifacts. ${modelSelection.reason}`,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
    estimatedCostCents: null,
    premiumBaselineCents: estimatePremiumBaselineCents(null, modelSelection.tier),
  };
  const workOrder = buildDeterministicWorkOrder({
    issueNumber: issue.number,
    title: issue.title,
    route: decision.route,
    routePolicy,
    suggestedFiles,
  });
  const contextPack = await buildContextPackForIssue(
    {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels,
      route: decision.route,
      workOrder,
      repositoryFullName: issue.repository_id,
      repositoryUrl: issue.html_url.split('/issues/')[0],
    },
    'live',
  );
  const baseDetail: IssueDetailViewModel = {
    ...card,
    body: issue.body,
    htmlUrl: issue.html_url,
    author: issue.author,
    labels,
    modelRun,
    workOrder,
    routePolicy,
    contextPack,
    sandboxExecutions: [],
    pullRequest: null,
    verification: null,
    bounty: decision.route === 'bounty-worthy'
      ? {
          status: 'proposed',
          amountCents: 15000,
          currency: 'USD',
          rationale: 'Live import heuristic marked this as bounty-worthy; Clustly task creation lands in Phase 6.',
          maintainerAccepted: false,
        }
      : null,
    paymentArtifact: null,
    routeHistory: [],
    trace: [],
    payoutGate: emptyPayoutGate(),
  };
  const payoutVisibleBaseDetail = hidePayoutArtifactsForNonClustlyRoutes(baseDetail);
  const payoutGate = canReleasePayout(payoutVisibleBaseDetail);
  const sandboxExecutions = buildSandboxExecutionsForIssue(payoutVisibleBaseDetail, issue.repository_id, 'live');
  const trace = [
    ...buildLiveTrace(issue, decision.route, modelRun.model, contextPack),
    ...buildSandboxTraceEvents(payoutVisibleBaseDetail, sandboxExecutions).map((event) => ({ ...event, route: decision.route })),
    ...persistedTrace,
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return hidePayoutArtifactsForNonClustlyRoutes({
    ...payoutVisibleBaseDetail,
    payoutGate,
    sandboxExecutions,
    routeHistory: buildRouteHistoryFromTrace(payoutVisibleBaseDetail, trace),
    trace,
  });
}

function buildLiveTrace(issue: IssueRow, route: ExecutionRoute, model: string, contextPack: IssueDetailViewModel['contextPack']): IssueTraceEventViewModel[] {
  const importedAt = toIso(issue.created_at) ?? new Date().toISOString();
  const updatedAt = toIso(issue.updated_at) ?? importedAt;
  const trace: IssueTraceEventViewModel[] = [
    {
      id: `${issue.id}-github-import`,
      at: importedAt,
      actor: 'GitHub import',
      provider: 'github',
      sourceState: 'live',
      route,
      title: `Imported issue #${issue.number}`,
      detail: 'Live GitHub issue metadata, labels, author, timestamps, URL, and body were persisted.',
      status: 'succeeded',
      artifactUrl: issue.html_url,
    },
    {
      id: `${issue.id}-neon-persisted`,
      at: updatedAt,
      actor: 'Neon data spine',
      provider: 'neon',
      sourceState: 'live',
      route,
      title: 'Persisted in Neon',
      detail: 'Issue is now readable through the MaintainerOS repository interface.',
      status: 'succeeded',
      relatedId: issue.repository_id,
    },
    {
      id: `${issue.id}-local-route`,
      at: updatedAt,
      actor: 'MaintainerOS router',
      sourceState: 'live',
      route,
      title: `Derived route: ${ROUTE_LABEL[route]}`,
      detail: `Temporary heuristic route used until CLōD Phase 2 writes the durable routing artifact. Planned model: ${model}.`,
      status: 'routed',
      model,
    },
  ];
  if (contextPack) {
    trace.push({ ...buildNiaTraceEvent({ id: issue.id, number: issue.number }, contextPack), route });
  }
  return trace;
}

function emptyIssueDetail(repositoryId: string): IssueDetailViewModel {
  return {
    id: `${repositoryId}-empty`,
    number: 0,
    title: 'No imported issues yet',
    lane: 'clarify',
    route: 'close-or-clarify',
    confidence: 0,
    risk: 'low',
    complexity: 'unknown',
    rationale: 'No live issues have been imported yet.',
    routeDelay: 0,
    body: 'Run the GitHub import endpoint to populate this repository.',
    htmlUrl: '#',
    author: 'maintaineros',
    labels: [],
    modelRun: {
      provider: 'clod',
      sourceState: 'planned',
      model: 'none',
      tier: 'cheap-open',
      purpose: 'routing',
      status: 'fallback',
      selectionReason: 'No issue is available for model selection.',
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCents: null,
      premiumBaselineCents: null,
    },
    workOrder: {
      title: 'No issue selected',
      status: 'blocked',
      assigneeKind: 'unassigned',
      acceptanceChecks: [],
      suggestedFiles: [],
      suggestedCommands: [],
    },
    routePolicy: {
      executionMode: 'clarify',
      automationAllowed: false,
      sandboxAllowed: false,
      requiresHumanReview: false,
      requiresPaidWork: false,
      reasons: ['No live issue is available.'],
      safetyChecks: [],
    },
    contextPack: null,
    sandboxExecutions: [],
    pullRequest: null,
    verification: null,
    bounty: null,
    paymentArtifact: null,
    routeHistory: [],
    trace: [],
    payoutGate: emptyPayoutGate(),
  };
}

function buildNiaProviderStatus(): NonNullable<DashboardViewModel['providerStatuses']>[number] {
  const health = getProviderHealth('nia');
  if (health?.configured) {
    return {
      provider: 'nia',
      sourceState: health.sourceState,
      status: 'connected',
      label: 'Nia',
      detail: 'Live unified search is configured for context-pack retrieval.',
    };
  }
  return {
    provider: 'nia',
    sourceState: health?.sourceState ?? 'planned',
    status: 'planned',
    label: 'Nia',
    detail: health?.detail ?? 'Nia context packs fall back to deterministic fixture context.',
  };
}

function buildBuckets(issues: IssueCardViewModel[]): RouteBucketViewModel[] {
  const routes: ExecutionRoute[] = ['agent-solvable', 'maintainer-review', 'bounty-worthy', 'close-or-clarify'];
  return routes.map((route) => {
    const bucketIssues = issues.filter((issue) => issue.route === route);
    return {
      route,
      lane: ROUTE_TO_LANE[route],
      label: ROUTE_LABEL[route],
      count: bucketIssues.length,
      issues: bucketIssues,
    };
  });
}

function liveEvaluation(sampleSize: number): EvaluationSummaryViewModel {
  const rows: EvaluationSummaryViewModel['rows'] = sampleSize > 0
    ? [
        {
          id: 'live-baseline-planned',
          label: 'Live baseline attempts pending verification evidence',
          sampleId: 'live-imported-issues',
          pairState: 'unpaired',
          contextMode: 'baseline',
          sourceState: 'live',
          verificationStatus: 'pending',
          failureCategory: null,
          retryCount: 0,
          escalated: false,
          modelCostCents: null,
          premiumBaselineCostCents: null,
          costEvidence: 'unknown',
        },
        {
          id: 'live-nia-enriched-planned',
          label: 'Live Nia-enriched attempts pending verification evidence',
          sampleId: 'live-imported-issues',
          pairState: 'unpaired',
          contextMode: 'nia-enriched',
          sourceState: 'live',
          verificationStatus: 'pending',
          failureCategory: null,
          retryCount: 0,
          escalated: false,
          modelCostCents: null,
          premiumBaselineCostCents: null,
          costEvidence: 'unknown',
        },
      ]
    : [];
  return {
    sampleSize,
    sourceState: 'live',
    sampleLabel: 'Live imported issue set; planned rows require Greptile verification artifacts before lift is claimed.',
    comparisonKind: 'planned',
    baselinePassedCount: 0,
    baselineTotalCount: 0,
    enrichedPassedCount: 0,
    enrichedTotalCount: 0,
    liftDeltaPct: null,
    baselinePassRate: 0,
    enrichedContextPassRate: 0,
    retryRate: 0,
    escalationRate: 0,
    costPerVerifiedFixCents: 0,
    costEvidence: 'unknown',
    premiumOnlyCostPerVerifiedFixCents: null,
    cheapFirstSavingsPct: null,
    commonFailureReasons: ['Evals require Greptile verification samples before pass-rate lift is claimed.'],
    rows,
  };
}

function toImportRun(row: ImportRunRow): ImportRunViewModel {
  const startedAt = toIso(row.started_at) ?? new Date().toISOString();
  const finishedAt = toIso(row.finished_at) ?? null;
  return {
    id: row.id,
    provider: 'github',
    owner: row.owner,
    repo: row.repo,
    requestedLimit: row.requested_limit,
    importedIssueCount: row.imported_issue_count,
    importedPullRequestCount: row.imported_pull_request_count,
    skippedPullRequestCount: row.skipped_pull_request_count,
    status: row.status,
    sourceState: row.source_state,
    startedAt,
    finishedAt,
    durationMs: finishedAt ? new Date(finishedAt).getTime() - new Date(startedAt).getTime() : null,
    errorMessage: row.error_message,
  };
}

function normalizeLabels(labels: IssueRow['labels']) {
  if (Array.isArray(labels)) return labels;
  try {
    const parsed = JSON.parse(labels);
    return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : [];
  } catch {
    return [];
  }
}

function suggestedFilesFor(issue: IssueRow) {
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  if (text.includes('docs')) return ['docs/'];
  if (text.includes('api')) return ['app/api/', 'lib/'];
  if (text.includes('ui') || text.includes('css')) return ['components/', 'app/'];
  return ['src/', 'tests/'];
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function emptyPayoutGate(): IssueDetailViewModel['payoutGate'] {
  return {
    canRelease: false,
    reasons: [],
    reasonCodes: [],
    reasonDetails: [],
  };
}
