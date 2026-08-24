import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import { OfferCheckedBadge } from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  getDeals,
  type DealsResult,
  type DealsRow,
} from "../lib/dealsPriceIntelligence";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import { formatCurrency } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/deals";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare today's recently checked delivered prices for exact supplement variants available from multiple UK retailers.";
const getCachedDeals = createLifecycleDataLoader(
  pagePath,
  "deals-price-intelligence-v1",
  getDeals
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return {
    title: "Best Supplement Prices Today UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Best Supplement Prices Today UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
  };
}

export function assertDealsDataAvailable(result: DealsResult) {
  assertLifecycleDataAvailable(result, pagePath);
}

function formatCheckedAt(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function buildDealsStructuredData(rows: DealsRow[]) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Best Supplement Prices Today UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
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
          { "@type": "ListItem", position: 2, name: "Deals", item: pageUrl },
        ],
      },
    ],
  };
}

export function isDealsStructuredDataValid(value: ReturnType<typeof buildDealsStructuredData>) {
  const graph = value["@graph"];
  return (
    value["@context"] === "https://schema.org" &&
    graph.some((item) => item["@type"] === "CollectionPage") &&
    graph.some((item) => item["@type"] === "ItemList") &&
    graph.some((item) => item["@type"] === "BreadcrumbList")
  );
}

function PriceCard({ row, position }: { row: DealsRow; position: number }) {
  const offer = row.bestOffer;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {position}. {row.brand || "Brand not stated"}
          </p>
          <Link href={row.productUrl} className="block">
            <h2 className="mt-2 text-xl font-bold hover:underline">{row.name}</h2>
          </Link>
          <p className="mt-2 text-sm font-semibold text-zinc-800">Exact pack: {row.packLabel}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.retailerCount} recently checked retailers for this same variant and pack.
          </p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
          <Link href={row.productUrl} className="mt-3 inline-block text-sm font-semibold underline">
            Compare every current offer
          </Link>
        </div>
        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Lowest current delivered price
          </p>
          <p className="mt-1 text-3xl font-extrabold">{formatCurrency(offer.deliveredPrice.totalPrice)}</p>
          <p className="mt-2 text-sm text-zinc-600">
            {formatCurrency(offer.productPrice)} product + {offer.shippingCost === 0 ? "free delivery" : `${formatCurrency(offer.shippingCost)} delivery`}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-700">Available at {offer.retailer.name}</p>
          <a
            href={`/go/${offer.id}?source=product_best_offer`}
            rel="sponsored nofollow noopener noreferrer"
            className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Check current retailer price
          </a>
        </div>
      </div>
    </article>
  );
}

export function DealsPageContent({ result }: { result: DealsResult }) {
  assertDealsDataAvailable(result);
  const jsonLd = buildDealsStructuredData(result.rows);
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Deals" sourcePage="deals_current_prices" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0 text-xl font-bold">SupplementScout</Link>
          <Link href="/search" className="text-sm font-semibold">
            <span className="sm:hidden">Search</span>
            <span className="hidden sm:inline">Search supplements</span>
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span aria-current="page">Deals</span>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Current UK price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Best Supplement Prices Today</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-700">
            Compare current delivered prices only where the same exact variant and pack is available from at least two recently checked UK retailers.
          </p>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            This page shows today&apos;s price evidence. It does not claim that a price has fallen or compare it with an earlier price.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Coverage is limited to the retailers SupplementScout currently tracks and does not represent every retailer in the UK market.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-bold">Current exact-variant prices</h2>
          <p className="text-sm text-zinc-600">{latestCheck ? `Latest check: ${latestCheck}` : "No current check time available"}</p>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          {result.summary.visibleProducts} products, {result.summary.qualifyingOffers} qualifying offers and {result.summary.freshRetailers} retailers meet the current evidence rules.
        </p>
        {result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No comparisons meet today&apos;s evidence rules</h2>
            <p className="mt-2 text-zinc-600">Single-retailer, stale and unresolved variant prices remain hidden.</p>
          </div>
        )}
        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => <PriceCard key={row.id} row={row} position={index + 1} />)}
          </div>
        )}
      </section>
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What qualifies?</h2>
            <p className="mt-3 leading-7 text-zinc-700">The product, retailer mapping and concrete variant must agree. The pack must have a known count and measure, the offer must be in stock, and both product price and delivery cost must be known.</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Why are some offers missing?</h2>
            <p className="mt-3 leading-7 text-zinc-700">We fail closed when identity, delivery, stock or freshness evidence is incomplete. A product also needs two retailers for the same exact variant before it appears here.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-xl font-bold">Related comparisons and information</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/whey-protein" className="font-semibold underline">Whey Protein</Link>
          <Link href="/protein-bars" className="font-semibold underline">Protein Bars</Link>
          <Link href="/creatine" className="font-semibold underline">Creatine</Link>
          <ComparisonTransparencyLinks />
        </div>
        <p className="mt-8 text-xs leading-5 text-zinc-500">Only current offers that meet the exact-variant, delivery, stock and freshness rules are shown. The launch gate remains a monitoring check, not an hourly indexing switch.</p>
      </section>
    </main>
  );
}

export default async function DealsPage() {
  const result = await getCachedDeals();
  assertDealsDataAvailable(result);
  return <DealsPageContent result={result} />;
}
