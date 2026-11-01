export type IntentSearchSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "price_per_serving_asc"
  | "cost_per_25g_protein_asc"
  | "cost_per_5g_creatine_asc";

export type SearchValueMetric =
  | "price_per_serving"
  | "cost_per_25g_protein"
  | "cost_per_5g_creatine";

export type ReviewedSearchIngredient =
  | "citrulline"
  | "beta_alanine"
  | "creatine"
  | "caffeine";

export type SearchProductFormat =
  | "powder"
  | "capsule"
  | "tablet"
  | "gummy"
  | "liquid"
  | "bar"
  | "sachet";

export type SearchIntentFilters = {
  maxDeliveredPrice: number | null;
  minVerifiedServings: number | null;
  minProteinPerServingG: number | null;
  maxCaffeineMg: number | null;
  caffeineFree: boolean;
  ingredients: ReviewedSearchIngredient[];
  format: SearchProductFormat | null;
};

export type SearchIntentConstraintKey =
  | "max_delivered_price"
  | "min_verified_servings"
  | "min_protein_per_serving"
  | "max_caffeine"
  | "caffeine_free"
  | `ingredient:${ReviewedSearchIngredient}`
  | "format"
  | "sort";

export type SearchIntentConstraint = {
  key: SearchIntentConstraintKey;
  label: string;
  source: "query" | "url";
  removable: boolean;
};

export type UnsupportedSearchClause = {
  key: "low_sugar" | "low_calorie" | "high_calorie" | "sensitive_stomach";
  clause: string;
  label: string;
  reason: string;
};

export type SearchIntentPlan = {
  rawQuery: string;
  textQuery: string;
  textTerms: string[];
  filters: SearchIntentFilters;
  valueMetric: SearchValueMetric | null;
  sort: IntentSearchSort;
  appliedConstraints: SearchIntentConstraint[];
  unsupportedClauses: UnsupportedSearchClause[];
};

export type SearchIntentUrlState = {
  servingsMin: number | null;
  proteinMinG: number | null;
  caffeineMaxMg: number | null;
  format: SearchProductFormat | null;
  ingredients: ReviewedSearchIngredient[];
};

export type SearchIntentExplicitValues = Partial<SearchIntentUrlState>;

export type SearchIntentBuildOptions = {
  explicit?: SearchIntentExplicitValues;
  caffeineFree?: boolean;
  requestedSort?: IntentSearchSort;
  sortIsExplicit?: boolean;
};

type ValueMetricDefinition = {
  sort: IntentSearchSort;
  label: string;
  applicability: string;
  patterns: RegExp[];
};

export const SEARCH_VALUE_METRICS: Record<
  SearchValueMetric,
  ValueMetricDefinition
> = {
  price_per_serving: {
    sort: "price_per_serving_asc",
    label: "Lowest cost per serving",
    applicability: "Products with a verified serving count",
    patterns: [
      /\b(?:price|cost|cheapest)\s+per\s+serving\b/gi,
      /\bcheapest\s+by\s+(?:price|cost)\s+per\s+serving\b/gi,
    ],
  },
  cost_per_25g_protein: {
    sort: "cost_per_25g_protein_asc",
    label: "Lowest cost per 25 g protein",
    applicability: "Products with verified protein per serving",
    patterns: [
      /\b(?:price|cost|cheapest)\s+per\s+25\s*g(?:\s+(?:of\s+)?protein)?\b/gi,
    ],
  },
  cost_per_5g_creatine: {
    sort: "cost_per_5g_creatine_asc",
    label: "Lowest cost per 5 g creatine",
    applicability: "Powder products with verified creatine and serving data",
    patterns: [
      /\b(?:price|cost|cheapest)\s+per\s+5\s*g(?:\s+(?:of\s+)?creatine)?\b/gi,
    ],
  },
};

const FORMAT_TERMS: Array<{
  format: SearchProductFormat;
  pattern: RegExp;
}> = [
  { format: "capsule", pattern: /\b(?:capsule|capsules|caps)\b/gi },
  { format: "tablet", pattern: /\b(?:tablet|tablets)\b/gi },
  { format: "gummy", pattern: /\b(?:gummy|gummies)\b/gi },
  { format: "liquid", pattern: /\bliquids?\b/gi },
  { format: "powder", pattern: /\bpowders?\b/gi },
  { format: "bar", pattern: /\bbars?\b/gi },
  { format: "sachet", pattern: /\bsachets?\b/gi },
];

const FORMAT_LABELS: Record<SearchProductFormat, string> = {
  powder: "Powder",
  capsule: "Capsule",
  tablet: "Tablet",
  gummy: "Gummy",
  liquid: "Liquid",
  bar: "Bar",
  sachet: "Sachet",
};

