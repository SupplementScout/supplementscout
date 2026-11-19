const assert = require("node:assert/strict");
const test = require("node:test");
const { canonicalIdentityConflict } = require("./lib/retailer-offer-sync/existing-offer-plan");
const { classifyExistingOffers, partitionExecutableRows } = require("./lib/retailer-offer-sync/classifier");
const { partitionImporterRows } = require("./gym-high-refresh-artifact");
const { PROFILES } = require("./lib/automation-review-publication-profiles");

function scope(count = 109) {
  const targets = Array.from({ length: count }, (_, index) => ({ offer_id: String(index + 1), retailer_product_id: String(index + 1000),
    external_product_id: String(index + 2000), external_variant_id: String(index + 3000), external_sku: null,
    price: "12.99", shipping_cost: "4.99", total_price: "17.98", in_stock: true,
    url: `https://example.invalid/products/test-${index}?variant=${index + 3000}`,
    external_url: `https://example.invalid/products/test-${index}?variant=${index + 3000}`, last_checked_at: "2026-11-11T10:00:00Z" }));
  const sourceVariants = targets.map((row, index) => ({ external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
    external_sku: null, product_handle: `test-${index}`, price: row.price, shipping_cost: row.shipping_cost, total_price: row.total_price, in_stock: true }));
  return { targets, sourceVariants, sourceCapturedAt: "2026-11-19T10:00:00Z", now: new Date("2026-11-19T10:00:00Z"),
    sourceProductCount: 343, previousSourceProductCount: 341, quarantineUnsafeRows: true,
    policy: { store_url: "https://example.invalid", required_matched_offers: count, source_freshness_hours: 24,
      future_clock_skew_minutes: 5, full_snapshot_minimum_source_count_ratio: .9, mass_oos_block_count: 4,
      maximum_total_oos_ratio: .35, maximum_oos_increase_percentage_points: .15, maximum_changed_record_ratio: .25,
      mass_price_change_block_ratio: .2, per_row_price_hard_block_ratio: .6, per_row_price_hard_block_absolute_gbp: "20" } };
}

test("Default with explicit siblings is reviewed for both freshness and price; 108 independent rows remain executable", () => {
  const record = { product: { id: 407 }, variant: { id: 386, product_id: 407, is_default: true } };
  const sibling = { id: 2015, product_id: 407, is_default: false, is_active: true };
  const conflict = canonicalIdentityConflict(record, [record.variant, sibling]);
  assert.deepEqual(conflict.active_explicit_variant_ids, ["2015"]);
  for (const changed of [false, true]) {
    const input = scope(); input.targets[0].canonical_identity_conflict = conflict;
    if (changed) { input.sourceVariants[0].price = "9.99"; input.sourceVariants[0].total_price = "14.98"; }
    const result = classifyExistingOffers(input);
    assert.equal(result.state, "DRY_RUN_READY_WITH_REVIEW");
    const partition = partitionExecutableRows(result, { approvedOfferIds: input.targets.map(row => row.offer_id) });
    assert.equal(partition.executable_rows.length, 108);
    assert.equal(partition.review_rows.length, 1);
    assert.equal(partition.review_rows[0].reason, "CANONICAL_IDENTITY_CONFLICT");
    assert.equal(partition.review_rows[0].expected_deltas.logical_field_deltas.last_checked_at_updates, 0);
    assert.deepEqual(classifyExistingOffers(input), result);
  }
  assert.equal(canonicalIdentityConflict({ ...record, variant: sibling }, [record.variant,sibling]), null);
  assert.equal(canonicalIdentityConflict(record, [record.variant]), null);
});

