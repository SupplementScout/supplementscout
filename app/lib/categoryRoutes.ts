import {
  hasReviewedVeganProteinIdentity,
  hasReviewedWheyIsolateIdentity,
} from "./proteinSubtypes";

export const COMPARISON_CATEGORY_LINKS = Object.freeze([
  { label: "Vitamins", href: "/vitamins" },
  { label: "Creatine", href: "/creatine" },
  { label: "Whey Protein", href: "/whey-protein" },
  { label: "Whey Isolate", href: "/whey-isolate" },
  { label: "Vegan Protein", href: "/vegan-protein" },
  { label: "Mass Gainer", href: "/mass-gainer" },
  { label: "Multivitamins", href: "/multivitamins" },
  { label: "Pre Workout", href: "/pre-workout" },
  { label: "Amino Acids", href: "/amino-acids" },
  { label: "Magnesium", href: "/magnesium" },
  { label: "Vitamin D", href: "/vitamin-d" },
  { label: "Omega 3", href: "/omega-3" },
  { label: "Hydration", href: "/hydration" },
  { label: "Glucosamine", href: "/glucosamine" },
]);

const comparisonLinkByCategory = new Map(
  COMPARISON_CATEGORY_LINKS.map((link) => [link.label.toLowerCase(), link])
);

export function comparisonLinkForCategory(
  category: string | null | undefined
) {
  const normalized = category?.trim().toLowerCase();
  return normalized ? comparisonLinkByCategory.get(normalized) || null : null;
}

export function comparisonLinkForProduct(product: {
  name: string;
  category?: string | null;
  product_format?: string | null;
}) {
  if (hasReviewedVeganProteinIdentity(product)) {
    return comparisonLinkForCategory("Vegan Protein");
  }
  if (hasReviewedWheyIsolateIdentity(product)) {
    return comparisonLinkForCategory("Whey Isolate");
  }
  return comparisonLinkForCategory(product.category);
}

export function categoryBrowseHref(category: string) {
  return (
    comparisonLinkForCategory(category)?.href ||
    `/search?q=${encodeURIComponent(category)}`
  );
}
