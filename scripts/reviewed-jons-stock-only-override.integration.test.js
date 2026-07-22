const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "supabase/migrations/20260722120000_add_reviewed_jons_stock_only_override.sql";
const IMAGE = "postgres:17-alpine";
const scope = {
  offer_ids: ["1013", "1016", "1029", "1046", "1176", "1243", "1276", "1375"],
  mapping_ids: ["1199", "1202", "1215", "1232", "1362", "1429", "1462", "1561"],
  external_product_ids: ["10904679186770", "10904679186770", "10018787557714", "10018787557714", "10563642065234", "10032290431314", "10088760148306", "10460316533074"],
  external_variant_ids: ["53868239389010", "53868239487314", "50561870463314", "50561871085906", "53264568910162", "50602413949266", "50838720676178", "52233394028882"],
};

function run(command, args, options = {}) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: options.timeout || 180_000, input: options.input }); }
function out(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}:\n${out(result)}`); return result; }
function fail(result, label, pattern) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.notEqual(result.status, 0, `${label} unexpectedly passed`); assert.match(out(result), pattern); }
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10_000 }).status === 0; }
function exec(container, args, options = {}) { return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options); }
function sql(container, text) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-f", "-"], { stdin: true, input: text }); }
function literal(value) { const text=typeof value==="string"?value:JSON.stringify(value); return `'${text.replaceAll("'", "''")}'::jsonb`; }
function wait(container) { for (let i=0;i<80;i+=1) { const result=exec(container,["pg_isready","-U","postgres"]); if(result.status===0)return; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250); } assert.fail("PostgreSQL unavailable"); }

function setupSql() {
  return `
create extension pgcrypto;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create role retailer_catalogue_staging_validator nologin; create role retailer_catalogue_staging_approver nologin; create role retailer_catalogue_staging_executor nologin;
create role retailer_catalogue_production_validator nologin; create role retailer_catalogue_production_approver nologin; create role retailer_catalogue_production_executor nologin;
create table public.retailer_offer_sync_batch_approvals(id uuid primary key default gen_random_uuid(),artifact_fingerprint text not null,approved_manifest jsonb not null,expires_at timestamptz not null);
create function public.atomic_import_has_exact_keys(p jsonb,k text[]) returns boolean language sql immutable as $$select jsonb_typeof(p)='object' and (select array_agg(key order by key) from jsonb_object_keys(p) key)=(select array_agg(x order by x) from unnest(k)x)$$;
create function public.retailer_catalogue_raise(c text,m text) returns void language plpgsql as $$begin raise exception '%: %',c,m;end$$;
create function public.retailer_catalogue_sha256_json(v jsonb) returns text language sql immutable as $$select encode(digest(convert_to(v::text,'UTF8'),'sha256'),'hex')$$;
create function public.retailer_catalogue_assert_migration_ledger(v jsonb,f text) returns text language sql stable as $$select f$$;
create function public.retailer_offer_sync_validate_manifest(v jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true)$$;
create function public.validate_product_import_plan_read_only(v jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true)$$;
create function public.retailer_offer_sync_validate_batch_read_only_internal(v jsonb) returns jsonb language sql stable security definer as $$select jsonb_build_object('ordinary',true)$$;
create function public.retailer_offer_sync_approve_batch_internal(v jsonb) returns jsonb language plpgsql volatile security definer as $$declare i uuid;begin insert into public.retailer_offer_sync_batch_approvals(artifact_fingerprint,approved_manifest,expires_at)values(v#>>'{artifact,artifact_fingerprint}',v->'artifact',(v->>'expires_at')::timestamptz)returning id into i;return jsonb_build_object('approval_id',i,'status','APPROVED');end$$;
create function public.retailer_offer_sync_execute_batch_internal(v jsonb) returns jsonb language plpgsql volatile security definer as $$begin if current_setting('app.inject_failure',true)='on'then raise exception 'INJECTED_DB_FAILURE';end if;return jsonb_build_object('status','APPLIED','business_writes',8);end$$;
`;
}