const INGREDIENT_LABELS: Record<ReviewedSearchIngredient, string> = {
  citrulline: "Citrulline",
  beta_alanine: "Beta-alanine",
  creatine: "Creatine",
  caffeine: "Caffeine",
};

const UNSUPPORTED_CLAUSES: Array<{
  key: UnsupportedSearchClause["key"];
  pattern: RegExp;
  clause: string;
  label: string;
  reason: string;
}> = [
  {
    key: "low_sugar",
    pattern: /\blow[-\s]+sugar\b/gi,
    clause: "low sugar",
    label: "Low sugar",
    reason: "Verified sugar data is not available for enough products yet.",
  },
  {
    key: "low_calorie",
    pattern: /\blow[-\s]+calorie(?:s)?\b/gi,
    clause: "low calorie",
    label: "Low calorie",
    reason: "Verified calorie data is not available for enough products yet.",
  },
  {
    key: "high_calorie",
    pattern: /\bhigh[-\s]+calorie(?:s)?\b/gi,
    clause: "high calorie",
    label: "High calorie",
    reason: "Verified calorie data is not available for enough products yet.",
  },
  {
    key: "sensitive_stomach",
    pattern: /\bsensitive\s+stomach\b/gi,
    clause: "sensitive stomach",
    label: "Sensitive stomach",
    reason: "SupplementScout does not have verified suitability data for this constraint.",
  },
];

function firstParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allParamValues(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function positiveNumber(value: unknown, maximum: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : null;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function replaceMatches(
  value: string,
  pattern: RegExp,
  onMatch?: (match: RegExpExecArray) => void
) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    onMatch?.(match);
    if (match[0].length === 0) matcher.lastIndex += 1;
  }

  return value.replace(matcher, " ");
}

function cleanStructuralText(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\b(?:with|and)\s*(?=$)/gi, " ")
      .replace(/^\s*(?:and|with)\b/gi, " ")
      .replace(/\s+([,;])/g, "$1")
      .replace(/[,;]+\s*$/g, " ")
  );
}

function valueMetricForSort(sort: IntentSearchSort) {
  return (Object.entries(SEARCH_VALUE_METRICS) as Array<
    [SearchValueMetric, ValueMetricDefinition]
  >).find(([, definition]) => definition.sort === sort)?.[0] || null;
}

function constraintSource(
  explicit: unknown,
  inferred: unknown
): "query" | "url" {
  return explicit !== undefined && explicit !== null ? "url" : inferred !== null
    ? "query"
    : "url";
}

export function normalizeSearchIntentUrlState(values: {
  servings_min?: string | string[];
  protein_min_g?: string | string[];
  caffeine_max_mg?: string | string[];
  format?: string | string[];
  ingredient?: string | string[];
}): SearchIntentUrlState {
  const rawFormat = normalizeWhitespace(firstParamValue(values.format) || "").toLowerCase();
  const supportedFormats = new Set<SearchProductFormat>(
    FORMAT_TERMS.map(({ format }) => format)
  );
  const ingredients = Array.from(
    new Set(
      allParamValues(values.ingredient)
        .flatMap((value) => value.split(","))
        .map((value) => normalizeWhitespace(value).toLowerCase().replace(/-/g, "_"))
        .filter((value): value is ReviewedSearchIngredient =>
          ["citrulline", "beta_alanine", "creatine", "caffeine"].includes(value)
        )
    )
  );

  return {
    servingsMin: positiveNumber(firstParamValue(values.servings_min), 10_000),
    proteinMinG: positiveNumber(firstParamValue(values.protein_min_g), 500),
    caffeineMaxMg: positiveNumber(firstParamValue(values.caffeine_max_mg), 2_000),
    format: supportedFormats.has(rawFormat as SearchProductFormat)
      ? (rawFormat as SearchProductFormat)
      : null,
    ingredients,
  };
}

