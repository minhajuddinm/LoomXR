import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/auth";
import { safeNextPath } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["recovery", "invite", "signup", "email", "magiclink"];

// Landing point for one-time links: account invitations and password resets.
// The link carries a single-use token; exchanging it signs the person in, and
// they are then sent on to choose a password.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await getRequestOrigin();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"), "/account/password");

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
