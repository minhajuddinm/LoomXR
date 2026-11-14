"use client";

import { useActionState } from "react";
import { BRIEF_QUESTIONS, CUSTOMER_SLOTS } from "@/lib/questions";
import { ui } from "@/lib/ui";
import type { FormState } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Status({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state?.error && <p className={ui.error}>{state.error}</p>}
      {state?.message && <p className={ui.notice}>{state.message}</p>}
    </div>
  );
}

export function BriefForm({ action, answers }: { action: Action; answers: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {BRIEF_QUESTIONS.map((q) => (
        <div key={q.id}>
          <label htmlFor={`brief-${q.id}`} className={ui.label}>
            {q.label}
          </label>
          {q.kind === "select" ? (
            <select id={`brief-${q.id}`} name={q.id} defaultValue={answers[q.id] ?? ""} required className={ui.input}>
              <option value="" disabled>
                Choose one
              </option>
              {q.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <input id={`brief-${q.id}`} name={q.id} defaultValue={answers[q.id] ?? ""} placeholder={q.placeholder} maxLength={200} className={ui.input} />
          )}
          {q.help && <p className="mt-1 text-sm text-ink-soft">{q.help}</p>}
        </div>
      ))}
      <Status state={state} />
      <button type="submit" disabled={pending} className={ui.button}>
        {pending ? "Saving…" : "Save answers and build prompt"}
      </button>
    </form>
  );
}

export function TemplateForm({ action, template }: { action: Action; template: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="template" className={ui.label}>
        Prompt template
      </label>
      {/* key resets the box when a new template is generated */}
      <textarea id="template" name="template" key={template} defaultValue={template} rows={7} className={`${ui.input} font-mono text-sm`} />
      <p className="text-sm text-ink-soft">
        Each customer&apos;s answers replace the placeholders: {CUSTOMER_SLOTS.map((s) => `{{${s}}}`).join(", ")}. The
        AI never draws text or logos; those are added afterwards.
      </p>
      <Status state={state} />
      <button type="submit" disabled={pending} className={ui.buttonQuiet}>
        {pending ? "Saving…" : "Save edited template"}
      </button>
    </form>
  );
}
