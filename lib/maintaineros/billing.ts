export type BillingPlan = 'pro' | 'team';
export type BillingInterval = 'monthly' | 'annual';

export interface BillingConfig {
  enabled: boolean;
  appUrl: string;
  stripeSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  priceIds: Record<BillingPlan, Record<BillingInterval, string | null>>;
}

export function getBillingConfig(): BillingConfig {
  const priceIds = {
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || null,
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL || null,
    },
    team: {
      monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || null,
      annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || null,
    },
  };
  const stripeSecretConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasAnyPrice = Object.values(priceIds).some((plan) => Object.values(plan).some(Boolean));
  return {
    enabled: process.env.BILLING_ENABLED === 'true' && stripeSecretConfigured && hasAnyPrice,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010',
    stripeSecretConfigured,
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    priceIds,
  };
}

export function getStripePriceId(plan: BillingPlan, interval: BillingInterval) {
  return getBillingConfig().priceIds[plan][interval];
}
