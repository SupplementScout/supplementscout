"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  comparisonHref,
  comparisonSelectorOptionLabel,
  comparisonSelectorStatus,
  filterComparisonSelectorOptions,
  normalizeComparisonSearch,
  type ComparisonSelectorOption,
} from "../lib/comparisonSelector";

const MAX_VISIBLE_RESULTS = 12;

type SelectorProps = {
  slot: "left" | "right";
  label: "Product A" | "Product B";
  options: ComparisonSelectorOption[];
  leftId: string | null;
  rightId: string | null;
};

export function SearchableComparisonSelector({
  slot,
  label,
  options,
  leftId,
  rightId,
}: SelectorProps) {
  const selectedId = slot === "left" ? leftId : rightId;
  const otherSelectedId = slot === "left" ? rightId : leftId;
  const selected = options.find((option) => option.id === selectedId) || null;
  const [isChanging, setIsChanging] = useState(!selected);
  const [query, setQuery] = useState("");
  const inputId = useId();
  const resultsId = useId();
  const statusId = useId();
  const matches = filterComparisonSelectorOptions(options, query, otherSelectedId);
  const visibleMatches = matches.slice(0, MAX_VISIBLE_RESULTS);
  const hasQuery = normalizeComparisonSearch(query).length > 0;
  const status = comparisonSelectorStatus(query, matches.length, visibleMatches.length);
  const clearHref = slot === "left"
    ? comparisonHref(null, rightId)
    : comparisonHref(leftId, null);

  function optionHref(optionId: string) {
    return slot === "left"
      ? comparisonHref(optionId, rightId)
      : comparisonHref(leftId, optionId);
  }

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="min-w-0 rounded-2xl border border-[var(--ss-border)] bg-[var(--ss-surface-muted)] p-4"
      data-comparison-selector={slot}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          <h3 id={`${inputId}-heading`} className="text-sm font-bold text-[var(--ss-ink)]">
            {label}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
            {selected ? `Current ${label} selection` : "No product selected"}
          </p>
          {selected && (
            <>
              <p className="mt-2 break-words text-sm font-bold leading-5 text-[var(--ss-ink)]">
                {[selected.brand, selected.name].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-zinc-600">
                {selected.exactVariantLabel || selected.exactPackLabel || "Exact variant unavailable"}
              </p>
            </>
          )}
        </div>
        {selected && (
          <Link
            href={clearHref}
            prefetch={false}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-zinc-600 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          >
            Clear {label}
          </Link>
        )}
      </div>

      {selected && !isChanging ? (
        <button
          type="button"
          onClick={() => setIsChanging(true)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--ss-border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ss-ink)] hover:bg-[var(--ss-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
        >
          Change {label}
        </button>
      ) : (
        <div className="mt-4 min-w-0">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--ss-ink)]">
              Search {label}
            </label>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  setIsChanging(false);
                  setQuery("");
                }}
                className="min-h-11 px-2 text-xs font-semibold text-zinc-600 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
              >
                Cancel
              </button>
            )}
          </div>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand, product, flavour or pack"
            autoComplete="off"
            aria-controls={resultsId}
            aria-describedby={statusId}
            className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[var(--ss-border-strong)] bg-white px-3 py-3 text-base text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2 sm:text-sm"
          />

          <div id={resultsId} className="mt-2 min-w-0">
            <p id={statusId} aria-live="polite" className="text-xs leading-5 text-zinc-600">
              {status}
            </p>
            {hasQuery && visibleMatches.length > 0 && (
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-[var(--ss-border)] bg-white p-1">
                {visibleMatches.map((option) => {
                  const optionLabel = comparisonSelectorOptionLabel(option);
                  const isCurrent = option.id === selectedId;
                  return (
                    <li key={option.id}>
                      {isCurrent ? (
                        <div
                          aria-current="true"
                          className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg bg-[var(--ss-surface-muted)] px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 break-words font-semibold text-[var(--ss-ink)]">
                            {optionLabel}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-zinc-500">Current</span>
                        </div>
                      ) : (
                        <Link
                          href={optionHref(option.id)}
                          prefetch={false}
                          aria-label={`Select ${label}: ${optionLabel}`}
                          className="flex min-h-11 min-w-0 items-center rounded-lg px-3 py-2 text-sm font-semibold leading-5 text-[var(--ss-ink)] hover:bg-[var(--ss-surface-muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--ss-accent)]"
                        >
                          <span className="min-w-0 break-words">{optionLabel}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function SearchableComparisonSelectors({
  options,
  leftId,
  rightId,
}: {
  options: ComparisonSelectorOption[];
  leftId: string | null;
  rightId: string | null;
}) {
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <SearchableComparisonSelector
        key={`left-${leftId || "empty"}`}
        slot="left"
        label="Product A"
        options={options}
        leftId={leftId}
        rightId={rightId}
      />
      <SearchableComparisonSelector
        key={`right-${rightId || "empty"}`}
        slot="right"
        label="Product B"
        options={options}
        leftId={leftId}
        rightId={rightId}
      />
    </div>
  );
}
