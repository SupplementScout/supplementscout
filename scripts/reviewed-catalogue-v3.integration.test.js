const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "reviewed-v3-local-only";
const MIGRATION = "supabase/migrations/20261018120000_add_reviewed_catalogue_v3_boundary.sql";
const ROLLBACK = "supabase/rollbacks/20261018120000_add_reviewed_catalogue_v3_boundary_rollback.sql";

function run(command, args, timeout = 180_000) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function succeed(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}:\n${output(result)}`); return result; }
function fails(result, label, pattern) { assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`); assert.match(output(result), pattern, label); }
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0; }
function exec(container, args, timeout = 180_000) { return run("docker", ["exec", "-e", `PGPASSWORD=${PASSWORD}`, container, ...args], timeout); }
function sql(container, statement, tuples = false) { return exec(container, ["psql", "-X", "--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1", ...(tuples ? ["-tA"] : []), "-U", "postgres", "-d", "postgres", "-c", statement]); }
function file(container, name) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${name}`]); }
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-tAc", "select 1"], 5_000).stdout.trim() === "1") return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}

function planFixture() {
  return {
    meta: { version: "2", plan_kind: "feed", operation_type: "standard_import", source_row_fingerprint: "1".repeat(64), plan_fingerprint: null, idempotency_key: "reviewed-v3-test" },
    retailer: { action: "existing", id: "12", values: null },
    product: { action: "create_or_reuse_reviewed", id: null, values: { name: "Example Clear Whey 875g", slug: "example-clear-whey-875g", brand: "Example Nutrition", category: "Whey Protein", price: "29.99", image: null, description: "Ingredient stack wording only", servings: "35", net_weight_g: "875", net_volume_ml: null, serving_count_verified: false, serving_size_g: null, serving_size_ml: null, protein_per_serving_g: null, creatine_per_serving_g: null, unit_count: null, unit_type: null, product_format: "powder", unit_pricing_verified: false, nutrition_verified: false, gtin: null } },
    product_variant: { action: "create_reviewed_variant", id: null, values: { variant_key: "grapefruit-875g", display_name: "Grapefruit / 875g", flavour_code: "grapefruit", flavour_label: "Grapefruit", size_value: "875", size_unit: "g", pack_count: "1", product_format: "powder" } },
    retailer_product: { action: "create", id: null, values: { retailer_id: "12", product_id: null, product_variant_id: null, external_product_id: "7462538510381", external_variant_id: "41660010364973", external_sku: null, external_gtin: null, external_url: "https://example.test/products/clear-whey?variant=41660010364973", external_options: { Flavours: "Grapefruit", Size: "35 Servings", Weight: "875g" }, external_name: "Example Clear Whey 875g", external_slug: "example-clear-whey-875g", match_method: "owner_reviewed", match_confidence: "100" } },
    offer: { action: "create", id: null, values: { product_id: null, retailer_id: "12", product_variant_id: null, retailer_product_id: null, price: "29.99", shipping_cost: "3.99", total_price: "33.98", in_stock: true, url: "https://affiliate.example/click/clear-whey", last_checked_at: "2026-10-18T12:00:00.000Z" } },
    price_history: { action: "create", values: { price: "29.99", shipping_cost: "3.99", total_price: "33.98", in_stock: true } },
    expected_state: { retailer: { id: "12", name: "Example Nutrition", slug: "example-nutrition", website: "https://example.test" }, product: null, product_variant: null, retailer_product: null, offer: null },
    approval: { approved: false, approval_type: "none" },
  };
}

function envelopeFixture(plan) {
  return {
    schema_version: 3, kind: "reviewed-catalogue-authorization-v3", source_platform: "shopify",
    target_environment: "STAGING", target_project_ref: "hxnrsyyqffztlvcrtgbf",
    retailer: { id: "12", name: "Example Nutrition", slug: "example-nutrition", website: "https://example.test" },
    profile_id: "batch-1", manifest_sha256: "2".repeat(64), artifact_sha256: "3".repeat(64), run_id: "reviewed-v3-run", review_row: "1",
    reviewed_action: "create_product_with_variant", external_product_id: plan.retailer_product.values.external_product_id,
    external_variant_id: plan.retailer_product.values.external_variant_id, direct_source_url: plan.retailer_product.values.external_url,
    affiliate_url: plan.offer.values.url, external_options: plan.retailer_product.values.external_options,
    option_roles: { flavour: { source_key: "Flavours", source_value: "Grapefruit" }, physical_size: { source_key: "Weight", source_value: "875g", size_value: "875", size_unit: "g" }, count: { source_key: "Size", source_value: "35 Servings", count_value: "35", count_unit: "servings" } },
    source_structure: { product_variant_count: 12, meaningful_variant_axes: ["flavour"] },
    source_row_fingerprint: plan.meta.source_row_fingerprint, plan_fingerprint: plan.meta.plan_fingerprint,
  };
}

function asRole(login, role, statement, { readOnly = false } = {}) {
  const marker = readOnly ? "" : "set local app.retailer_catalogue_staging_marker='1'; set local app.retailer_catalogue_allow='1';";
  return `set session authorization ${login}; begin${readOnly ? " read only" : ""}; ${marker} set local role ${role}; ${statement}; ${readOnly ? "rollback" : "commit"};`;
}

test("reviewed catalogue V3 has a separate validated approval boundary and reuses atomic apply", { timeout: 300_000 }, (t) => {
  if (!dockerAvailable()) return t.skip("Docker unavailable");
  const container = `supplementscout-reviewed-v3-${crypto.randomBytes(5).toString("hex")}`;
  try {
    succeed(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start PostgreSQL");
    wait(container);
    succeed(sql(container, `
      create extension pgcrypto;
      create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create role retailer_catalogue_staging_validator nologin; create role retailer_catalogue_staging_approver nologin; create role retailer_catalogue_staging_executor nologin;
      create role retailer_catalogue_production_validator nologin; create role retailer_catalogue_production_approver nologin; create role retailer_catalogue_production_executor nologin;
      create role supplementscout_staging_validator_login login; create role supplementscout_staging_approver_login login; create role supplementscout_staging_executor_login login;
      create role supplementscout_production_validator_login login; create role supplementscout_production_approver_login login; create role supplementscout_production_executor_login login;
      grant retailer_catalogue_staging_validator to supplementscout_staging_validator_login with set true;
      grant retailer_catalogue_staging_approver to supplementscout_staging_approver_login with set true;
      grant retailer_catalogue_staging_executor to supplementscout_staging_executor_login with set true;
      grant retailer_catalogue_production_validator to supplementscout_production_validator_login with set true;
      grant retailer_catalogue_production_approver to supplementscout_production_approver_login with set true;
      grant retailer_catalogue_production_executor to supplementscout_production_executor_login with set true;
      create table public.retailers(id bigint primary key,name text not null,slug text not null,website text not null);
      create table public.products(id bigint generated always as identity primary key,name text,slug text,brand text,category text,gtin text,is_active boolean default true,merged_into_product_id bigint,product_format text);
      create table public.product_variants(id bigint generated always as identity primary key,product_id bigint,variant_key text,display_name text,flavour_code text,flavour_label text,size_value numeric,size_unit text,pack_count integer,product_format text,is_default boolean default false,is_active boolean default true);
      create table public.retailer_products(id bigint generated always as identity primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,external_product_id text,external_variant_id text,external_sku text,external_gtin text,external_url text,external_options jsonb,external_name text,external_slug text,match_method text,match_confidence numeric);
      create table public.offers(id bigint generated always as identity primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,retailer_product_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,url text,last_checked_at timestamptz);
      create table public.price_history(id bigint generated always as identity primary key,offer_id bigint,price numeric,shipping_cost numeric,total_price numeric,in_stock boolean,checked_at timestamptz);
      create table public.approved_import_plans(id uuid primary key default gen_random_uuid(),artifact_sha256 text,run_id text,plan_fingerprint text,source_row_fingerprint text,plan_kind text,retailer_id bigint,created_at timestamptz default now(),expires_at timestamptz,status text default 'approved',consumed_at timestamptz,source text,plan_json jsonb,identity_observation_result jsonb,execution_result jsonb);
      insert into public.retailers values(12,'Example Nutrition','example-nutrition','https://example.test');
      create function public.atomic_import_canonical_json(p_value jsonb) returns text language sql immutable as $$select p_value::text$$;
      create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)$$;
      create function public.atomic_import_is_decimal_string(p_value text) returns boolean language sql immutable as $$select p_value ~ '^(0|[1-9][0-9]*)(\\.[0-9]+)?$'$$;
      create function public.atomic_import_normalized_identity(p_value text) returns text language sql immutable as $$select lower(regexp_replace(btrim(coalesce(p_value,'')),'[^a-zA-Z0-9]+','','g'))$$;
      create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable security definer as $$select '{"target_environment":"STAGING","project_ref":"hxnrsyyqffztlvcrtgbf"}'::jsonb$$;
      create function public.atomic_import_reviewed_catalogue_plan_allowed(p_plan jsonb) returns boolean language sql stable security definer as $$select exists(select 1 from approved_import_plans where source like 'reviewed-catalogue-package-v1:%' and plan_json=p_plan and status='approved' and consumed_at is null and expires_at>now())$$;
      create function public.validate_reviewed_catalogue_import_plan(p_plan jsonb) returns jsonb language sql stable security definer as $$select jsonb_build_object('legacy',true)$$;
      create function public.validate_product_import_plan_read_only(p_plan jsonb) returns jsonb language sql stable security definer as $$select jsonb_build_object('valid',true)$$;
      create function public.apply_approved_product_import_plan(p_approval_id uuid,p_artifact text,p_fingerprint text,p_source_fingerprint text,p_retailer bigint,p_kind text,p_run text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
      declare a approved_import_plans%rowtype; p jsonb; product_id bigint; variant_id bigint; mapping_id bigint; offer_id bigint; history_id bigint; result jsonb;
      begin
        select * into a from approved_import_plans where id=p_approval_id for update; p:=a.plan_json;
        if not atomic_import_reviewed_catalogue_plan_allowed(p) then raise exception 'approval not allowed'; end if;
        insert into products(name,slug,brand,category,gtin,product_format) values(p#>>'{product,values,name}',p#>>'{product,values,slug}',p#>>'{product,values,brand}',p#>>'{product,values,category}',null,p#>>'{product,values,product_format}') returning id into product_id;
        insert into product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_default) values(product_id,p#>>'{product_variant,values,variant_key}',p#>>'{product_variant,values,display_name}',p#>>'{product_variant,values,flavour_code}',p#>>'{product_variant,values,flavour_label}',(p#>>'{product_variant,values,size_value}')::numeric,p#>>'{product_variant,values,size_unit}',(p#>>'{product_variant,values,pack_count}')::integer,p#>>'{product_variant,values,product_format}',false) returning id into variant_id;
        insert into retailer_products(retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_url,external_options,external_name,external_slug,match_method,match_confidence) values(p_retailer,product_id,variant_id,p#>>'{retailer_product,values,external_product_id}',p#>>'{retailer_product,values,external_variant_id}',p#>>'{retailer_product,values,external_sku}',p#>>'{retailer_product,values,external_gtin}',p#>>'{retailer_product,values,external_url}',p#>'{retailer_product,values,external_options}',p#>>'{retailer_product,values,external_name}',p#>>'{retailer_product,values,external_slug}',p#>>'{retailer_product,values,match_method}',(p#>>'{retailer_product,values,match_confidence}')::numeric) returning id into mapping_id;
        insert into offers(retailer_id,product_id,product_variant_id,retailer_product_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(p_retailer,product_id,variant_id,mapping_id,(p#>>'{offer,values,price}')::numeric,(p#>>'{offer,values,shipping_cost}')::numeric,(p#>>'{offer,values,total_price}')::numeric,(p#>>'{offer,values,in_stock}')::boolean,p#>>'{offer,values,url}',(p#>>'{offer,values,last_checked_at}')::timestamptz) returning id into offer_id;
        insert into price_history(offer_id,price,shipping_cost,total_price,in_stock,checked_at) values(offer_id,(p#>>'{offer,values,price}')::numeric,(p#>>'{offer,values,shipping_cost}')::numeric,(p#>>'{offer,values,total_price}')::numeric,(p#>>'{offer,values,in_stock}')::boolean,(p#>>'{offer,values,last_checked_at}')::timestamptz) returning id into history_id;
        result:=jsonb_build_object('approval_status','consumed','artifact_sha256',p_artifact,'plan_fingerprint',p_fingerprint,'source_row_fingerprint',p_source_fingerprint,'retailer_id',p_retailer::text,'plan_kind',p_kind,'run_id',p_run,'product_id',product_id::text,'product_variant_id',variant_id::text,'retailer_product_id',mapping_id::text,'offer_id',offer_id::text,'price_history_id',history_id::text,'consumed_at',now());
        update approved_import_plans set status='consumed',consumed_at=now(),execution_result=result where id=p_approval_id;
        return result;
      end$$;
      revoke all on all tables in schema public from anon,authenticated,service_role,retailer_catalogue_staging_validator,retailer_catalogue_staging_approver,retailer_catalogue_staging_executor;
    `), "prepare V3 fixture");

    const plan = planFixture();
    plan.meta.plan_fingerprint = succeed(sql(container, `select md5(public.atomic_import_canonical_json(jsonb_set(${literal(plan)},'{meta,plan_fingerprint}','null'::jsonb,false)))`, true), "compute plan fingerprint").stdout.trim();
    const envelope = envelopeFixture(plan);
    const legacy = structuredClone(plan);
    legacy.meta.source_row_fingerprint = "5".repeat(64);
    legacy.meta.idempotency_key = "legacy-test";
    legacy.meta.plan_fingerprint = null;
    legacy.meta.plan_fingerprint = succeed(sql(container, `select md5(public.atomic_import_canonical_json(jsonb_set(${literal(legacy)},'{meta,plan_fingerprint}','null'::jsonb,false)))`, true), "compute legacy plan fingerprint").stdout.trim();
    succeed(sql(container, `insert into approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json) values('${"4".repeat(64)}','legacy','${legacy.meta.plan_fingerprint}','${legacy.meta.source_row_fingerprint}','feed',12,now()+interval '1 hour','reviewed-catalogue-package-v1:legacy:${"6".repeat(64)}',${literal(legacy)})`), "seed V1 compatibility row");
    assert.equal(succeed(sql(container, `select public.atomic_import_reviewed_catalogue_plan_allowed(${literal(legacy)})`, true), "legacy pre-migration allow").stdout.trim(), "t");
    succeed(file(container, MIGRATION), "apply V3 migration");
    assert.equal(succeed(sql(container, `select public.atomic_import_reviewed_catalogue_plan_allowed(${literal(legacy)})`, true), "legacy post-migration allow").stdout.trim(), "t");
    assert.equal(JSON.parse(succeed(sql(container, `select public.validate_reviewed_catalogue_import_plan(${literal(legacy)})::text`, true), "legacy validator compatibility").stdout.trim()).legacy, true);

    const before = succeed(sql(container, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers),(select count(*) from price_history),(select count(*) from approved_import_plans))", true), "before validation counts").stdout.trim();
    const validSql = `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(plan)},${literal(envelope)})::text`;
    const validated = JSON.parse(succeed(sql(container, asRole("supplementscout_staging_validator_login", "retailer_catalogue_staging_validator", validSql, { readOnly: true }), true), "V3 validator").stdout.trim());
    assert.equal(validated.valid, true);
    assert.equal(succeed(sql(container, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers),(select count(*) from price_history),(select count(*) from approved_import_plans))", true), "after validation counts").stdout.trim(), before);
    fails(sql(container, asRole("supplementscout_staging_validator_login", "retailer_catalogue_staging_validator", `select public.approve_reviewed_catalogue_v3_plan(${literal(plan)},${literal(envelope)})`)), "validator cannot approve", /permission denied/);
    fails(sql(container, asRole("supplementscout_staging_validator_login", "retailer_catalogue_staging_validator", `select public.apply_approved_reviewed_catalogue_v3_plan(gen_random_uuid(),${literal(plan)},${literal(envelope)})`)), "validator cannot execute", /permission denied/);
    fails(sql(container, `set session authorization service_role; begin read only; select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(plan)},${literal(envelope)}); rollback`), "service role has no V3 validator access", /permission denied/);

    for (const [label, mutate, pattern] of [
      ["environment", value => { value.target_environment = "PRODUCTION"; }, /V3_TARGET_MISMATCH/],
      ["project", value => { value.target_project_ref = "aftboxmrdgyhizicfsfu"; }, /V3_TARGET_MISMATCH/],
      ["retailer", value => { value.retailer.name = "Wrong"; }, /V3_RETAILER_MISMATCH/],
      ["manifest hash", value => { value.manifest_sha256 = "x".repeat(64); }, /V3_ENVELOPE_SCHEMA_MISMATCH/],
      ["artifact hash", value => { value.artifact_sha256 = "x".repeat(64); }, /V3_ENVELOPE_SCHEMA_MISMATCH/],
    ]) {
      const changed = structuredClone(envelope); mutate(changed);
      fails(sql(container, asRole("supplementscout_staging_validator_login", "retailer_catalogue_staging_validator", `select public.validate_reviewed_catalogue_v3_plan_read_only(${literal(plan)},${literal(changed)})`, { readOnly: true })), `${label} mismatch`, pattern);
    }

    const changedPlan = structuredClone(plan); changedPlan.offer.values.price = "1.00";
    fails(sql(container, asRole("supplementscout_staging_approver_login", "retailer_catalogue_staging_approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(changedPlan)},${literal(envelope)})`)), "approver revalidates exact plan", /V3_PLAN_SCHEMA_MISMATCH|V3_BINDING_MISMATCH/);
    fails(sql(container, asRole("supplementscout_staging_approver_login", "retailer_catalogue_staging_approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(plan)},${literal(envelope)},now()-interval '1 second')`)), "expired approval rejected", /V3_APPROVAL_MISMATCH/);

    const approval = JSON.parse(succeed(sql(container, asRole("supplementscout_staging_approver_login", "retailer_catalogue_staging_approver", `select public.approve_reviewed_catalogue_v3_plan(${literal(plan)},${literal(envelope)})::text`), true), "approve exact V3 plan").stdout.trim());
    assert.equal(approval.contract_kind, "reviewed-catalogue-package-v3");
    const beforeApply = JSON.parse(succeed(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history))", true), "before apply counts").stdout.trim());
    const applied = JSON.parse(succeed(sql(container, asRole("supplementscout_staging_executor_login", "retailer_catalogue_staging_executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}'::uuid,${literal(plan)},${literal(envelope)})::text`), true), "execute exact V3 approval").stdout.trim());
    assert.equal(applied.approval_status, "consumed");
    const afterApply = JSON.parse(succeed(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history))", true), "after apply counts").stdout.trim());
    for (const key of Object.keys(beforeApply)) assert.equal(afterApply[key] - beforeApply[key], 1, `${key} exact business delta`);
    const replay = JSON.parse(succeed(sql(container, asRole("supplementscout_staging_executor_login", "retailer_catalogue_staging_executor", `select public.apply_approved_reviewed_catalogue_v3_plan('${approval.approval_id}'::uuid,${literal(plan)},${literal(envelope)})::text`), true), "idempotent replay").stdout.trim());
    assert.equal(replay.status, "ALREADY_APPLIED"); assert.equal(replay.already_applied, true);
    const replayCounts = JSON.parse(succeed(sql(container, "select jsonb_build_object('products',(select count(*) from products),'product_variants',(select count(*) from product_variants),'retailer_products',(select count(*) from retailer_products),'offers',(select count(*) from offers),'price_history',(select count(*) from price_history))", true), "replay counts").stdout.trim());
    assert.deepEqual(replayCounts, afterApply);

    const acl = JSON.parse(succeed(sql(container, `select jsonb_build_object('validator_validate',has_function_privilege('retailer_catalogue_staging_validator','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),'validator_approve',has_function_privilege('retailer_catalogue_staging_validator','public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)','execute'),'validator_apply',has_function_privilege('retailer_catalogue_staging_validator','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),'approver_apply',has_function_privilege('retailer_catalogue_staging_approver','public.apply_approved_reviewed_catalogue_v3_plan(uuid,jsonb,jsonb)','execute'),'executor_approve',has_function_privilege('retailer_catalogue_staging_executor','public.approve_reviewed_catalogue_v3_plan(jsonb,jsonb,timestamptz)','execute'),'service_validate',has_function_privilege('service_role','public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)','execute'),'validator_table',has_table_privilege('retailer_catalogue_staging_validator','public.approved_import_plans','insert'))`, true), "V3 ACL proof").stdout.trim());
    assert.deepEqual(acl, { validator_validate: true, validator_approve: false, validator_apply: false, approver_apply: false, executor_approve: false, service_validate: false, validator_table: false });

    fails(file(container, ROLLBACK), "rollback refuses V3 ledger data", /rollback blocked by durable approval evidence/i);
    succeed(sql(container, "delete from approved_import_plans where source like 'reviewed-catalogue-package-v3:%'"), "remove disposable V3 approval");
    succeed(file(container, ROLLBACK), "bounded V3 rollback");
    assert.equal(succeed(sql(container, "select to_regprocedure('public.validate_reviewed_catalogue_v3_plan_read_only(jsonb,jsonb)') is null", true), "rollback result").stdout.trim(), "t");
    assert.equal(succeed(sql(container, `select public.atomic_import_reviewed_catalogue_plan_allowed(${literal(legacy)})`, true), "legacy allow after rollback").stdout.trim(), "t");
  } finally {
    run("docker", ["rm", "--force", container], 30_000);
  }
});
