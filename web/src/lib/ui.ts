// Shared Tailwind class strings, so forms and buttons look the same everywhere.

export const ui = {
  label: "block text-sm font-semibold text-ink",
  input:
    "mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-base text-ink placeholder:text-ink-soft/60",
  button:
    "inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-4 py-2.5 text-base font-semibold text-paper hover:bg-teal disabled:cursor-not-allowed disabled:opacity-60",
  buttonQuiet:
    "inline-flex min-h-11 items-center justify-center rounded-md border border-ink px-4 py-2.5 text-base font-semibold text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60",
  link: "font-semibold text-teal underline underline-offset-2 hover:text-ink",
  card: "rounded-lg border border-rule bg-paper p-6",
  error: "rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error",
  notice: "rounded-md border border-teal/40 bg-teal/5 px-3 py-2 text-sm text-ink",
};
