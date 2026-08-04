const fs = require("node:fs");
const path = require("node:path");
const config = require("../config/retailers/dolphin-vegan-protein-offer-sync.json");
const { shopifySnapshotFingerprints } = require("./lib/shopify-snapshot-reader");

const ROOT = path.resolve(__dirname, "..");
const HEADERS = "retailer_name,retailer_website,external_product_id,external_variant_id,product_name,variant_name,brand,category,description,image,slug,external_url,affiliate_url,external_gtin,price,shipping_known,shipping_cost,in_stock,is_for_sale,size,size_unit,flavour,product_format,pack_count,source_updated_at,product_id,product_variant_id".split(",");

function fail(message) { throw new Error(message); }
function csv(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

function parseProductPage(html, capturedAt = new Date().toISOString()) {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if (title !== config.source_title) fail("Dolphin exact product title drift");
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const documents = scripts.map((match) => JSON.parse(match[1]));
  const group = documents.find((item) => item?.["@type"] === "ProductGroup" && String(item.productGroupID) === config.external_product_id);
  if (!group || !Array.isArray(group.hasVariant)) fail("Dolphin exact ProductGroup is missing");
  const product = group.hasVariant.find((item) => item?.sku === config.external_variant_id && item?.url === config.source_url);
  const offer = product?.offers;
  if (!product || product.name !== config.source_title || offer?.priceCurrency !== "GBP" || offer?.seller?.name !== config.retailer_name) fail("Dolphin variant identity drift");
  const price = Number(offer.price);
  if (!Number.isFinite(price) || price <= 0) fail("Dolphin price is invalid");
  const availability = String(offer.availability || "");
  if (!/\/(InStock|OutOfStock)$/.test(availability)) fail("Dolphin availability is invalid");
  const inStock = availability.endsWith("/InStock");
  return {
    retailer_name: config.retailer_name, retailer_website: config.retailer_website,
    external_product_id: config.external_product_id, external_variant_id: config.external_variant_id,
    product_name: config.product_name, variant_name: config.variant_name, brand: "Optimum Nutrition",
    category: "Whey Protein", description: "", image: "", slug: "optimum-nutrition-100-plant-protein-684g",
    external_url: config.source_url, affiliate_url: config.source_url, external_gtin: "",
    price: price.toFixed(2), shipping_known: "true", shipping_cost: config.shipping_cost_gbp,
    in_stock: String(inStock), is_for_sale: "true", size: "684", size_unit: "g",
    flavour: "Vanilla", product_format: "powder", pack_count: "1", source_updated_at: capturedAt,
    product_id: String(config.product_id), product_variant_id: String(config.product_variant_id),
    retailer_product_id: String(config.retailer_product_id), offer_id: String(config.offer_id),
  };
}

function parseArgs(argv) {
  if (argv.length !== 1 || !argv[0].startsWith("--output=")) fail("Required --output=tmp/<file>.csv");
  const output = path.resolve(argv[0].slice(9));
  const relative = path.relative(path.join(ROOT, "tmp"), output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(output) !== ".csv") fail("Output must be a CSV inside tmp");
  return output;
}

async function run(output, options = {}) {
  const response = await (options.fetch || fetch)(config.source_url, { headers: { accept: "text/html", "user-agent": "SupplementScout-Dolphin-Offer-Refresh/1.0" }, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok || !String(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) fail("Dolphin source response is invalid");
  const row = parseProductPage(await response.text(), (options.now || new Date()).toISOString());
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${HEADERS.join(",")}\n${HEADERS.map((key) => csv(row[key])).join(",")}\n`);
  return { result: "PASS", source_url: config.source_url, rows: 1, price: row.price, in_stock: row.in_stock === "true", production_writes: 0, output: path.relative(ROOT, output) };
}

async function readDolphinSnapshot({
  fetchImpl = globalThis.fetch,
  capturedAt = new Date().toISOString(),
  timeoutMs = 20000,
  maximumAttempts = 3,
  retryBaseDelayMs = 250,
  userAgent = "SupplementScout-Dolphin-Offer-Refresh/1.0",
  sleepImpl = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
} = {}) {
  const diagnostic = {
    source_url: config.source_url,
    source_type: "EXACT_PRODUCT_JSON_LD",
    request_headers: { accept: "text/html", user_agent: userAgent },
    redirect_policy: "error",
    pages: [], pages_fetched: 0, bytes_received: 0,
    pagination_completed: false, retry_count: 0,
    final_http_status: null, final_content_type: null,
  };
  let html;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const started = Date.now();
    let response;
    try {
      response = await fetchImpl(config.source_url, {
        headers: { accept: "text/html", "user-agent": userAgent },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      diagnostic.pages.push({ attempt, duration_ms: Date.now() - started, result: "NETWORK_ERROR", error: error.message });
      if (attempt < maximumAttempts) {
        diagnostic.retry_count += 1;
        await sleepImpl(retryBaseDelayMs * attempt);
        continue;
      }
      error.code = "SOURCE_UNAVAILABLE";
      error.diagnostic = diagnostic;
      throw error;
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    diagnostic.final_http_status = response.status;
    diagnostic.final_content_type = contentType || null;
    if (!response.ok || !contentType.includes("text/html")) {
      const error = new Error("Dolphin source response is invalid");
      error.code = "SOURCE_INVALID_RESPONSE";
      error.diagnostic = diagnostic;
      throw error;
    }
    html = await response.text();
    diagnostic.bytes_received = Buffer.byteLength(html, "utf8");
    diagnostic.pages.push({ attempt, duration_ms: Date.now() - started, status: response.status, content_type: contentType, bytes_received: diagnostic.bytes_received, result: "PASS" });
    diagnostic.pages_fetched = 1;
    diagnostic.pagination_completed = true;
    break;
  }
  const row = parseProductPage(html, capturedAt);
  const snapshot = {
    captured_at: capturedAt,
    store_origin: config.retailer_website,
    pages: [{ page: 1, count: 1 }],
    products: [{
      id: row.external_product_id, handle: row.slug, title: row.product_name, updated_at: capturedAt,
      variants: [{ id: row.external_variant_id, sku: row.external_variant_id, price: row.price, available: row.in_stock === "true", title: row.variant_name, updated_at: capturedAt }],
    }],
    source_diagnostic: diagnostic,
  };
  const fingerprints = shopifySnapshotFingerprints(snapshot);
  return { ...snapshot, snapshot_sha256: fingerprints.raw_source_fingerprint, ...fingerprints };
}

if (require.main === module) run(parseArgs(process.argv.slice(2))).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { HEADERS, parseArgs, parseProductPage, readDolphinSnapshot, run };
