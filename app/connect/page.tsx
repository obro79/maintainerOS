'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Clock, CreditCard, ChevronRight, Loader2 } from 'lucide-react';
import { GITHUB_IMPORT_DEFAULT_LIMIT, GITHUB_IMPORT_MAX_LIMIT } from '@/lib/maintaineros/limits';
import { cn } from '@/lib/utils';

function GitHubMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 10 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 20 10.017C20 4.484 15.522 0 10 0z" />
    </svg>
  );
}

const PREVIEW_ISSUES = [
  { id: '#41', title: 'Incorrect cache invalidation on webhook replay', badge: 'AGENT',      badgeCls: 'bg-emerald-950 text-emerald-400 border-emerald-800', bar: 'bg-emerald-500' },
  { id: '#52', title: 'Review branch preview permissions after dep upgrade', badge: 'REVIEW', badgeCls: 'bg-amber-950 text-amber-400 border-amber-800',     bar: 'bg-amber-500' },
  { id: '#77', title: 'Implement schema migrations adapter + tests',     badge: 'BOUNTY',    badgeCls: 'bg-violet-950 text-violet-400 border-violet-800',   bar: 'bg-violet-500' },
  { id: '#88', title: 'Clarify vague worker retry failure report',       badge: 'CLARIFY',   badgeCls: 'bg-zinc-800 text-zinc-400 border-zinc-700',         bar: 'bg-zinc-500' },
];

const STEPS = [
  { n: '1', label: 'Authorize read access on GitHub' },
  { n: '2', label: 'CLOD classifies every open issue' },
  { n: '3', label: 'Review routes, override anything' },
];

