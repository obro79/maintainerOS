'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, GitBranch, GitPullRequest, CheckCircle2, MessageSquare, RotateCcw, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lane } from '@/lib/design-system';
import { LaneBadge } from '@/components/ui/lane-badge';
import { ProviderStatusBar } from '@/components/maintaineros/provider-status-bar';
import type { ProviderStatusViewModel } from '@/lib/maintaineros/types';

interface AuditStep {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
  detail: string;
  ts: string;
  highlight?: boolean;
}

interface AuditIssue {
  id: number;
  title: string;
  laneKey: string;
  conf: number;
  finalState: 'resolved' | 'active' | 'pending';
  steps: AuditStep[];
}

const ISSUES: AuditIssue[] = [
  {
    id: 108, title: 'Token refresh race in parallel SSO flows', laneKey: 'agent', conf: 91, finalState: 'resolved',
    steps: [
      { icon: Zap,           color: 'text-zinc-400',    bgColor: 'bg-zinc-800',    label: 'Ingested',             detail: 'Issue opened · added to CLOD queue',                                              ts: '72h ago' },
      { icon: Zap,           color: 'text-emerald-400', bgColor: 'bg-emerald-950', label: 'CLOD classification',  detail: 'Route → Agent · Conf 91% · "Reproducible, scoped to auth module, no API contract impact"', ts: '71h ago', highlight: true },
      { icon: GitBranch,     color: 'text-blue-400',    bgColor: 'bg-blue-950',    label: 'Branch created',       detail: 'codex/fix-sso-token-race via Codex',                                               ts: '70h ago' },
      { icon: GitPullRequest, color: 'text-violet-400', bgColor: 'bg-violet-950',  label: 'PR opened',            detail: '#204 — Fix token refresh mutex in SSO handler',                                    ts: '45h ago' },
      { icon: Shield,        color: 'text-blue-400',    bgColor: 'bg-blue-950',    label: 'Greptile verified',    detail: 'PR covers all paths described in issue. No spec gaps detected.',                    ts: '12h ago', highlight: true },
      { icon: CheckCircle2,  color: 'text-emerald-400', bgColor: 'bg-emerald-950', label: 'Merged',               detail: 'Squash merged to main · issue closed',                                             ts: '4h ago'  },
    ],
  },
  {
    id: 112, title: 'Redis queue drains silently on OOM restart', laneKey: 'bounty', conf: 94, finalState: 'active',
    steps: [
      { icon: Zap,          color: 'text-zinc-400',    bgColor: 'bg-zinc-800',    label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                                        ts: '50h ago' },
      { icon: Zap,          color: 'text-violet-400',  bgColor: 'bg-violet-950',  label: 'CLOD classification', detail: 'Route → Bounty · Conf 94% · "Infrastructure-level, broader expertise recommended"',         ts: '49h ago', highlight: true },
      { icon: CheckCircle2, color: 'text-violet-400',  bgColor: 'bg-violet-950',  label: 'Bounty posted',       detail: '$350 reward posted to Clustly · 2 claimants active',                                       ts: '48h ago' },
    ],
  },
  {
    id: 99, title: 'Clarify expected retry semantics on 408', laneKey: 'clarify', conf: 61, finalState: 'pending',
    steps: [
      { icon: Zap,           color: 'text-zinc-400',   bgColor: 'bg-zinc-800',   label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                               ts: '5d ago' },
      { icon: Zap,           color: 'text-amber-400',  bgColor: 'bg-amber-950',  label: 'CLOD classification', detail: 'Route → Clarify · Conf 61% · "Spec ambiguous — retry semantics undefined for 408 vs 429"', ts: '5d ago', highlight: true },
      { icon: MessageSquare, color: 'text-zinc-400',   bgColor: 'bg-zinc-800',   label: 'Clarification sent',  detail: 'Automated comment posted to issue author',                                         ts: '5d ago'  },
      { icon: RotateCcw,     color: 'text-amber-400',  bgColor: 'bg-amber-950',  label: 'Awaiting response',   detail: 'No reply yet · auto-escalation queued at 7d',                                     ts: 'now'     },
    ],
  },
  {
    id: 87, title: 'Upgrade path for v1→v2 webhook format', laneKey: 'review', conf: 88, finalState: 'active',
    steps: [
      { icon: Zap,       color: 'text-zinc-400',   bgColor: 'bg-zinc-800',   label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                                  ts: '10d ago' },
      { icon: Zap,       color: 'text-amber-400',  bgColor: 'bg-amber-950',  label: 'CLOD classification', detail: 'Route → Review · Conf 88% · "Breaking change potential, requires maintainer sign-off"', ts: '10d ago', highlight: true },
      { icon: RotateCcw, color: 'text-violet-400', bgColor: 'bg-violet-950', label: 'Maintainer override', detail: 'Re-routed Review → Bounty by @owenfisher',                                            ts: '2h ago'  },
      { icon: Zap,       color: 'text-violet-400', bgColor: 'bg-violet-950', label: 'Bounty pending',      detail: 'Awaiting Clustly posting',                                                           ts: 'now'     },
    ],
  },
];

