// Product shapes and the geometry that turns one wide artwork image into a
// texture per face. Pure functions only, so they are easy to test.

import { z } from "zod";

export const BOX_FACES = ["front", "right", "back", "left", "top", "bottom"] as const;
export type BoxFace = (typeof BOX_FACES)[number];

// The four faces that wrap around the box, in the order they appear in the
// generated artwork, left to right.
export const SIDE_FACES = ["front", "right", "back", "left"] as const;
export type SideFace = (typeof SIDE_FACES)[number];

export const FACE_LABELS: Record<BoxFace, string> = {
  front: "Front",
  right: "Right side",
  back: "Back",
  left: "Left side",
  top: "Top",
  bottom: "Bottom",
};

export type BoxDims = { width_mm: number; height_mm: number; depth_mm: number };

export type Product = BoxDims & {
  id: string;
  business_id: string;
  name: string;
  shape: "box" | "cylinder";
  brand_name: string | null;
  mandatory_text: string | null;
  brand_colours: string[];
  logo_path: string | null;
  base_price_cents: number | null;
  premium_price_cents: number | null;
  currency: string;
  allow_custom_content: boolean;
  public_slug: string;
  targets_path: string | null;
  status: "draft" | "active" | "archived";
};

export type ProductFace = { face: BoxFace; photo_path: string; target_index: number | null };

const mm = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(10, `${label} must be at least 10 mm.`)
    .max(2000, `${label} must be 2000 mm or less.`);

const dollars = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(100000, `${label} is too large.`)
    .transform((v) => Math.round(v * 100));

const HEX = /^#[0-9a-fA-F]{6}$/;

export const productInput = z
  .object({
    name: z.string().trim().min(1, "Enter a product name.").max(160),
    width_mm: mm("Width"),
    height_mm: mm("Height"),
    depth_mm: mm("Depth"),
    brand_name: z.string().trim().max(80).optional().default(""),
    mandatory_text: z.string().trim().max(200).optional().default(""),
    brand_colours: z
      .string()
      .optional()
      .default("")
      .transform((v) =>
        v
          .split(/[\s,]+/)
          .map((c) => c.trim())
          .filter(Boolean),
      )
      .refine((list) => list.every((c) => HEX.test(c)), "Colours must be hex codes like #1f6e7d.")
      .refine((list) => list.length <= 5, "Use at most 5 brand colours."),
    base_price: dollars("Base price"),
    premium_price: dollars("Premium price"),
    allow_custom_content: z.coerce.boolean().optional().default(false),
  })
  .refine((v) => v.premium_price >= v.base_price, {
    message: "The premium price must be at least the base price.",
    path: ["premium_price"],
  });

export type ProductInput = z.infer<typeof productInput>;

// Size of each face in millimetres, as seen from outside the box.
export function faceSizeMm(d: BoxDims, face: BoxFace): { w: number; h: number } {
  switch (face) {
    case "front":
    case "back":
      return { w: d.width_mm, h: d.height_mm };
    case "left":
    case "right":
      return { w: d.depth_mm, h: d.height_mm };
    case "top":
    case "bottom":
      return { w: d.width_mm, h: d.depth_mm };
  }
}

// The four side faces laid flat: front, right, back, left.
export function unrolledSizeMm(d: BoxDims): { w: number; h: number } {
  return { w: 2 * d.width_mm + 2 * d.depth_mm, h: d.height_mm };
}

// Pixel size to ask the image model for: the unrolled aspect ratio, sides a
// multiple of 16, longest side at most `maxSide`, shortest at least `minSide`.
export function generationSize(
  d: BoxDims,
  maxSide = 1408,
  minSide = 384,
): { width: number; height: number } {
  const { w, h } = unrolledSizeMm(d);
  const scale = maxSide / Math.max(w, h);
  const snap = (v: number) => Math.min(maxSide, Math.max(minSide, Math.round(v / 16) * 16));
  return { width: snap(w * scale), height: snap(h * scale) };
}

export type Rect = { left: number; top: number; width: number; height: number };

// Where each side face sits inside an artwork image of the given pixel size.
// The slices tile the full width exactly: no gaps and no overlap.
export function sideSlices(d: BoxDims, imageW: number, imageH: number): Record<SideFace, Rect> {
  const total = unrolledSizeMm(d).w;
  const edgesMm = [0, d.width_mm, d.width_mm + d.depth_mm, 2 * d.width_mm + d.depth_mm, total];
  const edges = edgesMm.map((e) => Math.round((e / total) * imageW));
  const rect = (i: number): Rect => ({
    left: edges[i],
    top: 0,
    width: Math.max(1, edges[i + 1] - edges[i]),
    height: imageH,
  });
  return { front: rect(0), right: rect(1), back: rect(2), left: rect(3) };
}

// The largest centred rectangle of the given aspect ratio (width / height)
// inside an image. Used when the artwork's shape differs from the box's.
export function centreCrop(imageW: number, imageH: number, aspect: number): Rect {
  let width = imageW;
  let height = Math.round(imageW / aspect);
  if (height > imageH) {
    height = imageH;
    width = Math.round(imageH * aspect);
  }
  width = Math.max(1, Math.min(imageW, width));
  height = Math.max(1, Math.min(imageH, height));
  return {
    left: Math.floor((imageW - width) / 2),
    top: Math.floor((imageH - height) / 2),
    width,
    height,
  };
}

// Output texture size for a face: real proportions, longest side `longest` px.
export function faceTextureSize(
  d: BoxDims,
  face: BoxFace,
  longest = 1024,
): { width: number; height: number } {
  const { w, h } = faceSizeMm(d, face);
  const scale = longest / Math.max(w, h);
  return { width: Math.max(8, Math.round(w * scale)), height: Math.max(8, Math.round(h * scale)) };
}

export function formatMoney(cents: number | null, currency: string): string {
  if (cents === null) return "";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);
}
