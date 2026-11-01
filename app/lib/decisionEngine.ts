import {
  isOfferFresh,
  MAXIMUM_CURRENT_OFFER_AGE_HOURS,
} from "./offerFreshness";
import { formatCurrency } from "./pricing";
import {
  SEARCH_RESULT_LOAD_LIMIT,
  searchProducts,
  type ProductSearchResult,
  type SearchFilters,
  type SearchSort,
} from "./products";
import type {
  SearchIntentPlan,
  SearchValueMetric,
  UnsupportedSearchClause,
} from "./searchIntent";

export type DecisionStatus =
  | "ANSWERED"
  | "NEEDS_CLARIFICATION"
  | "DATA_GAP"
  | "SAFETY_BOUNDARY";

export type DecisionPriority =
  | "LOWEST_DELIVERED_PRICE"
  | "LOWEST_PRICE_PER_SERVING"
  | "LOWEST_COST_PER_25G_PROTEIN"
  | "LOWEST_COST_PER_5G_CREATINE";

export type DecisionSource =
  | "direct"
  | "homepage"
  | "search"
  | "category"
  | "comparison";

export type DecisionSelectedProduct = {
  productId: string;
  variantId?: string | null;
};

export type DecisionRequest = {
  source: DecisionSource;
  intentPlan: SearchIntentPlan;
  primaryPriority: DecisionPriority | null;
  primaryPrioritySource: "query" | "url" | null;
  categoryContext: string | null;
  goalContext: string | null;
  selectedProducts: DecisionSelectedProduct[];
  shortlistLimit: 1 | 2 | 3;
  unsupportedNeeds: UnsupportedSearchClause[];
};

export type DecisionReasonType =
  | "lowest_delivered_price"
  | "lowest_price_per_serving"
  | "lowest_cost_per_25g_protein"
  | "lowest_cost_per_5g_creatine";

export type DecisionReason = {
  type: DecisionReasonType;
  label: string;
  value: number;
  display: string;
  evidenceBasis: string;
};

export type DecisionTradeOff = {
  type: "higher_upfront_price" | "fewer_servings" | "fewer_retailers";
  comparedToProductId: string;
  value: number;
  comparedValue: number;
};

export type DecisionShortlistItem = {
  rank: number;
  productId: string;
  variantId: string;
  slug: string | null;
  productHref: string;
  name: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  exactVariantLabel: string;
  primaryReason: DecisionReason;
  tradeOffs: DecisionTradeOff[];
  deliveredPrice: {
    productPrice: number;
    shippingCost: number;
    totalPrice: number;
    retailerName: string | null;
  };
  freshness: {
    state: "CURRENT";
    checkedAt: string;
    maximumAgeHours: number;
  };
  verifiedServingCount: number | null;
  proteinPerServingG: number | null;
  retailerCount: number;
  offerCount: number;
};

export type DecisionPriorityChoice = {
  priority: DecisionPriority;
  label: string;
};

export type DecisionClarification =
  | {
      kind: "PRIMARY_PRIORITY";
      question: "What matters most?";
      choices: DecisionPriorityChoice[];
      actionHref: null;
    }
  | {
      kind: "PRODUCT_CONTEXT";
      question: "Which two products do you want to compare?";
      choices: [];
      actionHref: "/compare";
    };

export type DecisionResult = {
  status: DecisionStatus;
  interpretedRequest: {
    query: string;
    textQuery: string;
    constraints: Array<{ key: string; label: string }>;
    primaryPriority: DecisionPriority | null;
    primaryPrioritySource: DecisionRequest["primaryPrioritySource"];
    categoryContext: string | null;
    goalContext: string | null;
  };
  candidateCount: number;
  eligibleCandidateCount: number;
  clarification: DecisionClarification | null;
  shortlist: DecisionShortlistItem[];
  unsupportedRequirements: UnsupportedSearchClause[];
  ineligible: Array<{ reason: string; count: number }>;
  message: string | null;
  comparisonHandoff: {
    href: string;
    label: string;
    priority: DecisionPriority | null;
  } | null;
};

