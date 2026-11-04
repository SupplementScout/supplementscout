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

const exactAminoAcidsCategoryPattern = /^\s*amino\s+acids\s*$/i;
const explicitAminoFamilyPattern =
  /\b(?:amino(?:\s+acids?|s|x)?|bcaas?|eaas?)\b/i;
const explicitNamedAminoPattern =
  /\b(?:glutamine|arginine|aakg|beta[-\s]?alanine|citrulline|carnitine|glycine|taurine|tyrosine|leucine|isoleucine|valine|lysine|hmb)\b/i;
const explicitAminoIdentityPattern =
  /\b(?:amino(?:\s+acids?|s|x)?|bcaas?|eaas?|glutamine|arginine|aakg|beta[-\s]?alanine|citrulline|carnitine|glycine|taurine|tyrosine|leucine|isoleucine|valine|lysine|hmb)\b/i;
const explicitAminoDescriptionPattern =
  /\b(?:amino\s+acids?|bcaas?|eaas?|branched[-\s]+chain\s+amino\s+acids?|essential\s+amino\s+acids?)\b/i;
const aminoDerivativePattern = /\b(?:nac|5[-\s]?htp|glutathione)\b/i;
const aminoBundlePattern =
  /\b(?:bundles?|multipacks?|\d+\s*[-\s]?packs?)\b/i;
const aminoProteinCoIdentityPattern = /\b(?:protein|whey)\b/i;
const aminoIntraWorkoutPattern = /\bintra[-\s]?workout\b/i;
const exactEnergySupplementsCategoryPattern = /^\s*energy\s+supplements\s*$/i;

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

const collagenNamePattern = /\bcollagen\b/i;
const collagenBenefitCopyPattern =
  /\b(?:collagen(?:\s+collagen)?\s+(?:formation|synthesis|production)|collagen\s+and\s+cartilage\s+formation|(?:formation|synthesis|production)\s+of\s+(?:healthy\s+)?collagen|produce\s+collagen|collagen\s+levels?)\b/i;
const collagenProtectionCopyPattern = /\bprotects?\s+collagen\b/i;
const collagenCompanionCopyPattern =
  /\btaken\s+alongside[\s\S]{0,160}\bcollagen\b/i;

const explicitNootropicPattern = /\bnootropics?\b/i;
const exactNootropicsCategoryPattern = /^\s*nootropics\s*$/i;
const nootropicStandaloneIngredientPattern =
  /\b(?:alpha\s+gpc|bacopa(?:\s+monnieri)?|choline(?:\s*&\s*inositol)?|ginkgo(?:\s+biloba)?|ginseng|l[-\s]?tyrosine|rhodiola(?:\s+rosea)?)\b/i;
