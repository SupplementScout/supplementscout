const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { canonicalJson } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const FORWARD = path.join(ROOT, "supabase/migrations/20261027130000_add_gladiator_nutrition_offer_sync_registration.sql");
const ROLLBACK = path.join(ROOT, "supabase/rollbacks/20261027130000_add_gladiator_nutrition_offer_sync_registration_rollback.sql");
const FUNCTION_SHA = "7b900b07e2948729b47ce0eeb4583de7362ee5d38e70d9a74d6458dc7136dfa8";
const STAGING_MANIFEST = require("../config/retailers/gladiator-nutrition-staging-approved-offer-manifest.json");
const PRODUCTION_MANIFEST = require("../config/retailers/gladiator-nutrition-approved-offer-manifest.json");
const TARGETS = Object.freeze({
  STAGING: Object.freeze({ retailerId: 12, projectRef: "hxnrsyyqffztlvcrtgbf", databaseIdentity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf", manifestSha: "fbee4533e7ea70948a1b229154222200e5275cba6388aea98c0d1d88cf285343", login: "supplementscout_staging_validator_login", role: "retailer_catalogue_staging_validator" }),
  PRODUCTION: Object.freeze({ retailerId: 15, projectRef: "aftboxmrdgyhizicfsfu", databaseIdentity: "supplementscout-production:aftboxmrdgyhizicfsfu", manifestSha: "f07122185a4d601e9e4172378d2fcf6636e5ab1833c33c749f69bccd3fcd8078", login: "supplementscout_production_validator_login", role: "retailer_catalogue_production_validator" }),
});

function run(command, args, options = {}) { return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: options.timeout || 180000, input: options.input }); }
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.equal(result.status, 0, `${label}: ${output(result)}`); return result; }
function fails(result, label, pattern) { assert.equal(result.error, undefined, `${label}: ${result.error?.message}`); assert.notEqual(result.status, 0, `${label} unexpectedly passed`); assert.match(output(result), pattern); }
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10000 }).status === 0; }
function exec(container, args, options = {}) { return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options); }
function psql(container, database, sql, user = "postgres") { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-tA", "-c", sql]); }
function psqlText(container, database, sql) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-f", "-"], { stdin: true, input: sql }); }
function psqlTextAs(container, database, sql, user) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database, "-tA", "-f", "-"], { stdin: true, input: sql }); }
function psqlFile(container, database, file) { return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-f", `/workspace/${path.relative(ROOT, file).replaceAll("\\", "/")}`]); }
function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sha(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex"); }
function resultJson(result) { return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)); }
function normalizedRows(manifest) { return manifest.rows.map((row) => ({ mapping_id: String(row.mapping_id), offer_id: String(row.offer_id), external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), canonical_product_id: String(row.canonical_product_id), canonical_variant_id: String(row.canonical_variant_id) })); }
function waitForPostgres(container) {
  let consecutive = 0;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = exec(container, ["pg_isready", "-U", "postgres"], { timeout: 5000 });
    consecutive = result.status === 0 ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not start");
}

