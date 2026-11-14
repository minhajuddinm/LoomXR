import { getPublicProduct } from "@/lib/customer-product";
import { createCustomerSession, getCustomerSession } from "@/lib/customer-session";
import { GenerationError, runGenerationRound } from "@/lib/generation/pipeline";
import { sanitizeCustomerAnswers } from "@/lib/questions";

// Image generation can take a while.
export const maxDuration = 120;

const STATUS: Record<GenerationError["code"], number> = {
  "round-limit": 429,
  "not-subscribed": 403,
  quota: 403,
  failed: 502,
};

// Starts a session on first use (consent required), then runs one round.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    consent?: boolean;
    answers?: unknown;
    customText?: string;
  } | null;
  if (!body?.slug) return Response.json({ error: "Bad request." }, { status: 400 });

  const product = await getPublicProduct(body.slug);
  if (!product) return Response.json({ error: "Product not found." }, { status: 404 });

  let session = await getCustomerSession(product.id);
  if (!session) {
    if (body.consent !== true) {
      return Response.json({ error: "Please accept the notice first." }, { status: 400 });
    }
    const answers = sanitizeCustomerAnswers(body.answers);
    if (!answers) return Response.json({ error: "Please answer every question." }, { status: 400 });
    session = await createCustomerSession(product.id, answers);
  }

  // Custom text: short, plain characters only. Proper moderation comes with
  // the rest of Phase 3; until then this keeps it to simple names and words.
  const raw = typeof body.customText === "string" ? body.customText.trim() : "";
  if (raw && !/^[\p{L}\p{N} .,!'&-]{1,24}$/u.test(raw)) {
    return Response.json(
      { error: "Use up to 24 letters, numbers and simple punctuation." },
      { status: 400 },
    );
  }

  try {
    const result = await runGenerationRound({ product, session, customText: raw || null });
    return Response.json(result);
  } catch (error) {
    if (error instanceof GenerationError) {
      return Response.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
    }
    console.error("Generation failed", error);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
