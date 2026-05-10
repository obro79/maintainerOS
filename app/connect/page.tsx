'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, CreditCard, GitMerge, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function GitHubMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 10 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 20 10.017C20 4.484 15.522 0 10 0z" />
    </svg>
  );
}

const PREVIEW_ISSUES = [
  { id: '#41', title: 'Incorrect cache invalidation on webhook replay',  badge: 'AGENT',   badgeCls: 'text-[#3F72AF] border-[#3F72AF]/30 bg-[#3F72AF]/10', bar: 'bg-[#3F72AF]' },
  { id: '#52', title: 'Review branch preview permissions after dep upgrade', badge: 'REVIEW', badgeCls: 'text-[#F9F7F7]/80 border-[#F9F7F7]/20 bg-[#F9F7F7]/8', bar: 'bg-[#F9F7F7]/50' },
  { id: '#77', title: 'Implement schema migrations adapter + tests',     badge: 'BOUNTY',  badgeCls: 'text-[#3F72AF]/90 border-[#3F72AF]/20 bg-[#112D4E]/40', bar: 'bg-[#112D4E]' },
  { id: '#88', title: 'Clarify vague worker retry failure report',       badge: 'CLARIFY', badgeCls: 'text-[#F9F7F7]/50 border-[#F9F7F7]/12 bg-white/4',     bar: 'bg-white/30' },
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
      {/* ── Left: preview panel ── */}
      <div className="hidden flex-col justify-center gap-6 lg:flex lg:w-[52%] lg:pr-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: ShieldCheck, stat: 'Public-only', label: 'OAuth scope' },
            { Icon: Clock,       stat: '~30 sec',     label: 'Import time' },
            { Icon: CreditCard,  stat: 'No card',     label: 'Free to start' },
          ].map(({ Icon, stat, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-lg border border-[#F9F7F7]/10 bg-[#0A111A] p-3 text-center">
              <Icon className="size-3.5 text-[#3F72AF]" />
              <div className="text-sm font-semibold text-white">{stat}</div>
              <div className="text-[10px] text-[#F9F7F7]/45">{label}</div>
            </div>
          ))}
        </div>

        {/* Issue preview */}
        <div className="overflow-hidden rounded-lg border border-[#F9F7F7]/12 bg-[#07101A] shadow-2xl shadow-black/45">
          <div className="flex items-center justify-between border-b border-[#F9F7F7]/10 bg-[#0D1724] px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                {['bg-[#ff5f57]', 'bg-[#ffbd2e]', 'bg-[#28c840]'].map((c, i) => (
                  <span key={i} className={cn('size-2 rounded-full opacity-60', c)} />
                ))}
              </div>
              <span className="font-mono text-[11px] text-[#F9F7F7]/38">your-org / your-repo</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#3F72AF]/70">After connecting</span>
          </div>
          {PREVIEW_ISSUES.map((row) => (
            <div key={row.id} className="flex items-center overflow-hidden border-b border-[#F9F7F7]/8 last:border-b-0 hover:bg-white/[0.02] transition-colors">
              <div className={cn('w-[3px] shrink-0 self-stretch opacity-70', row.bar)} />
              <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 font-mono text-[10px] text-[#F9F7F7]/35">{row.id}</span>
                <span className="flex-1 truncate text-xs text-[#F9F7F7]/82">{row.title}</span>
                <span className={cn('shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold', row.badgeCls)}>
                  {row.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#F9F7F7]/35">
          CLOD classifies your backlog with confidence scores and rationale — agent-safe, maintainer decisions, bounties, or clarification.
        </p>
      </div>

      {/* ── Right: form panel ── */}
      <div className="w-full lg:w-[48%] lg:border-l lg:border-[#F9F7F7]/10 lg:pl-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4">

          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[#3F72AF]">Public GitHub OAuth</p>
            <h1 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.03em] text-white">
              Connect a public repo
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-[#F9F7F7]/55">
              Sign in with GitHub, import a public repository, and route its open issues.
            </p>
          </div>

          <motion.a
            href="/api/auth/github/start"
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.985 }}
            className="flex w-full items-center justify-center gap-2.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-black/30 transition-colors hover:bg-[#F9F7F7]/90">
            <GitHubMark />
            {isOAuthConnected ? 'Reconnect GitHub' : 'Continue with GitHub'}
          </motion.a>

          <div className={cn(
            'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
            isOAuthConnected
              ? 'border-[#3F72AF]/25 bg-[#3F72AF]/8 text-[#F9F7F7]/80'
              : 'border-[#F9F7F7]/10 bg-[#F9F7F7]/4 text-[#F9F7F7]/45',
          )}>
            {isOAuthConnected
              ? <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-[#3F72AF]" />
              : <ShieldCheck className="mt-0.5 size-3 shrink-0 text-[#F9F7F7]/35" />}
            <span>
              {isOAuthConnected
                ? `Signed in as ${ownerFromGitHub}. Choose a public repository to import.`
                : 'OAuth uses public GitHub access only. Private repos require a GitHub App installation.'}
            </span>
          </div>

          <form onSubmit={importRepository} className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#F9F7F7]/50">Owner</span>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="vercel"
                  autoComplete="off"
                  className="w-full rounded-md border border-[#F9F7F7]/12 bg-[#07101A] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#F9F7F7]/25 focus:border-[#3F72AF]/50" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#F9F7F7]/50">Repository</span>
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="next.js"
                  autoComplete="off"
                  className="w-full rounded-md border border-[#F9F7F7]/12 bg-[#07101A] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#F9F7F7]/25 focus:border-[#3F72AF]/50" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#F9F7F7]/50">Issue import limit</span>
              <input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full rounded-md border border-[#F9F7F7]/12 bg-[#07101A] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#3F72AF]/50" />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300">
                <AlertCircle className="mt-0.5 size-3 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={status === 'importing'}
              whileHover={{ scale: status === 'importing' ? 1 : 1.015, y: status === 'importing' ? 0 : -1 }}
              whileTap={{ scale: status === 'importing' ? 1 : 0.985 }}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#3F72AF] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#3F72AF]/20 transition-colors hover:bg-[#4d83c4] disabled:cursor-not-allowed disabled:opacity-60">
              {status === 'importing' ? <Loader2 className="size-4 animate-spin" /> : <GitMerge className="size-4" />}
              {status === 'importing' ? `Importing ${repoPath}…` : 'Connect repo'}
            </motion.button>
          </form>

          <div className="flex items-center justify-between pt-1">
            <Link href="/demo" className="inline-flex items-center gap-1 text-xs text-[#F9F7F7]/40 transition-colors hover:text-[#F9F7F7]/70">
              Explore first?
              <span className="text-[#3F72AF]">View demo</span>
              <ChevronRight className="size-3 text-[#3F72AF]" />
            </Link>
            <p className="text-[10px] text-[#F9F7F7]/28">Public repos only</p>
          </div>
        </motion.div>
      </div>
    </ConnectShell>
  );
}

function ConnectLoading() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#F9F7F7]/10 bg-[#F9F7F7]/4 px-4 py-3 text-sm text-[#F9F7F7]/45">
      <Loader2 className="size-4 animate-spin" />
      Loading connect flow
    </div>
  );
}

function ConnectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#05070A] font-sans text-white">
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,247,218,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(251,247,218,.9) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,#07101A_0%,#05070A_60%)]" />
      <div className="pointer-events-none absolute left-[30%] top-0 z-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#3F72AF]/8 blur-[120px]" />

      {/* Nav bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex h-14 items-center justify-between px-8 border-b border-[#F9F7F7]/8">
        <Link href="/" className="font-heading text-[15px] font-semibold tracking-tight text-white">
          MaintainerOS
        </Link>
        <p className="text-[11px] text-[#F9F7F7]/30">© 2026 MaintainerOS</p>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex w-full items-center justify-center px-8 pt-14">
        <div className="flex w-full max-w-[960px] items-center gap-0">
          {children}
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
