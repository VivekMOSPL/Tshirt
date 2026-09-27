# WORKLOG — TshirtSolution

One line per slice: what I did -> the command I ran -> what it actually printed.

1. Created project folder and Supabase schema -> `New-Item -ItemType Directory TshirtSolution\supabase` -> directory created.
2. Wrote the `tsh_`-prefixed Supabase schema -> `write supabase/schema.sql` -> file written.
3. Scaffolded Next.js + Tailwind + TypeScript deps -> `npm install --no-audit --no-fund` -> `added 112 packages in 1m`.
4. Wrote components, API routes, types, tailwind/postcss/ts config -> `write ...` -> files written.
5. Typechecked -> `npx tsc --noEmit` -> exit 0, no errors.
6. Built production -> `node node_modules/next/dist/bin/next build .` -> `✓ Compiled successfully` / `Generating static pages using 7 workers (4/4)`; dynamic routes `/ /admin /api/*`.
7. Validated the SQL structurally -> `node scripts/validate-schema.cjs` -> `STRUCTURAL VALIDATION: PASS` (4 `$$` balanced, paren depth 0, all tsh_* objects present).
8. Proved the SQL against the configured Supabase project -> `node scripts/test-db.cjs` -> `ok schema executed`, `ok bad B2C order rejected`, `ok nothing saved after a rejected order`, `ok B2B order without company_name rejected`, `ok B2C order ... total_paise=49900`, `ok B2B order ... total_paise=898000`, `ok admin list returned 2 orders`, `ok test rows cleaned up`; `0 failed`.
9. Ran the dev server and exercised the live app -> `node node_modules/next/dist/bin/next dev .` -> `✓ Ready in 15.2s`; then `GET /api/catalogue` -> `200` `catalogue OK: Classic Cotton Tee colours=6 sizes=5 retail=49900 tiers=5`; `POST /api/order` (B2C) -> `200` `{"order_code":"TS-260927-7B10AD","total_quantity":1,"total_paise":49900}`; `POST /api/order` (B2B) -> `200` `{"order_code":"TS-260927-2D93F5","total_quantity":20,"total_paise":898000}`; `GET /api/admin/orders` -> `200` count 2 (demo design fields persisted: text `ACME`, colour `#2563EB`, font `Arial`, x 50, y 45, scale 1.1).
10. Verified the customer page renders -> `curl.exe -s -o home.html -w "status=%{http_code} bytes=%{size_download}\n" http://localhost:3000/` -> `status=200 bytes=17567`, HTML contains `design studio` and `Total`.
11. Cleaned up demo orders from the shared DB -> `node scripts/cleanup-demo.cjs` -> `cleaned up 2 demo order(s)` / `remaining tsh_orders in DB: 0`.
