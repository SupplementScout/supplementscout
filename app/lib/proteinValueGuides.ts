import { selectGuideExample } from "./buyingGuides";
import { evaluateProteinTaxonomy } from "./proteinTaxonomy";
import type { RawCategoryComparisonProduct } from "./categoryComparison";

export const WHEY_TYPE_GUIDE_PATH = "/guides/whey-isolate-vs-concentrate";
export const PACK_VALUE_GUIDE_PATH = "/guides/protein-powder-pack-size-value";
export const ISO_XP_SOURCE = "https://appliednutrition.uk/products/iso-xp";
export const CONCENTRATE_SOURCE = "https://7nutrition.eu/en/products/7nutrition-whey-protein-80-500g-598.html";
export const DAIRY_INGREDIENT_SOURCE = "https://www.adpi.org/wp-content/uploads/2022/07/Whey-and-Whey-Products_Human-Food-Definitions.pdf";

// Editorial source checks, 17 November 2026, for these exact examples only.
// Manufacturer Vanilla ingredients identify the sole whey source; these are
// not catalogue classifications or nutrition approvals. Never infer type from
// an arbitrary name, or generalise this evidence to another flavour/formula.
export const LARGE_ISOLATE = {
  id: "178", slug: "applied-nutrition-iso-xp-18kg", variantId: "735", flavour: "Vanilla", grams: 1800,
  brand: "Applied Nutrition", expectedName: "Applied Nutrition ISO-XP 1.8kg",
  label: "Applied Nutrition ISO-XP", proteinType: "Whey isolate", source: ISO_XP_SOURCE,
} as const;
export const SMALL_ISOLATE = { ...LARGE_ISOLATE, variantId: "4613", grams: 450 } as const;
export const CONCENTRATE = {
  id: "1005", slug: "7nutrition-whey-protein-80-500g", variantId: "2026", flavour: "Vanilla", grams: 500,
  brand: "7Nutrition", expectedName: "7Nutrition Whey Protein 80 500g",
  label: "7Nutrition Whey Protein 80", proteinType: "Whey concentrate", source: CONCENTRATE_SOURCE,
} as const;
export const WHEY_TYPE_TARGETS = [CONCENTRATE, LARGE_ISOLATE] as const;
export const PACK_VALUE_TARGETS = [SMALL_ISOLATE, LARGE_ISOLATE] as const;
type Target = typeof WHEY_TYPE_TARGETS[number] | typeof SMALL_ISOLATE;

function reviewedExample(products: RawCategoryComparisonProduct[], target: Target, now: Date) {
  const product = products.find(p => String(p.id) === target.id && p.slug === target.slug);
  if (!product || product.name !== target.expectedName || product.brand !== target.brand ||
    product.category !== "Whey Protein" || evaluateProteinTaxonomy(product).whey.state !== "INCLUDE_STRONG") return null;
  if (target.proteinType === "Whey isolate" && evaluateProteinTaxonomy(product).isolate.state !== "INCLUDE_STRONG") return null;
  const example = selectGuideExample(products, target, now);
  if (!example?.row.bestOffer?.deliveredPrice || example.variant.product_format !== "powder") return null;
  return { ...example, offer: example.row.bestOffer, label: target.label, proteinType: target.proteinType, source: target.source };
}

export function wheyTypeExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return WHEY_TYPE_TARGETS.map(t => reviewedExample(products, t, now)).filter(e => e !== null);
}
export type ProteinValueExample = NonNullable<ReturnType<typeof reviewedExample>>;

export function hasProteinValue(example: ProteinValueExample) {
  return example.nutritionApproved && example.totalProteinG !== null && example.totalProteinG > 0 &&
    example.row.costPer25gProtein !== null && example.row.verifiedServingCount !== null && example.row.proteinPerServingG !== null;
}

export function packValueComparison(products: RawCategoryComparisonProduct[], now = new Date()) {
  const small = reviewedExample(products, SMALL_ISOLATE, now), large = reviewedExample(products, LARGE_ISOLATE, now);
  if (!small || !large || small.row.id !== large.row.id || small.proteinType !== large.proteinType ||
    small.variant.flavour_label !== large.variant.flavour_label ||
    small.row.netWeightG !== SMALL_ISOLATE.grams || large.row.netWeightG !== LARGE_ISOLATE.grams ||
    !small.row.unitPricingVerified || !large.row.unitPricingVerified ||
    small.row.pricePerKg === null || large.row.pricePerKg === null) return null;
  const smallPence = Math.round(small.offer.deliveredPrice!.totalPrice * 100);
  const largePence = Math.round(large.offer.deliveredPrice!.totalPrice * 100);
  // Compare exact pennies and pack grams, never the displayed rounded unit costs.
  const order = largePence * small.row.netWeightG - smallPence * large.row.netWeightG;
  return { small, large,
    upfrontDifference: (largePence - smallPence) / 100,
    unitDifference: Math.abs(large.row.pricePerKg - small.row.pricePerKg),
    unitWinner: order < 0 ? "larger" : order > 0 ? "smaller" : "tie",
    bothProteinVerified: hasProteinValue(small) && hasProteinValue(large),
  };
}
