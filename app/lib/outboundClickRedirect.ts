export const OUTBOUND_CLICK_SOURCES = [
  "product_best_offer",
  "product_offer_list",
] as const;

const CRAWLER_USER_AGENT_PATTERNS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "crawler",
  "spider",
  "bot",
  "preview",
  "headlesschrome",
  "pagespeed",
  "lighthouse",
  "chatgpt-user",
  "anthropic-ai",
  "cohere-ai",
  "bytespider",
] as const;

const AUTOMATION_CLIENT_PATTERNS = [
  "curl/",
  "wget/",
  "python-requests",
  "python-httpx",
  "axios/",
  "node-fetch",
  "undici",
  "postmanruntime",
  "go-http-client",
  "libwww-perl",
  "powershell/",
  "scrapy/",
] as const;

export type OutboundClickSource = (typeof OUTBOUND_CLICK_SOURCES)[number];

export type OutboundTrafficClass =
  | "likely_human"
  | "likely_automated"
  | "unknown";

export type OutboundRequestDiagnostics = {
  traffic_class: OutboundTrafficClass;
  classification_reason:
    | "browser_same_origin_navigation"
    | "known_automation_client"
    | "missing_user_agent"
    | "non_navigation_fetch"
    | "incomplete_navigation_signals";
  client_family:
    | "chrome"
    | "edge"
    | "firefox"
    | "safari"
    | "other_browser"
    | "automation_client"
    | "unknown";
  referrer_class:
    | "same_origin_product"
    | "same_origin_other"
    | "external"
    | "missing"
    | "invalid";
  fetch_context:
    | "same_origin_navigation"
    | "other_navigation"
    | "non_navigation"
    | "missing";
  request_method: "GET";
};

export type OutboundOfferRecord = {
  id: string | number;
  product_id: string | number | null;
  retailer_id: string | number | null;
  url: string | null;
  in_stock: boolean | null;
};

export type OutboundProductRecord = {
  id: string | number;
  slug: string | null;
  is_active: boolean | null;
  merged_into_product_id: string | number | null;
};

export type OutboundClickDataSource = {
  fetchOffer: (offerId: string) => Promise<{
    data: OutboundOfferRecord | null;
    error: unknown;
  }>;
  fetchProduct: (productId: string) => Promise<{
    data: OutboundProductRecord | null;
    error: unknown;
  }>;
  insertClick: (click: {
    offer_id: string;
    product_id: string;
    retailer_id: string | null;
    destination_url: string;
    source_page: OutboundClickSource;
    traffic_class?: OutboundTrafficClass;
    classification_reason?: OutboundRequestDiagnostics["classification_reason"];
    client_family?: OutboundRequestDiagnostics["client_family"];
    referrer_class?: OutboundRequestDiagnostics["referrer_class"];
    fetch_context?: OutboundRequestDiagnostics["fetch_context"];
    request_method?: "GET";
  }) => Promise<{ error: unknown }>;
};

export type OutboundRedirectResult =
  | {
      ok: true;
      destinationUrl: string;
      clickInserted: boolean;
      clickInsertError: unknown;
    }
  | {
      ok: false;
      status: 400 | 404 | 503;
      message: string;
      productPath: string | null;
    };

const VALID_ID_PATTERN = /^[1-9][0-9]*$/;
const DEFAULT_SOURCE: OutboundClickSource = "product_offer_list";

function isValidId(value: string) {
  return VALID_ID_PATTERN.test(value);
}

function toIdString(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value);

  return isValidId(text) ? text : null;
}

export function normalizeOutboundSource(value: string | null): OutboundClickSource {
  return OUTBOUND_CLICK_SOURCES.includes(value as OutboundClickSource)
    ? (value as OutboundClickSource)
    : DEFAULT_SOURCE;
}

export function isCrawlerUserAgent(value: string | null) {
  if (!value) {
    return false;
  }

  const userAgent = value.toLowerCase();

  return CRAWLER_USER_AGENT_PATTERNS.some((pattern) =>
    userAgent.includes(pattern)
  );
}

function clientFamily(value: string | null): OutboundRequestDiagnostics["client_family"] {
  if (!value) return "unknown";
  const userAgent = value.toLowerCase();

  if (AUTOMATION_CLIENT_PATTERNS.some((pattern) => userAgent.includes(pattern))) {
    return "automation_client";
  }
  if (userAgent.includes("edg/")) return "edge";
  if (userAgent.includes("firefox/") || userAgent.includes("fxios/")) return "firefox";
  if (userAgent.includes("chrome/") || userAgent.includes("crios/")) return "chrome";
  if (userAgent.includes("safari/") && userAgent.includes("applewebkit/")) return "safari";
  if (userAgent.includes("mozilla/")) return "other_browser";

  return "unknown";
}

function referrerClass(
  value: string | null,
  siteOrigin: string
): OutboundRequestDiagnostics["referrer_class"] {
  if (!value) return "missing";

  try {
    const referrer = new URL(value);
    if (referrer.origin !== siteOrigin) return "external";
    return referrer.pathname.startsWith("/product/")
      ? "same_origin_product"
      : "same_origin_other";
  } catch {
    return "invalid";
  }
}

