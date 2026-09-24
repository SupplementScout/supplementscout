const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");
const { REQUIRED_COLUMNS, projectCsvRows } = require("./csv-product-feed-projector");

function invariant(value, message) { if (!value) throw new Error(message); }
function digest(value) { return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex"); }
function safeFeedUrl(feedUrl, storeUrl) {
  const feed = new URL(feedUrl), store = new URL(storeUrl);
  invariant(feed.protocol === "https:" && feed.origin === store.origin && !feed.username && !feed.password && !feed.hash, "CSV feed endpoint must use the retailer HTTPS origin");
  return feed;
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
