import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getBillingConfig, type BillingInterval, type BillingPlan } from '@/lib/maintaineros/billing';
import { getAuthConfig } from '@/lib/maintaineros/auth';

const VALID_PLANS: BillingPlan[] = ['pro', 'team'];
const VALID_INTERVALS: BillingInterval[] = ['monthly', 'annual'];

export async function POST(request: Request) {
  const billing = getBillingConfig();
  if (!billing.enabled) {
    return NextResponse.json(
      { ok: false, reason: 'Billing is disabled. Set BILLING_ENABLED=true, STRIPE_SECRET_KEY, and Stripe price IDs to enable checkout.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as Partial<{ plan: string; interval: string }>;
  const plan = body.plan;
  const interval = body.interval;

  if (!VALID_PLANS.includes(plan as BillingPlan) || !VALID_INTERVALS.includes(interval as BillingInterval)) {
    return NextResponse.json({ ok: false, reason: 'Invalid checkout plan or billing interval.' }, { status: 400 });
  }

  const planKey = plan as BillingPlan;
  const intervalKey = interval as BillingInterval;
  const priceId = billing.priceIds[planKey][intervalKey];
  if (!priceId) {
    return NextResponse.json({ ok: false, reason: 'Stripe price is not configured for this plan and interval.' }, { status: 503 });
  }

  try {
    const auth = getAuthConfig();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${billing.appUrl}/connect?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${billing.appUrl}/pricing?checkout=cancelled`,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        maintaineros_plan: planKey,
        maintaineros_interval: intervalKey,
        auth_enabled: String(auth.enabled),
        auth_provider: auth.provider,
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : 'Stripe checkout failed.' },
      { status: 502 },
    );
  }
}