export function buildSearchIntentPlan(
  rawQuery: string,
  options: SearchIntentBuildOptions = {}
): SearchIntentPlan {
  const raw = normalizeWhitespace(rawQuery);
  let working = raw;
  let maxDeliveredPrice: number | null = null;
  let minVerifiedServings: number | null = null;
  let minProteinPerServingG: number | null = null;
  let maxCaffeineMg: number | null = null;
  let caffeineFree = false;
  let format: SearchProductFormat | null = null;
  let valueMetric: SearchValueMetric | null = null;
  let inferredSort: IntentSearchSort = "relevance";
  const ingredients: ReviewedSearchIngredient[] = [];
  const unsupportedClauses: UnsupportedSearchClause[] = [];

  for (const definition of UNSUPPORTED_CLAUSES) {
    let found = false;
    working = replaceMatches(working, definition.pattern, () => {
      found = true;
    });
    if (found) {
      unsupportedClauses.push({
        key: definition.key,
        clause: definition.clause,
        label: definition.label,
        reason: definition.reason,
      });
    }
  }

  for (const [metric, definition] of Object.entries(
    SEARCH_VALUE_METRICS
  ) as Array<[SearchValueMetric, ValueMetricDefinition]>) {
    for (const pattern of definition.patterns) {
      let found = false;
      working = replaceMatches(working, pattern, () => {
        found = true;
      });
      if (found && valueMetric === null) {
        valueMetric = metric;
        inferredSort = definition.sort;
      }
    }
  }

  working = replaceMatches(
    working,
    /\b(?:under|below|max(?:imum)?(?:\s+of)?|up\s+to|less\s+than)\s*(\d+(?:\.\d{1,2})?)\s*mg\s*(?:of\s+)?caffeine\b/gi,
    (match) => {
      maxCaffeineMg ??= positiveNumber(match[1], 2_000);
    }
  );

  working = replaceMatches(
    working,
    /\b(?:at\s+least\s+)?(\d+(?:\.\d+)?)\s*\+?\s*servings?\b/gi,
    (match) => {
      minVerifiedServings ??= positiveNumber(match[1], 10_000);
    }
  );

  working = replaceMatches(
    working,
    /\b(?:at\s+least\s+)?(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?protein(?:\s+per\s+serving)?\b/gi,
    (match) => {
      minProteinPerServingG ??= positiveNumber(match[1], 500);
    }
  );

  let foundCaffeineFree = false;
  working = replaceMatches(
    working,
    /\b(?:caffeine[-\s]?free|without\s+caffeine|stim[-\s]?free)\b/gi,
    () => {
      foundCaffeineFree = true;
    }
  );
  caffeineFree = foundCaffeineFree;

  const budgetMatch = working.match(
    /\b(?:under|below|up\s+to|less\s+than)\s*£?\s*(\d+(?:\.\d{1,2})?)\s*$/i
  );
  if (budgetMatch) {
    const parsedBudget = positiveNumber(budgetMatch[1], 1_000);
    if (parsedBudget !== null) {
      maxDeliveredPrice = parsedBudget;
      working = working.slice(0, budgetMatch.index).trim();
      working = working.replace(/^(?:best)\s+/i, "");
    }
  }

  let foundCheap = false;
  working = replaceMatches(
    working,
    /\b(?:cheap|cheapest|lowest[-\s]+price)\b/gi,
    () => {
      foundCheap = true;
    }
  );
  if (foundCheap && valueMetric === null) inferredSort = "price_asc";

  const isPreWorkoutQuery = /\bpre[-\s]?workout\b/i.test(working);
  const ingredientPatterns: Array<{
    ingredient: ReviewedSearchIngredient;
    pattern: RegExp;
    allowBare: boolean;
  }> = [
    {
      ingredient: "citrulline",
      pattern: /\b(?:with\s+)?citrulline\b/gi,
      allowBare: true,
    },
    {
      ingredient: "beta_alanine",
      pattern: /\b(?:with\s+)?beta[-\s]?alanine\b/gi,
      allowBare: true,
    },
    {
      ingredient: "creatine",
      pattern: /\b(?:with\s+)?creatine\b/gi,
      allowBare: valueMetric !== "cost_per_5g_creatine",
    },
    {
      ingredient: "caffeine",
      pattern: /\b(?:with\s+)?caffeine\b/gi,
      allowBare: true,
    },
  ];

  if (isPreWorkoutQuery) {
    for (const definition of ingredientPatterns) {
      if (!definition.allowBare && definition.ingredient !== "caffeine") continue;
      let found = false;
      working = replaceMatches(working, definition.pattern, () => {
        found = true;
      });
      if (found) ingredients.push(definition.ingredient);
    }
  }

  for (const definition of FORMAT_TERMS) {
    let found = false;
    working = replaceMatches(working, definition.pattern, () => {
      found = true;
    });
    if (found && format === null) format = definition.format;
  }

  const textQuery = cleanStructuralText(working);
  const explicit = options.explicit || {};
  const effectiveMinServings =
    explicit.servingsMin ?? minVerifiedServings;
  const effectiveMinProtein = explicit.proteinMinG ?? minProteinPerServingG;
  const effectiveMaxCaffeine = explicit.caffeineMaxMg ?? maxCaffeineMg;
  const effectiveFormat = explicit.format ?? format;
  const effectiveIngredients =
    explicit.ingredients && explicit.ingredients.length > 0
      ? explicit.ingredients
      : Array.from(new Set(ingredients));
  const effectiveCaffeineFree = options.caffeineFree === true || caffeineFree;
  const requestedSort = options.requestedSort || "relevance";
  const sort = options.sortIsExplicit ? requestedSort : inferredSort;
  const effectiveMetric = options.sortIsExplicit
    ? valueMetricForSort(sort)
    : valueMetricForSort(sort) || valueMetric;
  const appliedConstraints: SearchIntentConstraint[] = [];

  if (maxDeliveredPrice !== null) {
    appliedConstraints.push({
      key: "max_delivered_price",
      label: `Delivered price ≤ £${formatNumber(maxDeliveredPrice)}`,
      source: "query",
      removable: false,
    });
  }
  if (effectiveMinServings !== null) {
    appliedConstraints.push({
      key: "min_verified_servings",
      label: `${formatNumber(effectiveMinServings)}+ verified servings`,
      source: constraintSource(explicit.servingsMin, minVerifiedServings),
      removable: true,
    });
  }
  if (effectiveMinProtein !== null) {
    appliedConstraints.push({
      key: "min_protein_per_serving",
      label: `Protein ≥ ${formatNumber(effectiveMinProtein)} g per serving`,
      source: constraintSource(explicit.proteinMinG, minProteinPerServingG),
      removable: true,
    });
  }
  if (effectiveMaxCaffeine !== null) {
    appliedConstraints.push({
      key: "max_caffeine",
      label: `Caffeine ≤ ${formatNumber(effectiveMaxCaffeine)} mg per serving`,
      source: constraintSource(explicit.caffeineMaxMg, maxCaffeineMg),
      removable: true,
    });
  }
  if (effectiveCaffeineFree) {
    appliedConstraints.push({
      key: "caffeine_free",
      label: "Confirmed caffeine free",
      source: options.caffeineFree ? "url" : "query",
      removable: true,
    });
  }
  for (const ingredient of effectiveIngredients) {
    appliedConstraints.push({
      key: `ingredient:${ingredient}`,
      label: `Contains ${INGREDIENT_LABELS[ingredient].toLowerCase()}`,
      source: explicit.ingredients?.includes(ingredient) ? "url" : "query",
      removable: true,
    });
  }
  if (effectiveFormat !== null) {
    appliedConstraints.push({
      key: "format",
      label: `${FORMAT_LABELS[effectiveFormat]} format`,
      source: explicit.format ? "url" : "query",
      removable: true,
    });
  }
  if (sort !== "relevance") {
    const metricDefinition = effectiveMetric
      ? SEARCH_VALUE_METRICS[effectiveMetric]
      : null;
    appliedConstraints.push({
      key: "sort",
      label:
        metricDefinition?.label ||
        (sort === "price_asc"
          ? "Lowest delivered price"
          : sort === "price_desc"
            ? "Highest delivered price"
            : "Selected sort"),
      source: options.sortIsExplicit ? "url" : "query",
      removable: true,
    });
  }

  return {
    rawQuery: raw,
    textQuery,
    textTerms: textQuery.toLowerCase().split(" ").filter(Boolean),
    filters: {
      maxDeliveredPrice,
      minVerifiedServings: effectiveMinServings,
      minProteinPerServingG: effectiveMinProtein,
      maxCaffeineMg: effectiveMaxCaffeine,
      caffeineFree: effectiveCaffeineFree,
      ingredients: effectiveIngredients,
      format: effectiveFormat,
    },
    valueMetric: effectiveMetric,
    sort,
    appliedConstraints,
    unsupportedClauses,
  };
}

export function intentUrlStateFromPlan(
  plan: SearchIntentPlan
): SearchIntentUrlState {
  return {
    servingsMin: plan.filters.minVerifiedServings,
    proteinMinG: plan.filters.minProteinPerServingG,
    caffeineMaxMg: plan.filters.maxCaffeineMg,
    format: plan.filters.format,
    ingredients: plan.filters.ingredients,
  };
}

export function canonicalIntentQuery(plan: SearchIntentPlan) {
  const clauses = [plan.textQuery];

  if (plan.filters.maxDeliveredPrice !== null) {
    clauses.push(`under £${formatNumber(plan.filters.maxDeliveredPrice)}`);
  }

  clauses.push(...plan.unsupportedClauses.map(({ clause }) => clause));
  return normalizeWhitespace(clauses.filter(Boolean).join(" "));
}

export function hasStructuredSearchIntent(plan: SearchIntentPlan) {
  return (
    plan.filters.maxDeliveredPrice !== null ||
    plan.filters.minVerifiedServings !== null ||
    plan.filters.minProteinPerServingG !== null ||
    plan.filters.maxCaffeineMg !== null ||
    plan.filters.caffeineFree ||
    plan.filters.ingredients.length > 0 ||
    plan.filters.format !== null ||
    plan.sort !== "relevance" ||
    plan.unsupportedClauses.length > 0
  );
}

export function reviewedIngredientLabel(ingredient: ReviewedSearchIngredient) {
  return INGREDIENT_LABELS[ingredient];
}
