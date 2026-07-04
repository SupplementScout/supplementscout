import Link from "next/link";
import type { SearchFacets, SearchFilters, SearchSort } from "../lib/products";
import { searchUrl } from "../lib/searchUrl";

type ActiveSearchFiltersProps = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  facets: SearchFacets;
};

function retailerLabel(value: string, facets: SearchFacets) {
  return (
    facets.retailers.find((option) => option.value === value)?.label || value
  );
}

export default function ActiveSearchFilters({
  query,
  sort,
  filters,
  facets,
}: ActiveSearchFiltersProps) {
  const activeFilters = [
    filters.category
      ? {
          key: "category",
          label: "Category",
          value: filters.category,
          href: searchUrl({
            query,
            sort,
            filters,
            updates: { category: "" },
          }),
        }
      : null,
    filters.brand
      ? {
          key: "brand",
          label: "Brand",
          value: filters.brand,
          href: searchUrl({
            query,
            sort,
            filters,
            updates: { brand: "" },
          }),
        }
      : null,
    filters.retailer
      ? {
          key: "retailer",
          label: "Retailer",
          value: retailerLabel(filters.retailer, facets),
          href: searchUrl({
            query,
            sort,
            filters,
            updates: { retailer: "" },
          }),
        }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {activeFilters.map((filter) => (
        <Link
          key={filter.key}
          href={filter.href}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-950"
        >
          {filter.label}: {filter.value} <span aria-hidden="true">&times;</span>
        </Link>
      ))}

      <Link
        href={searchUrl({
          query,
          sort,
          filters: { category: "", brand: "", retailer: "" },
        })}
        className="text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
      >
        Clear all filters
      </Link>
    </div>
  );
}
