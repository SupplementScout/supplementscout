const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const {
  CSV_PATH,
  REPORT_PATH,
  atomicWrite,
  buildCanonical,
  fetchJson,
  main,
  normalizeCsvSku,
  normalizeEvidence,
  parseExport,
  runImporter,
  sha256,
  validateCanonicalMappings,
  validateConfig,
} = require("./kior-shopify");

const ROOT = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/kior-shopify.json"), "utf8"));
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");

const approvedConfigEvidence = [
  ["6717613539421", "39821206192221", 439, "kior-health-astragalus-60-caps", "20220001", "0-754590-525916"],
  ["6717636903005", "39821296009309", 438, "kior-health-super-beets-60-caps", "20220012", null],
  ["6717637328989", "39821296992349", 437, "kior-health-clear-mind-60-caps", "20220003", null],
  ["6758522355805", "39962446921821", 435, "kior-health-collagen-probio-60-caps", "20220004", "0-754590-525954"],
  ["6758526025821", "39962452426845", 458, "kior-health-digestive-enzyme", "20220006", null],
  ["6758548078685", "39962495746141", 434, "kior-health-turmeric--ginger-60-caps", "20220013", null],
  ["6766403551325", "39984169058397", 442, "kior-health-ksm-66-ashwaganda-60-caps", "20220009", null],
  ["6825707929693", "40172596068445", 436, "kior-health-brain-wave-60-caps", "20220002", null],
  ["6825718546525", "40172613533789", 441, "kior-health-green-tea-60-caps", "20220007", null],
  ["7067692138589", "40939513741405", 460, "kior-health-collagen-glow", null, null],
  ["7067692531805", "40939514232925", 461, "kior-health-collagen-super", null, null],
];

function productFor(item, overrides = {}) {
  return {
    id: Number(item.shopify_product_id), title: item.canonical_name, handle: item.expected_handle,
    vendor: "KIOR", updated_at: "2026-07-11T12:00:00Z",
    images: [{ src: `https://cdn.test/${item.shopify_product_id}.jpg` }],
    variants: [{
      id: Number(item.shopify_variant_id), product_id: Number(item.shopify_product_id),
      sku: item.expected_sku ?? "", barcode: null, price: item.approved_price.toFixed(2),
      available: item.approved_in_stock, updated_at: "2026-07-11T12:00:00Z",
    }],
    ...overrides,
  };
}

