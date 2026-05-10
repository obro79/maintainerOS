import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROUTE_LABEL,
  ROUTE_TO_LANE,
  type ArtifactSourceState,
  type ClustlyBountyListItemViewModel,
  type DataMode,
  type DashboardViewModel,
  type EvaluationSummaryViewModel,
  type ExecutionRoute,
  type IssueCardViewModel,
  type IssueDetailViewModel,
  type IssueTraceEventViewModel,
  type MaintainerOSRepository,
  type RepositoryDataSourceViewModel,
  type ModelRunViewModel,
  type RouteBucketViewModel,
  type SandboxAttemptListItemViewModel,
  type VerificationQueueItemViewModel,
  type VerificationViewModel,
} from './types';
import { NON_CLUSTLY_ROUTE_REASON, canReleasePayout, hidePayoutArtifactsForNonClustlyRoutes } from './payout';
import { classifyComplexity, classifyRisk, estimatePremiumBaselineCents, evaluateRoutePolicy, scoreIssue, selectClodModel } from './routing';
import { applyStoredClodArtifact } from './clod-artifacts';
import { buildContextPackForIssue, buildNiaTraceEvent } from './nia-context';
import { buildSandboxExecutionsForIssue, buildSandboxTraceEvents, toSandboxAttemptListItems } from './daytona';
import { buildGreptileVerification, toVerificationQueueItem } from './verification';
import { buildFixtureClustlyTask, toClustlyBountyListItem } from './payments';
import { listPersistedTraceEvents, mergeTraceEvents } from './trace-events';
import { buildDeterministicWorkOrder } from './work-orders';
import { buildSponsorProofFromIssue } from './sponsor-proof';
import { buildRouteHistoryFromTrace } from './route-history';

interface FixtureRepositoryFile {
  repository: {
    id: string;
    provider: 'github';
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    description: string;
    generatedAt: string;
  };
  issues: FixtureIssue[];
}

interface FixtureIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  commentsCount: number;
  htmlUrl: string;
  classification: {
    route: ExecutionRoute;
    complexityScore: number;
    riskScore: number;
    confidence: number;
    rationale: string;
  };
  workOrder: {
    title: string;
    status: IssueDetailViewModel['workOrder']['status'];
    assigneeKind: IssueDetailViewModel['workOrder']['assigneeKind'];
    acceptanceChecks: string[];
    suggestedFiles: string[];
  };
  bounty: IssueDetailViewModel['bounty'];
  verification: {
    provider: 'greptile';
    status: VerificationViewModel['status'];
    summary: string;
  } | null;
  paymentArtifact: FixturePaymentArtifact | null;
  modelRun: {
    provider: 'clod';
    model: string;
    purpose: ModelRunViewModel['purpose'];
    estimatedCostCents: number;
    latencyMs: number;
    status: ModelRunViewModel['status'];
  };
}

interface FixturePaymentArtifact {
  provider: 'allscale' | 'clustly';
  status: 'draft' | 'ready' | 'released' | 'failed' | 'posted' | 'funded' | 'claimed' | 'submitted' | 'approved' | 'paid' | 'refunded';
  amountCents: number;
  currency: 'USD' | 'USDC';
  artifactUrl?: string;
  releaseReason?: string;
}

export class FixtureMaintainerOSRepository implements MaintainerOSRepository {
  constructor(
    private readonly options: {
      dataMode?: DataMode;
      sourceState?: ArtifactSourceState;
      fallbackReason?: string;
    } = {},
  ) {}

