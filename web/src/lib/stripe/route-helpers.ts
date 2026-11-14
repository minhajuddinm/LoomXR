import "server-only";
import { NextResponse } from "next/server";
import { getBusiness, getCurrentUser, getRequestOrigin, type CurrentUser } from "@/lib/auth";
import type { Business } from "@/lib/types";

// Shared guard for the billing POST routes. They are called by plain HTML
// forms, so failures redirect (303) to a page that can explain.
export type BillingContext = {
  user: CurrentUser;
  business: Business;
  origin: string;
};

export async function getBillingContext(
  request: Request,
): Promise<BillingContext | NextResponse> {
  const origin = await getRequestOrigin();

  // Cross-site form posts are rejected. Supabase cookies are SameSite=Lax, so
  // this is a second layer, not the only one.
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/billing`, 303);

  const business = await getBusiness();
  if (!business) return NextResponse.redirect(`${origin}/onboarding`, 303);

  return { user, business, origin };
}

export function billingRedirect(origin: string, notice: string): NextResponse {
  return NextResponse.redirect(`${origin}/billing?notice=${notice}`, 303);
}
