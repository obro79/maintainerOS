'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RotateCcw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANE_CONFIG, lane, laneOf } from '@/lib/design-system';
import { LaneBadge } from '@/components/ui/lane-badge';
import { ConfidenceRing } from '@/components/ui/confidence-ring';
import { DataSourceBanner } from '@/components/maintaineros/data-source-banner';
import { IssueWorkflowWorkbench } from '@/components/maintaineros/issue-workflow-workbench';
import { useWorkflowIssueUrl } from '@/components/maintaineros/use-workflow-issue-url';
import type { DashboardViewModel } from '@/lib/maintaineros/types';

type LaneFilter = 'all' | 'agent' | 'review' | 'bounty' | 'clarify';

function normalizeInitialLane(raw?: string | null): LaneFilter {
  const v = raw?.toLowerCase();
  if (v === 'agent' || v === 'review' || v === 'bounty' || v === 'clarify') return v;
  return 'all';
}

const ISSUES = [
  { id: 112, title: 'Redis queue drains silently on OOM restart',           lane: 'bounty',  conf: 94, risk: 'High', age: '2d',  labels: ['infra','bug']             },
  { id: 111, title: 'Add cursor-based pagination to /issues endpoint',      lane: 'agent',   conf: 89, risk: 'Low',  age: '2d',  labels: ['api','enhancement']       },
  { id: 110, title: 'Dark mode flicker on first paint (SSR hydration)',     lane: 'agent',   conf: 92, risk: 'Low',  age: '3d',  labels: ['ui','bug']                },
  { id: 108, title: 'Token refresh race in parallel SSO flows',             lane: 'agent',   conf: 91, risk: 'Med',  age: '3d',  labels: ['auth','bug']              },
  { id: 107, title: 'Expose per-repo webhook retry config in API',          lane: 'review',  conf: 85, risk: 'Med',  age: '4d',  labels: ['api']                     },
  { id: 105, title: 'Memory leak in background task worker (bun)',          lane: 'agent',   conf: 87, risk: 'High', age: '4d',  labels: ['performance','bug']       },
  { id: 103, title: 'Schema migration helper for v1→v2 event format',      lane: 'bounty',  conf: 90, risk: 'Med',  age: '5d',  labels: ['migrations']              },
  { id: 101, title: 'Greptile verification timeout on large diffs',         lane: 'review',  conf: 78, risk: 'Low',  age: '5d',  labels: ['integrations']            },
  { id: 99,  title: 'Clarify expected retry semantics on 408',              lane: 'clarify', conf: 61, risk: 'Low',  age: '5d',  labels: ['api','question']          },
  { id: 97,  title: 'Add E2E test suite for auth flow (Playwright)',        lane: 'agent',   conf: 93, risk: 'Low',  age: '6d',  labels: ['testing']                 },
  { id: 95,  title: 'Rate-limit by org on classification endpoint',        lane: 'review',  conf: 82, risk: 'Med',  age: '7d',  labels: ['security','api']          },
  { id: 93,  title: 'Docs: CLOD confidence threshold explanation missing', lane: 'agent',   conf: 96, risk: 'Low',  age: '8d',  labels: ['docs']                    },
  { id: 91,  title: 'Backlog sync breaks when repo renamed',               lane: 'agent',   conf: 88, risk: 'Med',  age: '9d',  labels: ['bug']                     },
  { id: 87,  title: 'Upgrade path for v1→v2 webhook format',              lane: 'review',  conf: 88, risk: 'High', age: '10d', labels: ['breaking-change']         },
  { id: 84,  title: 'Clustly budget alert when 80% consumed',             lane: 'bounty',  conf: 85, risk: 'Low',  age: '11d', labels: ['integrations']            },
];

type LaneLimitedKey = Exclude<LaneFilter, 'all'>;

