const crypto = require("node:crypto");

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

async function readShopifySnapshot({ storeUrl, fetchImpl = globalThis.fetch, pageLimit = 250, maximumPages = 100, maximumPageBytes = 10_000_000, timeoutMs = 15_000, capturedAt = new Date().toISOString(), marketCountry = null, noCache = false }) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 250) throw new Error("Shopify page limit must be 1..250");
  const origin = assertHttpsStoreUrl(storeUrl);
  const country = normalizeMarketCountry(marketCountry);
  const products = [];
  const pages = [];
  for (let page = 1; page <= maximumPages; page += 1) {
    const url = new URL("/products.json", origin);
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("page", String(page));
    if (country) url.searchParams.set("country", country);
    if (noCache) url.searchParams.set("_ss_no_cache", `${Date.now()}-${page}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Shopify snapshot request timed out")), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: noCache ? { accept: "application/json", "cache-control": "no-cache", pragma: "no-cache" } : { accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
    }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new Error(`Shopify snapshot request failed (${response.status})`);
    const declaredLength = Number(response.headers?.get?.("content-length") || 0);
    if (declaredLength > maximumPageBytes) throw new Error("Shopify products payload exceeds the byte limit");
    let payload;
    if (typeof response.text === "function") {
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > maximumPageBytes) throw new Error("Shopify products payload exceeds the byte limit");
      try { payload = JSON.parse(body); } catch { throw new Error("Malformed Shopify products JSON"); }
    } else payload = await response.json();
    if (!payload || !Array.isArray(payload.products)) throw new Error("Malformed Shopify products payload");
    pages.push({ page, count: payload.products.length, sha256: sha256(payload.products) });
    products.push(...payload.products);
    if (payload.products.length < pageLimit) {
      const variantIds = new Set();
      for (const product of products) for (const variant of product.variants || []) {
        const id = String(variant.id ?? "");
        if (!id || variantIds.has(id)) throw new Error("Shopify snapshot contains a missing or duplicate variant ID");
        variantIds.add(id);
      }
      const projection = { captured_at: capturedAt, store_origin: origin.origin, market_country: country, no_cache: Boolean(noCache), pages, products };
      const fingerprints = shopifySnapshotFingerprints(projection);
      return { ...projection, snapshot_sha256: fingerprints.raw_source_fingerprint, ...fingerprints };
    }
  }
  throw new Error("Shopify pagination exceeded the configured maximum");
}

module.exports = { assertSemanticShopifySnapshot, canonical, compareShopifySnapshots, normalizeMarketCountry, projectShopifyVariants, readShopifySnapshot, semanticShopifySnapshot, sha256, shopifySnapshotFingerprints };
