import { MARKETING_URL } from "@/lib/hosts";

// Split screen: brand statement on the left (large screens), form on the right.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="weave flex flex-col justify-between px-6 py-6 text-paper lg:w-[44%] lg:px-12 lg:py-12">
        <a href={MARKETING_URL} className="font-display text-2xl font-bold tracking-tight">
          Loom<span className="text-gold">XR</span>
        </a>
        <div className="hidden lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">For consumer brands</p>
          <p className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Packaging designed for one customer, seen on the real box before it is made.
          </p>
          <p className="mt-5 max-w-md text-lg text-paper/70">
            Set up a product once. Every shopper who scans its code gets designs made for them.
          </p>
        </div>
        <p className="hidden text-sm text-paper/50 lg:block">LoomXR Labs Inc., Ontario</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-rise rounded-2xl border border-rule/80 bg-paper p-7 shadow-lift sm:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
