const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { main, normalizeFitHouse, normalizeKior, validateNormalized, validateReports } = require("./validate-scheduled-reports");

function importerOutput(configured) {
  return [
    `approved rows: ${configured}`, "invalid rows: 0", "ambiguous rows: 0",
    "Skipped for review: 0", "Failed: 0", "offers would be created: 0",
    "offers would be updated: 0", `offers unchanged: ${configured}`,
  ].join("\n");
}

function fitReport(overrides = {}) {
  return {
    success: true, configured_products_count: 73, mapped_count: 73,
    unmapped_products_count: 0, unmapped_products: [], missing_configured_products: [],
    price_changes: [], stock_changes: [], handle_changes: [], vendor_mismatches: [],
    invalid_images: [], invalid_urls: [], duplicate_ids: [],
    importer_result: { output: importerOutput(73) }, database_writes: 0,
    generated_csv_sha256: "a".repeat(64), ...overrides,
  };
}

function kiorReport(overrides = {}) {
  return {
    success: true, configured_products: 11, mapped_products: 11, unmapped_products: [],
    csv_enrichment_used: false, missing_configured_products: [], sku_drifts: [], barcode_drifts: [],
    price_changes: [], stock_changes: [], handle_changes: [], vendor_mismatches: [],
    invalid_images: [], invalid_urls: [], database_writes: 0, generated_csv_sha256: "b".repeat(64),
    importer_summary: {
      approved_rows: 11, invalid_rows: 0, ambiguous_rows: 0, skipped_for_review: 0, failed: 0,
      offers_created: 0, offers_updated: 0, offers_unchanged: 11,
    },
    ...overrides,
  };
}

function validate(report, retailer = "kior") {
  const normalized = retailer === "fit" ? normalizeFitHouse(report) : normalizeKior(report);
  return validateNormalized(normalized);
}

test("valid Fit House report passes", () => {
  const result = validate(fitReport(), "fit");
  assert.deepEqual(result, { errors: [], warnings: [] });
});

test("valid JSON-only KIOR report passes", () => {
  const result = validate(kiorReport());
  assert.deepEqual(result, { errors: [], warnings: [] });
});

test("missing report and invalid JSON fail", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-report-test-"));
  const fitPath = path.join(directory, "fit.json");
  const kiorPath = path.join(directory, "kior.json");
  fs.writeFileSync(fitPath, JSON.stringify(fitReport()));
  assert.throws(() => validateReports({ fitHousePath: fitPath, kiorPath }), /KIOR report is missing/);
  fs.writeFileSync(kiorPath, "not-json");
  assert.throws(() => validateReports({ fitHousePath: fitPath, kiorPath }), /not valid JSON/);
});

test("success=false and database writes fail", () => {
  assert.match(validate(kiorReport({ success: false })).errors.join(" "), /success/);
  assert.match(validate(kiorReport({ database_writes: 1 })).errors.join(" "), /database_writes/);
});

test("skipped and failed importer rows fail", () => {
  const skipped = kiorReport(); skipped.importer_summary.skipped_for_review = 1;
  assert.match(validate(skipped).errors.join(" "), /skipped/);
  const failed = kiorReport(); failed.importer_summary.failed = 1;
  assert.match(validate(failed).errors.join(" "), /failed/);
});

test("drifts and missing configured products fail", () => {
  for (const [key, value, pattern] of [
    ["sku_drifts", [{}], /SKU drifts/], ["barcode_drifts", [{}], /barcode drifts/],
    ["handle_changes", [{}], /handle drifts/], ["vendor_mismatches", [{}], /vendor drifts/],
    ["invalid_images", [{}], /invalid images/], ["invalid_urls", [{}], /invalid URLs/],
    ["missing_configured_products", ["1"], /missing configured/],
  ]) assert.match(validate(kiorReport({ [key]: value })).errors.join(" "), pattern);
});

test("price and stock changes are warnings in summary but fail validation", () => {
  const result = validate(kiorReport({ price_changes: [{}], stock_changes: [{}] }));
  assert.match(result.errors.join(" "), /price changes require review/);
  assert.match(result.errors.join(" "), /stock changes require review/);
});

test("unmapped products warn without failure", () => {
  const result = validate(kiorReport({ unmapped_products: [{ product_id: "extra" }] }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ["unmapped products: 1"]);
});

test("incomplete approval and non-JSON-only KIOR fail", () => {
  const incomplete = kiorReport(); incomplete.importer_summary.approved_rows = 10;
  assert.match(validate(incomplete).errors.join(" "), /approved rows/);
  assert.match(validate(kiorReport({ csv_enrichment_used: true })).errors.join(" "), /JSON-only/);
});

test("mapped mismatch, duplicate IDs, and invalid SHA-256 fail", () => {
  assert.match(validate(kiorReport({ mapped_products: 10 })).errors.join(" "), /mapped/);
  assert.match(validate(fitReport({ duplicate_ids: [{}] }), "fit").errors.join(" "), /duplicate IDs/);
  assert.match(validate(kiorReport({ generated_csv_sha256: "invalid" })).errors.join(" "), /SHA-256/);
});

test("combined validation returns a readable workflow summary", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-report-test-"));
  const fitPath = path.join(directory, "fit.json");
  const kiorPath = path.join(directory, "kior.json");
  fs.writeFileSync(fitPath, JSON.stringify(fitReport({ unmapped_products_count: 2 })));
  fs.writeFileSync(kiorPath, JSON.stringify(kiorReport()));
  const result = validateReports({ fitHousePath: fitPath, kiorPath });
  assert.deepEqual(result.errors, []);
  assert.match(result.markdown, /# Retailer Dry Run/);
  assert.match(result.markdown, /## Fit House/);
  assert.match(result.markdown, /## KIOR/);
  assert.match(result.markdown, /CSV SHA-256/);
  assert.match(result.markdown, /unmapped products: 2/);
});

test("fatal read errors are printed as summary diagnostics before failure", () => {
  const messages = [];
  const originalLog = console.log;
  console.log = (message) => messages.push(message);
  try {
    assert.throws(() => main([], () => { throw new Error("KIOR report is missing"); }), /report is missing/);
  } finally {
    console.log = originalLog;
  }
  assert.match(messages.join("\n"), /# Retailer Dry Run/);
  assert.match(messages.join("\n"), /❌ KIOR report is missing/);
});
