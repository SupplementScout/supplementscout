export const PROTEIN_SEMANTIC_STATES = [
  "INCLUDE_STRONG",
  "EXCLUDE_STRONG",
  "REVIEW_REQUIRED",
] as const;

export type ProteinSemanticState = (typeof PROTEIN_SEMANTIC_STATES)[number];
export type ProteinSemanticConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ProteinSemanticDimension =
  | "umbrella"
  | "whey"
  | "isolate"
  | "vegan"
  | "casein"
  | "beef"
  | "egg";

export type ProteinSemanticInput = {
  name: string;
  category?: string | null;
  description?: string | null;
  product_format?: string | null;
  sourceLabels?: readonly string[] | null;
};

export type ProteinSemanticDecision = {
  state: ProteinSemanticState;
  confidence: ProteinSemanticConfidence;
  reasonCodes: string[];
  evidence: string[];
};

export type ProteinTaxonomyEvaluation = Record<
  ProteinSemanticDimension,
  ProteinSemanticDecision
>;

// Compatibility evidence only. Do not expand this list. Replace it with
// structured, provenance-backed protein-source evidence when that field exists.
export const LEGACY_REVIEWED_WHEY_BLEND_NAMES = Object.freeze([
  "bsn syntha-6 edge 1.87kg",
  "grenade hydra 6 protein 1.8kg",
  "pescience select protein 1.8kg",
  "pescience select protein 905g",
  "rule1 r1 protein 2.2kg",
  "rule1 r1 protein 29 servings",
  "trained by jp performance protein 1kg",
  "trained by jp performance protein 2kg",
]);

const legacyReviewedWheyBlendNames = new Set(
  LEGACY_REVIEWED_WHEY_BLEND_NAMES
);

const FOOD_OR_NON_POWDER =
  /\b(?:bar|bars|bite|bites|cookie|cookies|wafer|flapjack|spread|snack|brownie|drink|gel|meal|replacement|rtd|ready[- ]to[- ]drink|water|shot|smoothie|porridge|pancake|pancakes)\b/i;
