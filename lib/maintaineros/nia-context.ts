import type { ArtifactSourceState, ContextPackViewModel, IssueTraceEventViewModel, WorkOrderViewModel } from './types';
import { recordProviderRun } from './provider-runs';
import { getProviderHealth, isOfflineMode } from './provider-runtime';

interface ContextIssueInput {
  id: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  route: string;
  workOrder: WorkOrderViewModel;
  repositoryFullName?: string;
  repositoryUrl?: string;
}

interface NiaSearchSource {
  id?: unknown;
  source_id?: unknown;
  title?: unknown;
  name?: unknown;
  path?: unknown;
  url?: unknown;
  source_url?: unknown;
  content?: unknown;
  text?: unknown;
  snippet?: unknown;
  score?: unknown;
  similarity?: unknown;
  type?: unknown;
  kind?: unknown;
}

const DEFAULT_NIA_BASE_URL = 'https://apigcp.trynia.ai/v2';

export async function buildContextPackForIssue(issue: ContextIssueInput, sourceState: ArtifactSourceState): Promise<ContextPackViewModel | null> {
  if (!shouldAttachContext(issue)) return null;
  if (sourceState !== 'live') return buildFixtureContextPackForIssue(issue, sourceState);
  if (isOfflineMode()) return buildFixtureContextPackForIssue(issue, 'fixture', 'Offline mode is enabled; using deterministic Nia fixture context.');

  const health = getProviderHealth('nia');
  if (!health?.configured) {
    return buildFixtureContextPackForIssue(issue, 'fixture', health?.detail ?? 'Nia provider configuration is missing.');
  }

  try {
    const result = await fetchNiaContextPack(issue);
    if (!result) return buildFixtureContextPackForIssue(issue, 'fixture', 'Nia returned no usable sources; using deterministic fixture context.');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nia context request failed.';
    return buildFixtureContextPackForIssue(issue, 'fixture', message);
  }
}

export function buildFixtureContextPackForIssue(issue: ContextIssueInput, sourceState: ArtifactSourceState, fallbackReason?: string): ContextPackViewModel | null {
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
      query: contextQuery(issue),
      sourceIds: [],
      createdAt: new Date().toISOString(),
      status: 'blocked',
      summary: fallbackReason
        ? `Nia fixture fallback was blocked: ${fallbackReason}`
        : 'Nia context pack could not be assembled because no relevant files, docs, issues, or commands were identified.',
      sourceCount: 0,
      confidence: 0,
      citations: [],
      suggestedCommands: [],
      errorMessage: fallbackReason ?? 'No useful context sources found.',
    };
  }

  return {
    provider: 'nia',
    sourceState,
    id: `${issue.id}-nia-context`,
    issueId: issue.id,
    issueNumber: issue.number,
    workOrderId: `work-order-${issue.number}`,
    query: contextQuery(issue),
    sourceIds: citations.map((citation) => citation.sourceId ?? citation.id),
    createdAt: new Date().toISOString(),
    status: 'succeeded',
    summary: fallbackReason
      ? `${contextSummary(issue, citations.length, sourceState)} Fixture fallback reason: ${fallbackReason}`
      : contextSummary(issue, citations.length, sourceState),
    sourceCount: citations.length,
    confidence: confidenceFor(issue, citations.length),
    citations,
    suggestedCommands: suggestedCommandsFor(issue),
    errorMessage: fallbackReason ?? null,
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
    artifactUrl: contextPack.artifactUrl,
    relatedId: contextPack.providerRunId ?? contextPack.id,
  };
}

