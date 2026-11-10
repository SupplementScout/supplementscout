const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const fit=require('./fit-house-offer-refresh'),six=require('./six-pack-offer-refresh');
const {classifyExistingOffers,isolateAggregateRiskRows,partitionExecutableRows}=require('./lib/retailer-offer-sync/classifier');
const {parsePackCount,reconcileApprovedCatalogueScope}=require('./lib/feed-variant-guards');
const {liveIdentityDrift}=require('./six-pack-canary-builder');
const captured=require('./test-fixtures/retailer-targeted-repair-captured-2026-11-09.json');
const prior=require('./test-fixtures/retailer-quarantine-captured-evidence-2026-11-09.json');
const fitConfig=require('../config/retailers/fit-house-offer-sync.json');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fitReplay(){
  const state=reconcileApprovedCatalogueScope(fit.loadApprovedManifest().manifest,structuredClone(prior.fit.records));
  const native=captured.fit.classifier,matched=new Set(native.scope.scope_row_ids),changed=new Map(native.changed_rows.map(r=>[r.offer_id,r]));
  const targets=state.records.map(r=>({offer_id:String(r.offer.id),retailer_product_id:String(r.mapping.id),
    external_product_id:r.mapping.external_product_id,external_variant_id:r.mapping.external_variant_id,external_sku:r.mapping.external_sku||null,
    price:r.offer.price,shipping_cost:r.offer.shipping_cost,total_price:r.offer.total_price,in_stock:r.offer.in_stock,
    url:r.offer.url,external_url:r.mapping.external_url,last_checked_at:r.offer.last_checked_at}));
  // Projection of the retained native classifier, not a reconstructed raw feed.
  const source=targets.filter(t=>matched.has(t.offer_id)).map(t=>{const delta=changed.get(t.offer_id);return{
    external_product_id:t.external_product_id,external_variant_id:t.external_variant_id,external_sku:t.external_sku,
    product_handle:new URL(t.external_url).pathname.split('/')[2],price:delta?.new_price||t.price,
    shipping_cost:t.shipping_cost,total_price:t.total_price,in_stock:delta?delta.new_stock:t.in_stock};});
  const audit=fit.loadAuditedMissingVariantManifest();
  const reconciled=fit.reconcileAuditedMissingVariants(state.records,source,audit,state.historical_records,{isolateUnsafe:true,sourceComplete:true});
  const classification=classifyExistingOffers({targets,sourceVariants:reconciled.sourceVariants,policy:fit.effectiveOfferPolicy(),
    sourceCapturedAt:captured.fit.source_captured_at,now:new Date(captured.fit.source_captured_at),sourceProductCount:231,previousSourceProductCount:207,quarantineUnsafeRows:true});
  const approved=fit.loadOwnerApprovedSixAbsentManifest().manifest;
  const owner={approved_rows:approved.rows.filter(r=>approved.approved_offer_ids.includes(r.offer_id)),authorizedChangeCount:0,
    returned:fit.loadOwnerApprovedReturnedOfferManifest().manifest,isolation:fit.loadOwnerApprovedReturnIsolationManifest().manifest};
  return{state,classification,owner,audit,reconciled};
}

