const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const migration=fs.readFileSync(path.join(process.cwd(),"supabase/migrations/20260722130000_add_jons_sync_plan_registration.sql"),"utf8");
const workflow=fs.readFileSync(path.join(process.cwd(),".github/workflows/jons-offer-refresh.yml"),"utf8");

test("registration migration exposes one narrow security-definer RPC",()=>{
  assert.match(migration,/create or replace function public\.register_jons_offer_sync_control_plan\(p_request jsonb\)/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/retailer_id'<>'10'/i);
  assert.match(migration,/source_country'<>'GB'/i);
  assert.match(migration,/Manifest must cover every current Jon''s mapping/i);
  assert.match(migration,/perform public\.retailer_offer_sync_validate_manifest\(v_artifact\)/i);
  assert.match(migration,/RSBI_REPLAY_BLOCKED/i);
});

test("registration migration can write only parent and child control plans",()=>{
  const inserts=[...migration.matchAll(/insert into public\.([a-z0-9_]+)/gi)].map(match=>match[1]);
  assert.deepEqual([...new Set(inserts)].sort(),["retailer_catalogue_child_plans","retailer_catalogue_parent_plans"]);
  assert.doesNotMatch(migration,/\b(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history|approved_import_plans)\b/i);
  assert.doesNotMatch(migration,/\b(?:merge|truncate)\b/i);
});

test("only validator roles receive execute and direct tables remain ungranted",()=>{
  assert.match(migration,/grant execute on function public\.register_jons_offer_sync_control_plan\(jsonb\)\s+to retailer_catalogue_staging_validator/i);
  assert.match(migration,/grant execute on function public\.register_jons_offer_sync_control_plan\(jsonb\)\s+to retailer_catalogue_production_validator/i);
  assert.doesNotMatch(migration,/grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.retailer_catalogue_/i);
  assert.doesNotMatch(migration,/create\s+(?:role|user)/i);
});

test("workflow is protected, scheduled, dispatchable and uses role-separated credentials",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/cron: "47 4 \* \* \*"/);
  assert.match(workflow,/environment: production-readonly/);
  for(const secret of ["JONS_SYNC_VALIDATOR_DATABASE_URL","JONS_SYNC_APPROVER_DATABASE_URL","JONS_SYNC_EXECUTOR_DATABASE_URL"])assert.match(workflow,new RegExp(`secrets\\.${secret}`));
  assert.match(workflow,/--target=production --mode=dry-run/);
  assert.match(workflow,/--target=production --mode=apply/);
  assert.doesNotMatch(workflow,/^\s*SAFE_UPDATE\s*:/m);
});
