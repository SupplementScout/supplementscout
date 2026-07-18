const crypto = require("node:crypto");

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function assertHttpsStoreUrl(storeUrl) {
  const url = new URL(storeUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Shopify store URL must be a credential-free HTTPS origin");
  return url;
}

function projectShopifyVariants(snapshot, { shippingCost = null } = {}) {
  const rows = [];
  for (const product of snapshot.products || []) for (const variant of product.variants || []) rows.push({
    external_product_id: String(product.id), external_variant_id: String(variant.id), product_handle: String(product.handle || ""),
    price: String(variant.price), shipping_cost: shippingCost, in_stock: Boolean(variant.available),
    source_updated_at: product.updated_at || null,
  });
  return rows;
}

async function readShopifySnapshot({ storeUrl, fetchImpl = globalThis.fetch, pageLimit = 250, maximumPages = 100, maximumPageBytes = 10_000_000, timeoutMs = 15_000, capturedAt = new Date().toISOString() }) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 250) throw new Error("Shopify page limit must be 1..250");
  const origin = assertHttpsStoreUrl(storeUrl);
  const products = [];
  const pages = [];
  for (let page = 1; page <= maximumPages; page += 1) {
    const url = new URL("/products.json", origin);
    url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("page", String(page));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Shopify snapshot request timed out")), timeoutMs);
    let response;
    try { response = await fetchImpl(url, { headers: { accept: "application/json" }, redirect: "error", signal: controller.signal }); }
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
      const projection = { captured_at: capturedAt, store_origin: origin.origin, pages, products };
      return { ...projection, snapshot_sha256: sha256(projection) };
    }
  }
  throw new Error("Shopify pagination exceeded the configured maximum");
}

module.exports = { canonical, projectShopifyVariants, readShopifySnapshot, sha256 };
