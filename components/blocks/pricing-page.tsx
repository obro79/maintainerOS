'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, GitMerge, Minus, Sparkles } from 'lucide-react';
import { PageFrame, PageHeader, PageShell, Surface } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';

type Billing = 'monthly' | 'annual';
type PlanKey = 'free' | 'pro' | 'team';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    desc: 'For maintainers exploring the workflow.',
    monthly: 0,
    annual: 0,
    tone: 'text-[#F9F7F7]/78',
    border: 'border-[#F9F7F7]/12',
    cta: 'Get started free',
    ctaClass: 'border border-[#F9F7F7]/14 text-[#F9F7F7] hover:bg-[#F9F7F7]/7',
    features: ['1 connected repository', 'Up to 200 issues / month', 'CLOD routing rationale', 'Four-lane classification', 'CSV export'],
    limits: ['No Clustly bounty integration', 'No Greptile verification'],
  },
  {
    key: 'pro',
    name: 'Pro',
    desc: 'For active maintainers and small teams.',
    monthly: 49,
    annual: 39,
    tone: 'text-[#3F72AF]',
    border: 'border-[#3F72AF]/36',
    badge: 'Most popular',
    cta: 'Start free trial',
    ctaClass: 'bg-[#3F72AF] text-black hover:bg-[#F9F7F7] shadow-lg shadow-[#3F72AF]/20',
    features: ['Up to 5 repositories', 'Unlimited issues', 'Greptile PR verification', 'Clustly bounty integration', 'Override and reroute any issue', 'Email support'],
    limits: [],
  },
  {
    key: 'team',
    name: 'Team',
    desc: 'For orgs managing multiple repos at scale.',
    monthly: 149,
    annual: 119,
    tone: 'text-[#DBE2EF]',
    border: 'border-[#112D4E]/42',
    cta: 'Talk to us',
    ctaClass: 'border border-[#112D4E]/45 text-[#DBE2EF] hover:bg-[#112D4E]/12',
    features: ['Unlimited repositories', 'Everything in Pro', 'Custom routing rules', 'Per-repo Clustly budgets', 'Audit trail export', 'Priority support'],
    limits: [],
  },
] as const;

const FAQ = [
  { q: 'What counts as an issue?', a: 'Any open GitHub issue imported and classified by MaintainerOS.' },
  { q: 'How does Clustly bounty integration work?', a: 'Bounty-worthy issues are packaged for Clustly with a suggested reward and proof gates.' },
  { q: 'What is Greptile verification?', a: 'Greptile checks a submitted PR against the original issue and routing rationale before merge.' },
  { q: 'Can I override routing decisions?', a: 'Yes. The maintainer always has final say, and overrides become part of the audit trail.' },
];

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
    <PageShell>
      <PageFrame>
        <PageHeader
          align="center"
          eyebrow="Pricing"
          title="Simple pricing for routed maintenance."
          description="Start with one repository, then add verification, bounties, and team controls as the workflow becomes real."
        />

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-lg border border-[#F9F7F7]/12 bg-black/24 p-1">
            {(['monthly', 'annual'] as Billing[]).map((option) => (
              <button
                key={option}
                onClick={() => setBilling(option)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm capitalize transition-colors',
                  billing === option ? 'bg-[#F9F7F7] text-black' : 'text-[#F9F7F7]/58 hover:text-white',
                )}
              >
                {option}
                {option === 'annual' && <span className="ml-1 text-[#112D4E]">-20%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const price = billing === 'annual' ? plan.annual : plan.monthly;
            return (
              <Surface key={plan.key} className={cn('relative flex min-h-[520px] flex-col p-6', plan.border)}>
                {'badge' in plan && plan.badge && (
                  <div className="absolute right-4 top-4 rounded-full border border-[#3F72AF]/30 bg-[#3F72AF]/10 px-2.5 py-1 text-xs text-[#3F72AF]">
                    {plan.badge}
                  </div>
                )}
                <Sparkles className={cn('size-5', plan.tone)} />
                <h2 className={cn('mt-6 text-2xl font-semibold tracking-[-0.03em]', plan.tone)}>{plan.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#F9F7F7]/55">{plan.desc}</p>
                <div className="mt-6 border-y border-[#F9F7F7]/10 py-5">
                  <span className="text-4xl font-semibold tracking-[-0.04em] text-white">{price === 0 ? 'Free' : `$${price}`}</span>
                  {price > 0 && <span className="ml-1 text-sm text-[#F9F7F7]/42">/ mo</span>}
                </div>
                <button
                  type="button"
                  onClick={() => startCheckout(plan.key)}
                  disabled={checkoutState.plan === plan.key}
                  className={cn('mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-60', plan.ctaClass)}
                >
                  {checkoutState.plan === plan.key ? 'Starting...' : plan.cta}
                </button>
                {checkoutState.message && plan.key === 'pro' && <p className="mt-2 text-xs text-[#3F72AF]">{checkoutState.message}</p>}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-6 text-[#F9F7F7]/72">
                      <Check className={cn('mt-1 size-3.5 shrink-0', plan.tone)} />
                      {feature}
                    </li>
                  ))}
                  {plan.limits.map((limit) => (
                    <li key={limit} className="flex gap-2 text-sm leading-6 text-[#F9F7F7]/34">
                      <Minus className="mt-1 size-3.5 shrink-0" />
                      {limit}
                    </li>
                  ))}
                </ul>
              </Surface>
            );
          })}
        </div>

        <section className="mt-16 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#112D4E]">FAQ</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">Common questions.</h2>
          </div>
          <div className="space-y-2">
            {FAQ.map((item, index) => (
              <Surface key={item.q}>
                <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                  <span className="text-base font-semibold text-white">{item.q}</span>
                  <span className="text-xl text-[#F9F7F7]/44">{openFaq === index ? '-' : '+'}</span>
                </button>
                {openFaq === index && <p className="border-t border-[#F9F7F7]/10 px-5 py-4 text-sm leading-6 text-[#F9F7F7]/58">{item.a}</p>}
              </Surface>
            ))}
          </div>
        </section>

        <Surface className="mt-16 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em]">Start routing today.</h2>
            <p className="mt-2 text-[#F9F7F7]/55">Free plan, no credit card. Connect your first repo in under a minute.</p>
          </div>
          <Link href="/connect" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3F72AF] px-4 text-sm font-semibold text-black transition-colors hover:bg-[#F9F7F7]">
            <GitMerge className="size-4" />
            Connect repo
          </Link>
        </Surface>
      </PageFrame>
    </PageShell>
  );
}
