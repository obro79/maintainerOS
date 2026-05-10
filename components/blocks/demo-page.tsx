'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Search, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatInteger } from '@/lib/maintaineros/format';
import { SiteNav } from '@/components/layout/site-nav';
import { DataSourceBanner } from '@/components/maintaineros/data-source-banner';
import { ROUTE_LABEL } from '@/lib/maintaineros/types';
import type { DashboardViewModel, DemoLane, IssueCardViewModel } from '@/lib/maintaineros/types';

type Lane = DemoLane;

type Issue = IssueCardViewModel;

const LANE = {
  agent:      { label: 'Agent-safe', color: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8',  badge: 'bg-emerald-950 text-emerald-400 border-emerald-800', bar: 'bg-emerald-500',  glow: 'shadow-emerald-500/20', action: 'Generate work order'   },
  maintainer: { label: 'Maintainer', color: 'text-amber-400',   border: 'border-amber-500/25',   bg: 'bg-amber-500/8',    badge: 'bg-amber-950 text-amber-400 border-amber-800',       bar: 'bg-amber-500',    glow: 'shadow-amber-500/20',   action: 'Review decision brief' },
  bounty:     { label: 'Bounty',     color: 'text-violet-400',  border: 'border-violet-500/25',  bg: 'bg-violet-500/8',   badge: 'bg-violet-950 text-violet-400 border-violet-800',    bar: 'bg-violet-500',   glow: 'shadow-violet-500/20',  action: 'Set bounty amount'     },
  clarify:    { label: 'Clarify',    color: 'text-zinc-400',    border: 'border-zinc-500/25',    bg: 'bg-zinc-800/40',    badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',          bar: 'bg-zinc-500',     glow: 'shadow-zinc-500/20',    action: 'Send clarification'    },
} as const;

const RISK_CLR    = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-red-400' };
const COMPLEX_CLR = { low: 'text-sky-400', medium: 'text-blue-400', high: 'text-violet-400', unknown: 'text-zinc-500' };
const DEMO_STEPS = [
  { key: 'triaged', label: 'Route backlog' },
  { key: 'agent_work_order', label: 'Draft work' },
  { key: 'agent_pr', label: 'Link PR' },
  { key: 'greptile_verified', label: 'Verify proof' },
  { key: 'bounty_funded', label: 'Gate payout' },
  { key: 'clustly_released', label: 'Release artifact' },
] as const;

/* ─── Confidence ring ─────────────────────────────── */
function ConfidenceRing({ value, lane }: { value: number; lane: Lane }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const strokeColor = { agent: '#22c55e', maintainer: '#f59e0b', bounty: '#8b5cf6', clarify: '#71717a' }[lane];
  return (
    <div className="relative inline-flex items-center justify-center size-[72px]">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="36" cy="36" r={r} fill="none"
          stroke={strokeColor} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (value / 100) * circ }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-heading font-bold text-lg text-white leading-none">{value}</div>
        <div className="text-[9px] text-zinc-600 leading-none mt-0.5">%</div>
      </div>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────── */
export function DemoPage({ dashboard }: { dashboard: DashboardViewModel }) {
  const ISSUES = dashboard.issues;
  const [filter, setFilter]       = useState<Lane | 'all'>('all');
  const [selected, setSelected]   = useState<Issue>(dashboard.selectedIssue);
  const [routing, setRouting]     = useState(false);
  const [routedIds, setRoutedIds] = useState<Set<number>>(new Set(ISSUES.map(i => i.number)));
  const [query, setQuery]         = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const counts = {
    agent:      dashboard.buckets.find(bucket => bucket.lane === 'agent')?.count ?? 0,
    maintainer: dashboard.buckets.find(bucket => bucket.lane === 'maintainer')?.count ?? 0,
    bounty:     dashboard.buckets.find(bucket => bucket.lane === 'bounty')?.count ?? 0,
    clarify:    dashboard.buckets.find(bucket => bucket.lane === 'clarify')?.count ?? 0,
  };
  const avgConf = Math.round(ISSUES.reduce((s, i) => s + i.confidence, 0) / ISSUES.length);
  const selectedDetail = dashboard.issueDetails.find(issue => issue.number === selected.number) ?? dashboard.selectedIssue;

  function startRouting() {
    setRoutedIds(new Set());
    setRouting(true);
    const maxDelay = Math.max(...ISSUES.map(i => i.routeDelay));
    ISSUES.forEach((issue) => {
      setTimeout(() => setRoutedIds(prev => new Set([...prev, issue.number])), issue.routeDelay + 500);
    });
    setTimeout(() => setRouting(false), maxDelay + 700);
  }

  const visible = ISSUES
    .filter(i => filter === 'all' || i.lane === filter)
    .filter(i => i.title.toLowerCase().includes(query.toLowerCase()));

  const cfg = LANE[selected.lane];

  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => {
      setStepIndex((value) => {
        if (value >= DEMO_STEPS.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [playing, stepIndex]);

  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white overflow-x-hidden">
      <SiteNav />

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-20 right-0 w-[600px] h-[600px] bg-emerald-500/5 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-violet-500/4 blur-[100px] rounded-full" />
      </div>

      {/* Page header */}
      <div className="relative pt-24 pb-0 px-6">
        <div className="mx-auto max-w-6xl">
          {/* Eyebrow + action row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-6 pb-5 border-b border-white/6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80 mb-2">Interactive demo</p>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                {dashboard.repository.fullName}
              </h1>
              <p className="mt-1 text-zinc-600 text-sm font-mono">
                github.com · {dashboard.repository.openIssueCount} open issues · {dashboard.repository.dataMode} mode
              </p>
            </motion.div>

            <motion.button
              onClick={startRouting}
              disabled={routing}
              whileHover={{ scale: routing ? 1 : 1.02 }}
              whileTap={{ scale: routing ? 1 : 0.98 }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 shrink-0 mt-1',
                routing
                  ? 'border-white/8 bg-white/3 text-zinc-600 cursor-default'
                  : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/50',
              )}>
              <RefreshCw className={cn('size-4', routing && 'animate-spin')} />
              {routing ? 'Routing…' : 'Re-route all issues'}
            </motion.button>
          </div>

          <div className="flex flex-col gap-3 py-4 border-b border-white/6">
            <DataSourceBanner repository={dashboard.repository} compact />
            <div className="flex flex-wrap items-center gap-2">
              {DEMO_STEPS.map((step, index) => (
                <button
                  key={step.key}
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-colors',
                    index === stepIndex
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/8 text-zinc-600 hover:text-zinc-400',
                  )}>
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPlaying((value) => !value)}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 text-[11px] text-emerald-300 hover:bg-emerald-500/12">
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                className="px-3 py-1.5 rounded-lg border border-white/8 text-[11px] text-zinc-500 hover:text-zinc-300">
                Back
              </button>
              <button
                onClick={() => setStepIndex((value) => Math.min(DEMO_STEPS.length - 1, value + 1))}
                className="px-3 py-1.5 rounded-lg border border-white/8 text-[11px] text-zinc-500 hover:text-zinc-300">
                Next
              </button>
              <button
                onClick={() => {
                  setStepIndex(0);
                  setPlaying(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-white/8 text-[11px] text-zinc-500 hover:text-zinc-300">
                Restart
              </button>
              <span className="px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 text-[11px] text-amber-300">
                Fallback safe: GitHub, CLōD, Greptile, Clustly.
              </span>
            </div>
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/6 border-b border-white/6">
            {[
              { label: 'Total issues', value: String(dashboard.repository.openIssueCount), sub: 'open' },
              { label: 'Routed', value: '100%', sub: 'classified' },
              { label: 'Avg confidence', value: `${avgConf}%`, sub: 'CLOD score' },
              { label: 'Demo step', value: String(stepIndex + 1), sub: DEMO_STEPS[stepIndex].label },
            ].map((s) => (
              <div key={s.label} className="bg-[#030509] px-5 py-4">
                <div className="font-heading font-bold text-2xl text-white">{s.value}</div>
                <div className="text-[11px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Lane filter pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-wrap gap-2 py-4 border-b border-white/6">
            {(Object.entries(counts) as [Lane, number][]).map(([lane, count]) => {
              const c = LANE[lane];
              const active = filter === lane;
              return (
                <button key={lane}
                  onClick={() => setFilter(active ? 'all' : lane)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all duration-200 cursor-pointer',
                    active
                      ? `${c.border} ${c.bg} ${c.color}`
                      : 'border-white/8 bg-transparent text-zinc-500 hover:border-white/15 hover:text-zinc-300',
                  )}>
                  <span className={cn('size-1.5 rounded-full', active ? c.bar : 'bg-zinc-700')} />
                  <span className="tabular-nums font-bold">{count}</span>
                  {c.label}
                </button>
              );
            })}
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}
                className="px-3 py-1.5 rounded-full text-xs text-zinc-600 hover:text-zinc-400 border border-white/6 transition-colors cursor-pointer">
                Clear
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Two-column interface */}
      <div className="relative mx-auto max-w-6xl px-6 py-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">

          {/* Issue list */}
          <div className="min-w-0">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-600 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter issues…"
                className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all duration-200"
              />
            </div>

            <div className="space-y-1">
              <AnimatePresence initial={false}>
                {visible.map((issue) => {
                  const isRouted   = routedIds.has(issue.number);
                  const isSelected = selected.number === issue.number;
                  const c          = LANE[issue.lane];
                  return (
                    <motion.button
                      key={issue.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setSelected(issue)}
                      className={cn(
                        'group w-full flex items-center gap-0 rounded-xl border text-left transition-all duration-200 overflow-hidden cursor-pointer',
                        isSelected
                          ? `${c.border} ${c.bg}`
                          : 'border-white/5 bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/10',
                      )}>
                      {/* Lane color bar */}
                      <div className={cn(
                        'self-stretch w-[3px] shrink-0 transition-opacity duration-200',
                        c.bar,
                        isSelected ? 'opacity-80' : 'opacity-0 group-hover:opacity-30',
                      )} />

                      <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3">
                        <span className="font-mono text-[11px] text-zinc-600 w-9 shrink-0">#{issue.number}</span>
                        <span className="flex-1 text-sm text-zinc-200 truncate">{issue.title}</span>
                        {isRouted ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
                            className={cn('shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded border', c.badge)}>
                            {issue.lane.toUpperCase()}
                          </motion.span>
                        ) : (
                          <span className="shrink-0 flex items-center gap-1.5 text-[10px] text-zinc-700 font-mono">
                            <span className="size-1.5 rounded-full bg-zinc-700 animate-pulse" />
                            analyzing
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              {visible.length === 0 && (
                <p className="py-12 text-center text-sm text-zinc-600">No issues match.</p>
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'rounded-2xl border p-5 shadow-2xl',
                  cfg.border, cfg.bg, cfg.glow,
                )}>

                {/* Issue title */}
                <div className="flex items-start gap-2.5 pb-4 mb-4 border-b border-white/8">
                  <span className="font-mono text-[11px] text-zinc-600 mt-px shrink-0">#{selected.number}</span>
                  <h3 className="font-heading font-semibold text-[14px] text-white leading-snug">{selected.title}</h3>
                </div>

                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-4">CLOD Analysis</p>

                {/* Confidence ring + route badge */}
                <div className="flex items-center gap-4 mb-4">
                  <ConfidenceRing value={selected.confidence} lane={selected.lane} />
                  <div className="flex-1">
                    <div className="text-[11px] text-zinc-600 mb-1.5">Route decision</div>
                    <span className={cn('inline-block text-xs font-bold font-mono px-2.5 py-1 rounded-full border', cfg.badge)}>
                      {selected.lane.toUpperCase()}
                    </span>
                    <div className="text-[11px] text-zinc-600 mt-2">Confidence score</div>
                  </div>
                </div>

                {/* Risk + Complexity */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className={cn('rounded-xl border p-3', cfg.border, 'bg-[#030509]/60')}>
                    <div className="text-[10px] text-zinc-600 mb-1">Risk</div>
                    <div className={cn('font-semibold text-sm capitalize', RISK_CLR[selected.risk])}>{selected.risk}</div>
                  </div>
                  <div className={cn('rounded-xl border p-3', cfg.border, 'bg-[#030509]/60')}>
                    <div className="text-[10px] text-zinc-600 mb-1">Complexity</div>
                    <div className={cn('font-semibold text-sm capitalize', COMPLEX_CLR[selected.complexity])}>{selected.complexity}</div>
                  </div>
                </div>

                {/* Rationale */}
                <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                  <div className="text-[10px] text-zinc-600 mb-1.5">Rationale</div>
                  <p className="text-[13px] text-zinc-400 leading-relaxed">{selected.rationale}</p>
                </div>

                {selectedDetail && (
                  <>
                    <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-[10px] text-zinc-600">CLōD model run</div>
                        <span className="text-[10px] font-mono text-emerald-400">{selectedDetail.modelRun.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                        <div>
                          <span className="block text-zinc-600">Model</span>
                          <span className="text-zinc-300">{selectedDetail.modelRun.model}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-600">Tier</span>
                          <span className="text-zinc-300">{selectedDetail.modelRun.tier}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-600">Cost</span>
                          <span className="text-zinc-300">
                            {selectedDetail.modelRun.estimatedCostCents == null ? 'unknown' : `${selectedDetail.modelRun.estimatedCostCents}c`}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zinc-600">Latency</span>
                          <span className="text-zinc-300">{selectedDetail.modelRun.latencyMs}ms</span>
                        </div>
                      </div>
                      <p className="mt-2 text-[12px] text-zinc-500 leading-relaxed">{selectedDetail.modelRun.selectionReason}</p>
                    </div>

                    <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                      <div className="text-[10px] text-zinc-600 mb-2">Trace ledger</div>
                      <div className="space-y-2">
                        {selectedDetail.trace.slice(0, 5).map((event) => (
                          <div key={event.id} className="border-l border-white/10 pl-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-300">{event.title}</span>
                              <span className="text-[9px] font-mono text-zinc-600">{event.status}</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 leading-relaxed">{event.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                      <div className="text-[10px] text-zinc-600 mb-2">Retry / reroute history</div>
                      <div className="space-y-2">
                        {selectedDetail.routeHistory.slice(0, 3).map((attempt) => (
                          <div key={attempt.id} className="border-l border-white/10 pl-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-300">
                                {attempt.fromRoute ? `${ROUTE_LABEL[attempt.fromRoute]} -> ${ROUTE_LABEL[attempt.toRoute]}` : ROUTE_LABEL[attempt.toRoute]}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-600">{attempt.status}</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 leading-relaxed">{attempt.reason}</p>
                          </div>
                        ))}
                        {selectedDetail.routeHistory.length === 0 && <p className="text-[11px] text-zinc-600">No retry history recorded.</p>}
                      </div>
                    </div>

                    {selectedDetail.pullRequest && (
                      <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-[10px] text-zinc-600">GitHub PR</div>
                          <span className="text-[10px] font-mono text-zinc-500">{selectedDetail.pullRequest.status}</span>
                        </div>
                        <p className="text-[12px] text-zinc-300 mb-1">#{selectedDetail.pullRequest.number} {selectedDetail.pullRequest.title}</p>
                        <p className="text-[11px] text-zinc-600">{selectedDetail.pullRequest.branchName} · {selectedDetail.pullRequest.headSha ?? 'head sha unknown'}</p>
                      </div>
                    )}

                    <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-[10px] text-zinc-600">Work order</div>
                        <span className="text-[10px] font-mono text-zinc-500">{selectedDetail.workOrder.status}</span>
                      </div>
                      <p className="text-[12px] text-zinc-300 mb-2">{selectedDetail.workOrder.title}</p>
                      <div className="space-y-1">
                        {selectedDetail.workOrder.acceptanceChecks.slice(0, 2).map((check) => (
                          <p key={check} className="text-[11px] text-zinc-600 leading-relaxed">- {check}</p>
                        ))}
                      </div>
                    </div>

                    {selectedDetail.verification && (
                      <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-[10px] text-zinc-600">Greptile criteria</div>
                          <span className={cn('text-[10px] font-mono', selectedDetail.verification.status === 'passed' ? 'text-emerald-400' : 'text-amber-400')}>
                            {selectedDetail.verification.status}
                          </span>
                        </div>
                        <p className="text-[12px] text-zinc-500 leading-relaxed">{selectedDetail.verification.summary}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
                          <span>Findings: {selectedDetail.verification.blockingFindingsCount}</span>
                          <span>Stale: {selectedDetail.verification.isStale ? 'yes' : 'no'}</span>
                        </div>
                      </div>
                    )}

                    {selectedDetail.route === 'bounty-worthy' ? (
                      <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-[10px] text-zinc-600">Clustly payout gate</div>
                          <span className={cn('text-[10px] font-mono', selectedDetail.payoutGate.canRelease ? 'text-emerald-400' : 'text-amber-400')}>
                            {selectedDetail.payoutGate.canRelease ? 'release-ready' : 'blocked'}
                          </span>
                        </div>
                        {selectedDetail.bounty && (
                          <p className="text-[12px] text-zinc-300">
                            {selectedDetail.bounty.currency} {formatInteger(selectedDetail.bounty.amountCents / 100)} · {selectedDetail.bounty.status}
                          </p>
                        )}
                        {selectedDetail.paymentArtifact ? (
                          <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed">
                            Artifact {selectedDetail.paymentArtifact.status}: {selectedDetail.paymentArtifact.releaseReason}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed">{selectedDetail.payoutGate.reasons[0]}</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/8 bg-[#030509]/60 p-3.5 mb-4">
                        <div className="text-[10px] text-zinc-600 mb-1">Payout</div>
                        <p className="text-[11px] text-zinc-600">No payout artifact: this issue is not in the bounty lane.</p>
                      </div>
                    )}

                    <div className={cn('rounded-xl border p-3.5 mb-4', cfg.border, 'bg-[#030509]/60')}>
                      <div className="text-[10px] text-zinc-600 mb-2">Context-lift eval</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="block text-[10px] text-zinc-600">Sample</span>
                          <span className="font-mono text-xs text-zinc-300">{dashboard.evaluation.sampleSize}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-zinc-600">Baseline</span>
                          <span className="font-mono text-xs text-zinc-300">{Math.round(dashboard.evaluation.baselinePassRate * 100)}%</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-zinc-600">Context</span>
                          <span className="font-mono text-xs text-emerald-400">{Math.round(dashboard.evaluation.enrichedContextPassRate * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Action */}
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link href="/connect"
                    className={cn(
                      'flex items-center justify-between w-full px-4 py-3 rounded-xl border font-medium text-sm transition-all duration-200 hover:bg-white/[0.06] cursor-pointer',
                      cfg.border, cfg.bg, cfg.color,
                    )}>
                    {cfg.action}
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* CTA */}
      <div className="relative border-t border-white/6 py-24 px-6 text-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full" />
        </div>
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-600 mb-4">Ready?</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white mb-3">Route your own backlog</h2>
          <p className="text-zinc-500 mb-8 max-w-sm mx-auto text-[15px]">
            Takes 30 seconds. Every open issue classified with confidence scores and rationale.
          </p>
          <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <Link href="/connect"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200">
              <GitMerge className="size-4" />
              Connect repo
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
