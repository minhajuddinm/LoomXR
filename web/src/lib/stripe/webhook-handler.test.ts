import { describe, expect, it } from "vitest";
import {
  handleStripeEvent,
  subscriptionToState,
  type EventPhase,
  type StripeEventLike,
  type SubscriptionLike,
  type SubscriptionState,
  type WebhookStore,
} from "./webhook-handler";

const BUSINESS = "11111111-1111-1111-1111-111111111111";
const PERIOD_START = 1_800_000_000;
const PERIOD_END = PERIOD_START + 30 * 24 * 3600;

function subscription(overrides: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { business_id: BUSINESS },
    items: {
      data: [
        {
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
          price: { lookup_key: "loomxr_growth_monthly" },
        },
      ],
    },
    ...overrides,
  };
}

// In-memory stand-in for the stripe_events and businesses tables.
function fakeStore(options: { customers?: Record<string, string>; failApply?: number } = {}) {
  const events = new Map<string, { processed: boolean }>();
  const applied: Array<{ businessId: string; state: SubscriptionState }> = [];
  let failuresLeft = options.failApply ?? 0;

  const store: WebhookStore = {
    async beginEvent(id): Promise<EventPhase> {
      const existing = events.get(id);
      if (!existing) {
        events.set(id, { processed: false });
        return "new";
      }
      return existing.processed ? "done" : "retry";
    },
    async completeEvent(id) {
      events.get(id)!.processed = true;
    },
    async findBusinessIdByCustomer(customerId) {
      return options.customers?.[customerId] ?? null;
    },
    async applySubscription(businessId, state) {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("database unavailable");
      }
      applied.push({ businessId, state });
      return true;
    },
  };
  return { store, events, applied };
}

function event(type: string, object: unknown, id = "evt_1"): StripeEventLike {
  return { id, type, data: { object } };
}

describe("subscriptionToState", () => {
  it("maps an active subscription to its plan and quota", () => {
    expect(subscriptionToState(subscription())).toEqual({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      plan: "growth",
      status: "active",
      quota: 2000,
      periodStart: new Date(PERIOD_START * 1000).toISOString(),
      periodEnd: new Date(PERIOD_END * 1000).toISOString(),
    });
  });

  it("keeps the plan but grants no quota while payment is past due", () => {
    const state = subscriptionToState(subscription({ status: "past_due" }));
    expect(state.plan).toBe("growth");
    expect(state.quota).toBe(0);
    expect(state.stripeSubscriptionId).toBe("sub_1");
  });

  it("clears everything once the subscription is cancelled", () => {
    const state = subscriptionToState(subscription({ status: "canceled" }));
    expect(state).toMatchObject({
      plan: null,
      quota: 0,
      stripeSubscriptionId: null,
      periodStart: null,
      periodEnd: null,
      status: "canceled",
    });
  });

  it("grants no quota for a price that is not one of our plans", () => {
    const sub = subscription();
    sub.items.data[0].price = { lookup_key: "some_other_product" };
    expect(subscriptionToState(sub)).toMatchObject({ plan: null, quota: 0 });
  });

  it("accepts an expanded customer object", () => {
    expect(subscriptionToState(subscription({ customer: { id: "cus_9" } })).stripeCustomerId).toBe(
      "cus_9",
    );
  });
});

