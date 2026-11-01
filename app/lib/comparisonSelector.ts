export const COMPARISON_PATH = "/compare";

export type ComparisonSelectorOption = {
  id: string;
  brand: string | null;
  name: string;
  exactVariantLabel: string | null;
  exactPackLabel: string | null;
};

export function normalizeComparisonSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
}

export function comparisonSelectorOptionLabel(option: ComparisonSelectorOption) {
  return [option.brand, option.name, option.exactVariantLabel || option.exactPackLabel]
    .filter(Boolean)
    .join(" - ");
}

export function sortComparisonSelectorOptions(options: ComparisonSelectorOption[]) {
  return [...options].sort(
    (left, right) =>
      (left.brand || "").localeCompare(right.brand || "") ||
      left.name.localeCompare(right.name) ||
      (left.exactVariantLabel || "").localeCompare(right.exactVariantLabel || "") ||
      (left.exactPackLabel || "").localeCompare(right.exactPackLabel || "")
  );
}

export function filterComparisonSelectorOptions(
  options: ComparisonSelectorOption[],
  query: string,
  excludedId: string | null = null
) {
  const normalizedQuery = normalizeComparisonSearch(query);
  if (!normalizedQuery) return [];

  return options.filter((option) => {
    if (option.id === excludedId) return false;
    const searchableText = normalizeComparisonSearch(
      [option.brand, option.name, option.exactVariantLabel, option.exactPackLabel]
        .filter(Boolean)
        .join(" ")
    );
    return searchableText.includes(normalizedQuery);
  });
}

export function comparisonSelectorStatus(
  query: string,
  matchCount: number,
  visibleCount: number
) {
  if (!normalizeComparisonSearch(query)) {
    return "Type a brand, product name, flavour, variant or pack size.";
  }
  if (matchCount === 0) return "No products match your search.";
  if (matchCount > visibleCount) {
    return `Showing ${visibleCount} of ${matchCount} matches. Refine your search to narrow the list.`;
  }
  return `${matchCount} matching product${matchCount === 1 ? "" : "s"}.`;
}

export function comparisonHref(
  leftId: string | null,
  rightId: string | null = null
) {
  const params = new URLSearchParams();
  if (leftId) params.set("left", leftId);
  if (rightId) params.set("right", rightId);
  const query = params.toString();
  return query ? `${COMPARISON_PATH}?${query}` : COMPARISON_PATH;
}
