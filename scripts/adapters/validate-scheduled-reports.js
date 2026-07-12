const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const FIT_HOUSE_REPORT_PATH = path.join(ROOT, "tmp/retailer-feeds/fit-house/fit-house-adapter-report.json");
const KIOR_REPORT_PATH = path.join(ROOT, "tmp/retailer-feeds/kior/kior-adapter-report.json");

function fail(message) {
  throw new Error(message);
}

function readReport(filePath, retailer) {
  if (!fs.existsSync(filePath)) fail(`${retailer} report is missing: ${filePath}`);
  let report;
  try {
    report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(`${retailer} report is not valid JSON`);
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) fail(`${retailer} report must be a JSON object`);
  return report;
}

function count(items) {
  return Array.isArray(items) ? items.length : 0;
}

function outputCount(output, label) {
  const match = String(output || "").match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "mi"));
  if (!match) fail(`Fit House importer output is missing counter: ${label}`);
  return Number(match[1]);
}

function normalizeFitHouse(report) {
  const output = report.importer_result?.output;
  return {
    retailer: "Fit House",
    success: report.success,
    configured: report.configured_products_count,
    mapped: report.mapped_count,
    unmapped: report.unmapped_products_count ?? count(report.unmapped_products),
    priceChanges: count(report.price_changes),
    stockChanges: count(report.stock_changes),
    missing: count(report.missing_configured_products),
    handleDrifts: count(report.handle_changes),
    vendorDrifts: count(report.vendor_mismatches),
    invalidImages: count(report.invalid_images),
    invalidUrls: count(report.invalid_urls),
    duplicateIds: count(report.duplicate_ids),
    skuDrifts: 0,
    barcodeDrifts: 0,
    approved: outputCount(output, "approved rows"),
    invalid: outputCount(output, "invalid rows"),
    ambiguous: outputCount(output, "ambiguous rows"),
    skipped: outputCount(output, "Skipped for review"),
    failed: outputCount(output, "Failed"),
    offersCreated: outputCount(output, "offers would be created"),
    offersUpdated: outputCount(output, "offers would be updated"),
    offersUnchanged: outputCount(output, "offers unchanged"),
    databaseWrites: report.database_writes,
    sha256: report.generated_csv_sha256,
  };
}

function normalizeKior(report) {
  const summary = report.importer_summary || {};
  return {
    retailer: "KIOR",
    success: report.success,
    configured: report.configured_products,
    mapped: report.mapped_products,
    unmapped: count(report.unmapped_products),
    csvEnrichmentUsed: report.csv_enrichment_used,
    priceChanges: count(report.price_changes),
    stockChanges: count(report.stock_changes),
    missing: count(report.missing_configured_products),
    handleDrifts: count(report.handle_changes),
    vendorDrifts: count(report.vendor_mismatches),
    invalidImages: count(report.invalid_images),
    invalidUrls: count(report.invalid_urls),
    duplicateIds: 0,
    skuDrifts: count(report.sku_drifts),
    barcodeDrifts: count(report.barcode_drifts),
    approved: summary.approved_rows,
    invalid: summary.invalid_rows,
    ambiguous: summary.ambiguous_rows,
    skipped: summary.skipped_for_review,
    failed: summary.failed,
    offersCreated: summary.offers_created,
    offersUpdated: summary.offers_updated,
    offersUnchanged: summary.offers_unchanged,
    databaseWrites: report.database_writes,
    sha256: report.generated_csv_sha256,
  };
}

