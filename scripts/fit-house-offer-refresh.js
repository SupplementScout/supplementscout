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
const {migrationBinding}=require("./lib/environment-migrations");
const {canonicalJson}=require("./lib/canonical-json");
const {bindReviewedMixedChangeContract,buildMappedScopeEvidence,buildReviewedMixedChangeContract,buildScopedSourceEvidence}=require("./lib/retailer-offer-sync/reviewed-mixed-change");
const PROFILE=process.env.RETAILER_REFRESH_PROFILE||"fit-house";
const PROFILE_CONFIGS={"fit-house":"../config/retailers/fit-house-offer-sync.json","simply-supplements":"../config/retailers/simply-supplements-offer-sync.json"};
invariantProfile(PROFILE_CONFIGS[PROFILE],`unsupported retailer refresh profile ${PROFILE}`);
const config=require(PROFILE_CONFIGS[PROFILE]);
config.output_directory||="fit-house-offer-refresh";
config.environment_prefix||="FIT_HOUSE_SYNC";
config.phase_prefix||="FIT_HOUSE_REFRESH";
config.registration_rpc||="register_fit_house_offer_sync_control_plan";
config.guard_scope_name||="FIT_HOUSE_APPROVED_286";
config.manifest_mode||="row_manifest";

const ROOT=path.resolve(__dirname,"..");
const OUT=path.join(ROOT,"tmp",config.output_directory);
const TARGETS={staging:{environment:"STAGING",ref:"hxnrsyyqffztlvcrtgbf",identity:"supplementscout-staging:hxnrsyyqffztlvcrtgbf"},production:{environment:"PRODUCTION",ref:"aftboxmrdgyhizicfsfu",identity:"supplementscout-production:aftboxmrdgyhizicfsfu"}};
const ZERO_ROWS={products:0,product_variants:0,retailer_products:0,offers:0,price_history:0};
const ZERO_LOGICAL={offer_price_updates:0,offer_shipping_updates:0,offer_total_updates:0,offer_stock_updates:0,offer_url_updates:0,mapping_url_updates:0,mapping_updated_at_updates:0,last_checked_at_updates:0};

