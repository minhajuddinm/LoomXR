"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestOrigin } from "@/lib/auth";
import { safeNextPath } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string } | undefined;

const credentials = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
});

function parse(formData: FormData) {
  return credentials.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Confirm your email first. Check your inbox for the link."
          : "Wrong email or password.",
    };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const origin = await getRequestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: error.message };

  // With email confirmation off, Supabase signs the user in straight away.
  if (data.session) redirect("/onboarding");

  // Same message whether or not the address already has an account, so this
  // form cannot be used to find out who is registered.
  return { message: "Check your email for a confirmation link to finish signing up." };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const origin = await getRequestOrigin();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
