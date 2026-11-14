// Stripe webhook logic, kept free of Stripe and Supabase clients so it can be
// unit tested with fakes. The route (api/stripe/webhook) wires in the real ones.
//
// Two properties matter:
//   1. Idempotent. Stripe delivers events more than once. Each event ID is
//      recorded in stripe_events and a finished event is never applied twice.
//   2. Order-independent. Events can arrive out of order, so a subscription
//      event is only a signal: we re-read the subscription from Stripe and
//      store its current state, never the state inside the event payload.

import { isSubscriptionActive, planFromLookupKey, type PlanId } from "../plans.ts";

// The small part of a Stripe subscription this module reads.
export type SubscriptionLike = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string> | null;
  items: {
    data: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
      price?: { lookup_key?: string | null } | null;
    }>;
  };
};

export type StripeEventLike = {
  id: string;
  type: string;
  data: { object: unknown };
};

export type SubscriptionState = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: PlanId | null;
  status: string;
  quota: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type EventPhase = "new" | "retry" | "done";

export interface WebhookStore {
  // Records the event. "new": first time seen. "retry": seen before but never
  // finished (an earlier attempt failed). "done": already applied.
  beginEvent(id: string, type: string): Promise<EventPhase>;
  completeEvent(id: string): Promise<void>;
  findBusinessIdByCustomer(stripeCustomerId: string): Promise<string | null>;
  // Returns false when the business does not exist.
  applySubscription(businessId: string, state: SubscriptionState): Promise<boolean>;
}

export interface WebhookDeps {
  store: WebhookStore;
  fetchSubscription(id: string): Promise<SubscriptionLike>;
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

// Statuses where the subscription is over and nothing should stay attached.
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export function subscriptionToState(sub: SubscriptionLike): SubscriptionState {
  const item = sub.items.data[0];
  const plan = planFromLookupKey(item?.price?.lookup_key);
  const ended = ENDED_STATUSES.has(sub.status);
  // Quota is granted only while the subscription can actually be used.
  const usable = isSubscriptionActive(sub.status) && plan !== null;

  return {
    stripeCustomerId: idOf(sub.customer) ?? "",
    stripeSubscriptionId: ended ? null : sub.id,
    plan: ended ? null : (plan?.id ?? null),
    status: sub.status,
    quota: usable ? plan.monthlyGenerationQuota : 0,
    periodStart: ended ? null : toIso(item?.current_period_start),
    periodEnd: ended ? null : toIso(item?.current_period_end),
  };
}

async function syncSubscription(
  subscriptionId: string,
  hintedBusinessId: string | null,
  deps: WebhookDeps,
): Promise<boolean> {
  const sub = await deps.fetchSubscription(subscriptionId);
  const state = subscriptionToState(sub);
  const businessId =
    hintedBusinessId ??
    sub.metadata?.business_id ??
    (await deps.store.findBusinessIdByCustomer(state.stripeCustomerId));
  if (!businessId) return false;
  return deps.store.applySubscription(businessId, state);
}

export async function handleStripeEvent(
  event: StripeEventLike,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const phase = await deps.store.beginEvent(event.id, event.type);
  if (phase === "done") return "duplicate";

  let applied = false;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      mode?: string;
      subscription?: string | { id: string } | null;
      client_reference_id?: string | null;
    };
    const subscriptionId = idOf(session.subscription);
    if (session.mode === "subscription" && subscriptionId) {
      applied = await syncSubscription(
        subscriptionId,
        session.client_reference_id ?? null,
        deps,
      );
    }
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const sub = event.data.object as { id: string };
    applied = await syncSubscription(sub.id, null, deps);
  }

  // If anything above threw, the event stays unfinished and Stripe's retry
  // will run it again. Events we do not act on are still marked finished.
  await deps.store.completeEvent(event.id);
  return applied ? "processed" : "ignored";
}
