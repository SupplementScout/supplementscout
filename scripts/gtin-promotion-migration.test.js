const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260813170000_add_guarded_gtin_promotion.sql"), "utf8");
const rollback = fs.readFileSync(path.resolve(__dirname, "../supabase/rollbacks/20260813170000_add_guarded_gtin_promotion.sql"), "utf8");
const exact36Migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260816173000_extend_guarded_gtin_promotion_exact_36.sql"), "utf8");
const exact36Rollback = fs.readFileSync(path.resolve(__dirname, "../supabase/rollbacks/20260816173000_extend_guarded_gtin_promotion_exact_36.sql"), "utf8");

test("migration reuses the approval ledger and keeps GTIN promotion role-separated", () => {
  assert.match(migration, /^begin;/i);
  assert.match(migration, /commit;\s*$/i);
  assert.match(migration, /plan_kind in \('feed', 'manual', 'gtin_promotion'\)/i);
  assert.match(migration, /insert into public\.approved_import_plans/i);
  assert.match(migration, /to retailer_catalogue_(?:staging|production)_approver/);
  assert.match(migration, /to retailer_catalogue_(?:staging|production)_executor/);
  assert.doesNotMatch(migration, /grant execute[^;]+to (?:public|anon|authenticated|service_role)/i);
});

test("database gate enforces exact owner scope, checksum, quarantine, uniqueness and stale state", () => {
  assert.match(migration, /jsonb_array_length\(p_plan->'rows'\) <> 45/);
  assert.match(migration, /owner_review,reviewed_count.*<> '45'/s);
  assert.match(migration, /owner_review,scope_fingerprint.*<> 'a79b0f29d9ba141e3421a76a58b4cda4fb0995f4513e9d7004e6ab6308d50046'/s);
  assert.equal((migration.match(/\('[0-9]+','[0-9]+','[0-9]+'\)/g) || []).length, 45);
  assert.match(migration, /outside the exact owner-approved identity allowlist/);
  assert.match(migration, /gtin_promotion_is_valid_gtin/);
  assert.match(migration, /public\.gtin_promotion_quarantine/);
  assert.match(migration, /product_variants_gtin_unique/);
  assert.match(migration, /GTIN already belongs to another canonical identity/);
  assert.match(migration, /stale GTIN promotion canonical identity/);
  assert.match(migration, /stale GTIN promotion destination value/);
  assert.match(migration, /cannot overwrite a conflicting value/);
  assert.match(migration, /destination_field' <> 'product_variants\.gtin'/);
  assert.match(migration, /expected_current_gtin' <> 'null'::jsonb/);
  const seededGtins = [...migration.matchAll(/\('([0-9]{8}|[0-9]{12,14})',\d+,\d+,/g)].map((match) => match[1]);
  assert.equal(seededGtins.length, 16);
  assert.equal(new Set(seededGtins).size, 16);
});

test("apply locks, updates atomically, records audit result and blocks replay", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /order by p\.id for update/);
  assert.match(migration, /order by pv\.id for update/);
  assert.match(migration, /update public\.products set gtin=/);
  assert.match(migration, /update public\.product_variants set gtin=/);
  assert.match(migration, /approved GTIN promotion plan already consumed/);
  assert.match(migration, /set status='consumed',consumed_at=now\(\),apply_result=v_result/);
  assert.match(migration, /GTIN promotion test failpoint after first row/);
  assert.doesNotMatch(migration, /update\s+public\.(?:offers|retailer_products)/i);
});

test("rollback refuses to erase an applied or audited promotion", () => {
  assert.match(rollback, /^begin;/i);
  assert.match(rollback, /refusing GTIN promotion rollback while approval audit rows exist/);
  assert.match(rollback, /refusing GTIN promotion rollback while canonical variant GTINs exist/);
  assert.match(rollback, /commit;\s*$/i);
  assert.doesNotMatch(rollback, /drop\s+table[^;]*public\.(?:offers|retailer_products|products|product_variants)\b/i);
});

test("exact-36 extension reuses the guarded operation and cannot widen its owner scope", () => {
  assert.match(exact36Migration, /^begin;/i);
  assert.match(exact36Migration, /rename to validate_gtin_promotion_plan_exact_45_read_only/);
  assert.match(exact36Migration, /rename to apply_approved_gtin_promotion_plan_exact_45/);
  assert.match(exact36Migration, /jsonb_array_length\(p_plan->'rows'\)<>36/);
  assert.match(exact36Migration, /scope_fingerprint}'<>'415142d4ba069103441a908bba4a15c3de73a828b9b7896a8556e29f32a97c02'/);
  assert.equal((exact36Migration.match(/\('[0-9]+','[0-9]+','[0-9]+'\)/g) || []).length, 36);
  assert.match(exact36Migration, /outside exact-36 owner allowlist/);
  assert.match(exact36Migration, /gtin_promotion_is_valid_gtin/);
  assert.match(exact36Migration, /gtin_promotion_quarantine/);
  assert.match(exact36Migration, /destination_field'<>'product_variants\.gtin'/);
  assert.match(exact36Migration, /expected_current_gtin'<>'null'::jsonb/);
  assert.match(exact36Migration, /is distinct from v_product_id or rp\.product_variant_id is distinct from v_variant_id/);
  assert.doesNotMatch(exact36Migration, /update\s+public\.(?:products|offers|retailer_products)/i);
  assert.match(exact36Migration, /update public\.product_variants set gtin=/);
  assert.match(exact36Migration, /if v_count<>36/);
  assert.match(exact36Migration, /pg_advisory_xact_lock/);
  assert.match(exact36Migration, /set status='consumed',consumed_at=now\(\),apply_result=v_result/);
  assert.doesNotMatch(exact36Migration, /grant execute[^;]+to (?:public|anon|authenticated|service_role)/i);
  assert.match(exact36Migration, /commit;\s*$/i);
});

test("exact-36 rollback removes only the extension and restores the exact-45 public operation", () => {
  assert.match(exact36Rollback, /^begin;/i);
  assert.match(exact36Rollback, /refusing exact-36 GTIN promotion rollback while approval audit rows exist/);
  assert.match(exact36Rollback, /drop function public\.apply_approved_gtin_promotion_plan_exact_36/);
  assert.match(exact36Rollback, /drop function public\.validate_gtin_promotion_plan_exact_36_read_only/);
  assert.match(exact36Rollback, /rename to validate_gtin_promotion_plan_read_only/);
  assert.match(exact36Rollback, /rename to apply_approved_gtin_promotion_plan/);
  assert.doesNotMatch(exact36Rollback, /delete from|update\s+public\.(?:products|product_variants|offers|retailer_products)|drop\s+table/i);
  assert.match(exact36Rollback, /commit;\s*$/i);
});
