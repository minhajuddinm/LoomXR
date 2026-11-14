import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { isBillingRequired } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Admin" };

const usd = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n);
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(iso));

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
}

// LoomXR staff view across every business. requireAdmin() runs first; only
// then is the admin (RLS-bypassing) client used.
export default async function AdminPage() {
  await requireAdmin();
  const db = createAdminClient();
  const since = thirtyDaysAgo();

  const [businesses, products, orders, usage] = await Promise.all([
    db.from("businesses").select("id, name, plan, subscription_status, period_generations_used, created_at").order("created_at", { ascending: false }),
    db.from("products").select("business_id, status"),
    db.from("orders").select("business_id, status"),
    db.from("usage_events").select("business_id, cost_usd, units, created_at").gte("created_at", since),
  ]);

  const count = (rows: { business_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.business_id === id).length;
  const cost = (id?: string) =>
    (usage.data ?? []).filter((u) => !id || u.business_id === id).reduce((sum, u) => sum + Number(u.cost_usd), 0);
  const images = (usage.data ?? []).reduce((sum, u) => sum + Number(u.units), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>

      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          ["Businesses", String(businesses.data?.length ?? 0)],
          ["Products", String(products.data?.length ?? 0)],
          ["AI images, last 30 days", String(images)],
          ["AI cost, last 30 days", usd(cost())],
        ].map(([label, value]) => (
          <div key={label} className={ui.card}>
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="mt-1 text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-ink-soft">Billing is {isBillingRequired() ? "switched on" : "switched off: no subscription is required"}.</p>

      <section aria-labelledby="biz-heading">
        <h2 id="biz-heading" className="text-xl font-bold">
          Businesses
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-rule text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4 font-semibold">Name</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Joined</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Plan</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Products</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Orders</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Rounds this period</th>
                <th scope="col" className="py-2 font-semibold">AI cost, 30 days</th>
              </tr>
            </thead>
            <tbody>
              {(businesses.data ?? []).map((b) => (
                <tr key={b.id} className="border-b border-rule">
                  <th scope="row" className="py-2 pr-4 font-semibold">{b.name}</th>
                  <td className="py-2 pr-4">{day(b.created_at)}</td>
                  <td className="py-2 pr-4">{b.plan ? `${b.plan} (${b.subscription_status})` : "None"}</td>
                  <td className="py-2 pr-4">{count(products.data, b.id)}</td>
                  <td className="py-2 pr-4">{count(orders.data, b.id)}</td>
                  <td className="py-2 pr-4">{b.period_generations_used}</td>
                  <td className="py-2">{usd(cost(b.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
