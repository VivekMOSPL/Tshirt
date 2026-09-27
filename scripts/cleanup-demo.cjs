// Clean up demo orders inserted during verification from the shared project.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) { console.error("no env", file); process.exit(1); }
  const txt = fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Z0-9_]*)=(.*)$/i);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const env = readEnv(path.join(__dirname, "..", "..", "portfolio-board", ".env.local"));

(async () => {
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query(
    "delete from public.tsh_orders where customer_email in ('demo@example.com','acme@example.com') returning order_code"
  );
  await client.query("select count(*)::int as remaining from public.tsh_orders");
  const remaining = (await client.query("select count(*)::int as c from public.tsh_orders")).rows[0].c;
  await client.end();
  console.log(`cleaned up ${res.rowCount} demo order(s)`);
  console.log(`remaining tsh_orders in DB: ${remaining}`);
})().catch((e) => { console.error("FATAL", e.message); process.exit(3); });
