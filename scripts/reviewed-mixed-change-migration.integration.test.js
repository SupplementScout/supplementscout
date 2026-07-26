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
const SCOPED_MIGRATION = "supabase/migrations/20260726120000_add_scoped_reviewed_mixed_change_fingerprints.sql";
const SCOPED_ROLLBACK = "supabase/rollbacks/20260726120000_add_scoped_reviewed_mixed_change_fingerprints.sql";
const MAPPED_SCOPE_MIGRATION =
  "supabase/migrations/20260726130000_add_mapped_scope_reviewed_approval.sql";
const JONS_16_DEFINITION_MIGRATION =
  "supabase/migrations/20260726140000_authorize_reviewed_jons_16_mapped_scope.sql";
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
  let consecutive = 0;
  for (let index = 0; index < 80; index += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"]).status === 0) {
      consecutive += 1;
      if (consecutive === 2) return;
    } else {
      consecutive = 0;
    }
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

function scopedReviewedFixture() {
  const base = reviewedFixture();
  const reviewed = loadReviewedMixedChangeManifest(
    path.join(ROOT, "tmp/jons-15-review/jons-15-reviewed-manifest-scoped-8c08e919.json"),
    "2b14b0d7b09ab70f41aacb1907bd1718d605cab9fcde0246dc7b7a7f167718c2",
  );
  const rows = base.artifact.rows.map((row) => ({
    ...row,
    atomic_plan: {
      ...row.atomic_plan,
      expected_state: {
        retailer_product: { updated_at: "2026-07-26T08:00:00.000000Z" },
        offer: {
          ...row.atomic_plan.expected_state.offer,
          last_checked_at: "2026-07-26T08:00:00.000000Z",
        },
      },
    },
  }));
  const core = {
    ...base.artifact,
    target_environment: "STAGING",
    target_project_ref: "hxnrsyyqffztlvcrtgbf",
    target_database_identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
    source_snapshot_fingerprint:
      reviewed.manifest.scoped_source_contract.observed_full_source_fingerprint,
    rows,
  };
  delete core.artifact_fingerprint;
  const artifact = { ...core, artifact_fingerprint: fingerprint(core) };
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const scoped = reviewed.manifest.scoped_source_contract;
  const contract = buildReviewedMixedChangeContract({
    reviewed,
    artifact,
    targetEnvironment: "STAGING",
    expiresAt,
    scopedSourceEvidence: {
      full_source_fingerprint: scoped.observed_full_source_fingerprint,
      reviewed_full_source_fingerprint: scoped.reviewed_full_source_fingerprint,
      mapped_scope_fingerprint: scoped.mapped_scope_fingerprint,
      mapped_scope_row_count: scoped.mapped_scope_row_count,
      unmapped_source_delta: scoped.unmapped_source_delta,
      unmapped_source_delta_hash: scoped.unmapped_source_delta_hash,
    },
  });
  return { artifact, contract, expiresAt };
}

