import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integration tests talk to the real Supabase project named in .env.local.
// They create throwaway users (rls-test-…@example.com) and delete them after.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const hasSupabaseEnv = Boolean(url && publishableKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  return createClient(url!, secretKey!, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(url!, publishableKey!, noSession);
}

export type TestTenant = {
  userId: string;
  client: SupabaseClient;
  businessId: string;
};

// Creates a confirmed user, signs in as them, and creates their business
// through their own client (so the insert itself is exercised under RLS).
export async function createTenant(admin: SupabaseClient, label: string): Promise<TestTenant> {
  const email = `rls-test-${label}-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const inserted = await client
    .from("businesses")
    .insert({ owner_user_id: userId, name: `Test business ${label}` })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;

  return { userId, client, businessId: inserted.data.id };
}

export async function deleteTenant(admin: SupabaseClient, tenant: TestTenant | undefined) {
  if (!tenant) return;
  // Deleting the auth user cascades to the business and everything under it.
  await admin.auth.admin.deleteUser(tenant.userId);
}
