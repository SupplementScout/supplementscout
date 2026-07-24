const crypto = require("node:crypto");
const { TextDecoder } = require("node:util");
const { parse } = require("csv-parse/sync");
const { canonicalJson } = require("./canonical-json");

const REQUIRED_COLUMNS = [
  "id",
  "title",
  "link",
  "price",
  "description",
  "condition",
  "shipping",
  "shipping_weight",
  "gtin",
  "brand",
  "mpn",
  "identifier_exists",
  "item_group_id",
  "color",
  "material",
  "pattern",
  "size",
  "image_link",
  "additional_image_link",
  "product_type",
  "google_product_category",
  "quantity",
  "availability",
  "availability_date",
  "gender",
  "age_group",
  "adult",
  "multipack",
  "sale_price_effective_date",
  "sale_price",
  "energy_efficiency_class",
  "adwords_grouping",
  "adwords_labels",
  "adwords_redirect",
  "online_only",
  "excluded_destination",
  "unit_pricing_measure",
  "unit_pricing_base_measure",
  "expiration_date",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "custom_label_4",
  "c:product_ads_product_type",
  "size_type",
  "size_system",
  "is_bundle",
];

class EkmFeedError extends Error {
  constructor(code, message, diagnostic = {}) {
    super(message);
    this.name = "EkmFeedError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value) {
  return value == null ? "" : String(value).trim();
}

function parseMoney(value, field = "price") {
  const text = clean(value);
  const match = text.match(/^(\d+(?:\.\d{1,2})?)\s+GBP$/i);
  if (!match) throw new EkmFeedError("EKM_MALFORMED_PRICE", `Invalid ${field}: ${text}`);
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new EkmFeedError("EKM_MALFORMED_PRICE", `Invalid ${field}: ${text}`);
  }
  return amount.toFixed(2);
}

function parseAvailability(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "in stock") return true;
  if (normalized === "out of stock") return false;
  throw new EkmFeedError(
    "EKM_MALFORMED_AVAILABILITY",
    `Unsupported availability: ${value}`,
  );
}

function parseShippingRoutes(value) {
  const routes = [];
  for (const part of clean(value).split(",")) {
    const match = part.match(/^([A-Z]{2})::(.*):(\d+(?:\.\d{1,2})?)$/);
    if (!match) continue;
    routes.push({
      country: match[1],
      service: match[2].trim(),
      price: Number(match[3]).toFixed(2),
    });
  }
  return routes;
}

function deriveUkShipping(value, itemPrice) {
  const routes = parseShippingRoutes(value).filter((row) => row.country === "GB");
  const threshold = routes.find(
    (row) => row.price === "0.00" && /free.*over\s*£?(\d+(?:\.\d+)?)/i.test(row.service),
  );
  if (threshold) {
    const amount = Number(
      threshold.service.match(/free.*over\s*£?(\d+(?:\.\d+)?)/i)[1],
    );
    if (Number(itemPrice) >= amount) return "0.00";
  }
  const standard = routes.find((row) => /royal mail standard/i.test(row.service));
  if (!standard) {
    throw new EkmFeedError(
      "EKM_SHIPPING_SCHEMA_MISMATCH",
      "Required GB Royal Mail Standard route is missing",
    );
  }
  return standard.price;
}

function normalizeWheyOkayUrl(value, expectedVariantId = null) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new EkmFeedError("EKM_MALFORMED_URL", `Invalid product URL: ${value}`);
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:" || hostname !== "wheyokay.com") {
    throw new EkmFeedError(
      "EKM_URL_HOST_BLOCKED",
      `Product URL is outside wheyokay.com: ${value}`,
    );
  }
  const parentMatch = url.pathname.match(/-(\d+)-p\.asp$/i);
  if (!parentMatch) {
    throw new EkmFeedError(
      "EKM_PARENT_ID_MISSING",
      `Product URL has no exact EKM parent ID: ${value}`,
    );
  }
  const queryVariantId = clean(url.searchParams.get("variantid"));
  const variantId =
    queryVariantId ||
    (expectedVariantId && parentMatch[1] === String(expectedVariantId)
      ? String(expectedVariantId)
      : "");
  if (expectedVariantId && variantId !== String(expectedVariantId)) {
    throw new EkmFeedError(
      "EKM_VARIANT_ID_MISMATCH",
      `URL variant ${variantId || "(missing)"} does not match ${expectedVariantId}`,
    );
  }
  return {
    parent_id: parentMatch[1],
    variant_id: variantId,
    approved_url_identity: `https://wheyokay.com${url.pathname}`,
    source_url: url.href,
  };
}

