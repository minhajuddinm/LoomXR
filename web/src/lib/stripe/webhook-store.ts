import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventPhase, SubscriptionState, WebhookStore } from "./webhook-handler";

const UNIQUE_VIOLATION = "23505";

// WebhookStore backed by Supabase. Pass the secret-key (admin) client.
export function createWebhookStore(db: SupabaseClient): WebhookStore {
  return {
    async beginEvent(id, type): Promise<EventPhase> {
      const { error } = await db.from("stripe_events").insert({ id, type });
      if (!error) return "new";
      if (error.code !== UNIQUE_VIOLATION) {
        throw new Error(`stripe_events insert failed: ${error.message}`);
      }
      const { data, error: readError } = await db
        .from("stripe_events")
        .select("processed_at")
        .eq("id", id)
        .single();
      if (readError) throw new Error(`stripe_events read failed: ${readError.message}`);
      return data.processed_at ? "done" : "retry";
    },

    async completeEvent(id) {
      const { error } = await db
        .from("stripe_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`stripe_events update failed: ${error.message}`);
    },

    async findBusinessIdByCustomer(stripeCustomerId) {
      if (!stripeCustomerId) return null;
      const { data, error } = await db
        .from("businesses")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();
      if (error) throw new Error(`business lookup failed: ${error.message}`);
      return data?.id ?? null;
    },

    async applySubscription(businessId: string, state: SubscriptionState) {
      const { data, error } = await db.rpc("apply_subscription_state", {
        p_business_id: businessId,
        p_stripe_customer_id: state.stripeCustomerId || null,
        p_stripe_subscription_id: state.stripeSubscriptionId,
        p_plan: state.plan,
        p_status: state.status,
        p_quota: state.quota,
        p_period_start: state.periodStart,
        p_period_end: state.periodEnd,
      });
      if (error) throw new Error(`apply_subscription_state failed: ${error.message}`);
      return data === true;
    },
  };
}
