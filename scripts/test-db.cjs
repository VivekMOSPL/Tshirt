// Run this with: node scripts/test-db.cjs
// Executes supabase/schema.sql against the configured Supabase project, then
// smoke-tests tsh_place_order (validation + B2C + B2B bulk pricing), and the
// "invalid record saves nothing" rule (AGENTS.md §3).
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) {
    console.error(`env file not found: ${file}`);
    return out;
  }
  const txt = fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Z0-9_]*)=(.*)$/i);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const envPath = path.join(__dirname, "..", "..", "portfolio-board", ".env.local");
const env = readEnvFile(envPath);
if (!env.DATABASE_URL) {
  console.error("env keys found:", Object.keys(env).join(",") || "(none)");
}
const connectionString = env.DATABASE_URL;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString) {
  console.error("No DATABASE_URL found in", envPath);
  process.exit(2);
}

const pass = (...a) => console.log("ok   -", ...a);
const fail = (...a) => { console.log("FAIL -", ...a); failures++; };
let failures = 0;

(async () => {
  // 1. Run the schema (idempotent) over raw Postgres.
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  await client.query(sql);
  pass("schema executed against the configured project (tsh_* objects created)");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Catalogue
  const { data: cat, error: catErr } = await admin.rpc("tsh_get_catalogue");
  if (catErr || !cat || cat.styles.length === 0) {
    fail("catalogue not loaded", catErr);
  } else {
    const s = cat.styles[0];
    pass(`catalogue: style=${s.name}, colours=${s.colours.length}, sizes=${s.sizes.length}, tiers=${s.price_tiers.length}`);
  }

  const style_id = cat.styles[0].id;
  const colour_id = cat.styles[0].colours.find((c) => c.name === "Black").id;
  const sizes = cat.styles[0].sizes;
  const sizeId = (code) => sizes.find((s) => s.code === code).id;

  // 3. Reject bad data: B2C with missing email -> rejected, and NOTHING saved.
  const before = (await client.query("select count(*)::int from public.tsh_orders")).rows[0].count;
  const bad = await admin.rpc("tsh_place_order", {
    payload: {
      order_type: "b2c",
      style_id,
      colour_id,
      customer_name: "Bad",
      customer_email: "",
      customer_phone: "1234567",
      design_text: "X",
      items: [{ size_id: sizeId("M"), quantity: 1 }],
    },
  });
  if (bad.error) pass("bad B2C order rejected with error");
  else { fail("bad B2C order was accepted (should have been rejected)"); }
  const after = (await client.query("select count(*)::int from public.tsh_orders")).rows[0].count;
  if (Number(after) === Number(before)) pass("nothing saved after a rejected order");
  else fail(`a row leaked into tsh_orders (before=${before}, after=${after})`);

  // 4. Reject B2B without a company name.
  const nobiz = await admin.rpc("tsh_place_order", {
    payload: {
      order_type: "b2b",
      style_id,
      colour_id,
      customer_name: "Acme",
      customer_email: "a@b.com",
      customer_phone: "1234567",
      company_name: null,
      design_text: "ACME",
      items: [{ size_id: sizeId("M"), quantity: 12 }],
    },
  });
  if (nobiz.error) pass("B2B order without company_name rejected");
  else { fail("B2B order without company_name was accepted"); }

  // 5. Accept a valid B2C order -> retail price.
  const b2c = await admin.rpc("tsh_place_order", {
    payload: {
      order_type: "b2c",
      style_id,
      colour_id,
      customer_name: "Test Buyer",
      customer_email: "buyer@example.com",
      customer_phone: "9876543210",
      design_text: "HELLO",
      items: [{ size_id: sizeId("M"), quantity: 1 }],
    },
  });
  if (b2c.error) {
    fail("B2C order failed", b2c.error.message);
  } else {
    const r = b2c.data[0];
    pass(`B2C order: ${r.order_code} qty=${r.total_quantity} total_paise=${r.total_paise} (expect 49900)`);
    if (Number(r.total_paise) !== 49900) fail("B2C total mismatch");
    else pass("B2C total correct (\u20B9499.00)");
  }

  // 6. Accept a B2B order with bulk tier (qty 12 -> tier 44900/unit).
  const b2b = await admin.rpc("tsh_place_order", {
    payload: {
      order_type: "b2b",
      style_id,
      colour_id,
      customer_name: "Acme Buyer",
      customer_email: "buyer@acme.com",
      customer_phone: "9876543210",
      company_name: "Acme Corp",
      design_text: "ACME",
      items: [
        { size_id: sizeId("M"), quantity: 12 },
        { size_id: sizeId("L"), quantity: 8 },
      ],
    },
  });
  if (b2b.error) {
    fail("B2B order failed", b2b.error.message);
  } else {
    const r = b2b.data[0];
    const expectedUnit = 44900; // first tier min 10 reached (total qty 20)
    const expectedTotal = expectedUnit * 20;
    pass(`B2B order: ${r.order_code} qty=${r.total_quantity} total_paise=${r.total_paise} (expect ${expectedTotal})`);
    if (Number(r.total_paise) !== expectedTotal) fail("B2B total mismatch");
    else pass("B2B bulk total correct (12+8=20 shirts @ \u20B9449 each = " + (expectedTotal/100) + " INR)");
  }

  // 7. Admin read shows our two test orders.
  const list = await admin
    .from("tsh_orders")
    .select("order_code,order_type,total_paise,status")
    .in("customer_email", ["buyer@example.com", "buyer@acme.com"]);
  if (list.error) fail("admin list failed", list.error.message);
  else pass(`admin list returned ${list.data?.length ?? 0} orders`);

  // 8. Cleanup the test rows.
  await client.query(
    "delete from public.tsh_orders where customer_email in ($1,$2)",
    ["buyer@example.com", "buyer@acme.com"]
  );
  pass("test rows cleaned up");

  await client.end();

  console.log(`\n${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(3);
});