function fixtureSql() {
  const manifests = [[12, STAGING_MANIFEST], [15, PRODUCTION_MANIFEST]];
  const products = new Map();
  const variants = new Map();
  const mappings = [];
  const offers = [];
  for (const [retailerId, manifest] of manifests) for (const row of manifest.rows) {
    products.set(String(row.canonical_product_id), row.canonical_product_id);
    variants.set(String(row.canonical_variant_id), { id: row.canonical_variant_id, productId: row.canonical_product_id });
    mappings.push(`(${row.mapping_id},${retailerId},${row.canonical_product_id},${row.canonical_variant_id},${quote(row.external_product_id)},${quote(row.external_variant_id)})`);
    offers.push(`(${row.offer_id},${retailerId},${row.canonical_product_id},${row.canonical_variant_id},${row.mapping_id})`);
  }
  return `
create extension if not exists pgcrypto;
do $roles$ begin
  if to_regrole('anon') is null then create role anon nologin; end if;
  if to_regrole('authenticated') is null then create role authenticated nologin; end if;
  if to_regrole('service_role') is null then create role service_role nologin; end if;
  if to_regrole('retailer_catalogue_staging_validator') is null then create role retailer_catalogue_staging_validator nologin noinherit; end if;
  if to_regrole('retailer_catalogue_production_validator') is null then create role retailer_catalogue_production_validator nologin noinherit; end if;
  if to_regrole('retailer_catalogue_staging_approver') is null then create role retailer_catalogue_staging_approver nologin noinherit; end if;
  if to_regrole('retailer_catalogue_production_approver') is null then create role retailer_catalogue_production_approver nologin noinherit; end if;
  if to_regrole('retailer_catalogue_staging_executor') is null then create role retailer_catalogue_staging_executor nologin noinherit; end if;
  if to_regrole('retailer_catalogue_production_executor') is null then create role retailer_catalogue_production_executor nologin noinherit; end if;
  if to_regrole('supplementscout_staging_validator_login') is null then create role supplementscout_staging_validator_login login noinherit; end if;
  if to_regrole('supplementscout_production_validator_login') is null then create role supplementscout_production_validator_login login noinherit; end if;
end $roles$;
grant retailer_catalogue_staging_validator to supplementscout_staging_validator_login;
grant retailer_catalogue_production_validator to supplementscout_production_validator_login;
create table public.retailers(id bigint primary key,name text,slug text,website text);
create table public.products(id bigint primary key,is_active boolean not null,merged_into_product_id bigint,merged_at timestamptz);
create table public.product_variants(id bigint primary key,product_id bigint not null,is_active boolean not null);
create table public.retailer_products(id bigint primary key,retailer_id bigint not null,product_id bigint not null,product_variant_id bigint not null,external_product_id text,external_variant_id text);
create table public.offers(id bigint primary key,retailer_id bigint not null,product_id bigint not null,product_variant_id bigint not null,retailer_product_id bigint not null);
create table public.retailer_catalogue_parent_plans(id uuid primary key,parent_plan_fingerprint text,retailer_id bigint,target_environment text,source_snapshot_fingerprint text,canonical_snapshot_fingerprint text,adapter_fingerprint text,policy_fingerprint text,code_commit text,expected_state_fingerprint text,status text,expected_deltas jsonb,plan_json jsonb,child_manifest jsonb,rollback_manifest jsonb,source_captured_at timestamptz,canonical_snapshot_at timestamptz,created_by text,audit_log jsonb);
create table public.retailer_catalogue_child_plans(id uuid primary key,parent_plan_id uuid,retailer_id bigint,target_environment text,child_plan_fingerprint text,parent_plan_fingerprint text,source_snapshot_fingerprint text,canonical_snapshot_fingerprint text,adapter_fingerprint text,policy_fingerprint text,code_commit text,expected_state_fingerprint text,batch_index integer,batch_count integer,dependency_group text,rollback_group text,record_ids jsonb,status text,expected_deltas jsonb,plan_json jsonb,rollback_manifest jsonb,audit_log jsonb);
insert into public.retailers values(12,'Gladiator Nutrition','gladiator-nutrition','https://gladiatornutrition.co.uk'),(15,'Gladiator Nutrition','gladiator-nutrition','https://gladiatornutrition.co.uk');
insert into public.products values ${[...products.values()].map((id) => `(${id},true,null,null)`).join(",")};
insert into public.product_variants values ${[...variants.values()].map((row) => `(${row.id},${row.productId},true)`).join(",")};
insert into public.retailer_products values ${mappings.join(",")};
insert into public.offers values ${offers.join(",")};
create function public.atomic_import_has_exact_keys(p_value jsonb,p_keys text[]) returns boolean language sql immutable as $$select jsonb_typeof(p_value)='object' and (select array_agg(key order by key) from jsonb_object_keys(p_value) key)=(select array_agg(key order by key) from unnest(p_keys) key)$$;
create function public.atomic_import_canonical_json(p_value jsonb) returns text language plpgsql immutable strict set search_path=pg_catalog as $canonical$ declare v_result text; begin case jsonb_typeof(p_value) when 'object' then select '{'||coalesce(string_agg(to_jsonb(entry.key)::text||':'||public.atomic_import_canonical_json(entry.value),',' order by entry.key),'')||'}' into v_result from jsonb_each(p_value) entry; when 'array' then select '['||coalesce(string_agg(public.atomic_import_canonical_json(entry.value),',' order by entry.ordinality),'')||']' into v_result from jsonb_array_elements(p_value) with ordinality entry(value,ordinality); else v_result:=p_value::text; end case; return v_result; end $canonical$;
create function public.retailer_catalogue_sha256_json(p_value jsonb) returns text language sql immutable strict set search_path=pg_catalog,public as $$select encode(digest(convert_to(public.atomic_import_canonical_json(p_value),'UTF8'),'sha256'),'hex')$$;
create function public.retailer_catalogue_raise(p_code text,p_summary text) returns void language plpgsql as $$begin raise exception '%',jsonb_build_object('code',p_code,'summary',p_summary)::text using errcode='P0001'; end$$;
create function public.retailer_catalogue_staging_runtime_guard(p_environment text,p_ref text,p_identity text) returns void language plpgsql as $$begin if p_environment<>'STAGING' or p_ref<>'hxnrsyyqffztlvcrtgbf' or p_identity<>'supplementscout-staging:hxnrsyyqffztlvcrtgbf' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','staging guard'); end if; end$$;
create function public.retailer_catalogue_production_runtime_guard(p_environment text,p_ref text,p_identity text) returns void language plpgsql as $$begin if p_environment<>'PRODUCTION' or p_ref<>'aftboxmrdgyhizicfsfu' or p_identity<>'supplementscout-production:aftboxmrdgyhizicfsfu' then perform public.retailer_catalogue_raise('RSBI_ENVIRONMENT_BLOCKED','production guard'); end if; end$$;
create function public.retailer_offer_sync_validate_manifest(p_manifest jsonb) returns jsonb language sql stable as $$select jsonb_build_object('valid',true)$$;
create function public.retailer_catalogue_assert_migration_ledger(p_versions jsonb,p_fingerprint text) returns text language sql stable as $$select p_fingerprint$$;
`;
}