test("global source/identity failures cannot become local canonical reviews", () => {
  const input = scope(); input.targets[0].canonical_identity_conflict = { reason: "CANONICAL_IDENTITY_CONFLICT" };
  assert.equal(classifyExistingOffers({ ...input, sourceProductCount: 20 }).state, "BLOCKED");
  input.sourceVariants.push({ ...input.sourceVariants[0] });
  assert.equal(classifyExistingOffers(input).state, "BLOCKED");
  assert.throws(() => partitionExecutableRows({ rows: [{offer_id:"1"}], quarantined_rows: [] }, {approvedOfferIds:["1","2"]}), /INCOMPLETE/);
});

test("all latent Default siblings are held even when their current prices are unchanged", () => {
  const input=scope();
  const incidents=[[407,386,2015],[816,1163,2944],[824,1171,2886]];
  incidents.forEach(([productId,variantId,siblingId],index)=>{
    input.targets[index].canonical_identity_conflict=canonicalIdentityConflict({product:{id:productId},variant:{id:variantId,is_default:true}},
      [{id:siblingId,product_id:productId,is_active:true,is_default:false}]);
  });
  const result=classifyExistingOffers(input);
  const partition=partitionExecutableRows(result,{approvedOfferIds:input.targets.map(row=>row.offer_id)});
  assert.equal(partition.executable_rows.length,input.targets.length-incidents.length);
  assert.equal(partition.review_rows.length,incidents.length);
});

test("an unexpected database error remains a global, read-only validation failure", async () => {
  const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
  const statements=[];
  class TestClient {
    async connect() {}
    async end() {}
    async query(sql) {
      statements.push(sql);
      if(sql.includes("validate_retailer_offer_sync_batch_read_only")){
        const error=Error("TEST ONLY database unavailable");error.code="57P01";throw error;
      }
      if(sql.includes("select current_user,session_user"))return{rows:[{current_user:"retailer_catalogue_production_validator",ro:"on",safe_update:null}]};
      return{rows:[{value:null}]};
    }
  }
  const oldProfile=process.env.RETAILER_REFRESH_PROFILE,oldUrl=process.env.DISCOUNT_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL;
  process.env.RETAILER_REFRESH_PROFILE="discount-supplements";
  process.env.DISCOUNT_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL="postgresql://TEST_ONLY_USER@db.abcdefghijklmnopqrst.supabase.co/postgres?sslmode=require";
  try {
    const file=path.resolve("scripts/fit-house-offer-refresh.js"),mod=new Module(file,module);
    mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
    mod.require=name=>name==="pg"?{Client:TestClient}:Module.prototype.require.call(mod,name);
    mod._compile(fs.readFileSync(file,"utf8"),file);
    const row={offer_id:"1",action:"VERIFY_NO_CHANGE",changed_fields:{price:false,stock:false,url:false},
      atomic_plan:{expected_state:{offer:{price:"12.99",in_stock:true}},offer:{values:{price:"12.99",in_stock:true}}}};
    await assert.rejects(mod.exports.validate({target:"production",spec:{ref:"aftboxmrdgyhizicfsfu",identity:"TEST ONLY"},
      binding:{versions:[],fingerprint:"a".repeat(64)},head:"a".repeat(40),snapshot:{products:{length:343}},
      artifacts:[{policy_fingerprint:"a".repeat(64),rows:[row]}]}),error=>{
      assert.equal(error.code,"VALIDATOR_REJECTED");assert.equal(error.stage,"VALIDATOR");assert.equal(error.detail.sqlstate,"57P01");
      assert.equal(error.detail.database_error_fingerprint.length,64);return true;
    });
    assert.ok(statements.includes("begin read only"));assert.ok(statements.includes("rollback"));
    assert.equal(statements.some(sql=>/approve|execute_retailer|insert|update|delete/i.test(sql.replaceAll("safe_update","safe_flag"))),false);
  } finally {
    if(oldProfile===undefined)delete process.env.RETAILER_REFRESH_PROFILE;else process.env.RETAILER_REFRESH_PROFILE=oldProfile;
    if(oldUrl===undefined)delete process.env.DISCOUNT_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL;else process.env.DISCOUNT_SUPPLEMENTS_REFRESH_VALIDATOR_DATABASE_URL=oldUrl;
  }
});

