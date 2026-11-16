const { projectPartnerizeRows } = require("./partnerize-product-feed-projector");

const invariant = (condition, code) => { if (!condition) throw new Error(code); };
const SAFE_CODES = new Set([
  "PARTNERIZE_FEED_HTTP_INVALID", "PARTNERIZE_FEED_CONTENT_TYPE_INVALID", "PARTNERIZE_FEED_SIZE_INVALID",
  "PARTNERIZE_FEED_BODY_INVALID", "PARTNERIZE_FEED_REDIRECT_REJECTED", "PARTNERIZE_FEED_ENCODING_OR_SCHEMA_INVALID",
  "PARTNERIZE_FEED_EMPTY", "PARTNERIZE_FEED_COLUMNS_CHANGED", "PARTNERIZE_SOURCE_IDENTITY_INVALID_OR_DUPLICATE",
  "PARTNERIZE_REVIEWED_IDENTITIES_INVALID", "PARTNERIZE_STORE_ORIGIN_INVALID",
]);

function safeFeedUrl(value) {
  try {
    invariant(typeof value === "string" && !/[\u0000-\u0020\u007f]/.test(value), "PARTNERIZE_FEED_ENDPOINT_INVALID");
    const url = new URL(value);
    invariant(url.origin === "https://feeds.performancehorizon.com" && !url.username && !url.password && !url.hash
      && url.pathname !== "/", "PARTNERIZE_FEED_ENDPOINT_INVALID");
    return url;
  } catch { throw new Error("PARTNERIZE_FEED_ENDPOINT_INVALID"); }
}

async function boundedBody(response, maximumBytes) {
  const length = response.headers.get("content-length");
  invariant(length === null || (/^\d+$/.test(length) && Number(length) > 0 && Number(length) <= maximumBytes), "PARTNERIZE_FEED_SIZE_INVALID");
  invariant(typeof response.body?.getReader === "function", "PARTNERIZE_FEED_BODY_INVALID");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      invariant(value instanceof Uint8Array, "PARTNERIZE_FEED_BODY_INVALID");
      size += value.byteLength;
      invariant(size <= maximumBytes, "PARTNERIZE_FEED_SIZE_INVALID");
      chunks.push(Buffer.from(value));
    }
    invariant(size > 0, "PARTNERIZE_FEED_SIZE_INVALID");
    return Buffer.concat(chunks, size);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}

const httpDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

async function readPartnerizeProductFeed({ feedUrl, storeUrl, reviewedIdentities = [], fetchImpl = globalThis.fetch,
  maximumBytes = 12_000_000, timeoutMs = 30_000, maximumAttempts = 3, retryBaseDelayMs = 500,
  sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => new Date() }) {
  const endpoint = safeFeedUrl(feedUrl);
  invariant(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 50_000_000
    && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000
    && Number.isSafeInteger(maximumAttempts) && maximumAttempts > 0 && maximumAttempts <= 3
    && Number.isSafeInteger(retryBaseDelayMs) && retryBaseDelayMs >= 0 && retryBaseDelayMs <= 5000, "PARTNERIZE_FETCH_POLICY_INVALID");
  const headers = { accept: "text/csv, text/plain, application/octet-stream" };
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let retryable = false;
    let response;
    try {
      try {
        response = await fetchImpl(endpoint, { headers, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
      } catch { retryable = true; throw new Error("PARTNERIZE_FEED_TRANSPORT_FAILED"); }
      invariant(!response.redirected, "PARTNERIZE_FEED_REDIRECT_REJECTED");
      if (response.status !== 200) {
        retryable = response.status === 429 || response.status >= 500;
        await response.body?.cancel().catch(() => {});
        throw new Error("PARTNERIZE_FEED_HTTP_INVALID");
      }
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      invariant(/^(text\/(csv|plain)|application\/(octet-stream|csv))(?:\s*;|$)/.test(contentType)
        && (!/charset\s*=/.test(contentType) || /charset\s*=\s*"?utf-8"?(?:\s*;|\s*$)/.test(contentType)), "PARTNERIZE_FEED_CONTENT_TYPE_INVALID");
      const bytes = await boundedBody(response, maximumBytes);
      const projected = projectPartnerizeRows(bytes, { storeUrl, reviewedIdentities });
      return {
        schema_version: 1, captured_at: now().toISOString(), products: projected.products,
        source_variants: projected.sourceVariants, issues: [], discovered_variant_ids: [],
        raw_source_fingerprint: projected.raw_source_fingerprint, semantic_source_fingerprint: projected.semantic_source_fingerprint,
        source_diagnostic: {
          final_http_status: 200, final_content_type: contentType, bytes_received: bytes.length,
          pages_fetched: 1, pagination_completed: true, retry_count: attempt - 1, request_headers: headers,
          redirect_policy: "error", row_count: projected.sourceVariants.length,
          supplier_generated_at: null, supplier_generated_at_status: "NOT_PROVIDED",
          http_date: httpDate(response.headers.get("date")), http_last_modified: httpDate(response.headers.get("last-modified")),
        },
      };
    } catch (error) {
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
      if (retryable && attempt < maximumAttempts) { await sleepImpl(retryBaseDelayMs * attempt); continue; }
      // Never include transport messages, response bodies or the authenticated endpoint.
      throw new Error(SAFE_CODES.has(error.message) ? error.message : "PARTNERIZE_FEED_TRANSPORT_FAILED");
    }
  }
}

module.exports = { readPartnerizeProductFeed, safeFeedUrl };
