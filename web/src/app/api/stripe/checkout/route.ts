import { NextResponse } from "next/server";
import { getPlan, isSubscriptionActive } from "@/lib/plans";
import { getStripe } from "@/lib/stripe/client";
import { billingRedirect, getBillingContext } from "@/lib/stripe/route-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

// Starts a Stripe Checkout session for a subscription plan.
export async function POST(request: Request) {
  const context = await getBillingContext(request);
  if (context instanceof NextResponse) return context;
  const { user, business, origin } = context;

  const form = await request.formData();
  const plan = getPlan(String(form.get("plan") ?? ""));
  if (!plan) return billingRedirect(origin, "unknown-plan");

  // Plan changes for an existing subscriber go through the Customer Portal,
  // otherwise a second Checkout would create a second subscription.
  if (isSubscriptionActive(business.subscription_status)) {
    return billingRedirect(origin, "already-subscribed");
  }

  try {
    const stripe = getStripe();

    const prices = await stripe.prices.list({
      lookup_keys: [plan.lookupKey],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) return billingRedirect(origin, "plans-not-seeded");

    let customerId = business.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: business.name,
        email: user.email ?? undefined,
        metadata: { business_id: business.id },
      });
      customerId = customer.id;
      // stripe_customer_id is not writable by the user's own client, so this
      // uses the admin client. The business was already authorized above.
      const { error } = await createAdminClient()
        .from("businesses")
        .update({ stripe_customer_id: customerId })
        .eq("id", business.id);
      if (error) throw new Error(error.message);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: business.id,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { business_id: business.id } },
      success_url: `${origin}/billing?notice=checkout-success`,
      cancel_url: `${origin}/billing?notice=checkout-cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned no Checkout URL");

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Checkout failed", error);
    return billingRedirect(origin, "stripe-error");
  }
}
