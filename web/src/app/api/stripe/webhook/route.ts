import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeEvent, type SubscriptionLike } from "@/lib/stripe/webhook-handler";
import { createWebhookStore } from "@/lib/stripe/webhook-store";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe calls this server to server. There is no user session; the signature
// check below is the authentication.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const stripe = getStripe();
  // The signature covers the exact bytes, so read the raw body.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, serverEnv.stripeWebhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, {
      store: createWebhookStore(createAdminClient()),
      fetchSubscription: async (id) =>
        (await stripe.subscriptions.retrieve(id)) as unknown as SubscriptionLike,
    });
    return Response.json({ received: true, outcome });
  } catch (error) {
    // A 500 makes Stripe retry later. The event row stays unfinished.
    console.error("Stripe webhook failed", event.id, event.type, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}
