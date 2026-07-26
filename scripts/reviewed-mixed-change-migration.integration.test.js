const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { fingerprint } = require("./lib/retailer-offer-sync/artifacts");
const {
  buildReviewedMixedChangeContract,
  expectedArtifactDeltas,
  loadReviewedMixedChangeManifest,
} = require("./lib/retailer-offer-sync/reviewed-mixed-change");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "supabase/migrations/20260726100000_add_reviewed_mixed_change_approval.sql";
const ROLLBACK = "supabase/rollbacks/20260726100000_add_reviewed_mixed_change_approval.sql";
const IMAGE = "postgres:17-alpine";

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout: options.timeout || 180_000, input: options.input });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label}:\n${output(result)}`);
  return result;
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10_000 }).status === 0;
}
function exec(container, args, options = {}) {
  return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options);
}
function sql(container, text) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-f", "-"], { stdin: true, input: text });
}
function sqlAs(container, user, text) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", "postgres", "-tA", "-f", "-"], { stdin: true, input: text });
}
function literal(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'::jsonb`;
}
function wait(container) {
  for (let index = 0; index < 80; index += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"]).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL unavailable");
}

function setupSql() {
  return `
create extension pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role retailer_catalogue_staging_validator nologin;
create role retailer_catalogue_staging_approver nologin;
create role retailer_catalogue_staging_executor nologin;
create role retailer_catalogue_production_validator nologin;
create role retailer_catalogue_production_approver nologin;
create role retailer_catalogue_production_executor nologin;
create role supplementscout_production_validator_login login;
grant retailer_catalogue_production_validator to supplementscout_production_validator_login;
create table public.retailers(id bigint primary key);
insert into public.retailers values(10);
create table public.products(id bigint primary key,is_active boolean,merged_into_product_id bigint);
create table public.product_variants(id bigint primary key,product_id bigint,is_active boolean);
create table public.retailer_products(id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,external_product_id text,external_variant_id text);
create table public.offers(id bigint primary key,retailer_id bigint,product_id bigint,product_variant_id bigint,retailer_product_id bigint);
create table public.retailer_offer_sync_batch_approvals(
  id uuid primary key default gen_random_uuid(),
  artifact_fingerprint text not null,
  approved_manifest jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table public.approved_import_plans(id uuid primary key default gen_random_uuid(),consumed_at timestamptz,expires_at timestamptz);
create table public.retailer_catalogue_parent_plans(
  id uuid primary key,parent_plan_fingerprint text,retailer_id bigint,target_environment text,
  source_snapshot_fingerprint text,canonical_snapshot_fingerprint text,adapter_fingerprint text,
  policy_fingerprint text,code_commit text,expected_state_fingerprint text,status text,
  expected_deltas jsonb,plan_json jsonb,child_manifest jsonb,rollback_manifest jsonb,
  source_captured_at timestamptz,canonical_snapshot_at timestamptz,created_by text,audit_log jsonb
);
create table public.retailer_catalogue_child_plans(
  id uuid primary key,parent_plan_id uuid,retailer_id bigint,target_environment text,
  child_plan_fingerprint text,parent_plan_fingerprint text,source_snapshot_fingerprint text,
  canonical_snapshot_fingerprint text,adapter_fingerprint text,policy_fingerprint text,
  code_commit text,expected_state_fingerprint text,batch_index integer,batch_count integer,
  dependency_group text,rollback_group text,record_ids jsonb,status text,expected_deltas jsonb,
  plan_json jsonb,rollback_manifest jsonb,audit_log jsonb
);
create table public.retailer_catalogue_apply_runs(id uuid primary key default gen_random_uuid(),status text);
create function public.atomic_import_has_exact_keys(p jsonb,k text[]) returns boolean
language sql immutable as $$
  select jsonb_typeof(p)='object'
    and (select array_agg(key order by key) from jsonb_object_keys(p) key)
      =(select array_agg(x order by x) from unnest(k)x)
$$;
create function public.retailer_catalogue_raise(c text,m text) returns void
language plpgsql as $$begin raise exception '%: %',c,m;end$$;
create function public.atomic_import_canonical_json(v jsonb) returns text
language plpgsql immutable strict set search_path=pg_catalog as $$
declare result text;
begin
  case jsonb_typeof(v)
    when 'object' then
      select '{'||coalesce(string_agg(to_jsonb(entry.key)::text||':'||public.atomic_import_canonical_json(entry.value),',' order by entry.key),'')||'}'
      into result from jsonb_each(v) entry;
    when 'array' then
      select '['||coalesce(string_agg(public.atomic_import_canonical_json(entry.value),',' order by entry.ordinality),'')||']'
      into result from jsonb_array_elements(v) with ordinality entry(value,ordinality);
    else result:=v::text;
  end case;
  return result;
end
$$;
create function public.retailer_catalogue_sha256_json(v jsonb) returns text
language sql immutable as $$select encode(digest(convert_to(public.atomic_import_canonical_json(v),'UTF8'),'sha256'),'hex')$$;
create function public.retailer_catalogue_actual_database_target() returns jsonb
language sql stable as $$select '{"target_environment":"PRODUCTION"}'::jsonb$$;
create function public.retailer_catalogue_staging_runtime_guard(text,text,text) returns jsonb
language sql stable as $$select '{"valid":true}'::jsonb$$;
create function public.retailer_catalogue_production_runtime_guard(text,text,text) returns jsonb
language sql stable as $$select '{"valid":true}'::jsonb$$;
create function public.retailer_catalogue_assert_migration_ledger(v jsonb,f text) returns text
language sql stable as $$select f$$;
create function public.retailer_offer_sync_validate_manifest(v jsonb) returns jsonb
language sql stable as $$select '{"valid":true}'::jsonb$$;
create function public.validate_product_import_plan_read_only(v jsonb) returns jsonb
language sql stable as $$select '{"valid":true}'::jsonb$$;
create function public.retailer_offer_sync_validate_batch_read_only_internal(p_request jsonb) returns jsonb
language sql stable security definer as $$select '{"ordinary":true}'::jsonb$$;
create function public.retailer_offer_sync_approve_batch_internal(p_request jsonb) returns jsonb
language plpgsql volatile security definer as $$
declare i uuid;
begin
  insert into public.retailer_offer_sync_batch_approvals(artifact_fingerprint,approved_manifest,expires_at)
  values(p_request#>>'{artifact,artifact_fingerprint}',p_request->'artifact',(p_request->>'expires_at')::timestamptz)
  returning id into i;
  return jsonb_build_object('approval_id',i,'status','APPROVED');
end
$$;
create function public.retailer_offer_sync_execute_batch_internal(p_request jsonb) returns jsonb
language plpgsql volatile security definer as $$
begin
  if current_setting('app.inject_failure',true)='on' then raise exception 'INJECTED_DB_FAILURE'; end if;
  return '{"status":"APPLIED"}'::jsonb;
end
$$;
`;
}

