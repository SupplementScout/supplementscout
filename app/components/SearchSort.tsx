"use client";

import type { SearchFilters, SearchSort } from "../lib/products";
import { sendAnalyticsEvent } from "../lib/analytics";

const sortOptions: Array<{ value: SearchSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Lowest total price" },
  { value: "price_desc", label: "Highest total price" },
  { value: "price_per_serving_asc", label: "Lowest price per serving" },
];

export default function SearchSort({
  query,
  sort,
  filters,
}: {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
}) {
  return (
    <form
      action="/search"
      className="flex items-center gap-3"
      onSubmit={(event) => {
        const value = new FormData(event.currentTarget).get("sort") as SearchSort | null;
        if (value) sendAnalyticsEvent("sort_used", { sort_option: value });
      }}
    >
      <input type="hidden" name="q" value={query} />
      {filters.category && (
        <input type="hidden" name="category" value={filters.category} />
      )}
      {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
      {filters.retailer && (
        <input type="hidden" name="retailer" value={filters.retailer} />
      )}
      <label htmlFor="search-sort" className="text-sm font-medium text-zinc-600">
        Sort
      </label>
      <select
        id="search-sort"
        name="sort"
        defaultValue={sort}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg border border-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-950"
      >
        Apply
      </button>
    </form>
  );
}
