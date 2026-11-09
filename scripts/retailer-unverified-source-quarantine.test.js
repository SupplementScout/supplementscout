const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const evidence = require('./test-fixtures/retailer-quarantine-captured-evidence-2026-11-09.json');
const six = require('./six-pack-offer-refresh');
const fit = require('./fit-house-offer-refresh');
const { commercialIdentity, liveIdentityDrift } = require('./six-pack-canary-builder');
const { assessVariantCompatibility, parseSize, sizeKey, catalogueScopeBindings, reconcileApprovedCatalogueScope } = require('./lib/feed-variant-guards');
const { parsePhysicalSize, parseCount } = require('./lib/reviewed-catalogue-v3');
const { validateCanonicalIdentityEvidence } = require('./lib/reviewed-catalogue-canonical-evidence');
const { classifyExistingOffers } = require('./lib/retailer-offer-sync/classifier');
const { loadDryRunArtifact } = require('./import-products');
const executor = require('./six-pack-offer-refresh-executor');
const sixApproved = six.loadApprovedManifest(), fitApproved = fit.loadApprovedManifest();
const config = require('../config/retailers/fit-house-offer-sync.json');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function loadExistingTs(file) {
  const filename = path.resolve(file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:filename,
  }).outputText,filename);
  return mod.exports;
}

test('all115 retained incidents retain the global comparator result and reuse existing dimensional checks', () => {
  assert.equal(evidence.six.errors.length,115);
  assert.equal(hash(evidence.six.errors),'4ef2e73677a57ed88c131dbd9ede29cb215d76b680216cd1c3709bb5e1500c19');
  const counts={equal_size_and_words:0,equal_size_ambiguous_name:0,missing_size:0,missing_servings:0,pack_conflict:0};
  for(const e of evidence.six.errors){
    const {csv_product_name:left,live_product_name:right}=e.identity;
    assert.ok(liveIdentityDrift({source_record_id:e.external_variant_id,product_name:left},{product_name:right}));
    const a=commercialIdentity(left),b=commercialIdentity(right);
    const compatibility=assessVariantCompatibility({product_name:right},{name:left});
    if(compatibility.reasons.includes('size conflict')||compatibility.reasons.includes('pack-count conflict'))counts.pack_conflict++;
    else if(!b.tokens.length)counts.missing_size++;
    else if(JSON.stringify(a.tokens)===JSON.stringify(b.tokens)){
      assert.equal(sizeKey(parseSize(left)),sizeKey(parseSize(right)));
      counts[JSON.stringify(a.name_tokens)===JSON.stringify(b.name_tokens)?'equal_size_and_words':'equal_size_ambiguous_name']++;
    }else counts.missing_servings++;
  }
  assert.deepEqual(counts,{equal_size_and_words:24,equal_size_ambiguous_name:18,missing_size:66,missing_servings:3,pack_conflict:4});
  assert.deepEqual(parsePhysicalSize('2kg'),{size_value:'2000',size_unit:'g'});
  assert.deepEqual(parseCount('17 servings'),{count_value:'17',count_unit:'servings'});
  assert.equal(validateCanonicalIdentityEvidence(null,{}),null);
});

test('existing reviewed nutrition and pricing do not manufacture a live17-serving fact from510g', () => {
  const {getEffectiveNutritionMetrics}=loadExistingTs('app/lib/nutritionMetrics.ts');
  const {getDeliveredPrice,getVerifiedPricePerServing}=loadExistingTs('app/lib/pricing.ts');
  const r=evidence.six.records.find(r=>String(r.mapping.id)==='2235');
  const canonical=getEffectiveNutritionMetrics(r.product,r.variant);
  assert.equal(canonical.serving_count_verified,17);
  assert.equal(canonical.serving_size_g,30); assert.equal(canonical.net_weight_g,510);
  assert.equal(getVerifiedPricePerServing(getDeliveredPrice({price:'10.00',shipping_cost:'0.00'}),null),null);
  assert.equal(getEffectiveNutritionMetrics(r.product,{...r.variant,size_value:1000}).serving_count_verified,null);
  assert.ok(liveIdentityDrift({source_record_id:'31617',product_name:'Reflex Nutrition Clear Whey Isolate 510g 17 Servings'},
    {product_name:'Clear Whey Isolate 510g - Reflex Nutrition'}));
});

