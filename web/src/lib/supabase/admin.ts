import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

let cached: SupabaseClient | undefined;

// Secret-key client. BYPASSES RLS. Use only in server routes, and only after
// the route has done its own authorization check.
export function createAdminClient(): SupabaseClient {
  cached ??= createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
