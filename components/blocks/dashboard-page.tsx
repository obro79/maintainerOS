'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ChevronLeft, RefreshCw,
  CheckCircle2, GitPullRequest, Award, Zap, MessageSquare, X,
} from 'lucide-react';
import { SiteNav } from '@/components/layout/site-nav';
import { LANE_CONFIG } from '@/lib/design-system';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────── */
interface GhLabel   { name: string; color: string; }
interface DashboardIssue {
  number: number; title: string; labels: GhLabel[];
  user: string; daysAgo: number;
}
interface Repo { id: string; label: string; }
type LaneKey = 'agent' | 'review' | 'bounty' | 'clarify';
interface ActivityEntry {
  id: string;
  Icon: React.ElementType;
  color: string;
  label: string;
  time: string;
}
interface SelectedIssue { issue: DashboardIssue; laneKey: LaneKey; }

/* ─── Constants ──────────────────────────────────────── */
const LANES: LaneKey[] = ['agent', 'review', 'bounty', 'clarify'];

const DAG_STEPS = [
  { key: 'open',       label: 'Open'       },
  { key: 'triaged',    label: 'Triaged'    },
  { key: 'routed',     label: 'Routed'     },
  { key: 'work_order', label: 'Work Order' },
  { key: 'pr',         label: 'PR Open'    },
  { key: 'verified',   label: 'Verified'   },
  { key: 'done',       label: 'Done'       },
] as const;

type DagStepKey = typeof DAG_STEPS[number]['key'];

const FALLBACK_REPOS: Repo[] = [
  { id: 'acme/frontend', label: 'acme/frontend' },
  { id: 'acme/api',      label: 'acme/api'      },
];

const FALLBACK_ISSUES: Record<LaneKey, DashboardIssue[]> = {
  agent: [{
    number: 111, title: 'Add cursor-based pagination to /issues endpoint',
    labels: [{ name: 'enhancement', color: '0075ca' }, { name: 'api', color: 'e4e669' }],
    user: 'johndoe', daysAgo: 2,
  }],
  review: [{
    number: 87, title: 'Upgrade path for v1→v2 webhook format',
    labels: [{ name: 'breaking-change', color: 'e11d48' }],
    user: 'maintainer', daysAgo: 10,
  }],
  bounty: [{
    number: 112, title: 'Redis queue drains silently on OOM restart',
    labels: [{ name: 'infra', color: '0e8a16' }, { name: 'bug', color: 'd93f0b' }],
    user: 'reporter', daysAgo: 2,
  }],
  clarify: [{
    number: 99, title: 'Clarify expected retry semantics on 408',
    labels: [{ name: 'question', color: 'd876e3' }],
    user: 'contributor', daysAgo: 5,
  }],
};

/* ─── Helpers ────────────────────────────────────────── */
function getDagDetail(key: DagStepKey, issue: DashboardIssue, laneKey: LaneKey): string {
  const lbl = LANE_CONFIG[laneKey].label;
  switch (key) {
    case 'open':       return `#${issue.number} opened ${issue.daysAgo}d ago by ${issue.user}`;
    case 'triaged':    return `CLōD classified → ${lbl} lane · 87% confidence`;
    case 'routed':     return `Dispatched to ${lbl} queue · work order pending`;
    case 'work_order': return `Work order generated with acceptance criteria and context`;
    case 'pr':         return `Agent opened PR #${issue.number + 200} · awaiting review`;
    case 'verified':   return `Greptile: PR #${issue.number + 200} verified · 0 blocking findings`;
    case 'done':       return `Issue closed · PR #${issue.number + 200} merged`;
  }
}

/* ─── GhLabelBadge ───────────────────────────────────── */
function GhLabelBadge({ label }: { label: GhLabel }) {
  const hex = label.color.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return (
    <span
      style={{ backgroundColor: `#${hex}`, color: lum > 0.55 ? '#1a1a1a' : '#ffffff' }}
      className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none"
    >
      {label.name}
    </span>
  );
}

