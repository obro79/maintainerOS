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
      { icon: Zap,           color: 'text-[#F9F7F7]/68',    bgColor: 'bg-[#112D4E]/45',    label: 'Ingested',             detail: 'Issue opened · added to CLOD queue',                                              ts: '72h ago' },
      { icon: Zap,           color: 'text-[#3F72AF]', bgColor: 'bg-[#112D4E]/70', label: 'CLOD classification',  detail: 'Route → Agent · Conf 91% · "Reproducible, scoped to auth module, no API contract impact"', ts: '71h ago', highlight: true },
      { icon: GitBranch,     color: 'text-[#3F72AF]',    bgColor: 'bg-blue-950',    label: 'Branch created',       detail: 'codex/fix-sso-token-race via Codex',                                               ts: '70h ago' },
      { icon: GitPullRequest, color: 'text-[#DBE2EF]', bgColor: 'bg-[#112D4E]',  label: 'PR opened',            detail: '#204 — Fix token refresh mutex in SSO handler',                                    ts: '45h ago' },
      { icon: Shield,        color: 'text-[#3F72AF]',    bgColor: 'bg-blue-950',    label: 'Greptile verified',    detail: 'PR covers all paths described in issue. No spec gaps detected.',                    ts: '12h ago', highlight: true },
      { icon: CheckCircle2,  color: 'text-[#3F72AF]', bgColor: 'bg-[#112D4E]/70', label: 'Merged',               detail: 'Squash merged to main · issue closed',                                             ts: '4h ago'  },
    ],
  },
  {
    id: 112, title: 'Redis queue drains silently on OOM restart', laneKey: 'bounty', conf: 94, finalState: 'active',
    steps: [
      { icon: Zap,          color: 'text-[#F9F7F7]/68',    bgColor: 'bg-[#112D4E]/45',    label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                                        ts: '50h ago' },
      { icon: Zap,          color: 'text-[#DBE2EF]',  bgColor: 'bg-[#112D4E]',  label: 'CLOD classification', detail: 'Route → Bounty · Conf 94% · "Infrastructure-level, broader expertise recommended"',         ts: '49h ago', highlight: true },
      { icon: CheckCircle2, color: 'text-[#DBE2EF]',  bgColor: 'bg-[#112D4E]',  label: 'Bounty posted',       detail: '$350 reward posted to Clustly · 2 claimants active',                                       ts: '48h ago' },
    ],
  },
  {
    id: 99, title: 'Clarify expected retry semantics on 408', laneKey: 'clarify', conf: 61, finalState: 'pending',
    steps: [
      { icon: Zap,           color: 'text-[#F9F7F7]/68',   bgColor: 'bg-[#112D4E]/45',   label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                               ts: '5d ago' },
      { icon: Zap,           color: 'text-[#DBE2EF]',  bgColor: 'bg-[#112D4E]/70',  label: 'CLOD classification', detail: 'Route → Clarify · Conf 61% · "Spec ambiguous — retry semantics undefined for 408 vs 429"', ts: '5d ago', highlight: true },
      { icon: MessageSquare, color: 'text-[#F9F7F7]/68',   bgColor: 'bg-[#112D4E]/45',   label: 'Clarification sent',  detail: 'Automated comment posted to issue author',                                         ts: '5d ago'  },
      { icon: RotateCcw,     color: 'text-[#DBE2EF]',  bgColor: 'bg-[#112D4E]/70',  label: 'Awaiting response',   detail: 'No reply yet · auto-escalation queued at 7d',                                     ts: 'now'     },
    ],
  },
  {
    id: 87, title: 'Upgrade path for v1→v2 webhook format', laneKey: 'review', conf: 88, finalState: 'active',
    steps: [
      { icon: Zap,       color: 'text-[#F9F7F7]/68',   bgColor: 'bg-[#112D4E]/45',   label: 'Ingested',            detail: 'Issue opened · added to CLOD queue',                                                  ts: '10d ago' },
      { icon: Zap,       color: 'text-[#DBE2EF]',  bgColor: 'bg-[#112D4E]/70',  label: 'CLOD classification', detail: 'Route → Review · Conf 88% · "Breaking change potential, requires maintainer sign-off"', ts: '10d ago', highlight: true },
      { icon: RotateCcw, color: 'text-[#DBE2EF]', bgColor: 'bg-[#112D4E]', label: 'Maintainer override', detail: 'Re-routed Review → Bounty by @owenfisher',                                            ts: '2h ago'  },
      { icon: Zap,       color: 'text-[#DBE2EF]', bgColor: 'bg-[#112D4E]', label: 'Bounty pending',      detail: 'Awaiting Clustly posting',                                                           ts: 'now'     },
    ],
  },
];