test('captured Fit284+2 reuses the October partition:261 confirmations,19 stock review,4 missing review',()=>{
  const s=fitReplay();assert.equal(s.state.records.length,284);assert.equal(s.state.historical_records.length,2);
  assert.equal(s.audit.manifest.rows.length,78);assert.equal(s.reconciled.newUnavailableCount,0);
  assert.equal(s.classification.state,'BLOCKED');assert.equal(s.classification.reason,'MASS_OOS');
  assert.equal(s.classification.rows.filter(r=>r.action==='VERIFY_NO_CHANGE').length,261);
  assert.equal(s.classification.rows.filter(r=>r.action==='UPDATE_STOCK').length,19);assert.equal(s.classification.quarantined_rows.length,4);
  const ordinary=fit.authorizeOwnerApprovedSixStockOnly(s.classification,s.owner,{isolateUnsafe:true});
  assert.equal(ordinary.reason,'MASS_OOS'); // No aggregate guard was bypassed.
  const result=isolateAggregateRiskRows(ordinary),partition=partitionExecutableRows(result);
  assert.equal(result.state,'DRY_RUN_READY_WITH_REVIEW');assert.equal(partition.executable_rows.length,261);
  assert.equal(partition.review_rows.length,23);assert.ok(partition.executable_rows.every(r=>r.action==='VERIFY_NO_CHANGE'));
  assert.equal(partition.review_rows.filter(r=>r.reason==='SOURCE_VARIANT_MISSING').length,4);
  assert.equal(partition.review_rows.filter(r=>r.changed_fields.stock).length,19);
  assert.equal(s.state.records.find(r=>String(r.offer.id)==='1859').offer.in_stock,false);
  assert.equal(fit.approvedStableOosBaseline().count,104);
  for(const r of result.quarantined_rows)assert.ok(!fit.selectOrdinaryExecutionRows(result,s.owner).some(x=>x.offer_id===r.offer_id));
  const dir=path.resolve('tmp/targeted-repair');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'captured-fit-partition.json'),JSON.stringify({mode:'RETAINED_NATIVE_CLASSIFIER_PROJECTION_NOT_RAW_FEED',
    input:{active:284,historical:2,verify:261,stock:19,missing_review:4},output:{executable_confirmations:261,stock_review:19,missing_review:4},
    sql_validator:'NOT_RUN_OFFLINE',production_writes:0},null,2)+'\n');
});

test('consumed contract cannot authorize non-isolated writes or tolerate missing/tampered protected bindings',()=>{
  const s=fitReplay();assert.throws(()=>fit.authorizeOwnerApprovedSixStockOnly(s.classification,s.owner),{code:'FIT_HOUSE_ISOLATION_SCOPE_MISMATCH'});
  for(const change of [c=>{c.quarantined_rows.find(r=>r.offer_id==='1859').external_product_id='wrong';},
    c=>{c.quarantined_rows=c.quarantined_rows.filter(r=>r.offer_id!=='1859');},
    c=>{c.rows.find(r=>r.offer_id==='759').action='UPDATE_STOCK';}]){
    const c=structuredClone(s.classification);change(c);
    assert.throws(()=>fit.authorizeOwnerApprovedSixStockOnly(c,s.owner,{isolateUnsafe:true}),{code:'FIT_HOUSE_ISOLATION_SCOPE_MISMATCH'});
  }
  const pending={...s.owner,authorizedChangeCount:1};
  assert.throws(()=>fit.authorizeOwnerApprovedSixStockOnly(s.classification,pending,{isolateUnsafe:true}),{code:'FIT_HOUSE_ISOLATION_SCOPE_MISMATCH'});
  assert.equal(fitConfig.guardrails.mass_oos_block_count,4);
});

function sixRows(){return captured.six.records.map(record=>({record:structuredClone(record),live:structuredClone(captured.six.pages.find(p=>p.external_product_id===record.mapping.external_product_id))}));}
function freeze(t){t.mock.method(Date,'now',()=>Date.parse(captured.six.source_captured_at)+1000);}
function normalize(record,live){try{return{source:six.liveSourceFor(record,live)};}catch(error){return{error,review:six.normalizationReviewFor(error,record,live,captured.six.source_captured_at)};}}

test('existing pack parser recognizes only an unambiguous standalone boxed-piece label',()=>{
  assert.equal(parsePackCount('box (12pc)'),12);assert.equal(parsePackCount(' Box (1pcs) '),1);
  for(const label of ['75g','box (0pc)','box (12pc) or single','box (12pc) / box (1pc)','box (99999999999999999999pc)'])assert.equal(parsePackCount(label),null);
});

test('immutable captured source and504+2 approved scope remain sealed',()=>{
  assert.equal(digest(captured.six.pages),'5a60b0a399f1a62249acb82f2ee586f1bd3aece6b18f96b10e4d120e8e396e5c');
  const m=six.loadApprovedManifest().manifest;assert.equal(m.rows.length,504);assert.equal(m.historical_withdrawn_rows.length,2);
  assert.equal(captured.six.records.length,15);assert.equal(captured.six.pages.length,12);
});