const MASS_GAINER = /\b(?:mass gainer|weight gainer|lean mass gain|hyper mass|pro mass)\b/i;
const COLLAGEN = /\bcollagen\b/i;
const BUNDLE = /\b(?:bundle|shaker)\b/i;
const PLANT_SOURCE = /\b(?:vegan|plant(?:[ -]based)?|pea|rice|hemp|quinoa)\b/i;
const ANIMAL_SOURCE = /\b(?:whey|casein|collagen|beef|egg|milk protein)\b/i;
const CASEIN_SOURCE = /\bcasein\b/i;
const BEEF_SOURCE = /\bbeef\b/i;
const EGG_SOURCE = /\begg(?: white)?\b/i;
const PROTEIN = /\bprotein\b/i;
const WHEY_NAME = /whey/i;
const ISOLATE_NAME = /\bisolate\b/i;
const ISOLATE_ALIAS = /\b(?:wpi|iso[- ]?xp|iso ?100|iso ?pro|iso surge)\b/i;
const BARE_ISO = /\biso\b/i;
const ISOLATE_ZERO = /\bisolate zero\b/i;
const CLEAR_WHEY = /\bclear whey\b/i;
const AMBIGUOUS_ISOLATE_BLEND = /\b(?:tri[- ]?blend|blend)\b/i;
const UNSOURCED_HYDROLYSED_ISOLATE = /\bhydroly[sz]ed protein isolate\b/i;
const AMBIGUOUS_UMBRELLA_BLEND = /\b(?:complex carbs|recovery|men'?s formula)\b/i;
const NITRO_TECH_WITHOUT_SOURCE = /\bnitro[- ]?tech\b/i;
const CUTTING_FORMULA = /\bripped\b/i;
const ISOTONIC_RATIO_ALIAS = /\biso pro\s+\d+\s*:\s*\d+\b/i;

function normalized(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decision(
  state: ProteinSemanticState,
  confidence: ProteinSemanticConfidence,
  reasonCodes: string[],
  evidence: string[]
): ProteinSemanticDecision {
  return { state, confidence, reasonCodes, evidence };
}

function include(reasonCodes: string[], evidence: string[]) {
  return decision("INCLUDE_STRONG", "HIGH", reasonCodes, evidence);
}

function exclude(reasonCodes: string[], evidence: string[] = []) {
  return decision("EXCLUDE_STRONG", "HIGH", reasonCodes, evidence);
}

function review(reasonCodes: string[], evidence: string[]) {
  return decision("REVIEW_REQUIRED", "LOW", reasonCodes, evidence);
}

export function evaluateProteinTaxonomy(
  input: ProteinSemanticInput
): ProteinTaxonomyEvaluation {
  const name = normalized(input.name);
  const normalizedName = name.toLowerCase();
  const category = normalized(input.category);
  const description = normalized(input.description);
  const format = normalized(input.product_format).toLowerCase();
  const sourceLabels = (input.sourceLabels || []).map(normalized).filter(Boolean);
  const nameAndDescription = `${name} ${description}`.trim();
  const sourceText = sourceLabels.join(" ");
  const evidence = [
    name && `name:${name}`,
    category && `category:${category}`,
    description && `description:${description}`,
    format && `format:${format}`,
    sourceText && `sourceLabels:${sourceText}`,
  ].filter((value): value is string => Boolean(value));

  const invalidFormat = Boolean(format && format !== "powder");
  const massGainerCategory = category.toLowerCase() === "mass gainer";
  const excludedPresentation =
    invalidFormat ||
    massGainerCategory ||
    FOOD_OR_NON_POWDER.test(name) ||
    MASS_GAINER.test(nameAndDescription) ||
    COLLAGEN.test(name) ||
    BUNDLE.test(name);

  const plantName = PLANT_SOURCE.test(name);
  const animalName = ANIMAL_SOURCE.test(name);
  const animalSourceLabel = ANIMAL_SOURCE.test(sourceText);
  const caseinStrong =
    !excludedPresentation && CASEIN_SOURCE.test(nameAndDescription);
  const beefStrong =
    !excludedPresentation &&
    BEEF_SOURCE.test(name) &&
    (PROTEIN.test(name) || ISOLATE_NAME.test(name));
  const eggStrong =
    !excludedPresentation && EGG_SOURCE.test(name) && PROTEIN.test(name);
  const veganStrong =
    !excludedPresentation &&
    plantName &&
    PROTEIN.test(name) &&
    !animalName &&
    !animalSourceLabel;

  const legacyWhey = legacyReviewedWheyBlendNames.has(normalizedName);
  const wheyNameEvidence = WHEY_NAME.test(name);
  const wheyDescriptionEvidence = WHEY_NAME.test(description);
  const isolateNameEvidence =
    ISOLATE_NAME.test(name) || ISOLATE_ALIAS.test(name) || BARE_ISO.test(name);
  const wheyConflict =
    COLLAGEN.test(name) ||
    BEEF_SOURCE.test(name) ||
    CASEIN_SOURCE.test(name) ||
    EGG_SOURCE.test(name) ||
    plantName ||
    BUNDLE.test(name) ||
    CUTTING_FORMULA.test(name);
  const unsourcedHydrolysedIsolate =
    UNSOURCED_HYDROLYSED_ISOLATE.test(name) && !wheyDescriptionEvidence;
  const categorySupportsWhey = category.toLowerCase() === "whey protein";
  const supportedIsolateAlias =
    (ISOLATE_ALIAS.test(name) &&
      (categorySupportsWhey || wheyDescriptionEvidence)) ||
    (BARE_ISO.test(name) && wheyNameEvidence) ||
    (ISOLATE_ZERO.test(name) && (categorySupportsWhey || wheyDescriptionEvidence));
  const wheyStrong =
    !excludedPresentation &&
    !wheyConflict &&
    !unsourcedHydrolysedIsolate &&
    (legacyWhey ||
      wheyNameEvidence ||
      supportedIsolateAlias ||
      (isolateNameEvidence && wheyDescriptionEvidence) ||
      (isolateNameEvidence && categorySupportsWhey));
  const wheyReview =
    !excludedPresentation &&
    !wheyConflict &&
    !wheyStrong &&
    categorySupportsWhey &&
    (PROTEIN.test(name) ||
      isolateNameEvidence ||
      NITRO_TECH_WITHOUT_SOURCE.test(name));

  const isolateConflict =
    excludedPresentation || plantName || BEEF_SOURCE.test(name) ||
    CASEIN_SOURCE.test(name) || EGG_SOURCE.test(name) ||
    category.toLowerCase() === "carbohydrates" ||
    ISOTONIC_RATIO_ALIAS.test(name);
  const clearWheyWithoutIsolate =
    CLEAR_WHEY.test(name) && !ISOLATE_NAME.test(name);
  const isolateSourceStrong =
    wheyNameEvidence || wheyDescriptionEvidence || supportedIsolateAlias;
  const isolateStrong =
    !isolateConflict &&
    isolateNameEvidence &&
    isolateSourceStrong &&
    !clearWheyWithoutIsolate &&
    !AMBIGUOUS_ISOLATE_BLEND.test(name) &&
    !unsourcedHydrolysedIsolate;
  const isolateReview =
    !isolateConflict &&
    !isolateStrong &&
    (clearWheyWithoutIsolate ||
      isolateNameEvidence ||
      /\biso plus\b/i.test(name));

  const wheyDecision = wheyStrong
    ? include(
        [legacyWhey ? "LEGACY_REVIEWED_WHEY_BLEND" : "WHEY_SOURCE_EVIDENCE"],
        evidence
      )
    : wheyReview
      ? review(["WHEY_SOURCE_AMBIGUOUS"], evidence)
      : exclude(
          [wheyConflict ? "CONFLICTING_PROTEIN_SOURCE" : "NO_WHEY_SOURCE_EVIDENCE"],
          evidence
        );
  const isolateDecision = isolateStrong
    ? include(["WHEY_ISOLATE_SOURCE_EVIDENCE"], evidence)
    : isolateReview
      ? review(["ISOLATE_SOURCE_OR_BLEND_AMBIGUOUS"], evidence)
      : exclude(
          [isolateConflict ? "CONFLICTING_ISOLATE_SOURCE" : "NO_ISOLATE_EVIDENCE"],
          evidence
        );
  const veganDecision = veganStrong
    ? include(["PLANT_PROTEIN_SOURCE_EVIDENCE"], evidence)
    : exclude(
        [animalSourceLabel || animalName ? "ANIMAL_SOURCE_CONFLICT" : "NO_PLANT_PROTEIN_EVIDENCE"],
        evidence
      );
  const caseinDecision = caseinStrong
    ? include(["CASEIN_SOURCE_EVIDENCE"], evidence)
    : exclude(["NO_CASEIN_SOURCE_EVIDENCE"], evidence);
  const beefDecision = beefStrong
    ? include(["BEEF_PROTEIN_SOURCE_EVIDENCE"], evidence)
    : exclude(["NO_BEEF_PROTEIN_EVIDENCE"], evidence);
  const eggDecision = eggStrong
    ? include(["EGG_PROTEIN_SOURCE_EVIDENCE"], evidence)
    : exclude(["NO_EGG_PROTEIN_EVIDENCE"], evidence);

  const subtypeStrong = [
    wheyDecision,
    veganDecision,
    caseinDecision,
    beefDecision,
    eggDecision,
  ].some((value) => value.state === "INCLUDE_STRONG");
  const conventionalProteinName =
    PROTEIN.test(name) &&
    (format === "powder" ||
      category.toLowerCase() === "protein powder" ||
      categorySupportsWhey);
  const conventionalDescription =
    !format && /\bprotein supplement\b/i.test(description);
  const umbrellaAmbiguous =
    !excludedPresentation &&
    !subtypeStrong &&
    (AMBIGUOUS_UMBRELLA_BLEND.test(name) ||
      NITRO_TECH_WITHOUT_SOURCE.test(name) ||
      (conventionalProteinName && /\bcarbs\b/i.test(name)));
  const conventionalStrong =
    !excludedPresentation &&
    !umbrellaAmbiguous &&
    !COLLAGEN.test(nameAndDescription) &&
    (conventionalProteinName || conventionalDescription);
  const umbrellaDecision = subtypeStrong || conventionalStrong
    ? include(
        [subtypeStrong ? "SUPPORTED_PROTEIN_SUBTYPE" : "CONVENTIONAL_PROTEIN_POWDER_EVIDENCE"],
        evidence
      )
    : umbrellaAmbiguous
      ? review(["PROTEIN_POWDER_IDENTITY_AMBIGUOUS"], evidence)
      : exclude(["OUTSIDE_CONVENTIONAL_PROTEIN_POWDER_BOUNDARY"], evidence);

  return {
    umbrella: umbrellaDecision,
    whey: wheyDecision,
    isolate: isolateDecision,
    vegan: veganDecision,
    casein: caseinDecision,
    beef: beefDecision,
    egg: eggDecision,
  };
}