async function fetchNiaContextPack(issue: ContextIssueInput): Promise<ContextPackViewModel | null> {
  const startedAt = Date.now();
  const requestQuery = contextQuery(issue);
  const baseUrl = (process.env.NIA_BASE_URL || DEFAULT_NIA_BASE_URL).replace(/\/$/, '');
  const endpoint = `${baseUrl}/search`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getNiaTimeoutMs());
  const requestBody = {
    mode: 'query',
    search_mode: 'unified',
    include_sources: true,
    fast_mode: true,
    stream: false,
    max_tokens: 1400,
    messages: [{ role: 'user', content: requestQuery }],
    repositories: issue.repositoryFullName ? [issue.repositoryFullName] : [],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NIA_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(errorMessage(payload, `Nia search failed with ${response.status}.`));
    }

    const citations = normalizeNiaCitations(issue, payload);
    if (citations.length === 0) {
      await recordNiaRun(issue, {
        status: 'blocked',
        runId: runIdFrom(payload),
        endpoint,
        latencyMs: Date.now() - startedAt,
        requestBody,
        responseMeta: responseMeta(payload, 0),
        errorMessage: 'Nia returned no usable source citations.',
      });
      return null;
    }

    const providerRunId = runIdFrom(payload) ?? `nia-context-${issue.id}-${Date.now()}`;
    const sourceIds = citations.map((citation) => citation.sourceId ?? citation.id);
    await recordNiaRun(issue, {
      status: 'succeeded',
      runId: providerRunId,
      endpoint,
      latencyMs: Date.now() - startedAt,
      requestBody,
      responseMeta: responseMeta(payload, citations.length),
      errorMessage: null,
    });

    return {
      provider: 'nia',
      sourceState: 'live',
      id: `${issue.id}-nia-context`,
      issueId: issue.id,
      issueNumber: issue.number,
      workOrderId: `work-order-${issue.number}`,
      providerRunId,
      query: requestQuery,
      sourceIds,
      artifactUrl: endpoint,
      createdAt: new Date().toISOString(),
      status: 'succeeded',
      summary: liveContextSummary(issue, citations.length, payload),
      sourceCount: citations.length,
      confidence: confidenceFromCitations(issue, citations),
      citations,
      suggestedCommands: suggestedCommandsFromNia(issue, payload),
      errorMessage: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordNiaRun(
  issue: ContextIssueInput,
  input: {
    status: 'succeeded' | 'blocked' | 'failed';
    runId?: string | null;
    endpoint: string;
    latencyMs: number;
    requestBody: Record<string, unknown>;
    responseMeta: Record<string, unknown>;
    errorMessage: string | null;
  },
) {
  await recordProviderRun({
    provider: 'nia',
    purpose: 'context-pack',
    status: input.status,
    sourceState: input.status === 'succeeded' ? 'live' : 'planned',
    repositoryId: issue.repositoryFullName ?? null,
    issueNumber: issue.number,
    runId: input.runId ?? null,
    artifactUrl: input.endpoint,
    latencyMs: input.latencyMs,
    errorMessage: input.errorMessage,
    requestMeta: input.requestBody,
    responseMeta: input.responseMeta,
  });
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
    sourceId: `${issue.id}-file-${index}`,
    sourceUrl: file,
    pathOrUrl: file,
    snippet: `Relevant implementation surface for #${issue.number}: ${issue.title}.`,
    score: Number((0.82 - index * 0.03).toFixed(2)),
  }));

  const labelCitations = issue.labels.slice(0, 2).map((label, index) => ({
    id: `${issue.id}-nia-label-${index}`,
    title: `Label: ${label}`,
    kind: 'issue' as const,
    sourceId: `${issue.id}-label-${index}`,
    snippet: `GitHub label "${label}" contributes routing and context-pack scope.`,
    score: Number((0.72 - index * 0.02).toFixed(2)),
  }));

  return [...fileCitations, ...labelCitations].slice(0, 6);
}

function normalizeNiaCitations(issue: ContextIssueInput, payload: unknown): ContextPackViewModel['citations'] {
  const sources = sourceCandidates(payload).slice(0, 6);
  return sources
    .flatMap((source, index) => {
      const sourceId = stringValue(source.source_id) ?? stringValue(source.id) ?? `${issue.id}-nia-live-${index}`;
      const pathOrUrl = stringValue(source.path) ?? stringValue(source.url) ?? stringValue(source.source_url);
      const title = stringValue(source.title) ?? stringValue(source.name) ?? pathOrUrl ?? `Nia source ${index + 1}`;
      const snippet = stringValue(source.snippet) ?? stringValue(source.content) ?? stringValue(source.text);
      const sourceUrl = stringValue(source.source_url) ?? stringValue(source.url);
      const score = numberValue(source.score) ?? numberValue(source.similarity);
      if (!snippet) return [];
      return [{
        id: `${issue.id}-nia-live-${index}`,
        title,
        kind: kindFor(source, pathOrUrl ?? undefined),
        sourceId,
        ...(sourceUrl ? { sourceUrl } : {}),
        ...(pathOrUrl ? { pathOrUrl } : {}),
        snippet: truncate(snippet, 360),
        ...(score == null ? {} : { score }),
      }];
    });
}

