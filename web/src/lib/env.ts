// Environment access. Values are read lazily so `next build` works without
// secrets, and a missing value fails with a message that says what to set.

function need(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See web/.env.example.`);
  }
  return value;
}

// NEXT_PUBLIC_ values must be referenced literally so Next.js can inline them
// into the browser bundle.
export const publicEnv = {
  get supabaseUrl() {
    return need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return need(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

export function hasSupabasePublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// Server-only values. Import this object only from server code.
export const serverEnv = {
  get supabaseSecretKey() {
    return need("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
  get stripeSecretKey() {
    return need("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
  },
  get stripeWebhookSecret() {
    return need("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET);
  },
  get stripePortalConfigurationId() {
    return process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined;
  },
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
};
