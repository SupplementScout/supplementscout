const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { parse } = require("csv-parse/sync");
const { readShopifySnapshot } = require("./lib/shopify-snapshot-reader");
const config = require("../config/retailers/simply-supplements-reconciliation.json");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_AWIN_COLUMNS = [
  "aw_deep_link", "product_name", "aw_product_id", "merchant_product_id",
  "search_price", "merchant_name", "merchant_id", "currency", "merchant_deep_link",
  "data_feed_id", "brand_name", "merchant_category", "in_stock", "is_for_sale", "ean",
];

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function normalizedHost(url) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function exactUrl(value, expectedHost) {
  const url = new URL(value);
  invariant(url.protocol === "https:" && !url.username && !url.password && normalizedHost(url) === expectedHost, `unsafe URL: ${value}`);
  return url;
}

function shopifyIdentity(value) {
  const url = exactUrl(value, "simplysupplements.co.uk");
  const match = url.pathname.match(/^\/products\/([^/]+)\/?$/);
  const variants = url.searchParams.getAll("variant");
  invariant(match && variants.length === 1 && /^\d+$/.test(variants[0]), `invalid Simply variant URL: ${value}`);
  return { handle: decodeURIComponent(match[1]), variant_id: variants[0] };
}

function awinIdentity(value, expectedAwProductId) {
  const url = exactUrl(value, "awin1.com");
  invariant(url.searchParams.get("p") === expectedAwProductId, "Awin product identity mismatch");
  invariant(url.searchParams.get("m") === config.awin.merchant_id, "Awin merchant identity mismatch");
  return url.href;
}

function readAwinFeed(file) {
  const bytes = fs.readFileSync(file);
  const csv = file.toLowerCase().endsWith(".gz") ? zlib.gunzipSync(bytes) : bytes;
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: false, trim: false });
  invariant(rows.length > 0, "Awin feed is empty");
  const headers = Object.keys(rows[0]);
  for (const column of REQUIRED_AWIN_COLUMNS) invariant(headers.includes(column), `Awin feed missing column: ${column}`);
  const merchantIds = new Set();
  const awIds = new Set();
  const variantIds = new Set();
  const directUrls = new Set();
  const normalized = rows.map((row, index) => {
    const number = index + 2;
    invariant(row.merchant_id === config.awin.merchant_id && row.data_feed_id === config.awin.data_feed_id, `Awin source identity mismatch at row ${number}`);
    invariant(row.currency === config.awin.currency, `Awin currency mismatch at row ${number}`);
    invariant(row.merchant_product_id && row.aw_product_id, `Awin product identity missing at row ${number}`);
    invariant(!merchantIds.has(row.merchant_product_id), `duplicate Awin merchant product ID: ${row.merchant_product_id}`);
    invariant(!awIds.has(row.aw_product_id), `duplicate Awin product ID: ${row.aw_product_id}`);
    const direct = shopifyIdentity(row.merchant_deep_link);
    invariant(!variantIds.has(direct.variant_id), `duplicate Shopify variant ID in Awin: ${direct.variant_id}`);
    invariant(!directUrls.has(row.merchant_deep_link), `duplicate Awin direct URL: ${row.merchant_deep_link}`);
    const price = Number(row.search_price);
    invariant(Number.isFinite(price) && price > 0, `invalid Awin price at row ${number}`);
    merchantIds.add(row.merchant_product_id);
    awIds.add(row.aw_product_id);
    variantIds.add(direct.variant_id);
    directUrls.add(row.merchant_deep_link);
    return {
      merchant_product_id: row.merchant_product_id,
      aw_product_id: row.aw_product_id,
      shopify_variant_id: direct.variant_id,
      handle: direct.handle,
      title: row.product_name,
      brand: row.brand_name || null,
      category: row.merchant_category || null,
      ean: row.ean || null,
      direct_url: row.merchant_deep_link,
      affiliate_url: awinIdentity(row.aw_deep_link, row.aw_product_id),
      awin_price_evidence: price.toFixed(2),
      awin_in_stock_evidence: row.in_stock,
    };
  });
  return {
    rows: normalized,
    evidence: {
      file: path.relative(ROOT, file).replaceAll("\\", "/"),
      compressed_sha256: sha256(bytes),
      decompressed_sha256: sha256(csv),
      row_count: normalized.length,
      column_count: headers.length,
    },
  };
}

