// Local stand-in for the Stripe webhook.
//
// Stripe can only call a public URL, and localhost is not one. Instead of a
// tunnel, this script asks Stripe for recent events and runs each through the
// same handler the webhook route uses. Already-applied events are skipped, so
// it is safe to run as often as you like.
//
//   pnpm stripe:pull           process events from the last 24 hours, then exit
//   pnpm stripe:pull --watch   keep checking every 3 seconds
//
// Test mode only. The deployed app uses the real webhook route instead.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { handleStripeEvent, type SubscriptionLike } from "../src/lib/stripe/webhook-handler.ts";
import { createWebhookStore } from "../src/lib/stripe/webhook-store.ts";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

if (!stripeKey || !supabaseUrl || !supabaseSecret) {
  console.error("Set STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in web/.env.local.");
  process.exit(1);
}
if (!stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("rk_test_")) {
  console.error("Refusing to run: STRIPE_SECRET_KEY is not a test-mode key.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const store = createWebhookStore(
  createClient(supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
const deps = {
  store,
  fetchSubscription: async (id: string) =>
    (await stripe.subscriptions.retrieve(id)) as unknown as SubscriptionLike,
};

const TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
];

async function pullOnce(sinceSeconds: number): Promise<void> {
  const events: Stripe.Event[] = [];
  for await (const event of stripe.events.list({
    types: TYPES,
    created: { gte: sinceSeconds },
    limit: 100,
  })) {
    events.push(event);
  }
  // Stripe lists newest first; apply oldest first.
  events.reverse();

  for (const event of events) {
    const outcome = await handleStripeEvent(event, deps);
    if (outcome !== "duplicate") console.log(`${outcome.padEnd(9)} ${event.type}  ${event.id}`);
  }
}

const since = Math.floor(Date.now() / 1000) - 24 * 3600;
const watch = process.argv.includes("--watch");

await pullOnce(since);
if (watch) {
  console.log("Watching for Stripe events. Press Ctrl+C to stop.");
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      await pullOnce(since);
    } catch (error) {
      console.error("Pull failed, will retry:", error instanceof Error ? error.message : error);
    }
  }
} else {
  console.log("Done.");
}
