import { selectGuideExample } from "./buyingGuides";
import type { RawCategoryComparisonProduct } from "./categoryComparison";
import { isPreWorkoutProduct } from "./preWorkoutComparison";
import { isMassGainerProduct } from "./massGainerComparison";
import { getVerifiedPricePerServing } from "./pricing";

export const PRE_WORKOUT_BUDGET_PATH = "/guides/pre-workout-under-30";
export const MASS_GAINER_BUDGET_PATH = "/guides/mass-gainer-under-40";
export const PRE_WORKOUT_BUDGET_PENCE = 3000;
export const MASS_GAINER_BUDGET_PENCE = 4000;

// Existing catalogue identities only. A changed name, brand, flavour or pack
// needs a new editorial check; these pins never create or repair a mapping.
export const PRE_WORKOUT_BUDGET_TARGETS = [
  { id: "56", slug: "warrior-rage-unleash-hell-pre-workout-392g", variantId: "1006", flavour: "Blazin Berry", grams: 392,
    expectedName: "Warrior Rage Unleash Hell Pre Workout 392g", brand: "Warrior", label: "Warrior Rage Unleash Hell" },
  { id: "215", slug: "applied-nutrition-abe-ultimate-pre-workout-315g", variantId: "1672", flavour: "Baddy Berry", grams: 315,
    expectedName: "Applied Nutrition ABE Ultimate Pre-Workout 315g", brand: "Applied Nutrition", label: "Applied Nutrition ABE Ultimate Pre-Workout" },
  { id: "1457", slug: "cellucor-c4-sport-pre-workout-powder", variantId: "4610", flavour: "Icy Blue Raspberry", grams: 270,
    expectedName: "Cellucor C4 Sport Pre-Workout Powder", brand: "Cellucor", label: "Cellucor C4 Sport Pre-Workout" },
] as const;
export const MASS_GAINER_BUDGET_TARGETS = [
  { id: "128", slug: "7nutrition-bodybuilder-15kg", variantId: "2009", flavour: "Cookies & Cream", grams: 1500,
    expectedName: "7Nutrition Bodybuilder 1.5kg", brand: "7Nutrition", label: "7Nutrition Bodybuilder" },
  { id: "517", slug: "mutant-mass-mass-gainer-227kg", variantId: "1973", flavour: "Vanilla Ice Cream", grams: 2270,
    expectedName: "Mutant Mass (Mass Gainer) 2.27kg", brand: "Mutant", label: "Mutant Mass" },
  { id: "132", slug: "applied-nutrition-critical-mass-lean-mass-gainz-24kg", variantId: "1803", flavour: "Chocolate", grams: 2400,
    expectedName: "Applied Nutrition Critical Mass Lean Mass Gainz 2.4kg", brand: "Applied Nutrition", label: "Applied Nutrition Critical Mass Lean Mass Gainz" },
] as const;

type Target = typeof PRE_WORKOUT_BUDGET_TARGETS[number] | typeof MASS_GAINER_BUDGET_TARGETS[number];
function budgetExamples(products: RawCategoryComparisonProduct[], targets: readonly Target[], budgetPence: number,
  inScope: (product: RawCategoryComparisonProduct) => boolean, now: Date) {
  return targets.map(target => {
    const product = products.find(p => String(p.id) === target.id && p.slug === target.slug);
    if (!product || product.name !== target.expectedName || product.brand !== target.brand || !inScope(product)) return null;
    const example = selectGuideExample(products, target, now), offer = example?.row.bestOffer;
    if (!example || example.variant.product_format !== "powder" || !offer?.deliveredPrice ||
      Math.round(offer.deliveredPrice.totalPrice * 100) > budgetPence) return null;
    // Reuse the strict own-variant reviewed nutrition/pack gate. Never infer a
    // serving count from a name, scoop text, parent record or weight division.
    const costPerServing = example.nutritionApproved && example.totalProteinG !== null
      ? getVerifiedPricePerServing(offer.deliveredPrice, example.row.verifiedServingCount) : null;
    return { ...example, offer, label: target.label,
      verifiedServings: costPerServing !== null ? example.row.verifiedServingCount : null, costPerServing };
  }).filter(example => example !== null)
    .sort((a, b) => Math.round(a.offer.deliveredPrice!.totalPrice * 100) - Math.round(b.offer.deliveredPrice!.totalPrice * 100));
}
export type BudgetPurchaseExample = ReturnType<typeof budgetExamples>[number];
export function preWorkoutBudgetExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return budgetExamples(products, PRE_WORKOUT_BUDGET_TARGETS, PRE_WORKOUT_BUDGET_PENCE, isPreWorkoutProduct, now);
}
export function massGainerBudgetExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return budgetExamples(products, MASS_GAINER_BUDGET_TARGETS, MASS_GAINER_BUDGET_PENCE, isMassGainerProduct, now);
}
export function deliveryOrderChange(examples: BudgetPurchaseExample[]) {
  for (const lowerItem of examples) for (const higherItem of examples) {
    if (Math.round(lowerItem.offer.productPrice * 100) < Math.round(higherItem.offer.productPrice * 100) &&
      Math.round(lowerItem.offer.deliveredPrice!.totalPrice * 100) > Math.round(higherItem.offer.deliveredPrice!.totalPrice * 100)) {
      return { lowerItem, higherItem };
    }
  }
  return null;
}
export function lowestPowderUnitExample(examples: BudgetPurchaseExample[]) {
  const verified = examples.filter(e => e.row.unitPricingVerified && e.row.netWeightG !== null && e.row.pricePerKg !== null);
  return verified.sort((a,b) => Math.round(a.offer.deliveredPrice!.totalPrice * 100) * b.row.netWeightG! -
    Math.round(b.offer.deliveredPrice!.totalPrice * 100) * a.row.netWeightG!)[0] || null;
}
