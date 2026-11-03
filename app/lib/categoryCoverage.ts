export type CategoryCoverageClassification =
  | "INCLUDE_STRONG"
  | "EXCLUDE_STRONG"
  | "REVIEW_REQUIRED";

export type CategoryCoverageConfidence = "HIGH" | "MEDIUM" | "LOW";

export type CategoryCoverageProduct = {
  name: string;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
};

type CategoryCoverageField = keyof CategoryCoverageProduct;

type CategoryCoverageCondition = {
  field: CategoryCoverageField;
  pattern: RegExp;
};

export type CategoryCoverageRule = {
  reasonCode: string;
  confidence: CategoryCoverageConfidence;
  evidence: string;
  allOf?: readonly CategoryCoverageCondition[];
  anyOf?: readonly CategoryCoverageCondition[];
  noneOf?: readonly CategoryCoverageCondition[];
};

export type CategoryCoverageEvaluation = {
  classification: CategoryCoverageClassification;
  confidence: CategoryCoverageConfidence;
  reasonCodes: string[];
  evidence: string[];
};

export type CategoryCoverageDefinition = {
  key: string;
  publicLabel: string;
  route: string;
  canonicalCategoryAliases: readonly string[];
  candidateQueries: readonly string[];
  includeRules: readonly CategoryCoverageRule[];
  excludeRules: readonly CategoryCoverageRule[];
  reviewRules: readonly CategoryCoverageRule[];
};

const condition = (
  field: CategoryCoverageField,
  pattern: RegExp
): CategoryCoverageCondition => ({ field, pattern });

const rule = (
  reasonCode: string,
  confidence: CategoryCoverageConfidence,
  evidence: string,
  options: Pick<CategoryCoverageRule, "allOf" | "anyOf" | "noneOf">
): CategoryCoverageRule => ({
  reasonCode,
  confidence,
  evidence,
  ...options,
});

const vitaminStrongPattern =
  /\b(?:multivitamins?|vitamins?|vitamin\s+(?:a|b|c|d|d2|d3|e|k|k2)|b\s*complex|biotin|calcium|chromium|copper|folic\s+acid|iodine|iron|magnesium|manganese|minerals?|potassium|selenium|zinc)\b/i;
const vitaminExcludedPattern =
  /\b(?:amino|bcaa|chondroitin|cod\s+liver|collagen|creatine|eaa|electrolytes?|energy\s+drinks?|fish\s+oil|glucosamine|hydration|joint|krill|mass\s+gainer|nocco|omega|pre[-\s]?workout|protein|whey)\b/i;
const omega3ExcludedPattern =
  /\b(?:cat|dog|pet|starflower|evening\s+primrose)\b/i;

const testosteroneStrongNamePattern =
  /\b(?:testosterone|testo|test\s*x|testx|tribooster)\b/i;
const standaloneTestNamePattern = /\btest\b/i;
const testosteroneDescriptionPattern = /\btestosterone\b/i;
const testosteroneBoosterDescriptionPattern =
  /\btestosterone\s+boosters?\b/i;
const exactTestosteroneCategoryPattern = /^\s*testosterone\s+boosters\s*$/i;
const ambiguousTestosteroneIngredientPattern =
  /\b(?:fadogia(?:\s+agrestis)?|tongkat(?:\s+ali)?|long\s+jack|tribulus(?:\s+terrestris)?)\b/i;

const exactFatBurnersCategoryPattern = /^\s*fat\s+burners\s*$/i;
const explicitFatBurnerPattern =
  /\bfat[-\s]+burn(?:ers?|ing)\b/i;
const strongFatBurnerNamePattern =
  /\b(?:burner|black\s+bombs?|clenburexin|hydroxycut|oxyshred|the\s+ripper|thermogenic)\b/i;
const ambiguousFatIngredientPattern =
  /\b(?:(?:acetyl\s+)?l[-\s]?carnitine|carnitine|cla|conjugated\s+linoleic\s+acid|glucomannan|mct(?:\s+gold)?\s+oil)\b/i;
const ordinaryHealthProductPattern =
  /\b(?:alpha\s+lipoic\s+acid|biotin|collagen|cranberry|cream\s+of\s+rice|detox|folic\s+acid|garlic|glucosamine|hair\s+care|immunoboost|iron|l[-\s]?choline|magnesium|multivitamins?|omega[-\s]?3|potassium|sea\s+kelp|soya\s+isoflavones|starflower|taurine|vitamin|zinc)\b/i;

