import "server-only";
import { getBuyingGuideProducts } from "./buyingGuideData";
import { selectGuideExample } from "./buyingGuides";
import { CAFFEINE_FREE_PRODUCTS, type CaffeineFreeGuideResult } from "./caffeineFreeGuide";
import { loadAppliedPreWorkoutFacts } from "./reviewedPreWorkoutFacts.server";

export async function getCaffeineFreeGuideData(): Promise<CaffeineFreeGuideResult> {
  const result = await getBuyingGuideProducts(CAFFEINE_FREE_PRODUCTS.map((target) => target.slug));
  if (result.error) return { ...result, appliedFacts: {} };
  const variants = CAFFEINE_FREE_PRODUCTS.flatMap((target) => {
    const example = selectGuideExample(result.rows, target);
    return example?.row.bestOffer?.deliveredPrice ? [{
      id: target.variantId, product_id: target.id,
      nutrition_override: example.variant.nutrition_override,
    }] : [];
  });
  try {
    const facts = await loadAppliedPreWorkoutFacts(variants, { failOnError: true });
    return { ...result, appliedFacts: Object.fromEntries(facts) };
  } catch {
    return { rows: [], appliedFacts: {}, error: true };
  }
}