test('real artifact replay accounts all504 and284 without inventing missing commercial source rows', () => {
  const fitState=reconcileApprovedCatalogueScope(fitApproved.manifest,structuredClone(evidence.fit.records));
  assert.equal(fitState.records.length,284);assert.equal(fitState.historical_records.length,2);
  assert.equal(evidence.fit.source.pagination_completed,true);assert.equal(evidence.fit.source.product_count,231);
  assert.equal(evidence.fit.source.normalised_count,326);assert.equal(evidence.fit.missing.length,4);
  const sourceQuarantine=evidence.six.isolated_mapping_ids.length;
  assert.equal(sourceQuarantine,14);
  const result={mode:'PARTIAL_CAPTURED_EVIDENCE_REPLAY',commercial_rows_reconstructed:0,
    six:{active:504,historical:2,commercial_verified:0,previous_source_review_only:14,confirmed_unit_conflicts:4,
      insufficient_source_rows:486,executable_plans:0,normalization:'BLOCK_REAL_UNIT_CONFLICTS_AND_INCOMPLETE_REPLAY_INPUT'},
    fit:{active:284,historical:2,confirmed_missing_variant_ids:evidence.fit.missing.map(r=>r.external_variant_id),
      source_rows_not_retained:280,full_classifier:'NOT_REPLAYABLE_WITH_RETAINED_INPUT',executable_plans:0},
    missing:{six:evidence.six.missing_evidence,fit:evidence.fit.missing_evidence}};
  assert.equal(result.six.commercial_verified+result.six.previous_source_review_only+result.six.confirmed_unit_conflicts+result.six.insufficient_source_rows,504);
  const dir=path.resolve('tmp/quarantine-repair');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'real-offline-replay.json'),JSON.stringify(result,null,2)+'\n');
});

function targets(records){return records.map(r=>({offer_id:String(r.offer.id),retailer_product_id:String(r.mapping.id),
  external_product_id:String(r.mapping.external_product_id),external_variant_id:String(r.mapping.external_variant_id),
  external_sku:r.mapping.external_sku||null,price:r.offer.price,shipping_cost:r.offer.shipping_cost,total_price:r.offer.total_price,
  in_stock:r.offer.in_stock,url:r.offer.url,external_url:r.mapping.external_url,last_checked_at:r.offer.last_checked_at}));}
function fitContract(){
  const state=reconcileApprovedCatalogueScope(fitApproved.manifest,structuredClone(evidence.fit.records));
  const absent=new Set(evidence.fit.missing.map(r=>r.mapping_id));
  // CONTRACT FIXTURE ONLY: other source rows are injected, not reconstructed
  // from the absent latest Shopify payload or counted as live VERIFIED rows.
  const source=state.records.filter(r=>!absent.has(String(r.mapping.id))).map(r=>({
    external_product_id:String(r.mapping.external_product_id),external_variant_id:String(r.mapping.external_variant_id),
    external_sku:r.mapping.external_sku||null,product_handle:new URL(r.mapping.external_url).pathname.split('/')[2],
    price:r.offer.price,shipping_cost:r.offer.shipping_cost,total_price:r.offer.total_price,in_stock:r.offer.in_stock,
  }));
  return{state,source};
}
function classifyFit(state,source,options={}){return classifyExistingOffers({targets:targets(state.records),sourceVariants:source,
  policy:{...config.guardrails,store_url:config.store_url,ignore_source_sku:true},sourceCapturedAt:new Date().toISOString(),
  sourceProductCount:231,previousSourceProductCount:207,quarantineUnsafeRows:true,...options});}