function fixture(options = {}) {
  const products = config.products.map((item) => productFor(item));
  if (options.extra) products.push({ id: 999999, title: "Unmapped", handle: "unmapped", vendor: "KIOR", images: [], variants: [{ id: 888888, sku: "", price: "1.00", available: true }] });
  const exportLines = ["Handle,Variant SKU,Variant Inventory Qty,Variant Barcode,Variant Grams,Body (HTML),Image Src"];
  for (const item of config.products) {
    exportLines.push(`${item.expected_handle},${item.expected_sku ? `'${item.expected_sku}` : ""},99,${item.expected_barcode ?? ""},999,NEVER,https://csv.test/main.jpg`);
    exportLines.push(`${item.expected_handle},,,,,,https://csv.test/extra.jpg`);
  }
  const exportCsv = `${exportLines.join("\n")}\n`;
  return { products, exportCsv, groups: parseExport(exportCsv) };
}

function build({ enrichment = false, configOverride = config, products } = {}) {
  const data = fixture();
  return buildCanonical({
    config: structuredClone(configOverride),
    shopify: { products: products || data.products },
    exportGroups: enrichment ? data.groups : null,
    templateHeader: header,
  });
}

function response(body, status = 200) {
  return { status, headers: { get: () => null }, text: async () => body };
}

function importerOutput(overrides = {}) {
  const counts = {
    "approved rows": 11, "invalid rows": 0, "ambiguous rows": 0,
    "new retailers would be created": 0, "new products would be created": 0,
    "retailer_products would be created": 0, "offers would be created": 0,
    "offers would be updated": 0, "offers unchanged": 11,
    "price_history rows would be created": 0, "Skipped for review": 0, Failed: 0,
    ...overrides,
  };
  return `${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join("\n")}\nDry run: no database writes performed.\n`;
}

function importerStub() {
  return {
    runId: "test-run-id", output: importerOutput(), database_writes: 0,
    summary: {
      approved_rows: 11, invalid_rows: 0, ambiguous_rows: 0, new_retailers: 0,
      new_products: 0, retailer_products_created: 0, offers_created: 0,
      offers_updated: 0, offers_unchanged: 11, price_history_created: 0,
      skipped_for_review: 0, failed: 0,
    },
  };
}

function importerSpawn({ runId = "current", report = true, reportBody, output = importerOutput(), status = 0 } = {}) {
  return (_command, _args, options) => {
    if (report) {
      fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
      fs.writeFileSync(
        options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH,
        reportBody ?? JSON.stringify({
          runId: runId === "current" ? options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID : runId,
          rowLevelOffers: config.products.map((item, index) => ({ rowNumber: index + 2, slug: item.canonical_slug, offerAction: "unchanged" })),
        }),
      );
    }
    return { status, stdout: output, stderr: "" };
  };
}

test("config preserves explicit approved SKU/barcode evidence", () => {
  assert.equal(config.products.length, 11);
  assert.deepEqual(config.products.map((item) => [item.shopify_product_id, item.shopify_variant_id, item.canonical_product_id, item.canonical_slug, item.expected_sku, item.expected_barcode]), approvedConfigEvidence);
  assert.equal(new Set(config.products.map((item) => item.shopify_product_id)).size, 11);
  assert.equal(new Set(config.products.map((item) => item.shopify_variant_id)).size, 11);
  assert.equal(config.products.filter((item) => typeof item.expected_sku === "string").length, 9);
  assert.equal(config.products.filter((item) => item.expected_sku === null).length, 2);
  assert.equal(config.products.filter((item) => typeof item.expected_barcode === "string").length, 2);
  assert.equal(config.products.filter((item) => item.expected_barcode === null).length, 9);
  assert.doesNotThrow(() => validateConfig(config));
});

test("config requires both evidence fields as non-empty strings or null", () => {
  for (const key of ["expected_sku", "expected_barcode"]) {
    const missing = structuredClone(config); delete missing.products[0][key];
    assert.throws(() => validateConfig(missing), new RegExp(`Missing config field ${key}`));
    const empty = structuredClone(config); empty.products[0][key] = " ";
    assert.throws(() => validateConfig(empty), new RegExp(`Invalid config field ${key}`));
    const invalid = structuredClone(config); invalid.products[0][key] = 123;
    assert.throws(() => validateConfig(invalid), new RegExp(`Invalid config field ${key}`));
  }
});

test("normalization is conservative", () => {
  assert.equal(normalizeEvidence(undefined), null);
  assert.equal(normalizeEvidence("  Ab-01  "), "Ab-01");
  assert.equal(normalizeCsvSku(" '001-Ab "), "001-Ab");
  assert.equal(normalizeCsvSku(""), null);
});

test("JSON-only generates 11 rows and only two approved external GTINs", () => {
  const result = build();
  assert.equal(result.rows.length, 11);
  assert.deepEqual(result.rows.filter((row) => row.external_gtin).map((row) => row.external_gtin), ["0-754590-525916", "0-754590-525954"]);
  assert.equal(result.rows.filter((row) => row.external_gtin === "").length, 9);
  for (const forbidden of ["expected_sku", "expected_barcode", "Variant Grams", "Body (HTML)", "Inventory Qty", "verified_metrics"]) assert.equal(result.csv.includes(forbidden), false);
});

test("JSON SKU drift rules block mismatches and preserve approved null", () => {
  assert.doesNotThrow(() => build());
  for (const sku of ["DIFFERENT", ""]) {
    const data = fixture(); data.products[0].variants[0].sku = sku;
    assert.throws(() => build({ products: data.products }), /SKU drifts/);
  }
  const data = fixture(); data.products.at(-1).variants[0].sku = "NEW-SKU";
  assert.throws(() => build({ products: data.products }), /SKU drifts/);
});

test("public barcode passes only when absent or equal to approved evidence", () => {
  const matching = fixture(); matching.products[0].variants[0].barcode = config.products[0].expected_barcode;
  assert.doesNotThrow(() => build({ products: matching.products }));
  const mismatch = fixture(); mismatch.products[0].variants[0].barcode = "DIFFERENT";
  assert.throws(() => build({ products: mismatch.products }), /barcode drifts/);
  const unexpected = fixture(); unexpected.products[1].variants[0].barcode = "UNEXPECTED";
  assert.throws(() => build({ products: unexpected.products }), /barcode drifts/);
});

test("matching optional CSV enriches without changing canonical output", () => {
  const jsonOnly = build();
  const enriched = build({ enrichment: true });
  assert.equal(enriched.csv, jsonOnly.csv);
  assert.equal(sha256(enriched.csv), sha256(jsonOnly.csv));
});

test("CSV drift blocks and CSV barcode never overrides config", () => {
  const data = fixture();
  data.groups.get(config.products[0].expected_handle)[0]["Variant SKU"] = "OTHER";
  assert.throws(() => buildCanonical({ config, shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header }), /SKU drifts/);
  const barcode = fixture();
  barcode.groups.get(config.products[0].expected_handle)[0]["Variant Barcode"] = "OTHER";
  assert.throws(() => buildCanonical({ config, shopify: { products: barcode.products }, exportGroups: barcode.groups, templateHeader: header }), /barcode drifts/);
  const extra = fixture();
  extra.groups.get(config.products[1].expected_handle)[0]["Variant Barcode"] = "CSV-ONLY";
  assert.throws(() => buildCanonical({ config, shopify: { products: extra.products }, exportGroups: extra.groups, templateHeader: header }), /barcode drifts/);
});

test("CSV requires one main row and ignores image-only rows", () => {
  assert.doesNotThrow(() => build({ enrichment: true }));
  const data = fixture();
  data.groups.get(config.products[0].expected_handle).push({ Handle: config.products[0].expected_handle, "Variant SKU": config.products[0].expected_sku });
  assert.throws(() => buildCanonical({ config, shopify: { products: data.products }, exportGroups: data.groups, templateHeader: header }), /Ambiguous Shopify CSV join/);
});

test("product, variant, handle, vendor, image and URL guardrails remain blocking", () => {
  const missing = fixture(); missing.products.pop();
  assert.throws(() => build({ products: missing.products }), /Missing configured/);
  const variant = fixture(); variant.products[0].variants[0].id = 1;
  assert.throws(() => build({ products: variant.products }), /Configured variant/);
  const handle = fixture(); handle.products[0].handle = "changed";
  assert.throws(() => build({ products: handle.products }), /handle changes/);
  const vendor = fixture(); vendor.products[0].vendor = "Other";
  assert.throws(() => build({ products: vendor.products }), /vendor mismatches/);
  const image = fixture(); image.products[0].images[0].src = "http://invalid";
  assert.throws(() => build({ products: image.products }), /Invalid Shopify images/);
});

test("fetch rejects bad responses and enforces timeout", async () => {
  await assert.rejects(fetchJson("x", { timeoutMs: 50, maxBytes: 1000, fetchImpl: async () => response("x", 503) }), /HTTP 503/);
  await assert.rejects(fetchJson("x", { timeoutMs: 50, maxBytes: 1000, fetchImpl: async () => response("{") }), /not valid JSON/);
  await assert.rejects(fetchJson("x", { timeoutMs: 5, maxBytes: 1000, fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")))) }), /aborted/);
});

test("canonical mapping validation performs read-only ID/slug checks", async () => {
  const calls = [];
  const client = { from(table) { calls.push(["from", table]); return this; }, select(value) { calls.push(["select", value]); return this; }, in(key, ids) { calls.push(["in", key, ids]); return Promise.resolve({ data: config.products.map((item) => ({ id: item.canonical_product_id, slug: item.canonical_slug })), error: null }); } };
  await validateCanonicalMappings(config, client);
  assert.equal(calls.some((call) => ["insert", "update", "upsert", "delete"].includes(call[0])), false);
});

test("importer command is fixed dry-run without safe-create or apply", () => {
  let captured;
  runImporter("C:\\tmp\\generated.csv", (command, args, options) => {
    captured = { command, args, options };
    return importerSpawn() (command, args, options);
  });
  assert.equal(captured.command, process.execPath);
  assert.deepEqual(captured.args.slice(1), ["--mode=feed", "--dry-run", "--csv=C:\\tmp\\generated.csv"]);
  assert.equal(captured.args.includes("--safe-create"), false);
  assert.equal(captured.args.some((arg) => /apply/i.test(arg)), false);
});

test("importer requires a fresh valid machine report", () => {
  assert.throws(() => runImporter("x.csv", importerSpawn({ report: false })), /did not create/);
  assert.throws(() => runImporter("x.csv", importerSpawn({ reportBody: "not-json" })), /empty or invalid/);
  assert.throws(() => runImporter("x.csv", importerSpawn({ runId: "old" })), /stale/);
});

test("importer blocks unsafe summary counters", () => {
  assert.throws(() => runImporter("x.csv", importerSpawn({ output: importerOutput({ "approved rows": 10 }) })), /approved row count/);
  assert.throws(() => runImporter("x.csv", importerSpawn({ output: importerOutput({ "Skipped for review": 1 }) })), /skipped rows/);
  assert.throws(() => runImporter("x.csv", importerSpawn({ output: importerOutput({ Failed: 1 }) })), /failed rows/);
  assert.throws(() => runImporter("x.csv", importerSpawn({ status: 1 })), /dry-run failed/);
});

test("main rejects CLI args before fetching", async () => {
  let fetched = false;
  await assert.rejects(main({ argv: ["--dry-run"], fetchImpl: async () => { fetched = true; } }), /does not accept CLI arguments/);
  assert.equal(fetched, false);
});

test("main supports JSON-only and reports enrichment only when the CSV exists", async () => {
  const data = fixture();
  const body = JSON.stringify({ products: data.products });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kior-enrichment-test-"));
  const absent = path.join(directory, "absent.csv");
  const present = path.join(directory, "enrichment.csv");
  const jsonOnlyCsv = path.join(directory, "json-only-output.csv");
  const jsonOnlyReport = path.join(directory, "json-only-report.json");
  const enrichedCsv = path.join(directory, "enriched-output.csv");
  const enrichedReport = path.join(directory, "enriched-report.json");
  const absentInjected = absent.split(path.sep).join("/");
  const presentInjected = present.split(path.sep).join("/");
  try {
    assert.equal(fs.existsSync(absentInjected), false);
    const jsonOnly = await main({ argv: [], exportPath: absentInjected, csvPath: jsonOnlyCsv, reportPath: jsonOnlyReport, fetchImpl: async () => response(body), validateCanonical: async () => {}, runImporter: importerStub });
    assert.equal(jsonOnly.report.csv_enrichment_used, false);
    assert.equal(Object.hasOwn(jsonOnly.report, "csv_enrichment_path"), false);
    assert.equal(jsonOnly.report.success, true);

    fs.writeFileSync(present, data.exportCsv, "utf8");
    assert.equal(fs.existsSync(presentInjected), true);
    const enriched = await main({ argv: [], exportPath: presentInjected, csvPath: enrichedCsv, reportPath: enrichedReport, fetchImpl: async () => response(body), validateCanonical: async () => {}, runImporter: importerStub });
    assert.equal(enriched.report.csv_enrichment_used, true);
    assert.equal(enriched.report.csv_enrichment_path, presentInjected);
    assert.equal(enriched.csv, jsonOnly.csv);
    assert.equal(fs.readFileSync(enrichedCsv, "utf8"), fs.readFileSync(jsonOnlyCsv, "utf8"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("adapter report is written only after importer success", async () => {
  const body = JSON.stringify({ products: fixture().products });
  await assert.rejects(main({ argv: [], exportPath: path.join(os.tmpdir(), "absent-kior.csv"), fetchImpl: async () => response(body), validateCanonical: async () => {}, runImporter: () => { throw new Error("importer failed"); } }), /importer failed/);
  assert.equal(fs.existsSync(REPORT_PATH), false);
  await main({ argv: [], exportPath: path.join(os.tmpdir(), "absent-kior.csv"), fetchImpl: async () => response(body), validateCanonical: async () => {}, runImporter: importerStub });
  assert.equal(JSON.parse(fs.readFileSync(REPORT_PATH, "utf8")).success, true);
});

test("main blocks any non-zero database_writes claim", async () => {
  const body = JSON.stringify({ products: fixture().products });
  await assert.rejects(main({
    argv: [], exportPath: path.join(os.tmpdir(), "absent-kior.csv"),
    fetchImpl: async () => response(body), validateCanonical: async () => {},
    runImporter: () => ({ ...importerStub(), database_writes: 1 }),
  }), /database_writes must be zero/);
  assert.equal(fs.existsSync(REPORT_PATH), false);
});

test("atomic output replaces complete files and leaves no temporary files", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kior-atomic-"));
  const target = path.join(directory, "output.csv");
  atomicWrite(target, "old");
  assert.throws(() => atomicWrite(target, Symbol("invalid")), TypeError);
  assert.equal(fs.readFileSync(target, "utf8"), "old");
  atomicWrite(target, "complete");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
});

test("generated CSV parses to 11 rows without forbidden product data", () => {
  const rows = parse(build().csv, { columns: true, skip_empty_lines: true });
  assert.equal(rows.length, 11);
  for (const forbidden of ["canonical_product_id", "gtin", "net_weight_g", "nutrition_verified", "expected_sku", "expected_barcode"]) assert.equal(Object.hasOwn(rows[0], forbidden), false);
});

test.after(() => {
  for (const target of [CSV_PATH, REPORT_PATH]) fs.rmSync(target, { force: true });
});
