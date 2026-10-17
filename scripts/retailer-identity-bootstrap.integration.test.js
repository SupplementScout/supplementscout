const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { buildRetailerIdentityBootstrapPlan, planFingerprint, sourceFingerprint } = require("./lib/retailer-identity-bootstrap");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "retailer-bootstrap-local-only";
const FILES = {
  baseline: "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
  setup: "supabase/test/product_variants_stage2_migration_test.sql",
  stage2: "supabase/migrations/20260713130000_product_variants_stage2.sql",
  atomic: "supabase/migrations/20260713180000_atomic_product_import_rpc.sql",
  approvals: "supabase/migrations/20260713190000_approved_import_plan_ledger.sql",
  bootstrap: "supabase/migrations/20261017120000_add_retailer_identity_bootstrap.sql",
  rollback: "supabase/manual/20261017120000_add_retailer_identity_bootstrap_rollback.sql",
};
const TARGET = {
  target_environment: "STAGING",
  project_ref: "abcdefghijklmnopqrst",
  database_identity: "supplementscout-staging:abcdefghijklmnopqrst",
};

function run(command, args, timeout = 180_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function succeed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function fails(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(output(result), pattern, label);
}
function dockerAvailable() { return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000).status === 0; }
function exec(container, args, timeout = 180_000) {
  return run("docker", ["exec", "-e", `PGPASSWORD=${PASSWORD}`, container, ...args], timeout);
}
function psql(container, database, sql, tuples = false) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1", ...(tuples ? ["-tA"] : []), "-U", "postgres", "-d", database, "-c", sql]);
}
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", `/workspace/${file}`);
  return exec(container, args);
}
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = run("docker", ["logs", container], 5_000);
    if (/PostgreSQL init process complete; ready for start up\./i.test(output(logs))) {
      const probe = exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000);
      if (probe.status === 0 && probe.stdout.trim() === "1") return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}
function plan(name, slug, website, authorizationId = crypto.randomUUID(), expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()) {
  return buildRetailerIdentityBootstrapPlan({
    name, slug, website, authorizationId, expiresAt, environment: TARGET,
    sourceArtifactSha256: crypto.createHash("sha256").update(`${name}:${slug}:${website}`).digest("hex"),
  });
}
function rpc(sqlName, values) {
  return `select public.${sqlName}(${values.join(",")})::text;`;
}
function asRole(role, statement) { return `begin; set local role ${role}; ${statement} commit;`; }

function prepareDatabase(container, database) {
  succeed(exec(container, ["createdb", "-U", "postgres", database]), `create ${database}`);
  succeed(psql(container, database, `do $roles$ begin
    if to_regrole('anon') is null then create role anon nologin; end if;
    if to_regrole('authenticated') is null then create role authenticated nologin; end if;
    if to_regrole('service_role') is null then create role service_role nologin; end if;
    if to_regrole('retailer_catalogue_staging_validator') is null then create role retailer_catalogue_staging_validator nologin; end if;
    if to_regrole('retailer_catalogue_staging_approver') is null then create role retailer_catalogue_staging_approver nologin; end if;
    if to_regrole('retailer_catalogue_staging_executor') is null then create role retailer_catalogue_staging_executor nologin; end if;
  end $roles$;`), "create isolated roles");
  succeed(psqlFile(container, database, FILES.baseline), "apply baseline");
  succeed(psqlFile(container, database, FILES.setup, [
    "stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1",
    `stage2_expected_database=${database}`, "stage2_scenario=success",
  ]), "seed stage2 fixture");
  succeed(psql(container, database, "select setval(pg_get_serial_sequence('public.retailers','id'),(select max(id) from public.retailers),true)"), "align retailer fixture sequence");
  succeed(psqlFile(container, database, FILES.stage2), "apply stage2");
  succeed(psqlFile(container, database, FILES.atomic), "apply atomic importer");
  succeed(psqlFile(container, database, FILES.approvals), "apply shared approval ledger");
  succeed(psql(container, database, `alter table public.approved_import_plans drop constraint approved_import_plans_plan_kind_check;
    alter table public.approved_import_plans add constraint approved_import_plans_plan_kind_check check (plan_kind in ('feed','manual','gtin_promotion'));
    insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json)
    select repeat('a',64),'legacy-'||kind,repeat('b',32),repeat('c',64),kind,case when kind='gtin_promotion' then null else 1 end,
      now()+interval '1 hour','baseline-compatibility',jsonb_build_object('legacy_kind',kind)
    from unnest(array['feed','manual','gtin_promotion']) kind;`), "seed current approval kinds");
  succeed(psql(container, database, `create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;
    create function public.retailer_catalogue_sha256_json(p_value jsonb) returns text language sql immutable strict
      as $$select encode(extensions.digest(public.atomic_import_canonical_json(p_value),'sha256'),'hex')$$;
    create function public.retailer_catalogue_actual_database_target() returns jsonb language sql stable security definer
      set search_path=pg_catalog,public,pg_temp as $$select '${JSON.stringify(TARGET)}'::jsonb$$;`), "install target attestations");
  succeed(psqlFile(container, database, FILES.bootstrap), "apply bootstrap migration");
}

