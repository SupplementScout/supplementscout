const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");
const {buildExistingOfferUpdatePlan}=require("./lib/retailer-offer-sync/existing-offer-plan");
const {RefreshError,canonicalHash,executionRow,guardrailsFor,migrationBinding,parseArgs,runWithDiagnostic,sourceHealth,sumDeltas,verificationRecord}=require("./jons-offer-refresh");

const migrationFiles=fs.readdirSync(path.join(process.cwd(),"supabase","migrations"));
const approvedRegistrationMigration="20260724100000_add_approved_retailer_sync_registration";
const environmentMigrationExclusions={
  STAGING:new Set(["20260717130000_add_local_retailer_catalogue_child_executor","20260719100000_add_production_retailer_sync_enablement"]),
  PRODUCTION:new Set(["20260717120000_create_retailer_catalogue_control_ledger","20260717130000_add_local_retailer_catalogue_child_executor","20260717140000_add_staging_retailer_catalogue_executor","20260718150000_add_verified_no_change_offer_refresh","20260718160000_add_retailer_offer_mixed_batch_executor","20260718170000_add_read_only_mixed_batch_validator","20260719090000_add_expired_retailer_offer_sync_approval_close"]),
};
function assertMigrationBindingContract(files){
  const allMigrationIds=files.filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).map(name=>name.slice(0,-4));
  for(const environment of ["STAGING","PRODUCTION"]){
    const versions=migrationBinding(environment,files).versions;
    assert.equal(versions.includes(approvedRegistrationMigration),true,`${environment} must bind the approved retailer sync registration migration`);
    for(const id of allMigrationIds)assert.equal(versions.includes(id),!environmentMigrationExclusions[environment].has(id),`${environment} migration binding mismatch for ${id}`);
  }
}

const rowDelta=(stock=0)=>({row_count_deltas:{products:0,product_variants:0,retailer_products:0,offers:0,price_history:0},logical_field_deltas:{offer_price_updates:0,offer_shipping_updates:0,offer_total_updates:0,offer_stock_updates:stock,offer_url_updates:0,mapping_url_updates:0,mapping_updated_at_updates:0,last_checked_at_updates:1}});
const state={product:{id:1,name:"Test",is_active:true,merged_into_product_id:null,product_format:"powder"},variant:{id:2,product_id:1,variant_key:"default",display_name:"Default",flavour_code:null,flavour_label:null,size_value:"300",size_unit:"g",pack_count:null,product_format:"powder",is_active:true,is_default:true},retailer:{id:10,name:"Jon's Supplements",slug:"jon-s-supplements",website:"https://jonssupplements.co.uk"},mapping:{id:3,retailer_id:10,product_id:1,product_variant_id:2,external_product_id:"100",external_variant_id:"200",external_sku:"SKU",external_options:null,external_name:"Test",external_slug:"test",external_gtin:null,external_url:"https://jonssupplements.co.uk/products/test?variant=200",match_method:"EXACT",match_confidence:"1",updated_at:"2026-07-22T10:00:00Z"},offer:{id:4,product_id:1,retailer_id:10,product_variant_id:2,retailer_product_id:3,price:"10.00",shipping_cost:"3.99",total_price:"13.99",in_stock:true,url:"https://jonssupplements.co.uk/products/test?variant=200",last_checked_at:"2026-07-22T10:00:00Z"}};

