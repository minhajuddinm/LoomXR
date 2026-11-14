import Link from "next/link";
import { IconBox, IconCard, IconHome, IconLogout, IconShield } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

// Business pages always show live, per-business data. Never prerender them.
export const dynamic = "force-dynamic";

export default async function BusinessLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  const links = [
    { href: "/dashboard", label: "Dashboard", Icon: IconHome },
    { href: "/products", label: "Products", Icon: IconBox },
    { href: "/billing", label: "Billing", Icon: IconCard },
    ...(user.isAdmin ? [{ href: "/admin", label: "Admin", Icon: IconShield }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Sidebar on large screens, compact top bar on small ones. */}
      <header className="weave text-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-6 lg:py-7">
          <Link href="/dashboard" className="font-display text-2xl font-bold tracking-tight">
            Loom<span className="text-gold">XR</span>
          </Link>
          <p className="hidden text-sm text-paper/60 lg:mt-1 lg:block">Packaging, made personal</p>
        </div>

        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:px-4 lg:pb-0">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold text-paper/80 transition duration-200 hover:bg-paper/10 hover:text-paper"
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden border-t border-paper/10 px-6 py-5 lg:block">
          {isDemoMode() ? (
            <p className="rounded-lg bg-gold/20 px-3 py-2 text-sm font-semibold">Demo mode, no login</p>
          ) : (
            <form action="/auth/signout" method="post">
              {user.email && <p className="truncate text-sm text-paper/60">{user.email}</p>}
              <button type="submit" className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-paper/85 transition hover:text-paper">
                <IconLogout className="size-4" />
                Log out
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {!isDemoMode() && (
          <form action="/auth/signout" method="post" className="flex justify-end px-5 pt-3 lg:hidden">
            <button type="submit" className="min-h-11 text-sm font-semibold text-ink-soft underline underline-offset-4">
              Log out
            </button>
          </form>
        )}
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 animate-rise px-5 py-8 sm:px-8 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
