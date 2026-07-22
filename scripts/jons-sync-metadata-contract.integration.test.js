const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const test=require("node:test");
const {buildExistingOfferUpdatePlan}=require("./lib/retailer-offer-sync/existing-offer-plan");
const {canonicalJson}=require("./lib/canonical-json");

const root=path.resolve(__dirname,"..");
const migrationNames=[
  "20260712211120_baseline_current_public_schema.sql","20260713130000_product_variants_stage2.sql",
  "20260713180000_atomic_product_import_rpc.sql","20260713190000_approved_import_plan_ledger.sql",
  "20260713200000_legacy_mapping_upgrade_rpc.sql","20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  "20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql","20260715234500_align_approval_product_format_normalization.sql",
  "20260716003000_support_optioned_legacy_mapping_upgrade.sql","20260716004000_support_optioned_parent_size_evidence.sql",
  "20260716005000_allow_optioned_legacy_identity_update_null_total.sql","20260718150000_add_verified_no_change_offer_refresh.sql",
  "20260722133000_align_retailer_sync_plan_metadata.sql",
];
const migrations=migrationNames.map(name=>path.join(root,"supabase/migrations",name));
const stage2Setup=path.join(root,"supabase/test/product_variants_stage2_migration_test.sql");
const image="postgres:17-alpine";
function run(command,args,timeout=120000){return spawnSync(command,args,{cwd:root,encoding:"utf8",timeout})}
function output(result){return `${result.stdout||""}\n${result.stderr||""}`}
function ok(result,label){assert.equal(result.error,undefined,`${label}: ${result.error?.message}`);assert.equal(result.status,0,`${label}:\n${output(result)}`)}
function dockerAvailable(){const result=run("docker",["version","--format","{{.Server.Version}}"],10000);return result.status===0&&result.stdout.trim()}
function exec(container,args,timeout=120000){return run("docker",["exec","-e","PGPASSWORD=metadata-local-only",container,...args],timeout)}
function containerPath(file){return `/workspace/${path.relative(root,file).replaceAll("\\","/")}`}
function psqlFile(container,database,file,variables=[]){const args=["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1"];for(const variable of variables)args.push("-v",variable);args.push("-U","postgres","-d",database,"-f",containerPath(file));return exec(container,args)}
function literal(value){return `'${String(value).replaceAll("'","''")}'`}
function query(container,database,sql){const result=exec(container,["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-tA","-c",sql]);ok(result,"query");return result.stdout.trim()}
function wait(container){for(let i=0;i<80;i++){const result=exec(container,["psql","-X","--no-psqlrc","-U","postgres","-d","postgres","-tAc","select 1"],5000);if(result.status===0&&result.stdout.trim()==="1")return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}assert.fail("postgres unavailable")}
function reseal(plan){const copy=JSON.parse(JSON.stringify(plan));copy.meta.plan_fingerprint=null;copy.meta.plan_fingerprint=crypto.createHash("md5").update(canonicalJson(copy)).digest("hex");return copy}
function expectBlocked(container,database,plan){const result=exec(container,["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-c",`select public.validate_product_import_plan_read_only(${literal(JSON.stringify(plan))}::jsonb);`]);assert.notEqual(result.status,0,"unsafe plan unexpectedly validated")}

