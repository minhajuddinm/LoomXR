// Art direction. This is what turns a vague request ("floral, blue") into a
// prompt a designer would write. The approach comes from the HYPAR thesis
// project, where it produced the strongest results:
//
//   1. Two images per design, not one: a composed FRONT PANEL at the front
//      face's own proportions, and a matching seamless PATTERN for the other
//      faces. (One wide image cut into faces gives the front a random crop.)
//   2. Prompts name a design language, materials and a layout, the way a
//      packaging brief does, instead of listing adjectives.
//   3. Each of the three designs in a round uses a different layout, so the
//      customer sees three real options and not three near-copies.
//
// The centre of the front is kept plain so the label (logo, name, required
// text) can be typeset there in code, always spelled correctly.

export type PlateShape = "frame" | "medallion" | "band";

export type Palette = {
  background: string; // words for the prompt
  plate: string; // label background (hex)
  ink: string; // label text (hex)
  accent: string; // label rules and border (hex)
};

// Keyed by the customer's "colours" answer.
const PALETTES: Record<string, Palette> = {
  "warm reds, oranges and golds": { background: "deep terracotta red", plate: "#fbf3e4", ink: "#5a1e12", accent: "#b8862f" },
  "cool blues and greens": { background: "deep teal blue", plate: "#f6f3e8", ink: "#12324a", accent: "#b08d4f" },
  "earthy browns, greens and terracotta": { background: "warm olive green", plate: "#f3ead9", ink: "#3b2f22", accent: "#9a6b3a" },
  "soft pastel tones": { background: "soft blush pink", plate: "#fffaf5", ink: "#4a3f55", accent: "#c9a15a" },
  "black, white and one accent colour": { background: "matte charcoal black", plate: "#ffffff", ink: "#141414", accent: "#141414" },
};
const DEFAULT_PALETTE = PALETTES["cool blues and greens"];

// Keyed by the customer's "style" answer. Each is a design language with the
// materials and finish that go with it.
const STYLES: Record<string, { language: string; pattern: string }> = {
  "Art Deco geometry with fine metallic gold linework": {
    language: "Art Deco: crisp stepped geometry, symmetrical fan and sunburst shapes, fine metallic gold-foil linework",
    pattern: "small repeating Art Deco fans and stepped geometric shapes in fine gold linework",
  },
  "vintage botanical engraving with soft colour": {
    language: "vintage botanical illustration: precise engraved linework with soft hand-tinted colour, like a 19th-century herbarium plate",
    pattern: "small repeating botanical sprigs in fine engraved linework with soft tinted colour",
  },
  "mid-century modern shapes with a screen-print look": {
    language: "mid-century modern graphic design: overlapping circles, arcs and leaf shapes in flat colour, slightly off-register screen-print look",
    pattern: "small repeating mid-century shapes, overlapping circles and arcs in flat screen-print colour",
  },
  "loose hand-painted watercolour": {
    language: "loose hand-painted watercolour: soft translucent washes, visible brush marks and cold-press paper grain",
    pattern: "small repeating hand-painted watercolour motifs with soft washes on paper grain",
  },
  "luxury minimal with one fine line motif": {
    language: "luxury minimal: large calm areas of flat colour, one delicate continuous-line drawing, a single thin foil rule, generous empty space",
    pattern: "sparse repeating fine-line motifs, mostly calm flat colour",
  },
  "1970s retro pop with bold wavy shapes": {
    language: "1970s retro pop: bold wavy organic shapes, rounded blobs and stripes in saturated flat colour with a glossy finish",
    pattern: "repeating bold wavy 1970s shapes and stripes in saturated flat colour",
  },
};
const DEFAULT_STYLE = STYLES["vintage botanical engraving with soft colour"];

// Five layouts, one per design in a round. `open` layouts keep the middle of
// the panel empty for the label; the others run the artwork edge to edge and
// let the label plate sit on top.
const LAYOUTS: Array<{ plate: PlateShape; layout: string; open?: boolean }> = [
  {
    plate: "frame",
    open: true,
    layout:
      "an ornamental border runs around all four edges, with the main subject clustered richly in the four corners and along the edges",
  },
  {
    plate: "medallion",
    open: true,
    layout: "the main subject forms a full, symmetrical wreath ringing the middle of the panel, radiating outward to the edges",
  },
  {
    plate: "band",
    open: true,
    layout:
      "the main subject fills the top third and the bottom third of the panel as two rich horizontal friezes mirrored across the middle",
  },
  {
    plate: "frame",
    open: true,
    layout:
      "an asymmetrical, dynamic composition: the main subject sweeps in diagonally from the bottom-left corner and from the top-right corner, large in scale",
  },
  {
    plate: "medallion",
    layout:
      "a bold all-over composition: the main subject is drawn large and fills the entire panel evenly from edge to edge, dense and rich",
  },
];

export const LAYOUT_COUNT = LAYOUTS.length;

export const QUALITY =
  "Matte paper stock with fine grain and subtle embossing. Premium retail packaging, confident, balanced and intentional, professional graphic design.";

export const NEGATIVE =
  "No text, no letters, no numbers, no logos, no label, no badge, no box, no product photo, no mockup, no hands, no people.";

export type ArtDirection = {
  frontPrompt: string;
  patternPrompt: string;
  plate: PlateShape;
  palette: Palette;
};

export function artDirection(input: {
  designIndex: number;
  answers: Record<string, string>;
  // The business's filled-in template: product, feel, subject, rules.
  brief: string;
}): ArtDirection {
  const { answers, brief } = input;
  const palette = PALETTES[answers.colours] ?? DEFAULT_PALETTE;
  const style = STYLES[answers.style] ?? DEFAULT_STYLE;
  const { plate, layout, open } = LAYOUTS[((input.designIndex % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length];
  const motif = answers.motif ?? "abstract shapes";

  const frontPrompt = [
    "Flat 2D front panel design for retail packaging, a pure graphic layout seen straight on, filling the whole frame edge to edge.",
    `Design language: ${style.language}.`,
    `Layout: ${layout}.${open ? ` The middle of the panel is left as plain, empty ${palette.background} with nothing in it.` : ""}`,
    `Background colour: ${palette.background}.`,
    brief,
    QUALITY,
    NEGATIVE,
  ].join(" ");

  const patternPrompt = [
    "Seamless tileable surface pattern as a flat digital swatch: the repeat fills the entire image from edge to edge on all four sides, with no margin, no white space, no border, no shadow and no object. Even small-scale repeat with no focal point.",
    `${style.pattern}, showing ${motif}, in ${answers.colours ?? "harmonious colours"} on a ${palette.background} background.`,
    QUALITY,
    NEGATIVE,
  ].join(" ");

  return { frontPrompt, patternPrompt, plate, palette };
}

export const STYLE_VALUES = Object.keys(STYLES);
export const COLOUR_VALUES = Object.keys(PALETTES);
