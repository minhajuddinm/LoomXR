import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

// Data access layer for the business side. Every page and route that needs a
// user goes through here, so the check lives in one place.

export type CurrentUser = { id: string; email: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Reads through the user's own client, so RLS guarantees it is their business.
export const getBusiness = cache(async (): Promise<Business | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load business: ${error.message}`);
  return (data as Business | null) ?? null;
});

export async function requireBusiness(): Promise<{ user: CurrentUser; business: Business }> {
  const user = await requireUser();
  const business = await getBusiness();
  if (!business) redirect("/onboarding");
  return { user, business };
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && serverEnv.adminEmails.includes(email.toLowerCase()));
}

// Origin of the current request, e.g. https://app.loomxrlabs.com or a Vercel
// preview URL. Used to build auth and Stripe return URLs.
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