const FINAL_STATE_STYLES = {
  resolved: 'bg-[#112D4E]/70/50 text-[#3F72AF] border-[#3F72AF]/25',
  active:   'bg-[#112D4E]/70/50 text-[#DBE2EF] border-[#DBE2EF]/25',
  pending:  'bg-[#112D4E]/45/50 text-[#F9F7F7]/56 border-[#F9F7F7]/12',
};

export function RepoAudit({ providerStatuses }: { providerStatuses?: ProviderStatusViewModel[] }) {
  const [expanded, setExpanded] = useState<number | null>(ISSUES[0].id);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#F9F7F7]/40 mb-1">Proof Chain</p>
        <h1 className="font-heading text-3xl font-semibold text-white tracking-tight">Audit Trail</h1>
        <p className="text-sm text-[#F9F7F7]/56 mt-1">Every classification decision, override, and verification step — immutably logged.</p>
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
                'rounded-lg border overflow-hidden transition-all duration-200',
                isOpen ? 'border-[#F9F7F7]/12 bg-[#0A111A]' : 'border-[#F9F7F7]/12 bg-[#0A111A]/60',
              )}>

              {/* Collapsed header */}
              <button
                onClick={() => setExpanded(isOpen ? null : issue.id)}
                className="w-full flex items-stretch text-left cursor-pointer hover:bg-[#F9F7F7]/[0.025] transition-colors">
                {/* Lane bar */}
                <div className={cn('w-1 shrink-0', l.tw.bg)} />

                <div className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-sans text-[10px] text-[#F9F7F7]/40 [font-variant-numeric:tabular-nums]">#{issue.id}</span>
                      <LaneBadge value={issue.laneKey} />
                      <span className={cn(
                        'text-[9px] font-sans px-1.5 py-0.5 rounded border',
                        FINAL_STATE_STYLES[issue.finalState],
                      )}>
                        {issue.finalState.toUpperCase()}
                      </span>
                      <span className={cn('text-[10px] font-sans font-bold ml-auto [font-variant-numeric:tabular-nums]',
                        issue.conf >= 85 ? 'text-[#3F72AF]' : 'text-[#DBE2EF]')}>
                        {issue.conf}% conf
                      </span>
                    </div>
                    <p className="text-sm text-[#F9F7F7]/88 truncate">{issue.title}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#F9F7F7]/28 font-sans">{issue.steps.length} steps</span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="size-4 text-[#F9F7F7]/40" />
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
                    className="overflow-hidden border-t border-[#F9F7F7]/10">
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
                                step.highlight ? 'border-current/30' : 'border-[#F9F7F7]/12',
                              )}>
                                <step.icon className={cn('size-3', step.color)} />
                              </div>
                              {!isLast && (
                                <div className="w-px flex-1 bg-[#F9F7F7]/10 mt-1 mb-0" style={{ minHeight: '20px' }} />
                              )}
                            </div>

                            {/* Step content */}
                            <div className={cn('pb-4 flex-1 min-w-0', isLast && 'pb-0')}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={cn('text-xs font-semibold', step.highlight ? step.color : 'text-[#F9F7F7]/76')}>
                                  {step.label}
                                </span>
                                <span className="text-[10px] text-[#F9F7F7]/28 font-sans [font-variant-numeric:tabular-nums]">{step.ts}</span>
                              </div>
                              {step.highlight ? (
                                <div className={cn('rounded-lg border px-3 py-2 mt-1.5 font-sans text-[11px] leading-relaxed',
                                  step.bgColor, step.color, 'border-current/20')}>
                                  {step.detail}
                                </div>
                              ) : (
                                <p className="text-xs text-[#F9F7F7]/56 leading-relaxed">{step.detail}</p>
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