const FINAL_STATE_STYLES = {
  resolved: 'bg-emerald-950/50 text-emerald-500 border-emerald-900',
  active:   'bg-amber-950/50 text-amber-500 border-amber-900',
  pending:  'bg-zinc-800/50 text-zinc-500 border-zinc-700',
};

export function RepoAudit({ providerStatuses }: { providerStatuses?: ProviderStatusViewModel[] }) {
  const [expanded, setExpanded] = useState<number | null>(ISSUES[0].id);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-1">Proof Chain</p>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Audit Trail</h1>
        <p className="text-sm text-zinc-500 mt-1">Every classification decision, override, and verification step — immutably logged.</p>
      </motion.div>

      {providerStatuses && <ProviderStatusBar providers={providerStatuses} />}

      {/* Issue rows */}
      <div className="space-y-3">
        {ISSUES.map((issue, i) => {
          const l = lane(issue.laneKey);
          const isOpen = expanded === issue.id;

          return (
            <motion.div
              key={issue.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                'rounded-xl border overflow-hidden transition-all duration-200',
                isOpen ? 'border-white/12 bg-[#080d14]' : 'border-white/8 bg-[#080d14]/60',
              )}>

              {/* Collapsed header */}
              <button
                onClick={() => setExpanded(isOpen ? null : issue.id)}
                className="w-full flex items-stretch text-left cursor-pointer hover:bg-white/[0.02] transition-colors">
                {/* Lane bar */}
                <div className={cn('w-1 shrink-0', l.tw.bg)} />

                <div className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-zinc-600 [font-variant-numeric:tabular-nums]">#{issue.id}</span>
                      <LaneBadge value={issue.laneKey} />
                      <span className={cn(
                        'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                        FINAL_STATE_STYLES[issue.finalState],
                      )}>
                        {issue.finalState.toUpperCase()}
                      </span>
                      <span className={cn('text-[10px] font-mono font-bold ml-auto [font-variant-numeric:tabular-nums]',
                        issue.conf >= 85 ? 'text-emerald-400' : 'text-amber-400')}>
                        {issue.conf}% conf
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200 truncate">{issue.title}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-700 font-mono">{issue.steps.length} steps</span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="size-4 text-zinc-600" />
                    </motion.div>
                  </div>
                </div>
              </button>

              {/* Expanded timeline */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-t border-white/6">
                    <div className="px-6 py-5 space-y-0">
                      {issue.steps.map((step, j) => {
                        const isLast = j === issue.steps.length - 1;
                        return (
                          <div key={j} className="flex gap-4">
                            {/* Timeline connector */}
                            <div className="flex flex-col items-center w-6 shrink-0">
                              <div className={cn(
                                'size-6 rounded-full flex items-center justify-center border shrink-0 z-10',
                                step.bgColor,
                                step.highlight ? 'border-current/30' : 'border-white/8',
                              )}>
                                <step.icon className={cn('size-3', step.color)} />
                              </div>
                              {!isLast && (
                                <div className="w-px flex-1 bg-white/6 mt-1 mb-0" style={{ minHeight: '20px' }} />
                              )}
                            </div>

                            {/* Step content */}
                            <div className={cn('pb-4 flex-1 min-w-0', isLast && 'pb-0')}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn('text-xs font-semibold', step.highlight ? step.color : 'text-zinc-300')}>
                                  {step.label}
                                </span>
                                <span className="text-[10px] text-zinc-700 font-mono [font-variant-numeric:tabular-nums]">{step.ts}</span>
                              </div>
                              {step.highlight ? (
                                <div className={cn('rounded-lg border px-3 py-2 mt-1.5 font-mono text-[11px] leading-relaxed',
                                  step.bgColor, step.color, 'border-current/20')}>
                                  {step.detail}
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-500 leading-relaxed">{step.detail}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
