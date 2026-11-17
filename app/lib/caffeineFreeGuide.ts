import { selectGuideExample, type GuideProductsResult } from "./buyingGuides";
import type { AppliedPreWorkoutFacts } from "./reviewedPreWorkoutFacts";

export const CAFFEINE_FREE_PATH = "/guides/caffeine-free-pre-workout";
export const CAFFEINE_FREE_PRODUCTS = [
  { id: "481", slug: "applied-nutrition-abe-pump-500g", variantId: "763", flavour: "Tigers Blood", grams: 500 },
  { id: "528", slug: "nutrend--pump-pre-workout", variantId: "1848", flavour: "Bubble Gum", grams: 225 },
] as const;
export type CaffeineFreeGuideResult = GuideProductsResult & { appliedFacts: Record<string, AppliedPreWorkoutFacts> };

export function caffeineFreeExamples(result: CaffeineFreeGuideResult, now = new Date()) {
  return CAFFEINE_FREE_PRODUCTS.map((target) => {
    const example = selectGuideExample(result.rows, target, now);
    const applied = result.appliedFacts[target.variantId];
    const caffeine = applied?.facts.find((fact) => fact.key === "caffeine");
    if (!example?.row.bestOffer?.deliveredPrice || example.variant.product_format !== "powder" || !applied?.caffeineFreeConfirmed ||
      applied.productId !== target.id || applied.productVariantId !== target.variantId ||
      caffeine?.informationState !== "confirmed_absent" || caffeine.sourceKinds.length === 0) return null;
    return { ...example, offer: example.row.bestOffer, caffeine };
  }).filter((example) => example !== null)
    .sort((a, b) => a.offer.deliveredPrice!.totalPrice - b.offer.deliveredPrice!.totalPrice);
}