  async getDashboard(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || 'maintaineros-demo-large'): Promise<DashboardViewModel> {
    const fixture = loadFixture(repositoryId);
    const sourceState = this.sourceState;
    const issues = fixture.issues.slice(0, 40).map(toIssueCard);
    const issueDetails = await Promise.all(fixture.issues.slice(0, 40).map((issue) => toIssueDetailWithPersistedTrace(repositoryId, fixture.repository.id, issue, sourceState)));
    const selectedIssue = await toIssueDetailWithPersistedTrace(repositoryId, fixture.repository.id, fixture.issues.find((issue) => issue.number === 41) ?? fixture.issues[0], sourceState);

    return {
      repository: {
        id: fixture.repository.id,
        provider: 'github',
        owner: fixture.repository.owner,
        name: fixture.repository.name,
        fullName: fixture.repository.fullName,
        htmlUrl: fixture.repository.htmlUrl,
        openIssueCount: fixture.issues.length,
        dataMode: this.dataMode,
        importedAt: fixture.repository.generatedAt,
        latestImportRun: {
          id: `${fixture.repository.id}-fixture-import`,
          provider: 'github',
          owner: fixture.repository.owner,
          repo: fixture.repository.name,
          requestedLimit: fixture.issues.length,
          importedIssueCount: fixture.issues.length,
          skippedPullRequestCount: 0,
          status: 'succeeded',
          sourceState,
          startedAt: fixture.repository.generatedAt,
          finishedAt: fixture.repository.generatedAt,
          durationMs: 0,
          errorMessage: null,
        },
        dataSource: this.dataSource,
      },
      demo: {
        step: 'triaged',
        isAutoPlaying: false,
      },
      buckets: buildBuckets(issues),
      issues,
      issueDetails,
      selectedIssue,
      evaluation: buildEvaluationSummary(sourceState),
      providerStatuses: buildProviderStatuses(sourceState, this.options.fallbackReason),
      sponsorProof: buildSponsorProofFromIssue(selectedIssue, sourceState),
    };
  }

  async getIssueDetail(repositoryId: string, issueNumber: number): Promise<IssueDetailViewModel | null> {
    const fixture = loadFixture(repositoryId);
    const issue = fixture.issues.find((candidate) => candidate.number === issueNumber);
    return issue ? toIssueDetailWithPersistedTrace(repositoryId, fixture.repository.id, issue, this.sourceState) : null;
  }

  async getIssueTrace(repositoryId: string, issueNumber: number): Promise<IssueTraceEventViewModel[]> {
    const issue = await this.getIssueDetail(repositoryId, issueNumber);
    return issue?.trace ?? [];
  }

  async getEvaluationSummary(): Promise<EvaluationSummaryViewModel> {
    return buildEvaluationSummary(this.sourceState);
  }

  async getSandboxAttempts(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || 'maintaineros-demo-large'): Promise<SandboxAttemptListItemViewModel[]> {
    const fixture = loadFixture(repositoryId);
    const details = await Promise.all(fixture.issues
      .slice(0, 40)
      .map(async (issue) => applyStoredClodArtifact(repositoryId, applyStoredClodArtifact(fixture.repository.id, await toIssueDetail(issue, this.sourceState, repositoryId)))));
    return details.flatMap((issue) => toSandboxAttemptListItems(repositoryId, issue));
  }

  async getVerificationQueue(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || 'maintaineros-demo-large'): Promise<VerificationQueueItemViewModel[]> {
    const fixture = loadFixture(repositoryId);
    const details = await Promise.all(fixture.issues
      .slice(0, 40)
      .map(async (issue) => applyStoredClodArtifact(repositoryId, applyStoredClodArtifact(fixture.repository.id, await toIssueDetail(issue, this.sourceState, repositoryId)))));
    return details
      .filter((issue) => issue.pullRequest || issue.verification)
      .map((issue) => toVerificationQueueItem(repositoryId, issue));
  }

  async getBountyTasks(repositoryId = process.env.MAINTAINEROS_DEMO_REPO_ID || 'maintaineros-demo-large'): Promise<ClustlyBountyListItemViewModel[]> {
    const fixture = loadFixture(repositoryId);
    const details = await Promise.all(fixture.issues
      .slice(0, 80)
      .map(async (issue) => applyStoredClodArtifact(repositoryId, applyStoredClodArtifact(fixture.repository.id, await toIssueDetail(issue, this.sourceState, repositoryId)))));
    return details
      .map((issue) => toClustlyBountyListItem(repositoryId, issue))
      .filter((item): item is ClustlyBountyListItemViewModel => Boolean(item));
  }

  private get dataMode(): DataMode {
    return this.options.dataMode ?? 'fixture';
  }

  private get sourceState(): ArtifactSourceState {
    return this.options.sourceState ?? (this.dataMode === 'rehearsal' ? 'rehearsal' : 'fixture');
  }

