const assert = require("node:assert/strict");
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
const {
  attachSharedParentIdentityContracts,
} = require("./lib/retailer-shared-parent-identity");

const ROOT = path.resolve(__dirname, "..");
const IMAGE = "postgres:17-alpine";
const PASSWORD = "shared-parent-local-only";
const MIGRATIONS = [
  "supabase/migrations/20260712211120_baseline_current_public_schema.sql",
  "supabase/test/product_variants_stage2_migration_test.sql",
  "supabase/migrations/20260713130000_product_variants_stage2.sql",
  "supabase/migrations/20260713180000_atomic_product_import_rpc.sql",
  "supabase/migrations/20260713190000_approved_import_plan_ledger.sql",
  "supabase/migrations/20260713200000_legacy_mapping_upgrade_rpc.sql",
  "supabase/migrations/20260715234500_align_approval_product_format_normalization.sql",
  "supabase/migrations/20260718150000_add_verified_no_change_offer_refresh.sql",
  "supabase/migrations/20260719193000_support_existing_product_variant_import.sql",
  "supabase/migrations/20260720103000_align_safe_create_reviewed_families.sql",
  "supabase/migrations/20260720110000_align_serving_count_variant_size.sql",
  "supabase/migrations/20260720113000_support_verified_shopify_variants_without_sku.sql",
  "supabase/migrations/20260721100000_support_reviewed_parent_explicit_variant_safe_create.sql",
  "supabase/migrations/20260721113000_allow_reviewed_tbjp_parent_variants.sql",
  "supabase/migrations/20260721125000_allow_reviewed_jons_preworkout_parent_variants.sql",
  "supabase/migrations/20260721190000_allow_reviewed_jons_hydration_bar_parent_variants.sql",
  "supabase/migrations/20260721191000_allow_reviewed_bar_format_in_parent_import.sql",
  "supabase/migrations/20260721200000_allow_reviewed_jons_nutrition_families.sql",
  "supabase/migrations/20260721210000_allow_reviewed_strom_health_support_families.sql",
  "supabase/migrations/20260722113000_allow_final_reviewed_jons_closeout.sql",
  "supabase/migrations/20260723160000_allow_exact_retailer_variants_to_share_product_urls.sql",
  "supabase/migrations/20260723161000_allow_exact_retailer_variants_to_share_legacy_parent_url_evidence.sql",
  "supabase/migrations/20260723170000_unify_ekm_shared_parent_import_identity.sql",
];
const ROLLBACK =
  "supabase/manual/20260723170000_unify_ekm_shared_parent_import_identity_rollback.sql";

