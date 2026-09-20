const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260919120000_supersede_interrupted_10reps_refresh.sql'),'utf8');
const rollback=fs.readFileSync(path.join(root,'supabase/rollbacks/20260919120000_supersede_interrupted_10reps_refresh.sql'),'utf8');
test('10 Reps cleanup preserves 791 applied rows and supersedes only 147 planned rows',()=>{
  for(const token of ['522b2186-4200-4d5a-9c7d-263185830039','52184a2d996f5ff8786dcc26982dd4058c56678f4094ac532c4a9676747199ba','9793e8fa7ef51d33c2142dfbf51a364a31898e36744cb87711e84b401832d749'])assert.match(sql,new RegExp(token));
  assert.match(sql,/status='APPLIED'\)<>16/);assert.match(sql,/status='PLANNED'\)<>3/);assert.match(sql,/<>791/);assert.match(sql,/<>147/);assert.match(sql,/array\[16,17,18\]/);assert.match(sql,/v_rows<>3/);assert.match(sql,/is distinct from v_before/);
  assert.doesNotMatch(sql,/(?:insert into|delete from|update) public\.(?:products|product_variants|retailers|retailer_products|offers|price_history)/i);
});
test('cleanup is expired, production-owner-only and forward-only',()=>{assert.match(sql,/current_user<>'postgres'/);assert.match(sql,/approval_expires_at<clock_timestamp/);assert.match(sql,/r\.status='STARTED'/);assert.match(rollback,/forward-only incident cleanup/);});
test('requested retailer workflows share one full-run production lock',()=>{for(const name of ['fit-house-offer-refresh.yml','whey-okay-offer-refresh.yml','simply-supplements-offer-refresh.yml']){const y=fs.readFileSync(path.join(root,'.github/workflows',name),'utf8');assert.match(y,/concurrency:\s*\n\s*group: retailer-offer-production-write\s*\n\s*cancel-in-progress: false/);}});
