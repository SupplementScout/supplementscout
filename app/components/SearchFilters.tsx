import Link from "next/link";
import type {
  SearchFacetOption,
  SearchFacets,
  SearchFilters,
  SearchSort,
} from "../lib/products";
import { searchUrl } from "../lib/searchUrl";

type SearchFiltersProps = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  facets: SearchFacets;
};

type FilterKey = keyof SearchFilters;

function FilterOptionList({
  title,
  filterKey,
  options,
  query,
  sort,
  filters,
}: {
  title: string;
  filterKey: FilterKey;
  options: SearchFacetOption[];
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>

      {options.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No options available</p>
      ) : (
        <div className="mt-3 space-y-1">
          {options.map((option) => {
            const isSelected = filters[filterKey] === option.value;

            return (
              <Link
                key={option.value}
                href={searchUrl({
                  query,
                  sort,
                  filters,
                  updates: {
                    [filterKey]: isSelected ? "" : option.value,
                  },
                })}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  isSelected
                    ? "bg-zinc-950 font-semibold text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                <span
                  className={
                    isSelected
                      ? "text-xs text-zinc-200"
                      : "text-xs text-zinc-500"
                  }
                >
                  {option.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SearchFilters({
  query,
  sort,
  filters,
  facets,
}: SearchFiltersProps) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <summary className="cursor-pointer text-base font-bold text-zinc-950">
        Filters
      </summary>

      <div className="mt-5 space-y-6">
        <FilterOptionList
          title="Category"
          filterKey="category"
          options={facets.categories}
          query={query}
          sort={sort}
          filters={filters}
        />
        <FilterOptionList
          title="Brand"
          filterKey="brand"
          options={facets.brands}
          query={query}
          sort={sort}
          filters={filters}
        />
        <FilterOptionList
          title="Retailer"
          filterKey="retailer"
          options={facets.retailers}
          query={query}
          sort={sort}
          filters={filters}
        />
      </div>
    </details>
  );
}
