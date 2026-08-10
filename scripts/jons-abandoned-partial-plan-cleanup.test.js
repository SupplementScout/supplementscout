const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const ROOT=path.resolve(__dirname,"..");
const sql=fs.readFileSync(path.join(ROOT,"supabase/migrations/20260810250000_supersede_abandoned_partial_jons_plan.sql"),"utf8");
const rollback=fs.readFileSync(path.join(ROOT,"supabase/rollbacks/20260810250000_supersede_abandoned_partial_jons_plan.sql"),"utf8");
test("cleanup is exact, control-only and preserves the applied child",()=>{
  assert.match(sql,/a36a61b0-97c0-495a-9662-f1e9928629b6/);
  assert.match(sql,/4ad2f26291c87bec38a6520d7b33b73a3d71f593be78e77c4ffa2453116699ef/);
  assert.match(sql,/PARTIALLY_APPLIED/);assert.match(sql,/status='APPLIED'\)<>1/);assert.match(sql,/status='APPROVED'\)<>1/);assert.match(sql,/status='PLANNED'\)<>9/);
  assert.match(sql,/1758c3b0-c438-4629-8935-711927d0c927/);assert.match(sql,/business_writes'\)::integer=46/);assert.match(sql,/price_history_delta'\)::integer=2/);
  assert.match(sql,/status in \('PLANNED','APPROVED'\)/);assert.match(sql,/v_rows<>10/);assert.match(sql,/preserved_business_writes',46/);
  assert.doesNotMatch(sql,/(insert into|delete from|update) public\.(products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(sql,/price_history\)<>v_history/);assert.match(sql,/status='SUPERSEDED'\)<>10/);
});
test("cleanup refuses active approvals or runs and rollback cannot reactivate it",()=>{
  assert.match(sql,/r\.status='STARTED'/);assert.match(sql,/a\.consumed_at is null and a\.expires_at>clock_timestamp\(\)/);
  assert.match(rollback,/forward-only control cleanup/);assert.doesNotMatch(rollback,/update public\./);
});