function row(index, environment, capturedAt) {
  const offer = scope.offer_ids[index], mapping = scope.mapping_ids[index], url = `https://jonssupplements.co.uk/products/exact-${index}?variant=${scope.external_variant_ids[index]}`;
  return {
    offer_id: offer, retailer_product_id: mapping, external_product_id: scope.external_product_ids[index], external_variant_id: scope.external_variant_ids[index], action: "UPDATE_STOCK",
    changed_fields: { price: false, stock: true, url: false, blocked: false }, source_captured_at: capturedAt,
    expected_deltas: { row_count_deltas: { products:0, product_variants:0, retailer_products:0, offers:0, price_history:0 }, logical_field_deltas: { offer_price_updates:0, offer_shipping_updates:0, offer_total_updates:0, offer_stock_updates:1, offer_url_updates:0, mapping_url_updates:0, mapping_updated_at_updates:0, last_checked_at_updates:1 } },
    atomic_plan: {
      meta: { operation_type:"standard_import", source_snapshot_sha256:"a".repeat(64), source_captured_at:capturedAt },
      product:{action:"existing"}, product_variant:{action:"existing"}, retailer:{action:"existing",id:"10"},
      retailer_product:{action:"noop",id:mapping,values:{external_url:url}},
      offer:{action:"update",id:offer,values:{price:"10.00",shipping_cost:"0.00",total_price:"10.00",in_stock:false,url,last_checked_at:capturedAt}},
      price_history:{action:"noop"}, approval:{approved:false,approval_type:"none"},
      expected_state:{retailer_product:{external_url:url},offer:{price:"10.00",shipping_cost:"0.00",total_price:"10.00",in_stock:true,url,last_checked_at:"2026-07-22T00:00:00.000Z"}},
    },
  };
}

function fixture(now = Date.now()) {
  const a = new Date(now-2000).toISOString(), b = new Date(now-1000).toISOString(), expiry = new Date(now+600000).toISOString();
  const expected = { row_count_deltas:{products:0,product_variants:0,retailer_products:0,offers:0,price_history:0},logical_field_deltas:{offer_price_updates:0,offer_shipping_updates:0,offer_total_updates:0,offer_stock_updates:8,offer_url_updates:0,mapping_url_updates:0,mapping_updated_at_updates:0,last_checked_at_updates:8} };
  const artifact={schema_version:1,target_environment:"PRODUCTION",retailer_id:"10",source_snapshot_fingerprint:"a".repeat(64),source_captured_at:b,artifact_fingerprint:"b".repeat(64),expected_deltas:expected,rows:scope.offer_ids.map((_,i)=>row(i,"PRODUCTION",b))};
  const contract={schema_version:1,kind:"jons-reviewed-stock-only-v1",authorization_id:"jons-reviewed-eight-oos-2026-07-22-production",target_environment:"PRODUCTION",retailer_id:"10",...scope,before_stock:true,after_stock:false,source_country:"GB",snapshot_a_fingerprint:"a".repeat(64),snapshot_b_fingerprint:"a".repeat(64),snapshot_a_captured_at:a,snapshot_b_captured_at:b,expires_at:expiry,artifact_fingerprint:artifact.artifact_fingerprint,reviewed_plan_hash:null};
  return {artifact,contract,expiry};
}

function hashContract(container, data) {
  const result=ok(sql(container,`select public.retailer_catalogue_sha256_json(${literal(data.contract)}-'reviewed_plan_hash');`),"hash contract");
  data.contract.reviewed_plan_hash=result.stdout.trim(); return data;
}
function helperSql(data) { return `select public.retailer_offer_sync_validate_reviewed_stock_only_contract(${literal(data.artifact)},${literal(data.contract)},'${data.expiry}'::timestamptz);`; }

