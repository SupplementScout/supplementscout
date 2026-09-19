const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const migration=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260919193000_extend_sequential_refresh_window.sql'),'utf8');
const rollback=fs.readFileSync(path.join(process.cwd(),'supabase/rollbacks/20260919193000_extend_sequential_refresh_window.sql'),'utf8');
const automation=fs.readFileSync(path.join(process.cwd(),'scripts/fit-house-offer-refresh.js'),'utf8');
test('repair closes only four exact expired children and preserves 739 applied rows',()=>{
  assert.match(migration,/c8656839-4b23-4316-991a-1984a4a0bef6/);
  assert.match(migration,/status='APPLIED'\)<>15/);
  assert.match(migration,/status='PLANNED'\)<>4/);
  assert.match(migration,/<>739/);
  assert.match(migration,/array\[15,16,17,18\]/);
  assert.doesNotMatch(migration,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('parent window is bounded while every child receives a fresh short approval',()=>{
  assert.match(migration,/register_retailer_offer_sync_control_plan/);
  assert.match(migration,/register_fit_house_offer_sync_control_plan/);
  assert.match(migration,/45 minutes/);
  assert.match(automation,/Date\.now\(\)\+44\*60000/);
  assert.match(automation,/Date\.now\(\)\+14\*60000/);
  assert.match(automation,/Date\.parse\(parentExpiresAt\)<=Date\.now\(\)\+45\*60000/);
  assert.match(rollback,/Forward-only/);
});