test('Fit full284+2 routes exactly four unknown absences to existing quarantine without OOS or replay1859', () => {
  const {state,source}=fitContract(),before=structuredClone(state),audited=fit.loadAuditedMissingVariantManifest();
  const reconciled=fit.reconcileAuditedMissingVariants(state.records,source,audited,state.historical_records,{isolateUnsafe:true,sourceComplete:true});
  assert.equal(audited.manifest.rows.length,78);assert.equal(reconciled.sourceVariants.length,280);
  assert.equal(reconciled.newUnavailableCount,0);assert.equal(reconciled.missingVariantIds.length,0);
  assert.deepEqual(new Set(reconciled.reviewOnlyMissingVariantIds),new Set(evidence.fit.missing.map(r=>r.external_variant_id)));
  const c=classifyFit(state,reconciled.sourceVariants);
  assert.equal(c.state,'DRY_RUN_READY_WITH_REVIEW');assert.equal(c.rows.length,280);assert.equal(c.quarantined_rows.length,4);
  for(const row of c.quarantined_rows){
    assert.equal(row.reason,'SOURCE_VARIANT_MISSING');assert.equal(row.source,null);
    assert.deepEqual(row.changed_fields,{price:false,stock:false,url:false,blocked:true});
    assert.equal(fit.reviewReportRow(row).proposed_offer,null);
    assert.ok(c.rows.every(r=>r.offer_id!==row.offer_id));
  }
  assert.equal(state.records.find(r=>String(r.offer.id)==='1859').offer.in_stock,false);
  assert.deepEqual(fit.durableAutomationReviewStockTransitions({records:state.records,automationReviews:evidence.fit.reviews,
    automationReviewExecutions:evidence.fit.executions}),[{offer_id:'1859',before_in_stock:true,after_in_stock:false,oos_delta:1}]);
  assert.equal(fit.approvedStableOosBaseline().count,104);
  assert.deepEqual(evidence.fit.guard_results.find(r=>r.guard==='FIT_HOUSE_APPROVED_STABLE_OOS_BASELINE').durable_automation_review_stock_transitions.map(r=>r.offer_id),['697','983','1859','1982']);
  assert.doesNotThrow(()=>fit.requireAuditedMissingOwnerApproval(audited,reconciled,c,null));assert.deepEqual(state,before);
});

test('Fit rejects incomplete capture/non-isolated absence and keeps wrong-parent and aggregate guards', () => {
  const {state,source}=fitContract(),audit=fit.loadAuditedMissingVariantManifest();
  for(const options of [{},{isolateUnsafe:true},{isolateUnsafe:true,sourceComplete:false},{isolateUnsafe:false,sourceComplete:true}])
    assert.throws(()=>fit.reconcileAuditedMissingVariants(state.records,source,audit,state.historical_records,options),{code:'IDENTITY_DRIFT'});
  const conflicting=structuredClone(source);conflicting[0].external_product_id='999999';
  assert.equal(classifyFit(state,conflicting).reason,'IDENTITY_DRIFT');
  assert.equal(classifyFit(state,source,{sourceProductCount:1}).reason,'SOURCE_COLLAPSE');
  const changed=structuredClone(source);for(const r of changed)r.in_stock=false;
  assert.equal(classifyFit(state,changed).reason,'MASS_OOS');
  const historical=structuredClone(state);historical.historical_records[0].product.is_active=true;
  assert.throws(()=>fit.reconcileAuditedMissingVariants(historical.records,source,audit,historical.historical_records,{isolateUnsafe:true,sourceComplete:true}));
});

