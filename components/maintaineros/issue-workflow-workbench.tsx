'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bot,
  Box,
  CheckCircle2,
  CircleDot,
  DollarSign,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { EvidenceBadge } from './evidence-badge';
import { LaneBadge } from '@/components/ui/lane-badge';
import { cn } from '@/lib/utils';
import { formatUtcDateTime } from '@/lib/maintaineros/format';
import { buildIssueWorkflowSnapshot, type IssueWorkflowNode, type IssueWorkflowNodeId, type IssueWorkflowProvider, type IssueWorkflowStatus } from '@/lib/maintaineros/issue-workflow';
import { ROUTE_LABEL, type IssueDetailViewModel, type IssueTraceEventViewModel } from '@/lib/maintaineros/types';

interface IssueWorkflowWorkbenchProps {
  org: string;
  repo: string;
  issueNumber: number | null;
  initialIssue?: IssueDetailViewModel | null;
  onClose: () => void;
}

interface IssueApiPayload {
  ok: boolean;
  repositoryId?: string;
  refreshedAt?: string;
  issue?: IssueDetailViewModel;
  error?: string;
}

const CANVAS = { width: 1340, height: 390 };

const NODE_POSITIONS: Record<IssueWorkflowNodeId, { x: number; y: number }> = {
  github: { x: 112, y: 200 },
  clod: { x: 282, y: 200 },
  'work-order': { x: 452, y: 200 },
  nia: { x: 622, y: 120 },
  daytona: { x: 792, y: 120 },
  'pull-request': { x: 962, y: 120 },
  greptile: { x: 962, y: 280 },
  clustly: { x: 1132, y: 280 },
  terminal: { x: 1248, y: 200 },
};

const GROUPS = [
  { label: 'Intake', x: 28, y: 96, width: 510, height: 208 },
  { label: 'Agent path', x: 566, y: 44, width: 486, height: 142 },
  { label: 'Proof and release', x: 888, y: 222, width: 410, height: 122 },
];

const PROVIDER_ICON: Record<IssueWorkflowProvider, LucideIcon> = {
  github: GitBranch,
  neon: Box,
  clod: Bot,
  nia: Network,
  daytona: FileCode2,
  greptile: ShieldCheck,
  clustly: DollarSign,
  'work-order': CircleDot,
  'pull-request': GitPullRequest,
  terminal: CheckCircle2,
};

const STATUS_LABEL: Record<IssueWorkflowStatus, string> = {
  pending: 'pending',
  running: 'running',
  passed: 'passed',
  failed: 'failed',
  stale: 'stale',
  blocked: 'blocked',
  succeeded: 'done',
  routed: 'routed',
  escalated: 'escalated',
  selected: 'selected',
  skipped: 'skipped',
};