function run(command, args, timeout = 180_000) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
}
function output(result) {
  return `${result.stdout || ""}\n${result.stderr || ""}`;
}
function succeed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label} failed:\n${output(result)}`);
  return result;
}
function fail(result, label, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly passed`);
  assert.match(output(result), pattern, label);
  return result;
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], 10_000)
    .status === 0;
}
function exec(container, args, timeout = 180_000) {
  return run("docker", [
    "exec",
    "-e",
    `PGPASSWORD=${PASSWORD}`,
    container,
    ...args,
  ], timeout);
}
function psql(container, database, sql) {
  return exec(container, [
    "psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database, "-c", sql,
  ]);
}
function psqlFile(container, database, file, variables = []) {
  const args = ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1"];
  for (const variable of variables) args.push("-v", variable);
  args.push("-U", "postgres", "-d", database, "-f", `/workspace/${file}`);
  return exec(container, args);
}
function sqlLiteral(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}
function json(container, database, sql) {
  const result = succeed(exec(container, [
    "psql", "-X", "--no-psqlrc", "-At",
    "-U", "postgres", "-d", database, "-c", sql,
  ]), "JSON query");
  return JSON.parse(result.stdout.trim());
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"], 5_000).status === 0) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL did not become ready");
}
function postgresRpcClient(container, database) {
  return {
    async rpc(name, args) {
      try {
        if (name === "approve_product_import_plan") {
          return {
            data: json(container, database,
              `select public.approve_product_import_plan(${sqlLiteral(JSON.stringify(args.p_plan))}::jsonb,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_run_id)},${sqlLiteral(args.p_source)})::text;`
            ),
            error: null,
          };
        }
        if (name === "apply_approved_product_import_plan") {
          return {
            data: json(container, database,
              `select public.apply_approved_product_import_plan(${sqlLiteral(args.p_approval_id)}::uuid,${sqlLiteral(args.p_artifact_sha256)},${sqlLiteral(args.p_plan_fingerprint)},${sqlLiteral(args.p_source_row_fingerprint)},${sqlLiteral(args.p_retailer_id)}::bigint,${sqlLiteral(args.p_plan_kind)},${sqlLiteral(args.p_run_id)})::text;`
            ),
            error: null,
          };
        }
        return { data: null, error: new Error(`unsupported RPC ${name}`) };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
function plannedItem(externalVariantId, flavour, url, externalProductId = "PARENT-1") {
  const slug = flavour.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const row = {
    retailer_name: "Whey Okay",
    retailer_website: "https://wheyokay.test",
    external_product_id: externalProductId,
    external_variant_id: externalVariantId,
    external_sku: `SKU-${externalVariantId}`,
    external_gtin: `GTIN-${externalVariantId}`,
    external_options: JSON.stringify({ Flavour: flavour }),
    external_url: url,
    affiliate_url: url,
    product_name: "Shared Parent Product 2kg",
    slug: "shared-parent-product-2kg",
    category: "Whey Protein",
    flavour,
    variant_name: `${flavour} / 2kg`,
    size: "2000 g",
    product_format: "powder",
    price: "20.00",
    shipping_cost: "0.00",
    in_stock: "true",
    is_for_sale: "true",
  };
  return {
    row,
    rowNumber: 2,
    retailer: {
      id: 990001,
      name: "Whey Okay",
      slug: "whey-okay",
      website: "https://wheyokay.test",
    },
    product: {
      id: 990001,
      name: "Shared Parent Product 2kg",
      is_active: true,
      merged_into_product_id: null,
      product_format: null,
    },
    mapping: null,
    productVariant: {
      id: null,
      product_id: 990001,
      planned_create: true,
      variant_key: `${slug}-2000g`,
      display_name: `${flavour} / 2kg`,
      flavour_code: flavour.toLowerCase(),
      flavour_label: flavour,
      size_value: 2000,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
      is_active: true,
      is_default: false,
    },
    existingOffer: null,
    offerPlan: {
      action: "create",
      createsPriceHistory: true,
      priceChanged: false,
      shippingChanged: false,
      stockChanged: false,
      urlChanged: false,
    },
    validationErrors: [],
    variantResolutionError: null,
    mode: "feed",
    externalGtin: `GTIN-${externalVariantId}`,
    sharedParentIdentityRequired: true,
    sharedParentUrlPeers: [],
  };
}
function artifactFor(item, directory, name) {
  item.importPlan = buildAtomicImportPlan(item);
  return writeDryRunArtifact([item.row], {
    skipped: 0,
    blockedRows: [],
    report: { approvedRows: [item], blockedRows: [] },
  }, {
    artifactPath: path.join(directory, `${name}.json`),
    runId: `shared-parent-${name}`,
    sourceContent: JSON.stringify(item.row),
    sourceFileName: `${name}.json`,
    environmentMarker: "disposable-postgresql",
  });
}
async function approve(itemArtifact) {
  const fingerprint = itemArtifact.artifact.plans[0].plan_fingerprint;
  return approveArtifactPlan({
    artifactPath: itemArtifact.artifactPath,
    planFingerprint: fingerprint,
  });
}
function applySql(approval, itemArtifact) {
  const entry = itemArtifact.artifact.plans[0];
  return `select public.apply_approved_product_import_plan(` +
    `${sqlLiteral(approval.approvalId)}::uuid,` +
    `${sqlLiteral(itemArtifact.artifactSha256)},` +
    `${sqlLiteral(entry.plan_fingerprint)},` +
    `${sqlLiteral(entry.source_row_fingerprint)},` +
    `${sqlLiteral(entry.retailer_id)}::bigint,` +
    `${sqlLiteral(entry.plan_kind)},` +
    `${sqlLiteral(itemArtifact.artifact.run_id)});`;
}

test("shared-parent planner contract and atomic RPC stay in parity", {
  skip: !dockerAvailable() && "Docker is unavailable",
  timeout: 240_000,
}, async () => {
  const suffix = `${process.pid}-${Date.now()}`.toLowerCase();
  const container = `supplementscout-shared-parent-${suffix}`;
  const database =
    `supplementscout_stage2_test_shared_parent_${suffix.replaceAll("-", "_")}`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shared-parent-rpc-"));
  let primaryError = null;
  try {
    succeed(run("docker", [
      "run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", `POSTGRES_PASSWORD=${PASSWORD}`,
      "-v", `${ROOT}:/workspace:ro`,
      IMAGE,
    ], 180_000), "start PostgreSQL");
    wait(container);
    succeed(exec(container, ["createdb", "-U", "postgres", database]), "create database");
    succeed(psql(container, database, `do $roles$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $roles$;`), "create roles");

    for (const file of MIGRATIONS) {
      const variables = file.includes("product_variants_stage2_migration_test.sql")
        ? [
            "stage2_test_database_confirmed=1",
            "stage2_test_host=127.0.0.1",
            `stage2_expected_database=${database}`,
            "stage2_scenario=success",
          ]
        : [];
      succeed(psqlFile(container, database, file, variables), `apply ${file}`);
      if (file.endsWith("20260713130000_product_variants_stage2.sql")) {
        succeed(psql(container, database, `
          update public.retailer_products
          set external_product_id=null,external_variant_id=null,external_sku=null,
              external_gtin=null,external_options=null
          where id in (137,549)
        `), "align historical GymHigh fixture identity");
      }
    }

    succeed(psql(container, database, `
      insert into public.retailers(id,name,slug,website)
      values(990001,'Whey Okay','whey-okay','https://wheyokay.test');
      insert into public.products(id,name,slug,brand,category,price,is_active)
      values(990001,'Shared Parent Product 2kg','shared-parent-product-2kg','Test','Whey Protein',20,true);
      insert into public.product_variants(
        id,product_id,variant_key,display_name,is_active,is_default
      ) values(990001,990001,'default','Default',true,true);
      insert into public.retailer_products(
        id,retailer_id,product_id,product_variant_id,external_name,
        external_url,match_method,match_confidence
      ) values(
        990001,990001,990001,990001,'Legacy parent',
        'https://wheyokay.test/shared-parent','legacy_url',80
      );
    `), "seed compatible legacy parent");

    setSupabaseForTests(postgresRpcClient(container, database));
    const legacyPeer = {
      id: 990001,
      retailer_id: 990001,
      product_id: 990001,
      product_variant_id: 990001,
      external_product_id: null,
      external_variant_id: null,
      external_sku: null,
      external_gtin: null,
      external_options: null,
      external_url: "https://wheyokay.test/shared-parent",
    };
    const first = plannedItem(
      "VARIANT-1", "Chocolate", "https://wheyokay.test/shared-parent"
    );
    const second = plannedItem(
      "VARIANT-2", "Vanilla", "https://wheyokay.test/shared-parent"
    );
    first.sharedParentUrlPeers = [legacyPeer];
    second.sharedParentUrlPeers = [legacyPeer];
    attachSharedParentIdentityContracts([first, second]);
    const firstArtifact = artifactFor(first, directory, "first");
    const secondArtifact = artifactFor(second, directory, "second");
    const firstApproval = await approve(firstArtifact);
    const secondApproval = await approve(secondArtifact);
    await applyArtifactPlan({
      artifactPath: firstArtifact.artifactPath,
      planFingerprint: firstArtifact.artifact.plans[0].plan_fingerprint,
      approvalId: firstApproval.approvalId,
      pilotApply: true,
    });
    await applyArtifactPlan({
      artifactPath: secondArtifact.artifactPath,
      planFingerprint: secondArtifact.artifact.plans[0].plan_fingerprint,
      approvalId: secondApproval.approvalId,
      pilotApply: true,
    });
    assert.deepEqual(json(container, database, `
      select json_build_object(
        'variants',(select count(*) from public.product_variants where product_id=990001 and not is_default),
        'mappings',(select count(*) from public.retailer_products where retailer_id=990001 and external_variant_id in ('VARIANT-1','VARIANT-2')),
        'offers',(select count(*) from public.offers where retailer_id=990001),
        'history',(select count(*) from public.price_history ph join public.offers o on o.id=ph.offer_id where o.retailer_id=990001)
      )::text
    `), { variants: 2, mappings: 2, offers: 2, history: 2 });
    await assert.rejects(
      () => applyArtifactPlan({
        artifactPath: firstArtifact.artifactPath,
        planFingerprint: firstArtifact.artifact.plans[0].plan_fingerprint,
        approvalId: firstApproval.approvalId,
        pilotApply: true,
      }),
      /already consumed/
    );

    const currentPeers = json(container, database, `
      select coalesce(json_agg(r order by r.id),'[]'::json)::text
      from (
        select id,retailer_id,product_id,product_variant_id,external_product_id,
               external_variant_id,external_sku,external_gtin,external_options,external_url
        from public.retailer_products
        where retailer_id=990001 and external_url='https://wheyokay.test/shared-parent'
      ) r
    `);
    const stale = plannedItem(
      "VARIANT-3", "Strawberry", "https://wheyokay.test/shared-parent"
    );
    stale.sharedParentUrlPeers = currentPeers;
    attachSharedParentIdentityContracts([stale]);
    const staleArtifact = artifactFor(stale, directory, "stale");
    const staleApproval = await approve(staleArtifact);
    succeed(psql(container, database, `
      insert into public.product_variants(
        id,product_id,variant_key,display_name,flavour_code,flavour_label,
        size_value,size_unit,pack_count,product_format,is_active,is_default
      ) values(
        990099,990001,'unexpected-2000g','Unexpected / 2kg','unexpected',
        'Unexpected',2000,'g',1,'powder',true,false
      );
      insert into public.retailer_products(
        retailer_id,product_id,product_variant_id,external_name,external_url,
        external_product_id,external_variant_id,external_sku,external_gtin,
        external_options,match_method,match_confidence
      ) values(
        990001,990001,990099,'Unexpected','https://wheyokay.test/shared-parent',
        'PARENT-1','UNEXPECTED','SKU-UNEXPECTED','GTIN-UNEXPECTED',
        '{"Flavour":"Unexpected"}','external_id',100
      );
    `), "insert unapproved compatible peer");
    await assert.rejects(
      () => applyArtifactPlan({
        artifactPath: staleArtifact.artifactPath,
        planFingerprint: staleArtifact.artifact.plans[0].plan_fingerprint,
        approvalId: staleApproval.approvalId,
        pilotApply: true,
      }),
      /shared parent peer set changed/
    );

    const rollbackA = plannedItem(
      "VARIANT-20", "Banana", "https://wheyokay.test/rollback-parent", "PARENT-2"
    );
    const rollbackB = plannedItem(
      "VARIANT-21", "Caramel", "https://wheyokay.test/rollback-parent", "PARENT-2"
    );
    attachSharedParentIdentityContracts([rollbackA, rollbackB]);
    const rollbackAArtifact = artifactFor(rollbackA, directory, "rollback-a");
    const rollbackBArtifact = artifactFor(rollbackB, directory, "rollback-b");
    const rollbackAApproval = await approve(rollbackAArtifact);
    const rollbackBApproval = await approve(rollbackBArtifact);
    succeed(psql(container, database, `
      insert into public.product_variants(
        id,product_id,variant_key,display_name,is_active,is_default
      ) values(990098,990001,'sku-collision','SKU collision',true,false);
      insert into public.retailer_products(
        retailer_id,product_id,product_variant_id,external_name,external_url,
        external_product_id,external_variant_id,external_sku,match_method,match_confidence
      ) values(
        990001,990001,990098,'SKU collision','https://wheyokay.test/other',
        'OTHER-PARENT','OTHER-VARIANT','SKU-VARIANT-21','external_id',100
      );
    `), "seed later-row SKU collision");
    fail(psql(container, database,
      `begin;${applySql(rollbackAApproval, rollbackAArtifact)}` +
      `${applySql(rollbackBApproval, rollbackBArtifact)}commit;`
    ), "atomic rollback on later sibling", /external SKU collision/);
    assert.deepEqual(json(container, database, `
      select json_build_object(
        'mappings',(select count(*) from public.retailer_products where external_variant_id in ('VARIANT-20','VARIANT-21')),
        'variants',(select count(*) from public.product_variants where variant_key in ('banana-2000g','caramel-2000g')),
        'unconsumed',(select count(*) from public.approved_import_plans where id in (
          '${rollbackAApproval.approvalId}'::uuid,'${rollbackBApproval.approvalId}'::uuid
        ) and consumed_at is null)
      )::text
    `), { mappings: 0, variants: 0, unconsumed: 2 });

    const forwardHash = json(container, database, `
      select to_json(
        encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
          'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
        ),'UTF8')),'hex')
      )::text
    `);
    assert.match(forwardHash, /^[0-9a-f]{64}$/);
    succeed(psqlFile(container, database, ROLLBACK), "apply rollback definition");
    assert.equal(json(container, database, `
      select to_json(
        encode(pg_catalog.sha256(convert_to(pg_get_functiondef(
          'public.atomic_import_validate_variant_plan_core(jsonb)'::regprocedure
        ),'UTF8')),'hex')
      )::text
    `), "955321b6f9fd577cc95b3e6c206fa7919fd8e7bf54755e9ed584c49b3d587179");
  } catch (error) {
    primaryError = error;
  } finally {
    setSupabaseForTests(null);
    fs.rmSync(directory, { recursive: true, force: true });
    run("docker", ["rm", "-f", container], 30_000);
  }
  if (primaryError) throw primaryError;
});
