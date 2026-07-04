import type { SearchFilters, SearchSort } from "./products";

type SearchUrlOptions = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  updates?: Partial<SearchFilters> & { sort?: SearchSort };
};

export function searchUrl({ query, sort, filters, updates = {} }: SearchUrlOptions) {
  const params = new URLSearchParams();
  const nextFilters = {
    ...filters,
    category: updates.category ?? filters.category,
    brand: updates.brand ?? filters.brand,
    retailer: updates.retailer ?? filters.retailer,
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

  if (nextSort !== "relevance") {
    params.set("sort", nextSort);
  }

  const search = params.toString();

  return search ? `/search?${search}` : "/search";
}
