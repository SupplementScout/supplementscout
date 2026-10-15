"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendAnalyticsEvent } from "../lib/analytics";
import {
  categoryControlUrl,
  type CategoryControlFacet,
  type CategoryControlFilter,
  type CategoryControlSort,
  type CategoryControlValues,
} from "../lib/categoryControls";

const MOBILE_FILTER_QUERY = "(max-width: 1023px)";

const sortLabels: Record<CategoryControlSort, string> = {
  decision: "Recommended order",
  delivered_total: "Lowest delivered total",
  verified_value: "Best verified value",
  retailer_coverage: "Widest retailer coverage",
};

function FilterGroup({
  title,
  filterName,
  options,
  basePath,
  controls,
  category,
  onNavigate,
}: {
  title: string;
  filterName: CategoryControlFilter;
  options: CategoryControlFacet[];
  basePath: string;
  controls: CategoryControlValues;
  category: string;
  onNavigate?: () => void;
}) {
  if (options.length < 2) return null;
  const selected = controls[filterName];

  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
        {title}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Link
              key={option.value}
              href={categoryControlUrl(basePath, controls, {
                [filterName]: active ? "" : option.value,
              })}
              onClick={() => {
                sendAnalyticsEvent("category_filter_used", {
                  category,
                  filter_name: filterName,
                  filter_action: active ? "remove" : "apply",
                });
                onNavigate?.();
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${
                active
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              <span>{option.label}</span>
              <span className={active ? "text-zinc-300" : "text-zinc-500"}>
                {option.count}
              </span>
            </Link>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function CategoryComparisonControls({
  basePath,
  category,
  controls,
  facets,
  sorts,
  resultCount,
  totalCount,
}: {
  basePath: string;
  category: string;
  controls: CategoryControlValues;
  facets: {
    brands: CategoryControlFacet[];
    retailers: CategoryControlFacet[];
    formats: CategoryControlFacet[];
  };
  sorts: CategoryControlSort[];
  resultCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const groups = [
    { title: "Brand", filterName: "brand" as const, options: facets.brands },
    {
      title: "Retailer",
      filterName: "retailer" as const,
      options: facets.retailers,
    },
    { title: "Format", filterName: "format" as const, options: facets.formats },
  ].filter((group) => group.options.length >= 2);

  useEffect(() => {
    if (!isOpen) return;
    const mobileViewport = window.matchMedia(MOBILE_FILTER_QUERY);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const onViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    mobileViewport.addEventListener("change", onViewportChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      mobileViewport.removeEventListener("change", onViewportChange);
    };
  }, [isOpen]);

  const filterGroups = (onNavigate?: () => void) => (
    <div className="space-y-5">
      {groups.map((group) => (
        <FilterGroup
          key={group.filterName}
          {...group}
          basePath={basePath}
          controls={controls}
          category={category}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-700" aria-live="polite">
          Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong>{" "}
          products
        </p>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold lg:hidden"
            >
              Filters
            </button>
          )}
          <label htmlFor={`${basePath}-sort`} className="text-sm font-medium text-zinc-600">
            Sort
          </label>
          <select
            id={`${basePath}-sort`}
            value={controls.sort}
            onChange={(event) => {
              const sort = event.target.value as CategoryControlSort;
              sendAnalyticsEvent("category_sort_used", {
                category,
                sort_option: sort,
              });
              router.push(categoryControlUrl(basePath, controls, { sort }));
            }}
            className="min-h-11 min-w-0 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold"
          >
            {sorts.map((sort) => (
              <option key={sort} value={sort}>
                {sortLabels[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="mt-5 hidden border-t border-zinc-200 pt-5 lg:block">
          {filterGroups()}
        </div>
      )}

      {resultCount === 0 && totalCount > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-zinc-950">
            No products match these filters.
          </p>
          <Link href={basePath} className="mt-2 inline-flex font-semibold underline">
            Clear filters and show all products
          </Link>
        </div>
      )}

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close category filters"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-filter-heading"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4">
              <h2 id="category-filter-heading" className="text-lg font-bold">
                Filter products
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 rounded-lg border border-zinc-300 px-4 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {filterGroups(() => setIsOpen(false))}
            </div>
            <div className="border-t border-zinc-200 p-4">
              <Link
                href={basePath}
                onClick={() => setIsOpen(false)}
                className="flex min-h-12 items-center justify-center rounded-lg border border-zinc-300 font-semibold"
              >
                Clear all filters
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
