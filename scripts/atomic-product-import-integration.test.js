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
    requireSuccess(psqlFile(container, database, atomicMigration), "reapply atomic import migration idempotently");
    requireSuccess(psqlFile(container, database, approvalMigration), "reapply approval ledger migration idempotently");
    requireSuccess(psqlFile(container, database, legacyUpgradeMigration), "reapply legacy mapping upgrade migration idempotently");
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
    const legacyFixtureInsert = exec(container, [
      "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database, "-c",
      "update public.retailers set name='Discount Supplements',slug='discount-supplements',website='https://www.discount-supplements.co.uk' where id=4; insert into public.products(id,name,slug,brand,category,product_format,is_active) values(407,'CNP Creatine Monohydrate 250g','cnp-creatine-monohydrate-250g','CNP','Creatine',null,true); insert into public.product_variants(id,product_id,variant_key,display_name,size_value,size_unit,pack_count,product_format,is_active,is_default) values(386,407,'default','Default',null,null,null,null,true,true); insert into public.retailer_products(id,retailer_id,product_id,product_variant_id,external_name,external_slug,external_gtin,external_url,external_product_id,external_variant_id,external_sku,external_options,match_method,match_confidence,updated_at) values(948,4,407,386,'CNP Creatine Monohydrate 250g','cnp-creatine-monohydrate-250g',null,'https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234',null,null,null,null,'slug',90,'2026-07-12T12:37:52.563+00:00'); insert into public.offers(id,product_id,retailer_id,retailer_product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url,last_checked_at) values(762,407,4,948,386,12.99,4.99,17.98,true,'https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234','2026-07-12T12:37:52.674+00:00');",
    ]);
    requireSuccess(legacyFixtureInsert, "create exact legacy mapping 948 fixture");
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
        assert.equal(artifact.artifact.plans[0].operation_type, "standard_import");
        assert.equal(
          artifact.artifact.plans[0].operation_type,
          artifact.artifact.plans[0].resolved_plan.meta.operation_type
        );
        const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
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