const categoryCoverageDefinitions = [
  {
    key: "glucosamine",
    publicLabel: "Glucosamine",
    route: "/glucosamine",
    canonicalCategoryAliases: ["Glucosamine"],
    candidateQueries: ["glucosamine"],
    includeRules: [
      rule("NAME_GLUCOSAMINE_IDENTITY", "HIGH", "Name identifies glucosamine.", {
        anyOf: [condition("name", /\bglucosamine\b/i)],
      }),
    ],
    excludeRules: [],
    reviewRules: [],
  },
  {
    key: "magnesium",
    publicLabel: "Magnesium",
    route: "/magnesium",
    canonicalCategoryAliases: ["Magnesium"],
    candidateQueries: ["magnesium", "zma", "zmb", "zmpro"],
    includeRules: [
      rule("NAME_MAGNESIUM_IDENTITY", "HIGH", "Name identifies magnesium or an established ZM identity.", {
        anyOf: [condition("name", /\b(?:magnesium|zma(?:ttack)?|zmb|zmpro)\b/i)],
      }),
    ],
    excludeRules: [],
    reviewRules: [],
  },
  {
    key: "omega-3",
    publicLabel: "Omega 3",
    route: "/omega-3",
    canonicalCategoryAliases: ["Omega 3"],
    candidateQueries: ["omega 3", "fish oil", "krill oil", "cod liver oil", "flaxseed oil"],
    includeRules: [
      rule("NAME_OMEGA_3_IDENTITY", "HIGH", "Name identifies an established Omega 3 identity.", {
        anyOf: [condition("name", /\b(?:cod\s+liver\s+oil|fish\s+oil|flaxseed\s+oil|krill\s+oil|omega[-\s]?3)\b/i)],
      }),
    ],
    excludeRules: [
      rule("NAME_OMEGA_3_EXCLUDED_IDENTITY", "HIGH", "Name identifies an excluded Omega 3-adjacent product.", {
        anyOf: [condition("name", omega3ExcludedPattern)],
      }),
    ],
    reviewRules: [],
  },
  {
    key: "vitamin-d",
    publicLabel: "Vitamin D",
    route: "/vitamin-d",
    canonicalCategoryAliases: ["Vitamin D"],
    candidateQueries: ["vitamin d", "vitamin d2", "vitamin d3"],
    includeRules: [
      rule("NAME_VITAMIN_D_IDENTITY", "HIGH", "Name identifies Vitamin D.", {
        anyOf: [condition("name", /\b(?:d2|d3|vit(?:amin)?\s+d(?:2|3)?)\b/i)],
      }),
    ],
    excludeRules: [],
    reviewRules: [],
  },
  {
    key: "vitamins",
    publicLabel: "Vitamins",
    route: "/vitamins",
    canonicalCategoryAliases: ["Vitamins"],
    candidateQueries: ["vitamin", "vitamins", "mineral", "minerals"],
    includeRules: [
      rule("NAME_VITAMIN_OR_MINERAL_IDENTITY", "HIGH", "Name identifies a vitamin or mineral product.", {
        anyOf: [condition("name", vitaminStrongPattern)],
      }),
    ],
    excludeRules: [
      rule("NAME_NON_VITAMIN_IDENTITY", "HIGH", "Name identifies an excluded non-vitamin product family.", {
        anyOf: [condition("name", vitaminExcludedPattern)],
      }),
    ],
    reviewRules: [],
  },
  {
    key: "testosterone-boosters",
    publicLabel: "Testosterone Boosters",
    route: "/testosterone-boosters",
    canonicalCategoryAliases: ["Testosterone Boosters"],
    candidateQueries: [
      "Testosterone Boosters",
      "testosterone",
      "testo",
      "testx",
      "tribooster",
      "hormone support",
      "anabol",
      "fadogia",
      "tongkat",
      "tribulus",
      "turkesterone",
    ],
    excludeRules: [
      rule("POST_CYCLE_IDENTITY", "HIGH", "Name identifies a post-cycle or PCT product.", {
        anyOf: [condition("name", /\b(?:pct|post[-\s]?cycle)\b/i)],
      }),
      rule("ZMA_ZMB_NUTRIENT_IDENTITY", "HIGH", "Name identifies a ZMA/ZMB-style nutrient product.", {
        anyOf: [condition("name", /\b(?:zma(?:ttack)?|zmb|zmpro)\b/i)],
      }),
      rule("ORDINARY_ZINC_IDENTITY", "HIGH", "Name identifies an ordinary zinc product without stronger Testosterone identity.", {
        anyOf: [condition("name", /\bzinc\b/i)],
        noneOf: [condition("name", testosteroneStrongNamePattern), condition("name", standaloneTestNamePattern)],
      }),
      rule("ORDINARY_ASHWAGANDHA_IDENTITY", "HIGH", "Name identifies an ordinary Ashwagandha product without stronger Testosterone identity.", {
        anyOf: [condition("name", /\bashwagandha\b/i)],
        noneOf: [condition("name", testosteroneStrongNamePattern), condition("name", standaloneTestNamePattern)],
      }),
      rule("STANDALONE_TURKESTERONE_IDENTITY", "HIGH", "Name identifies standalone Turkesterone without stronger Testosterone identity.", {
        anyOf: [condition("name", /\b(?:turkesterone|turk(?:[-\s]?x)?)\b/i)],
        noneOf: [condition("name", testosteroneStrongNamePattern), condition("name", standaloneTestNamePattern)],
      }),
    ],
    includeRules: [
      rule("EXPLICIT_TESTOSTERONE_NAME", "HIGH", "Name contains an explicit Testosterone, Testo, TestX or Tribooster identity.", {
        anyOf: [condition("name", testosteroneStrongNamePattern)],
      }),
      rule("EXPLICIT_TESTOSTERONE_BOOSTER_DESCRIPTION", "HIGH", "Description explicitly identifies a testosterone booster.", {
        anyOf: [condition("description", testosteroneBoosterDescriptionPattern)],
      }),
      rule("EXPLICIT_NATURAL_HORMONE_SUPPORT_DESCRIPTION", "HIGH", "Description explicitly identifies complete natural hormone support.", {
        anyOf: [condition("description", /\bcomplete\s+natural\s+hormone\s+support\b/i)],
      }),
      rule("SUPPORTED_TEST_NAME_BY_DESCRIPTION", "HIGH", "Standalone Test name is supported by explicit Testosterone description evidence.", {
        allOf: [
          condition("name", standaloneTestNamePattern),
          condition("description", testosteroneDescriptionPattern),
        ],
      }),
      rule("SUPPORTED_TEST_NAME_BY_CATEGORY", "HIGH", "Standalone Test name is supported by the exact reviewed category alias.", {
        allOf: [
          condition("name", standaloneTestNamePattern),
          condition("category", exactTestosteroneCategoryPattern),
        ],
      }),
    ],
    reviewRules: [
      rule("AMBIGUOUS_INGREDIENT_IDENTITY", "MEDIUM", "Ingredient-only identity needs reviewed semantic evidence.", {
        anyOf: [condition("name", ambiguousTestosteroneIngredientPattern)],
      }),
      rule("AMBIGUOUS_CANONICAL_CATEGORY", "MEDIUM", "Canonical category alone is candidate evidence, not strong semantic membership.", {
        anyOf: [condition("category", exactTestosteroneCategoryPattern)],
      }),
    ],
  },
  {
    key: "fat-burners",
    publicLabel: "Fat Burners",
    route: "/fat-burners",
    canonicalCategoryAliases: ["Fat Burners"],
    candidateQueries: [
      "Fat Burners",
      "fat burner",
      "fat burning",
      "fat loss",
      "thermogenic",
      "thermogenesis",
      "burner",
      "shred",
      "cuts",
      "ripper",
      "clenburexin",
      "oxyshred",
      "hydroxycut",
    ],
    excludeRules: [
      rule("PRE_WORKOUT_ONLY_IDENTITY", "HIGH", "Product is a pre-workout without independent Fat Burner identity.", {
        anyOf: [
          condition("name", /\bpre[-\s]?workout\b/i),
          condition("category", /^\s*pre\s+workout\s*$/i),
        ],
        noneOf: [
          condition("name", strongFatBurnerNamePattern),
        ],
      }),
      rule("ENERGY_DRINK_IDENTITY", "HIGH", "Product is an energy drink rather than a Fat Burner product.", {
        anyOf: [
          condition("name", /\benergy\s+drinks?\b/i),
          condition("category", /^\s*energy\s+drinks?\s*$/i),
        ],
      }),
      rule("CREATINE_PRODUCT_IDENTITY", "HIGH", "Product is an ordinary Creatine product or subtype.", {
        anyOf: [
          condition("name", /\bcreatine\b/i),
          condition("category", /^\s*creatine\s*$/i),
        ],
      }),
      rule("MASS_GAINER_IDENTITY", "HIGH", "Product is a Mass Gainer or mass stack.", {
        anyOf: [
          condition("name", /\b(?:mass\s+gainer|mass\s+stack)\b/i),
          condition("category", /^\s*mass\s+gainer\s*$/i),
        ],
      }),
      rule("MEAL_OR_RTD_IDENTITY", "HIGH", "Product is a meal or ready-to-drink food identity.", {
        anyOf: [
          condition("name", /\b(?:huel|meal\s+replacement|ready[-\s]?to[-\s]?drink|rtd)\b/i),
        ],
      }),
      rule("DIET_OR_SLIMMING_PROTEIN_IDENTITY", "HIGH", "Product is a diet or slimming protein without Fat Burner identity.", {
        anyOf: [condition("name", /\b(?:diet\s+whey|diet\s+protein|slimming\s+protein)\b/i)],
        noneOf: [
          condition("name", strongFatBurnerNamePattern),
          condition("description", explicitFatBurnerPattern),
        ],
      }),
      rule("WATER_LOSS_IDENTITY", "HIGH", "Product has a water-loss or diuretic identity rather than Fat Burner identity.", {
        anyOf: [condition("name", /\b(?:aqua\s+loss|water[-\s]+loss|diuretic)\b/i)],
      }),
      rule("KETO_SALT_IDENTITY", "HIGH", "Product is a Keto salt product rather than a Fat Burner.", {
        anyOf: [condition("name", /\bketo\s+a?\s*salt\b/i)],
      }),
      rule("APPLE_CIDER_VINEGAR_IDENTITY", "HIGH", "Product is an ordinary Apple Cider Vinegar supplement.", {
        anyOf: [condition("name", /\bapple\s+cider\s+vinegar\b/i)],
      }),
      rule("ORDINARY_FIBRE_IDENTITY", "HIGH", "Product is an ordinary fibre supplement without reviewed Fat Burner identity.", {
        anyOf: [condition("name", /\bpsyllium\s+husk\b/i)],
      }),
      rule("NON_SUPPLEMENT_ACCESSORY_IDENTITY", "HIGH", "Product is an accessory rather than a supplement.", {
        anyOf: [condition("category", /^\s*accessories\s*$/i)],
      }),
      rule("ORDINARY_PROTEIN_IDENTITY", "HIGH", "Product is an ordinary protein product without Fat Burner identity.", {
        anyOf: [
          condition("name", /\b(?:protein\s+bars?|protein\s+(?:blend|powder))\b/i),
          condition("category", /^\s*(?:protein\s+bars?|whey\s+protein)\s*$/i),
        ],
        noneOf: [
          condition("name", strongFatBurnerNamePattern),
          condition("description", explicitFatBurnerPattern),
        ],
      }),
      rule("ORDINARY_AMINO_ACID_IDENTITY", "HIGH", "Product is an ordinary Amino Acid product without ambiguous Fat Burner evidence.", {
        anyOf: [condition("category", /^\s*amino\s+acids\s*$/i)],
        noneOf: [condition("name", ambiguousFatIngredientPattern)],
      }),
      rule("ORDINARY_VITAMIN_IDENTITY", "HIGH", "Product is an ordinary Vitamin product.", {
        anyOf: [condition("category", /^\s*vitamins\s*$/i)],
      }),
      rule("ORDINARY_HEALTH_PRODUCT_IDENTITY", "HIGH", "Product has an ordinary health-product identity rather than Fat Burner identity.", {
        anyOf: [condition("name", ordinaryHealthProductPattern)],
        noneOf: [
          condition("name", ambiguousFatIngredientPattern),
          condition("name", strongFatBurnerNamePattern),
          condition("description", explicitFatBurnerPattern),
        ],
      }),
    ],
    includeRules: [
      rule("EXPLICIT_FAT_BURNER_NAME", "HIGH", "Name explicitly identifies a Fat Burner or established strong product family.", {
        anyOf: [condition("name", strongFatBurnerNamePattern)],
      }),
      rule("EXPLICIT_FAT_BURNER_DESCRIPTION", "HIGH", "Description explicitly identifies a Fat Burner or fat-burning product.", {
        anyOf: [condition("description", explicitFatBurnerPattern)],
      }),
      rule("SUPPORTED_FAT_BURNERS_CATEGORY", "HIGH", "The exact reviewed Fat Burners category supports product identity.", {
        anyOf: [condition("category", exactFatBurnersCategoryPattern)],
      }),
    ],
    reviewRules: [
      rule("AMBIGUOUS_FAT_INGREDIENT_IDENTITY", "MEDIUM", "Ingredient-only identity needs reviewed semantic evidence.", {
        anyOf: [condition("name", ambiguousFatIngredientPattern)],
      }),
      rule("AMBIGUOUS_SHRED_IDENTITY", "MEDIUM", "Shred wording without stronger Fat Burner evidence needs review.", {
        anyOf: [condition("name", /\bshred\w*\b/i)],
      }),
    ],
  },
] as const satisfies readonly CategoryCoverageDefinition[];

