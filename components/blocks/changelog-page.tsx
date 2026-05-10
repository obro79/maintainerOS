import { Award, GitMerge, Search, Shield, Sparkles, Zap } from 'lucide-react';
import type { ElementType } from 'react';
import { PageFrame, PageHeader, PageShell, Surface } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';

interface ChangelogEntry {
  version: string;
  date: string;
  tag: 'Major' | 'Release' | 'Beta';
  icon: ElementType;
  tone: string;
  items: { type: 'New' | 'Fixed' | 'Improved'; text: string }[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.9.1',
    date: 'May 7, 2026',
    tag: 'Release',
    icon: Sparkles,
    tone: 'text-[#3F72AF]',
    items: [
      { type: 'New', text: 'Confidence ring animation on issue rows in demo and backlog views' },
      { type: 'New', text: 'Clustly budget alerts at 80% and 95% consumption' },
      { type: 'Fixed', text: 'Lane distribution bar animation no longer re-triggers on scroll' },
      { type: 'Fixed', text: 'Override panel now closes correctly after re-route on mobile' },
    ],
  },
  {
    version: 'v0.9.0',
    date: 'Apr 28, 2026',
    tag: 'Major',
    icon: Zap,
    tone: 'text-[#DBE2EF]',
    items: [
      { type: 'New', text: 'Greptile verification blocks PRs with unresolved spec gaps before merge' },
      { type: 'New', text: 'Per-issue proof chain with full classification and verification log' },
      { type: 'Improved', text: 'Batch classification is faster with parallel CLOD workers' },
      { type: 'Fixed', text: 'Webhook replay no longer double-counts classified issues' },
    ],
  },
  {
    version: 'v0.8.4',
    date: 'Apr 12, 2026',
    tag: 'Release',
    icon: Award,
    tone: 'text-[#DBE2EF]',
    items: [
      { type: 'New', text: 'Clustly bounty integration with suggested rewards' },
      { type: 'New', text: 'Per-repo Clustly budget controls on Team plan' },
      { type: 'Improved', text: 'Bounty payout history shows merge date and verifying contributor' },
    ],
  },
  {
    version: 'v0.8.0',
    date: 'Mar 31, 2026',
    tag: 'Major',
    icon: GitMerge,
    tone: 'text-[#3F72AF]',
    items: [
      { type: 'New', text: 'Four-lane routing system: AI, DEV, CLUSTLY, and CLARIFY' },
      { type: 'New', text: 'CLOD v2 with structured output and confidence scoring' },
      { type: 'Improved', text: 'Issue override history persists across sessions' },
    ],
  },
  {
    version: 'v0.7.2',
    date: 'Mar 10, 2026',
    tag: 'Release',
    icon: Shield,
    tone: 'text-[#DBE2EF]',
    items: [
      { type: 'New', text: 'GitHub public-only connect flow' },
      { type: 'Improved', text: 'CSV export includes confidence score and rationale summary' },
      { type: 'Fixed', text: 'Pagination fixed for repos with more than 500 open issues' },
    ],
  },
  {
    version: 'v0.7.0',
    date: 'Feb 20, 2026',
    tag: 'Beta',
    icon: Search,
    tone: 'text-[#F9F7F7]/70',
    items: [
      { type: 'New', text: 'Public beta launched with a free plan' },
      { type: 'New', text: 'CLOD v1 binary Agent / Review classification' },
      { type: 'New', text: 'Dashboard with issue breakdown and recent activity' },
    ],
  },
];

const TYPE_STYLE = {
  New: 'text-[#3F72AF]',
  Fixed: 'text-[#DBE2EF]',
  Improved: 'text-[#DBE2EF]',
};

export function ChangelogPage() {
  return (
    <PageShell>
      <PageFrame className="max-w-3xl">
        <PageHeader
          eyebrow="Product updates"
          title="Changelog"
          description="What is new in MaintainerOS. Shipped fast, written down plainly."
        />

        <div className="relative mt-12 pl-8">
          <div className="absolute bottom-0 left-[9px] top-1 w-px bg-[#F9F7F7]/10" />
          <div className="space-y-8">
            {ENTRIES.map((entry) => {
              const Icon = entry.icon;
              return (
                <article key={entry.version} className="relative">
                  <div className="absolute -left-8 top-2 flex size-[18px] items-center justify-center rounded-full border-2 border-[#05070A] bg-[#0A111A]">
                    <Icon className={cn('size-3', entry.tone)} />
                  </div>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">{entry.version}</h2>
                    <span className="rounded border border-[#F9F7F7]/12 bg-[#F9F7F7]/7 px-2 py-0.5 text-xs text-[#F9F7F7]/64">{entry.tag}</span>
                    <span className="ml-auto text-sm text-[#F9F7F7]/40">{entry.date}</span>
                  </div>
                  <Surface className="overflow-hidden">
                    {entry.items.map((item) => (
                      <div key={`${entry.version}-${item.text}`} className="grid gap-2 border-b border-[#F9F7F7]/8 px-4 py-3 last:border-b-0 sm:grid-cols-[92px_1fr]">
                        <span className={cn('text-sm font-semibold', TYPE_STYLE[item.type])}>{item.type}</span>
                        <p className="text-sm leading-6 text-[#F9F7F7]/68">{item.text}</p>
                      </div>
                    ))}
                  </Surface>
                </article>
              );
            })}
          </div>
        </div>
      </PageFrame>
    </PageShell>
  );
}
