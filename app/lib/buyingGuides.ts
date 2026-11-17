import {
  normalizeCategoryComparison,
  type CategoryComparisonOffer,
  type CategoryComparisonRow,
  type ComparisonNutritionVariant,
  type RawCategoryComparisonProduct,
  type RawComparisonOffer,
} from "./categoryComparison";
import { exactPackLabelFromVariant } from "./twoProductComparison";
import { getEffectiveNutritionMetrics, hasVariantAlignedReviewedNutrition } from "./nutritionMetrics";
import { isOfferFresh } from "./offerFreshness";
import { getVerifiedTotalPackageNutrient } from "./pricing";

export const DELIVERY_GUIDE_PATH = "/guides/supplement-prices-including-delivery";
export const PROTEIN_GUIDE_PATH = "/guides/cost-per-25g-protein";
export const DELIVERY_PRODUCT = {
  id: "407", slug: "cnp-creatine-monohydrate-250g",
  variantId: "2015", flavour: "Unflavoured", grams: 250,
} as const;
export const PROTEIN_PRODUCTS = [
  { id: "178", slug: "applied-nutrition-iso-xp-18kg", variantId: "732", flavour: "Banana", grams: 1800 },
  { id: "178", slug: "applied-nutrition-iso-xp-18kg", variantId: "735", flavour: "Vanilla", grams: 1800 },
] as const;

type ExampleTarget = {
  id: string; slug: string; variantId: string; flavour: string | null; grams: number;
};
export type GuideProductsResult = { rows: RawCategoryComparisonProduct[]; error: boolean };
export type GuideExample = {
  row: CategoryComparisonRow;
  variant: NonNullable<ComparisonNutritionVariant>;
  variantLabel: string;
  packLabel: string;
  productUrl: string;
  nutritionApproved: boolean;
  totalProteinG: number | null;
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function matchesVariant(product: RawCategoryComparisonProduct, offer: RawComparisonOffer, target: ExampleTarget) {
  const variant = one(offer.product_variant);
  return offer.variant_resolution === "resolved" && variant?.is_active === true &&
    String(variant.id) === target.variantId && String(variant.product_id) === target.id &&
    String(product.id) === target.id && product.slug === target.slug &&
    Number(variant.pack_count) === 1 && Number(variant.size_value) === target.grams &&
    variant.size_unit?.toLowerCase() === "g" &&
    (variant.flavour_label?.trim() || null) === target.flavour;
}

function hasExactProteinEvidence(variant: NonNullable<ComparisonNutritionVariant>) {
  const data = variant.nutrition_override || {};
  // Reviewed protein records may explicitly mark the unrelated creatine field
  // as null. Keep validating protein and pack alignment with the shared helper.
  const proteinEvidence = { ...data };
  if (proteinEvidence.creatine_per_serving_g === null) delete proteinEvidence.creatine_per_serving_g;
  return variant.product_format === "powder" &&
    Object.hasOwn(data, "protein_per_serving_g") &&
    data.source_type === "manufacturer_product_page" &&
    typeof data.source_url === "string" && /^https:\/\//.test(data.source_url) &&
    typeof data.evidence === "string" && data.evidence.trim().length >= 20 &&
    hasVariantAlignedReviewedNutrition(variant, proteinEvidence);
}

export function selectGuideExample(products: RawCategoryComparisonProduct[], target: ExampleTarget, now = new Date()): GuideExample | null {
  const product = products.find((candidate) => String(candidate.id) === target.id && candidate.slug === target.slug);
  if (!product || product.is_active !== true || product.merged_at !== null || product.merged_into_product_id !== null) return null;
  const scoped = (product.offers || []).filter((offer) => matchesVariant(product, offer, target));
  const variant = one(scoped[0]?.product_variant);
  if (!variant) return null;
  const packLabel = exactPackLabelFromVariant(variant);
  if (!packLabel) return null;
  const approved = hasExactProteinEvidence(variant);
  const normalized = normalizeCategoryComparison([{ ...product, offers: scoped }], {
    isProductInScope: () => true,
    resolveNutritionMetrics: (base) => {
      const metrics = getEffectiveNutritionMetrics(base, variant);
      return approved ? metrics : { ...metrics, protein_per_serving_g: null, nutrition_verified: false };
    },
    now,
  });
  const row = normalized.rows[0];
  if (!row) return null;
  return {
    row, variant, variantLabel: variant.display_name || variant.flavour_label || packLabel,
    packLabel, productUrl: `/product/${target.slug}?variant=${target.variantId}`,
    nutritionApproved: approved,
    totalProteinG: approved ? getVerifiedTotalPackageNutrient(
      row.verifiedServingCount, row.proteinPerServingG, row.unitPricingVerified,
      row.nutritionVerified, row.netWeightG, row.servingSizeG, row.productFormat
    ) : null,
  };
}

export function currentDeliveredOffers(example: GuideExample | null, now = new Date()) {
  const retailers = new Set<string>();
  return (example?.row.offers || []).filter((offer) => {
    if (!offer.deliveredPrice || !isOfferFresh(offer.lastCheckedAt, now) || retailers.has(offer.retailer.id)) return false;
    retailers.add(offer.retailer.id);
    return true;
  });
}

export function deliveryExample(products: RawCategoryComparisonProduct[], now = new Date()) {
  const example = selectGuideExample(products, DELIVERY_PRODUCT, now);
  const offers = currentDeliveredOffers(example, now).filter((offer) =>
    ["jon-s-supplements", "6-pack-supplements"].includes(offer.retailer.slug || "")
  );
  if (!example) return null;
  if (offers.length < 2) return { ...example, offers: [], reversed: false };
  const lowItem = [...offers].sort((a,b) => a.productPrice - b.productPrice)[0];
  const lowDelivered = [...offers].sort((a,b) => a.deliveredPrice!.totalPrice - b.deliveredPrice!.totalPrice)[0];
  const reversed = lowDelivered.productPrice > lowItem.productPrice &&
    lowDelivered.deliveredPrice!.totalPrice < lowItem.deliveredPrice!.totalPrice;
  return { ...example, offers: offers.slice(0, 2), reversed };
}

export function proteinExamples(products: RawCategoryComparisonProduct[], now = new Date()) {
  return PROTEIN_PRODUCTS.map((target) => selectGuideExample(products, target, now))
    .filter((example): example is GuideExample => example !== null);
}

export function guideStructuredData(path: string, title: string, description: string) {
  const site = "https://www.supplementscout.co.uk", url = site + path;
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": url, url, name: title, description, breadcrumb: { "@id": url + "#breadcrumb" } },
    { "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site },
      { "@type": "ListItem", position: 2, name: title, item: url },
    ] },
  ] };
}

export type GuideOffer = CategoryComparisonOffer;
