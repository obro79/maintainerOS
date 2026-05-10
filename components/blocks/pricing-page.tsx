'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, GitMerge, Zap, ArrowRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SiteNav } from '@/components/layout/site-nav';

type Billing = 'monthly' | 'annual';
type PlanKey = 'free' | 'pro' | 'team';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    desc: 'For maintainers exploring the tool.',
    monthly: 0,
    annual: 0,
    color: 'text-zinc-300',
    accent: 'text-zinc-400',
    border: 'border-white/10',
    bg: 'bg-white/[0.02]',
    glow: '',
    cta: 'Get started free',
    ctaCls: 'border border-white/15 text-white hover:bg-white/8 hover:border-white/25',
    features: [
      '1 connected repository',
      'Up to 200 issues / month',
      'CLOD routing + rationale',
      'Four-lane classification',
      'Confidence scores',
      'CSV export',
    ],
    limits: ['No Clustly bounty integration', 'No Greptile verification'],
  },
  {
    key: 'pro',
    name: 'Pro',
    desc: 'For active maintainers and small teams.',
    monthly: 49,
    annual: 39,
    color: 'text-emerald-400',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/[0.06]',
    glow: 'shadow-2xl shadow-emerald-500/20',
    badge: 'Most popular',
    cta: 'Start free trial',
    ctaCls: 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50',
    features: [
      'Up to 5 repositories',
      'Unlimited issues',
      'CLOD routing + rationale',
      'Greptile PR verification',
      'Clustly bounty integration',
      'Override & re-route any issue',
      'Slack notifications',
      'Email support',
    ],
    limits: [],
  },
  {
    key: 'team',
    name: 'Team',
    desc: 'For orgs managing multiple repos at scale.',
    monthly: 149,
    annual: 119,
    color: 'text-violet-400',
    accent: 'text-violet-300',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/[0.04]',
    glow: 'shadow-xl shadow-violet-500/10',
    cta: 'Talk to us',
    ctaCls: 'border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/60',
    features: [
      'Unlimited repositories',
      'Unlimited issues',
      'Everything in Pro',
      'Custom routing rules & weights',
      'Per-repo Clustly budgets',
      'Audit trail export',
      'SSO (SAML)',
      'SLA + priority support',
      'Dedicated onboarding call',
    ],
    limits: [],
  },
] as const;

const FAQ = [
  { q: 'What counts as an "issue"?', a: 'Any open GitHub issue ingested and classified by CLOD. Closing or routing counts against your monthly limit. Re-routing does not.' },
  { q: 'How does Clustly bounty integration work?', a: 'When CLOD routes an issue as bounty-worthy, MaintainerOS sends it to Clustly with a suggested reward range. Clustly funds the bounty and releases payment only after a Greptile-verified PR merges.' },
  { q: 'What is Greptile verification?', a: 'Greptile scans the submitted PR against the original issue spec and routing rationale. It blocks merge if there are unresolved gaps. Included on Pro and Team.' },
  { q: "Can I override CLOD's routing decisions?", a: 'Yes — always. Every issue has an override button. CLOD surfaces a decision brief; you have final say on every route.' },
  { q: 'Is there a free trial for Pro?', a: '14 days, no credit card required. Full Pro access including Greptile and Clustly integrations.' },
];

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