test("stock-only update builds a source-bound existing-identity standard plan",()=>{const snapshot="a".repeat(64),built=buildExistingOfferUpdatePlan({...state,source:{external_product_id:"100",external_variant_id:"200",price:"10.00",shipping_cost:"3.99",total_price:"13.99",in_stock:false,url:state.offer.url},sourceCapturedAt:"2026-07-22T11:00:00Z",sourceSnapshotFingerprint:snapshot});assert.deepEqual(built.changed,{price:false,stock:true,url:false});assert.equal(built.plan.meta.operation_type,"standard_import");assert.equal(built.plan.meta.source_snapshot_sha256,snapshot);assert.equal(built.plan.meta.source_captured_at,"2026-07-22T11:00:00.000Z");assert.equal(built.plan.product.action,"existing");assert.equal(built.plan.product_variant.action,"existing");assert.equal(built.plan.retailer_product.action,"noop");assert.equal(built.plan.offer.action,"update");assert.equal(built.plan.price_history.action,"noop")});
test("identity drift and false no-op standard updates block",()=>{assert.throws(()=>buildExistingOfferUpdatePlan({...state,source:{external_product_id:"999",external_variant_id:"200",price:"10.00",shipping_cost:"3.99",total_price:"13.99",in_stock:false,url:state.offer.url},sourceCapturedAt:"2026-07-22T11:00:00Z",sourceSnapshotFingerprint:"a".repeat(64)}),/identity drift/);assert.throws(()=>buildExistingOfferUpdatePlan({...state,source:{external_product_id:"100",external_variant_id:"200",price:"10.00",shipping_cost:"3.99",total_price:"13.99",in_stock:true,url:state.offer.url},sourceCapturedAt:"2026-07-22T11:00:00Z",sourceSnapshotFingerprint:"a".repeat(64)}),/changed field/)});
test("standard update preserves PostgreSQL microsecond expected state",()=>{const precise={...state,mapping:{...state.mapping,updated_at:"2026-07-22T10:00:00.123456Z"},offer:{...state.offer,last_checked_at:"2026-07-22T10:00:00.654321Z"}},built=buildExistingOfferUpdatePlan({...precise,source:{external_product_id:"100",external_variant_id:"200",price:"10.00",shipping_cost:"3.99",total_price:"13.99",in_stock:false,url:state.offer.url},sourceCapturedAt:"2026-07-22T11:00:00Z",sourceSnapshotFingerprint:"a".repeat(64)});assert.equal(built.plan.expected_state.retailer_product.updated_at,"2026-07-22T10:00:00.123456Z");assert.equal(built.plan.expected_state.offer.last_checked_at,"2026-07-22T10:00:00.654321Z")});
test("delta aggregation preserves freshness and stock counts",()=>{const total=sumDeltas([{expected_deltas:rowDelta(0)},{expected_deltas:rowDelta(1)}]);assert.equal(total.logical_field_deltas.last_checked_at_updates,2);assert.equal(total.logical_field_deltas.offer_stock_updates,1);assert.equal(total.row_count_deltas.price_history,0)});
test("guard evidence retains unchanged MASS_OOS limits",()=>{const policy="a".repeat(64),rows=[{action:"UPDATE_STOCK",changed_fields:{price:false},atomic_plan:{expected_state:{offer:{in_stock:true}},offer:{values:{in_stock:false}}}}];const guard=guardrailsFor(rows,224,policy);assert.equal(guard.policy_fingerprint,policy);assert.equal(guard.limits.maximum_new_oos_count,"3");assert.equal(guard.limits.maximum_oos_increase_ratio,"0.15");assert.equal(guard.new_oos_count,1)});
test("CLI scope is closed",()=>{assert.deepEqual(parseArgs(["--target=production","--mode=dry-run"]),{target:"production",mode:"dry-run"});assert.throws(()=>parseArgs(["--target=other","--mode=apply"]));assert.throws(()=>parseArgs(["--target=production","--mode=unsafe"]))});
test("verification records omit mapping audit-only columns",()=>{const record=verificationRecord(state,{external_product_id:"100",external_variant_id:"200",price:"10.00",in_stock:true,url:state.offer.url},"a".repeat(64),"2026-07-22T11:00:00Z");assert.equal(Object.hasOwn(record.target.retailer_product,"updated_at"),false);assert.deepEqual(Object.keys(record.target.retailer_product).sort(),["external_gtin","external_name","external_options","external_product_id","external_sku","external_slug","external_url","external_variant_id","id","match_confidence","match_method","product_id","product_variant_id","retailer_id"].sort())});
test("verification records serialize PostgreSQL timestamp values",()=>{const record=verificationRecord({...state,offer:{...state.offer,last_checked_at:new Date("2026-07-22T10:00:00Z")}},{external_product_id:"100",external_variant_id:"200",price:"10.00",in_stock:true,url:state.offer.url},"a".repeat(64),"2026-07-22T11:00:00Z");assert.equal(record.target.offer.last_checked_at,"2026-07-22T10:00:00.000Z")});
test("control hashes use the JSON value sent to PostgreSQL",()=>{assert.equal(canonicalHash({timestamp:new Date("2026-07-22T10:00:00Z"),omitted:undefined}),canonicalHash({timestamp:"2026-07-22T10:00:00.000Z"}))});
test("migration bindings exclude only environment-specific ledgers",()=>{assertMigrationBindingContract(migrationFiles)});
test("later unrelated migrations do not change the retailer registration binding contract",()=>{const laterUnrelatedMigration="99999999999999_unrelated_future_migration.sql";assertMigrationBindingContract([...migrationFiles,laterUnrelatedMigration]);for(const environment of ["STAGING","PRODUCTION"])assert.equal(migrationBinding(environment,[...migrationFiles,laterUnrelatedMigration]).versions.includes(laterUnrelatedMigration.slice(0,-4)),true)});
test("execution rows use the validator closed schema",()=>{const input={offer_id:"1",retailer_product_id:"2",external_product_id:"3",external_variant_id:"4",action:"VERIFY_NO_CHANGE",changed_fields:{},source_captured_at:"now",expected_deltas:{},atomic_plan:{},source:{diagnostic:true},target:{diagnostic:true},policy_fingerprint:"a"};assert.deepEqual(Object.keys(executionRow(input)).sort(),["offer_id","retailer_product_id","external_product_id","external_variant_id","action","changed_fields","source_captured_at","expected_deltas","atomic_plan"].sort())});

