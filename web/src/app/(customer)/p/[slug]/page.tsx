import type { Metadata } from "next";
import { getPublicProduct } from "@/lib/customer-product";
import { formatMoney } from "@/lib/products";
import { ui } from "@/lib/ui";
import { Flow } from "./flow";

export const metadata: Metadata = { title: "Design your packaging" };

export default async function CustomerProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="weave px-5 py-4 text-paper">
        <p className="mx-auto max-w-md font-display text-xl font-bold tracking-tight">
          Loom<span className="text-gold">XR</span>
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-6">
        {product ? (
          <Flow
            slug={slug}
            productName={product.name}
            brandName={product.brand_name}
            premiumPrice={formatMoney(product.premium_price_cents, product.currency)}
            basePrice={formatMoney(product.base_price_cents, product.currency)}
            allowCustomText={product.allow_custom_content}
            arReady={Boolean(product.targets_path)}
            dims={{
              width: Number(product.width_mm),
              height: Number(product.height_mm),
              depth: Number(product.depth_mm),
            }}
          />
        ) : (
          <>
            <h1 className={ui.h1}>Not available</h1>
            <p className="mt-3 text-ink-soft">
              Personalized packaging for this product is not available right now. Please ask in store.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
