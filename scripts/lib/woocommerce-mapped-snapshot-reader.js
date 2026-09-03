const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");
const { readWooCommerceProductPage } = require("./woocommerce-product-page-reader");

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
}

function validateManifestRows(rows, { storeUrl, expectedCount }) {
  if (!Array.isArray(rows) || rows.length !== expectedCount) throw new Error(`approved WooCommerce scope must contain exactly ${expectedCount} rows`);
  const origin = new URL(storeUrl);
  for (const field of ["mapping_id", "offer_id", "external_variant_id"]) {
    if (new Set(rows.map((row) => String(row[field]))).size !== rows.length) throw new Error(`approved WooCommerce scope has duplicate ${field}`);
  }
  for (const row of rows) {
    if (![row.mapping_id, row.offer_id, row.external_product_id, row.external_variant_id].every((value) => /^\d+$/.test(String(value)))) {
      throw new Error("approved WooCommerce scope contains an invalid identity");
    }
    const url = new URL(row.external_url);
    if (url.protocol !== "https:" || url.hostname !== origin.hostname || url.username || url.password || url.hash) {
      throw new Error("approved WooCommerce scope contains an external URL outside the retailer origin");
    }
  }
}

function preferredUrl(rows) {
  return [...new Set(rows.map((row) => row.external_url))].sort((left, right) => {
    const a = new URL(left), b = new URL(right);
    const aScore = (a.pathname === "/" ? 0 : 10_000) + a.pathname.length - a.search.length;
    const bScore = (b.pathname === "/" ? 0 : 10_000) + b.pathname.length - b.search.length;
    return bScore - aScore || left.localeCompare(right);
  })[0];
}

function sourceRowsForPage(page, approvedRows) {
  const approvedIds = new Set(approvedRows.map((row) => String(row.external_variant_id)));
  const observed = page.variations.length ? page.variations.filter((row) => row.active === true && row.purchasable === true) : page.product_offer ? [{
    external_variant_id: String(page.external_product_id),
    price: page.product_offer.price,
    in_stock: page.product_offer.in_stock,
    sku: page.product_offer.sku,
  }] : [];
  return {
    rows: observed.filter((row) => approvedIds.has(String(row.external_variant_id))).map((row) => ({
      external_product_id: String(page.external_product_id),
      external_variant_id: String(row.external_variant_id),
      external_sku: row.sku || null,
      product_handle: new URL(page.canonical_url).pathname.replace(/^\/+|\/+$/g, "") || null,
      price: String(row.price),
      in_stock: Boolean(row.in_stock),
    })),
    discoveredVariantIds: observed.map((row) => String(row.external_variant_id)).filter((id) => !approvedIds.has(id)),
  };
}

async function readWooCommerceMappedSnapshot({
  storeUrl,
  manifestRows,
  expectedCount,
  fetchImpl = globalThis.fetch,
  capturedAt = new Date().toISOString(),
  timeoutMs,
  maximumBytes,
  maximumAttempts,
  retryBaseDelayMs,
  sleepImpl,
  userAgent,
  allowedPathPrefixes,
}) {
  validateManifestRows(manifestRows, { storeUrl, expectedCount });
  const grouped = new Map();
  for (const row of manifestRows) {
    const key = String(row.external_product_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const products = [], sourceVariants = [], issues = [], pages = [], discoveredVariantIds = [];
  let retryCount = 0, bytesReceived = 0;
  for (const [productId, approvedRows] of grouped) {
    const requestUrl = preferredUrl(approvedRows);
    try {
      const page = await readWooCommerceProductPage({ storeUrl, productId, productUrl: requestUrl, fetchImpl, capturedAt,
        timeoutMs, maximumBytes, maximumAttempts, retryBaseDelayMs, sleepImpl, userAgent, allowedPathPrefixes });
      const projected = sourceRowsForPage(page, approvedRows);
      const rawCount = page.variations.length || (page.product_offer ? 1 : 0);
      bytesReceived += Number(page.html_bytes || 0);
      products.push({ external_product_id: productId, variants: Array.from({ length: rawCount }, () => ({})) });
      sourceVariants.push(...projected.rows);
      discoveredVariantIds.push(...projected.discoveredVariantIds);
      pages.push({ external_product_id: productId, request_url: requestUrl, final_url: page.canonical_url, result: "PASS", html_sha256: page.html_sha256, raw_variant_count: rawCount });
    } catch (error) {
      const retries = Math.max(0, Number(error?.detail?.last_attempt || maximumAttempts || 1) - 1);
      retryCount += retries;
      issues.push({ external_product_id: productId, code: error.code || "SOURCE_UNAVAILABLE", message: String(error.message || error).slice(0, 500), http_status: error?.detail?.http_status || null });
      pages.push({ external_product_id: productId, request_url: requestUrl, result: "BLOCK", error_code: error.code || "SOURCE_UNAVAILABLE", http_status: error?.detail?.http_status || null });
    }
  }
  const sourceIds = new Set(sourceVariants.map((row) => row.external_variant_id));
  for (const row of manifestRows) if (!sourceIds.has(String(row.external_variant_id))) {
    issues.push({ external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), offer_id: String(row.offer_id), code: "SOURCE_VARIANT_MISSING" });
  }
  sourceVariants.sort((a, b) => a.external_variant_id.localeCompare(b.external_variant_id, "en", { numeric: true }));
  const semantic = digest(sourceVariants.map((row) => ({ external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, price: row.price, in_stock: row.in_stock })));
  return {
    schema_version: 1,
    captured_at: capturedAt,
    products,
    source_variants: sourceVariants,
    issues,
    discovered_variant_ids: [...new Set(discoveredVariantIds)].sort(),
    raw_source_fingerprint: digest(pages),
    semantic_source_fingerprint: semantic,
    source_diagnostic: {
      final_http_status: issues.find((issue) => issue.http_status)?.http_status || (issues.length ? null : 200),
      final_content_type: products.length ? "text/html" : null,
      bytes_received: bytesReceived,
      pages_fetched: products.length,
      pagination_completed: true,
      retry_count: retryCount,
      request_headers: { accept: "text/html" },
      redirect_policy: "same-origin-approved-product-paths",
      pages,
    },
  };
}

module.exports = { preferredUrl, readWooCommerceMappedSnapshot, sourceRowsForPage, validateManifestRows };
