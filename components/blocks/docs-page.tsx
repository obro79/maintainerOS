'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Award, BookOpen, ChevronRight, GitBranch, GitMerge, Search, Terminal, Zap } from 'lucide-react';
import { PageFrame, PageHeader, PageShell, Surface } from '@/components/layout/page-shell';
import { LANE_CONFIG } from '@/lib/design-system';
import { cn } from '@/lib/utils';

const NAV_SECTIONS = [
  { id: 'quickstart', label: 'Quickstart', icon: Zap },
  { id: 'lanes', label: 'Lanes', icon: GitBranch },
  { id: 'greptile', label: 'Greptile', icon: Search },
  { id: 'clustly', label: 'Clustly', icon: Award },
  { id: 'api', label: 'API', icon: Terminal },
];

const QUICKSTART_STEPS = [
  {
    n: '01',
    label: 'Connect your repo',
    body: 'Authorize read access via GitHub. This flow does not request private-repo scopes or write access. MaintainerOS imports issues and stores the routing artifacts separately from your repository.',
  },
  {
    n: '02',
    label: 'Classify the backlog',
    body: 'CLOD routes issues into AI, DEV, CLUSTLY, or CLARIFY with a confidence score and written rationale.',
  },
  {
    n: '03',
    label: 'Review and override',
    body: 'Maintainers can override any route. Every decision is logged so future automation remains inspectable.',
  },
];

const LANES = [
  { key: 'agent', title: 'AI', desc: 'Well-scoped, reproducible issues safe for an autonomous coding agent.' },
  { key: 'review', title: 'DEV', desc: 'Architecture, security, or product decisions that need maintainer judgment.' },
  { key: 'bounty', title: 'CLUSTLY', desc: 'Work that should be packaged for an outside contributor and bounty flow.' },
  { key: 'clarify', title: 'CLARIFY', desc: 'Reports missing reproduction detail, scope, or acceptance criteria.' },
] as const;

export function DocsPage() {
  const [active, setActive] = useState('quickstart');

  return (
    <PageShell>
      <PageFrame className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
          <Surface className="p-2">
            <p className="px-3 py-2 text-xs uppercase tracking-[0.22em] text-[#F9F7F7]/38">Docs</p>
            {NAV_SECTIONS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActive(id)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active === id ? 'bg-[#F9F7F7]/9 text-white' : 'text-[#F9F7F7]/50 hover:bg-[#F9F7F7]/6 hover:text-white',
                )}
              >
                <Icon className={cn('size-4', active === id ? 'text-[#3F72AF]' : 'text-[#F9F7F7]/35')} />
                {label}
              </a>
            ))}
            <div className="mt-3 border-t border-[#F9F7F7]/10 pt-3">
              <Link href="/connect" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#3F72AF] hover:bg-[#3F72AF]/10">
                <GitMerge className="size-4" />
                Connect repo
                <ChevronRight className="ml-auto size-4" />
              </Link>
            </div>
          </Surface>
        </aside>

        <div className="min-w-0 space-y-14">
          <PageHeader
            eyebrow="Documentation"
            title="MaintainerOS Docs"
            description="Connect a repo, understand route decisions, and wire Greptile verification plus Clustly bounties into your maintainer workflow."
          />

          <section id="quickstart" className="scroll-mt-28" onMouseEnter={() => setActive('quickstart')}>
            <div className="mb-5 flex items-center gap-3">
              <BookOpen className="size-5 text-[#3F72AF]" />
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Quickstart</h2>
            </div>
            <div className="space-y-4">
              {QUICKSTART_STEPS.map((step) => (
                <Surface key={step.n} className="grid gap-4 p-5 sm:grid-cols-[72px_1fr]">
                  <span className="text-3xl font-semibold tracking-[-0.05em] text-[#F9F7F7]/24">{step.n}</span>
                  <div>
                    <h3 className="font-semibold text-white">{step.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#F9F7F7]/58">{step.body}</p>
                  </div>
                </Surface>
              ))}
            </div>
          </section>

          <section id="lanes" className="scroll-mt-28" onMouseEnter={() => setActive('lanes')}>
            <h2 className="mb-5 text-2xl font-semibold tracking-[-0.03em]">The Four Lanes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {LANES.map((lane) => {
                const cfg = LANE_CONFIG[lane.key];
                return (
                  <Surface key={lane.key} className={cn('p-5', cfg.tw.border)}>
                    <div className="flex items-center justify-between">
                      <h3 className={cn('font-semibold', cfg.tw.text)}>{lane.title}</h3>
                      <span className={cn('size-2 rounded-full', cfg.tw.bg)} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#F9F7F7]/58">{lane.desc}</p>
                  </Surface>
                );
              })}
            </div>
          </section>

          <section id="greptile" className="scroll-mt-28" onMouseEnter={() => setActive('greptile')}>
            <h2 className="mb-4 text-2xl font-semibold tracking-[-0.03em]">Greptile Verification</h2>
            <p className="max-w-2xl text-[#F9F7F7]/60">
              When a PR is submitted for a routed issue, Greptile checks the diff against the original issue and CLOD rationale before merge.
            </p>
            <Surface className="mt-5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#3F72AF]" />
                <span className="text-sm font-semibold text-[#3F72AF]">Verification passed</span>
                <span className="ml-auto text-sm text-[#F9F7F7]/38">PR #204</span>
              </div>
              <p className="text-sm leading-6 text-[#F9F7F7]/58">
                PR covers the issue spec and route rationale. No blocking gaps detected. Merge approved.
              </p>
            </Surface>
          </section>

          <section id="clustly" className="scroll-mt-28" onMouseEnter={() => setActive('clustly')}>
            <h2 className="mb-4 text-2xl font-semibold tracking-[-0.03em]">Clustly Bounty Integration</h2>
            <p className="max-w-2xl text-[#F9F7F7]/60">
              CLUSTLY-lane issues are packaged with a suggested reward, proof requirements, and a payout gate.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {['Route as CLUSTLY', 'Post bounty package', 'Release after proof'].map((label, index) => (
                <Surface key={label} className="p-4">
                  <div className="text-2xl font-semibold text-[#DBE2EF]">0{index + 1}</div>
                  <p className="mt-2 text-sm text-[#F9F7F7]/58">{label}</p>
                </Surface>
              ))}
            </div>
          </section>

          <section id="api" className="scroll-mt-28" onMouseEnter={() => setActive('api')}>
            <h2 className="mb-4 text-2xl font-semibold tracking-[-0.03em]">API Reference</h2>
            <div className="space-y-2">
              {[
                ['GET', '/v1/issues?repo=org/repo', 'List routed issues'],
                ['POST', '/v1/issues/:id/override', 'Override a route'],
                ['GET', '/v1/bounties?repo=org/repo', 'List bounties'],
                ['GET', '/v1/audit/:id', 'Fetch proof chain'],
              ].map(([method, path, desc]) => (
                <Surface key={path} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[70px_1fr_160px]">
                  <span className={method === 'GET' ? 'text-[#3F72AF]' : 'text-[#DBE2EF]'}>{method}</span>
                  <span className="text-[#F9F7F7]/74">{path}</span>
                  <span className="text-[#F9F7F7]/38">{desc}</span>
                </Surface>
              ))}
            </div>
          </section>
        </div>
      </PageFrame>
    </PageShell>
  );
}
