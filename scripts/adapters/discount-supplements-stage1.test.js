const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertReadOnlyEnvironment,
  assertReadOnlyImporterArgs,
  classifyCatalog,
  main,
  renderSummary,
  runImporterDryRun,
  serializeCsv,
  validateDryRun,
  validateSnapshotArtifacts,
} = require("./discount-supplements-stage1");

const ROOT = path.resolve(__dirname, "../..");
const PRODUCT_URL = "https://www.discount-supplements.co.uk/products/gold-standard?variant=56719096316282";

function config() {
  return {
    schema_version: 1,
    source_url: "https://www.discount-supplements.co.uk/products.json?limit=250",
    retailer: {
      id: 4,
      name: "Discount Supplements",
      slug: "discount-supplements",
      website: "https://www.discount-supplements.co.uk",
    },
    shipping: { known: true, cost: 4.99 },
    guardrails: { fetch_timeout_ms: 15000, max_response_bytes: 5242880, max_pages: 20 },
  };
}

function sourceRow(overrides = {}) {
  return {
    retailer_name: "Discount Supplements",
    retailer_website: "https://www.discount-supplements.co.uk",
    external_product_id: "4666284834863",
    external_variant_id: "56719096316282",
    external_sku: "OPNU-0965",
    external_options: JSON.stringify({ Size: "2kg", Flavour: "Chocolate" }),
    external_gtin: "",
    product_name: "Optimum Nutrition Gold Standard 100% Whey 2kg",
    variant_name: "Chocolate / 2kg",
    brand: "Optimum Nutrition",
    category: "Whey Protein",
    handle: "gold-standard",
    external_url: PRODUCT_URL,
    price: "89.95",
    in_stock: "true",
    is_for_sale: "true",
    image: "https://cdn.shopify.com/example.jpg",
    product_updated_at: "2026-07-14T10:00:00Z",
    variant_updated_at: "2026-07-14T10:01:00Z",
    ...overrides,
  };
}

