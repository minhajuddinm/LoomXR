// Prompt templates. The business's answers produce a template with {{slots}};
// each shopper's answers fill the slots. Pure functions only.

import { CUSTOMER_SLOTS } from "../questions.ts";

const SLOT = /\{\{\s*([a-z_]+)\s*\}\}/g;

// The image model must never draw words or logos: those are added in code.
export const NO_TEXT_SUFFIX =
  "Flat two-dimensional artwork that fills the whole frame edge to edge, like a printed pattern seen straight on. Not a photo, render or mockup of a box, package or product. No panels, no frames, no borders. No text, no letters, no numbers, no logos, no watermark.";

export function parseSlots(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(SLOT)) found.add(match[1]);
  return [...found];
}

export function unknownSlots(template: string): string[] {
  return parseSlots(template).filter((s) => !CUSTOMER_SLOTS.includes(s));
}

export function fillTemplate(template: string, answers: Record<string, string>): string {
  const filled = template
    .replace(SLOT, (_, name: string) => answers[name] ?? "")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return `${filled} ${NO_TEXT_SUFFIX}`;
}

export type Brief = Partial<
  Record<"category" | "audience" | "tone" | "must_include" | "must_avoid", string>
>;

const CATEGORY_WORDS: Record<string, string> = {
  food: "a food product",
  beverage: "a tea, coffee or drinks product",
  beauty: "a beauty or personal care product",
  gift: "a gift or confectionery product",
  home: "a home and lifestyle product",
  other: "a retail product",
};

// A template built from the brief with no AI call. Used when no text model is
// configured, and as the starting point the model is asked to improve.
export function defaultTemplate(brief: Brief, brandColours: string[] = []): string {
  const parts = [
    `Flat decorative artwork, a continuous horizontal band, for the packaging of ${CATEGORY_WORDS[brief.category ?? "other"] ?? CATEGORY_WORDS.other}`,
    brief.audience ? `, bought by ${brief.audience}` : "",
    `. Overall feel: ${brief.tone || "warm and friendly"}, and {{mood}}, made for {{occasion}}.`,
    ` Style: {{style}}. Main subject: {{motif}}`,
    brief.must_include ? `, with hints of ${brief.must_include}` : "",
    `. Colour palette: {{colours}}`,
    brandColours.length ? `, accented with the brand colours ${brandColours.join(", ")}` : "",
    `. Spread the detail evenly from left to right, with nothing important only at the edges.`,
    brief.must_avoid ? ` Do not show ${brief.must_avoid}.` : "",
  ];
  return parts.join("").replace(/\s+\./g, ".").replace(/\s{2,}/g, " ").trim();
}
