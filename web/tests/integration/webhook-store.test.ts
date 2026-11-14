import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleStripeEvent,
  type StripeEventLike,
  type SubscriptionLike,
} from "@/lib/stripe/webhook-handler";
import { createWebhookStore } from "@/lib/stripe/webhook-store";
import { adminClient, createTenant, deleteTenant, hasSupabaseEnv, type TestTenant } from "./helpers";

// The same handler as the unit test, but against the real stripe_events and
// businesses tables. Stripe itself is faked.
describe.skipIf(!hasSupabaseEnv)("webhook idempotency against the database", () => {
  let admin: SupabaseClient;
  let tenant: TestTenant;
  const eventIds: string[] = [];
  const run = randomUUID().slice(0, 8);
  const subscriptionId = `sub_test_${run}`;
  const customerId = `cus_test_${run}`;

  const start = Math.floor(Date.now() / 1000);
  const month = 30 * 24 * 3600;

  function sub(periodStart: number, status = "active"): SubscriptionLike {
    return {
      id: subscriptionId,
      status,
      customer: customerId,
      metadata: { business_id: tenant.businessId },
      items: {
        data: [
          {
            current_period_start: periodStart,
            current_period_end: periodStart + month,
            price: { lookup_key: "loomxr_starter_monthly" },
          },
        ],
      },
    };
  }

  function event(type: string): StripeEventLike {
    const id = `evt_test_${randomUUID()}`;
    eventIds.push(id);
    return { id, type, data: { object: { id: subscriptionId } } };
  }

  async function business() {
    const { data, error } = await admin
      .from("businesses")
      .select(
        "plan, subscription_status, monthly_generation_quota, period_generations_used, stripe_subscription_id",
      )
      .eq("id", tenant.businessId)
      .single();
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    admin = adminClient();
    tenant = await createTenant(admin, "webhook");
  });

  afterAll(async () => {
    if (!hasSupabaseEnv) return;
    if (eventIds.length) await admin.from("stripe_events").delete().in("id", eventIds);
    await deleteTenant(admin, tenant);
  });

  it("applies an event once and reports later deliveries as duplicates", async () => {
    const store = createWebhookStore(admin);
    let fetches = 0;
    const deps = {
      store,
      fetchSubscription: async () => {
        fetches += 1;
        return sub(start);
      },
    };
    const evt = event("customer.subscription.created");

    expect(await handleStripeEvent(evt, deps)).toBe("processed");
    expect(await business()).toMatchObject({
      plan: "starter",
      subscription_status: "active",
      monthly_generation_quota: 500,
      stripe_subscription_id: subscriptionId,
    });

    // Simulate usage, then redeliver. A duplicate must not reset the counter
    // or touch Stripe again.
    await admin
      .from("businesses")
      .update({ period_generations_used: 7 })
      .eq("id", tenant.businessId);

    expect(await handleStripeEvent(evt, deps)).toBe("duplicate");
    expect(fetches).toBe(1);
    expect((await business()).period_generations_used).toBe(7);

    const row = await admin.from("stripe_events").select("processed_at").eq("id", evt.id).single();
    expect(row.data?.processed_at).not.toBeNull();
  });

  it("keeps the usage counter on an update inside the same period", async () => {
    const deps = { store: createWebhookStore(admin), fetchSubscription: async () => sub(start) };
    expect(await handleStripeEvent(event("customer.subscription.updated"), deps)).toBe("processed");
    expect((await business()).period_generations_used).toBe(7);
  });

  it("resets the usage counter when a new billing period starts", async () => {
    const deps = {
      store: createWebhookStore(admin),
      fetchSubscription: async () => sub(start + month),
    };
    expect(await handleStripeEvent(event("customer.subscription.updated"), deps)).toBe("processed");
    expect((await business()).period_generations_used).toBe(0);
  });

  it("removes the plan and quota when the subscription is cancelled", async () => {
    const deps = {
      store: createWebhookStore(admin),
      fetchSubscription: async () => sub(start + month, "canceled"),
    };
    expect(await handleStripeEvent(event("customer.subscription.deleted"), deps)).toBe("processed");
    expect(await business()).toMatchObject({
      plan: null,
      subscription_status: "canceled",
      monthly_generation_quota: 0,
      stripe_subscription_id: null,
    });
  });
});
