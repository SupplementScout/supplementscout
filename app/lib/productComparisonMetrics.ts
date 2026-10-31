import { formatCurrency, formatUnitPrice } from "./pricing";
import type {
  ComparisonPriceHistorySummary,
  TwoProductComparisonRow,
  TwoProductPriceHistory,
} from "./twoProductComparison";
import type { AppliedPreWorkoutFactKey } from "./reviewedPreWorkoutFacts";

export type ComparisonDirection =
  | "LOWER_IS_BETTER"
  | "HIGHER_IS_BETTER"
  | "INFORMATION_ONLY";

export type ProductComparisonMetricValue = {
  display: string;
  numeric: number | null;
};

export type ProductComparisonMetric = {
  key: string;
  section: "price" | "pack" | "supplement";
  label: string;
  direction: ComparisonDirection;
  explanation: string | null;
  left: ProductComparisonMetricValue | null;
  right: ProductComparisonMetricValue | null;
  outcome: "left" | "right" | "tie" | null;
  winnerLabel: string | null;
  tieLabel: string | null;
  verdictLabel: string | null;
  verdictPriority: number;
};

type ComparisonContext = {
  left: TwoProductComparisonRow;
  right: TwoProductComparisonRow;
  history: TwoProductPriceHistory;
  categoryGroup: string | null;
  deliveryComparisonComplete: boolean;
};

type MetricDefinition = {
  key: string;
  section: ProductComparisonMetric["section"];
  label: string | ((context: ComparisonContext) => string);
  direction: ComparisonDirection;
  applies?: (context: ComparisonContext) => boolean;
  resolve: (
    row: TwoProductComparisonRow,
    context: ComparisonContext
  ) => ProductComparisonMetricValue | null;
  tolerance?: number;
  explanation?: string | ((context: ComparisonContext) => string);
  winnerLabel?: string | ((context: ComparisonContext) => string);
  tieLabel?: string;
  verdictLabel?: string | ((context: ComparisonContext) => string);
  verdictPriority?: number;
};

const PROTEIN_CATEGORIES = new Set([
  "protein",
  "whey protein",
  "whey isolate",
  "vegan protein",
  "mass gainer",
  "protein bars",
]);

function normalizedCategory(row: TwoProductComparisonRow) {
  return row.category?.trim().toLowerCase() || null;
}

export function productComparisonCategoryGroup(
  row: TwoProductComparisonRow
) {
  const category = normalizedCategory(row);
  if (!category) return null;
  if (PROTEIN_CATEGORIES.has(category)) return "protein";
  if (category === "creatine") return "creatine";
  if (category === "pre workout") return "pre_workout";
  return `category:${category}`;
}

export function isCrossCategoryComparison(
  left: TwoProductComparisonRow,
  right: TwoProductComparisonRow
) {
  const leftGroup = productComparisonCategoryGroup(left);
  const rightGroup = productComparisonCategoryGroup(right);
  return leftGroup !== null && rightGroup !== null && leftGroup !== rightGroup;
}

function numericValue(
  numeric: number | null | undefined,
  format: (value: number) => string
) {
  return numeric === null || numeric === undefined || !Number.isFinite(numeric)
    ? null
    : { numeric, display: format(numeric) };
}