function reviewedFixture() {
  const reviewed = loadReviewedMixedChangeManifest(
    path.join(ROOT, "tmp/jons-15-review/jons-15-reviewed-manifest-a27e9a90.json"),
    "15a1a71238af5fa6cb08a334b859230c8cc0944cb2856c0572ef9abbd0c380a5",
  );
  const capturedAt = new Date().toISOString();
  const rows = reviewed.reviewed_rows.map((row, index) => {
    const priceChanged = row.changed_fields.includes("price");
    const stockChanged = row.changed_fields.includes("stock");
    const urlChanged = row.changed_fields.includes("url");
    const shipping = "3.99";
    return {
      offer_id: String(1000 + index),
      retailer_product_id: String(2000 + index),
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      action: row.action,
      changed_fields: { price: priceChanged, stock: stockChanged, url: urlChanged, blocked: false },
      expected_deltas: {
        row_count_deltas: { products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: priceChanged ? 1 : 0 },
        logical_field_deltas: {
          offer_price_updates: priceChanged ? 1 : 0,
          offer_shipping_updates: 0,
          offer_total_updates: priceChanged ? 1 : 0,
          offer_stock_updates: stockChanged ? 1 : 0,
          offer_url_updates: urlChanged ? 1 : 0,
          mapping_url_updates: urlChanged ? 1 : 0,
          mapping_updated_at_updates: urlChanged ? 1 : 0,
          last_checked_at_updates: 1,
        },
      },
      atomic_plan: {
        meta: { operation_type: "standard_import" },
        product: { action: "existing" },
        product_variant: { action: "existing" },
        retailer: { action: "existing", id: "10" },
        retailer_product: {
          action: urlChanged ? "update" : "noop",
          id: String(2000 + index),
          values: { external_url: row.after.url },
        },
        offer: {
          action: "update",
          id: String(1000 + index),
          values: {
            price: row.after.price,
            shipping_cost: shipping,
            total_price: (Number(row.after.price) + Number(shipping)).toFixed(2),
            in_stock: row.after.in_stock,
            url: row.after.url,
          },
        },
        price_history: { action: priceChanged ? "create" : "noop" },
        approval: { approved: false, approval_type: "none" },
        expected_state: {
          offer: {
            price: row.before.price,
            shipping_cost: shipping,
            total_price: (Number(row.before.price) + Number(shipping)).toFixed(2),
            in_stock: row.before.in_stock,
            url: row.before.url,
          },
        },
      },
    };
  });
  const core = {
    retailer_slug: "jon-s-supplements",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    target_database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
    retailer_id: "10",
    source_snapshot_fingerprint: reviewed.manifest.source_capture_sha256,
    source_captured_at: capturedAt,
    code_commit: "d".repeat(40),
    expected_state_fingerprint: "e".repeat(64),
    adapter_fingerprint: "f".repeat(64),
    policy_fingerprint: "1".repeat(64),
    expected_deltas: expectedArtifactDeltas(reviewed.manifest),
    rows,
  };
  const artifact = { ...core, artifact_fingerprint: fingerprint(core) };
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const contract = buildReviewedMixedChangeContract({ reviewed, artifact, targetEnvironment: "PRODUCTION", expiresAt });
  return { artifact, contract, expiresAt };
}