function importerScope(blockedCount) {
  const approved_scope_rows = Array.from({length:66}, (_,i)=>({external_product_id:String(i+1),external_variant_id:String(i+1),mapping_id:String(i+100),offer_id:String(i+200)}));
  const source_rows=approved_scope_rows.slice(0,65).map((row,i)=>({row_number:String(i+1),status:i<blockedCount?"blocked":"planned",normalized_source_row:row,source_row_fingerprint:"a".repeat(64)}));
  return {report:{approved_row_count:66,executable_row_count:65,row_artifact_count:65,review_row_count:1,
    review_rows:[{...approved_scope_rows[65],external_variant_ids:["66"],reason:"SOURCE_IDENTITY_DRIFT"}],approved_scope_rows},
    loaded:{artifact:{row_count:"65",source_rows,plans:source_rows.slice(blockedCount).map(row=>({row_number:row.row_number})),
      blocked_rows:source_rows.slice(0,blockedCount).map(row=>({rowNumber:row.row_number,reasons:["unit-count conflict"]}))}}};
}

test("catalogue adapter accounts for every approved row using the same execution/review partition", () => {
  for (const blockedCount of [0,1,4,10,65]) {
    const input=importerScope(blockedCount),result=partitionImporterRows(input.report,input.loaded);
    assert.equal(result.report.executable_row_count,65-blockedCount);
    assert.equal(result.report.review_row_count,1+blockedCount);
    assert.equal(result.loaded.artifact.plans.length+result.report.review_row_count,66);
    assert.equal(new Set(result.report.review_rows.map(row=>row.offer_id)).size,1+blockedCount);
  }
  const unknown=importerScope(1);unknown.loaded.artifact.blocked_rows[0].reasons=["database disconnected"];
  assert.throws(()=>partitionImporterRows(unknown.report,unknown.loaded),/globally blocked/);
  const missing=importerScope(1);missing.report.approved_scope_rows.pop();
  assert.throws(()=>partitionImporterRows(missing.report,missing.loaded),/identities are missing/);
});

test("both incident adapters reuse the shared publisher and closed review-only identity policy", () => {
  for (const name of ["gym-high","discount-supplements"]) {
    const profile=PROFILES[name];
    const policy=profile.readOnlyReviewPolicies.CANONICAL_IDENTITY_CONFLICT;
    assert.deepEqual(policy,{reasonCode:"IDENTITY_CONFLICT",reviewKind:"IDENTITY_CONFLICT",operation:"MANUAL_REVIEW_IDENTITY"});
    const card=profile.reviewCard({}, {action:"READ_ONLY_REVIEW",evidence_reason:"CANONICAL_IDENTITY_CONFLICT"});
    assert.equal(card.operationType,"MANUAL_REVIEW_IDENTITY");
    assert.equal(card.proposedState.automatic_action,false);
    assert.equal(card.sourcePrice,null);
  }
});

