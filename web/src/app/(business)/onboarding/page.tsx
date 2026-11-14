import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBusiness } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  if (await getBusiness()) redirect("/dashboard");

  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold tracking-tight">Set up your business</h1>
      <p className="mt-2 mb-6 text-ink-soft">
        This is the name your team sees in the dashboard. You can change it later.
      </p>
      <OnboardingForm />
    </div>
  );
}
