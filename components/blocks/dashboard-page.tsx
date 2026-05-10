'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ElementType } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  GitPullRequest,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { SiteNav } from '@/components/layout/site-nav';
import { LANE_CONFIG } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface GhLabel {
  name: string;
  color: string;
}

interface DashboardIssue {
  number: number;
  title: string;
  labels: GhLabel[];
  user: string;
  daysAgo: number;
}

interface Repo {
  id: string;
  label: string;
}

type LaneKey = 'agent' | 'review' | 'bounty' | 'clarify';

interface ActivityEntry {
  id: string;
  Icon: ElementType;
  color: string;
  label: string;
  time: string;
}

const LANES: LaneKey[] = ['agent', 'review', 'bounty', 'clarify'];

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
} satisfies Record<LaneKey, { title: string; copy: string; icon: ElementType }>;

const FALLBACK_REPOS: Repo[] = [
  { id: 'acme/frontend', label: 'acme/frontend' },
  { id: 'acme/api', label: 'acme/api' },
];

const FALLBACK_ISSUES: Record<LaneKey, DashboardIssue[]> = {
  agent: [
    {
      number: 111,
      title: 'Add cursor-based pagination to /issues endpoint',
      labels: [
        { name: 'enhancement', color: 'ECD852' },
        { name: 'api', color: 'FBF7DA' },
      ],
      user: 'johndoe',
      daysAgo: 2,
    },
  ],
  review: [
    {
      number: 87,
      title: 'Upgrade path for v1 to v2 webhook format',
      labels: [{ name: 'breaking-change', color: '842E65' }],
      user: 'maintainer',
      daysAgo: 10,
    },
  ],
  bounty: [
    {
      number: 112,
      title: 'Redis queue drains silently on OOM restart',
      labels: [
        { name: 'infra', color: 'ECD852' },
        { name: 'bug', color: '842E65' },
      ],
      user: 'reporter',
      daysAgo: 2,
    },
  ],
  clarify: [
    {
      number: 99,
      title: 'Clarify expected retry semantics on 408',
      labels: [{ name: 'question', color: 'FBF7DA' }],
      user: 'contributor',
      daysAgo: 5,
    },
  ],
};

function labelStyle(label: GhLabel) {
  const hex = label.color.replace('#', '').padEnd(6, '0');
  return {
    borderColor: `#${hex}55`,
    backgroundColor: `#${hex}1f`,
    color: `#${hex}`,
  };
}

function LabelBadge({ label }: { label: GhLabel }) {
  return (
    <span
      style={labelStyle(label)}
      className="rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none"
    >
      {label.name}
    </span>
  );
}

function IssueRow({
  issue,
  laneKey,
  selected,
  dispatching,
  onSelect,
}: {
  issue: DashboardIssue;
  laneKey: LaneKey;
  selected: boolean;
  dispatching: boolean;
  onSelect: () => void;
}) {
  const cfg = LANE_CONFIG[laneKey];
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group w-full rounded-md border px-3 py-3 text-left transition-colors',
        selected
          ? `${cfg.tw.border} ${cfg.tw.bgFaint}`
          : 'border-[#F9F7F7]/10 bg-black/18 hover:border-[#F9F7F7]/22 hover:bg-[#F9F7F7]/5',
        dispatching && 'ring-1 ring-[#3F72AF]/35',
      )}
    >
      <div className="flex items-start gap-3">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#F9F7F7]/32 transition-colors group-hover:text-[#F9F7F7]/70" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#F9F7F7]/86">{issue.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {issue.labels.map((label) => (
              <LabelBadge key={`${issue.number}-${label.name}`} label={label} />
            ))}
          </div>
        </div>
        <span className="font-mono text-[11px] text-[#F9F7F7]/34">#{issue.number}</span>
      </div>
    </button>
  );
}

