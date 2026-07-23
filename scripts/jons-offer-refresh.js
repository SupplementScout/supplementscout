const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {Client}=require("pg");
const {createClient}=require("@supabase/supabase-js");
const {readShopifySnapshot,projectShopifyVariants,sha256}=require("./lib/shopify-snapshot-reader");
const {classifyExistingOffers}=require("./lib/retailer-offer-sync/classifier");
const {sealArtifact}=require("./lib/retailer-offer-sync/artifacts");
const {buildVerifiedNoChangePlan}=require("./verified-no-change-offer-refresh");
const {buildExistingOfferUpdatePlan}=require("./lib/retailer-offer-sync/existing-offer-plan");
const {migrationLedgerFingerprint}=require("./lib/retailer-snapshot/staging-execution-contract");
const {canonicalJson}=require("./lib/canonical-json");
const config=require("../config/retailers/jons-supplements-offer-sync.json");

const ROOT=path.resolve(__dirname,"..");
const OUT=path.join(ROOT,"tmp","jons-offer-refresh");
const TARGETS={staging:{environment:"STAGING",ref:"hxnrsyyqffztlvcrtgbf",identity:"supplementscout-staging:hxnrsyyqffztlvcrtgbf"},production:{environment:"PRODUCTION",ref:"aftboxmrdgyhizicfsfu",identity:"supplementscout-production:aftboxmrdgyhizicfsfu"}};
const ZERO_ROWS={products:0,product_variants:0,retailer_products:0,offers:0,price_history:0};
const ZERO_LOGICAL={offer_price_updates:0,offer_shipping_updates:0,offer_total_updates:0,offer_stock_updates:0,offer_url_updates:0,mapping_url_updates:0,mapping_updated_at_updates:0,last_checked_at_updates:0};

