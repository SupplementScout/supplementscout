const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  applyArtifactPlan,
  approveArtifactPlan,
  buildAtomicImportPlan,
  setSupabaseForTests,
  writeDryRunArtifact,
} = require("./import-products");
const { canonicalJson } = require("./lib/canonical-json");

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const stage2 = path.join(root, "supabase/migrations/20260713130000_product_variants_stage2.sql");
const stage2Setup = path.join(root, "supabase/test/product_variants_stage2_migration_test.sql");
const atomicMigration = path.join(root, "supabase/migrations/20260713180000_atomic_product_import_rpc.sql");
const approvalMigration = path.join(root, "supabase/migrations/20260713190000_approved_import_plan_ledger.sql");
const legacyUpgradeMigration = path.join(root, "supabase/migrations/20260713200000_legacy_mapping_upgrade_rpc.sql");
const standaloneLegacyUpgradeMigration = path.join(root, "supabase/migrations/20260716000000_support_standalone_legacy_mapping_upgrade.sql");
const legacyNullTotalMigration = path.join(root, "supabase/migrations/20260716002000_allow_legacy_mapping_upgrade_null_total_noop.sql");
const formatNormalizationMigration = path.join(root, "supabase/migrations/20260715234500_align_approval_product_format_normalization.sql");
const optionedLegacyUpgradeMigration = path.join(root, "supabase/migrations/20260716003000_support_optioned_legacy_mapping_upgrade.sql");
const optionedParentSizeMigration = path.join(root, "supabase/migrations/20260716004000_support_optioned_parent_size_evidence.sql");
const integrationTest = path.join(root, "supabase/test/atomic_product_import_rpc_integration_test.sql");
const forbiddenRefs = ["aftboxmrdgyhizicfsfu", "dlsbwshkzdsvzubjftbv"];
const image = "postgres:17-alpine";

assert.equal(process.argv.length, 2, "integration runner accepts no connection arguments");

function run(command, args, timeout = 120_000) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout });
}

function output(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}

function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
}

function dockerAvailable() {
  const result = run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000);
  return result.status === 0 && result.stdout.trim().length > 0;
}

function exec(container, args, timeout = 120_000) {
  return run("docker", ["exec", "-e", "PGPASSWORD=atomic-local-only", container, ...args], timeout);
}

function containerPath(file) {
  return `/workspace/${path.relative(root, file).replaceAll("\\", "/")}`;
}

function psqlFile(container, database, file, variables = []) {
  assert.match(database, /^supplementscout_stage2_test_atomic_import_[a-z0-9_]+$/);
  assert.ok(forbiddenRefs.every((ref) => !database.includes(ref)));
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", containerPath(file));
  return exec(container, args);
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function psqlJson(container, database, sql) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  args.push("-U", "postgres", "-d", database, "-tA", "-c", sql);
  const result = exec(container, args);
  requireSuccess(result, "execute Node/PostgreSQL RPC bridge");
  return JSON.parse(result.stdout.trim());
}

