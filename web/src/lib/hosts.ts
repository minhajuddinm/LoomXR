// Hostname routing. One Next.js app serves two subdomains:
//   app.loomxrlabs.com  business dashboard
//   ar.loomxrlabs.com   anonymous customer flow
// Any other host (localhost, Vercel preview URLs) can reach every route by
// path, which is how phone testing works before DNS exists.

export type HostKind = "app" | "ar" | "any";

export const MARKETING_URL = "https://www.loomxrlabs.com";

export type HostDecision =
  | { action: "next" }
  | { action: "notFound" }
  | { action: "redirect"; to: string };

export function hostKind(host: string | null | undefined): HostKind {
  const name = (host ?? "").toLowerCase().split(":")[0];
  if (name.startsWith("app.")) return "app";
  if (name.startsWith("ar.")) return "ar";
  return "any";
}

// Routes the customer flow needs. Everything else belongs to the business app.
const CUSTOMER_PREFIXES = ["/p/", "/api/session", "/api/generate", "/api/designs"];

// Server-to-server routes that may arrive on either host.
const SHARED_PREFIXES = ["/api/cron"];

function hasPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  );
}

export function isCustomerPath(pathname: string): boolean {
  return hasPrefix(pathname, CUSTOMER_PREFIXES);
}

export function resolveHostRoute(
  host: string | null | undefined,
  pathname: string,
): HostDecision {
  const kind = hostKind(host);
  if (kind === "any") return { action: "next" };

  if (hasPrefix(pathname, SHARED_PREFIXES)) return { action: "next" };

  if (kind === "ar") {
    if (pathname === "/") return { action: "redirect", to: MARKETING_URL };
    return isCustomerPath(pathname) ? { action: "next" } : { action: "notFound" };
  }

  // kind === "app"
  return isCustomerPath(pathname) ? { action: "notFound" } : { action: "next" };
}

// Business pages that need a signed-in user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/billing",
  "/onboarding",
  "/products",
  "/orders",
  "/admin",
];
const AUTH_PAGES = ["/login", "/signup"];

export function isProtectedPath(pathname: string): boolean {
  return hasPrefix(pathname, PROTECTED_PREFIXES);
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.includes(pathname);
}

// Only allow same-site relative redirects after login.
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
