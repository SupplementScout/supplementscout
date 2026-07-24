"use client";

import { useRouter } from "next/navigation";
import type { SearchFilters, SearchSort } from "../lib/products";
import { sendAnalyticsEvent } from "../lib/analytics";
import { searchUrl } from "../lib/searchUrl";

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
  const router = useRouter();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="search-sort" className="text-sm font-medium text-zinc-600">
        Sort
      </label>
      <select
        id="search-sort"
        name="sort"
        value={sort}
        onChange={(event) => {
          const value = event.target.value as SearchSort;

          sendAnalyticsEvent("sort_used", { sort_option: value });
          router.push(
            searchUrl({
              query,
              sort,
              filters,
              updates: { sort: value },
            })
          );
        }}
        className="min-h-11 min-w-0 max-w-[152px] rounded-lg border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-900 sm:max-w-none sm:px-3"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
