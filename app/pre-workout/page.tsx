import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
  UnavailableComparisonProductCard,
} from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import {
  getPreWorkoutComparison,
  type PreWorkoutComparisonResult,
  type PreWorkoutComparisonRow,
} from "../lib/preWorkoutComparison";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/pre-workout";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Pre Workout prices from UK supplement retailers, with recently checked offers, known delivery costs, retailer coverage and verified value metrics.";
const getCachedPreWorkoutComparison = createLifecycleDataLoader(
  pagePath,
  "pre-workout-comparison-v1",
  getPreWorkoutComparison
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));

  return {
    title: "Compare Pre Workout Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Pre Workout Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Pre Workout Prices UK | SupplementScout",
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

function productFacts(row: PreWorkoutComparisonRow) {
  return [
    row.netWeightG
      ? `${row.netWeightG.toLocaleString("en-GB")} g`
      : null,
    row.unitCount && row.unitType
      ? `${row.unitCount.toLocaleString("en-GB")} ${row.unitType}`
      : null,
    row.verifiedServingCount
      ? `${row.verifiedServingCount.toLocaleString("en-GB")} verified servings`
      : null,
  ].filter((value): value is string => Boolean(value));
}

export function buildPreWorkoutStructuredData(
  rows: PreWorkoutComparisonRow[]
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
        name: "Compare Pre Workout Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Pre Workout products with recently checked UK retailer offers",
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
            name: "Pre Workout",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function PreWorkoutProductCard({
  row,
  position,
}: {
  row: PreWorkoutComparisonRow;
  position: number;
}) {
  if (!row.bestOffer) {
    return <UnavailableComparisonProductCard row={row} position={position} />;
  }
  const facts = productFacts(row);
  const retailerNames = [
    ...new Set(row.offers.map((offer) => offer.retailer.name)),
  ];
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;
  const hasComparison = row.retailerCount >= 2;

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
            {position}. {row.brand || "Brand not stated"}
          </p>
          <Link href={row.productUrl} className="block">
            <h3 className="mt-2 break-words text-xl font-bold text-zinc-950 hover:underline">
              {row.name}
            </h3>
          </Link>
          {facts.length > 0 && (
            <p className="mt-2 text-sm text-zinc-600">
              {facts.join(" · ")}
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.offerCount} recently checked in-stock offer
            {row.offerCount === 1 ? "" : "s"} from {retailerNames.join(", ")}.
          </p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>

        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {hasComparison
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
            Available at {row.bestOffer.retailer.name}
          </p>

          {(row.pricePerKg !== null || row.pricePerServing !== null) && (
            <dl className="mt-4 grid gap-2 border-t border-zinc-200 pt-3 text-sm">
              {row.pricePerKg !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Delivered price / kg</dt>
                  <dd className="font-semibold">
                    {formatCurrency(row.pricePerKg)}
                  </dd>
                </div>
              )}
              {row.pricePerServing !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Delivered price / serving</dt>
                  <dd className="font-semibold">
                    {formatUnitPrice(row.pricePerServing)}
                  </dd>
                </div>
              )}
            </dl>
          )}

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

export function PreWorkoutPageContent({
  result,
}: {
  result: PreWorkoutComparisonResult;
}) {
  const jsonLd = buildPreWorkoutStructuredData(result.rows);
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics
        category="Pre Workout"
        sourcePage="pre_workout_comparison"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=pre%20workout"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search Pre Workout
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
            <li aria-current="page">Pre Workout</li>
          </ol>
        </nav>

        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            UK retailer price comparison
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Pre Workout Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Compare recently checked Pre Workout offers from UK supplement
            retailers. We show the lowest known delivered total for each
            product when delivery is available, without estimating missing
            prices, servings or formulation details.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} Pre Workout
              product{result.summary.visibleProducts === 1 ? "" : "s"},{" "}
              {result.summary.freshOffers} recently checked offer
              {result.summary.freshOffers === 1 ? "" : "s"} from{" "}
              {result.summary.freshRetailers} retailer
              {result.summary.freshRetailers === 1 ? "" : "s"}.{" "}
              {result.summary.productsWithMultipleFreshRetailers} product
              {result.summary.productsWithMultipleFreshRetailers === 1
                ? " has"
                : "s have"}{" "}
              current offers from multiple retailers.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Current comparison
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Pre Workout prices and retailer coverage
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck
              ? `Latest retailer check: ${latestCheck}`
              : "No current check time available"}
          </p>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Products with broader retailer coverage appear first. Within each
          product, recently checked offers are ordered by known delivered
          total. This is a coverage-first comparison, not a claim that the
          first product has a better formulation or effect.
        </p>

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">
              Current Pre Workout data is temporarily unavailable
            </h2>
            <p className="mt-2 text-zinc-700">
              No old prices have been substituted. Try the broader search
              while current retailer data is restored.
            </p>
            <Link
              href="/search?q=pre%20workout"
              className="mt-4 inline-flex font-semibold underline"
            >
              Search Pre Workout
            </Link>
          </div>
        )}

        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              No recently checked Pre Workout offers
            </h2>
            <p className="mt-2 text-zinc-600">
              Older prices remain hidden until retailer data is checked again.
            </p>
          </div>
        )}

        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => (
              <PreWorkoutProductCard
                key={row.id}
                row={row}
                position={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How prices are compared</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              We use active, mapped, in-stock retailer offers checked within
              24 hours. Where both the product price and delivery charge are
              known, the delivered total decides the lowest current offer for
              that product. An offer with unknown delivery cannot outrank one
              with a complete delivered total.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {result.summary.staleOrUnusableOffersExcluded} older or unusable
              in-stock offer
              {result.summary.staleOrUnusableOffersExcluded === 1
                ? " is"
                : "s are"}{" "}
              currently excluded. Prices and stock can change after the shown
              check time, so confirm the final amount at the retailer.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              When value metrics are shown
            </h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Price per kilogram and price per serving appear only when the
              required package or serving fields have been reviewed and marked
              as verified. Missing information is left blank rather than
              estimated from a product name or retailer description.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">Pre Workout comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-bold">What is included?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              The page covers active products in the reviewed Pre Workout
              category with a recently checked offer. Multi-product bundles
              are excluded so a bundle price is not compared with a single
              canonical product.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Does this page identify stimulant-free products?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. Product names can mention pump, stim or caffeine, but this
              page does not infer stimulant status or ingredient suitability
              from names. Check the current label and retailer details for the
              formulation that matters to you.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Does the first product mean the best Pre Workout?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. The order favours products with more current retailer
              coverage. SupplementScout does not rank effectiveness,
              formulation quality or suitability without verified evidence.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Why is a value calculation sometimes missing?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              A current price can be valid even when package or serving data is
              incomplete. We still show the retailer comparison but hide any
              per-kilogram or per-serving calculation that cannot be verified.
            </p>
          </div>
          <div>
            <h3 className="font-bold">How often are prices checked?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              Only offers checked within the last 24 hours are eligible for
              this page. Each product shows its latest check time, and stale
              prices are removed from the current ranking.
            </p>
          </div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">
            Related comparisons and information
          </h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/creatine" className="font-semibold underline">
              Creatine comparison
            </Link>
            <Link href="/hydration" className="font-semibold underline">
              Hydration comparison
            </Link>
            <Link href="/whey-protein" className="font-semibold underline">
              Whey Protein comparison
            </Link>
            <Link href="/amino-acids" className="font-semibold underline">
              Amino Acids, BCAA and EAA comparison
            </Link>
            <Link
              href="/search?q=pre%20workout"
              className="font-semibold underline"
            >
              Search all Pre Workout products
            </Link>
            <Link href="/about" className="font-semibold underline">
              How SupplementScout works
            </Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          We only feature this comparison in search when it includes enough
          recently checked offers from multiple UK retailers. If coverage is
          temporarily limited, you can still use the page, but we will not
          present it as a complete market comparison.
        </p>
      </section>
    </main>
  );
}

export default async function PreWorkoutPage() {
  const result = await getCachedPreWorkoutComparison();
  assertLifecycleDataAvailable(result, pagePath);
  return <PreWorkoutPageContent result={result} />;
}
