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
] as const;

export type OutboundClickSource = (typeof OUTBOUND_CLICK_SOURCES)[number];

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
