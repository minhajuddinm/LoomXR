import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import sharp, { type OverlayOptions } from "sharp";
import {
  BOX_FACES,
  SIDE_FACES,
  centreCrop,
  faceTextureSize,
  sideSlices,
  unrolledSizeMm,
  type BoxDims,
  type BoxFace,
} from "@/lib/products";

// Turns one wide artwork image into a finished texture for each face of a box.
//
// The AI only ever paints the background. Logo and text are placed here, in
// code, so they are always spelled correctly and always in the same spot.
// Text is drawn by satori from a bundled font file and converted to shapes,
// so it looks the same on any server.

let fonts: { name: string; data: Buffer; weight: 500 | 700; style: "normal" }[] | undefined;

function loadFonts() {
  fonts ??= ([500, 700] as const).map((weight) => ({
    name: "Archivo",
    data: readFileSync(path.join(process.cwd(), "assets", "fonts", `archivo-${weight}.woff`)),
    weight,
    style: "normal" as const,
  }));
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (style: Record<string, unknown>, children?: Node | Node[] | string): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

async function renderOverlay(width: number, height: number, tree: Node): Promise<Buffer> {
  const svg = await satori(tree as unknown as React.ReactNode, { width, height, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// A soft panel behind text so it stays readable on any artwork.
const panel = (fontSize: number, text: string, weight: 500 | 700 = 500): Node =>
  el(
    {
      backgroundColor: "rgba(255,255,255,0.88)",
      color: "#12283a",
      borderRadius: fontSize * 0.5,
      padding: `${fontSize * 0.45}px ${fontSize * 0.8}px`,
      fontSize,
      fontWeight: weight,
      fontFamily: "Archivo",
      textAlign: "center",
      justifyContent: "center",
      maxWidth: "88%",
      lineHeight: 1.2,
    },
    text,
  );

// The image model has minimum and maximum sizes, so for very wide or very tall
// boxes the artwork comes back in a different shape than the unrolled box.
// Crop the centre to the true shape first, so nothing is stretched.
async function cropToUnrolledAspect(artwork: Buffer, dims: BoxDims): Promise<Buffer> {
  const meta = await sharp(artwork).metadata();
  const want = unrolledSizeMm(dims);
  const crop = centreCrop(meta.width, meta.height, want.w / want.h);
  if (crop.width === meta.width && crop.height === meta.height) return artwork;
  return sharp(artwork).extract(crop).png().toBuffer();
}

export type CompositeInput = {
  artwork: Buffer;
  dims: BoxDims;
  logo?: Buffer | null;
  brandName?: string | null;
  mandatoryText?: string | null;
  customText?: string | null;
};

export async function buildFaceTextures(input: CompositeInput): Promise<Record<BoxFace, Buffer>> {
  const { dims } = input;
  const artwork = await cropToUnrolledAspect(input.artwork, dims);
  const meta = await sharp(artwork).metadata();
  const slices = sideSlices(dims, meta.width, meta.height);
  const out = {} as Record<BoxFace, Buffer>;

  for (const face of SIDE_FACES) {
    const size = faceTextureSize(dims, face);
    const base = sharp(artwork).extract(slices[face]).resize(size.width, size.height, { fit: "fill" });
    const unit = Math.min(size.width, size.height);
    const layers: OverlayOptions[] = [];

    if (face === "front") {
      const children: Node[] = [];
      if (input.logo) {
        const logoBox = Math.round(size.width * 0.42);
        const logo = await sharp(input.logo)
          .resize(logoBox, Math.round(size.height * 0.2), { fit: "inside" })
          .png()
          .toBuffer();
        const logoMeta = await sharp(logo).metadata();
        const pad = Math.round(unit * 0.04);
        const plate = await sharp({
          create: {
            width: logoMeta.width + pad * 2,
            height: logoMeta.height + pad * 2,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0.9 },
          },
        })
          .composite([{ input: logo, left: pad, top: pad }])
          .png()
          .toBuffer();
        layers.push({
          input: plate,
          left: Math.round((size.width - logoMeta.width - pad * 2) / 2),
          top: Math.round(size.height * 0.07),
        });
      } else if (input.brandName) {
        children.push(
          el({ position: "absolute", top: size.height * 0.07, left: 0, right: 0, justifyContent: "center" }, [
            panel(unit * 0.085, input.brandName, 700),
          ]),
        );
      }
      if (input.customText) {
        children.push(
          el({ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }, [
            panel(unit * 0.075, input.customText, 700),
          ]),
        );
      }
      if (input.mandatoryText) {
        children.push(
          el({ position: "absolute", bottom: size.height * 0.05, left: 0, right: 0, justifyContent: "center" }, [
            panel(unit * 0.04, input.mandatoryText),
          ]),
        );
      }
      if (children.length) {
        layers.push({
          input: await renderOverlay(size.width, size.height, el({ width: "100%", height: "100%", position: "relative" }, children)),
        });
      }
    }

    if (face === "back" && (input.brandName || input.mandatoryText)) {
      const children: Node[] = [];
      if (input.brandName) children.push(panel(unit * 0.07, input.brandName, 700));
      if (input.mandatoryText) children.push(panel(unit * 0.04, input.mandatoryText));
      layers.push({
        input: await renderOverlay(
          size.width,
          size.height,
          el({ width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: unit * 0.04 }, children),
        ),
      });
    }

    // Composite needs a concrete buffer of the resized base first.
    const resized = await base.png().toBuffer();
    out[face] = await sharp(resized).composite(layers).jpeg({ quality: 86 }).toBuffer();
  }

  // Top and bottom continue the artwork: a soft blurred crop of the front.
  for (const face of ["top", "bottom"] as const) {
    const size = faceTextureSize(dims, face);
    out[face] = await sharp(artwork)
      .extract(slices.front)
      .resize(size.width, size.height, { fit: "cover", position: face === "top" ? "top" : "bottom" })
      .blur(12)
      .jpeg({ quality: 82 })
      .toBuffer();
  }

  return out;
}

export { BOX_FACES };
