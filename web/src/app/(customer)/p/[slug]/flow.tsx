"use client";

import { useState } from "react";
import { CUSTOMER_QUESTIONS } from "@/lib/questions";
import { ui } from "@/lib/ui";

type Design = { id: string; textures: Record<string, string> };
type Step = "consent" | "questions" | "working" | "designs" | "done";

export function Flow(props: {
  slug: string;
  productName: string;
  brandName: string | null;
  premiumPrice: string;
  basePrice: string;
  allowCustomText: boolean;
  arReady: boolean;
}) {
  const [step, setStep] = useState<Step>("consent");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [roundsLeft, setRoundsLeft] = useState(0);
  const [sample, setSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  const answered = CUSTOMER_QUESTIONS.every((q) => answers[q.id]);

  async function generate() {
    setStep("working");
    setError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: props.slug, consent: true, answers, customText }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Something went wrong.");
      setDesigns(json.designs);
      setRoundsLeft(json.roundsLeft);
      setSample(json.sample);
      setStep("designs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep(designs.length ? "designs" : "questions");
    }
  }

  async function choose(id: string) {
    setChoosing(id);
    setError(null);
    try {
      const response = await fetch(`/api/designs/${id}/select`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not save your choice.");
      setOrderCode(json.orderCode);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your choice.");
    } finally {
      setChoosing(null);
    }
  }

  const alert = error && (
    <p role="alert" className={`${ui.error} mt-4`}>
      {error}
    </p>
  );

  if (step === "consent") {
    return (
      <>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Make this box yours</h1>
        <p className="mt-3 text-ink-soft">
          Answer five quick questions and see {props.brandName ?? "this product"}&apos;s {props.productName} in packaging
          designed for you, on the real box, through your camera.
        </p>
        {props.premiumPrice && (
          <p className="mt-3">
            Personalized: <strong>{props.premiumPrice}</strong>
            {props.basePrice && <span className="text-ink-soft"> (usual price {props.basePrice})</span>}. You pay in
            store, only if you like it.
          </p>
        )}
        <div className="mt-6 rounded-lg bg-panel p-4 text-sm">
          <p className="font-semibold">Before you start</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No account, name or email is needed.</li>
            <li>Your answers are used only to create the designs.</li>
            <li>Designs are made by AI services run by Together AI.</li>
            <li>Your answers and any designs you do not buy are deleted within 24 hours.</li>
            <li>The camera is used only on your phone to show the preview. No video is recorded or sent.</li>
          </ul>
        </div>
        <button type="button" className={`${ui.button} mt-6 w-full`} onClick={() => setStep("questions")}>
          I agree, let&apos;s start
        </button>
      </>
    );
  }

  if (step === "questions" || step === "working") {
    const working = step === "working";
    return (
      <>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Your taste</h1>
        <div className="mt-4 space-y-6">
          {CUSTOMER_QUESTIONS.map((q) => (
            <fieldset key={q.id} disabled={working}>
              <legend className="font-semibold">{q.label}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.choices.map((c) => {
                  const selected = answers[q.id] === c.value;
                  return (
                    <label
                      key={c.value}
                      className={`min-h-11 cursor-pointer rounded-full border px-4 py-2 text-base has-focus-visible:outline-2 has-focus-visible:outline-teal ${
                        selected ? "border-ink bg-ink text-paper" : "border-rule bg-paper"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={c.value}
                        checked={selected}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.value }))}
                        className="sr-only"
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {props.allowCustomText && (
            <div>
              <label htmlFor="custom" className="font-semibold">
                Add a name or short message <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="custom"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={24}
                disabled={working}
                className={ui.input}
                placeholder="e.g. For Sam"
              />
              <p className="mt-1 text-sm text-ink-soft">Up to 24 characters. Printed on the front.</p>
            </div>
          )}
        </div>
        {alert}
        <button type="button" className={`${ui.button} mt-6 w-full`} disabled={!answered || working} onClick={() => void generate()}>
          {working ? "Designing your packaging…" : "Show my designs"}
        </button>
        {working && (
          <p className="mt-3 text-center text-sm text-ink-soft" aria-live="polite">
            This usually takes 10 to 30 seconds.
          </p>
        )}
      </>
    );
  }

  if (step === "designs") {
    return (
      <>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Your designs</h1>
        {sample && (
          <p className={`${ui.notice} mt-3`}>
            Sample patterns only. AI generation is not connected yet, so these are not real designs.
          </p>
        )}
        <ul className="mt-4 space-y-5">
          {designs.map((d, i) => (
            <li key={d.id} className="rounded-lg border border-rule p-3">
              <div className="flex gap-2 overflow-x-auto">
                {["front", "right", "back"].map((face) => (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img key={face} src={d.textures[face]} alt={`Design ${i + 1}, ${face}`} className="h-56 rounded border border-rule" />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {props.arReady && (
                  <a href={`/ar/viewer.html?slug=${props.slug}&design=${d.id}`} className={ui.button}>
                    See it on the box
                  </a>
                )}
                <button type="button" className={ui.buttonQuiet} disabled={choosing !== null} onClick={() => void choose(d.id)}>
                  {choosing === d.id ? "Saving…" : `Choose design ${i + 1}`}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!props.arReady && <p className="mt-4 text-sm text-ink-soft">The camera preview is not set up for this product yet.</p>}
        {alert}
        <button type="button" className={`${ui.buttonQuiet} mt-6 w-full`} disabled={roundsLeft <= 0} onClick={() => void generate()}>
          {roundsLeft > 0 ? `Show me different designs (${roundsLeft} left)` : "No more rounds left"}
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Design saved</h1>
      <p className="mt-3 text-ink-soft">Show this code at the till to buy {props.productName} with your design.</p>
      <p className="mt-6 rounded-lg bg-panel py-6 text-center text-4xl font-bold tracking-widest">{orderCode}</p>
      {props.premiumPrice && <p className="mt-4 text-center">Price: {props.premiumPrice}</p>}
    </>
  );
}
