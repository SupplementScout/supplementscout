const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const file = path.resolve(
  __dirname,
  "../supabase/migrations/20260803260000_align_existing_offer_option_evidence.sql",
);
const sql = fs.readFileSync(file, "utf8");

test("existing-offer option alignment is production-only and transactional", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(sql, /simply-49-2bc798f9fb7db4af-production/);
  assert.match(sql, /atomic_import_apply_standard_plan_core\(jsonb\)/);
});

test("option omission requires an existing variant and exact no-op mapping identity", () => {
  assert.match(sql, /product_variant,action}'='existing'/);
  assert.match(sql, /retailer_product,action}'='noop'/);
  assert.match(sql, /approved_mapping_id}'=p_plan#>>'\{retailer_product,id\}'/);
  assert.match(sql, /external_options}'='null'::jsonb/);
  assert.doesNotMatch(sql, /\b(insert into|update|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
});
