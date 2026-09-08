const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260908180000_supersede_interrupted_shared_refresh_plans.sql"), "utf8");
const rollback = fs.readFileSync(path.join(ROOT, "supabase/rollbacks/20260908180000_supersede_interrupted_shared_refresh_plans.sql"), "utf8");
const expiredSql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260908190000_supersede_expired_discount_jons_refresh_plans.sql"), "utf8");
const expiredRollback = fs.readFileSync(path.join(ROOT, "supabase/rollbacks/20260908190000_supersede_expired_discount_jons_refresh_plans.sql"), "utf8");
const serializedSql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260908200000_serialize_shared_refresh_and_close_partial_jons.sql"), "utf8");
const serializedRollback = fs.readFileSync(path.join(ROOT, "supabase/rollbacks/20260908200000_serialize_shared_refresh_and_close_partial_jons.sql"), "utf8");

test("cleanup is exact, control-only, and preserves completed refresh children", () => {
  for (const token of ["c2e1d342-072d-4fc0-aefa-79c345ab4e3b", "c0290d21-70f8-46fb-a7d8-5eda0ed389f2", "36c5e024442662bdd599c0946c8d607788ecd75d80d03d50f712af5c2ccee5f6", "84eadbcafb859cb1515672fb56cad9447afa9850c368077378f677f5a2031de3"]) assert.match(sql, new RegExp(token));
  assert.match(sql, /status='APPLIED'\)<>4/);
  assert.match(sql, /status='APPLIED'\)<>1/);
  assert.match(sql, /record_ids\)\),0\)[\s\S]*<>192/);
  assert.match(sql, /record_ids\)\),0\)[\s\S]*<>50/);
  assert.match(sql, /status in \('PLANNED','APPROVED'\)/);
  assert.match(sql, /v_rows<>20/);
  assert.doesNotMatch(sql, /(?:insert into|delete from|update) public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(sql, /v_after is distinct from v_before/);
});

test("cleanup rejects active work and rollback cannot reactivate plans", () => {
  assert.match(sql, /r\.status='STARTED'/);
  assert.match(sql, /a\.expires_at<clock_timestamp\(\)/);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(sql, /target_environment'<>'PRODUCTION'/);
  assert.match(rollback, /forward-only control cleanup/);
  assert.doesNotMatch(rollback, /update public\./);
});

test("expired Discount and Jon's cleanup is exact, control-only, and preserves the catalogue", () => {
  for (const token of [
    "a072732f-df0e-4ed8-b3e7-1bb60f62fe51",
    "444c1eb4b5127a9edc8ae00527f8ded6bbc082b6f9e6a4b642fccf8857f6ac01",
    "8afb103b-661b-4b30-a32a-301dd0a83ce4",
    "2335b43b-0bfd-4fc1-8e62-65bfb7e430b3",
    "ec18d2639dc6adaef669f18f81d366136b24d183a0837d96a86cfe7af52b8282",
    "52be46a4-43fd-4db6-803a-d62930f585dd",
  ]) assert.match(expiredSql, new RegExp(token));
  assert.match(expiredSql, /status='APPROVED'\)<>1/);
  assert.match(expiredSql, /status='PLANNED'\)<>2/);
  assert.match(expiredSql, /status='PLANNED'\)<>10/);
  assert.match(expiredSql, /a\.expires_at<clock_timestamp\(\)/);
  assert.match(expiredSql, /v_rows<>14/);
  assert.match(expiredSql, /v_after is distinct from v_before/);
  assert.doesNotMatch(expiredSql, /(?:insert into|delete from|update) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i);
  assert.match(expiredRollback, /forward-only control cleanup/);
  assert.doesNotMatch(expiredRollback, /update public\./);
});

test("shared execution is serialized and the exact partial Jon's plan is closed without catalogue writes", () => {
  for (const token of [
    "8079673c-ae56-47df-9aec-60e11060f736",
    "bb40a9ab0baf8623f652ae01aafd0cf2851ee55a84004409ded758decc969ee2",
    "f9a906f7-f870-4226-9b31-de8e4cb257ef",
    "870a4a80-9b0e-4b86-bbda-98433293d50e",
    "fdd2f32a-90b0-4c0c-8f64-48a2c7e66b0a",
  ]) assert.match(serializedSql, new RegExp(token));
  assert.match(serializedSql, /pg_advisory_xact_lock\(hashtextextended\('retailer-offer-sync:global-execution',0\)\)/g);
  assert.match(serializedSql, /current_user<>'retailer_catalogue_production_executor'/);
  assert.match(serializedSql, /status='APPLIED'\)<>1/);
  assert.match(serializedSql, /status='APPROVED'\)<>1/);
  assert.match(serializedSql, /status='PLANNED'\)<>9/);
  assert.match(serializedSql, /v_rows<>10/);
  assert.match(serializedSql, /'preserved_applied_children',1,'preserved_refreshed_offers',50/);
  assert.match(serializedSql, /v_after is distinct from v_before/);
  assert.doesNotMatch(serializedSql, /(?:insert into|delete from|update) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i);
  assert.match(serializedRollback, /forward-only incident cleanup/);
  assert.doesNotMatch(serializedRollback, /update public\./);
});
