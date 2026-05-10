import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ClodRouteResult } from './clod';
import type { ExecutionRoute, IssueDetailViewModel, IssueTraceEventViewModel, WorkOrderViewModel } from './types';

interface StoredClodArtifact {
  repositoryId: string;
  issueNumber: number;
  issueId: string;
  route: ExecutionRoute;
  createdAt: string;
  artifact: ClodRouteResult['artifact'];
  modelRun: IssueDetailViewModel['modelRun'];
  workOrder: WorkOrderViewModel;
  traceEvent: IssueTraceEventViewModel;
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
    detail: result.fallbackReason ?? result.artifact.rationale,
    status: result.modelRun.status === 'succeeded' ? 'passed' : 'succeeded',
    relatedId: result.modelRun.runId ?? result.modelRun.id,
    model: result.modelRun.model,
    costCents: result.modelRun.estimatedCostCents ?? undefined,
    filesTouched: issue.workOrder.suggestedFiles,
  };
  const stored: StoredClodArtifact = {
    repositoryId,
    issueNumber: issue.number,
    issueId: issue.id,
    route: issue.route,
    createdAt,
    artifact: result.artifact,
    modelRun: result.modelRun,
    workOrder,
    traceEvent,
  };
  const file = readStore();
  file.artifacts = [
    stored,
    ...file.artifacts.filter((artifact) => artifact.repositoryId !== repositoryId || artifact.issueNumber !== issue.number),
  ].slice(0, 200);
  writeStore(file);
  return stored;
}

export function applyStoredClodArtifact(repositoryId: string, issue: IssueDetailViewModel): IssueDetailViewModel {
  const stored = getStoredClodArtifact(repositoryId, issue.number);
  if (!stored) return issue;

  const trace = [stored.traceEvent, ...issue.trace.filter((event) => event.id !== stored.traceEvent.id)]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    ...issue,
    modelRun: stored.modelRun,
    workOrder: stored.workOrder,
    trace,
  };
}

export function getStoredClodArtifact(repositoryId: string, issueNumber: number) {
  return readStore().artifacts.find((artifact) => artifact.repositoryId === repositoryId && artifact.issueNumber === issueNumber) ?? null;
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
