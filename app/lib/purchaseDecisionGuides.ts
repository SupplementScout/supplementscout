import { selectGuideExample } from "./buyingGuides";
import type { RawCategoryComparisonProduct } from "./categoryComparison";
import { isMassGainerProduct } from "./massGainerComparison";
import { evaluateProteinTaxonomy } from "./proteinTaxonomy";

export const MASS_WHEY_GUIDE_PATH = "/guides/mass-gainer-vs-whey-protein";
export const CREATINE_PACK_GUIDE_PATH = "/guides/creatine-pack-size-value";
// Editorial ingredient/size sources checked17 November2026 for these pins only.
// They do not approve nutrition, classify arbitrary products or alter mappings.
export const HYPER_MASS = {
  id: "1058", slug: "biotech-usa-hyper-mass-4kg", variantId: "2223", flavour: "Strawberry", grams: 4000,
  expectedName: "BioTech USA Hyper Mass 4kg", brand: "BioTech USA", label: "BioTech USA Hyper Mass",
  kind: "Carbohydrate-and-protein blend", source: "https://shop.biotechusa.com/products/hyper-mass-4000-g",
} as const;
export const EFECTIV_WHEY = {
  id: "746", slug: "efectiv-nutrition-grass-fed-whey-protein-isolate-2kg", variantId: "1196", flavour: "Strawberry Milkshake", grams: 2000,
  expectedName: "Efectiv Nutrition Grass-Fed Whey Protein Isolate 2kg", brand: "Efectiv Nutrition", label: "Efectiv Grass-Fed Whey Protein Isolate",
  kind: "Whey isolate powder", source: "https://efectivnutrition.com/products/efectiv-grass-fed-whey-protein-isolate-2kg",
} as const;
export const MASS_WHEY_TARGETS = [HYPER_MASS, EFECTIV_WHEY] as const;
export const APPLIED_SMALL = {
  id: "742", slug: "applied-nutrition-creatine-monohydrate-250g", variantId: "799", flavour: "Unflavoured", grams: 250,
  expectedName: "Applied Nutrition Creatine Monohydrate 250g", brand: "Applied Nutrition", label: "Applied Nutrition Creatine Monohydrate",
  kind: "Unflavoured creatine powder", source: "https://appliednutrition.uk/products/creatine-monohydrate",
} as const;
export const APPLIED_LARGE = { ...APPLIED_SMALL, variantId: "4559", grams: 500 } as const;
export const OPTIMUM_SMALL = {
  id: "231", slug: "optimum-nutrition-micronised-creatine-317g", variantId: "783", flavour: "Unflavoured", grams: 317,
  expectedName: "Optimum Nutrition Micronised Creatine 317g", brand: "Optimum Nutrition", label: "Optimum Nutrition Micronised Creatine",
  kind: "Unflavoured creatine powder", source: "https://www.optimumnutrition.com/en-gb/products/micronised-creatine-powder",
} as const;
export const OPTIMUM_LARGE = { ...OPTIMUM_SMALL, variantId: "4614", grams: 634 } as const;
export const CREATINE_PACK_FAMILIES = [
  { key: "applied", small: APPLIED_SMALL, large: APPLIED_LARGE },
  { key: "optimum", small: OPTIMUM_SMALL, large: OPTIMUM_LARGE },
] as const;
export const CREATINE_PACK_TARGETS = CREATINE_PACK_FAMILIES.flatMap(f => [f.small, f.large]);
type Target = typeof MASS_WHEY_TARGETS[number] | typeof CREATINE_PACK_TARGETS[number];

function reviewedExample(products: RawCategoryComparisonProduct[], target: Target, now: Date) {
  const product = products.find(p => String(p.id) === target.id && p.slug === target.slug);
  if (!product || product.name !== target.expectedName || product.brand !== target.brand) return null;
  if (target.id === HYPER_MASS.id ? !isMassGainerProduct(product) :
    target.id === EFECTIV_WHEY.id ? product.category !== "Whey Protein" || evaluateProteinTaxonomy(product).whey.state !== "INCLUDE_STRONG" :
    product.category !== "Creatine") return null;
  const example = selectGuideExample(products, target, now), offer = example?.row.bestOffer;
  if (!example || example.variant.product_format !== "powder" || !offer?.deliveredPrice) return null;
  return { ...example, offer, label: target.label, kind: target.kind, source: target.source };
}
export type PurchaseGuideExample = NonNullable<ReturnType<typeof reviewedExample>>;
export function massWheyExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return MASS_WHEY_TARGETS.map(t => reviewedExample(products, t, now)).filter(e => e !== null);
}
export function creatinePackComparisons(products: RawCategoryComparisonProduct[], now = new Date()) {
  return CREATINE_PACK_FAMILIES.map(family => {
    const small = reviewedExample(products, family.small, now), large = reviewedExample(products, family.large, now);
    if (!small || !large || small.row.id !== large.row.id || small.variant.flavour_label !== large.variant.flavour_label ||
      small.row.netWeightG !== family.small.grams || large.row.netWeightG !== family.large.grams ||
      !small.row.unitPricingVerified || !large.row.unitPricingVerified || small.row.pricePerKg === null || large.row.pricePerKg === null) return null;
    const smallPence = Math.round(small.offer.deliveredPrice!.totalPrice * 100), largePence = Math.round(large.offer.deliveredPrice!.totalPrice * 100);
    const order = largePence * family.small.grams - smallPence * family.large.grams;
    return { key: family.key, small, large, upfrontDifference: (largePence - smallPence) / 100,
      unitDifference: Math.abs(small.row.pricePerKg - large.row.pricePerKg), unitWinner: order < 0 ? "larger" : order > 0 ? "smaller" : "tie" };
  }).filter(pair => pair !== null);
}
