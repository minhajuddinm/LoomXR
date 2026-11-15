import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import sharp from "sharp";
import { isDemoMode } from "@/lib/demo";
import { isBillingRequired, isSubscriptionActive } from "@/lib/plans";
import { BOX_FACES, faceGenerationSize, type BoxFace, type Product } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CustomerSession } from "@/lib/customer-session";
import { buildFaceTextures } from "./composite";
import { artDirection } from "./directions";
import { placeholderArtwork } from "./placeholder";
import { defaultTemplate, fillTemplate } from "./prompt";
import { IMAGE_COST_USD, IMAGE_MODEL, generateImage, hasTogether } from "./together";

// One generation round. Each design is two AI images (a composed front panel
// and a matching pattern, see directions.ts) turned into a texture per face.
//
// Not built yet (later in Phase 3): the uniqueness check against locked
// designs (CLIP embedding + perceptual hash) and moderation of custom content.

export const MAX_ROUNDS = 3;
export const DESIGNS_PER_ROUND = 5;
const SIGNED_URL_SECONDS = 60 * 60;

export type DesignView = { id: string; textures: Record<BoxFace, string> };

export class GenerationError extends Error {
  constructor(
    public code: "round-limit" | "not-subscribed" | "quota" | "failed",
    message: string,
  ) {
    super(message);
  }
}

export async function signDesignTextures(
  paths: Record<string, string>,
): Promise<Record<BoxFace, string>> {
  const db = createAdminClient();
  const faces = BOX_FACES.filter((f) => paths[f]);
  const { data, error } = await db.storage
    .from("designs")
    .createSignedUrls(faces.map((f) => paths[f]), SIGNED_URL_SECONDS);
  if (error) throw new Error(`Could not sign design URLs: ${error.message}`);
  const out = {} as Record<BoxFace, string>;
  faces.forEach((face, i) => {
    out[face] = data[i].signedUrl ?? "";
  });
  return out;
}

export async function runGenerationRound(input: {
  product: Product;
  session: CustomerSession;
  customText: string | null;
}): Promise<{ designs: DesignView[]; roundsLeft: number; sample: boolean }> {
  const { product, session } = input;
  const db = createAdminClient();

  if (session.rounds_used >= MAX_ROUNDS) {
    throw new GenerationError("round-limit", "You have used all your design rounds.");
  }

  // Subscription and quota, enforced only once billing is switched on.
  const { data: business } = await db
    .from("businesses")
    .select("id, subscription_status, monthly_generation_quota, period_generations_used")
    .eq("id", product.business_id)
    .single();
  if (isBillingRequired() && !isDemoMode()) {
    if (!business || !isSubscriptionActive(business.subscription_status)) {
      throw new GenerationError("not-subscribed", "This product is not available right now.");
    }
    if (business.period_generations_used >= business.monthly_generation_quota) {
      throw new GenerationError("quota", "This product is not available right now.");
    }
  }

  const { data: templateRow } = await db
    .from("prompt_templates")
    .select("template")
    .eq("product_id", product.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const template = templateRow?.template ?? defaultTemplate({}, product.brand_colours);
  const brief = fillTemplate(template, session.answers);
  // Stored for the record and, later, for locking: the front prompt of design 1.
  const prompt = artDirection({ designIndex: 0, answers: session.answers, brief }).frontPrompt;

  const roundNumber = session.rounds_used + 1;
  const round = await db
    .from("generation_rounds")
    .insert({ session_id: session.id, round_number: roundNumber, filled_prompt: prompt })
    .select("id")
    .single();
  if (round.error) throw new GenerationError("failed", "Could not start a design round.");
  await db.from("customer_sessions").update({ rounds_used: roundNumber }).eq("id", session.id);

  let logo: Buffer | null = null;
  if (product.logo_path) {
    const file = await db.storage.from("product-assets").download(product.logo_path);
    if (file.data) logo = Buffer.from(await file.data.arrayBuffer());
  }

  const frontSize = faceGenerationSize(product, "front");
  const patternSize = { width: 768, height: 768 };
  const real = hasTogether();
  const customText = product.allow_custom_content ? input.customText : null;

  const results = await Promise.allSettled(
    Array.from({ length: DESIGNS_PER_ROUND }, async (_, designIndex): Promise<DesignView> => {
      const id = randomUUID();
      const seed = randomInt(1, 2 ** 31 - 1);
      // A different layout for each of the three designs, rotated each round.
      const direction = artDirection({
        // Later rounds start from a different layout, so asking for more
        // with the same answers still looks fresh.
        designIndex: designIndex + session.rounds_used * 2,
        answers: session.answers,
        brief,
      });

      const [rawFront, rawPattern] = real
        ? await Promise.all([
            generateImage({ prompt: direction.frontPrompt, ...frontSize, seed }),
            generateImage({ prompt: direction.patternPrompt, ...patternSize, seed }),
          ])
        : await Promise.all([
            placeholderArtwork({ ...frontSize, seed, colourAnswer: session.answers.colours }),
            placeholderArtwork({ ...patternSize, seed: seed + 1, colourAnswer: session.answers.colours }),
          ]);
      // Models return JPEG or PNG; store one consistent format.
      const artwork = await sharp(rawFront).png().toBuffer();

      const textures = await buildFaceTextures({
        front: artwork,
        pattern: rawPattern,
        dims: product,
        plate: direction.plate,
        palette: direction.palette,
        logo,
        brandName: product.brand_name,
        mandatoryText: product.mandatory_text,
        customText,
      });

      const folder = `${product.id}/${id}`;
      const artworkPath = `${folder}/artwork.png`;
      const paths = {} as Record<BoxFace, string>;
      // Uploads occasionally fail on a dropped connection, so each gets a retry.
      const put = async (path: string, body: Buffer, contentType: string) => {
        for (let attempt = 1; ; attempt++) {
          const { error } = await db.storage
            .from("designs")
            .upload(path, body, { contentType, upsert: true });
          if (!error) return;
          if (attempt >= 3) throw new Error(`Upload failed: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      };
      await Promise.all([
        put(artworkPath, artwork, "image/png"),
        ...BOX_FACES.map((face) => {
          paths[face] = `${folder}/${face}.jpg`;
          return put(paths[face], textures[face], "image/jpeg");
        }),
      ]);

      const row = await db.from("designs").insert({
        id,
        round_id: round.data.id,
        product_id: product.id,
        seed,
        model: real ? IMAGE_MODEL : "placeholder",
        artwork_path: artworkPath,
        composite_paths: paths,
      });
      if (row.error) throw new Error(`Could not save design: ${row.error.message}`);

      if (real) {
        await db.from("usage_events").insert({
          provider: "together",
          model: IMAGE_MODEL,
          operation: "image",
          units: 2,
          cost_usd: 2 * (IMAGE_COST_USD[IMAGE_MODEL] ?? 0),
          business_id: product.business_id,
          session_id: session.id,
        });
      }
      return { id, textures: await signDesignTextures(paths) };
    }),
  );

  const designs = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  for (const r of results) {
    if (r.status === "rejected") console.error("Design generation failed", r.reason);
  }
  if (designs.length === 0) {
    throw new GenerationError("failed", "We could not make designs just now. Please try again.");
  }

  if (business) {
    await db
      .from("businesses")
      .update({ period_generations_used: business.period_generations_used + 1 })
      .eq("id", business.id);
  }

  return { designs, roundsLeft: MAX_ROUNDS - roundNumber, sample: !real };
}