const ordinaryNonNootropicIdentityPattern =
  /\b(?:caffeine|garlic|glucosamine|hyaluronic\s+acid|magnesium|multivitamins?|omega[-\s]?3|potassium|vitamin\s+[a-z0-9]+|zinc)\b/i;

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
    key: "amino-acids",
    publicLabel: "Amino Acids",
    route: "/amino-acids",
    canonicalCategoryAliases: ["Amino Acids"],
    candidateQueries: [
      "Amino Acids",
      "amino",
      "BCAA",
      "EAA",
      "glutamine",
      "arginine",
      "AAKG",
      "beta alanine",
      "citrulline",
      "carnitine",
      "glycine",
      "taurine",
      "tyrosine",
      "leucine",
      "isoleucine",
      "valine",
      "lysine",
      "HMB",
      "intra workout",
    ],
    excludeRules: [
      rule(
        "AMINO_DERIVATIVE_IDENTITY",
        "HIGH",
        "Name identifies NAC, 5-HTP or Glutathione rather than an Amino comparison identity.",
        {
          anyOf: [condition("name", aminoDerivativePattern)],
        }
      ),
    ],
    includeRules: [
      rule(
        "EXPLICIT_AMINO_FAMILY_NAME_IDENTITY",
        "HIGH",
        "Name identifies Amino Acids, BCAA or EAA as a primary or named co-primary identity.",
        {
          anyOf: [condition("name", explicitAminoFamilyPattern)],
          noneOf: [
            condition("name", aminoBundlePattern),
            condition("name", aminoProteinCoIdentityPattern),
          ],
        }
      ),
      rule(
        "EXPLICIT_NAMED_AMINO_IDENTITY",
        "HIGH",
        "Name identifies a named amino identity.",
        {
          anyOf: [condition("name", explicitNamedAminoPattern)],
          noneOf: [
            condition("name", aminoBundlePattern),
            condition("name", aminoProteinCoIdentityPattern),
            condition("name", /\bcaffeine\b/i),
          ],
        }
      ),
      rule(
        "AMINO_CATEGORY_WITH_EXPLICIT_DESCRIPTION",
        "HIGH",
        "The reviewed Amino Acids category is supported by an explicit Amino Acids, BCAA or EAA formula description.",
        {
          allOf: [
            condition("category", exactAminoAcidsCategoryPattern),
            condition("description", explicitAminoDescriptionPattern),
          ],
          noneOf: [
            condition("name", aminoBundlePattern),
            condition("name", aminoProteinCoIdentityPattern),
          ],
        }
      ),
    ],
    reviewRules: [
      rule(
        "AMINO_BUNDLE_OR_MULTIPACK_AMBIGUITY",
        "MEDIUM",
        "Bundle or multipack identity needs exact product-level review.",
        {
          anyOf: [condition("name", aminoBundlePattern)],
        }
      ),
      rule(
        "AMINO_PROTEIN_COIDENTITY_AMBIGUITY",
        "MEDIUM",
        "Protein or Whey co-identity needs independent Amino product evidence.",
        {
          allOf: [
            condition("name", aminoProteinCoIdentityPattern),
            condition("name", explicitAminoIdentityPattern),
          ],
        }
      ),
      rule(
        "AMINO_ENERGY_FORMULA_AMBIGUITY",
        "MEDIUM",
        "Energy-supplement identity needs independent Amino product evidence.",
        {
          allOf: [
            condition("category", exactEnergySupplementsCategoryPattern),
            condition("name", /\bcaffeine\b/i),
            condition("name", explicitNamedAminoPattern),
          ],
        }
      ),
      rule(
        "AMINO_INTRA_WORKOUT_AMBIGUITY",
        "MEDIUM",
        "Intra-workout identity needs explicit Amino, BCAA or EAA evidence.",
        {
          anyOf: [condition("name", aminoIntraWorkoutPattern)],
        }
      ),
      rule(
        "AMBIGUOUS_AMINO_CATEGORY",
        "MEDIUM",
        "The Amino Acids category alone is candidate evidence, not strong semantic membership.",
        {
          anyOf: [condition("category", exactAminoAcidsCategoryPattern)],
        }
      ),
    ],
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
  {
    key: "collagen",
    publicLabel: "Collagen",
    route: "/collagen",
    canonicalCategoryAliases: ["Collagen"],
    candidateQueries: [
      "Collagen",
      "collagen peptides",
      "marine collagen",
      "hydrolysed collagen",
      "hydrolyzed collagen",
      "collagen protein",
      "bovine collagen",
      "collagen powder",
      "multi collagen",
    ],
    excludeRules: [
      rule("COLLAGEN_BENEFIT_COPY_ONLY", "HIGH", "Description identifies Collagen formation, synthesis, production or levels as a benefit rather than product identity.", {
        anyOf: [condition("description", collagenBenefitCopyPattern)],
        noneOf: [condition("name", collagenNamePattern)],
      }),
      rule("COLLAGEN_PROTECTION_COPY_ONLY", "HIGH", "Description mentions protecting Collagen without a Collagen product identity.", {
        anyOf: [condition("description", collagenProtectionCopyPattern)],
        noneOf: [condition("name", collagenNamePattern)],
      }),
      rule("COLLAGEN_COMPANION_COPY_ONLY", "HIGH", "Description only says the product may be taken alongside Collagen.", {
        anyOf: [condition("description", collagenCompanionCopyPattern)],
        noneOf: [condition("name", collagenNamePattern)],
      }),
    ],
    includeRules: [
      rule("EXPLICIT_COLLAGEN_NAME", "HIGH", "Name identifies Collagen as a primary or named co-primary product identity.", {
        anyOf: [condition("name", collagenNamePattern)],
      }),
    ],
    reviewRules: [
      rule("DESCRIPTION_LEVEL_COLLAGEN_COMPONENT", "MEDIUM", "Description identifies Collagen as one component without a Collagen product-name identity.", {
        anyOf: [condition("description", collagenNamePattern)],
        noneOf: [condition("name", collagenNamePattern)],
      }),
    ],
  },
  {
    key: "nootropics",
    publicLabel: "Nootropics",
    route: "/nootropics",
    canonicalCategoryAliases: ["Nootropics"],
    candidateQueries: [
      "Nootropics",
      "nootropic",
      "brain booster",
      "focus",
      "cognitive",
      "mental focus",
      "lion's mane",
      "bacopa",
      "alpha gpc",
      "tyrosine",
      "choline",
      "ginkgo",
      "ginseng",
      "rhodiola",
      "mushroom",
      "mushroom complex",
      "reishi",
    ],
    excludeRules: [
      rule("EXPLICIT_PREWORKOUT_PRIMARY_IDENTITY", "HIGH", "Name identifies an ordinary Pre Workout without an explicit Nootropic name.", {
        anyOf: [condition("name", /\bpre[-\s]?workout\b/i)],
        noneOf: [condition("name", explicitNootropicPattern)],
      }),
      rule("PREWORKOUT_DESCRIPTION_FALSE_POSITIVE", "HIGH", "Description identifies a Pre Workout focus claim without an explicit Nootropic identity.", {
        anyOf: [condition("description", /\bpre[-\s]?workout\b/i)],
        noneOf: [
          condition("name", explicitNootropicPattern),
          condition("description", explicitNootropicPattern),
        ],
      }),
      rule("PUMP_PREWORKOUT_PRIMARY_IDENTITY", "HIGH", "Product is a Pump Pre Workout rather than a primary Nootropic identity.", {
        allOf: [
          condition("name", /\bpump\b/i),
          condition("category", /^\s*pre\s+workout\s*$/i),
        ],
        noneOf: [condition("name", explicitNootropicPattern)],
      }),
      rule("AMINO_HYDRATION_PRIMARY_IDENTITY", "HIGH", "Product is an Amino Acid or hydration identity rather than a Nootropic.", {
        anyOf: [
          condition("name", /\b(?:amino|bcaa|eaa|hydration)\b/i),
          condition("category", /^\s*amino\s+acids\s*$/i),
        ],
        noneOf: [condition("name", nootropicStandaloneIngredientPattern)],
      }),
      rule("NON_SUPPLEMENT_ACCESSORY_IDENTITY", "HIGH", "Product is an accessory rather than a supplement.", {
        anyOf: [condition("category", /^\s*accessories\s*$/i)],
      }),
      rule("MASS_GAINER_PRIMARY_IDENTITY", "HIGH", "Product is a Mass Gainer with only a secondary mushroom component.", {
        anyOf: [
          condition("name", /\bmass\s+gainer\b/i),
          condition("category", /^\s*mass\s+gainer\s*$/i),
        ],
      }),
      rule("GENERIC_MUSHROOM_WELLNESS_IDENTITY", "HIGH", "Product has a generic mushroom-wellness identity without explicit Nootropic evidence.", {
        anyOf: [condition("name", /\b(?:reishi|mushroom\s+superblend)\b/i)],
        noneOf: [condition("name", explicitNootropicPattern)],
      }),
      rule("ORDINARY_NON_NOOTROPIC_IDENTITY", "HIGH", "Name identifies an ordinary vitamin, mineral or wellness product rather than a Nootropic.", {
        anyOf: [condition("name", ordinaryNonNootropicIdentityPattern)],
        noneOf: [condition("name", explicitNootropicPattern)],
      }),
    ],
    includeRules: [
      rule("EXPLICIT_NOOTROPIC_NAME", "HIGH", "Name identifies Nootropic as a primary or named co-primary product identity.", {
        anyOf: [condition("name", explicitNootropicPattern)],
      }),
      rule("EXPLICIT_NOOTROPIC_DESCRIPTION", "HIGH", "Description identifies a Nootropic formula, blend or named co-primary identity.", {
        anyOf: [condition("description", explicitNootropicPattern)],
      }),
      rule("FOCUS_IDENTITY_SUPPORTED_BY_EXACT_CATEGORY", "HIGH", "Focus identity is supported by the exact reviewed Nootropics category.", {
        allOf: [
          condition("name", /\bfocus(?:max)?\b/i),
          condition("category", exactNootropicsCategoryPattern),
        ],
      }),
    ],
    reviewRules: [
      rule("FOCUS_IDENTITY_AMBIGUITY", "MEDIUM", "Focus-only identity needs independent reviewed Nootropic evidence.", {
        anyOf: [condition("name", /\b(?:focus(?:max)?|mentality)\b/i)],
      }),
      rule("STANDALONE_INGREDIENT_AMBIGUITY", "MEDIUM", "Standalone cognitive-associated ingredient identity needs review.", {
        anyOf: [condition("name", nootropicStandaloneIngredientPattern)],
        noneOf: [condition("name", /\bblack\s+maca\b/i)],
      }),
      rule("STANDALONE_LIONS_MANE_AMBIGUITY", "MEDIUM", "Standalone Lion's Mane identity needs review.", {
        anyOf: [condition("name", /\blion['’]?s\s+mane\b/i)],
      }),
      rule("LOW_EVIDENCE_MUSHROOM_IDENTITY", "LOW", "Mushroom identity lacks enough evidence for inclusion or strong exclusion.", {
        anyOf: [condition("name", /\bmushroom\s+complex\b/i)],
      }),
      rule("LOW_EVIDENCE_INGREDIENT_BLEND", "LOW", "Ingredient blend lacks enough evidence for Nootropic membership.", {
        allOf: [
          condition("name", /\bblack\s+maca\b/i),
          condition("name", /\bginseng\b/i),
        ],
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
