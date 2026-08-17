import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";
import {
  evaluateWheyIsolateIndexability,
  getWheyIsolateComparison,
  type WheyIsolateComparisonResult,
  type WheyIsolateComparisonRow,
} from "../lib/wheyIsolateComparison";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/whey-isolate";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare Whey Isolate prices across UK supplement retailers. See the lowest known delivered cost, fresh offers and verified protein value when available.";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getWheyIsolateComparison();
  const readiness = evaluateWheyIsolateIndexability(result.summary, true);
  const indexable = !result.error && readiness.indexable;

  return {
    title: "Whey Isolate Prices UK – Delivered Cost",
    description,
    robots: { index: indexable, follow: true },
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Whey Isolate Prices UK – Compare Delivered Cost | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Whey Isolate Prices UK – Compare Delivered Cost | SupplementScout",
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

export function buildWheyIsolateStructuredData(rows: WheyIsolateComparisonRow[]) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Whey Isolate Prices UK – Compare Delivered Cost",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Whey Isolate products with recently checked UK retailer offers",
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
          { "@type": "ListItem", position: 2, name: "Whey Protein", item: `${siteUrl}/whey-protein` },
          { "@type": "ListItem", position: 3, name: "Whey Isolate", item: pageUrl },
        ],
      },
    ],
  };
}

export function getLowestDeliveredWheyIsolateRows(
  rows: WheyIsolateComparisonRow[],
  limit = 3,
) {
  return rows
    .filter((row) => row.bestOffer.deliveredPrice !== null)
    .sort((left, right) => {
      const priceDifference =
        left.bestOffer.deliveredPrice!.totalPrice -
        right.bestOffer.deliveredPrice!.totalPrice;
      return priceDifference || left.name.localeCompare(right.name, "en-GB");
    })
    .slice(0, limit);
}

function IsolateProductCard({ row, position }: { row: WheyIsolateComparisonRow; position: number }) {
  const checkedAt = formatCheckedAt(row.lastCheckedAt);
  const retailerNames = [...new Set(row.offers.map((offer) => offer.retailer.name))];
  const displayedPrice = row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {position}. {row.brand || "Brand not stated"}
          </p>
          <Link href={row.productUrl} className="block">
            <h3 className="mt-2 break-words text-xl font-bold hover:underline">{row.name}</h3>
          </Link>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.offerCount} recently checked in-stock offer{row.offerCount === 1 ? "" : "s"} from {retailerNames.join(", ")}.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {checkedAt ? `Latest check: ${checkedAt}` : "Check time unavailable"}
          </p>
        </div>
        <div className="w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {row.retailerCount >= 2 ? "Lowest current delivered price" : "Current available price"}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{formatCurrency(displayedPrice)}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {row.bestOffer.deliveredPrice ? "Includes known delivery" : "Product price; delivery not known"}
          </p>
          {(row.pricePerKg !== null || row.pricePerServing !== null || row.costPer25gProtein !== null) && (
            <dl className="mt-4 grid gap-2 border-t border-zinc-200 pt-3 text-sm">
              {row.pricePerKg !== null && <div className="flex justify-between gap-4"><dt>Delivered price / kg</dt><dd className="font-semibold">{formatCurrency(row.pricePerKg)}</dd></div>}
              {row.pricePerServing !== null && <div className="flex justify-between gap-4"><dt>Delivered price / serving</dt><dd className="font-semibold">{formatUnitPrice(row.pricePerServing)}</dd></div>}
              {row.costPer25gProtein !== null && <div className="flex justify-between gap-4"><dt>Cost / 25 g protein</dt><dd className="font-semibold">{formatCurrency(row.costPer25gProtein)}</dd></div>}
            </dl>
          )}
          <Link href={row.productUrl} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">
            Compare this product
          </Link>
        </div>
      </div>
    </article>
  );
}