test('real15 retained incidents yield4 exact selected multipacks and11 noncommercial reviews',t=>{
  freeze(t);const counts={source:0,review:0,block:0},outcomes=[];
  for(const {record,live} of sixRows()){
    assert.ok(liveIdentityDrift({source_record_id:record.mapping.external_variant_id,product_name:record.mapping.external_name},live));
    const result=normalize(record,live),kind=result.source?'source':result.review?'review':'block';counts[kind]++;
    if(result.review){assert.equal(result.review.identity.commercial_identity,'UNVERIFIED');assert.equal(result.review.identity.authority,'MANUAL_REVIEW_ONLY');}
    if(result.source)assert.equal(record.mapping.external_product_id,'4566');
    if(kind==='block')assert.ok(['5091','4145'].includes(record.mapping.external_product_id));
    outcomes.push({mapping:record.mapping.id,parent:record.mapping.external_product_id,variant:record.mapping.external_variant_id,disposition:kind});
  }
  assert.deepEqual(counts,{source:4,review:11,block:0});
  fs.writeFileSync(path.resolve('tmp/targeted-repair/captured-six15-replay.json'),JSON.stringify({mode:'CAPTURED_PARSED_SOURCE_REPLAY_WITH_FROZEN_CAPTURE_CLOCK',
    counts,outcomes,full_runtime_result:'NOT_RUN_PARTIAL_OFFLINE_REPLAY_ONLY',classifier:'NOT_RUN',sql_validator:'NOT_RUN',
    executable_artifacts:0,production_writes:0},null,2)+'\n');
});

test('CNP exact variants retain their actual prices and stocks; a single75g cannot become box12',t=>{
  freeze(t);
  for(const {record,live} of sixRows().filter(x=>x.record.mapping.external_product_id==='4566')){
    const selected=live.variations.find(v=>v.external_variant_id===record.mapping.external_variant_id),normalized=six.liveSourceFor(record,live);
    assert.equal(selected.attributes.attribute_size,'box (12pc)');assert.equal(parsePackCount(selected.attributes.attribute_size),12);
    assert.equal(normalized.price,selected.price);assert.equal(normalized.in_stock,selected.in_stock);
    for(const mutate of [(r,p,s)=>{s.attributes.attribute_size='box (1pc)';},(r,p,s)=>{s.attributes.attribute_size='box (6pc)';},
      (r,p,s)=>{s.attributes.attribute_flavour='Other flavour';},(r)=>{r.variant.flavour_label='Other canonical flavour';},
      (r,p)=>{p.product_name=p.product_name.replace('75g','150g');},(r)=>{r.variant.pack_count=6;},
      (r)=>{r.variant.size_value=150;},(r,p,s)=>{s.price='NaN';},(r,p)=>{p.technical_document_identity=null;},
      (r,p)=>{p.source_provenance.body_complete=false;},(r,p)=>{p.canonical_url='https://other.example/product/';},
      (r,p,s)=>{s.attributes.attribute_size='box (12pc) or single';},
      (r,p,s)=>{r.mapping.external_sku='EXPECTED';s.sku='DIFFERENT';}]){
      const rr=structuredClone(record),pp=structuredClone(live),ss=pp.variations.find(v=>v.external_variant_id===rr.mapping.external_variant_id);
      mutate(rr,pp,ss);assert.equal(normalize(rr,pp).source,undefined);
    }
    const missing=structuredClone(record);missing.mapping.external_sku='KNOWN_BUT_UNOBSERVED';
    assert.equal(normalize(missing,live).source,undefined);assert.equal(normalize(missing,live).review.identity.commercial_identity,'UNVERIFIED');
  }
});

test('eleven unverified reviews cannot supply commercial classifier rows or apply confirmations',t=>{
  freeze(t);const reviews=sixRows().map(({record,live})=>({record,result:normalize(record,live)})).filter(x=>x.result.review);
  assert.equal(reviews.length,11);
  // Subset contract of the unchanged classifier, not a full source dry-run.
  const targets=reviews.map(({record:r})=>({offer_id:String(r.offer.id),retailer_product_id:String(r.mapping.id),external_product_id:r.mapping.external_product_id,
    external_variant_id:r.mapping.external_variant_id,external_sku:r.mapping.external_sku,price:r.offer.price,shipping_cost:r.offer.shipping_cost,
    total_price:r.offer.total_price,in_stock:r.offer.in_stock,url:r.offer.url,external_url:r.mapping.external_url}));
  const c=classifyExistingOffers({targets,sourceVariants:[],policy:{...fit.effectiveOfferPolicy(),required_matched_offers:11},
    sourceCapturedAt:captured.six.source_captured_at,now:new Date(captured.six.source_captured_at),sourceProductCount:277,previousSourceProductCount:277,quarantineUnsafeRows:true});
  assert.equal(c.rows.length,0);assert.equal(c.quarantined_rows.length,11);
  for(const row of c.quarantined_rows){assert.equal(row.reason,'SOURCE_VARIANT_MISSING');assert.equal(row.source,null);
    assert.deepEqual(row.changed_fields,{price:false,stock:false,url:false,blocked:true});assert.equal(fit.reviewReportRow(row).proposed_offer,null);}
});

