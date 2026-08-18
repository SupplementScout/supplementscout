const crypto = require("node:crypto");
const { readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const { readWooCommerceStoreCatalogue } = require("./lib/woocommerce-store-api-reader");
const { loadScope, parseArgs, writeJsonAtomic } = require("./gym-high-source-monitor");
const { canonicalJson } = require("./lib/canonical-json");

function fail(message, code = "CATALOGUE_AUDIT_BLOCKED") { const error = new Error(message); error.code = code; throw error; }

function classification(product) {
  if (/gift\s*cards?/i.test(product.name)) return "EXCLUDE_GIFT_CARD";
  if (product.categories.some((category) => /accessories|clothing/i.test(category))) return "REVIEW_ACCESSORY";
  return "REVIEW_SUPPLEMENT";
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function next() { while (cursor < values.length) { const index = cursor++; results[index] = await worker(values[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, next));
  return results;
}

function exactIds(left, right) { return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]); }

async function buildCatalogueAudit(scope, dependencies = {}) {
  const readCatalogue = dependencies.readCatalogue || readWooCommerceStoreCatalogue;
  const readPage = dependencies.readPage || readWooCommerceProductPage;
  const catalogue = await readCatalogue({ storeUrl: scope.config.retailer.website, maximumPages: scope.config.source.maximum_pages, maximumProducts: scope.config.source.maximum_products });
  if (catalogue.products.length < scope.config.source.minimum_parent_products) fail("Catalogue collapsed below the approved minimum", "SOURCE_COVERAGE_MISMATCH");
  const captures = await mapLimit(catalogue.products, 4, (product) => readPage({ storeUrl: scope.config.retailer.website, productId: product.external_product_id, userAgent: "SupplementScout-GYM-HIGH-Catalogue/1.0" }));
  const rows = [];
  for (let index = 0; index < catalogue.products.length; index += 1) {
    const product = catalogue.products[index];
    const capture = captures[index];
    if (capture.external_product_id !== product.external_product_id || capture.product_name !== product.name || new URL(capture.canonical_url).href !== product.permalink) fail(`Product ${product.external_product_id} page identity drift`, "SOURCE_IDENTITY_DRIFT");
    const declared = product.variations.map((row) => row.external_variant_id);
    const observed = capture.variations.map((row) => row.external_variant_id);
    if (product.type === "variable" && !exactIds(declared, observed)) fail(`Product ${product.external_product_id} variation coverage drift`, "SOURCE_COVERAGE_MISMATCH");
    const category = classification(product);
    if (product.type === "simple") {
      if (!capture.product_offer) fail(`Simple product ${product.external_product_id} has no exact live offer`, "SOURCE_SCHEMA_MISMATCH");
      rows.push({ external_product_id: product.external_product_id, external_variant_id: product.external_product_id, name: product.name, type: product.type, attributes: {}, price_gbp: capture.product_offer.price, in_stock: capture.product_offer.in_stock, canonical_url: capture.canonical_url, classification: category });
    } else {
      for (const variation of capture.variations) rows.push({ external_product_id: product.external_product_id, external_variant_id: variation.external_variant_id, name: product.name, type: product.type, attributes: variation.attributes, sku: variation.sku, price_gbp: variation.price, in_stock: variation.in_stock, canonical_url: capture.canonical_url, classification: category });
    }
  }
  const approved = scope.manifest.rows[0];
  for (const row of rows) if (row.external_product_id === approved.external_product_id && row.external_variant_id === approved.external_variant_id) row.classification = "APPROVED_EXISTING_MAPPING";
  const counts = Object.fromEntries([...new Set(rows.map((row) => row.classification))].sort().map((key) => [key, rows.filter((row) => row.classification === key).length]));
  const identityRows = rows
    .map((row) => { const identity = { ...row }; delete identity.price_gbp; delete identity.in_stock; return identity; })
    .sort((left, right) => Number(right.external_product_id) - Number(left.external_product_id));
  const sourceIdentityFingerprint = crypto.createHash("sha256").update(canonicalJson(identityRows)).digest("hex");
  return { schema_version: 1, result: "PASS", mode: "FULL_CATALOGUE_READ_ONLY_AUDIT", production_writes: 0, catalogue_creates: 0, captured_at: catalogue.captured_at, parent_product_count: catalogue.products.length, source_row_count: rows.length, source_identity_fingerprint: sourceIdentityFingerprint, classification_counts: counts, rows };
}

async function main(dependencies = {}) {
  const scope = dependencies.scope || loadScope();
  const args = dependencies.args || parseArgs(process.argv.slice(2));
  const report = await buildCatalogueAudit(scope, dependencies);
  (dependencies.write || writeJsonAtomic)(args.output, report);
  return report;
}

if (require.main === module) main().then((report) => console.log(JSON.stringify({ result: report.result, parent_product_count: report.parent_product_count, source_row_count: report.source_row_count, source_identity_fingerprint: report.source_identity_fingerprint, classification_counts: report.classification_counts, production_writes: report.production_writes }, null, 2))).catch((error) => { console.error(`${error.code || "CATALOGUE_AUDIT_FAILED"}: ${error.message}`); process.exitCode = 1; });

module.exports = { buildCatalogueAudit, classification, exactIds, main, mapLimit };
