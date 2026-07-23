const crypto = require("node:crypto");

class ShopifySourceError extends Error {
  constructor(code, message, diagnostic, cause) {
    super(message, { cause });
    this.name = "ShopifySourceError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function compareIdentity(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
  return a.localeCompare(b);
}

function semanticShopifySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.products)) throw new Error("A Shopify product snapshot is required");
  const productIds = new Set();
  const variantIds = new Set();
  const products = snapshot.products.map((product) => {
    const productId = String(product?.id ?? "");
    if (!productId || productIds.has(productId)) throw new Error("Shopify semantic snapshot contains a missing or duplicate product ID");
    productIds.add(productId);
    const rawVariants = product.variants || [];
    const productFields = { ...product };
    delete productFields.updated_at;
    delete productFields.variants;
    if (!Array.isArray(rawVariants)) throw new Error("Shopify semantic snapshot contains malformed variants");
    const variants = rawVariants.map((variant) => {
      const variantId = String(variant?.id ?? "");
      if (!variantId || variantIds.has(variantId)) throw new Error("Shopify semantic snapshot contains a missing or duplicate variant ID");
      variantIds.add(variantId);
      const variantFields = { ...variant };
      delete variantFields.updated_at;
      return variantFields;
    }).sort((left, right) => compareIdentity(left.id, right.id));
    return { ...productFields, variants };
  }).sort((left, right) => compareIdentity(left.id, right.id));
  return { store_origin: snapshot.store_origin || null, products };
}

function shopifySnapshotFingerprints(snapshot) {
  const rawProjection = {
    captured_at: snapshot.captured_at,
    store_origin: snapshot.store_origin,
    pages: snapshot.pages,
    products: snapshot.products,
  };
  return {
    raw_source_fingerprint: sha256(rawProjection),
    semantic_source_fingerprint: sha256(semanticShopifySnapshot(snapshot)),
  };
}

function compareShopifySnapshots(boundSnapshot, freshSnapshot) {
  const bound = shopifySnapshotFingerprints(boundSnapshot);
  const fresh = shopifySnapshotFingerprints(freshSnapshot);
  return {
    raw_match: bound.raw_source_fingerprint === fresh.raw_source_fingerprint,
    semantic_match: bound.semantic_source_fingerprint === fresh.semantic_source_fingerprint,
    non_semantic_raw_drift: bound.raw_source_fingerprint !== fresh.raw_source_fingerprint && bound.semantic_source_fingerprint === fresh.semantic_source_fingerprint,
    bound,
    fresh,
  };
}

function assertSemanticShopifySnapshot(boundSnapshot, freshSnapshot) {
  const comparison = compareShopifySnapshots(boundSnapshot, freshSnapshot);
  if (!comparison.semantic_match) throw new Error("Semantic Shopify source drift");
  return comparison;
}

function assertHttpsStoreUrl(storeUrl) {
  const url = new URL(storeUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Shopify store URL must be a credential-free HTTPS origin");
  return url;
}

function normalizeMarketCountry(marketCountry) {
  if (marketCountry === null || marketCountry === undefined || String(marketCountry).trim() === "") return null;
  const value = String(marketCountry).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) throw new Error("Shopify market country must be a two-letter ISO country code");
  return value;
}

function projectShopifyVariants(snapshot, { shippingCost = null } = {}) {
  const rows = [];
  for (const product of snapshot.products || []) for (const variant of product.variants || []) rows.push({
    external_product_id: String(product.id), external_variant_id: String(variant.id), product_handle: String(product.handle || ""),
    external_sku: variant.sku == null || String(variant.sku).trim() === "" ? null : String(variant.sku),
    price: String(variant.price), shipping_cost: shippingCost, in_stock: Boolean(variant.available),
    source_updated_at: product.updated_at || null,
  });
  return rows;
}

function sourceError(code, message, diagnostic, cause) {
  return new ShopifySourceError(code, message, { ...diagnostic, completed_at: new Date().toISOString() }, cause);
}

function contentTypeOf(response) {
  return String(response.headers?.get?.("content-type") || "").toLowerCase();
}

function isJsonContentType(value) {
  return /^(?:application|text)\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(value);
}

function isTransientStatus(status) {
  return [408, 425, 429].includes(status) || status >= 500;
}

