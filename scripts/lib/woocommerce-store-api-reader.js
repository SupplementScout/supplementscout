class WooCommerceStoreApiError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "WooCommerceStoreApiError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail) {
  throw new WooCommerceStoreApiError(code, message, detail);
}

function productRow(row, origin) {
  const id = String(row?.id || "");
  if (!/^[1-9]\d*$/.test(id) || !["simple", "variable"].includes(row?.type)) fail("SOURCE_SCHEMA_MISMATCH", "Store API product identity is invalid");
  const permalink = new URL(row.permalink);
  if (permalink.protocol !== "https:" || permalink.hostname !== origin.hostname || !permalink.pathname.startsWith("/product/")) fail("SOURCE_IDENTITY_DRIFT", `Product ${id} permalink left the approved origin`);
  if (row.prices?.currency_code !== "GBP" || row.prices?.currency_minor_unit !== 2) fail("SOURCE_SCHEMA_MISMATCH", `Product ${id} does not use GBP minor units`);
  const variations = (row.variations || []).map((variation) => ({
    external_variant_id: String(variation.id || ""),
    attributes: Object.fromEntries((variation.attributes || []).map((attribute) => [String(attribute.name || ""), attribute.value]))
  }));
  if (row.type === "simple" && variations.length) fail("SOURCE_SCHEMA_MISMATCH", `Simple product ${id} declares variations`);
  if (row.type === "variable" && !variations.length) fail("SOURCE_SCHEMA_MISMATCH", `Variable product ${id} has no variations`);
  if (variations.some((variation) => !/^[1-9]\d*$/.test(variation.external_variant_id)) || new Set(variations.map((variation) => variation.external_variant_id)).size !== variations.length) fail("SOURCE_SCHEMA_MISMATCH", `Product ${id} has invalid or duplicate variations`);
  return {
    external_product_id: id,
    name: String(row.name || "").trim(),
    slug: String(row.slug || "").trim(),
    type: row.type,
    permalink: permalink.href,
    sku: String(row.sku || "").trim() || null,
    categories: (row.categories || []).map((category) => String(category.name || "").replace(/&amp;/g, "&").trim()),
    variations
  };
}

async function boundedJson(response, maximumBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maximumBytes) fail("SOURCE_TOO_LARGE", "Store API response exceeds the byte limit");
  const text = await response.text();
  if (Buffer.byteLength(text) > maximumBytes) fail("SOURCE_TOO_LARGE", "Store API response exceeds the byte limit");
  try { return JSON.parse(text); } catch { fail("SOURCE_SCHEMA_MISMATCH", "Store API response is not valid JSON"); }
}

async function readWooCommerceStoreCatalogue({ storeUrl, fetchImpl = globalThis.fetch, maximumPages = 5, maximumProducts = 100, maximumBytesPerPage = 2_000_000, timeoutMs = 20_000 }) {
  const origin = new URL(storeUrl);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) fail("SOURCE_CONFIGURATION", "storeUrl must be a credential-free HTTPS origin");
  const products = [];
  let expectedTotal = null;
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    if (page > maximumPages) fail("SOURCE_TOO_LARGE", "Store API catalogue exceeds the page limit");
    const url = new URL("/wp-json/wc/store/v1/products", origin);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "SupplementScout-GYM-HIGH-Catalogue/1.0" }, redirect: "error", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (response.status !== 200 || !String(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) fail("SOURCE_HTTP_ERROR", `Store API page ${page} was unavailable`);
    const declaredTotal = Number(response.headers.get("x-wp-total"));
    const declaredPages = Number(response.headers.get("x-wp-totalpages"));
    if (!Number.isInteger(declaredTotal) || !Number.isInteger(declaredPages) || declaredTotal < 1 || declaredPages < 1) fail("SOURCE_SCHEMA_MISMATCH", "Store API pagination headers are invalid");
    if (expectedTotal == null) { expectedTotal = declaredTotal; totalPages = declaredPages; }
    if (expectedTotal !== declaredTotal || totalPages !== declaredPages) fail("SOURCE_CHANGED_DURING_CAPTURE", "Store API pagination changed during capture");
    const body = await boundedJson(response, maximumBytesPerPage);
    if (!Array.isArray(body)) fail("SOURCE_SCHEMA_MISMATCH", "Store API response must be an array");
    products.push(...body.map((row) => productRow(row, origin)));
    if (products.length > maximumProducts) fail("SOURCE_TOO_LARGE", "Store API catalogue exceeds the product limit");
  }
  if (products.length !== expectedTotal || new Set(products.map((row) => row.external_product_id)).size !== products.length) fail("SOURCE_COVERAGE_MISMATCH", "Store API catalogue count or identity is inconsistent");
  return { captured_at: new Date().toISOString(), declared_total: expectedTotal, products };
}

module.exports = { WooCommerceStoreApiError, boundedJson, productRow, readWooCommerceStoreCatalogue };