test("shared source binding verifies the exact review artifact and retry attempt for both incident workflows", async () => {
  const {verifyGithubBinding}=require("./shared-retailer-automation-review-source");
  for(const key of ["gym-high","discount-supplements"]){
    const profile=PROFILES[key],sha="a".repeat(40),digest="b".repeat(64);
    const run={id:123,repository:{full_name:"SupplementScout/supplementscout"},path:profile.workflow,name:profile.workflowName,
      status:"in_progress",event:"schedule",head_branch:"main",head_sha:sha,run_attempt:2};
    const artifact={id:456,workflow_run:{id:123},name:`${profile.artifactPrefix}-123-2`,expired:false,digest:`sha256:${digest}`};
    const fetchImpl=async url=>({ok:true,json:async()=>url.includes("/artifacts/")?artifact:run});
    const options={profile:key,sourceRunId:"123",sourceArtifactId:"456",sourceCommitSha:sha,sourceArtifactDigest:digest};
    const env={GITHUB_TOKEN:"TEST_ONLY",GITHUB_ACTIONS:"true",GITHUB_RUN_ID:"123",GITHUB_RUN_ATTEMPT:"2"};
    await verifyGithubBinding(options,env,fetchImpl);
    artifact.name=`${profile.artifactPrefix}-123-1`;
    await assert.rejects(verifyGithubBinding(options,env,fetchImpl),/artifact binding mismatch/);
    artifact.name=`${profile.artifactPrefix}-123-2`;artifact.digest=`sha256:${"c".repeat(64)}`;
    await assert.rejects(verifyGithubBinding(options,env,fetchImpl),/digest mismatch/);
    run.head_branch="feature";await assert.rejects(verifyGithubBinding(options,env,fetchImpl),/branch or commit mismatch/);
  }
});

test("shared postflight deltas preserve shipping-only changes, freshness and history from atomic plans", () => {
  const {deltasForExistingOfferPlan}=require("./lib/retailer-offer-sync/action-contract");
  const plan={expected_state:{offer:{price:"12.99",shipping_cost:"4.99",total_price:"17.98",in_stock:true,url:"https://example.invalid/a"},
    retailer_product:{external_url:"https://example.invalid/a"}},
    offer:{action:"verify_no_change",values:{price:"12.99",shipping_cost:"4.99",total_price:"17.98",in_stock:true,url:"https://example.invalid/a"}},
    retailer_product:{action:"noop",values:{external_url:"https://example.invalid/a"}},price_history:{action:"noop"}};
  let deltas=deltasForExistingOfferPlan(plan);
  assert.equal(deltas.logical_field_deltas.last_checked_at_updates,1);
  assert.equal(deltas.row_count_deltas.price_history,0);
  assert.equal(Object.values(deltas.logical_field_deltas).reduce((a,b)=>a+b),1);
  plan.offer.action="update";plan.offer.values.shipping_cost="3.99";plan.offer.values.total_price="16.98";plan.price_history.action="create";
  deltas=deltasForExistingOfferPlan(plan);
  assert.equal(deltas.logical_field_deltas.offer_price_updates,0);
  assert.equal(deltas.logical_field_deltas.offer_shipping_updates,1);
  assert.equal(deltas.logical_field_deltas.offer_total_updates,1);
  assert.equal(deltas.row_count_deltas.price_history,1);
  plan.offer.values.url="https://example.invalid/b";plan.retailer_product.action="update";plan.retailer_product.values.external_url=plan.offer.values.url;
  deltas=deltasForExistingOfferPlan(plan);
  assert.equal(deltas.logical_field_deltas.offer_url_updates,1);assert.equal(deltas.logical_field_deltas.mapping_url_updates,1);
  plan.offer.action="create";assert.throws(()=>deltasForExistingOfferPlan(plan),/INVALID/);
});

