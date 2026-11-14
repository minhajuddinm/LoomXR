import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Browser client. Uses the publishable key; RLS decides what it can see.
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