function animalSignal({ title = "", category = "", handle = "" }) {
  const animalCategories = new Set(["pet vitamins & supplements", "dog treats", "non-prescription cat food", "non-prescription dog food", "skin & coat"]);
  return animalCategories.has(String(category).trim().toLowerCase())
    || /\b(?:for dogs|for cats|dog food|cat food)\b/i.test(title)
    || /(?:^|-)(?:dogs|cats|pet|pets|vitapaws)(?:-|$)/i.test(handle);
}

function validateAnimalExclusions(awinRows, settings = config) {
  const byMerchantId = new Map(awinRows.map((row) => [row.merchant_product_id, row]));
  const excluded = new Set();
  for (const expected of settings.animal_exclusions) {
    const actual = byMerchantId.get(expected.merchant_product_id);
    invariant(actual, `reviewed animal exclusion missing from Awin: ${expected.merchant_product_id}`);
    invariant(actual.aw_product_id === expected.aw_product_id && actual.shopify_variant_id === expected.shopify_variant_id && actual.handle === expected.handle && actual.title === expected.title, `reviewed animal exclusion drift: ${expected.merchant_product_id}`);
    invariant(animalSignal(actual), `reviewed animal exclusion lost its source signal: ${expected.merchant_product_id}`);
    excluded.add(expected.merchant_product_id);
  }
  return excluded;
}

function validateApprovedRekeys(awinRows, approvedSeeds, settings = config) {
  const contract = settings.approved_awin_rekeys || { rows: [] };
  invariant(Array.isArray(contract.rows), "approved Awin rekey rows are required");
  const byCurrentMerchantId = new Map(awinRows.map((row) => [row.merchant_product_id, row]));
  const bySeedMerchantId = new Map(approvedSeeds.map((row) => [row.merchant_product_id, row]));
  const approved = new Map();
  const currentIds = new Set();
  for (const expected of contract.rows) {
    invariant(!approved.has(expected.merchant_product_id), `duplicate approved Awin rekey: ${expected.merchant_product_id}`);
    invariant(!currentIds.has(expected.current_merchant_product_id), `duplicate current Awin rekey: ${expected.current_merchant_product_id}`);
    const seed = bySeedMerchantId.get(expected.merchant_product_id);
    const current = byCurrentMerchantId.get(expected.current_merchant_product_id);
    invariant(seed && current, `approved Awin rekey source missing: ${expected.merchant_product_id}`);
    const priorIdentity = shopifyIdentity(seed.direct_url || seed.external_url);
    invariant(seed.aw_product_id === expected.aw_product_id && priorIdentity.variant_id === expected.shopify_variant_id && priorIdentity.handle === expected.handle && seed.product_name === expected.title && (seed.affiliate_url || seed.aw_deep_link || seed.url) === expected.affiliate_url, `approved legacy Awin rekey identity drift: ${expected.merchant_product_id}`);
    invariant(current.aw_product_id === expected.current_aw_product_id && current.shopify_variant_id === expected.shopify_variant_id && current.handle === expected.handle && current.direct_url === (seed.direct_url || seed.external_url) && current.affiliate_url === expected.current_affiliate_url, `approved current Awin rekey identity drift: ${expected.merchant_product_id}`);
    approved.set(expected.merchant_product_id, { expected, seed, current });
    currentIds.add(expected.current_merchant_product_id);
  }
  return approved;
}

function loadApprovedSeeds(directory) {
  const files = fs.readdirSync(directory).filter((name) => /^simply-supplements-safe-sample-.*\.csv$/i.test(name)).sort();
  invariant(files.length === 3, "expected exactly three Simply approved sample files");
  const rows = files.flatMap((name) => parse(fs.readFileSync(path.join(directory, name)), { columns: true, bom: true, skip_empty_lines: true }));
  invariant(rows.length === 120, `expected 120 approved Simply seeds, got ${rows.length}`);
  const ids = new Set();
  for (const row of rows) {
    invariant(row.merchant_product_id && !ids.has(row.merchant_product_id), `duplicate approved Simply merchant product ID: ${row.merchant_product_id}`);
    ids.add(row.merchant_product_id);
  }
  return rows;
}