test("reviewed exact-eight SQL contract applies, blocks mutations, consumes once and rolls injected failure back", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container=`reviewed-jons-stock-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker",["run","--detach","--rm","--name",container,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-v",`${ROOT}:/workspace:ro`,IMAGE]),"start"); wait(container);
    ok(sql(container,setupSql()),"setup");
    ok(exec(container,["psql","-X","--no-psqlrc","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres","-f",`/workspace/${MIGRATION}`]),"migration");
    const base=hashContract(container,fixture());
    assert.match(ok(sql(container,helperSql(base)),"exact contract").stdout,/"valid": true/);

    const mutations=[
      ["nine rows",d=>{d.artifact.rows.push(structuredClone(d.artifact.rows[7]));}],
      ["seven rows",d=>{d.artifact.rows.pop();}],
      ["different offer",d=>{d.artifact.rows[0].offer_id="9999";}],
      ["different mapping",d=>{d.artifact.rows[0].retailer_product_id="9999";}],
      ["different variant",d=>{d.artifact.rows[0].external_variant_id="9999";}],
      ["another retailer",d=>{d.artifact.retailer_id="11";}],
      ["false to true",d=>{d.artifact.rows[0].atomic_plan.expected_state.offer.in_stock=false;d.artifact.rows[0].atomic_plan.offer.values.in_stock=true;}],
      ["price",d=>{d.artifact.rows[0].atomic_plan.offer.values.price="11.00";}],
      ["url",d=>{d.artifact.rows[0].atomic_plan.offer.values.url="https://evil.example/";}],
      ["snapshot disagreement",d=>{d.contract.snapshot_b_fingerprint="c".repeat(64);}],
      ["non GB",d=>{d.contract.source_country="US";}],
      ["expired",d=>{d.contract.expires_at=new Date(Date.now()-1000).toISOString();d.expiry=d.contract.expires_at;}],
    ];
    for(const [label,mutate] of mutations){const d=structuredClone(base);mutate(d);fail(sql(container,helperSql(d)),label,/RSBI_/);}

    const ordinary=ok(sql(container,"select public.retailer_offer_sync_validate_batch_read_only_internal('{}'::jsonb);"),"ordinary dispatch");assert.match(ordinary.stdout,/ordinary/);
    const approvalRequest={schema_version:1,child_plan_id:crypto.randomUUID(),parent_plan_fingerprint:"p",child_plan_fingerprint:"c",artifact:base.artifact,execution_fingerprint:"e".repeat(64),expected_migration_versions:["1_x"],expected_migration_fingerprint:"f".repeat(64),migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",approved_by:"test",expires_at:base.expiry,production_project_ref:"aftboxmrdgyhizicfsfu",production_database_identity:"supplementscout-production:aftboxmrdgyhizicfsfu",reviewed_stock_only_contract:base.contract};
    const approved=JSON.parse(ok(sql(container,`select public.retailer_offer_sync_approve_batch_internal(${literal(approvalRequest)})::text;`),"approve").stdout.trim());
    const execution={schema_version:1,approval_id:approved.approval_id,execution_fingerprint:"e".repeat(64),expected_migration_versions:["1_x"],expected_migration_fingerprint:"f".repeat(64),migration_fingerprint_algorithm:"SHA-256",migration_fingerprint_version:"RSBI-CJ1",production_project_ref:"aftboxmrdgyhizicfsfu",production_database_identity:"supplementscout-production:aftboxmrdgyhizicfsfu",requested_at:new Date().toISOString(),explicit_allow:true};
    assert.match(ok(sql(container,`select public.retailer_offer_sync_execute_batch_internal(${literal(execution)})::text;`),"execute").stdout,/APPLIED/);
    fail(sql(container,`select public.retailer_offer_sync_execute_batch_internal(${literal(execution)});`),"replay",/RSBI_REPLAY_BLOCKED/);

    const state=ok(sql(container,"select status||':'||(consumed_at is not null)::text from public.retailer_offer_sync_reviewed_stock_only_authorizations;"),"state");assert.equal(state.stdout.trim(),"CONSUMED:true");
    const controls=ok(sql(container,"select count(*) from public.retailer_offer_sync_reviewed_stock_only_authorizations;"),"control count");assert.equal(controls.stdout.trim(),"1");
    ok(sql(container,"update public.retailer_offer_sync_reviewed_stock_only_authorizations set status='APPROVED',consumed_at=null;"),"prepare injected failure");
    fail(sql(container,`begin;set local app.inject_failure='on';select public.retailer_offer_sync_execute_batch_internal(${literal(execution)});commit;`),"injected failure",/INJECTED_DB_FAILURE/);
    const rollback=ok(sql(container,"select status||':'||(consumed_at is null)::text from public.retailer_offer_sync_reviewed_stock_only_authorizations;"),"rollback state");assert.equal(rollback.stdout.trim(),"APPROVED:true");
  } finally { run("docker",["rm","-f",container],{timeout:30000}); }
});
