const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const fit = require('./fit-house-offer-refresh');
const six = require('./six-pack-offer-refresh');
const { catalogueScopeBindings, reconcileApprovedCatalogueScope, assertCataloguePolicyAllowsRecords } = require('./lib/feed-variant-guards');
const { readWooCommerceProductPage } = require('./lib/woocommerce-product-page-reader');

const fitApproved = fit.loadApprovedManifest(), sixApproved = six.loadApprovedManifest();
const audited = fit.loadAuditedMissingVariantManifest();
const fitConfig = require('../config/retailers/fit-house-offer-sync.json');
const capturedAt = '2026-11-09T14:31:53.000Z';

// TEST ONLY: exact approved tuples with synthetic commercial values, no network.
function physicalRecords(manifest) {
  const historical = new Map(manifest.historical_withdrawn_rows.map(r => [r.mapping_id, r]));
  return catalogueScopeBindings(manifest).map(b => {
    const decision = historical.get(b.mapping_id);
    const proof = audited.manifest.rows.find(r => manifest.retailer.id === 9 && r.mapping_id === b.mapping_id);
    const alignment = manifest.retailer.id === 9 && fit.APPROVED_CANONICAL_REBINDINGS.find(r => r.mapping_id === b.mapping_id);
    const url = `https://${manifest.retailer.id === 9 ? 'fithouse.uk' : '6pack-supplements.co.uk'}/products/fixture-${b.external_product_id}`;
    return {
      product: { id:b.canonical_product_id, name:`Permitted fixture ${b.canonical_product_id}`, is_active:!decision, merged_into_product_id:null,
        ...(decision ? { owner_withdrawal_state:decision.withdrawal_state, owner_withdrawal_reason:decision.decision_reference, owner_withdrawn_at:capturedAt } : {}) },
      variant: { ...(alignment || {}), id:b.canonical_variant_id, product_id:b.canonical_product_id, is_active:!decision },
      mapping: { id:b.mapping_id, retailer_id:manifest.retailer.id, product_id:b.canonical_product_id, product_variant_id:b.canonical_variant_id,
        external_product_id:b.external_product_id, external_variant_id:b.external_variant_id, external_sku:proof?.external_sku || null, external_url:url, external_name:'Permitted fixture' },
      offer: { id:b.offer_id, retailer_id:manifest.retailer.id, retailer_product_id:b.mapping_id, product_id:b.canonical_product_id,
        product_variant_id:b.canonical_variant_id, price:'10.00', shipping_cost:'3.99', total_price:'13.99', in_stock:false, url }
    };
  });
}
function fitPartition() { return reconcileApprovedCatalogueScope(fitApproved.manifest, physicalRecords(fitApproved.manifest)); }
function live(record) {
  return { external_product_id:record.mapping.external_product_id, external_variant_id:record.mapping.external_variant_id,
    product_handle:`fixture-${record.mapping.external_product_id}`, external_sku:record.mapping.external_sku,
    price:'10.00', shipping_cost:'3.99', total_price:'13.99', in_stock:false };
}
function reconcile(p, source) { return fit.reconcileAuditedMissingVariants(p.records, source, audited, p.historical_records); }

test('current immutable manifests retain Fit 284+2 and Six 504+2 exact bindings', () => {
  assert.equal(fitApproved.sha256, 'b25aaafadecb848e08507ba488f34a4b4a84871f67d993d93538eff50600e3b5');
  assert.equal(sixApproved.sha256, 'a038f86f98057c5edde505ec5c07f262066dbc53001157a933ebee6c468ae77e');
  assert.equal(audited.sha256, fitConfig.discovery_policy.audited_missing_variant_manifest_sha256);
  for (const [approved, active, physical] of [[fitApproved,284,286],[sixApproved,504,506]]) {
    const p = reconcileApprovedCatalogueScope(approved.manifest, physicalRecords(approved.manifest));
    assert.equal(p.records.length, active); assert.equal(p.historical_records.length, 2);
    assert.equal(p.scope_partition.physical_mapping_count, physical);
    assert.equal(new Set([...p.records,...p.historical_records].map(r => r.mapping.id)).size, physical);
  }
});