function productionState(overrides = {}) {
  const state = {
    retailers: [{ id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" }],
    products: [{ id: 7, name: "Optimum Nutrition Gold Standard 100% Whey 2.27kg", slug: "optimum-nutrition-gold-standard-whey-2-27kg", brand: "Optimum Nutrition", category: "Whey Protein", product_format: "powder", is_active: true, merged_into_product_id: null }],
    productVariants: [{ id: 712, product_id: 7, variant_key: "chocolate-2000g", display_name: "Chocolate / 2kg", flavour_code: "chocolate", flavour_label: "Chocolate", size_value: 2000, size_unit: "g", pack_count: 1, product_format: "powder", is_active: true, is_default: false }],
    retailerProducts: [{ id: 951, retailer_id: 4, product_id: 7, product_variant_id: 712, external_name: "Optimum Nutrition Gold Standard 100% Whey 2kg", external_slug: "optimum-nutrition-gold-standard-whey-2kg", external_gtin: null, external_url: PRODUCT_URL, external_product_id: "4666284834863", external_variant_id: "56719096316282", external_sku: "OPNU-0965", external_options: { Size: "2kg", Flavour: "Chocolate" }, match_method: "slug", match_confidence: 90, updated_at: "2026-07-14T11:45:28Z" }],
    offers: [{ id: 765, product_id: 7, retailer_id: 4, retailer_product_id: 951, product_variant_id: 712, price: "89.95", shipping_cost: "4.99", total_price: "94.94", in_stock: true, url: PRODUCT_URL, last_checked_at: "2026-07-14T11:45:28Z" }],
  };
  for (const [key, value] of Object.entries(overrides)) state[key] = value;
  return state;
}

function classify(row = sourceRow(), state = productionState()) {
  return classifyCatalog({ rows: [row], state, config: config() });
}

test("no change remains NO_CHANGE and builds one existing-mapping import row", () => {
  const result = classify();
  assert.equal(result.entries[0].classification, "NO_CHANGE");
  assert.deepEqual(result.entries[0].changes, []);
  assert.equal(result.importRows.length, 1);
  assert.equal(result.importRows[0].external_variant_id, "56719096316282");
  assert.equal(result.importRows[0].flavour, "Chocolate");
  assert.equal(result.importRows[0].size, "2000");
  assert.equal(result.importRows[0].product_format, "powder");
});

test("price-only source change is SAFE_UPDATE and recalculates total without floating point", () => {
  const result = classify(sourceRow({ price: "90.01" }));
  assert.equal(result.entries[0].classification, "SAFE_UPDATE");
  assert.deepEqual(result.entries[0].changes, ["price", "total_price"]);
  assert.equal(result.importRows[0].price, "90.01");
});

test("stock-only source change is OUT_OF_STOCK and remains eligible for dry-run", () => {
  const result = classify(sourceRow({ in_stock: "false" }));
  assert.equal(result.entries[0].classification, "OUT_OF_STOCK");
  assert.ok(result.entries[0].changes.includes("in_stock"));
  assert.equal(result.importRows[0].in_stock, "false");
});

test("shipping drift is SAFE_UPDATE and URL-only drift is SAFE_UPDATE", () => {
  const shippingState = productionState();
  shippingState.offers[0] = { ...shippingState.offers[0], shipping_cost: "0.00", total_price: "89.95" };
  const shipping = classify(sourceRow(), shippingState).entries[0];
  assert.equal(shipping.classification, "SAFE_UPDATE");
  assert.ok(shipping.changes.includes("shipping_cost"));
  assert.ok(shipping.changes.includes("total_price"));

  const oldUrl = "https://www.discount-supplements.co.uk/products/old?variant=56719096316282";
  const urlState = productionState();
  urlState.retailerProducts[0] = { ...urlState.retailerProducts[0], external_url: oldUrl };
  urlState.offers[0] = { ...urlState.offers[0], url: oldUrl };
  const url = classify().entries[0];
  const changed = classify(sourceRow(), urlState).entries[0];
  assert.equal(url.classification, "NO_CHANGE");
  assert.equal(changed.classification, "SAFE_UPDATE");
  assert.ok(changed.changes.includes("external_url"));
});

test("new source identities are review-only and never enter the importer CSV", () => {
  const newVariant = classify(sourceRow({
    external_variant_id: "56719096316283",
    external_url: "https://www.discount-supplements.co.uk/products/gold-standard?variant=56719096316283",
  }));
  assert.equal(
    newVariant.entries.find((entry) => entry.external_variant_id === "56719096316283").classification,
    "NEW_VARIANT_REVIEW"
  );
  assert.equal(newVariant.importRows.length, 0);

  const newProduct = classify(sourceRow({
    external_product_id: "999999999",
    external_variant_id: "999999998",
    external_url: "https://www.discount-supplements.co.uk/products/new?variant=999999998",
  }));
  assert.equal(
    newProduct.entries.find((entry) => entry.external_variant_id === "999999998").classification,
    "NEW_PRODUCT_REVIEW"
  );
  assert.equal(newProduct.importRows.length, 0);
});

test("missing source variants are reported without creating an importer row", () => {
  const state = productionState();
  state.retailerProducts.push({
    ...state.retailerProducts[0], id: 952, external_variant_id: "56719096316299",
    external_url: "https://www.discount-supplements.co.uk/products/gold-standard?variant=56719096316299",
  });
  state.offers.push({ ...state.offers[0], id: 766, retailer_product_id: 952 });
  const result = classify(sourceRow(), state);
  assert.equal(result.counts.MISSING_FROM_SOURCE, 1);
  assert.equal(result.entries.find((entry) => entry.external_variant_id === "56719096316299").classification, "MISSING_FROM_SOURCE");
  assert.equal(result.importRows.length, 1);
});

test("identity conflicts fail closed before importer selection", () => {
  const state = productionState();
  state.retailerProducts[0] = { ...state.retailerProducts[0], external_product_id: "different-product" };
  const result = classify(sourceRow(), state);
  assert.equal(result.entries[0].classification, "IDENTITY_CONFLICT");
  assert.match(result.entries[0].block_reason, /external_product_id drift/);
  assert.equal(result.importRows.length, 0);

  const duplicate = productionState();
  duplicate.retailerProducts.push({ ...duplicate.retailerProducts[0], id: 999, retailer_id: 99 });
  const duplicateResult = classify(sourceRow(), duplicate);
  assert.equal(duplicateResult.entries[0].classification, "IDENTITY_CONFLICT");
  assert.match(duplicateResult.entries[0].block_reason, /not unique/);
});

function snapshotFixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "discount-stage1-snapshot-"));
  const rawPath = path.join(directory, "raw.json");
  const normalizedPath = path.join(directory, "normalized.csv");
  const fullReportPath = path.join(directory, "report.json");
  const rows = options.rows || [sourceRow()];
  const productCount = options.productCount ?? 1;
  const pageProductCounts = Array(Math.floor(productCount / 250)).fill(250);
  const remainder = productCount % 250;
  if (remainder || productCount < 250) pageProductCounts.push(remainder);
  else pageProductCounts.push(0);
  const products = Array.from({ length: productCount }, (_, index) => ({ id: String(index + 1), variants: index === 0 ? rows.map((row) => ({ id: row.external_variant_id })) : [] }));
  const raw = `${JSON.stringify({ source_url: "https://www.discount-supplements.co.uk/products.json?limit=250", page_product_counts: pageProductCounts, products }, null, 2)}\n`;
  const header = Object.keys(rows[0]);
  const csv = serializeCsv(header, rows);
  fs.writeFileSync(rawPath, options.rawText ?? raw);
  fs.writeFileSync(normalizedPath, csv);
  const report = {
    source_url: "https://www.discount-supplements.co.uk/products.json?limit=250",
    page_count: pageProductCounts.length,
    page_product_counts: pageProductCounts,
    shopify_product_count: productCount,
    shopify_variant_count: rows.length,
    in_stock_count: rows.filter((row) => row.in_stock === "true").length,
    out_of_stock_count: rows.filter((row) => row.in_stock !== "true").length,
    invalid_record_count: 0,
    duplicate_external_variant_id_count: 0,
    output_hashes: {
      raw_json_sha256: crypto.createHash("sha256").update(fs.readFileSync(rawPath)).digest("hex"),
      normalized_csv_sha256: crypto.createHash("sha256").update(fs.readFileSync(normalizedPath)).digest("hex"),
    },
    database_writes: 0,
    importer_run: false,
    ...options.reportOverrides,
  };
  fs.writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { rawPath, normalizedPath, fullReportPath };
}

