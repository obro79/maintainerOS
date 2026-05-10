'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, CreditCard, GitMerge, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function GitHubMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 10 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 20 10.017C20 4.484 15.522 0 10 0z" />
    </svg>
  );
}

const PREVIEW_ISSUES = [
  { id: '#41', title: 'Incorrect cache invalidation on webhook replay', badge: 'AGENT', badgeCls: 'bg-emerald-950 text-emerald-400 border-emerald-800', bar: 'bg-emerald-500' },
  { id: '#52', title: 'Review branch preview permissions after dep upgrade', badge: 'REVIEW', badgeCls: 'bg-amber-950 text-amber-400 border-amber-800', bar: 'bg-amber-500' },
  { id: '#77', title: 'Implement schema migrations adapter + tests', badge: 'BOUNTY', badgeCls: 'bg-violet-950 text-violet-400 border-violet-800', bar: 'bg-violet-500' },
  { id: '#88', title: 'Clarify vague worker retry failure report', badge: 'CLARIFY', badgeCls: 'bg-zinc-800 text-zinc-400 border-zinc-700', bar: 'bg-zinc-500' },
];

const STEPS = [
  { n: '1', label: 'Sign in with public GitHub OAuth' },
  { n: '2', label: 'Import a public repository' },
  { n: '3', label: 'Route every open issue' },
];

