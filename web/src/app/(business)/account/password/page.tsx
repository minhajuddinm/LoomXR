import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Choose a password" };

export default async function PasswordPage() {
  const user = await requireUser();
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold tracking-tight">Choose a password</h1>
      <p className="mt-2 mb-6 text-ink-soft">
        {user.email ? `For ${user.email}. ` : ""}You will use it with your email to log in from now on.
      </p>
      <PasswordForm />
    </div>
  );
}
