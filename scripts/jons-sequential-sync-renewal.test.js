const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");

const migration=fs.readFileSync(path.join(__dirname,"../supabase/migrations/20260722140000_renew_and_resume_sequential_sync_plans.sql"),"utf8");

function nextChild(parent,children){
  if(!["APPROVED","PARTIALLY_APPLIED"].includes(parent.status)||parent.expired)throw new Error("parent blocked");
  const applied=children.filter(row=>row.status==="APPLIED").length;
  const child=children[applied];
  if(!child||child.status!=="PLANNED")throw new Error("next ordinal blocked");
  if(children.slice(0,applied).some(row=>row.status!=="APPLIED"))throw new Error("prior child blocked");
  if(children.slice(applied+1).some(row=>row.status!=="PLANNED"))throw new Error("later child blocked");
  return child;
}

test("renewal RPC is exact, single-use, owner-only and business-data free",()=>{
  assert.match(migration,/renew_exact_jons_staging_parent_approval\(p_request jsonb\)/);
  assert.match(migration,/be94ac00-4f61-44f8-8e2e-1aa4ae4dc6ba/g);
  assert.match(migration,/session_user<>'postgres'/);
  assert.match(migration,/EXACT_STAGING_PARENT_APPROVAL_RENEWED/);
  assert.match(migration,/single-use/);
  assert.match(migration,/old_expiry.*new_expiry/s);
  assert.match(migration,/child_plan_fingerprint<>public\.retailer_catalogue_sha256_json\(c\.plan_json-'artifact_fingerprint'\)/);
  assert.match(migration,/recomputed parent hash mismatch/i);
  assert.match(migration,/Current Jon''s mapping manifest changed/);
  assert.doesNotMatch(migration,/grant execute on function public\.renew_exact_jons_staging_parent_approval/i);
  assert.doesNotMatch(migration,/\b(?:insert into|update|delete from) public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("renewal retains exact source, manifest, retailer, action and child bindings",()=>{
  for(const value of [
    "752a8bf3c12dbd8aafa66b4bac8b0df6cb08056161538abe1c3bb83dd391d2cc",
    "45f2b02b4e89186930fcad503379d3f6f35dc3539d71d3962efa4190e72dce3e",
    "99f3403bbbeebfd3c0cb686839606bb09ede3910b85f4cc77c1dbf1ba29e13de",
  ])assert.match(migration,new RegExp(value));
  assert.match(migration,/\{"UPDATE_STOCK":3,"VERIFY_NO_CHANGE":503\}/);
  assert.match(migration,/row#>>'\{atomic_plan,product,action\}'<>'existing'/);
  assert.match(migration,/row#>>'\{atomic_plan,product_variant,action\}'<>'existing'/);
  assert.match(migration,/row#>>'\{atomic_plan,retailer_product,action\}' not in \('noop','update'\)/);
  assert.match(migration,/row#>>'\{atomic_plan,offer,action\}' not in \('update','verify_no_change'\)/);
  assert.match(migration,/jsonb_array_length\(v_parent\.child_manifest\)<>11/);
  assert.equal((migration.match(/"batch_index":\d+/g)||[]).length,11);
});

test("sequential model accepts all eleven children only in exact order",()=>{
  const parent={status:"APPROVED",expired:false};
  const children=Array.from({length:11},(_,batch_index)=>({batch_index,status:"PLANNED"}));
  for(let index=0;index<11;index++){
    const child=nextChild(parent,children);
    assert.equal(child.batch_index,index);
    child.status="APPLIED";
    parent.status=index===10?"COMPLETED":"PARTIALLY_APPLIED";
  }
  assert.equal(parent.status,"COMPLETED");
  assert.throws(()=>nextChild(parent,children),/parent blocked/);
});

test("sequential model blocks skipped, later-active, expired, failed and replay states",()=>{
  assert.throws(()=>nextChild({status:"PARTIALLY_APPLIED",expired:true},[{status:"APPLIED"},{status:"PLANNED"}]),/parent blocked/);
  assert.throws(()=>nextChild({status:"FAILED",expired:false},[{status:"APPLIED"},{status:"PLANNED"}]),/parent blocked/);
  assert.throws(()=>nextChild({status:"PARTIALLY_APPLIED",expired:false},[{status:"APPLIED"},{status:"PLANNED"},{status:"APPROVED"}]),/later child blocked/);
  assert.throws(()=>nextChild({status:"PARTIALLY_APPLIED",expired:false},[{status:"PLANNED"},{status:"APPLIED"},{status:"PLANNED"}]),/next ordinal blocked/);
});

test("SQL patch preserves exact hashes, dependency ordering, replay and expiry guards",()=>{
  assert.match(migration,/v_parent\.status not in \(''PLANNED'',''APPROVED'',''PARTIALLY_APPLIED''\)/);
  assert.match(migration,/v_parent\.approval_expires_at<=now\(\)/);
  assert.match(migration,/v_child\.batch_index<>\(select count\(\*\).*status='APPLIED'\)/s);
  assert.match(migration,/c\.batch_index<v_child\.batch_index and c\.status<>'APPLIED'/);
  assert.match(migration,/c\.batch_index>v_child\.batch_index and c\.status<>'PLANNED'/);
  assert.match(migration,/Another active child approval exists/);
  assert.match(migration,/retailer_catalogue_assert_migration_ledger_for_child/);
  assert.doesNotMatch(migration,/create\s+(?:role|user)/i);
  assert.doesNotMatch(migration,/^\s*grant\s/im);
  assert.doesNotMatch(migration,/MASS_OOS|MASS_PRICE|MASS_CHANGE|SOURCE_DEGRADED/);
});