function sixContract(){
  const manifest=sixApproved.manifest,historical=new Map(manifest.historical_withdrawn_rows.map(r=>[r.mapping_id,r]));
  const now=new Date().toISOString(),byProduct=new Map();
  const records=catalogueScopeBindings(manifest).map((b,i)=>{
    const decision=historical.get(b.mapping_id),simple=b.external_product_id===b.external_variant_id;
    const name=`Contract product ${b.external_product_id} 100g`,url=`https://6pack-supplements.co.uk/product/contract-${b.external_product_id}/`;
    const r={retailer:{id:11,name:'6 Pack Supplements',slug:'6-pack-supplements',website:'https://6pack-supplements.co.uk'},
      product:{id:b.canonical_product_id,name,product_format:'powder',is_active:!decision,merged_into_product_id:null,
        ...(decision?{owner_withdrawal_state:decision.withdrawal_state,owner_withdrawal_reason:decision.decision_reference,owner_withdrawn_at:now}:{})},
      variant:{id:b.canonical_variant_id,product_id:b.canonical_product_id,is_active:!decision,is_default:simple,
        variant_key:simple?'default':`flavour-${i}`,display_name:simple?'Default':`Flavour ${i}`,flavour_code:simple?null:`flavour-${i}`,flavour_label:simple?null:`Flavour ${i}`,size_value:100,size_unit:'g',pack_count:1,product_format:'powder'},
      mapping:{id:b.mapping_id,retailer_id:11,product_id:b.canonical_product_id,product_variant_id:b.canonical_variant_id,
        external_product_id:b.external_product_id,external_variant_id:b.external_variant_id,external_name:name,external_url:url,
        external_sku:null,external_gtin:null,external_options:{},external_slug:`contract-${i}`,match_method:'slug',match_confidence:90,updated_at:now},
      offer:{id:b.offer_id,retailer_id:11,retailer_product_id:b.mapping_id,product_id:b.canonical_product_id,product_variant_id:b.canonical_variant_id,
        price:'10.00',shipping_cost:'4.99',total_price:'14.99',in_stock:true,url,last_checked_at:now}};
    let page=byProduct.get(b.external_product_id);
    if(!page){page={external_product_id:b.external_product_id,product_name:name,canonical_url:url,product_offer:null,variations:[],html_sha256:hash(b.external_product_id),html_bytes:100};byProduct.set(b.external_product_id,page);}
    if(simple)page.product_offer={price:'10.00',in_stock:true};
    else page.variations.push({external_variant_id:b.external_variant_id,price:'10.00',in_stock:true,active:true,purchasable:true});
    return r;
  });
  const paths=()=>{const key=crypto.randomUUID();return{artifact:path.resolve('tmp/six-pack-offer-refresh-tests/'+key+'.json'),report:path.resolve('tmp/six-pack-offer-refresh-tests/'+key+'-report.json')};};
  const readLive=async(id,ctx)=>{
    const page=structuredClone(byProduct.get(id));page.captured_at=ctx.capturedAt;
    page.source_provenance={request_url:`https://6pack-supplements.co.uk/?p=${id}`,response_url:page.canonical_url,
      http_status:200,content_type:'text/html',body_complete:true,html_sha256:page.html_sha256,html_bytes:page.html_bytes};
    page.technical_document_identity={product_id:id,canonical_url:page.canonical_url,html_sha256:page.html_sha256};
    return page;
  };
  return{records,byProduct,paths,readLive};
}

test('Six full504+2 reuses missing-source quarantine at variant granularity, with no commercial apply', async () => {
  const s=sixContract(),record=s.records.find(r=>r.mapping.id==='2235');record.mapping.external_name+=' 17 servings';
  const before=structuredClone(s.records),calls=[],out=s.paths();
  const result=await six.run({target:'production',...out,isolateUnsafe:true},{state:{records:s.records},readLive:async(id,ctx)=>{calls.push(id);return s.readLive(id,ctx);}});
  assert.equal(calls.length,277);assert.ok(!calls.includes('4110')&&!calls.includes('29928'));
  assert.equal(result.report.approved_mapping_count,504);assert.equal(result.report.executable_plan_count,503);
  assert.equal(result.report.review_row_count,1);assert.equal(result.report.normalization_review_rows.length,1);
  const row=result.report.review_rows[0];assert.equal(row.offer_id,'2049');assert.equal(row.proposed_offer,null);
  assert.equal(row.source_failure.identity.commercial_identity,'UNVERIFIED');assert.equal(row.source_failure.identity.authority,'MANUAL_REVIEW_ONLY');
  const artifact=loadDryRunArtifact(out.artifact).artifact;
  assert.doesNotThrow(()=>executor.validateArtifactScope(artifact,sixApproved.manifest));
  assert.ok(artifact.plans.every(p=>String(p.resolved_plan.offer.id)!=='2049'));
  assert.ok(artifact.source_rows.every(p=>p.normalized_source_row.source.external_variant_id!=='31617'));
  const forged=structuredClone(artifact);forged.plans[0].resolved_plan.offer.id='2049';
  assert.throws(()=>executor.validateArtifactScope(forged,sixApproved.manifest));
  assert.equal(result.report.database_writes,0);assert.deepEqual(s.records,before);
  await assert.rejects(six.run({target:'production',...s.paths(),isolateUnsafe:false},{state:{records:s.records},readLive:s.readLive}),{code:'SOURCE_IDENTITY_DRIFT'});
});

