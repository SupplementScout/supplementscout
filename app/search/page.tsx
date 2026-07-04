import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ActiveSearchFilters from "../components/ActiveSearchFilters";
import ProductResultCard from "../components/ProductResultCard";
import SearchFilters from "../components/SearchFilters";
import SearchPagination from "../components/SearchPagination";
import SearchSort from "../components/SearchSort";
import {
  normalizeSearchQuery,
  normalizeSearchFilters,
  normalizeSearchPage,
  normalizeSearchSort,
  searchProducts,
} from "../lib/products";
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
        error: null,
      };
  const hasActiveFilters =
    filters.category.length > 0 ||
    filters.brand.length > 0 ||
    filters.retailer.length > 0;

  if (hasQuery && !error && totalCount > 0 && requestedPage > totalPages) {
    redirect(searchUrl({ query, sort, filters, page: totalPages }));
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-600">
            New search
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <form action="/search" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search supplements, brands or categories"
              className="min-h-12 flex-1 rounded-lg border border-zinc-300 px-4 text-base outline-none focus:border-zinc-950"
            />
            <input type="hidden" name="sort" value={sort} />
            {filters.category && (
              <input type="hidden" name="category" value={filters.category} />
            )}
            {filters.brand && (
              <input type="hidden" name="brand" value={filters.brand} />
            )}
            {filters.retailer && (
              <input type="hidden" name="retailer" value={filters.retailer} />
            )}
            <button
              type="submit"
              className="min-h-12 rounded-lg bg-zinc-950 px-6 text-sm font-semibold text-white"
            >
              Search
            </button>
          </div>
        </form>

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
            <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Search results
                </p>
                <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                  {query}
                </h1>
                {!error && (
                  <p className="mt-2 text-sm text-zinc-600">
                    {totalCount} product{totalCount === 1 ? "" : "s"} found
                  </p>
                )}
                {!error && totalCount > 0 && (
                  <p className="mt-1 text-sm text-zinc-500">
                    Showing {startResult}-{endResult} of {totalCount}
                  </p>
                )}
                {!error && hasActiveFilters && (
                  <p className="mt-1 text-sm text-zinc-500">
                    Filtered from {unfilteredCount} product
                    {unfilteredCount === 1 ? "" : "s"} with an in-stock
                    delivered offer
                  </p>
                )}
                {!error && unfilteredCount >= resultLimit && resultLimit > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Search is currently limited to the first {resultLimit} matched
                    products for this MVP.
                  </p>
                )}
              </div>

              <SearchSort query={query} sort={sort} filters={filters} />
            </div>

            <ActiveSearchFilters
              query={query}
              sort={sort}
              filters={filters}
              facets={facets}
            />

            {error && (
              <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
                <p className="font-semibold">Search failed.</p>
                <p className="mt-1 text-sm">
                  Please try again or use a shorter search phrase.
                </p>
              </div>
            )}

            {!error && totalCount === 0 && (
              <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-8 text-center">
                <h2 className="text-2xl font-bold">
                  {hasActiveFilters ? "No filtered results found" : "No results found"}
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
                  {hasActiveFilters
                    ? "No products match this combination of filters. Remove a filter or clear all filters to broaden the search."
                    : "No active products with in-stock offers matched this search. Try a broader product name, brand or category."}
                </p>
              </div>
            )}

            {!error && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
                <SearchFilters
                  query={query}
                  sort={sort}
                  filters={filters}
                  facets={facets}
                />

                {results.length > 0 && (
                  <div>
                    <div className="space-y-4">
                      {results.map((product) => (
                        <ProductResultCard key={product.id} product={product} />
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
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