function validateNormalized(result) {
  const errors = [];
  const warnings = [];
  if (result.success !== true) errors.push("success is not true");
  if (!Number.isInteger(result.configured) || result.configured <= 0) errors.push("configured count is invalid");
  if (result.mapped !== result.configured) errors.push(`mapped ${result.mapped} does not equal configured ${result.configured}`);
  if (result.approved !== result.configured) errors.push(`approved rows ${result.approved} does not equal configured ${result.configured}`);
  if (result.databaseWrites !== 0) errors.push(`database_writes is ${result.databaseWrites}`);
  if (result.skipped !== 0) errors.push(`skipped_for_review is ${result.skipped}`);
  if (result.failed !== 0) errors.push(`failed is ${result.failed}`);
  if (result.invalid !== 0) errors.push(`invalid rows is ${result.invalid}`);
  if (result.ambiguous !== 0) errors.push(`ambiguous rows is ${result.ambiguous}`);
  for (const [label, value] of [
    ["missing configured products", result.missing], ["handle drifts", result.handleDrifts],
    ["vendor drifts", result.vendorDrifts], ["invalid images", result.invalidImages],
    ["invalid URLs", result.invalidUrls], ["duplicate IDs", result.duplicateIds],
    ["SKU drifts", result.skuDrifts], ["barcode drifts", result.barcodeDrifts],
  ]) if (value !== 0) errors.push(`${label}: ${value}`);
  if (result.priceChanges !== 0) errors.push(`price changes require review: ${result.priceChanges}`);
  if (result.stockChanges !== 0) errors.push(`stock changes require review: ${result.stockChanges}`);
  if (result.unmapped !== 0) warnings.push(`unmapped products: ${result.unmapped}`);
  if (!/^[a-f0-9]{64}$/i.test(String(result.sha256 || ""))) errors.push("CSV SHA-256 is missing or invalid");
  if (result.retailer === "KIOR" && result.csvEnrichmentUsed !== false) errors.push("KIOR must run JSON-only in CI");
  return { errors, warnings };
}

function row(label, value) {
  return `| ${label} | ${value} |`;
}

function section(result, validation) {
  const warning = (value) => value ? `⚠️ ${value}` : "0";
  const lines = [
    `## ${result.retailer}`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    row("Configured", result.configured), row("Mapped", result.mapped),
    row("Unmapped", warning(result.unmapped)),
  ];
  if (result.retailer === "KIOR") {
    lines.push(row("CSV enrichment used", result.csvEnrichmentUsed), row("SKU drifts", result.skuDrifts), row("Barcode drifts", result.barcodeDrifts));
  }
  lines.push(
    row("Price changes", warning(result.priceChanges)), row("Stock changes", warning(result.stockChanges)),
    row("Offers created", result.offersCreated), row("Offers updated", result.offersUpdated),
    row("Offers unchanged", result.offersUnchanged), row("Database writes", result.databaseWrites),
    row("CSV SHA-256", `\`${result.sha256}\``), "",
  );
  if (validation.warnings.length) lines.push(`> ⚠️ ${validation.warnings.join("; ")}`, "");
  if (validation.errors.length) lines.push(`> ❌ ${validation.errors.join("; ")}`, "");
  else lines.push("> ✅ Report passed all safety checks.", "");
  return lines.join("\n");
}

function validateReports({ fitHousePath = FIT_HOUSE_REPORT_PATH, kiorPath = KIOR_REPORT_PATH } = {}) {
  const results = [
    normalizeFitHouse(readReport(fitHousePath, "Fit House")),
    normalizeKior(readReport(kiorPath, "KIOR")),
  ];
  const validations = results.map(validateNormalized);
  const markdown = ["# Retailer Dry Run", "", ...results.map((result, index) => section(result, validations[index]))].join("\n");
  const errors = results.flatMap((result, index) => validations[index].errors.map((error) => `${result.retailer}: ${error}`));
  return { results, validations, markdown, errors };
}

function main(argv = process.argv.slice(2), validate = validateReports) {
  if (argv.length !== 0) fail("Report validator does not accept CLI arguments");
  try {
    const result = validate();
    console.log(result.markdown);
    if (result.errors.length) fail(`Retailer report validation failed: ${result.errors.join("; ")}`);
    return result;
  } catch (error) {
    if (!String(error?.message || "").startsWith("Retailer report validation failed:")) {
      console.log(["# Retailer Dry Run", "", "## Validation", "", `> ❌ ${error.message}`, ""].join("\n"));
    }
    throw error;
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { main, normalizeFitHouse, normalizeKior, validateNormalized, validateReports };
