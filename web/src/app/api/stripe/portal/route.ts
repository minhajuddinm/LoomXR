import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { billingRedirect, getBillingContext } from "@/lib/stripe/route-helpers";

// Opens the Stripe Customer Portal (change plan, update card, cancel).
export async function POST(request: Request) {
  const context = await getBillingContext(request);
  if (context instanceof NextResponse) return context;
  const { business, origin } = context;

  if (!business.stripe_customer_id) return billingRedirect(origin, "no-customer");

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${origin}/billing`,
      configuration: serverEnv.stripePortalConfigurationId,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Portal session failed", error);
    return billingRedirect(origin, "stripe-error");
  }
}
