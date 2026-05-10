'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, ChevronRight, GitMerge, Menu, X,
  Search, TrendingUp, Zap, Terminal, MousePointerClick, Cloud, Cpu,
  Bot, UserCheck, Coins, HelpCircle, Inbox, Compass, ShieldCheck, BadgeCheck,
  Check,
} from 'lucide-react';
import {
  motion, useInView, useMotionValue, useSpring, animate,
  useScroll, useTransform,
} from 'framer-motion';
import { formatInteger } from '@/lib/maintaineros/format';
import { cn } from '@/lib/utils';

/* ─── Animated counter ───────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 20 });
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.4, ease: 'easeOut' });
    return c.stop;
  }, [inView, mv, to]);
  useEffect(() => spring.on('change', (v) => {
    if (ref.current) ref.current.textContent = formatInteger(Math.round(v)) + suffix;
  }), [spring, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

/* ─── Scroll-triggered fade-up ───────────────────── */
function FadeUp({
  children, delay = 0, className,
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Partner logo components ─────────────────────── */
function GitHubMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-[17px] shrink-0" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 10 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 20 10.017C20 4.484 15.522 0 10 0z" />
    </svg>
  );
}

const partners = [
  { name: 'GitHub',    icon: <GitHubMark /> },
  { name: 'Greptile',  icon: <Search className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'Clustly',  icon: <TrendingUp className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'Neon',      icon: <Zap className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'Codex',     icon: <Terminal className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'Cursor',    icon: <MousePointerClick className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'Anthropic', icon: <Cpu className="size-[15px] shrink-0" strokeWidth={2} /> },
  { name: 'CLOD',      icon: <Cloud className="size-[15px] shrink-0" strokeWidth={2} /> },
];

/* ─── Data ────────────────────────────────────────── */
const lanes = [
  {
    key: 'agent',
    label: 'Agent-safe',
    tag: 'Autonomous',
    icon: Bot,
    count: 430,
    percent: 43,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/25',
    hoverBorder: 'hover:border-emerald-500/50',
    accentBg: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/10',
    glowFrom: 'from-emerald-500/15',
    desc: 'Bounded scope, low risk, clear acceptance criteria. CLOD marks it safe. A work order goes to Codex or Cursor. PR submitted. Greptile verifies.',
  },
  {
    key: 'maintainer',
    label: 'Maintainer decision',
    tag: 'Human judgment',
    icon: UserCheck,
    count: 280,
    percent: 28,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/25',
    hoverBorder: 'hover:border-amber-500/50',
    accentBg: 'bg-amber-500',
    iconBg: 'bg-amber-500/10',
    glowFrom: 'from-amber-500/15',
    desc: 'Architecture, security, design tradeoffs. CLOD surfaces a decision brief with context. You approve, override, or redirect.',
  },
  {
    key: 'bounty',
    label: 'Bounty-worthy',
    tag: 'Funded',
    icon: Coins,
    count: 120,
    percent: 12,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/25',
    hoverBorder: 'hover:border-violet-500/50',
    accentBg: 'bg-violet-500',
    iconBg: 'bg-violet-500/10',
    glowFrom: 'from-violet-500/15',
    desc: 'Needs an outside contributor. Clustly funds the bounty. Release is gated on a Greptile-passing PR. No manual payout.',
  },
  {
    key: 'clarify',
    label: 'Close or clarify',
    tag: 'Needs info',
    icon: HelpCircle,
    count: 170,
    percent: 17,
    color: 'text-zinc-300',
    borderColor: 'border-zinc-500/25',
    hoverBorder: 'hover:border-zinc-400/50',
    accentBg: 'bg-zinc-400',
    iconBg: 'bg-zinc-500/10',
    glowFrom: 'from-zinc-400/15',
    desc: 'Vague reproduction, missing context, or out of scope. CLOD drafts the response. You send as-is or discard.',
  },
];

