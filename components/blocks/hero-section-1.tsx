'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Coins,
  GitPullRequest,
  HelpCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SiteNav } from '@/components/layout/site-nav';
import { cn } from '@/lib/utils';

const metrics = [
  { value: '1,000', label: 'issues imported' },
  { value: '43%', label: 'agent-ready' },
  { value: '87%', label: 'avg confidence' },
  { value: '$350', label: 'bounty gated' },
];

const lanes = [
  {
    label: 'AI lane',
    detail: 'Cleanly scoped issues become work orders with model choice, context, and acceptance criteria.',
    icon: Bot,
    tone: 'text-[#3F72AF]',
    border: 'border-[#3F72AF]/28',
    dot: 'bg-[#3F72AF]',
  },
  {
    label: 'Maintainer lane',
    detail: 'Risky or architectural issues stay in a human review queue with the decision brief already prepared.',
    icon: UserCheck,
    tone: 'text-[#F9F7F7]',
    border: 'border-[#F9F7F7]/22',
    dot: 'bg-[#F9F7F7]',
  },
  {
    label: 'Clustly lane',
    detail: 'Fundable work is packaged with payout, proof gates, and the PR verification loop.',
    icon: Coins,
    tone: 'text-[#112D4E]',
    border: 'border-[#112D4E]/35',
    dot: 'bg-[#112D4E]',
  },
  {
    label: 'Clarify lane',
    detail: 'Noisy reports become draft replies, repro requests, or close recommendations.',
    icon: HelpCircle,
    tone: 'text-white/70',
    border: 'border-white/14',
    dot: 'bg-white/45',
  },
];

const productRows = [
  {
    id: '#111',
    title: 'Add cursor-based pagination to /issues endpoint',
    route: 'AI',
    status: 'Work order ready',
    color: 'text-[#3F72AF] border-[#3F72AF]/30 bg-[#3F72AF]/10',
  },
  {
    id: '#087',
    title: 'Upgrade path for v1 to v2 webhook format',
    route: 'DEV',
    status: 'Maintainer decision',
    color: 'text-[#F9F7F7] border-[#F9F7F7]/25 bg-[#F9F7F7]/8',
  },
  {
    id: '#112',
    title: 'Redis queue drains silently on OOM restart',
    route: 'CLUSTLY',
    status: 'Bounty draft',
    color: 'text-[#112D4E] border-[#112D4E]/35 bg-[#112D4E]/12',
  },
  {
    id: '#099',
    title: 'Clarify expected retry semantics on 408',
    route: 'CLARIFY',
    status: 'Reply queued',
    color: 'text-white/65 border-white/14 bg-white/6',
  },
];

