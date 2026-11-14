import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { getPlan, isSubscriptionActive } from "@/lib/plans";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const plan = getPlan(business.plan);
  const active = isSubscriptionActive(business.subscription_status);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>

      <section className={ui.card} aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-lg font-bold">
          Subscription
        </h2>
        {active && plan ? (
          <>
            <p className="mt-2">
              {plan.name} plan. {business.period_generations_used} of{" "}
              {business.monthly_generation_quota} generations used this period.
            </p>
            <Link href="/billing" className={`${ui.link} mt-3 inline-block`}>
              Manage billing
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-ink-soft">
              No active subscription. Customers cannot generate designs until you choose a plan.
            </p>
            <Link href="/billing" className={`${ui.button} mt-4`}>
              Choose a plan
            </Link>
          </>
        )}
      </section>

      <section className={ui.card} aria-labelledby="products-heading">
        <h2 id="products-heading" className="text-lg font-bold">
          Products
        </h2>
        <p className="mt-2 text-ink-soft">
          Product setup is not built yet. It is the next phase of the MVP.
        </p>
      </section>
    </div>
  );
}
