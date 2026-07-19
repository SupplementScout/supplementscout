const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { applyArtifactPlan, approveArtifactPlan, setSupabaseForTests, writeDryRunArtifact } = require("./import-products");
const { canonicalJson } = require("./lib/canonical-json");
const { buildVerifiedNoChangeDryRun } = require("./verified-no-change-offer-refresh");

const root = path.resolve(__dirname, "..");
const migrations = [
  "20260712211120_baseline_current_public_schema.sql",
  "20260713130000_product_variants_stage2.sql",
  "20260713180000_atomic_product_import_rpc.sql",
  "20260713190000_approved_import_plan_ledger.sql",
  "20260713200000_legacy_mapping_upgrade_rpc.sql",
  "20260716000000_support_standalone_legacy_mapping_upgrade.sql",
  "20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql",
  "20260715234500_align_approval_product_format_normalization.sql",
  "20260716003000_support_optioned_legacy_mapping_upgrade.sql",
  "20260716004000_support_optioned_parent_size_evidence.sql",
  "20260716005000_allow_optioned_legacy_identity_update_null_total.sql",
  "20260718150000_add_verified_no_change_offer_refresh.sql",
].map((name) => path.join(root, "supabase/migrations", name));
const stage2Setup = path.join(root, "supabase/test/product_variants_stage2_migration_test.sql");
const image = "postgres:17-alpine";

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
}
function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}
function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=verified-local-only", container, ...args], timeout);
}
function containerPath(file) { return `/workspace/${path.relative(root, file).replaceAll("\\", "/")}`; }
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", containerPath(file));
  return exec(container, args);
}
function sqlLiteral(value) { return `'${String(value ?? "").replaceAll("'", "''")}'`; }
function psqlJson(container, database, sql) {
  const result = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-tA", "-c", sql]);
  requireSuccess(result, "execute JSON query");
  return JSON.parse(result.stdout.trim());
}
function waitForPostgres(container) {
  let consecutive = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1"], 5_000);
    consecutive = result.status === 0 && result.stdout.trim() === "1" ? consecutive + 1 : 0;
    if (consecutive === 3) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}
function postgresRpcClient(container, database) {
  return {
    async rpc(name, args) {
      try {
        if (name === "approve_product_import_plan") {
          return { data: psqlJson(container, database, `select public.approve_product_import_plan(${sqlLiteral(JSON.stringify(args.p_plan))}::jsonb,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_run_id)},${sqlLiteral(args.p_source)})::text::jsonb;`), error: null };
        }
        if (name === "apply_approved_product_import_plan") {
          return { data: psqlJson(container, database, `select public.apply_approved_product_import_plan(${sqlLiteral(args.p_approval_id)}::uuid,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_plan_fingerprint)},${sqlLiteral(args.p_source_row_fingerprint)},${sqlLiteral(args.p_retailer_id)}::bigint,${sqlLiteral(args.p_plan_kind)},${sqlLiteral(args.p_run_id)})::text::jsonb;`), error: null };
        }
        return { data: null, error: new Error(`Unknown RPC ${name}`) };
      } catch (error) { return { data: null, error }; }
    },
  };
}
function refreshFingerprint(plan) {
  plan.meta.plan_fingerprint = null;
  plan.meta.plan_fingerprint = crypto.createHash("md5").update(canonicalJson(plan)).digest("hex");
  return plan;
}
function writeArtifact(directory, name, records) {
  const hashes = [...new Set(records.map((record) => record.source_snapshot_sha256))];
  const dryRun = buildVerifiedNoChangeDryRun(records, {
    targetEnvironment: "STAGING", targetProjectRef: "hxnrsyyqffztlvcrtgbf",
    sourceSnapshotSha256s: hashes, expectedCount: records.length,
  });
  return writeDryRunArtifact(dryRun.records, dryRun.result, {
    artifactPath: path.join(directory, `${name}.json`), sourceContent: JSON.stringify(records),
    sourceFileName: `${name}.json`, environmentMarker: "staging", runId: `verified-${name}`,
  });
}
function recordFromState(state, capture, hash) {
  return {
    source_snapshot_sha256: hash,
    source_captured_at: capture,
    source: {
      external_product_id: state.retailer_product.external_product_id,
      external_variant_id: state.retailer_product.external_variant_id,
      price: String(state.offer.price), in_stock: state.offer.in_stock, url: state.offer.url,
    },
    target: state,
  };
}

