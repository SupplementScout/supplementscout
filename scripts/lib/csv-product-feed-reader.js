const crypto = require("node:crypto");
const { parse } = require("csv-parse/sync");
const { canonicalJson } = require("./canonical-json");

const REQUIRED_COLUMNS = Object.freeze([
  "product_id", "variant_id", "product_name", "brand", "category", "variant_name", "flavour", "size", "sku", "ean",
  "price", "sale_price", "current_price", "stock_status", "product_url", "image_url", "last_updated",
]);

function invariant(value, message) { if (!value) throw new Error(message); }
function digest(value) { return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex"); }
function money(value) {
  invariant(/^\d+(?:\.\d{1,2})?$/.test(String(value || "").trim()) && Number(value) > 0, "CSV feed contains an invalid current price");
  return Number(value).toFixed(2);
}
function safeFeedUrl(feedUrl, storeUrl) {
  const feed = new URL(feedUrl), store = new URL(storeUrl);
  invariant(feed.protocol === "https:" && feed.origin === store.origin && !feed.username && !feed.password && !feed.hash, "CSV feed endpoint must use the retailer HTTPS origin");
  return feed;
}

function projectCsvRows(bytes, { storeUrl, capturedAt }) {
  const parsed = parse(bytes, { columns: true, skip_empty_lines: true, bom: true });
  invariant(parsed.length > 0, "CSV feed is empty");
  invariant(JSON.stringify(Object.keys(parsed[0])) === JSON.stringify(REQUIRED_COLUMNS), "CSV feed columns changed");
  const store = new URL(storeUrl), seen = new Set();
  const sourceVariants = parsed.map(row => {
    const externalProductId = String(row.product_id || "").trim();
    const externalVariantId = String(row.variant_id || externalProductId).trim();
    invariant(/^\d+$/.test(externalProductId) && /^\d+$/.test(externalVariantId) && !seen.has(externalVariantId), "CSV feed contains an invalid or duplicate source identity");
    seen.add(externalVariantId);
    const url = new URL(row.product_url);
    invariant(url.protocol === "https:" && url.origin === store.origin && !url.username && !url.password && !url.hash, "CSV feed contains a product URL outside the retailer origin");
    invariant(["instock", "outofstock", "onbackorder"].includes(row.stock_status), "CSV feed contains an unknown stock status");
    return {
      external_product_id: externalProductId,
      external_variant_id: externalVariantId,
      external_sku: String(row.sku || "").trim() || null,
      product_handle: url.pathname.replace(/^\/+|\/+$/g, "") || null,
      price: money(row.current_price),
      in_stock: row.stock_status === "instock",
      url: url.href,
      external_url: url.href,
      source_updated_at: String(row.last_updated || "").trim() || capturedAt,
    };
  });
  const products = [...new Set(sourceVariants.map(row => row.external_product_id))].map(id => ({
    external_product_id: id,
    variants: sourceVariants.filter(row => row.external_product_id === id).map(row => ({ external_variant_id: row.external_variant_id })),
  }));
  return { products, sourceVariants };
}

async function readCsvProductFeed({ feedUrl, storeUrl, capturedAt = new Date().toISOString(), fetchImpl = globalThis.fetch, timeoutMs = 30_000, maximumBytes = 5_000_000, maximumAttempts = 3, retryBaseDelayMs = 500, sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const endpoint = safeFeedUrl(feedUrl, storeUrl);
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, { headers: { accept: "text/csv" }, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
      invariant(response.status === 200, `CSV feed HTTP status ${response.status}`);
      invariant(String(response.headers.get("content-type") || "").toLowerCase().includes("csv"), "CSV feed content type changed");
      const bytes = Buffer.from(await response.arrayBuffer());
      invariant(bytes.length > 0 && bytes.length <= maximumBytes, "CSV feed size is outside the approved boundary");
      const projected = projectCsvRows(bytes, { storeUrl, capturedAt });
      const semanticRows = projected.sourceVariants.map(({ external_product_id, external_variant_id, price, in_stock, url }) => ({ external_product_id, external_variant_id, price, in_stock, url }));
      return {
        schema_version: 1,
        captured_at: capturedAt,
        products: projected.products,
        source_variants: projected.sourceVariants,
        issues: [],
        discovered_variant_ids: [],
        raw_source_fingerprint: digest(bytes),
        semantic_source_fingerprint: digest(semanticRows),
        source_diagnostic: { final_http_status: 200, final_content_type: response.headers.get("content-type"), bytes_received: bytes.length, pages_fetched: 1, pagination_completed: true, retry_count: attempt - 1, request_headers: { accept: "text/csv" }, redirect_policy: "error", row_count: projected.sourceVariants.length },
      };
    } catch (error) {
      lastError = error;
      if (attempt < maximumAttempts) await sleepImpl(retryBaseDelayMs * attempt);
    }
  }
  throw new Error(`CSV feed read failed after ${maximumAttempts} attempt(s): ${String(lastError?.message || "unknown source error").replace(/https?:\/\/\S+/g, "[REDACTED_URL]")}`);
}

module.exports = { REQUIRED_COLUMNS, projectCsvRows, readCsvProductFeed, safeFeedUrl };