test('all 78 audited bindings remain verified, while only 76 active absences reconcile within full Fit 284', () => {
  const p = fitPartition(), before = structuredClone(p);
  const auditedIds = new Set(audited.manifest.rows.map(r => r.mapping_id));
  const source = p.records.filter(r => !auditedIds.has(r.mapping.id)).map(live);
  const result = reconcile(p, source);
  assert.equal(audited.manifest.rows.length, 78); assert.equal(result.missingVariantIds.length, 76);
  assert.equal(result.sourceVariants.length, 284); assert.equal(result.newUnavailableCount, 0);
  const synthetic = result.sourceVariants.filter(r => r.audited_source_absent);
  assert.equal(synthetic.length, 76); assert.ok(synthetic.every(r => r.in_stock === false));
  const historicalIds = new Set(p.historical_records.map(r => r.mapping.external_variant_id));
  assert.ok(result.sourceVariants.every(r => !historicalIds.has(r.external_variant_id)));
  assert.deepEqual(p, before); assert.equal(result.manifest_sha256, audited.sha256);
  assert.doesNotThrow(() => fit.requireAuditedMissingOwnerApproval(audited,result,{state:'DRY_RUN_READY',rows:[]},null));
});

test('returned historical source cannot become synthetic OOS or a returned active approval candidate', () => {
  const p = fitPartition(), auditIds = new Set(audited.manifest.rows.map(r => r.mapping_id));
  const returned = p.records.find(r => auditIds.has(r.mapping.id));
  const source = [...p.records.filter(r => !auditIds.has(r.mapping.id)), returned, ...p.historical_records].map(live);
  const result = reconcile(p, source);
  assert.deepEqual(result.returnedLive, [returned.mapping.external_variant_id]);
  assert.equal(result.missingVariantIds.length, 75);
  assert.ok(result.sourceVariants.filter(r => r.audited_source_absent).every(r => !p.historical_records.some(h => h.mapping.external_variant_id === r.external_variant_id)));
});

test('missing, duplicated, reactivated or wrongly partitioned historical proof fails closed', () => {
  for (const mutate of [p => p.historical_records.pop(), p => p.historical_records.push(p.historical_records[0]),
    p => { p.historical_records[0].product.is_active = true; },
    p => { p.historical_records[0].product.owner_withdrawal_reason = 'unapproved'; },
    p => { p.historical_records[0].product.owner_withdrawn_at = null; },
    p => { p.records.push(...p.historical_records); p.historical_records = []; }]) {
    const p = fitPartition(); mutate(p); assert.throws(() => reconcile(p, []));
  }
  for (const field of ['external_sku','external_variant_id']) {
    const p = fitPartition(); p.historical_records[0].mapping[field] = 'DRIFT';
    assert.throws(() => reconcile(p, []));
  }
  const p = fitPartition();
  p.records.find(r => r.mapping.id === audited.manifest.rows[0].mapping_id).mapping.external_sku = 'DRIFT';
  assert.throws(() => reconcile(p, []), /no longer matches its canonical mapping/);
});

test('new active audited OOS still requires owner approval before artifacts', () => {
  const p = fitPartition(), record = p.records.find(r => r.mapping.id === audited.manifest.rows[0].mapping_id);
  record.offer.in_stock = true;
  const result = reconcile(p, p.records.filter(r => !audited.manifest.rows.some(a => a.mapping_id === r.mapping.id)).map(live));
  assert.equal(result.newUnavailableCount, 1);
  assert.throws(() => fit.requireAuditedMissingOwnerApproval(audited,result,{state:'DRY_RUN_READY',rows:[]},null), {code:'OWNER_OOS_APPROVAL_REQUIRED'});
});

