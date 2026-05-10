'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, GitPullRequest, Award, MessageSquare, RefreshCw, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANE_CONFIG, lane } from '@/lib/design-system';
import { StatCard } from '@/components/ui/stat-card';
import { DonutChart } from '@/components/ui/donut-chart';
import { LaneBadge } from '@/components/ui/lane-badge';
import { DataSourceBanner } from '@/components/maintaineros/data-source-banner';
import { ProviderStatusBar } from '@/components/maintaineros/provider-status-bar';
import type { DashboardViewModel } from '@/lib/maintaineros/types';

const LANE_DIST = [
  { key: 'agent',   count: 38, pct: 49 },
  { key: 'review',  count: 21, pct: 27 },
  { key: 'bounty',  count: 12, pct: 15 },
  { key: 'clarify', count:  7, pct:  9 },
] as const;

const ATTENTION = [
  { id: '#112', title: 'Redis queue drains silently on OOM restart',     lane: 'bounty',  conf: 94, age: '2d' },
  { id: '#108', title: 'Token refresh race in parallel SSO flows',       lane: 'agent',   conf: 91, age: '3d' },
  { id: '#99',  title: 'Clarify expected retry semantics on 408',        lane: 'clarify', conf: 61, age: '5d' },
  { id: '#87',  title: 'Upgrade path for v1→v2 webhook format',         lane: 'review',  conf: 88, age: '6d' },
];

const ACTIVITY = [
  { icon: CheckCircle2,  color: 'text-emerald-400', label: '#108 routed → Agent lane',              time: '4m ago'  },
  { icon: Award,         color: 'text-violet-400',  label: '#112 bounty posted · $350 via Clustly', time: '18m ago' },
  { icon: GitPullRequest, color: 'text-blue-400',   label: '#103 PR verified by Greptile · merged',  time: '1h ago'  },
  { icon: RefreshCw,     color: 'text-amber-400',   label: '#87 re-routed Review → Bounty',          time: '2h ago'  },
  { icon: MessageSquare, color: 'text-zinc-400',    label: '#99 clarification requested from author', time: '3h ago' },
  { icon: Zap,           color: 'text-emerald-400', label: 'Batch classify · 14 issues processed',   time: '4h ago'  },
];

interface RepoDashboardProps {
  org: string;
  repo: string;
  dashboard?: DashboardViewModel;
}