export function PricingPage() {
  const [billing, setBilling] = useState<Billing>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkoutState, setCheckoutState] = useState<{ plan: PlanKey | null; message: string | null }>({ plan: null, message: null });

  async function startCheckout(plan: PlanKey) {
    if (plan === 'free') {
      window.location.assign('/connect');
      return;
    }
    if (plan === 'team') {
      window.location.assign('mailto:hi@maintaineros.dev?subject=MaintainerOS%20Team%20plan');
      return;
    }
    setCheckoutState({ plan, message: null });
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: billing }),
      });
      const payload = await response.json();
      if (payload?.url) {
        window.location.assign(payload.url);
        return;
      }
      setCheckoutState({ plan: null, message: payload?.reason ?? 'Checkout is not available yet.' });
    } catch {
      setCheckoutState({ plan: null, message: 'Checkout is not available yet.' });
    }
  }

  return (
    <div className="min-h-screen bg-[#030509] font-sans text-white overflow-x-hidden">
      <SiteNav />

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-violet-500/4 blur-[100px] rounded-full" />
      </div>

      {/* Hero */}
      <div className="relative pt-28 pb-14 px-6 text-center">
        <FadeUp>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 mb-6">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-xs text-emerald-400">340+ maintainers routing today</span>
          </div>
          <h1 className="font-heading text-[clamp(2.4rem,5vw,4rem)] font-bold tracking-[-0.02em] text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-zinc-400 max-w-md mx-auto text-lg leading-relaxed mb-8">
            Start free. Upgrade when your backlog demands it.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-white/3">
            {(['monthly', 'annual'] as Billing[]).map((b) => (
              <button key={b} onClick={() => setBilling(b)}
                className={cn(
                  'relative px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize',
                  billing === b
                    ? 'bg-white text-black shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}>
                {b}
                {b === 'annual' && (
                  <span className={cn(
                    'ml-1.5 text-[10px] font-bold transition-colors',
                    billing === 'annual' ? 'text-emerald-600' : 'text-emerald-500',
                  )}>−20%</span>
                )}
              </button>
            ))}
          </div>
        </FadeUp>
      </div>

      {/* Plans */}
      <div className="relative mx-auto max-w-5xl px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-4 items-end">
          {PLANS.map((plan, i) => {
            const price = billing === 'annual' ? plan.annual : plan.monthly;
            const isPro = plan.key === 'pro';
            return (
              <FadeUp key={plan.key} delay={i * 0.07} className={cn('h-full', isPro && 'md:-mt-4')}>
                <div className={cn(
                  'relative h-full rounded-2xl border p-6 flex flex-col transition-all duration-300',
                  plan.border, plan.bg,
                  isPro && plan.glow,
                )}>
                  {/* Pro ambient glow */}
                  {isPro && (
                    <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
                  )}

                  {'badge' in plan && plan.badge && (
                    <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-black font-mono shadow-lg shadow-emerald-500/30">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-5 pt-2">
                    <div className={cn('font-heading font-bold text-xl mb-1', plan.color)}>{plan.name}</div>
                    <p className="text-sm text-zinc-500 leading-snug">{plan.desc}</p>
                  </div>

                  <div className="mb-5 pb-5 border-b border-white/8">
                    <div className="flex items-baseline gap-1">
                      <span className="font-heading font-bold text-4xl text-white">
                        {price === 0 ? 'Free' : `$${price}`}
                      </span>
                      {price > 0 && <span className="text-zinc-600 text-sm">/ mo</span>}
                    </div>
                    {price > 0 && billing === 'annual' && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Billed annually · ${plan.monthly}/mo billed monthly
                      </p>
                    )}
                    {price === 0 && <p className="text-[11px] text-zinc-600 mt-1">No credit card required</p>}
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mb-6">
                    <button
                      type="button"
                      disabled={checkoutState.plan === plan.key}
                      onClick={() => startCheckout(plan.key)}
                      className={cn(
                        'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer',
                        plan.ctaCls,
                        checkoutState.plan === plan.key && 'opacity-70',
                      )}>
                      {plan.key === 'free' && <GitMerge className="size-4" />}
                      {plan.key === 'pro' && <Zap className="size-4" />}
                      {plan.key === 'team' && <ArrowRight className="size-4" />}
                      {checkoutState.plan === plan.key ? 'Starting...' : plan.cta}
                    </button>
                    {checkoutState.message && plan.key === 'pro' && (
                      <p className="mt-2 text-center text-[11px] text-amber-300">{checkoutState.message}</p>
                    )}
                  </motion.div>

                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check className={cn('size-4 shrink-0 mt-0.5', plan.color)} />
                        {f}
                      </li>
                    ))}
                    {'limits' in plan && plan.limits.map((l) => (
                      <li key={l} className="flex items-start gap-2.5 text-sm text-zinc-600">
                        <Minus className="size-4 shrink-0 mt-0.5" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="border-t border-white/6 py-16 px-6">
        <div className="mx-auto max-w-2xl">
          <FadeUp className="text-center mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-600 mb-3">FAQ</p>
            <h2 className="font-heading text-2xl font-bold text-white">Common questions</h2>
          </FadeUp>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <FadeUp key={i} delay={i * 0.04}>
                <div className={cn(
                  'rounded-xl border transition-all duration-200',
                  openFaq === i ? 'border-white/12 bg-white/[0.03]' : 'border-white/8 bg-white/[0.015]',
                )}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer">
                    <span className="font-medium text-[15px] text-white">{item.q}</span>
                    <motion.div
                      animate={{ rotate: openFaq === i ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 size-5 rounded-full border border-white/15 flex items-center justify-center text-zinc-500 text-sm leading-none">
                      +
                    </motion.div>
                  </button>
                  {openFaq === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="px-5 pb-4 overflow-hidden">
                      <p className="text-sm text-zinc-400 leading-relaxed border-t border-white/6 pt-3">{item.a}</p>
                    </motion.div>
                  )}
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/6 py-24 px-6 text-center">
        <FadeUp>
          <div className="mx-auto max-w-xl">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl bg-emerald-500/12 rounded-full scale-150 pointer-events-none" />
              <h2 className="relative font-heading text-3xl font-bold text-white">Start routing today.</h2>
            </div>
            <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
              Free plan, no credit card. Connect your first repo in under a minute.
            </p>
            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} className="inline-block">
              <Link href="/connect"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200">
                <GitMerge className="size-4" />
                Connect repo — it&apos;s free
              </Link>
            </motion.div>
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
