'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GitMerge, ChevronRight, Zap, GitBranch, Award, Search, Terminal, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANE_CONFIG } from '@/lib/design-system';
import { SiteNav } from '@/components/layout/site-nav';
import { LaneBadge } from '@/components/ui/lane-badge';

const NAV_SECTIONS = [
  { id: 'quickstart', label: 'Quickstart',         icon: Zap      },
  { id: 'lanes',      label: 'The Four Lanes',     icon: GitBranch },
  { id: 'greptile',   label: 'Greptile',           icon: Search   },
  { id: 'clustly',   label: 'Clustly',           icon: Award    },
  { id: 'api',        label: 'API Reference',      icon: Terminal  },
];

const QUICKSTART_STEPS = [
  {
    n: '01',
    label: 'Connect your repo',
    body: 'Go to /connect, sign in with public GitHub OAuth, and choose a public repository to import. This flow does not request private-repo scopes or write access.',
  },
  {
    n: '02',
    label: 'CLOD classifies your backlog',
    body: 'Within seconds, CLOD processes every open issue and routes it into one of four lanes: Agent, Review, Bounty, or Clarify — each with a confidence score and written rationale.',
  },
  {
    n: '03',
    label: 'Review and override',
    body: 'Every decision includes a rationale and confidence score. Use the Override button on any issue to reroute it — your decisions are logged in the audit trail and improve future classifications.',
  },
];

const LANE_DESCS = [
  { key: 'agent',   desc: 'Well-scoped, reproducible issues with no API contract impact. Safe for an AI coding agent (Codex, Cursor) to attempt autonomously.' },
  { key: 'review',  desc: 'Requires maintainer judgment — breaking changes, architectural decisions, or anything needing human sign-off before proceeding.' },
  { key: 'bounty',  desc: 'Infrastructure-heavy or domain-specific issues best solved by the broader community. CLOD posts these to Clustly automatically.' },
  { key: 'clarify', desc: 'The issue spec is ambiguous. CLOD posts a targeted clarification comment and re-classifies once the author responds.' },
] as const;

