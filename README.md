# TshirtSolution

A small custom T-shirt design studio for Shankar's B2B + B2C t-shirt business.

- Next.js 16 (App Router) on Vercel
- Supabase (Postgres + Storage) for data and logo uploads
- One customer page (`/`) + one admin page (`/admin`)

## What it does

1. Pick a shirt: one style **Classic Cotton Tee** (seeded), with 6 colours and sizes S–XXL.
2. Add a design: type text, or upload your own logo (saved to the `tsh-logos` storage bucket).
3. See it on the shirt: the design renders on a shirt and can be dragged + resized before ordering.
4. Pick colour and size — every change updates the **Total** live. B2B shows bulk savings.
5. Place the order. The design details (text, colour, font, x/y/scale, logo path) are saved so Shankar knows what to print.
6. Order confirmation page at `/order-confirmation`.

### Order types

- **B2C**: one shirt, one size — priced at retail.
- **B2B**: several sizes with a quantity per size — priced with bulk tiers (1 / 10 / 25 / 50 / 100).

No login, no payment gateway.

## Data & security

- All tables/functions are prefixed `tsh_` so they can live in the **same Supabase project** as another app without colliding.
- Tables are closed to anonymous and authenticated users; the Next.js server talks to Supabase only with the **service-role key**, which never reaches the browser. Logo uploads go through a server API route.
- Pricing is computed in the database (`tsh_place_order`), never trusted from the browser. Validation is also in the database — a bad order (missing email, B2B without a company name, order with no design) is rejected and saves nothing.

## Run it locally

```bash
cd TshirtSolution
npm install            # already installed
cp .env.local.example .env.local   # fill in your project's URL + keys
npm run dev            # http://localhost:3000
```

Get the keys from your Supabase Dashboard → Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (secret — server only)

## The SQL

Run this **once** in your Supabase project: **SQL Editor → New query → paste `supabase/schema.sql` → Run**.

It creates the `tsh_*` tables, the `tsh_get_catalogue()` and `tsh_place_order(jsonb)` functions, the `tsh-logos` storage bucket, and seeds the Classic Cotton Tee style (6 colours, 5 sizes, 5 bulk tiers). It is safe to re-run.

## Test the database logic

```bash
npm test      # node scripts/test-db.cjs
```

This runs `supabase/schema.sql` against your configured project, then smoke-tests: bad orders are rejected with no rows saved, B2C = ₹499.00, B2B (20 shirts) = ₹898.00, and the admin list shows the design fields. Demo rows are cleaned up automatically.

To regenerate the structure check only:

```bash
node scripts/validate-schema.cjs
```

## Deploy

Push to Vercel (Next.js). Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (add in Vercel → Project Settings → Environment Variables; **never** mark it as exposed to the browser)

## Files

- `app/` — Next.js App Router pages and API routes (`/`, `/admin`, `/api/catalogue`, `/api/order`, `/api/upload-logo`, `/api/admin/orders`, `/order-confirmation`).
- `components/` — `OrderForm.tsx` (state, live price, B2C/B2B), `DesignCanvas.tsx` (shirt + draggable/resizable design).
- `lib/supabase/server.ts` — server-only Supabase admin client.
- `lib/catalogue.ts`, `lib/price.ts` — catalogue fetch + pure price math mirrored from the DB.
- `types.ts`, `tailwind.config.js`, `postcss.config.js`, `next.config.ts`, `tsconfig.json`.
- `supabase/schema.sql` — the SQL to run in the SQL Editor.
- `scripts/validate-schema.cjs`, `scripts/test-db.cjs`, `scripts/cleanup-demo.cjs`.
