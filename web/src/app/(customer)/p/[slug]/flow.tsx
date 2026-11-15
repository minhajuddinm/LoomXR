"use client";

import { useState } from "react";
import { Box3D } from "@/components/box-3d";
import { IconArrow, IconCamera, IconCheck, IconSpark } from "@/components/icons";
import { CUSTOMER_QUESTIONS } from "@/lib/questions";
import { ui } from "@/lib/ui";

type Design = { id: string; textures: Record<string, string> };
type Step = "consent" | "questions" | "working" | "designs" | "done";

const STAGES = ["Welcome", "Your taste", "Your designs", "Done"];
const stageOf: Record<Step, number> = { consent: 0, questions: 1, working: 1, designs: 2, done: 3 };

function Progress({ step }: { step: Step }) {
  const current = stageOf[step];
  return (
    <ol className="mb-6 flex gap-1.5" aria-label="Progress">
      {STAGES.map((name, i) => (
        <li key={name} className="flex-1" aria-current={i === current ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full transition-colors duration-300 ${i <= current ? "bg-teal" : "bg-rule"}`} />
          <span className={`mt-1.5 block text-xs font-semibold ${i === current ? "text-ink" : "text-ink-soft/70"}`}>
            {name}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Flow(props: {
  slug: string;
  productName: string;
  brandName: string | null;
  premiumPrice: string;
  basePrice: string;
  allowCustomText: boolean;
  arReady: boolean;
  dims: { width: number; height: number; depth: number };
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

  const answeredCount = CUSTOMER_QUESTIONS.filter((q) => answers[q.id]).length;
  const answered = answeredCount === CUSTOMER_QUESTIONS.length;

  async function generate() {
    setStep("working");
    setError(null);
    window.scrollTo({ top: 0 });
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
      <div className="animate-rise">
        <Progress step={step} />
        <p className={ui.eyebrow}>{props.brandName ?? "Personalized packaging"}</p>
        <h1 className={`${ui.h1} mt-2`}>Make this box yours</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Answer five quick questions and get five designs for {props.productName}, made just for you. See each one on
          the real box through your camera.
        </p>

        {props.premiumPrice && (
          <div className="mt-5 flex items-baseline gap-3 rounded-2xl bg-gold-soft px-5 py-4">
            <span className="font-display text-3xl font-bold">{props.premiumPrice}</span>
            <span className="text-sm text-ink-soft">
              personalized{props.basePrice && ` (usually ${props.basePrice})`}. Pay in store, only if you love it.
            </span>
          </div>
        )}

        <div className={`${ui.card} mt-5`}>
          <p className="font-semibold">Before you start</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {[
              "No account, name or email is needed.",
              "Your answers are used only to create the designs.",
              "Designs are made by AI services run by Together AI.",
              "Answers and designs you do not buy are deleted within 24 hours.",
              "The camera only shows the preview on your phone. Nothing is recorded or sent.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <IconCheck className="mt-0.5 size-4 text-teal" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <button type="button" className={`${ui.button} mt-6 w-full`} onClick={() => setStep("questions")}>
          I agree, let&apos;s start
          <IconArrow />
        </button>
      </div>
    );
  }

  if (step === "working") {
    return (
      <div className="animate-rise" aria-live="polite">
        <Progress step={step} />
        <h1 className={ui.h1}>Designing your packaging</h1>
        <p className="mt-3 text-ink-soft">Five designs are being made just for you. This takes about 30 to 60 seconds.</p>
        <div className="mt-6 space-y-4" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (step === "questions") {
    return (
      <div className="animate-rise">
        <Progress step={step} />
        <h1 className={ui.h1}>{designs.length ? "Change your answers" : "Your taste"}</h1>
        <p className="mt-2 text-ink-soft">
          {designs.length
            ? "Change anything you like, then get five new designs."
            : `${answeredCount} of ${CUSTOMER_QUESTIONS.length} answered`}
        </p>
        {designs.length > 0 && (
          <button type="button" className={`${ui.link} mt-3 min-h-11`} onClick={() => setStep("designs")}>
            Back to my designs
          </button>
        )}
        <div className="mt-6 space-y-7">
          {CUSTOMER_QUESTIONS.map((q) => (
            <fieldset key={q.id}>
              <legend className="text-lg font-semibold">{q.label}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.choices.map((c) => {
                  const selected = answers[q.id] === c.value;
                  return (
                    <label
                      key={c.value}
                      className={`flex min-h-12 items-center rounded-full border px-5 py-2.5 text-base font-semibold transition duration-200 active:scale-[0.97] has-focus-visible:outline-3 has-focus-visible:outline-teal ${
                        selected ? "border-ink bg-ink text-paper shadow-card" : "border-rule bg-paper hover:border-ink-soft"
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
              <label htmlFor="custom" className="text-lg font-semibold">
                Add a name or short message <span className="text-base font-normal text-ink-soft">(optional)</span>
              </label>
              <input
                id="custom"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={24}
                className={ui.input}
                placeholder="e.g. For Sam"
              />
              <p className="mt-1.5 text-sm text-ink-soft">Up to 24 characters. Printed on the front label.</p>
            </div>
          )}
        </div>
        {alert}
        <div className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-canvas via-canvas to-transparent px-5 pb-4 pt-6">
          <button type="button" className={`${ui.button} w-full`} disabled={!answered} onClick={() => void generate()}>
            <IconSpark />
            {designs.length ? "Show five new designs" : "Show my designs"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "designs") {
    return (
      <div className="animate-rise">
        <Progress step={step} />
        <h1 className={ui.h1}>Your designs</h1>
        <p className="mt-2 text-ink-soft">Drag a box to turn it. Pick the one you love.</p>
        {sample && (
          <p className={`${ui.notice} mt-4`}>
            Sample patterns only. AI generation is not connected, so these are not real designs.
          </p>
        )}
        <ul className="stagger mt-5 space-y-5">
          {designs.map((d, i) => (
            <li key={d.id} className={`${ui.card} overflow-hidden !p-0`}>
              <div className="bg-gradient-to-b from-panel to-canvas py-4">
                <Box3D textures={d.textures} dims={props.dims} label={`Design ${i + 1} shown on a turning box`} />
              </div>
              <div className="space-y-3 p-5">
                <p className="font-display text-xl font-bold">Design {i + 1}</p>
                {props.arReady && (
                  <a href={`/ar/viewer.html?slug=${props.slug}&design=${d.id}`} className={`${ui.button} w-full`}>
                    <IconCamera />
                    See it on the real box
                  </a>
                )}
                <button
                  type="button"
                  className={`${props.arReady ? ui.buttonQuiet : ui.button} w-full`}
                  disabled={choosing !== null}
                  onClick={() => void choose(d.id)}
                >
                  {choosing === d.id ? "Saving…" : "Choose this design"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {alert}
        <section className={`${ui.card} mt-6`} aria-labelledby="more-heading">
          <h2 id="more-heading" className="font-display text-xl font-bold">
            Not quite right?
          </h2>
          {roundsLeft > 0 ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                You can ask for new designs {roundsLeft === 1 ? "one more time" : `${roundsLeft} more times`}.
              </p>
              <button
                type="button"
                className={`${ui.button} mt-4 w-full`}
                onClick={() => {
                  setStep("questions");
                  window.scrollTo({ top: 0 });
                }}
              >
                Change my answers
              </button>
              <button type="button" className={`${ui.buttonQuiet} mt-3 w-full`} onClick={() => void generate()}>
                Same answers, five new designs
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">
              You have used all your design rounds. Pick your favourite above.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="animate-rise text-center">
      <Progress step={step} />
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-paper">
        <IconCheck className="size-8" />
      </span>
      <h1 className={`${ui.h1} mt-5`}>Design saved</h1>
      <p className="mt-3 text-ink-soft">Show this code at the till to buy {props.productName} with your design.</p>
      <p className="weave mt-6 rounded-2xl py-7 font-display text-4xl font-bold tracking-[0.2em] text-paper shadow-lift">
        {orderCode}
      </p>
      {props.premiumPrice && <p className="mt-4 text-lg">Price: {props.premiumPrice}</p>}
    </div>
  );
}
