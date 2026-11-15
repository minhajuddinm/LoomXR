import type { Metadata } from "next";
import Link from "next/link";
import { IconArrow, IconCheck } from "@/components/icons";
import { getBusinessContext } from "@/lib/auth";
import { getPlan, isBillingRequired, isSubscriptionActive } from "@/lib/plans";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { business, db } = await getBusinessContext();

  const [products, orders] = await Promise.all([
    db.from("products").select("id, status, targets_path").eq("business_id", business.id).neq("status", "archived"),
    db.from("orders").select("id, status").eq("business_id", business.id),
  ]);
  const list = products.data ?? [];
  const live = list.filter((p) => p.status === "active").length;
  const withTracking = list.filter((p) => p.targets_path).length;
  const orderCount = orders.data?.length ?? 0;

  const plan = getPlan(business.plan);
  const billingOn = isBillingRequired();
  const subscribed = isSubscriptionActive(business.subscription_status);

  const steps = [
    { done: list.length > 0, label: "Add your first product", href: "/products/new" },
    { done: withTracking > 0, label: "Upload photos and prepare AR tracking", href: "/products" },
    { done: live > 0, label: "Go live and print the QR code", href: "/products" },
    { done: orderCount > 0, label: "Get your first customer design", href: "/products" },
  ];
  const next = steps.find((s) => !s.done);

  const stats = [
    { label: "Products", value: list.length },
    { label: "Live in store", value: live },
    { label: "Designs chosen", value: orderCount },
    { label: "Design rounds this period", value: business.period_generations_used },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className={ui.eyebrow}>Dashboard</p>
        <h1 className={`${ui.h1} mt-2`}>{business.name}</h1>
      </div>

      <dl className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${ui.card} lift`}>
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-display text-4xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className={ui.card} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className={ui.h2}>
            Getting set up
          </h2>
          <ol className="mt-5 space-y-3">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    s.done ? "bg-success text-paper" : "border border-rule bg-canvas text-ink-soft"
                  }`}
                >
                  {s.done ? <IconCheck className="size-4" /> : i + 1}
                </span>
                <span className={s.done ? "text-ink-soft line-through decoration-ink-soft/40" : "font-semibold"}>
                  {s.label}
                </span>
                <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
              </li>
            ))}
          </ol>
          {next ? (
            <Link href={next.href} className={`${ui.button} mt-6`}>
              {next.label}
              <IconArrow />
            </Link>
          ) : (
            <Link href="/products" className={`${ui.buttonQuiet} mt-6`}>
              Manage products
            </Link>
          )}
        </section>

        <section className="weave rounded-2xl p-6 text-paper shadow-card sm:p-7" aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="font-display text-2xl font-bold tracking-tight">
            Subscription
          </h2>
          {!billingOn ? (
            <p className="mt-3 text-paper/75">
              Billing is not switched on yet. Everything is available at no charge for now.
            </p>
          ) : subscribed && plan ? (
            <p className="mt-3 text-paper/75">
              {plan.name} plan. {business.period_generations_used} of {business.monthly_generation_quota} design rounds
              used this period.
            </p>
          ) : (
            <p className="mt-3 text-paper/75">No active plan. Customers cannot create designs until you choose one.</p>
          )}
          <Link href="/billing" className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-gold underline decoration-gold/40 underline-offset-4 hover:text-paper">
            {billingOn && !subscribed ? "Choose a plan" : "Billing details"}
            <IconArrow className="size-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
