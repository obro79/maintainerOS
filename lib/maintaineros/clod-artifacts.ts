import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ClodRouteResult } from './clod';
import { buildClodRunEvidenceMeta } from './clod-run-evidence';
import { buildInitialRouteAttempt, mergeRouteHistory } from './route-history';
import type { ExecutionRoute, IssueDetailViewModel, IssueTraceEventViewModel, RouteAttemptViewModel, WorkOrderViewModel } from './types';

interface StoredClodArtifact {
  repositoryId: string;
  issueNumber: number;
  issueId: string;
  route: ExecutionRoute;
  createdAt: string;
  artifact: ClodRouteResult['artifact'];
  modelRun: IssueDetailViewModel['modelRun'];
  runEvidence: ReturnType<typeof buildClodRunEvidenceMeta>;
  workOrder: WorkOrderViewModel;
  traceEvent: IssueTraceEventViewModel;
  routeAttempt?: RouteAttemptViewModel;
}

interface ClodArtifactFile {
  artifacts: StoredClodArtifact[];
}

const STORE_PATH = join(process.cwd(), 'data', 'clod-artifacts.json');

export function persistClodArtifact(repositoryId: string, issue: IssueDetailViewModel, result: ClodRouteResult) {
  const createdAt = result.modelRun.createdAt ?? new Date().toISOString();
  const workOrder: WorkOrderViewModel = {
    ...issue.workOrder,
    title: result.artifact.summary || issue.workOrder.title,
    summary: result.artifact.summary,
    rationale: result.artifact.rationale,
    generatedBy: result.modelRun.status === 'succeeded' ? 'clod' : 'deterministic',
    generatedAt: createdAt,
    status: result.modelRun.status === 'succeeded' ? 'ready' : issue.workOrder.status,
    acceptanceChecks: result.artifact.acceptanceChecks.length > 0 ? result.artifact.acceptanceChecks : issue.workOrder.acceptanceChecks,
  };
  const traceEvent: IssueTraceEventViewModel = {
    id: `${result.modelRun.runId ?? result.modelRun.id ?? `clod-${issue.id}`}-trace`,
    at: createdAt,
    actor: result.modelRun.status === 'succeeded' ? 'CLōD model router' : 'MaintainerOS deterministic fallback',
    provider: 'clod',
    sourceState: result.modelRun.sourceState ?? (result.modelRun.status === 'succeeded' ? 'live' : 'fixture'),
    title: result.modelRun.status === 'succeeded' ? 'CLōD work order generated' : 'CLōD fallback work order generated',
    detail: result.fallbackReason ?? `${result.artifact.rationale} Model ${result.modelRun.model} selected ${result.modelRun.tier}; cost ${formatCost(result.modelRun.estimatedCostCents)}.`,
    status: result.modelRun.status === 'succeeded' ? 'passed' : 'succeeded',
    relatedId: result.modelRun.runId ?? result.modelRun.id,
    model: result.modelRun.model,
    costCents: result.modelRun.estimatedCostCents ?? undefined,
    filesTouched: issue.workOrder.suggestedFiles,
  };
  const routeAttempt = buildInitialRouteAttempt(
    {
      id: `${issue.id}-${result.modelRun.runId ?? result.modelRun.id ?? createdAt}`,
      route: issue.route,
      rationale: result.fallbackReason ?? result.artifact.rationale,
      modelRun: result.modelRun,
    },
    createdAt,
    [traceEvent.id],
  );
  const stored: StoredClodArtifact = {
    repositoryId,
    issueNumber: issue.number,
    issueId: issue.id,
    route: issue.route,
    createdAt,
    artifact: result.artifact,
    modelRun: result.modelRun,
    runEvidence: buildClodRunEvidenceMeta({ issue, modelRun: result.modelRun }),
    workOrder,
    traceEvent,
    routeAttempt,
  };
  const file = readStore();
  file.artifacts = [
    stored,
    ...file.artifacts.filter((artifact) => artifact.traceEvent.id !== traceEvent.id),
  ].slice(0, 200);
  writeStore(file);
  return stored;
}

export function applyStoredClodArtifact(repositoryId: string, issue: IssueDetailViewModel): IssueDetailViewModel {
  const storedArtifacts = getStoredClodArtifacts(repositoryId, issue.number);
  const stored = storedArtifacts[0];
  if (!stored) return issue;

  const storedTraceEvents = storedArtifacts.map((artifact) => artifact.traceEvent);
  const storedTraceIds = new Set(storedTraceEvents.map((event) => event.id));
  const trace = [...storedTraceEvents, ...issue.trace.filter((event) => !storedTraceIds.has(event.id))]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const routeHistory = mergeRouteHistory(
    issue.routeHistory,
    storedArtifacts.map((artifact) => artifact.routeAttempt ?? buildInitialRouteAttempt(
      {
        id: `${artifact.issueId}-${artifact.traceEvent.id}`,
        route: artifact.route,
        rationale: artifact.traceEvent.detail,
        modelRun: artifact.modelRun,
      },
      artifact.createdAt,
      [artifact.traceEvent.id],
    )),
  );

  return {
    ...issue,
    modelRun: stored.modelRun,
    workOrder: stored.workOrder,
    routeHistory,
    trace,
  };
}

export function getStoredClodArtifact(repositoryId: string, issueNumber: number) {
  return getStoredClodArtifacts(repositoryId, issueNumber)[0] ?? null;
}

export function getStoredClodArtifacts(repositoryId: string, issueNumber: number) {
  return readStore().artifacts
    .filter((artifact) => artifact.repositoryId === repositoryId && artifact.issueNumber === issueNumber)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function readStore(): ClodArtifactFile {
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as ClodArtifactFile;
  } catch {
    return { artifacts: [] };
  }
}

function writeStore(file: ClodArtifactFile) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

function formatCost(value: number | null) {
  return value == null ? 'unknown' : `${value}c`;
}
