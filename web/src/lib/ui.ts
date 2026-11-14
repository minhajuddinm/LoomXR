// Shared Tailwind class strings, so every form, button and card looks the same.

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const ui = {
  h1: "font-display text-4xl font-bold tracking-tight sm:text-5xl",
  h2: "font-display text-2xl font-bold tracking-tight",
  eyebrow: "text-sm font-semibold uppercase tracking-[0.14em] text-gold",
  label: "block text-sm font-semibold text-ink",
  input:
    "mt-1.5 block w-full rounded-xl border border-rule bg-paper px-3.5 py-3 text-base text-ink shadow-[inset_0_1px_2px_rgb(18_40_58/0.04)] transition duration-200 placeholder:text-ink-soft/55 hover:border-ink-soft/50 focus:border-teal focus:outline-none focus:ring-4 focus:ring-teal/15",
  button: `${buttonBase} bg-ink text-paper shadow-card hover:bg-teal`,
  buttonGold: `${buttonBase} bg-gold text-ink-deep shadow-card hover:brightness-110`,
  buttonQuiet: `${buttonBase} border border-ink/25 bg-paper text-ink hover:border-ink hover:bg-panel`,
  link: "font-semibold text-teal underline decoration-teal/40 underline-offset-4 transition hover:text-ink hover:decoration-ink",
  card: "rounded-2xl border border-rule/80 bg-paper p-6 shadow-card sm:p-7",
  error: "rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error",
  notice: "rounded-xl border border-teal/25 bg-teal-soft px-4 py-3 text-sm text-ink",
  badgeLive: "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-success",
  badgeDraft: "inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft",
};
