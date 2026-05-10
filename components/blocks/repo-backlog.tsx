'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import { useState } from 'react';
import { Bot, ChevronRight, Coins, ExternalLink, HelpCircle, Search, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANE_CONFIG, lane } from '@/lib/design-system';
import { LaneBadge } from '@/components/ui/lane-badge';
import { DataSourceBanner } from '@/components/maintaineros/data-source-banner';
import { IssueWorkflowWorkbench } from '@/components/maintaineros/issue-workflow-workbench';
import { useWorkflowIssueUrl } from '@/components/maintaineros/use-workflow-issue-url';
import type { DashboardViewModel } from '@/lib/maintaineros/types';

type LaneFilter = 'all' | 'agent' | 'review' | 'bounty' | 'clarify';
type LaneLimitedKey = Exclude<LaneFilter, 'all'>;
type BacklogIssue = {
  id: number;
  title: string;
  lane: LaneLimitedKey;
  conf: number;
  risk: string;
  age: string;
  labels: string[];
};

function normalizeInitialLane(raw?: string | null): LaneFilter {
  const v = raw?.toLowerCase();
  if (v === 'agent' || v === 'review' || v === 'bounty' || v === 'clarify') return v;
  return 'all';
}

function toBacklogLane(raw: DashboardViewModel['issues'][number]['lane']): LaneLimitedKey {
  return raw === 'maintainer' ? 'review' : raw;
}

const ISSUES: BacklogIssue[] = [
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

const LANE_ORDER = ['agent', 'review', 'bounty', 'clarify'] as const;

const LANE_META = {
  agent: {
    title: 'AI',
    copy: 'Safe for autonomous work',
    icon: Bot,
  },
  review: {
    title: 'DEV',
    copy: 'Needs maintainer judgment',
    icon: UserCheck,
  },
  bounty: {
    title: 'CLUSTLY',
    copy: 'Ready to fund externally',
    icon: Coins,
  },
  clarify: {
    title: 'CLARIFY',
    copy: 'Needs a better report',
    icon: HelpCircle,
  },
} satisfies Record<LaneLimitedKey, { title: string; copy: string; icon: ElementType }>;

export function RepoBacklog({ dashboard, initialLane }: { dashboard?: DashboardViewModel; initialLane?: string | null }) {
  const [filter, setFilter] = useState<LaneFilter>(() => normalizeInitialLane(initialLane));
  const [search, setSearch] = useState('');
  const { workflowIssueNumber, openWorkflowIssue, closeWorkflowIssue } = useWorkflowIssueUrl();
  const issues: BacklogIssue[] = dashboard
    ? dashboard.issues.map(issue => ({
        id: issue.number,
        title: issue.title,
        lane: toBacklogLane(issue.lane),
        conf: issue.confidence,
        risk: issue.risk === 'medium' ? 'Med' : issue.risk[0].toUpperCase() + issue.risk.slice(1),
        age: dashboard.repository.dataMode === 'live' ? 'live' : 'fixture',
        labels: [],
      }))
    : ISSUES;
  const laneCounts: { key: LaneLimitedKey; count: number }[] = (
    LANE_ORDER
  ).map(k => ({
    key: k,
    count: issues.filter(i => i.lane === k).length,
  }));

  const visible = issues.filter((issue) => {
    if (filter !== 'all' && issue.lane !== filter) return false;
    if (search && !issue.title.toLowerCase().includes(search.toLowerCase()) && !String(issue.id).includes(search)) return false;
    return true;
  });
  const displayedLanes = filter === 'all' ? LANE_ORDER : ([filter] as LaneLimitedKey[]);
  const traceBase = dashboard ? `/${dashboard.repository.owner}/${dashboard.repository.name}` : null;
  const selectedWorkflowIssue = workflowIssueNumber
    ? dashboard?.issueDetails.find((issue) => issue.number === workflowIssueNumber) ?? null
    : null;

  return (
    <div className="w-full max-w-7xl space-y-6 p-5 sm:p-6 lg:p-8">
      {/* Page header */}
      <div>
        <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-[#F9F7F7]/40 mb-1">Backlog</p>
        <h1 className="font-heading text-3xl font-semibold text-white tracking-tight">All Issues</h1>
        <p className="font-sans text-sm text-[#F9F7F7]/56 mt-1">{issues.length} open · {issues.filter(i => i.conf >= 85).length} high-confidence routes</p>
      </div>

      {dashboard && <DataSourceBanner repository={dashboard.repository} />}

      {/* Lane count pills — mini summary bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-sans text-xs font-medium transition-all duration-150',
            filter === 'all'
              ? 'border-[#F9F7F7]/20 bg-[#F9F7F7]/7 text-white'
              : 'border-[#F9F7F7]/12 bg-transparent text-[#F9F7F7]/56 hover:border-[#F9F7F7]/20 hover:text-[#F9F7F7]/76',
          )}
        >
          All
          <span className="font-sans font-bold [font-variant-numeric:tabular-nums]">{issues.length}</span>
        </button>
        {laneCounts.map(({ key, count }) => {
          const cfg = LANE_CONFIG[key];
          return (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-sans text-xs font-medium transition-all duration-150',
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
            className="pl-8 pr-4 py-1.5 font-sans text-sm bg-[#F9F7F7]/[0.035] border border-[#F9F7F7]/12 rounded-lg text-white placeholder:text-[#F9F7F7]/28 focus:outline-none focus:border-[#F9F7F7]/24 w-48 transition-colors"
          />
        </div>
      </div>

      {/* Kanban board */}
      <div
        className={cn(
          'grid gap-4',
          displayedLanes.length === 1 ? 'lg:grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-4',
        )}
      >
        {displayedLanes.map((laneKey) => (
          <LaneColumn
            key={laneKey}
            laneKey={laneKey}
            issues={visible.filter((issue) => issue.lane === laneKey)}
            traceBase={traceBase}
            onIssueOpen={dashboard ? openWorkflowIssue : undefined}
          />
        ))}
      </div>
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

function LaneColumn({
  laneKey,
  issues,
  traceBase,
  onIssueOpen,
}: {
  laneKey: LaneLimitedKey;
  issues: BacklogIssue[];
  traceBase: string | null;
  onIssueOpen?: (issueNumber: number) => void;
}) {
  const cfg = LANE_CONFIG[laneKey];
  const meta = LANE_META[laneKey];
  const Icon = meta.icon;

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="border-b border-[#F9F7F7]/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={cn('size-4 shrink-0', cfg.tw.text)} />
            <h2 className="truncate font-sans text-sm font-semibold text-white">{meta.title}</h2>
          </div>
          <span className={cn('text-xs font-semibold [font-variant-numeric:tabular-nums]', cfg.tw.text)}>
            {issues.length}
          </span>
        </div>
        <p className="mt-1 font-sans text-xs text-[#F9F7F7]/45">{meta.copy}</p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {issues.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#F9F7F7]/12 bg-black/15 px-3 py-8 text-center font-sans text-xs text-[#F9F7F7]/35">
            No issues
          </div>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} traceBase={traceBase} onIssueOpen={onIssueOpen} />
          ))
        )}
      </div>
    </section>
  );
}

