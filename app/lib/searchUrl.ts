import type { SearchFilters, SearchSort } from "./products";
import type { SearchIntentUrlState } from "./searchIntent";

type SearchUrlOptions = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  intent?: SearchIntentUrlState;
  page?: number;
  updates?: Partial<SearchFilters> & { sort?: SearchSort };
  intentUpdates?: Partial<SearchIntentUrlState>;
};

export function searchUrl({
  query,
  sort,
  filters,
  intent,
  page = 1,
  updates = {},
  intentUpdates = {},
}: SearchUrlOptions) {
  const params = new URLSearchParams();
  const nextFilters = {
    ...filters,
    category: updates.category ?? filters.category,
    brand: updates.brand ?? filters.brand,
    retailer: updates.retailer ?? filters.retailer,
    caffeine: updates.caffeine ?? filters.caffeine,
  };
  const nextIntent: SearchIntentUrlState = {
    servingsMin: "servingsMin" in intentUpdates
      ? intentUpdates.servingsMin ?? null
      : intent?.servingsMin ?? null,
    proteinMinG: "proteinMinG" in intentUpdates
      ? intentUpdates.proteinMinG ?? null
      : intent?.proteinMinG ?? null,
    caffeineMaxMg: "caffeineMaxMg" in intentUpdates
      ? intentUpdates.caffeineMaxMg ?? null
      : intent?.caffeineMaxMg ?? null,
    format: "format" in intentUpdates
      ? intentUpdates.format ?? null
      : intent?.format ?? null,
    ingredients: "ingredients" in intentUpdates
      ? intentUpdates.ingredients || []
      : intent?.ingredients || [],
  };
  const nextSort = updates.sort ?? sort;

  if (query) {
    params.set("q", query);
  }

  if (nextFilters.category) {
    params.set("category", nextFilters.category);
  }

  if (nextFilters.brand) {
    params.set("brand", nextFilters.brand);
  }

  if (nextFilters.retailer) {
    params.set("retailer", nextFilters.retailer);
  }

  if (nextFilters.caffeine === "free") {
    params.set("caffeine", "free");
  }

  if (nextIntent.servingsMin !== null) {
    params.set("servings_min", String(nextIntent.servingsMin));
  }

  if (nextIntent.proteinMinG !== null) {
    params.set("protein_min_g", String(nextIntent.proteinMinG));
  }

  if (nextIntent.caffeineMaxMg !== null) {
    params.set("caffeine_max_mg", String(nextIntent.caffeineMaxMg));
  }

  if (nextIntent.format !== null) {
    params.set("format", nextIntent.format);
  }

  for (const ingredient of nextIntent.ingredients) {
    params.append("ingredient", ingredient);
  }

  if (nextSort !== "relevance") {
    params.set("sort", nextSort);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search ? `/search?${search}` : "/search";
}