describe("handleStripeEvent", () => {
  it("applies a subscription event once, however many times it is delivered", async () => {
    const { store, applied } = fakeStore();
    const deps = { store, fetchSubscription: async () => subscription() };
    const evt = event("customer.subscription.updated", { id: "sub_1" });

    expect(await handleStripeEvent(evt, deps)).toBe("processed");
    expect(await handleStripeEvent(evt, deps)).toBe("duplicate");
    expect(await handleStripeEvent(evt, deps)).toBe("duplicate");

    expect(applied).toHaveLength(1);
    expect(applied[0].businessId).toBe(BUSINESS);
  });

  it("does not fetch from Stripe again for a duplicate", async () => {
    const { store } = fakeStore();
    let fetches = 0;
    const deps = {
      store,
      fetchSubscription: async () => {
        fetches += 1;
        return subscription();
      },
    };
    const evt = event("customer.subscription.created", { id: "sub_1" });
    await handleStripeEvent(evt, deps);
    await handleStripeEvent(evt, deps);
    expect(fetches).toBe(1);
  });

  it("retries an event whose first attempt failed", async () => {
    const { store, events, applied } = fakeStore({ failApply: 1 });
    const deps = { store, fetchSubscription: async () => subscription() };
    const evt = event("customer.subscription.updated", { id: "sub_1" });

    await expect(handleStripeEvent(evt, deps)).rejects.toThrow("database unavailable");
    expect(events.get("evt_1")).toEqual({ processed: false });
    expect(applied).toHaveLength(0);

    expect(await handleStripeEvent(evt, deps)).toBe("processed");
    expect(applied).toHaveLength(1);
    expect(await handleStripeEvent(evt, deps)).toBe("duplicate");
  });

  it("stores the state Stripe reports now, not the state inside the event", async () => {
    const { store, applied } = fakeStore();
    // A stale "updated" event arrives after the subscription was cancelled.
    const deps = {
      store,
      fetchSubscription: async () => subscription({ status: "canceled" }),
    };
    const stale = event("customer.subscription.updated", { id: "sub_1", status: "active" });

    await handleStripeEvent(stale, deps);
    expect(applied[0].state).toMatchObject({ status: "canceled", plan: null, quota: 0 });
  });

  it("links a completed checkout to the business in client_reference_id", async () => {
    const { store, applied } = fakeStore();
    const deps = {
      store,
      fetchSubscription: async () => subscription({ metadata: {} }),
    };
    const evt = event("checkout.session.completed", {
      mode: "subscription",
      subscription: "sub_1",
      client_reference_id: BUSINESS,
    });

    expect(await handleStripeEvent(evt, deps)).toBe("processed");
    expect(applied[0]).toMatchObject({ businessId: BUSINESS, state: { plan: "growth" } });
  });

  it("falls back to the Stripe customer when the subscription has no metadata", async () => {
    const { store, applied } = fakeStore({ customers: { cus_1: BUSINESS } });
    const deps = { store, fetchSubscription: async () => subscription({ metadata: null }) };

    await handleStripeEvent(event("customer.subscription.updated", { id: "sub_1" }), deps);
    expect(applied[0].businessId).toBe(BUSINESS);
  });

  it("finishes, without applying, a subscription that belongs to no business", async () => {
    const { store, events, applied } = fakeStore();
    const deps = { store, fetchSubscription: async () => subscription({ metadata: null }) };

    const outcome = await handleStripeEvent(
      event("customer.subscription.updated", { id: "sub_1" }),
      deps,
    );
    expect(outcome).toBe("ignored");
    expect(applied).toHaveLength(0);
    expect(events.get("evt_1")).toEqual({ processed: true });
  });

  it("records and ignores event types it does not handle", async () => {
    const { store, events, applied } = fakeStore();
    const deps = {
      store,
      fetchSubscription: async () => {
        throw new Error("should not be called");
      },
    };

    expect(await handleStripeEvent(event("invoice.paid", { id: "in_1" }), deps)).toBe("ignored");
    expect(applied).toHaveLength(0);
    expect(events.get("evt_1")).toEqual({ processed: true });
  });

  it("ignores a one-off (non-subscription) checkout", async () => {
    const { store, applied } = fakeStore();
    const deps = { store, fetchSubscription: async () => subscription() };
    const evt = event("checkout.session.completed", { mode: "payment", subscription: null });

    expect(await handleStripeEvent(evt, deps)).toBe("ignored");
    expect(applied).toHaveLength(0);
  });
});
