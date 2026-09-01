const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(__dirname, "../supabase/migrations/20260901090000_add_reviewed_variant_create_rebind_offer_update.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

test("migration extends the existing importer and approval ledger", () => {
  assert.match(sql, /rename to atomic_import_validate_before_reviewed_variant_rebind/);
  assert.match(sql, /rename to atomic_import_apply_before_reviewed_variant_rebind/);
  assert.match(sql, /rename to atomic_import_apply_approved_before_reviewed_variant_rebind/);
  assert.match(sql, /add column if not exists execution_result jsonb/);
  assert.match(sql, /approved_import_plans_reviewed_variant_idempotency_idx/);
  assert.match(sql, /current_user <> 'postgres'/);
  assert.match(sql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.doesNotMatch(sql, /create table\s+(?!if not exists public\.approved_import_plans)/i);
});

test("reviewed SQL path binds source semantics, fingerprints, expiry, and full stale state", () => {
  for (const required of [
    "source-to-target binding", "source semantics or two-capture proof", "approval or idempotency fingerprint",
    "stale reviewed variant rebind plan: product", "stale reviewed variant rebind plan: current variant",
    "stale reviewed variant rebind plan: mapping", "stale reviewed variant rebind plan: offer or commercial state",
    "reviewed variant rebind duplicate or variant-set drift", "for update", "pg_advisory_xact_lock",
  ]) assert.ok(sql.toLowerCase().includes(required), `missing ${required}`);
  assert.match(sql, /jsonb_path_exists\(p_plan,'\$\.\*\* \? \(@\.type\(\) == "number"\)'\)/);
  assert.match(sql, /md5\(public\.atomic_import_canonical_json/);
  assert.match(sql, /encode\(digest\(public\.atomic_import_canonical_json\(v_source\),'sha256'\),'hex'\)/);
  assert.match(sql, /v_capture_1 >= v_capture_2/);
  assert.match(sql, /v_capture_2<=v_offer\.last_checked_at/);
});

test("atomic DML is exactly variant create, two rebind updates, one history row, and no parent write", () => {
  const apply = sql.slice(sql.indexOf("create function public.apply_reviewed_variant_create_rebind_offer_update_plan"), sql.indexOf("create function public.validate_product_import_plan_read_only"));
  assert.equal((apply.match(/insert into public\.product_variants/g) || []).length, 1);
  assert.equal((apply.match(/update public\.retailer_products/g) || []).length, 1);
  assert.equal((apply.match(/update public\.offers/g) || []).length, 1);
  assert.equal((apply.match(/insert into public\.price_history/g) || []).length, 1);
  assert.equal((apply.match(/update public\.products/g) || []).length, 0);
  assert.match(apply, /modified parent product/);
  assert.match(apply, /price_history_action','create'/);
});

test("approval RPC supports exact idempotent retry and keeps raw helpers private", () => {
  assert.match(sql, /status','ALREADY_APPLIED','already_applied',true/);
  assert.match(sql, /already consumed without replay evidence/);
  assert.match(sql, /execution_result=v_result/);
  assert.match(sql, /revoke all on function public\.validate_reviewed_variant_create_rebind_offer_update_plan/);
  assert.match(sql, /public\.apply_reviewed_variant_create_rebind_offer_update_plan\(jsonb\)[\s\S]+from public,anon,authenticated,service_role/);
  assert.match(sql, /grant execute on function public\.apply_approved_product_import_plan[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function public\.apply_product_import_plan[^;]+to service_role/s);
});

test("migration contains no catalogue DML outside the guarded apply function", () => {
  const beforeApply = sql.slice(0, sql.indexOf("create function public.apply_reviewed_variant_create_rebind_offer_update_plan"));
  const afterApply = sql.slice(sql.indexOf("create function public.validate_product_import_plan_read_only"));
  const install = `${beforeApply}\n${afterApply}`;
  assert.doesNotMatch(install, /(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
});
