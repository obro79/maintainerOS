import { ROUTE_LABEL, type ArtifactSourceState, type IssueDetailViewModel, type IssueTraceEventViewModel, type ProviderKey } from './types';

export type IssueWorkflowStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'stale'
  | 'blocked'
  | 'succeeded'
  | 'routed'
  | 'escalated'
  | 'selected'
  | 'skipped';

export type IssueWorkflowNodeId =
  | 'github'
  | 'clod'
  | 'work-order'
  | 'nia'
  | 'daytona'
  | 'pull-request'
  | 'greptile'
  | 'clustly'
  | 'terminal';

export type IssueWorkflowProvider = ProviderKey | 'work-order' | 'pull-request' | 'terminal';

export interface IssueWorkflowNode {
  id: IssueWorkflowNodeId;
  label: string;
  provider: IssueWorkflowProvider;
  status: IssueWorkflowStatus;
  sourceState?: ArtifactSourceState;
  summary: string;
  evidenceIds: string[];
}

export interface IssueWorkflowEdge {
  from: IssueWorkflowNodeId;
  to: IssueWorkflowNodeId;
  status: IssueWorkflowStatus;
}

export interface IssueWorkflowSnapshot {
  issue: {
    number: number;
    title: string;
    route: IssueDetailViewModel['route'];
    lane: IssueDetailViewModel['lane'];
    confidence: number;
    risk: IssueDetailViewModel['risk'];
    complexity: IssueDetailViewModel['complexity'];
    rationale: string;
  };
  nodes: IssueWorkflowNode[];
  edges: IssueWorkflowEdge[];
  currentNodeId: IssueWorkflowNodeId;
  latestTraceEvents: IssueTraceEventViewModel[];
}

