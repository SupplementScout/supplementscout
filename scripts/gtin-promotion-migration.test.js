const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20260813170000_add_guarded_gtin_promotion.sql"), "utf8");
const rollback = fs.readFileSync(path.resolve(__dirname, "../supabase/rollbacks/20260813170000_add_guarded_gtin_promotion.sql"), "utf8");

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
  assert.match(migration, /gtin_promotion_is_valid_gtin/);
  assert.match(migration, /public\.gtin_promotion_quarantine/);
  assert.match(migration, /product_variants_gtin_unique/);
  assert.match(migration, /GTIN already belongs to another canonical identity/);
  assert.match(migration, /stale GTIN promotion canonical identity/);
  assert.match(migration, /stale GTIN promotion destination value/);
  assert.match(migration, /cannot overwrite a conflicting value/);
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
