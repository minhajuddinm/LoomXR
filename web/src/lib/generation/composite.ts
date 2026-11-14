import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { BOX_FACES, faceTextureSize, type BoxDims, type BoxFace } from "@/lib/products";
import type { Palette, PlateShape } from "./directions";

// Builds the finished texture for every face of a box from two AI images:
// the composed front panel and the matching pattern.
//
// The AI never draws words. The label (logo or brand name, the customer's own
// text, the required text) is typeset here from bundled font files and turned
// into shapes by satori, so it is always spelled right and looks the same on
// any server.

type Font = { name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" | "italic" };
let fonts: Font[] | undefined;

function loadFonts(): Font[] {
  const file = (name: string) => readFileSync(path.join(process.cwd(), "assets", "fonts", name));
  fonts ??= [
    { name: "Playfair", data: file("playfair-700.woff"), weight: 700, style: "normal" },
    { name: "Playfair", data: file("playfair-400-italic.woff"), weight: 400, style: "italic" },
    { name: "Archivo", data: file("archivo-500.woff"), weight: 500, style: "normal" },
    { name: "Archivo", data: file("archivo-700.woff"), weight: 700, style: "normal" },
  ];
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children?: Node | Node[] | string): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});

async function render(width: number, height: number, tree: Node): Promise<Buffer> {
  const svg = await satori(tree as unknown as React.ReactNode, { width, height, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type LabelContent = {
  logo?: Buffer | null;
  brandName?: string | null;
  customText?: string | null;
  mandatoryText?: string | null;
};

// The typeset label. `unit` is the shorter side of the face in pixels, so the
// label scales with the box.
async function labelNodes(
  content: LabelContent,
  palette: Palette,
  unit: number,
  maxWidth: number,
): Promise<Node[]> {
  const nodes: Node[] = [];
  const rule = () =>
    box({ width: unit * 0.16, height: Math.max(2, unit * 0.004), backgroundColor: palette.accent });
  const text = (style: Record<string, unknown>, value: string) =>
    box({ color: palette.ink, textAlign: "center", justifyContent: "center", ...style }, value);

  if (content.logo) {
    const logo = await sharp(content.logo)
      .resize(Math.round(maxWidth * 0.8), Math.round(unit * 0.2), { fit: "inside" })
      .png()
      .toBuffer();
    const meta = await sharp(logo).metadata();
    nodes.push({
      type: "img",
      props: {
        src: `data:image/png;base64,${logo.toString("base64")}`,
        width: meta.width,
        height: meta.height,
      },
    });
  } else if (content.brandName) {
    nodes.push(
      text(
        { fontFamily: "Playfair", fontWeight: 700, fontSize: unit * 0.092, lineHeight: 1.1 },
        content.brandName,
      ),
    );
  }

  if (content.customText) {
    if (nodes.length) nodes.push(rule());
    nodes.push(
      text(
        { fontFamily: "Playfair", fontStyle: "italic", fontWeight: 400, fontSize: unit * 0.07, lineHeight: 1.15 },
        content.customText,
      ),
    );
  }

  if (content.mandatoryText) {
    if (nodes.length) nodes.push(rule());
    nodes.push(
      text(
        {
          fontFamily: "Archivo",
          fontWeight: 500,
          fontSize: unit * 0.03,
          letterSpacing: unit * 0.004,
          lineHeight: 1.3,
          textTransform: "uppercase",
        },
        content.mandatoryText,
      ),
    );
  }
  return nodes;
}

// The label plate: a solid panel in the design's own palette with a fine
// double keyline, in one of three shapes to suit the layout behind it.
async function plateOverlay(
  width: number,
  height: number,
  shape: PlateShape,
  palette: Palette,
  content: LabelContent,
): Promise<Buffer | null> {
  const unit = Math.min(width, height);
  const line = Math.max(2, Math.round(unit * 0.004));
  const gap = Math.round(unit * 0.018);

  const size =
    shape === "medallion"
      ? { width: unit * 0.66, height: unit * 0.66 }
      : shape === "band"
        ? { width, height: height * 0.36 }
        : { width: width * 0.68, height: height * 0.46 };
  const inner = shape === "medallion" ? size.width * 0.68 : size.width * 0.8;

  const nodes = await labelNodes(content, palette, unit, inner);
  if (!nodes.length) return null;

  const radius = shape === "medallion" ? size.width : shape === "band" ? 0 : unit * 0.012;
  const sides = (w: number) =>
    shape === "band"
      ? { borderTop: `${w}px solid ${palette.accent}`, borderBottom: `${w}px solid ${palette.accent}` }
      : { border: `${w}px solid ${palette.accent}` };

  const plate = box(
    {
      width: size.width,
      height: size.height,
      backgroundColor: palette.plate,
      borderRadius: radius,
      padding: gap,
      boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
      ...sides(line),
    },
    box(
      {
        flex: 1,
        borderRadius: radius,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: unit * 0.028,
        padding: `0 ${Math.max(0, (size.width - inner) / 2 - gap)}px`,
        ...sides(Math.max(1, line - 1)),
      },
      nodes,
    ),
  );

  return render(width, height, box({ width, height, alignItems: "center", justifyContent: "center" }, plate));
}

// Now and then the model returns the artwork as a picture of a card on a plain
// backdrop. Trimming removes any uniform border; if there is none, the image
// comes back unchanged.
async function trimBorder(image: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(image).trim({ threshold: 18 }).png().toBuffer({ resolveWithObject: true });
    const meta = await sharp(image).metadata();
    // Ignore a trim that removes most of the picture: that is a flat design,
    // not a border.
    return info.width * info.height < meta.width * meta.height * 0.35 ? image : data;
  } catch {
    return image;
  }
}

export type CompositeInput = LabelContent & {
  front: Buffer;
  pattern: Buffer;
  dims: BoxDims;
  plate: PlateShape;
  palette: Palette;
};

// Which part of the pattern each face shows, so neighbouring faces differ.
const PATTERN_CROP: Record<Exclude<BoxFace, "front">, string> = {
  right: "left",
  back: "centre",
  left: "right",
  top: "top",
  bottom: "bottom",
};

export async function buildFaceTextures(input: CompositeInput): Promise<Record<BoxFace, Buffer>> {
  const { dims, palette } = input;
  const out = {} as Record<BoxFace, Buffer>;
  const pattern = await trimBorder(input.pattern);

  for (const face of BOX_FACES) {
    const size = faceTextureSize(dims, face);
    const source = face === "front" ? input.front : pattern;
    // "cover" crops to the face's shape. Nothing is ever stretched.
    const base = await sharp(source)
      .resize(size.width, size.height, {
        fit: "cover",
        position: face === "front" ? "centre" : PATTERN_CROP[face],
      })
      .png()
      .toBuffer();

    let overlay: Buffer | null = null;
    if (face === "front") {
      overlay = await plateOverlay(size.width, size.height, input.plate, palette, input);
    } else if (face === "back") {
      overlay = await plateOverlay(size.width, size.height, "frame", palette, {
        brandName: input.brandName,
        mandatoryText: input.mandatoryText,
      });
    }

    out[face] = await sharp(base)
      .composite(overlay ? [{ input: overlay }] : [])
      .jpeg({ quality: 88 })
      .toBuffer();
  }
  return out;
}
