// Historical lifecycle fixtures retain their original v1 contract. The live
// manifest is independently exercised below in a fresh process.
const legacyMembershipPath = require.resolve("../config/retailers/ebay-approved-membership.json");
require.cache[legacyMembershipPath] = { id: legacyMembershipPath, filename: legacyMembershipPath, loaded: true, exports: require("./fixtures/ebay-membership-v1.json") };
const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { canonicalJson } = require("./lib/canonical-json");
const { MEMBERSHIP, SCOPES, LEGACY_SCOPE_SHA256, createMembership, bindMembership, assertArtifactMembership, assertMembershipRows } = require("./lib/ebay-membership");
const manifest = require("../config/retailers/ebay-approved-membership.json");
test("active manifest retains all legacy identities and binds every actual addition across consumers", () => {
  const source = `const assert=require('node:assert/strict');const manifest=require('./config/retailers/ebay-approved-membership.json');const m=require('./scripts/lib/ebay-membership');const legacy=m.createMembership(require('./scripts/fixtures/ebay-membership-v1.json'));assert.deepEqual(m.SCOPES.slice(0,237),legacy.scopes);assert.equal(m.MEMBERSHIP.count,237+manifest.additions.length);assert.equal(m.MEMBERSHIP.version,manifest.version);assert.deepEqual(require('./scripts/ebay-offer-refresh').SCOPES,m.SCOPES);assert.deepEqual(require('./scripts/retailer-offer-refresh-postflight').PROFILES['ebay-uk'].offerIds,m.MEMBERSHIP.offerIds);assert.equal(new Set(m.SCOPES.map(x=>x.offer_id)).size,m.MEMBERSHIP.count);assert.equal(new Set(m.SCOPES.map(x=>x.retailer_product_id)).size,m.MEMBERSHIP.count);for(const x of manifest.additions){assert.equal(Object.hasOwn(x,'source_captured_at'),false);assert.equal(Object.hasOwn(x,'total_price'),false);assert.match(x.owner_artifact_sha256,/^[0-9a-f]{64}$/);assert.match(x.import_readback_sha256,/^[0-9a-f]{64}$/);assert.equal(new URL(x.affiliate_url).searchParams.get('var')||'0',x.external_variant_id.split('|')[2]);assert.equal(require('./scripts/ebay-offer-refresh').classifyContinuity(x,{item_id:x.external_variant_id,legacy_item_id:x.external_product_id,affiliate_ready:true,affiliate_url:x.affiliate_url,seller:{username:x.seller_username,account_type:"BUSINESS"},returned_gtin:x.continuity_policy.returned_gtin,blockers:x.continuity_policy.blockers,review_reasons:x.continuity_policy.review_reasons}).eligible,true);}if(manifest.version>1)assert.throws(()=>m.assertArtifactMembership({approved_mapping_count:237,membership_version:1,membership_fingerprint:legacy.fingerprint}),/membership/);require('./scripts/automation-review-ebay-worker');require('./scripts/automation-review-reconciliation-dry-run');require('./scripts/automation-reliability-watchdog');require('./scripts/ebay-refresh-evidence-sealer');`;
  const result=spawnSync(process.execPath,["-"],{input:source,cwd:require("node:path").resolve(__dirname,".."),encoding:"utf8",windowsHide:true});
  assert.equal(result.status,0,result.error?.message||result.stderr);
});
function addition(index) {
  // Synthetic only. Never persisted as active or presented as production IDs.
  const item = String(900000000000 + index), variation = String(800000000000 + index);
  return { ...SCOPES[0], retailer_product_id: String(900000 + index), offer_id: String(800000 + index), product_id: String(700000 + index), product_variant_id: String(600000 + index), external_product_id: item, external_variant_id: `v1|${item}|${variation}`, external_url: `https://www.ebay.co.uk/itm/${item}?var=${variation}`, affiliate_url:`https://www.ebay.co.uk/itm/${item}?var=${variation}&campid=0000000000&mkevt=1&mkcid=1`, seller_username: "synthetic_seller", owner_artifact_sha256: "a".repeat(64), import_readback_sha256: "b".repeat(64) };
}
function future(count) { return { ...manifest, version: 2, additions: Array.from({ length: count }, (_,index) => addition(index)) }; }
function sourceRows(membership) { return membership.scopes.map(s => ({ offer_id:s.offer_id,mapping_id:s.retailer_product_id,retailer_id:s.retailer_id,product_id:s.product_id,product_variant_id:s.product_variant_id,external_product_id:s.external_product_id,external_variant_id:s.external_variant_id })); }
test("membership preserves all frozen legacy fields and identities independently of availability", () => {
  assert.equal(MEMBERSHIP.count, 237);
  assert.equal(crypto.createHash("sha256").update(canonicalJson(SCOPES)).digest("hex"), LEGACY_SCOPE_SHA256);
  assert.deepEqual(require("./ebay-offer-refresh").SCOPES, SCOPES);
  assert.ok(Object.isFrozen(SCOPES[0]));
  assert.equal(createMembership(manifest).fingerprint, MEMBERSHIP.fingerprint);
  assertMembershipRows(sourceRows(MEMBERSHIP).map(row => ({ ...row, in_stock:false, source_error:"SOURCE_READ_FAILED" })));
});
test("extension supports 323 and a smaller approved scope without changing active membership", () => {
  for (const added of [86, 3]) {
    const extended = createMembership(future(added));
    assert.equal(extended.count, 237+added);
    assertMembershipRows(sourceRows(extended), "source", extended);
    assert.notEqual(extended.fingerprint, MEMBERSHIP.fingerprint);
    assertArtifactMembership(bindMembership({ approved_mapping_count:extended.count },extended),extended);
  }
  assert.equal(MEMBERSHIP.count,237);
});
test("unresolved readback, native collisions, changed legacy binding and duplicate mapping fail closed", () => {
  for (const mutate of [s=>{s.offer_id=null;},s=>{s.import_readback_sha256=null;},s=>{s.owner_artifact_sha256=null;},s=>{s.external_variant_id=SCOPES[0].external_variant_id;},s=>{s.retailer_product_id=SCOPES[0].retailer_product_id;},s=>{s.product_variant_id=SCOPES[0].product_variant_id;},s=>{s.external_url="https://www.ebay.co.uk/itm/1";},s=>{s.seller_username="";}]) {
    const m=future(1);mutate(m.additions[0]);assert.throws(()=>createMembership(m));
  }
  assert.throws(()=>createMembership({...future(1),version:1}),/new version/);
  const changed=JSON.parse(JSON.stringify(SCOPES));changed[0].product_variant_id="123";
  assert.throws(()=>createMembership(manifest,changed),/Frozen Exact-237/);
});
test("wrong artifact membership and unapproved canonical/native rows are rejected", () => {
  assertArtifactMembership({approved_mapping_count:237}); // Historical Exact-237.
  for(const value of [{...bindMembership(),membership_version:2},{...bindMembership(),membership_fingerprint:"0".repeat(64)},{membership_version:1}]) assert.throws(()=>assertArtifactMembership(value),/membership/);
  assert.throws(()=>assertArtifactMembership({approved_mapping_count:237},createMembership(future(1))),/membership/);
  for(const key of ["mapping_id","offer_id","product_variant_id","external_variant_id"]){const rows=sourceRows(MEMBERSHIP);rows[0][key]="unapproved";assert.throws(()=>assertMembershipRows(rows),/membership/);}
});
test("future scope reaches existing refresh, postflight, loader and worker through the same module", () => {
  for(const added of [86,3]) {
    const script=`const assert=require('node:assert/strict');const file=require.resolve('./config/retailers/ebay-approved-membership.json');require.cache[file]={id:file,filename:file,loaded:true,exports:${JSON.stringify(future(added))}};const m=require('./scripts/lib/ebay-membership');const refresh=require('./scripts/ebay-offer-refresh');const p=require('./scripts/retailer-offer-refresh-postflight');assert.equal(refresh.SCOPES.length,${237+added});assert.equal(p.PROFILES['ebay-uk'].approvedMappingCount,${237+added});assert.deepEqual(p.approvedOfferIds(p.PROFILES['ebay-uk']),m.MEMBERSHIP.offerIds);require('./scripts/automation-review-ebay-worker');require('./scripts/automation-review-reconciliation-dry-run');require('./scripts/automation-reliability-watchdog');require('./scripts/ebay-refresh-evidence-sealer');const c=require('./scripts/lib/ebay-artifact-bound-contract');const rows=c.buildSemanticSourceRows(refresh.SCOPES,[]);m.assertMembershipRows(rows);const report=c.bindSemanticEvidence({approved_mapping_count:m.MEMBERSHIP.count,execution_offer_ids:[],review_rows:rows.map(r=>({offer_id:r.offer_id})),expected_deltas:{}},rows,{executable:[],review:[],blocked:[]});m.assertArtifactMembership(report);assert.equal(report.membership_version,2);assert.equal(report.membership_fingerprint,m.MEMBERSHIP.fingerprint);assert.equal(m.MEMBERSHIP.count,${237+added});`;
    const result=spawnSync(process.execPath,["-"],{input:script,cwd:require("node:path").resolve(__dirname,".."),encoding:"utf8",windowsHide:true});
    assert.equal(result.status,0,result.error?.message || result.stderr);
  }
});
test("future exact seller drift remains isolated and affiliate offer URL stays intact", () => {
  const refresh=require("./ebay-offer-refresh");const scope=addition(1);
  const evaluation={item_id:scope.external_variant_id,legacy_item_id:scope.external_product_id,affiliate_ready:true,affiliate_url:scope.affiliate_url,seller:{username:"other_seller",account_type:"BUSINESS"},blockers:[],review_reasons:[],returned_gtin:scope.gtin,decision:"AUTO_ELIGIBLE"};
  assert.equal(refresh.classifyContinuity(scope,evaluation).eligible,false);
  evaluation.seller.username=scope.seller_username;
  Object.assign(evaluation,{item_price:{value:12,currency:"GBP"},uk_shipping:{value:0,currency:"GBP"},delivered_price:{value:12,currency:"GBP"}});
  assert.equal(refresh.classifyContinuity(scope,evaluation).eligible,true);
  const row=refresh.rowFromEvaluation(scope,evaluation);
  assert.equal(row.affiliate_url,scope.affiliate_url);
  assert.equal(require("./import-products").getOfferUrl(row),scope.affiliate_url);
});
test("reviewed extension continuity is data bound and rejects changed GTIN, seller or unexplained evidence", () => {
  const scope=addition(3);scope.continuity_policy={returned_gtin:null,blockers:[],review_reasons:["RETURNED_GTIN_UNPROVEN"]};
  const membership=createMembership({...future(0),additions:[scope]});
  const evaluation={item_id:scope.external_variant_id,legacy_item_id:scope.external_product_id,affiliate_ready:true,affiliate_url:scope.affiliate_url,seller:{username:scope.seller_username,account_type:"BUSINESS"},blockers:[],review_reasons:["RETURNED_GTIN_UNPROVEN"],returned_gtin:null};
  const {classifyContinuity}=require("./ebay-offer-refresh");
  assert.equal(classifyContinuity(membership.scopes.at(-1),evaluation).eligible,true);
  for(const changed of [{...evaluation,seller:{username:"changed",account_type:"BUSINESS"}},{...evaluation,returned_gtin:"changed"},{...evaluation,blockers:["SIZE_MISMATCH"]}]) assert.equal(classifyContinuity(scope,changed).eligible,false);
  const altered=structuredClone(scope);altered.continuity_policy.review_reasons.push("SIZE_UNPROVEN");
  assert.notEqual(createMembership({...future(0),additions:[altered]}).fingerprint,membership.fingerprint);
});
test("legacy native drift stays review-only while new members and canonical bindings remain exact", () => {
  const m=createMembership(future(1));
  const rows=m.scopes.map(s=>({offer_id:s.offer_id,mapping_id:s.retailer_product_id,retailer_id:s.retailer_id,mapping_product_id:s.product_id,mapping_variant_id:s.product_variant_id,offer_product_id:s.product_id,offer_variant_id:s.product_variant_id,external_product_id:s.external_product_id,external_variant_id:s.external_variant_id}));
  const reviewed=[
    ["2637","352221379935","v1|352221379935|0"],
    ["2638","277793153663","v1|277793153663|0"],
    ["2681","167879148689","v1|167879148689|467421651917"],
    ["2708","134979308772","v1|134979308772|0"],
    ["2770","146086688061","v1|146086688061|445043246476"],
  ];
  const migration=require("node:fs").readFileSync(require("node:path").resolve(__dirname,"../supabase/migrations/20260905170000_apply_reviewed_ebay_26_remediation.sql"),"utf8");
  for(const[id,item,native]of reviewed){assert.ok(migration.includes(`${id},'${item}','${native}'`));Object.assign(rows.find(r=>r.offer_id===id),{external_product_id:item,external_variant_id:native});}
  assert.throws(()=>assertMembershipRows(rows,"database",m),/identity mismatch/);
  assertMembershipRows(rows,"database",m,{deferLegacyNativeDrift:true});
  assertMembershipRows(rows,"database",m,{reviewOfferIds:reviewed.map(r=>r[0])});
  for(const[id]of reviewed)assert.throws(()=>assertMembershipRows(rows,"database",m,{reviewOfferIds:reviewed.map(r=>r[0]).filter(other=>other!==id)}),/identity mismatch/);
  const known=rows.find(r=>r.offer_id==="2637"),originalNative=known.external_variant_id;
  known.external_variant_id="v1|999999999999|0";
  assert.throws(()=>assertMembershipRows(rows,"database",m,{deferLegacyNativeDrift:true}),/identity mismatch/);
  known.external_variant_id=originalNative;
  rows[0].external_variant_id="v1|999999999999|0";
  assert.throws(()=>assertMembershipRows(rows,"database",m,{deferLegacyNativeDrift:true}),/identity mismatch/);
  assert.throws(()=>assertMembershipRows(rows,"database",m,{reviewOfferIds:rows.map(r=>r.offer_id)}),/identity mismatch/);
  rows[0].external_variant_id=m.scopes[0].external_variant_id;
  rows[0].mapping_variant_id="changed";
  assert.throws(()=>assertMembershipRows(rows,"database",m,{deferLegacyNativeDrift:true}),/identity mismatch/);
  rows[0].mapping_variant_id=m.scopes[0].product_variant_id;
  rows.at(-1).external_variant_id="v1|999999999999|0";
  assert.throws(()=>assertMembershipRows(rows,"database",m,{deferLegacyNativeDrift:true}),/identity mismatch/);
});