function sourceCandidates(payload: unknown): NiaSearchSource[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.sources,
    record.results,
    record.search_results,
    record.citations,
    record.data_sources,
    nested(record, ['data', 'sources']),
    nested(record, ['data', 'results']),
    nested(record, ['response', 'sources']),
  ];
  return candidates
    .flatMap((candidate) => Array.isArray(candidate) ? candidate : [])
    .filter((candidate): candidate is NiaSearchSource => Boolean(candidate) && typeof candidate === 'object');
}

function nested(record: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
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

function suggestedCommandsFromNia(issue: ContextIssueInput, payload: unknown) {
  const commands = [...(issue.workOrder.suggestedCommands ?? []), ...suggestedCommandsFor(issue)];
  if (payload && typeof payload === 'object') {
    const rawCommands = (payload as Record<string, unknown>).commands ?? (payload as Record<string, unknown>).suggested_commands;
    if (Array.isArray(rawCommands)) {
      commands.push(...rawCommands.filter((command): command is string => typeof command === 'string'));
    }
  }
  return [...new Set(commands)].slice(0, 6);
}

function confidenceFor(issue: ContextIssueInput, sourceCount: number) {
  const fileBonus = Math.min(sourceCount * 0.06, 0.24);
  const labelBonus = Math.min(issue.labels.length * 0.02, 0.08);
  return Number(Math.min(0.94, 0.62 + fileBonus + labelBonus).toFixed(2));
}

function confidenceFromCitations(issue: ContextIssueInput, citations: ContextPackViewModel['citations']) {
  const scored = citations.map((citation) => citation.score).filter((score): score is number => typeof score === 'number');
  if (scored.length > 0) {
    const average = scored.reduce((sum, score) => sum + score, 0) / scored.length;
    return Number(Math.min(0.96, Math.max(0.55, average)).toFixed(2));
  }
  return confidenceFor(issue, citations.length);
}

function contextSummary(issue: ContextIssueInput, sourceCount: number, sourceState: ArtifactSourceState) {
  return `${sourceState === 'live' ? 'Live-shaped' : sourceState} Nia context pack attached ${sourceCount} sources to the work order for #${issue.number}.`;
}

function liveContextSummary(issue: ContextIssueInput, sourceCount: number, payload: unknown) {
  const answer = payload && typeof payload === 'object'
    ? stringValue((payload as Record<string, unknown>).answer) ?? stringValue((payload as Record<string, unknown>).response)
    : null;
  if (answer) return truncate(answer, 280);
  return `Live Nia search attached ${sourceCount} cited sources to the work order for #${issue.number}.`;
}

function contextQuery(issue: ContextIssueInput) {
  return [
    `Build a concise context pack for GitHub issue #${issue.number}: ${issue.title}`,
    issue.body,
    `Labels: ${issue.labels.join(', ') || 'none'}`,
    `Route: ${issue.route}`,
    `Acceptance checks: ${issue.workOrder.acceptanceChecks.join('; ') || 'none'}`,
    `Suggested files: ${issue.workOrder.suggestedFiles.join(', ') || 'unknown'}`,
    'Return source-grounded citations and commands useful for an implementation agent.',
  ].filter(Boolean).join('\n\n');
}

function getNiaTimeoutMs() {
  const parsed = Number(process.env.NIA_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2500;
}

function runIdFrom(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  return stringValue(record.run_id) ?? stringValue(record.runId) ?? stringValue(record.id) ?? stringValue(record.job_id);
}

function responseMeta(payload: unknown, sourceCount: number) {
  return {
    sourceCount,
    runId: runIdFrom(payload),
  };
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  return stringValue((payload as Record<string, unknown>).error) ?? stringValue((payload as Record<string, unknown>).message) ?? fallback;
}

function kindFor(source: NiaSearchSource, pathOrUrl: string | undefined): ContextPackViewModel['citations'][number]['kind'] {
  const value = `${stringValue(source.kind) ?? ''} ${stringValue(source.type) ?? ''} ${pathOrUrl ?? ''}`.toLowerCase();
  if (value.includes('pull')) return 'pull-request';
  if (value.includes('issue')) return 'issue';
  if (value.includes('command')) return 'command';
  if (value.includes('doc') || value.includes('http')) return 'doc';
  return 'file';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
