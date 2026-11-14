import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function BusinessLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            LoomXR
          </Link>
          <nav aria-label="Main" className="flex gap-5 text-base font-semibold">
            <Link href="/dashboard" className="hover:text-teal">
              Dashboard
            </Link>
            <Link href="/billing" className="hover:text-teal">
              Billing
            </Link>
          </nav>
          <form action="/auth/signout" method="post" className="ml-auto flex items-center gap-3">
            {user.email && (
              <span className="hidden text-sm text-ink-soft sm:inline">{user.email}</span>
            )}
            <button type="submit" className="text-sm font-semibold underline underline-offset-2">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>
    </>
  );
}
