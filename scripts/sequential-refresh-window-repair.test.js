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
test('dedicated 10 Reps and Simply registrations receive the same bounded parent window',()=>{
  const dedicated=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260919200000_extend_10reps_simply_refresh_window.sql'),'utf8');
  assert.match(dedicated,/register_10reps_offer_sync_control_plan/);
  assert.match(dedicated,/register_simply_supplements_offer_sync_control_plan/);
  assert.match(dedicated,/15 minutes/);
  assert.match(dedicated,/45 minutes/);
  assert.doesNotMatch(dedicated,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('Discount, Dolphin and KIOR registrations accept the existing 44-minute parent without business writes',()=>{
  const dedicated=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260922122000_extend_three_dedicated_refresh_windows.sql'),'utf8');
  for(const name of ['discount_supplements','dolphin_vegan_protein','kior'])assert.match(dedicated,new RegExp(`register_${name}_offer_sync_control_plan`));
  assert.match(dedicated,/15 minutes/);
  assert.match(dedicated,/45 minutes/);
  assert.match(dedicated,/retailer_catalogue_business_counts\(\) is distinct from v_before/);
  assert.doesNotMatch(dedicated,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('sequential parent approval preserves the applied 10 Reps batch and fixes both long retailers',()=>{
  const repair=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260919203000_prepare_sequential_parent_approval.sql'),'utf8');
  assert.match(repair,/6bf06253-9309-4ec7-98ae-003047d946cb/);
  assert.match(repair,/status='APPLIED'\)<>1/);
  assert.match(repair,/status='PLANNED'\)<>18/);
  assert.match(repair,/preserved_refreshed_offers',50/);
  assert.match(repair,/v_parent\.retailer_id not in \(7,14\)/);
  assert.match(repair,/prepare_sequential_retailer_offer_sync_parent_approval/);
  assert.match(repair,/PARTIALLY_APPLIED/);
  assert.match(automation,/prepareSequentialParentApproval/);
  assert.doesNotMatch(repair,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('approver identity repair uses the effective role and closes only the empty retry',()=>{
  const repair=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260919210000_fix_sequential_parent_approver_identity.sql'),'utf8');
  assert.match(repair,/720ff2b5-358a-4c15-b1c1-49262da8d254/);
  assert.match(repair,/status='PLANNED'\)<>19/);
  assert.match(repair,/<>935/);
  assert.match(repair,/v_effective_role text:=current_setting\('role',true\)/);
  assert.match(repair,/v_effective_role is distinct from 'retailer_catalogue_production_approver'/);
  assert.doesNotMatch(repair,/if current_user<>'retailer_catalogue_production_approver'/);
  assert.match(repair,/v_parent\.retailer_id not in \(7,14\)/);
  assert.doesNotMatch(repair,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('three more retailers use the existing guarded sequential parent approval',()=>{
  const previous=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260919210000_fix_sequential_parent_approver_identity.sql'),'utf8');
  const extension=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260922140000_extend_three_sequential_parent_approvals.sql'),'utf8');
  const marker='create or replace function public.prepare_sequential_retailer_offer_sync_parent_approval(p_request jsonb)';
  const functionSection=text=>text.slice(text.indexOf(marker),text.lastIndexOf('commit;')).replaceAll('\r\n','\n');
  const expected=functionSection(previous)
    .replace('v_parent.retailer_id not in (7,14)','v_parent.retailer_id not in (4,5,7,8,14)')
    .replace("v_slug:=case v_parent.retailer_id when 14 then '10-reps' when 7 then 'simply-supplements' end;",
      "v_slug:=case v_parent.retailer_id when 4 then 'discount-supplements' when 5 then 'dolphin-fitness' when 7 then 'simply-supplements' when 8 then 'kior-health' when 14 then '10-reps' end;");
  assert.equal(functionSection(extension),expected);
  assert.match(extension,/retailer_catalogue_actual_database_target\(\)/);
  assert.match(extension,/current_user<>'postgres'/);
  assert.match(extension,/sequential parent approval extension definition mismatch/);
  assert.doesNotMatch(extension,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
test('failed Discount, Dolphin and KIOR parents are superseded only after exact empty-plan checks',()=>{
  const cleanup=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20260922141000_supersede_three_failed_refresh_plans.sql'),'utf8');
  for(const exact of [
    'dfdaaaa4-fd5a-4fe8-b775-a019f61b79ae',
    '61071c3345db0f257d824928aae26dd6c3ace24fcb64fd072d26647b5665b1f8',
    '9c3bb11e-797c-4dbf-86f8-1084c6dc09fc',
    'e615ef54055888bb4dc06dfb2424fcff6967c5b4b744214d5d0c14e8c07bd988',
    '541138a2-3df3-4ca6-8563-3ec9550b459b',
    '516eda5e64a14472926683f962e1fcfc6c9fcaaa7e45d8bd69973d866878b125',
  ])assert.ok(cleanup.includes(exact));
  assert.match(cleanup,/3::integer\)[\s\S]*1::integer\)[\s\S]*1::integer\)/);
  assert.match(cleanup,/p\.status='PLANNED'/);
  assert.match(cleanup,/v_plan\.expires_at<v_now/);
  assert.match(cleanup,/p\.approval_id is null and p\.approval_consumed_at is null/);
  assert.match(cleanup,/c\.status='PLANNED'/);
  assert.match(cleanup,/public\.retailer_catalogue_apply_runs/);
  assert.match(cleanup,/public\.retailer_offer_sync_batch_approvals/);
  assert.match(cleanup,/v_after is distinct from v_before/);
  assert.doesNotMatch(cleanup,/\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history|retailers)\b/i);
});
