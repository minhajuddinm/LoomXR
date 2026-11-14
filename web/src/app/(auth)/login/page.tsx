import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/hosts";
import { ui } from "@/lib/ui";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Business login" };

const ERRORS: Record<string, string> = {
  google: "Google sign-in could not start. Try again, or use email.",
  callback: "That sign-in link is invalid or has expired. Log in again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Business login</h1>
      <p className="mt-2 mb-6 text-ink-soft">
        New to LoomXR?{" "}
        <Link href="/signup" className={ui.link}>
          Create an account
        </Link>
      </p>
      {error && <p className={`${ui.error} mb-4`}>{error}</p>}
      <AuthForm mode="login" next={next} />
    </>
  );
}