const OWNER_REPO_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export default function ConnectPage() {
  return (
    <Suspense fallback={<ConnectShell><ConnectLoading /></ConnectShell>}>
      <ConnectContent />
    </Suspense>
  );
}

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const githubState = searchParams.get('github');
  const ownerFromGitHub = searchParams.get('owner') ?? '';
  const [owner, setOwner] = useState(ownerFromGitHub);
  const [repo, setRepo] = useState('');
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState<string | null>(connectMessage(githubState, searchParams.get('reason')));
  const [status, setStatus] = useState<'idle' | 'importing' | 'connected'>('idle');

  const isOAuthConnected = githubState === 'connected';
  const repoPath = useMemo(() => `${owner.trim()}/${repo.trim()}`, [owner, repo]);

  async function importRepository(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextOwner = owner.trim();
    const nextRepo = repo.trim();
    if (!OWNER_REPO_PATTERN.test(nextOwner) || !OWNER_REPO_PATTERN.test(nextRepo)) {
      setError('Use a valid public GitHub owner and repository name.');
      return;
    }

    setStatus('importing');
    try {
      const response = await fetch('/api/maintaineros/import-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: nextOwner, repo: nextRepo, limit }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? `GitHub import failed with ${response.status}.`);
      }
      setStatus('connected');
      router.push(`/${encodeURIComponent(nextOwner)}/${encodeURIComponent(nextRepo)}`);
    } catch (importError) {
      setStatus('idle');
      setError(importError instanceof Error ? importError.message : 'GitHub import failed.');
    }
  }

  return (
    <ConnectShell>
      <div className="mb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80">Public GitHub OAuth</p>
        <h1 className="mb-2 font-heading text-[2rem] font-bold leading-tight tracking-tight text-white">
          Connect a public repo
        </h1>
        <p className="text-[15px] leading-relaxed text-zinc-500">
          Sign in with GitHub, import a public repository, and route its open issues through MaintainerOS.
        </p>
      </div>

      <motion.a
        href="/api/auth/github/start"
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-black shadow-2xl shadow-black/50 transition-all duration-200 hover:bg-zinc-100">
        <GitHubMark />
        {isOAuthConnected ? 'Reconnect GitHub' : 'Continue with GitHub'}
      </motion.a>

      <div className={cn(
        'mb-5 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs',
        isOAuthConnected ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-white/8 bg-white/[0.02] text-zinc-500',
      )}>
        {isOAuthConnected ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />}
        <span>
          {isOAuthConnected
            ? `Signed in as ${ownerFromGitHub}. Choose a public repository to import.`
            : 'OAuth uses public GitHub access only. Private repo read-only support should use a GitHub App installation.'}
        </span>
      </div>

      <form onSubmit={importRepository} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">Owner</span>
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="vercel"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-[#080d14] px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/50" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">Repository</span>
            <input
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="next.js"
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-[#080d14] px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/50" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">Issue import limit</span>
          <input
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-[#080d14] px-3 py-3 text-sm text-white outline-none transition-colors focus:border-emerald-500/50" />
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <motion.button
          type="submit"
          disabled={status === 'importing'}
          whileHover={{ scale: status === 'importing' ? 1 : 1.02, y: status === 'importing' ? 0 : -1 }}
          whileTap={{ scale: status === 'importing' ? 1 : 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-[15px] font-semibold text-black shadow-xl shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70">
          {status === 'importing' ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
          {status === 'importing' ? `Importing ${repoPath}` : 'Connect repo'}
        </motion.button>
      </form>

      <div className="my-8 grid grid-cols-3 gap-3">
        {[
          { Icon: ShieldCheck, stat: 'Public-only', label: 'OAuth scope' },
          { Icon: Clock, stat: '~30 sec', label: 'Import time' },
          { Icon: CreditCard, stat: 'No card', label: 'Free to start' },
        ].map(({ Icon, stat, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
            <Icon className="size-4 text-zinc-600" />
            <div className="font-heading text-sm font-bold text-white">{stat}</div>
            <div className="text-[10px] text-zinc-600">{label}</div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/demo" className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-400">
          Want to explore first? <span className="text-emerald-500">View live demo</span>
          <ChevronRight className="size-3.5 text-emerald-500" />
        </Link>
      </div>
    </ConnectShell>
  );
}

function ConnectLoading() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-zinc-500">
      <Loader2 className="size-4 animate-spin" />
      Loading connect flow
    </div>
  );
}

function ConnectShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#030509] font-sans text-white">
      <div className="relative hidden flex-1 flex-col overflow-hidden border-r border-white/6 p-12 pt-16 lg:flex">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-violet-500/5 blur-[100px]" />
        <Link href="/" className="mb-16 inline-block font-heading text-[15px] font-bold tracking-tight text-white">
          MaintainerOS
        </Link>
        <div className="flex flex-1 flex-col justify-center">
          <div className="max-w-md">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80">After connecting, you&apos;ll see</p>
            <h2 className="mb-2 font-heading text-3xl font-bold leading-tight tracking-tight text-white">
              Every issue<br />routed in seconds.
            </h2>
            <p className="mb-10 text-[15px] leading-relaxed text-zinc-500">
              CLOD classifies your public backlog with confidence scores and rationale. Agent-safe, maintainer decisions, bounties, or clarification.
            </p>

            <div className="mb-10 overflow-hidden rounded-2xl border border-white/10 bg-[#080d14] shadow-2xl shadow-black/60">
              <div className="flex items-center gap-3 border-b border-white/8 bg-[#0a1018] px-4 py-3">
                <div className="flex gap-1.5">
                  {['bg-[#ff5f57]', 'bg-[#ffbd2e]', 'bg-[#28c840]'].map((color, index) => (
                    <span key={index} className={cn('size-2.5 rounded-full opacity-70', color)} />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-zinc-600">your-org / your-repo</span>
              </div>
              <div className="grid grid-cols-4 border-b border-white/8 text-center">
                {[
                  { n: '-', label: 'Agent', color: 'text-emerald-400' },
                  { n: '-', label: 'Maintainer', color: 'text-amber-400' },
                  { n: '-', label: 'Bounty', color: 'text-violet-400' },
                  { n: '-', label: 'Clarify', color: 'text-zinc-400' },
                ].map((lane) => (
                  <div key={lane.label} className="border-r border-white/8 px-3 py-3 last:border-r-0">
                    <div className={cn('font-heading text-lg font-bold', lane.color)}>{lane.n}</div>
                    <div className="mt-0.5 text-[10px] text-zinc-700">{lane.label}</div>
                  </div>
                ))}
              </div>
              {PREVIEW_ISSUES.map((row) => (
                <div key={row.id} className="flex items-center gap-0 overflow-hidden border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.02]">
                  <div className={cn('w-[3px] shrink-0 self-stretch opacity-60', row.bar)} />
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
                    <span className="shrink-0 font-mono text-[10px] text-zinc-700">{row.id}</span>
                    <span className="flex-1 truncate text-xs text-zinc-300">{row.title}</span>
                    <span className={cn('shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold', row.badgeCls)}>
                      {row.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {STEPS.map((step) => (
                <div key={step.n} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] text-emerald-400">
                    {step.n}
                  </span>
                  <span className="text-sm text-zinc-400">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col lg:max-w-[500px]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent" />
        <div className="p-6 pb-0 lg:hidden">
          <Link href="/" className="font-heading text-[15px] font-bold tracking-tight text-white">
            MaintainerOS
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm">
            {children}
          </motion.div>
        </div>
        <div className="px-8 pb-6 text-center lg:text-left">
          <p className="text-[11px] text-zinc-700">
            © 2026 MaintainerOS · Public repositories only in this OAuth flow
          </p>
        </div>
      </div>
    </div>
  );
}

function connectMessage(state: string | null, reason: string | null) {
  if (state === 'oauth-unconfigured') return 'GitHub OAuth is not configured yet. Add GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.';
  if (state === 'state-mismatch') return 'GitHub sign-in expired or failed state validation. Try connecting again.';
  if (state === 'failed') return reason ?? 'GitHub sign-in failed. Try connecting again.';
  return null;
}
