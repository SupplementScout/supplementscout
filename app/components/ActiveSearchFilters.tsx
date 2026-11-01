import Link from "next/link";
import type { SearchFacets, SearchFilters, SearchSort } from "../lib/products";
import type { SearchIntentPlan, SearchIntentUrlState } from "../lib/searchIntent";
import { searchUrl } from "../lib/searchUrl";

type ActiveSearchFiltersProps = {
  query: string;
  sort: SearchSort;
  filters: SearchFilters;
  facets: SearchFacets;
  intent: SearchIntentUrlState;
  intentPlan: SearchIntentPlan;
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
  intent,
  intentPlan,
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
            intent,
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
            intent,
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
            intent,
            updates: { retailer: "" },
          }),
        }
      : null,
    filters.caffeine === "free"
      ? {
          key: "caffeine",
          label: "Caffeine",
          value: "Confirmed caffeine free",
          href: searchUrl({
            query,
            sort,
            filters,
            intent,
            updates: { caffeine: "" },
          }),
        }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  for (const constraint of intentPlan.appliedConstraints) {
    if (!constraint.removable || constraint.key === "caffeine_free") continue;

    if (constraint.key === "min_verified_servings") {
      activeFilters.push({
        key: constraint.key,
        label: "Intent",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          intentUpdates: { servingsMin: null },
        }),
      });
    } else if (constraint.key === "min_protein_per_serving") {
      activeFilters.push({
        key: constraint.key,
        label: "Intent",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          intentUpdates: { proteinMinG: null },
        }),
      });
    } else if (constraint.key === "max_caffeine") {
      activeFilters.push({
        key: constraint.key,
        label: "Intent",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          intentUpdates: { caffeineMaxMg: null },
        }),
      });
    } else if (constraint.key === "format") {
      activeFilters.push({
        key: constraint.key,
        label: "Intent",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          intentUpdates: { format: null },
        }),
      });
    } else if (constraint.key.startsWith("ingredient:")) {
      const ingredient = constraint.key.slice("ingredient:".length);
      activeFilters.push({
        key: constraint.key,
        label: "Intent",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          intentUpdates: {
            ingredients: intent.ingredients.filter((value) => value !== ingredient),
          },
        }),
      });
    } else if (constraint.key === "sort") {
      activeFilters.push({
        key: constraint.key,
        label: "Sort",
        value: constraint.label,
        href: searchUrl({
          query,
          sort,
          filters,
          intent,
          updates: { sort: "relevance" },
        }),
      });
    }
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {activeFilters.map((filter) => (
        <Link
          key={filter.key}
          prefetch={false}
          href={filter.href}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-950"
        >
          {filter.label}: {filter.value} <span aria-hidden="true">&times;</span>
        </Link>
      ))}

      <Link
        prefetch={false}
        href={searchUrl({
          query,
          sort: "relevance",
          filters: { category: "", brand: "", retailer: "", caffeine: "" },
          intent: {
            servingsMin: null,
            proteinMinG: null,
            caffeineMaxMg: null,
            format: null,
            ingredients: [],
          },
        })}
        className="text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-zinc-950"
      >
        Clear interpreted intent and filters
      </Link>
    </div>
  );
}
