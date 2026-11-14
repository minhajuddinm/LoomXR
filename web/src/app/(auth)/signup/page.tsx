import type { Metadata } from "next";
import Link from "next/link";
import { ui } from "@/lib/ui";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create a business account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Create a business account</h1>
      <p className="mt-2 mb-6 text-ink-soft">
        Already have one?{" "}
        <Link href="/login" className={ui.link}>
          Log in
        </Link>
      </p>
      <AuthForm mode="signup" next="/onboarding" />
    </>
  );
}
