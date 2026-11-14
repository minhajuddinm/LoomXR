import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/auth";
import { safeNextPath } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

// Landing point for Google sign-in and email confirmation links. Supabase
// sends a one-time code here, which is exchanged for a session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await getRequestOrigin();
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
