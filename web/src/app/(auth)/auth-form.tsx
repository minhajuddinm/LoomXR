"use client";

import { useActionState } from "react";
import { ui } from "@/lib/ui";
import { signIn, signInWithGoogle, signUp, type AuthFormState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    undefined,
  );

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className={ui.label}>
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={ui.input}
          />
        </div>
        <div>
          <label htmlFor="password" className={ui.label}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            className={ui.input}
          />
          {mode === "signup" && (
            <p className="mt-1 text-sm text-ink-soft">At least 8 characters.</p>
          )}
        </div>

        <div aria-live="polite">
          {state?.error && <p className={ui.error}>{state.error}</p>}
          {state?.message && <p className={ui.notice}>{state.message}</p>}
        </div>

        <button type="submit" disabled={pending} className={`${ui.button} w-full`}>
          {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={`${ui.buttonQuiet} w-full`}>
          Continue with Google
        </button>
      </form>
    </div>
  );
}
