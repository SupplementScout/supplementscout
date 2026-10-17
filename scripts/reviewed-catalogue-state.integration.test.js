const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "reviewed-state-local-only";
const MIGRATION = "supabase/migrations/20261017130000_add_reviewed_catalogue_bounded_state.sql";

function run(command, args, timeout = 180_000) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function succeed(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}:\n${output(result)}`); return result; }
function fails(result, label, pattern) { assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.match(output(result), pattern, label); }
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0; }
function exec(container, args, timeout = 180_000) { return run("docker", ["exec", "-e", `PGPASSWORD=${PASSWORD}`, container, ...args], timeout); }
function sql(container, statement, tuples = false) { return exec(container, ["psql", "-X", "--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1", ...(tuples ? ["-tA"] : []), "-U", "postgres", "-d", "postgres", "-c", statement]); }
function file(container, name) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${name}`]); }
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-tAc", "select 1"], 5_000).stdout.trim() === "1") return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function asValidator(statement) {
  return `set session authorization supplementscout_staging_validator_login; begin read only; set local role retailer_catalogue_staging_validator; ${statement}; rollback;`;
}

test("reviewed catalogue state RPC exposes only bounded validator state without table privileges", { timeout: 300_000 }, (t) => {
  if (!dockerAvailable()) return t.skip("Docker unavailable");
  const container = `supplementscout-reviewed-state-${crypto.randomBytes(5).toString("hex")}`;
  try {
    succeed(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start PostgreSQL");
    wait(container);
    succeed(sql(container, `
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role retailer_catalogue_staging_validator nologin;
      create role retailer_catalogue_production_validator nologin;
      create role retailer_catalogue_staging_approver nologin; create role retailer_catalogue_staging_executor nologin;
      create role retailer_catalogue_production_approver nologin; create role retailer_catalogue_production_executor nologin;
      create role supplementscout_staging_validator_login login;
      create role supplementscout_production_validator_login login;
      grant retailer_catalogue_staging_validator to supplementscout_staging_validator_login with set true;
      grant retailer_catalogue_production_validator to supplementscout_production_validator_login with set true;
      create table public.retailers(id bigint primary key,name text,slug text,website text);
      create table public.products(id bigint primary key,name text,brand text,category text,gtin text,slug text,is_active boolean,merged_into_product_id bigint,product_format text);
      create table public.product_variants(id bigint primary key,product_id bigint,variant_key text,display_name text,is_active boolean,is_default boolean);
      create table public.retailer_products(id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,external_product_id text,external_variant_id text,external_sku text,external_gtin text,external_url text);
      create table public.offers(id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,retailer_product_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text,last_checked_at timestamptz);
      create table public.price_history(id bigint primary key,offer_id bigint,price numeric,shipping_cost numeric,total_price numeric,checked_at timestamptz);
      create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)$$;
      create function public.retailer_catalogue_raise(p_code text,p_message text) returns void language plpgsql as $$begin raise exception '%: %',p_code,p_message;end$$;
      create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable security definer as $$select '{"target_environment":"STAGING","project_ref":"hxnrsyyqffztlvcrtgbf"}'::jsonb$$;
      insert into retailers values(12,'Example Nutrition','example-nutrition','https://example.test'),(99,'Other','other','https://other.test');
      insert into products values(1,'Wanted Whey 1kg Powder','Brand A','Whey Protein',null,'wanted-whey-1kg',true,null,'powder'),(2,'Unrelated Whey 2kg','Brand A','Whey Protein',null,'unrelated-whey-2kg',true,null,'powder');
      insert into product_variants values(10,1,'default','Default',true,true),(20,2,'default','Default',true,true);
      insert into retailer_products values(100,12,1,10,'p-1','v-1','SKU-1',null,'https://example.test/p-1'),(200,12,2,20,'p-2','v-2','SKU-2',null,'https://example.test/p-2');
      insert into offers values(1000,12,1,10,100,10,0,10,true,'https://affiliate.test/p-1',now()),(2000,12,2,20,200,20,0,20,true,'https://affiliate.test/p-2',now());
      insert into price_history values(10000,1000,10,0,10,now()),(20000,2000,20,0,20,now());
    `), "prepare fixture");
    succeed(file(container, MIGRATION), "apply bounded state migration");
    const request = {
      schema_version: 1, target_environment: "STAGING", target_project_ref: "hxnrsyyqffztlvcrtgbf",
      retailer: { id: 12, slug: "example-nutrition" },
      rows: [{ external_gtin: null, external_product_id: "p-1", external_sku: "SKU-1", external_url: "https://example.test/p-1", external_variant_id: "v-1", product_brand: "Brand A", product_category: "Whey Protein", product_gtin: null, product_id: "1", product_name_key: "wanted whey 1kg", product_slug: "wanted-whey-1kg", product_variant_id: "10" }],
    };
    const before = succeed(sql(container, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers),(select count(*) from price_history))", true), "before counts").stdout.trim();
    const state = JSON.parse(succeed(sql(container, asValidator(`select public.read_reviewed_catalogue_import_state(${literal(request)})::text`), true), "read bounded state").stdout.trim());
    assert.deepEqual(state.products.map(row => row.id), [1]);
    assert.deepEqual(state.product_variants.map(row => row.id), [10]);
    assert.deepEqual(state.retailer_products.map(row => row.id), [100]);
    assert.deepEqual(state.offers.map(row => row.id), [1000]);
    assert.deepEqual(state.price_history.map(row => row.id), [10000]);
    const after = succeed(sql(container, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers),(select count(*) from price_history))", true), "after counts").stdout.trim();
    assert.equal(after, before);
    const acl = JSON.parse(succeed(sql(container, `select jsonb_build_object('validator',has_function_privilege('retailer_catalogue_staging_validator','public.read_reviewed_catalogue_import_state(jsonb)','execute'),'service',has_function_privilege('service_role','public.read_reviewed_catalogue_import_state(jsonb)','execute'),'approver',has_function_privilege('retailer_catalogue_staging_approver','public.read_reviewed_catalogue_import_state(jsonb)','execute'),'table_select',has_table_privilege('retailer_catalogue_staging_validator','public.products','select'))`, true), "ACL proof").stdout.trim());
    assert.deepEqual(acl, { validator: true, service: false, approver: false, table_select: false });
    const wrong = structuredClone(request); wrong.target_environment = "PRODUCTION";
    fails(sql(container, asValidator(`select public.read_reviewed_catalogue_import_state(${literal(wrong)})`)), "wrong environment", /ENVIRONMENT_BLOCKED/);
    fails(sql(container, `begin read only; select public.read_reviewed_catalogue_import_state(${literal(request)}); rollback`), "owner planning path", /Exact read-only reviewed catalogue validator session/);
    fails(sql(container, `set session authorization supplementscout_production_validator_login; begin read only; set local role retailer_catalogue_production_validator; select public.read_reviewed_catalogue_import_state(${literal(request)}); rollback`), "production credential on staging", /Exact read-only reviewed catalogue validator session/);
    fails(sql(container, `set session authorization service_role; begin read only; select public.read_reviewed_catalogue_import_state(${literal(request)}); rollback`), "service role planning path", /permission denied/);
    const oversizedSql = `with base as (select ${literal(request)} value), expanded as (select jsonb_set(value,'{rows}',(select jsonb_agg(jsonb_set(value->'rows'->0,'{external_variant_id}',to_jsonb('v-'||g::text))) from generate_series(1,201) g)) value from base) select public.read_reviewed_catalogue_import_state((select value from expanded))`;
    fails(sql(container, asValidator(oversizedSql)), "oversized request", /SCOPE_MISMATCH/);
    fails(sql(container, `set session authorization supplementscout_staging_validator_login; set role retailer_catalogue_staging_validator; select public.read_reviewed_catalogue_import_state(${literal(request)})`), "non-read-only session", /Exact read-only/);
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