function postgresRpcClient(container, database) {
  return {
    async rpc(name, args) {
      try {
        if (name === "approve_product_import_plan") {
          return { data: psqlJson(container, database,
            `select public.approve_product_import_plan(${sqlLiteral(JSON.stringify(args.p_plan))}::jsonb,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_run_id)},${sqlLiteral(args.p_source)})::text::jsonb;`
          ), error: null };
        }
        if (name === "apply_approved_product_import_plan") {
          return { data: psqlJson(container, database,
            `select public.apply_approved_product_import_plan(${sqlLiteral(args.p_approval_id)}::uuid,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_plan_fingerprint)},${sqlLiteral(args.p_source_row_fingerprint)},nullif(${sqlLiteral(args.p_retailer_id)},'')::bigint,${sqlLiteral(args.p_plan_kind)},${sqlLiteral(args.p_run_id)})::text::jsonb;`
          ), error: null };
        }
        return { data: null, error: new Error(`Unknown RPC ${name}`) };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}

function writeNodePlanArtifact(directory, name, row, item) {
  item.importPlan = buildAtomicImportPlan(item);
  const result = {
    skipped: 0,
    blockedRows: [],
    report: { approvedRows: [item], blockedRows: [] },
  };
  return writeDryRunArtifact([row], result, {
    artifactPath: path.join(directory, `${name}.json`),
    runId: `node-postgres-${name}`,
    sourceContent: JSON.stringify(row),
    sourceFileName: `${name}.json`,
    environmentMarker: "disposable-postgresql",
  });
}

function refreshPlanFingerprint(plan) {
  plan.meta.plan_fingerprint = null;
  plan.meta.plan_fingerprint = crypto.createHash("md5").update(canonicalJson(plan)).digest("hex");
  return plan;
}

function waitForPostgres(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = run("docker", ["logs", container], 5_000);
    if (/PostgreSQL init process complete; ready for start up\./i.test(output(logs))) {
      const result = exec(container, [
        "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", "postgres", "-tAc", "select 1",
      ], 5_000);
      if (result.status === 0 && result.stdout.trim() === "1") return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("disposable PostgreSQL did not become ready");
}

test("atomic import execution and approval ledger expose only guarded service-role RPCs", () => {
  const sql = require("node:fs").readFileSync(atomicMigration, "utf8");
  const approvalSql = require("node:fs").readFileSync(approvalMigration, "utf8");
  const legacySql = require("node:fs").readFileSync(legacyUpgradeMigration, "utf8");
  const legacyNullTotalSql = require("node:fs").readFileSync(legacyNullTotalMigration, "utf8");
  const formatSql = require("node:fs").readFileSync(formatNormalizationMigration, "utf8");
  const optionedLegacySql = require("node:fs").readFileSync(optionedLegacyUpgradeMigration, "utf8");
  const optionedParentSizeSql = require("node:fs").readFileSync(optionedParentSizeMigration, "utf8");
  assert.match(sql, /^begin;/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /alter function public\.apply_product_import_plan\(jsonb\) owner to postgres/i);
  assert.match(sql, /set search_path = pg_catalog, public, pg_temp/i);
  assert.match(sql, /atomic_import_has_exact_keys/i);
  assert.match(sql, /plan_fingerprint/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /stale product import plan/i);
  assert.doesNotMatch(sql, /import_test_failpoint/i);
  assert.doesNotMatch(sql, /grant execute[^;]+service_role/i);
  assert.doesNotMatch(sql, /grant execute[^;]+to\s+(anon|authenticated|public)\s*;/i);
  assert.match(approvalSql, /create table if not exists public\.approved_import_plans/i);
  assert.match(approvalSql, /enable row level security/i);
  assert.match(approvalSql, /force row level security/i);
  assert.match(approvalSql, /revoke all on function public\.apply_product_import_plan\(jsonb\) from service_role/i);
  assert.match(approvalSql, /grant execute on function public\.approve_product_import_plan[^;]+service_role/i);
  assert.match(approvalSql, /grant execute on function public\.apply_approved_product_import_plan[^;]+service_role/i);
  assert.match(approvalSql, /artifact_sha256/i);
  assert.match(approvalSql, /validate_product_import_plan_read_only/i);
  assert.doesNotMatch(approvalSql, /perform public\.apply_product_import_plan/i);
  assert.doesNotMatch(approvalSql, /grant option/i);
  assert.match(legacySql, /^begin;/i);
  assert.match(legacySql, /atomic_import_is_legacy_mapping_upgrade/i);
  assert.match(legacySql, /meta,operation_type.*legacy_mapping_upgrade/is);
  assert.match(legacySql, /exactly one retailer\/product mapping|count\(\*\).*retailer_products/is);
  assert.match(legacySql, /revoke all on function public\.atomic_import_is_legacy_mapping_upgrade/i);
  assert.doesNotMatch(legacySql, /grant execute[^;]+service_role/i);
  assert.doesNotMatch(legacySql, /\bexecute\s+format|import_test_failpoint/i);
  assert.match(legacyNullTotalSql, /^begin;/i);
  assert.match(legacyNullTotalSql, /legacy_mapping_upgrade/i);
  assert.match(legacyNullTotalSql, /expected_state,offer,total_price/i);
  assert.match(legacyNullTotalSql, /alter function public\.validate_product_import_plan_read_only\(jsonb\) owner to postgres/i);
  assert.doesNotMatch(legacyNullTotalSql, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(legacyNullTotalSql, /\bupdate\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(legacyNullTotalSql, /\bdelete\s+from\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.match(formatSql, /^begin;/i);
  assert.match(formatSql, /atomic_import_normalize_product_format/i);
  assert.match(formatSql, /ready_to_drink[\s\S]+liquid/i);
  assert.match(formatSql, /ready-to-drink[\s\S]+liquid/i);
  assert.match(formatSql, /ready to drink[\s\S]+liquid/i);
  assert.match(formatSql, /public\.atomic_import_normalize_product_format\(v_evidence->>'product_format'\)/i);
  assert.match(formatSql, /public\.atomic_import_normalize_product_format\(v_variant\.product_format\)/i);
  assert.match(formatSql, /format comparison target not found/i);
  assert.match(formatSql, /alter function public\.validate_product_import_plan_read_only\(jsonb\) owner to postgres/i);
  assert.match(formatSql, /alter function public\.apply_product_import_plan\(jsonb\) owner to postgres/i);
  assert.doesNotMatch(formatSql, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(formatSql, /\bupdate\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(formatSql, /\bdelete\s+from\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.match(optionedLegacySql, /^begin;/i);
  assert.match(optionedLegacySql, /optioned case/i);
  assert.match(optionedLegacySql, /v_expected_variant_id is distinct from v_variant_id/i);
  assert.match(optionedLegacySql, /product_variant_id = nullif\(p_plan#>>'\{retailer_product,values,product_variant_id\}'/i);
  assert.match(optionedLegacySql, /mapping variant guard target not found/i);
  assert.match(optionedLegacySql, /offer variant guard target not found/i);
  assert.match(optionedLegacySql, /v_offer_action = 'identity_update'/i);
  assert.match(optionedLegacySql, /v_offer_action in \('update','noop','identity_update'\)/i);
  assert.match(optionedLegacySql, /update public\.offers set\s+product_variant_id = v_variant_id/i);
  assert.match(optionedLegacySql, /alter function public\.atomic_import_is_legacy_mapping_upgrade\(jsonb\) owner to postgres/i);
  assert.match(optionedLegacySql, /alter function public\.apply_product_import_plan\(jsonb\) owner to postgres/i);
  assert.doesNotMatch(optionedLegacySql, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(optionedLegacySql, /\bupdate\s+public\.(products|product_variants|price_history|approved_import_plans)/i);
  assert.doesNotMatch(optionedLegacySql, /\bdelete\s+from\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.match(optionedParentSizeSql, /^begin;/i);
  assert.match(optionedParentSizeSql, /flavour_only_parent_size/i);
  assert.match(optionedParentSizeSql, /legacy_parent_size_all_variants_same/i);
  assert.match(optionedParentSizeSql, /atomic_import_is_legacy_mapping_upgrade\(jsonb\)/i);
  assert.doesNotMatch(optionedParentSizeSql, /insert\s+into\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(optionedParentSizeSql, /\bupdate\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
  assert.doesNotMatch(optionedParentSizeSql, /\bdelete\s+from\s+public\.(products|product_variants|retailer_products|offers|price_history|approved_import_plans)/i);
});

test("real atomic import RPC scenarios on disposable PostgreSQL", { skip: !dockerAvailable() && "Docker daemon unavailable" }, async () => {
  const container = `supplementscout-atomic-${crypto.randomBytes(6).toString("hex")}`;
  const database = "supplementscout_stage2_test_atomic_import_main";
  const mount = `${root}:/workspace:ro`;
  let primaryError = null;
  const cleanupErrors = [];

  try {
    requireSuccess(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_PASSWORD=atomic-local-only", "-v", mount, image,
    ], 180_000), "start disposable PostgreSQL");
    waitForPostgres(container);
    requireSuccess(exec(container, ["createdb", "-U", "postgres", database]), "create disposable database");
    requireSuccess(exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
      "-c", `do $roles$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
      end $roles$;`,
    ]), "create local Supabase roles");
    requireSuccess(psqlFile(container, database, baseline), "apply baseline");
    requireSuccess(psqlFile(container, database, stage2Setup, [
      "stage2_test_database_confirmed=1",
      "stage2_test_host=127.0.0.1",
      `stage2_expected_database=${database}`,
      "stage2_scenario=success",
    ]), "seed Stage 2 fixture");
  } catch (error) {
    primaryError = error;
  }

  try {
    if (primaryError) throw primaryError;
    requireSuccess(psqlFile(container, database, stage2), "apply Stage 2");
    requireSuccess(psqlFile(container, database, atomicMigration), "apply atomic import migration");
    requireSuccess(psqlFile(container, database, approvalMigration), "apply approved import plan ledger migration");
    requireSuccess(psqlFile(container, database, legacyUpgradeMigration), "apply legacy mapping upgrade migration");
    requireSuccess(psqlFile(container, database, standaloneLegacyUpgradeMigration), "apply standalone legacy mapping upgrade migration");
    requireSuccess(psqlFile(container, database, legacyNullTotalMigration), "apply legacy mapping null total migration");
    requireSuccess(psqlFile(container, database, formatNormalizationMigration), "apply approval format normalization migration");
    requireSuccess(psqlFile(container, database, optionedLegacyUpgradeMigration), "apply optioned legacy mapping upgrade migration");
    requireSuccess(psqlFile(container, database, optionedParentSizeMigration), "apply optioned parent-size evidence migration");
    requireSuccess(psqlFile(container, database, atomicMigration), "reapply atomic import migration idempotently");
    requireSuccess(psqlFile(container, database, approvalMigration), "reapply approval ledger migration idempotently");
    requireSuccess(psqlFile(container, database, legacyUpgradeMigration), "reapply legacy mapping upgrade migration idempotently");
    requireSuccess(psqlFile(container, database, standaloneLegacyUpgradeMigration), "reapply standalone legacy mapping upgrade migration idempotently");
    requireSuccess(psqlFile(container, database, legacyNullTotalMigration), "reapply legacy mapping null total migration idempotently");
    requireSuccess(psqlFile(container, database, formatNormalizationMigration), "reapply approval format normalization migration idempotently");
    requireSuccess(psqlFile(container, database, optionedLegacyUpgradeMigration), "reapply optioned legacy mapping upgrade migration idempotently");
    requireSuccess(psqlFile(container, database, optionedParentSizeMigration), "reapply optioned parent-size evidence migration idempotently");
    requireSuccess(psqlFile(container, database, integrationTest, [
      "atomic_import_test_database_confirmed=1",
      "atomic_import_test_host=127.0.0.1",
      `atomic_import_expected_database=${database}`,
    ]), "run 60 atomic import and approval-ledger SQL scenarios");

    const formatContracts = [
      ["ready_to_drink", "liquid", "true"],
      ["ready-to-drink", "liquid", "true"],
      ["ready to drink", "liquid", "true"],
      ["liquid", "liquid", "true"],
      ["powder", "powder", "true"],
      ["capsule", "capsules", "true"],
      ["tablet", "tablets", "true"],
      ["gummy", "gummies", "true"],
      ["liquid", "powder", "false"],
      ["liquid", "capsules", "false"],
      ["ready_to_drink", "powder", "false"],
      ["bar", "liquid", "false"],
    ];
    for (const [left, right, expected] of formatContracts) {
      const result = exec(container, [
        "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-tAc",
        `select (public.atomic_import_normalize_product_format(${sqlLiteral(left)}) = public.atomic_import_normalize_product_format(${sqlLiteral(right)}))::text`,
      ]);
      requireSuccess(result, `format normalization contract ${left} vs ${right}`);
      assert.equal(result.stdout.trim(), expected, `${left} vs ${right}`);
    }

    const fixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "insert into public.products(id,name,slug,brand,category,product_format,is_active) values(920001,'Micro Dose Product','micro-dose-product','Integration Brand','Health Supplements','capsule',true); insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(920001,920001,'micro-0-1mcg','0.1 mcg',0.0000001,'g',1,'capsule',true,false); insert into public.products(id,name,slug,brand,category,product_format,is_active) values(930001,'RTD Product','rtd-product','Integration Brand','Health Supplements','liquid',true); insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(930001,930001,'chocolate-330ml','Chocolate / 330ml','chocolate','Chocolate',330,'ml',1,'ready_to_drink',true,false),(930002,930001,'chocolate-330ml-liquid','Chocolate / 330ml Liquid','chocolate','Chocolate',330,'ml',1,'liquid',true,false),(930003,930001,'chocolate-330ml-powder','Chocolate / 330ml Powder','chocolate','Chocolate',330,'ml',1,'powder',true,false),(930004,930001,'chocolate-330ml-capsules','Chocolate / 330ml Capsules','chocolate','Chocolate',330,'ml',1,'capsules',true,false),(930005,930001,'chocolate-330ml-bar','Chocolate / 330ml Bar','chocolate','Chocolate',330,'ml',1,'bar',true,false); update public.offers set total_price=999 where retailer_product_id=(select id from public.retailer_products where external_variant_id='manual-default');",
    ]);
    requireSuccess(fixtureInsert, "create Node decimal integration fixture");
    const legacyFixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "update public.retailers set name='Discount Supplements',slug='discount-supplements',website='https://www.discount-supplements.co.uk' where id=4; insert into public.products(id,name,slug,brand,category,product_format,is_active) values(407,'CNP Creatine Monohydrate 250g','cnp-creatine-monohydrate-250g','CNP','Creatine',null,true); insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(386,407,'default','Default',null,null,null,null,true,true); insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_gtin,external_url,external_product_id,external_variant_id,external_sku,external_options,match_method,match_confidence,updated_at) values(948,4,407,386,'CNP Creatine Monohydrate 250g','cnp-creatine-monohydrate-250g',null,'https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234',null,null,null,null,'slug',90,'2026-07-12T12:37:52.563+00:00'); insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(762,407,4,948,386,12.99,4.99,17.98,true,'https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234','2026-07-12T12:37:52.674+00:00');",
    ]);
    requireSuccess(legacyFixtureInsert, "create exact legacy mapping 948 fixture");
    const standaloneLegacyFixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "update public.retailers set name='Whey Okay',slug='whey-okay',website='https://wheyokay.com' where id=3; insert into public.products(id,name,slug,brand,category,product_format,is_active) values(940001,'BioTech USA Magnesium Chelate 60 Caps','biotech-usa-magnesium-chelate-60-caps','BioTech USA','Vitamins & Minerals','capsule',true); insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(940001,940001,'default','Default',null,null,null,null,true,true); insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_gtin,external_url,external_product_id,external_variant_id,external_sku,external_options,match_method,match_confidence,updated_at) values(940001,3,940001,940001,'BioTech USA Magnesium Chelate 60 Caps','biotech-usa-magnesium-chelate-60-caps',null,'https://wheyokay.com/biotech-usa-magnesium-chelate-60-caps-668-p.asp',null,null,null,null,'slug',90,'2026-07-15T10:00:00.000+00:00'); insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(940001,940001,3,940001,940001,9.99,3.99,null,true,'https://wheyokay.com/biotech-usa-magnesium-chelate-60-caps-668-p.asp','2026-07-15T10:00:01.000+00:00');",
    ]);
    requireSuccess(standaloneLegacyFixtureInsert, "create standalone Whey Okay legacy mapping fixture");
    const optionedLegacyFixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "insert into public.products(id,name,slug,brand,category,product_format,is_active) values(950001,'Time 4 Mass 6000g','time-4-mass-6000g','Time 4 Nutrition','Mass Gainer','powder',true); insert into public.product_variants(id,product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default) values(950001,950001,'default','Default',null,null,null,null,null,null,true,true),(950002,950001,'banana-6000g','Banana / 6000g','banana','Banana',6000,'g',1,'powder',true,false),(950003,950001,'chocolate-6000g','Chocolate / 6000g','chocolate','Chocolate',6000,'g',1,'powder',true,false); insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_gtin,external_url,external_product_id,external_variant_id,external_sku,external_options,match_method,match_confidence,updated_at) values(950001,3,950001,950001,'Time 4 Mass 6000g','time-4-mass-6000g',null,'https://wheyokay.com/time-4-mass-6000g-banana-686-p.asp?variant=687',null,null,null,null,'slug',90,'2026-07-15T11:00:00.000+00:00'); insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(950001,950001,3,950001,950001,39.99,4.99,44.98,true,'https://wheyokay.com/time-4-mass-6000g-banana-686-p.asp?variant=687','2026-07-15T11:00:01.000+00:00');",
    ]);
    requireSuccess(optionedLegacyFixtureInsert, "create optioned Whey Okay legacy mapping fixture");
    const state = psqlJson(container, database, `select jsonb_build_object(
      'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=1),
      'mass_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=900001),
      'mass_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=900002),
      'micro_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=920001),
      'micro_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=920001),
      'rtd_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=930001),
      'rtd_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=930001),
      'rtd_variants',(select jsonb_agg(jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) order by id) from public.product_variants where product_id=930001),
      'manual_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=2010),
      'manual_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=2010)
      ,'drift_mapping',(select to_jsonb(rp)-'created_at' from public.retailer_products rp where external_variant_id='manual-default')
      ,'drift_offer',(select jsonb_build_object('id',o.id,'product_id',o.product_id,'retailer_id',o.retailer_id,'product_variant_id',o.product_variant_id,'retailer_product_id',o.retailer_product_id,'price',o.price,'shipping_cost',o.shipping_cost,'total_price',o.total_price,'in_stock',o.in_stock,'url',o.url,'last_checked_at',o.last_checked_at) from public.offers o join public.retailer_products rp on rp.id=o.retailer_product_id where rp.external_variant_id='manual-default')
    );`);
    const artifactDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-node-pg-"));
    try {
      setSupabaseForTests(postgresRpcClient(container, database));
      const cases = [
        {
          name: "discount-1kg",
          mode: "feed",
          product: state.mass_product,
          variant: state.mass_variant,
          row: {
            retailer_name: state.retailer.name, retailer_website: state.retailer.website,
            product_name: state.mass_product.name, slug: "node-discount-1kg",
            brand: state.mass_product.brand, category: state.mass_product.category,
            external_product_id: "node-discount-product", external_variant_id: "node-discount-1kg",
            external_sku: "node-discount-sku", external_options: '{"Size":"1kg","Flavour":"Vanilla"}',
            flavour: "Vanilla", size: "1kg", product_format: "powder",
            price: "29.99", shipping_cost: "1.25",
            in_stock: "true", external_url: "https://local.test/node-discount-1kg",
            affiliate_url: "https://affiliate.local/node-discount-1kg",
          },
        },
        {
          name: "rtd-liquid-evidence",
          mode: "feed",
          product: state.rtd_product,
          variant: state.rtd_variant,
          row: {
            retailer_name: state.retailer.name, retailer_website: state.retailer.website,
            product_name: state.rtd_product.name, slug: "node-rtd-product",
            brand: state.rtd_product.brand, category: state.rtd_product.category,
            external_product_id: "node-rtd-product", external_variant_id: "node-rtd-chocolate-330ml",
            external_sku: "node-rtd-sku", external_options: '{"Flavor":"Chocolate"}',
            flavour: "Chocolate", size: "330ml", product_format: "liquid",
            price: "2.50", shipping_cost: "3.99",
            in_stock: "true", external_url: "https://local.test/node-rtd-chocolate-330ml",
            affiliate_url: "https://affiliate.local/node-rtd-chocolate-330ml",
          },
        },
        {
          name: "micro-0-1mcg",
          mode: "feed",
          product: state.micro_product,
          variant: state.micro_variant,
          row: {
            retailer_name: state.retailer.name, retailer_website: state.retailer.website,
            product_name: state.micro_product.name, slug: "node-micro-dose",
            brand: state.micro_product.brand, category: state.micro_product.category,
            external_product_id: "node-micro-product", external_variant_id: "node-micro-0-1mcg",
            external_sku: "node-micro-sku", external_options: '{"Size":"0.1 mcg"}',
            size: "0.1 mcg", product_format: "capsule",
            price: "0.000001", shipping_cost: "0.0000001",
            in_stock: "true", external_url: "https://local.test/node-micro-dose",
            affiliate_url: "https://affiliate.local/node-micro-dose",
          },
        },
        {
          name: "manual-existing",
          mode: "manual",
          product: state.manual_product,
          variant: state.manual_variant,
          row: {
            retailer_name: state.retailer.name, retailer_website: state.retailer.website,
            product_name: state.manual_product.name, slug: "node-manual-existing",
            brand: state.manual_product.brand, category: state.manual_product.category,
            external_product_id: "node-manual-product", external_variant_id: "node-manual-existing",
            external_sku: "node-manual-sku", external_options: null,
            price: "19.95", shipping_cost: "2.05", in_stock: "true",
            external_url: "https://local.test/node-manual-existing",
            affiliate_url: "https://affiliate.local/node-manual-existing",
          },
        },
        {
          name: "total-price-only-drift",
          mode: "manual",
          product: state.manual_product,
          variant: state.manual_variant,
          mapping: state.drift_mapping,
          offer: state.drift_offer,
          offerPlan: { action: "update", createsPriceHistory: true },
          row: {
            retailer_name: state.retailer.name, retailer_website: state.retailer.website,
            product_name: state.drift_mapping.external_name, slug: state.drift_mapping.external_slug,
            brand: state.manual_product.brand, category: state.manual_product.category,
            external_product_id: state.drift_mapping.external_product_id,
            external_variant_id: state.drift_mapping.external_variant_id,
            external_sku: state.drift_mapping.external_sku,
            external_gtin: state.drift_mapping.external_gtin,
            external_options: state.drift_mapping.external_options,
            price: String(state.drift_offer.price), shipping_cost: String(state.drift_offer.shipping_cost),
            in_stock: String(state.drift_offer.in_stock), external_url: state.drift_mapping.external_url,
            affiliate_url: state.drift_offer.url,
          },
        },
      ];
      for (const scenario of cases) {
        const item = {
          row: scenario.row, rowNumber: 2, retailer: state.retailer,
          product: scenario.product, productVariant: scenario.variant,
          mapping: scenario.mapping || null, existingOffer: scenario.offer || null,
          offerPlan: scenario.offerPlan || { action: "create", createsPriceHistory: true }, mode: scenario.mode,
        };
        const artifact = writeNodePlanArtifact(artifactDirectory, scenario.name, scenario.row, item);
        assert.equal(artifact.artifact.plans[0].operation_type, "standard_import");
        assert.equal(
          artifact.artifact.plans[0].operation_type,
          artifact.artifact.plans[0].resolved_plan.meta.operation_type
        );
        const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
        if (scenario.name === "rtd-liquid-evidence") {
          const rtdPlan = artifact.artifact.plans[0].resolved_plan;
          const rtdVariantById = new Map(state.rtd_variants.map((variant) => [Number(variant.id), variant]));
          const validatorCases = [
            ["artifact ready_to_drink vs DB ready_to_drink", "ready_to_drink", 930001, true],
            ["artifact ready-to-drink vs DB ready_to_drink", "ready-to-drink", 930001, true],
            ["artifact ready to drink vs DB ready_to_drink", "ready to drink", 930001, true],
            ["artifact liquid vs DB ready_to_drink", "liquid", 930001, true],
            ["artifact ready_to_drink vs DB liquid", "ready_to_drink", 930002, true],
            ["artifact liquid vs DB powder", "liquid", 930003, false],
            ["artifact liquid vs DB capsules", "liquid", 930004, false],
            ["artifact ready_to_drink vs DB powder", "ready_to_drink", 930003, false],
            ["artifact bar vs DB ready_to_drink", "bar", 930001, false],
            ["artifact bar vs DB liquid", "bar", 930002, false],
            ["missing artifact format vs DB ready_to_drink", null, 930001, false],
          ];
          for (const [label, evidenceFormat, variantId, shouldPass] of validatorCases) {
            const plan = structuredClone(rtdPlan);
            const expectedVariant = rtdVariantById.get(variantId);
            assert.ok(expectedVariant, `missing RTD fixture variant ${variantId}`);
            plan.product_variant.id = String(variantId);
            plan.expected_state.product_variant = {
              ...expectedVariant,
              id: String(expectedVariant.id),
              product_id: String(expectedVariant.product_id),
              size_value: String(expectedVariant.size_value),
              pack_count: String(expectedVariant.pack_count),
            };
            plan.retailer_product.values.product_variant_id = String(variantId);
            if (evidenceFormat === null) {
              delete plan.product_variant.evidence.product_format;
            } else {
              plan.product_variant.evidence.product_format = evidenceFormat;
            }
            refreshPlanFingerprint(plan);
            const validated = exec(container, [
              "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
              "-c", `select public.validate_product_import_plan_read_only(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
            ]);
            if (shouldPass) {
              requireSuccess(validated, `RTD validator alias case: ${label}`);
            } else {
              assert.notEqual(validated.status, 0, `RTD validator accepted conflicting format: ${label}`);
            }
          }
        }
        const approved = await approveArtifactPlan({ artifactPath: artifact.artifactPath, planFingerprint: fingerprint });
        const applied = await applyArtifactPlan({
          artifactPath: artifact.artifactPath, planFingerprint: fingerprint,
          approvalId: approved.approvalId, pilotApply: true,
        });
        assert.equal(applied.successful, 1);
      }

      const legacyState = psqlJson(container, database, `select jsonb_build_object(
        'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=4),
        'product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=407),
        'variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=386),
        'mapping',(select jsonb_build_object('id',id,'retailer_id',retailer_id,'product_id',product_id,'product_variant_id',product_variant_id,'updated_at',updated_at,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_name',external_name,'external_slug',external_slug,'external_gtin',external_gtin,'external_url',external_url,'match_method',match_method,'match_confidence',match_confidence) from public.retailer_products where id=948),
        'offer',(select jsonb_build_object('id',id,'product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'retailer_product_id',retailer_product_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=762)
      );`);
      const legacyUrl = legacyState.mapping.external_url;
      const legacyRow = {
        retailer_name: "Discount Supplements", retailer_website: "https://www.discount-supplements.co.uk",
        product_name: "CNP Creatine Monohydrate 250g", slug: "cnp-creatine-monohydrate-250g",
        brand: "CNP", category: "Creatine", external_product_id: "6788065329348",
        external_variant_id: "54879874810234", external_sku: "CNP-0508",
        external_options: JSON.stringify({ Size: "250g", Flavour: "Unflavoured" }),
        external_gtin: "", variant_name: "250g / Unflavoured", size: "250 g",
        flavour: "Unflavoured", product_format: "powder", pack_count: "1",
        price: "12.99", shipping_cost: "4.99", in_stock: "true",
        external_url: legacyUrl, affiliate_url: legacyUrl,
        legacy_mapping_upgrade: "true", retailer_product_id: "948",
        expected_retailer_product_updated_at: legacyState.mapping.updated_at,
      };
      const legacyAfter = {
        external_product_id: "6788065329348", external_variant_id: "54879874810234",
        external_sku: "CNP-0508", external_options: { Size: "250g", Flavour: "Unflavoured" },
        external_gtin: null,
      };
      const legacyItem = {
        row: legacyRow, rowNumber: 2, retailer: legacyState.retailer,
        product: legacyState.product, productVariant: legacyState.variant,
        mapping: legacyState.mapping, existingOffer: legacyState.offer,
        offerPlan: { action: "unchanged", createsPriceHistory: false }, mode: "feed",
        legacyMappingUpgrade: {
          operationType: "legacy_mapping_upgrade",
          controls: { mappingId: "948", expectedUpdatedAt: legacyState.mapping.updated_at },
          after: legacyAfter, alreadyCompleted: false, exactUrl: legacyUrl,
          approvedEvidence: {
            product_name: legacyRow.product_name, brand: legacyRow.brand, size: "250 g",
            flavour: legacyRow.flavour, product_format: legacyRow.product_format,
            pack_count: legacyRow.pack_count, ...legacyAfter, external_url: legacyUrl,
          },
        },
      };
      const legacyArtifact = writeNodePlanArtifact(
        artifactDirectory, "legacy-mapping-948", legacyRow, legacyItem
      );
      const legacyFingerprint = legacyArtifact.artifact.plans[0].plan_fingerprint;
      const legacyPlan = legacyArtifact.artifact.plans[0].resolved_plan;
      assert.equal(legacyArtifact.artifact.plans[0].operation_type, "legacy_mapping_upgrade");
      assert.equal(legacyPlan.meta.operation_type, "legacy_mapping_upgrade");
      const helperCases = [
        ["missing operation type", (plan) => { delete plan.meta.operation_type; }, "f"],
        ["null operation type", (plan) => { plan.meta.operation_type = null; }, "f"],
        ["standard import", (plan) => { plan.meta.operation_type = "standard_import"; }, "f"],
        ["valid legacy mapping upgrade", () => {}, "t"],
        ["missing plan kind", (plan) => { delete plan.meta.plan_kind; }, "f"],
        ["null plan kind", (plan) => { plan.meta.plan_kind = null; }, "f"],
        ["disallowed plan kind", (plan) => { plan.meta.plan_kind = "manual"; }, "f"],
      ];
      for (const [label, mutate, expected] of helperCases) {
        const plan = structuredClone(legacyPlan);
        mutate(plan);
        const helperResult = exec(container, [
          "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
          "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
        ]);
        requireSuccess(helperResult, `legacy helper case: ${label}`);
        assert.equal(helperResult.stdout.trim(), expected, label);
      }
      const tamperedPlans = [
        ["missing operation type", (plan) => { delete plan.meta.operation_type; }],
        ["null operation type", (plan) => { plan.meta.operation_type = null; }],
        ["boolean operation type", (plan) => { plan.meta.operation_type = true; }],
        ["number operation type", (plan) => { plan.meta.operation_type = 1; }],
        ["unknown operation type", (plan) => { plan.meta.operation_type = "unknown_import"; }],
        ["legacy shape marked standard", (plan) => { plan.meta.operation_type = "standard_import"; }],
        ["legacy operation type on manual plan", (plan) => { plan.meta.plan_kind = "manual"; }],
        ["stale mapping timestamp", (plan) => { plan.expected_state.retailer_product.updated_at = "2026-07-12T12:37:51+00:00"; }],
        ["mapping URL", (plan) => { plan.retailer_product.values.external_url += "-changed"; }],
        ["mapping confidence", (plan) => { plan.retailer_product.values.match_confidence = "91"; }],
        ["mapping variant", (plan) => { plan.retailer_product.values.product_variant_id = "999"; }],
        ["offer price", (plan) => { plan.offer.values.price = "13.99"; plan.offer.values.total_price = "18.98"; }],
        ["offer stock", (plan) => { plan.offer.values.in_stock = false; }],
        ["offer action", (plan) => { plan.offer.action = "update"; }],
        ["price history", (plan) => { plan.price_history.action = "create"; }],
      ];
      for (const [label, mutate] of tamperedPlans) {
        const plan = structuredClone(legacyPlan);
        mutate(plan);
        refreshPlanFingerprint(plan);
        const rejected = exec(container, [
          "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
          "-c", `select public.validate_product_import_plan_read_only(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
        ]);
        assert.notEqual(rejected.status, 0, `legacy RPC accepted hidden change: ${label}`);
      }
      const legacyApproved = await approveArtifactPlan({
        artifactPath: legacyArtifact.artifactPath,
        planFingerprint: legacyFingerprint,
      });
      const legacyApplied = await applyArtifactPlan({
        artifactPath: legacyArtifact.artifactPath,
        planFingerprint: legacyFingerprint,
        approvalId: legacyApproved.approvalId,
        pilotApply: true,
      });
      assert.equal(legacyApplied.successful, 1);
      const legacyCheck = psqlJson(container, database, `select jsonb_build_object(
        'mapping',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_gtin',external_gtin,'external_url',external_url) from public.retailer_products where id=948),
        'offer',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'retailer_product_id',retailer_product_id,'product_variant_id',product_variant_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=762),
        'history_count',(select count(*) from public.price_history where offer_id=762),
        'mapping_count',(select count(*) from public.retailer_products where retailer_id=4 and product_id=407),
        'offer_count',(select count(*) from public.offers where retailer_id=4 and product_id=407)
      );`);
      assert.deepEqual(legacyCheck.mapping, {
        product_id: 407, retailer_id: 4, product_variant_id: 386,
        external_product_id: "6788065329348", external_variant_id: "54879874810234",
        external_sku: "CNP-0508", external_options: { Size: "250g", Flavour: "Unflavoured" },
        external_gtin: null, external_url: legacyUrl,
      });
      assert.deepEqual(legacyCheck.offer, {
        product_id: 407, retailer_id: 4, retailer_product_id: 948, product_variant_id: 386,
        price: 12.99, shipping_cost: 4.99, total_price: 17.98, in_stock: true,
        url: legacyUrl, last_checked_at: legacyState.offer.last_checked_at,
      });
      assert.equal(legacyCheck.history_count, 0);
      assert.equal(legacyCheck.mapping_count, 1);
      assert.equal(legacyCheck.offer_count, 1);

      const optionedState = psqlJson(container, database, `select jsonb_build_object(
        'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=3),
        'product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=950001),
        'target_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=950002),
        'mapping',(select jsonb_build_object('id',id,'retailer_id',retailer_id,'product_id',product_id,'product_variant_id',product_variant_id,'updated_at',updated_at,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_name',external_name,'external_slug',external_slug,'external_gtin',external_gtin,'external_url',external_url,'match_method',match_confidence) from public.retailer_products where id=950001),
        'offer',(select jsonb_build_object('id',id,'product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'retailer_product_id',retailer_product_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=950001)
      );`);
      optionedState.mapping.match_method = "slug";
      optionedState.mapping.match_confidence = 90;
      const optionedUrl = optionedState.mapping.external_url;
      const optionedRow = {
        retailer_name: "Whey Okay", retailer_website: "https://wheyokay.com",
        product_name: "Time 4 Mass 6000g", slug: "time-4-mass-6000g",
        brand: "Time 4 Nutrition", category: "Mass Gainer",
        product_id: "950001", product_variant_id: "950002",
        external_product_id: "686", external_variant_id: "687",
        external_sku: "T4M-BAN-6000",
        external_options: '{"Size":"6000g","Flavour":"Banana"}',
        external_gtin: "", variant_name: "Banana / 6000g",
        size: "6000g", size_unit: "g", flavour: "Banana",
        product_format: "powder", pack_count: "1", price: "39.99",
        shipping_cost: "4.99", in_stock: "true",
        external_url: optionedUrl, affiliate_url: optionedUrl,
        legacy_mapping_upgrade: "true", legacy_mapping_optioned: "true",
        legacy_duplicate_source_listing: "false",
        legacy_identity_drift: "false",
        retailer_product_id: "950001",
        expected_retailer_product_updated_at: optionedState.mapping.updated_at,
      };
      const optionedAfter = {
        external_product_id: "686", external_variant_id: "687",
        external_sku: "T4M-BAN-6000",
        external_options: { Size: "6000g", Flavour: "Banana" },
        external_gtin: null,
      };
      const optionedItem = {
        row: optionedRow, rowNumber: 2, retailer: optionedState.retailer,
        product: optionedState.product, productVariant: optionedState.target_variant,
        mapping: optionedState.mapping, existingOffer: optionedState.offer,
        offerPlan: { action: "unchanged", createsPriceHistory: false }, mode: "feed",
        legacyMappingUpgrade: {
          operationType: "legacy_mapping_upgrade",
          controls: {
            mappingId: "950001",
            expectedUpdatedAt: optionedState.mapping.updated_at,
            standalone: false,
            optioned: true,
          },
          after: optionedAfter, alreadyCompleted: false, exactUrl: optionedUrl,
          approvedEvidence: {
            product_name: optionedRow.product_name, brand: optionedRow.brand,
            size: optionedRow.size, flavour: optionedRow.flavour,
            product_format: optionedRow.product_format, pack_count: optionedRow.pack_count,
            ...optionedAfter, external_url: optionedUrl,
            legacy_mapping_optioned: true,
          },
        },
      };
      const optionedArtifact = writeNodePlanArtifact(
        artifactDirectory, "legacy-optioned-whey-okay-950001", optionedRow, optionedItem
      );
      const optionedPlan = optionedArtifact.artifact.plans[0].resolved_plan;
      const parentSizeOptionedRow = {
        ...optionedRow,
        external_options: '{"Flavour":"Banana"}',
        legacy_option_tuple_mode: "flavour_only_parent_size",
        legacy_parent_size_value: "6000",
        legacy_parent_size_unit: "g",
        legacy_parent_size_source: "parent_product_title",
        legacy_parent_size_all_variants_same: "true",
      };
      const parentSizeOptionedAfter = {
        ...optionedAfter,
        external_options: { Flavour: "Banana" },
      };
      const parentSizeOptionedItem = {
        ...optionedItem,
        row: parentSizeOptionedRow,
        legacyMappingUpgrade: {
          ...optionedItem.legacyMappingUpgrade,
          controls: {
            ...optionedItem.legacyMappingUpgrade.controls,
            optionTupleMode: "flavour_only_parent_size",
            parentSizeValue: "6000",
            parentSizeUnit: "g",
            parentSizeSource: "parent_product_title",
            parentSizeAllVariantsSame: true,
          },
          after: parentSizeOptionedAfter,
          approvedEvidence: {
            ...optionedItem.legacyMappingUpgrade.approvedEvidence,
            ...parentSizeOptionedAfter,
            legacy_option_tuple_mode: "flavour_only_parent_size",
            legacy_parent_size_value: "6000",
            legacy_parent_size_unit: "g",
            legacy_parent_size_source: "parent_product_title",
            legacy_parent_size_all_variants_same: true,
          },
        },
      };
      const parentSizeOptionedArtifact = writeNodePlanArtifact(
        artifactDirectory, "legacy-optioned-parent-size-whey-okay-950001", parentSizeOptionedRow, parentSizeOptionedItem
      );
      const parentSizeOptionedFingerprint = parentSizeOptionedArtifact.artifact.plans[0].plan_fingerprint;
      const parentSizeOptionedPlan = parentSizeOptionedArtifact.artifact.plans[0].resolved_plan;
      assert.equal(optionedPlan.meta.operation_type, "legacy_mapping_upgrade");
      assert.equal(optionedPlan.product_variant.id, "950002");
      assert.equal(optionedPlan.expected_state.retailer_product.product_variant_id, "950001");
      assert.equal(optionedPlan.retailer_product.values.product_variant_id, "950002");
      assert.equal(optionedPlan.offer.action, "identity_update");
      assert.equal(optionedPlan.expected_state.offer.product_variant_id, "950001");
      assert.equal(optionedPlan.offer.values.product_variant_id, "950002");
      assert.equal(optionedPlan.price_history.action, "noop");
      const optionedHelper = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(optionedPlan))}::jsonb);`,
      ]);
      requireSuccess(optionedHelper, "optioned legacy helper accepts exact default to non-default plan");
      assert.equal(optionedHelper.stdout.trim(), "t");
      const optionedTamperedPlans = [
        ["same product and variant IDs", (plan) => { plan.retailer_product.values.external_variant_id = "686"; }],
        ["missing size", (plan) => { delete plan.retailer_product.values.external_options.Size; delete plan.product_variant.evidence.external_options.Size; }],
        ["flavour mismatch", (plan) => { plan.product_variant.evidence.flavour = "chocolate"; }],
        ["size mismatch", (plan) => { plan.product_variant.evidence.size_value = "5000"; }],
        ["format mismatch", (plan) => { plan.product_variant.evidence.product_format = "capsules"; }],
        ["wrong target product", (plan) => { plan.product_variant.id = "950003"; plan.retailer_product.values.product_variant_id = "950003"; }],
        ["offer update", (plan) => { plan.offer.action = "update"; }],
        ["offer price drift", (plan) => { plan.offer.values.price = "40.99"; }],
        ["history create", (plan) => { plan.price_history.action = "create"; }],
      ];
      for (const [label, mutate] of optionedTamperedPlans) {
        const plan = structuredClone(optionedPlan);
        mutate(plan);
        refreshPlanFingerprint(plan);
        const rejected = exec(container, [
          "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
          "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
        ]);
        requireSuccess(rejected, `optioned helper rejection: ${label}`);
        assert.equal(rejected.stdout.trim(), "f", `optioned helper accepted ${label}`);
      }
      assert.equal(parentSizeOptionedPlan.meta.operation_type, "legacy_mapping_upgrade");
      assert.equal(parentSizeOptionedPlan.product_variant.id, "950002");
      assert.equal(parentSizeOptionedPlan.expected_state.retailer_product.product_variant_id, "950001");
      assert.equal(parentSizeOptionedPlan.retailer_product.values.product_variant_id, "950002");
      assert.deepEqual(parentSizeOptionedPlan.retailer_product.values.external_options, { Flavour: "Banana" });
      assert.deepEqual(parentSizeOptionedPlan.product_variant.evidence.external_options, { Flavour: "Banana" });
      assert.equal(parentSizeOptionedPlan.product_variant.evidence.legacy_option_tuple_mode, "flavour_only_parent_size");
      assert.equal(parentSizeOptionedPlan.product_variant.evidence.legacy_parent_size_value, "6000");
      assert.equal(parentSizeOptionedPlan.product_variant.evidence.legacy_parent_size_unit, "g");
      assert.equal(parentSizeOptionedPlan.product_variant.evidence.legacy_parent_size_source, "parent_product_title");
      assert.equal(parentSizeOptionedPlan.product_variant.evidence.legacy_parent_size_all_variants_same, true);
      assert.equal(parentSizeOptionedPlan.offer.action, "identity_update");
      assert.equal(parentSizeOptionedPlan.expected_state.offer.product_variant_id, "950001");
      assert.equal(parentSizeOptionedPlan.offer.values.product_variant_id, "950002");
      assert.equal(parentSizeOptionedPlan.price_history.action, "noop");
      const parentSizeOptionedHelper = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(parentSizeOptionedPlan))}::jsonb);`,
      ]);
      requireSuccess(parentSizeOptionedHelper, "optioned parent-size helper accepts flavour-only source option plan");
      assert.equal(parentSizeOptionedHelper.stdout.trim(), "t");
      const parentSizeTamperedPlans = [
        ["parent size mismatch", (plan) => { plan.product_variant.evidence.legacy_parent_size_value = "5000"; }],
        ["missing parent proof source", (plan) => { delete plan.product_variant.evidence.legacy_parent_size_source; }],
        ["mixed parent sizes", (plan) => { plan.product_variant.evidence.legacy_parent_size_all_variants_same = false; }],
        ["hidden source Size option", (plan) => { plan.retailer_product.values.external_options.Size = "6000g"; plan.product_variant.evidence.external_options.Size = "6000g"; }],
        ["missing flavour option", (plan) => { delete plan.retailer_product.values.external_options.Flavour; delete plan.product_variant.evidence.external_options.Flavour; }],
        ["flavour mismatch", (plan) => { plan.product_variant.evidence.flavour = "chocolate"; }],
        ["size mismatch", (plan) => { plan.product_variant.evidence.size_value = "5000"; }],
      ];
      for (const [label, mutate] of parentSizeTamperedPlans) {
        const plan = structuredClone(parentSizeOptionedPlan);
        mutate(plan);
        refreshPlanFingerprint(plan);
        const rejected = exec(container, [
          "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
          "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
        ]);
        requireSuccess(rejected, `optioned parent-size helper rejection: ${label}`);
        assert.equal(rejected.stdout.trim(), "f", `optioned parent-size helper accepted ${label}`);
      }
      const optionedApproved = await approveArtifactPlan({
        artifactPath: parentSizeOptionedArtifact.artifactPath,
        planFingerprint: parentSizeOptionedFingerprint,
      });
      const optionedApplied = await applyArtifactPlan({
        artifactPath: parentSizeOptionedArtifact.artifactPath,
        planFingerprint: parentSizeOptionedFingerprint,
        approvalId: optionedApproved.approvalId,
        pilotApply: true,
      });
      assert.equal(optionedApplied.successful, 1);
      await assert.rejects(
        () => applyArtifactPlan({
          artifactPath: parentSizeOptionedArtifact.artifactPath,
          planFingerprint: parentSizeOptionedFingerprint,
          approvalId: optionedApproved.approvalId,
          pilotApply: true,
        }),
        /approved import plan already consumed/i
      );
      const optionedCheck = psqlJson(container, database, `select jsonb_build_object(
        'mapping',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_gtin',external_gtin,'external_url',external_url) from public.retailer_products where id=950001),
        'offer',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'retailer_product_id',retailer_product_id,'product_variant_id',product_variant_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=950001),
        'history_count',(select count(*) from public.price_history where offer_id=950001),
        'mapping_count',(select count(*) from public.retailer_products where retailer_id=3 and product_id=950001),
        'offer_count',(select count(*) from public.offers where retailer_id=3 and product_id=950001)
      );`);
      assert.deepEqual(optionedCheck.mapping, {
        product_id: 950001, retailer_id: 3, product_variant_id: 950002,
        external_product_id: "686", external_variant_id: "687",
        external_sku: "T4M-BAN-6000",
        external_options: { Flavour: "Banana" },
        external_gtin: null, external_url: optionedUrl,
      });
      assert.deepEqual(optionedCheck.offer, {
        product_id: 950001, retailer_id: 3, retailer_product_id: 950001,
        product_variant_id: 950002, price: 39.99, shipping_cost: 4.99,
        total_price: 44.98, in_stock: true, url: optionedUrl,
        last_checked_at: optionedState.offer.last_checked_at,
      });
      assert.equal(optionedCheck.history_count, 0);
      assert.equal(optionedCheck.mapping_count, 1);
      assert.equal(optionedCheck.offer_count, 1);

      const standaloneState = psqlJson(container, database, `select jsonb_build_object(
        'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=3),
        'product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=940001),
        'variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=940001),
        'mapping',(select jsonb_build_object('id',id,'retailer_id',retailer_id,'product_id',product_id,'product_variant_id',product_variant_id,'updated_at',updated_at,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_name',external_name,'external_slug',external_slug,'external_gtin',external_gtin,'external_url',external_url,'match_method',match_confidence) from public.retailer_products where id=940001),
        'offer',(select jsonb_build_object('id',id,'product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'retailer_product_id',retailer_product_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=940001)
      );`);
      standaloneState.mapping.match_method = "slug";
      standaloneState.mapping.match_confidence = 90;
      const standaloneUrl = standaloneState.mapping.external_url;
      const standaloneRow = {
        retailer_name: "Whey Okay", retailer_website: "https://wheyokay.com",
        product_name: "BioTech USA Magnesium Chelate 60 Caps",
        slug: "biotech-usa-magnesium-chelate-60-caps",
        brand: "BioTech USA", category: "Vitamins & Minerals",
        external_product_id: "668", external_variant_id: "668",
        external_sku: "BIO-MAG-60", external_options: null,
        external_gtin: "", variant_name: "", size: "", flavour: "",
        product_format: "capsule", pack_count: "", price: "9.99",
        shipping_cost: "3.99", in_stock: "true",
        external_url: standaloneUrl, affiliate_url: standaloneUrl,
        legacy_mapping_upgrade: "true", legacy_mapping_standalone: "true",
        legacy_standalone_sellable_count: "1",
        legacy_standalone_has_options: "false",
        legacy_duplicate_source_listing: "false",
        legacy_identity_drift: "false",
        retailer_product_id: "940001",
        expected_retailer_product_updated_at: standaloneState.mapping.updated_at,
      };
      const standaloneAfter = {
        external_product_id: "668", external_variant_id: "668",
        external_sku: "BIO-MAG-60", external_options: null,
        external_gtin: null,
      };
      const standaloneItem = {
        row: standaloneRow, rowNumber: 2, retailer: standaloneState.retailer,
        product: standaloneState.product, productVariant: standaloneState.variant,
        mapping: standaloneState.mapping, existingOffer: standaloneState.offer,
        offerPlan: { action: "unchanged", createsPriceHistory: false }, mode: "feed",
        legacyMappingUpgrade: {
          operationType: "legacy_mapping_upgrade",
          controls: {
            mappingId: "940001",
            expectedUpdatedAt: standaloneState.mapping.updated_at,
            standalone: true,
          },
          after: standaloneAfter, alreadyCompleted: false, exactUrl: standaloneUrl,
          approvedEvidence: {
            product_name: standaloneRow.product_name, brand: standaloneRow.brand,
            size: "", flavour: "", product_format: standaloneRow.product_format,
            pack_count: "", ...standaloneAfter, external_url: standaloneUrl,
            legacy_mapping_standalone: true, legacy_standalone_sellable_count: "1",
          },
        },
      };
      const standaloneArtifact = writeNodePlanArtifact(
        artifactDirectory, "legacy-standalone-whey-okay-940001", standaloneRow, standaloneItem
      );
      const standaloneFingerprint = standaloneArtifact.artifact.plans[0].plan_fingerprint;
      const standalonePlan = standaloneArtifact.artifact.plans[0].resolved_plan;
      assert.equal(standalonePlan.meta.operation_type, "legacy_mapping_upgrade");
      assert.equal(standalonePlan.retailer_product.values.external_options, null);
      assert.equal(standalonePlan.offer.action, "noop");
      assert.equal(standalonePlan.offer.values.total_price, null);
      assert.equal(standalonePlan.price_history.action, "noop");
      assert.equal(standalonePlan.product_variant.evidence.external_options, null);
      assert.equal(standalonePlan.product_variant.evidence.flavour, null);
      assert.equal(standalonePlan.product_variant.evidence.size_value, null);
      const standaloneHelper = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(standalonePlan))}::jsonb);`,
      ]);
      requireSuccess(standaloneHelper, "standalone legacy helper accepts exact standalone plan");
      assert.equal(standaloneHelper.stdout.trim(), "t");
      const standaloneTamperedPlans = [
        ["two source variants / product and variant IDs differ", (plan) => {
          plan.retailer_product.values.external_variant_id = "669";
        }],
        ["flavour evidence", (plan) => {
          plan.product_variant.evidence.flavour = "vanilla";
        }],
        ["size evidence", (plan) => {
          plan.product_variant.evidence.size_value = "60";
          plan.product_variant.evidence.size_unit = "capsule";
        }],
        ["source options", (plan) => {
          plan.retailer_product.values.external_options = { Flavour: "Default" };
          plan.product_variant.evidence.external_options = { Flavour: "Default" };
        }],
        ["plan writes historical null total_price", (plan) => {
          plan.offer.values.total_price = "13.98";
        }],
        ["offer price", (plan) => {
          plan.offer.values.price = "10.99";
        }],
        ["offer stock", (plan) => {
          plan.offer.values.in_stock = false;
        }],
        ["offer url", (plan) => {
          plan.offer.values.url = `${plan.offer.values.url}?changed=true`;
        }],
        ["price history", (plan) => {
          plan.price_history.action = "create";
        }],
      ];
      for (const [label, mutate] of standaloneTamperedPlans) {
        const plan = structuredClone(standalonePlan);
        mutate(plan);
        refreshPlanFingerprint(plan);
        const rejected = exec(container, [
          "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
          "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(plan))}::jsonb);`,
        ]);
        requireSuccess(rejected, `standalone helper rejection: ${label}`);
        assert.equal(rejected.stdout.trim(), "f", `standalone helper accepted ${label}`);
      }
      requireSuccess(exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
        "insert into public.product_variants(id,product_id,variant_key,display_name,is_active,is_default) values(940002,940001,'capsule-non-default','Capsule Non Default',true,false);",
      ]), "create non-default canonical variant blocker");
      const nonDefaultRejected = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(standalonePlan))}::jsonb);`,
      ]);
      requireSuccess(nonDefaultRejected, "standalone helper rejects active non-default canonical variant");
      assert.equal(nonDefaultRejected.stdout.trim(), "f");
      requireSuccess(exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
        "delete from public.product_variants where id=940002;",
      ]), "remove non-default canonical variant blocker");
      const duplicateOfferConstraint = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
        "insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(940002,940001,3,940001,940001,9.99,3.99,13.98,true,'https://wheyokay.com/duplicate-offer','2026-07-15T10:00:02.000+00:00');",
      ]);
      assert.notEqual(duplicateOfferConstraint.status, 0, "schema accepted duplicate offer for one retailer_product_id");
      assert.match(output(duplicateOfferConstraint), /offers_retailer_product_unique/);

      requireSuccess(exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
        "insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_gtin,external_url,external_product_id,external_variant_id,external_sku,external_options,match_method,match_confidence,updated_at) values(940002,3,940001,940001,'BioTech USA Magnesium Chelate 60 Caps','biotech-usa-magnesium-chelate-60-caps',null,'https://wheyokay.com/biotech-usa-magnesium-chelate-60-caps-duplicate-940002-p.asp',null,null,null,null,'slug',90,'2026-07-15T10:00:03.000+00:00');",
      ]), "create duplicate standalone retailer/product mapping blocker");
      const duplicateMappingRejected = exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database,
        "-tAc", `select public.atomic_import_is_legacy_mapping_upgrade(${sqlLiteral(JSON.stringify(standalonePlan))}::jsonb);`,
      ]);
      requireSuccess(duplicateMappingRejected, "standalone helper rejects duplicate retailer/product mapping");
      assert.equal(duplicateMappingRejected.stdout.trim(), "f");
      requireSuccess(exec(container, [
        "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
        "delete from public.retailer_products where id=940002;",
      ]), "remove duplicate standalone retailer/product mapping blocker");

      const standaloneApproved = await approveArtifactPlan({
        artifactPath: standaloneArtifact.artifactPath,
        planFingerprint: standaloneFingerprint,
      });
      const standaloneApplied = await applyArtifactPlan({
        artifactPath: standaloneArtifact.artifactPath,
        planFingerprint: standaloneFingerprint,
        approvalId: standaloneApproved.approvalId,
        pilotApply: true,
      });
      assert.equal(standaloneApplied.successful, 1);
      const standaloneCheck = psqlJson(container, database, `select jsonb_build_object(
        'mapping',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'product_variant_id',product_variant_id,'external_product_id',external_product_id,'external_variant_id',external_variant_id,'external_sku',external_sku,'external_options',external_options,'external_gtin',external_gtin,'external_url',external_url) from public.retailer_products where id=940001),
        'offer',(select jsonb_build_object('product_id',product_id,'retailer_id',retailer_id,'retailer_product_id',retailer_product_id,'product_variant_id',product_variant_id,'price',price,'shipping_cost',shipping_cost,'total_price',total_price,'in_stock',in_stock,'url',url,'last_checked_at',last_checked_at) from public.offers where id=940001),
        'history_count',(select count(*) from public.price_history where offer_id=940001),
        'mapping_count',(select count(*) from public.retailer_products where retailer_id=3 and product_id=940001),
        'offer_count',(select count(*) from public.offers where retailer_id=3 and product_id=940001)
      );`);
      assert.deepEqual(standaloneCheck.mapping, {
        product_id: 940001, retailer_id: 3, product_variant_id: 940001,
        external_product_id: "668", external_variant_id: "668",
        external_sku: "BIO-MAG-60", external_options: null,
        external_gtin: null, external_url: standaloneUrl,
      });
      assert.deepEqual(standaloneCheck.offer, {
        product_id: 940001, retailer_id: 3, retailer_product_id: 940001,
        product_variant_id: 940001, price: 9.99, shipping_cost: 3.99,
        total_price: null, in_stock: true, url: standaloneUrl,
        last_checked_at: standaloneState.offer.last_checked_at,
      });
      assert.equal(standaloneCheck.history_count, 0);
      assert.equal(standaloneCheck.mapping_count, 1);
      assert.equal(standaloneCheck.offer_count, 1);
    } finally {
      fs.rmSync(artifactDirectory, { recursive: true, force: true });
    }
    const nodeCounts = exec(container, [
      "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-tAc",
      "select (select count(*) from retailer_products rp join offers o on o.retailer_product_id=rp.id where rp.external_variant_id in ('node-discount-1kg','node-micro-0-1mcg','node-manual-existing') and exists(select 1 from price_history ph where ph.offer_id=o.id)) || ':' || (select total_price::text from offers o join retailer_products rp on rp.id=o.retailer_product_id where rp.external_variant_id='manual-default')",
    ]);
    requireSuccess(nodeCounts, "verify Node artifact PostgreSQL writes");
    assert.equal(nodeCounts.stdout.trim(), "3:13");

    const approval = exec(container, [
      "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-tAc",
      "select (public.approve_product_import_plan(public.atomic_test_existing_plan('atomic-concurrent','atomic-concurrent',2010,2010),repeat('c',64),'atomic-concurrent-run','concurrency-test')->>'approval_id')",
    ]);
    requireSuccess(approval, "approve concurrent import plan");
    const approvalId = approval.stdout.trim();
    assert.match(approvalId, /^[0-9a-f-]{36}$/i);
    const sql = `select public.atomic_test_consume('${approvalId}'::uuid);`;
    const concurrent = exec(container, ["sh", "-c", `set +e
      psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d ${database} -c \"${sql}\" >/tmp/atomic-a.log 2>&1 & a=$!
      psql -X --no-psqlrc -v ON_ERROR_STOP=1 -U postgres -d ${database} -c \"${sql}\" >/tmp/atomic-b.log 2>&1 & b=$!
      wait $a; sa=$?
      wait $b; sb=$?
      cat /tmp/atomic-a.log /tmp/atomic-b.log
      if [ "$sa" -eq 0 ] && [ "$sb" -ne 0 ]; then exit 0; fi
      if [ "$sb" -eq 0 ] && [ "$sa" -ne 0 ]; then exit 0; fi
      exit 1`], 30_000);
    requireSuccess(concurrent, "run concurrent external-variant conflict");
    assert.match(output(concurrent), /approved import plan already consumed/i);
    const counts = exec(container, [
      "psql", "-X", "--no-psqlrc", "-U", "postgres", "-d", database, "-tAc",
      "select (select count(*) from products where id=2010) || ':' || (select count(*) from retailer_products where external_variant_id='atomic-concurrent') || ':' || (select count(*) from offers o join retailer_products rp on rp.id=o.retailer_product_id where rp.external_variant_id='atomic-concurrent') || ':' || (select count(*) from price_history ph join offers o on o.id=ph.offer_id join retailer_products rp on rp.id=o.retailer_product_id where rp.external_variant_id='atomic-concurrent')",
    ]);
    requireSuccess(counts, "check concurrent identity");
    assert.equal(counts.stdout.trim(), "1:1:1:1", "concurrent import was not serialized");
  } catch (error) {
    primaryError = primaryError || error;
  } finally {
    try {
      requireSuccess(exec(container, ["dropdb", "-U", "postgres", "--force", "--if-exists", database]), "drop disposable database");
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      requireSuccess(run("docker", ["rm", "--force", container], 30_000), "remove disposable container");
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (primaryError && cleanupErrors.length) throw new AggregateError([primaryError, ...cleanupErrors], "integration and cleanup failed", { cause: primaryError });
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "integration cleanup failed");
});