test("approval-bound verified no-change refresh is atomic and metadata-only on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, async () => {
  const container = `supplementscout-verified-${crypto.randomBytes(6).toString("hex")}`;
  const database = "supplementscout_stage2_test_verified_no_change";
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-verified-pg-"));
  let primaryError;
  try {
    requireSuccess(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=verified-local-only", "-v", `${root}:/workspace:ro`, image], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);
    requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create disposable database");
    requireSuccess(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", "do $roles$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $roles$;"]), "create local roles");
    requireSuccess(psqlFile(container, database, migrations[0]), "apply baseline");
    requireSuccess(psqlFile(container, database, stage2Setup, ["stage2_test_database_confirmed=1", "stage2_test_host=127.0.0.1", `stage2_expected_database=${database}`, "stage2_scenario=success"]), "seed Stage 2 fixture");
    for (const migration of migrations.slice(1)) requireSuccess(psqlFile(container, database, migration), `apply ${path.basename(migration)}`);

    const fixtureSql = `
      insert into public.retailers(id,name,slug,website) values(970001,'Verified Retailer','verified-retailer','https://verified.local');
      insert into public.products(id,name,slug,brand,category,product_format,is_active) values
        (970001,'Verified Creatine A','verified-creatine-a','Verified','Creatine','powder',true),
        (970002,'Verified Creatine B','verified-creatine-b','Verified','Creatine','powder',true);
      insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values
        (970001,970001,'500g','500g',500,'g',1,'powder',true,false),
        (970002,970002,'500g','500g',500,'g',1,'powder',true,false);
      insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_name,external_slug,external_url,match_method,match_confidence) values
        (970001,970001,970001,970001,'10001','20001','Verified Creatine A','verified-creatine-a','https://verified.local/a?variant=20001','external_id',100),
        (970002,970001,970002,970002,'10002','20002','Verified Creatine B','verified-creatine-b','https://verified.local/b?variant=20002','external_id',100);
      insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values
        (970001,970001,970001,970001,970001,19.99,3.99,23.98,true,'https://verified.local/a?variant=20001',now()-interval '2 days'),
        (970002,970002,970001,970002,970002,29.99,3.99,33.98,true,'https://verified.local/b?variant=20002',now()-interval '2 days');
      insert into public.verified_offer_refresh_targets(id,target_environment,project_ref,database_system_identifier,database_oid,is_active,attested_by)
      select true,'STAGING','hxnrsyyqffztlvcrtgbf',system_identifier::text,(select oid from pg_database where datname=current_database()),true,'integration-test'
      from pg_control_system();`;
    requireSuccess(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", fixtureSql]), "seed verification fixtures");
    setSupabaseForTests(postgresRpcClient(container, database));

    const stateFor = (id) => psqlJson(container, database, `select jsonb_build_object(
      'product',(select jsonb_build_object('id',id,'name',name,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=${id}),
      'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=970001),
      'product_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=${id}),
      'retailer_product',(select jsonb_build_object('id',id,'retailer_id',retailer_id,'product_id',product_id,'product_variant_id',product_variant_id,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_name',external_name,'external_slug',external_slug,'external_gtin',external_gtin,'external_url',external_url,'match_method',match_method,'match_confidence',match_confidence) from public.retailer_products where id=${id}),
      'offer',(select jsonb_build_object('id',id,'product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'retailer_product_id',retailer_product_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=${id})
    );`);
    const snapshot = () => psqlJson(container, database, `select jsonb_build_object(
      'a_without_checked',(select to_jsonb(o)-'last_checked_at' from public.offers o where id=970001),
      'mapping',(select to_jsonb(rp)-'created_at'-'updated_at' from public.retailer_products rp where id=970001),
      'history',(select count(*) from public.price_history where offer_id in (970001,970002)),
      'offer_count',(select count(*) from public.offers where id in (970001,970002)),
      'mapping_count',(select count(*) from public.retailer_products where id in (970001,970002)),
      'a_checked',(select to_char(last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.offers where id=970001),
      'b_checked',(select to_char(last_checked_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.offers where id=970002)
    );`);

    const initial = snapshot();
    const capture = new Date(Date.now() - 60_000).toISOString();
    const artifact = writeArtifact(directory, "single", [recordFromState(stateFor(970001), capture, "a".repeat(64))]);
    const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
    const approved = await approveArtifactPlan({ artifactPath: artifact.artifactPath, planFingerprint: fingerprint });
    const applied = await applyArtifactPlan({ artifactPath: artifact.artifactPath, planFingerprint: fingerprint, approvalId: approved.approvalId, pilotApply: true });
    assert.equal(applied.successful, 1);
    const after = snapshot();
    assert.deepEqual(after.a_without_checked, initial.a_without_checked);
    assert.deepEqual(after.mapping, initial.mapping);
    assert.equal(after.history, 0);
    assert.equal(after.offer_count, 2);
    assert.equal(after.mapping_count, 2);
    assert.equal(after.a_checked, capture);
    await assert.rejects(applyArtifactPlan({ artifactPath: artifact.artifactPath, planFingerprint: fingerprint, approvalId: approved.approvalId, pilotApply: true }), /already consumed/);

    const nextCapture = new Date(Date.now() - 30_000).toISOString();
    const expiredArtifact = writeArtifact(directory, "expired", [recordFromState(stateFor(970001), nextCapture, "b".repeat(64))]);
    const expiredFingerprint = expiredArtifact.artifact.plans[0].plan_fingerprint;
    const expired = await approveArtifactPlan({ artifactPath: expiredArtifact.artifactPath, planFingerprint: expiredFingerprint });
    requireSuccess(exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-c", `update public.approved_import_plans set created_at=now()-interval '2 seconds',expires_at=now()-interval '1 second' where id=${sqlLiteral(expired.approvalId)}::uuid;`]), "expire approval fixture");
    await assert.rejects(applyArtifactPlan({ artifactPath: expiredArtifact.artifactPath, planFingerprint: expiredFingerprint, approvalId: expired.approvalId, pilotApply: true }), /expired/);

    const wrongTarget = structuredClone(expiredArtifact.artifact.plans[0].resolved_plan);
    wrongTarget.meta.target_environment = "PRODUCTION";
    wrongTarget.meta.target_project_ref = "aftboxmrdgyhizicfsfu";
    refreshFingerprint(wrongTarget);
    const wrongTargetResult = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", `select public.validate_product_import_plan_read_only(${sqlLiteral(JSON.stringify(wrongTarget))}::jsonb);`]);
    assert.notEqual(wrongTargetResult.status, 0);
    assert.match(output(wrongTargetResult), /wrong target/);

    const mixedCapture = new Date(Date.now() - 10_000).toISOString();
    const mixedArtifact = writeArtifact(directory, "mixed", [
      recordFromState(stateFor(970001), mixedCapture, "c".repeat(64)),
      recordFromState(stateFor(970002), mixedCapture, "c".repeat(64)),
    ]);
    const approvals = [];
    for (const entry of mixedArtifact.artifact.plans) approvals.push(await approveArtifactPlan({ artifactPath: mixedArtifact.artifactPath, planFingerprint: entry.plan_fingerprint }));
    requireSuccess(exec(container, ["psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-c", "update public.offers set price=30.00 where id=970002;"]), "create price drift after approval");
    const beforeMixed = snapshot();
    const calls = mixedArtifact.artifact.plans.map((entry, index) => `select public.apply_approved_product_import_plan(${sqlLiteral(approvals[index].approvalId)}::uuid,${sqlLiteral(mixedArtifact.artifactSha256)},${sqlLiteral(entry.plan_fingerprint)},${sqlLiteral(entry.source_row_fingerprint)},970001,'feed',${sqlLiteral(mixedArtifact.artifact.run_id)});`).join(" ");
    const mixedResult = exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c", `begin; ${calls} commit;`]);
    assert.notEqual(mixedResult.status, 0);
    assert.match(output(mixedResult), /stale verified no-change plan|price, stock, URL/);
    const afterMixed = snapshot();
    assert.equal(afterMixed.a_checked, beforeMixed.a_checked, "mixed transaction did not roll back the first timestamp");
    const approvalStates = psqlJson(container, database, `select jsonb_agg(status order by id) from public.approved_import_plans where id in (${approvals.map((item) => `${sqlLiteral(item.approvalId)}::uuid`).join(",")});`);
    assert.deepEqual(approvalStates, ["approved", "approved"]);
  } catch (error) {
    primaryError = error;
  } finally {
    setSupabaseForTests(null);
    fs.rmSync(directory, { recursive: true, force: true });
    run("docker", ["rm", "--force", container], 30_000);
  }
  if (primaryError) throw primaryError;
});