function shippingFor(price, settings = config) {
  invariant(Number.isFinite(price) && price > 0, "positive Shopify price required for shipping");
  return price >= settings.shipping.free_from_gbp ? 0 : settings.shipping.standard_gbp;
}

function indexShopify(snapshot, settings = config) {
  invariant(snapshot?.source_diagnostic?.pagination_completed === true, "Shopify pagination is incomplete");
  invariant(snapshot.source_diagnostic.pagination_completion === "empty-page", "Simply requires empty-page Shopify pagination");
  invariant(snapshot.pages?.at(-1)?.count === 0, "Simply Shopify capture must end on an empty page");
  invariant(snapshot.market_country === settings.shopify.market_country, "Simply Shopify capture must use GB market context");
  invariant(snapshot.products.length >= settings.shopify.minimum_product_count, "Simply Shopify product source collapsed");
  const byVariantId = new Map();
  for (const product of snapshot.products) {
    invariant(product?.id != null && product.handle, "Shopify product identity missing");
    for (const variant of product.variants || []) {
      const id = String(variant?.id ?? "");
      invariant(id && !byVariantId.has(id), `duplicate Shopify variant ID: ${id || "missing"}`);
      invariant(typeof variant.available === "boolean", `Shopify availability must be boolean for variant ${id}`);
      const price = Number(variant.price);
      invariant(Number.isFinite(price) && price > 0, `invalid Shopify price for variant ${id}`);
      const rawCompareAtPrice = variant.compare_at_price;
      const parsedCompareAtPrice = rawCompareAtPrice == null || String(rawCompareAtPrice).trim() === "" ? 0 : Number(rawCompareAtPrice);
      invariant(Number.isFinite(parsedCompareAtPrice) && parsedCompareAtPrice >= 0, `invalid Shopify compare-at price for variant ${id}`);
      const compareAtPrice = parsedCompareAtPrice > 0 ? parsedCompareAtPrice : null;
      byVariantId.set(id, { product_id: String(product.id), variant_id: id, handle: String(product.handle), title: String(product.title || ""), variant_title: String(variant.title || ""), sku: variant.sku ? String(variant.sku) : null, price, compare_at_price: compareAtPrice, in_stock: variant.available });
    }
  }
  invariant(byVariantId.size >= settings.shopify.minimum_variant_count, "Simply Shopify variant source collapsed");
  return byVariantId;
}