export function RepoBacklog({ dashboard, initialLane }: { dashboard?: DashboardViewModel; initialLane?: string | null }) {
  const [filter, setFilter] = useState<LaneFilter>(() => normalizeInitialLane(initialLane));
  const [search, setSearch] = useState('');
  const [overriding, setOverriding] = useState<number | null>(null);
  const { workflowIssueNumber, openWorkflowIssue, closeWorkflowIssue } = useWorkflowIssueUrl();
  const issues = dashboard
    ? dashboard.issues.map(issue => ({
        id: issue.number,
        title: issue.title,
        lane: issue.lane === 'maintainer' ? 'review' : issue.lane,
        conf: issue.confidence,
        risk: issue.risk === 'medium' ? 'Med' : issue.risk[0].toUpperCase() + issue.risk.slice(1),
        age: dashboard.repository.dataMode === 'live' ? 'live' : 'fixture',
        labels: [],
      }))
    : ISSUES;
  const laneCounts: { key: LaneLimitedKey; count: number }[] = (
    ['agent', 'review', 'bounty', 'clarify'] as LaneLimitedKey[]
  ).map(k => ({
    key: k,
    count: issues.filter(i => i.lane === k).length,
  }));

  const visible = issues.filter((issue) => {
    if (filter !== 'all' && issue.lane !== filter) return false;
    if (search && !issue.title.toLowerCase().includes(search.toLowerCase()) && !String(issue.id).includes(search)) return false;
    return true;
  });
  const traceBase = dashboard ? `/${dashboard.repository.owner}/${dashboard.repository.name}` : null;
  const selectedWorkflowIssue = workflowIssueNumber
    ? dashboard?.issueDetails.find((issue) => issue.number === workflowIssueNumber) ?? null
    : null;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#F9F7F7]/40 mb-1">Backlog</p>
        <h1 className="font-heading text-3xl font-semibold text-white tracking-tight">All Issues</h1>
        <p className="text-sm text-[#F9F7F7]/56 mt-1">{issues.length} open · {issues.filter(i => i.conf >= 85).length} high-confidence routes</p>
      </motion.div>

      {dashboard && <DataSourceBanner repository={dashboard.repository} />}

      {/* Lane count pills — mini summary bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="flex items-center gap-2 flex-wrap">
        {laneCounts.map(({ key, count }) => {
          const cfg = LANE_CONFIG[key];
          return (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150',
                filter === key
                  ? [cfg.tw.bgFaint, cfg.tw.text, cfg.tw.border]
                  : 'border-[#F9F7F7]/12 text-[#F9F7F7]/56 hover:text-[#F9F7F7]/76 hover:border-[#F9F7F7]/20 bg-transparent',
              )}>
              <div className={cn('size-1.5 rounded-full', cfg.tw.bg)} />
              <span>{cfg.label}</span>
              <span className={cn('font-sans font-bold [font-variant-numeric:tabular-nums]', filter === key ? cfg.tw.text : 'text-[#F9F7F7]/40')}>{count}</span>
            </button>
          );
        })}

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#F9F7F7]/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search issues"
            placeholder="Search issues…"
            className="pl-8 pr-4 py-1.5 text-sm bg-[#F9F7F7]/[0.035] border border-[#F9F7F7]/12 rounded-lg text-white placeholder:text-[#F9F7F7]/28 focus:outline-none focus:border-[#F9F7F7]/24 w-48 transition-colors"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-lg border border-[#F9F7F7]/12 overflow-hidden bg-[#0A111A]">

        {/* Header */}
        <div className="flex items-center px-5 py-2.5 border-b border-[#F9F7F7]/10 bg-[#0A111A]/60">
          <div className="w-4 shrink-0" />
          <div className="flex-1 pl-3 text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28">Issue</div>
          <div className="w-20 text-center text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28">Lane</div>
          <div className="w-12 text-center text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28">Conf</div>
          <div className="w-12 text-center text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28">Risk</div>
          <div className="w-10 text-center text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28">Age</div>
          <div className="w-24 text-right text-[10px] font-sans uppercase tracking-wider text-[#F9F7F7]/28 pr-1">Action</div>
        </div>

        <AnimatePresence mode="popLayout">
          {visible.map((issue) => {
            const l = lane(issue.lane);
            return (
              <motion.div
                key={issue.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role={dashboard ? 'button' : undefined}
                tabIndex={dashboard ? 0 : undefined}
                onClick={() => { if (dashboard) openWorkflowIssue(issue.id); }}
                onKeyDown={(event) => {
                  if (!dashboard) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openWorkflowIssue(issue.id);
                  }
                }}
                className={cn('flex items-center border-b border-[#F9F7F7]/8 last:border-b-0 hover:bg-[#F9F7F7]/[0.025] transition-colors group', dashboard && 'cursor-pointer')}
              >
                {/* Lane bar */}
                <div className={cn('w-1 self-stretch shrink-0', l.tw.bg)} />

                {/* Title */}
                <div className="flex-1 min-w-0 pl-4 py-3 pr-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-sans text-[10px] text-[#F9F7F7]/40 [font-variant-numeric:tabular-nums]">#{issue.id}</span>
                    {issue.labels.slice(0, 2).map(lbl => (
                      <span key={lbl} className="text-[9px] px-1.5 py-0.5 rounded bg-[#F9F7F7]/[0.07] text-[#F9F7F7]/40 border border-[#F9F7F7]/10">{lbl}</span>
                    ))}
                  </div>
                  <p className="text-xs text-[#F9F7F7]/88 truncate">{issue.title}</p>
                </div>

                {/* Lane badge */}
                <div className="w-20 flex justify-center">
                  <LaneBadge value={issue.lane} />
                </div>

                {/* Confidence ring */}
                <div className="w-12 flex justify-center">
                  <ConfidenceRing value={issue.conf} size={26} />
                </div>

                {/* Risk */}
                <div className="w-12 text-center">
                  <span className={cn('text-[10px] font-sans',
                    issue.risk === 'High' ? 'text-[#F9F7F7]' :
                    issue.risk === 'Med'  ? 'text-[#DBE2EF]' : 'text-[#F9F7F7]/40'
                  )}>{issue.risk}</span>
                </div>

                {/* Age */}
                <div className="w-10 text-center text-[10px] text-[#F9F7F7]/40 font-sans [font-variant-numeric:tabular-nums]">{issue.age}</div>

                {/* Actions */}
                <div className="w-24 flex items-center justify-end gap-1 pr-3">
                  {overriding === issue.id ? (
                    <div className="flex items-center gap-1">
                      {(['agent','review','bounty','clarify'] as const)
                        .filter(k => k !== laneOf(issue.lane))
                        .map(k => {
                          const c = LANE_CONFIG[k];
                          return (
                            <button key={k} onClick={(event) => { event.stopPropagation(); setOverriding(null); }}
                              className={cn('text-[8px] font-sans font-bold px-1 py-0.5 rounded border transition-colors',
                                c.tw.bgMuted, c.tw.text, c.tw.borderMuted, 'hover:opacity-80')}>
                              {c.label[0]}
                            </button>
                          );
                        })}
                      <button onClick={(event) => { event.stopPropagation(); setOverriding(null); }} className="text-[#F9F7F7]/28 hover:text-[#F9F7F7]/56 ml-0.5">
                        <RotateCcw className="size-2.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={(event) => { event.stopPropagation(); setOverriding(issue.id); }}
                        className="text-[10px] text-[#F9F7F7]/40 hover:text-[#F9F7F7]/76 px-1.5 py-1 rounded hover:bg-[#F9F7F7]/7 transition-colors">
                        Override
                      </button>
                      {traceBase ? (
                        <Link href={`${traceBase}/issues/${issue.id}/trace`} aria-label={`Open trace for issue ${issue.id}`} onClick={(event) => event.stopPropagation()}>
                          <ExternalLink className="size-3 text-[#F9F7F7]/28 hover:text-[#F9F7F7]/56 cursor-pointer transition-colors" />
                        </Link>
                      ) : (
                        <ExternalLink className="size-3 text-[#F9F7F7]/28 hover:text-[#F9F7F7]/56 cursor-pointer transition-colors" />
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible.length === 0 && (
          <div className="py-14 text-center">
            <p className="text-[#F9F7F7]/40 text-sm">No issues match this filter.</p>
          </div>
        )}
      </motion.div>
      {dashboard && (
        <IssueWorkflowWorkbench
          org={dashboard.repository.owner}
          repo={dashboard.repository.name}
          issueNumber={workflowIssueNumber}
          initialIssue={selectedWorkflowIssue}
          onClose={closeWorkflowIssue}
        />
      )}
    </div>
  );
}