function registrationFixture(fixture) {
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
  const manifest = [...fixture.artifact.rows]
    .sort((left, right) => Number(left.retailer_product_id) - Number(right.retailer_product_id))
    .map((row) => ({
      mapping_id: row.retailer_product_id,
      offer_id: row.offer_id,
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
    }));
  const workflow = { repository: "SupplementScout/supplementscout", run_id: "integration", run_attempt: "1", actor: "integration" };
  const parentHashInput = {
    schema_version: 1,
    kind: "jons-existing-offer-sync-parent",
    parent_plan_id: parentId,
    target_environment: "PRODUCTION",
    target_project_ref: fixture.artifact.target_project_ref,
    target_database_identity: fixture.artifact.target_database_identity,
    retailer_id: "10",
    source_country: "GB",
    source_snapshot_fingerprint: fixture.artifact.source_snapshot_fingerprint,
    source_captured_at: fixture.artifact.source_captured_at,
    manifest_fingerprint: fingerprint(manifest),
    child_plan_ids: [childId],
    child_fingerprints: [fixture.artifact.artifact_fingerprint],
    code_commit: fixture.artifact.code_commit,
    expires_at: fixture.expiresAt,
    workflow,
  };
  const request = {
    schema_version: 1,
    kind: "jons-existing-offer-sync-control-plan-registration",
    target_environment: "PRODUCTION",
    target_project_ref: fixture.artifact.target_project_ref,
    target_database_identity: fixture.artifact.target_database_identity,
    retailer_id: "10",
    retailer_slug: "jon-s-supplements",
    source_platform: "SHOPIFY",
    source_domain: "jonssupplements.co.uk",
    source_country: "GB",
    source_snapshot_fingerprint: fixture.artifact.source_snapshot_fingerprint,
    source_captured_at: fixture.artifact.source_captured_at,
    manifest,
    manifest_fingerprint: fingerprint(manifest),
    parent_plan_id: parentId,
    parent_plan_fingerprint: fingerprint(parentHashInput),
    children: [{ child_plan_id: childId, artifact: fixture.artifact }],
    code_commit: fixture.artifact.code_commit,
    expires_at: fixture.expiresAt,
    workflow,
    request_fingerprint: null,
    reviewed_mixed_change_contract: fixture.contract,
  };
  request.request_fingerprint = fingerprint(request);
  return request;
}

