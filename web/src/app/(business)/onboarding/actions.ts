"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string } | undefined;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your business name.")
    .max(120, "Keep the name under 120 characters."),
});

export async function createBusiness(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Runs as the user. RLS only accepts a row they own, and the column grants
  // only let them set the name, so plan and quota stay at their defaults.
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .insert({ owner_user_id: user.id, name: parsed.data.name });

  // 23505: this user already has a business (double submit). Carry on.
  if (error && error.code !== "23505") {
    return { error: "Could not save your business. Try again." };
  }
  redirect("/billing");
}
