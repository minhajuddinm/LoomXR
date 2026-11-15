import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessContext } from "@/lib/auth";
import type { Product } from "@/lib/products";
import { ui } from "@/lib/ui";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const removed = (await searchParams).removed === "1";
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
        <h1 className="font-display text-4xl font-bold tracking-tight">Products</h1>
        <Link href="/products/new" className={ui.button}>
          Add a product
        </Link>
      </div>

      {removed && (
        <p role="status" className={ui.notice}>
          Product removed. Its QR code no longer works.
        </p>
      )}

      {products.length === 0 ? (
        <p className={`${ui.card} text-ink-soft`}>
          No products yet. Add a box product to set up its photos, questions and QR code.
        </p>
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className={`${ui.card} block transition duration-200 hover:-translate-y-0.5 hover:border-teal hover:shadow-lift`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-2xl font-bold tracking-tight">{p.name}</span>
                  <span className={p.status === "active" ? ui.badgeLive : ui.badgeDraft}>
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