function mappedReviewedFixture() {
  const base = reviewedFixture();
  const loaded = loadReviewedMixedChangeManifest(
    path.join(ROOT, "tmp/jons-15-review/jons-15-reviewed-manifest-scoped-8c08e919.json"),
    "2b14b0d7b09ab70f41aacb1907bd1718d605cab9fcde0246dc7b7a7f167718c2",
  );
  const mappedSourceContract = {
    schema_version: 1,
    baseline_full_source_fingerprint: "8".repeat(64),
    baseline_product_count: 226,
    baseline_variant_count: 848,
    mapped_scope_row_count: 506,
    mapped_scope_fingerprint: "7".repeat(64),
    allowed_unmapped_collisions: [],
    allowed_unmapped_collisions_hash: fingerprint([]),
    unmapped_drift_policy:
      "ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS",
  };
  const reviewed = {
    sha256: "3".repeat(64),
    manifest: {
      ...loaded.manifest,
      mapped_source_contract: mappedSourceContract,
    },
    reviewed_rows: loaded.reviewed_rows,
    reviewed_scope_hash: loaded.reviewed_scope_hash,
    scoped: false,
    mapped: true,
  };
  delete reviewed.manifest.scoped_source_contract;
  const rows = base.artifact.rows.map((row) => ({
    ...row,
    atomic_plan: {
      ...row.atomic_plan,
      expected_state: {
        retailer_product: { updated_at: "2026-07-26T08:00:00.000000Z" },
        offer: {
          ...row.atomic_plan.expected_state.offer,
          last_checked_at: "2026-07-26T08:00:00.000000Z",
        },
      },
    },
  }));
  const fullSourceFingerprint = "9".repeat(64);
  const core = {
    ...base.artifact,
    source_snapshot_fingerprint: fullSourceFingerprint,
    rows,
  };
  delete core.artifact_fingerprint;
  const artifact = { ...core, artifact_fingerprint: fingerprint(core) };
  const unmappedIdentityRows = [{
    external_product_id: "900",
    external_variant_id: "901",
    external_sku: "UNMAPPED-901",
    external_gtin: null,
    url: "https://jonssupplements.co.uk/products/unmapped?variant=901",
  }];
  const mappedSourceEvidence = {
    full_source_fingerprint: fullSourceFingerprint,
    observed_product_count: 300,
    observed_variant_count: 507,
    mapped_scope_fingerprint: mappedSourceContract.mapped_scope_fingerprint,
    mapped_scope_row_count: 506,
    unmapped_identity_rows: unmappedIdentityRows,
    unmapped_identity_rows_hash: fingerprint(unmappedIdentityRows),
    unmapped_identity_row_count: unmappedIdentityRows.length,
    unmapped_collisions: [],
    unmapped_collisions_hash: fingerprint([]),
    allowed_unmapped_collisions_hash:
      mappedSourceContract.allowed_unmapped_collisions_hash,
    unmapped_drift_policy: mappedSourceContract.unmapped_drift_policy,
    collision_checks: "PASS",
  };
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const contract = buildReviewedMixedChangeContract({
    reviewed,
    artifact,
    targetEnvironment: "PRODUCTION",
    expiresAt,
    mappedSourceEvidence,
  });
  return { artifact, contract, expiresAt, reviewed, mappedSourceEvidence };
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

test("scoped reviewed migration preserves v1, validates v2 and rejects collisions and reruns", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `reviewed-scoped-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start");
    wait(container);
    ok(sql(container, setupSql()), "setup");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]), "base migration");
    ok(sql(container, `
      alter table public.retailers add column website text;
      update public.retailers set website='https://jonssupplements.co.uk' where id=10;
      alter table public.retailer_products
        add column external_sku text,
        add column external_gtin text,
        add column external_url text;
      create or replace function public.retailer_catalogue_actual_database_target() returns jsonb
      language sql stable as $$
        select '{"target_environment":"STAGING"}'::jsonb
      $$;
      update public.retailer_offer_sync_reviewed_mixed_change_definitions
      set authorization_id='jons-15-15a1a71238af5fa6-staging',target_environment='STAGING';
    `), "staging fixture");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${SCOPED_MIGRATION}`]), "scoped migration");
    const definitions = ok(sql(container, `
      select string_agg(authorization_id||':'||contract_version,',' order by contract_version)
      from public.retailer_offer_sync_reviewed_mixed_change_definitions;
    `), "scoped definitions");
    assert.equal(
      definitions.stdout.trim(),
      "jons-15-15a1a71238af5fa6-staging:1,jons-15-2b14b0d7b09ab70f-staging:2",
    );
    const fixture = scopedReviewedFixture();
    const exact = ok(sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(fixture.artifact)},${literal(fixture.contract)},'${fixture.expiresAt}'::timestamptz);
    `), "scoped exact contract");
    assert.match(exact.stdout, /"contract_version": 2/);
    assert.match(exact.stdout, /"valid": true/);
    const stalePrecondition = structuredClone(fixture.contract);
    stalePrecondition.execution_preconditions[0].mapping_updated_at =
      "2026-07-26T07:59:59.000000Z";
    stalePrecondition.reviewed_change_scope_hash = fingerprint({
      reviewed_rows: stalePrecondition.reviewed_rows,
      execution_preconditions: stalePrecondition.execution_preconditions,
      expected_deltas: stalePrecondition.expected_deltas,
    });
    delete stalePrecondition.reviewed_contract_hash;
    stalePrecondition.reviewed_contract_hash = fingerprint(stalePrecondition);
    const preconditionBlocked = sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(fixture.artifact)},${literal(stalePrecondition)},'${fixture.expiresAt}'::timestamptz);
    `);
    assert.notEqual(preconditionBlocked.status, 0);
    assert.match(output(preconditionBlocked), /RSBI_EXPECTED_STATE_MISMATCH/);
    ok(sql(container, `
      insert into public.retailer_products(
        id,retailer_id,product_id,product_variant_id,external_product_id,
        external_variant_id,external_sku,external_gtin,external_url)
      values(9999,10,1,1,'900','901','SPT14001',null,'https://example.test/collision');
    `), "collision fixture");
    const collision = sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(fixture.artifact)},${literal(fixture.contract)},'${fixture.expiresAt}'::timestamptz);
    `);
    assert.notEqual(collision.status, 0);
    assert.match(output(collision), /RSBI_DUPLICATE_IDENTITY/);
    ok(sql(container, "delete from public.retailer_products where id=9999;"), "remove collision fixture");
    const approvalRequest = {
      schema_version: 1,
      child_plan_id: crypto.randomUUID(),
      parent_plan_fingerprint: "a".repeat(64),
      child_plan_fingerprint: fixture.artifact.artifact_fingerprint,
      artifact: fixture.artifact,
      execution_fingerprint: "b".repeat(64),
      expected_migration_versions: [
        "20260726100000_add_reviewed_mixed_change_approval",
        "20260726120000_add_scoped_reviewed_mixed_change_fingerprints",
      ],
      expected_migration_fingerprint: "c".repeat(64),
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      approved_by: "scoped-integration-test",
      expires_at: fixture.expiresAt,
      staging_project_ref: "hxnrsyyqffztlvcrtgbf",
      staging_database_identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
      reviewed_mixed_change_contract: fixture.contract,
    };
    const approved = JSON.parse(ok(sql(container, `
      select public.retailer_offer_sync_approve_batch_internal(${literal(approvalRequest)})::text;
    `), "scoped approve").stdout.trim());
    const executionRequest = {
      schema_version: 1,
      approval_id: approved.approval_id,
      execution_fingerprint: approvalRequest.execution_fingerprint,
      expected_migration_versions: approvalRequest.expected_migration_versions,
      expected_migration_fingerprint: approvalRequest.expected_migration_fingerprint,
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      staging_project_ref: approvalRequest.staging_project_ref,
      staging_database_identity: approvalRequest.staging_database_identity,
      requested_at: new Date().toISOString(),
      explicit_allow: true,
    };
    assert.match(
      ok(sql(container, `
        select public.retailer_offer_sync_execute_batch_internal(${literal(executionRequest)});
      `), "scoped execute").stdout,
      /APPLIED/,
    );
    const replay = sql(container, `
      select public.retailer_offer_sync_execute_batch_internal(${literal(executionRequest)});
    `);
    assert.notEqual(replay.status, 0);
    assert.match(output(replay), /RSBI_REPLAY_BLOCKED/);
    const beforeRerun = ok(sql(container, `
      select count(*)||':'||(select count(*) from pg_proc where proname like '%reviewed_mixed_change%')
      from public.retailer_offer_sync_reviewed_mixed_change_definitions;
    `), "scoped pre-rerun");
    const rerun = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${SCOPED_MIGRATION}`]);
    assert.notEqual(rerun.status, 0);
    assert.match(output(rerun), /already installed; rerun rejected/);
    const afterRerun = ok(sql(container, `
      select count(*)||':'||(select count(*) from pg_proc where proname like '%reviewed_mixed_change%')
      from public.retailer_offer_sync_reviewed_mixed_change_definitions;
    `), "scoped post-rerun");
    assert.equal(afterRerun.stdout.trim(), beforeRerun.stdout.trim());
    const rollbackBlocked = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${SCOPED_ROLLBACK}`]);
    assert.notEqual(rollbackBlocked.status, 0);
    assert.match(output(rollbackBlocked), /rollback is forbidden after any scoped reviewed approval binding/);
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});

test("mapped-scope migration preserves v1/v2, permits unrelated unmapped drift and rejects new collisions", { skip: !dockerAvailable() && "Docker unavailable" }, () => {
  const container = `reviewed-mapped-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start");
    wait(container);
    ok(sql(container, setupSql()), "setup");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MIGRATION}`]), "base migration");
    ok(sql(container, `
      alter table public.retailers add column website text;
      update public.retailers set website='https://jonssupplements.co.uk' where id=10;
      alter table public.retailer_products
        add column external_sku text,
        add column external_gtin text,
        add column external_url text;
    `), "mapped prerequisite fixture");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${SCOPED_MIGRATION}`]), "scoped prerequisite migration");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MAPPED_SCOPE_MIGRATION}`]), "mapped-scope migration");
    ok(sql(container, `
      create or replace function public.retailer_catalogue_actual_database_target()
      returns jsonb language sql stable as $$
        select '{
          "target_environment":"PRODUCTION",
          "project_ref":"aftboxmrdgyhizicfsfu",
          "database_identity":"supplementscout-production:aftboxmrdgyhizicfsfu"
        }'::jsonb
      $$;
    `), "production target fixture");
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${JONS_16_DEFINITION_MIGRATION}`]), "Jon's 16 definition migration");
    const seeded = ok(sql(container, `
      select authorization_id||':'||contract_version||':'||row_count||':'||
             allowed_unmapped_collisions_hash
      from public.retailer_offer_sync_reviewed_mixed_change_definitions
      where authorization_id='jons-16-52d2f3f0bd5ec046-production';
    `), "Jon's 16 definition");
    assert.match(
      seeded.stdout,
      /jons-16-52d2f3f0bd5ec046-production:3:16:7d61f670d3cbbfd00dac93ec4a9edec8a66f9d6f51b37a81b752b66561fd29d6/,
    );
    const definitionRerun = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", "postgres", "-f",
      `/workspace/${JONS_16_DEFINITION_MIGRATION}`,
    ]);
    assert.notEqual(definitionRerun.status, 0);
    assert.match(output(definitionRerun), /already installed; rerun rejected/);

    const fixture = mappedReviewedFixture();
    ok(sql(container, `
      insert into public.retailer_offer_sync_reviewed_mixed_change_definitions(
        authorization_id,target_environment,retailer_id,reviewed_manifest_sha256,
        reviewed_source_fingerprint,reviewed_scope_hash,row_count,expected_deltas,
        authorized_by,contract_version,mapped_scope_fingerprint,
        allowed_unmapped_collisions,allowed_unmapped_collisions_hash,
        unmapped_drift_policy
      ) values(
        '${fixture.contract.authorization_id}','PRODUCTION',10,
        '${fixture.contract.reviewed_manifest_sha256}',
        '${fixture.contract.reviewed_source_fingerprint}',
        '${fixture.contract.reviewed_scope_hash}',15,
        ${literal(fixture.contract.expected_deltas)},
        'mapped-scope-integration-test',3,
        '${fixture.contract.mapped_scope_fingerprint}',
        '[]'::jsonb,'${fingerprint([])}',
        'ALLOW_UNMAPPED_ADD_REMOVE_WITHOUT_NEW_MAPPED_IDENTITY_COLLISIONS'
      );
    `), "mapped definition");
    const catalogueSql = fixture.artifact.rows.map((row, index) => {
      const productId = 5000 + index;
      const variantId = 6000 + index;
      return `
insert into public.products values(${productId},true,null);
insert into public.product_variants values(${variantId},${productId},true);
insert into public.retailer_products(
  id,retailer_id,product_id,product_variant_id,external_product_id,
  external_variant_id,external_sku,external_gtin,external_url
) values(
  ${row.retailer_product_id},10,${productId},${variantId},
  '${row.external_product_id}','${row.external_variant_id}',
  'MAPPED-${index}',null,'${row.atomic_plan.offer.values.url}'
);
insert into public.offers values(
  ${row.offer_id},10,${productId},${variantId},${row.retailer_product_id}
);`;
    }).join("\n");
    ok(sql(container, catalogueSql), "mapped catalogue fixture");

    const exact = ok(sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(fixture.artifact)},${literal(fixture.contract)},'${fixture.expiresAt}'::timestamptz);
    `), "mapped exact contract");
    assert.match(exact.stdout, /"contract_version": 3/);
    assert.match(exact.stdout, /"collision_checks": "PASS"/);

    const unrelatedArtifact = structuredClone(fixture.artifact);
    unrelatedArtifact.source_snapshot_fingerprint = "6".repeat(64);
    delete unrelatedArtifact.artifact_fingerprint;
    unrelatedArtifact.artifact_fingerprint = fingerprint(unrelatedArtifact);
    const unrelated = structuredClone(fixture.contract);
    unrelated.full_source_fingerprint = unrelatedArtifact.source_snapshot_fingerprint;
    unrelated.artifact_fingerprint = unrelatedArtifact.artifact_fingerprint;
    unrelated.observed_variant_count += 1;
    unrelated.unmapped_identity_rows.push({
      external_product_id: fixture.artifact.rows[0].external_product_id,
      external_variant_id: "903",
      external_sku: "UNMAPPED-903",
      external_gtin: null,
      url: "https://jonssupplements.co.uk/products/unmapped-2?variant=903",
    });
    unrelated.unmapped_identity_row_count += 1;
    unrelated.unmapped_identity_rows_hash = fingerprint(unrelated.unmapped_identity_rows);
    delete unrelated.reviewed_contract_hash;
    unrelated.reviewed_contract_hash = fingerprint(unrelated);
    const unrelatedResult = ok(sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(unrelatedArtifact)},${literal(unrelated)},'${fixture.expiresAt}'::timestamptz);
    `), "unrelated unmapped addition");
    assert.match(unrelatedResult.stdout, /"contract_version": 3/);

    const collision = structuredClone(unrelated);
    collision.unmapped_identity_rows[1].external_sku = "MAPPED-0";
    collision.unmapped_identity_rows_hash = fingerprint(collision.unmapped_identity_rows);
    collision.unmapped_collisions = [{
      unmapped_external_product_id: fixture.artifact.rows[0].external_product_id,
      unmapped_external_variant_id: "903",
      mapped_external_product_id: fixture.artifact.rows[0].external_product_id,
      mapped_external_variant_id: fixture.artifact.rows[0].external_variant_id,
      collision_fields: ["external_sku"],
    }];
    collision.unmapped_collisions_hash = fingerprint(collision.unmapped_collisions);
    delete collision.reviewed_contract_hash;
    collision.reviewed_contract_hash = fingerprint(collision);
    const collisionBlocked = sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(unrelatedArtifact)},${literal(collision)},'${fixture.expiresAt}'::timestamptz);
    `);
    assert.notEqual(collisionBlocked.status, 0);
    assert.match(output(collisionBlocked), /RSBI_DUPLICATE_IDENTITY/);

    const v1 = reviewedFixture();
    const v1Result = ok(sql(container, `
      select public.retailer_offer_sync_validate_reviewed_mixed_change_contract(
        ${literal(v1.artifact)},${literal(v1.contract)},'${v1.expiresAt}'::timestamptz);
    `), "v1 preserved after v3");
    assert.match(v1Result.stdout, /"valid": true/);

    const beforeRerun = ok(sql(container, `
      select count(*)||':'||(select count(*) from pg_proc
        where proname like '%reviewed_mixed_change%')
      from public.retailer_offer_sync_reviewed_mixed_change_definitions;
    `), "mapped pre-rerun");
    const rerun = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/${MAPPED_SCOPE_MIGRATION}`]);
    assert.notEqual(rerun.status, 0);
    assert.match(output(rerun), /already installed; rerun rejected/);
    const afterRerun = ok(sql(container, `
      select count(*)||':'||(select count(*) from pg_proc
        where proname like '%reviewed_mixed_change%')
      from public.retailer_offer_sync_reviewed_mixed_change_definitions;
    `), "mapped post-rerun");
    assert.equal(afterRerun.stdout.trim(), beforeRerun.stdout.trim());
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});
