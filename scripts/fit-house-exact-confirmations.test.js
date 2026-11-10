const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),vm=require('node:vm'),yaml=require('js-yaml');
const {createRequire}=require('node:module');
const engine=require('./fit-house-offer-refresh');
const {enforceExactConfirmationScope,idsHash,loadExactConfirmationScope}=require('./lib/retailer-offer-sync/exact-confirmation-scope');
const {reconcileApprovedCatalogueScope}=require('./lib/feed-variant-guards');
const {sealArtifact}=require('./lib/retailer-offer-sync/artifacts');
const {buildVerifiedNoChangePlan}=require('./verified-no-change-offer-refresh');
const {migrationBinding}=require('./lib/environment-migrations');
const {sha256}=require('./lib/shopify-snapshot-reader');
const {projectRowManifestOfferSyncState,ROW_MANIFEST_OFFER_SYNC_KEYS}=require('./lib/reviewed-catalogue-state');
const config=require('../config/retailers/fit-house-offer-sync.json'),prior=require('./test-fixtures/retailer-quarantine-captured-evidence-2026-11-09.json');
const ROOT=path.resolve(__dirname,'..'),evidence=loadExactConfirmationScope(ROOT,config);
const NOW=Date.parse('2026-11-10T12:00:00Z'),capturedAt=new Date(NOW-1000).toISOString(),sourceHash='a'.repeat(64);
const state=reconcileApprovedCatalogueScope(engine.loadApprovedManifest().manifest,structuredClone(prior.fit.records));
const delta={row_count_deltas:{products:0,product_variants:0,retailer_products:0,offers:0,price_history:0},
 logical_field_deltas:{offer_price_updates:0,offer_shipping_updates:0,offer_total_updates:0,offer_stock_updates:0,offer_url_updates:0,mapping_url_updates:0,mapping_updated_at_updates:0,last_checked_at_updates:1}};

function fixture(){
 const byId=new Map(state.records.map(r=>[String(r.offer.id),r]));
 const rows=evidence.execution_offer_ids.map(id=>{
  const record=structuredClone(byId.get(id));record.retailer={id:9,name:'Fit House',slug:'fit-house',website:'https://fithouse.uk'};
  // Retained identity fixtures omit nullable label fields; these nulls are test-only, never source evidence.
  for(const [part,keys] of [['product','products'],['variant','product_variants'],['mapping','retailer_products'],['offer','offers']])
   for(const key of ROW_MANIFEST_OFFER_SYNC_KEYS[keys])if(record[part][key]===undefined)record[part][key]=null;
  const bounded=projectRowManifestOfferSyncState({retailer:record.retailer,products:[record.product],product_variants:[record.variant],retailer_products:[record.mapping],offers:[record.offer],price_history:[]});
  Object.assign(record,{product:bounded.products[0],variant:bounded.product_variants[0],mapping:bounded.retailer_products[0],offer:bounded.offers[0]});
  const source={external_product_id:record.mapping.external_product_id,external_variant_id:record.mapping.external_variant_id,
   price:record.offer.price,in_stock:record.offer.in_stock,url:record.offer.url,external_url:record.mapping.external_url};
  const {plan}=buildVerifiedNoChangePlan(engine.verificationRecord(record,source,sourceHash,capturedAt),{
   targetEnvironment:'PRODUCTION',targetProjectRef:evidence.target_project_ref,sourceSnapshotSha256s:new Set([sourceHash]),now:new Date(NOW)});
  return{offer_id:id,action:'VERIFY_NO_CHANGE',changed_fields:{price:false,stock:false,url:false,blocked:false},expected_deltas:structuredClone(delta),atomic_plan:plan};
 });
 const artifacts=engine.balancedExecutionBatches(rows).map(batch=>sealArtifact({rows:batch,expected_deltas:engine.sumDeltas(batch),source_snapshot_fingerprint:sourceHash,source_captured_at:capturedAt,state:'DRY_RUN_READY',block:null}));
 const run={target:'production',spec:{ref:evidence.target_project_ref,identity:evidence.target_database_identity},binding:migrationBinding('PRODUCTION'),
  capturedAt,snapshot:{source_diagnostic:{pagination_completed:true}},isolateUnsafe:true,reviewed:null,
  classification:{state:'DRY_RUN_READY_WITH_REVIEW',rows,quarantined_rows:evidence.review_offer_ids.map(offer_id=>({offer_id}))},artifacts,
  exactConfirmationState:{active:engine.confirmationStateFingerprint(state.records),historical:engine.confirmationStateFingerprint(state.historical_records),mapped_source:evidence.mapped_source_fingerprint}};
 const validations=artifacts.map(artifact=>({request:{artifact:structuredClone(artifact),validation_expires_at:new Date(NOW+14*60000).toISOString()},
  result:{valid:true,status:'DRY_RUN_VALIDATED',row_count:artifact.rows.length}}));
 return{run,validations};
}
function check(f,e=evidence,c=config){return enforceExactConfirmationScope(f.run,e,f.validations,c,NOW);}
function blocked(mutate){const f=fixture();mutate(f);assert.throws(()=>check(f));}

