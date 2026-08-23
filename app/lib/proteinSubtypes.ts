type ProteinSubtypeCandidate = {
  name: string;
  category?: string | null;
  product_format?: string | null;
};

const EXPLICIT_ISOLATE_IDENTITY =
  /(?:\bisolate\b|\bwpi\b|\biso(?:[-\s]?(?:xp|hd|100))?\b)/i;
const EXCLUDED_ISOLATE_IDENTITY =
  /(?:\bblend\b|\btri[-\s]?blend\b|\bbeef\b|\bcollagen\b)/i;

const PLANT_IDENTITY = /\b(vegan|plant(?:[ -]based)?|pea|rice|hemp)\b/i;
const PROTEIN_IDENTITY = /\bprotein\b/i;
const NON_POWDER_FOOD =
  /\b(bar|bars|bite|bites|cookie|cookies|wafer|flapjack|spread|snack|brownie|drink|gel|meal)\b/i;
export const ANIMAL_PROTEIN_IDENTITY =
  /\b(whey|casein|collagen|beef|egg|milk protein)\b/i;

export function hasReviewedWheyIsolateIdentity(
  product: ProteinSubtypeCandidate
) {
  return (
    product.category?.trim().toLowerCase() === "whey protein" &&
    EXPLICIT_ISOLATE_IDENTITY.test(product.name) &&
    !EXCLUDED_ISOLATE_IDENTITY.test(product.name)
  );
}

export function hasReviewedVeganProteinIdentity(
  product: ProteinSubtypeCandidate
) {
  return (
    PLANT_IDENTITY.test(product.name) &&
    PROTEIN_IDENTITY.test(product.name) &&
    !NON_POWDER_FOOD.test(product.name) &&
    !ANIMAL_PROTEIN_IDENTITY.test(product.name) &&
    (product.product_format == null || product.product_format === "powder")
  );
}