export const CATEGORY_COVERAGE_DEFINITIONS = Object.freeze(
  categoryCoverageDefinitions
) as readonly CategoryCoverageDefinition[];

const confidenceRank: Record<CategoryCoverageConfidence, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function conditionMatches(
  product: CategoryCoverageProduct,
  value: CategoryCoverageCondition
) {
  return value.pattern.test(String(product[value.field] || ""));
}

function ruleMatches(
  product: CategoryCoverageProduct,
  value: CategoryCoverageRule
) {
  return (
    (!value.allOf || value.allOf.every((item) => conditionMatches(product, item))) &&
    (!value.anyOf || value.anyOf.some((item) => conditionMatches(product, item))) &&
    (!value.noneOf || value.noneOf.every((item) => !conditionMatches(product, item)))
  );
}

function evaluationFromRules(
  classification: CategoryCoverageClassification,
  rules: readonly CategoryCoverageRule[]
): CategoryCoverageEvaluation {
  const confidence = rules.reduce<CategoryCoverageConfidence>(
    (highest, current) =>
      confidenceRank[current.confidence] > confidenceRank[highest]
        ? current.confidence
        : highest,
    "LOW"
  );

  return {
    classification,
    confidence,
    reasonCodes: rules.map((value) => value.reasonCode),
    evidence: rules.map((value) => value.evidence),
  };
}

