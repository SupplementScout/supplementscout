const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/20260919113000_supersede_interrupted_jons_refresh.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/20260919113000_supersede_interrupted_jons_refresh.sql"), "utf8");
const jonsWorkflow = fs.readFileSync(path.join(root, ".github/workflows/jons-offer-refresh.yml"), "utf8");
const ebayWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ebay-offer-refresh.yml"), "utf8");

test("cleanup is exact, control-only, and preserves 138 completed freshness writes", () => {
  for (const token of [
    "2c54a71a-50c4-4592-9ad4-64819853934d",
    "ea4d7f3f175a75d265c134b0add38cf5c900416a02fe5603d58b542b06316ded",
    "001b63da-bcff-4500-a6d3-9b16671b91a8",
    "d92a23d8-e0c9-478a-930d-9d24f0383b6b",
    "b4014db705d77b5f74a9db719602a457db899bb3b2c4d7ae775876e320209293",
  ]) assert.match(sql, new RegExp(token));
  assert.match(sql, /status='APPLIED'\)<>3/);
  assert.match(sql, /status='APPROVED'\)<>1/);
  assert.match(sql, /status='PLANNED'\)<>7/);
  assert.match(sql, /record_ids\)\),0\)[\s\S]*<>138/);
  assert.match(sql, /v_rows<>8/);
  assert.match(sql, /'preserved_applied_children',3,'preserved_refreshed_offers',138/);
  assert.match(sql, /v_after is distinct from v_before/);
  assert.doesNotMatch(sql, /(?:insert into|delete from|update) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i);
});

test("cleanup rejects active work and rollback cannot reactivate the plan", () => {
  assert.match(sql, /r\.status='STARTED'/);
  assert.match(sql, /a\.expires_at<clock_timestamp\(\)/);
  assert.match(sql, /current_user<>'postgres'/);
  assert.match(rollback, /forward-only incident cleanup/);
  assert.doesNotMatch(rollback, /update public\./);
});

test("eBay and Jon's serialize their complete production refresh workflows", () => {
  for (const workflow of [jonsWorkflow, ebayWorkflow]) {
    assert.match(workflow, /concurrency:\s*\n\s*group: retailer-offer-production-write\s*\n\s*cancel-in-progress: false/);
  }
});