export function buildIssueWorkflowSnapshot(issue: IssueDetailViewModel): IssueWorkflowSnapshot {
  const trace = [...issue.trace].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const byProvider = (provider: ProviderKey) => trace.filter((event) => event.provider === provider);
  const byTitle = (needle: string) => trace.filter((event) => event.title.toLowerCase().includes(needle));
  const latestTraceEvents = [...trace].reverse().slice(0, 5);
  const latestProviderEvent = (provider: ProviderKey) => byProvider(provider).at(-1);

  const githubEvents = byProvider('github');
  const routeEvents = byProvider('clod');
  const workOrderEvents = [...routeEvents, ...byTitle('work order')];
  const sandbox = issue.sandboxExecutions.at(-1);
  const needsContext = Boolean(issue.contextPack || issue.routePolicy.sandboxAllowed || issue.sandboxExecutions.length > 0);
  const needsSandbox = Boolean(issue.routePolicy.sandboxAllowed || issue.sandboxExecutions.length > 0);
  const needsPullRequest = Boolean(issue.pullRequest || issue.routePolicy.automationAllowed || issue.verification);
  const needsVerification = Boolean(issue.pullRequest || issue.verification || issue.route !== 'close-or-clarify');
  const needsClustly = issue.route === 'bounty-worthy';

  const nodes: IssueWorkflowNode[] = [
    {
      id: 'github',
      label: 'GitHub issue',
      provider: 'github',
      status: statusFromTrace(githubEvents, 'passed'),
      sourceState: latestProviderEvent('github')?.sourceState,
      summary: `Imported issue #${issue.number} from GitHub.`,
      evidenceIds: githubEvents.map((event) => event.id),
    },
    {
      id: 'clod',
      label: 'CLOD route',
      provider: 'clod',
      status: issue.modelRun.status === 'failed' ? 'failed' : 'succeeded',
      sourceState: issue.modelRun.sourceState ?? latestProviderEvent('clod')?.sourceState,
      summary: `${ROUTE_LABEL[issue.route]} selected at ${issue.confidence}% confidence.`,
      evidenceIds: routeEvents.map((event) => event.id),
    },
    {
      id: 'work-order',
      label: 'Work order',
      provider: 'work-order',
      status: workOrderStatus(issue.workOrder.status),
      sourceState: issue.modelRun.sourceState ?? workOrderEvents.at(-1)?.sourceState,
      summary: issue.workOrder.rationale ?? issue.workOrder.summary ?? issue.workOrder.title,
      evidenceIds: uniqueIds(workOrderEvents.map((event) => event.id)),
    },
    {
      id: 'nia',
      label: 'Nia context',
      provider: 'nia',
      status: issue.contextPack ? issue.contextPack.status : needsContext ? 'pending' : 'skipped',
      sourceState: issue.contextPack?.sourceState ?? latestProviderEvent('nia')?.sourceState,
      summary: issue.contextPack?.summary ?? (needsContext ? 'Waiting for repo-grounded context.' : 'No context pack needed for this route.'),
      evidenceIds: byProvider('nia').map((event) => event.id),
    },
    {
      id: 'daytona',
      label: 'AI runner',
      provider: 'daytona',
      status: sandbox ? sandbox.status : needsSandbox ? 'pending' : 'skipped',
      sourceState: sandbox?.sourceState ?? latestProviderEvent('daytona')?.sourceState,
      summary: sandbox?.logSummary ?? (needsSandbox ? 'Waiting for AI execution evidence.' : 'AI execution is not required.'),
      evidenceIds: byProvider('daytona').map((event) => event.id),
    },
    {
      id: 'pull-request',
      label: 'Pull request',
      provider: 'pull-request',
      status: issue.pullRequest ? pullRequestStatus(issue.pullRequest.status) : needsPullRequest ? 'pending' : 'skipped',
      sourceState: issue.pullRequest?.sourceState ?? latestProviderEvent('github')?.sourceState,
      summary: issue.pullRequest ? `PR #${issue.pullRequest.number}: ${issue.pullRequest.title}` : needsPullRequest ? 'Waiting for linked implementation PR.' : 'No PR required yet.',
      evidenceIds: trace.filter((event) => event.relatedId === issue.pullRequest?.id || event.title.toLowerCase().includes('pr')).map((event) => event.id),
    },
    {
      id: 'greptile',
      label: 'Greptile verify',
      provider: 'greptile',
      status: issue.verification ? issue.verification.isStale ? 'stale' : issue.verification.status : needsVerification ? 'pending' : 'skipped',
      sourceState: issue.verification?.sourceState ?? latestProviderEvent('greptile')?.sourceState,
      summary: issue.verification?.summary ?? (needsVerification ? 'Waiting for verification against acceptance criteria.' : 'Verification is not required for this route.'),
      evidenceIds: byProvider('greptile').map((event) => event.id),
    },
    {
      id: 'clustly',
      label: 'Clustly release',
      provider: 'clustly',
      status: clustlyStatus(issue, needsClustly),
      sourceState: issue.paymentArtifact?.sourceState ?? latestProviderEvent('clustly')?.sourceState,
      summary: clustlySummary(issue, needsClustly),
      evidenceIds: byProvider('clustly').map((event) => event.id),
    },
  ];

  const terminal = buildTerminalNode(issue, nodes, trace);
  const allNodes = [...nodes, terminal];

  return {
    issue: {
      number: issue.number,
      title: issue.title,
      route: issue.route,
      lane: issue.lane,
      confidence: issue.confidence,
      risk: issue.risk,
      complexity: issue.complexity,
      rationale: issue.rationale,
    },
    nodes: allNodes,
    edges: buildEdges(allNodes, needsClustly),
    currentNodeId: currentNodeId(allNodes),
    latestTraceEvents,
  };
}

function buildTerminalNode(issue: IssueDetailViewModel, nodes: IssueWorkflowNode[], trace: IssueTraceEventViewModel[]): IssueWorkflowNode {
  const blocking = nodes.find((node) => isBlockingStatus(node.status));
  if (blocking) {
    return {
      id: 'terminal',
      label: 'Blocked',
      provider: 'terminal',
      status: 'blocked',
      sourceState: blocking.sourceState,
      summary: `${blocking.label} needs attention before the issue can finish.`,
      evidenceIds: blocking.evidenceIds,
    };
  }

  if (issue.route === 'close-or-clarify') {
    return {
      id: 'terminal',
      label: 'Clarify',
      provider: 'terminal',
      status: 'succeeded',
      summary: 'MaintainerOS selected a clarification or close path.',
      evidenceIds: trace.map((event) => event.id),
    };
  }

  if (issue.route === 'bounty-worthy') {
    const releaseReady = issue.payoutGate.canRelease || issue.paymentArtifact?.status === 'released' || issue.paymentArtifact?.status === 'paid';
    return {
      id: 'terminal',
      label: releaseReady ? 'Release ready' : 'In progress',
      provider: 'terminal',
      status: releaseReady ? 'succeeded' : 'pending',
      sourceState: issue.paymentArtifact?.sourceState,
      summary: releaseReady ? 'Payout release criteria are satisfied.' : 'Bounty workflow is waiting on proof or release criteria.',
      evidenceIds: trace.map((event) => event.id),
    };
  }

  const verified = issue.verification?.status === 'passed' && !issue.verification.isStale;
  return {
    id: 'terminal',
    label: verified ? 'Done' : 'In progress',
    provider: 'terminal',
    status: verified ? 'succeeded' : 'pending',
    sourceState: issue.verification?.sourceState,
    summary: verified ? 'Issue has a fresh passing verification artifact.' : 'Issue is still working toward fresh verification.',
    evidenceIds: trace.map((event) => event.id),
  };
}

