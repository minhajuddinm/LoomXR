"use client";

import { useActionState } from "react";
import { ui } from "@/lib/ui";
import { createBusiness, type OnboardingState } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createBusiness,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className={ui.label}>
          Business name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          maxLength={120}
          required
          className={ui.input}
        />
      </div>
      <div aria-live="polite">{state?.error && <p className={ui.error}>{state.error}</p>}</div>
      <button type="submit" disabled={pending} className={ui.button}>
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