type PriorityDefinition = {
  label: string;
  sort: SearchSort;
  valueMetric: SearchValueMetric | null;
  reasonType: DecisionReasonType;
  winnerReasonLabel: string;
  metricLabel: string;
  evidenceBasis: string;
};

export const DECISION_PRIORITY_DEFINITIONS: Record<
  DecisionPriority,
  PriorityDefinition
> = {
  LOWEST_DELIVERED_PRICE: {
    label: "Lowest delivered price",
    sort: "price_asc",
    valueMetric: null,
    reasonType: "lowest_delivered_price",
    winnerReasonLabel: "Lowest delivered price",
    metricLabel: "Delivered price",
    evidenceBasis: "Current product price plus known delivery for this variant.",
  },
  LOWEST_PRICE_PER_SERVING: {
    label: "Lowest cost per serving",
    sort: "price_per_serving_asc",
    valueMetric: "price_per_serving",
    reasonType: "lowest_price_per_serving",
    winnerReasonLabel: "Lowest cost per serving",
    metricLabel: "Cost per serving",
    evidenceBasis:
      "Current delivered price divided by the verified serving count for this variant.",
  },
  LOWEST_COST_PER_25G_PROTEIN: {
    label: "Lowest cost per 25 g protein",
    sort: "cost_per_25g_protein_asc",
    valueMetric: "cost_per_25g_protein",
    reasonType: "lowest_cost_per_25g_protein",
    winnerReasonLabel: "Lowest cost per 25 g protein",
    metricLabel: "Cost per 25 g protein",
    evidenceBasis:
      "Current delivered price and verified protein details for this variant.",
  },
  LOWEST_COST_PER_5G_CREATINE: {
    label: "Lowest cost per 5 g creatine",
    sort: "cost_per_5g_creatine_asc",
    valueMetric: "cost_per_5g_creatine",
    reasonType: "lowest_cost_per_5g_creatine",
    winnerReasonLabel: "Lowest cost per 5 g creatine",
    metricLabel: "Cost per 5 g creatine",
    evidenceBasis:
      "Current delivered price and verified creatine details for this variant.",
  },
};

const PRIORITY_URL_VALUES: Record<DecisionPriority, string> = {
  LOWEST_DELIVERED_PRICE: "lowest_delivered_price",
  LOWEST_PRICE_PER_SERVING: "lowest_price_per_serving",
  LOWEST_COST_PER_25G_PROTEIN: "lowest_cost_per_25g_protein",
  LOWEST_COST_PER_5G_CREATINE: "lowest_cost_per_5g_creatine",
};

const PRIORITY_BY_URL_VALUE = new Map(
  Object.entries(PRIORITY_URL_VALUES).flatMap(([priority, value]) => [
    [value, priority as DecisionPriority],
    [priority.toLowerCase(), priority as DecisionPriority],
  ])
);

const PROTEIN_CATEGORIES = new Set([
  "protein",
  "whey protein",
  "whey isolate",
  "vegan protein",
  "mass gainer",
  "protein bars",
]);

const MEDICAL_SAFETY_PATTERNS = [
  /\b(?:safe|suitable|best)\s+(?:for|during)\s+pregnan(?:cy|t)\b/i,
  /\b(?:diabetes|diabetic)\b/i,
  /\b(?:anxiety|depression)\b/i,
  /\b(?:high\s+blood\s+pressure|hypertension)\b/i,
  /\b(?:treat|cure|therapy|medical)\b[^.]{0,40}\binsomnia\b/i,
  /\b(?:medical\s+)?testosterone\s+(?:treatment|therapy)\b/i,
  /\b(?:drug|medication|prescription)\s+interactions?\b/i,
  /\binteractions?\s+with\s+(?:my\s+)?(?:drug|medication|prescription)\b/i,
];

const PERSONAL_SUITABILITY_PATTERNS = [
  /\bsensitive\s+stomach\b/i,
  /\bgentle\s+(?:on|for)\s+(?:the\s+)?stomach\b/i,
  /\beasy\s+(?:on|for)\s+(?:the\s+)?stomach\b/i,
];