function expectedDeltas() { return { row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 }, logical_field_deltas: { offer_price_updates: 0, offer_shipping_updates: 0, offer_total_updates: 0, offer_stock_updates: 0, offer_url_updates: 0, mapping_url_updates: 0, mapping_updated_at_updates: 0, last_checked_at_updates: 0 } }; }
function request(environment, overrides = {}) {
  const target = TARGETS[environment];
  const manifestSource = environment === "STAGING" ? STAGING_MANIFEST : PRODUCTION_MANIFEST;
  const manifest = normalizedRows(manifestSource);
  const capturedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
  const source = (environment === "STAGING" ? "1" : "2").repeat(64);
  const parentId = environment === "STAGING" ? "00000000-0000-4000-8000-000000000012" : "00000000-0000-4000-8000-000000000015";
  const childId = environment === "STAGING" ? "10000000-0000-4000-8000-000000000012" : "10000000-0000-4000-8000-000000000015";
  const artifact = { expected_migration_versions: ["20261027120000_consolidate_reviewed_catalogue_v3_owned_runtime"], expected_migration_fingerprint: "3".repeat(64), retailer_id: String(target.retailerId), retailer_slug: "gladiator-nutrition", target_environment: environment, target_project_ref: target.projectRef, target_database_identity: target.databaseIdentity, source_snapshot_fingerprint: source, source_captured_at: capturedAt, code_commit: "4".repeat(40), artifact_fingerprint: "5".repeat(64), expected_state_fingerprint: "6".repeat(64), adapter_fingerprint: "7".repeat(64), policy_fingerprint: "8".repeat(64), rows: [{ retailer_product_id: manifest[0].mapping_id, offer_id: manifest[0].offer_id, external_product_id: manifest[0].external_product_id, external_variant_id: manifest[0].external_variant_id }], expected_deltas: expectedDeltas() };
  const children = [{ child_plan_id: childId, artifact }];
  const manifestFingerprint = sha({ approved_manifest_sha256: target.manifestSha.toUpperCase(), environment, rows: manifest });
  const workflow = { repository: "SupplementScout/supplementscout", run_id: "integration", run_attempt: "1", actor: "integration" };
  const parent = { schema_version: 1, kind: "retailer-existing-offer-sync-parent", parent_plan_id: parentId, target_environment: environment, target_project_ref: target.projectRef, target_database_identity: target.databaseIdentity, retailer_id: String(target.retailerId), source_country: "GB", source_snapshot_fingerprint: source, source_captured_at: capturedAt, manifest_fingerprint: manifestFingerprint, approved_manifest_sha256: target.manifestSha.toUpperCase(), child_plan_ids: [childId], child_fingerprints: [artifact.artifact_fingerprint], code_commit: artifact.code_commit, expires_at: expiresAt, workflow };
  const value = { schema_version: 1, kind: "retailer-existing-offer-sync-control-plan-registration", target_environment: environment, target_project_ref: target.projectRef, target_database_identity: target.databaseIdentity, retailer_id: String(target.retailerId), retailer_slug: "gladiator-nutrition", source_platform: "SHOPIFY", source_domain: "gladiatornutrition.co.uk", source_country: "GB", source_snapshot_fingerprint: source, source_captured_at: capturedAt, approved_manifest_sha256: target.manifestSha.toUpperCase(), manifest, manifest_fingerprint: manifestFingerprint, parent_plan_id: parentId, parent_plan_fingerprint: sha(parent), children, code_commit: artifact.code_commit, expires_at: expiresAt, workflow, request_fingerprint: null };
  Object.assign(value, overrides);
  value.request_fingerprint = sha(value);
  return value;
}