function sourceCounts(productCount,variantCount,{complete=true}={}){
  const products=Array.from({length:productCount},(_,index)=>({id:index+1,variants:[]}));
  for(let index=0;index<variantCount;index++)products[index%Math.max(1,productCount)]?.variants.push({id:index+1});
  return{snapshot:{products,source_diagnostic:{pagination_completed:complete}},variants:Array.from({length:variantCount},(_,index)=>({external_variant_id:String(index+1)}) )};
}
test("source health accepts baseline and catalogue growth without weakening the 90 percent guard",()=>{
  for(const [products,variants] of [[224,844],[225,847]]){const value=sourceCounts(products,variants);const result=sourceHealth(value.snapshot,value.variants);assert.equal(result.result,"PASS");assert.ok(result.observed_ratio>=1)}
});
test("source health distinguishes incomplete, degraded and genuine collapse",()=>{
  let value=sourceCounts(0,0);assert.equal(sourceHealth(value.snapshot,value.variants).code,"SOURCE_INCOMPLETE");
  value=sourceCounts(210,740);assert.equal(sourceHealth(value.snapshot,value.variants).code,"SOURCE_DEGRADED");
  value=sourceCounts(100,400);assert.equal(sourceHealth(value.snapshot,value.variants).code,"GENUINE_SOURCE_COLLAPSE");
  value=sourceCounts(224,844,{complete:false});assert.equal(sourceHealth(value.snapshot,value.variants).code,"SOURCE_INCOMPLETE");
});
test("diagnostic artifact is written on success",async()=>{
  const outDir=fs.mkdtempSync(path.join(os.tmpdir(),"jons-refresh-success-"));
  const completed=await runWithDiagnostic(["--target=production","--mode=dry-run"],{outDir,operation:async(_args,diagnostic)=>{diagnostic.approved_mapping_count=506;diagnostic.mappings_matched=506;diagnostic.validator_result="PASS";return{result:"PASS"}}});
  const artifact=JSON.parse(fs.readFileSync(completed.diagnostic_path,"utf8"));
  assert.equal(artifact.result,"PASS");assert.equal(artifact.approved_mapping_count,506);assert.equal(artifact.mappings_matched,506);assert.equal(artifact.database_writes_completed,0);
});
test("diagnostic artifact is written before a guard failure and records zero writes",async()=>{
  const outDir=fs.mkdtempSync(path.join(os.tmpdir(),"jons-refresh-failure-"));
  await assert.rejects(runWithDiagnostic(["--target=production","--mode=dry-run"],{outDir,operation:async()=>{throw new RefreshError("SOURCE_INCOMPLETE","pagination incomplete","SOURCE_GUARD")}}),/pagination incomplete/);
  const artifact=JSON.parse(fs.readFileSync(path.join(outDir,"production-dry-run-diagnostic.json"),"utf8"));
  assert.equal(artifact.result,"FAIL");assert.equal(artifact.failure_stage,"SOURCE_GUARD");assert.equal(artifact.error_code,"SOURCE_INCOMPLETE");assert.equal(artifact.database_writes_attempted,0);assert.equal(artifact.database_writes_completed,0);assert.equal(artifact.approvals_created,0);assert.equal(artifact.recovery_calls,0);
});
