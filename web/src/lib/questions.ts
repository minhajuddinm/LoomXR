// The two questionnaires.
//   BRIEF_QUESTIONS     answered once by the business, per product.
//   CUSTOMER_QUESTIONS  answered by each shopper. General taste only: nothing
//                       here identifies a person.

export type Choice = { value: string; label: string };

export type BriefQuestion =
  | { id: string; label: string; help?: string; kind: "select"; choices: Choice[] }
  | { id: string; label: string; help?: string; kind: "text"; placeholder?: string };

export const BRIEF_QUESTIONS: BriefQuestion[] = [
  {
    id: "category",
    label: "What kind of product is it?",
    kind: "select",
    choices: [
      { value: "food", label: "Food or snacks" },
      { value: "beverage", label: "Tea, coffee or drinks" },
      { value: "beauty", label: "Beauty or personal care" },
      { value: "gift", label: "Gifts or confectionery" },
      { value: "home", label: "Home or lifestyle" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    id: "audience",
    label: "Who usually buys it?",
    kind: "text",
    placeholder: "e.g. adults buying a small gift",
  },
  {
    id: "tone",
    label: "How should the packaging feel?",
    kind: "select",
    choices: [
      { value: "premium and refined", label: "Premium and refined" },
      { value: "warm and friendly", label: "Warm and friendly" },
      { value: "bold and energetic", label: "Bold and energetic" },
      { value: "natural and calm", label: "Natural and calm" },
      { value: "playful and fun", label: "Playful and fun" },
    ],
  },
  {
    id: "must_include",
    label: "Anything the artwork should always suggest?",
    help: "Themes or ingredients, not text. Text and logos are added separately.",
    kind: "text",
    placeholder: "e.g. tea leaves, citrus",
  },
  {
    id: "must_avoid",
    label: "Anything the artwork must never show?",
    kind: "text",
    placeholder: "e.g. people, animals, alcohol",
  },
];

export type CustomerQuestion = { id: string; label: string; choices: Choice[] };

export const CUSTOMER_QUESTIONS: CustomerQuestion[] = [
  {
    id: "occasion",
    label: "What is it for?",
    choices: [
      { value: "an everyday treat", label: "A treat for me" },
      { value: "a gift for someone", label: "A gift" },
      { value: "a celebration", label: "A celebration" },
      { value: "no particular occasion", label: "Just curious" },
    ],
  },
  {
    id: "mood",
    label: "Pick a mood",
    choices: [
      { value: "calm and soothing", label: "Calm" },
      { value: "bold and striking", label: "Bold" },
      { value: "playful and joyful", label: "Playful" },
      { value: "elegant and refined", label: "Elegant" },
      { value: "cozy and warm", label: "Cozy" },
    ],
  },
  {
    id: "colours",
    label: "Colours you like",
    choices: [
      { value: "warm reds, oranges and golds", label: "Warm" },
      { value: "cool blues and greens", label: "Cool" },
      { value: "earthy browns, greens and terracotta", label: "Earthy" },
      { value: "soft pastel tones", label: "Pastel" },
      { value: "black, white and one accent colour", label: "Monochrome" },
    ],
  },
  {
    id: "style",
    label: "Design style",
    // Each value is a design language defined in generation/directions.ts.
    choices: [
      { value: "Art Deco geometry with fine metallic gold linework", label: "Art Deco" },
      { value: "vintage botanical engraving with soft colour", label: "Botanical" },
      { value: "mid-century modern shapes with a screen-print look", label: "Mid-century" },
      { value: "loose hand-painted watercolour", label: "Watercolour" },
      { value: "luxury minimal with one fine line motif", label: "Minimal" },
      { value: "1970s retro pop with bold wavy shapes", label: "Retro pop" },
    ],
  },
  {
    id: "motif",
    label: "What should it show?",
    choices: [
      { value: "leaves, plants and nature", label: "Nature" },
      { value: "flowers in bloom", label: "Floral" },
      { value: "abstract shapes and textures", label: "Abstract" },
      { value: "ocean waves and water", label: "Ocean" },
      { value: "stars, moon and night sky", label: "Night sky" },
      { value: "city streets and architecture", label: "City" },
    ],
  },
];

export const CUSTOMER_SLOTS = CUSTOMER_QUESTIONS.map((q) => q.id);

// Keeps only known questions with one of their listed answers, so a tampered
// request cannot inject free text into the image prompt.
export function sanitizeCustomerAnswers(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const clean: Record<string, string> = {};
  for (const q of CUSTOMER_QUESTIONS) {
    const value = raw[q.id];
    if (typeof value !== "string" || !q.choices.some((c) => c.value === value)) return null;
    clean[q.id] = value;
  }
  return clean;
}
