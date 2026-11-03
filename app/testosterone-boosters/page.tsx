import type { Metadata } from "next";
import Link from "next/link";
import ProductResultCard from "../components/ProductResultCard";
import { CATEGORY_LANDING_PAGE_SIZE } from "../lib/categoryLandingPagination";
import {
  evaluateCategoryCoverage,
  getCategoryCoverageDefinition,
} from "../lib/categoryCoverage";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import { getLandingProducts } from "../lib/products";

const pagePath = "/testosterone-boosters";
const definition = getCategoryCoverageDefinition("testosterone-boosters");

if (!definition) {
  throw new Error("Testosterone Boosters category coverage definition is missing.");
}
const testosteroneBoosterDefinition = definition;

const description =
  "Compare current UK retailer prices for products with a reviewed Testosterone Booster identity.";

async function loadTestosteroneBoosterProducts() {
  const result = await getLandingProducts(
    [...testosteroneBoosterDefinition.candidateQueries],
    CATEGORY_LANDING_PAGE_SIZE,
    {
      productFilter: (product) =>
        evaluateCategoryCoverage(testosteroneBoosterDefinition, product)
          .classification ===
        "INCLUDE_STRONG",
    }
  );

  return { ...result, error: Boolean(result.error) };
}

const getCachedTestosteroneBoosterProducts = createLifecycleDataLoader(
  pagePath,
  "testosterone-boosters-category-v1",
  loadTestosteroneBoosterProducts
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({
  searchParams,
}: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));

  return {
    title: "Compare Testosterone Booster Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Testosterone Booster Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
  };
}

export default async function TestosteroneBoostersPage() {
  const result = await getCachedTestosteroneBoosterProducts();
  assertLifecycleDataAvailable(result, pagePath);
  const rows = result.results;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=Testosterone%20Boosters"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search all products
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Reviewed category coverage
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Testosterone Booster Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">
            SupplementScout uses reviewed product identity rules for this
            category. Ingredient-only products are not automatically treated as
            Testosterone Boosters.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Current retailer availability and prices can change. Check the exact
            label, directions and retailer information before buying; this is a
            price comparison, not an effectiveness or suitability ranking.
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
              Current Testosterone Booster products
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {rows.length} reviewed product{rows.length === 1 ? "" : "s"}
          </p>
        </div>

        {rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              No reviewed Testosterone Booster products available
            </h2>
            <p className="mt-2 text-zinc-600">
              No product currently meets the strong category membership rules.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {rows.map((product) => (
              <ProductResultCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
