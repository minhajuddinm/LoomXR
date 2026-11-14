// Subscription plans. PLACEHOLDER prices and quotas until real pricing is set.
// One "generation" is one round of designs for one customer.
//
// Stripe prices are found by lookup key, so no price IDs live in env vars.
// `pnpm seed:stripe` creates the matching Stripe products and prices.
//
// This file is also imported by scripts/seed-stripe.ts under plain Node, so
// keep it free of path aliases and non-erasable TypeScript.

export type PlanId = "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: "cad";
  monthlyGenerationQuota: number;
  lookupKey: string;
  blurb: string;
};

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 4900,
    currency: "cad",
    monthlyGenerationQuota: 500,
    lookupKey: "loomxr_starter_monthly",
    blurb: "One store trying personalized packaging.",
  },
  {
    id: "growth",
    name: "Growth",
    priceCents: 14900,
    currency: "cad",
    monthlyGenerationQuota: 2000,
    lookupKey: "loomxr_growth_monthly",
    blurb: "Several products or locations.",
  },
  {
    id: "scale",
    name: "Scale",
    priceCents: 39900,
    currency: "cad",
    monthlyGenerationQuota: 6000,
    lookupKey: "loomxr_scale_monthly",
    blurb: "High-traffic retail.",
  },
];

export function getPlan(id: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

export function planFromLookupKey(key: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.lookupKey === key) ?? null;
}

// Billing switch. While the company's Stripe account is being set up, billing
// is off: no subscription is needed and no quota is enforced. Set
// BILLING_REQUIRED=true once Stripe is connected.
export function isBillingRequired(): boolean {
  return process.env.BILLING_REQUIRED === "true";
}

// Statuses that let a business generate designs.
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
