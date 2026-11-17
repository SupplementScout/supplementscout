import { selectGuideExample } from "./buyingGuides";
import { evaluateProteinTaxonomy } from "./proteinTaxonomy";
import type { RawCategoryComparisonProduct } from "./categoryComparison";

export const PROTEIN_BUDGET_PATH = "/guides/protein-powder-under-30";
export const PROTEIN_BUDGET_PENCE = 3000;
export const PROTEIN_BUDGET_PRODUCTS = [
  { id: "771", slug: "biotech-usa-100-pure-whey-454g", variantId: "949", flavour: "Hazelnut", grams: 454 },
  { id: "70", slug: "optimum-nutrition-100-plant-protein-684g", variantId: "1623", flavour: "Vanilla", grams: 684 },
  { id: "867", slug: "cnp-premium-whey-900g", variantId: "1318", flavour: "Chocolate Peanut Butter", grams: 900 },
] as const;

export function proteinBudgetExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return PROTEIN_BUDGET_PRODUCTS.map((target) => {
    const product = products.find((row) => String(row.id) === target.id && row.slug === target.slug);
    if (!product || evaluateProteinTaxonomy(product).umbrella.state !== "INCLUDE_STRONG") return null;
    const example = selectGuideExample(products, target, now);
    const offer = example?.row.bestOffer;
    if (!example || example.variant.product_format !== "powder" || !offer?.deliveredPrice ||
      Math.round(offer.deliveredPrice.totalPrice * 100) > PROTEIN_BUDGET_PENCE) return null;
    return { ...example, offer };
  }).filter((example) => example !== null)
    .sort((a, b) => a.offer.deliveredPrice!.totalPrice - b.offer.deliveredPrice!.totalPrice);
}