export function DocsPage() {
  const [active, setActive] = useState('quickstart');

  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white overflow-x-hidden">
      <SiteNav />

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-24 flex gap-12">

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-48 shrink-0 sticky top-24 self-start gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-700 mb-2 px-3">Docs</p>
          {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActive(id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                active === id
                  ? 'text-white bg-white/[0.06] font-medium'
                  : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.03]',
              )}>
              {active === id && <div className="size-1 rounded-full bg-emerald-500 shrink-0" />}
              <Icon className="size-3.5 shrink-0" />
              {label}
            </a>
          ))}

          <div className="mt-6 pt-5 border-t border-white/6">
            <Link href="/connect" className="flex items-center gap-1.5 px-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              <GitMerge className="size-3.5" />
              Connect repo
              <ChevronRight className="size-3 ml-auto" />
            </Link>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-16">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="size-4 text-emerald-400" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-500/80">Documentation</p>
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-white mb-4">MaintainerOS Docs</h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
              Connect your repo, understand routing decisions, and integrate Greptile verification and Clustly bounties.
            </p>
          </motion.div>

          {/* Quickstart */}
          <section id="quickstart" className="scroll-mt-24" onMouseEnter={() => setActive('quickstart')}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Zap className="size-4 text-emerald-400" />
                </div>
                <h2 className="font-heading text-xl font-bold text-white">Quickstart</h2>
              </div>
              <div className="space-y-5">
                {QUICKSTART_STEPS.map((step) => (
                  <div key={step.n} className="flex gap-5">
                    <div className="font-heading font-bold text-3xl text-zinc-800 [font-variant-numeric:tabular-nums] leading-none pt-1 w-8 shrink-0">
                      {step.n}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="font-semibold text-white mb-1.5">{step.label}</div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Four Lanes */}
          <section id="lanes" className="scroll-mt-24" onMouseEnter={() => setActive('lanes')}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="size-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <GitBranch className="size-4 text-violet-400" />
                </div>
                <h2 className="font-heading text-xl font-bold text-white">The Four Lanes</h2>
              </div>
              <div className="space-y-3">
                {LANE_DESCS.map(({ key, desc }) => {
                  const cfg = LANE_CONFIG[key];
                  return (
                    <div key={key} className={cn('flex gap-4 p-4 rounded-xl border', cfg.tw.bgFaint, cfg.tw.border)}>
                      <div className="pt-0.5">
                        <LaneBadge value={key} size="md" />
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </section>

          {/* Greptile */}
          <section id="greptile" className="scroll-mt-24" onMouseEnter={() => setActive('greptile')}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="size-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Search className="size-4 text-blue-400" />
                </div>
                <h2 className="font-heading text-xl font-bold text-white">Greptile Verification</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                When a PR is submitted for a routed issue, Greptile scans the diff against the original issue description and CLOD rationale. If there are unresolved spec gaps, merge is blocked until they&apos;re addressed.
              </p>
              <div className="rounded-xl border border-white/8 bg-[#080d14] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono text-emerald-400">Verification passed</span>
                  <span className="ml-auto text-xs text-zinc-600">PR #204</span>
                </div>
                <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                  &quot;PR covers all paths described in issue #108. Token refresh mutex correctly handles concurrent SSO flows. No spec gaps detected. Merge approved.&quot;
                </p>
              </div>
              <p className="text-xs text-zinc-600 mt-3">Available on Pro and Team plans.</p>
            </motion.div>
          </section>

          {/* Clustly */}
          <section id="clustly" className="scroll-mt-24" onMouseEnter={() => setActive('clustly')}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="size-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Award className="size-4 text-violet-400" />
                </div>
                <h2 className="font-heading text-xl font-bold text-white">Clustly Bounty Integration</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                CLOD routes Bounty-lane issues to Clustly with a suggested reward range based on complexity and risk scores. Clustly funds and manages the bounty. Payment releases only after Greptile confirms the submitted PR fully resolves the issue.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { step: '01', label: 'CLOD routes issue as Bounty', color: 'text-violet-400' },
                  { step: '02', label: 'Clustly posts with suggested reward', color: 'text-violet-400' },
                  { step: '03', label: 'Greptile verifies PR · funds released', color: 'text-emerald-400' },
                ].map(({ step, label, color }) => (
                  <div key={step} className="rounded-xl border border-white/8 bg-[#080d14] p-3">
                    <div className={cn('font-heading font-bold text-2xl mb-1 [font-variant-numeric:tabular-nums]', color)}>{step}</div>
                    <p className="text-xs text-zinc-500 leading-snug">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* API */}
          <section id="api" className="scroll-mt-24" onMouseEnter={() => setActive('api')}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="size-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <Terminal className="size-4 text-zinc-400" />
                </div>
                <h2 className="font-heading text-xl font-bold text-white">API Reference</h2>
              </div>
              <p className="text-zinc-400 leading-relaxed mb-4">
                MaintainerOS exposes a REST API for advanced integrations. Authenticate with a Bearer token from your settings page.
              </p>
              <div className="space-y-3">
                {[
                  { method: 'GET',  path: '/v1/issues?repo=org/repo',    desc: 'List all routed issues with lane + confidence' },
                  { method: 'POST', path: '/v1/issues/:id/override',     desc: 'Override a lane decision for a specific issue'  },
                  { method: 'GET',  path: '/v1/bounties?repo=org/repo',  desc: 'List active and paid bounties'                  },
                  { method: 'GET',  path: '/v1/audit/:id',               desc: 'Fetch the full proof chain for an issue'        },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="flex items-center gap-3 rounded-lg border border-white/6 bg-[#080d14] px-4 py-3 font-mono text-xs">
                    <span className={cn('font-bold w-10 shrink-0', method === 'GET' ? 'text-emerald-400' : 'text-amber-400')}>{method}</span>
                    <span className="text-zinc-300 flex-1">{path}</span>
                    <span className="text-zinc-600 hidden md:block">{desc}</span>
                  </div>
                ))}
              </div>
              <pre className="mt-4 rounded-xl border border-white/8 bg-[#080d14] p-4 font-mono text-sm text-emerald-300 overflow-x-auto leading-relaxed">
{`curl -H "Authorization: Bearer <token>" \\
  https://api.maintaineros.dev/v1/issues?repo=acme/my-repo`}
              </pre>
            </motion.div>
          </section>

        </div>
      </div>
    </div>
  );
}