const issues = [
  { id: '#41', title: 'Incorrect cache invalidation on webhook replay', badge: 'AGENT', badgeCls: 'bg-emerald-950 text-emerald-400 border-emerald-800', action: 'Work order ready' },
  { id: '#52', title: 'Review branch preview permissions after dep upgrade', badge: 'REVIEW', badgeCls: 'bg-amber-950 text-amber-400 border-amber-800', action: 'Decision needed' },
  { id: '#77', title: 'Implement schema migrations adapter + acceptance tests', badge: 'BOUNTY', badgeCls: 'bg-violet-950 text-violet-400 border-violet-800', action: '$350 · Clustly' },
  { id: '#88', title: 'Clarify vague worker retry failure report', badge: 'CLARIFY', badgeCls: 'bg-zinc-800 text-zinc-400 border-zinc-700', action: 'Draft reply' },
];

const proofSteps = [
  {
    step: '01',
    icon: Inbox,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    bgColor: 'bg-emerald-500/[0.03]',
    numBg: 'bg-emerald-500/10',
    dotBg: 'bg-emerald-500',
    railFrom: 'from-emerald-500/40',
    title: 'Import from GitHub',
    desc: 'Every open issue ingested. CLOD scores risk, complexity, and confidence for each one. Takes seconds.',
    artifactKind: 'ingest' as const,
  },
  {
    step: '02',
    icon: Compass,
    color: 'text-sky-400',
    borderColor: 'border-sky-500/20',
    bgColor: 'bg-sky-500/[0.03]',
    numBg: 'bg-sky-500/10',
    dotBg: 'bg-sky-500',
    railFrom: 'from-sky-500/40',
    title: 'Route with rationale',
    desc: 'Agent, maintainer, bounty, or clarify. Every decision includes a confidence score and CLOD rationale. You override anything.',
    artifactKind: 'route' as const,
  },
  {
    step: '03',
    icon: ShieldCheck,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/20',
    bgColor: 'bg-violet-500/[0.03]',
    numBg: 'bg-violet-500/10',
    dotBg: 'bg-violet-500',
    railFrom: 'from-violet-500/40',
    title: 'Execute and verify',
    desc: 'Work orders dispatched to agents. PRs submitted. Greptile scans for correctness before merge is allowed.',
    artifactKind: 'verify' as const,
  },
  {
    step: '04',
    icon: BadgeCheck,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    bgColor: 'bg-amber-500/[0.03]',
    numBg: 'bg-amber-500/10',
    dotBg: 'bg-amber-500',
    railFrom: 'from-amber-500/40',
    title: 'Gated release',
    desc: 'Clustly releases bounty payment only after merge and Greptile pass. Every artifact tied back to the original issue.',
    artifactKind: 'release' as const,
  },
];

/* ─── Proof artifacts: mini UI snippets shown inside each step card ── */
function ProofArtifact({ kind }: { kind: 'ingest' | 'route' | 'verify' | 'release' }) {
  if (kind === 'ingest') {
    const rows = [
      { id: '#41', title: 'Cache invalidation on webhook replay', risk: '0.2', conf: '92' },
      { id: '#52', title: 'Branch preview permissions',           risk: '0.5', conf: '88' },
      { id: '#77', title: 'Schema migrations adapter',             risk: '0.7', conf: '84' },
    ];
    return (
      <div className="rounded-lg border border-white/8 bg-black/30 overflow-hidden font-mono text-[11px]">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2',
              i !== rows.length - 1 && 'border-b border-white/5',
            )}>
            <span className="text-zinc-500 w-8">{r.id}</span>
            <span className="text-zinc-300 flex-1 truncate">{r.title}</span>
            <span className="text-zinc-600 hidden sm:inline">risk {r.risk}</span>
            <span className="text-emerald-400">conf {r.conf}%</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'route') {
    return (
      <div className="rounded-lg border border-white/8 bg-black/30 p-3 font-mono text-[11px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-zinc-500">→</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
            AGENT-SAFE
          </span>
          <span className="text-zinc-500">·</span>
          <span className="text-sky-400">conf 0.91</span>
          <span className="ml-auto text-zinc-600 hidden sm:inline">override anytime</span>
        </div>
        <p className="text-zinc-400 leading-relaxed">
          <span className="text-zinc-600">rationale ›</span> Bounded scope, fixture exists, no data
          migration. Codex preferred for this surface.
        </p>
      </div>
    );
  }
  if (kind === 'verify') {
    return (
      <div className="rounded-lg border border-white/8 bg-black/30 p-3 font-mono text-[11px]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-zinc-300 font-semibold">PR #421</span>
          <span className="text-emerald-400">+47</span>
          <span className="text-rose-400">−12</span>
          <span className="text-zinc-600">·</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Check className="size-3" strokeWidth={3} />
            Greptile 4 / 4 pass
          </span>
          <span className="ml-auto text-zinc-500 hidden sm:inline">merge unlocked</span>
        </div>
      </div>
    );
  }
  // release
  return (
    <div className="rounded-lg border border-white/8 bg-black/30 p-3 font-mono text-[11px]">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <Check className="size-3" strokeWidth={3} />
          Merged
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-300">Clustly released</span>
        <span className="text-amber-400 font-semibold">$350</span>
        <span className="text-zinc-500">→ contributor.alex</span>
      </div>
    </div>
  );
}