test("Discount publication validates the complete existing contract and rejects missing, overlapping or changed evidence", t => {
  const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
  const {loadAndValidateSource}=require("./shared-retailer-automation-review-source");
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"ss-shared-review-test-"));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const input=scope(),fingerprint="a".repeat(64),executionIds=input.targets.slice(0,106).map(row=>row.offer_id);
  const report={result:"PASS_WITH_REVIEW",mode:"dry-run",target:"production",source:{fingerprint},approved_mapping_count:109,
    executable_plan_count:106,executed_plan_count:0,review_row_count:3,blocked_row_count:0,execution_offer_ids:executionIds,
    verification_offer_ids:executionIds,stock_change_offer_ids:[],classification:{VERIFY_NO_CHANGE:106},
    review_rows:input.targets.slice(106).map(row=>({...row,reason:"CANONICAL_IDENTITY_CONFLICT",source_record_evidence:{canonical_identity:{default_variant:true}}}))};
  const diagnostic={result:"PASS",approved_mapping_count:109,source:{fingerprint},classifier_summary:{
    scope:{blocked_rows:0,reconciled:true,reconciled_total:106,scope_row_ids:executionIds},action_counts:report.classification,changed_rows:[],changed_row_ids:[]}};
  const baseline={schema_version:1,kind:"retailer-offer-refresh-db-baseline",result:"PASS",profile:"discount-supplements",
    snapshot:{retailer_id:"4",retailer_name:"Discount Supplements",row_count:109,rows:input.targets.map(row=>({...row,mapping_id:row.retailer_product_id}))}};
  const write=()=>{for(const [name,data] of [["production-dry-run.json",report],["production-preflight-diagnostic.json",diagnostic],["production-db-baseline.json",baseline]])fs.writeFileSync(path.join(directory,name),JSON.stringify(data));};
  write();const source=loadAndValidateSource(directory,"discount-supplements");
  assert.equal(source.changedRows.length,3);assert.ok(source.changedRows.every(row=>row.action==="READ_ONLY_REVIEW"));
  report.execution_offer_ids=[...executionIds.slice(1),report.review_rows[0].offer_id];write();
  assert.throws(()=>loadAndValidateSource(directory,"discount-supplements"),/drifted|overlap|incomplete/);
  report.execution_offer_ids=executionIds;baseline.snapshot.rows[108].external_variant_id="changed";write();
  assert.throws(()=>loadAndValidateSource(directory,"discount-supplements"),/identity drift/);
});

test("admin reader requests one bounded database page at any history size and fails closed on drift or truncation", async () => {
  const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
  const source=fs.readFileSync("app/admin/lib/automationReviewQueueData.ts","utf8");
  let response, calls=0;
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    module:mod,exports:mod.exports,require:name=>{
      if(name==="server-only")return{};
      if(name==="../../lib/supabaseAdmin")return{supabaseAdmin:{rpc:async(name,args)=>{
        calls++;assert.equal(name,"read_automation_review_queue_page_v1");assert.equal(args.p_request.page_size,10);
        assert.equal(args.p_request.capabilities["9"].UPDATE_STOCK,"REVIEW_EXECUTABLE");return{data:response,error:null};}}};
      if(name==="../../lib/automationReviewCapabilityMatrix")return{AUTOMATION_REVIEW_CAPABILITY_MATRIX:[{retailerId:"9",operations:{UPDATE_STOCK:{capability:"REVIEW_EXECUTABLE"}}}]};
      if(name==="./automationReviewQueue")return{REVIEW_QUEUE_PAGE_SIZE:50,REVIEW_QUEUE_WORK_PAGE_SIZE:10};
      throw Error(`Unexpected import ${name}`);
    },Date,Number,Set,Error});
  for(const total of [5000,6694,10000,1000000]){
    response={schema_version:1,revision:"a".repeat(32),revision_changed:false,page:1,page_size:10,total,total_pages:Math.ceil(total/10),
      rows:Array.from({length:10},(_,i)=>({id:i+1,execution_request:null})),retailers:["TEST ONLY"],summary:{decide:total}};
    const result=await mod.exports.loadReviewQueuePage({display:"WORK"},1);
    assert.equal(result.error,null);assert.equal(result.data.rows.length,10);assert.equal(result.data.total,total);
  }
  assert.equal(calls,4);
  response.revision_changed=true;
  assert.match((await mod.exports.loadReviewQueuePage({display:"WORK"},2)).error.message,/zmieniła/);
  response.revision_changed=false;response.rows.pop();
  assert.match((await mod.exports.loadReviewQueuePage({display:"WORK"},1)).error.message,/incomplete/);
  response.rows.push(response.rows[0]);
  assert.match((await mod.exports.loadReviewQueuePage({display:"WORK"},1)).error.message,/invalid/);
});