async function readShopifySnapshot({
  storeUrl,
  fetchImpl = globalThis.fetch,
  pageLimit = 250,
  maximumPages = 100,
  maximumPageBytes = 10_000_000,
  timeoutMs = 15_000,
  capturedAt = new Date().toISOString(),
  marketCountry = null,
  noCache = false,
  maximumAttempts = 3,
  retryBaseDelayMs = 250,
  sleepImpl = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  userAgent = "SupplementScout-Retailer-Refresh/1.0",
}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 250) throw new Error("Shopify page limit must be 1..250");
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 5) throw new Error("Shopify maximum attempts must be 1..5");
  const origin = assertHttpsStoreUrl(storeUrl);
  const country = normalizeMarketCountry(marketCountry);
  const products = [];
  const pages = [];
  const diagnostic = {
    source_url: new URL("/products.json", origin).href,
    source_type: "SHOPIFY_PRODUCTS_JSON",
    request_headers: {
      accept: "application/json",
      cache_control: noCache ? "no-cache" : null,
      pragma: noCache ? "no-cache" : null,
      user_agent: userAgent,
    },
    redirect_policy: "error",
    pages: [],
    pages_fetched: 0,
    bytes_received: 0,
    pagination_completed: false,
    retry_count: 0,
    final_http_status: null,
    final_content_type: null,
  };
  for (let page = 1; page <= maximumPages; page += 1) {
    const url = new URL("/products.json", origin);
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("page", String(page));
    if (country) url.searchParams.set("country", country);
    if (noCache) url.searchParams.set("_ss_no_cache", `${Date.now()}-${page}`);
    let payload;
    let pageDiagnostic;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("Shopify snapshot request timed out")), timeoutMs);
      const started = Date.now();
      let response;
      try {
        response = await fetchImpl(url, {
          headers: noCache
            ? { accept: "application/json", "cache-control": "no-cache", pragma: "no-cache", "user-agent": userAgent }
            : { accept: "application/json", "user-agent": userAgent },
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timer);
        pageDiagnostic = {
          page,
          attempt,
          url: url.href,
          duration_ms: Date.now() - started,
          status: null,
          content_type: null,
          bytes_received: 0,
          result: "NETWORK_ERROR",
          error: error.message,
        };
        diagnostic.pages.push(pageDiagnostic);
        if (attempt < maximumAttempts) {
          diagnostic.retry_count += 1;
          await sleepImpl(retryBaseDelayMs * attempt);
          continue;
        }
        throw sourceError("SOURCE_UNAVAILABLE", "Shopify source request failed after bounded retries", diagnostic, error);
      } finally {
        clearTimeout(timer);
      }
      const contentType = contentTypeOf(response);
      const declaredLength = Number(response.headers?.get?.("content-length") || 0);
      diagnostic.final_http_status = Number(response.status);
      diagnostic.final_content_type = contentType || null;
      pageDiagnostic = {
        page,
        attempt,
        url: url.href,
        response_url: response.url || url.href,
        redirected: Boolean(response.redirected),
        duration_ms: Date.now() - started,
        status: Number(response.status),
        content_type: contentType || null,
        declared_bytes: declaredLength || null,
        bytes_received: 0,
        result: null,
      };
      if (!response.ok) {
        pageDiagnostic.result = "HTTP_ERROR";
        diagnostic.pages.push(pageDiagnostic);
        if (isTransientStatus(Number(response.status)) && attempt < maximumAttempts) {
          diagnostic.retry_count += 1;
          await sleepImpl(retryBaseDelayMs * attempt);
          continue;
        }
        const code = isTransientStatus(Number(response.status)) ? "SOURCE_UNAVAILABLE" : "SOURCE_INVALID_RESPONSE";
        throw sourceError(code, `Shopify snapshot request failed (${response.status})`, diagnostic);
      }
      if (!isJsonContentType(contentType)) {
        pageDiagnostic.result = "INVALID_CONTENT_TYPE";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", `Shopify source returned non-JSON content type (${contentType || "missing"})`, diagnostic);
      }
      if (declaredLength > maximumPageBytes) {
        pageDiagnostic.result = "BYTE_LIMIT";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Shopify products payload exceeds the byte limit", diagnostic);
      }
      let body;
      try {
        body = await response.text();
      } catch (error) {
        pageDiagnostic.result = "BODY_READ_ERROR";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Unable to read Shopify products response", diagnostic, error);
      }
      const receivedBytes = Buffer.byteLength(body, "utf8");
      pageDiagnostic.bytes_received = receivedBytes;
      diagnostic.bytes_received += receivedBytes;
      if (receivedBytes > maximumPageBytes) {
        pageDiagnostic.result = "BYTE_LIMIT";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Shopify products payload exceeds the byte limit", diagnostic);
      }
      if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body)) {
        pageDiagnostic.result = "HTML_RESPONSE";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Shopify source returned an HTML or challenge response", diagnostic);
      }
      try {
        payload = JSON.parse(body);
      } catch (error) {
        pageDiagnostic.result = "MALFORMED_JSON";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Malformed or truncated Shopify products JSON", diagnostic, error);
      }
      if (!payload || !Array.isArray(payload.products)) {
        pageDiagnostic.result = "INVALID_SCHEMA";
        diagnostic.pages.push(pageDiagnostic);
        throw sourceError("SOURCE_INVALID_RESPONSE", "Malformed Shopify products payload", diagnostic);
      }
      pageDiagnostic.result = "PASS";
      pageDiagnostic.product_count = payload.products.length;
      diagnostic.pages.push(pageDiagnostic);
      break;
    }
    pages.push({ page, count: payload.products.length, bytes: pageDiagnostic.bytes_received, sha256: sha256(payload.products) });
    diagnostic.pages_fetched = pages.length;
    products.push(...payload.products);
    if (payload.products.length < pageLimit) {
      const variantIds = new Set();
      for (const product of products) for (const variant of product.variants || []) {
        const id = String(variant.id ?? "");
        if (!id || variantIds.has(id)) throw new Error("Shopify snapshot contains a missing or duplicate variant ID");
        variantIds.add(id);
      }
      diagnostic.pages_fetched = pages.length;
      diagnostic.pagination_completed = true;
      const projection = {
        captured_at: capturedAt,
        store_origin: origin.origin,
        market_country: country,
        no_cache: Boolean(noCache),
        pages,
        products,
        source_diagnostic: diagnostic,
      };
      const fingerprints = shopifySnapshotFingerprints(projection);
      return { ...projection, snapshot_sha256: fingerprints.raw_source_fingerprint, ...fingerprints };
    }
  }
  diagnostic.pages_fetched = pages.length;
  throw sourceError("SOURCE_INCOMPLETE", "Shopify pagination exceeded the configured maximum", diagnostic);
}

module.exports = { ShopifySourceError, assertSemanticShopifySnapshot, canonical, compareShopifySnapshots, normalizeMarketCountry, projectShopifyVariants, readShopifySnapshot, semanticShopifySnapshot, sha256, shopifySnapshotFingerprints };
