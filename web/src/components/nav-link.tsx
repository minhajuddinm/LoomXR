"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar link that marks the section you are in.
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 font-semibold transition duration-200 hover:bg-paper/10 hover:text-paper ${
        active ? "bg-paper/12 text-paper shadow-[inset_3px_0_0_var(--color-gold)]" : "text-paper/75"
      }`}
    >
      {children}
    </Link>
  );
}