function IssueCard({ issue, traceBase, onIssueOpen }: { issue: BacklogIssue; traceBase: string | null; onIssueOpen?: (issueNumber: number) => void }) {
  const l = lane(issue.lane);
  const detailHref = traceBase ? `${traceBase}/issues/${issue.id}` : '#';
  const traceHref = traceBase ? `${traceBase}/issues/${issue.id}/trace` : '#';
  const interactive = Boolean(onIssueOpen);

  return (
    <article
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={() => onIssueOpen?.(issue.id)}
      onKeyDown={(event) => {
        if (!onIssueOpen) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onIssueOpen(issue.id);
        }
      }}
      className={cn(
        'group overflow-hidden rounded-md border bg-black/18 transition-colors hover:bg-[#F9F7F7]/[0.035]',
        l.tw.borderMuted,
        interactive && 'cursor-pointer',
      )}
    >
      <div className={cn('h-[3px]', l.tw.bg)} />
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[#F9F7F7]/40 [font-variant-numeric:tabular-nums]">#{issue.id}</span>
              <LaneBadge value={issue.lane} />
            </div>
            <Link href={detailHref} className="block" onClick={(event) => event.stopPropagation()}>
              <h3 className="line-clamp-3 font-sans text-sm font-semibold leading-snug text-[#F9F7F7]/90 transition-colors group-hover:text-white">
                {issue.title}
              </h3>
            </Link>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#F9F7F7]/30 transition-colors group-hover:text-[#F9F7F7]/70" />
        </div>

        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.slice(0, 3).map((label) => (
              <span key={label} className="rounded border border-[#F9F7F7]/10 bg-[#F9F7F7]/[0.04] px-1.5 py-0.5 font-sans text-[10px] text-[#F9F7F7]/45">
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-sans text-[10px] text-[#F9F7F7]/40">
            <span>Confidence</span>
            <span className={cn('font-semibold [font-variant-numeric:tabular-nums]', issue.conf >= 85 ? 'text-[#3F72AF]' : issue.conf >= 70 ? 'text-[#DBE2EF]' : 'text-[#F9F7F7]/70')}>
              {issue.conf}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F9F7F7]/7">
            <div
              className={cn('h-full rounded-full', l.tw.bg)}
              style={{ width: `${issue.conf}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#F9F7F7]/8 pt-2 font-sans text-[10px] text-[#F9F7F7]/40">
          <span>{issue.risk} risk</span>
          <span className="size-1 rounded-full bg-[#F9F7F7]/20" />
          <span>{issue.age}</span>
          <Link
            href={traceHref}
            aria-label={`Open trace for issue ${issue.id}`}
            onClick={(event) => event.stopPropagation()}
            className="ml-auto rounded border border-[#F9F7F7]/10 p-1 text-[#F9F7F7]/35 transition-colors hover:border-[#F9F7F7]/20 hover:text-[#F9F7F7]/70"
          >
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