test('owner evidence pins original artifact, exact261 IDs,23 exclusions and unchanged284+2 manifest',()=>{
 assert.equal(evidence.source_evidence.run_id,42692247024);assert.equal(evidence.source_evidence.artifact_id,13707591856);
 assert.equal(evidence.source_evidence.zip_sha256,'36b9fadb3b50d6d3b95b54efa2f018e3d1a5d00d4004fe9179a61289d42485f8');
 assert.equal(idsHash(evidence.execution_offer_ids),'df3f35359365bfadd016b36bbb78098333dc3fb36849e422bd21353ba3bd32fd');
 assert.equal(evidence.execution_count,261);assert.equal(evidence.review_count,23);assert.equal(state.records.length,284);assert.equal(state.historical_records.length,2);
 assert.equal(engine.loadApprovedManifest().sha256,'b25aaafadecb848e08507ba488f34a4b4a84871f67d993d93538eff50600e3b5');
});
test('exact execution authority preserves the installed SQL business-policy fingerprint,not guard changes',()=>{
 const businessConfig={...config};delete businessConfig.exact_confirmation_scope;delete businessConfig.require_exact_confirmation_scope;
 assert.equal(engine.runtimePolicyFingerprint(),sha256({config:businessConfig,effective_guardrails:engine.effectiveOfferPolicy()}));
 const before=engine.runtimePolicyFingerprint(),limit=config.guardrails.maximum_total_oos_ratio;
 try{config.guardrails.maximum_total_oos_ratio=0.36;assert.notEqual(engine.runtimePolicyFingerprint(),before);}finally{config.guardrails.maximum_total_oos_ratio=limit;}
});
test('exact261 native verification plans PASS with14 read-only SQL batches',()=>{
 const f=fixture();assert.equal(f.run.artifacts.length,14);assert.equal(check(f).execution_count,261);
});
test('260,262,replaced and duplicate execution IDs BLOCK',()=>{
 blocked(f=>f.run.artifacts[0].rows.pop());
 blocked(f=>f.run.artifacts[0].rows.push({...f.run.artifacts[0].rows[0],offer_id:'999999'}));
 blocked(f=>f.run.artifacts[0].rows[0].offer_id='999999');
 blocked(f=>f.run.artifacts[0].rows[0].offer_id=f.run.artifacts[0].rows[1].offer_id);
});
test('ID ordering does not change sets, and cannot hide a replacement',()=>{
 const f=fixture();f.run.classification.rows.reverse();f.run.classification.quarantined_rows.reverse();f.run.artifacts.reverse();f.validations.reverse();
 assert.equal(check(f).result,'PASS');
 f.run.artifacts[0].rows[0].offer_id='999999';assert.throws(()=>check(f));
});
test('one stock,price,URL,shipping or catalogue/history change BLOCKS',()=>{
 for(const action of ['UPDATE_STOCK','UPDATE_PRICE','UPDATE_URL'])blocked(f=>{f.run.artifacts[0].rows[0].action=action;});
 for(const field of ['offer_price_updates','offer_stock_updates','offer_shipping_updates','offer_url_updates','mapping_updated_at_updates'])
  blocked(f=>{f.run.artifacts[0].rows[0].expected_deltas.logical_field_deltas[field]=1;});
 blocked(f=>{f.run.artifacts[0].rows[0].expected_deltas.row_count_deltas.price_history=1;});
 blocked(f=>{f.run.artifacts[0].rows[0].expected_deltas.logical_field_deltas.last_checked_at_updates=2;});
 blocked(f=>{f.run.artifacts[0].rows[0].atomic_plan.price_history.action='insert';});
 blocked(f=>{f.run.artifacts[0].rows[0].atomic_plan.retailer_product.action='update';});
 blocked(f=>{f.run.artifacts[0].rows[0].atomic_plan.offer.values.price='999';});
 blocked(f=>{f.run.artifacts[0].expected_deltas.logical_field_deltas.offer_stock_updates=1;});
});
test('review moved to executable,extra classifier rows,missing or replaced review IDs BLOCK',()=>{
 blocked(f=>{f.run.artifacts[0].rows[0].offer_id=evidence.review_offer_ids[0];});
 blocked(f=>{f.run.classification.rows.push({offer_id:'999999',action:'VERIFY_NO_CHANGE'});});
 blocked(f=>f.run.classification.quarantined_rows.pop());
 blocked(f=>{f.run.classification.quarantined_rows[0].offer_id='999999';});
});
test('stale source,changed DB/freshness/historical state and partial-execution replay BLOCK',()=>{
 blocked(f=>{f.run.capturedAt=new Date(NOW-25*3600000).toISOString();});
 blocked(f=>{f.run.snapshot.source_diagnostic.pagination_completed=false;});
 blocked(f=>{f.run.classification.state='BLOCKED';});
 for(const field of ['active','historical','mapped_source'])blocked(f=>{f.run.exactConfirmationState[field]='b'.repeat(64);});
 const changed=structuredClone(state.records);changed[0].offer.last_checked_at=capturedAt;
 blocked(f=>{f.run.exactConfirmationState.active=engine.confirmationStateFingerprint(changed);});
 changed[0].offer.price='999.00';assert.notEqual(engine.confirmationStateFingerprint(changed),evidence.active_state_sha256);
});
test('missing/tampered approval and stale/missing SQL validation BLOCK',()=>{
 assert.throws(()=>check(fixture(),null));
 assert.throws(()=>loadExactConfirmationScope(ROOT,{...config,exact_confirmation_scope:undefined}));
 assert.throws(()=>loadExactConfirmationScope(ROOT,{...config,exact_confirmation_scope:{...config.exact_confirmation_scope,sha256:'0'.repeat(64)}}));
 blocked(f=>{f.validations=[];});blocked(f=>{f.validations[0].result.valid=false;});
 blocked(f=>{f.validations[0].request.validation_expires_at=new Date(NOW-1).toISOString();});
 blocked(f=>{f.validations[0].request.artifact.rows=[];});
});
test('other retailer,target,migration or nonisolated context cannot use this approval',()=>{
 assert.throws(()=>check(fixture(),evidence,{...config,retailer_id:14,retailer_slug:'10reps'}));
 blocked(f=>{f.run.target='staging';});blocked(f=>{f.run.spec.ref='other';});blocked(f=>{f.run.reviewed={};});
 blocked(f=>{f.run.isolateUnsafe=false;});blocked(f=>{f.run.binding.fingerprint='0'.repeat(64);});
});
test('native scope selector cannot silently discard an extra executable row',()=>{
 const f=fixture(),m=engine.loadApprovedManifest().manifest;
 assert.equal(engine.selectApprovedScopeSegment(f.run.classification.rows,f.run.classification,m,evidence.segment).length,261);
 assert.throws(()=>engine.selectApprovedScopeSegment([...f.run.classification.rows,{offer_id:'999999'}],f.run.classification,m,evidence.segment),/extra executable/);
});
test('process gate is mandatory for configured ordinary apply, after SQL and before registration',()=>{
 const source=engine.executeRefresh.toString();
 assert.match(source,/args\.mode==="apply"&&\(config\.require_exact_confirmation_scope===true\|\|config\.exact_confirmation_scope\)/);
 const validation=source.indexOf('await validate(run,diagnostic)'),gate=source.indexOf('diagnostic.exact_confirmation_scope=enforceExactConfirmationScope'),writes=source.indexOf('diagnostic.database_writes_attempted=1'),registration=source.indexOf('await register(run,registration)');
 assert.ok(validation>=0&&gate>validation&&writes>gate&&registration>writes);
 assert.match(source,/if\(run\.artifacts\.length===0\)\{\s*if\(exactScope\)enforceExactConfirmationScope/);
});
test('actual ordinary apply control flow reaches no registration for drift, even without a scope selector',async t=>{
 t.mock.method(Date,'now',()=>NOW);
 const filename=path.join(ROOT,'scripts/fit-house-offer-refresh.js'),source=fs.readFileSync(filename,'utf8');
 async function exercise(f,profileConfig=config){
  const harness={run:f.run,validations:f.validations,registrations:0,validationsCalled:0},runtimeModule={exports:{}};
  const nativeRequire=createRequire(filename),requireForTest=id=>id==='../config/retailers/fit-house-offer-sync.json'?profileConfig:nativeRequire(id);
  const context={module:runtimeModule,exports:runtimeModule.exports,require:requireForTest,__dirname:path.dirname(filename),__filename:filename,
   process:{env:{GITHUB_ACTIONS:'true'}},Buffer,console,Date,setTimeout,clearTimeout,harness};
  // Stub external I/O only. The production executeRefresh and exact gate run unchanged.
  vm.runInNewContext(source+`\n git=()=> 'main'; readState=async()=>({counts:{mappings:286,offers:286}});
   buildRun=async()=>harness.run; validate=async()=>{harness.validationsCalled++;return harness.validations;};
   executionReportContext=()=>({}); registrationRequest=()=>({});
   register=async()=>{harness.registrations++;throw new Error('REGISTRATION_BOUNDARY');};`,context,{timeout:1000});
  let error;try{await runtimeModule.exports.executeRefresh({target:'production',mode:'apply',isolateUnsafe:true},{guard_results:[]});}catch(e){error=e;}
  return{harness,error};
 }
 const ready=await exercise(fixture());assert.equal(ready.error.message,'REGISTRATION_BOUNDARY');assert.equal(ready.harness.registrations,1);
 const missing=await exercise(fixture(),{...config,exact_confirmation_scope:undefined});
 assert.match(missing.error.message,/missing approval evidence/);assert.equal(missing.harness.registrations,0);assert.equal(missing.harness.validationsCalled,0);
 for(const mutate of [f=>f.run.artifacts[0].rows.pop(),f=>{f.run.artifacts[0].rows.push({...f.run.artifacts[0].rows[0],offer_id:'999999'});},
  f=>{f.run.artifacts[0].rows[0].offer_id='999999';},f=>{f.run.artifacts[0].rows[0].action='UPDATE_STOCK';},
  f=>{f.run.artifacts[0].rows[0].atomic_plan.offer.values.price='999';},f=>{f.run.artifacts[0].rows[0].offer_id=evidence.review_offer_ids[0];},
  f=>{f.run.exactConfirmationState.active='0'.repeat(64);},f=>{f.run.capturedAt=new Date(NOW-25*3600000).toISOString();},
  f=>{f.validations[0].result.valid=false;}]){
  const f=fixture();mutate(f);const stopped=await exercise(f);assert.ok(stopped.error);assert.equal(stopped.harness.registrations,0);assert.equal(stopped.harness.validationsCalled,1);
 }
});

const workflow=yaml.load(fs.readFileSync(path.join(ROOT,'.github/workflows/fit-house-offer-refresh.yml'),'utf8'));
const outputs={artifact_id:'1',artifact_digest:'sealed',source_contract_sha256:'bound',review_scope_fingerprint:'scope'};
function enabled(item,operation,retailer='fit-house',event='workflow_dispatch',schedule='47 2 * * *'){
 const needs=Object.fromEntries(['fit-house-offer-refresh','ten-reps-offer-refresh','gladiator-nutrition-offer-refresh'].map(k=>[k,{outputs}]));
 return Boolean(vm.runInNewContext(item.if.replace(/^\$\{\{\s*|\s*\}\}$/g,'').replace(/needs\.([a-z-]+)/g,(_,key)=>`needs["${key}"]`),{github:{ref:'refs/heads/main',event_name:event,event:{schedule}},inputs:{operation,retailer},needs,always:()=>true,success:()=>true},{timeout:1000}));
}
test('exact manual operation runs Fit baseline/apply/postflight/idempotency,never Review Queue or another retailer',()=>{
 assert.ok(workflow.on.workflow_dispatch.inputs.operation.options.includes('apply-exact-confirmations'));
 const fit=workflow.jobs['fit-house-offer-refresh'];assert.equal(enabled(fit,'apply-exact-confirmations'),true);
 for(const key of ['ten-reps-offer-refresh','gladiator-nutrition-offer-refresh','refresh-review-queue','expired-control-plan-recovery'])
  for(const retailer of ['fit-house','10reps','gladiator-nutrition','all'])assert.equal(enabled(workflow.jobs[key],'apply-exact-confirmations',retailer),false,key+retailer);
 for(const name of ['Capture Fit House DB baseline read-only','Apply all approved Fit House offer refresh','Verify Fit House DB postflight read-only','Verify idempotency with a fresh source capture'])
  assert.equal(enabled(fit.steps.find(s=>s.name===name),'apply-exact-confirmations'),true,name);
 assert.equal(enabled(fit.steps.find(s=>s.id==='review_source'),'apply-exact-confirmations'),false);
 assert.match(fit.steps.find(s=>s.name==='Validate protected execution context').run,/test "\$REFRESH_RETAILER" = "fit-house"/);
 assert.match(fit.steps.find(s=>s.name==='Apply all approved Fit House offer refresh').run,/--scope-segment=\$FIT_HOUSE_REFRESH_SCOPE_SEGMENT/);
 assert.equal(enabled(fit,'apply-exact-confirmations','fit-house','schedule'),false);
});
test('ordinary operations keep their job/publication choices and existing permissions',()=>{
 for(const operation of ['dry-run','apply','review-only']){
  assert.equal(enabled(workflow.jobs['fit-house-offer-refresh'],operation),true);
  assert.equal(enabled(workflow.jobs['refresh-review-queue'],operation),operation!=='dry-run');
  assert.equal(enabled(workflow.jobs['ten-reps-offer-refresh'],operation,'10reps'),true);
 }
 assert.deepEqual(workflow.permissions,{contents:'read',actions:'read'});assert.equal(workflow.concurrency.group,'retailer-offer-production-write');
 const ds=require('../config/retailers/discount-supplements-approved-offer-manifest.json');
 const segment=Object.keys(ds.scope_segments)[0],rows=ds.rows.map(row=>({offer_id:String(row.offer_id)}));
 assert.equal(engine.selectApprovedScopeSegment(rows,{quarantined_rows:[]},ds,segment).length,ds.scope_segments[segment].length);
});
