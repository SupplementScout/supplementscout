const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config/retailers/gym-high-woocommerce.json");

function fail(message, code = "SOURCE_MONITOR_BLOCKED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactObject(actual, expected) {
  const actualKeys = Object.keys(actual || {}).sort();
  const expectedKeys = Object.keys(expected || {}).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
    && expectedKeys.every((key) => actual[key] === expected[key]);
}

function loadScope(configPath = CONFIG_PATH) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const manifestPath = path.join(ROOT, config.automation.manifest_path);
  const bytes = fs.readFileSync(manifestPath);
  if (sha256(bytes) !== config.automation.manifest_sha256) fail("Approved source manifest SHA mismatch", "MANIFEST_DRIFT");
  const manifest = JSON.parse(bytes);
  if (
    manifest.approved !== true
    || manifest.retailer?.id !== config.retailer.id
    || manifest.retailer?.slug !== config.retailer.slug
    || manifest.approved_source_count !== 1
    || manifest.rows?.length !== 1
    || manifest.discovery_policy?.production_writes !== false
    || config.guardrails?.production_writes !== false
    || config.guardrails?.catalogue_creates !== false
  ) fail("Approved source manifest identity mismatch", "MANIFEST_DRIFT");
  return { config, manifest, manifestSha256: sha256(bytes) };
}

function evaluateCapture(capture, scope, capturedAt = new Date().toISOString()) {
  const { config, manifest, manifestSha256 } = scope;
  const approved = manifest.rows[0];
  if (capture.external_product_id !== approved.external_product_id) fail("Approved product identity drift", "SOURCE_IDENTITY_DRIFT");
  if (capture.product_name !== approved.expected_product_name) fail("Approved product name drift", "SOURCE_IDENTITY_DRIFT");
  const canonical = new URL(capture.canonical_url);
  if (canonical.protocol !== "https:" || canonical.hostname !== new URL(config.retailer.website).hostname || !canonical.pathname.startsWith("/product/")) {
    fail("Approved product URL drift", "SOURCE_IDENTITY_DRIFT");
  }
  const matches = capture.variations.filter((row) => row.external_variant_id === approved.external_variant_id);
  if (matches.length !== 1) fail("Approved variation is missing or duplicated", "SOURCE_IDENTITY_DRIFT");
  const variation = matches[0];
  if (!exactObject(variation.attributes, approved.expected_attributes) || variation.sku !== approved.expected_sku) {
    fail("Approved variation attributes or SKU drift", "SOURCE_IDENTITY_DRIFT");
  }
  if (variation.active !== true || variation.purchasable !== true) fail("Approved variation is not purchasable", "SOURCE_STATE_BLOCKED");
  return {
    schema_version: 1,
    result: "PASS",
    mode: "READ_ONLY_SOURCE_MONITOR",
    production_writes: 0,
    catalogue_creates: 0,
    captured_at: capturedAt,
    source_captured_at: capture.captured_at,
    retailer: manifest.retailer,
    manifest_sha256: manifestSha256,
    approved: {
      ...approved,
      canonical_url: capture.canonical_url,
      price_gbp: variation.price,
      regular_price_gbp: variation.regular_price,
      in_stock: variation.in_stock,
      source_html_sha256: capture.html_sha256
    },
    discovery_only: capture.variations
      .filter((row) => row.external_variant_id !== approved.external_variant_id)
      .map((row) => ({
        external_product_id: capture.external_product_id,
        external_variant_id: row.external_variant_id,
        attributes: row.attributes,
        price_gbp: row.price,
        in_stock: row.in_stock
      }))
  };
}

function parseArgs(argv) {
  let output = "tmp/gym-high-source-monitor/report.json";
  for (const arg of argv) {
    const match = arg.match(/^--output=(.+)$/);
    if (!match) fail(`Invalid argument ${arg}`, "INVALID_ARGUMENT");
    output = match[1];
  }
  const resolved = path.resolve(ROOT, output);
  const relative = path.relative(path.join(ROOT, "tmp"), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp", "INVALID_ARGUMENT");
  return { output: resolved };
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, filePath);
}

async function main(dependencies = {}) {
  const args = dependencies.args || parseArgs(process.argv.slice(2));
  const scope = dependencies.scope || loadScope();
  const row = scope.manifest.rows[0];
  const read = dependencies.read || readWooCommerceProductPage;
  const capture = await read({
    storeUrl: scope.config.retailer.website,
    productId: row.external_product_id,
    userAgent: "SupplementScout-GYM-HIGH-Monitor/1.0"
  });
  const report = evaluateCapture(capture, scope, dependencies.capturedAt);
  (dependencies.write || writeJsonAtomic)(args.output, report);
  return report;
}

if (require.main === module) {
  main().then((report) => console.log(JSON.stringify(report, null, 2))).catch((error) => {
    console.error(`${error.code || "SOURCE_MONITOR_FAILED"}: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { evaluateCapture, exactObject, loadScope, main, parseArgs, sha256, writeJsonAtomic };