export default function ConnectPage() {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [limit, setLimit] = useState(String(GITHUB_IMPORT_DEFAULT_LIMIT));
  const [status, setStatus] = useState<'idle' | 'importing' | 'succeeded' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('importing');
    setMessage('');

    const numericLimit = Math.min(Math.max(Number(limit) || GITHUB_IMPORT_DEFAULT_LIMIT, 1), GITHUB_IMPORT_MAX_LIMIT);
    setLimit(String(numericLimit));

    try {
      const response = await fetch('/api/maintaineros/import-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, limit: numericLimit }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? 'GitHub import failed.');
      }

      const importedIssues = payload.run?.importedIssueCount ?? 0;
      const importedPullRequests = payload.run?.importedPullRequestCount ?? 0;
      setStatus('succeeded');
      setMessage(`Imported ${importedIssues} issues and ${importedPullRequests} PRs.`);
    } catch (error) {
      setStatus('failed');
      setMessage(error instanceof Error ? error.message : 'GitHub import failed.');
    }
  }

  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white flex overflow-x-hidden">

      {/* ── Left panel — preview ── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden border-r border-white/6 p-12 pt-16">
        {/* Ambient */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="font-heading font-bold text-[15px] tracking-tight text-white mb-16 inline-block">
          MaintainerOS
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80 mb-4">After connecting, you&apos;ll see</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
              Every issue<br />routed in seconds.
            </h2>
            <p className="text-zinc-500 text-[15px] mb-10 leading-relaxed">
              CLOD classifies your entire backlog with confidence scores and rationale. Agent-safe, maintainer decisions, bounties, or clarification — every issue gets a lane.
            </p>

            {/* Mini dashboard preview */}
            <div className="rounded-2xl border border-white/10 bg-[#080d14] shadow-2xl shadow-black/60 overflow-hidden mb-10">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0a1018]">
                <div className="flex gap-1.5">
                  {['bg-[#ff5f57]', 'bg-[#ffbd2e]', 'bg-[#28c840]'].map((c, i) => (
                    <span key={i} className={cn('size-2.5 rounded-full opacity-70', c)} />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-zinc-600">your-org / your-repo</span>
              </div>

              {/* Lane stats */}
              <div className="grid grid-cols-4 border-b border-white/8 text-center">
                {[
                  { n: '—', label: 'Agent',      color: 'text-emerald-400' },
                  { n: '—', label: 'Maintainer', color: 'text-amber-400'   },
                  { n: '—', label: 'Bounty',     color: 'text-violet-400'  },
                  { n: '—', label: 'Clarify',    color: 'text-zinc-400'    },
                ].map((lane) => (
                  <div key={lane.label} className="px-3 py-3 border-r border-white/8 last:border-r-0">
                    <div className={cn('font-heading font-bold text-lg', lane.color)}>{lane.n}</div>
                    <div className="text-[10px] text-zinc-700 mt-0.5">{lane.label}</div>
                  </div>
                ))}
              </div>

              {/* Issue rows */}
              {PREVIEW_ISSUES.map((row) => (
                <div key={row.id} className="flex items-center gap-0 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors overflow-hidden">
                  <div className={cn('self-stretch w-[3px] shrink-0 opacity-60', row.bar)} />
                  <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-2.5">
                    <span className="font-mono text-[10px] text-zinc-700 shrink-0">{row.id}</span>
                    <span className="flex-1 text-xs text-zinc-300 truncate">{row.title}</span>
                    <span className={cn('shrink-0 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border', row.badgeCls)}>
                      {row.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3">
                  <span className="size-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center font-mono text-[11px] text-emerald-400 shrink-0">
                    {step.n}
                  </span>
                  <span className="text-sm text-zinc-400">{step.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 lg:max-w-[480px] flex flex-col relative">
        {/* Subtle right-side ambient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />

        {/* Mobile logo */}
        <div className="lg:hidden p-6 pb-0">
          <Link href="/" className="font-heading font-bold text-[15px] tracking-tight text-white">
            MaintainerOS
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm">

            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80 mb-3">Step 1 of 2</p>
              <h1 className="font-heading text-[2rem] font-bold tracking-tight text-white mb-2 leading-tight">
                Connect GitHub
              </h1>
              <p className="text-zinc-500 text-[15px] leading-relaxed">
                Authorize MaintainerOS to read your issues. We never write to your repo without your explicit approval.
              </p>
            </div>

            <form onSubmit={submitImport} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-zinc-600">Owner</span>
                  <input
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="vercel"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-zinc-600">Repo</span>
                  <input
                    value={repo}
                    onChange={(event) => setRepo(event.target.value)}
                    required
                    autoComplete="off"
                    placeholder="next.js"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/50"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-zinc-600">Import limit</span>
                <input
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  required
                  type="number"
                  min={1}
                  max={GITHUB_IMPORT_MAX_LIMIT}
                  step={1}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500/50"
                />
              </label>
              <motion.button
                type="submit"
                disabled={status === 'importing'}
                whileHover={{ scale: status === 'importing' ? 1 : 1.02, y: status === 'importing' ? 0 : -1 }}
                whileTap={{ scale: status === 'importing' ? 1 : 0.98 }}
                className="mb-3 flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-black shadow-2xl shadow-black/50 transition-all duration-200 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60">
                {status === 'importing' ? <Loader2 className="size-5 animate-spin" /> : <GitHubMark />}
                {status === 'importing' ? 'Importing backlog' : 'Import GitHub repo'}
              </motion.button>
              {message && (
                <p className={cn(
                  'rounded-xl border px-3 py-2 text-xs leading-relaxed',
                  status === 'succeeded' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-red-500/20 bg-red-500/10 text-red-200',
                )}>
                  {message}
                </p>
              )}
            </form>

            <p className="mb-8 mt-3 text-center text-xs text-zinc-600">
              Imports up to {GITHUB_IMPORT_MAX_LIMIT.toLocaleString()} open issues and PRs with read-only GitHub access.
            </p>

            {/* Trust stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { Icon: ShieldCheck, stat: 'Read-only',  label: 'GitHub access' },
                { Icon: Clock,       stat: '~30 sec',    label: 'Setup time'    },
                { Icon: CreditCard,  stat: 'No card',    label: 'Free to start' },
              ].map(({ Icon, stat, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/8 bg-white/[0.02] text-center">
                  <Icon className="size-4 text-zinc-600" />
                  <div className="font-heading font-bold text-white text-sm">{stat}</div>
                  <div className="text-[10px] text-zinc-600">{label}</div>
                </div>
              ))}
            </div>

            {/* Already have an account */}
            <div className="text-center">
              <Link href="/demo"
                className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">
                Want to explore first? <span className="text-emerald-500">View live demo</span>
                <ChevronRight className="size-3.5 text-emerald-500" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center lg:text-left">
          <p className="text-[11px] text-zinc-700">© 2025 MaintainerOS · <Link href="#" className="hover:text-zinc-500 transition-colors">Privacy</Link> · <Link href="#" className="hover:text-zinc-500 transition-colors">Terms</Link></p>
        </div>
      </div>
    </div>
  );
}