function parseFeedText(text, { capturedAt, lastModified, sourceUrl, rawSha256 }) {
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0].split("\t");
  if (
    header.length !== REQUIRED_COLUMNS.length ||
    header.some((name, index) => name !== REQUIRED_COLUMNS[index])
  ) {
    throw new EkmFeedError("EKM_SCHEMA_MISMATCH", "Expected exact 48-column feed schema", {
      expected_columns: REQUIRED_COLUMNS,
      actual_columns: header,
    });
  }
  let parsed;
  try {
    parsed = parse(text, {
      columns: true,
      delimiter: "\t",
      bom: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: false,
    });
  } catch (error) {
    throw new EkmFeedError("EKM_MALFORMED_TSV", error.message);
  }
  const identities = new Set();
  const rows = parsed.map((row, index) => {
    const variantFromId = clean(row.id).match(/^2ab763(\d+)$/)?.[1] || "";
    if (!variantFromId) {
      throw new EkmFeedError(
        "EKM_VARIANT_ID_MISSING",
        `Row ${index + 2} has invalid id`,
      );
    }
    const identity = normalizeWheyOkayUrl(row.link, variantFromId);
    const sourceKey = `${identity.parent_id}:${identity.variant_id}`;
    if (identities.has(sourceKey)) {
      throw new EkmFeedError(
        "EKM_DUPLICATE_IDENTITY",
        `Duplicate source identity ${sourceKey}`,
      );
    }
    identities.add(sourceKey);
    const price = parseMoney(clean(row.sale_price) || row.price, "price");
    return {
      source_key: sourceKey,
      external_product_id: identity.parent_id,
      external_variant_id: identity.variant_id,
      title: clean(row.title),
      brand: clean(row.brand),
      price,
      in_stock: parseAvailability(row.availability),
      url: identity.approved_url_identity,
      source_url: identity.source_url,
      feed_shipping_cost: deriveUkShipping(row.shipping, price),
      gtin: clean(row.gtin) || null,
      mpn: clean(row.mpn) || null,
    };
  });
  const productCount = new Set(rows.map((row) => row.external_product_id)).size;
  const semanticRows = rows.map((row) => ({
    source_key: row.source_key,
    price: row.price,
    in_stock: row.in_stock,
    url: row.url,
    feed_shipping_cost: row.feed_shipping_cost,
  }));
  return {
    source_url: sourceUrl,
    captured_at: capturedAt,
    last_modified: lastModified,
    raw_sha256: rawSha256,
    semantic_fingerprint: sha256(canonicalJson(semanticRows)),
    column_count: REQUIRED_COLUMNS.length,
    row_count: rows.length,
    product_count: productCount,
    in_stock_count: rows.filter((row) => row.in_stock).length,
    out_of_stock_count: rows.filter((row) => !row.in_stock).length,
    rows,
  };
}

function transient(error) {
  return (
    error?.name === "AbortError" ||
    error instanceof TypeError ||
    [408, 425, 429, 500, 502, 503, 504].includes(error?.status)
  );
}

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRedirectValidation(
  initialUrl,
  { fetchImpl, timeoutMs, maximumRedirects, userAgent },
) {
  let current = new URL(initialUrl);
  const redirects = [];
  for (let index = 0; index <= maximumRedirects; index += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/plain,text/tab-separated-values;q=0.9",
          "user-agent": userAgent,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || index === maximumRedirects) {
        const error = new Error("Invalid or excessive feed redirect");
        error.status = response.status;
        throw error;
      }
      const next = new URL(location, current);
      if (
        next.protocol !== "https:" ||
        next.hostname.toLowerCase().replace(/^www\./, "") !== "wheyokay.com"
      ) {
        throw new EkmFeedError(
          "EKM_REDIRECT_BLOCKED",
          `Feed redirected outside the authorised HTTPS host: ${next.href}`,
        );
      }
      redirects.push({ status: response.status, from: current.href, to: next.href });
      current = next;
      continue;
    }
    return { response, finalUrl: current.href, redirects };
  }
  throw new EkmFeedError("EKM_REDIRECT_BLOCKED", "Feed redirect limit exceeded");
}