test("snapshot integrity rejects duplicate variant IDs and malformed prices", () => {
  const duplicate = snapshotFixture({ rows: [sourceRow(), sourceRow()] });
  assert.throws(() => validateSnapshotArtifacts({ ...duplicate, baselineProducts: 1, baselineVariants: 1 }), /Duplicate external_variant_id/);
  const malformed = snapshotFixture({ rows: [sourceRow({ price: "£89.95" })] });
  assert.throws(() => validateSnapshotArtifacts({ ...malformed, baselineProducts: 1, baselineVariants: 1 }), /SOURCE_ERROR.*price/);
});

test("snapshot integrity blocks partial pagination and sudden count drops", () => {
  const partial = snapshotFixture({ productCount: 2, reportOverrides: { page_count: 2, page_product_counts: [200, 2] } });
  assert.throws(() => validateSnapshotArtifacts({ ...partial, baselineProducts: 1, baselineVariants: 1 }), /pagination is incomplete|pagination total mismatch/);
  const dropped = snapshotFixture({ productCount: 1 });
  assert.throws(() => validateSnapshotArtifacts({ ...dropped, baselineProducts: 10, baselineVariants: 1 }), /product count drop/);
});

test("snapshot count threshold allows 80% or more and blocks any lower ratio without rounding", () => {
  const productPass = snapshotFixture({ productCount: 274 });
  assert.doesNotThrow(() => validateSnapshotArtifacts({ ...productPass, baselineProducts: 342, baselineVariants: 1 }));
  const productBlock = snapshotFixture({ productCount: 273 });
  assert.throws(() => validateSnapshotArtifacts({ ...productBlock, baselineProducts: 342, baselineVariants: 1 }), /product count drop/);

  const rows = Array.from({ length: 806 }, (_, index) => {
    const variantId = String(60000000000000 + index);
    return sourceRow({
      external_variant_id: variantId,
      external_url: `https://www.discount-supplements.co.uk/products/gold-standard?variant=${variantId}`,
    });
  });
  const variantPass = snapshotFixture({ rows });
  assert.doesNotThrow(() => validateSnapshotArtifacts({ ...variantPass, baselineProducts: 1, baselineVariants: 1007 }));
  const variantBlock = snapshotFixture({ rows: rows.slice(0, 805) });
  assert.throws(() => validateSnapshotArtifacts({ ...variantBlock, baselineProducts: 1, baselineVariants: 1007 }), /variant count drop/);

  const exact = snapshotFixture({ productCount: 4 });
  assert.doesNotThrow(() => validateSnapshotArtifacts({ ...exact, baselineProducts: 5, baselineVariants: 1 }));
  const below = snapshotFixture({ productCount: 3 });
  assert.throws(() => validateSnapshotArtifacts({ ...below, baselineProducts: 5, baselineVariants: 1 }), /product count drop/);
});

