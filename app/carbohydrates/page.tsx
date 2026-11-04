import type { Metadata } from "next";
import Link from "next/link";
import CategoryComparisonControls from "../components/CategoryComparisonControls";
import CategoryDecisionPanel from "../components/CategoryDecisionPanel";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
  UnavailableComparisonProductCard,
} from "../components/ComparisonProductVisuals";
import {
  getCarbohydratesComparison,
  type CarbohydratesComparisonResult,
  type CarbohydratesComparisonRow,
} from "../lib/carbohydratesComparison";
import {
  buildCategoryControlView,
  sharedCategoryControlFacts,
  type CategoryControlView,
} from "../lib/categoryControls";
import {
  categoryDecisionCandidates,
  selectCategoryDecisionAnswers,
} from "../lib/categoryDecision";
import { categoryCoverageRawSearchHref } from "../lib/categorySearchIntent";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/carbohydrates";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current UK retailer prices for clearly identified carbohydrate supplements, including Cream of Rice, carbohydrate powders and dextrin products.";
const rawCarbohydratesSearchHref =
  categoryCoverageRawSearchHref("Carbohydrates");
const getCachedCarbohydratesComparison = createLifecycleDataLoader(
  pagePath,
  "carbohydrates-comparison-v1",
  getCarbohydratesComparison
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({
  searchParams,
}: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));

  return {
    title: "Compare Carbohydrate Supplement Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Carbohydrate Supplement Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Carbohydrate Supplement Prices UK | SupplementScout",
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

function productFacts(row: CarbohydratesComparisonRow) {
  return [
    row.netWeightG ? `${row.netWeightG.toLocaleString("en-GB")} g` : null,
    row.netVolumeMl ? `${row.netVolumeMl.toLocaleString("en-GB")} ml` : null,
    row.unitCount
      ? `${row.unitCount.toLocaleString("en-GB")} ${row.unitType || "units"}`
      : null,
    row.verifiedServingCount
      ? `${row.verifiedServingCount.toLocaleString("en-GB")} verified servings`
      : null,
  ].filter((value): value is string => Boolean(value));
}

export function buildCarbohydratesStructuredData(
  rows: CarbohydratesComparisonRow[]
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
        name: "Compare Carbohydrate Supplement Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Carbohydrate supplements with recently checked UK offers",
        numberOfItems: rows.length,
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
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "Carbohydrates",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function CarbohydratesProductCard({
  row,
  position,
}: {
  row: CarbohydratesComparisonRow;
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
            <h3 className="mt-2 break-words text-xl font-bold hover:underline">
              {row.name}
            </h3>
          </Link>
          {facts.length > 0 && (
            <p className="mt-2 text-sm text-zinc-600">{facts.join(" · ")}</p>
          )}
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
          <p className="mt-1 text-2xl font-extrabold">
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

export function CarbohydratesPageContent({
  result,
  controlView,
}: {
  result: CarbohydratesComparisonResult;
  controlView?: CategoryControlView<CarbohydratesComparisonRow>;
}) {
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildCarbohydratesStructuredData(result.rows);
  const decisionAnswers = selectCategoryDecisionAnswers(
    categoryDecisionCandidates(result.rows)
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics
        category="Carbohydrates"
        sourcePage="carbohydrates_comparison"
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
            href={rawCarbohydratesSearchHref}
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search carbohydrates
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Carbohydrates</li>
          </ol>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            UK retailer price comparison
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Carbohydrate Supplement Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Compare recently checked offers for clearly identified carbohydrate
            supplements, including Cream of Rice, carbohydrate powders,
            dextrose, dextrin and sports carbohydrate formulas. These products
            are not necessarily nutritionally or functionally equivalent.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} recently checked offers from {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have offers from multiple retailers.
            </p>
          )}
        </div>
      </section>

      <CategoryDecisionPanel
        answers={decisionAnswers}
        category="Carbohydrates"
      />

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Current comparison
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Carbohydrate supplement prices and retailer coverage
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck
              ? `Latest retailer check: ${latestCheck}`
              : "No current check time available"}
          </p>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Products with broader retailer coverage appear first. This is a
          coverage-first price comparison, not a ranking of formulation,
          performance, nutrition or suitability.
        </p>

        {controlView && (
          <CategoryComparisonControls
            basePath={pagePath}
            category="Carbohydrates"
            controls={controlView.controls}
            facets={controlView.facets}
            sorts={controlView.sorts}
            resultCount={result.rows.length}
            totalCount={controlView.totalCount}
          />
        )}

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">
              Current carbohydrate data is temporarily unavailable
            </h2>
            <p className="mt-2 text-zinc-700">
              No old prices have been substituted.
            </p>
            <Link
              href={rawCarbohydratesSearchHref}
              className="mt-4 inline-flex font-semibold underline"
            >
              Search carbohydrates
            </Link>
          </div>
        )}
        {!result.error && result.rows.length === 0 &&
          (!controlView || controlView.totalCount === 0) && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="text-xl font-bold">
                No recently checked carbohydrate offers
              </h2>
              <p className="mt-2 text-zinc-600">
                Products remain listed when identified, while older prices stay
                hidden until retailer data is checked again.
              </p>
            </div>
          )}
        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => (
              <CarbohydratesProductCard
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
            <h2 className="text-2xl font-bold">Reviewed inclusion boundary</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              A product needs explicit evidence of a carbohydrate supplement
              identity, such as Cream of Rice, a carbohydrate powder, dextrin,
              dextrose or Vitargo. A carbohydrate value in nutrition copy does
              not make an ordinary food, Mass Gainer, Protein Bar or Whey
              product part of this comparison.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">How prices are compared</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Only mapped, in-stock offers checked within 24 hours are shown.
              Known delivered totals are compared first; missing delivery is
              disclosed and never estimated. Per-kilogram or per-serving values
              appear only when the required fields are verified.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {result.summary.staleOrUnusableOffersExcluded} older or unusable in-stock offer{result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} excluded. Confirm the final price and stock with the retailer.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">
          Carbohydrate supplement comparison questions
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Is Cream of Rice included?</h3><p className="mt-2 leading-7 text-zinc-700">Yes. Clearly identified Cream of Rice products sit within the shared Carbohydrates comparison rather than a separate route.</p></div>
          <div><h3 className="font-bold">Are all products directly equivalent?</h3><p className="mt-2 leading-7 text-zinc-700">No. Cream of Rice, dextrose, dextrin, Vitargo and carbohydrate-electrolyte formulas differ in format and labelling. Compare the current product label and pack details.</p></div>
          <div><h3 className="font-bold">Are Mass Gainers and Protein Bars included?</h3><p className="mt-2 leading-7 text-zinc-700">Not from carbohydrate content alone. They need an independent primary carbohydrate-supplement identity; ambiguous protein products fail closed.</p></div>
          <div><h3 className="font-bold">Does the first result mean the best product?</h3><p className="mt-2 leading-7 text-zinc-700">No. Ordering favours current retailer and offer coverage. SupplementScout does not rank formulation quality, effects or personal suitability.</p></div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">Related comparisons and information</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/hydration" className="font-semibold underline">Hydration comparison</Link>
            <Link href="/pre-workout" className="font-semibold underline">Pre Workout comparison</Link>
            <Link href="/mass-gainer" className="font-semibold underline">Mass Gainer comparison</Link>
            <Link href="/amino-acids" className="font-semibold underline">Amino Acids comparison</Link>
            <Link href={rawCarbohydratesSearchHref} className="font-semibold underline">Search carbohydrate products</Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>
      </section>
    </main>
  );
}

export default async function CarbohydratesPage({
  searchParams,
}: PageProps = {}) {
  const params = await (searchParams || Promise.resolve({}));
  const result = await getCachedCarbohydratesComparison();
  assertLifecycleDataAvailable(result, pagePath);
  const controlView = buildCategoryControlView(
    result.rows,
    params,
    sharedCategoryControlFacts
  );
  return (
    <CarbohydratesPageContent
      result={{ ...result, rows: controlView.rows }}
      controlView={controlView}
    />
  );
}
