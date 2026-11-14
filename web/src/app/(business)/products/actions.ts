"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessContext } from "@/lib/auth";
import { defaultTemplate, unknownSlots, type Brief } from "@/lib/generation/prompt";
import { chat, hasTogether } from "@/lib/generation/together";
import { BOX_FACES, productInput, type BoxFace } from "@/lib/products";
import { BRIEF_QUESTIONS, CUSTOMER_SLOTS } from "@/lib/questions";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error?: string; message?: string } | undefined;

// Every action starts here: it returns the product only if it belongs to the
// current business. In demo mode the database client bypasses RLS, so this
// explicit business_id filter is what enforces ownership.
async function ownedProduct(productId: string) {
  const { business, db } = await getBusinessContext();
  const { data } = await db
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!data) throw new Error("Product not found");
  return { business, db, product: data };
}

function parseProduct(formData: FormData) {
  return productInput.safeParse({
    ...Object.fromEntries(formData),
    allow_custom_content: formData.get("allow_custom_content") === "on",
  });
}

function productColumns(v: ReturnType<typeof productInput.parse>) {
  return {
    name: v.name,
    width_mm: v.width_mm,
    height_mm: v.height_mm,
    depth_mm: v.depth_mm,
    brand_name: v.brand_name || null,
    mandatory_text: v.mandatory_text || null,
    brand_colours: v.brand_colours,
    base_price_cents: v.base_price,
    premium_price_cents: v.premium_price,
    allow_custom_content: v.allow_custom_content,
  };
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { business, db } = await getBusinessContext();
  const { data, error } = await db
    .from("products")
    .insert({ business_id: business.id, shape: "box", ...productColumns(parsed.data) })
    .select("id")
    .single();
  if (error) return { error: "Could not save the product. Try again." };
  redirect(`/products/${data.id}`);
}

export async function updateProduct(
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { db, product } = await ownedProduct(productId);
  const dimsChanged =
    Number(product.width_mm) !== parsed.data.width_mm ||
    Number(product.height_mm) !== parsed.data.height_mm ||
    Number(product.depth_mm) !== parsed.data.depth_mm;

  const { error } = await db.from("products").update(productColumns(parsed.data)).eq("id", productId);
  if (error) return { error: "Could not save the product. Try again." };
  revalidatePath(`/products/${productId}`);
  return { message: dimsChanged ? "Saved. Dimensions changed, so check your photos still match." : "Saved." };
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/octet-stream": "mind",
};

// Gives the browser a one-time URL to upload a file straight to storage. The
// path is chosen here, inside this business's folder, never by the browser.
export async function requestUpload(
  productId: string,
  kind: "face" | "logo" | "targets",
  contentType: string,
  face?: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const { business } = await ownedProduct(productId);
  const ext = EXTENSIONS[contentType];
  if (!ext) return { error: "Use a JPEG, PNG or WebP image." };
  if (kind === "face" && !BOX_FACES.includes(face as BoxFace)) return { error: "Unknown face." };

  const name = kind === "face" ? `face-${face}` : kind;
  const path = `${business.id}/${productId}/${name}-${randomUUID().slice(0, 8)}.${ext}`;
  // Signed upload URLs are issued with the admin client; ownership was checked above.
  const { data, error } = await createAdminClient()
    .storage.from("product-assets")
    .createSignedUploadUrl(path);
  if (error) return { error: "Could not start the upload." };
  return { path, token: data.token };
}

function insideProductFolder(path: string, businessId: string, productId: string) {
  return path.startsWith(`${businessId}/${productId}/`) && !path.includes("..");
}

export async function saveFace(productId: string, face: string, path: string): Promise<FormState> {
  const { business, db } = await ownedProduct(productId);
  if (!BOX_FACES.includes(face as BoxFace) || !insideProductFolder(path, business.id, productId)) {
    return { error: "Invalid upload." };
  }
  const { error } = await db
    .from("product_faces")
    .upsert({ product_id: productId, face, photo_path: path, target_index: null }, { onConflict: "product_id,face" });
  if (error) return { error: "Could not save the photo." };
  // A new photo makes the old tracking file stale.
  await db.from("products").update({ targets_path: null }).eq("id", productId);
  await db.from("product_faces").update({ target_index: null }).eq("product_id", productId);
  revalidatePath(`/products/${productId}`);
}

export async function removeFace(productId: string, face: string): Promise<FormState> {
  const { db } = await ownedProduct(productId);
  await db.from("product_faces").delete().eq("product_id", productId).eq("face", face);
  await db.from("products").update({ targets_path: null }).eq("id", productId);
  await db.from("product_faces").update({ target_index: null }).eq("product_id", productId);
  revalidatePath(`/products/${productId}`);
  return undefined;
}