test("retailer identity bootstrap enforces validation, approval, apply, replay and rollback contracts", { timeout: 600_000 }, (t) => {
  if (!dockerAvailable()) return t.skip("Docker unavailable");
  const container = `supplementscout-retailer-bootstrap-${crypto.randomBytes(5).toString("hex")}`;
  const database = "supplementscout_stage2_test_retailer_bootstrap";
  const cleanDatabase = "supplementscout_stage2_test_retailer_bootstrap_rollback";
  try {
    succeed(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", `POSTGRES_PASSWORD=${PASSWORD}`, "-v", `${ROOT}:/workspace:ro`, IMAGE]), "start PostgreSQL");
    wait(container);
    prepareDatabase(container, database);

    const acl = succeed(psql(container, database, `select jsonb_build_object(
      'validator',has_function_privilege('retailer_catalogue_staging_validator','public.validate_retailer_identity_bootstrap_plan(jsonb,text,uuid,timestamptz)','execute'),
      'validator_apply',has_function_privilege('retailer_catalogue_staging_validator','public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text)','execute'),
      'approver',has_function_privilege('retailer_catalogue_staging_approver','public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz)','execute'),
      'executor',has_function_privilege('retailer_catalogue_staging_executor','public.apply_approved_retailer_identity_bootstrap(uuid,text,text,text,uuid,text,text,text)','execute'),
      'service',has_function_privilege('service_role','public.approve_retailer_identity_bootstrap(jsonb,text,uuid,timestamptz)','execute'))::text;`, true), "read ACL").stdout.trim();
    assert.deepEqual(JSON.parse(acl), { validator: true, validator_apply: false, approver: true, executor: true, service: false });
    assert.equal(succeed(psql(container, database, "select string_agg(plan_kind,',' order by plan_kind) from public.approved_import_plans where source='baseline-compatibility'", true), "verify old approval kinds").stdout.trim(), "feed,gtin_promotion,manual");

    const happy = plan("Example Nutrition", "example-nutrition", "https://example.test");
    const args = [literal(JSON.stringify(happy)), literal(happy.meta.source_artifact_sha256), `${literal(happy.meta.authorization_id)}::uuid`, `${literal(happy.meta.expires_at)}::timestamptz`];
    succeed(psql(container, database, asRole("retailer_catalogue_staging_validator", rpc("validate_retailer_identity_bootstrap_plan", args))), "validate happy plan");
    const approvalText = succeed(psql(container, database, asRole("retailer_catalogue_staging_approver", rpc("approve_retailer_identity_bootstrap", args)), true), "approve happy plan").stdout.trim();
    const approval = JSON.parse(approvalText);
    const productExecutorArgs = [
      `${literal(approval.approval_id)}::uuid`, literal(happy.meta.source_artifact_sha256), literal(happy.meta.plan_fingerprint),
      literal(happy.meta.source_fingerprint), "null::bigint", literal("retailer_identity_bootstrap"), literal(happy.meta.authorization_id),
    ];
    fails(psql(container, database, rpc("apply_approved_product_import_plan", productExecutorArgs)), "product executor rejects bootstrap plan", /ledger integrity mismatch|invalid/i);
    const productApprovalId = succeed(psql(container, database, `insert into public.approved_import_plans(artifact_sha256,run_id,plan_fingerprint,source_row_fingerprint,plan_kind,retailer_id,expires_at,source,plan_json)
      values(repeat('d',64),'product-cross-type',repeat('e',32),repeat('f',64),'feed',1,now()+interval '15 minutes','cross-type','{"meta":{"plan_kind":"feed"}}'::jsonb) returning id;`, true), "seed product cross-type approval").stdout.trim();
    const bootstrapRejectsProductArgs = [`${literal(productApprovalId)}::uuid`, literal("d".repeat(64)), literal("e".repeat(32)), literal("f".repeat(64)), `${literal(happy.meta.authorization_id)}::uuid`, literal(TARGET.target_environment), literal(TARGET.project_ref), literal(TARGET.database_identity)];
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", bootstrapRejectsProductArgs))), "bootstrap executor rejects product plan", /already consumed or invalid/);
    const secondApproval = psql(container, database, asRole("retailer_catalogue_staging_approver", rpc("approve_retailer_identity_bootstrap", args)));
    fails(secondApproval, "reject concurrent active approval", /approved_import_plans_one_active_retailer_bootstrap_slug_idx|duplicate key/i);

    const applyArgs = [
      `${literal(approval.approval_id)}::uuid`, literal(happy.meta.source_artifact_sha256), literal(happy.meta.plan_fingerprint),
      literal(happy.meta.source_fingerprint), `${literal(happy.meta.authorization_id)}::uuid`, literal(TARGET.target_environment),
      literal(TARGET.project_ref), literal(TARGET.database_identity),
    ];
    const changedArtifact = [...applyArgs]; changedArtifact[1] = literal("b".repeat(64));
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", changedArtifact))), "reject changed artifact", /binding mismatch/);
    const changedFingerprint = [...applyArgs]; changedFingerprint[2] = literal("b".repeat(32));
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", changedFingerprint))), "reject changed fingerprint", /binding mismatch/);
    const receipt = JSON.parse(succeed(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", applyArgs)), true), "apply happy plan").stdout.trim());
    assert.deepEqual(receipt.expected_delta, { retailers: 1, products: 0, product_variants: 0, retailer_products: 0, offers: 0, price_history: 0 });
    assert.deepEqual(Object.fromEntries(Object.keys(receipt.expected_delta).map((key) => [key, Number(receipt.after_counts[key]) - Number(receipt.before_counts[key])])), receipt.expected_delta);
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", applyArgs))), "reject replay", /already consumed/);
    fails(psqlFile(container, database, FILES.rollback), "block rollback after consumed evidence", /approval evidence exists/);

    const duplicateSlug = plan("Different Slug Name", "example-nutrition", "https://different-slug.test");
    const duplicateName = plan("Example Nutrition", "different-name-slug", "https://different-name.test");
    const duplicateWebsite = plan("Different Website Name", "different-website-slug", "https://example.test");
    const wrongEnvironment = structuredClone(plan("Wrong Environment", "wrong-environment", "https://wrong-environment.test"));
    wrongEnvironment.environment.database_identity = "wrong";
    wrongEnvironment.meta.source_fingerprint = sourceFingerprint({ environment: wrongEnvironment.environment, retailer: wrongEnvironment.retailer });
    wrongEnvironment.meta.plan_fingerprint = planFingerprint(wrongEnvironment);
    for (const [label, candidate, pattern] of [["slug", duplicateSlug, /expected-absent mismatch/], ["name", duplicateName, /expected-absent mismatch/], ["website", duplicateWebsite, /expected-absent mismatch/], ["environment", wrongEnvironment, /environment mismatch/]]) {
      const values = [literal(JSON.stringify(candidate)), literal(candidate.meta.source_artifact_sha256), `${literal(candidate.meta.authorization_id)}::uuid`, `${literal(candidate.meta.expires_at)}::timestamptz`];
      fails(psql(container, database, asRole("retailer_catalogue_staging_validator", rpc("validate_retailer_identity_bootstrap_plan", values))), `reject ${label} collision`, pattern);
    }
    fails(psql(container, database, "insert into public.retailers(name,slug,website) values('Normalized collision','EXAMPLE-NUTRITION','https://normalized.test')"), "reject normalized slug collision", /retailers_normalized_slug_unique_idx|duplicate key/i);

    const expired = plan("Expired Shop", "expired-shop", "https://expired.test");
    const expiredArgs = [literal(JSON.stringify(expired)), literal(expired.meta.source_artifact_sha256), `${literal(expired.meta.authorization_id)}::uuid`, `${literal(expired.meta.expires_at)}::timestamptz`];
    const expiredApproval = JSON.parse(succeed(psql(container, database, asRole("retailer_catalogue_staging_approver", rpc("approve_retailer_identity_bootstrap", expiredArgs)), true), "approve expiry scenario").stdout.trim());
    succeed(psql(container, database, `update public.approved_import_plans set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where id=${literal(expiredApproval.approval_id)}::uuid`), "expire test approval");
    const expiredApply = [`${literal(expiredApproval.approval_id)}::uuid`, literal(expired.meta.source_artifact_sha256), literal(expired.meta.plan_fingerprint), literal(expired.meta.source_fingerprint), `${literal(expired.meta.authorization_id)}::uuid`, literal(TARGET.target_environment), literal(TARGET.project_ref), literal(TARGET.database_identity)];
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", expiredApply))), "reject expired approval", /expired/);

    const postflight = plan("Postflight Shop", "postflight-shop", "https://postflight.test");
    const postflightArgs = [literal(JSON.stringify(postflight)), literal(postflight.meta.source_artifact_sha256), `${literal(postflight.meta.authorization_id)}::uuid`, `${literal(postflight.meta.expires_at)}::timestamptz`];
    const postflightApproval = JSON.parse(succeed(psql(container, database, asRole("retailer_catalogue_staging_approver", rpc("approve_retailer_identity_bootstrap", postflightArgs)), true), "approve postflight scenario").stdout.trim());
    succeed(psql(container, database, `create function public.bootstrap_test_extra_row() returns trigger language plpgsql as $$begin if new.slug='postflight-shop' then insert into public.retailers(name,slug,website) values('Unexpected','unexpected-side-row','https://unexpected.test'); end if; return new; end$$; create trigger bootstrap_test_extra after insert on public.retailers for each row execute function public.bootstrap_test_extra_row();`), "install postflight fault");
    const postflightApply = [`${literal(postflightApproval.approval_id)}::uuid`, literal(postflight.meta.source_artifact_sha256), literal(postflight.meta.plan_fingerprint), literal(postflight.meta.source_fingerprint), `${literal(postflight.meta.authorization_id)}::uuid`, literal(TARGET.target_environment), literal(TARGET.project_ref), literal(TARGET.database_identity)];
    fails(psql(container, database, asRole("retailer_catalogue_staging_executor", rpc("apply_approved_retailer_identity_bootstrap", postflightApply))), "rollback postflight mismatch", /postflight delta mismatch/);
    const rollbackState = JSON.parse(succeed(psql(container, database, `select jsonb_build_object('retailers',(select count(*) from retailers where slug in ('postflight-shop','unexpected-side-row')),'approval',(select status from approved_import_plans where id=${literal(postflightApproval.approval_id)}::uuid))::text;`, true), "verify atomic rollback").stdout.trim());
    assert.deepEqual(rollbackState, { retailers: 0, approval: "approved" });

    prepareDatabase(container, cleanDatabase);
    succeed(psqlFile(container, cleanDatabase, FILES.rollback), "rollback before approval evidence");
  } finally {
    run("docker", ["stop", container], 60_000);
  }
});
