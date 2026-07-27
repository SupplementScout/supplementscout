const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("csv-parse/sync");
const { sha256 } = require("./lib/woocommerce-product-page-reader");
const { serializeCsv } = require("./six-pack-canary-builder");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements");
const DEFAULT_CSV = path.join(OUTPUT_DIR, "six-pack-canary-10.csv");
const DEFAULT_MANIFEST = path.join(OUTPUT_DIR, "six-pack-canary-10-manifest.json");
const DEFAULT_REPORT = path.join(OUTPUT_DIR, "six-pack-canary-10-import-report.json");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  const allowed = new Set(["csv", "manifest", "import-report", "output-dir"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || !allowed.has(match[1]) || result[match[1]] !== undefined) fail(`Invalid argument ${argument}`);
    result[match[1]] = match[2];
  }
  result.csv = result.csv ? path.resolve(result.csv) : DEFAULT_CSV;
  result.manifest = result.manifest ? path.resolve(result.manifest) : DEFAULT_MANIFEST;
  result.importReport = result["import-report"] ? path.resolve(result["import-report"]) : DEFAULT_REPORT;
  result.outputDir = result["output-dir"] ? path.resolve(result["output-dir"]) : OUTPUT_DIR;
  const relative = path.relative(path.join(ROOT, "tmp"), result.outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output directory must be inside repository tmp");
  return result;
}

function selectDryRunApprovedRows(csvText, importReport) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: false,
  });
  if (!Array.isArray(importReport.rowLevelOffers)) fail("Import report is missing rowLevelOffers");
  if ((importReport.successfulRows || []).length || (importReport.failedRows || []).length) {
    fail("Import report contains applied rows and is not a dry-run-only review");
  }
  const rowNumbers = importReport.rowLevelOffers.map((row) => Number(row.rowNumber));
  if (new Set(rowNumbers).size !== rowNumbers.length || rowNumbers.some((row) => !Number.isInteger(row) || row < 2)) {
    fail("Import report contains invalid or duplicate approved row numbers");
  }
  const selected = rowNumbers.map((rowNumber) => {
    const row = records[rowNumber - 2];
    if (!row) fail(`Approved row ${rowNumber} does not exist in source CSV`);
    if (!row.product_id || !row.product_variant_id || !row.external_product_id || !row.external_variant_id) {
      fail(`Approved row ${rowNumber} is missing an explicit identity binding`);
    }
    return row;
  });
  if (selected.length < 5 || selected.length > 20) fail(`Final canary must contain 5..20 approved rows; received ${selected.length}`);
  return { header: Object.keys(records[0] || {}), rowNumbers, selected };
}

function run(options) {
  for (const file of [options.csv, options.manifest, options.importReport]) {
    if (!fs.existsSync(file)) fail(`Required input missing: ${file}`);
  }
  const csvText = fs.readFileSync(options.csv, "utf8");
  const parentManifest = JSON.parse(fs.readFileSync(options.manifest, "utf8"));
  const importReportText = fs.readFileSync(options.importReport, "utf8");
  const importReport = JSON.parse(importReportText);
  if (
    parentManifest.approved !== false ||
    parentManifest.csv_sha256 !== sha256(csvText) ||
    parentManifest.row_count < 5 ||
    parentManifest.database_writes > 0
  ) fail("Parent canary manifest is not a valid unapproved dry-run artifact");

  const selection = selectDryRunApprovedRows(csvText, importReport);
  const finalCsv = serializeCsv(selection.header, selection.selected);
  const manifest = {
    schema_version: 1,
    kind: "six-pack-production-canary-importer-approved-subset",
    approved: false,
    target_environment: parentManifest.target_environment,
    target_project_ref: parentManifest.target_project_ref,
    source_snapshot_fingerprint: parentManifest.source_snapshot_fingerprint,
    parent_manifest_fingerprint: parentManifest.manifest_fingerprint,
    parent_csv_sha256: parentManifest.csv_sha256,
    importer_review_sha256: sha256(importReportText),
    importer_run_id: importReport.runId || null,
    source_row_numbers: selection.rowNumbers,
    blocked_source_rows: (importReport.blockedRows || []).map((row) => ({
      row_number: row.rowNumber,
      reasons: row.reasons || [],
    })),
    csv_sha256: sha256(finalCsv),
    row_count: selection.selected.length,
    database_writes: 0,
    rows: selection.selected.map((row) => ({
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      product_id: row.product_id,
      product_variant_id: row.product_variant_id,
      price: row.price,
      in_stock: row.in_stock,
      external_url: row.external_url,
    })),
    manifest_fingerprint: null,
  };
  manifest.manifest_fingerprint = sha256(JSON.stringify(manifest));
  fs.mkdirSync(options.outputDir, { recursive: true });
  const csvPath = path.join(options.outputDir, `six-pack-canary-approved-${selection.selected.length}.csv`);
  const manifestPath = path.join(options.outputDir, `six-pack-canary-approved-${selection.selected.length}-manifest.json`);
  fs.writeFileSync(csvPath, finalCsv);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { csvPath, manifestPath, manifest };
}

function main(argv = process.argv.slice(2)) {
  const result = run(parseArgs(argv));
  console.log(JSON.stringify({
    result: "PASS",
    database_writes: 0,
    approved: false,
    row_count: result.manifest.row_count,
    csv_sha256: result.manifest.csv_sha256,
    outputs: [result.csvPath, result.manifestPath].map((file) => path.relative(ROOT, file)),
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  run,
  selectDryRunApprovedRows,
};
