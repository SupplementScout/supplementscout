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

const root = path.resolve(__dirname, "..");
const baseline = path.join(root, "supabase/migrations/20260712211120_baseline_current_public_schema.sql");
const stage2 = path.join(root, "supabase/migrations/20260713130000_product_variants_stage2.sql");
const stage2Setup = path.join(root, "supabase/test/product_variants_stage2_migration_test.sql");
const atomicMigration = path.join(root, "supabase/migrations/20260713180000_atomic_product_import_rpc.sql");
const approvalMigration = path.join(root, "supabase/migrations/20260713190000_approved_import_plan_ledger.sql");
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
    requireSuccess(psqlFile(container, database, atomicMigration), "reapply atomic import migration idempotently");
    requireSuccess(psqlFile(container, database, approvalMigration), "reapply approval ledger migration idempotently");
    requireSuccess(psqlFile(container, database, integrationTest, [
      "atomic_import_test_database_confirmed=1",
      "atomic_import_test_host=127.0.0.1",
      `atomic_import_expected_database=${database}`,
    ]), "run 60 atomic import and approval-ledger SQL scenarios");

    const fixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "insert into public.products(id,name,slug,brand,category,product_format,is_active) values(920001,'Micro Dose Product','micro-dose-product','Integration Brand','Health Supplements','capsule',true); insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(920001,920001,'micro-0-1mcg','0.1 mcg',0.0000001,'g',1,'capsule',true,false); update public.offers set total_price=999 where retailer_product_id=(select id from public.retailer_products where external_variant_id='manual-default');",
    ]);
    requireSuccess(fixtureInsert, "create Node decimal integration fixture");
    const state = psqlJson(container, database, `select jsonb_build_object(
      'retailer',(select jsonb_build_object('id',id,'name',name,'slug',slug,'website',website) from public.retailers where id=1),
      'mass_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=900001),
      'mass_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=900002),
      'micro_product',(select jsonb_build_object('id',id,'name',name,'slug',slug,'brand',brand,'category',category,'is_active',is_active,'merged_into_product_id',merged_into_product_id,'product_format',product_format) from public.products where id=920001),
      'micro_variant',(select jsonb_build_object('id',id,'product_id',product_id,'variant_key',variant_key,'display_name',display_name,'flavour_code',flavour_code,'flavour_label',flavour_label,'size_value',size_value,'size_unit',size_unit,'pack_count',pack_count,'product_format',product_format,'is_active',is_active,'is_default',is_default) from public.product_variants where id=920001),
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
        const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
        const approved = await approveArtifactPlan({ artifactPath: artifact.artifactPath, planFingerprint: fingerprint });
        const applied = await applyArtifactPlan({
          artifactPath: artifact.artifactPath, planFingerprint: fingerprint,
          approvalId: approved.approvalId, pilotApply: true,
        });
        assert.equal(applied.successful, 1);
      }
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