export async function saveLogo(productId: string, path: string): Promise<FormState> {
  const { business, db } = await ownedProduct(productId);
  if (!insideProductFolder(path, business.id, productId)) return { error: "Invalid upload." };
  const { error } = await db.from("products").update({ logo_path: path }).eq("id", productId);
  if (error) return { error: "Could not save the logo." };
  revalidatePath(`/products/${productId}`);
}

// Records the compiled tracking file and which tracked image is which face.
export async function saveTargets(
  productId: string,
  path: string,
  faceOrder: string[],
): Promise<FormState> {
  const { business, db } = await ownedProduct(productId);
  if (!insideProductFolder(path, business.id, productId)) return { error: "Invalid upload." };
  if (!faceOrder.length || !faceOrder.every((f) => BOX_FACES.includes(f as BoxFace))) {
    return { error: "Invalid face list." };
  }
  for (const [index, face] of faceOrder.entries()) {
    await db.from("product_faces").update({ target_index: index }).eq("product_id", productId).eq("face", face);
  }
  const { error } = await db.from("products").update({ targets_path: path }).eq("id", productId);
  if (error) return { error: "Could not save AR tracking." };
  revalidatePath(`/products/${productId}`);
  return { message: "AR tracking is ready." };
}

async function nextTemplateVersion(db: Awaited<ReturnType<typeof ownedProduct>>["db"], productId: string) {
  const { data } = await db
    .from("prompt_templates")
    .select("version")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}

// Saves the questionnaire and writes a fresh prompt template from it.
export async function saveBrief(
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db, product } = await ownedProduct(productId);

  const answers: Record<string, string> = {};
  for (const q of BRIEF_QUESTIONS) {
    const value = String(formData.get(q.id) ?? "").trim().slice(0, 200);
    if (q.kind === "select" && !q.choices.some((c) => c.value === value)) {
      return { error: `Choose an answer for "${q.label}"` };
    }
    answers[q.id] = value;
  }

  const brief = await db
    .from("product_briefs")
    .upsert({ product_id: productId, answers }, { onConflict: "product_id" });
  if (brief.error) return { error: "Could not save your answers." };

  const base = defaultTemplate(answers as Brief, product.brand_colours ?? []);
  let template = base;
  let usedAi = false;

  if (hasTogether()) {
    try {
      const improved = await chat(
        `You write prompts for an image model that paints packaging artwork. Rewrite the user's draft into one vivid paragraph of at most 90 words. Keep every placeholder exactly as written: ${CUSTOMER_SLOTS.map((s) => `{{${s}}}`).join(", ")}. Each placeholder must appear exactly once. Do not ask for text, letters or logos. Reply with the prompt only.`,
        base,
      );
      const hasAll = CUSTOMER_SLOTS.every((s) => improved.includes(`{{${s}}}`));
      if (hasAll && unknownSlots(improved).length === 0) {
        template = improved;
        usedAi = true;
      }
    } catch (error) {
      console.error("Template generation failed, using the built-in template", error);
    }
  }

  const saved = await db.from("prompt_templates").insert({
    product_id: productId,
    template,
    slots: CUSTOMER_SLOTS,
    edited_by_business: false,
    version: await nextTemplateVersion(db, productId),
  });
  if (saved.error) return { error: "Could not save the prompt template." };

  revalidatePath(`/products/${productId}`);
  return {
    message: usedAi
      ? "Saved. An AI-written prompt template is ready to review below."
      : "Saved. A prompt template was built from your answers (no AI text model is connected yet).",
  };
}

export async function saveTemplate(
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { db } = await ownedProduct(productId);
  const template = String(formData.get("template") ?? "").trim();
  if (template.length < 20 || template.length > 1500) {
    return { error: "The template should be between 20 and 1500 characters." };
  }
  const unknown = unknownSlots(template);
  if (unknown.length) {
    return { error: `Unknown placeholder: {{${unknown[0]}}}. Allowed: ${CUSTOMER_SLOTS.join(", ")}.` };
  }
  const { error } = await db.from("prompt_templates").insert({
    product_id: productId,
    template,
    slots: CUSTOMER_SLOTS,
    edited_by_business: true,
    version: await nextTemplateVersion(db, productId),
  });
  if (error) return { error: "Could not save the template." };
  revalidatePath(`/products/${productId}`);
  return { message: "Template saved." };
}

export async function setProductStatus(productId: string, status: "draft" | "active"): Promise<void> {
  const { db } = await ownedProduct(productId);
  await db.from("products").update({ status }).eq("id", productId);
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
}
