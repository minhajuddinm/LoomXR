"use client";

import { useActionState } from "react";
import { ui } from "@/lib/ui";
import { setPassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(setPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className={ui.label}>
          New password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={ui.input} />
        <p className="mt-1 text-sm text-ink-soft">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className={ui.label}>
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={ui.input} />
      </div>
      <div aria-live="polite">{state?.error && <p className={ui.error}>{state.error}</p>}</div>
      <button type="submit" disabled={pending} className={ui.button}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
