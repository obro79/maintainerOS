export type DataMode = 'fixture' | 'live' | 'rehearsal';

export type ArtifactSourceState = 'live' | 'rehearsal' | 'fixture' | 'planned';

export type ProviderKey = 'github' | 'neon' | 'clod' | 'nia' | 'daytona' | 'greptile' | 'clustly';

export type ArtifactStatus = 'pending' | 'running' | 'passed' | 'failed' | 'stale' | 'blocked' | 'succeeded';

export type ExecutionRoute = 'agent-solvable' | 'maintainer-review' | 'bounty-worthy' | 'close-or-clarify';

export type DemoLane = 'agent' | 'maintainer' | 'bounty' | 'clarify';

export type IssueRisk = 'low' | 'medium' | 'high';

export type IssueComplexity = 'low' | 'medium' | 'high' | 'unknown';

export interface MaintainerRepositorySummary {
  id: string;
  provider: 'github';
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  openIssueCount: number;
  dataMode: DataMode;
  importedAt?: string;
  latestImportRun?: ImportRunViewModel | null;
  dataSource?: RepositoryDataSourceViewModel;
}

export interface ImportRunViewModel {
  id: string;
  provider: 'github';
  owner: string;
  repo: string;
  requestedLimit: number;
  importedIssueCount: number;
  skippedPullRequestCount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'partial';
  sourceState: ArtifactSourceState;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface RepositoryDataSourceViewModel {
  mode: DataMode;
  sourceState: ArtifactSourceState;
  provider: 'fixture' | 'neon';
  fallbackReason?: string;
  checkedAt: string;
}

export interface IssueCardViewModel {
  id: string;
  number: number;
  title: string;
  lane: DemoLane;
  route: ExecutionRoute;
  confidence: number;
  risk: IssueRisk;
  complexity: IssueComplexity;
  rationale: string;
  routeDelay: number;
}

export interface ModelRunViewModel {
  provider: 'clod';
  id?: string;
  runId?: string;
  createdAt?: string;
  sourceState?: ArtifactSourceState;
  model: string;
  tier: 'cheap-open' | 'balanced' | 'deep' | 'premium-fallback';
  purpose: 'triage' | 'routing' | 'work-order' | 'verification-summary' | 'bounty-pricing';
  status: 'succeeded' | 'failed' | 'fallback';
  selectionReason: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostCents: number | null;
  premiumBaselineCents: number | null;
  fallbackReason?: string | null;
}

export interface ContextPackViewModel {
  provider: 'nia';
  sourceState: ArtifactSourceState;
  id: string;
  issueId?: string;
  issueNumber?: number;
  workOrderId?: string;
  createdAt?: string;
  errorMessage?: string | null;
  status: ArtifactStatus;
  summary: string;
  sourceCount: number;
  confidence: number;
  citations: Array<{
    id: string;
    title: string;
    kind: 'file' | 'doc' | 'issue' | 'pull-request' | 'command';
    pathOrUrl?: string;
    snippet: string;
  }>;
  suggestedCommands: string[];
}

export interface SandboxExecutionViewModel {
  provider: 'daytona';
  sourceState: ArtifactSourceState;
  id: string;
  status: ArtifactStatus;
  sandboxId: string;
  imageOrTemplate: string;
  repoRef: string;
  branchName: string;
  contextPackId: string | null;
  requestedCommands: string[];
  completedCommands: string[];
  durationMs: number | null;
  exitCode: number | null;
  logSummary: string;
  filesTouched: string[];
  pullRequestUrl: string | null;
  failureReason: string | null;
}

export interface SandboxAttemptListItemViewModel {
  issueNumber: number;
  issueTitle: string;
  route: ExecutionRoute;
  traceUrl: string;
  detailUrl: string;
  attempt: SandboxExecutionViewModel;
}

export interface WorkOrderViewModel {
  title: string;
  summary?: string;
  rationale?: string;
  generatedBy?: ProviderKey | 'deterministic';
  generatedAt?: string;
  status: 'draft' | 'ready' | 'dispatched' | 'blocked' | 'completed' | 'canceled';
  assigneeKind: 'agent' | 'maintainer' | 'contributor' | 'unassigned';
  acceptanceChecks: string[];
  suggestedFiles: string[];
}

export interface VerificationViewModel {
  provider: 'greptile';
  sourceState?: ArtifactSourceState;
  status: 'pending' | 'passed' | 'failed' | 'stale';
  summary: string;
  criteria: string[];
  filesTouched: string[];
  filesInspected?: string[];
  verifiedSha: string | null;
  currentSha: string | null;
  blockingFindingsCount: number;
  blockingFindings?: string[];
  riskSummary: string;
  failureReason?: string | null;
  verifiedAt: string | null;
  isStale: boolean;
}

export interface PullRequestViewModel {
  provider: 'github';
  number: number;
  title: string;
  branchName: string;
  headSha: string;
  status: 'open' | 'draft' | 'merged' | 'closed';
  htmlUrl: string;
  authorLogin: string;
  linkedAt?: string;
}

export interface VerificationQueueItemViewModel {
  issueNumber: number;
  issueTitle: string;
  route: ExecutionRoute;
  detailUrl: string;
  traceUrl: string;
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel;
  blockingReason: string;
}

export interface ClustlyBountyListItemViewModel {
  issueNumber: number;
  issueTitle: string;
  route: ExecutionRoute;
  detailUrl: string;
  traceUrl: string;
  bounty: BountyViewModel;
  task: ClustlyTaskViewModel | null;
  gate: {
    canRelease: boolean;
    reasons: string[];
  };
}

export interface BountyViewModel {
  status: 'proposed' | 'funded' | 'claimed' | 'submitted' | 'approved' | 'paid' | 'canceled';
  amountCents: number;
  currency: 'USD';
  rationale: string;
  maintainerAccepted: boolean;
}

export interface ClustlyTaskViewModel {
  provider: 'clustly';
  sourceState?: ArtifactSourceState;
  status: 'draft' | 'posted' | 'funded' | 'claimed' | 'submitted' | 'approved' | 'paid' | 'released' | 'refunded' | 'failed';
  taskId?: string;
  taskUrl?: string;
  claimId?: string;
  claimerKind?: 'agent' | 'human' | null;
  fundingMode?: 'manual-browser' | 'api' | 'fixture';
  amountCents: number;
  currency: 'USD' | 'USDC';
  artifactUrl?: string;
  releaseReason: string;
}

export type PaymentArtifactViewModel = ClustlyTaskViewModel;

export interface SponsorProofViewModel {
  provider: ProviderKey;
  sourceState: ArtifactSourceState;
  title: string;
  status: ArtifactStatus;
  runId?: string;
  artifactUrl?: string;
  screenshotUrl?: string;
  logUrl?: string;
  occurredAt?: string;
  summary: string;
}

export interface ProviderStatusViewModel {
  provider: ProviderKey;
  sourceState: ArtifactSourceState;
  status: 'connected' | 'disconnected' | 'degraded' | 'planned';
  label: string;
  lastRunAt?: string;
  detail: string;
}

export interface DemoResetScenarioViewModel {
  id: 'happy-path' | 'failed-cheap-attempt' | 'stale-verification' | 'bounty-release-blocked' | 'bounty-released';
  label: string;
  sourceState: ArtifactSourceState;
  description: string;
}

export interface IssueTraceEventViewModel {
  id: string;
  at: string;
  actor: string;
  provider?: ProviderKey;
  sourceState?: ArtifactSourceState;
  route?: ExecutionRoute;
  title: string;
  detail: string;
  status: 'passed' | 'failed' | 'routed' | 'escalated' | 'pending' | 'blocked' | 'running' | 'stale' | 'succeeded';
  artifactUrl?: string;
  relatedId?: string;
  model?: string;
  costCents?: number;
  filesTouched?: string[];
}

export interface RouteAttemptViewModel {
  id: string;
  sequence: number;
  fromRoute: ExecutionRoute | null;
  toRoute: ExecutionRoute;
  trigger: 'initial-route' | 'retry' | 'reroute' | 'manual-override';
  status: 'selected' | 'failed' | 'superseded' | 'blocked';
  reason: string;
  occurredAt: string;
  sourceState?: ArtifactSourceState;
  model?: string;
  costCents?: number;
  evidenceEventIds: string[];
}

export interface IssueDetailViewModel extends IssueCardViewModel {
  body: string;
  htmlUrl: string;
  author: string;
  labels: string[];
  modelRun: ModelRunViewModel;
  workOrder: WorkOrderViewModel;
  contextPack: ContextPackViewModel | null;
  sandboxExecutions: SandboxExecutionViewModel[];
  pullRequest: PullRequestViewModel | null;
  verification: VerificationViewModel | null;
  bounty: BountyViewModel | null;
  paymentArtifact: PaymentArtifactViewModel | null;
  routeHistory: RouteAttemptViewModel[];
  trace: IssueTraceEventViewModel[];
  payoutGate: {
    canRelease: boolean;
    reasons: string[];
  };
}

export interface RouteBucketViewModel {
  route: ExecutionRoute;
  lane: DemoLane;
  label: string;
  count: number;
  issues: IssueCardViewModel[];
}

export interface EvaluationSummaryViewModel {
  sampleSize: number;
  sourceState?: ArtifactSourceState;
  sampleLabel?: string;
  comparisonKind?: 'paired' | 'comparable' | 'unpaired' | 'planned';
  baselinePassedCount?: number;
  baselineTotalCount?: number;
  enrichedPassedCount?: number;
  enrichedTotalCount?: number;
  liftDeltaPct?: number | null;
  baselinePassRate: number;
  enrichedContextPassRate: number;
  retryRate: number;
  escalationRate: number;
  costPerVerifiedFixCents: number;
  costEvidence?: 'known' | 'estimated' | 'unknown';
  premiumOnlyCostPerVerifiedFixCents?: number | null;
  cheapFirstSavingsPct?: number | null;
  commonFailureReasons: string[];
  rows?: Array<{
    id: string;
    label: string;
    issueNumber?: number;
    attemptId?: string;
    sampleId?: string;
    pairId?: string;
    pairState?: 'paired' | 'comparable' | 'unpaired';
    contextMode: 'baseline' | 'nia-enriched';
    verificationStatus: ArtifactStatus;
    sourceState?: ArtifactSourceState;
    contextPackId?: string;
    traceUrl?: string;
    verificationUrl?: string;
    failureCategory?: string | null;
    retryCount?: number;
    escalated?: boolean;
    modelTierPath?: string;
    modelCostCents?: number | null;
    premiumBaselineCostCents?: number | null;
    costEvidence?: 'known' | 'estimated' | 'unknown';
  }>;
}

export interface DashboardViewModel {
  repository: MaintainerRepositorySummary;
  demo: {
    step: 'messy_backlog' | 'triaged' | 'agent_work_order' | 'agent_pr' | 'greptile_verified' | 'bounty_funded' | 'clustly_released';
    isAutoPlaying: boolean;
  };
  buckets: RouteBucketViewModel[];
  issues: IssueCardViewModel[];
  issueDetails: IssueDetailViewModel[];
  selectedIssue: IssueDetailViewModel;
  evaluation: EvaluationSummaryViewModel;
  providerStatuses?: ProviderStatusViewModel[];
  sponsorProof?: SponsorProofViewModel[];
}

export interface MaintainerOSRepository {
  getDashboard(repositoryId?: string): Promise<DashboardViewModel>;
  getIssueDetail(repositoryId: string, issueNumber: number): Promise<IssueDetailViewModel | null>;
  getIssueTrace(repositoryId: string, issueNumber: number): Promise<IssueTraceEventViewModel[]>;
  getEvaluationSummary(repositoryId?: string): Promise<EvaluationSummaryViewModel>;
  getSandboxAttempts(repositoryId?: string): Promise<SandboxAttemptListItemViewModel[]>;
  getVerificationQueue(repositoryId?: string): Promise<VerificationQueueItemViewModel[]>;
  getBountyTasks(repositoryId?: string): Promise<ClustlyBountyListItemViewModel[]>;
}

export const ROUTE_TO_LANE: Record<ExecutionRoute, DemoLane> = {
  'agent-solvable': 'agent',
  'maintainer-review': 'maintainer',
  'bounty-worthy': 'bounty',
  'close-or-clarify': 'clarify',
};

export const ROUTE_LABEL: Record<ExecutionRoute, string> = {
  'agent-solvable': 'Agent-safe',
  'maintainer-review': 'Maintainer',
  'bounty-worthy': 'Bounty',
  'close-or-clarify': 'Clarify',
};
