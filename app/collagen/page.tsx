import type { Metadata } from "next";
import Link from "next/link";
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

const pagePath = "/collagen";
const pageTitle = "Compare Collagen Prices UK";
const description =
  "Compare current UK retailer prices for products with a reviewed Collagen identity, including Collagen Peptides and Marine Collagen.";
const definition = getCategoryCoverageDefinition("collagen");

if (!definition) {
  throw new Error("Collagen category coverage definition is missing.");
}
const collagenDefinition = definition;

async function loadCollagenProducts(page: number) {
  const result = await getLandingProducts(
    [...collagenDefinition.candidateQueries],
    CATEGORY_LANDING_PAGE_SIZE,
    {
      page,
      productFilter: (product) =>
        evaluateCategoryCoverage(collagenDefinition, product).classification ===
        "INCLUDE_STRONG",
    }
  );

  return { ...result, error: Boolean(result.error) };
}

const getCachedCollagenProducts = createLifecycleDataLoader(
  pagePath,
  "collagen-category-v1",
  loadCollagenProducts
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

function lifecycleParamsForPagination(params: RouteSearchParams) {
  const keys = Object.keys(params);
  const hasOnlyCanonicalPage =
    keys.every((key) => key === "page") &&
    isCanonicalCategoryLandingPageParam(params.page);

  return hasOnlyCanonicalPage ? {} : params;
}

export async function generateMetadata({
  searchParams,
}: PageProps = {}): Promise<Metadata> {
  const params: RouteSearchParams = await (
    searchParams || Promise.resolve({})
  );
  const page = normalizeCategoryLandingPage(params.page);

  return {
    ...buildCategoryLandingMetadata({
      basePath: pagePath,
      description,
      page,
      title: pageTitle,
    }),
    robots: getLifecycleRobots(
      pagePath,
      lifecycleParamsForPagination(params)
    ),
  };
}

export default async function CollagenPage({ searchParams }: PageProps = {}) {
  const params: RouteSearchParams = await (
    searchParams || Promise.resolve({})
  );
  const pageParam = params.page;
  const requestedPage = normalizeCategoryLandingPage(pageParam);

  if (!isCanonicalCategoryLandingPageParam(pageParam)) {
    redirect(pagePath);
  }

  const result = await getCachedCollagenProducts(requestedPage);
  assertLifecycleDataAvailable(result, pagePath);

  if (result.page !== requestedPage) {
    redirect(categoryLandingPageHref(pagePath, result.page));
  }

  const rows = result.results;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=Collagen"
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
            Compare Collagen Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">
            SupplementScout uses reviewed product identity rules for this
            category. Collagen Peptides and Marine Collagen are included when
            Collagen is a primary or named co-primary product identity.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            Products that only mention Collagen formation or synthesis are not
            included. Current retailer availability and prices can change;
            this is price comparison, not effectiveness or suitability advice.
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
              Current Collagen products
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            Page {result.page} of {result.totalPages} ({result.totalCount}{" "}
            reviewed product{result.totalCount === 1 ? "" : "s"})
          </p>
        </div>

        {rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              No reviewed Collagen products available
            </h2>
            <p className="mt-2 text-zinc-600">
              No product currently meets the strong category membership rules.
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