function call(container, database, environment, value, login = TARGETS[environment].login, role = TARGETS[environment].role) {
  return psqlTextAs(container, database, `set role ${role}; select public.register_gladiator_nutrition_offer_sync_control_plan(${quote(JSON.stringify(value))}::jsonb)::text;`, login);
}

test("Gladiator registration binds disposable STAGING 12 and PRODUCTION 15 and rejects cross-environment identities", { skip: !dockerAvailable() && "Docker daemon unavailable" }, () => {
  const container = `supplementscout-gladiator-binding-${crypto.randomBytes(5).toString("hex")}`;
  let primaryError;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start PostgreSQL");
    waitForPostgres(container);
    const database = "gladiator_binding";
    ok(exec(container, ["createdb", "-U", "postgres", database]), "create database");
    ok(psqlText(container, database, fixtureSql()), "install disposable fixture");
    const businessBefore = ok(psql(container, database, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers))::text"), "business before").stdout.trim();
    ok(psqlFile(container, database, FORWARD), "install Gladiator registration");

    const staging = request("STAGING");
    const production = request("PRODUCTION");
    assert.equal(resultJson(ok(call(container, database, "STAGING", staging), "valid staging binding")).mapping_count, 46);
    assert.equal(resultJson(ok(call(container, database, "PRODUCTION", production), "valid production binding")).mapping_count, 603);

    const stagingAs15 = request("STAGING", { retailer_id: "15" });
    fails(call(container, database, "STAGING", stagingAs15), "STAGING retailer 15", /RSBI_ENVIRONMENT_BLOCKED/);
    const productionAs12 = request("PRODUCTION", { retailer_id: "12" });
    fails(call(container, database, "PRODUCTION", productionAs12), "PRODUCTION retailer 12", /RSBI_ENVIRONMENT_BLOCKED/);
    fails(call(container, database, "PRODUCTION", production, TARGETS.STAGING.login, TARGETS.STAGING.role), "staging identity on production", /RSBI_ENVIRONMENT_BLOCKED/);
    fails(call(container, database, "STAGING", staging, TARGETS.PRODUCTION.login, TARGETS.PRODUCTION.role), "production identity on staging", /RSBI_ENVIRONMENT_BLOCKED/);

    const control = JSON.parse(ok(psql(container, database, "select jsonb_build_object('parents',(select jsonb_agg(jsonb_build_object('environment',target_environment,'retailer_id',retailer_id) order by target_environment) from retailer_catalogue_parent_plans),'children',(select count(*) from retailer_catalogue_child_plans),'function_sha',encode(digest(pg_get_functiondef('public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)'::regprocedure),'sha256'),'hex'))::text"), "control state").stdout.trim());
    assert.deepEqual(control.parents, [{ environment: "PRODUCTION", retailer_id: 15 }, { environment: "STAGING", retailer_id: 12 }]);
    assert.equal(control.children, 2);
    assert.equal(control.function_sha, FUNCTION_SHA);
    const businessAfter = ok(psql(container, database, "select jsonb_build_array((select count(*) from products),(select count(*) from product_variants),(select count(*) from retailer_products),(select count(*) from offers))::text"), "business after").stdout.trim();
    assert.equal(businessAfter, businessBefore);
    ok(psqlFile(container, database, ROLLBACK), "rollback exact environment-safe registration");
    assert.equal(ok(psql(container, database, "select to_regprocedure('public.register_gladiator_nutrition_offer_sync_control_plan(jsonb)') is null"), "rollback readback").stdout.trim(), "t");
  } catch (error) { primaryError = error; throw error; } finally {
    const cleanup = run("docker", ["rm", "-f", container], { timeout: 30000 });
    if (!primaryError && cleanup.status !== 0) assert.fail(output(cleanup));
  }
});