test('stable OOS104 retains all four proven stock transitions over the physical 286 scope', () => {
  const records = physicalRecords(fitApproved.manifest);
  const transitions = [['697',false,true],['983',true,false],['1859',true,false],['1982',true,false]];
  const approvedIds = new Set(fit.loadOwnerApprovedSixAbsentManifest().manifest.approved_offer_ids);
  const stillAvailable = [...approvedIds].find(id => !transitions.some(t => t[0] === id));
  const oos = new Set([...approvedIds].filter(id => id !== stillAvailable).concat(transitions.filter(t => !t[2]).map(t => t[0])));
  for (const r of records) if (oos.size < 111 && !['697',stillAvailable].includes(r.offer.id)) oos.add(r.offer.id);
  for (const r of records) r.offer.in_stock = !oos.has(r.offer.id);
  const state = {records,automationReviews:[],automationReviewExecutions:[]};
  transitions.forEach(([id,before,after],i) => {
    const review = {id:String(i+1),offer_id:id,review_status:'EXECUTED',operation_type:'UPDATE_STOCK',source_row_fingerprint:'a'.repeat(64),plan_fingerprint:'b'.repeat(64),before_state:{in_stock:before},proposed_state:{in_stock:after}};
    state.automationReviews.push(review);
    state.automationReviewExecutions.push({review_id:review.id,retailer_id:9,operation_type:'UPDATE_STOCK',review_fingerprint:review.source_row_fingerprint,plan_fingerprint:review.plan_fingerprint,status:'EXECUTED',postflight_hash:'c'.repeat(64),executed_offer_ids:[id],failed_offer_ids:[],remaining_offer_ids:[],actual_deltas:{stock:1},database_writes:20,idempotency_result:'PASS',last_checkpoint:'IDEMPOTENCY_PASSED',completed_at:capturedAt});
  });
  assert.equal(fit.approvedStableOosBaseline().count, 104);
  const guard = fit.applyApprovedStableOosBaselineGuard(state);
  assert.equal(guard.current_oos_count, 111); assert.equal(guard.durable_automation_review_stock_delta, 2);
  assert.equal(guard.durable_automation_review_stock_transitions.length, 4);
  state.automationReviewExecutions.pop();
  assert.throws(() => fit.applyApprovedStableOosBaselineGuard(state), {code:'STABLE_OOS_BASELINE_EXCEEDED'});
});

