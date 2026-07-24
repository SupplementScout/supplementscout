import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ActiveSearchFilters from "../components/ActiveSearchFilters";
import ProductResultCard from "../components/ProductResultCard";
import SearchInput from "../components/SearchInput";
import SearchPagination from "../components/SearchPagination";
import SearchAnalyticsEvents from "../components/SearchAnalyticsEvents";
import SearchResultsLayout from "../components/SearchResultsLayout";
import {
  normalizeSearchQuery,
  normalizeSearchFilters,
  normalizeSearchPage,
  normalizeSearchSort,
  searchProducts,
} from "../lib/products";
import { logSearchResultsEvent } from "../lib/searchAnalytics";
import { searchUrl } from "../lib/searchUrl";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
    category?: string | string[];
    brand?: string | string[];
    retailer?: string | string[];
    page?: string | string[];
  }>;
};

const popularSearchSuggestions = [
  { label: "Creatine", query: "creatine" },
  { label: "Whey protein", query: "whey protein" },
  { label: "Vitamin D", query: "vitamin d" },
];

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const title = query
    ? `Search results for \u201c${query}\u201d`
    : "Search Supplements";
  const description =
    "Search UK supplement prices and compare the cheapest available delivered offers.";

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: "/search",
    },
    openGraph: {
      title: `${title} | SupplementScout`,
      description,
      url: query ? `/search?q=${encodeURIComponent(query)}` : "/search",
    },
    twitter: {
      card: "summary",
      title: `${title} | SupplementScout`,
      description,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const sort = normalizeSearchSort(params.sort);
  const filters = normalizeSearchFilters(params);
  const requestedPage = normalizeSearchPage(params.page);
  const hasQuery = query.length > 0;
  const {
    results,
    facets,
    totalCount,
    unfilteredCount,
    page,
    totalPages,
    startResult,
    endResult,
    resultLimit,
    metadata,
    error,
  } = hasQuery
    ? await searchProducts(query, sort, filters, requestedPage)
    : {
        results: [],
        facets: { categories: [], brands: [], retailers: [] },
        totalCount: 0,
        unfilteredCount: 0,
        page: 1,
        totalPages: 1,
        startResult: 0,
        endResult: 0,
        resultLimit: 0,
        metadata: {
          originalQuery: "",
          appliedQuery: "",
          correctedQuery: null,
          queryVariants: [],
          matchStatus: "none" as const,
          searchMode: "standard_ilike" as const,
        },
        error: null,
      };
  const hasActiveFilters =
    filters.category.length > 0 ||
    filters.brand.length > 0 ||
    filters.retailer.length > 0;

  if (hasQuery && !error && totalCount > 0 && requestedPage > totalPages) {
    redirect(searchUrl({ query, sort, filters, page: totalPages }));
  }

  if (hasQuery && !error) {
    await logSearchResultsEvent({
      query,
      metadata,
      resultCount: unfilteredCount,
      requestParams: params,
    });
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link href="/" className="hidden text-sm font-medium text-zinc-600 sm:inline">
            New search
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <SearchInput key={query} initialQuery={query} variant="compact" />

        {!hasQuery && (
          <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-8 text-center">
            <h1 className="text-3xl font-bold">Search supplement deals</h1>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
              Enter a product, brand or category to compare in-stock UK retailer
              offers by total delivered price.
            </p>
          </div>
        )}

        {hasQuery && (
          <>
            {!error && <SearchAnalyticsEvents resultCount={totalCount} hasFilters={hasActiveFilters} />}
            {error && (
              <>
                <div className="mt-6 md:mt-8">
                  <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Search results
                  </p>
                  <h1 className="mt-1.5 break-words text-2xl font-bold text-zinc-950 sm:text-3xl md:text-4xl">
                    {query}
                  </h1>
                </div>
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700 md:mt-8">
                  <p className="font-semibold">Search failed.</p>
                  <p className="mt-1 text-sm">
                    Please try again or use a shorter search phrase.
                  </p>
                </div>
              </>
            )}

            {!error && (
              <SearchResultsLayout
                query={query}
                sort={sort}
                filters={filters}
                facets={facets}
                totalCount={totalCount}
                heading={
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                      Search results
                    </p>
                    <h1 className="mt-1.5 break-words text-2xl font-bold text-zinc-950 sm:text-3xl md:text-4xl">
                      {query}
                    </h1>
                    <p className="mt-2 hidden text-sm text-zinc-600 lg:block">
                      {totalCount} product{totalCount === 1 ? "" : "s"} found
                    </p>
                    {totalCount > 0 && (
                      <p className="mt-1 hidden text-sm text-zinc-500 lg:block">
                        Showing {startResult}-{endResult} of {totalCount}
                      </p>
                    )}
                    {totalCount > 0 && metadata.correctedQuery && (
                      <p className="mt-1 text-sm font-medium text-zinc-700">
                        Showing results for &ldquo;{metadata.appliedQuery}&rdquo;
                      </p>
                    )}
                    {hasActiveFilters && (
                      <p className="mt-1 hidden text-sm text-zinc-500 lg:block">
                        Filtered from {unfilteredCount} product
                        {unfilteredCount === 1 ? "" : "s"} with an in-stock
                        delivered offer
                      </p>
                    )}
                    {unfilteredCount >= resultLimit && resultLimit > 0 && (
                      <p className="mt-1 hidden text-xs text-zinc-400 lg:block">
                        Search is currently limited to the first {resultLimit} matched
                        products for this MVP.
                      </p>
                    )}
                  </div>
                }
                activeFilters={
                  <ActiveSearchFilters
                    query={query}
                    sort={sort}
                    filters={filters}
                    facets={facets}
                  />
                }
              >
                {totalCount === 0 ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center sm:p-8">
                    <h2 className="text-2xl font-bold">
                      {hasActiveFilters ? "No filtered results found" : "No results found"}
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
                      {hasActiveFilters
                        ? "No products match this combination of filters. Clear the filters to broaden the search."
                        : `No products found for “${query}”. Try another ingredient, brand or category.`}
                    </p>

                    {metadata.correctedQuery && (
                      <p className="mt-4 text-sm text-zinc-600">
                        We also checked &ldquo;{metadata.correctedQuery}&rdquo;.
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {popularSearchSuggestions.map((suggestion) => (
                        <Link
                          key={suggestion.query}
                          href={searchUrl({
                            query: suggestion.query,
                            sort: "relevance",
                            filters: { category: "", brand: "", retailer: "" },
                          })}
                          className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
                        >
                          {suggestion.label}
                        </Link>
                      ))}
                    </div>

                    {hasActiveFilters && (
                      <Link
                        href={searchUrl({
                          query,
                          sort,
                          filters: { category: "", brand: "", retailer: "" },
                        })}
                        className="mt-5 inline-flex min-h-11 items-center font-semibold text-zinc-800 underline underline-offset-4"
                      >
                        Clear filters
                      </Link>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="space-y-3 sm:space-y-4">
                      {results.map((product) => (
                        <ProductResultCard
                          key={product.id}
                          product={product}
                          searchMobileFirst
                        />
                      ))}
                    </div>

                    <SearchPagination
                      query={query}
                      sort={sort}
                      filters={filters}
                      currentPage={page}
                      totalPages={totalPages}
                    />
                  </div>
                )}
              </SearchResultsLayout>
            )}
          </>
        )}
      </section>
    </main>
  );
}
