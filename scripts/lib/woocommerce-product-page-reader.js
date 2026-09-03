const crypto = require("node:crypto");

class WooCommerceSourceError extends Error {
  constructor(code, message, detail = {}, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "WooCommerceSourceError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail, cause) {
  throw new WooCommerceSourceError(code, message, detail, cause);
}

function errorChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current) && chain.length < 6) {
    chain.push(current);
    seen.add(current);
    current = current.cause;
  }
  return chain;
}

function safeToken(value) {
  const token = typeof value === "string" ? value : "";
  return /^[A-Za-z0-9_.-]{1,64}$/.test(token) ? token : null;
}

function exhaustedRetryDiagnostic(error, { productId, requestUrl, attempt }) {
  const chain = errorChain(error);
  const errorType = chain.map((entry) => safeToken(entry.name)).find(Boolean) || "Error";
  const networkCode = chain.map((entry) => safeToken(entry.code)).find((code) => (
    code && !code.startsWith("SOURCE_") && !code.startsWith("DUPLICATE_")
  )) || null;
  const httpStatus = chain
    .map((entry) => Number(entry?.detail?.status ?? entry?.status))
    .find((status) => Number.isInteger(status) && status >= 100 && status <= 599) || null;
  const timeout = chain.some((entry) => {
    const name = safeToken(entry.name);
    const code = safeToken(entry.code);
    return name === "AbortError" || ["ABORT_ERR", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(code);
  });
  return {
    error_type: errorType,
    network_code: networkCode,
    timeout,
    last_attempt: attempt,
    request_url: requestUrl.href,
    product_id: String(productId),
    http_status: httpStatus,
  };
}

function exhaustedRetryMessage(diagnostic, lastError) {
  const controlledLastError = lastError instanceof WooCommerceSourceError
    ? lastError.message.replace(/[\r\n\t]+/g, " ").slice(0, 240)
    : null;
  return [
    `WooCommerce product ${diagnostic.product_id} failed after bounded retries`,
    `error_type=${diagnostic.error_type}`,
    `network_code=${diagnostic.network_code || "none"}`,
    `timeout=${diagnostic.timeout}`,
    `last_attempt=${diagnostic.last_attempt}`,
    `request_url=${diagnostic.request_url}`,
    `http_status=${diagnostic.http_status || "none"}`,
    controlledLastError ? `last_error=${controlledLastError}` : null,
  ].filter(Boolean).join("; ");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (firstError) {
    try {
      return JSON.parse(value.replace(/\\"/g, '"').replace(/\\\//g, "/"));
    } catch {
      fail("SOURCE_SCHEMA_MISMATCH", `${label} is not valid JSON`, {}, firstError);
    }
  }
}

function decodedString(value) {
  return String(value ?? "")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .trim();
}

function extractProductName(html) {
  const source = String(html);
  const heading = source.match(/<h1[^>]*class=["'][^"']*\bproduct_title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (!heading) return null;
  return decodeHtmlEntities(heading[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim() || null;
}

function extractVariationPayload(html) {
  const source = String(html);
  const escaped = source.match(/data-product_variations=\\"([\s\S]*?)\\">/i);
  const regular = escaped ? null : source.match(/data-product_variations\s*=\s*"([\s\S]*?)"\s*>/i);
  const single = escaped || regular ? null : source.match(/data-product_variations\s*=\s*'([\s\S]*?)'\s*>/i);
  const match = escaped || regular || single;
  if (!match) return [];
  const parsed = parseJson(decodeHtmlEntities(match[1]), "WooCommerce variation payload");
  if (!Array.isArray(parsed)) fail("SOURCE_SCHEMA_MISMATCH", "WooCommerce variation payload must be an array");
  const ids = new Set();
  return parsed.map((row) => {
    const variationId = String(row?.variation_id ?? "");
    if (!/^[1-9]\d*$/.test(variationId)) fail("SOURCE_SCHEMA_MISMATCH", "Variation payload contains an invalid variation ID");
    if (ids.has(variationId)) fail("DUPLICATE_SOURCE_IDENTITY", `Duplicate live variation ID ${variationId}`);
    ids.add(variationId);
    const price = Number(row.display_price);
    const regularPrice = Number(row.display_regular_price);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(regularPrice) || regularPrice <= 0) {
      fail("SOURCE_SCHEMA_MISMATCH", `Variation ${variationId} contains an invalid price`);
    }
    return {
      external_variant_id: variationId,
      attributes: row.attributes && typeof row.attributes === "object" ? row.attributes : {},
      price: price.toFixed(2),
      regular_price: regularPrice.toFixed(2),
      in_stock: row.is_in_stock === true,
      purchasable: row.is_purchasable === true,
      active: row.variation_is_active === true,
      sku: decodedString(row.sku) || null,
      image_url: decodedString(row.image?.full_src || row.image?.src) || null,
    };
  });
}

function jsonLdScripts(html) {
  const scripts = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of String(html).matchAll(pattern)) {
    try {
      scripts.push(JSON.parse(decodeHtmlEntities(match[1]).trim()));
    } catch {
      // Unrelated malformed analytics JSON-LD must not hide a valid Product block.
    }
  }
  return scripts;
}

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visitor);
    return;
  }
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

function comparableUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function productUrls(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers].filter(Boolean);
  return [
    product?.url,
    product?.["@id"],
    ...offers.map((offer) => offer?.url),
  ].map(comparableUrl).filter(Boolean);
}

function extractProductOffer(html, options = {}) {
  const products = [];
  for (const block of jsonLdScripts(html)) {
    walk(block, (value) => {
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      if (types.includes("Product")) products.push(value);
    });
  }
  const expectedUrl = comparableUrl(options.canonicalUrl);
  const candidates = expectedUrl
    ? products.filter((product) => productUrls(product).includes(expectedUrl))
    : products;
  if (candidates.length === 0 && options.allowMissing) return null;
  if (candidates.length !== 1) {
    fail("SOURCE_SCHEMA_MISMATCH", `Expected one matching Product JSON-LD block, found ${candidates.length}`, {
      total_product_blocks: products.length,
      canonical_url: options.canonicalUrl || null,
    });
  }
  const product = candidates[0];
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers].filter(Boolean);
  const offersOfType = offers.filter((offer) => {
    const types = Array.isArray(offer?.["@type"]) ? offer["@type"] : [offer?.["@type"]];
    return types.includes("Offer");
  });
  if (offersOfType.length !== 1) return null;
  const offer = offersOfType[0];
  const price = Number(offer.price);
  if (!Number.isFinite(price) || price <= 0 || offer.priceCurrency !== "GBP") {
    fail("SOURCE_SCHEMA_MISMATCH", "Product JSON-LD contains an invalid GBP offer");
  }
  const availability = String(offer.availability || "").toLowerCase();
  if (!availability) fail("SOURCE_SCHEMA_MISMATCH", "Product JSON-LD offer is missing availability");
  return {
    name: String(product.name || "").trim() || null,
    sku: String(product.sku || "").trim() || null,
    price: price.toFixed(2),
    in_stock: /instock$/.test(availability) && !/outofstock$/.test(availability),
    url: String(offer.url || "").trim() || null,
  };
}

function productIdFromHtml(html) {
  const source = String(html);
  const postIds = [...source.matchAll(/\bpostid-(\d+)\b/gi)].map((match) => match[1]);
  const uniquePostIds = [...new Set(postIds)];
  if (uniquePostIds.length === 1) return uniquePostIds[0];
  const match = source.match(/data-product_id=\\?["'](\d+)\\?["'][^>]*data-product_variations/i);
  return match?.[1] || null;
}

function parseWooCommerceProductPage(html, options) {
  const productId = String(options.productId || "");
  if (!/^[1-9]\d*$/.test(productId)) fail("SOURCE_SCHEMA_MISMATCH", "A positive WooCommerce product ID is required");
  const observedProductId = productIdFromHtml(html);
  if (observedProductId && observedProductId !== productId) {
    fail("SOURCE_IDENTITY_DRIFT", `Expected product ${productId}, received ${observedProductId}`);
  }
  const variants = extractVariationPayload(html);
  // Variable-product JSON-LD commonly embeds one Product node per variation.
  // The Woo variation payload is the exact source of price/stock identity there.
  const productOffer = variants.length
    ? null
    : extractProductOffer(html, { canonicalUrl: options.canonicalUrl });
  if (!variants.length && !productOffer) {
    fail("SOURCE_SCHEMA_MISMATCH", "Product page has neither variations nor a simple product offer");
  }
  return {
    schema_version: 1,
    external_product_id: productId,
    canonical_url: String(options.canonicalUrl || ""),
    captured_at: options.capturedAt || new Date().toISOString(),
    product_name: extractProductName(html) || productOffer?.name,
    product_offer: productOffer,
    variations: variants,
    html_sha256: sha256(html),
    html_bytes: Buffer.byteLength(html),
  };
}

async function boundedText(response, maximumBytes) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maximumBytes) fail("SOURCE_TOO_LARGE", "WooCommerce page exceeds maximum response size");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maximumBytes) fail("SOURCE_TOO_LARGE", "WooCommerce page exceeds maximum response size");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      fail("SOURCE_TOO_LARGE", "WooCommerce page exceeds maximum response size");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readWooCommerceProductPage({
  storeUrl,
  productId,
  productUrl,
  allowedPathPrefixes = ["/product/"],
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
  maximumBytes = 2_000_000,
  maximumAttempts = 3,
  retryBaseDelayMs = 250,
  sleepImpl = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  capturedAt = new Date().toISOString(),
  userAgent = "SupplementScout-6-Pack-Refresh/1.0",
}) {
  if (typeof fetchImpl !== "function") fail("SOURCE_CONFIGURATION", "A fetch implementation is required");
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 5) {
    fail("SOURCE_CONFIGURATION", "maximumAttempts must be 1..5");
  }
  const origin = new URL(storeUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash) {
    fail("SOURCE_CONFIGURATION", "storeUrl must be a credential-free HTTPS origin");
  }
  const id = String(productId || "");
  if (!/^[1-9]\d*$/.test(id)) fail("SOURCE_CONFIGURATION", "productId must be a positive integer");
  if (!Array.isArray(allowedPathPrefixes) || allowedPathPrefixes.length === 0 ||
      allowedPathPrefixes.some((prefix) => typeof prefix !== "string" || !prefix.startsWith("/"))) {
    fail("SOURCE_CONFIGURATION", "allowedPathPrefixes must contain absolute path prefixes");
  }
  const requestUrl = productUrl ? new URL(productUrl) : new URL("/", origin);
  if (!productUrl) requestUrl.searchParams.set("p", id);
  if (requestUrl.protocol !== "https:" || requestUrl.hostname !== origin.hostname ||
      requestUrl.username || requestUrl.password || requestUrl.hash) {
    fail("SOURCE_CONFIGURATION", "productUrl must stay on the credential-free HTTPS store origin");
  }
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(requestUrl, {
        headers: { accept: "text/html", "user-agent": userAgent },
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.status !== 200) fail("SOURCE_HTTP_ERROR", `WooCommerce product ${id} returned HTTP ${response.status}`, { status: response.status, attempt });
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      if (!contentType.startsWith("text/html")) fail("SOURCE_CONTENT_TYPE", `WooCommerce product ${id} returned ${contentType || "unknown content type"}`);
      const finalUrl = new URL(response.url || requestUrl);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== origin.hostname ||
          !allowedPathPrefixes.some((prefix) => finalUrl.pathname.startsWith(prefix))) {
        fail("SOURCE_REDIRECT_ERROR", `WooCommerce product ${id} redirected outside the approved product origin`, { final_url: finalUrl.href });
      }
      const html = await boundedText(response, maximumBytes);
      return parseWooCommerceProductPage(html, {
        productId: id,
        canonicalUrl: finalUrl.href,
        capturedAt,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maximumAttempts) {
        await sleepImpl(retryBaseDelayMs * attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const diagnostic = exhaustedRetryDiagnostic(lastError, {
    productId: id,
    requestUrl,
    attempt: maximumAttempts,
  });
  const code = lastError instanceof WooCommerceSourceError
    ? lastError.code
    : "SOURCE_UNAVAILABLE";
  fail(code, exhaustedRetryMessage(diagnostic, lastError), diagnostic, lastError);
}

module.exports = {
  WooCommerceSourceError,
  decodeHtmlEntities,
  exhaustedRetryDiagnostic,
  extractProductOffer,
  extractProductName,
  extractVariationPayload,
  parseWooCommerceProductPage,
  productIdFromHtml,
  readWooCommerceProductPage,
  sha256,
};
