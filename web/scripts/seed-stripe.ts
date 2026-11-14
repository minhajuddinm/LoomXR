// Creates the Stripe products, prices and Customer Portal configuration for
// the plans in src/lib/plans.ts. Safe to run more than once.
//
//   pnpm seed:stripe
//
// Reads STRIPE_SECRET_KEY from .env.local and refuses to run on a live key.

import Stripe from "stripe";
import { PLANS } from "../src/lib/plans.ts";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Add it to web/.env.local.");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("Refusing to seed: STRIPE_SECRET_KEY is not a test-mode key.");
  process.exit(1);
}

const stripe = new Stripe(key);
const priceIds: string[] = [];
const productIds: string[] = [];

for (const plan of PLANS) {
  const existing = await stripe.prices.list({
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });

  if (existing.data[0]) {
    const price = existing.data[0];
    priceIds.push(price.id);
    productIds.push(typeof price.product === "string" ? price.product : price.product.id);
    console.log(`= ${plan.name}: price ${price.id} already exists`);
    continue;
  }

  const product = await stripe.products.create({
    name: `LoomXR ${plan.name}`,
    description: `${plan.monthlyGenerationQuota} design generations per month. ${plan.blurb}`,
    metadata: { plan: plan.id },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.priceCents,
    currency: plan.currency,
    recurring: { interval: "month" },
    lookup_key: plan.lookupKey,
    metadata: { plan: plan.id },
  });
  priceIds.push(price.id);
  productIds.push(product.id);
  console.log(`+ ${plan.name}: product ${product.id}, price ${price.id}`);
}

// A portal configuration that lets subscribers switch between the three plans.
if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
  console.log("= Portal configuration already set in env, skipping.");
} else {
  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your LoomXR subscription" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: productIds.map((product, i) => ({ product, prices: [priceIds[i]] })),
      },
    },
  });
  console.log("+ Portal configuration created. Add this line to web/.env.local:");
  console.log(`STRIPE_PORTAL_CONFIGURATION_ID=${configuration.id}`);
}
