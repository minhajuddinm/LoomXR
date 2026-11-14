import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  anonClient,
  createTenant,
  deleteTenant,
  hasSupabaseEnv,
  type TestTenant,
} from "./helpers";

// Two businesses, A and B. Nothing A owns may be visible to or changeable by
// B, and neither may touch server-only tables or their own billing columns.
describe.skipIf(!hasSupabaseEnv)("RLS isolation between two businesses", () => {
  let admin: SupabaseClient;
  let a: TestTenant;
  let b: TestTenant;
  let productA: string;
  const filePath = () => `${a.businessId}/rls-test.txt`;

  beforeAll(async () => {
    admin = adminClient();
    a = await createTenant(admin, "a");
    b = await createTenant(admin, "b");

    const product = await a.client
      .from("products")
      .insert({ business_id: a.businessId, name: "A's box", shape: "box" })
      .select("id")
      .single();
    if (product.error) throw product.error;
    productA = product.data.id;

    const upload = await a.client.storage
      .from("product-assets")
      .upload(filePath(), new Blob(["hello"]), { contentType: "text/plain" });
    if (upload.error) throw upload.error;
  });

  afterAll(async () => {
    if (!hasSupabaseEnv) return;
    if (a) await admin.storage.from("product-assets").remove([filePath()]);
    await deleteTenant(admin, a);
    await deleteTenant(admin, b);
  });

  it("shows each owner only their own business", async () => {
    const seenByA = await a.client.from("businesses").select("id");
    expect(seenByA.data?.map((r) => r.id)).toEqual([a.businessId]);

    const seenByB = await b.client.from("businesses").select("id");
    expect(seenByB.data?.map((r) => r.id)).toEqual([b.businessId]);
  });

  it("hides A's products from B", async () => {
    const direct = await b.client.from("products").select("id").eq("id", productA);
    expect(direct.data).toEqual([]);

    const all = await b.client.from("products").select("id");
    expect(all.data).toEqual([]);
  });

  it("stops B creating a product under A's business", async () => {
    const res = await b.client
      .from("products")
      .insert({ business_id: a.businessId, name: "Intruder", shape: "box" });
    expect(res.error).not.toBeNull();
  });

  it("stops B changing or deleting A's product", async () => {
    await b.client.from("products").update({ name: "Hacked" }).eq("id", productA);
    await b.client.from("products").delete().eq("id", productA);

    const check = await admin.from("products").select("name").eq("id", productA).single();
    expect(check.data?.name).toBe("A's box");
  });

  it("stops B moving their own product into A's business", async () => {
    const own = await b.client
      .from("products")
      .insert({ business_id: b.businessId, name: "B's can", shape: "cylinder" })
      .select("id")
      .single();
    expect(own.error).toBeNull();

    const moved = await b.client
      .from("products")
      .update({ business_id: a.businessId })
      .eq("id", own.data!.id);
    expect(moved.error).not.toBeNull();
  });

  it("stops B attaching faces, briefs or templates to A's product", async () => {
    const face = await b.client
      .from("product_faces")
      .insert({ product_id: productA, face: "front", photo_path: "x" });
    expect(face.error).not.toBeNull();

    const brief = await b.client.from("product_briefs").insert({ product_id: productA });
    expect(brief.error).not.toBeNull();

    const template = await b.client
      .from("prompt_templates")
      .insert({ product_id: productA, template: "x" });
    expect(template.error).not.toBeNull();
  });

  it("stops B renaming A's business", async () => {
    await b.client.from("businesses").update({ name: "Hacked" }).eq("id", a.businessId);
    const check = await admin.from("businesses").select("name").eq("id", a.businessId).single();
    expect(check.data?.name).toBe("Test business a");
  });

  it("lets an owner rename their own business", async () => {
    const res = await a.client
      .from("businesses")
      .update({ name: "Renamed a" })
      .eq("id", a.businessId)
      .select("name")
      .single();
    expect(res.error).toBeNull();
    expect(res.data?.name).toBe("Renamed a");
    await a.client.from("businesses").update({ name: "Test business a" }).eq("id", a.businessId);
  });

  it("stops an owner giving themselves a plan or quota", async () => {
    const quota = await a.client
      .from("businesses")
      .update({ monthly_generation_quota: 999_999 })
      .eq("id", a.businessId);
    expect(quota.error).not.toBeNull();

    const status = await a.client
      .from("businesses")
      .update({ subscription_status: "active", plan: "scale" })
      .eq("id", a.businessId);
    expect(status.error).not.toBeNull();

    const rpc = await a.client.rpc("apply_subscription_state", {
      p_business_id: a.businessId,
      p_stripe_customer_id: null,
      p_stripe_subscription_id: null,
      p_plan: "scale",
      p_status: "active",
      p_quota: 999_999,
      p_period_start: null,
      p_period_end: null,
    });
    expect(rpc.error).not.toBeNull();

    const check = await admin
      .from("businesses")
      .select("plan, subscription_status, monthly_generation_quota")
      .eq("id", a.businessId)
      .single();
    expect(check.data).toEqual({
      plan: null,
      subscription_status: "none",
      monthly_generation_quota: 0,
    });
  });

  it("stops a user creating a business owned by someone else", async () => {
    // A already has a business, so use B's id as the owner.
    const res = await a.client
      .from("businesses")
      .insert({ owner_user_id: b.userId, name: "Impostor" });
    expect(res.error).not.toBeNull();
  });

  it("keeps server-only tables closed to business users", async () => {
    for (const table of [
      "customer_sessions",
      "custom_content",
      "generation_rounds",
      "locked_designs",
      "usage_events",
      "stripe_events",
      "app_settings",
    ]) {
      const res = await a.client.from(table).select("*").limit(1);
      expect(res.error, `${table} should be denied`).not.toBeNull();
    }
  });

  it("gives a signed-out visitor nothing", async () => {
    const anon = anonClient();
    for (const table of ["businesses", "products", "designs", "orders", "app_settings"]) {
      const res = await anon.from(table).select("*").limit(1);
      expect(res.error, `${table} should be denied to anon`).not.toBeNull();
    }
  });

  it("keeps A's files private to A", async () => {
    const own = await a.client.storage.from("product-assets").download(filePath());
    expect(own.error).toBeNull();

    const other = await b.client.storage.from("product-assets").download(filePath());
    expect(other.error).not.toBeNull();

    const anon = await anonClient().storage.from("product-assets").download(filePath());
    expect(anon.error).not.toBeNull();
  });

  it("stops B writing into A's folder or the server-only buckets", async () => {
    const intoA = await b.client.storage
      .from("product-assets")
      .upload(`${a.businessId}/intruder.txt`, new Blob(["x"]));
    expect(intoA.error).not.toBeNull();

    const intoDesigns = await b.client.storage
      .from("designs")
      .upload(`${b.businessId}/x.txt`, new Blob(["x"]));
    expect(intoDesigns.error).not.toBeNull();
  });
});
