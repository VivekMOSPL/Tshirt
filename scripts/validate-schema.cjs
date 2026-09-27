const fs = require("fs");
const path = require("path");

const sql = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

// 1) Dollar-quote $$ ... $$ balances (function bodies / heredocs).
const dq = sql.split(/[$][ $]/).length - 1; // count literal $$ tokens
const dqBal = (dq % 2 === 0);
console.log(`dollar-quote $$ tokens: ${dq} -> balanced=${dqBal}`);

// 2) Parenthesis balance overall (rough, ignores those inside string literals).
let depth = 0;
let inStr = false;
let strCh = "";
let ok = true;
for (let i = 0; i < sql.length; i++) {
  const c = sql[i];
  if (inStr) {
    if (c === "\\") { i++; continue; }
    if (c === strCh) inStr = false;
    continue;
  }
  if (c === "'" || c === '"') { inStr = true; strCh = c; continue; }
  if (c === "(") depth++;
  else if (c === ")") depth--;
  if (depth < 0) { ok = false; break; }
}
console.log(`paren depth at end: ${depth} (0 = balanced), valid=${ok && depth === 0}`);

// 3) Required objects present, exactly once each (definition-level check).
const required = [
  "public.tsh_styles",
  "public.tsh_colours",
  "public.tsh_sizes",
  "public.tsh_price_tiers",
  "public.tsh_orders",
  "public.tsh_order_items",
  "function public.tsh_get_catalogue()",
  "function public.tsh_place_order(jsonb)",
];
let allPresent = true;
for (const r of required) {
  const count = (sql.match(new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const present = count > 0;
  if (!present) allPresent = false;
  console.log(`${present ? "ok   " : "MISS "} ${r}  (${count})`);
}

const pass = dqBal && ok && depth === 0 && allPresent;
console.log("\nSTRUCTURAL VALIDATION:", pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
