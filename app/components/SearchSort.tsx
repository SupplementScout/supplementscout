"use client";

import { useRouter } from "next/navigation";
import type { SearchFilters, SearchSort } from "../lib/products";
import type { SearchIntentUrlState } from "../lib/searchIntent";
import { sendAnalyticsEvent } from "../lib/analytics";
import { searchUrl } from "../lib/searchUrl";

const sortOptions: Array<{ value: SearchSort; label: string }> = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Lowest delivered price" },
  { value: "price_desc", label: "Highest delivered price" },
  { value: "price_per_serving_asc", label: "Lowest cost/serving" },
  { value: "cost_per_25g_protein_asc", label: "Lowest cost/25 g protein" },
  { value: "cost_per_5g_creatine_asc", label: "Lowest cost/5 g creatine" },
];

export default function SearchSort({
  query,
  sort,
  filters,
  intent,
}: {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  intent: SearchIntentUrlState;
}) {
  const router = useRouter();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="search-sort" className="sr-only text-sm font-medium text-zinc-600 sm:not-sr-only">
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
              intent,
              updates: { sort: value },
            })
          );
        }}
        className="min-h-11 min-w-0 max-w-[170px] rounded-lg border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-900 sm:max-w-none sm:px-3"
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
