import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Anonymous customer sessions. The browser holds a random token in an
// httpOnly cookie; the database stores only its hash. No account, no name.

const COOKIE = "lx_session";
const DAY_SECONDS = 24 * 60 * 60;

export type CustomerSession = {
  id: string;
  product_id: string;
  answers: Record<string, string>;
  rounds_used: number;
  expires_at: string;
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function getCustomerSession(productId: string): Promise<CustomerSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, token] = raw.split(".");
  if (!id || !token) return null;

  const { data } = await createAdminClient()
    .from("customer_sessions")
    .select("id, product_id, answers, rounds_used, expires_at, token_hash")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.token_hash !== hash(token)) return null;
  if (data.product_id !== productId || new Date(data.expires_at) < new Date()) return null;

  return {
    id: data.id,
    product_id: data.product_id,
    answers: data.answers,
    rounds_used: data.rounds_used,
    expires_at: data.expires_at,
  };
}

export async function createCustomerSession(
  productId: string,
  answers: Record<string, string>,
): Promise<CustomerSession> {
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await createAdminClient()
    .from("customer_sessions")
    .insert({
      product_id: productId,
      token_hash: hash(token),
      answers,
      consented_at: new Date().toISOString(),
    })
    .select("id, product_id, answers, rounds_used, expires_at")
    .single();
  if (error) throw new Error(`Could not start session: ${error.message}`);

  (await cookies()).set(COOKIE, `${data.id}.${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAY_SECONDS,
  });
  return data as CustomerSession;
}