  private get dataSource(): RepositoryDataSourceViewModel {
    return {
      mode: this.dataMode,
      sourceState: this.sourceState,
      provider: 'fixture',
      fallbackReason: this.options.fallbackReason,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function toIssueDetailWithPersistedTrace(repositoryId: string, fixtureRepositoryId: string, issue: FixtureIssue, sourceState: ArtifactSourceState) {
  const detail = applyStoredClodArtifact(repositoryId, applyStoredClodArtifact(fixtureRepositoryId, await toIssueDetail(issue, sourceState, repositoryId)));
  const persisted = await listPersistedTraceEvents(repositoryId, detail.number);
  if (persisted.length === 0 && repositoryId === fixtureRepositoryId) return detail;
  const fixturePersisted = repositoryId === fixtureRepositoryId ? [] : await listPersistedTraceEvents(fixtureRepositoryId, detail.number);
  const trace = mergeTraceEvents(detail.trace, [...persisted, ...fixturePersisted]);
  return {
    ...detail,
    routeHistory: buildRouteHistoryFromTrace(detail, trace),
    trace,
  };
}

export function getMaintainerOSRepository(): MaintainerOSRepository {
  return new FixtureMaintainerOSRepository();
}

function loadFixture(repositoryId: string): FixtureRepositoryFile {
  const fixturePath = join(process.cwd(), 'data', 'mock-repos', `${repositoryId}.json`);
  if (existsSync(fixturePath)) {
    return JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureRepositoryFile;
  }
  const fallbackPath = join(process.cwd(), 'data', 'mock-repos', `${process.env.MAINTAINEROS_DEMO_REPO_ID || 'maintaineros-demo-large'}.json`);
  return JSON.parse(readFileSync(fallbackPath, 'utf8')) as FixtureRepositoryFile;
}

function toIssueCard(issue: FixtureIssue): IssueCardViewModel {
  const decision = scoreIssue(issue);
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
    routeDelay: (issue.number % 12) * 110,
  };
}

async function toIssueDetail(issue: FixtureIssue, sourceState: ArtifactSourceState = 'fixture', repositoryId = 'maintaineros-demo-large'): Promise<IssueDetailViewModel> {
  const card = toIssueCard(issue);
  const decision = scoreIssue(issue);
  const routePolicy = evaluateRoutePolicy({
    route: decision.route,
    complexityScore: decision.complexityScore,
    riskScore: decision.riskScore,
    confidence: decision.confidence,
    labels: issue.labels,
  });
  const selection = selectClodModel(decision);
  const workOrder = buildDeterministicWorkOrder({
    issueNumber: issue.number,
    title: issue.title,
    route: decision.route,
    routePolicy,
    suggestedFiles: issue.workOrder.suggestedFiles,
    base: issue.workOrder,
  });
  const estimatedCostCents = issue.modelRun.estimatedCostCents ?? null;
  const modelRun: ModelRunViewModel = {
    provider: 'clod',
    sourceState,
    model: issue.modelRun.model || selection.model,
    tier: selection.tier,
    purpose: issue.modelRun.purpose,
    status: issue.modelRun.status,
    selectionReason: selection.reason,
    latencyMs: issue.modelRun.latencyMs,
    inputTokens: null,
    outputTokens: null,
    estimatedCostCents,
    premiumBaselineCents: estimatePremiumBaselineCents(estimatedCostCents, selection.tier),
  };

  const pullRequest = buildPullRequest(issue);
  const baseVerification: VerificationViewModel | null = issue.verification && pullRequest
    ? {
        provider: 'greptile',
        sourceState,
        status: issue.verification.status,
        summary: issue.verification.summary,
        criteria: workOrder.acceptanceChecks,
        filesTouched: workOrder.suggestedFiles,
        filesInspected: workOrder.suggestedFiles,
        verifiedSha: issue.verification.status === 'pending' ? null : pullRequest.headSha,
        currentSha: pullRequest.headSha,
        blockingFindingsCount: 0,
        blockingFindings: [],
        riskSummary: issue.verification.summary,
        failureReason: null,
        verifiedAt: issue.verification.status === 'pending' ? null : '2026-05-08T19:20:00.000Z',
        isStale: false,
      }
    : null;
  const verification = pullRequest ? buildGreptileVerification({ ...card, body: issue.body, htmlUrl: issue.htmlUrl, author: issue.author, labels: issue.labels, modelRun, workOrder, routePolicy, contextPack: null, sandboxExecutions: [], pullRequest, verification: baseVerification, bounty: issue.bounty, paymentArtifact: null, routeHistory: [], trace: [], payoutGate: emptyPayoutGate() }, pullRequest, sourceState) : null;
  const contextPack = await buildContextPackForIssue(
    {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      route: card.route,
      workOrder,
      repositoryFullName: repositoryId,
      repositoryUrl: issue.htmlUrl.split('/issues/')[0],
    },
    sourceState,
  );
  const baseDetail: IssueDetailViewModel = {
    ...card,
    body: issue.body,
    htmlUrl: issue.htmlUrl,
    author: issue.author,
    labels: issue.labels,
    modelRun,
    workOrder,
    routePolicy,
    contextPack,
    sandboxExecutions: [],
    pullRequest,
    verification,
    bounty: issue.bounty
      ? {
          ...issue.bounty,
          maintainerAccepted: issue.paymentArtifact?.status === 'released' || issue.bounty.status === 'paid',
        }
      : null,
    paymentArtifact: issue.paymentArtifact ? toClustlyTask(issue.paymentArtifact, sourceState) : null,
    routeHistory: [],
    trace: [],
    payoutGate: emptyPayoutGate(),
  };
  const payoutVisibleBaseDetail = hidePayoutArtifactsForNonClustlyRoutes(baseDetail);
  const sandboxExecutions = buildSandboxExecutionsForIssue(payoutVisibleBaseDetail, repositoryId, sourceState);
  const payoutGate = canReleasePayout(payoutVisibleBaseDetail);
  const paymentArtifact = buildFixtureClustlyTask({ ...payoutVisibleBaseDetail, payoutGate }, sourceState);
  const detailForTrace = { ...payoutVisibleBaseDetail, paymentArtifact, payoutGate };
  const trace = [
    ...buildTrace(issue, modelRun, sourceState, contextPack, verification, card.route, workOrder),
    ...buildSandboxTraceEvents(detailForTrace, sandboxExecutions).map((event) => ({ ...event, route: card.route })),
    ...buildPullRequestTraceEvents(issue, pullRequest, sourceState, card.route, workOrder),
    ...buildPayoutGateTraceEvents(issue, paymentArtifact, payoutGate, sourceState, card.route),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const detail = hidePayoutArtifactsForNonClustlyRoutes({
    ...payoutVisibleBaseDetail,
    paymentArtifact,
    payoutGate,
    sandboxExecutions,
    routeHistory: buildRouteHistoryFromTrace(detailForTrace, trace),
    trace,
  });

  return {
    ...detail,
    payoutGate: detail.route === 'bounty-worthy' ? payoutGate : detail.payoutGate,
  };
}

function buildPullRequest(issue: FixtureIssue) {
  if (!issue.verification && !issue.bounty) return null;
  return {
    provider: 'github' as const,
    number: 900 + issue.number,
    title: `Fix #${issue.number}: ${issue.title}`,
    branchName: `maintaineros/issue-${issue.number}`,
    headSha: `sha-${issue.number.toString(16).padStart(6, '0')}`,
    status: issue.verification?.status === 'passed' ? 'merged' as const : 'open' as const,
    htmlUrl: `${issue.htmlUrl.replace('/issues/', '/pull/')}`.replace(String(issue.number), String(900 + issue.number)),
    authorLogin: issue.classification.route === 'bounty-worthy' ? 'external-contributor' : 'agent-runner',
    linkedAt: '2026-05-08T20:45:00.000Z',
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

function buildTrace(issue: FixtureIssue, modelRun: ModelRunViewModel, sourceState: ArtifactSourceState, contextPack: IssueDetailViewModel['contextPack'], verification: VerificationViewModel | null, route: ExecutionRoute, workOrder: IssueDetailViewModel['workOrder']): IssueTraceEventViewModel[] {
  const base = `2026-05-08T18:${String(issue.number % 50).padStart(2, '0')}:00.000Z`;
  const trace: IssueTraceEventViewModel[] = [
    {
      id: `${issue.id}-imported`,
      at: base,
      actor: 'GitHub import',
      provider: 'github',
      sourceState,
      title: `Imported issue #${issue.number}`,
      detail: 'Issue metadata, labels, author, timestamps, and body entered the MaintainerOS queue.',
      status: 'pending',
    },
    {
      id: `${issue.id}-clod`,
      at: base,
      actor: 'CLōD model router',
      provider: 'clod',
      sourceState,
      title: `${modelRun.tier} model selected`,
      detail: modelRun.selectionReason,
      status: modelRun.status === 'succeeded' ? 'passed' : 'failed',
      model: modelRun.model,
      costCents: modelRun.estimatedCostCents ?? undefined,
    },
    {
      id: `${issue.id}-routed`,
      at: base,
      actor: 'MaintainerOS router',
      sourceState,
      title: `Routed to ${ROUTE_LABEL[route]}`,
      detail: workOrder.rationale ?? issue.classification.rationale,
      status: 'routed',
    },
  ];

  if (issue.number === 5 || issue.number === 41 || route === 'bounty-worthy') {
    trace.push(
      {
        id: `${issue.id}-cheap-attempt`,
        at: base,
        actor: 'Low-cost agent',
        provider: 'daytona',
        sourceState,
        route: 'agent-solvable',
        title: 'First attempt failed verification',
        detail: 'Greptile-style check found missing regression coverage and incomplete acceptance criteria.',
        status: 'failed',
        model: 'cheap-open',
        costCents: 2,
        filesTouched: workOrder.suggestedFiles.slice(0, 1),
      },
      {
        id: `${issue.id}-escalated`,
        at: base,
        actor: 'Escalation policy',
        sourceState,
        route: issue.classification.route,
        title: 'Escalated after failed proof',
        detail: 'MaintainerOS preserved the failed attempt and selected a stronger route based on verification evidence.',
        status: 'escalated',
        model: route === 'bounty-worthy' ? 'clustly' : route === 'agent-solvable' ? 'balanced' : 'dev',
        costCents: route === 'bounty-worthy' ? issue.bounty?.amountCents ? Math.round(issue.bounty.amountCents / 100) : 150 : 7,
      },
    );
  }

  if (verification) {
    trace.push({
      id: `${issue.id}-verification`,
      at: base,
      actor: 'Greptile verification',
      provider: 'greptile',
      sourceState,
      title: `Verification ${verification.status}`,
      detail: `${verification.summary} Verified SHA: ${verification.verifiedSha ?? 'pending'}. Current SHA: ${verification.currentSha ?? 'unknown'}.`,
      status: verification.status === 'passed' ? 'passed' : verification.status === 'failed' ? 'failed' : verification.status === 'stale' ? 'stale' : 'pending',
      relatedId: verification.verifiedSha ?? verification.currentSha ?? undefined,
      filesTouched: workOrder.suggestedFiles,
    });
    if (verification.status === 'failed' || verification.status === 'stale') {
      trace.push({
        id: `${issue.id}-verification-escalated`,
        at: base,
        actor: 'Escalation policy',
        provider: 'greptile',
        sourceState,
        title: verification.status === 'stale' ? 'Stale proof blocked completion' : 'Failed proof triggered retry',
        detail: verification.failureReason ?? verification.riskSummary,
        status: 'escalated',
        relatedId: verification.verifiedSha ?? verification.currentSha ?? undefined,
      });
    }
  }

  if (contextPack) {
    trace.push(buildNiaTraceEvent({ id: issue.id, number: issue.number }, contextPack));
  }

  if (route !== 'bounty-worthy' && issue.paymentArtifact) {
    trace.push({
      id: `${issue.id}-payout-suppressed`,
      at: base,
      actor: 'MaintainerOS payout guard',
      sourceState,
      title: 'Payout artifact suppressed',
      detail: NON_CLUSTLY_ROUTE_REASON,
      status: 'blocked',
    });
  }

  if (route === 'bounty-worthy' && issue.paymentArtifact) {
    trace.push(
      {
        id: `${issue.id}-clustly-posted`,
        at: base,
        actor: 'Clustly task',
        provider: 'clustly',
        sourceState,
        title: 'Clustly task fixture-backed',
        detail: `${issue.paymentArtifact.currency} ${(issue.paymentArtifact.amountCents / 100).toFixed(0)} bounty task created with manual browser funding.`,
        status: 'succeeded',
        costCents: issue.paymentArtifact.amountCents,
      },
      {
        id: `${issue.id}-clustly-funded`,
        at: base,
        actor: 'Clustly funding',
        provider: 'clustly',
        sourceState,
        title: 'Manual funding step recorded',
        detail: 'Funding is represented as a manual-browser step; no automated funding endpoint is claimed.',
        status: issue.bounty?.status === 'funded' || issue.bounty?.status === 'paid' ? 'passed' : 'pending',
      },
      {
        id: `${issue.id}-payment`,
        at: base,
        actor: 'Clustly release gate',
        provider: 'clustly',
        sourceState,
        title: `Clustly ${issue.paymentArtifact.status}`,
        detail: `${issue.paymentArtifact.currency} ${(issue.paymentArtifact.amountCents / 100).toFixed(0)} bounty task is ${issue.paymentArtifact.status}. Release still depends on MaintainerOS verification and acceptance gates.`,
        status: issue.paymentArtifact.status === 'released' ? 'passed' : 'blocked',
        costCents: issue.paymentArtifact.amountCents,
      },
    );
  }

  return trace.map((event) => ({ route, ...event }));
}

function buildPullRequestTraceEvents(issue: FixtureIssue, pullRequest: IssueDetailViewModel['pullRequest'], sourceState: ArtifactSourceState, route: ExecutionRoute, workOrder: IssueDetailViewModel['workOrder']): IssueTraceEventViewModel[] {
  if (!pullRequest) return [];
  return [
    {
      id: `${issue.id}-pr-linked`,
      at: pullRequest.linkedAt ?? `2026-05-08T20:${String(issue.number % 50).padStart(2, '0')}:00.000Z`,
      actor: 'GitHub pull request',
      provider: 'github',
      sourceState,
      route,
      title: `PR #${pullRequest.number} linked`,
      detail: `${pullRequest.authorLogin} opened ${pullRequest.branchName}; MaintainerOS tied the PR back to issue #${issue.number}.`,
      status: pullRequest.status === 'closed' ? 'blocked' : 'succeeded',
      artifactUrl: pullRequest.htmlUrl,
      relatedId: pullRequest.headSha,
      filesTouched: workOrder.suggestedFiles,
    },
  ];
}

function buildPayoutGateTraceEvents(
  issue: FixtureIssue,
  paymentArtifact: IssueDetailViewModel['paymentArtifact'],
  payoutGate: IssueDetailViewModel['payoutGate'],
  sourceState: ArtifactSourceState,
  route: ExecutionRoute,
): IssueTraceEventViewModel[] {
  if (route !== 'bounty-worthy' || (!issue.bounty && !paymentArtifact)) return [];
  return [
    {
      id: `${issue.id}-payout-gate`,
      at: `2026-05-08T21:${String(issue.number % 50).padStart(2, '0')}:00.000Z`,
      actor: 'MaintainerOS payout gate',
      provider: 'clustly',
      sourceState,
      route,
      title: payoutGate.canRelease ? 'Payout gate release allowed' : 'Payout gate blocked',
      detail: payoutGate.canRelease
        ? 'Funded task, linked PR, passed non-stale verification, and maintainer acceptance are all present.'
        : payoutGate.reasons.join(' '),
      status: payoutGate.canRelease ? 'passed' : 'blocked',
      artifactUrl: paymentArtifact?.taskUrl ?? paymentArtifact?.artifactUrl,
      relatedId: paymentArtifact?.taskId,
      costCents: paymentArtifact?.amountCents,
    },
  ];
}

function buildEvaluationSummary(sourceState: ArtifactSourceState = 'fixture'): EvaluationSummaryViewModel {
  return {
    sampleSize: 80,
    sourceState,
    sampleLabel: 'Fixture issue sample: 80 routed issues, 24 comparable baseline/enriched attempts',
    comparisonKind: 'comparable',
    baselinePassedCount: 19,
    baselineTotalCount: 24,
    enrichedPassedCount: 21,
    enrichedTotalCount: 24,
    liftDeltaPct: 5,
    baselinePassRate: 0.8,
    enrichedContextPassRate: 0.85,
    retryRate: 0.18,
    escalationRate: 0.11,
    costPerVerifiedFixCents: 9,
    costEvidence: 'known',
    premiumOnlyCostPerVerifiedFixCents: 21,
    cheapFirstSavingsPct: 57,
    commonFailureReasons: ['missing repo context', 'insufficient tests', 'ambiguous reproduction', 'verification stale after PR update'],
    rows: [
      {
        id: 'baseline-fixture',
        label: 'Baseline cheap-agent attempt on #41',
        issueNumber: 41,
        attemptId: 'issue-41-attempt-1',
        sampleId: 'fixture-agent-context-lift',
        pairId: 'issue-41-context-lift',
        pairState: 'comparable',
        contextMode: 'baseline',
        sourceState,
        verificationStatus: 'failed',
        traceUrl: '/maintaineros-demo-large/issues/41/trace#issue-41-cheap-attempt',
        verificationUrl: '/maintaineros-demo-large/issues/41/trace#issue-41-verification',
        failureCategory: 'missing repo context',
        retryCount: 1,
        escalated: true,
        modelTierPath: 'cheap-open',
        modelCostCents: 2,
        premiumBaselineCostCents: 21,
        costEvidence: 'known',
      },
      {
        id: 'nia-enriched-fixture',
        label: 'Nia-enriched retry on #41',
        issueNumber: 41,
        attemptId: 'issue-41-attempt-2',
        sampleId: 'fixture-agent-context-lift',
        pairId: 'issue-41-context-lift',
        pairState: 'comparable',
        contextMode: 'nia-enriched',
        sourceState,
        contextPackId: 'issue-41-nia-context',
        verificationStatus: 'passed',
        traceUrl: '/maintaineros-demo-large/issues/41/trace#issue-41-nia-context-trace',
        verificationUrl: '/maintaineros-demo-large/issues/41/trace#issue-41-verification',
        failureCategory: null,
        retryCount: 0,
        escalated: false,
        modelTierPath: 'cheap-open -> balanced',
        modelCostCents: 7,
        premiumBaselineCostCents: 21,
        costEvidence: 'known',
      },
      {
        id: 'stale-proof-fixture',
        label: 'Stale verification regression guard',
        issueNumber: 17,
        attemptId: 'issue-17-stale-proof',
        sampleId: 'fixture-verification-quality',
        pairState: 'unpaired',
        contextMode: 'baseline',
        sourceState,
        verificationStatus: 'stale',
        traceUrl: '/maintaineros-demo-large/issues/17/trace#issue-17-verification',
        verificationUrl: '/maintaineros-demo-large/issues/17/trace#issue-17-verification',
        failureCategory: 'verification stale after PR update',
        retryCount: 1,
        escalated: true,
        modelTierPath: 'balanced',
        modelCostCents: null,
        premiumBaselineCostCents: null,
        costEvidence: 'unknown',
      },
    ],
  };
}

function toClustlyTask(artifact: FixturePaymentArtifact, sourceState: ArtifactSourceState): IssueDetailViewModel['paymentArtifact'] {
  return {
    provider: 'clustly',
    sourceState,
    status: artifact.status === 'ready' ? 'approved' : artifact.status,
    amountCents: artifact.amountCents,
    currency: artifact.currency === 'USD' ? 'USDC' : artifact.currency,
    taskId: `fixture-${artifact.amountCents}`,
    taskUrl: artifact.artifactUrl?.replace('allscale.example/payments', 'clustly.ai/tasks'),
    fundingMode: 'manual-browser',
    claimerKind: 'human',
    releaseReason: 'Released only after funded Clustly task, linked PR, non-stale passed verification, and maintainer acceptance.',
  };
}

function emptyPayoutGate(): IssueDetailViewModel['payoutGate'] {
  return {
    canRelease: false,
    reasons: [],
    reasonCodes: [],
    reasonDetails: [],
  };
}

function buildProviderStatuses(sourceState: ArtifactSourceState = 'fixture', fallbackReason?: string): DashboardViewModel['providerStatuses'] {
  return [
    { provider: 'github', sourceState, status: 'connected', label: 'GitHub', detail: fallbackReason ? `Fixture fallback: ${fallbackReason}` : 'Fixture repository loaded.' },
    { provider: 'neon', sourceState: fallbackReason ? 'planned' : sourceState, status: fallbackReason ? 'degraded' : 'planned', label: 'Neon', detail: fallbackReason ?? 'Live repository adapter available in Phase 1.' },
    { provider: 'clod', sourceState, status: 'connected', label: 'CLōD', detail: 'Fixture model-run artifacts available.' },
    { provider: 'nia', sourceState, status: 'connected', label: 'Nia', detail: 'Fixture context packs available.' },
    { provider: 'daytona', sourceState, status: 'connected', label: 'Daytona', detail: 'Fixture sandbox attempts available.' },
    { provider: 'greptile', sourceState, status: 'connected', label: 'Greptile', detail: 'Fixture verification artifacts available.' },
    { provider: 'clustly', sourceState, status: 'connected', label: 'Clustly', detail: 'Fixture task/release gate available.' },
  ];
}