/* ─── IssueCard ──────────────────────────────────────── */
function IssueCard({
  issue, laneKey, dispatching, completed, selected, onSelect,
}: {
  issue: DashboardIssue; laneKey: LaneKey;
  dispatching: boolean; completed: boolean; selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LANE_CONFIG[laneKey];

  return (
    <motion.div
      layout
      animate={dispatching ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      onClick={onSelect}
      className={cn(
        'rounded-lg border cursor-pointer transition-all duration-150',
        selected  ? `${cfg.tw.border} ${cfg.tw.bgFaint}` : 'border-white/8 bg-[#0d1520] hover:border-white/15',
        dispatching && 'ring-1 ring-emerald-400/40',
        completed && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="mt-0.5 shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs leading-snug', completed ? 'line-through text-zinc-600' : 'text-zinc-200')}>
            {issue.title}
          </p>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issue.labels.map((lbl) => <GhLabelBadge key={lbl.name} label={lbl} />)}
            </div>
          )}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                  #{issue.number} · {issue.user} opened {issue.daysAgo} {issue.daysAgo === 1 ? 'day' : 'days'} ago
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {completed && <CheckCircle2 className="size-3 text-emerald-400 shrink-0 mt-0.5" />}
      </div>
    </motion.div>
  );
}

/* ─── LaneColumn ─────────────────────────────────────── */
function LaneColumn({
  laneKey, issues, loading, dispatchingIssues, completedIssues, selectedNumber, onSelect,
}: {
  laneKey: LaneKey; issues: DashboardIssue[]; loading: boolean;
  dispatchingIssues: Set<number>; completedIssues: Set<number>;
  selectedNumber: number | null; onSelect: (i: DashboardIssue) => void;
}) {
  const cfg = LANE_CONFIG[laneKey];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: LANES.indexOf(laneKey) * 0.07 }}
      className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
        <div className={cn('size-2 rounded-full shrink-0', cfg.tw.bg)} />
        <span className={cn('font-heading font-semibold text-sm', cfg.tw.text)}>{cfg.label}</span>
      </div>
      <div className="p-3 space-y-2 min-h-[80px]">
        {loading ? (
          <div className="py-6 text-center text-[10px] text-zinc-700 font-mono animate-pulse">loading…</div>
        ) : issues.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-zinc-700">No issues</div>
        ) : issues.map((issue) => (
          <IssueCard
            key={issue.number}
            issue={issue}
            laneKey={laneKey}
            dispatching={dispatchingIssues.has(issue.number)}
            completed={completedIssues.has(issue.number)}
            selected={selectedNumber === issue.number}
            onSelect={() => onSelect(issue)}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ─── DagPanel ───────────────────────────────────────── */
function DagPanel({
  selected, stepIndex, playing, onClose, onPlay, onPrev, onNext,
}: {
  selected: SelectedIssue; stepIndex: number; playing: boolean;
  onClose: () => void; onPlay: () => void; onPrev: () => void; onNext: () => void;
}) {
  const { issue, laneKey } = selected;
  const cfg = LANE_CONFIG[laneKey];
  const atEnd = stepIndex >= DAG_STEPS.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/6">
        <span className="font-mono text-[11px] text-zinc-600 shrink-0">#{issue.number}</span>
        <span className="flex-1 text-sm text-zinc-200 truncate">{issue.title}</span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors ml-1">
          <X className="size-3.5" />
        </button>
      </div>

      {/* DAG step pills */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-1">
          {DAG_STEPS.map((step, i) => {
            const done    = i < stepIndex;
            const current = i === stepIndex;
            return (
              <div key={step.key} className="flex items-center gap-1">
                {i > 0 && (
                  <div className={cn('w-3 h-px shrink-0', done ? `${cfg.tw.bg} opacity-40` : 'bg-white/15')} />
                )}
                <span className={cn(
                  'px-1.5 py-0.5 rounded border text-[9px] font-mono transition-colors',
                  done    ? `${cfg.tw.bgFaint} ${cfg.tw.text} ${cfg.tw.border}` :
                  current ? 'border-white/20 bg-white/6 text-zinc-200' :
                            'border-white/6 text-zinc-700',
                )}>
                  {i + 1}. {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step detail */}
      <div className={cn('mx-4 mb-3 rounded-lg border px-3 py-2', cfg.tw.border, cfg.tw.bgFaint)}>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {getDagDetail(DAG_STEPS[stepIndex].key, issue, laneKey)}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={onPlay}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
            playing ? 'border-white/8 text-zinc-600' : `${cfg.tw.border} ${cfg.tw.bgFaint} ${cfg.tw.text}`,
          )}
        >
          <RefreshCw className={cn('size-3', playing && 'animate-spin')} />
          {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        </button>
        <button onClick={onPrev} disabled={stepIndex === 0}
          className="p-1.5 rounded-lg border border-white/8 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">
          <ChevronLeft className="size-3.5" />
        </button>
        <button onClick={onNext} disabled={atEnd}
          className="p-1.5 rounded-lg border border-white/8 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">
          <ChevronRight className="size-3.5" />
        </button>
        {atEnd && (
          <span className="ml-auto text-[10px] font-mono text-emerald-400">✓ Resolved</span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── ActivityFeedPanel ──────────────────────────────── */
function ActivityFeedPanel({ items }: { items: ActivityEntry[] }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/6">
        <span className="font-heading font-semibold text-sm text-white">Activity</span>
      </div>
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-zinc-700">No activity · dispatch to begin</p>
          ) : items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 px-4 py-3"
            >
              <div className="size-5 rounded-full bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                <item.Icon className={cn('size-2.5', item.color)} />
              </div>
              <p className="flex-1 text-xs text-zinc-300 leading-relaxed min-w-0 truncate">{item.label}</p>
              <span className="text-[10px] text-zinc-700 shrink-0 pt-0.5">{item.time}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── DashboardPage ──────────────────────────────────── */
export function DashboardPage() {
  const [repos, setRepos]               = useState<Repo[]>(FALLBACK_REPOS);
  const [selectedRepo, setSelectedRepo] = useState<string>(FALLBACK_REPOS[0].id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [columnIssues, setColumnIssues] = useState<Record<LaneKey, DashboardIssue[]>>(FALLBACK_ISSUES);
  const [loadingCols, setLoadingCols]   = useState<Set<LaneKey>>(new Set());
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // Dynamic state
  const [dispatchingIssues, setDispatchingIssues] = useState<Set<number>>(new Set());
  const [completedIssues,   setCompletedIssues]   = useState<Set<number>>(new Set());
  const [selectedIssue,     setSelectedIssue]     = useState<SelectedIssue | null>(null);
  const [dagStepIndex,      setDagStepIndex]       = useState(0);
  const [dagPlaying,        setDagPlaying]         = useState(false);
  const [activity,          setActivity]           = useState<ActivityEntry[]>([]);
  const [dispatching,       setDispatching]        = useState(false);

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id'>) => {
    setActivity(prev => [
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ...prev.slice(0, 49),
    ]);
  }, []);

  /* Repo & issue fetching ───────── */
  useEffect(() => {
    fetch('/api/dashboard/repos')
      .then((r) => r.json())
      .then((data: Repo[]) => { if (Array.isArray(data) && data.length > 0) { setRepos(data); setSelectedRepo(data[0].id); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    setLoadingCols(new Set(LANES));
    LANES.forEach((laneKey) => {
      fetch(`/api/dashboard/issues?lane=${laneKey}&repo=${encodeURIComponent(selectedRepo)}`)
        .then((r) => r.json())
        .then((data: DashboardIssue[]) => { if (Array.isArray(data)) setColumnIssues((p) => ({ ...p, [laneKey]: data })); })
        .catch(() => { setColumnIssues((p) => ({ ...p, [laneKey]: FALLBACK_ISSUES[laneKey] })); })
        .finally(() => { setLoadingCols((p) => { const n = new Set(p); n.delete(laneKey); return n; }); });
    });
  }, [selectedRepo]);

  /* Close repo dropdown on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  /* Autonomous route on mount */
  useEffect(() => {
    const t = setTimeout(() => {
      const issue = FALLBACK_ISSUES.agent[0];
      addActivity({ Icon: Zap, color: 'text-emerald-400', label: `Autonomous route: #${issue.number} → Agent lane (87% conf)`, time: 'just now' });
    }, 1500);
    return () => clearTimeout(t);
  }, [addActivity]);

  /* DAG auto-play */
  useEffect(() => {
    if (!dagPlaying || !selectedIssue) return;
    if (dagStepIndex >= DAG_STEPS.length - 1) { setDagPlaying(false); return; }

    const t = setTimeout(() => {
      const nextIdx = dagStepIndex + 1;
      const nextKey = DAG_STEPS[nextIdx].key;

      if (nextKey === 'work_order') {
        addActivity({ Icon: Zap, color: 'text-emerald-400', label: `Work order generated for #${selectedIssue.issue.number}`, time: 'just now' });
      } else if (nextKey === 'pr') {
        addActivity({ Icon: GitPullRequest, color: 'text-blue-400', label: `Agent opened PR #${selectedIssue.issue.number + 200} for #${selectedIssue.issue.number}`, time: 'just now' });
      } else if (nextKey === 'verified') {
        addActivity({ Icon: CheckCircle2, color: 'text-emerald-400', label: `Greptile: PR #${selectedIssue.issue.number + 200} verified · 0 findings`, time: 'just now' });
      } else if (nextKey === 'done') {
        setCompletedIssues(c => new Set([...c, selectedIssue.issue.number]));
        addActivity({ Icon: CheckCircle2, color: 'text-emerald-400', label: `#${selectedIssue.issue.number} resolved · PR merged`, time: 'just now' });
      }

      setDagStepIndex(nextIdx);
    }, 1600);

    return () => clearTimeout(t);
  }, [dagPlaying, dagStepIndex, selectedIssue, addActivity]);

  /* Dispatch action */
  const startDispatch = useCallback(() => {
    if (dispatching) return;
    setDispatching(true);
    const allIssues = LANES.flatMap(k => (columnIssues[k] ?? []).map(i => ({ issue: i, laneKey: k })));

    allIssues.forEach(({ issue, laneKey }, idx) => {
      setTimeout(() => {
        setDispatchingIssues(p => new Set([...p, issue.number]));
        const cfg = LANE_CONFIG[laneKey];
        addActivity({ Icon: Zap, color: 'text-emerald-400', label: `#${issue.number} dispatched → ${cfg.label} lane`, time: 'just now' });
        setTimeout(() => setDispatchingIssues(p => { const n = new Set(p); n.delete(issue.number); return n; }), 700);
      }, idx * 450);
    });

    const totalMs = allIssues.length * 450 + 300;
    setTimeout(() => {
      setDispatching(false);
      if (allIssues.length > 0) {
        const { issue, laneKey } = allIssues[0];
        setSelectedIssue({ issue, laneKey });
        setDagStepIndex(0);
        setTimeout(() => setDagPlaying(true), 400);
      }
    }, totalMs);
  }, [dispatching, columnIssues, addActivity]);

  /* Derived */
  const selectedLabel = repos.find((r) => r.id === selectedRepo)?.label ?? selectedRepo;
  const totalIssues   = LANES.reduce((s, k) => s + (columnIssues[k]?.length ?? 0), 0);
  const isLoading     = loadingCols.size > 0;

  const stats = [
    { label: 'Total issues',   value: String(totalIssues),   sub: 'open'        },
    { label: 'Routed',         value: '100%',                sub: 'classified'  },
    { label: 'Avg confidence', value: '87%',                 sub: 'CLOD score'  },
    { label: 'Repos',          value: String(repos.length),  sub: 'connected'   },
  ];

  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white overflow-x-hidden">
      <SiteNav />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-violet-500/4 blur-[100px] rounded-full" />
      </div>

      <div className="relative pt-24 pb-0 px-6">
        <div className="mx-auto max-w-6xl">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-6 pb-5 border-b border-white/6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80 mb-2">Dashboard</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                {selectedLabel}
              </h1>
              <p className="mt-1 text-zinc-600 text-sm font-mono">
                github.com · {totalIssues} open issues · fixture
              </p>
            </motion.div>

            <div className="flex items-center gap-3 mt-1 shrink-0">
              {/* Dispatch button */}
              <motion.button
                onClick={startDispatch}
                disabled={dispatching}
                whileHover={{ scale: dispatching ? 1 : 1.02 }}
                whileTap={{ scale: dispatching ? 1 : 0.98 }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200',
                  dispatching
                    ? 'border-white/8 bg-white/[0.03] text-zinc-600 cursor-default'
                    : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/50',
                )}
              >
                <RefreshCw className={cn('size-4', dispatching && 'animate-spin')} />
                {dispatching ? 'Dispatching…' : 'Dispatch issues'}
              </motion.button>

              {/* Repo dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-zinc-200 hover:border-white/20 hover:bg-white/[0.05] transition-all duration-200 min-w-[170px]"
                >
                  <span className="flex-1 text-left">{selectedLabel}</span>
                  <ChevronDown className={cn('size-3.5 text-zinc-600 transition-transform duration-200', dropdownOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full right-0 mt-1.5 z-20 rounded-xl border border-white/10 bg-[#0d1520] shadow-2xl overflow-hidden min-w-full"
                    >
                      {repos.map((repo) => (
                        <button key={repo.id}
                          onClick={() => { setSelectedRepo(repo.id); setDropdownOpen(false); }}
                          className={cn(
                            'w-full text-left px-4 py-2.5 text-sm transition-colors',
                            repo.id === selectedRepo ? 'text-emerald-400 bg-emerald-500/8' : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]',
                          )}>
                          {repo.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/6 border-b border-white/6"
          >
            {stats.map((s) => (
              <div key={s.label} className="bg-[#030509] px-5 py-4">
                <div className="font-heading font-bold text-2xl text-white">{s.value}</div>
                <div className="text-[11px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Lane count row */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-4 gap-4 pt-6 pb-3"
          >
            {LANES.map((laneKey, i) => {
              const cfg   = LANE_CONFIG[laneKey];
              const count = columnIssues[laneKey]?.length ?? 0;
              return (
                <motion.div key={laneKey}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 + i * 0.05 }}
                  className="flex items-baseline gap-2"
                >
                  <span className={cn('font-heading font-bold text-2xl [font-variant-numeric:tabular-nums]', cfg.tw.text)}>
                    {isLoading ? '—' : count}
                  </span>
                  <span className="text-[11px] text-zinc-600 font-mono">{cfg.label.toLowerCase()}</span>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Main area: 2×2 columns + right panel */}
          <div className="flex gap-6 pb-12 items-start">

            {/* Left: 2×2 Kanban grid */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
              {LANES.map((laneKey) => (
                <LaneColumn
                  key={laneKey}
                  laneKey={laneKey}
                  issues={columnIssues[laneKey] ?? []}
                  loading={loadingCols.has(laneKey)}
                  dispatchingIssues={dispatchingIssues}
                  completedIssues={completedIssues}
                  selectedNumber={selectedIssue?.issue.number ?? null}
                  onSelect={(issue) => {
                    setSelectedIssue({ issue, laneKey });
                    setDagStepIndex(0);
                    setDagPlaying(false);
                  }}
                />
              ))}
            </div>

            {/* Right: DAG + activity */}
            <div className="w-[340px] shrink-0 space-y-4">
              <AnimatePresence>
                {selectedIssue ? (
                  <DagPanel
                    key="dag"
                    selected={selectedIssue}
                    stepIndex={dagStepIndex}
                    playing={dagPlaying}
                    onClose={() => { setSelectedIssue(null); setDagPlaying(false); }}
                    onPlay={() => {
                      if (dagStepIndex >= DAG_STEPS.length - 1) { setDagStepIndex(0); setDagPlaying(true); }
                      else setDagPlaying(p => !p);
                    }}
                    onPrev={() => { setDagPlaying(false); setDagStepIndex(s => Math.max(0, s - 1)); }}
                    onNext={() => { setDagPlaying(false); setDagStepIndex(s => Math.min(DAG_STEPS.length - 1, s + 1)); }}
                  />
                ) : (
                  <motion.div
                    key="dag-placeholder"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="rounded-xl border border-white/6 bg-[#080d14] px-5 py-8 text-center"
                  >
                    <p className="text-[11px] text-zinc-700">Select an issue to view its DAG progression</p>
                  </motion.div>
                )}
              </AnimatePresence>
              <ActivityFeedPanel items={activity} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
