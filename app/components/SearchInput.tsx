"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SearchSuggestion = {
  id: string;
  type: "category" | "brand" | "product";
  label: string;
  href: string;
  matchText: string;
  score: number;
};

type SearchSuggestionsResponse = {
  query: string;
  appliedQuery: string;
  correctedQuery: string | null;
  suggestions: SearchSuggestion[];
};

const suggestionTypeLabels: Record<SearchSuggestion["type"], string> = {
  category: "Category",
  brand: "Brand",
  product: "Product",
};

const groupedSuggestionTypes: SearchSuggestion["type"][] = [
  "category",
  "brand",
  "product",
];

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function SearchInput() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedQuery = normalizeQuery(query);
  const shouldSuggest = normalizedQuery.length >= 2;
  const groupedSuggestions = useMemo(
    () =>
      groupedSuggestionTypes
        .map((type) => ({
          type,
          label: suggestionTypeLabels[type],
          suggestions: suggestions.filter((suggestion) => suggestion.type === type),
        }))
        .filter((group) => group.suggestions.length > 0),
    [suggestions]
  );

  useEffect(() => {
    if (!shouldSuggest) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          setSuggestions([]);
          setCorrectedQuery(null);
          return;
        }

        const data = (await response.json()) as SearchSuggestionsResponse;
        setSuggestions(data.suggestions.slice(0, 10));
        setCorrectedQuery(data.correctedQuery);
        setHighlightedIndex(-1);
        setIsOpen(document.activeElement?.getAttribute("name") === "q");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setCorrectedQuery(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [normalizedQuery, shouldSuggest]);

  function clearBlurTimeout() {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }

  function openHighlightedSuggestion() {
    const suggestion = suggestions[highlightedIndex];

    if (suggestion) {
      window.location.href = suggestion.href;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(suggestions.length > 0);
    }

    if (event.key === "ArrowDown") {
      if (suggestions.length === 0) {
        return;
      }

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (suggestions.length === 0) {
        return;
      }

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1
      );
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      openHighlightedSuggestion();
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  }

  return (
    <form
      id="search"
      action="/search"
      className="relative mx-auto mt-6 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-2.5 shadow-xl sm:mt-10 sm:p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          value={query}
          onBlur={handleBlur}
          onChange={(event) => {
            const nextQuery = event.target.value;

            setQuery(nextQuery);

            if (normalizeQuery(nextQuery).length < 2) {
              setSuggestions([]);
              setCorrectedQuery(null);
              setIsLoading(false);
              setHighlightedIndex(-1);
              setIsOpen(false);
              return;
            }

            setIsOpen(true);
          }}
          onFocus={() => {
            clearBlurTimeout();
            setIsOpen(shouldSuggest && suggestions.length > 0);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label="Search supplements, brands or categories"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-haspopup="listbox"
          aria-controls="search-suggestions"
          className="min-h-14 flex-1 rounded-2xl border border-zinc-200 px-4 text-base outline-none focus:border-zinc-950 sm:min-h-16 sm:px-6"
          placeholder="Search supplements, brands or categories"
        />
        <button
          type="submit"
          className="min-h-14 rounded-2xl bg-zinc-950 px-8 font-semibold text-white sm:min-h-16 sm:px-10"
        >
          Search
        </button>
      </div>

      {isOpen && shouldSuggest && (suggestions.length > 0 || isLoading) && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-2xl"
        >
          {correctedQuery && (
            <p className="border-b border-zinc-100 px-4 py-3 text-sm text-zinc-500 sm:px-5">
              Suggestions for &ldquo;{correctedQuery}&rdquo;
            </p>
          )}

          {isLoading && suggestions.length === 0 && (
            <p className="px-4 py-4 text-sm text-zinc-500 sm:px-5">Searching...</p>
          )}

          {groupedSuggestions.map((group) => (
            <div key={group.type} className="border-b border-zinc-100 last:border-b-0">
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:px-5">
                {group.label}
              </p>
              <div className="py-1.5">
                {group.suggestions.map((suggestion) => {
                  const suggestionIndex = suggestions.findIndex(
                    (item) => item.id === suggestion.id && item.type === suggestion.type
                  );
                  const isHighlighted = suggestionIndex === highlightedIndex;

                  return (
                    <a
                      key={`${suggestion.type}-${suggestion.id}`}
                      href={suggestion.href}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(suggestionIndex)}
                      className={`block min-h-12 px-4 py-3 text-sm font-medium sm:px-5 ${
                        isHighlighted
                          ? "bg-zinc-100 text-zinc-950"
                          : "text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {suggestion.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