async function syntheticMaintenanceScenario(inputManifest) {
  const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
  process.chdir(path.resolve(process.cwd(),".."));
  const file=require.resolve("../config/retailers/ebay-approved-membership.json");
  require.cache[file]={id:file,filename:file,loaded:true,exports:inputManifest};
  const {MEMBERSHIP,SCOPES,bindMembership}=require("./lib/ebay-membership");
  const refresh=require("./ebay-offer-refresh"),contract=require("./lib/ebay-artifact-bound-contract"),postflight=require("./retailer-offer-refresh-postflight"),{seal}=require("./ebay-refresh-evidence-sealer");
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"ebay-future-maintenance-"));
  const now=new Date("2026-11-27T12:00:00.000Z"),beforeTime="2026-11-27T11:00:00.000Z",afterTime=now.toISOString();
  const env={GITHUB_ACTIONS:"true",GITHUB_EVENT_NAME:"schedule",GITHUB_REF:"refs/heads/main",GITHUB_RUN_ID:"123",GITHUB_RUN_ATTEMPT:"1",GITHUB_SHA:"a".repeat(40)};
  process.env.GITHUB_SHA=env.GITHUB_SHA;
  global.fetch=()=>{throw Error("Network forbidden in synthetic maintenance regression");};
  const evaluations=new Map(),plans=new Map(),rows=[];
  for(const scope of SCOPES){
    const price=String(scope.price),shipping=String(scope.shipping_cost),total=(Number(price)+Number(shipping)).toFixed(2);
    const mapping={id:scope.retailer_product_id,retailer_id:"12",product_id:scope.product_id,product_variant_id:scope.product_variant_id,external_product_id:scope.external_product_id,external_variant_id:scope.external_variant_id,external_sku:scope.external_sku||null,external_gtin:scope.gtin,external_options:JSON.parse(scope.external_options||"{}"),external_url:scope.external_url};
    const offer={id:scope.offer_id,product_id:scope.product_id,product_variant_id:scope.product_variant_id,retailer_id:"12",retailer_product_id:scope.retailer_product_id,price,shipping_cost:shipping,total_price:total,in_stock:true,url:scope.affiliate_url,last_checked_at:beforeTime};
    rows.push({mapping_id:mapping.id,retailer_id:"12",mapping_product_id:mapping.product_id,mapping_variant_id:mapping.product_variant_id,external_product_id:mapping.external_product_id,external_variant_id:mapping.external_variant_id,external_sku:mapping.external_sku,external_gtin:mapping.external_gtin,external_options:mapping.external_options,external_url:mapping.external_url,offer_id:offer.id,offer_product_id:offer.product_id,offer_variant_id:offer.product_variant_id,price,shipping_cost:shipping,total_price:total,in_stock:true,url:offer.url,last_checked_at:beforeTime});
    if(!scope.import_readback_sha256){evaluations.set(scope.offer_id,{item_id:scope.external_variant_id,legacy_item_id:scope.external_product_id,decision:"NOT_FOUND",blockers:["SOURCE_READ_FAILED"],review_reasons:[],returned_gtin:null,source_error:"SOURCE_READ_FAILED",source_failure_scope:"ROW",continuity:{eligible:false,tier:"blocked"}});continue;}
    evaluations.set(scope.offer_id,{item_id:scope.external_variant_id,legacy_item_id:scope.external_product_id,decision:"AUTO_ELIGIBLE",blockers:[],review_reasons:[],returned_gtin:scope.gtin,seller:{username:scope.seller_username,account_type:"BUSINESS"},affiliate_ready:true,affiliate_url:scope.affiliate_url,item_price:{value:Number(price),currency:"GBP"},uk_shipping:{value:Number(shipping),currency:"GBP"},delivered_price:{value:Number(total),currency:"GBP"}});
    plans.set(scope.offer_id,{product:{action:"existing",id:scope.product_id},product_variant:{action:"existing",id:scope.product_variant_id},retailer:{action:"existing",id:"12"},retailer_product:{action:"noop",id:mapping.id},offer:{action:"verify_no_change",id:offer.id,values:{price,shipping_cost:shipping,total_price:total,in_stock:true,url:offer.url,last_checked_at:afterTime}},price_history:{action:"noop"},expected_state:{retailer_product:mapping,offer}});
  }
  try{
    const report=await refresh.run({target:"production",mode:"dry-run"},{config:{},token:"synthetic-token",evaluations,outDir:directory,now,env,runImportRows:async([row])=>{const scope=SCOPES.find(s=>s.external_variant_id===row.external_variant_id);return{report:{approvedRows:[{importPlan:plans.get(scope.offer_id)}]}};},writeDryRunArtifact:(_rows,result)=>({artifact:{blocked_rows:[],plans:[{plan_kind:"feed",operation_type:"verify_offer_no_change",retailer_id:"12",resolved_plan:result.report.approvedRows[0].importPlan}]},artifactSha256:"a".repeat(64)})});
    assert.equal(report.approved_mapping_count,MEMBERSHIP.count);assert.equal(report.executable_plan_count,inputManifest.additions.length);assert.equal(report.review_row_count,237);assert.equal(report.blocked_row_count,0);
    const emitted=contract.writeDryRunContract(directory,report,env,now);
    const approved={runId:env.GITHUB_RUN_ID,commitSha:env.GITHUB_SHA,manifestSha256:emitted.manifestSha256,reportSha256:emitted.reportSha256,fullCaptureFingerprint:report.full_capture_fingerprint,executableSourceFingerprint:report.executable_source_fingerprint,reviewScopeFingerprint:report.review_scope_fingerprint,planFingerprint:report.plan_fingerprint};
    const loaded=contract.loadAndVerifyContract(directory,approved,new Date(now.getTime()+1000));
    const snapshot={row_count:rows.length,rows,price_history_count:0,business_price_history_count:0,daily_confirmation_count:0};
    const baseline={...bindMembership(),schema_version:1,kind:"retailer-offer-refresh-db-baseline",result:"PASS",profile:"ebay-uk",snapshot};baseline.evidence_hash=postflight.baselineHash(baseline);
    contract.verifyDatabaseBaseline(loaded,baseline);
    const apply={...report,mode:"execute-apply",executed_plan_count:report.executable_plan_count,manifest_sha256:emitted.manifestSha256};
    const executionIds=new Set(apply.execution_offer_ids),after={...snapshot,rows:rows.map(row=>({...row,last_checked_at:executionIds.has(row.offer_id)?afterTime:beforeTime}))};
    const checked=postflight.verifyPostflight(baseline,after,apply);
    const freshPlans=structuredClone(report.semantic_plan_rows);for(const row of freshPlans.executable)row.before_state.offer.last_checked_at=afterTime;
    const idempotency=contract.bindSemanticEvidence({...report},report.semantic_source_rows,freshPlans);
    const evidence=seal({apply,baseline,postflight:checked,idempotency,env});
    require('./automation-reliability-watchdog').validateEbayApplyArtifacts({run:{event:env.GITHUB_EVENT_NAME,head_sha:env.GITHUB_SHA,conclusion:'success'},artifact:{digest:'sha256:'+'a'.repeat(64)},files:[{name:'production-apply.json',json:apply},{name:'production-db-postflight.json',json:checked,sha256:'b'.repeat(64)}]});
    assert.equal(evidence.approved_mapping_count,MEMBERSHIP.count);assert.equal(evidence.idempotency_result,"PASS");assert.equal(checked.freshness_change_count,inputManifest.additions.length);
    console.log(JSON.stringify({count:MEMBERSHIP.count,executed_synthetic_only:checked.freshness_change_count,review_only:report.review_row_count,real_database_writes:0,network_calls:0}));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test("323 and 240 traverse existing refresh, artifact loader, DB contract, postflight and sealer locally",()=>{
  for(const added of [86,3]){
    const source=`(${syntheticMaintenanceScenario.toString()})(${JSON.stringify(future(added))}).catch(e=>{console.error(e.stack);process.exitCode=1;})`;
    const result=spawnSync(process.execPath,["-"],{input:source,cwd:__dirname,encoding:"utf8",windowsHide:true});
    assert.equal(result.status,0,result.error?.message||result.stderr);
  }
});