const DIGESTIBILITY_PATTERN = /\b(?:digestibility|easy\s+to\s+digest)\b/i;

type DecisionCandidate = {
  product: ProductSearchResult;
  productId: string;
  variantId: string;
  exactVariantLabel: string;
  productHref: string;
  deliveredTotal: number;
  productPrice: number;
  shippingCost: number;
  retailerName: string | null;
  checkedAt: string;
  retailerCount: number;
  offerCount: number;
  verifiedServingCount: number | null;
  proteinPerServingG: number | null;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function normalizedContext(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ") || "";
  return normalized || null;
}
function positiveMetric(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toPence(value: number) {
  return Math.round(value * 100);
}

function stableIdCompare(left: string, right: string) {
  return left.localeCompare(right, "en", { numeric: true });
}

function normalizedCategory(product: ProductSearchResult) {
  return product.category?.trim().toLowerCase() || "";
}

function isExactPositiveId(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function normalizedSelectedProducts(
  products: DecisionSelectedProduct[] | undefined
) {
  const normalized: DecisionSelectedProduct[] = [];
  for (const product of products || []) {
    if (!isExactPositiveId(product.productId)) continue;
    const variantId = isExactPositiveId(product.variantId || null)
      ? product.variantId || null
      : null;
    if (normalized.some(({ productId }) => productId === product.productId)) continue;
    normalized.push({ productId: product.productId, variantId });
    if (normalized.length === 2) break;
  }
  return normalized;
}

function isTwoProductRequest(query: string) {
  return (
    /\b(?:these|those)\s+two\b/i.test(query) ||
    /\bcompare\s+(?:these\s+)?two\b/i.test(query) ||
    /\bbetter\s+of\b/i.test(query)
  );
}

function comparisonHref(selectedProducts: DecisionSelectedProduct[]) {
  const [left, right] = selectedProducts;
  const params = new URLSearchParams({
    left: left.productId,
    right: right.productId,
  });
  return `/compare?${params.toString()}`;
}

function boundaryStatus(request: DecisionRequest) {
  const query = request.intentPlan.rawQuery;
  if (
    request.unsupportedNeeds.some(({ key }) => key === "sensitive_stomach") ||
    PERSONAL_SUITABILITY_PATTERNS.some((pattern) => pattern.test(query))
  ) {
    return {
      status: "SAFETY_BOUNDARY" as const,
      message:
        "SupplementScout does not rank products for personal stomach suitability. You can search again using verified shopping criteria such as price, servings or format.",
    };
  }
  if (MEDICAL_SAFETY_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      status: "SAFETY_BOUNDARY" as const,
      message:
        "SupplementScout does not rank products for personal medical suitability. You can search again using non-medical shopping criteria.",
    };
  }
  if (
    request.unsupportedNeeds.some(({ key }) => key !== "sensitive_stomach") ||
    DIGESTIBILITY_PATTERN.test(query)
  ) {
    const labels = request.unsupportedNeeds
      .filter(({ key }) => key !== "sensitive_stomach")
      .map(({ label }) => label.toLowerCase());
    if (DIGESTIBILITY_PATTERN.test(query)) labels.push("digestibility");
    const uniqueLabels = Array.from(new Set(labels));
    return {
      status: "DATA_GAP" as const,
      message: `We understood the request, but do not yet have enough verified ${uniqueLabels.join(
        " and "
      )} data to claim that products meet that requirement.`,
    };
  }
  return null;
}

function resultBase(request: DecisionRequest): DecisionResult {
  return {
    status: "DATA_GAP",
    interpretedRequest: {
      query: request.intentPlan.rawQuery,
      textQuery: request.intentPlan.textQuery,
      constraints: request.intentPlan.appliedConstraints
        .filter(({ key }) => key !== "sort")
        .map(({ key, label }) => ({ key, label })),
      primaryPriority: request.primaryPriority,
      primaryPrioritySource: request.primaryPrioritySource,
      categoryContext: request.categoryContext,
      goalContext: request.goalContext,
    },
    candidateCount: 0,
    eligibleCandidateCount: 0,
    clarification: null,
    shortlist: [],
    unsupportedRequirements: request.unsupportedNeeds,
    ineligible: [],
    message: null,
    comparisonHandoff: null,
  };
}

export function normalizeDecisionPriority(
  value: string | string[] | undefined
): DecisionPriority | null {
  const normalized = firstValue(value)?.trim().toLowerCase() || "";
  return PRIORITY_BY_URL_VALUE.get(normalized) || null;
}

export function decisionPriorityUrlValue(priority: DecisionPriority) {
  return PRIORITY_URL_VALUES[priority];
}

export function inferDecisionPriority(plan: SearchIntentPlan) {
  if (plan.sort === "price_asc") return "LOWEST_DELIVERED_PRICE" as const;
  if (plan.sort === "price_per_serving_asc") {
    return "LOWEST_PRICE_PER_SERVING" as const;
  }
  if (plan.sort === "cost_per_25g_protein_asc") {
    return "LOWEST_COST_PER_25G_PROTEIN" as const;
  }
  if (plan.sort === "cost_per_5g_creatine_asc") {
    return "LOWEST_COST_PER_5G_CREATINE" as const;
  }
  return null;
}

export function createDecisionRequest(options: {
  source?: DecisionSource;
  intentPlan: SearchIntentPlan;
  explicitPriority?: DecisionPriority | null;
  categoryContext?: string | null;
  goalContext?: string | null;
  selectedProducts?: DecisionSelectedProduct[];
  shortlistLimit?: number;
}): DecisionRequest {
  const inferredPriority = inferDecisionPriority(options.intentPlan);
  const explicitPriority = options.explicitPriority || null;
  const rawLimit = Number.isInteger(options.shortlistLimit)
    ? Number(options.shortlistLimit)
    : 3;
  const shortlistLimit = Math.min(3, Math.max(1, rawLimit)) as 1 | 2 | 3;

  return {
    source: options.source || "direct",
    intentPlan: options.intentPlan,
    primaryPriority: explicitPriority || inferredPriority,
    primaryPrioritySource: explicitPriority
      ? "url"
      : inferredPriority
        ? "query"
        : null,
    categoryContext: normalizedContext(options.categoryContext),
    goalContext: normalizedContext(options.goalContext),
    selectedProducts: normalizedSelectedProducts(options.selectedProducts),
    shortlistLimit,
    unsupportedNeeds: options.intentPlan.unsupportedClauses,
  };
}

function decisionIntentPlan(
  plan: SearchIntentPlan,
  priority: DecisionPriority | null
): SearchIntentPlan {
  if (!priority) return plan;
  const definition = DECISION_PRIORITY_DEFINITIONS[priority];
  return {
    ...plan,
    sort: definition.sort,
    valueMetric: definition.valueMetric,
  };
}

export function decisionProductHref(
  product: Pick<ProductSearchResult, "id" | "slug">,
  variantId: string
) {
  const base = `/product/${product.slug || product.id}`;
  return `${base}?variant=${encodeURIComponent(variantId)}#retailer-offers`;
}

function toDecisionCandidate(
  product: ProductSearchResult,
  now: Date
): DecisionCandidate | null {
  const offer = product.cheapestOffer;
  if (!offer?.deliveredPrice || !isExactPositiveId(offer.product_variant_id)) {
    return null;
  }
  if (
    product.selectedVariantId &&
    product.selectedVariantId !== offer.product_variant_id
  ) {
    return null;
  }
  if (!offer.last_checked_at || !isOfferFresh(offer.last_checked_at, now)) {
    return null;
  }

  const variantId = offer.product_variant_id;
  const exactVariantOffers = product.validOffers.filter(
    (candidate) =>
      candidate.product_variant_id === variantId &&
      candidate.deliveredPrice !== null &&
      candidate.last_checked_at !== null &&
      isOfferFresh(candidate.last_checked_at, now)
  );
  const retailerCount = new Set(
    exactVariantOffers.map(({ retailer }) => retailer?.id || "").filter(Boolean)
  ).size;
  const exactVariantLabel =
    offer.product_variant?.display_name?.trim() ||
    offer.product_variant?.flavour_label?.trim() ||
    product.selectedVariantLabel?.trim() ||
    `Exact variant ${variantId}`;

  return {
    product,
    productId: product.id,
    variantId,
    exactVariantLabel,
    productHref: decisionProductHref(product, variantId),
    deliveredTotal: offer.deliveredPrice.totalPrice,
    productPrice: offer.deliveredPrice.productPrice,
    shippingCost: offer.deliveredPrice.shippingCost,
    retailerName: offer.retailer?.name || null,
    checkedAt: offer.last_checked_at,
    retailerCount,
    offerCount: exactVariantOffers.length,
    verifiedServingCount: positiveMetric(product.serving_count_verified),
    proteinPerServingG:
      product.nutrition_verified === true
        ? positiveMetric(product.protein_per_serving_g)
        : null,
  };
}

function metricForPriority(
  candidate: DecisionCandidate,
  priority: DecisionPriority
) {
  if (priority === "LOWEST_DELIVERED_PRICE") {
    return candidate.deliveredTotal;
  }
  if (priority === "LOWEST_PRICE_PER_SERVING") {
    return positiveMetric(candidate.product.verifiedPricePerServing);
  }
  if (priority === "LOWEST_COST_PER_25G_PROTEIN") {
    return PROTEIN_CATEGORIES.has(normalizedCategory(candidate.product))
      ? positiveMetric(candidate.product.verifiedCostPer25gProtein)
      : null;
  }
  return normalizedCategory(candidate.product) === "creatine"
    ? positiveMetric(candidate.product.verifiedCostPer5gCreatine)
    : null;
}

function applicablePriorityChoices(candidates: DecisionCandidate[]) {
  return (Object.keys(DECISION_PRIORITY_DEFINITIONS) as DecisionPriority[])
    .filter(
      (priority) =>
        candidates.filter(
          (candidate) => metricForPriority(candidate, priority) !== null
        ).length >= 2
    )
    .map((priority) => ({
      priority,
      label: DECISION_PRIORITY_DEFINITIONS[priority].label,
    }));
}

function sortCandidates(
  candidates: DecisionCandidate[],
  priority: DecisionPriority
) {
  return [...candidates].sort((left, right) => {
    const primaryDifference =
      (metricForPriority(left, priority) as number) -
      (metricForPriority(right, priority) as number);
    return (
      primaryDifference ||
      left.deliveredTotal - right.deliveredTotal ||
      right.retailerCount - left.retailerCount ||
      right.offerCount - left.offerCount ||
      left.product.name.localeCompare(right.product.name) ||
      stableIdCompare(left.productId, right.productId) ||
      stableIdCompare(left.variantId, right.variantId)
    );
  });
}

function reasonForCandidate(
  candidate: DecisionCandidate,
  priority: DecisionPriority,
  rank: number
): DecisionReason {
  const definition = DECISION_PRIORITY_DEFINITIONS[priority];
  const value = metricForPriority(candidate, priority) as number;
  const suffix =
    priority === "LOWEST_DELIVERED_PRICE"
      ? " delivered"
      : priority === "LOWEST_PRICE_PER_SERVING"
        ? " per serving"
        : priority === "LOWEST_COST_PER_25G_PROTEIN"
          ? " per 25 g protein"
          : " per 5 g creatine";
  return {
    type: definition.reasonType,
    label:
      rank === 1 ? definition.winnerReasonLabel : definition.metricLabel,
    value,
    display: `${formatCurrency(value)}${suffix}`,
    evidenceBasis: definition.evidenceBasis,
  };
}

function shortlistItem(
  candidate: DecisionCandidate,
  priority: DecisionPriority,
  rank: number
): DecisionShortlistItem {
  return {
    rank,
    productId: candidate.productId,
    variantId: candidate.variantId,
    slug: candidate.product.slug,
    productHref: candidate.productHref,
    name: candidate.product.name,
    brand: candidate.product.brand,
    category: candidate.product.category,
    image: candidate.product.image,
    exactVariantLabel: candidate.exactVariantLabel,
    primaryReason: reasonForCandidate(candidate, priority, rank),
    tradeOffs: [],
    deliveredPrice: {
      productPrice: candidate.productPrice,
      shippingCost: candidate.shippingCost,
      totalPrice: candidate.deliveredTotal,
      retailerName: candidate.retailerName,
    },
    freshness: {
      state: "CURRENT",
      checkedAt: candidate.checkedAt,
      maximumAgeHours: MAXIMUM_CURRENT_OFFER_AGE_HOURS,
    },
    verifiedServingCount: candidate.verifiedServingCount,
    proteinPerServingG: candidate.proteinPerServingG,
    retailerCount: candidate.retailerCount,
    offerCount: candidate.offerCount,
  };
}

function addTradeOffs(items: DecisionShortlistItem[]) {
  if (items.length < 2) return items;
  const cheapest = [...items].sort(
    (left, right) =>
      toPence(left.deliveredPrice.totalPrice) -
        toPence(right.deliveredPrice.totalPrice) ||
      stableIdCompare(left.productId, right.productId)
  )[0];
  const cheapestPence = toPence(cheapest.deliveredPrice.totalPrice);
  const mostServings = [...items]
    .filter(({ verifiedServingCount }) => verifiedServingCount !== null)
    .sort(
      (left, right) =>
        (right.verifiedServingCount as number) -
          (left.verifiedServingCount as number) ||
        stableIdCompare(left.productId, right.productId)
    )[0];
  const mostRetailers = [...items].sort(
    (left, right) =>
      right.retailerCount - left.retailerCount ||
      stableIdCompare(left.productId, right.productId)
  )[0];

  return items.map((item) => {
    const tradeOffs: DecisionTradeOff[] = [];
    const itemPence = toPence(item.deliveredPrice.totalPrice);
    if (itemPence > cheapestPence) {
      tradeOffs.push({
        type: "higher_upfront_price",
        comparedToProductId: cheapest.productId,
        value: itemPence / 100,
        comparedValue: cheapestPence / 100,
      });
    }
    if (
      tradeOffs.length < 2 &&
      mostServings &&
      item.productId !== mostServings.productId &&
      item.verifiedServingCount !== null &&
      mostServings.verifiedServingCount !== null &&
      item.verifiedServingCount < mostServings.verifiedServingCount
    ) {
      tradeOffs.push({
        type: "fewer_servings",
        comparedToProductId: mostServings.productId,
        value: item.verifiedServingCount,
        comparedValue: mostServings.verifiedServingCount,
      });
    }
    if (
      tradeOffs.length < 2 &&
      item.productId !== mostRetailers.productId &&
      item.retailerCount < mostRetailers.retailerCount
    ) {
      tradeOffs.push({
        type: "fewer_retailers",
        comparedToProductId: mostRetailers.productId,
        value: item.retailerCount,
        comparedValue: mostRetailers.retailerCount,
      });
    }
    return { ...item, tradeOffs };
  });
}

export async function runDecisionEngine(
  request: DecisionRequest,
  options: {
    now?: Date;
    search?: typeof searchProducts;
  } = {}
): Promise<DecisionResult> {
  const base = resultBase(request);
  const boundary = boundaryStatus(request);
  if (boundary) {
    return { ...base, status: boundary.status, message: boundary.message };
  }

  if (isTwoProductRequest(request.intentPlan.rawQuery)) {
    if (request.selectedProducts.length !== 2) {
      return {
        ...base,
        status: "NEEDS_CLARIFICATION",
        clarification: {
          kind: "PRODUCT_CONTEXT",
          question: "Which two products do you want to compare?",
          choices: [],
          actionHref: "/compare",
        },
        message:
          "Choose two products first. Product Comparison will apply its existing exact-pack metric contract.",
      };
    }
    return {
      ...base,
      status: "ANSWERED",
      message:
        "Use Product Comparison for an evidence-backed side-by-side answer. The decision tool does not create a second two-product engine.",
      comparisonHandoff: {
        href: comparisonHref(request.selectedProducts),
        label: "Compare these products",
        priority: request.primaryPriority,
      },
    };
  }

  if (!request.intentPlan.textQuery) {
    return {
      ...base,
      status: "DATA_GAP",
      message: "Tell us which supplement or category you want to compare.",
    };
  }

  const search = options.search || searchProducts;
  const intentPlan = decisionIntentPlan(
    request.intentPlan,
    request.primaryPriority
  );
  const filters: SearchFilters = {
    category: request.categoryContext || "",
    brand: "",
    retailer: "",
    caffeine: "",
  };
  const searchResult = await search(
    request.intentPlan.rawQuery,
    intentPlan.sort,
    filters,
    1,
    { intentPlan, pageSize: SEARCH_RESULT_LOAD_LIMIT }
  );
  if (searchResult.error) {
    return {
      ...base,
      status: "DATA_GAP",
      message:
        "Current product evidence is temporarily unavailable, so no recommendation is being claimed.",
    };
  }

  const now = options.now || new Date();
  const candidates = searchResult.results
    .map((product) => toDecisionCandidate(product, now))
    .filter((candidate): candidate is DecisionCandidate => candidate !== null);
  const exactVariantExcludedCount = Math.max(
    0,
    searchResult.totalCount - candidates.length
  );
  const withCandidateCounts: DecisionResult = {
    ...base,
    candidateCount: candidates.length,
    ineligible:
      exactVariantExcludedCount > 0
        ? [
            {
              reason:
                "No current offer with a complete delivered price for this variant",
              count: exactVariantExcludedCount,
            },
          ]
        : [],
  };

  if (candidates.length === 0) {
    return {
      ...withCandidateCounts,
      status: "DATA_GAP",
      message:
        "No current products meet every requirement with a known delivered price.",
    };
  }

  const applicablePriorities = applicablePriorityChoices(candidates);
  if (
    !request.primaryPriority &&
    candidates.length > 1 &&
    applicablePriorities.length > 1
  ) {
    return {
      ...withCandidateCounts,
      status: "NEEDS_CLARIFICATION",
      clarification: {
        kind: "PRIMARY_PRIORITY",
        question: "What matters most?",
        choices: applicablePriorities,
        actionHref: null,
      },
      message: "Choose one priority so the shortlist has one clear ordering rule.",
    };
  }

  const resolvedPriority =
    request.primaryPriority ||
    applicablePriorities[0]?.priority ||
    "LOWEST_DELIVERED_PRICE";
  const eligible = candidates.filter(
    (candidate) => metricForPriority(candidate, resolvedPriority) !== null
  );
  const missingMetricCount = candidates.length - eligible.length;
  if (eligible.length === 0) {
    return {
      ...withCandidateCounts,
      status: "DATA_GAP",
      message: `No current products have the verified details required for ${DECISION_PRIORITY_DEFINITIONS[
        resolvedPriority
      ].label.toLowerCase()}.`,
      ineligible: [
        ...withCandidateCounts.ineligible,
        {
          reason: `Missing verified details for ${DECISION_PRIORITY_DEFINITIONS[resolvedPriority].label}`,
          count: missingMetricCount,
        },
      ],
    };
  }

  const ordered = sortCandidates(eligible, resolvedPriority);
  const shortlist = addTradeOffs(
    ordered
      .slice(0, request.shortlistLimit)
      .map((candidate, index) =>
        shortlistItem(candidate, resolvedPriority, index + 1)
      )
  );

  return {
    ...withCandidateCounts,
    status: "ANSWERED",
    interpretedRequest: {
      ...withCandidateCounts.interpretedRequest,
      primaryPriority: resolvedPriority,
      primaryPrioritySource: request.primaryPrioritySource,
    },
    eligibleCandidateCount: eligible.length,
    shortlist,
    ineligible:
      missingMetricCount > 0
        ? [
            ...withCandidateCounts.ineligible,
            {
              reason: `Missing verified details for ${DECISION_PRIORITY_DEFINITIONS[resolvedPriority].label}`,
              count: missingMetricCount,
            },
          ]
        : withCandidateCounts.ineligible,
    message: null,
  };
}
