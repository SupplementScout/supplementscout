"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  SearchFacetOption,
  SearchFacets,
  SearchFilters as SearchFilterValues,
  SearchSort,
} from "../lib/products";
import { searchUrl } from "../lib/searchUrl";
import { sendAnalyticsEvent } from "../lib/analytics";

type FilterKey = keyof SearchFilterValues;
const MOBILE_OPTION_LIMIT = 6;
const MOBILE_FILTER_QUERY = "(max-width: 1023px)";

function activeFilterLabel(
  key: FilterKey,
  value: string,
  facets: SearchFacets
) {
  if (key !== "retailer") return value;

  return facets.retailers.find((option) => option.value === value)?.label || value;
}

function FilterOptionList({
  title,
  filterKey,
  options,
  query,
  sort,
  filters,
  expanded,
  onExpand,
  onDraftChange,
}: {
  title: string;
  filterKey: FilterKey;
  options: SearchFacetOption[];
  query: string;
  sort: SearchSort;
  filters: SearchFilterValues;
  expanded: boolean;
  onExpand: () => void;
  onDraftChange: (key: FilterKey, value: string) => void;
}) {
  return (
    <details open className="group border-b border-zinc-200 pb-5 last:border-b-0">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-zinc-600">
        {title}
      </summary>

      {options.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No options available</p>
      ) : (
        <div className="mt-3 space-y-1">
          {options.map((option, index) => {
            const isSelected = filters[filterKey] === option.value;
            const nextValue = isSelected ? "" : option.value;

            return (
              <Link
                key={option.value}
                href={searchUrl({
                  query,
                  sort,
                  filters,
                  updates: { [filterKey]: nextValue },
                })}
                onClick={(event) => {
                  if (window.matchMedia(MOBILE_FILTER_QUERY).matches) {
                    event.preventDefault();
                    onDraftChange(filterKey, nextValue);
                    return;
                  }

                  sendAnalyticsEvent("filter_used", {
                    filter_name: filterKey,
                    filter_action: isSelected ? "remove" : "apply",
                  });
                }}
                className={`${
                  !expanded && index >= MOBILE_OPTION_LIMIT
                    ? "hidden lg:flex"
                    : "flex"
                } min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  isSelected
                    ? "bg-zinc-950 font-semibold text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                <span
                  className={isSelected ? "text-xs text-zinc-200" : "text-xs text-zinc-500"}
                >
                  {option.count}
                </span>
              </Link>
            );
          })}

          {!expanded && options.length > MOBILE_OPTION_LIMIT && (
            <button
              type="button"
              onClick={onExpand}
              className="mt-2 min-h-11 text-sm font-semibold text-zinc-700 underline underline-offset-4 lg:hidden"
            >
              Show more ({options.length - MOBILE_OPTION_LIMIT})
            </button>
          )}
        </div>
      )}
    </details>
  );
}

export default function SearchFilters({
  query,
  sort,
  filters,
  facets,
  isOpen,
  onClose,
}: {
  query: string;
  sort: SearchSort;
  filters: SearchFilterValues;
  facets: SearchFacets;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState(filters);
  const [expanded, setExpanded] = useState<Record<FilterKey, boolean>>({
    category: false,
    brand: false,
    retailer: false,
  });

  useEffect(() => {
    if (!isOpen) return;

    const mobileViewport = window.matchMedia(MOBILE_FILTER_QUERY);

    if (!mobileViewport.matches) {
      onClose();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    let scrollLocked = true;
    document.body.style.overflow = "hidden";

    function restoreBodyOverflow() {
      if (!scrollLocked) return;

      document.body.style.overflow = previousOverflow;
      scrollLocked = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    function onViewportChange(event: MediaQueryListEvent) {
      if (event.matches) return;

      restoreBodyOverflow();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    mobileViewport.addEventListener("change", onViewportChange);

    return () => {
      restoreBodyOverflow();
      window.removeEventListener("keydown", onKeyDown);
      mobileViewport.removeEventListener("change", onViewportChange);
    };
  }, [isOpen, onClose]);

  function closeWithoutApplying() {
    setDraftFilters(filters);
    onClose();
  }

  function applyFilters() {
    (Object.keys(draftFilters) as FilterKey[]).forEach((key) => {
      if (draftFilters[key] === filters[key]) return;

      sendAnalyticsEvent("filter_used", {
        filter_name: key,
        filter_action: draftFilters[key] ? "apply" : "remove",
      });
    });

    router.push(searchUrl({ query, sort, filters: draftFilters }));
    onClose();
    window.setTimeout(() => {
      document.getElementById("search-results-list")?.scrollIntoView({
        block: "start",
      });
    }, 100);
  }

  const activeDraftFilters = (Object.keys(draftFilters) as FilterKey[]).filter(
    (key) => draftFilters[key]
  );

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close filters"
          onClick={closeWithoutApplying}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        aria-label="Search filters"
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? true : undefined}
        className={`${
          isOpen ? "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm" : "hidden"
        } min-w-0 flex-col bg-white shadow-2xl lg:sticky lg:top-6 lg:z-auto lg:block lg:w-auto lg:max-w-none lg:self-start lg:rounded-lg lg:border lg:border-zinc-200 lg:p-4 lg:shadow-sm`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 lg:hidden">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">Filters</h2>
            <p className="text-sm text-zinc-500">Refine these search results</p>
          </div>
          <button
            type="button"
            onClick={closeWithoutApplying}
            className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:overflow-visible lg:p-0">
          {activeDraftFilters.length > 0 && (
            <div className="mb-5 lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Active filters
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeDraftFilters.map((key) => (
                  <span
                    key={key}
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800"
                  >
                    {activeFilterLabel(key, draftFilters[key], facets)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5">
            <FilterOptionList
              title="Category"
              filterKey="category"
              options={facets.categories}
              query={query}
              sort={sort}
              filters={draftFilters}
              expanded={expanded.category}
              onExpand={() => setExpanded((current) => ({ ...current, category: true }))}
              onDraftChange={(key, value) =>
                setDraftFilters((current) => ({ ...current, [key]: value }))
              }
            />
            <FilterOptionList
              title="Brand"
              filterKey="brand"
              options={facets.brands}
              query={query}
              sort={sort}
              filters={draftFilters}
              expanded={expanded.brand}
              onExpand={() => setExpanded((current) => ({ ...current, brand: true }))}
              onDraftChange={(key, value) =>
                setDraftFilters((current) => ({ ...current, [key]: value }))
              }
            />
            <FilterOptionList
              title="Retailer"
              filterKey="retailer"
              options={facets.retailers}
              query={query}
              sort={sort}
              filters={draftFilters}
              expanded={expanded.retailer}
              onExpand={() => setExpanded((current) => ({ ...current, retailer: true }))}
              onDraftChange={(key, value) =>
                setDraftFilters((current) => ({ ...current, [key]: value }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 bg-white p-4 lg:hidden">
          <button
            type="button"
            onClick={() =>
              setDraftFilters({ category: "", brand: "", retailer: "" })
            }
            className="min-h-12 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-800"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="min-h-12 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white"
          >
            Show results
          </button>
        </div>
      </aside>
    </>
  );
}
