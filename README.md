# LoomXR

LoomXR lets a business offer AI-generated, personalized packaging designs. A customer in the store scans a QR code, answers a few questions, gets designs made for them, and previews them in AR on the real product before buying at a premium price.

LoomXR earns money only from business subscriptions. It never takes the customer's money and it prints nothing. The business charges the customer and produces the packaging itself.

This README explains how the product works for each of the three people involved: the business, the customer, and you as the owner. It also says plainly what is built today and what is still planned.

## Build status

| Phase | What it covers | Status |
|---|---|---|
| 1. Foundation | Accounts, subscriptions, database, hostname routing | Code done. Stripe and Google sign-in still need keys before they can be tested end to end. |
| 2. Product onboarding | Product wizard, face photos, brand assets, questionnaire, prompt template, pricing, QR code | Not started |
| 3. Generation pipeline | Customer questions, moderation, image generation, compositing, uniqueness check | Not started |
| 4. Box AR | AR preview on a real box, design selection, order code | Not started |
| 5. Cylinder AR | AR preview on cans and bottles | Not started |
| 6. Orders and launch | Orders view, design locking, cleanup, usage costs, go-live | Not started |

Anything below marked **(planned)** does not exist yet.

## The three websites

| Address | Who uses it | What it is |
|---|---|---|
| `loomxrlabs.com` | Anyone | The marketing landing page. Static HTML at the root of this repo. |
| `app.loomxrlabs.com` | Businesses | The dashboard: sign up, subscribe, set up products, see orders. |
| `ar.loomxrlabs.com` | Customers in a store | The page a QR code opens: questions, designs, AR preview. |

The second and third are one Next.js app in `web/`. It looks at the hostname of each request and shows only the pages that belong to that address. The two subdomains are not connected to DNS yet, so for now the app is reached on `localhost` or a Vercel preview URL, where every page is available by path.

## How it works for a business

1. **Create an account.** The business goes to `app.loomxrlabs.com`, signs up with email and password or with Google, and confirms their email.
2. **Name the business.** A one-field form. This creates their business record.
3. **Choose a plan.** The Billing page shows three plans (Starter, Growth, Scale). Each includes a number of generations per month. Choosing one opens Stripe Checkout, where they enter their card. LoomXR never sees the card number.
4. **Plan becomes active.** Stripe tells LoomXR the payment succeeded, and the dashboard shows the plan and how many generations have been used this period. The count resets at the start of each billing period.
5. **Manage billing.** A button opens Stripe's own portal to change plan, update the card, see invoices or cancel.
6. **Add a product (planned).** The business registers a box or a cylinder: its real dimensions in millimetres, a photo of each face, logo, brand colours and any text that must always appear.
7. **Describe the product (planned).** A short questionnaire about category, audience, tone and anything that is banned. LoomXR turns the answers into a prompt template, which the business can review and edit.
8. **Set prices (planned).** A base price and a premium price for the personalized version, and whether customers may add their own text or image.
9. **Print the QR code (planned).** Each product gets a QR code to put on the shelf.
10. **Handle orders (planned).** When a customer picks a design they get an order code. Staff look up the code, take payment at the till as usual, mark it purchased, and later confirm receipt. On confirmation the design is locked so nobody else can ever be given the same one.

What a business can and cannot do: a business sees only its own data. It can change its business name. It cannot change its own plan, status or generation quota; only a confirmed Stripe payment can.

## How it works for a customer

Everything in this section is **planned** except the placeholder page at `/p/<code>`.

1. **Scan.** The customer scans the QR code on the shelf. It opens `ar.loomxrlabs.com/p/<code>` in the phone browser. There is no app to install and no account to create.
2. **Consent.** A short notice explains what is collected and who processes it.
3. **Answer a few questions.** General taste questions that do not identify the person.
4. **Add their own touch (optional).** If the business allows it, a short text or an image. This is checked by an automated moderation service first, and rejected content is never stored.
5. **See designs.** Three designs are generated. The customer can ask for new ones up to three times.
6. **Preview in AR.** They point the phone at the real product and see each design wrapped on it.
7. **Pick one.** They get an order code and take the product to the till. They pay the business, not LoomXR.

Privacy: customers are anonymous. Their session and any designs they did not buy are deleted within 24 hours. Only a purchased design is kept, so that it stays unique.

## How it works for you (the owner)

### Services and accounts

| Service | What it does | Cost now |
|---|---|---|
| Supabase, project `loomxr-mvp`, Canada (Central) | Database, sign-in, file storage | Free plan. Pauses after about 7 days with no activity. |
| Stripe, test mode | Subscriptions | Free. No real money moves in test mode. |
| Vercel | Hosting | Free Hobby plan, which is for non-commercial use. Real stores need Pro. |
| Together AI **(planned)** | Text and image generation | Pay per use, estimated about US$0.05 per round of three designs. |
| OpenAI moderation **(planned)** | Checks customer text and images | Free |

### Keys

Secrets live only in `web/.env.local`, which git ignores. `web/.env.example` lists every name. Never paste a secret key into a chat, a commit or a public page.

Still needed for Phase 1:

- `SUPABASE_SECRET_KEY`: Supabase dashboard, Project Settings, API keys.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: Stripe dashboard in test mode.
- Google sign-in: a client ID and secret from Google Cloud, entered in Supabase under Authentication, Providers.

The Supabase database password was generated by Supabase when the project was created and was not saved anywhere. The app does not need it. If you ever need it, reset it in the Supabase dashboard under Database settings.

### Run it on your computer

In a terminal, from the `web` folder:

```bash
pnpm install
```

```bash
pnpm dev
```

Then open `http://localhost:3000`. Useful pages: `/signup`, `/login`, `/dashboard`, `/billing`, `/p/test`.

To create the three test plans in Stripe (after adding the Stripe test key):

```bash
pnpm seed:stripe
```

### Check that it works

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build
```

`pnpm test` always runs the unit tests. The database tests (one business cannot see another's data, a Stripe event is applied only once) run only when `SUPABASE_SECRET_KEY` is set; otherwise they are skipped and the output says so.

To test a subscription by hand, use Stripe's test card `4242 4242 4242 4242` with any future date and any CVC.

### Your admin access (planned)

`ADMIN_EMAILS` in the env file lists who may open `/admin/usage`, which will show what generation is costing per day, provider and business.

### Safety rules for this repo

- Work happens on the `mvp` branch. Nothing is pushed to `main` or deployed to production without your approval.
- The landing page files at the repo root are live. Do not edit them casually.
- Before `mvp` is merged to `main`, the landing site must be stopped from serving the `web/` and `supabase/` folders as downloadable files. This is not solved yet.

## Where things are

```
index.html, styles.css, ...   landing page (live)
web/                          the Next.js app for app. and ar.
  src/app/(auth)/             login and signup
  src/app/(business)/         dashboard, billing, onboarding
  src/app/(customer)/         the page a QR code opens
  src/app/api/stripe/         checkout, portal, webhook
  src/lib/                    shared code (auth, Supabase, Stripe, plans, routing)
  tests/integration/          tests that use the real database
supabase/migrations/          database schema and access rules
CLAUDE.md                     notes for AI coding sessions
```

Plan prices and quotas are placeholders. Change them in `web/src/lib/plans.ts` before running the seed script.
