import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthPage,
  isProtectedPath,
  resolveHostRoute,
  safeNextPath,
} from "@/lib/hosts";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this file "proxy" (it was "middleware" before).
// It does two things: hostname routing, and an optimistic signed-in check.
// The real authorization check happens again in each page and route.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const decision = resolveHostRoute(request.headers.get("host"), pathname);
  if (decision.action === "notFound") {
    return new NextResponse("Not found", { status: 404 });
  }
  if (decision.action === "redirect") {
    return NextResponse.redirect(decision.to);
  }

  const protectedPath = isProtectedPath(pathname);
  const authPage = isAuthPage(pathname);
  if (!protectedPath && !authPage) return NextResponse.next();

  const { response, userId } = await updateSession(request);

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [targetPath, query = ""] = path.split("?");
    url.pathname = targetPath;
    url.search = query ? `?${query}` : "";
    const redirect = NextResponse.redirect(url);
    // Keep any refreshed session cookies.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (protectedPath && !userId) {
    const next = encodeURIComponent(pathname + request.nextUrl.search);
    return redirectTo(`/login?next=${next}`);
  }
  if (authPage && userId) {
    return redirectTo(safeNextPath(request.nextUrl.searchParams.get("next")));
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico|txt)$).*)",
  ],
};