export function getCategoryCoverageDefinition(key: string) {
  return CATEGORY_COVERAGE_DEFINITIONS.find((definition) => definition.key === key);
}

export function categoryCoverageDefinitionForLabel(
  value: string | null | undefined
) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  return (
    CATEGORY_COVERAGE_DEFINITIONS.find(
      (definition) =>
        definition.publicLabel.toLowerCase() === normalized ||
        definition.canonicalCategoryAliases.some(
          (alias) => alias.toLowerCase() === normalized
        )
    ) || null
  );
}

export function evaluateCategoryCoverage(
  definition: CategoryCoverageDefinition,
  product: CategoryCoverageProduct
): CategoryCoverageEvaluation {
  const exclusions = definition.excludeRules.filter((value) =>
    ruleMatches(product, value)
  );
  if (exclusions.length > 0) {
    return evaluationFromRules("EXCLUDE_STRONG", exclusions);
  }

  const inclusions = definition.includeRules.filter((value) =>
    ruleMatches(product, value)
  );
  if (inclusions.length > 0) {
    return evaluationFromRules("INCLUDE_STRONG", inclusions);
  }

  const reviews = definition.reviewRules.filter((value) =>
    ruleMatches(product, value)
  );
  if (reviews.length > 0) {
    return evaluationFromRules("REVIEW_REQUIRED", reviews);
  }

  return {
    classification: "REVIEW_REQUIRED",
    confidence: "LOW",
    reasonCodes: ["INSUFFICIENT_SEMANTIC_EVIDENCE"],
    evidence: ["No deterministic include or exclude rule matched."],
  };
}
