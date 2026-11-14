import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Business } from "@/lib/types";

// DEMO MODE: no login, no subscription check. Everyone who opens the app works
// inside one shared "Demo business". It exists so the product, generation and
// AR flows can be tried before accounts and billing are switched back on.
//
// It is on only when DEMO_MODE=true. Never set that in production: anyone with
// the URL can edit the demo business and spend generation credits.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

const SETTING_KEY = "demo_business_id";

export const getDemoBusiness = cache(async (): Promise<Business> => {
  const db = createAdminClient();

  const setting = await db.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
  if (typeof setting.data?.value === "string") {
    const found = await db.from("businesses").select("*").eq("id", setting.data.value).maybeSingle();
    if (found.data) return found.data as Business;
  }

  // First use: a business row needs an owner, so create a login-less owner.
  const owner = await db.auth.admin.createUser({
    email: `demo-owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
    email_confirm: true,
  });
  if (owner.error) throw new Error(`Could not create demo owner: ${owner.error.message}`);

  const created = await db
    .from("businesses")
    .insert({ owner_user_id: owner.data.user.id, name: "Demo business" })
    .select("*")
    .single();
  if (created.error) throw new Error(`Could not create demo business: ${created.error.message}`);

  await db.from("app_settings").upsert({ key: SETTING_KEY, value: created.data.id });
  return created.data as Business;
});
