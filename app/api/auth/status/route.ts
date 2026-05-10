import { NextResponse } from 'next/server';
import { getAuthConfig } from '@/lib/maintaineros/auth';
import { getBillingConfig } from '@/lib/maintaineros/billing';

export function GET() {
  const auth = getAuthConfig();
  const billing = getBillingConfig();
  return NextResponse.json({
    auth,
    billing: {
      enabled: billing.enabled,
      stripeSecretConfigured: billing.stripeSecretConfigured,
      webhookSecretConfigured: billing.webhookSecretConfigured,
      priceIdsConfigured: Object.fromEntries(
        Object.entries(billing.priceIds).map(([plan, intervals]) => [
          plan,
          Object.fromEntries(Object.entries(intervals).map(([interval, value]) => [interval, Boolean(value)])),
        ]),
      ),
    },
  });
}