test('5088 approved legacy slug permits manual isolation without becoming commercial identity',t=>{
  freeze(t);const {record,live}=sixRows().find(x=>x.record.mapping.external_product_id==='5088');
  assert.equal(record.mapping.external_url,live.canonical_url);
  assert.match(live.canonical_url,/skinny-food/);
  const original=normalize(record,live);assert.equal(original.source,undefined);
  assert.equal(original.review.identity.authority,'MANUAL_REVIEW_ONLY');
  assert.equal(live.product_offer.in_stock,false); // Captured source, not the owner's manual observation.
  live.product_offer.gtin=record.mapping.external_gtin;
  const result=normalize(record,live);assert.equal(result.source,undefined);
  assert.equal(result.review.identity.commercial_identity,'UNVERIFIED');
  for(const [index,mutate] of [p=>{p.canonical_url='https://6pack-supplements.co.uk/product/unapproved/';},
    p=>{p.source_provenance.request_url='https://6pack-supplements.co.uk/?p=5091';},
    p=>{p.source_provenance.response_url='https://other.example/product/';},
    p=>{p.technical_document_identity.product_id='5091';},p=>{p.source_provenance.body_complete=false;},
    p=>{p.product_offer.sku='DIFFERENT';},p=>{p.product_name='Battle Bites 120g';}].entries()){
    const changed=structuredClone(live);mutate(changed);
    const result=normalize(record,changed);
    if(index<5) assert.equal(result.review,null);
    else {
      assert.equal(result.review.disposition,'SOURCE_IDENTITY_CONFLICT');
      assert.equal(result.review.identity.commercial_identity,'UNVERIFIED');
      assert.equal(result.review.identity.authority,'MANUAL_REVIEW_ONLY');
    }
    assert.equal(normalize(record,changed).source,undefined);
  }
});

test('historical v12 preserves separate GTIN and SKU columns, bindings and the approved5088 slug',()=>{
  const {parse}=require('csv-parse/sync');
  const bytes=fs.readFileSync(path.resolve('config/retailers/six-pack-production-expansion-v12.csv'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'bc087c3e12ea44a329acf81c558b7f48eda7dbc09708036a64d26cfc5e406074');
  const rows=parse(bytes,{columns:true,skip_empty_lines:true}),caramel=rows.find(r=>r.external_product_id==='5091');
  assert.equal(caramel.external_gtin,'500318691586');assert.equal(caramel.external_sku,'5060318691586');
  assert.equal(caramel.product_id,'384');assert.equal(caramel.product_variant_id,'2281');
  const marshmallow=rows.find(r=>r.external_product_id==='5088');
  const {record}=sixRows().find(x=>x.record.mapping.external_product_id==='5088');
  assert.equal(marshmallow.external_url,record.mapping.external_url);
  assert.equal(marshmallow.external_gtin,record.mapping.external_gtin);
  assert.equal(marshmallow.external_sku,record.mapping.external_sku);
});

test('invalid approved GTIN still blocks commercial normalization even when its document is isolated',t=>{
  freeze(t);const {record,live}=sixRows().find(x=>x.record.mapping.external_product_id==='5091');
  live.product_name=record.mapping.external_name;
  const result=normalize(record,live);assert.equal(result.source,undefined);
  assert.equal(result.review.disposition,'SOURCE_IDENTITY_CONFLICT');
  assert.equal(result.review.identity.expected_gtin,'500318691586');
  assert.equal(result.review.identity.commercial_identity,'UNVERIFIED');
  assert.equal(result.error.detail.reason_code,'INVALID_APPROVED_GTIN');
});
