import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabasePublicEnv, publicEnv } from "@/lib/env";

// Refreshes the Supabase session cookie and reports who is signed in.
// Server Components cannot write cookies, so the refresh has to happen here.
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request });
  if (!hasSupabasePublicEnv()) return { response, userId: null };

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims verifies the token signature; do not trust getSession here.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { response, userId };
}
