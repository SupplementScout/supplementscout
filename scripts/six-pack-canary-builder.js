const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { readWooCommerceProductPage, sha256 } = require("./lib/woocommerce-product-page-reader");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");
const { TARGETS } = require("./six-pack-match-report");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "tmp", "retailer-feeds", "six-pack-supplements");
const DEFAULT_MATCH_REPORT = path.join(OUTPUT_DIR, "six-pack-match-report.json");
const DEFAULT_SOURCE = path.join(OUTPUT_DIR, "six-pack-source-snapshot.json");
const TEMPLATE = path.join(ROOT, "data", "templates", "retailer-feed-template.csv");
const EXTRA_COLUMNS = Object.freeze(["external_sku", "external_options", "product_id", "product_variant_id"]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || result[match[1]] !== undefined || !["target", "limit", "match-report", "source", "output-dir", "exclude-existing", "include-out-of-stock"].includes(match[1])) {
      fail(`Invalid argument ${argument}`);
    }
    result[match[1]] = match[2];
  }
  if (!TARGETS[result.target]) fail("Required --target=staging|production");
  result.limit = Number(result.limit || 10);
  if (!Number.isInteger(result.limit) || result.limit < 5 || result.limit > 20) fail("Canary limit must be 5..20");
  result.matchReport = result["match-report"] ? path.resolve(result["match-report"]) : DEFAULT_MATCH_REPORT;
  result.source = result.source ? path.resolve(result.source) : DEFAULT_SOURCE;
  result.outputDir = result["output-dir"] ? path.resolve(result["output-dir"]) : OUTPUT_DIR;
  result.excludeExisting = result["exclude-existing"] === "true";
  if (result["exclude-existing"] !== undefined && !["true", "false"].includes(result["exclude-existing"])) {
    fail("--exclude-existing must be true|false");
  }
  result.includeOutOfStock = result["include-out-of-stock"] === "true";
  if (result["include-out-of-stock"] !== undefined && !["true", "false"].includes(result["include-out-of-stock"])) {
    fail("--include-out-of-stock must be true|false");
  }
  const relative = path.relative(path.join(ROOT, "tmp"), result.outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output directory must be inside repository tmp");
  return result;
}

async function mappedExternalVariantIds(client) {
  const retailerResult = await client.from("retailers").select("id").eq("slug", config.retailer.slug).limit(2);
  if (retailerResult.error) throw retailerResult.error;
  if (retailerResult.data.length > 1) fail("Duplicate 6 Pack retailer identity");
  if (retailerResult.data.length === 0) return new Set();
  const mappingResult = await client
    .from("retailer_products")
    .select("external_variant_id")
    .eq("retailer_id", retailerResult.data[0].id);
  if (mappingResult.error) throw mappingResult.error;
  return new Set(mappingResult.data.map((row) => String(row.external_variant_id)));
}