function buildEdges(nodes: IssueWorkflowNode[], needsClustly: boolean): IssueWorkflowEdge[] {
  const edgePairs: Array<[IssueWorkflowNodeId, IssueWorkflowNodeId]> = [
    ['github', 'clod'],
    ['clod', 'work-order'],
    ['work-order', 'nia'],
    ['nia', 'daytona'],
    ['daytona', 'pull-request'],
    ['pull-request', 'greptile'],
    needsClustly ? ['greptile', 'clustly'] : ['greptile', 'terminal'],
    ['clustly', 'terminal'],
  ];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return edgePairs.map(([from, to]) => ({
    from,
    to,
    status: edgeStatus(nodeMap.get(from), nodeMap.get(to)),
  }));
}

function currentNodeId(nodes: IssueWorkflowNode[]): IssueWorkflowNodeId {
  const activeNodes = nodes.filter((node) => node.status !== 'skipped');
  return (
    activeNodes.find((node) => isBlockingStatus(node.status)) ??
    activeNodes.find((node) => node.status === 'running' || node.status === 'pending') ??
    activeNodes.at(-1) ??
    nodes.at(-1)
  )!.id;
}

function statusFromTrace(events: IssueTraceEventViewModel[], fallback: IssueWorkflowStatus): IssueWorkflowStatus {
  const status = events.at(-1)?.status;
  if (!status) return fallback;
  if (status === 'routed') return 'routed';
  return status;
}

function workOrderStatus(status: IssueDetailViewModel['workOrder']['status']): IssueWorkflowStatus {
  if (status === 'completed') return 'succeeded';
  if (status === 'blocked') return 'blocked';
  if (status === 'canceled') return 'failed';
  if (status === 'dispatched') return 'running';
  if (status === 'ready') return 'passed';
  return 'pending';
}

function pullRequestStatus(status: NonNullable<IssueDetailViewModel['pullRequest']>['status']): IssueWorkflowStatus {
  if (status === 'merged') return 'succeeded';
  if (status === 'closed') return 'failed';
  if (status === 'draft') return 'running';
  return 'passed';
}

function clustlyStatus(issue: IssueDetailViewModel, needsClustly: boolean): IssueWorkflowStatus {
  if (!needsClustly) return 'skipped';
  if (!issue.payoutGate.canRelease && issue.payoutGate.reasonCodes.length > 0) return 'blocked';
  const status = issue.paymentArtifact?.status;
  if (!status) return 'pending';
  if (status === 'failed' || status === 'refunded') return 'failed';
  if (status === 'released' || status === 'paid' || status === 'approved') return 'succeeded';
  if (status === 'claimed' || status === 'submitted') return 'running';
  return 'passed';
}

function clustlySummary(issue: IssueDetailViewModel, needsClustly: boolean): string {
  if (!needsClustly) return 'No Clustly artifact needed for this route.';
  if (issue.paymentArtifact) return issue.paymentArtifact.releaseReason;
  return issue.payoutGate.reasons[0] ?? 'Waiting for bounty task and release gate evidence.';
}

function edgeStatus(from?: IssueWorkflowNode, to?: IssueWorkflowNode): IssueWorkflowStatus {
  if (!from || !to) return 'pending';
  if (from.status === 'skipped' || to.status === 'skipped') return 'skipped';
  if (isBlockingStatus(from.status) || isBlockingStatus(to.status)) return 'blocked';
  if (to.status === 'running' || to.status === 'pending') return to.status;
  if (isCompleteStatus(from.status) && isCompleteStatus(to.status)) return 'succeeded';
  return to.status;
}

function isBlockingStatus(status: IssueWorkflowStatus) {
  return status === 'blocked' || status === 'failed' || status === 'stale';
}

function isCompleteStatus(status: IssueWorkflowStatus) {
  return status === 'passed' || status === 'succeeded' || status === 'routed' || status === 'selected';
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}
