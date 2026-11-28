const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(__dirname, "../supabase/migrations/20260901090000_add_reviewed_variant_create_rebind_offer_update.sql");
const sql = fs.readFileSync(migrationPath, "utf8");
const repairPath = path.join(__dirname, "../supabase/migrations/20260901100000_fix_reviewed_variant_digest_schema_resolution.sql");
const repairSql = fs.readFileSync(repairPath, "utf8");
const executorAclRepairPath = path.join(__dirname, "../supabase/migrations/20260901110000_restore_reviewed_variant_executor_rpc_acl.sql");
const executorAclRepairSql = fs.readFileSync(executorAclRepairPath, "utf8");

const proposal = name => fs.readFileSync(path.join(__dirname, "../supabase/migrations", name), "utf8");
test("v4 shared proposal preserves old serializers and exposes no new public capability", () => {
  const value = proposal("20261125100000_shared_import_contract_v4.sql");
  assert.match(value, /utf16_sort_key/);assert.match(value, /v_version in \('2','3'\)/);
  assert.match(value, /CONSUMER_LINEAGE_MISMATCH/);assert.match(value, /CONSUMER_PATCH_SHAPE/);
  assert.match(value, /revoke all on all functions in schema atomic_import_private from public,anon,authenticated,service_role/);
  assert.match(value, /CANONICAL_GTIN_STATE_CHANGED/);assert.match(value, /FOREIGN_GTIN_CLAIM/);
  assert.match(value, /PARENT_PEERS_CHANGED/);assert.match(value, /OWNER_RESOLUTION_INVALID/);
  assert.match(value, /lock table public.gtin_promotion_quarantine in share mode/);
  assert.doesNotMatch(value, /create (?:or replace )?function public\./i);
  assert.doesNotMatch(value, /create table|grant (?:select|execute)|retailer_id\s*=\s*(?:12|13)/i);
});

test("format v2 proposal extends the existing ledger and keeps a typed single-field NULL fill", () => {
  const value = proposal("20261125101000_reviewed_format_correction_v2.sql");
  assert.match(value, /p_package->'schema_version'='1'::jsonb/);
  assert.match(value, /p_package->'schema_version'='2'::jsonb/);
  assert.match(value, /v_op->'expected_before' is distinct from 'null'::jsonb/);
  assert.match(value, /set product_format=p_package#>>'\{operation,reviewed_after\}'/);
  assert.match(value, /FORMAT_V2_POSTCONDITION_MISMATCH/);
  assert.match(value, /FORMAT_V2_LINEAGE_MISMATCH/);
  assert.doesNotMatch(value, /create (?:or replace )?function public\.|create table|grant (?:select|execute)/i);
});

test("identity v5 proposal reuses the existing executor with zero commercial and history writes", () => {
  const value = proposal("20261125102000_existing_target_identity_rebind_v5.sql");
  assert.match(value, /IDENTITY_V5_MANAGED_HISTORY_UNSUPPORTED/);
  assert.match(value, /set product_variant_id=/);
  assert.match(value, /IDENTITY_ONLY_NO_OBSERVATION/);
  assert.match(value, /IDENTITY_V5_POSTCONDITION_MISMATCH/);
  assert.match(value, /IDENTITY_V5_OWNER_RESOLUTION_INVALID/);
  assert.doesNotMatch(value, /insert into public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.doesNotMatch(value, /set (?:price|shipping_cost|total_price|in_stock|url|last_checked_at|external_gtin)=/i);
  assert.doesNotMatch(value, /create (?:or replace )?function public\.|create table|grant (?:select|execute)/i);
});

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

test("forward-only digest repair changes only the four validator extension calls", () => {
  const validator = sql.slice(
    sql.indexOf("create function public.validate_reviewed_variant_create_rebind_offer_update_plan"),
    sql.indexOf("create function public.apply_reviewed_variant_create_rebind_offer_update_plan"),
  );
  const repaired = validator.replaceAll("digest(", "extensions.digest(");
  assert.equal((validator.match(/(?<![A-Za-z0-9_.])digest\s*\(/g) || []).length, 4);
  assert.equal((repaired.match(/(?<![A-Za-z0-9_.])digest\s*\(/g) || []).length, 0);
  assert.equal((repaired.match(/extensions\.digest\s*\(/g) || []).length, 4);
  assert.match(repairSql, /pg_get_functiondef\('public\.validate_reviewed_variant_create_rebind_offer_update_plan\(jsonb\)'::regprocedure\)/);
  assert.match(repairSql, /replace\(v_definition,'digest\(', 'extensions\.digest\('\)/);
  assert.match(repairSql, /v_unqualified_count <> 4[\s\S]+v_qualified_count <> 0/);
  assert.match(repairSql, /v_unqualified_count <> 0[\s\S]+v_qualified_count <> 4/);
  assert.doesNotMatch(repairSql, /search_path\s*=\s*[^\n;]*extensions/i);
});

test("digest repair preserves owner, security boundary, and contains no data writes", () => {
  assert.match(repairSql, /current_user <> 'postgres'/);
  assert.match(repairSql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(repairSql, /v_owner <> 'postgres'/);
  assert.match(repairSql, /not v_security_definer/);
  assert.match(repairSql, /array\['search_path=pg_catalog, public, pg_temp'\]/);
  assert.match(repairSql, /revoke all on function public\.validate_reviewed_variant_create_rebind_offer_update_plan\(jsonb\)[\s\S]+from public,anon,authenticated,service_role/);
  assert.match(repairSql, /not has_function_privilege\('service_role','public\.apply_approved_product_import_plan/);
  assert.doesNotMatch(repairSql, /\b(?:insert\s+into|update|delete\s+from|merge\s+into|truncate)\b/i);
  assert.doesNotMatch(repairSql, /\bgrant\b/i);
});

test("forward-only ACL repair restores only the reviewed executor RPC capability", () => {
  assert.match(executorAclRepairSql, /current_user <> 'postgres'/);
  assert.match(executorAclRepairSql, /supplementscout-production:aftboxmrdgyhizicfsfu/);
  assert.match(executorAclRepairSql, /v_owner <> 'postgres'/);
  assert.match(executorAclRepairSql, /not v_security_definer/);
  assert.match(executorAclRepairSql, /array\['search_path=pg_catalog, public, pg_temp'\]/);
  assert.match(executorAclRepairSql, /grant execute on function public\.apply_approved_product_import_plan\(uuid,text,text,text,bigint,text,text\)\s+to retailer_catalogue_production_executor;/);
  assert.doesNotMatch(executorAclRepairSql, /grant execute[\s\S]+to (?:public|anon|authenticated|service_role|retailer_catalogue_production_approver|retailer_catalogue_production_validator)/i);
  for (const forbidden of ["public", "anon", "authenticated", "retailer_catalogue_production_approver", "retailer_catalogue_production_validator"]) {
    assert.match(executorAclRepairSql, new RegExp(`has_function_privilege\\('${forbidden}'.+,'execute'\\)`));
  }
  assert.match(executorAclRepairSql, /not has_function_privilege\('service_role'.+,'execute'\)/);
  assert.match(executorAclRepairSql, /not has_function_privilege\('retailer_catalogue_production_executor'.+,'execute'\)/);
  assert.doesNotMatch(executorAclRepairSql, /\b(?:insert\s+into|update|delete\s+from|merge\s+into|truncate|create\s+(?:or\s+replace\s+)?function|alter\s+function)\b/i);
});
