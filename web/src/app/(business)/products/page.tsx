import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessContext } from "@/lib/auth";
import type { Product } from "@/lib/products";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { business, db } = await getBusinessContext();
  const { data } = await db
    .from("products")
    .select("*")
    .eq("business_id", business.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <Link href="/products/new" className={ui.button}>
          Add a product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className={`${ui.card} text-ink-soft`}>
          No products yet. Add a box product to set up its photos, questions and QR code.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className={`${ui.card} block hover:border-teal`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold">{p.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                      p.status === "active" ? "bg-teal/10 text-teal" : "bg-panel text-ink-soft"
                    }`}
                  >
                    {p.status === "active" ? "Live" : "Draft"}
                  </span>
                </span>
                <span className="mt-1 block text-ink-soft">
                  Box, {Number(p.width_mm)} × {Number(p.height_mm)} × {Number(p.depth_mm)} mm
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
