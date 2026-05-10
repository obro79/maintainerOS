'use client';

import { useMemo, useState } from 'react';
import { Play, RefreshCw, Search } from 'lucide-react';
import { PageFrame, PageHeader, PageShell, Surface } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import type { DashboardViewModel, DemoLane, IssueCardViewModel } from '@/lib/maintaineros/types';

const LANE_STYLE = {
  agent: { label: 'AI', color: 'text-[#3F72AF]', border: 'border-[#3F72AF]/35', bg: 'bg-[#3F72AF]/10', dot: 'bg-[#3F72AF]' },
  maintainer: { label: 'DEV', color: 'text-[#DBE2EF]', border: 'border-[#112D4E]/45', bg: 'bg-[#112D4E]/16', dot: 'bg-[#112D4E]' },
  bounty: { label: 'CLUSTLY', color: 'text-[#DBE2EF]', border: 'border-[#112D4E]/45', bg: 'bg-[#112D4E]/16', dot: 'bg-[#112D4E]' },
  clarify: { label: 'CLARIFY', color: 'text-[#F9F7F7]/70', border: 'border-[#F9F7F7]/14', bg: 'bg-[#F9F7F7]/7', dot: 'bg-[#F9F7F7]/45' },
} satisfies Record<DemoLane, { label: string; color: string; border: string; bg: string; dot: string }>;

const STEPS = ['Import', 'Route', 'Context', 'Dispatch', 'Verify', 'Release'];

export function DemoPage({ dashboard }: { dashboard: DashboardViewModel }) {
  const [filter, setFilter] = useState<DemoLane | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IssueCardViewModel>(
    dashboard.issues.find((issue) => issue.number === dashboard.selectedIssue.number) ?? dashboard.issues[0],
  );
  const [routing, setRouting] = useState(false);
  const [step, setStep] = useState(1);

  const counts = useMemo(() => {
    return dashboard.issues.reduce<Record<DemoLane, number>>(
      (acc, issue) => {
        acc[issue.lane] += 1;
        return acc;
      },
      { agent: 0, maintainer: 0, bounty: 0, clarify: 0 },
    );
  }, [dashboard.issues]);

  const visibleIssues = dashboard.issues
    .filter((issue) => filter === 'all' || issue.lane === filter)
    .filter((issue) => issue.title.toLowerCase().includes(query.toLowerCase()));

  function startRouting() {
    setRouting(true);
    setStep(1);
    STEPS.forEach((_, index) => {
      window.setTimeout(() => setStep(index + 1), index * 550);
    });
    window.setTimeout(() => setRouting(false), STEPS.length * 550 + 150);
  }

  const selectedStyle = LANE_STYLE[selected.lane];
  const avgConfidence = Math.round(dashboard.issues.reduce((sum, issue) => sum + issue.confidence, 0) / dashboard.issues.length);

  return (
    <PageShell>
      <PageFrame>
        <PageHeader
          eyebrow="Interactive demo"
          title={dashboard.repository.fullName}
          description={`${dashboard.repository.openIssueCount} open issues in ${dashboard.repository.dataMode} mode. Route the backlog, inspect decisions, and follow the proof path.`}
        />

        <div className="mt-6 flex flex-col gap-3 border-b border-[#F9F7F7]/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index + 1)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  step === index + 1
                    ? 'border-[#3F72AF]/35 bg-[#3F72AF]/10 text-[#3F72AF]'
                    : 'border-[#F9F7F7]/10 text-[#F9F7F7]/45 hover:text-white',
                )}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
          <button
            onClick={startRouting}
            disabled={routing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#3F72AF]/35 bg-[#3F72AF]/10 px-4 text-sm font-semibold text-[#3F72AF] transition-colors hover:bg-[#3F72AF]/16 disabled:opacity-60"
          >
            {routing ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
            {routing ? 'Routing' : 'Re-route all issues'}
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-[#F9F7F7]/10 sm:grid-cols-4">
          {[
            ['Total issues', String(dashboard.repository.openIssueCount)],
            ['Routed', '100%'],
            ['Avg confidence', `${avgConfidence}%`],
            ['Current step', `${step}/${STEPS.length}`],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-[#F9F7F7]/10 px-4 py-5 last:border-r-0">
              <div className="text-2xl font-semibold tracking-[-0.03em] text-white">{value}</div>
              <div className="mt-1 text-sm text-[#F9F7F7]/42">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#F9F7F7]/35" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter issues"
                  className="h-10 w-full rounded-md border border-[#F9F7F7]/12 bg-black/24 pl-9 pr-3 text-sm text-white placeholder:text-[#F9F7F7]/35 focus:border-[#3F72AF]/35 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'agent', 'maintainer', 'bounty', 'clarify'] as const).map((lane) => {
                  const active = filter === lane;
                  const style = lane === 'all' ? null : LANE_STYLE[lane];
                  return (
                    <button
                      key={lane}
                      onClick={() => setFilter(lane)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm transition-colors',
                        active ? 'border-[#3F72AF]/35 bg-[#3F72AF]/10 text-[#3F72AF]' : 'border-[#F9F7F7]/10 text-[#F9F7F7]/45 hover:text-white',
                      )}
                    >
                      {lane === 'all' ? 'All' : `${style?.label} ${counts[lane]}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {visibleIssues.map((issue) => {
                const style = LANE_STYLE[issue.lane];
                const active = selected.number === issue.number;
                return (
                  <button
                    key={issue.id}
                    onClick={() => setSelected(issue)}
                    className={cn(
                      'grid w-full gap-3 rounded-lg border px-4 py-3 text-left transition-colors sm:grid-cols-[64px_1fr_90px]',
                      active ? `${style.border} ${style.bg}` : 'border-[#F9F7F7]/10 bg-[#0A111A] hover:border-[#F9F7F7]/22',
                    )}
                  >
                    <span className="text-sm text-[#F9F7F7]/38">#{issue.number}</span>
                    <span className="truncate text-sm text-[#F9F7F7]/82">{issue.title}</span>
                    <span className={cn('text-sm font-semibold', style.color)}>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <Surface className={cn('p-5', selectedStyle.border)}>
              <div className="mb-4 flex items-center justify-between">
                <span className={cn('rounded border px-2 py-1 text-xs font-semibold', selectedStyle.border, selectedStyle.bg, selectedStyle.color)}>
                  {selectedStyle.label}
                </span>
                <span className="text-sm text-[#F9F7F7]/42">#{selected.number}</span>
              </div>
              <h2 className="text-xl font-semibold leading-tight tracking-[-0.03em]">{selected.title}</h2>
              <p className="mt-4 text-sm leading-6 text-[#F9F7F7]/58">{selected.rationale}</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ['Confidence', `${selected.confidence}%`],
                  ['Risk', selected.risk],
                  ['Complexity', selected.complexity],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-[#F9F7F7]/10 bg-black/20 p-3">
                    <div className="text-lg font-semibold text-white">{value}</div>
                    <div className="mt-1 text-xs text-[#F9F7F7]/35">{label}</div>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="p-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em]">Proof path</h2>
              <div className="mt-4 space-y-2">
                {STEPS.map((label, index) => (
                  <div key={label} className="flex items-center gap-3 rounded-md border border-[#F9F7F7]/10 bg-black/20 px-3 py-2">
                    <span className={cn('size-2 rounded-full', index + 1 <= step ? 'bg-[#3F72AF]' : 'bg-[#F9F7F7]/20')} />
                    <span className="text-sm text-[#F9F7F7]/70">{label}</span>
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        </div>
      </PageFrame>
    </PageShell>
  );
}
