'use client';

import { motion } from 'framer-motion';
import { Zap, GitMerge, Shield, Award, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SiteNav } from '@/components/layout/site-nav';

interface ChangelogItem {
  type: 'new' | 'fix' | 'impr';
  text: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  tag: 'Major' | 'Release' | 'Beta';
  icon: React.ElementType;
  iconColor: string;
  dotColor: string;
  items: ChangelogItem[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.9.1', date: 'May 7, 2026', tag: 'Release',
    icon: Sparkles, iconColor: 'text-emerald-400', dotColor: 'bg-emerald-500',
    items: [
      { type: 'new',  text: 'Confidence ring animation on issue rows in demo and backlog views'     },
      { type: 'new',  text: 'Clustly budget alerts at 80% and 95% consumption'                    },
      { type: 'fix',  text: 'Lane distribution bar animation no longer re-triggers on scroll'       },
      { type: 'fix',  text: 'Override panel now closes correctly after re-route on mobile'          },
    ],
  },
  {
    version: 'v0.9.0', date: 'Apr 28, 2026', tag: 'Major',
    icon: Zap, iconColor: 'text-violet-400', dotColor: 'bg-violet-500',
    items: [
      { type: 'new',  text: 'Greptile verification — PRs blocked on unresolved spec gaps before merge' },
      { type: 'new',  text: 'Audit trail: per-issue proof chain with full classification and verification log' },
      { type: 'new',  text: 'CLOD now outputs rationale text alongside lane + confidence for every issue'    },
      { type: 'impr', text: 'Batch classification 3× faster with parallel CLOD workers'                     },
      { type: 'fix',  text: 'Webhook replay no longer double-counts already-classified issues'               },
    ],
  },
  {
    version: 'v0.8.4', date: 'Apr 12, 2026', tag: 'Release',
    icon: Award, iconColor: 'text-violet-400', dotColor: 'bg-violet-400',
    items: [
      { type: 'new',  text: 'Clustly bounty integration: Bounty-lane issues automatically posted with suggested reward' },
      { type: 'new',  text: 'Per-repo Clustly budget controls on Team plan'                                              },
      { type: 'impr', text: 'Bounty payout history now shows merge date and verifying contributor'                        },
    ],
  },
  {
    version: 'v0.8.0', date: 'Mar 31, 2026', tag: 'Major',
    icon: GitMerge, iconColor: 'text-emerald-400', dotColor: 'bg-emerald-500',
    items: [
      { type: 'new',  text: 'Four-lane routing system: Agent, Review, Bounty, Clarify'                           },
      { type: 'new',  text: 'CLOD v2 rebuilt on Claude Sonnet 4.6 with structured output + confidence scoring'   },
      { type: 'new',  text: 'Slack notifications for lane changes and high-confidence routes'                     },
      { type: 'impr', text: 'Issue override history persisted across sessions'                                    },
      { type: 'fix',  text: 'Repo rename no longer breaks backlog sync'                                           },
    ],
  },
  {
    version: 'v0.7.2', date: 'Mar 10, 2026', tag: 'Release',
    icon: Shield, iconColor: 'text-blue-400', dotColor: 'bg-blue-500',
    items: [
      { type: 'new',  text: 'GitHub OAuth public-only connect flow — no private-repo scopes requested' },
      { type: 'impr', text: 'CSV export now includes confidence score and rationale summary'      },
      { type: 'fix',  text: 'Pagination fixed for repos with >500 open issues'                   },
    ],
  },
  {
    version: 'v0.7.0', date: 'Feb 20, 2026', tag: 'Beta',
    icon: Search, iconColor: 'text-zinc-400', dotColor: 'bg-zinc-600',
    items: [
      { type: 'new', text: 'Public beta launched — free plan available'                               },
      { type: 'new', text: 'CLOD v1: binary Agent / Review classification on open issues'             },
      { type: 'new', text: 'Dashboard with issue count breakdown and recent activity'                  },
    ],
  },
];

const TAG_STYLES: Record<string, string> = {
  Major:   'bg-violet-950 text-violet-400 border-violet-800',
  Release: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  Beta:    'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const ITEM_STYLES: Record<string, { label: string; cls: string }> = {
  new:  { label: 'New',      cls: 'text-emerald-400' },
  impr: { label: 'Improved', cls: 'text-blue-400'    },
  fix:  { label: 'Fixed',    cls: 'text-amber-400'   },
};

export function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white overflow-x-hidden">
      <SiteNav />

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-14">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-600 mb-3">Product Updates</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white mb-4">Changelog</h1>
          <p className="text-zinc-500 leading-relaxed">What&apos;s new in MaintainerOS. Shipped fast, documented honestly.</p>
        </motion.div>

        {/* Entries */}
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-[9px] top-2 bottom-0 w-px bg-white/6" />

          <div className="space-y-10">
            {ENTRIES.map((entry, i) => (
              <motion.div
                key={entry.version}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="relative">

                {/* Timeline dot */}
                <div className={cn(
                  'absolute -left-8 top-[14px] size-[18px] rounded-full border-2 border-[#030509] flex items-center justify-center',
                  entry.dotColor,
                )}>
                  <entry.icon className="size-2.5 text-black" />
                </div>

                {/* Entry header */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="font-heading font-bold text-white text-lg [font-variant-numeric:tabular-nums]">{entry.version}</span>
                  <span className={cn('text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border', TAG_STYLES[entry.tag])}>
                    {entry.tag.toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-600 ml-auto font-mono">{entry.date}</span>
                </div>

                {/* Items */}
                <div className="rounded-xl border border-white/8 bg-[#080d14] overflow-hidden">
                  {entry.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
                      <span className={cn(
                        'text-[10px] font-mono font-bold shrink-0 pt-0.5 w-16',
                        ITEM_STYLES[item.type].cls,
                      )}>
                        {ITEM_STYLES[item.type].label}
                      </span>
                      <p className="text-sm text-zinc-300 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
