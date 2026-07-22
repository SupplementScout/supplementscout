import type { Metadata } from "next";
import Link from "next/link";
import {
  getHydrationComparison,
  HYDRATION_INDEX_GATE,
  type HydrationComparisonResult,
  type HydrationComparisonRow,
} from "../lib/hydrationComparison";
import { formatCurrency } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pageUrl = `${siteUrl}/hydration`;
const description =
  "Browse recently checked hydration and electrolyte products, current prices and stock from UK supplement retailers.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Hydration & Electrolyte Supplements UK",
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: "/hydration" },
  openGraph: {
    title: "Hydration & Electrolyte Supplements UK | SupplementScout",
    description,
    url: "/hydration",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Hydration & Electrolyte Supplements UK | SupplementScout",
    description,
  },
};

function formatCheckedAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function productFacts(row: HydrationComparisonRow) {
  return [
    row.netWeightG ? `${row.netWeightG.toLocaleString("en-GB")} g` : null,
    row.netVolumeMl ? `${row.netVolumeMl.toLocaleString("en-GB")} ml` : null,
    row.unitCount
      ? `${row.unitCount.toLocaleString("en-GB")} ${row.unitType || "units"}`
      : null,
    row.verifiedServingCount
      ? `${row.verifiedServingCount.toLocaleString("en-GB")} verified servings`
      : null,
  ].filter(Boolean);
}

export function buildHydrationStructuredData(rows: HydrationComparisonRow[]) {
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const itemListId = `${pageUrl}#products`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Recently checked hydration and electrolyte products",
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
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Hydration and electrolytes",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function HydrationProductCard({ row }: { row: HydrationComparisonRow }) {
  const facts = productFacts(row);
  const checkedAt = formatCheckedAt(row.lastCheckedAt);
  const retailerNames = [
    ...new Set(row.offers.map((offer) => offer.retailer.name)),
  ];
  const priceLabel =
    row.retailerCount >= 2
      ? "Lowest current delivered price"
      : "Current available price";
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {row.brand || "Brand not stated"}
          </p>
          <Link href={row.productUrl} className="block">
            <h2 className="mt-2 break-words text-xl font-bold text-zinc-950 hover:underline">
              {row.name}
            </h2>
          </Link>
          {facts.length > 0 && (
            <p className="mt-2 text-sm text-zinc-600">{facts.join(" · ")}</p>
          )}
          <p className="mt-3 text-sm text-zinc-700">
            {row.offerCount} recently checked in-stock offer
            {row.offerCount === 1 ? "" : "s"} from {retailerNames.join(", ")}.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {checkedAt ? `Latest check: ${checkedAt}` : "Check time unavailable"}
          </p>
        </div>

        <div className="w-full shrink-0 rounded-lg bg-zinc-50 p-4 sm:w-64">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {priceLabel}
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
          <Link
            href={row.productUrl}
            className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            View product
          </Link>
        </div>
      </div>
    </article>
  );
}

export function HydrationPageContent({
  result,
}: {
  result: HydrationComparisonResult;
}) {
  const jsonLd = buildHydrationStructuredData(result.rows);
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            SupplementScout
          </Link>
          <Link
            href="/search?q=electrolytes"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search electrolytes
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Hydration and electrolytes</li>
          </ol>
        </nav>

        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recently checked availability
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Hydration &amp; Electrolyte Supplements UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Browse hydration powders, electrolyte mixes, tablets and formulas
            with recently checked in-stock prices. Check available prices and
            stock now; more retailer comparisons will appear as current coverage grows.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} product
              {result.summary.visibleProducts === 1 ? "" : "s"}, {result.summary.freshOffers} recently checked offer
              {result.summary.freshOffers === 1 ? "" : "s"} and {result.summary.freshRetailers} retailer
              {result.summary.freshRetailers === 1 ? "" : "s"}. {result.summary.productsWithMultipleFreshRetailers === 0
                ? "No product currently has recently checked offers from multiple retailers, so this page does not claim a retailer price comparison."
                : `${result.summary.productsWithMultipleFreshRetailers} products currently have multiple recently checked retailers.`}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Current products</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Recently checked prices and stock</h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}
          </p>
        </div>

        {result.error && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Current hydration data is temporarily unavailable</h2>
            <p className="mt-2 text-zinc-700">No old prices have been substituted. Try the electrolyte search instead.</p>
            <Link href="/search?q=electrolytes" className="mt-4 inline-flex font-semibold underline">Search electrolytes</Link>
          </div>
        )}

        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No recently checked hydration offers</h2>
            <p className="mt-2 text-zinc-600">Older prices remain hidden until retailer data is checked again.</p>
          </div>
        )}

        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row) => <HydrationProductCard key={row.id} row={row} />)}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How freshness works</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Only active, in-stock offers with a valid price, retailer mapping,
              retailer URL and a check within the same 24-hour freshness window
              used by the Creatine comparison appear here. Older or incomplete
              offers do not influence current prices.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {result.summary.staleOrUnusableOffersExcluded} older or unusable in-stock offer
              {result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} currently excluded.
              Prices and stock can change after the displayed check, so confirm details on the retailer page.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">When this page can be indexed</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              The page remains out of search indexes until at least {HYDRATION_INDEX_GATE.minimumProductsWithMultipleFreshRetailers} products have
              recently checked offers from multiple retailers, at least {HYDRATION_INDEX_GATE.minimumFreshRetailersAcrossComparisons} fresh retailers are represented
              across those comparisons, at least {HYDRATION_INDEX_GATE.minimumFreshOffers} fresh offers remain available, and structured data has no major errors.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">Hydration and electrolyte questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">What are hydration supplements?</h3><p className="mt-2 leading-7 text-zinc-700">They are products designed to add fluid-mixing ingredients and, commonly, electrolytes to a drink. Formats include powders, tablets and ready-to-drink products.</p></div>
          <div><h3 className="font-bold">What do electrolyte products commonly contain?</h3><p className="mt-2 leading-7 text-zinc-700">Formulas commonly use minerals such as sodium, potassium or magnesium. Amounts vary, so check the product label rather than assuming every formula is equivalent.</p></div>
          <div><h3 className="font-bold">Who may use hydration products?</h3><p className="mt-2 leading-7 text-zinc-700">People commonly consider them around exercise, travel or other situations involving fluid intake. Individual needs vary; follow the label and seek qualified advice when appropriate.</p></div>
          <div><h3 className="font-bold">How are hydration products different from EAA or pre-workout?</h3><p className="mt-2 leading-7 text-zinc-700">Hydration products are positioned around fluids and electrolytes. EAA products focus on essential amino acids, while pre-workouts use ingredients intended for use before training. Combination products appear here only when hydration or electrolyte positioning is explicit.</p></div>
          <div><h3 className="font-bold">How does SupplementScout check prices and stock?</h3><p className="mt-2 leading-7 text-zinc-700">Retailer offers are mapped to reviewed canonical products. This page accepts only valid in-stock offers checked within 24 hours and never fills missing prices by estimation.</p></div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">Related comparisons and searches</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/creatine" className="font-semibold underline">Creatine comparison</Link>
            <Link href="/vitamins" className="font-semibold underline">Vitamins</Link>
            <Link href="/search?q=electrolytes" className="font-semibold underline">Search electrolytes</Link>
            <Link href="/about" className="font-semibold underline">How SupplementScout works</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default async function HydrationPage() {
  const result = await getHydrationComparison();
  return <HydrationPageContent result={result} />;
}