test("snapshot integrity accepts complete small hermetic snapshot", () => {
  const fixture = snapshotFixture();
  const result = validateSnapshotArtifacts({ ...fixture, baselineProducts: 1, baselineVariants: 1 });
  assert.equal(result.rows.length, 1);
  assert.equal(result.report.database_writes, 0);
});

test("read-only environment and importer CLI are fail closed", () => {
  assert.throws(() => assertReadOnlyEnvironment({}), /READ_ONLY/);
  assert.doesNotThrow(() => assertReadOnlyEnvironment({
    SUPPLEMENTSCOUT_STAGE1_READ_ONLY: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-secret",
  }));
  const safe = ["scripts/import-products.js", "--mode=feed", "--dry-run", "--csv=C:\\tmp\\rows.csv", "--artifact=C:\\tmp\\plan.json"];
  assert.doesNotThrow(() => assertReadOnlyImporterArgs(safe));
  for (const forbidden of ["--approve-plan", "--pilot-apply", "--approval-id=1", "db push", "migration up"]) {
    assert.throws(() => assertReadOnlyImporterArgs([...safe, forbidden]), /Forbidden|fixed feed dry-run/);
  }
});

test("importer runner requires a real artifact sidecar and only accepts existing-scope plans", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "discount-stage1-importer-"));
  const csvPath = path.join(directory, "rows.csv");
  const artifactPath = path.join(directory, "plan.json");
  const machineReportPath = path.join(directory, "machine.json");
  fs.writeFileSync(csvPath, "header\n");
  const plan = {
    meta: { operation_type: "standard_import" },
    product: { action: "existing" },
    product_variant: { action: "existing" },
    retailer: { action: "existing" },
    retailer_product: { action: "noop" },
    offer: { action: "update" },
    price_history: { action: "noop" },
  };
  const spawn = (_executable, args, spawnOptions) => {
    assert.deepEqual(args.slice(1, 3), ["--mode=feed", "--dry-run"]);
    const artifact = { plans: [{ operation_type: "standard_import", resolved_plan: plan }], blocked_rows: [] };
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact)}\n`);
    fs.writeFileSync(`${artifactPath}.sha256`, `${crypto.createHash("sha256").update(fs.readFileSync(artifactPath)).digest("hex")}\n`);
    fs.writeFileSync(machineReportPath, JSON.stringify({ runId: spawnOptions.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID }));
    return { status: 0, stdout: "deduplicated identical rows: 0\nDry run: no database writes performed.\n", stderr: "" };
  };
  const result = runImporterDryRun(csvPath, { runId: "test-run", artifactPath, machineReportPath, spawn });
  assert.equal(result.deduplicated, 0);
  assert.deepEqual(validateDryRun(result, 1), {
    mapping_update: 0, mapping_noop: 1,
    offer_update: 1, offer_noop: 0,
    price_history_create: 0, price_history_noop: 1,
  });
  const unsafe = structuredClone(result);
  unsafe.artifact.plans[0].resolved_plan.offer.action = "create";
  assert.throws(() => validateDryRun(unsafe, 1), /outside existing-mapping/);
});

function validDryRun() {
  return {
    artifact: {
      plans: [{
        operation_type: "standard_import",
        resolved_plan: {
          meta: { operation_type: "standard_import" },
          product: { action: "existing" },
          product_variant: { action: "existing" },
          retailer: { action: "existing" },
          retailer_product: { action: "noop" },
          offer: { action: "noop" },
          price_history: { action: "noop" },
        },
      }],
      blocked_rows: [],
    },
    deduplicated: 0,
  };
}

test("every create action outside price history is blocked independently", () => {
  for (const field of ["product", "product_variant", "retailer", "retailer_product", "offer"]) {
    const dryRun = validDryRun();
    dryRun.artifact.plans[0].resolved_plan[field].action = "create";
    assert.throws(() => validateDryRun(dryRun, 1), /outside existing-mapping/, field);
  }
});

test("operation type, blocked rows and deduplicated rows are fail closed", () => {
  const entryOperation = validDryRun();
  entryOperation.artifact.plans[0].operation_type = "legacy_mapping_upgrade";
  assert.throws(() => validateDryRun(entryOperation, 1), /outside existing-mapping/);

  const planOperation = validDryRun();
  planOperation.artifact.plans[0].resolved_plan.meta.operation_type = "legacy_mapping_upgrade";
  assert.throws(() => validateDryRun(planOperation, 1), /outside existing-mapping/);

  const blocked = validDryRun();
  blocked.artifact.blocked_rows.push({ row: 1 });
  assert.throws(() => validateDryRun(blocked, 1), /zero blocked rows/);

  const deduplicated = validDryRun();
  deduplicated.deduplicated = 1;
  assert.throws(() => validateDryRun(deduplicated, 1), /zero deduplicated rows/);
});

test("importer runner blocks when zero database writes confirmation is absent", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "discount-stage1-zero-write-"));
  const spawn = () => ({ status: 0, stdout: "dry-run completed\n", stderr: "" });
  assert.throws(() => runImporterDryRun(path.join(directory, "rows.csv"), {
    artifactPath: path.join(directory, "plan.json"),
    machineReportPath: path.join(directory, "machine.json"),
    spawn,
  }), /did not confirm zero database writes/);
});

test("summary contains complete counters and separates source variants from database-only findings", () => {
  const report = {
    snapshot: { products: 342, variants: 1007, in_stock: 711, out_of_stock: 296 },
    existing_mappings_checked: 25,
    classification_counts: {
      NO_CHANGE: 900, SAFE_UPDATE: 20, NEW_VARIANT_REVIEW: 30, NEW_PRODUCT_REVIEW: 25,
      IDENTITY_CONFLICT: 10, SOURCE_ERROR: 2, OUT_OF_STOCK: 20, MISSING_FROM_SOURCE: 3,
    },
    source_variant_classification_total: 1007,
    snapshot_variant_count: 1007,
    missing_from_source_count: 3,
    total_report_rows: 1010,
    change_counts: {
      price_changes: 4, stock_changes: 5, shipping_changes: 6, url_changes: 7,
      total_only_changes: 8, stock_only_changes: 9, url_only_changes: 10,
      mapping_metadata_changes: 11,
    },
    dry_run: {
      plans: 25,
      blocked_rows: 0,
      deduplicated_rows: 0,
      actions: {
        mapping_update: 12, mapping_noop: 13,
        offer_update: 14, offer_noop: 11,
        price_history_create: 15, price_history_noop: 10,
      },
    },
    database_writes: 0,
  };
  const summary = renderSummary(report);
  for (const label of Object.keys(report.classification_counts).filter((label) => label !== "MISSING_FROM_SOURCE")) {
    assert.match(summary, new RegExp(label));
  }
  for (const expected of [
    "Source variant classification total | 1007", "Snapshot variant count | 1007",
    "Missing from source \(database-only\) | 3", "Total report rows | 1010",
    "Price changes | 4", "Shipping changes | 6", "Total-only changes | 8",
    "Stock-only changes | 9", "URL-only changes | 10", "Mapping metadata changes | 11",
    "Retailer product update | 12", "Retailer product noop | 13", "Offer update | 14",
    "Offer noop | 11", "Price history create | 15", "Price history noop | 10",
    "Blocked rows | 0", "Deduplicated rows | 0",
  ]) assert.match(summary, new RegExp(expected));
  assert.doesNotMatch(summary, /service-role-test-secret/);
  assert.match(summary, /Approval and production apply were not invoked/);
  const incomplete = structuredClone(report);
  delete incomplete.dry_run.actions.offer_noop;
  assert.throws(() => renderSummary(incomplete), /metric is unavailable/);
  const inconsistent = structuredClone(report);
  inconsistent.source_variant_classification_total -= 1;
  assert.throws(() => renderSummary(inconsistent), /classification totals are inconsistent/);
});

test("hermetic Stage 1 main writes only review artifacts and a zero-write machine report", async () => {
  const snapshot = snapshotFixture();
  const directory = path.dirname(snapshot.rawPath);
  const classificationJsonPath = path.join(directory, "classification.json");
  const classificationCsvPath = path.join(directory, "classification.csv");
  const importCsvPath = path.join(directory, "import.csv");
  const runReportPath = path.join(directory, "run-report.json");
  const artifactPath = path.join(directory, "artifact.json");
  const sidecarPath = `${artifactPath}.sha256`;
  const machineReportPath = path.join(directory, "import-report.json");
  const plan = {
    meta: { operation_type: "standard_import" },
    product: { action: "existing" },
    product_variant: { action: "existing" },
    retailer: { action: "existing" },
    retailer_product: { action: "noop" },
    offer: { action: "noop" },
    price_history: { action: "noop" },
  };
  const result = await main({
    argv: [],
    env: {
      SUPPLEMENTSCOUT_STAGE1_READ_ONLY: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-secret",
    },
    config: config(),
    state: productionState(),
    snapshotOptions: { ...snapshot, baselineProducts: 1, baselineVariants: 1 },
    classificationJsonPath,
    classificationCsvPath,
    importCsvPath,
    runReportPath,
    log: () => {},
    runImporter(csvPath) {
      assert.equal(csvPath, importCsvPath);
      fs.writeFileSync(artifactPath, "artifact\n");
      fs.writeFileSync(sidecarPath, "a".repeat(64));
      fs.writeFileSync(machineReportPath, "{}\n");
      return {
        runId: "hermetic-run",
        artifact: { plans: [{ operation_type: "standard_import", resolved_plan: plan }], blocked_rows: [] },
        artifactPath,
        artifactSha256: "a".repeat(64),
        sidecarPath,
        machineReportPath,
        deduplicated: 0,
      };
    },
  });
  assert.equal(result.report.database_writes, 0);
  assert.equal(result.report.automatic_approval, false);
  assert.equal(result.report.automatic_apply, false);
  assert.equal(result.report.dry_run.plans, 1);
  for (const filePath of [classificationJsonPath, classificationCsvPath, importCsvPath, runReportPath]) {
    assert.equal(fs.existsSync(filePath), true);
    assert.doesNotMatch(fs.readFileSync(filePath, "utf8"), /service-role-test-secret/);
  }
});

const FORBIDDEN_LEGACY_REPORT_DEPENDENCIES = [
  "Run Fit House dry-run",
  "Run KIOR JSON-only dry-run",
  "Validate final reports",
  "scripts/adapters/validate-scheduled-reports.js",
  "tmp/retailer-feeds/fit-house/fit-house-adapter-report.json",
  "tmp/retailer-feeds/fit-house/fit-house-canonical-generated.csv",
  "tmp/retailer-feeds/kior/kior-adapter-report.json",
  "tmp/retailer-feeds/kior/kior-canonical-generated.csv",
];

function assertNoLegacyReportDependencies(workflow) {
  for (const dependency of FORBIDDEN_LEGACY_REPORT_DEPENDENCIES) {
    assert.equal(
      workflow.includes(dependency),
      false,
      `Workflow must not contain legacy Fit House/KIOR report dependency: ${dependency}`
    );
  }
}

test("scheduled workflow is main-only, environment-protected and cannot invoke writes", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/retailer-dry-run.yml"), "utf8");
  const orchestrator = fs.readFileSync(path.join(ROOT, "scripts/adapters/discount-supplements-stage1.js"), "utf8");
  assertNoLegacyReportDependencies(workflow);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron:\s*"17 6 \* \* \*"/);
  assert.doesNotMatch(workflow, /^\s*pull_request(?:_target)?:/m);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /environment:\s*production-readonly/);
  const guard = workflow.match(/^\s*if:\s*\$\{\{\s*(.+)\s*\}\}\s*$/m)?.[1]?.trim();
  assert.equal(guard, "github.ref == 'refs/heads/main' && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch')");
  const jobAllowed = (ref, eventName) => ref === "refs/heads/main" && ["schedule", "workflow_dispatch"].includes(eventName);
  assert.equal(jobAllowed("refs/heads/feature", "workflow_dispatch"), false);
  assert.equal(jobAllowed("refs/heads/main", "workflow_dispatch"), true);
  assert.match(workflow, /EXPECTED_REPOSITORY:\s*SupplementScout\/supplementscout/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /discount-supplements-shopify\.js --full-snapshot/);
  assert.match(workflow, /SUPPLEMENTSCOUT_STAGE1_READ_ONLY:\s*"true"/);
  assert.match(workflow, /discount-supplements-stage1\.js/);
  assert.doesNotMatch(workflow, /--approve-plan|--pilot-apply|db\s+push|supabase\s+db|\bmigration\b|\beval\b|set\s+-x/i);
  const permissions = workflow.match(/^permissions:\s*\n((?:\s{2}.+\n)+)/m)?.[1] || "";
  assert.match(permissions, /^\s{2}contents:\s*read\s*$/m);
  assert.doesNotMatch(permissions, /write/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*(?!\$\{\{\s*secrets\.)\S+/);
  assert.equal((workflow.match(/^\s+SUPABASE_SERVICE_ROLE_KEY:/gm) || []).length, 1);
  assert.equal((workflow.match(/secrets\.SUPABASE_SERVICE_ROLE_KEY/g) || []).length, 1);
  assert.equal((workflow.match(/^\s+NEXT_PUBLIC_SUPABASE_URL:/gm) || []).length, 1);
  assert.equal((workflow.match(/secrets\.NEXT_PUBLIC_SUPABASE_URL/g) || []).length, 1);
  const adapterTestsStep = workflow.match(/- name: Test retailer adapters[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.doesNotMatch(adapterTestsStep, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/);
  const snapshotStep = workflow.match(/- name: Fetch Discount Supplements full snapshot[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.doesNotMatch(snapshotStep, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/);
  const stage1Step = workflow.match(/- name: Classify Discount Supplements and dry-run existing mappings[\s\S]*?(?=\n\s{6}- name:)/)?.[0] || "";
  assert.match(stage1Step, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/);
  assert.equal((stage1Step.match(/^\s+SUPABASE_SERVICE_ROLE_KEY:/gm) || []).length, 1);
  assert.equal((stage1Step.match(/secrets\.SUPABASE_SERVICE_ROLE_KEY/g) || []).length, 1);
  assert.doesNotMatch(stage1Step, /run:[^\n]*(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)/);
  const nonStage1Workflow = workflow.replace(stage1Step, "");
  assert.doesNotMatch(nonStage1Workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /(echo|printf|artifact|path:)[^\n]*SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(orchestrator, /^\s*\.(?:insert|update|upsert|delete|rpc)\(/m);
  assert.doesNotMatch(orchestrator, /console\.log\([^\n]*(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)/);
});

test("workflow regression guard blocks legacy validator and Fit House/KIOR artifact paths in memory", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/retailer-dry-run.yml"), "utf8");
  for (const dependency of [
    "scripts/adapters/validate-scheduled-reports.js",
    "tmp/retailer-feeds/fit-house/fit-house-adapter-report.json",
    "tmp/retailer-feeds/kior/kior-adapter-report.json",
  ]) {
    const mutatedWorkflow = `${workflow}\n# regression fixture: ${dependency}\n`;
    assert.throws(
      () => assertNoLegacyReportDependencies(mutatedWorkflow),
      /legacy Fit House\/KIOR report dependency/
    );
  }
});
