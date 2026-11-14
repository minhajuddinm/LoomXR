import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/products";

// Looks up the product a QR code points to. Only active products are visible
// to customers. Uses the admin client because customers have no database role.
export async function getPublicProduct(slug: string): Promise<Product | null> {
  if (!/^[a-z0-9]{6,32}$/.test(slug)) return null;
  const { data } = await createAdminClient()
    .from("products")
    .select("*")
    .eq("public_slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return (data as Product | null) ?? null;
}
