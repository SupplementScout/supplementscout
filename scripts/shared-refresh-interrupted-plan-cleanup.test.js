const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260908180000_supersede_interrupted_shared_refresh_plans.sql"), "utf8");
const rollback = fs.readFileSync(path.join(ROOT, "supabase/rollbacks/20260908180000_supersede_interrupted_shared_refresh_plans.sql"), "utf8");

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
