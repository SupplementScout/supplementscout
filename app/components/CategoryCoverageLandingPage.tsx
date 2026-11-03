import Link from "next/link";
import type {
  CategoryCoverageLandingPresentationConfig,
  CategoryCoverageLandingResult,
} from "../lib/categoryCoverageLanding";
import CategoryLandingPagination from "./CategoryLandingPagination";
import ProductResultCard from "./ProductResultCard";

export default function CategoryCoverageLandingPage({
  pagePath,
  presentation,
  result,
}: {
  pagePath: string;
  presentation: CategoryCoverageLandingPresentationConfig;
  result: CategoryCoverageLandingResult;
}) {
  const rows = result.results;
  const reviewedProductLabel = `reviewed product${
    result.totalCount === 1 ? "" : "s"
  }`;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(presentation.searchQuery)}`}
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search all products
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {presentation.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {presentation.pageTitle}
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">
            {presentation.intro}
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            {presentation.secondaryCopy}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Strong category members
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {presentation.sectionTitle}
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {result.totalPages > 1
              ? `Page ${result.page} of ${result.totalPages} (${result.totalCount} ${reviewedProductLabel})`
              : `${result.totalCount} ${reviewedProductLabel}`}
          </p>
        </div>

        {rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">{presentation.emptyTitle}</h2>
            <p className="mt-2 text-zinc-600">
              {presentation.emptyDescription}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="mt-6 space-y-4">
              {rows.map((product) => (
                <ProductResultCard key={product.id} product={product} />
              ))}
            </div>
            <CategoryLandingPagination
              basePath={pagePath}
              currentPage={result.page}
              totalPages={result.totalPages}
            />
          </>
        )}
      </section>
    </main>
  );
}
