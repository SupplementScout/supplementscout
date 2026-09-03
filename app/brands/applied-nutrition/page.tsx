import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
  UnavailableComparisonProductCard,
} from "../../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../../components/ComparisonTransparencyLinks";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import {
  getAppliedNutritionBrand,
  type AppliedNutritionBrandResult,
  type AppliedNutritionBrandRow,
} from "../../lib/appliedNutritionBrand";
import { formatCurrency } from "../../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/brands/applied-nutrition";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Applied Nutrition product prices from UK supplement retailers, including known delivery, retailer coverage and recently checked offers.";
const getCachedAppliedNutritionBrand = createLifecycleDataLoader(
  pagePath,
  "applied-nutrition-brand-v1",
  getAppliedNutritionBrand
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export function isAppliedNutritionStructuredDataValid(
  rows: AppliedNutritionBrandRow[]
) {
  return (
    rows.length > 0 &&
    new Set(rows.map((row) => row.id)).size === rows.length &&
    rows.every(
      (row) =>
        row.brand === "Applied Nutrition" &&
        row.name.trim().length > 0 &&
        /^\/product\/[a-z0-9-]+$/i.test(row.productUrl)
    )
  );
}

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));

  return {
    title: "Applied Nutrition Products & Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Applied Nutrition Products & Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Applied Nutrition Products & Prices UK | SupplementScout",
      description,
    },
  };
}

function formatCheckedAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function buildAppliedNutritionStructuredData(
  rows: AppliedNutritionBrandRow[]
) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Applied Nutrition Products & Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Applied Nutrition products with recently checked UK retailer offers",
        numberOfItems: rows.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: rows.map((row, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: row.name,
          url: `${siteUrl}${row.productUrl}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Applied Nutrition",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function ProductCard({
  row,
  position,
}: {
  row: AppliedNutritionBrandRow;
  position: number;
}) {
  if (!row.bestOffer) {
    return <UnavailableComparisonProductCard row={row} position={position} />;
  }
  const retailerNames = [
    ...new Set(row.offers.map((offer) => offer.retailer.name)),
  ];
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 lg:grid-cols-[128px_minmax(0,1fr)_20rem] lg:items-center lg:gap-5">
        <ComparisonProductThumbnail
          image={row.image}
          name={row.name}
          productUrl={row.productUrl}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {position}. {row.category || "Other"}
          </p>
          <Link href={row.productUrl} className="block">
            <h3 className="mt-2 break-words text-xl font-bold text-zinc-950 hover:underline">
              {row.name}
            </h3>
          </Link>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.offerCount} recently checked in-stock offer
            {row.offerCount === 1 ? "" : "s"} from {retailerNames.join(", ")}.
          </p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>

        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {row.retailerCount >= 2
              ? "Lowest current delivered price"
              : "Current available price"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-zinc-950">
            {formatCurrency(displayedPrice)}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {row.bestOffer.deliveredPrice
              ? "Includes known delivery"
              : "Product price; delivery not known"}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-700">
            {row.retailerCount} retailer{row.retailerCount === 1 ? "" : "s"} in
            current coverage
          </p>
          <Link
            href={row.productUrl}
            className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Compare this product
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AppliedNutritionPageContent({
  result,
}: {
  result: AppliedNutritionBrandResult;
}) {
  const structuredDataValid = isAppliedNutritionStructuredDataValid(
    result.rows
  );
  const jsonLd = structuredDataValid
    ? buildAppliedNutritionStructuredData(result.rows)
    : null;
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics
        category="Applied Nutrition"
        sourcePage="applied_nutrition_brand"
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?brand=Applied%20Nutrition"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search this brand
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Applied Nutrition</li>
          </ol>
        </nav>

        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            UK retailer coverage by brand
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Applied Nutrition Products &amp; Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Compare recently checked Applied Nutrition offers from UK supplement
            retailers. Products with broader retailer coverage appear first,
            and known delivery is included when the retailer evidence supports it.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} products, {" "}
              {result.summary.freshOffers} recently checked offers from {" "}
              {result.summary.freshRetailers} retailers. {" "}
              {result.summary.productsWithMultipleFreshRetailers} products have
              current offers from multiple retailers.
            </p>
          )}
        </div>
      </section>

      {!result.error && result.categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-bold">What products can you compare?</h2>
            <p className="mt-3 max-w-4xl leading-7 text-zinc-700">
              SupplementScout currently has fresh Applied Nutrition offers
              across {result.categories.length} catalogue categories. These are
              catalogue groupings, not a ranking of product quality or suitability.
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.categories.map((category) => (
                <div key={category.name} className="rounded-xl bg-zinc-50 p-4">
                  <dt className="font-bold">{category.name}</dt>
                  <dd className="mt-1 text-sm leading-6 text-zinc-600">
                    {category.products} current product
                    {category.products === 1 ? "" : "s"}; {" "}
                    {category.multiRetailerProducts} with multiple retailers
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Current comparison
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Applied Nutrition prices and retailer coverage
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck
              ? `Latest retailer check: ${latestCheck}`
              : "No current check time available"}
          </p>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Coverage is ranked before offer count and product completeness. Products
          are not ordered by claimed effectiveness, popularity or an unsupported
          quality score.
        </p>

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Current brand data is unavailable</h2>
            <p className="mt-2 text-zinc-700">
              No old prices have been substituted. Use catalogue search while
              current retailer data is restored.
            </p>
            <Link
              href="/search?brand=Applied%20Nutrition"
              className="mt-4 inline-flex font-semibold underline"
            >
              Search Applied Nutrition products
            </Link>
          </div>
        )}

        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No recently checked offers</h2>
            <p className="mt-2 text-zinc-600">
              Older prices remain hidden until retailer data is checked again.
            </p>
          </div>
        )}

        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => (
              <ProductCard key={row.id} row={row} position={index + 1} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How this page compares prices</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Only active, unmerged products whose canonical brand is exactly
              Applied Nutrition are included. Offers must be mapped, in stock,
              positive-priced and checked within 24 hours. Unknown delivery is
              never treated as free.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Brand and catalogue limits</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              SupplementScout is an independent comparison service, not the
              official Applied Nutrition store. Its official catalogue groups
              products across protein, pre-workout, creatine, hydration and
              health and wellbeing; this page shows only products currently
              represented in our verified retailer coverage.
            </p>
            <a
              href="https://appliednutrition.uk/products"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-semibold underline"
            >
              View the official Applied Nutrition catalogue
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">Applied Nutrition price questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-bold">Does the first product mean the best?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. Broader current retailer coverage is listed first. We do not
              infer effectiveness or suitability from price, stock or popularity.
            </p>
          </div>
          <div>
            <h3 className="font-bold">Are all Applied Nutrition products shown?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. Products without a current qualifying retailer offer remain
              outside this comparison until fresh evidence is available.
            </p>
          </div>
          <div>
            <h3 className="font-bold">How often are offers checked?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              Only checks from the last 24 hours qualify. Prices and stock can
              change afterwards, so confirm the final amount with the retailer.
            </p>
          </div>
          <div>
            <h3 className="font-bold">Why can delivery be missing?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              Delivery is shown only when it is known for that offer. We do not
              estimate a missing charge or rank it ahead of a known delivered total.
            </p>
          </div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">Related comparisons and information</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/whey-protein" className="font-semibold underline">
              Whey Protein comparison
            </Link>
            <Link href="/pre-workout" className="font-semibold underline">
              Pre Workout comparison
            </Link>
            <Link href="/creatine" className="font-semibold underline">
              Creatine comparison
            </Link>
            <Link
              href="/search?brand=Applied%20Nutrition"
              className="font-semibold underline"
            >
              Search this brand
            </Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          This page remains indexable only while its exact brand identity,
          current multi-retailer depth, fresh offer count, category breadth and
          structured data all pass the published fail-closed gate.
        </p>
      </section>
    </main>
  );
}

export default async function AppliedNutritionBrandPage() {
  const result = await getCachedAppliedNutritionBrand();
  assertLifecycleDataAvailable(result, pagePath);
  return <AppliedNutritionPageContent result={result} />;
}