function textValue(display: string | null | undefined) {
  return display ? { numeric: null, display } : null;
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString("en-GB", { maximumFractionDigits });
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(value, 0)} ${value === 1 ? singular : plural}`;
}

function deliveryComplete(row: TwoProductComparisonRow) {
  return (
    row.offers.length > 0 &&
    row.offers.every((offer) => offer.deliveredPrice !== null)
  );
}

function historyValue(summary: ComparisonPriceHistorySummary | null) {
  if (!summary) return null;
  const date = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(value));
  const period = summary.firstRecordedAt === summary.lastRecordedAt
    ? date(summary.firstRecordedAt)
    : `${date(summary.firstRecordedAt)} to ${date(summary.lastRecordedAt)}`;
  return {
    numeric: summary.lowestDeliveredPrice,
    display: `${formatCurrency(summary.lowestDeliveredPrice)} · ${formatCount(
      summary.recordCount,
      "record"
    )} · ${period}`,
  };
}

function preWorkoutFactValue(
  row: TwoProductComparisonRow,
  key: AppliedPreWorkoutFactKey
) {
  const fact = row.preWorkoutFacts?.facts.find((candidate) => candidate.key === key);
  if (!fact) return null;
  if (fact.informationState === "confirmed_absent") {
    return { numeric: 0, display: "Confirmed absent" };
  }
  if (fact.informationState === "present_amount_not_disclosed") {
    return { numeric: null, display: "Present · amount not disclosed" };
  }
  if (fact.informationState === "conflicting_information") {
    return { numeric: null, display: "Conflicting information" };
  }
  if (fact.informationState === "no_information") return null;
  return numericValue(fact.amountPerServingMg, (value) =>
    value >= 1000
      ? `${formatNumber(value / 1000, 3)} g per serving`
      : `${formatNumber(value, 1)} mg per serving`
  );
}

function sameCategoryGroup(context: ComparisonContext, group: string) {
  return context.categoryGroup === group;
}

function knownDeliveredLabel(context: ComparisonContext, complete: string, known: string) {
  return context.deliveryComparisonComplete ? complete : known;
}

export const PRODUCT_COMPARISON_METRIC_REGISTRY: readonly MetricDefinition[] = [
  {
    key: "product_price",
    section: "price",
    label: "Product price",
    direction: "LOWER_IS_BETTER",
    resolve: (row) => numericValue(row.bestOffer?.productPrice, formatCurrency),
    tolerance: 0.005,
    winnerLabel: "Lower product price",
    tieLabel: "Same product price",
    verdictLabel: "Lower product price before delivery",
    verdictPriority: 50,
  },
  {
    key: "delivery",
    section: "price",
    label: "Delivery",
    direction: "LOWER_IS_BETTER",
    resolve: (row) => {
      if (!row.bestOffer) return null;
      return row.bestOffer.shippingCost === null
        ? textValue("Calculated by retailer")
        : numericValue(row.bestOffer.shippingCost, (value) =>
            value === 0 ? "Free delivery" : formatCurrency(value)
          );
    },
    tolerance: 0.005,
    winnerLabel: "Lower delivery cost",
    tieLabel: "Same delivery cost",
    verdictPriority: 80,
  },
  {
    key: "delivered_total",
    section: "price",
    label: (context) =>
      knownDeliveredLabel(context, "Total delivered price", "Known delivered total"),
    direction: "LOWER_IS_BETTER",
    resolve: (row) =>
      row.bestOffer?.deliveredPrice
        ? numericValue(row.bestOffer.deliveredPrice.totalPrice, formatCurrency)
        : row.bestOffer
          ? textValue("Delivery calculated by retailer")
          : null,
    tolerance: 0.005,
    winnerLabel: (context) =>
      knownDeliveredLabel(context, "Lower delivered price", "Lower known delivered total"),
    tieLabel: "Same delivered total",
    verdictLabel: (context) =>
      knownDeliveredLabel(context, "Lower delivered price", "Lower known delivered total"),
    verdictPriority: 10,
  },
  {
    key: "retailer_count",
    section: "price",
    label: "Current retailer choice",
    direction: "HIGHER_IS_BETTER",
    resolve: (row) =>
      row.retailerCount > 0
        ? numericValue(row.retailerCount, (value) => formatCount(value, "retailer"))
        : textValue("No current retailer offer"),
    winnerLabel: "More retailer choice",
    tieLabel: "Same retailer choice",
    verdictLabel: "More current retailer choice",
    verdictPriority: 60,
  },
  {
    key: "exact_pack",
    section: "pack",
    label: "Pack size",
    direction: "INFORMATION_ONLY",
    resolve: (row) => textValue(row.exactPackLabel),
  },
  {
    key: "servings",
    section: "pack",
    label: "Verified servings",
    direction: "INFORMATION_ONLY",
    resolve: (row) =>
      numericValue(row.verifiedServingCount, (value) => formatCount(value, "serving")),
  },
  {
    key: "price_per_serving",
    section: "price",
    label: (context) =>
      knownDeliveredLabel(
        context,
        "Delivered cost per serving",
        "Known delivered cost per serving"
      ),
    direction: "LOWER_IS_BETTER",
    resolve: (row) => numericValue(row.pricePerServing, formatUnitPrice),
    tolerance: 0.005,
    explanation:
      "Selected offer delivered total divided by the verified serving count for this exact variant.",
    winnerLabel: "Lower cost per serving",
    tieLabel: "Same cost per serving",
    verdictLabel: "Lower cost per serving",
    verdictPriority: 20,
  },
  {
    key: "price_per_kg",
    section: "price",
    label: "Delivered price per kilogram",
    direction: "LOWER_IS_BETTER",
    resolve: (row) => numericValue(row.pricePerKg, formatCurrency),
    tolerance: 0.005,
    winnerLabel: "Lower price per kilogram",
    tieLabel: "Same price per kilogram",
    verdictLabel: "Lower price per kilogram",
    verdictPriority: 40,
  },
  {
    key: "price_per_litre",
    section: "price",
    label: "Delivered price per litre",
    direction: "LOWER_IS_BETTER",
    resolve: (row) => numericValue(row.pricePerLitre, formatCurrency),
    tolerance: 0.005,
    winnerLabel: "Lower price per litre",
    tieLabel: "Same price per litre",
    verdictLabel: "Lower price per litre",
    verdictPriority: 40,
  },
  {
    key: "price_per_unit",
    section: "price",
    label: (context) => {
      const unit = context.left.pricePerUnit?.unitType || context.right.pricePerUnit?.unitType;
      return `Delivered price per ${unit || "unit"}`;
    },
    direction: "LOWER_IS_BETTER",
    applies: (context) => {
      const units = new Set(
        [context.left.pricePerUnit?.unitType, context.right.pricePerUnit?.unitType].filter(Boolean)
      );
      return units.size === 1;
    },
    resolve: (row) => numericValue(row.pricePerUnit?.price, formatUnitPrice),
    tolerance: 0.005,
    winnerLabel: "Lower price per unit",
    tieLabel: "Same price per unit",
    verdictLabel: "Lower price per capsule or tablet",
    verdictPriority: 40,
  },
  {
    key: "price_history_low",
    section: "price",
    label: "Lowest recorded delivered price",
    direction: "INFORMATION_ONLY",
    resolve: (row, context) => historyValue(context.history[row.id] || null),
    explanation:
      "Lowest recorded delivered total for current offers of the selected exact variant; history periods may differ.",
  },
  {
    key: "protein_per_serving",
    section: "supplement",
    label: "Protein per serving",
    direction: "HIGHER_IS_BETTER",
    applies: (context) => sameCategoryGroup(context, "protein"),
    resolve: (row) =>
      numericValue(row.proteinPerServingG, (value) => `${formatNumber(value, 1)} g`),
    tolerance: 0.05,
    winnerLabel: "More protein per serving",
    tieLabel: "Similar protein per serving",
    verdictLabel: "More verified protein per serving",
    verdictPriority: 35,
  },
  {
    key: "cost_per_25g_protein",
    section: "supplement",
    label: "Delivered cost per 25 g protein",
    direction: "LOWER_IS_BETTER",
    applies: (context) => sameCategoryGroup(context, "protein"),
    resolve: (row) => numericValue(row.costPer25gProtein, formatCurrency),
    tolerance: 0.005,
    explanation:
      "Selected offer delivered total divided by verified protein across the pack, then normalised to 25 g protein.",
    winnerLabel: "Lower cost per 25 g protein",
    tieLabel: "Same cost per 25 g protein",
    verdictLabel: "Lower cost per 25 g protein",
    verdictPriority: 25,
  },
  {
    key: "creatine_per_serving",
    section: "supplement",
    label: "Creatine per serving",
    direction: "INFORMATION_ONLY",
    applies: (context) => sameCategoryGroup(context, "creatine"),
    resolve: (row) =>
      numericValue(row.creatinePerServingG, (value) => `${formatNumber(value, 1)} g`),
  },
  {
    key: "cost_per_5g_creatine",
    section: "supplement",
    label: "Delivered cost per 5 g creatine",
    direction: "LOWER_IS_BETTER",
    applies: (context) => sameCategoryGroup(context, "creatine"),
    resolve: (row) => numericValue(row.costPer5gCreatine, formatCurrency),
    tolerance: 0.005,
    explanation:
      "Selected offer delivered total divided by verified creatine across the pack, then normalised to 5 g creatine.",
    winnerLabel: "Lower cost per 5 g creatine",
    tieLabel: "Same cost per 5 g creatine",
    verdictLabel: "Lower cost per 5 g creatine",
    verdictPriority: 25,
  },
  {
    key: "caffeine_per_serving",
    section: "supplement",
    label: "Caffeine",
    direction: "INFORMATION_ONLY",
    applies: (context) => sameCategoryGroup(context, "pre_workout"),
    resolve: (row) => preWorkoutFactValue(row, "caffeine"),
  },
  {
    key: "citrulline_per_serving",
    section: "supplement",
    label: "Citrulline",
    direction: "INFORMATION_ONLY",
    applies: (context) => sameCategoryGroup(context, "pre_workout"),
    resolve: (row) => preWorkoutFactValue(row, "citrulline"),
  },
  {
    key: "beta_alanine_per_serving",
    section: "supplement",
    label: "Beta-alanine",
    direction: "INFORMATION_ONLY",
    applies: (context) => sameCategoryGroup(context, "pre_workout"),
    resolve: (row) => preWorkoutFactValue(row, "beta_alanine"),
  },
  {
    key: "preworkout_creatine_per_serving",
    section: "supplement",
    label: "Creatine",
    direction: "INFORMATION_ONLY",
    applies: (context) => sameCategoryGroup(context, "pre_workout"),
    resolve: (row) => preWorkoutFactValue(row, "creatine"),
  },
] as const;

function resolvedText(
  value: string | ((context: ComparisonContext) => string) | undefined,
  context: ComparisonContext
) {
  return typeof value === "function" ? value(context) : value || null;
}

function metricOutcome(
  definition: MetricDefinition,
  left: ProductComparisonMetricValue | null,
  right: ProductComparisonMetricValue | null
): ProductComparisonMetric["outcome"] {
  if (
    definition.direction === "INFORMATION_ONLY" ||
    left?.numeric === null ||
    left?.numeric === undefined ||
    right?.numeric === null ||
    right?.numeric === undefined
  ) {
    return null;
  }
  const difference = left.numeric - right.numeric;
  if (Math.abs(difference) <= (definition.tolerance || 0)) return "tie";
  if (definition.direction === "LOWER_IS_BETTER") {
    return difference < 0 ? "left" : "right";
  }
  return difference > 0 ? "left" : "right";
}

export function buildProductComparisonMetrics(
  left: TwoProductComparisonRow,
  right: TwoProductComparisonRow,
  history: TwoProductPriceHistory = {}
) {
  const leftGroup = productComparisonCategoryGroup(left);
  const rightGroup = productComparisonCategoryGroup(right);
  const context: ComparisonContext = {
    left,
    right,
    history,
    categoryGroup: leftGroup !== null && leftGroup === rightGroup ? leftGroup : null,
    deliveryComparisonComplete: deliveryComplete(left) && deliveryComplete(right),
  };

  return PRODUCT_COMPARISON_METRIC_REGISTRY.flatMap(
    (definition): ProductComparisonMetric[] => {
      if (definition.applies && !definition.applies(context)) return [];
      const leftValue = definition.resolve(left, context);
      const rightValue = definition.resolve(right, context);
      if (!leftValue && !rightValue) return [];
      const outcome = metricOutcome(definition, leftValue, rightValue);
      return [
        {
          key: definition.key,
          section: definition.section,
          label: resolvedText(definition.label, context) || definition.key,
          direction: definition.direction,
          explanation: resolvedText(definition.explanation, context),
          left: leftValue,
          right: rightValue,
          outcome,
          winnerLabel: outcome === "left" || outcome === "right"
            ? resolvedText(definition.winnerLabel, context)
            : null,
          tieLabel: outcome === "tie" ? definition.tieLabel || "No meaningful difference" : null,
          verdictLabel: resolvedText(definition.verdictLabel, context),
          verdictPriority: definition.verdictPriority || 100,
        },
      ];
    }
  );
}

export function buildQuickComparisonVerdict(
  metrics: ProductComparisonMetric[]
) {
  const candidates = metrics
    .filter(
      (metric) =>
        (metric.outcome === "left" || metric.outcome === "right") &&
        metric.verdictLabel
    )
    .sort(
      (left, right) =>
        left.verdictPriority - right.verdictPriority ||
        left.key.localeCompare(right.key)
    );

  return {
    left: candidates
      .filter((metric) => metric.outcome === "left")
      .slice(0, 3)
      .map((metric) => metric.verdictLabel as string),
    right: candidates
      .filter((metric) => metric.outcome === "right")
      .slice(0, 3)
      .map((metric) => metric.verdictLabel as string),
  };
}
