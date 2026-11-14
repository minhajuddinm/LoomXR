import { MARKETING_URL } from "@/lib/hosts";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <a href={MARKETING_URL} className="mb-8 text-2xl font-bold tracking-tight text-ink">
        LoomXR
      </a>
      {children}
    </main>
  );
}
