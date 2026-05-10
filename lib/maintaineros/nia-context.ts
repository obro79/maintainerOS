import type { ArtifactSourceState, ContextPackViewModel, IssueTraceEventViewModel, WorkOrderViewModel } from './types';

interface ContextIssueInput {
  id: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  route: string;
  workOrder: WorkOrderViewModel;
}

export function buildContextPackForIssue(issue: ContextIssueInput, sourceState: ArtifactSourceState): ContextPackViewModel | null {
  if (!shouldAttachContext(issue)) return null;

  const citations = buildCitations(issue);
  if (citations.length === 0) {
    return {
      provider: 'nia',
      sourceState,
      id: `${issue.id}-nia-context`,
      issueId: issue.id,
      issueNumber: issue.number,
      workOrderId: `work-order-${issue.number}`,
      createdAt: new Date().toISOString(),
      status: 'blocked',
      summary: 'Nia context pack could not be assembled because no relevant files, docs, issues, or commands were identified.',
      sourceCount: 0,
      confidence: 0,
      citations: [],
      suggestedCommands: [],
      errorMessage: 'No useful context sources found.',
    };
  }

  return {
    provider: 'nia',
    sourceState,
    id: `${issue.id}-nia-context`,
    issueId: issue.id,
    issueNumber: issue.number,
    workOrderId: `work-order-${issue.number}`,
    createdAt: new Date().toISOString(),
    status: 'succeeded',
    summary: contextSummary(issue, citations.length, sourceState),
    sourceCount: citations.length,
    confidence: confidenceFor(issue, citations.length),
    citations,
    suggestedCommands: suggestedCommandsFor(issue),
    errorMessage: null,
  };
}

export function buildNiaTraceEvent(issue: { id: string; number: number }, contextPack: ContextPackViewModel): IssueTraceEventViewModel {
  return {
    id: `${contextPack.id}-trace`,
    at: contextPack.createdAt ?? new Date().toISOString(),
    actor: 'Nia context provider',
    provider: 'nia',
    sourceState: contextPack.sourceState,
    title: contextPack.status === 'succeeded' ? 'Nia context pack attached' : 'Nia context pack blocked',
    detail: contextPack.status === 'succeeded'
      ? `${contextPack.sourceCount} sources attached for issue #${issue.number}; confidence ${Math.round(contextPack.confidence * 100)}%.`
      : contextPack.errorMessage ?? contextPack.summary,
    status: contextPack.status === 'succeeded' ? 'passed' : contextPack.status === 'blocked' ? 'blocked' : 'failed',
    relatedId: contextPack.id,
  };
}

function shouldAttachContext(issue: ContextIssueInput) {
  if (issue.route === 'close-or-clarify') return false;
  if (issue.route === 'agent-solvable' || issue.route === 'bounty-worthy') return true;
  const text = `${issue.title} ${issue.body} ${issue.labels.join(' ')}`.toLowerCase();
  return text.includes('migration') || text.includes('api') || text.includes('auth') || text.includes('integration');
}

function buildCitations(issue: ContextIssueInput): ContextPackViewModel['citations'] {
  const files = issue.workOrder.suggestedFiles.length > 0 ? issue.workOrder.suggestedFiles : inferredFiles(issue);
  const fileCitations = files.slice(0, 4).map((file, index) => ({
    id: `${issue.id}-nia-file-${index}`,
    title: file,
    kind: 'file' as const,
    pathOrUrl: file,
    snippet: `Relevant implementation surface for #${issue.number}: ${issue.title}.`,
  }));

  const labelCitations = issue.labels.slice(0, 2).map((label, index) => ({
    id: `${issue.id}-nia-label-${index}`,
    title: `Label: ${label}`,
    kind: 'issue' as const,
    snippet: `GitHub label "${label}" contributes routing and context-pack scope.`,
  }));

  return [...fileCitations, ...labelCitations].slice(0, 6);
}

function inferredFiles(issue: ContextIssueInput) {
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  if (text.includes('docs')) return ['docs/'];
  if (text.includes('api')) return ['app/api/', 'lib/'];
  if (text.includes('auth')) return ['lib/maintaineros/auth.ts', 'app/api/auth/'];
  if (text.includes('ui')) return ['components/', 'app/'];
  return ['src/', 'tests/'];
}

function suggestedCommandsFor(issue: ContextIssueInput) {
  const text = `${issue.title} ${issue.body} ${issue.labels.join(' ')}`.toLowerCase();
  const commands = ['npm test'];
  if (text.includes('ui') || text.includes('page')) commands.push('npm run build');
  if (text.includes('api') || text.includes('auth')) commands.push('npm run lint');
  if (commands.length === 1) commands.push('npm run lint');
  return commands;
}

function confidenceFor(issue: ContextIssueInput, sourceCount: number) {
  const fileBonus = Math.min(sourceCount * 0.06, 0.24);
  const labelBonus = Math.min(issue.labels.length * 0.02, 0.08);
  return Number(Math.min(0.94, 0.62 + fileBonus + labelBonus).toFixed(2));
}

function contextSummary(issue: ContextIssueInput, sourceCount: number, sourceState: ArtifactSourceState) {
  return `${sourceState === 'live' ? 'Live-shaped' : sourceState} Nia context pack attached ${sourceCount} sources to the work order for #${issue.number}.`;
}