test('both initial reconciliation and aggregate confirmation retain historical proof', () => {
  const source = fs.readFileSync(path.join(__dirname,'fit-house-offer-refresh.js'),'utf8');
  assert.match(source,/reconcileAuditedMissingVariants\(state.records,ownerReconciledSourceVariants,auditedMissing,state.historical_records\|\|\[\],\{isolateUnsafe:/);
  assert.match(source,/reconcileAuditedMissingVariants\(state.records,secondOwnerReconciledSourceVariants,auditedMissing,state.historical_records\|\|\[\],\{isolateUnsafe:/);
});

test('other retailer profiles retain generic reconciliation without the Fit historical audit path', () => {
  const directory = path.join(__dirname,'../config/retailers');
  const auditProfiles = fs.readdirSync(directory).filter(name => name.endsWith('-offer-sync.json'))
    .filter(name => JSON.parse(fs.readFileSync(path.join(directory,name),'utf8')).discovery_policy?.audited_missing_variant_manifest_path);
  assert.deepEqual(auditProfiles,['fit-house-offer-sync.json']);
  const source = fs.readFileSync(path.join(__dirname,'fit-house-offer-refresh.js'),'utf8');
  assert.equal((source.match(/:reconcileMissingMappedVariants\(targets,/g)||[]).length, 2);
});

test('Six unavailable parent retains unverified commercial identity in technical-scope manual review', async () => {
  // Synthetic parser fixture reproduces the retained name conflict; it is not
  // additional merchant evidence for pack, composition or product identity.
  const url = 'https://6pack-supplements.co.uk/product/trec-nutrition-sleep-er/';
  const html = fs.readFileSync(path.join(__dirname,'test-fixtures/six-pack-theme-unbuyable-parent.html'),'utf8')
    .replaceAll('28570','7565').replaceAll('Skull Labs Angel Dust PUMP Pre-Workout','Trec Nutrition SLEEPer night regeneration formula')
    .replaceAll('https://6pack-supplements.co.uk/product/skull-labs-angel-dust-pump-pre-workout-fruit-killer-flavor/',url);
  const records = physicalRecords(sixApproved.manifest), record = records.find(r => r.mapping.id === '2674');
  record.mapping.external_name = 'Trec Sleep-er 225g'; record.mapping.external_url = url;
  const before = structuredClone(records); let error;
  try { await readWooCommerceProductPage({storeUrl:'https://6pack-supplements.co.uk',productId:'7565',capturedAt,
    maximumAttempts:1,parseProductPage:six.parseSixPackProductPage,
    fetchImpl:async()=>({status:200,url,headers:{get:()=> 'text/html'},text:async()=>html})}); } catch(e) { error=e; }
  assert.equal(error?.code,'SOURCE_SCHEMA_MISMATCH');
  const disposition=six.approvedSourceFailureDisposition(error,'7565',sixApproved,capturedAt,records);
  assert.equal(disposition.scope,'PRODUCT');
  assert.equal(disposition.identity.commercial_identity,'UNVERIFIED');
  assert.equal(disposition.identity.name_equivalence_verified,false);
  assert.equal(disposition.identity.authority,'MANUAL_REVIEW_ONLY');
  for(const mutate of [r=>{r.mapping.external_url='https://6pack-supplements.co.uk/product/other/';},
    r=>{r.offer.retailer_product_id='99999';},r=>{r.mapping.external_variant_id='99999';},
    r=>{r.offer.product_variant_id='99999';},r=>{r.variant.product_id='99999';},r=>{r.offer.retailer_id=9;}]){
    const invalid=structuredClone(records);mutate(invalid.find(r=>r.mapping.id==='2674'));
    assert.equal(six.approvedSourceFailureDisposition(error,'7565',sixApproved,capturedAt,invalid).scope,'RETAILER');
  }
  assert.deepEqual(records,before);
});

test('current Six offline 504+2 isolates one unverified parent, continues all 277, and cannot apply its review row', async () => {
  const records=physicalRecords(sixApproved.manifest), byProduct=new Map();
  for(const [i,r]of records.entries()){
    const simple=r.mapping.external_product_id===r.mapping.external_variant_id;
    Object.assign(r.product,{name:`Fixture ${r.mapping.external_product_id}`,product_format:'capsule'});
    Object.assign(r.variant,{variant_key:simple?'default':`flavour-${i}`,display_name:simple?'Default':`Flavour ${i}`,
      flavour_code:simple?null:`flavour-${i}`,flavour_label:simple?null:`Flavour ${i}`,size_value:null,size_unit:null,pack_count:null,product_format:null,is_default:simple});
    const url=`https://6pack-supplements.co.uk/product/fixture-${r.mapping.external_product_id}/`;
    Object.assign(r.mapping,{external_url:url,external_name:r.product.name,external_options:{},external_slug:`fixture-${i}`,external_gtin:null,match_method:'slug',match_confidence:90,updated_at:capturedAt});
    Object.assign(r.offer,{url,in_stock:true,shipping_cost:'4.99',total_price:'14.99',last_checked_at:capturedAt});
    r.retailer={id:11,name:'6 Pack Supplements',slug:'6-pack-supplements',website:'https://6pack-supplements.co.uk'};
    let page=byProduct.get(r.mapping.external_product_id);
    if(!page){page={external_product_id:r.mapping.external_product_id,canonical_url:url,product_name:r.product.name,product_offer:null,variations:[],html_sha256:require('node:crypto').createHash('sha256').update(r.mapping.external_product_id).digest('hex')};byProduct.set(r.mapping.external_product_id,page);}
    if(simple)page.product_offer={price:'10.00',in_stock:true};
    else page.variations.push({external_variant_id:r.mapping.external_variant_id,price:'10.00',in_stock:true,active:true,purchasable:true});
  }
  const url='https://6pack-supplements.co.uk/product/trec-nutrition-sleep-er/';
  const affected=records.find(r=>r.mapping.id==='2674');affected.mapping.external_name='Trec Sleep-er 225g';affected.mapping.external_url=url;affected.offer.url=url;
  const html=fs.readFileSync(path.join(__dirname,'test-fixtures/six-pack-theme-unbuyable-parent.html'),'utf8')
    .replaceAll('28570','7565').replaceAll('Skull Labs Angel Dust PUMP Pre-Workout','Trec Nutrition SLEEPer night regeneration formula')
    .replaceAll('https://6pack-supplements.co.uk/product/skull-labs-angel-dust-pump-pre-workout-fruit-killer-flavor/',url);
  const before=structuredClone(records),called=[],key=require('node:crypto').randomUUID();
  const artifact=path.join(__dirname,'../tmp/six-pack-offer-refresh-tests',key+'.json'),report=artifact.replace('.json','-report.json');
  const result=await six.run({target:'production',artifact,report,isolateUnsafe:true},{state:{records},
    readLive:async(id,ctx)=>{called.push(id);if(id!=='7565')return byProduct.get(id);
      return readWooCommerceProductPage({storeUrl:'https://6pack-supplements.co.uk',productId:id,capturedAt:ctx.capturedAt,maximumAttempts:1,
        parseProductPage:six.parseSixPackProductPage,fetchImpl:async()=>({status:200,url,headers:{get:()=> 'text/html'},text:async()=>html})});}});
  assert.equal(result.report.result,'PASS_WITH_REVIEW');assert.equal(result.report.approved_mapping_count,504);
  assert.equal(called.length,277);assert.equal(new Set(called).size,277);
  assert.ok(!called.includes('4110')&&!called.includes('29928'));assert.ok(called.includes('8628')); // Injected fixture, never live verification.
  assert.equal(result.report.executable_plan_count,503);assert.equal(result.report.review_row_count,1);assert.equal(result.report.blocked_row_count,0);
  const row=result.report.review_rows[0];assert.equal(row.offer_id,'2488');assert.equal(row.proposed_offer,null);
  assert.equal(row.changed_fields.price,false);assert.equal(row.changed_fields.stock,false);assert.equal(row.changed_fields.url,false);
  assert.equal(row.source_failure.identity.commercial_identity,'UNVERIFIED');
  const sealed=require('./import-products').loadDryRunArtifact(artifact).artifact,executor=require('./six-pack-offer-refresh-executor');
  assert.doesNotThrow(()=>executor.validateArtifactScope(sealed,sixApproved.manifest));
  assert.equal(sealed.plans.length,503);assert.ok(sealed.plans.every(p=>String(p.resolved_plan.offer.id)!=='2488'));
  assert.ok(sealed.source_rows.every(r=>r.normalized_source_row.source.external_product_id!=='7565'));
  const forged=structuredClone(sealed);forged.plans[0].resolved_plan.offer.id='2488';
  assert.throws(()=>executor.validateArtifactScope(forged,sixApproved.manifest));
  assert.equal(result.report.database_writes,0);assert.equal(result.report.executed_plan_count,0);assert.deepEqual(records,before);
});

test('source quarantine cannot reactivate the previously excluded standalone products', () => {
  for (const name of ['7Nutrition Melatonin 1mg 60 Capsules','Soma Melatonin 4mg 100 Tablets']) {
    const r = {product:{name},variant:{display_name:'Default'},mapping:{external_name:'Unverified merchant alias'},offer:{id:'fixture'},__reviewed_catalogue_identity:{approved:true}};
    assert.throws(() => assertCataloguePolicyAllowsRecords([r]),{code:'CATALOGUE_POLICY_SCOPE_BLOCKED'});
  }
});
