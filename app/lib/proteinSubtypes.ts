import {
  evaluateProteinTaxonomy,
  type ProteinSemanticInput,
} from "./proteinTaxonomy";

export type ProteinSubtypeCandidate = ProteinSemanticInput;

export function hasReviewedWheyIsolateIdentity(
  product: ProteinSubtypeCandidate
) {
  return evaluateProteinTaxonomy(product).isolate.state === "INCLUDE_STRONG";
}

export function hasReviewedVeganProteinIdentity(
  product: ProteinSubtypeCandidate
) {
  return evaluateProteinTaxonomy(product).vegan.state === "INCLUDE_STRONG";
}