const menuItems = [
  { name: 'How it works', href: '#how-it-works' },
  { name: 'Routes', href: '#routes' },
  { name: 'Demo', href: '#demo' },
  { name: 'GitHub', href: '#' },
];

/* ─── Animated pipeline dot ──────────────────────── */
function PipelineDot() {
  return (
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80"
      initial={{ left: '0%' }}
      animate={{ left: '100%' }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
    />
  );
}

/* ─── Live badge ──────────────────────────────────── */
function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 border border-emerald-800 bg-emerald-950/80 px-2.5 py-1 rounded">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
      </span>
      LIVE
    </div>
  );
}

/* ─── Nav ─────────────────────────────────────────── */
function HeroHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn('mx-auto mt-3 px-4 transition-all duration-500', scrolled ? 'max-w-4xl' : 'max-w-6xl')}>
        <div className={cn(
          'flex items-center justify-between rounded-2xl px-5 py-3 transition-all duration-500',
          scrolled ? 'border border-white/10 bg-[#030509]/85 backdrop-blur-xl shadow-xl shadow-black/50' : 'border border-transparent',
        )}>
          <Link href="/" className="flex items-center gap-2">
            <span className="font-heading font-bold text-[15px] tracking-tight text-white">MaintainerOS</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link key={item.name} href={item.href}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-all duration-200">
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="#demo"
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all duration-200">
              See demo
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="#connect"
                className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-200 inline-block">
                Connect repo
              </Link>
            </motion.div>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#030509]/95 backdrop-blur-xl p-4 lg:hidden">
            {menuItems.map((item) => (
              <Link key={item.name} href={item.href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm text-zinc-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
                {item.name}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10">
              <Link href="#connect" className="block text-center py-2.5 text-sm font-semibold bg-emerald-500 text-black rounded-xl">
                Connect repo
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </header>
  );
}

/* ─── Main export ─────────────────────────────────── */
export function HeroSection() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div className="bg-[#030509] font-sans overflow-x-hidden">
      <HeroHeader />

      <main>
        {/* ── Hero ── background image scoped here only */}
        <section ref={heroRef} className="relative pt-36 pb-16 px-6 overflow-hidden">

          <div className="pointer-events-none absolute inset-0">
            <Image src="/hero-bg.png" alt="" fill className="object-cover object-top opacity-70" priority />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#030509] to-transparent" />
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)`,
              backgroundSize: '48px 48px',
            }} />

          <div className="mx-auto max-w-5xl text-center relative">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}>
              <Link href="#demo"
                className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-300 group mb-10 backdrop-blur-sm">
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  43% of issues are agent-solvable
                </span>
                <span className="h-4 w-px bg-white/15" />
                <span className="flex items-center gap-1 text-emerald-400 group-hover:gap-2 transition-all duration-200">
                  See the routing <ArrowRight className="size-3" />
                </span>
              </Link>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading text-[clamp(2.8rem,8vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white mb-8">
              Turn 1,000 GitHub issues<br />
              into{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  routed work orders
                </span>
                <motion.span
                  aria-hidden
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  style={{ originX: 0 }}
                  className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-teal-400/0 block"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="mx-auto max-w-xl text-lg text-zinc-400 leading-relaxed mb-10">
              MaintainerOS routes every issue to the right lane — agent, maintainer, bounty, or close — with proof attached at every step.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
              <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                <Link href="#connect"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[15px] shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-colors duration-200">
                  <GitMerge className="size-4" />
                  Connect repo
                </Link>
              </motion.div>
              <Link href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/5 font-medium text-[15px] transition-all duration-200">
                How it works <ChevronRight className="size-4" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-wrap items-center justify-center gap-3 mb-16">
              {[
                { label: 'issues routed', value: 1000, suffix: '' },
                { label: 'agent-safe', value: 43, suffix: '%' },
                { label: 'avg confidence', value: 86, suffix: '%' },
                { label: 'bounty rate', value: 12, suffix: '%' },
              ].map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5 px-5 py-2.5 rounded-full border border-white/8 bg-white/3 backdrop-blur-sm">
                  <span className="font-heading font-bold text-xl text-white tabular-nums">
                    <Counter to={s.value} suffix={s.suffix} />
                  </span>
                  <span className="text-xs text-zinc-500">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ y: mockupY }}
            className="relative mx-auto max-w-5xl">
            <div className="absolute inset-0 -z-10 translate-y-4 scale-[0.97] rounded-3xl bg-emerald-500/8 blur-3xl" />
            <div className="rounded-2xl border border-white/10 bg-[#080d14] shadow-2xl shadow-black/70 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8 bg-[#0a1018]">
                <div className="flex gap-1.5">
                  {['bg-[#ff5f57]', 'bg-[#ffbd2e]', 'bg-[#28c840]'].map((c, i) => (
                    <span key={i} className={`size-3 rounded-full ${c} opacity-80`} />
                  ))}
                </div>
                <div className="flex-1 flex justify-center">
                  <span className="font-mono text-xs text-zinc-500 bg-white/5 px-4 py-1 rounded-md">
                    obro79 / maintaineros-demo-ledgerkit
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <LiveBadge />
                  <span className="font-mono text-[10px] text-zinc-600 border border-white/10 px-2 py-0.5 rounded">Neon</span>
                </div>
              </div>
              <div className="grid grid-cols-4 border-b border-white/8">
                {lanes.map((lane) => (
                  <div key={lane.key} className="px-5 py-4 border-r border-white/8 last:border-r-0">
                    <div className={`font-heading font-bold text-2xl tabular-nums ${lane.color}`}>{lane.count}</div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">{lane.label}</div>
                  </div>
                ))}
              </div>
              {issues.map((row, i) => (
                <div key={row.id}
                  className={cn('flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors', i === 0 && 'bg-white/[0.015]')}>
                  <span className="font-mono text-xs text-zinc-600 w-9 shrink-0">{row.id}</span>
                  <span className="flex-1 text-sm text-zinc-200 truncate">{row.title}</span>
                  <span className={cn('shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded border', row.badgeCls)}>{row.badge}</span>
                  <span className="hidden sm:block text-[11px] text-zinc-600 w-32 text-right shrink-0">{row.action}</span>
                </div>
              ))}
              <div className="relative flex items-center gap-2 px-5 py-3 bg-[#060a0f] border-t border-white/8 overflow-hidden">
                <PipelineDot />
                {['GitHub issue', 'CLOD route', 'Work order', 'PR proof', 'Greptile ✓', 'Clustly payout'].map((step, i) => (
                  <React.Fragment key={step}>
                    <span className={cn('text-[10px] font-mono whitespace-nowrap relative z-10',
                      step.includes('Greptile') ? 'text-emerald-500' :
                        step.includes('Clustly') ? 'text-violet-400' : 'text-zinc-700')}>
                      {step}
                    </span>
                    {i < 5 && <span className="text-zinc-800 text-[10px]">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Partners ── solid bg, no image bleed */}
        <section className="py-14 border-y border-white/6 bg-[#030509]">
          <motion.div
            className="mx-auto max-w-4xl px-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
            <motion.p
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4 } } }}
              className="text-center text-[10px] uppercase tracking-[0.25em] text-zinc-700 mb-8">
              Powered by
            </motion.p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {partners.map(({ name, icon }) => (
                <motion.div
                  key={name}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
                  }}
                  className="flex items-center gap-2 text-zinc-600 hover:text-zinc-300 transition-colors duration-200 cursor-default">
                  {icon}
                  <span className="font-heading font-semibold text-sm tracking-tight">{name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Routes ── */}
        <section id="routes" className="py-28 px-6 bg-[#030509]">
          <div className="mx-auto max-w-6xl">
            <FadeUp className="text-center mb-16">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-emerald-500/80 mb-4">Four lanes</p>
              <h2 className="font-heading text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.02em] text-white leading-tight">
                Every issue gets exactly<br />the right treatment
              </h2>
              <p className="mt-5 text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Not a priority label. A route decision with rationale, a confidence score, and the next action already built.
              </p>
            </FadeUp>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {lanes.map((lane, i) => {
                const Icon = lane.icon;
                return (
                  <FadeUp key={lane.key} delay={i * 0.07} className="h-full">
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                      className="group relative h-full rounded-2xl border border-white/[0.08] hover:border-white/[0.14] p-6 pl-7 bg-white/[0.015] hover:bg-white/[0.025] transition-colors duration-300 cursor-default flex flex-col overflow-hidden">
                      {/* Left accent rail (lane color) */}
                      <div className={cn(
                        'absolute left-0 inset-y-6 w-[2px] rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-300',
                        lane.accentBg,
                      )} />
                      {/* Soft top-right sheen on hover */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background:
                            'radial-gradient(ellipse 60% 50% at 100% 0%, rgba(255,255,255,0.04), transparent 70%)',
                        }}
                      />

                      {/* Header: tag + subtle icon */}
                      <div className="relative flex items-center justify-between mb-6">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400">
                          <span className={cn('inline-block size-1.5 rounded-full', lane.accentBg)} />
                          {lane.tag}
                        </span>
                        <Icon
                          className="size-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors duration-300"
                          strokeWidth={2}
                        />
                      </div>

                      {/* Title + description */}
                      <h3 className="relative font-heading font-bold text-[18px] text-white mb-2 tracking-tight">
                        {lane.label}
                      </h3>
                      <p className="relative text-[13px] text-zinc-500 leading-relaxed mb-6 flex-1">
                        {lane.desc}
                      </p>

                      {/* Share bar */}
                      <div className="relative">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className={cn('font-heading font-bold text-[28px] tabular-nums leading-none', lane.color)}>
                            <Counter to={lane.percent} suffix="%" />
                          </span>
                          <span className="text-[11px] font-mono text-zinc-600">
                            {formatInteger(lane.count)} of 1,000
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full', lane.accentBg)}
                            initial={{ width: '0%' }}
                            whileInView={{ width: `${lane.percent}%` }}
                            viewport={{ once: true, margin: '-60px' }}
                            transition={{ duration: 1.2, delay: 0.35 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Proof at every step ── */}
        <section id="how-it-works" className="py-28 px-6 border-t border-white/6 bg-[#030509]">
          <div className="mx-auto max-w-3xl">
            <FadeUp className="text-center mb-20">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-violet-400/80 mb-4">End-to-end</p>
              <h2 className="font-heading text-[clamp(2rem,5vw,3.5rem)] font-bold tracking-[-0.02em] text-white">
                Proof at every step
              </h2>
              <p className="mt-5 text-zinc-400 max-w-md mx-auto leading-relaxed">
                Every artifact is traceable back to the original issue. No black-box decisions, no mystery payouts.
              </p>
            </FadeUp>

            <div className="relative pl-8 sm:pl-12">
              {/* Rail: soft outer glow */}
              <div
                aria-hidden="true"
                className="absolute left-[5px] sm:left-[9px] top-2 bottom-2 w-[6px] rounded-full bg-gradient-to-b from-emerald-500/15 via-sky-500/12 to-amber-500/15 blur-[3px]"
              />
              {/* Rail: crisp core line */}
              <div
                aria-hidden="true"
                className="absolute left-[7px] sm:left-[11px] top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-emerald-500/55 via-sky-500/50 to-amber-500/55"
              />
              {/* Rail: top fade — softens the start */}
              <div
                aria-hidden="true"
                className="absolute left-[7px] sm:left-[11px] top-2 w-[2px] h-16 rounded-full bg-gradient-to-b from-[#030509] to-transparent"
              />
              {/* Rail: bottom fade — softens the end */}
              <div
                aria-hidden="true"
                className="absolute left-[7px] sm:left-[11px] bottom-2 w-[2px] h-16 rounded-full bg-gradient-to-t from-[#030509] to-transparent"
              />
              {/* Animated pulse traveling down the rail */}
              <motion.div
                aria-hidden="true"
                className="absolute left-[6px] sm:left-[10px] w-[4px] h-16 rounded-full bg-gradient-to-b from-transparent via-white/90 to-transparent blur-[2px] pointer-events-none"
                initial={{ top: '-4rem', opacity: 0 }}
                animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2, times: [0, 0.1, 0.9, 1] }}
              />

              <div className="space-y-4">
                {proofSteps.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <FadeUp key={s.step} delay={i * 0.1}>
                      <div className="relative">
                        {/* Timeline node — vertically centered on the card */}
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0 }}
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true, margin: '-60px' }}
                          transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute z-10 size-3 top-1/2 -translate-y-1/2 -left-[30px] sm:-left-[42px]"
                          aria-hidden="true">
                          {/* Outer halo — soft glow in lane color */}
                          <span className={cn(
                            'absolute -inset-2 rounded-full opacity-50 blur-[5px]',
                            s.dotBg,
                          )} />
                          {/* Slow ambient pulse ring */}
                          <span className={cn(
                            'absolute -inset-1 rounded-full opacity-20 animate-ping',
                            s.dotBg,
                          )} />
                          {/* Main nodule — crisp, with dark separator ring */}
                          <span className={cn(
                            'absolute inset-0 rounded-full ring-[3px] ring-[#030509]',
                            s.dotBg,
                          )}>
                            {/* Inner highlight for dimensionality */}
                            <span className="absolute top-[1.5px] left-[1.5px] size-[3px] rounded-full bg-white/50" />
                          </span>
                        </motion.div>

                        {/* Step card */}
                        <motion.div
                          whileHover={{ x: 4 }}
                          transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
                          className="group relative rounded-2xl border border-white/[0.08] hover:border-white/[0.14] bg-white/[0.015] hover:bg-white/[0.03] p-5 sm:p-6 transition-colors duration-300 cursor-default">
                          <div className="flex items-start gap-4 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Icon className="size-3.5 text-zinc-500" strokeWidth={2} />
                                <span className={cn('font-mono text-[11px] font-medium tracking-wider', s.color)}>
                                  STEP {s.step}
                                </span>
                                <span className="text-zinc-700">·</span>
                                <span className="font-mono text-[11px] text-zinc-500 uppercase tracking-wider">
                                  proof
                                </span>
                              </div>
                              <h3 className="font-heading font-semibold text-[17px] text-white tracking-tight">
                                {s.title}
                              </h3>
                            </div>
                            <ChevronRight className="shrink-0 size-4 mt-2 text-zinc-600 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-x-1 group-hover:translate-x-0" />
                          </div>

                          <p className="text-[13.5px] text-zinc-500 leading-relaxed mb-4 sm:pr-6">
                            {s.desc}
                          </p>

                          <ProofArtifact kind={s.artifactKind} />
                        </motion.div>
                      </div>
                    </FadeUp>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-32 px-6 bg-[#030509]">
          <FadeUp className="text-center">
            <div className="mx-auto max-w-2xl">
              <div className="relative mb-8">
                <div className="absolute inset-0 blur-3xl bg-emerald-500/15 rounded-full scale-75" />
                <h2 className="relative font-heading text-[clamp(2.2rem,6vw,4rem)] font-bold tracking-[-0.03em] text-white">
                  Your backlog is waiting.
                </h2>
              </div>
              <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-md mx-auto">
                Connect your GitHub repo and see every open issue routed in seconds.
              </p>
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="inline-block">
                <Link href="#connect"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-colors duration-200">
                  <GitMerge className="size-4" />
                  Connect your repo
                </Link>
              </motion.div>
            </div>
          </FadeUp>
        </section>
      </main>
    </div>
  );
}
