import { randomInt } from "node:crypto";
import { getCustomerSession } from "@/lib/customer-session";
import { createAdminClient } from "@/lib/supabase/admin";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike characters

function orderCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `LX-${code}`;
}

// The customer picks a design. Creates an order the store can look up by code.
export async function POST(_request: Request, ctx: RouteContext<"/api/designs/[id]/select">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const db = createAdminClient();
  const { data: design } = await db
    .from("designs")
    .select("id, product_id, status, round_id, generation_rounds(session_id)")
    .eq("id", id)
    .maybeSingle();
  if (!design) return Response.json({ error: "Not found." }, { status: 404 });

  // The design must belong to this browser's session.
  const session = await getCustomerSession(design.product_id);
  const round = design.generation_rounds as unknown as { session_id: string } | null;
  if (!session || round?.session_id !== session.id) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const existing = await db.from("orders").select("order_code").eq("design_id", id).maybeSingle();
  if (existing.data) return Response.json({ orderCode: existing.data.order_code });

  const { data: product } = await db
    .from("products")
    .select("business_id, base_price_cents, premium_price_cents, currency")
    .eq("id", design.product_id)
    .single();
  if (!product) return Response.json({ error: "Not found." }, { status: 404 });

  const code = orderCode();
  const order = await db.from("orders").insert({
    design_id: id,
    business_id: product.business_id,
    order_code: code,
    base_price_cents: product.base_price_cents ?? 0,
    premium_price_cents: product.premium_price_cents ?? 0,
    currency: product.currency,
  });
  if (order.error) return Response.json({ error: "Could not save your choice." }, { status: 500 });

  // Keep the chosen design past the 24-hour cleanup.
  await db.from("designs").update({ status: "selected", expires_at: null }).eq("id", id);
  return Response.json({ orderCode: code });
}
