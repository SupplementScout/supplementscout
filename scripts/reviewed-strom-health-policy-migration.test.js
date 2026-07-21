const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260721210000_allow_reviewed_strom_health_support_families.sql"), "utf8");

test("Strom health-support migration adds only exact reviewed formula boundaries", () => {
  for (const value of [
    "('Strom Sports FocusMax 36 Servings','Strom','Health Supplements','powder','36','servings')",
    "('Strom Sports GlutathioneMAX 200g','Strom','Health Supplements','powder','200','g')",
    "('Strom Sports SystolMAX 495g','Strom','Health Supplements','powder','495','g')",
    "('Strom Sports DigestMax 480g','Strom','Health Supplements','powder','480','g')",
    "('Strom MSM (Methylsulfonylmethane) 83 Servings','Strom','Health Supplements','powder','83','servings')",
  ]) assert.ok(sql.includes(value), value);
  assert.doesNotMatch(sql, /like\s+'%|ilike|wildcard/i);
  assert.doesNotMatch(sql, /\b(create\s+role|create\s+user|grant|revoke)\b/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+(?:into\s+|from\s+)?public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});