class RefreshError extends Error{
  constructor(code,message,stage,detail={}){super(message);this.name="RefreshError";this.code=code;this.stage=stage;this.detail=detail}
}
function invariantProfile(value,message){if(!value)throw new Error(message)}
function invariant(value,message){if(!value)throw new Error(message)}
function parseArgs(argv){const out={};for(const arg of argv){const m=arg.match(/^--([^=]+)=(.*)$/);if(!m||out[m[1]]!==undefined||!["target","mode"].includes(m[1]))throw new Error(`invalid argument ${arg}`);out[m[1]]=m[2]}if(!TARGETS[out.target]||!["dry-run","apply"].includes(out.mode))throw new Error("required --target=staging|production --mode=dry-run|apply");return out}
function loadEnvFile(file){if(!fs.existsSync(file))return{};const out={};for(const line of fs.readFileSync(file,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)out[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,"$2")}return out}
function loadEnvironment(){Object.assign(process.env,Object.fromEntries(Object.entries(loadEnvFile(path.join(ROOT,".env.local"))).filter(([key])=>!process.env[key])))}
function roleCredential(target,kind){const direct=process.env[`${config.environment_prefix}_${kind.toUpperCase()}_DATABASE_URL`];let url=direct;if(!url){const file=target==="production"?path.join(process.env.USERPROFILE||"", ".supplementscout","credentials",`production-${kind}.env`):path.join(ROOT,`.env.staging.${kind}.local`);const values=loadEnvFile(file);url=Object.entries(values).find(([key])=>key.endsWith("_DATABASE_URL"))?.[1]}invariant(url,`missing ${kind} database URL`);const parsed=new URL(url);parsed.searchParams.delete("sslmode");invariant(!parsed.href.includes(TARGETS[target==="production"?"staging":"production"].ref),`${kind} opposite target`);return parsed.href}
function git(...args){return execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:30000}).trim()}
function canonicalHash(value){return sha256(canonicalJson(JSON.parse(JSON.stringify(value))))}
function uuid(){return crypto.randomUUID()}
function write(name,value){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,name),`${JSON.stringify(value,null,2)}\n`)}
function loadApprovedManifest(){
  const file=path.join(ROOT,config.manifest_path),bytes=fs.readFileSync(file),actual=crypto.createHash("sha256").update(bytes).digest("hex");
  invariant(actual===config.manifest_sha256,"approved manifest SHA mismatch");
  const manifest=JSON.parse(bytes);
  if(config.manifest_mode==="authority_fingerprint"){
    invariant(manifest.retailer_id===config.retailer_id&&manifest.retailer_slug===config.retailer_slug&&manifest.row_count===config.approved_mapping_count&&manifest.artifact_fingerprint===config.authority_artifact_fingerprint,"approved authority shape mismatch");
  }else{
    invariant(manifest.retailer?.id===config.retailer_id&&manifest.retailer?.slug===config.retailer_slug&&manifest.approved_mapping_count===config.approved_mapping_count&&manifest.rows?.length===config.approved_mapping_count,"approved manifest shape mismatch");
    invariant(new Set(manifest.rows.map(row=>String(row.external_variant_id))).size===config.approved_mapping_count,"approved manifest duplicate variant identity");
  }
  return{manifest,sha256:actual};
}
function sourceHealth(snapshot,sourceVariants){
  const baseline=config.source_baseline;
  invariant(baseline&&baseline.product_count>0&&baseline.variant_count>0,`${config.retailer_name} source baseline missing`);
  const rawVariants=snapshot.products.reduce((count,product)=>count+(Array.isArray(product.variants)?product.variants.length:0),0);
  const productRatio=snapshot.products.length/baseline.product_count,variantRatio=sourceVariants.length/baseline.variant_count,ratio=Math.min(productRatio,variantRatio);
  const evidence={baseline_products:baseline.product_count,baseline_variants:baseline.variant_count,product_count:snapshot.products.length,raw_variant_count:rawVariants,normalised_variant_count:sourceVariants.length,product_ratio:productRatio,variant_ratio:variantRatio,observed_ratio:ratio,minimum_ratio:baseline.minimum_count_ratio,genuine_collapse_ratio:baseline.genuine_collapse_ratio};
  if(!snapshot.source_diagnostic?.pagination_completed||snapshot.products.length===0||rawVariants===0||sourceVariants.length===0)return{result:"BLOCK",code:"SOURCE_INCOMPLETE",...evidence};
  if(ratio<baseline.genuine_collapse_ratio)return{result:"BLOCK",code:"GENUINE_SOURCE_COLLAPSE",...evidence};
  if(ratio<baseline.minimum_count_ratio)return{result:"BLOCK",code:"SOURCE_DEGRADED",...evidence};
  return{result:"PASS",code:null,...evidence};
}
function projectSourceVariants(snapshot){
  const rows=projectShopifyVariants(snapshot,{shippingCost:config.shipping_policy.mode==="fixed"?config.shipping_policy.cost_gbp:null});
  if(config.shipping_policy.mode==="threshold")for(const row of rows){const price=Number(row.price);row.shipping_cost=(price>=Number(config.shipping_policy.free_from_gbp)?0:Number(config.shipping_policy.standard_gbp)).toFixed(2)}
  return rows;
}
function diagnosticName(argv,env=process.env){
  const target=argv.find(value=>value.startsWith("--target="))?.slice(9)||"unknown";
  const mode=argv.find(value=>value.startsWith("--mode="))?.slice(7)||"startup";
  const phase=String(env[`${config.phase_prefix}_PHASE`]||mode).replace(/[^a-z0-9_-]+/gi,"-").toLowerCase();
  return`${target}-${phase}-diagnostic.json`;
}
function diagnosticTemplate(argv,env=process.env){
  let commit=env.GITHUB_SHA||null;try{commit||=git("rev-parse","HEAD")}catch{}
  return{
    schema_version:1,
    timestamp:new Date().toISOString(),
    result:"STARTED",
    workflow_run_context:{repository:env.GITHUB_REPOSITORY||"SupplementScout/supplementscout",run_id:env.GITHUB_RUN_ID||null,run_attempt:env.GITHUB_RUN_ATTEMPT||null,actor:env.GITHUB_ACTOR||null,event_name:env.GITHUB_EVENT_NAME||"local",ref:env.GITHUB_REF||null,actions:env.GITHUB_ACTIONS==="true"},
    trigger_type:env[`${config.phase_prefix}_TRIGGER_TYPE`]||env.GITHUB_EVENT_NAME||"local",
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
async function all(client,table,columns,filter){const out=[];for(let from=0;;from+=1000){let query=client.from(table).select(columns).range(from,from+999);if(filter)query=filter(query);const{data,error}=await query;if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)return out}}
function money(value){return value==null?null:Number(value).toFixed(2)}
function timestamp(value){return value instanceof Date?value.toISOString():value}
function executionRow(row){return{offer_id:row.offer_id,retailer_product_id:row.retailer_product_id,external_product_id:row.external_product_id,external_variant_id:row.external_variant_id,action:row.action,changed_fields:row.changed_fields,source_captured_at:row.source_captured_at,expected_deltas:row.expected_deltas,atomic_plan:row.atomic_plan}}
function sumDeltas(rows){const out={row_count_deltas:{...ZERO_ROWS},logical_field_deltas:{...ZERO_LOGICAL}};for(const row of rows){for(const key of Object.keys(out.row_count_deltas))out.row_count_deltas[key]+=Number(row.expected_deltas.row_count_deltas[key]);for(const key of Object.keys(out.logical_field_deltas))out.logical_field_deltas[key]+=Number(row.expected_deltas.logical_field_deltas[key])}return out}
function balancedExecutionBatches(rows,maximumBatchSize=50,maximumNewOosPerBatch=3){invariant(Number.isInteger(maximumBatchSize)&&maximumBatchSize>0,"invalid maximum batch size");invariant(Number.isInteger(maximumNewOosPerBatch)&&maximumNewOosPerBatch>0,"invalid new OOS batch limit");if(rows.length===0)return[];const newOos=rows.filter(row=>Boolean(row.atomic_plan.expected_state.offer.in_stock)&&!Boolean(row.atomic_plan.offer.values.in_stock)),count=Math.max(Math.ceil(rows.length/maximumBatchSize),Math.ceil(newOos.length/maximumNewOosPerBatch)),batches=Array.from({length:count},()=>[]),existingOos=[],inStock=[];for(const row of rows){const before=Boolean(row.atomic_plan.expected_state.offer.in_stock),after=Boolean(row.atomic_plan.offer.values.in_stock);if(!after&&before)continue;else if(!after)existingOos.push(row);else inStock.push(row)}let cursor=0;for(const group of[newOos,existingOos,inStock])for(const row of group){while(batches[cursor%count].length>=maximumBatchSize)cursor+=1;batches[cursor%count].push(row);cursor+=1}for(const batch of batches){batch.sort((a,b)=>Number(a.offer_id)-Number(b.offer_id));invariant(batch.length>0&&batch.length<=maximumBatchSize,"balanced batch size drift");invariant(batch.filter(row=>Boolean(row.atomic_plan.expected_state.offer.in_stock)&&!Boolean(row.atomic_plan.offer.values.in_stock)).length<=maximumNewOosPerBatch,"new OOS batch limit exceeded")}invariant(batches.reduce((sum,batch)=>sum+batch.length,0)===rows.length,"balanced batch coverage drift");return batches}

function reconcileMissingMappedVariants(targets,sourceVariants,discoveryPolicy=config.discovery_policy){
  invariant(["MARK_UNAVAILABLE","BLOCK"].includes(discoveryPolicy?.missing_mapped_variant_mode),"missing mapped variant policy must fail closed");
  const sourceIds=new Set(sourceVariants.map(row=>String(row.external_variant_id)));
  const missing=targets.filter(target=>!sourceIds.has(String(target.external_variant_id)));
  const maximumCount=Number(discoveryPolicy.maximum_missing_mapped_variants);
  const maximumRatio=Number(discoveryPolicy.maximum_missing_mapped_variant_ratio);
  invariant(Number.isInteger(maximumCount)&&maximumCount>=0&&maximumRatio>=0&&maximumRatio<=1,"invalid missing mapped variant limits");
  invariant(missing.length<=maximumCount&&missing.length/Math.max(1,targets.length)<=maximumRatio,"missing mapped variant safety limit exceeded");
  if(discoveryPolicy.missing_mapped_variant_mode==="BLOCK")return{sourceVariants,missingVariantIds:[],newUnavailableCount:0};
  const unavailable=missing.map(target=>{
    const currentUrl=new URL(target.external_url||target.url);
    const expectedHost=new URL(config.store_url).hostname.toLowerCase().replace(/^www\./,"");
    invariant(currentUrl.hostname.toLowerCase().replace(/^www\./,"")===expectedHost,"missing variant URL domain drift");
    const match=currentUrl.pathname.match(/^\/products\/([^/]+)\/?$/);
    invariant(match,"missing variant product URL drift");
    return{external_product_id:String(target.external_product_id),external_variant_id:String(target.external_variant_id),external_sku:target.external_sku||null,product_handle:decodeURIComponent(match[1]),price:money(target.price),shipping_cost:money(target.shipping_cost),total_price:money(target.total_price),in_stock:false,source_absence:true};
  });
  return{sourceVariants:[...sourceVariants,...unavailable],missingVariantIds:missing.map(row=>String(row.external_variant_id)),newUnavailableCount:missing.filter(row=>row.in_stock).length};
}

function loadReviewedMassOosManifest(){
  const policy=config.discovery_policy,file=path.join(ROOT,policy.reviewed_mass_oos_manifest_path||""),bytes=fs.readFileSync(file),actual=crypto.createHash("sha256").update(bytes).digest("hex");
  invariant(actual===policy.reviewed_mass_oos_manifest_sha256,"reviewed mass OOS manifest SHA mismatch");
  const manifest=JSON.parse(bytes),topKeys=["schema_version","kind","retailer_id","retailer_slug","target_environment","authorized_by","authorized_at","source_snapshot_fingerprint","row_count","rows"].sort();
  invariant(JSON.stringify(Object.keys(manifest).sort())===JSON.stringify(topKeys)&&manifest.schema_version===1&&manifest.kind==="fit-house-reviewed-mass-oos-v1"&&manifest.retailer_id===9&&manifest.retailer_slug==="fit-house"&&manifest.target_environment==="PRODUCTION","reviewed mass OOS manifest contract mismatch");
  invariant(typeof manifest.authorized_by==="string"&&manifest.authorized_by.startsWith("owner-instruction-")&&Number.isFinite(Date.parse(manifest.authorized_at))&&/^[0-9a-f]{64}$/.test(manifest.source_snapshot_fingerprint),"reviewed mass OOS authority mismatch");
  invariant(Array.isArray(manifest.rows)&&manifest.row_count===manifest.rows.length&&manifest.row_count>0,"reviewed mass OOS row count mismatch");
  const rowKeys=["offer_id","mapping_id","external_product_id","external_variant_id","action","old_price","new_price","old_stock","new_stock"].sort();
  for(const row of manifest.rows)invariant(JSON.stringify(Object.keys(row).sort())===JSON.stringify(rowKeys)&&/^\d+$/.test(row.offer_id)&&/^\d+$/.test(row.mapping_id)&&/^\d+$/.test(row.external_product_id)&&/^\d+$/.test(row.external_variant_id)&&["UPDATE_STOCK","UPDATE_PRICE_AND_STOCK"].includes(row.action)&&row.old_stock===true&&row.new_stock===false,"reviewed mass OOS row contract mismatch");
  invariant(new Set(manifest.rows.map(row=>row.offer_id)).size===manifest.row_count&&manifest.rows.every((row,index)=>index===0||Number(manifest.rows[index-1].offer_id)<Number(row.offer_id)),"reviewed mass OOS identities must be unique and ascending");
  return{manifest,sha256:actual};
}

function authorizeReviewedMassOos(classification,sourceFingerprint){
  if(classification.state!=="BLOCKED"||classification.reason!=="MASS_OOS")return{classification,review:null};
  if(config.reviewed_mass_oos_enabled===false)return{classification,review:null};
  const reviewed=loadReviewedMassOosManifest();
  invariant(sourceFingerprint===reviewed.manifest.source_snapshot_fingerprint,"reviewed mass OOS source fingerprint drift");
  const rows=classification.rows.filter(row=>row.target.in_stock&&!row.source.in_stock).map(row=>({offer_id:String(row.offer_id),mapping_id:String(row.retailer_product_id),external_product_id:String(row.external_product_id),external_variant_id:String(row.external_variant_id),action:row.action,old_price:money(row.target.price),new_price:money(row.source.price),old_stock:true,new_stock:false}));
  invariant(canonicalHash(rows)===canonicalHash(reviewed.manifest.rows),"reviewed mass OOS scope drift");
  return{classification:{...classification,state:"DRY_RUN_READY",reason:null,action:"REVIEWED_MASS_OOS"},review:{manifest_sha256:reviewed.sha256,authorized_by:reviewed.manifest.authorized_by,authorized_at:reviewed.manifest.authorized_at,row_count:reviewed.manifest.row_count,source_snapshot_fingerprint:sourceFingerprint}};
}

async function readState(target){
  const spec=TARGETS[target],url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;let retailers,products,variants,mappings,offers,history;
  if(url&&key&&new URL(url).hostname.split(".")[0]===spec.ref){const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});[retailers,products,variants,mappings,offers,history]=await Promise.all([
      all(client,"retailers","id,name,slug,website",q=>q.eq("id",config.retailer_id)),all(client,"products","id,name,is_active,merged_into_product_id,product_format"),all(client,"product_variants","id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),all(client,"retailer_products","id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,updated_at",q=>q.eq("retailer_id",config.retailer_id)),all(client,"offers","id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at",q=>q.eq("retailer_id",config.retailer_id)),all(client,"price_history","id")]);
  }else{invariant(target==="staging"&&!process.env.GITHUB_ACTIONS,"read-only Supabase target mismatch");const values=loadEnvFile(path.join(ROOT,".env.staging.audit.local")),connection=Object.entries(values).find(([name])=>name.endsWith("_DATABASE_URL"))?.[1];invariant(connection,"staging audit credential missing");const parsed=new URL(connection);parsed.searchParams.delete("sslmode");const client=new Client({connectionString:parsed.href,ssl:{rejectUnauthorized:false},application_name:`${config.retailer_slug}-offer-refresh-staging-read`,options:"-c default_transaction_read_only=on -c statement_timeout=120000"});await client.connect();try{await client.query("begin read only");[retailers,products,variants,mappings,offers,history]=await Promise.all([
        client.query("select id,name,slug,website from public.retailers where id=$1",[config.retailer_id]).then(r=>r.rows),client.query("select id,name,is_active,merged_into_product_id,product_format from public.products").then(r=>r.rows),client.query("select id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default from public.product_variants").then(r=>r.rows),client.query("select id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_options,external_name,external_slug,external_gtin,external_url,match_method,match_confidence,to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') updated_at from public.retailer_products where retailer_id=$1",[config.retailer_id]).then(r=>r.rows),client.query("select id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,to_char(last_checked_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') last_checked_at from public.offers where retailer_id=$1",[config.retailer_id]).then(r=>r.rows),client.query("select id from public.price_history").then(r=>r.rows)]);await client.query("rollback")}finally{await client.end()}}
  invariant(retailers.length===1&&retailers[0].slug===config.retailer_slug&&retailers[0].website===config.store_url,`${config.retailer_name} retailer mismatch`);
  invariant(mappings.length===config.approved_mapping_count&&offers.length===config.approved_mapping_count,`${config.retailer_name} approved scope must be ${config.approved_mapping_count}/${config.approved_mapping_count}`);
  const approved=loadApprovedManifest();
  const productBy=new Map(products.map(row=>[String(row.id),row])),variantBy=new Map(variants.map(row=>[String(row.id),row])),offerByMapping=new Map(offers.map(row=>[String(row.retailer_product_id),row]));
  const records=mappings.map(mapping=>{const offer=offerByMapping.get(String(mapping.id)),product=productBy.get(String(mapping.product_id)),variant=variantBy.get(String(mapping.product_variant_id));invariant(offer&&product&&variant&&product.is_active&&!product.merged_into_product_id&&variant.is_active,"inactive or missing approved mapping state");return{product,variant,retailer:retailers[0],mapping,offer}}).sort((a,b)=>Number(a.offer.id)-Number(b.offer.id));
  const scopeRows=[...records].sort((a,b)=>Number(a.mapping.id)-Number(b.mapping.id)).map(row=>({mapping_id:String(row.mapping.id),offer_id:String(row.offer.id),external_product_id:String(row.mapping.external_product_id),external_variant_id:String(row.mapping.external_variant_id),canonical_product_id:String(row.product.id),canonical_variant_id:String(row.variant.id)}));
  if(config.manifest_mode==="authority_fingerprint")invariant(canonicalHash(scopeRows)===config.approved_scope_fingerprint,`${config.retailer_name} approved scope fingerprint drift`);
  else{const expected=approved.manifest.rows.map(row=>`${row.external_product_id}:${row.external_variant_id}`).sort(),actual=mappings.map(row=>`${row.external_product_id}:${row.external_variant_id}`).sort();invariant(JSON.stringify(actual)===JSON.stringify(expected),`${config.retailer_name} approved stable Shopify scope drift`)}
  invariant(new Set(records.map(row=>String(row.mapping.external_variant_id))).size===config.approved_mapping_count,"duplicate approved external variant identity");
  return{records,counts:{products:products.length,variants:variants.length,mappings:mappings.length,offers:offers.length,history:history.length}};
}

function sourceFor(record,sourceByVariant){const source=sourceByVariant.get(String(record.mapping.external_variant_id));invariant(source,"missing mapped Shopify variant");invariant(String(source.external_product_id)===String(record.mapping.external_product_id),"Shopify product relationship drift");const url=config.guardrails.preserve_existing_urls?new URL(record.offer.url):new URL(`/products/${source.product_handle}`,config.store_url);if(!config.guardrails.preserve_existing_urls)url.searchParams.set("variant",String(source.external_variant_id));return{...source,url:url.href,total_price:(Number(source.price)+Number(source.shipping_cost||0)).toFixed(2)}}
function targetFor(record){return{offer_id:String(record.offer.id),retailer_product_id:String(record.mapping.id),external_product_id:String(record.mapping.external_product_id),external_variant_id:String(record.mapping.external_variant_id),external_sku:record.mapping.external_sku||null,price:money(record.offer.price),shipping_cost:money(record.offer.shipping_cost),total_price:money(record.offer.total_price),in_stock:Boolean(record.offer.in_stock),url:record.offer.url,external_url:record.mapping.external_url,last_checked_at:timestamp(record.offer.last_checked_at)}}
function verificationRecord(record,source,snapshotFingerprint,capturedAt){const mapping={...record.mapping};delete mapping.updated_at;return{source_snapshot_sha256:snapshotFingerprint,source_captured_at:capturedAt,source:{external_product_id:String(source.external_product_id),external_variant_id:String(source.external_variant_id),price:money(source.price),in_stock:Boolean(source.in_stock),url:source.url},target:{product:{...record.product,id:String(record.product.id),merged_into_product_id:record.product.merged_into_product_id==null?null:String(record.product.merged_into_product_id)},retailer:{...record.retailer,id:String(record.retailer.id)},product_variant:{...record.variant,id:String(record.variant.id),product_id:String(record.variant.product_id),size_value:record.variant.size_value==null?null:String(record.variant.size_value),pack_count:record.variant.pack_count==null?null:String(record.variant.pack_count)},retailer_product:{...mapping,id:String(mapping.id),retailer_id:String(mapping.retailer_id),product_id:String(mapping.product_id),product_variant_id:String(mapping.product_variant_id),match_confidence:mapping.match_confidence==null?null:String(mapping.match_confidence)},offer:{...record.offer,id:String(record.offer.id),product_id:String(record.offer.product_id),retailer_id:String(record.offer.retailer_id),product_variant_id:String(record.offer.product_variant_id),retailer_product_id:String(record.offer.retailer_product_id),price:money(record.offer.price),shipping_cost:money(record.offer.shipping_cost),total_price:money(record.offer.total_price),last_checked_at:timestamp(record.offer.last_checked_at)}}}}
function classificationDiagnostic(classification){
  const rows=Array.isArray(classification.rows)?classification.rows:[];
  return{
    state:classification.state,
    reason:classification.reason||null,
    scope:classification.guard_evidence||null,
    action_counts:rows.reduce((counts,row)=>({...counts,[row.action]:(counts[row.action]||0)+1}),{}),
    changed_row_ids:rows.filter(row=>row.action!=="VERIFY_NO_CHANGE").map(row=>String(row.offer_id)),
    changed_rows:rows.filter(row=>row.action!=="VERIFY_NO_CHANGE").map(row=>({offer_id:String(row.offer_id),retailer_product_id:String(row.retailer_product_id),external_product_id:String(row.external_product_id),external_variant_id:String(row.external_variant_id),action:row.action,changed_fields:row.changed_fields,old_price:row.target.price,new_price:row.source.price,old_stock:Boolean(row.target.in_stock),new_stock:Boolean(row.source.in_stock)})),
  };
}

function guardrailsFor(rows,sourceProducts,policyFingerprint=rows[0]?.policy_fingerprint,policy=config.guardrails){invariant(/^[0-9a-f]{64}$/.test(String(policyFingerprint||"")),"policy fingerprint is required");const changed=rows.filter(row=>row.action!=="VERIFY_NO_CHANGE"),newOos=rows.filter(row=>row.atomic_plan.expected_state.offer.in_stock&&!row.atomic_plan.offer.values.in_stock),currentOos=rows.filter(row=>!row.atomic_plan.offer.values.in_stock),previousOos=rows.filter(row=>!row.atomic_plan.expected_state.offer.in_stock),price=rows.filter(row=>row.changed_fields.price);return{schema_version:1,policy_fingerprint:policyFingerprint,source_product_count:sourceProducts,previous_source_product_count:config.source_baseline.product_count,required_source_rows:rows.length,matched_source_rows:rows.length,new_oos_count:newOos.length,total_oos_count:currentOos.length,previous_oos_count:previousOos.length,changed_row_count:changed.length,price_changed_row_count:price.length,price_anomaly_count:0,limits:{minimum_source_count_ratio:String(policy.full_snapshot_minimum_source_count_ratio),maximum_new_oos_count:String(policy.mass_oos_block_count-1),maximum_oos_increase_ratio:String(policy.maximum_oos_increase_percentage_points),maximum_total_oos_ratio:String(policy.maximum_total_oos_ratio),maximum_changed_record_ratio:String(policy.maximum_changed_record_ratio),mass_price_change_ratio:String(policy.mass_price_change_block_ratio),price_anomaly_ratio:String(policy.per_row_price_hard_block_ratio),price_anomaly_absolute_gbp:String(policy.per_row_price_hard_block_absolute_gbp)},result:"PASS"}}

async function buildRun(target,state,diagnostic=null,reviewed=null){
  const spec=TARGETS[target],capturedAt=new Date().toISOString();
  let snapshot;
  try{
    snapshot=await readShopifySnapshot({storeUrl:config.store_url,marketCountry:"GB",noCache:true,capturedAt,timeoutMs:config.source_fetch.timeout_ms,maximumPages:config.source_fetch.maximum_pages,maximumAttempts:config.source_fetch.maximum_attempts,retryBaseDelayMs:config.source_fetch.retry_base_delay_ms,userAgent:config.source_fetch.user_agent,paginationCompletion:config.source_fetch.pagination_completion||"short-page"});
  }catch(error){
    if(diagnostic&&error.diagnostic)Object.assign(diagnostic.source,{http_status:error.diagnostic.final_http_status,content_type:error.diagnostic.final_content_type,bytes_received:error.diagnostic.bytes_received||0,pages_fetched:error.diagnostic.pages_fetched||0,pagination_completed:Boolean(error.diagnostic.pagination_completed),request_headers:error.diagnostic.request_headers||null,redirect_policy:error.diagnostic.redirect_policy||null,retries:error.diagnostic.retry_count||0,pages:error.diagnostic.pages||[]});
    throw new RefreshError(error.code||"SOURCE_UNAVAILABLE",error.message,"SOURCE_FETCH",{source_diagnostic:error.diagnostic||null});
  }
  const sourceVariants=projectSourceVariants(snapshot),health=sourceHealth(snapshot,sourceVariants);
  if(diagnostic)diagnostic.source.fingerprint=snapshot.semantic_source_fingerprint;
  if(diagnostic){applySourceDiagnostic(diagnostic,snapshot,sourceVariants,health);diagnostic.guard_results.push({guard:"SOURCE_HEALTH",result:health.result,code:health.code,product_ratio:health.product_ratio,variant_ratio:health.variant_ratio,threshold:health.minimum_ratio,genuine_collapse_threshold:health.genuine_collapse_ratio})}
  if(health.result!=="PASS")throw new RefreshError(health.code,`${config.retailer_name} source guard blocked: ${health.code}`,"SOURCE_GUARD",health);
  invariant(new Set(sourceVariants.map(row=>String(row.external_variant_id))).size===sourceVariants.length,"duplicate source identity");
  const duplicateSku=new Map();for(const row of sourceVariants)if(row.external_sku)duplicateSku.set(row.external_sku,(duplicateSku.get(row.external_sku)||0)+1);
  const targets=state.records.map(targetFor),targetByVariant=new Map(targets.map(row=>[row.external_variant_id,row]));for(const row of sourceVariants){const targetRow=targetByVariant.get(String(row.external_variant_id));if(targetRow&&targetRow.external_sku===null&&row.external_sku&&duplicateSku.get(row.external_sku)>1)row.external_sku=null}
  let scopedSourceEvidence=null,mappedSourceEvidence=null;
  if(reviewed?.mapped){
    try{
      mappedSourceEvidence=buildMappedScopeEvidence({reviewed,snapshot,sourceVariants,records:state.records,storeUrl:config.store_url});
      if(diagnostic)diagnostic.mapped_source_evidence={full_source_fingerprint:mappedSourceEvidence.full_source_fingerprint,observed_product_count:mappedSourceEvidence.observed_product_count,observed_variant_count:mappedSourceEvidence.observed_variant_count,mapped_scope_fingerprint:mappedSourceEvidence.mapped_scope_fingerprint,mapped_scope_row_count:mappedSourceEvidence.mapped_scope_row_count,unmapped_identity_row_count:mappedSourceEvidence.unmapped_identity_row_count,unmapped_identity_rows_hash:mappedSourceEvidence.unmapped_identity_rows_hash,unmapped_collisions:mappedSourceEvidence.unmapped_collisions,unmapped_collisions_hash:mappedSourceEvidence.unmapped_collisions_hash,allowed_unmapped_collisions_hash:mappedSourceEvidence.allowed_unmapped_collisions_hash,unmapped_drift_policy:mappedSourceEvidence.unmapped_drift_policy,collision_checks:mappedSourceEvidence.collision_checks};
    }catch(error){
      throw new RefreshError("REVIEWED_MANIFEST_DRIFT",error.message,"REVIEWED_CONTRACT",{reviewed_manifest_sha256:reviewed.sha256,reviewed_mapped_scope_fingerprint:reviewed.manifest.mapped_source_contract.mapped_scope_fingerprint,live_source_fingerprint:snapshot.semantic_source_fingerprint});
    }
  }else if(reviewed?.scoped){
    try{
      scopedSourceEvidence=buildScopedSourceEvidence({reviewed,snapshot,sourceVariants,records:state.records,storeUrl:config.store_url});
      if(diagnostic)diagnostic.scoped_source_evidence={full_source_fingerprint:scopedSourceEvidence.full_source_fingerprint,reviewed_full_source_fingerprint:scopedSourceEvidence.reviewed_full_source_fingerprint,mapped_scope_fingerprint:scopedSourceEvidence.mapped_scope_fingerprint,mapped_scope_row_count:scopedSourceEvidence.mapped_scope_row_count,unmapped_source_delta_hash:scopedSourceEvidence.unmapped_source_delta_hash,unmapped_source_delta:scopedSourceEvidence.unmapped_source_delta,collision_checks:scopedSourceEvidence.collision_checks};
    }catch(error){
      throw new RefreshError("REVIEWED_MANIFEST_DRIFT",error.message,"REVIEWED_CONTRACT",{reviewed_manifest_sha256:reviewed.sha256,reviewed_source_fingerprint:reviewed.manifest.source_capture_sha256,live_source_fingerprint:snapshot.semantic_source_fingerprint});
    }
  }
  const reconciled=reconcileMissingMappedVariants(targets,sourceVariants);
  const policy={...config.guardrails,mass_oos_block_count:config.guardrails.mass_oos_block_count+reconciled.newUnavailableCount,required_matched_offers:config.approved_mapping_count,store_url:config.store_url};
  const classified=reviewed?.classify
    ? reviewed.classify({targets,sourceVariants:reconciled.sourceVariants,sourceCapturedAt:capturedAt,sourceFingerprint:snapshot.semantic_source_fingerprint})
    : classifyExistingOffers({targets,sourceVariants:reconciled.sourceVariants,policy,guardScope:{name:config.guard_scope_name,retailer:config.retailer_name},sourceCapturedAt:capturedAt,now:new Date(capturedAt),sourceProductCount:snapshot.products.length,previousSourceProductCount:config.source_baseline.product_count});
  const massOosAuthorization=authorizeReviewedMassOos(classified,snapshot.semantic_source_fingerprint),classification=massOosAuthorization.classification;
  if(diagnostic){
    diagnostic.classifier_summary=classificationDiagnostic(classification);
    diagnostic.mappings_matched=Array.isArray(classification.rows)?classification.rows.length:0;
    diagnostic.mappings_missing=Math.max(0,targets.length-diagnostic.mappings_matched);
    if(classification.guard_evidence)for(const guard of classification.guard_evidence.guards)diagnostic.guard_results.push({...guard,scope_name:classification.guard_evidence.scope_name,retailer:classification.guard_evidence.retailer,scope_row_ids:classification.guard_evidence.scope_row_ids});
    if(massOosAuthorization.review)diagnostic.guard_results.push({guard:"REVIEWED_MASS_OOS",result:"PASS",...massOosAuthorization.review});
  }
  if(reviewed){
    const changed=classification.rows.filter(row=>row.action!=="VERIFY_NO_CHANGE");
    const stable=changed.map(row=>`${row.external_product_id}:${row.external_variant_id}:${row.action}`).sort();
    const expected=reviewed.reviewed_rows.map(row=>`${row.external_product_id}:${row.external_variant_id}:${row.action}`).sort();
    if((reviewed.approved_baseline?classification.state!=="DRY_RUN_READY":classification.reason!=="MASS_OOS")
       || classification.rows.length!==(reviewed.approved_baseline?reviewed.manifest.row_count:config.approved_mapping_count)
       || (!reviewed.scoped&&!reviewed.mapped&&snapshot.semantic_source_fingerprint!==reviewed.manifest.source_capture_sha256)
       || JSON.stringify(stable)!==JSON.stringify(expected)){
      throw new RefreshError("REVIEWED_MANIFEST_DRIFT",`live ${config.retailer_name} source/state differs from reviewed mixed-change manifest`,"REVIEWED_CONTRACT",{classifier_reason:classification.reason||null,reviewed_manifest_sha256:reviewed.sha256,reviewed_source_fingerprint:reviewed.manifest.source_capture_sha256,live_source_fingerprint:snapshot.semantic_source_fingerprint,reviewed_scope:expected,live_scope:stable});
    }
  }else if(classification.state!=="DRY_RUN_READY"||classification.rows.length!==config.approved_mapping_count)throw new RefreshError(classification.reason||"CLASSIFIER_BLOCKED",`full ${config.retailer_name} classifier blocked`,"CLASSIFIER",{...(classification.detail||{}),guard_evidence:classification.guard_evidence||null});
  const sourceByVariant=new Map(reconciled.sourceVariants.map(row=>[String(row.external_variant_id),row])),recordByOffer=new Map(state.records.map(row=>[String(row.offer.id),row])),binding=migrationBinding(spec.environment),head=process.env.GITHUB_SHA||git("rev-parse","HEAD"),policyFingerprint=sha256({config,effective_guardrails:policy}),adapterFingerprint=sha256({reader:fs.readFileSync(path.join(ROOT,"scripts","lib","shopify-snapshot-reader.js"),"utf8"),classifier:fs.readFileSync(path.join(ROOT,"scripts","lib","retailer-offer-sync","classifier.js"),"utf8"),config}),expectedStateFingerprint=canonicalHash(state.records.map(row=>({product:row.product,variant:row.variant,mapping:row.mapping,offer:row.offer}))),rows=[];
  const plannedRows=reviewed?classification.rows.filter(row=>row.action!=="VERIFY_NO_CHANGE"):classification.rows;
  for(const classified of plannedRows){const record=recordByOffer.get(String(classified.offer_id)),source=sourceFor(record,sourceByVariant);let plan;if(classified.action==="VERIFY_NO_CHANGE")plan=buildVerifiedNoChangePlan(verificationRecord(record,source,snapshot.semantic_source_fingerprint,capturedAt),{targetEnvironment:spec.environment,targetProjectRef:spec.ref,sourceSnapshotSha256s:new Set([snapshot.semantic_source_fingerprint]),now:new Date(capturedAt)}).plan;else{const built=buildExistingOfferUpdatePlan({product:record.product,variant:record.variant,retailer:record.retailer,mapping:record.mapping,offer:record.offer,source:{...source,url:source.url,shipping_cost:source.shipping_cost,total_price:source.total_price},sourceCapturedAt:capturedAt,sourceSnapshotFingerprint:snapshot.semantic_source_fingerprint});plan=built.plan;invariant(built.changed.price===classified.changed_fields.price&&built.changed.stock===classified.changed_fields.stock&&built.changed.url===classified.changed_fields.url,"classifier/plan changed-field mismatch")}
    rows.push({...classified,atomic_plan:plan,policy_fingerprint:policyFingerprint});
  }
  const artifacts=[];for(const batch of balancedExecutionBatches(rows,50)){const part=batch.map(executionRow),expected=sumDeltas(part),actionManifestFingerprint=canonicalHash({state:"DRY_RUN_READY",rows:part,expected_deltas:expected});artifacts.push(sealArtifact({kind:"retailer-existing-offer-mixed-batch-execution",retailer_slug:config.retailer_slug,retailer_id:String(config.retailer_id),target_environment:spec.environment,target_project_ref:spec.ref,target_database_identity:spec.identity,expected_migration_versions:binding.versions,expected_migration_fingerprint:binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",source_snapshot_fingerprint:snapshot.semantic_source_fingerprint,adapter_fingerprint:adapterFingerprint,policy_fingerprint:policyFingerprint,code_commit:head,expected_state_fingerprint:expectedStateFingerprint,source_captured_at:capturedAt,state:"DRY_RUN_READY",block:null,rows:part,expected_deltas:expected,action_manifest_fingerprint:actionManifestFingerprint}))}
  const manifest=[...state.records].sort((a,b)=>Number(a.mapping.id)-Number(b.mapping.id)).map(row=>({mapping_id:String(row.mapping.id),offer_id:String(row.offer.id),external_product_id:String(row.mapping.external_product_id),external_variant_id:String(row.mapping.external_variant_id),canonical_product_id:String(row.product.id),canonical_variant_id:String(row.variant.id)}));
  const sourceIds=new Set(sourceVariants.map(row=>String(row.external_variant_id))),mappedIds=new Set(manifest.map(row=>row.external_variant_id));
  const discovery={new_variants:[...sourceIds].filter(id=>!mappedIds.has(id)),missing_variants:[...mappedIds].filter(id=>!sourceIds.has(id))};
  if(diagnostic){diagnostic.mappings_matched=manifest.length;diagnostic.mappings_missing=discovery.missing_variants.length;diagnostic.guard_results.push({guard:"APPROVED_MAPPING_COVERAGE",result:"PASS",expected:manifest.length,matched:manifest.length,source_absent_marked_unavailable:discovery.missing_variants.length,maximum_source_absent:config.discovery_policy.maximum_missing_mapped_variants})}
  const reviewedExpiresAt=reviewed?new Date(Date.now()+14*60000).toISOString():null;
  const reviewedContract=reviewed?(reviewed.buildContract
    ?reviewed.buildContract({artifact:artifacts[0],targetEnvironment:spec.environment,expiresAt:reviewedExpiresAt})
    :buildReviewedMixedChangeContract({reviewed,artifact:artifacts[0],targetEnvironment:spec.environment,expiresAt:reviewedExpiresAt,scopedSourceEvidence,mappedSourceEvidence})):null;
  return{target,spec,capturedAt,snapshot,sourceVariants,classification,artifacts,manifest,manifestFingerprint:canonicalHash({approved_manifest_sha256:config.manifest_sha256.toUpperCase(),environment:spec.environment,rows:manifest}),binding,head,discovery,effectiveGuardrails:config.guardrails,massOosAuthorization:massOosAuthorization.review,reviewed,reviewedExpiresAt,reviewedContract,scopedSourceEvidence,mappedSourceEvidence};
}

async function roleCall(target,kind,readOnly,body){const spec=TARGETS[target],client=new Client({connectionString:roleCredential(target,kind),ssl:{rejectUnauthorized:false},application_name:`${config.retailer_slug}-offer-refresh-${kind}`,options:"-c statement_timeout=120000"});await client.connect();try{invariant((await client.query("select current_setting('app.safe_update',true) value")).rows[0].value==null,"SAFE_UPDATE must remain unset");await client.query(readOnly?"begin read only":"begin");await client.query(`select set_config('app.retailer_catalogue_${target}_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)`);await client.query(`set role retailer_catalogue_${target}_${kind}`);const who=(await client.query("select current_user,session_user,current_setting('transaction_read_only') ro,current_setting('app.safe_update',true) safe_update")).rows[0];invariant(who.current_user===`retailer_catalogue_${target}_${kind}`,`${kind} role mismatch`);invariant(who.safe_update==null,"SAFE_UPDATE became set");if(readOnly)invariant(who.ro==="on",`${kind} transaction is not read-only`);const result=await body(client,spec);await client.query(readOnly?"rollback":"commit");return{result,identity:who}}catch(error){try{await client.query("rollback")}catch{}throw error}finally{await client.end()}}
function validationRequest(run,artifact){const expires=run.reviewedExpiresAt||new Date(Date.now()+14*60000).toISOString(),guard=guardrailsFor(artifact.rows,run.snapshot.products.length,artifact.policy_fingerprint,run.effectiveGuardrails);if(run.reviewed)guard.result="BLOCK";const request={schema_version:1,kind:"retailer-existing-offer-mixed-batch-read-only-validation",artifact,validation_expires_at:expires,[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",code_commit:run.head,source_snapshot_fingerprint:artifact.source_snapshot_fingerprint,policy_fingerprint:artifact.policy_fingerprint,action_manifest_fingerprint:artifact.action_manifest_fingerprint,artifact_fingerprint:artifact.artifact_fingerprint,guardrails:guard,batch_fingerprint:canonicalHash({artifact_fingerprint:artifact.artifact_fingerprint,action_manifest_fingerprint:artifact.action_manifest_fingerprint,policy_fingerprint:artifact.policy_fingerprint,source_snapshot_fingerprint:artifact.source_snapshot_fingerprint,row_count:artifact.rows.length,rows:artifact.rows}),package_fingerprint:null};if(run.reviewed)return bindReviewedMixedChangeContract(request,run.reviewedContract);request.package_fingerprint=canonicalHash(request);return request}
async function validate(run){const outputs=[];for(const artifact of run.artifacts){const request=validationRequest(run,artifact),call=await roleCall(run.target,"validator",true,client=>client.query("select public.validate_retailer_offer_sync_batch_read_only($1::jsonb) result",[request]));const result=call.result.rows[0].result;invariant(result.valid&&result.status==="DRY_RUN_VALIDATED"&&Number(result.row_count)===artifact.rows.length,"validator rejected child");outputs.push({request,result,identity:call.identity})}return outputs}
function registrationRequest(run){const parentId=uuid(),children=run.artifacts.map(artifact=>({child_plan_id:uuid(),artifact})),workflow={repository:process.env.GITHUB_REPOSITORY||"SupplementScout/supplementscout",run_id:process.env.GITHUB_RUN_ID||`local-${Date.now()}`,run_attempt:process.env.GITHUB_RUN_ATTEMPT||"1",actor:process.env.GITHUB_ACTOR||"local-authorised-operator"},expiresAt=run.reviewedExpiresAt||new Date(Date.now()+14*60000).toISOString(),approvedManifestSha=config.manifest_sha256.toUpperCase(),parentHashInput={schema_version:1,kind:"retailer-existing-offer-sync-parent",parent_plan_id:parentId,target_environment:run.spec.environment,target_project_ref:run.spec.ref,target_database_identity:run.spec.identity,retailer_id:String(config.retailer_id),source_country:"GB",source_snapshot_fingerprint:run.snapshot.semantic_source_fingerprint,source_captured_at:run.capturedAt,manifest_fingerprint:run.manifestFingerprint,...(run.reviewed?{}:{approved_manifest_sha256:approvedManifestSha}),child_plan_ids:children.map(row=>row.child_plan_id),child_fingerprints:children.map(row=>row.artifact.artifact_fingerprint),code_commit:run.head,expires_at:expiresAt,workflow};const request={schema_version:1,kind:"retailer-existing-offer-sync-control-plan-registration",target_environment:run.spec.environment,target_project_ref:run.spec.ref,target_database_identity:run.spec.identity,retailer_id:String(config.retailer_id),retailer_slug:config.retailer_slug,source_platform:"SHOPIFY",source_domain:new URL(config.store_url).hostname.replace(/^www\./,""),source_country:"GB",source_snapshot_fingerprint:run.snapshot.semantic_source_fingerprint,source_captured_at:run.capturedAt,...(run.reviewed?{}:{approved_manifest_sha256:approvedManifestSha}),manifest:run.manifest,manifest_fingerprint:run.manifestFingerprint,parent_plan_id:parentId,parent_plan_fingerprint:canonicalHash(parentHashInput),children,code_commit:run.head,expires_at:expiresAt,workflow,...(run.reviewed?{reviewed_mixed_change_contract:run.reviewedContract}:{}),request_fingerprint:null};request.request_fingerprint=canonicalHash(request);return request}
async function register(run,request){const rpc=run.reviewed?"register_reviewed_mixed_change_control_plan":config.registration_rpc,call=await roleCall(run.target,"validator",false,client=>client.query(`select public.${rpc}($1::jsonb) result`,[request])),result=call.result.rows[0].result;invariant(result.status==="REGISTERED"&&Number(result.mapping_count)===config.approved_mapping_count&&Number(result.child_count)===run.artifacts.length&&Number(result.business_writes)===0,"registration failed");if(run.reviewed)invariant(result.reviewed_mixed_change===true&&Number(result.operation_count)===run.artifacts[0].rows.length,"reviewed registration failed");return{result,identity:call.identity}}
async function approveAndExecute(run,registration,validations){const results=[],expiresAt=registration.expires_at;invariant(Date.parse(expiresAt)>Date.now()&&Date.parse(expiresAt)<=Date.now()+15*60000,"registered approval expiry is invalid");for(let index=0;index<registration.children.length;index++){const child=registration.children[index],artifact=child.artifact,executionFingerprint=canonicalHash({child_plan_id:child.child_plan_id,artifact_fingerprint:artifact.artifact_fingerprint,target_environment:run.spec.environment,project_ref:run.spec.ref,database_identity:run.spec.identity,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1"}),approvalRequest={schema_version:1,child_plan_id:child.child_plan_id,parent_plan_fingerprint:registration.parent_plan_fingerprint,child_plan_fingerprint:artifact.artifact_fingerprint,artifact,execution_fingerprint:executionFingerprint,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",approved_by:`github-${config.retailer_slug}-sync:${registration.workflow.run_id}`,expires_at:expiresAt,[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity};if(run.reviewed)approvalRequest.reviewed_mixed_change_contract=run.reviewedContract;const approved=await roleCall(run.target,"approver",false,client=>client.query("select public.approve_retailer_offer_sync_batch($1::jsonb) result",[approvalRequest])),approval=approved.result.rows[0].result;invariant(approval.status==="APPROVED","approval failed");const executeRequest={schema_version:1,approval_id:approval.approval_id,execution_fingerprint:executionFingerprint,expected_migration_versions:run.binding.versions,expected_migration_fingerprint:run.binding.fingerprint,migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",[`${run.target}_project_ref`]:run.spec.ref,[`${run.target}_database_identity`]:run.spec.identity,requested_at:new Date().toISOString(),explicit_allow:true};const executed=await roleCall(run.target,"executor",false,client=>client.query("select public.execute_retailer_offer_sync_batch($1::jsonb) result",[executeRequest])),result=executed.result.rows[0].result;invariant(result.status==="APPLIED"&&Number(result.row_approvals_created)===artifact.rows.length,"executor failed");results.push({validation:validations[index].result,approval,result})}return results}

async function executeRefresh(args,diagnostic,reviewed=null){
  const spec=TARGETS[args.target];
  invariant(!process.env.SAFE_UPDATE,"SAFE_UPDATE must be unset");
  invariant(git("branch","--show-current")==="main","main required");
  if(!process.env.GITHUB_ACTIONS)invariant(git("status","--short").split(/\r?\n/).filter(line=>line&&!line.startsWith("?? tmp/")).length===0,"unexpected tracked worktree changes");
  const before=await readState(args.target);
  diagnostic.approved_mapping_count=before.counts.mappings;
  diagnostic.approved_offer_count=before.counts.offers;
  diagnostic.database_before=before.counts;
  const run=await buildRun(args.target,before,diagnostic,reviewed);
  const counts={};for(const row of run.classification.rows)counts[row.action]=(counts[row.action]||0)+1;
  const validations=await validate(run);
  diagnostic.validator_result="PASS";
  diagnostic.guard_results.push({guard:"VALIDATOR",result:"PASS",batches:validations.length});
  const appliedExpected=run.artifacts.reduce((total,artifact)=>{for(const key of Object.keys(total.row_count_deltas))total.row_count_deltas[key]+=artifact.expected_deltas.row_count_deltas[key];for(const key of Object.keys(total.logical_field_deltas))total.logical_field_deltas[key]+=artifact.expected_deltas.logical_field_deltas[key];return total},{row_count_deltas:{...ZERO_ROWS},logical_field_deltas:{...ZERO_LOGICAL}});
  const base={result:"PASS",mode:args.mode,target:args.target,project_ref:spec.ref,approved_manifest_sha256:config.manifest_sha256,source:{country:"GB",products:run.snapshot.products.length,variants:run.sourceVariants.length,available:run.sourceVariants.filter(row=>row.in_stock).length,fingerprint:run.snapshot.semantic_source_fingerprint,diagnostic:run.snapshot.source_diagnostic},scope:{mappings:config.approved_mapping_count,offers:config.approved_mapping_count,children:run.artifacts.length,rows:run.artifacts.reduce((sum,artifact)=>sum+artifact.rows.length,0)},classification:counts,reviewed_mass_oos:run.massOosAuthorization,expected_deltas:appliedExpected,discovery:{new_variants:run.discovery.new_variants.length,missing_variants:run.discovery.missing_variants.length,missing_variants_marked_unavailable:run.discovery.missing_variants.length,catalogue_creates:0},validator_batches:validations.length,safe_update:"unset"};
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
  const appliedRows=run.artifacts.reduce((sum,artifact)=>sum+artifact.rows.length,0);
  diagnostic.business_writes_completed=appliedRows;
  const output={...base,registration:registered.result,executions:executions.map(row=>row.result),business:{products_delta:0,variants_delta:0,mappings_delta:0,offers_delta:0,price_history_delta:historyDelta,offers_refreshed:appliedRows},recovery_calls:0};
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
module.exports={RefreshError,authorizeReviewedMassOos,balancedExecutionBatches,buildRun,canonicalHash,classificationDiagnostic,diagnosticTemplate,executeRefresh,executionRow,guardrailsFor,loadApprovedManifest,loadReviewedMassOosManifest,migrationBinding,parseArgs,projectSourceVariants,readState,reconcileMissingMappedVariants,registrationRequest,runWithDiagnostic,sourceHealth,sumDeltas,verificationRecord};