async function readEkmGoogleProductFeed({
  url,
  capturedAt = new Date().toISOString(),
  fetchImpl = globalThis.fetch,
  maximumAttempts = 3,
  retryBaseDelayMs = 250,
  timeoutMs = 20_000,
  maximumRedirects = 3,
  freshnessHours = 24,
  futureClockSkewMinutes = 5,
  userAgent = "SupplementScout-EKM-Feed/1.0",
} = {}) {
  if (!url || typeof fetchImpl !== "function") {
    throw new EkmFeedError("EKM_CONFIGURATION_ERROR", "Feed URL and fetch are required");
  }
  const initial = new URL(url);
  if (
    initial.protocol !== "https:" ||
    initial.hostname.toLowerCase().replace(/^www\./, "") !== "wheyokay.com"
  ) {
    throw new EkmFeedError("EKM_URL_HOST_BLOCKED", "Feed URL must use HTTPS wheyokay.com");
  }
  const diagnostic = {
    source_url: initial.href,
    captured_at: new Date(capturedAt).toISOString(),
    attempts: 0,
    retries: 0,
    redirects: [],
    http_status: null,
    content_type: null,
    bytes_received: 0,
    last_modified: null,
    freshness_hours: null,
  };
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    diagnostic.attempts = attempt;
    try {
      const { response, finalUrl, redirects } = await fetchWithRedirectValidation(
        initial.href,
        { fetchImpl, timeoutMs, maximumRedirects, userAgent },
      );
      diagnostic.http_status = response.status;
      diagnostic.redirects = redirects;
      if (response.status !== 200) {
        const error = new Error(`Feed HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const contentType = clean(response.headers.get("content-type"))
        .split(";")[0]
        .toLowerCase();
      diagnostic.content_type = contentType;
      if (!["text/plain", "text/tab-separated-values"].includes(contentType)) {
        throw new EkmFeedError(
          "EKM_CONTENT_TYPE_MISMATCH",
          `Unexpected feed content type ${contentType || "(missing)"}`,
          diagnostic,
        );
      }
      const lastModifiedText = response.headers.get("last-modified");
      const lastModified = new Date(lastModifiedText || "");
      if (!lastModifiedText || Number.isNaN(lastModified.getTime())) {
        throw new EkmFeedError(
          "EKM_LAST_MODIFIED_MISSING",
          "Feed Last-Modified header is missing or invalid",
          diagnostic,
        );
      }
      const capture = new Date(capturedAt);
      const ageHours = (capture.getTime() - lastModified.getTime()) / 3_600_000;
      diagnostic.last_modified = lastModified.toISOString();
      diagnostic.freshness_hours = ageHours;
      if (
        ageHours > freshnessHours ||
        ageHours < -futureClockSkewMinutes / 60
      ) {
        throw new EkmFeedError(
          "EKM_FEED_STALE",
          `Feed Last-Modified age ${ageHours.toFixed(3)}h is outside policy`,
          diagnostic,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      diagnostic.bytes_received = bytes.length;
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        throw new EkmFeedError(
          "EKM_ENCODING_MISMATCH",
          "Feed is not valid UTF-8",
          diagnostic,
        );
      }
      const feed = parseFeedText(text, {
        capturedAt: capture.toISOString(),
        lastModified: lastModified.toISOString(),
        sourceUrl: finalUrl,
        rawSha256: sha256(bytes),
      });
      return {
        ...feed,
        diagnostic: {
          ...diagnostic,
          final_url: finalUrl,
          row_count: feed.row_count,
          product_count: feed.product_count,
          in_stock_count: feed.in_stock_count,
          out_of_stock_count: feed.out_of_stock_count,
          column_count: feed.column_count,
          raw_sha256: feed.raw_sha256,
          semantic_fingerprint: feed.semantic_fingerprint,
          result: "PASS",
        },
      };
    } catch (error) {
      lastError = error;
      if (error instanceof EkmFeedError) {
        error.diagnostic = { ...diagnostic, ...error.diagnostic, result: "FAIL" };
      }
      if (attempt >= maximumAttempts || !transient(error)) break;
      diagnostic.retries += 1;
      await delay(retryBaseDelayMs * 2 ** (attempt - 1));
    }
  }
  if (lastError instanceof EkmFeedError) throw lastError;
  throw new EkmFeedError(
    "EKM_SOURCE_UNAVAILABLE",
    lastError?.message || "Unable to fetch EKM feed",
    { ...diagnostic, result: "FAIL" },
  );
}

module.exports = {
  EkmFeedError,
  REQUIRED_COLUMNS,
  deriveUkShipping,
  normalizeWheyOkayUrl,
  parseAvailability,
  parseFeedText,
  parseMoney,
  readEkmGoogleProductFeed,
  sha256,
};
