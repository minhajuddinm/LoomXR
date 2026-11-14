import "server-only";

// Thin client for Together AI. Only two calls are needed: one image, one chat
// completion. Model names can be overridden with env vars.

const BASE = "https://api.together.xyz/v1";

export const IMAGE_MODEL = process.env.TOGETHER_IMAGE_MODEL || "black-forest-labs/FLUX.2-dev";
// Checked on 2026-11-14: available without a dedicated endpoint, $0.15 in /
// $0.60 out per million tokens. It reasons before answering, hence the
// generous max_tokens below.
export const TEXT_MODEL = process.env.TOGETHER_TEXT_MODEL || "openai/gpt-oss-120b";

// USD per image, from together.ai/pricing on 2026-11-13. Used for usage logs.
export const IMAGE_COST_USD: Record<string, number> = {
  "black-forest-labs/FLUX.2-dev": 0.0154,
  "black-forest-labs/FLUX.2-pro": 0.03,
};

export function hasTogether(): boolean {
  return Boolean(process.env.TOGETHER_API_KEY);
}

// Together sometimes answers "temporarily unavailable due to high demand"
// (as a 400), or 429 / 5xx. Those are worth a couple of retries.
function isTemporary(status: number, detail: string): boolean {
  return status === 429 || status >= 500 || /temporarily unavailable|high demand|overloaded/i.test(detail);
}

async function post(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await postOnce(path, body, timeoutMs);
    } catch (error) {
      const temporary = error instanceof TemporaryError || (error instanceof TypeError && attempt < attempts);
      if (!temporary || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
}

class TemporaryError extends Error {}

async function postOnce(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    const message = `Together ${path} failed (${response.status}): ${detail}`;
    throw isTemporary(response.status, detail) ? new TemporaryError(message) : new Error(message);
  }
  return response.json();
}

export async function generateImage(input: {
  prompt: string;
  width: number;
  height: number;
  seed: number;
}): Promise<Buffer> {
  const json = (await post(
    "/images/generations",
    { model: IMAGE_MODEL, n: 1, response_format: "b64_json", ...input },
    90_000,
  )) as { data?: Array<{ b64_json?: string; url?: string }> };

  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const image = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
    if (!image.ok) throw new Error(`Could not download generated image (${image.status})`);
    return Buffer.from(await image.arrayBuffer());
  }
  throw new Error("Together returned no image");
}

export async function chat(system: string, user: string): Promise<string> {
  const json = (await post(
    "/chat/completions",
    {
      model: TEXT_MODEL,
      max_tokens: 1500,
      temperature: 0.6,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    30_000,
  )) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Together returned no text");
  return text;
}