function fetchContext(input: {
  secFetchSite: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
}): OutboundRequestDiagnostics["fetch_context"] {
  const site = input.secFetchSite?.toLowerCase() || null;
  const mode = input.secFetchMode?.toLowerCase() || null;
  const destination = input.secFetchDest?.toLowerCase() || null;

  if (!site && !mode && !destination) return "missing";
  if (mode === "navigate" && destination === "document") {
    return site === "same-origin"
      ? "same_origin_navigation"
      : "other_navigation";
  }

  return "non_navigation";
}

export function classifyOutboundRequest(input: {
  userAgent: string | null;
  referer: string | null;
  secFetchSite: string | null;
  secFetchMode: string | null;
  secFetchDest: string | null;
  siteOrigin: string;
}): OutboundRequestDiagnostics {
  const family = clientFamily(input.userAgent);
  const referrer = referrerClass(input.referer, input.siteOrigin);
  const context = fetchContext(input);

  if (family === "automation_client") {
    return {
      traffic_class: "likely_automated",
      classification_reason: "known_automation_client",
      client_family: family,
      referrer_class: referrer,
      fetch_context: context,
      request_method: "GET",
    };
  }
  if (!input.userAgent) {
    return {
      traffic_class: "likely_automated",
      classification_reason: "missing_user_agent",
      client_family: family,
      referrer_class: referrer,
      fetch_context: context,
      request_method: "GET",
    };
  }
  if (context === "non_navigation") {
    return {
      traffic_class: "likely_automated",
      classification_reason: "non_navigation_fetch",
      client_family: family,
      referrer_class: referrer,
      fetch_context: context,
      request_method: "GET",
    };
  }
  if (
    family !== "unknown" &&
    referrer === "same_origin_product" &&
    context === "same_origin_navigation"
  ) {
    return {
      traffic_class: "likely_human",
      classification_reason: "browser_same_origin_navigation",
      client_family: family,
      referrer_class: referrer,
      fetch_context: context,
      request_method: "GET",
    };
  }

  return {
    traffic_class: "unknown",
    classification_reason: "incomplete_navigation_signals",
    client_family: family,
    referrer_class: referrer,
    fetch_context: context,
    request_method: "GET",
  };
}

export function validateRetailerDestinationUrl(value: string | null) {
  if (!value || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function productPath(product: OutboundProductRecord | null) {
  if (!product) {
    return null;
  }

  const id = toIdString(product.id);

  if (product.slug) {
    return `/product/${product.slug}`;
  }

  return id ? `/product/${id}` : null;
}

export async function resolveOutboundRedirect(input: {
  offerId: string;
  source: string | null;
  dataSource: OutboundClickDataSource;
  diagnostics?: OutboundRequestDiagnostics;
  log?: Pick<Console, "error">;
}): Promise<OutboundRedirectResult> {
  const offerId = input.offerId.trim();
  const source = normalizeOutboundSource(input.source);

  if (!isValidId(offerId)) {
    return {
      ok: false,
      status: 400,
      message: "Invalid offer.",
      productPath: null,
    };
  }

  const offerResult = await input.dataSource.fetchOffer(offerId);

  if (offerResult.error) {
    return {
      ok: false,
      status: 503,
      message: "Unable to load offer.",
      productPath: null,
    };
  }

  const offer = offerResult.data;

  if (!offer || offer.in_stock !== true) {
    return {
      ok: false,
      status: 404,
      message: "Offer unavailable.",
      productPath: null,
    };
  }

  const productId = toIdString(offer.product_id);

  if (!productId) {
    return {
      ok: false,
      status: 404,
      message: "Offer unavailable.",
      productPath: null,
    };
  }

  const destinationUrl = validateRetailerDestinationUrl(offer.url);
  const productResult = await input.dataSource.fetchProduct(productId);
  const product = productResult.data;
  const fallbackProductPath = productPath(product);

  if (productResult.error) {
    return {
      ok: false,
      status: 503,
      message: "Unable to load product.",
      productPath: null,
    };
  }

  if (
    !product ||
    product.is_active !== true ||
    product.merged_into_product_id !== null
  ) {
    return {
      ok: false,
      status: 404,
      message: "Offer unavailable.",
      productPath: fallbackProductPath,
    };
  }

  if (!destinationUrl) {
    return {
      ok: false,
      status: 404,
      message: "Offer unavailable.",
      productPath: fallbackProductPath,
    };
  }

  const retailerId = toIdString(offer.retailer_id);
  const insertResult = await input.dataSource.insertClick({
    offer_id: offerId,
    product_id: productId,
    retailer_id: retailerId,
    destination_url: destinationUrl,
    source_page: source,
    ...input.diagnostics,
  });

  if (insertResult.error) {
    input.log?.error("Failed to record outbound click", insertResult.error);
  }

  return {
    ok: true,
    destinationUrl,
    clickInserted: !insertResult.error,
    clickInsertError: insertResult.error,
  };
}
