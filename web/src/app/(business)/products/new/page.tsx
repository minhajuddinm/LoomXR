import type { Metadata } from "next";
import Link from "next/link";
import { ui } from "@/lib/ui";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Add a product" };

export default function NewProductPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/products" className={ui.link}>
        Back to products
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Add a product</h1>
      <p className="mt-2 mb-6 text-ink-soft">
        Start with the basics. Photos, questions and the QR code come on the next screen.
      </p>
      <ProductForm action={createProduct} />
    </div>
  );
}
