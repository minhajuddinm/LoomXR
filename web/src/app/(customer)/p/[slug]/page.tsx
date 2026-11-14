import type { Metadata } from "next";
import { getPublicProduct } from "@/lib/customer-product";
import { formatMoney } from "@/lib/products";
import { Flow } from "./flow";

export const metadata: Metadata = { title: "Design your packaging" };

export default async function CustomerProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="text-xl font-bold tracking-tight">LoomXR</p>
      {product ? (
        <Flow
          slug={slug}
          productName={product.name}
          brandName={product.brand_name}
          premiumPrice={formatMoney(product.premium_price_cents, product.currency)}
          basePrice={formatMoney(product.base_price_cents, product.currency)}
          allowCustomText={product.allow_custom_content}
          arReady={Boolean(product.targets_path)}
        />
      ) : (
        <>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Not available</h1>
          <p className="mt-3 text-ink-soft">
            Personalized packaging for this product is not available right now. Please ask in store.
          </p>
        </>
      )}
    </main>
  );
}
