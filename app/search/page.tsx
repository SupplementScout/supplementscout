import Link from "next/link";
import ProductResultCard from "../components/ProductResultCard";
import SearchSort from "../components/SearchSort";
import {
  normalizeSearchQuery,
  normalizeSearchSort,
  searchProducts,
} from "../lib/products";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    sort?: string | string[];
  }>;
};

export const metadata = {
  title: "Search Supplement Prices | SupplementScout",
  description:
    "Search UK supplement prices and compare the cheapest available delivered offers.",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const sort = normalizeSearchSort(params.sort);
  const hasQuery = query.length > 0;
  const { results, error } = hasQuery
    ? await searchProducts(query, sort)
    : { results: [], error: null };

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
                    {results.length} product{results.length === 1 ? "" : "s"}{" "}
                    with an in-stock delivered offer
                  </p>
                )}
              </div>

              <SearchSort query={query} sort={sort} />
            </div>

            {error && (
              <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
                <p className="font-semibold">Search failed.</p>
                <p className="mt-1 text-sm">
                  Please try again or use a shorter search phrase.
                </p>
              </div>
            )}

            {!error && results.length === 0 && (
              <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-8 text-center">
                <h2 className="text-2xl font-bold">No results found</h2>
                <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
                  No active products with in-stock offers matched this search.
                  Try a broader product name, brand or category.
                </p>
              </div>
            )}

            {!error && results.length > 0 && (
              <div className="mt-8 space-y-4">
                {results.map((product) => (
                  <ProductResultCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