test("reviewed mixed-change migration parses, registers and validates only the exact stable reviewed scope", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `reviewed-mixed-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start");
    wait(container);
    ok(sql(container, setupSql()), "setup");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]), "migration");
    const beforeRerun = ok(sql(container, `
      select
        (select count(*) from public.retailer_offer_sync_reviewed_mixed_change_definitions)
        ||':'||
        (select count(*) from pg_proc where proname like '%reviewed_mixed_change%')
        ||':'||
        (select count(*) from public.retailer_offer_sync_reviewed_mixed_change_bindings);
    `), "pre-rerun state");
    const rerun = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]);
    assert.notEqual(rerun.status, 0);
    assert.match(output(rerun), /already installed; rerun rejected/);
    const afterRerun = ok(sql(container, `
      select
        (select count(*) from public.retailer_offer_sync_reviewed_mixed_change_definitions)
        ||':'||
        (select count(*) from pg_proc where proname like '%reviewed_mixed_change%')
        ||':'||
        (select count(*) from public.retailer_offer_sync_reviewed_mixed_change_bindings);
    `), "post-rerun state");
    assert.equal(afterRerun.stdout.trim(), beforeRerun.stdout.trim());
    const definition = ok(sql(container, "select authorization_id||':'||target_environment||':'||row_count from public.retailer_offer_sync_reviewed_mixed_change_definitions;"), "definition");
    assert.equal(definition.stdout.trim(), "jons-15-15a1a71238af5fa6-production:PRODUCTION:15");
    const ordinary = ok(sql(container, "select public.retailer_offer_sync_validate_batch_read_only_internal('{}'::jsonb);"), "ordinary dispatch");
    assert.match(ordinary.stdout, /ordinary/);
    const functions = ok(sql(container, "select count(*) from pg_proc where proname like '%reviewed_mixed_change%';"), "function surface");
    assert.equal(functions.stdout.trim(), "3");
    const fixture = reviewedFixture();
    const exact = ok(sql(container, `select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(${literal(fixture.artifact)},${literal(fixture.contract)},'${fixture.expiresAt}'::timestamptz);`), "exact contract");
    assert.match(exact.stdout, /"valid": true/);
    const drifted = structuredClone(fixture);
    drifted.artifact.rows[0].external_variant_id = "1";
    const blocked = sql(container, `select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(${literal(drifted.artifact)},${literal(drifted.contract)},'${drifted.expiresAt}'::timestamptz);`);
    assert.notEqual(blocked.status, 0);
    assert.match(output(blocked), /RSBI_APPROVAL_MISMATCH/);
    const catalogueSql = fixture.artifact.rows.map((row, index) => {
      const productId = 3000 + index;
      const variantId = 4000 + index;
      return `
insert into public.products values(${productId},true,null);
insert into public.product_variants values(${variantId},${productId},true);
insert into public.retailer_products values(${row.retailer_product_id},10,${productId},${variantId},'${row.external_product_id}','${row.external_variant_id}');
insert into public.offers values(${row.offer_id},10,${productId},${variantId},${row.retailer_product_id});`;
    }).join("\n");
    ok(sql(container, catalogueSql), "catalogue fixture");
    const registrationRequest = registrationFixture(fixture);
    const registered = ok(sqlAs(
      container,
      "supplementscout_production_validator_login",
      `begin;set role retailer_catalogue_production_validator;select public.register_reviewed_mixed_change_control_plan(${literal(registrationRequest)})::text;commit;`,
    ), "reviewed registration");
    assert.match(registered.stdout, /"operation_count": 15/);
    assert.match(registered.stdout, /"mapping_count": 15/);
    const plans = ok(sql(container, "select (select count(*) from public.retailer_catalogue_parent_plans)||':'||(select count(*) from public.retailer_catalogue_child_plans);"), "control plans");
    assert.equal(plans.stdout.trim(), "1:1");
    const approvalRequest = {
      schema_version: 1,
      child_plan_id: crypto.randomUUID(),
      parent_plan_fingerprint: "a".repeat(64),
      child_plan_fingerprint: fixture.artifact.artifact_fingerprint,
      artifact: fixture.artifact,
      execution_fingerprint: "b".repeat(64),
      expected_migration_versions: ["20260726100000_add_reviewed_mixed_change_approval"],
      expected_migration_fingerprint: "c".repeat(64),
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      approved_by: "integration-test",
      expires_at: fixture.expiresAt,
      production_project_ref: "aftboxmrdgyhizicfsfu",
      production_database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
      reviewed_mixed_change_contract: fixture.contract,
    };
    const approved = JSON.parse(ok(sql(container, `select public.retailer_offer_sync_approve_batch_internal(${literal(approvalRequest)})::text;`), "approve").stdout.trim());
    const executionRequest = {
      schema_version: 1,
      approval_id: approved.approval_id,
      execution_fingerprint: approvalRequest.execution_fingerprint,
      expected_migration_versions: approvalRequest.expected_migration_versions,
      expected_migration_fingerprint: approvalRequest.expected_migration_fingerprint,
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      production_project_ref: approvalRequest.production_project_ref,
      production_database_identity: approvalRequest.production_database_identity,
      requested_at: new Date().toISOString(),
      explicit_allow: true,
    };
    const injected = sql(container, `begin;set local app.inject_failure='on';select public.retailer_offer_sync_execute_batch_internal(${literal(executionRequest)});commit;`);
    assert.notEqual(injected.status, 0);
    assert.match(output(injected), /INJECTED_DB_FAILURE/);
    const afterFailure = ok(sql(container, "select status||':'||(consumed_at is null)::text from public.retailer_offer_sync_reviewed_mixed_change_bindings;"), "rollback state");
    assert.equal(afterFailure.stdout.trim(), "APPROVED:true");
    assert.match(ok(sql(container, `select public.retailer_offer_sync_execute_batch_internal(${literal(executionRequest)});`), "execute").stdout, /APPLIED/);
    const consumed = ok(sql(container, "select status||':'||(consumed_at is not null)::text from public.retailer_offer_sync_reviewed_mixed_change_bindings;"), "consumed state");
    assert.equal(consumed.stdout.trim(), "CONSUMED:true");
    const replay = sql(container, `select public.retailer_offer_sync_execute_batch_internal(${literal(executionRequest)});`);
    assert.notEqual(replay.status, 0);
    assert.match(output(replay), /RSBI_REPLAY_BLOCKED/);
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});

test("reviewed mixed-change rollback restores ordinary dispatch before any binding", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `reviewed-mixed-rb-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start");
    wait(container);
    ok(sql(container, setupSql()), "setup");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]), "migration");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${ROLLBACK}`]), "rollback");
    const ordinary = ok(sql(container, "select public.retailer_offer_sync_validate_batch_read_only_internal('{}'::jsonb);"), "ordinary after rollback");
    assert.match(ordinary.stdout, /ordinary/);
    const removed = ok(sql(container, "select to_regclass('public.retailer_offer_sync_reviewed_mixed_change_definitions') is null;"), "removed");
    assert.equal(removed.stdout.trim(), "t");
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});
