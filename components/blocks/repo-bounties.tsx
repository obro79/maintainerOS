'use client';

import { motion } from 'framer-motion';
import { Award, CheckCircle2, Clock, ExternalLink, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';
import { EvidenceBadge } from '@/components/maintaineros/evidence-badge';
import { ProviderStatusBar } from '@/components/maintaineros/provider-status-bar';
import type { ClustlyBountyListItemViewModel, ProviderStatusViewModel } from '@/lib/maintaineros/types';

const ACTIVE_BOUNTIES = [
  { id: 112, title: 'Redis queue drains silently on OOM restart',     reward: 350, status: 'Open',        posted: '2d ago',  claimants: 2, complexity: 'High'   },
  { id: 103, title: 'Schema migration helper for v1→v2 event format', reward: 500, status: 'In Progress', posted: '5d ago',  claimants: 1, complexity: 'High'   },
  { id: 84,  title: 'Clustly budget alert when 80% consumed',        reward: 150, status: 'Open',        posted: '11d ago', claimants: 0, complexity: 'Low'    },
  { id: 77,  title: 'Implement schema migrations adapter + tests',    reward: 400, status: 'In Review',   posted: '14d ago', claimants: 3, complexity: 'High'   },
];

const PAID_BOUNTIES = [
  { id: 61, title: 'Fix memory leak in Bun worker pool',             reward: 300, paidTo: 'gh/alicecodes', merged: '3d ago'  },
  { id: 55, title: 'Add Greptile verification integration layer',    reward: 600, paidTo: 'gh/devxpro',    merged: '8d ago'  },
  { id: 48, title: 'Cursor-based pagination on /events endpoint',    reward: 200, paidTo: 'gh/wren42',     merged: '12d ago' },
  { id: 44, title: 'Slack notification webhook adapter',             reward: 250, paidTo: 'gh/alicecodes', merged: '18d ago' },
];

const STATUS_STYLES: Record<string, string> = {
  'Open':        'bg-emerald-950 text-emerald-400 border-emerald-800',
  'In Progress': 'bg-amber-950 text-amber-400 border-amber-800',
  'In Review':   'bg-violet-950 text-violet-400 border-violet-800',
};

export function RepoBounties({ bounties, providerStatuses }: { bounties?: ClustlyBountyListItemViewModel[]; providerStatuses?: ProviderStatusViewModel[] }) {
  const repositoryBacked = bounties !== undefined;
  const hasRepositoryBounties = Boolean(bounties?.length);
  const totalActive = repositoryBacked ? bounties.reduce((s, b) => s + b.bounty.amountCents / 100, 0) : ACTIVE_BOUNTIES.reduce((s, b) => s + b.reward, 0);
  const totalPaid   = repositoryBacked ? bounties.filter((b) => b.task?.status === 'released' || b.task?.status === 'paid').reduce((s, b) => s + b.bounty.amountCents / 100, 0) : PAID_BOUNTIES.reduce((s, b) => s + b.reward, 0);
  const budgetUsed  = Math.round((totalActive / (totalActive + 2400)) * 100);

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-1">Clustly Integration</p>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight">Bounties</h1>
        <p className="text-sm text-zinc-500 mt-1">Community-funded via Clustly · payouts on Greptile-verified merges only</p>
      </motion.div>

      {providerStatuses && <ProviderStatusBar providers={providerStatuses} />}

      {/* Clustly budget card — hero */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="relative rounded-xl border border-violet-500/25 bg-[#080d14] overflow-hidden p-5">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-violet-400 to-transparent" />
        <div className="absolute top-4 right-4 opacity-10">
          <Zap className="size-16 text-violet-400" />
        </div>

        <div className="flex items-start gap-6">
          <div>
            <div className="text-xs text-zinc-500 mb-1 font-medium">Clustly Budget</div>
            <div className="font-heading font-bold text-4xl text-white [font-variant-numeric:tabular-nums] tracking-tight">$2,400</div>
            <div className="text-xs text-zinc-600 mt-1">remaining · ${totalActive} active</div>
          </div>

          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1.5">
              <span>Budget used</span>
              <span className="font-mono [font-variant-numeric:tabular-nums]">{budgetUsed}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                initial={{ width: 0 }}
                animate={{ width: `${budgetUsed}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="size-1.5 rounded-full bg-violet-500" />
              <span className="text-[10px] text-zinc-600">Alert at 80% · ${Math.round(2400 * 0.2)} remaining before alert</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Award}        label="Active rewards"    value={`$${totalActive}`} sub={`${repositoryBacked ? bounties.length : ACTIVE_BOUNTIES.length} open`}    accent="violet"  index={0} />
        <StatCard icon={CheckCircle2} label="Total paid out"    value={`$${totalPaid}`}   sub="all time"                             accent="emerald" index={1} />
        <StatCard icon={Clock}        label="Avg time to close" value="6.2d"               sub="across paid bounties"                accent="amber"   index={2} />
        <StatCard icon={TrendingUp}   label="Claimants today"  value="6"                  sub="across all open bounties"            accent="violet"  index={3} />
      </div>

      {repositoryBacked ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
            <Award className="size-3.5 text-violet-400" />
            <span className="font-heading font-semibold text-sm text-white">Clustly Tasks</span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">{bounties.length} TASKS</span>
          </div>
          {hasRepositoryBounties ? (
          <div className="divide-y divide-white/5">
            {bounties.map((item) => (
              <div key={item.issueNumber} className="flex items-stretch hover:bg-white/[0.02] transition-colors">
                <div className={cn('w-1 shrink-0', item.gate.canRelease ? 'bg-emerald-500' : 'bg-violet-500')} />
                <div className="flex-1 min-w-0 px-4 py-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-zinc-600">#{item.issueNumber}</span>
                    {item.task?.sourceState && <EvidenceBadge sourceState={item.task.sourceState} />}
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border border-violet-800 bg-violet-950 text-violet-400">
                      {(item.task?.status ?? item.bounty.status).toUpperCase()}
                    </span>
                    <span className="text-[10px] text-zinc-600">{item.task?.claimerKind ?? 'unclaimed'}</span>
                    <span className="text-[10px] text-zinc-700 ml-auto">{item.task?.fundingMode ?? 'manual-browser'}</span>
                  </div>
                  <p className="text-sm text-zinc-200 truncate">{item.issueTitle}</p>
                  <p className={item.gate.canRelease ? 'mt-1 text-xs text-emerald-300' : 'mt-1 text-xs text-amber-300'}>
                    {item.gate.canRelease ? 'Release allowed' : `Blocked: ${item.gate.reasons[0] ?? 'waiting on gate'}`}
                  </p>
                  {!item.gate.canRelease && item.gate.reasonCodes[0] && (
                    <p className="mt-1 font-mono text-[10px] uppercase text-zinc-700">{item.gate.reasonCodes[0]}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 pr-4 shrink-0">
                  <div className="text-right">
                    <div className="font-heading font-bold text-xl text-violet-400">${Math.round(item.bounty.amountCents / 100)}</div>
                    <div className="text-[9px] text-zinc-700 uppercase font-mono">{item.task?.taskId ?? 'draft'}</div>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    {item.task?.taskUrl && <a className="text-blue-300" href={item.task.taskUrl}>Task</a>}
                    <a className="text-zinc-400" href={item.detailUrl}>Issue</a>
                    <a className="text-zinc-400" href={item.traceUrl}>Trace</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="p-6">
              <p className="text-sm font-semibold text-white">No Clustly tasks yet</p>
              <p className="mt-2 text-sm text-zinc-500">Bounty-worthy issues will appear here after MaintainerOS creates a work order and posts or drafts a Clustly task.</p>
            </div>
          )}
        </motion.div>
      ) : (
      /* Active bounties */
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
          <Award className="size-3.5 text-violet-400" />
          <span className="font-heading font-semibold text-sm text-white">Active Bounties</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">{ACTIVE_BOUNTIES.length} OPEN</span>
        </div>
        <div className="divide-y divide-white/5">
          {ACTIVE_BOUNTIES.map((b) => (
            <div key={b.id} className="flex items-stretch hover:bg-white/[0.02] transition-colors group cursor-pointer">
              {/* Bounty lane bar */}
              <div className="w-1 shrink-0 bg-violet-500" />
              <div className="flex-1 min-w-0 px-4 py-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-zinc-600 [font-variant-numeric:tabular-nums]">#{b.id}</span>
                  <span className={cn('text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border', STATUS_STYLES[b.status])}>
                    {b.status.toUpperCase()}
                  </span>
                  {b.claimants > 0 && (
                    <span className="text-[10px] text-zinc-600">{b.claimants} claimant{b.claimants !== 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[10px] text-zinc-700 ml-auto">{b.posted}</span>
                </div>
                <p className="text-sm text-zinc-200 truncate">{b.title}</p>
              </div>
              <div className="flex items-center gap-2 pr-4 shrink-0">
                <div className="text-right">
                  <div className="font-heading font-bold text-xl text-violet-400 [font-variant-numeric:tabular-nums]">${b.reward}</div>
                  <div className="text-[9px] text-zinc-700 uppercase font-mono">{b.complexity}</div>
                </div>
                <ExternalLink className="size-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
      )}

      {/* Payout history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
        className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-emerald-400" />
          <span className="font-heading font-semibold text-sm text-white">Payout History</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">${totalPaid} TOTAL</span>
        </div>
        <div className="divide-y divide-white/5">
          {PAID_BOUNTIES.map((b) => (
            <div key={b.id} className="flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="w-1 self-stretch shrink-0 bg-emerald-500/40" />
              <div className="flex-1 min-w-0 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[10px] text-zinc-600">#{b.id}</span>
                  <span className="text-[9px] font-mono text-emerald-600 tracking-wide">MERGED · VERIFIED</span>
                </div>
                <p className="text-sm text-zinc-400 truncate">{b.title}</p>
              </div>
              <div className="shrink-0 text-right pr-4">
                <div className="font-heading font-bold text-base text-emerald-400 [font-variant-numeric:tabular-nums]">+${b.reward}</div>
                <div className="text-[10px] text-zinc-600 font-mono">{b.paidTo}</div>
              </div>
              <div className="text-[10px] text-zinc-700 font-mono pr-4 [font-variant-numeric:tabular-nums]">{b.merged}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
