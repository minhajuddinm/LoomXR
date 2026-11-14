# LoomXR

LoomXR Labs Inc. B2B SaaS: a business offers AI-generated, personalized packaging designs that in-store customers preview in WebAR on the real product. LoomXR earns only from business subscriptions; it never takes customer money and prints nothing.

## Rules

- Work on the `mvp` branch. Never push to `main` or deploy to production without the owner's approval.
- The landing page at the repo root (`index.html`, `styles.css`, `privacy.html`, `terms.html`, `fonts/`, `Logo/`, `team/`) is live on loomxrlabs.com. Do not change it. The only approved edit was the `Business Login` nav link.
- Never commit keys. Secrets live in `web/.env.local` (git-ignored) and in Vercel env vars. `web/.env.example` lists the names.
- Stripe is test mode only until launch is approved.
- Build one phase at a time. Each phase ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, a commit on `mvp`, and a phone test list.

## Layout

```
/                      static landing page (Vercel project "loomxr")
web/                   Next.js app (second Vercel project, Root Directory = web)
supabase/migrations/   SQL schema, RLS, grants, buckets
```

One Next.js app serves two subdomains. `web/src/proxy.ts` routes by hostname using `web/src/lib/hosts.ts`:

- `app.loomxrlabs.com`: business dashboard (`/login`, `/signup`, `/onboarding`, `/dashboard`, `/billing`, later `/products`, `/orders`, `/admin`).
- `ar.loomxrlabs.com`: anonymous customer flow (`/p/[slug]` and its API routes).
- Any other host (localhost, Vercel preview URLs) reaches every route by path, so phones can test before DNS exists.

## Stack notes

- Next.js 16, App Router, TypeScript, Tailwind 4, pnpm. Read `web/AGENTS.md`: this Next.js version differs from older ones. Middleware is called Proxy (`src/proxy.ts`). Bundled docs are in `web/node_modules/next/dist/docs/`.
- `cacheComponents` is off on purpose (see `web/next.config.ts`).
- Supabase: project `loomxr-mvp` (ref `gwetmxmvqnulhsrlqlzx`, ca-central-1, free plan). Postgres, Auth (email + Google), Storage, pgvector. Uses the new publishable and secret keys. "Automatically expose new tables" is off and automatic RLS is on, so every new table needs explicit grants. Migrations were applied through the Supabase connector; file names match the recorded versions.
- Stripe Billing: Checkout, Customer Portal, webhook. Plans are in `web/src/lib/plans.ts` (placeholder prices) and are matched to Stripe prices by lookup key.

## Modes and logins

- `DEMO_MODE=true` removes login (one shared business). It is OFF now; keep it off anywhere public.
- `BILLING_REQUIRED` is unset: no subscription is needed until the company Stripe account exists. Set it to `true` to turn the Stripe flow back on.
- Admin role lives in Supabase `app_metadata.role = "admin"` (or `ADMIN_EMAILS`). `/admin` is staff only.
- Dev admin login: username `admin` (maps to `admin@loomxrlabs.com`). Its password is deliberately simple for development and MUST be changed before the app is reachable without Vercel's login wall.
- `pnpm invite <email> [--admin]` creates a login and prints a one-time link to choose a password.

## Generation and AR

- `lib/generation/directions.ts`: art direction, taken from what worked in the HYPAR thesis project. Each design is TWO images: a composed front panel at the front face's proportions and a matching seamless pattern for the other faces. Three layouts (frame, medallion, band) give three distinct designs per round. Read this file before touching prompts.
- `lib/generation/composite.ts`: crops (never stretches) the images to each face and typesets the label (logo or brand name, custom text, required text) with satori. The AI never draws text.
- `lib/generation/prompt.ts`: the business's brief template with `{{slots}}`. `together.ts`: API calls with retries. `placeholder.ts`: sample patterns when `TOGETHER_API_KEY` is empty. `pipeline.ts`: one round.
- Cost: 6 images per round on FLUX.2 [dev], about US$0.09.
- `public/ar/viewer.html`: static MindAR + three.js viewer (CDN for now; self-host before launch). `components/box-3d.tsx`: CSS 3D box preview used in the customer gallery.
- Face photos are compiled to a `.mind` tracking file in the business's browser (`products/[id]/photos.tsx`).
- Not built yet: uniqueness check (CLIP + pHash), moderation of custom content, custom images, cylinders, orders view, cleanup job.

## UI

Tokens are in `web/src/app/globals.css` and class strings in `web/src/lib/ui.ts`; use those, not one-off colours. Brand ink/teal/gold, Archivo for text, Playfair Display for headings (the same face as the packaging labels). Icons are inline SVG in `components/icons.tsx`.

## Trust boundaries

- Business users: Supabase Auth. Queries run through `lib/supabase/server.ts` as the user, so RLS applies. `lib/auth.ts` is the single place that reads the session (`getClaims`, never `getSession`).
- The `authenticated` role has explicit grants only. On `businesses` it may write `name` and nothing else, so plan, status and quota can only be changed by the Stripe webhook.
- Customers: no account and no Data API access. The `anon` role has no grants. Customer reads and writes go through server routes using `lib/supabase/admin.ts` (secret key, bypasses RLS). Every such route must do its own authorization first.
- New tables need: RLS enabled, explicit grants, and a case in `web/tests/integration/rls.test.ts`.

## Stripe webhook

`lib/stripe/webhook-handler.ts` holds the logic with no Stripe or Supabase imports, so it is unit tested with fakes. Each event ID is recorded in `stripe_events` and applied once. Subscription events are treated as signals: the handler re-reads the subscription from Stripe and stores its current state, so out-of-order delivery is harmless. The usage counter resets only when the billing period start changes (`apply_subscription_state` in SQL).

## Commands (run in `web/`)

```
pnpm dev            local server on :3000
pnpm lint
pnpm typecheck
pnpm test           unit tests; integration tests run only when .env.local has Supabase keys
pnpm build
pnpm seed:stripe    create test-mode products, prices and portal configuration
```

Integration tests (`web/tests/integration/`) hit the real Supabase project in `.env.local`. They create throwaway `rls-test-…@example.com` users and delete them afterwards.

## Database changes

Add a new file in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`). Do not edit a migration that has already been applied. After schema changes, run the Supabase security advisors.

## Before merging to main (open item)

The landing Vercel project serves the repo root as static files. Once `web/` and `supabase/` are on `main`, their source would be publicly downloadable from loomxrlabs.com unless excluded. Decide and test the exclusion (for example a root `.vercelignore`, checked against both Vercel projects on a preview) before any merge.

## Phase status

1. Foundation: done; login and billing are bypassed while demo mode is on.
2. Product onboarding: first version built (boxes only, no dieline upload).
3. Generation pipeline: first version built; uniqueness and moderation missing.
4. Box AR: viewer built, not yet tested on a phone.
5. Cylinder AR: not started.
6. Orders and launch: not started.

Approved plan: `C:\Users\minha\.claude\plans\pasted-content-id-5144-project-abundant-glade.md`.
