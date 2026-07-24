"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type {
  SearchFacets,
  SearchFilters as SearchFilterValues,
  SearchSort as SearchSortValue,
} from "../lib/products";
import SearchFilters from "./SearchFilters";
import SearchSort from "./SearchSort";

export default function SearchResultsLayout({
  query,
  sort,
  filters,
  facets,
  totalCount,
  heading,
  activeFilters,
  children,
}: {
  query: string;
  sort: SearchSortValue;
  filters: SearchFilterValues;
  facets: SearchFacets;
  totalCount: number;
  heading: ReactNode;
  activeFilters: ReactNode;
  children: ReactNode;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    filters.category,
    filters.brand,
    filters.retailer,
  ].filter(Boolean).length;
  const hasFilterOptions =
    activeFilterCount > 0 ||
    facets.categories.length > 0 ||
    facets.brands.length > 0 ||
    facets.retailers.length > 0;

  return (
    <>
      <div className="mt-6 flex min-w-0 flex-col gap-4 md:mt-8 md:flex-row md:items-end md:justify-between">
        {heading}

        {(totalCount > 0 || hasFilterOptions) && (
          <div className="flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm md:w-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <span className="mr-auto pl-2 text-sm font-semibold text-zinc-700 md:hidden">
              {totalCount} result{totalCount === 1 ? "" : "s"}
            </span>
            {hasFilterOptions && (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 lg:hidden"
              >
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
            )}
            {totalCount > 0 && (
              <SearchSort query={query} sort={sort} filters={filters} />
            )}
          </div>
        )}
      </div>

      {activeFilters}

      <div
        className={`mt-5 grid min-w-0 gap-5 lg:mt-8 lg:gap-6 ${
          hasFilterOptions ? "lg:grid-cols-[280px_minmax(0,1fr)]" : ""
        }`}
      >
        {hasFilterOptions && (
          <SearchFilters
            key={`${filters.category}:${filters.brand}:${filters.retailer}`}
            query={query}
            sort={sort}
            filters={filters}
            facets={facets}
            isOpen={filtersOpen}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        <div id="search-results-list" className="min-w-0 scroll-mt-4">
          {children}
        </div>
      </div>
    </>
  );
}