test('Six parent-wide uncertainty excludes every variant of that parent', async () => {
  const s=sixContract();for(const r of s.records.filter(r=>r.mapping.external_product_id==='31593'))r.mapping.external_name+=' 17 servings';
  const result=await six.run({target:'production',...s.paths(),isolateUnsafe:true},{state:{records:s.records},readLive:s.readLive});
  assert.equal(result.report.review_row_count,3);assert.equal(result.report.executable_plan_count,501);
  assert.ok(result.report.review_rows.every(r=>r.external_product_id==='31593'&&r.proposed_offer===null));
});

test('Six fatal dimensions stop sealing while retaining captured normalization inputs and review evidence', async () => {
  const s=sixContract(),out=s.paths();
  s.records.find(r=>r.mapping.id==='2235').mapping.external_name+=' 17 servings';
  const conflict=s.records.find(r=>r.mapping.external_product_id==='4566');
  conflict.mapping.external_name=conflict.mapping.external_name.replace('100g','200g');
  await assert.rejects(six.run({target:'production',...out,isolateUnsafe:true},
    {state:{records:s.records},readLive:s.readLive}),{code:'SOURCE_IDENTITY_DRIFT'});
  assert.equal(fs.existsSync(out.artifact),false);
  const report=JSON.parse(fs.readFileSync(out.report,'utf8'));
  assert.equal(report.normalization_review_rows.length,1);
  assert.equal(report.normalization_inputs_retention,'COMPLETE_PARSED_INPUT');
  assert.equal(report.normalization_inputs.length,277);
  assert.ok(report.normalization_inputs.every(p=>p.technical_document_identity&&p.source_provenance));
  assert.equal(report.executable_plan_count,0);assert.equal(report.database_writes,0);
  assert.ok(report.post_capture_errors.some(e=>e.mapping_id===conflict.mapping.id));
});

test('Six quarantine rejects real unit/identifier/price/provenance conflicts rather than approving equivalence', async () => {
  const s=sixContract(),record=s.records.find(r=>r.mapping.id==='2235');record.mapping.external_name+=' 17 servings';
  const capturedAt=new Date().toISOString(),page=await s.readLive('31593',{capturedAt});
  let error;try{six.liveSourceFor(record,page);}catch(e){error=e;}
  assert.ok(six.normalizationReviewFor(error,record,page,capturedAt));
  const cases=[
    (r,p)=>{p.product_name=p.product_name.replace('100g','200g');},
    (r,p)=>{r.mapping.external_name='CNP Protein Flapjack Box of 12 x 75g';p.product_name='Cnp protein flapjack 75g';},
    (r,p)=>{r.product.brand='Approved Brand';p.brand='Different Brand';},
    (r,p)=>{r.mapping.external_sku='APPROVED';p.variations[0].sku='OTHER';},
    (r,p)=>{r.mapping.external_gtin='1234567890123';p.variations[0].gtin='9876543210987';},
    (r,p)=>{p.variations[0].price='NaN';},
    (r,p)=>{p.source_provenance.body_complete=false;},
    (r,p)=>{p.technical_document_identity=null;},
    (r,p)=>{p.source_provenance.html_sha256='0'.repeat(64);},
    (r,p)=>{p.canonical_url='https://6pack-supplements.co.uk/product/wrong/';},
    (r,p)=>{p.external_product_id='99999';},
    (r,p)=>{p.variations=[];},
    (r,p)=>{p.variations.push(p.variations[0]);},
    (r,p)=>{p.captured_at='2020-01-01T00:00:00Z';},
  ];
  for(const change of cases){const r=structuredClone(record),p=structuredClone(page);change(r,p);let failure;
    try{six.liveSourceFor(r,p);}catch(e){failure=e;}
    assert.equal(six.normalizationReviewFor(failure||error,r,p,capturedAt),null);
  }
});