class RefreshError extends Error{
  constructor(code,message,stage,detail={}){super(message);this.name="RefreshError";this.code=code;this.stage=stage;this.detail=detail}
}
function invariant(value,message){if(!value)throw new Error(message)}
function parseArgs(argv){const out={};for(const arg of argv){const m=arg.match(/^--([^=]+)=(.*)$/);if(!m||out[m[1]]!==undefined)throw new Error(`invalid argument ${arg}`);out[m[1]]=m[2]}if(!TARGETS[out.target]||!["dry-run","apply"].includes(out.mode))throw new Error("required --target=staging|production --mode=dry-run|apply");return out}
function loadEnvFile(file){if(!fs.existsSync(file))return{};const out={};for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)out[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,"$2")}return out}
function loadEnvironment(){Object.assign(process.env,Object.fromEntries(Object.entries(loadEnvFile(path.join(ROOT,".env.local"))).filter(([key])=>!process.env[key])))}
function roleCredential(target,kind){const direct=process.env[`JONS_SYNC_${kind.toUpperCase()}_DATABASE_URL`];let url=direct;if(!url){const file=target==="production"?path.join(process.env.USERPROFILE||"", ".supplementscout","credentials",`production-${kind}.env`):path.join(ROOT,`.env.staging.${kind}.local`);const values=loadEnvFile(file);url=Object.entries(values).find(([key])=>key.endsWith("_DATABASE_URL"))?.[1]}invariant(url,`missing ${kind} database URL`);const parsed=new URL(url);parsed.searchParams.delete("sslmode");invariant(!parsed.href.includes(TARGETS[target==="production"?"staging":"production"].ref),`${kind} opposite target`);return parsed.href}
function git(...args){return execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:30000}).trim()}
function canonicalHash(value){return sha256(canonicalJson(JSON.parse(JSON.stringify(value))))}
function uuid(){return crypto.randomUUID()}
function write(name,value){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,name),`${JSON.stringify(value,null,2)}\n`)}
function sourceHealth(snapshot,sourceVariants){
  const baseline=config.source_baseline;
  invariant(baseline&&baseline.product_count>0&&baseline.variant_count>0,"Jon's source baseline missing");
  const rawVariants=snapshot.products.reduce((count,product)=>count+(Array.isArray(product.variants)?product.variants.length:0),0);
  const productRatio=snapshot.products.length/baseline.product_count,variantRatio=sourceVariants.length/baseline.variant_count,ratio=Math.min(productRatio,variantRatio);
  const evidence={baseline_products:baseline.product_count,baseline_variants:baseline.variant_count,product_count:snapshot.products.length,raw_variant_count:rawVariants,normalised_variant_count:sourceVariants.length,product_ratio:productRatio,variant_ratio:variantRatio,observed_ratio:ratio,minimum_ratio:baseline.minimum_count_ratio,genuine_collapse_ratio:baseline.genuine_collapse_ratio};
  if(!snapshot.source_diagnostic?.pagination_completed||snapshot.products.length===0||rawVariants===0||sourceVariants.length===0)return{result:"BLOCK",code:"SOURCE_INCOMPLETE",...evidence};
  if(ratio<baseline.genuine_collapse_ratio)return{result:"BLOCK",code:"GENUINE_SOURCE_COLLAPSE",...evidence};
  if(ratio<baseline.minimum_count_ratio)return{result:"BLOCK",code:"SOURCE_DEGRADED",...evidence};
  return{result:"PASS",code:null,...evidence};
}
function diagnosticName(argv,env=process.env){
  const target=argv.find(value=>value.startsWith("--target="))?.slice(9)||"unknown";
  const mode=argv.find(value=>value.startsWith("--mode="))?.slice(7)||"startup";
  const phase=String(env.JONS_REFRESH_PHASE||mode).replace(/[^a-z0-9_-]+/gi,"-").toLowerCase();
  return`${target}-${phase}-diagnostic.json`;
}
function diagnosticTemplate(argv,env=process.env){
  let commit=env.GITHUB_SHA||null;try{commit||=git("rev-parse","HEAD")}catch{}
  return{
    schema_version:1,
    timestamp:new Date().toISOString(),
    result:"STARTED",
    workflow_run_context:{repository:env.GITHUB_REPOSITORY||"SupplementScout/supplementscout",run_id:env.GITHUB_RUN_ID||null,run_attempt:env.GITHUB_RUN_ATTEMPT||null,actor:env.GITHUB_ACTOR||null,event_name:env.GITHUB_EVENT_NAME||"local",ref:env.GITHUB_REF||null,actions:env.GITHUB_ACTIONS==="true"},
    trigger_type:env.JONS_REFRESH_TRIGGER_TYPE||env.GITHUB_EVENT_NAME||"local",
    commit,
    source:{url:new URL("/products.json",config.store_url).href,type:"SHOPIFY_PRODUCTS_JSON",http_status:null,content_type:null,bytes_received:0,pages_fetched:0,pagination_completed:false,product_count:0,raw_variant_count:0,normalised_count:0,baseline_product_count:config.source_baseline.product_count,baseline_variant_count:config.source_baseline.variant_count,product_ratio:0,variant_ratio:0,ratio:0,minimum_ratio:config.source_baseline.minimum_count_ratio,genuine_collapse_ratio:config.source_baseline.genuine_collapse_ratio,request_headers:null,redirect_policy:null,retries:0},
    approved_mapping_count:0,approved_offer_count:0,mappings_matched:0,mappings_missing:0,guard_results:[],
    validator_result:"NOT_RUN",approver_result:"NOT_RUN",executor_result:"NOT_RUN",
    failure_stage:null,error_code:null,error_message:null,
    database_writes_attempted:0,database_writes_completed:0,
    business_writes_completed:0,control_writes_completed:0,approvals_created:0,approvals_consumed:0,recovery_calls:0,
  };
}
function writeDiagnostic(name,diagnostic,outDir=OUT){fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,name),`${JSON.stringify(diagnostic,null,2)}\n`)}
function applySourceDiagnostic(diagnostic,snapshot,sourceVariants,health){
  const source=snapshot.source_diagnostic||{};
  Object.assign(diagnostic.source,{http_status:source.final_http_status,content_type:source.final_content_type,bytes_received:source.bytes_received||0,pages_fetched:source.pages_fetched||0,pagination_completed:Boolean(source.pagination_completed),product_count:snapshot.products.length,raw_variant_count:health.raw_variant_count,normalised_count:sourceVariants.length,product_ratio:health.product_ratio,variant_ratio:health.variant_ratio,ratio:health.observed_ratio,request_headers:source.request_headers||null,redirect_policy:source.redirect_policy||null,retries:source.retry_count||0,pages:source.pages||[]});
}
const ENVIRONMENT_MIGRATION_EXCLUSIONS={
  STAGING:new Set(["20260717130000_add_local_retailer_catalogue_child_executor","20260719100000_add_production_retailer_sync_enablement","20260723210000_apply_reviewed_whey_okay_product_formats"]),
  PRODUCTION:new Set(["20260717120000_create_retailer_catalogue_control_ledger","20260717130000_add_local_retailer_catalogue_child_executor","20260717140000_add_staging_retailer_catalogue_executor","20260718150000_add_verified_no_change_offer_refresh","20260718160000_add_retailer_offer_mixed_batch_executor","20260718170000_add_read_only_mixed_batch_validator","20260719090000_add_expired_retailer_offer_sync_approval_close","20260723210000_apply_reviewed_whey_okay_product_formats"]),
};
function migrationBinding(environment){const excluded=ENVIRONMENT_MIGRATION_EXCLUSIONS[environment];invariant(excluded,`unsupported migration environment ${environment}`);const ids=fs.readdirSync(path.join(ROOT,"supabase","migrations")).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort().map(name=>name.slice(0,-4)).filter(id=>!excluded.has(id));return{versions:ids,fingerprint:migrationLedgerFingerprint(ids,environment)}}
async function all(client,table,columns,filter){const out=[];for(let from=0;;from+=1000){let query=client.from(table).select(columns).range(from,from+999);if(filter)query=filter(query);const{data,error}=await query;if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)return out}}
function money(value){return value==null?null:Number(value).toFixed(2)}
function timestamp(value){return value instanceof Date?value.toISOString():value}
function executionRow(row){return{offer_id:row.offer_id,retailer_product_id:row.retailer_product_id,external_product_id:row.external_product_id,external_variant_id:row.external_variant_id,action:row.action,changed_fields:row.changed_fields,source_captured_at:row.source_captured_at,expected_deltas:row.expected_deltas,atomic_plan:row.atomic_plan}}
function sumDeltas(rows){const out={row_count_deltas:{...ZERO_ROWS},logical_field_deltas:{...ZERO_LOGICAL}};for(const row of rows){for(const key of Object.keys(out.row_count_deltas))out.row_count_deltas[key]+=Number(row.expected_deltas.row_count_deltas[key]);for(const key of Object.keys(out.logical_field_deltas))out.logical_field_deltas[key]+=Number(row.expected_deltas.logical_field_deltas[key])}return out}