function LaneColumn({
  laneKey,
  issues,
  loading,
  selectedNumber,
  dispatchingIssues,
  onSelect,
}: {
  laneKey: LaneKey;
  issues: DashboardIssue[];
  loading: boolean;
  selectedNumber: number | null;
  dispatchingIssues: Set<number>;
  onSelect: (issue: DashboardIssue) => void;
}) {
  const cfg = LANE_CONFIG[laneKey];
  const meta = LANE_META[laneKey];
  const Icon = meta.icon;

  return (
    <section className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="border-b border-[#F9F7F7]/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn('size-4', cfg.tw.text)} />
            <h2 className="text-sm font-semibold text-white">{meta.title}</h2>
          </div>
          <span className={cn('font-mono text-xs', cfg.tw.text)}>{issues.length}</span>
        </div>
        <p className="mt-1 text-xs text-[#F9F7F7]/45">{meta.copy}</p>
      </div>

      <div className="space-y-2 p-3">
        {loading ? (
          <div className="rounded-md border border-[#F9F7F7]/10 bg-black/15 px-3 py-8 text-center text-xs text-[#F9F7F7]/35">
            Loading issues
          </div>
        ) : issues.length === 0 ? (
          <div className="rounded-md border border-[#F9F7F7]/10 bg-black/15 px-3 py-8 text-center text-xs text-[#F9F7F7]/35">
            No issues
          </div>
        ) : (
          issues.map((issue) => (
            <IssueRow
              key={issue.number}
              issue={issue}
              laneKey={laneKey}
              selected={selectedNumber === issue.number}
              dispatching={dispatchingIssues.has(issue.number)}
              onSelect={() => onSelect(issue)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DetailPanel({ selected }: { selected: { issue: DashboardIssue; laneKey: LaneKey } | null }) {
  if (!selected) {
    return (
      <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A] p-5">
        <p className="text-sm text-[#F9F7F7]/42">Select an issue to inspect its route proof.</p>
      </div>
    );
  }

  const cfg = LANE_CONFIG[selected.laneKey];
  const meta = LANE_META[selected.laneKey];
  const steps = [
    'Imported from GitHub',
    'Context bundle attached',
    `${meta.title} lane selected`,
    selected.laneKey === 'agent' ? 'Work order ready' : selected.laneKey === 'bounty' ? 'Bounty package ready' : 'Maintainer action queued',
  ];

  return (
    <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="border-b border-[#F9F7F7]/10 px-5 py-4">
        <p className="font-mono text-xs text-[#F9F7F7]/38">#{selected.issue.number}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-white">{selected.issue.title}</h3>
      </div>
      <div className="space-y-2 p-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-md border border-[#F9F7F7]/10 bg-black/15 px-3 py-2.5">
            <span className={cn('size-1.5 rounded-full', index === steps.length - 1 ? cfg.tw.bg : 'bg-[#F9F7F7]/35')} />
            <span className="text-sm text-[#F9F7F7]/78">{step}</span>
            {index < steps.length - 1 ? (
              <CheckCircle2 className="ml-auto size-4 text-[#F9F7F7]/32" />
            ) : (
              <ShieldCheck className={cn('ml-auto size-4', cfg.tw.text)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityEntry[] }) {
  return (
    <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
      <div className="border-b border-[#F9F7F7]/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
      </div>
      <div className="divide-y divide-[#F9F7F7]/8">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-[#F9F7F7]/35">No activity yet</p>
          ) : (
            items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#F9F7F7]/10 bg-black/18">
                  <item.Icon className={cn('size-3.5', item.color)} />
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-[#F9F7F7]/72">{item.label}</p>
                <span className="shrink-0 text-[11px] text-[#F9F7F7]/32">{item.time}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [repos, setRepos] = useState<Repo[]>(FALLBACK_REPOS);
  const [selectedRepo, setSelectedRepo] = useState(FALLBACK_REPOS[0].id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [columnIssues, setColumnIssues] = useState<Record<LaneKey, DashboardIssue[]>>(FALLBACK_ISSUES);
  const [loadingCols, setLoadingCols] = useState<Set<LaneKey>>(new Set());
  const [dispatchingIssues, setDispatchingIssues] = useState<Set<number>>(new Set());
  const [selectedIssue, setSelectedIssue] = useState<{ issue: DashboardIssue; laneKey: LaneKey } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id'>) => {
    setActivity((prev) => [
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ...prev.slice(0, 24),
    ]);
  }, []);

  useEffect(() => {
    fetch('/api/dashboard/repos')
      .then((response) => response.json())
      .then((data: Repo[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setRepos(data);
          setSelectedRepo(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    setLoadingCols(new Set(LANES));
    LANES.forEach((laneKey) => {
      fetch(`/api/dashboard/issues?lane=${laneKey}&repo=${encodeURIComponent(selectedRepo)}`)
        .then((response) => response.json())
        .then((data: DashboardIssue[]) => {
          if (Array.isArray(data)) {
            setColumnIssues((current) => ({ ...current, [laneKey]: data }));
          }
        })
        .catch(() => {
          setColumnIssues((current) => ({ ...current, [laneKey]: FALLBACK_ISSUES[laneKey] }));
        })
        .finally(() => {
          setLoadingCols((current) => {
            const next = new Set(current);
            next.delete(laneKey);
            return next;
          });
        });
    });
  }, [selectedRepo]);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [dropdownOpen]);

  const selectedLabel = repos.find((repo) => repo.id === selectedRepo)?.label ?? selectedRepo;
  const totalIssues = LANES.reduce((sum, laneKey) => sum + (columnIssues[laneKey]?.length ?? 0), 0);
  const isLoading = loadingCols.size > 0;

  const startDispatch = useCallback(() => {
    if (dispatching) return;
    setDispatching(true);

    const allIssues = LANES.flatMap((laneKey) =>
      (columnIssues[laneKey] ?? []).map((issue) => ({ issue, laneKey })),
    );

    allIssues.forEach(({ issue, laneKey }, index) => {
      window.setTimeout(() => {
        const cfg = LANE_CONFIG[laneKey];
        setDispatchingIssues((current) => new Set([...current, issue.number]));
        addActivity({
          Icon: Zap,
          color: cfg.tw.text,
          label: `#${issue.number} routed to ${LANE_META[laneKey].title}`,
          time: 'just now',
        });
        window.setTimeout(() => {
          setDispatchingIssues((current) => {
            const next = new Set(current);
            next.delete(issue.number);
            return next;
          });
        }, 700);
      }, index * 420);
    });

    window.setTimeout(() => {
      setDispatching(false);
      if (allIssues[0]) {
        setSelectedIssue(allIssues[0]);
        addActivity({
          Icon: GitPullRequest,
          color: 'text-[#3F72AF]',
          label: `Work order opened for #${allIssues[0].issue.number}`,
          time: 'just now',
        });
      }
    }, allIssues.length * 420 + 300);
  }, [addActivity, columnIssues, dispatching]);

  return (
    <div className="min-h-screen bg-[#05070A] font-sans text-white">
      <SiteNav />

      <main className="px-5 pb-12 pt-28">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-col gap-5 border-b border-[#F9F7F7]/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#3F72AF]">Dashboard</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">{selectedLabel}</h1>
              <p className="mt-2 text-sm text-[#F9F7F7]/48">github.com - {totalIssues} open issues - live router</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={startDispatch}
                disabled={dispatching}
                className={cn(
                  'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors',
                  dispatching
                    ? 'border-[#F9F7F7]/10 bg-[#F9F7F7]/5 text-[#F9F7F7]/35'
                    : 'border-[#3F72AF]/30 bg-[#3F72AF]/10 text-[#3F72AF] hover:bg-[#3F72AF]/16',
                )}
              >
                <RefreshCw className={cn('size-4', dispatching && 'animate-spin')} />
                {dispatching ? 'Dispatching' : 'Dispatch issues'}
              </button>

              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen((open) => !open)}
                  className="inline-flex h-10 min-w-[180px] items-center justify-between gap-3 rounded-md border border-[#F9F7F7]/12 bg-black/20 px-3 text-sm text-[#F9F7F7]/84 transition-colors hover:border-[#F9F7F7]/24"
                >
                  {selectedLabel}
                  <ChevronDown className={cn('size-4 text-[#F9F7F7]/45 transition-transform', dropdownOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 top-full z-20 mt-2 min-w-full overflow-hidden rounded-md border border-[#F9F7F7]/12 bg-[#0A111A] shadow-2xl shadow-black/40"
                    >
                      {repos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => {
                            setSelectedRepo(repo.id);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            'block w-full px-3 py-2.5 text-left text-sm transition-colors',
                            repo.id === selectedRepo
                              ? 'bg-[#3F72AF]/10 text-[#3F72AF]'
                              : 'text-[#F9F7F7]/68 hover:bg-[#F9F7F7]/7 hover:text-white',
                          )}
                        >
                          {repo.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-[#F9F7F7]/10 sm:grid-cols-4">
            {[
              { label: 'Total issues', value: isLoading ? '--' : String(totalIssues) },
              { label: 'Routed', value: '100%' },
              { label: 'Avg confidence', value: '87%' },
              { label: 'Repos', value: String(repos.length) },
            ].map((stat) => (
              <div key={stat.label} className="border-r border-[#F9F7F7]/10 px-4 py-5 last:border-r-0">
                <div className="text-2xl font-semibold tracking-tight text-white">{stat.value}</div>
                <div className="mt-1 text-xs text-[#F9F7F7]/42">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="grid gap-4 md:grid-cols-2">
              {LANES.map((laneKey) => (
                <LaneColumn
                  key={laneKey}
                  laneKey={laneKey}
                  issues={columnIssues[laneKey] ?? []}
                  loading={loadingCols.has(laneKey)}
                  selectedNumber={selectedIssue?.issue.number ?? null}
                  dispatchingIssues={dispatchingIssues}
                  onSelect={(issue) => setSelectedIssue({ issue, laneKey })}
                />
              ))}
            </div>

            <div className="space-y-4">
              <DetailPanel selected={selectedIssue} />
              <ActivityFeed items={activity} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
