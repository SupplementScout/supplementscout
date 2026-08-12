import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CategoryLandingPagination from "../components/CategoryLandingPagination";
import ProductResultCard from "../components/ProductResultCard";
import {
  CATEGORY_LANDING_PAGE_SIZE,
  buildCategoryLandingMetadata,
  categoryLandingPageHref,
  isCanonicalCategoryLandingPageParam,
  normalizeCategoryLandingPage,
} from "../lib/categoryLandingPagination";
import { formatCurrency } from "../lib/pricing";
import {
  getLandingProducts,
  isReviewedLandingProductMatch,
} from "../lib/products";

export const revalidate = 3600;

const basePath = "/vitamin-d";
const pageTitle = "Compare Vitamin D Supplements UK";
const pageDescription =
  "Compare Vitamin D supplement prices from UK retailers. See product price, delivery cost and total delivered price with SupplementScout.";

type VitaminDPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({
  searchParams,
}: VitaminDPageProps): Promise<Metadata> {
  const page = normalizeCategoryLandingPage((await searchParams).page);
  return buildCategoryLandingMetadata({
    basePath,
    description: pageDescription,
    page,
    title: pageTitle,
  });
}

export default async function VitaminDPage({
  searchParams,
}: VitaminDPageProps) {
  const pageParam = (await searchParams).page;
  const requestedPage = normalizeCategoryLandingPage(pageParam);

  if (!isCanonicalCategoryLandingPageParam(pageParam)) {
    redirect(basePath);
  }

  const { results, error, page, totalCount, totalPages } = await getLandingProducts(
    ["vitamin d", "vitamin d3", "vitamin d2"],
    CATEGORY_LANDING_PAGE_SIZE,
    {
      page: requestedPage,
      productFilter: (product) =>
        isReviewedLandingProductMatch("vitamin-d", product),
    }
  );

  if (page !== requestedPage) {
    redirect(categoryLandingPageHref(basePath, page));
  }

  const lowestDeliveredPrice =
    page === 1
      ? results[0]?.cheapestOffer?.deliveredPrice.totalPrice ?? null
      : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=vitamin%20d"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search Vitamin D
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Vitamin D supplements
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Vitamin D Supplements UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Find Vitamin D tablets, capsules, gummies and formulas from UK
            supplement retailers. Compare product prices, delivery costs and
            total delivered prices in one place.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Vitamin D supplements are commonly sold as tablets, capsules,
            sprays, gummies, drops and combination formulas. Check product
            labels for the form, strength and ingredients before buying.
          </p>
        </div>
      </section>

      {lowestDeliveredPrice !== null && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12">
          <div className="max-w-3xl rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-bold">
              How much does vitamin D cost in the UK?
            </h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout currently compares {totalCount} Vitamin D products
              with in-stock offers. The lowest current delivered price in the
              comparison below is {formatCurrency(lowestDeliveredPrice)}.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Vitamin D prices vary by pack size, strength, number of servings
              and delivery cost. Compare the current offers below; where the
              serving count is verified, the product card also shows the
              delivered cost per serving.
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Product results
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Vitamin D supplement deals
            </h2>
          </div>
          <Link
            href="/search?q=vitamin%20d"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
          >
            View all search results
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Products could not be loaded.</p>
            <p className="mt-1 text-sm">
              Please try the Vitamin D search page instead.
            </p>
          </div>
        )}

        {!error && results.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center sm:p-8">
            <h2 className="text-2xl font-bold">No Vitamin D deals found</h2>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
              No active Vitamin D products with in-stock delivered offers are
              available right now. Try the main search for broader results.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="mt-5 text-sm text-zinc-600 sm:mt-6">
              Showing page {page} of {totalPages} ({totalCount} products)
            </p>
            <div className="mt-3 space-y-3 sm:space-y-4">
              {results.map((product) => (
                <ProductResultCard key={product.id} product={product} />
              ))}
            </div>
            <CategoryLandingPagination
              basePath={basePath}
              currentPage={page}
              totalPages={totalPages}
            />
          </>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How we compare prices</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout compares in-stock offers from UK retailers.
              Product price is the shelf price of the supplement. Delivery cost
              is the retailer delivery charge where known. Total delivered price
              combines the product price and delivery cost so you can compare
              offers more clearly.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Retailer availability can change, so check the retailer page
              before buying. Some retailer links may be affiliate links. This
              does not change the price you pay.{" "}
              <Link
                href="/affiliate-disclosure"
                className="font-semibold text-zinc-950 underline"
              >
                Read our affiliate disclosure
              </Link>
              .
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-2xl font-bold">Important note</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout is not medical advice. Always check product labels
              and consult a qualified professional if you are pregnant, taking
              medication, have a health condition or are unsure whether a
              supplement is suitable for you.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
