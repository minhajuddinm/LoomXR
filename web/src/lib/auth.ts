import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDemoBusiness, isDemoMode } from "@/lib/demo";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

// Data access layer for the business side. Every page and route that needs a
// user goes through here, so the check lives in one place.

export type CurrentUser = { id: string; email: string | null; isAdmin: boolean };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  // The admin role lives in app_metadata, which only the server can write.
  // (user_metadata is editable by the user, so it is never used for this.)
  const role = (data.claims.app_metadata as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin" || isAdminEmail(email);
  return { id: data.claims.sub, email, isAdmin };
});

export async function requireUser(): Promise<CurrentUser> {
  if (isDemoMode()) {
    const business = await getDemoBusiness();
    return { id: business.owner_user_id, email: null, isAdmin: false };
  }
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Reads through the user's own client, so RLS guarantees it is their business.
export const getBusiness = cache(async (): Promise<Business | null> => {
  if (isDemoMode()) return getDemoBusiness();
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

// LoomXR staff only. Everyone else gets a 404, so the page's existence is not
// revealed. Never available in demo mode, where nobody is signed in.
export async function requireAdmin(): Promise<CurrentUser> {
  if (isDemoMode()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) notFound();
  return user;
}

// The database client business pages should use, plus the business it is
// limited to. Normally that is the signed-in user's client, where RLS enforces
// ownership. In demo mode there is no user, so it is the admin client and every
// query MUST filter by business.id itself.
export async function getBusinessContext() {
  const { business } = await requireBusiness();
  const db = isDemoMode() ? createAdminClient() : await createClient();
  return { business, db };
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