export function WheyIsolatePageContent({ result }: { result: WheyIsolateComparisonResult }) {
  const jsonLd = buildWheyIsolateStructuredData(result.rows);
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const lowestDeliveredRows = getLowestDeliveredWheyIsolateRows(result.rows);
  const lowestDeliveredRow = lowestDeliveredRows[0] ?? null;
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Whey Isolate" sourcePage="whey_isolate_comparison" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-bold">SupplementScout</Link>
          <Link href="/whey-protein" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">All Whey Protein</Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2"><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li><Link href="/whey-protein">Whey Protein</Link></li><li aria-hidden="true">/</li><li aria-current="page">Whey Isolate</li></ol>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">UK retailer price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Whey Isolate Prices UK – Compare Delivered Cost</h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">
            Compare recently checked offers for products whose canonical identity explicitly states whey isolate, ISO or WPI. Known delivery is included when available; missing prices, delivery and nutrition are never estimated.
          </p>
          {!result.error && <p className="mt-4 text-sm leading-6 text-zinc-600">Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} fresh offers and {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have multiple retailers.</p>}
        </div>
      </section>
      {lowestDeliveredRows.length > 0 && (
        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Quick price answer</p>
              <h2 className="mt-2 text-2xl font-bold">Lowest known delivered Whey Isolate prices</h2>
              <p className="mt-3 leading-7 text-zinc-700">
                These are the lowest recently checked in-stock totals where delivery is known. Offers with missing delivery are excluded from this shortlist rather than estimated.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {lowestDeliveredRows.map((row, index) => (
                <article key={row.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">#{index + 1} lowest known delivered total</p>
                  <h3 className="mt-2 font-bold"><Link href={row.productUrl} className="hover:underline">{row.name}</Link></h3>
                  <p className="mt-3 text-2xl font-extrabold">{formatCurrency(row.bestOffer.deliveredPrice!.totalPrice)}</p>
                  <p className="mt-1 text-sm text-zinc-600">From {row.bestOffer.retailer.name}, including known delivery.</p>
                  <Link href={row.productUrl} className="mt-4 inline-flex min-h-11 items-center font-semibold underline">Compare offers</Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-bold">Current Whey Isolate comparison</h2><p className="text-sm text-zinc-600">{latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}</p></div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">Products with broader retailer coverage appear first. This is a coverage and price ordering, not a nutritional or health ranking.</p>
        {result.error && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold">Current Whey Isolate data is temporarily unavailable</h2><p className="mt-2">No old prices have been substituted.</p></div>}
        {!result.error && result.rows.length === 0 && <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">No recently checked Whey Isolate offers</h2><p className="mt-2 text-zinc-600">Older prices remain hidden until retailer data is checked again.</p></div>}
        {result.rows.length > 0 && <div className="mt-6 space-y-4">{result.rows.map((row, index) => <IsolateProductCard key={row.id} row={row} position={index + 1} />)}</div>}
      </section>
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div><h2 className="text-2xl font-bold">What is included</h2><p className="mt-3 leading-7 text-zinc-700">Only active products in the reviewed Whey Protein category with an explicit isolate, ISO or WPI identity are included. Explicit blends, beef protein and collagen products are excluded. Retailer wording alone cannot put a different canonical product into scope.</p></div>
          <div><h2 className="text-2xl font-bold">How current prices work</h2><p className="mt-3 leading-7 text-zinc-700">Only mapped in-stock offers checked within 24 days are eligible. Known delivered totals rank ahead of offers with unknown delivery. Verified per-kilogram, serving and protein metrics appear only when their required source data is verified.</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold">Whey Isolate comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Is every whey product included?</h3><p className="mt-2 leading-7 text-zinc-700">No. The broader <Link href="/whey-protein" className="underline">Whey Protein comparison</Link> includes concentrates and reviewed whey blends. This page uses the narrower explicit-isolate boundary.</p></div>
          <div><h3 className="font-bold">Does the first product mean the best isolate?</h3><p className="mt-2 leading-7 text-zinc-700">No. Products with more current retailer coverage appear first; no unsupported quality, formulation or health ranking is made.</p></div>
          <div><h3 className="font-bold">Why can a product have only one retailer?</h3><p className="mt-2 leading-7 text-zinc-700">A recently checked offer can still be useful, but a product needs offers from more than one retailer before it provides a direct price comparison.</p></div>
          <div><h3 className="font-bold">Why is a value metric missing?</h3><p className="mt-2 leading-7 text-zinc-700">The current price can be valid while package, serving or nutrition evidence is incomplete. Unverified calculations remain hidden.</p></div>
          {lowestDeliveredRow && (
            <div><h3 className="font-bold">Which Whey Isolate has the lowest known delivered price?</h3><p className="mt-2 leading-7 text-zinc-700">From the fresh offers with known delivery currently included here, <Link href={lowestDeliveredRow.productUrl} className="underline">{lowestDeliveredRow.name}</Link> has the lowest delivered total at {formatCurrency(lowestDeliveredRow.bestOffer.deliveredPrice!.totalPrice)}. Coverage and prices can change, so check the dated retailer offers before buying.</p></div>
          )}
        </div>
        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Related comparisons and information</h2><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link><Link href="/vegan-protein" className="font-semibold underline">Vegan Protein comparison</Link><Link href="/creatine" className="font-semibold underline">Creatine comparison</Link><Link href="/pre-workout" className="font-semibold underline">Pre Workout comparison</Link><Link href="/search?q=whey%20isolate" className="font-semibold underline">Search Whey Isolate</Link><ComparisonTransparencyLinks /></div></aside>
        <p className="mt-8 text-xs leading-5 text-zinc-500">We only feature this comparison in search when it includes enough recently checked offers from multiple UK retailers. If coverage is temporarily limited, you can still use the page, but we will not present it as a complete market comparison.</p>
      </section>
    </main>
  );
}

export default async function WheyIsolatePage() {
  const result = await getWheyIsolateComparison();
  return <WheyIsolatePageContent result={result} />;
}
