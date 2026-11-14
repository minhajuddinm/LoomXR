"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { error?: string } | undefined;

export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  await requireUser();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password.length > 72) return { error: "Use 72 characters or fewer." };
  if (password !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not save the password. Open your link again and retry." };
  redirect("/dashboard");
}
