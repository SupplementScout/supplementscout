"use client";

export type AnalyticsEventMap = {
  view_product: {
    product_id: string;
    product_name: string;
    variant_id?: string;
    category?: string;
  };
  view_category: {
    category: string;
    source_page: string;
  };
  search: {
    result_count: number;
    has_filters: boolean;
    search_context: "site_search";
  };
  filter_used: {
    filter_name: "category" | "brand" | "retailer";
    filter_action: "apply" | "remove";
  };
  sort_used: {
    sort_option: "relevance" | "price_asc" | "price_desc" | "price_per_serving_asc";
  };
  retailer_offer_click: {
    product_id: string;
    product_name: string;
    variant_id?: string;
    category?: string;
    retailer_id?: string;
    retailer_name?: string;
    offer_price?: number;
    position: number;
    source_page: "product_best_offer" | "product_offer_list";
    is_affiliate: boolean;
  };
  no_results: {
    result_count: 0;
    has_filters: boolean;
    source_page: "search";
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
export const ANALYTICS_READY_EVENT = "supplementscout:analytics-ready";
export const ANALYTICS_EVENT_PARAMETER_KEYS = {
  view_product: ["product_id", "product_name", "variant_id", "category"],
  view_category: ["category", "source_page"],
  search: ["result_count", "has_filters", "search_context"],
  filter_used: ["filter_name", "filter_action"],
  sort_used: ["sort_option"],
  retailer_offer_click: ["product_id", "product_name", "variant_id", "category", "retailer_id", "retailer_name", "offer_price", "position", "source_page", "is_affiliate"],
  no_results: ["result_count", "has_filters", "source_page"],
} as const satisfies Record<AnalyticsEventName, readonly string[]>;
export type QueuedAnalyticsEvent = {
  [Name in AnalyticsEventName]: {
    name: Name;
    parameters: AnalyticsEventMap[Name];
  };
}[AnalyticsEventName];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __supplementScoutAnalyticsConsent?: "granted" | "denied";
    __supplementScoutAnalyticsReady?: boolean;
    __supplementScoutAnalyticsQueue?: QueuedAnalyticsEvent[];
  }
}

export function sendAnalyticsEvent<Name extends AnalyticsEventName>(
  name: Name,
  parameters: AnalyticsEventMap[Name]
) {
  if (typeof window === "undefined") return false;
  if (window.__supplementScoutAnalyticsConsent !== "granted") return false;

  try {
    const allowed = new Set<string>(ANALYTICS_EVENT_PARAMETER_KEYS[name]);
    const safeParameters = Object.fromEntries(
      Object.entries(parameters).filter(([key, value]) => allowed.has(key) && ["string", "number", "boolean"].includes(typeof value))
    ) as AnalyticsEventMap[Name];

    if (window.__supplementScoutAnalyticsReady && window.gtag) {
      window.gtag("event", name, safeParameters);
    } else {
      window.__supplementScoutAnalyticsQueue ||= [];
      window.__supplementScoutAnalyticsQueue.push({ name, parameters: safeParameters } as QueuedAnalyticsEvent);
    }

    return true;
  } catch {
    return false;
  }
}

export function flushAnalyticsQueue() {
  if (typeof window === "undefined" || !window.gtag) return;

  const queue = window.__supplementScoutAnalyticsQueue || [];
  window.__supplementScoutAnalyticsQueue = [];

  for (const event of queue) {
    try {
      window.gtag("event", event.name, event.parameters);
    } catch {
      // Analytics is deliberately best-effort and must never affect navigation.
    }
  }
}
