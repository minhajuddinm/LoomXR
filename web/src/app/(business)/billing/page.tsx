import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { PLANS, formatPrice, getPlan, isBillingRequired, isSubscriptionActive } from "@/lib/plans";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Billing" };

const NOTICES: Record<string, { text: string; tone: "notice" | "error" }> = {
  "checkout-success": {
    text: "Payment received. Your plan appears here within a few seconds; refresh if it has not updated.",
    tone: "notice",
  },
  "checkout-cancelled": { text: "Checkout was cancelled. Nothing was charged.", tone: "notice" },
  "already-subscribed": {
    text: "You already have a subscription. Use Manage billing to change plans.",
    tone: "notice",
  },
  "plans-not-seeded": {
    text: "Plans are not set up in Stripe yet. Run pnpm seed:stripe.",
    tone: "error",
  },
  "unknown-plan": { text: "That plan does not exist.", tone: "error" },
  "no-customer": { text: "There is no billing account yet. Choose a plan first.", tone: "error" },
  "stripe-error": { text: "Stripe could not be reached. Try again in a moment.", tone: "error" },
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "long" }).format(new Date(iso));
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { business } = await requireBusiness();
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] : undefined;

  const currentPlan = getPlan(business.plan);
  const active = isSubscriptionActive(business.subscription_status);
  const renews = formatDate(business.current_period_end);

  if (!isBillingRequired()) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Billing</h1>
        <p className={ui.notice}>
          Billing is not switched on yet. Everything is available at no charge while payments are being set up. You will
          be told before any plan starts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Billing</h1>

      {notice && <p className={notice.tone === "error" ? ui.error : ui.notice}>{notice.text}</p>}

      <section className={ui.card} aria-labelledby="current-heading">
        <h2 id="current-heading" className="font-display text-2xl font-bold tracking-tight">
          Current plan
        </h2>
        {currentPlan ? (
          <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-soft">Plan</dt>
            <dd className="font-semibold">{currentPlan.name}</dd>
            <dt className="text-ink-soft">Status</dt>
            <dd className="font-semibold">{business.subscription_status.replace("_", " ")}</dd>
            <dt className="text-ink-soft">Generations this period</dt>
            <dd className="font-semibold">
              {business.period_generations_used} of {business.monthly_generation_quota}
            </dd>
            {renews && (
              <>
                <dt className="text-ink-soft">Current period ends</dt>
                <dd className="font-semibold">{renews}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-ink-soft">No subscription yet.</p>
        )}
        {business.stripe_customer_id && (
          <form action="/api/stripe/portal" method="post" className="mt-4">
            <button type="submit" className={ui.buttonQuiet}>
              Manage billing
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="font-display text-2xl font-bold tracking-tight">
          Plans
        </h2>
        <p className="mt-1 text-ink-soft">
          Billed monthly in CAD. One generation is one round of designs for one customer.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = active && currentPlan?.id === plan.id;
            return (
              <li key={plan.id} className={`${ui.card} flex flex-col`}>
                <h3 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-ink-soft">{plan.blurb}</p>
                <p className="mt-4 text-3xl font-bold">
                  {formatPrice(plan.priceCents, plan.currency)}
                  <span className="text-base font-normal text-ink-soft"> / month</span>
                </p>
                <p className="mt-1 mb-5">
                  {plan.monthlyGenerationQuota.toLocaleString("en-CA")} generations per month
                </p>
                <div className="mt-auto">
                  {isCurrent ? (
                    <p className="font-semibold text-teal">Your current plan</p>
                  ) : active ? (
                    <p className="text-sm text-ink-soft">Switch with Manage billing.</p>
                  ) : (
                    <form action="/api/stripe/checkout" method="post">
                      <input type="hidden" name="plan" value={plan.id} />
                      <button type="submit" className={`${ui.button} w-full`}>
                        Subscribe to {plan.name}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