test("source-bound stock, price and URL plans validate and apply atomically",{skip:!dockerAvailable()&&"Docker daemon unavailable"},()=>{
  const container=`supplementscout-metadata-${crypto.randomBytes(6).toString("hex")}`,database="supplementscout_stage2_test_metadata_contract";
  let primary;
  try{
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_PASSWORD=metadata-local-only","-v",`${root}:/workspace:ro`,image],180000),"start postgres");wait(container);
    ok(exec(container,["createdb","-U","postgres",database]),"create database");
    ok(exec(container,["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-c","do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $r$;"]),"roles");
    ok(psqlFile(container,database,migrations[0]),"baseline");ok(psqlFile(container,database,stage2Setup,["stage2_test_database_confirmed=1","stage2_test_host=127.0.0.1",`stage2_expected_database=${database}`,"stage2_scenario=success"]),"stage2 fixture");for(const migration of migrations.slice(1))ok(psqlFile(container,database,migration),path.basename(migration));
    const seed=`insert into public.retailers(id,name,slug,website) values(970101,'Jon''s Supplements','jon-s-supplements','https://jonssupplements.co.uk');
      insert into public.products(id,name,slug,brand,category,product_format,is_active) values(970101,'Metadata Product','metadata-product','Test','Creatine','powder',true);
      insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(970101,970101,'300g','300g',300,'g',1,'powder',true,false);
      insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_name,external_slug,external_url,match_method,match_confidence,updated_at) values(970101,970101,970101,970101,'100','200','SKU','Metadata Product','metadata-product','https://jonssupplements.co.uk/products/metadata-product?variant=200','external_id',100,'2026-07-20T10:00:00Z');
      insert into public.offers(id,product_id,retailer_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(970101,970101,970101,970101,970101,10,3.99,13.99,true,'https://jonssupplements.co.uk/products/metadata-product?variant=200','2026-07-20T10:00:00Z');`;
    ok(exec(container,["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d",database,"-c",seed]),"seed");
    const state={product:{id:970101,name:"Metadata Product",is_active:true,merged_into_product_id:null,product_format:"powder"},variant:{id:970101,product_id:970101,variant_key:"300g",display_name:"300g",flavour_code:null,flavour_label:null,size_value:"300",size_unit:"g",pack_count:"1",product_format:"powder",is_active:true,is_default:false},retailer:{id:970101,name:"Jon's Supplements",slug:"jon-s-supplements",website:"https://jonssupplements.co.uk"},mapping:{id:970101,retailer_id:970101,product_id:970101,product_variant_id:970101,external_product_id:"100",external_variant_id:"200",external_sku:"SKU",external_options:null,external_name:"Metadata Product",external_slug:"metadata-product",external_gtin:null,external_url:"https://jonssupplements.co.uk/products/metadata-product?variant=200",match_method:"external_id",match_confidence:"100",updated_at:"2026-07-20T10:00:00Z"},offer:{id:970101,product_id:970101,retailer_id:970101,product_variant_id:970101,retailer_product_id:970101,price:"10",shipping_cost:"3.99",total_price:"13.99",in_stock:true,url:"https://jonssupplements.co.uk/products/metadata-product?variant=200",last_checked_at:"2026-07-20T10:00:00Z"}};
    const captured=new Date(Date.now()-60000).toISOString(),snapshot="a".repeat(64),source={external_product_id:"100",external_variant_id:"200",price:"10",shipping_cost:"3.99",total_price:"13.99",in_stock:false,url:state.offer.url};
    const stock=buildExistingOfferUpdatePlan({...state,source,sourceCapturedAt:captured,sourceSnapshotFingerprint:snapshot}).plan;
    assert.equal(query(container,database,`select (public.validate_product_import_plan_read_only(${literal(JSON.stringify(stock))}::jsonb)->>'source_snapshot_sha256');`),snapshot);
    const price=buildExistingOfferUpdatePlan({...state,source:{...source,price:"11",total_price:"14.99",in_stock:true},sourceCapturedAt:captured,sourceSnapshotFingerprint:snapshot}).plan;
    const url="https://jonssupplements.co.uk/products/metadata-product-new?variant=200",urlPlan=buildExistingOfferUpdatePlan({...state,source:{...source,in_stock:true,url},sourceCapturedAt:captured,sourceSnapshotFingerprint:snapshot}).plan;
    query(container,database,`select public.validate_product_import_plan_read_only(${literal(JSON.stringify(price))}::jsonb);select public.validate_product_import_plan_read_only(${literal(JSON.stringify(urlPlan))}::jsonb);`);
    const approval=JSON.parse(query(container,database,`select public.approve_product_import_plan(${literal(JSON.stringify(stock))}::jsonb,${literal("b".repeat(64))},'metadata-contract','integration',now()+interval '10 minutes')::text;`));
    query(container,database,`select public.apply_approved_product_import_plan(${literal(approval.approval_id)}::uuid,${literal("b".repeat(64))},${literal(stock.meta.plan_fingerprint)},${literal(stock.meta.source_row_fingerprint)},970101,'feed','metadata-contract');`);
    assert.equal(query(container,database,"select in_stock::text||'|'||to_char(last_checked_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') from public.offers where id=970101;"),`false|${captured}`);
    const unknown=reseal({...stock,meta:{...stock.meta,unexpected:"blocked"}}),badSha=reseal({...stock,meta:{...stock.meta,source_snapshot_sha256:"BAD"}}),stale=reseal({...stock,meta:{...stock.meta,source_captured_at:"2020-01-01T00:00:00Z"}}),create=reseal({...stock,product:{action:"create",values:{}}});
    for(const plan of [unknown,badSha,stale,create])expectBlocked(container,database,plan);
  }catch(error){primary=error;throw error}finally{const stopped=run("docker",["rm","-f",container],30000);if(!primary&&stopped.status!==0)assert.fail(`stop postgres: ${output(stopped)}`)}
});
