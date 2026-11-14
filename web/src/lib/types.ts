// Hand-written row types for Phase 1. Replace with generated Supabase types
// once the schema settles.

import type { PlanId } from "./plans";

export type Business = {
  id: string;
  owner_user_id: string;
  name: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanId | null;
  subscription_status: string;
  monthly_generation_quota: number;
  period_generations_used: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