export function RepoDashboard({ org, repo, dashboard }: RepoDashboardProps) {
  const laneDist = dashboard
    ? ([
        { key: 'agent', count: dashboard.buckets.find(bucket => bucket.lane === 'agent')?.count ?? 0 },
        { key: 'review', count: dashboard.buckets.find(bucket => bucket.lane === 'maintainer')?.count ?? 0 },
        { key: 'bounty', count: dashboard.buckets.find(bucket => bucket.lane === 'bounty')?.count ?? 0 },
        { key: 'clarify', count: dashboard.buckets.find(bucket => bucket.lane === 'clarify')?.count ?? 0 },
      ] as const).map(item => ({
        ...item,
        pct: dashboard.issues.length > 0 ? Math.round((item.count / dashboard.issues.length) * 100) : 0,
      }))
    : LANE_DIST;

  const totalIssues = dashboard?.issues.length ?? 78;
  const attention = dashboard
    ? dashboard.issues.slice(0, 4).map(issue => ({
        id: `#${issue.number}`,
        title: issue.title,
        lane: issue.lane === 'maintainer' ? 'review' : issue.lane,
        conf: issue.confidence,
        age: 'live',
      }))
    : ATTENTION;

  const donutSegments = laneDist.map(l => ({
    pct: l.pct,
    color: LANE_CONFIG[l.key].color,
    label: LANE_CONFIG[l.key].label,
    count: l.count,
  }));

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-1">{org}</p>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight">{repo}</h1>
        <p className="text-sm text-zinc-500 mt-1">{dashboard?.repository.latestImportRun ? 'Last imported from GitHub' : 'Last classified 4 minutes ago'} · {dashboard?.repository.openIssueCount ?? 78} open issues</p>
      </motion.div>

      {dashboard && <DataSourceBanner repository={dashboard.repository} />}
      {dashboard?.providerStatuses && <ProviderStatusBar providers={dashboard.providerStatuses} />}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp}    label="Issues routed"     value={String(totalIssues)}   sub={dashboard?.repository.dataMode ?? 'fixture'}         accent="emerald" index={0} />
        <StatCard icon={CheckCircle2} label="Routed this week"  value="91%"  sub="7 pending override"      accent="emerald" index={1} />
        <StatCard icon={Clock}        label="Avg route time"    value="1.4s" sub="per issue"                accent="amber"   index={2} />
        <StatCard icon={AlertTriangle} label="Needs attention"  value="4"    sub="low confidence / stale"  accent="red"     index={3} />
      </div>

      {/* Lane distribution — donut + breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
          <span className="font-heading font-semibold text-sm text-white">Lane Distribution</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">{totalIssues} TOTAL</span>
        </div>

        <div className="flex items-center gap-8 p-6">
          {/* Donut */}
          <DonutChart
            segments={donutSegments}
            centerValue={String(totalIssues)}
            centerLabel="issues"
            size={160}
          />

          {/* Lane breakdown */}
          <div className="flex-1 space-y-4">
            {laneDist.map((l, i) => {
              const cfg = LANE_CONFIG[l.key];
              return (
                <div key={l.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('font-mono font-bold text-xs w-14 shrink-0', cfg.tw.text)}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full', cfg.tw.bg)}
                        initial={{ width: 0 }}
                        animate={{ width: `${l.pct}%` }}
                        transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <span className="text-xs text-white font-heading font-bold [font-variant-numeric:tabular-nums] w-6 text-right">{l.count}</span>
                    <span className="text-[10px] text-zinc-600 [font-variant-numeric:tabular-nums] w-8 text-right">{l.pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Two-column bottom */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-amber-400" />
            <span className="font-heading font-semibold text-sm text-white">Needs Attention</span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">{attention.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {attention.map((item) => {
              const l = lane(item.lane);
              const issueNumber = item.id.replace('#', '');
              return (
                <div key={item.id} className="flex items-stretch hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  {/* Lane bar */}
                  <div className={cn('w-1 shrink-0', l.tw.bg)} />
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-zinc-600">{item.id}</span>
                      <LaneBadge value={item.lane} />
                      <span className="ml-auto text-[10px] text-zinc-600 [font-variant-numeric:tabular-nums]">{item.age}</span>
                    </div>
                    <p className="text-xs text-zinc-300 truncate leading-snug">{item.title}</p>
                  </div>
                  <div className="flex items-center pr-3">
                    <span className={cn(
                      'text-xs font-mono font-bold [font-variant-numeric:tabular-nums]',
                      item.conf >= 85 ? 'text-emerald-400' : item.conf >= 70 ? 'text-amber-400' : 'text-red-400',
                    )}>{item.conf}%</span>
                    <Link
                      className="ml-3 rounded-md border border-white/8 px-1.5 py-1 text-[10px] text-zinc-600 hover:text-zinc-300"
                      href={`/${org}/${repo}/issues/${issueNumber}/trace`}
                    >
                      Trace
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/6">
            <span className="font-heading font-semibold text-sm text-white">Recent Activity</span>
          </div>
          <div className="divide-y divide-white/5">
            {ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="size-6 rounded-full bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className={cn('size-3', item.color)} />
                </div>
                <p className="flex-1 min-w-0 text-xs text-zinc-300 leading-relaxed truncate pt-0.5">{item.label}</p>
                <span className="text-[10px] text-zinc-700 shrink-0 pt-0.5 [font-variant-numeric:tabular-nums]">{item.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