function loadClient(target) {
  dotenv.config({ path: path.join(ROOT, target === "production" ? ".env.local" : ".env.staging.audit.local"), quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail(`Missing ${target} read credentials`);
  const ref = new URL(url).hostname.split(".")[0];
  if (ref !== TARGETS[target]) fail(`Supabase target mismatch: expected ${TARGETS[target]}, received ${ref}`);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function orderedCandidates(rows, { includeOutOfStock = false } = {}) {
  const safe = rows.filter((row) =>
    row.status === "SAFE_EXISTING_VARIANT" && (includeOutOfStock || row.source_in_stock)
  );
  const simple = safe.filter((row) => row.source_type === "simple");
  const variations = safe.filter((row) => row.source_type === "variation");
  const firstByParent = [];
  const remainder = [];
  const seen = new Set();
  for (const row of variations) {
    if (!seen.has(row.external_product_id)) {
      seen.add(row.external_product_id);
      firstByParent.push(row);
    } else {
      remainder.push(row);
    }
  }
  const numeric = (left, right) => Number(left.external_variant_id) - Number(right.external_variant_id);
  return [...simple.sort(numeric), ...firstByParent.sort(numeric), ...remainder.sort(numeric)];
}

async function exactRows(client, table, ids, columns) {
  if (!ids.length) return [];
  const { data, error } = await client.from(table).select(columns).in("id", ids);
  if (error) throw error;
  return data || [];
}

function csvCell(value) {
  const string = value == null ? "" : String(value);
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function serializeCsv(header, rows) {
  return `${[header, ...rows.map((row) => header.map((key) => row[key] ?? ""))]
    .map((line) => line.map(csvCell).join(","))
    .join("\n")}\n`;
}

function currentOffer(source, live) {
  if (source.source_type === "simple") {
    if (!live.product_offer) fail(`Live simple offer missing for ${source.external_product_id}`);
    return {
      price: live.product_offer.price,
      in_stock: live.product_offer.in_stock,
      is_for_sale: true,
      active: true,
      image_url: source.image_url,
    };
  }
  const variation = live.variations.find((row) => row.external_variant_id === source.external_variant_id);
  if (!variation) fail(`Live variation ${source.external_variant_id} missing from product ${source.external_product_id}`);
  return {
    price: variation.price,
    in_stock: variation.in_stock,
    is_for_sale: variation.active && variation.purchasable,
    active: variation.active,
    image_url: variation.image_url || source.image_url,
  };
}

function commercialIdentityTokens(value) {
  const tokens = [];
  const pattern = /(\d+(?:[.,]\d+)?)\s*(mcg|µg|mg|kg|g|ml|l|iu|capsules?|caps?|tablets?|tabs?)\b/gi;
  for (const match of String(value || "").matchAll(pattern)) {
    let unit = match[2].toLowerCase();
    if (/^caps?/.test(unit)) unit = "capsule";
    if (/^(tablets?|tabs?)$/.test(unit)) unit = "tablet";
    tokens.push(`${match[1].replace(",", ".")}${unit}`);
  }
  return [...new Set(tokens)].sort();
}

function liveIdentityDrift(source, live) {
  const sourceTokens = commercialIdentityTokens(source.product_name);
  const liveTokens = commercialIdentityTokens(live.product_name);
  if (
    !sourceTokens.length ||
    !liveTokens.length ||
    sourceTokens.every((token) => liveTokens.includes(token))
  ) {
    return null;
  }
  return {
    source_record_id: source.source_record_id,
    code: "CSV_LIVE_IDENTITY_DRIFT",
    csv_product_name: source.product_name,
    live_product_name: live.product_name,
    csv_identity_tokens: sourceTokens,
    live_identity_tokens: liveTokens,
  };
}

function canonicalFeedRow(source, product, variant, live, observedAt) {
  const offer = currentOffer(source, live);
  const shippingCost = Number(offer.price) < Number(config.shipping_policy.free_shipping_threshold)
    ? Number(config.shipping_policy.below_threshold).toFixed(2)
    : Number(config.shipping_policy.at_or_above_threshold).toFixed(2);
  return {
    retailer_name: config.retailer.name,
    retailer_website: config.retailer.website,
    external_product_id: source.external_product_id,
    external_variant_id: source.external_variant_id,
    product_name: product.name,
    variant_name: variant.display_name,
    brand: product.brand,
    category: product.category,
    description: "",
    image: offer.image_url || "",
    slug: product.slug,
    external_url: live.canonical_url,
    affiliate_url: live.canonical_url,
    external_gtin: source.external_gtin || "",
    price: offer.price,
    shipping_known: "true",
    shipping_cost: shippingCost,
    in_stock: String(offer.in_stock),
    is_for_sale: String(offer.is_for_sale),
    size: variant.size_value ?? "",
    size_unit: variant.size_unit ?? "",
    flavour: variant.flavour_label || variant.flavour_code || "",
    product_format: variant.product_format || product.product_format || "",
    pack_count: variant.pack_count ?? 1,
    source_updated_at: observedAt,
    external_sku: source.external_sku || "",
    external_options: JSON.stringify(source.external_options || {}),
    product_id: String(product.id),
    product_variant_id: variant.id == null ? "" : String(variant.id),
  };
}

async function run(options, dependencies = {}) {
  for (const file of [options.matchReport, options.source, TEMPLATE]) if (!fs.existsSync(file)) fail(`Required input missing: ${file}`);
  const matchReport = JSON.parse(fs.readFileSync(options.matchReport, "utf8"));
  const sourceSnapshot = JSON.parse(fs.readFileSync(options.source, "utf8"));
  if (
    !["READ_ONLY_MATCH_ONLY", "READ_ONLY_EXPANSION_MATCH_ONLY"].includes(matchReport.mode) ||
    matchReport.database_writes !== 0 ||
    matchReport.target_project_ref !== TARGETS[options.target] ||
    matchReport.source_snapshot_fingerprint !== sourceSnapshot.snapshot_fingerprint
  ) fail("Match report is not a valid bound read-only artifact");
  let candidates = orderedCandidates(matchReport.rows, { includeOutOfStock: options.includeOutOfStock });
  const client = dependencies.client || loadClient(options.target);
  if (options.excludeExisting) {
    const existing = dependencies.existingExternalVariantIds
      ? new Set(dependencies.existingExternalVariantIds.map(String))
      : await mappedExternalVariantIds(client);
    candidates = candidates.filter((row) => !existing.has(String(row.external_variant_id)));
  }
  if (candidates.length < options.limit) fail(`Only ${candidates.length} in-stock safe candidates for ${options.limit}-row canary`);
  const productIds = [...new Set(candidates.map((row) => row.canonical_product_id))];
  const variantIds = [...new Set(candidates.map((row) => row.canonical_variant_id))];
  const [products, variants] = await Promise.all([
    dependencies.products || exactRows(client, "products", productIds, "id,name,slug,brand,category,product_format,is_active,merged_into_product_id"),
    dependencies.variants || exactRows(client, "product_variants", variantIds, "id,product_id,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,is_active,is_default"),
  ]);
  const productById = new Map(products.map((row) => [String(row.id), row]));
  const variantById = new Map(variants.map((row) => [String(row.id), row]));
  const sourceById = new Map(sourceSnapshot.records.map((row) => [String(row.source_record_id), row]));
  const readLive = dependencies.readLive || ((productId) => readWooCommerceProductPage({
    storeUrl: config.retailer.website,
    productId,
  }));
  const liveByProduct = new Map();
  const selected = [];
  const drift = [];
  for (const candidate of candidates) {
    if (selected.length >= options.limit) break;
    const source = sourceById.get(candidate.source_record_id);
    const product = productById.get(candidate.canonical_product_id);
    const variant = variantById.get(candidate.canonical_variant_id);
    if (
      !source || !product || !variant ||
      product.is_active === false || product.merged_into_product_id != null ||
      variant.is_active === false || String(variant.product_id) !== String(product.id)
    ) fail(`Canonical identity drift for source ${candidate.source_record_id}`);
    let live = liveByProduct.get(source.external_product_id);
    if (!live) {
      live = await readLive(source.external_product_id);
      liveByProduct.set(source.external_product_id, live);
    }
    const identityDrift = liveIdentityDrift(source, live);
    if (identityDrift) {
      drift.push(identityDrift);
      continue;
    }
    const offer = currentOffer(source, live);
    const safeAvailable = offer.in_stock && offer.is_for_sale;
    const safeOutOfStock = options.includeOutOfStock && !offer.in_stock && offer.active;
    if (!safeAvailable && !safeOutOfStock) {
      drift.push({ source_record_id: source.source_record_id, code: "LIVE_NOT_FOR_SALE", csv_in_stock: source.in_stock, live_in_stock: offer.in_stock });
      continue;
    }
    if (offer.price !== source.price || offer.in_stock !== source.in_stock) {
      drift.push({ source_record_id: source.source_record_id, code: "CSV_LIVE_COMMERCE_DRIFT", csv_price: source.price, live_price: offer.price, csv_in_stock: source.in_stock, live_in_stock: offer.in_stock });
    }
    selected.push({ candidate, source, product, variant, live, offer });
  }
  if (selected.length !== options.limit) fail(`Live source produced only ${selected.length}/${options.limit} safe for-sale canary rows`);
  const observedAt = new Date().toISOString();
  const rows = selected.map(({ source, product, variant, live }) =>
    canonicalFeedRow(source, product, variant, live, observedAt)
  );
  const templateHeader = fs.readFileSync(TEMPLATE, "utf8").split(/\r?\n/, 1)[0].split(",");
  const header = [...templateHeader, ...EXTRA_COLUMNS];
  const csv = serializeCsv(header, rows);
  const liveEvidence = [...liveByProduct.values()].map((row) => ({
    external_product_id: row.external_product_id,
    canonical_url: row.canonical_url,
    captured_at: row.captured_at,
    html_sha256: row.html_sha256,
    variation_count: row.variations.length,
  })).sort((left, right) => Number(left.external_product_id) - Number(right.external_product_id));
  const manifest = {
    schema_version: 1,
    kind: "six-pack-production-canary-draft",
    approved: false,
    target_environment: options.target.toUpperCase(),
    target_project_ref: TARGETS[options.target],
    source_snapshot_fingerprint: sourceSnapshot.snapshot_fingerprint,
    match_report_generated_at: matchReport.generated_at,
    observed_at: observedAt,
    csv_sha256: sha256(csv),
    row_count: rows.length,
    live_source: liveEvidence,
    commerce_drift: drift,
    rows: rows.map((row) => ({
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
  const csvPath = path.join(options.outputDir, `six-pack-canary-${options.limit}.csv`);
  const manifestPath = path.join(options.outputDir, `six-pack-canary-${options.limit}-manifest.json`);
  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(csvPath, csv);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { csvPath, manifestPath, manifest, rows };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await run(options);
  console.log(JSON.stringify({
    result: "PASS",
    database_writes: 0,
    approved: false,
    row_count: result.manifest.row_count,
    csv_sha256: result.manifest.csv_sha256,
    commerce_drift_count: result.manifest.commerce_drift.length,
    outputs: [result.csvPath, result.manifestPath].map((file) => path.relative(ROOT, file)),
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  EXTRA_COLUMNS,
  canonicalFeedRow,
  commercialIdentityTokens,
  currentOffer,
  liveIdentityDrift,
  mappedExternalVariantIds,
  orderedCandidates,
  parseArgs,
  run,
  serializeCsv,
};
