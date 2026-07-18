const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql"), "utf8");

test("migration is one transactional, rerun-safe generic executor/recovery unit", () => {
  assert.match(sql, /^begin;/i); assert.match(sql, /commit;\s*$/i); assert.match(sql, /already installed; rerun rejected/); assert.match(sql, /requires atomic, verified no-change, Phase 2 and staging executor migrations/);
});
test("normal apply delegates row DML and recovery is the only bounded reverse DML", () => {
  const normal = sql.slice(sql.indexOf("retailer_offer_sync_execute_batch_internal"), sql.indexOf("approve_retailer_offer_sync_recovery"));
  assert.match(normal, /apply_approved_product_import_plan/); assert.doesNotMatch(normal, /\b(update|insert into|delete from) public\.(products|product_variants)\b/i);
  assert.doesNotMatch(normal, /\b(update|delete from) public\.(offers|retailer_products|price_history)\b/i);
});
test("only dedicated staging roles receive executor and recovery RPC grants", () => {
  assert.match(sql, /grant execute[^;]+approve_retailer_offer_sync_batch[^;]+retailer_catalogue_staging_approver/is);
  assert.match(sql, /grant execute[^;]+execute_retailer_offer_sync_batch[^;]+retailer_catalogue_staging_executor/is);
  assert.doesNotMatch(sql, /grant execute[^;]+(anon|authenticated|service_role)/i);
  assert.match(sql, /aftboxmrdgyhizicfsfu|project_ref='hxnrsyyqffztlvcrtgbf'/);
});