function reconcile({ awin, snapshot, approvedSeeds, settings = config }) {
  const excludedIds = validateAnimalExclusions(awin.rows, settings);
  const approvedRekeys = validateApprovedRekeys(awin.rows, approvedSeeds, settings);
  const shopify = indexShopify(snapshot, settings);
  const awinVariantIds = new Set(awin.rows.map((row) => row.shopify_variant_id));
  const ready = [];
  const missingShopify = [];
  const identityReview = [];
  const excludedAnimals = [];
  const animalReviewSignals = [];
  for (const row of awin.rows) {
    if (excludedIds.has(row.merchant_product_id)) {
      excludedAnimals.push({ ...row, reason: "OWNER_EXCLUDED_ANIMAL_PRODUCT" });
      continue;
    }
    if (animalSignal(row)) animalReviewSignals.push({ ...row, reason: "UNREVIEWED_ANIMAL_SIGNAL" });
    const live = shopify.get(row.shopify_variant_id);
    if (!live) {
      missingShopify.push({ ...row, reason: "MISSING_SHOPIFY_VARIANT_BLOCK_NOT_OOS" });
      continue;
    }
    if (live.handle !== row.handle) {
      identityReview.push({ ...row, live_handle: live.handle, reason: "SHOPIFY_HANDLE_DRIFT" });
      continue;
    }
    const shipping = shippingFor(live.price, settings);
    ready.push({
      merchant_product_id: row.merchant_product_id,
      aw_product_id: row.aw_product_id,
      external_product_id: live.product_id,
      external_variant_id: live.variant_id,
      external_sku: live.sku,
      handle: live.handle,
      product_name: live.title,
      variant_name: live.variant_title,
      external_gtin: row.ean,
      external_url: `${settings.retailer.store_url}/products/${live.handle}?variant=${live.variant_id}`,
      affiliate_url: row.affiliate_url,
      price: live.price.toFixed(2),
      compare_at_price: live.compare_at_price == null ? null : live.compare_at_price.toFixed(2),
      in_stock: live.in_stock,
      shipping_cost: shipping.toFixed(2),
      total_price: (live.price + shipping).toFixed(2),
      commercial_source: "SHOPIFY_GB",
      identity_source: "AWIN_5959_115748_PLUS_SHOPIFY_VARIANT",
    });
  }
  const readyByMerchantId = new Map(ready.map((row) => [row.merchant_product_id, row]));
  const awinByMerchantId = new Map(awin.rows.map((row) => [row.merchant_product_id, row]));
  const approvedScope = approvedSeeds.map((seed) => {
    let currentAwin = awinByMerchantId.get(seed.merchant_product_id);
    const approvedRekey = approvedRekeys.get(seed.merchant_product_id);
    if (!currentAwin && approvedRekey) currentAwin = approvedRekey.current;
    if (!currentAwin) {
      const priorIdentity = shopifyIdentity(seed.direct_url || seed.external_url);
      const live = shopify.get(priorIdentity.variant_id);
      return {
        merchant_product_id: seed.merchant_product_id,
        aw_product_id: seed.aw_product_id,
        status: live ? "BLOCKED_AWIN_MISSING_SHOPIFY_PRESENT" : "BLOCKED_AWIN_AND_SHOPIFY_MISSING",
        prior_variant_id: priorIdentity.variant_id,
        prior_affiliate_url: seed.affiliate_url || seed.aw_deep_link || seed.url || null,
        live_shopify: live ? { external_product_id: live.product_id, external_variant_id: live.variant_id, handle: live.handle, price: live.price.toFixed(2), in_stock: live.in_stock } : null,
      };
    }
    const current = readyByMerchantId.get(seed.merchant_product_id);
    const currentReady = current || (approvedRekey ? readyByMerchantId.get(approvedRekey.expected.current_merchant_product_id) : null);
    if (!currentReady) return { merchant_product_id: seed.merchant_product_id, status: "BLOCKED_RECONCILIATION", current_variant_id: currentAwin.shopify_variant_id };
    const priorPrice = Number(seed.price);
    const priorStock = /^(?:1|true|yes)$/i.test(String(seed.in_stock));
    const identity = approvedRekey ? {
      merchant_product_id: approvedRekey.expected.merchant_product_id,
      aw_product_id: approvedRekey.expected.aw_product_id,
      affiliate_url: approvedRekey.expected.affiliate_url,
      current_awin_rekey: {
        merchant_product_id: approvedRekey.expected.current_merchant_product_id,
        aw_product_id: approvedRekey.expected.current_aw_product_id,
        affiliate_url: approvedRekey.expected.current_affiliate_url,
      },
    } : {};
    return { ...currentReady, ...identity, status: approvedRekey ? "READY_OWNER_APPROVED_AWIN_REKEY" : "READY_FOR_OWNER_MANIFEST_REVIEW", prior_price: Number.isFinite(priorPrice) ? priorPrice.toFixed(2) : null, prior_in_stock: priorStock, price_changed: Number.isFinite(priorPrice) ? priorPrice.toFixed(2) !== currentReady.price : null, stock_changed: priorStock !== currentReady.in_stock };
  });
  const approvedReady = approvedScope.filter((row) => row.status.startsWith("READY_"));
  const approvedBlocked = approvedScope.filter((row) => !row.status.startsWith("READY_"));
  const approvedIds = new Set(approvedSeeds.map((row) => row.merchant_product_id));
  for (const row of approvedRekeys.values()) approvedIds.add(row.expected.current_merchant_product_id);
  const discovery = ready.filter((row) => !approvedIds.has(row.merchant_product_id)).map((row) => ({ ...row, status: "DISCOVERY_REVIEW_ONLY" }));
  const shopifyOnly = [...shopify.values()].filter((row) => !awinVariantIds.has(row.variant_id)).map((row) => ({ ...row, status: animalSignal(row) ? "ANIMAL_REVIEW_SIGNAL" : "SHOPIFY_ONLY_REVIEW" }));
  const report = {
    schema_version: 1,
    kind: settings.kind,
    generated_at: new Date().toISOString(),
    state: approvedBlocked.length || identityReview.length || animalReviewSignals.length || missingShopify.length ? "REVIEW_REQUIRED" : "READ_ONLY_READY",
    approved_scope_state: approvedBlocked.length ? "BLOCKED" : "READY_FOR_MANIFEST",
    policy: settings.policy,
    retailer: settings.retailer,
    sources: {
      awin: awin.evidence,
      shopify: { captured_at: snapshot.captured_at, raw_source_fingerprint: snapshot.raw_source_fingerprint, semantic_source_fingerprint: snapshot.semantic_source_fingerprint, product_count: snapshot.products.length, variant_count: shopify.size, pages: snapshot.pages.map((page) => ({ page: page.page, count: page.count, bytes: page.bytes, sha256: page.sha256 })) },
    },
    counts: {
      awin_rows: awin.rows.length,
      shopify_products: snapshot.products.length,
      shopify_variants: shopify.size,
      owner_excluded_animal_products: excludedAnimals.length,
      unreviewed_animal_signals: animalReviewSignals.length,
      awin_rows_ready: ready.length,
      awin_missing_shopify: missingShopify.length,
      awin_identity_review: identityReview.length,
      approved_scope_total: approvedScope.length,
      approved_scope_ready: approvedReady.length,
      approved_scope_blocked: approvedBlocked.length,
      approved_awin_rekeys: approvedScope.filter((row) => row.status === "READY_OWNER_APPROVED_AWIN_REKEY").length,
      approved_scope_price_changes: approvedReady.filter((row) => row.price_changed).length,
      approved_scope_price_changes_matching_compare_at: approvedReady.filter((row) => row.price_changed && row.compare_at_price === row.prior_price).length,
      approved_scope_stock_changes: approvedReady.filter((row) => row.stock_changed).length,
      human_discovery_rows: discovery.length,
      shopify_only_review_rows: shopifyOnly.length,
      database_writes: 0,
    },
    approved_scope: approvedScope,
    owner_excluded_animals: excludedAnimals,
    unreviewed_animal_signals: animalReviewSignals,
    missing_shopify_variants: missingShopify,
    identity_review: identityReview,
    human_discovery: discovery,
    shopify_only_review: shopifyOnly,
  };
  report.report_fingerprint = sha256(canonical({ ...report, generated_at: null, report_fingerprint: undefined }));
  return report;
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--(awin|output)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument: ${arg}`);
    out[match[1]] = path.resolve(match[2]);
  }
  invariant(out.awin && out.output, "required --awin=<csv|csv.gz> --output=<tmp/report.json>");
  const inputRelative = path.relative(path.join(ROOT, "data", "feeds", "awin"), out.awin);
  const outputRelative = path.relative(path.join(ROOT, "tmp"), out.output);
  invariant(inputRelative && !inputRelative.startsWith("..") && !path.isAbsolute(inputRelative), "Awin input must be inside data/feeds/awin");
  invariant(outputRelative && !outputRelative.startsWith("..") && !path.isAbsolute(outputRelative), "report output must be inside tmp");
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const awin = readAwinFeed(args.awin);
  const approvedSeeds = loadApprovedSeeds(path.join(ROOT, "data", "feeds", "awin", "samples"));
  const snapshot = await readShopifySnapshot({ storeUrl: config.retailer.store_url, marketCountry: config.shopify.market_country, noCache: true, paginationCompletion: config.shopify.pagination_completion });
  const report = reconcile({ awin, snapshot, approvedSeeds });
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ state: report.state, counts: report.counts, report_fingerprint: report.report_fingerprint, output: path.relative(ROOT, args.output).replaceAll("\\", "/") }));
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { animalSignal, indexShopify, loadApprovedSeeds, parseArgs, readAwinFeed, reconcile, shippingFor, shopifyIdentity, validateAnimalExclusions };