const workflow = [
  { label: 'GitHub issue import', icon: CircleDot },
  { label: 'Nia context bundle', icon: ShieldCheck },
  { label: 'CLOD route decision', icon: Bot },
  { label: 'PR and Greptile gate', icon: GitPullRequest },
  { label: 'Merge or payout proof', icon: CheckCircle2 },
];

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#07101A] shadow-2xl shadow-black/45">
      <div className="flex items-center justify-between border-b border-[#F9F7F7]/10 bg-[#0D1724] px-4 py-3">
        <div>
          <p className="text-xs font-medium text-white">PrairieLearn / PrairieLearn</p>
          <p className="mt-0.5 text-[11px] text-[#F9F7F7]/45">Live issue router</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#3F72AF]/25 bg-[#3F72AF]/10 px-2.5 py-1 text-[11px] font-medium text-[#3F72AF]">
          <span className="size-1.5 rounded-full bg-[#3F72AF]" />
          Neon synced
        </div>
      </div>

      <div className="grid grid-cols-4 border-b border-[#F9F7F7]/10">
        {metrics.map((metric) => (
          <div key={metric.label} className="border-r border-[#F9F7F7]/10 px-4 py-4 last:border-r-0">
            <div className="text-xl font-semibold tracking-tight text-white">{metric.value}</div>
            <div className="mt-1 text-[11px] text-[#F9F7F7]/45">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="divide-y divide-[#F9F7F7]/8">
        {productRows.map((row) => (
          <div key={row.id} className="grid grid-cols-[64px_1fr_96px_130px] items-center gap-4 px-4 py-3 text-sm">
            <span className="font-mono text-xs text-[#F9F7F7]/38">{row.id}</span>
            <span className="truncate text-[#F9F7F7]/88">{row.title}</span>
            <span className={cn('w-fit rounded border px-2 py-0.5 text-[10px] font-semibold', row.color)}>{row.route}</span>
            <span className="text-right text-xs text-[#F9F7F7]/48">{row.status}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#F9F7F7]/10 bg-black/20 px-4 py-4">
        <div className="grid gap-3 md:grid-cols-5">
          {workflow.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="relative rounded-md border border-[#F9F7F7]/10 bg-white/[0.025] px-3 py-3">
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="size-4 text-[#3F72AF]" />
                  <span className="font-mono text-[10px] text-[#F9F7F7]/35">0{index + 1}</span>
                </div>
                <p className="text-xs leading-snug text-[#F9F7F7]/68">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070A] font-sans text-white">
      <SiteNav />

      <main>
        <section id="product" className="relative px-5 pb-16 pt-28 sm:pt-32">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#07101A_0%,#05070A_56%)]" />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(251,247,218,.9) 1px, transparent 1px), linear-gradient(90deg, rgba(251,247,218,.9) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />

          <div className="mx-auto max-w-[1120px]">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-[#F9F7F7]/12 bg-black/25 px-3 py-1.5 text-sm text-[#F9F7F7]/72 transition-colors hover:border-[#3F72AF]/35 hover:text-white"
                >
                  <span className="size-1.5 rounded-full bg-[#3F72AF]" />
                  Maintainer workflow, routed end to end
                  <ArrowRight className="size-3.5" />
                </Link>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.75rem,6.6vw,5.25rem)] font-medium leading-[0.94] tracking-[-0.06em]"
              >
                Turn every open issue into a routed work order.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.16 }}
                className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-8 text-[#F9F7F7]/62"
              >
                MaintainerOS imports your backlog, classifies each issue, gathers context, dispatches safe work, and keeps PR verification tied to the original decision.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.24 }}
                className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Link
                  href="/connect"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#3F72AF] px-5 text-sm font-semibold text-black shadow-lg shadow-[#3F72AF]/20 transition-colors hover:bg-[#F9F7F7]"
                >
                  Connect repo
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[#F9F7F7]/14 bg-black/20 px-5 text-sm font-medium text-[#F9F7F7]/82 transition-colors hover:border-[#F9F7F7]/30 hover:bg-[#F9F7F7]/7 hover:text-white"
                >
                  Open dashboard
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.32 }}
              className="mx-auto mt-10 max-w-5xl"
            >
              <ProductPreview />
            </motion.div>
          </div>
        </section>

        <section id="routes" className="border-y border-[#F9F7F7]/10 bg-[#07101A] px-5 py-20">
          <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#3F72AF]">Route lanes</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                The backlog becomes four clear queues.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#F9F7F7]/58">
                Each lane has a next action, a confidence score, and proof attached. The UI stays dense enough for repeated maintainer work.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {lanes.map((lane) => {
                const Icon = lane.icon;
                return (
                  <div key={lane.label} className={cn('rounded-lg border bg-black/20 p-5', lane.border)}>
                    <div className="flex items-center justify-between">
                      <span className={cn('size-2 rounded-full', lane.dot)} />
                      <Icon className={cn('size-4', lane.tone)} />
                    </div>
                    <h3 className="mt-7 text-lg font-semibold tracking-[-0.02em] text-white">{lane.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#F9F7F7]/55">{lane.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-5 py-20">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#112D4E]">Control plane</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  A Linear-style workspace for issue operations.
                </h2>
              </div>
              <div className="rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]">
                {workflow.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-4 border-b border-[#F9F7F7]/10 px-5 py-4 last:border-b-0">
                      <span className="font-mono text-xs text-[#F9F7F7]/35">0{index + 1}</span>
                      <Icon className="size-4 text-[#3F72AF]" />
                      <span className="text-sm text-[#F9F7F7]/82">{item.label}</span>
                      <CheckCircle2 className="ml-auto size-4 text-[#F9F7F7]/35" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