async function readState(target){
  const spec=TARGETS[target],url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;let retailers,products,variants,mappings,offers,history;
  if(url&&key&&new URL(url).hostname.split(".")[0]===spec.ref){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});[retailers,products,variants,mappings,offers,history]=await Promise.all([
      all(client,"retailers","id,name,slug,website",q=>q.eq("id",10)),all(client,"products","id,name,is_active,merged_into_product_id,product_format"),all(client,"product_variants","id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),all(client,"retailer_products","id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,updated_at",q=>q.eq("retailer_id",10)),all(client,"offers","id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at",q=>q.eq("retailer_id",10)),all(client,"price_history","id")]);
  }else{invariant(target==="staging"&&!process.env.GITHUB_ACTIONS,"read-only Supabase target mismatch");const values=loadEnvFile(path.join(ROOT,".env.staging.audit.local")),connection=Object.entries(values).find(([name])=>name.endsWith("_DATABASE_URL"))?.[1];invariant(connection,"staging audit credential missing");const parsed=new URL(connection);parsed.searchParams.delete("sslmode");const client=new Client({connectionString:parsed.href,ssl:{rejectUnauthorized:false},application_name:"jons-offer-refresh-staging-read",options:"-c default_transaction_read_only=on -c statement_timeout=120000"});await client.connect();try{await client.query("begin read only");[retailers,products,variants,mappings,offers,history]=await Promise.all([
        client.query("select id,name,slug,website from public.retailers where id=10").then(r=>r.rows),client.query("select id,name,is_active,merged_into_product_id,product_format from public.products").then(r=>r.rows),client.query("select id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default from public.product_variants").then(r=>r.rows),client.query("select id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') updated_at from public.retailer_products where retailer_id=10").then(r=>r.rows),client.query("select id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,to_char(last_checked_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') last_checked_at from public.offers where retailer_id=10").then(r=>r.rows),client.query("select id from public.price_history").then(r=>r.rows)]);await client.query("rollback")}finally{await client.end()}}
  invariant(retailers.length===1&&retailers[0].slug==="jon-s-supplements"&&retailers[0].website==="https://jonssupplements.co.uk","Jon's retailer mismatch");
  invariant(mappings.length===506&&offers.length===506,"Jon's approved scope must be 506/506");
  const productBy=new Map(products.map(row=>[String(row.id),row])),variantBy=new Map(variants.map(row=>[String(row.id),row])),offerByMapping=new Map(offers.map(row=>[String(row.retailer_product_id),row]));
  const records=mappings.map(mapping=>{const offer=offerByMapping.get(String(mapping.id)),product=productBy.get(String(mapping.product_id)),variant=variantBy.get(String(mapping.product_variant_id));invariant(offer&&product&&variant&&product.is_active&&!product.merged_into_product_id&&variant.is_active,"inactive or missing approved mapping state");return{product,variant,retailer:retailers[0],mapping,offer}}).sort((a,b)=>Number(a.offer.id)-Number(b.offer.id));
  invariant(new Set(records.map(row=>String(row.mapping.external_variant_id))).size===506,"duplicate approved external variant identity");
  return{records,counts:{products:products.length,variants:variants.length,mappings:mappings.length,offers:offers.length,history:history.length}};
}

function sourceFor(record,sourceByVariant){const source=sourceByVariant.get(String(record.mapping.external_variant_id));invariant(source,"missing mapped Shopify variant");invariant(String(source.external_product_id)===String(record.mapping.external_product_id),"Shopify product relationship drift");const url=new URL(`/products/${source.product_handle}`,config.store_url);url.searchParams.set("variant",String(source.external_variant_id));return{...source,url:url.href,total_price:(Number(source.price)+Number(source.shipping_cost||0)).toFixed(2)}}
function targetFor(record){return{offer_id:String(record.offer.id),retailer_product_id:String(record.mapping.id),external_product_id:String(record.mapping.external_product_id),external_variant_id:String(record.mapping.external_variant_id),external_sku:record.mapping.external_sku||null,price:money(record.offer.price),shipping_cost:money(record.offer.shipping_cost),total_price:money(record.offer.total_price),in_stock:Boolean(record.offer.in_stock),url:record.offer.url,external_url:record.mapping.external_url,last_checked_at:timestamp(record.offer.last_checked_at)}}
function verificationRecord(record,source,snapshotFingerprint,capturedAt){const mapping={...record.mapping};delete mapping.updated_at;return{source_snapshot_sha256:snapshotFingerprint,source_captured_at:capturedAt,source:{external_product_id:String(source.external_product_id),external_variant_id:String(source.external_variant_id),price:money(source.price),in_stock:Boolean(source.in_stock),url:source.url},target:{product:{...record.product,id:String(record.product.id),merged_into_product_id:record.product.merged_into_product_id==null?null:String(record.product.merged_into_product_id)},retailer:{...record.retailer,id:String(record.retailer.id)},product_variant:{...record.variant,id:String(record.variant.id),product_id:String(record.variant.product_id),size_value:record.variant.size_value==null?null:String(record.variant.size_value),pack_count:record.variant.pack_count==null?null:String(record.variant.pack_count)},retailer_product:{...mapping,id:String(mapping.id),retailer_id:String(mapping.retailer_id),product_id:String(mapping.product_id),product_variant_id:String(mapping.product_variant_id),match_confidence:mapping.match_confidence==null?null:String(mapping.match_confidence)},offer:{...record.offer,id:String(record.offer.id),product_id:String(record.offer.product_id),retailer_id:String(record.offer.retailer_id),product_variant_id:String(record.offer.product_variant_id),retailer_product_id:String(record.offer.retailer_product_id),price:money(record.offer.price),shipping_cost:money(record.offer.shipping_cost),total_price:money(record.offer.total_price),last_checked_at:timestamp(record.offer.last_checked_at)}}}}

function guardrailsFor(rows,sourceProducts,policyFingerprint=rows[0]?.policy_fingerprint){invariant(/^[0-9a-f]{64}$/.test(String(policyFingerprint||"")),"policy fingerprint is required");const changed=rows.filter(row=>row.action!=="VERIFY_NO_CHANGE"),newOos=rows.filter(row=>row.atomic_plan.expected_state.offer.in_stock&&!row.atomic_plan.offer.values.in_stock),currentOos=rows.filter(row=>!row.atomic_plan.offer.values.in_stock),previousOos=rows.filter(row=>!row.atomic_plan.expected_state.offer.in_stock),price=rows.filter(row=>row.changed_fields.price);return{schema_version:1,policy_fingerprint:policyFingerprint,source_product_count:sourceProducts,previous_source_product_count:config.source_baseline.product_count,required_source_rows:rows.length,matched_source_rows:rows.length,new_oos_count:newOos.length,total_oos_count:currentOos.length,previous_oos_count:previousOos.length,changed_row_count:changed.length,price_changed_row_count:price.length,price_anomaly_count:0,limits:{minimum_source_count_ratio:String(config.guardrails.full_snapshot_minimum_source_count_ratio),maximum_new_oos_count:String(config.guardrails.mass_oos_block_count-1),maximum_oos_increase_ratio:String(config.guardrails.maximum_oos_increase_percentage_points),maximum_total_oos_ratio:String(config.guardrails.maximum_total_oos_ratio),maximum_changed_record_ratio:String(config.guardrails.maximum_changed_record_ratio),mass_price_change_ratio:String(config.guardrails.mass_price_change_block_ratio),price_anomaly_ratio:String(config.guardrails.per_row_price_hard_block_ratio),price_anomaly_absolute_gbp:String(config.guardrails.per_row_price_hard_block_absolute_gbp)},result:"PASS"}}

async function buildRun(target,state,diagnostic=null){
  const spec=TARGETS[target],capturedAt=new Date().toISOString();
  let snapshot;
  try{
    snapshot=await readShopifySnapshot({storeUrl:config.store_url,marketCountry:"GB",noCache:true,capturedAt,timeoutMs:config.source_fetch.timeout_ms,maximumPages:config.source_fetch.maximum_pages,maximumAttempts:config.source_fetch.maximum_attempts,retryBaseDelayMs:config.source_fetch.retry_base_delay_ms,userAgent:config.source_fetch.user_agent});
  }catch(error){
    if(diagnostic&&error.diagnostic)Object.assign(diagnostic.source,{http_status:error.diagnostic.final_http_status,content_type:error.diagnostic.final_content_type,bytes_received:error.diagnostic.bytes_received||0,pages_fetched:error.diagnostic.pages_fetched||0,pagination_completed:Boolean(error.diagnostic.pagination_completed),request_headers:error.diagnostic.request_headers||null,redirect_policy:error.diagnostic.redirect_policy||null,retries:error.diagnostic.retry_count||0,pages:error.diagnostic.pages||[]});
    throw new RefreshError(error.code||"SOURCE_UNAVAILABLE",error.message,"SOURCE_FETCH",{source_diagnostic:error.diagnostic||null});
  }
  const sourceVariants=projectShopifyVariants(snapshot,{shippingCost:"3.99"}),health=sourceHealth(snapshot,sourceVariants);
  if(diagnostic){applySourceDiagnostic(diagnostic,snapshot,sourceVariants,health);diagnostic.guard_results.push({guard:"SOURCE_HEALTH",result:health.result,code:health.code,product_ratio:health.product_ratio,variant_ratio:health.variant_ratio,threshold:health.minimum_ratio,genuine_collapse_threshold:health.genuine_collapse_ratio})}
  if(health.result!=="PASS")throw new RefreshError(health.code,`Jon's source guard blocked: ${health.code}`,"SOURCE_GUARD",health);
  invariant(new Set(sourceVariants.map(row=>String(row.external_variant_id))).size===sourceVariants.length,"duplicate source identity");
  const duplicateSku=new Map();for(const row of sourceVariants)if(row.external_sku)duplicateSku.set(row.external_sku,(duplicateSku.get(row.external_sku)||0)+1);
  const targets=state.records.map(targetFor),targetByVariant=new Map(targets.map(row=>[row.external_variant_id,row]));for(const row of sourceVariants){const targetRow=targetByVariant.get(String(row.external_variant_id));if(targetRow&&targetRow.external_sku===null&&row.external_sku&&duplicateSku.get(row.external_sku)>1)row.external_sku=null}
  const policy={...config.guardrails,required_matched_offers:506,store_url:config.store_url};
  const classification=classifyExistingOffers({targets,sourceVariants,policy,sourceCapturedAt:capturedAt,now:new Date(capturedAt),sourceProductCount:snapshot.products.length,previousSourceProductCount:config.source_baseline.product_count});
  if(classification.state!=="DRY_RUN_READY"||classification.rows.length!==506)throw new RefreshError(classification.reason||"CLASSIFIER_BLOCKED","full Jon's classifier blocked","CLASSIFIER",classification.detail||{});
  const sourceByVariant=new Map(sourceVariants.map(row=>[String(row.external_variant_id),row])),recordByOffer=new Map(state.records.map(row=>[String(row.offer.id),row])),binding=migrationBinding(spec.environment),head=process.env.GITHUB_SHA||git("rev-parse","HEAD"),policyFingerprint=sha256(config),adapterFingerprint=sha256({reader:fs.readFileSync(path.join(ROOT,"scripts","lib","shopify-snapshot-reader.js"),"utf8"),classifier:fs.readFileSync(path.join(ROOT,"scripts","lib","retailer-offer-sync","classifier.js"),"utf8"),config}),expectedStateFingerprint=canonicalHash(state.records.map(row=>({product:row.product,variant:row.variant,mapping:row.mapping,offer:row.offer}))),rows=[];
  for(const classified of classification.rows){const record=recordByOffer.get(String(classified.offer_id)),source=sourceFor(record,sourceByVariant);let plan;if(classified.action==="VERIFY_NO_CHANGE")plan=buildVerifiedNoChangePlan(verificationRecord(record,source,snapshot.semantic_source_fingerprint,capturedAt),{targetEnvironment:spec.environment,targetProjectRef:spec.ref,sourceSnapshotSha256s:new Set([snapshot.semantic_source_fingerprint]),now:new Date(capturedAt)}).plan;else{const built=buildExistingOfferUpdatePlan({product:record.product,variant:record.variant,retailer:record.retailer,mapping:record.mapping,offer:record.offer,source:{...source,url:source.url,shipping_cost:source.shipping_cost,total_price:source.total_price},sourceCapturedAt:capturedAt,sourceSnapshotFingerprint:snapshot.semantic_source_fingerprint});plan=built.plan;invariant(built.changed.price===classified.changed_fields.price&&built.changed.stock===classified.changed_fields.stock&&built.changed.url===classified.changed_fields.url,"classifier/plan changed-field mismatch")}
    rows.push({...classified,atomic_plan:plan,policy_fingerprint:policyFingerprint});
  }
  const artifacts=[];for(let offset=0;offset<rows.length;offset+=50){const part=rows.slice(offset,offset+50).map(executionRow),expected=sumDeltas(part),actionManifestFingerprint=canonicalHash({state:"DRY_RUN_READY",rows:part,expected_deltas:expected});artifacts.push(sealArtifact({kind:"retailer-existing-offer-mixed-batch-execution",retailer_slug:"jon-s-supplements",retailer_id:"10",target_environment:spec.environment,target_project_ref:spec.ref,target_database_identity:spec.identity,expected_migration_versions:binding.versions,expected_migration_fingerprint:binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",source_snapshot_fingerprint:snapshot.semantic_source_fingerprint,adapter_fingerprint:adapterFingerprint,policy_fingerprint:policyFingerprint,code_commit:head,expected_state_fingerprint:expectedStateFingerprint,source_captured_at:capturedAt,state:"DRY_RUN_READY",block:null,rows:part,expected_deltas:expected,action_manifest_fingerprint:actionManifestFingerprint}))}
  const manifest=[...state.records].sort((a,b)=>Number(a.mapping.id)-Number(b.mapping.id)).map(row=>({mapping_id:String(row.mapping.id),offer_id:String(row.offer.id),external_product_id:String(row.mapping.external_product_id),external_variant_id:String(row.mapping.external_variant_id)}));
  const sourceIds=new Set(sourceVariants.map(row=>String(row.external_variant_id))),mappedIds=new Set(manifest.map(row=>row.external_variant_id));
  const discovery={new_variants:[...sourceIds].filter(id=>!mappedIds.has(id)),missing_variants:[...mappedIds].filter(id=>!sourceIds.has(id))};
  if(diagnostic){diagnostic.mappings_matched=manifest.length-discovery.missing_variants.length;diagnostic.mappings_missing=discovery.missing_variants.length;diagnostic.guard_results.push({guard:"APPROVED_MAPPING_COVERAGE",result:discovery.missing_variants.length===0?"PASS":"BLOCK",expected:manifest.length,matched:diagnostic.mappings_matched,missing:discovery.missing_variants.length})}
  return{target,spec,capturedAt,snapshot,sourceVariants,classification,artifacts,manifest,manifestFingerprint:canonicalHash(manifest),binding,head,discovery};
}

async function roleCall(target,kind,readOnly,body){const spec=TARGETS[target],client=new Client({connectionString:roleCredential(target,kind),ssl:{rejectUnauthorized:false},application_name:`jons-offer-refresh-${kind}`,options:"-c statement_timeout=120000"});await client.connect();try{await client.query(readOnly?"begin read only":"begin");await client.query(`select set_config('app.safe_update','false',true),set_config('app.retailer_catalogue_${target}_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)`);await client.query(`set role retailer_catalogue_${target}_${kind}`);const who=(await client.query("select current_user,session_user,current_setting('transaction_read_only') ro")).rows[0];invariant(who.current_user===`retailer_catalogue_${target}_${kind}`,`${kind} role mismatch`);if(readOnly)invariant(who.ro==="on",`${kind} transaction is not read-only`);const result=await body(client,spec);await client.query(readOnly?"rollback":"commit");return{result,identity:who}}catch(error){try{await client.query("rollback")}catch{}throw error}finally{await client.end()}}
function validationRequest(run,artifact){const expires=new Date(Date.now()+14*60000).toISOString(),guard=guardrailsFor(artifact.rows,run.snapshot.products.length,artifact.policy_fingerprint),request={schema_version:1,kind:"retailer-existing-offer-mixed-batch-read-only-validation",artifact,validation_expires_at:expires,[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",code_commit:run.head,source_snapshot_fingerprint:artifact.source_snapshot_fingerprint,policy_fingerprint:artifact.policy_fingerprint,action_manifest_fingerprint:artifact.action_manifest_fingerprint,artifact_fingerprint:artifact.artifact_fingerprint,guardrails:guard,batch_fingerprint:canonicalHash({artifact_fingerprint:artifact.artifact_fingerprint,action_manifest_fingerprint:artifact.action_manifest_fingerprint,policy_fingerprint:artifact.policy_fingerprint,source_snapshot_fingerprint:artifact.source_snapshot_fingerprint,row_count:artifact.rows.length,rows:artifact.rows}),package_fingerprint:null};request.package_fingerprint=canonicalHash(request);return request}
async function validate(run){const outputs=[];for(const artifact of run.artifacts){const request=validationRequest(run,artifact),call=await roleCall(run.target,"validator",true,client=>client.query("select public.validate_retailer_offer_sync_batch_read_only($1::jsonb) result",[request]));const result=call.result.rows[0].result;invariant(result.valid&&result.status==="DRY_RUN_VALIDATED"&&Number(result.row_count)===artifact.rows.length,"validator rejected child");outputs.push({request,result,identity:call.identity})}return outputs}
function registrationRequest(run){const parentId=uuid(),children=run.artifacts.map(artifact=>({child_plan_id:uuid(),artifact})),workflow={repository:process.env.GITHUB_REPOSITORY||"SupplementScout/supplementscout",run_id:process.env.GITHUB_RUN_ID||`local-${Date.now()}`,run_attempt:process.env.GITHUB_RUN_ATTEMPT||"1",actor:process.env.GITHUB_ACTOR||"local-authorised-operator"},expiresAt=new Date(Date.now()+14*60000).toISOString(),parentHashInput={schema_version:1,kind:"jons-existing-offer-sync-parent",parent_plan_id:parentId,target_environment:run.spec.environment,target_project_ref:run.spec.ref,target_database_identity:run.spec.identity,retailer_id:"10",source_country:"GB",source_snapshot_fingerprint:run.snapshot.semantic_source_fingerprint,source_captured_at:run.capturedAt,manifest_fingerprint:run.manifestFingerprint,child_plan_ids:children.map(row=>row.child_plan_id),child_fingerprints:children.map(row=>row.artifact.artifact_fingerprint),code_commit:run.head,expires_at:expiresAt,workflow};const request={schema_version:1,kind:"jons-existing-offer-sync-control-plan-registration",target_environment:run.spec.environment,target_project_ref:run.spec.ref,target_database_identity:run.spec.identity,retailer_id:"10",retailer_slug:"jon-s-supplements",source_platform:"SHOPIFY",source_domain:"jonssupplements.co.uk",source_country:"GB",source_snapshot_fingerprint:run.snapshot.semantic_source_fingerprint,source_captured_at:run.capturedAt,manifest:run.manifest,manifest_fingerprint:run.manifestFingerprint,parent_plan_id:parentId,parent_plan_fingerprint:canonicalHash(parentHashInput),children,code_commit:run.head,expires_at:expiresAt,workflow,request_fingerprint:null};request.request_fingerprint=canonicalHash(request);return request}
async function register(run,request){const call=await roleCall(run.target,"validator",false,client=>client.query("select public.register_jons_offer_sync_control_plan($1::jsonb) result",[request]));const result=call.result.rows[0].result;invariant(result.status==="REGISTERED"&&Number(result.mapping_count)===506&&Number(result.child_count)===run.artifacts.length&&Number(result.business_writes)===0,"registration failed");return{result,identity:call.identity}}
async function approveAndExecute(run,registration,validations){const results=[],expiresAt=registration.expires_at;invariant(Date.parse(expiresAt)>Date.now()&&Date.parse(expiresAt)<=Date.now()+15*60000,"registered approval expiry is invalid");for(let index=0;index<registration.children.length;index++){const child=registration.children[index],artifact=child.artifact,executionFingerprint=canonicalHash({child_plan_id:child.child_plan_id,artifact_fingerprint:artifact.artifact_fingerprint,target_environment:run.spec.environment,project_ref:run.spec.ref,database_identity:run.spec.identity,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1"}),approvalRequest={schema_version:1,child_plan_id:child.child_plan_id,parent_plan_fingerprint:registration.parent_plan_fingerprint,child_plan_fingerprint:artifact.artifact_fingerprint,artifact,execution_fingerprint:executionFingerprint,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",approved_by:`github-jons-sync:${registration.workflow.run_id}`,expires_at:expiresAt,[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity};const approved=await roleCall(run.target,"approver",false,client=>client.query("select public.approve_retailer_offer_sync_batch($1::jsonb) result",[approvalRequest])),approval=approved.result.rows[0].result;invariant(approval.status==="APPROVED","approval failed");const executeRequest={schema_version:1,approval_id:approval.approval_id,execution_fingerprint:executionFingerprint,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity,requested_at:new Date().toISOString(),explicit_allow:true};const executed=await roleCall(run.target,"executor",false,client=>client.query("select public.execute_retailer_offer_sync_batch($1::jsonb) result",[executeRequest])),result=executed.result.rows[0].result;invariant(result.status==="APPLIED"&&Number(result.row_approvals_created)===artifact.rows.length,"executor failed");results.push({validation:validations[index].result,approval,result})}return results}

async function executeRefresh(args,diagnostic){
  const spec=TARGETS[args.target];
  invariant(!process.env.SAFE_UPDATE,"SAFE_UPDATE must be unset");
  invariant(git("branch","--show-current")==="main","main required");
  if(!process.env.GITHUB_ACTIONS)invariant(git("status","--short").split(/\r?\n/).filter(line=>line&&!line.startsWith("?? tmp/")).length===0,"unexpected tracked worktree changes");
  const before=await readState(args.target);
  diagnostic.approved_mapping_count=before.counts.mappings;
  diagnostic.approved_offer_count=before.counts.offers;
  diagnostic.database_before=before.counts;
  const run=await buildRun(args.target,before,diagnostic);
  if(run.discovery.missing_variants.length!==0)throw new RefreshError("SOURCE_INCOMPLETE","missing mapped source identity","SOURCE_GUARD",{missing_variants:run.discovery.missing_variants});
  const counts={};for(const row of run.classification.rows)counts[row.action]=(counts[row.action]||0)+1;
  const validations=await validate(run);
  diagnostic.validator_result="PASS";
  diagnostic.guard_results.push({guard:"VALIDATOR",result:"PASS",batches:validations.length});
  const base={result:"PASS",mode:args.mode,target:args.target,project_ref:spec.ref,source:{country:"GB",products:run.snapshot.products.length,variants:run.sourceVariants.length,available:run.sourceVariants.filter(row=>row.in_stock).length,fingerprint:run.snapshot.semantic_source_fingerprint,diagnostic:run.snapshot.source_diagnostic},scope:{mappings:506,offers:506,children:run.artifacts.length},classification:counts,expected_deltas:run.classification.expected_deltas,discovery:{new_variants:run.discovery.new_variants.length,missing_variants:0},validator_batches:validations.length,safe_update:"unset"};
  if(args.mode==="dry-run"){write(`${args.target}-dry-run.json`,base);return base}
  diagnostic.database_writes_attempted=1;
  const registration=registrationRequest(run),registered=await register(run,registration);
  diagnostic.control_writes_completed=1;
  const executions=await approveAndExecute(run,registration,validations);
  diagnostic.approver_result="PASS";
  diagnostic.executor_result="PASS";
  diagnostic.approvals_created=executions.length;
  diagnostic.approvals_consumed=executions.length;
  const after=await readState(args.target);
  invariant(after.counts.products===before.counts.products&&after.counts.variants===before.counts.variants&&after.counts.mappings===before.counts.mappings&&after.counts.offers===before.counts.offers,"forbidden catalogue row-count delta");
  const historyDelta=after.counts.history-before.counts.history;
  diagnostic.database_after=after.counts;
  diagnostic.database_writes_completed=executions.length;
  diagnostic.business_writes_completed=506;
  const output={...base,registration:registered.result,executions:executions.map(row=>row.result),business:{products_delta:0,variants_delta:0,mappings_delta:0,offers_delta:0,price_history_delta:historyDelta,offers_refreshed:506},recovery_calls:0};
  write(`${args.target}-apply.json`,output);
  return output;
}
async function runWithDiagnostic(argv=process.argv.slice(2),{operation=executeRefresh,outDir=OUT,env=process.env}={}){
  fs.mkdirSync(outDir,{recursive:true});
  const name=diagnosticName(argv,env),diagnostic=diagnosticTemplate(argv,env);
  writeDiagnostic(name,diagnostic,outDir);
  try{
    loadEnvironment();
    const args=parseArgs(argv);
    const result=await operation(args,diagnostic);
    diagnostic.result="PASS";
    diagnostic.completed_at=new Date().toISOString();
    diagnostic.failure_stage=null;
    diagnostic.error_code=null;
    diagnostic.error_message=null;
    writeDiagnostic(name,diagnostic,outDir);
    return{result,diagnostic,diagnostic_path:path.join(outDir,name)};
  }catch(error){
    diagnostic.result="FAIL";
    diagnostic.completed_at=new Date().toISOString();
    diagnostic.failure_stage=error.stage||"STARTUP_OR_INTERNAL";
    diagnostic.error_code=error.code||"INTERNAL_ERROR";
    diagnostic.error_message=error.message;
    if(error.detail&&Object.keys(error.detail).length)diagnostic.error_detail=error.detail;
    writeDiagnostic(name,diagnostic,outDir);
    throw error;
  }
}
async function main(argv=process.argv.slice(2)){
  const completed=await runWithDiagnostic(argv);
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
module.exports={RefreshError,buildRun,canonicalHash,diagnosticTemplate,executionRow,guardrailsFor,migrationBinding,parseArgs,readState,registrationRequest,runWithDiagnostic,sourceHealth,sumDeltas,verificationRecord};