export function IssueWorkflowWorkbench({ org, repo, issueNumber, initialIssue, onClose }: IssueWorkflowWorkbenchProps) {
  const open = issueNumber != null;
  const [issue, setIssue] = useState<IssueDetailViewModel | null>(initialIssue ?? null);
  const [lastRefresh, setLastRefresh] = useState<{ issueNumber: number; at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<{ issueNumber: number; message: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<{ issueNumber: number; nodeId: IssueWorkflowNodeId } | null>(null);

  useEffect(() => {
    if (!open || !issueNumber) return;
    const activeIssueNumber = issueNumber;
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function load(silent: boolean) {
      activeController?.abort();
      activeController = new AbortController();
      if (silent) {
        setPolling(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await fetch(`/api/maintaineros/repositories/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/issues/${activeIssueNumber}`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: activeController.signal,
        });
        const payload = await response.json().catch(() => ({})) as IssueApiPayload;
        if (!response.ok || !payload.ok || !payload.issue) {
          throw new Error(payload.error ?? 'Unable to refresh issue workflow.');
        }
        if (cancelled) return;
        setIssue(payload.issue);
        setLastRefresh({ issueNumber: activeIssueNumber, at: payload.refreshedAt ?? new Date().toISOString() });
        setError(null);
      } catch (caught) {
        if (cancelled || activeController.signal.aborted) return;
        setError({ issueNumber: activeIssueNumber, message: caught instanceof Error ? caught.message : 'Unable to refresh issue workflow.' });
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPolling(false);
        }
      }
    }

    void load(Boolean(initialIssue && initialIssue.number === issueNumber));
    const interval = window.setInterval(() => void load(true), 5000);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(interval);
    };
  }, [initialIssue, issueNumber, open, org, repo]);

  const effectiveIssue = issueNumber && issue?.number === issueNumber
    ? issue
    : issueNumber && initialIssue?.number === issueNumber
      ? initialIssue
      : null;
  const snapshot = useMemo(() => effectiveIssue ? buildIssueWorkflowSnapshot(effectiveIssue) : null, [effectiveIssue]);

  if (!issueNumber) return null;

  const selectedNodeId = selectedNode?.issueNumber === issueNumber && snapshot?.nodes.some((node) => node.id === selectedNode.nodeId)
    ? selectedNode.nodeId
    : snapshot?.currentNodeId ?? null;
  const inspectedNode = snapshot?.nodes.find((node) => node.id === selectedNodeId) ?? snapshot?.nodes.find((node) => node.id === snapshot.currentNodeId) ?? null;
  const visibleError = error?.issueNumber === issueNumber ? error.message : null;
  const visibleRefreshAt = lastRefresh?.issueNumber === issueNumber ? lastRefresh.at : null;
  const basePath = `/${org}/${repo}/issues/${issueNumber}`;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <Dialog.Portal keepMounted>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Backdrop
                render={(
                  <motion.div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  />
                )}
              />
              <Dialog.Popup
                render={(
                  <motion.div
                    className="fixed inset-3 z-50 flex overflow-hidden rounded-xl border border-white/10 bg-[#05080d] text-white shadow-2xl shadow-black/60 outline-none md:inset-6"
                    initial={{ opacity: 0, scale: 0.985, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.985, y: 12 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="border-b border-white/8 bg-[#080d14] px-4 py-3 md:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Dialog.Title className="truncate text-sm font-semibold text-white">
                          #{issueNumber} {snapshot?.issue.title ?? effectiveIssue?.title ?? 'Issue workflow'}
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          {snapshot ? (
                            <>
                              <LaneBadge value={snapshot.issue.lane === 'maintainer' ? 'review' : snapshot.issue.lane} />
                              <span className="rounded-full border border-white/10 px-2 py-0.5">{ROUTE_LABEL[snapshot.issue.route]}</span>
                              <span>{snapshot.issue.confidence}% confidence</span>
                              <span className="capitalize">Risk: {snapshot.issue.risk}</span>
                              <span className="capitalize">Complexity: {snapshot.issue.complexity}</span>
                            </>
                          ) : (
                            <span>Loading workflow state...</span>
                          )}
                        </Dialog.Description>
                      </div>
                      <div className="hidden shrink-0 md:block">
                        <RefreshState loading={loading} polling={polling} error={visibleError} lastRefreshedAt={visibleRefreshAt} />
                      </div>
                      <Dialog.Close className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition-colors hover:text-white" aria-label="Close workflow workbench">
                        <X className="size-4" />
                      </Dialog.Close>
                    </div>
                    <div className="mt-3 md:hidden">
                      <RefreshState loading={loading} polling={polling} error={visibleError} lastRefreshedAt={visibleRefreshAt} />
                    </div>
                  </header>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-1 xl:overflow-hidden">
                    <main className="flex min-h-[520px] min-w-0 shrink-0 flex-col xl:min-h-0 xl:shrink xl:overflow-hidden">
                      <div className="min-h-[360px] flex-1 overflow-auto border-b border-white/8 xl:min-h-0 xl:border-b-0">
                        {snapshot ? (
                          <WorkflowGraph
                            nodes={snapshot.nodes}
                            edges={snapshot.edges}
                            currentNodeId={snapshot.currentNodeId}
                            selectedNodeId={selectedNodeId ?? snapshot.currentNodeId}
                            onSelectNode={(nodeId) => setSelectedNode({ issueNumber, nodeId })}
                          />
                        ) : (
                          <WorkflowLoading issueNumber={issueNumber} />
                        )}
                      </div>

                      <TraceStrip events={snapshot?.latestTraceEvents ?? effectiveIssue?.trace.slice(-5).reverse() ?? []} basePath={basePath} />
                    </main>

                    <aside className="shrink-0 border-t border-white/8 bg-[#080d14] p-4 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0">
                      <NodeInspector node={inspectedNode} currentNodeId={snapshot?.currentNodeId ?? null} issue={snapshot?.issue ?? null} basePath={basePath} />
                    </aside>
                  </div>
                </div>
              </Dialog.Popup>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WorkflowGraph({
  nodes,
  edges,
  currentNodeId,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: IssueWorkflowNode[];
  edges: Array<{ from: IssueWorkflowNodeId; to: IssueWorkflowNodeId; status: IssueWorkflowStatus }>;
  currentNodeId: IssueWorkflowNodeId;
  selectedNodeId: IssueWorkflowNodeId;
  onSelectNode: (nodeId: IssueWorkflowNodeId) => void;
}) {
  return (
    <div className="min-h-full min-w-full bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.10)_1px,transparent_0)] [background-size:18px_18px] p-4">
      <div className="relative mx-auto" style={{ width: CANVAS.width, height: CANVAS.height }}>
        <motion.div
          className="absolute left-8 top-5 z-10 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[11px] text-emerald-300"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Working through issue
        </motion.div>
        {GROUPS.map((group) => (
          <motion.div
            key={group.label}
            className="absolute rounded-xl border border-white/8 bg-white/[0.015]"
            style={{ left: group.x, top: group.y, width: group.width, height: group.height }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="absolute left-3 top-2 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-700">{group.label}</span>
          </motion.div>
        ))}

        <svg className="absolute inset-0 pointer-events-none" width={CANVAS.width} height={CANVAS.height} role="presentation">
          {edges.map((edge, index) => {
            const from = NODE_POSITIONS[edge.from];
            const to = NODE_POSITIONS[edge.to];
            const tone = edgeTone(edge.status);
            const active = edge.to === currentNodeId;
            return (
              <motion.line
                key={`${edge.from}-${edge.to}-${edge.status}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={tone.stroke}
                strokeWidth={active ? 2.25 : 1.5}
                strokeLinecap="round"
                strokeDasharray={tone.dash}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: tone.opacity, strokeDashoffset: active ? [0, -18] : 0 }}
                transition={{ pathLength: { duration: 0.45, delay: index * 0.04 }, strokeDashoffset: { duration: 1.1, repeat: active ? Infinity : 0, ease: 'linear' } }}
              />
            );
          })}
        </svg>

        {nodes.map((node, index) => {
          const position = NODE_POSITIONS[node.id];
          return (
            <WorkflowNodeCard
              key={node.id}
              node={node}
              index={index}
              current={node.id === currentNodeId}
              selected={node.id === selectedNodeId}
              onSelect={() => onSelectNode(node.id)}
              style={{ left: position.x, top: position.y }}
            />
          );
        })}
      </div>
    </div>
  );
}

function WorkflowNodeCard({
  node,
  index,
  current,
  selected,
  onSelect,
  style,
}: {
  node: IssueWorkflowNode;
  index: number;
  current: boolean;
  selected: boolean;
  onSelect: () => void;
  style: { left: number; top: number };
}) {
  const Icon = PROVIDER_ICON[node.provider];
  const tone = nodeTone(node.status);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'absolute w-[164px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-[#080d14] p-2.5 text-left shadow-lg shadow-black/20 outline-none transition-colors',
        tone.border,
        selected ? 'ring-2 ring-white/20' : 'hover:border-white/20',
        node.status === 'skipped' && 'opacity-60',
      )}
      style={style}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: selected ? 1.035 : 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] }}
      aria-pressed={selected}
    >
      {current && (
        <motion.span
          className={cn('absolute inset-x-0 top-0 h-px opacity-70', tone.bar)}
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear', delay: index * 0.08 }}
        />
      )}
      {current && (
        <motion.span
          className={cn('absolute -right-1 -top-1 size-3 rounded-full', tone.dot)}
          animate={{ scale: [1, 1.8, 1], opacity: [0.9, 0.15, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-md border', tone.icon)}>
          <Icon className="size-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <p className="truncate text-xs font-semibold text-white">{node.label}</p>
          <p className={cn('shrink-0 text-[9px] font-mono uppercase', tone.text)}>{STATUS_LABEL[node.status]}</p>
        </div>
      </div>
      <p className="mt-2 truncate text-[11px] leading-relaxed text-zinc-500">{node.summary}</p>
    </motion.button>
  );
}

function NodeInspector({
  node,
  currentNodeId,
  issue,
  basePath,
}: {
  node: IssueWorkflowNode | null;
  currentNodeId: IssueWorkflowNodeId | null;
  issue: IssueWorkflowWorkbenchSnapshotIssue | null;
  basePath: string;
}) {
  if (!node || !issue) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-sm font-semibold text-white">Loading node details</p>
        <p className="mt-2 text-sm text-zinc-500">The workflow graph will appear as soon as issue data is available.</p>
      </div>
    );
  }

  const Icon = PROVIDER_ICON[node.provider];
  const tone = nodeTone(node.status);
  const isCurrent = node.id === currentNodeId;

  return (
    <motion.div key={node.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
      <div>
        <div className="flex items-start gap-3">
          <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-lg border', tone.icon)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-white">{node.label}</h2>
              {isCurrent && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">current</span>}
            </div>
            <p className={cn('mt-1 text-xs font-mono uppercase', tone.text)}>{STATUS_LABEL[node.status]}</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{node.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Provider</p>
          <p className="mt-1 text-zinc-300">{providerLabel(node.provider)}</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Source</p>
          <div className="mt-1">{node.sourceState ? <EvidenceBadge sourceState={node.sourceState} /> : <span className="text-zinc-500">unknown</span>}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Route</p>
          <p className="mt-1 text-zinc-300">{ROUTE_LABEL[issue.route]}</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Evidence</p>
          <p className="mt-1 font-mono text-zinc-300">{node.evidenceIds.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/8 bg-black/20 p-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Issue rationale</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{issue.rationale}</p>
      </div>

      {node.evidenceIds.length > 0 && (
        <div className="rounded-lg border border-white/8 bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-700">Trace evidence</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {node.evidenceIds.slice(0, 6).map((id) => (
              <a key={id} className="rounded-md border border-white/8 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300" href={`${basePath}/trace#${id}`}>
                {id}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white" href={basePath}>
          Detail
        </Link>
        <Link className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white" href={`${basePath}/trace`}>
          Trace
        </Link>
      </div>
    </motion.div>
  );
}

type IssueWorkflowWorkbenchSnapshotIssue = ReturnType<typeof buildIssueWorkflowSnapshot>['issue'];

function TraceStrip({ events, basePath }: { events: IssueTraceEventViewModel[]; basePath: string }) {
  return (
    <div className="border-t border-white/8 bg-[#05080d] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-700">Latest trace</p>
        <Link className="text-xs text-zinc-500 hover:text-zinc-300" href={`${basePath}/trace`}>Open ledger</Link>
      </div>
      {events.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-5">
          {events.map((event) => (
            <a key={event.id} href={`${basePath}/trace#${event.id}`} className="min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-2 transition-colors hover:border-white/15">
              <div className="flex items-center gap-2">
                <span className={cn('size-1.5 shrink-0 rounded-full', eventStatusDot(event.status))} />
                <p className="truncate text-[11px] font-medium text-zinc-300">{event.title}</p>
              </div>
              <p className="mt-1 truncate text-[10px] text-zinc-600">{formatUtcDateTime(event.at)}</p>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">No trace events recorded yet.</p>
      )}
    </div>
  );
}

function RefreshState({ loading, polling, error, lastRefreshedAt }: { loading: boolean; polling: boolean; error: string | null; lastRefreshedAt: string | null }) {
  if (error) {
    return (
      <div className="flex max-w-[260px] items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="truncate">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      {(loading || polling) ? <Loader2 className="size-3.5 animate-spin text-emerald-400" /> : <RefreshCw className="size-3.5 text-zinc-600" />}
      <span>{loading ? 'Loading' : polling ? 'Refreshing' : lastRefreshedAt ? `Refreshed ${formatUtcDateTime(lastRefreshedAt)}` : 'Snapshot'}</span>
    </div>
  );
}

function WorkflowLoading({ issueNumber }: { issueNumber: number }) {
  return (
    <div className="flex min-h-[430px] items-center justify-center bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.10)_1px,transparent_0)] [background-size:18px_18px] p-6">
      <div className="rounded-xl border border-white/8 bg-[#080d14] p-5 text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-emerald-400" />
        <p className="mt-3 text-sm font-semibold text-white">Loading issue #{issueNumber}</p>
        <p className="mt-1 text-sm text-zinc-500">Fetching workflow status and trace evidence.</p>
      </div>
    </div>
  );
}

function providerLabel(provider: IssueWorkflowProvider) {
  if (provider === 'pull-request') return 'GitHub PR';
  if (provider === 'work-order') return 'Work order';
  if (provider === 'terminal') return 'Workflow';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function nodeTone(status: IssueWorkflowStatus) {
  if (status === 'failed') {
    return {
      border: 'border-red-500/40',
      text: 'text-red-300',
      dot: 'bg-red-400',
      icon: 'border-red-500/30 bg-red-500/10 text-red-300',
      bar: 'bg-red-300',
    };
  }
  if (status === 'blocked' || status === 'stale') {
    return {
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      bar: 'bg-amber-300',
    };
  }
  if (status === 'running' || status === 'pending' || status === 'escalated') {
    return {
      border: 'border-blue-500/35',
      text: 'text-blue-300',
      dot: 'bg-blue-400',
      icon: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      bar: 'bg-blue-300',
    };
  }
  if (status === 'skipped') {
    return {
      border: 'border-white/8',
      text: 'text-zinc-600',
      dot: 'bg-zinc-600',
      icon: 'border-white/8 bg-white/[0.03] text-zinc-500',
      bar: 'bg-zinc-600',
    };
  }
  return {
    border: 'border-emerald-500/35',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    bar: 'bg-emerald-300',
  };
}

function edgeTone(status: IssueWorkflowStatus) {
  if (status === 'failed') return { stroke: '#f87171', opacity: 0.9, dash: '4 7' };
  if (status === 'blocked' || status === 'stale') return { stroke: '#fbbf24', opacity: 0.85, dash: '7 7' };
  if (status === 'running' || status === 'pending' || status === 'escalated') return { stroke: '#60a5fa', opacity: 0.82, dash: '7 8' };
  if (status === 'skipped') return { stroke: '#3f3f46', opacity: 0.45, dash: '4 8' };
  return { stroke: '#34d399', opacity: 0.86, dash: '0' };
}

function eventStatusDot(status: IssueTraceEventViewModel['status']) {
  if (status === 'failed' || status === 'blocked' || status === 'stale') return 'bg-amber-400';
  if (status === 'running' || status === 'pending' || status === 'escalated') return 'bg-blue-400';
  return 'bg-emerald-400';
}
