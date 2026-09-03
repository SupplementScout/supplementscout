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
  getProteinBarsComparison,
  type ProteinBarsComparisonResult,
  type ProteinBarsComparisonRow,
} from "../lib/proteinBarsComparison";
import { formatCurrency } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/protein-bars";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Protein Bar prices from UK supplement retailers using exact pack counts, recently checked offers and known delivery costs.";
const getCachedProteinBarsComparison = createLifecycleDataLoader(
  pagePath,
  "protein-bars-comparison-v1",
  getProteinBarsComparison
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return {
    title: "Compare Protein Bar Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Protein Bar Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Protein Bar Prices UK | SupplementScout",
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

export function buildProteinBarsStructuredData(rows: ProteinBarsComparisonRow[]) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Compare Protein Bar Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Protein Bars with exact packs and recently checked UK retailer offers",
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
          { "@type": "ListItem", position: 2, name: "Protein Bars", item: pageUrl },
        ],
      },
    ],
  };
}

function ProteinBarCard({ row, position }: { row: ProteinBarsComparisonRow; position: number }) {
  if (!row.bestOffer) {
    return <UnavailableComparisonProductCard row={row} position={position} />;
  }
  const retailerNames = [...new Set(row.offers.map((offer) => offer.retailer.name))];
  const displayedPrice = row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 lg:grid-cols-[128px_minmax(0,1fr)_20rem] lg:items-center lg:gap-5">
        <ComparisonProductThumbnail image={row.image} name={row.name} productUrl={row.productUrl} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{position}. {row.brand || "Brand not stated"}</p>
          <Link href={row.productUrl} className="block"><h3 className="mt-2 break-words text-xl font-bold hover:underline">{row.name}</h3></Link>
          <p className="mt-2 text-sm font-semibold text-zinc-800">Exact pack: {row.packCount} {row.packCount === 1 ? "bar" : "bars"}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{row.offerCount} recently checked exact-pack offer{row.offerCount === 1 ? "" : "s"} from {retailerNames.join(", ")}.</p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>
        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{row.retailerCount >= 2 ? "Lowest current delivered price" : "Current available price"}</p>
          <p className="mt-1 text-2xl font-extrabold">{formatCurrency(displayedPrice)}</p>
          <p className="mt-1 text-sm text-zinc-600">{row.bestOffer.deliveredPrice ? "Includes known delivery" : "Product price; delivery not known"}</p>
          <p className="mt-1 text-sm font-medium text-zinc-700">Available at {row.bestOffer.retailer.name}</p>
          <Link href={row.productUrl} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">Compare this product</Link>
        </div>
      </div>
    </article>
  );
}

export function ProteinBarsPageContent({ result }: { result: ProteinBarsComparisonResult }) {
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildProteinBarsStructuredData(result.rows);
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Protein Bars" sourcePage="protein_bars_comparison" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link href="/" className="text-xl font-bold">SupplementScout</Link><Link href="/search?q=protein%20bars" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">Search Protein Bars</Link></div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600"><ol className="flex items-center gap-2"><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li aria-current="page">Protein Bars</li></ol></nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">UK exact-pack price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare Protein Bar Prices UK</h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">Compare recently checked Protein Bar offers without mixing single bars and boxes. Known delivery is included, while unresolved pack identities and unverified per-bar or nutrition calculations remain hidden.</p>
          {!result.error && <p className="mt-4 text-sm leading-6 text-zinc-600">Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} exact-pack offers and {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have multiple retailers.</p>}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-bold">Current Protein Bar comparison</h2><p className="text-sm text-zinc-600">{latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}</p></div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">Products with broader exact-pack retailer coverage appear first. This is a price and availability comparison, not a ranking of taste, nutrition, quality or suitability.</p>
        {result.error && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold">Current Protein Bar data is temporarily unavailable</h2><p className="mt-2">No old prices or uncertain packs have been substituted.</p></div>}
        {!result.error && result.rows.length === 0 && <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">No recently checked exact-pack offers</h2><p className="mt-2 text-zinc-600">Older prices and unresolved packs remain hidden until data is checked again.</p></div>}
        {result.rows.length > 0 && <div className="mt-6 space-y-4">{result.rows.map((row, index) => <ProteinBarCard key={row.id} row={row} position={index + 1} />)}</div>}
      </section>
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div><h2 className="text-2xl font-bold">Reviewed inclusion boundary</h2><p className="mt-3 leading-7 text-zinc-700">Only active, unmerged products in the Protein Bars category with an explicit bar, wafer or flapjack identity, a reviewed bar or snack format and one consistent pack count across active concrete variants are included. Cookies, spreads, drinks, pancake mixes and other foods stay outside this comparison.</p></div>
          <div><h2 className="text-2xl font-bold">How exact-pack prices work</h2><p className="mt-3 leading-7 text-zinc-700">Only mapped, in-stock offers checked within 24 hours and bound to the product&apos;s exact pack count are shown. Known delivered totals include recorded shipping. We do not infer price per bar or nutrition value from a name alone.</p><p className="mt-3 text-sm leading-6 text-zinc-600">{result.summary.staleOrUnusableOffersExcluded} older, unresolved or unusable in-stock offer{result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} excluded. Confirm the selected flavour, pack, final price and stock with the retailer.</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold">Protein Bar comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Are single bars compared with boxes?</h3><p className="mt-2 leading-7 text-zinc-700">No. A product is included only when its active concrete variants share one known pack count, and every displayed offer must resolve to that exact pack.</p></div>
          <div><h3 className="font-bold">Does the first result mean the best Protein Bar?</h3><p className="mt-2 leading-7 text-zinc-700">No. Ordering favours current retailer and offer coverage. SupplementScout does not make an unsupported taste, nutrition or effectiveness ranking.</p></div>
          <div><h3 className="font-bold">Why is price per bar not shown?</h3><p className="mt-2 leading-7 text-zinc-700">Pack identity can be known while a product-level unit-value field is not verified. Calculations remain hidden until the required approved evidence exists.</p></div>
          <div><h3 className="font-bold">Why can only one retailer appear?</h3><p className="mt-2 leading-7 text-zinc-700">A recently checked exact-pack offer can still be useful, but a direct comparison needs the same product pack at more than one retailer.</p></div>
        </div>
        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Related comparisons and information</h2><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/deals" className="font-semibold underline">Best supplement prices today</Link><Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link><Link href="/vegan-protein" className="font-semibold underline">Vegan Protein comparison</Link><Link href="/search?q=protein%20bars" className="font-semibold underline">Search Protein Bars</Link><ComparisonTransparencyLinks /></div></aside>
        <p className="mt-8 text-xs leading-5 text-zinc-500">We only feature this comparison in search when it includes enough recently checked exact-pack offers from multiple UK retailers. If coverage falls, the readiness gate removes it from the sitemap and changes it to noindex.</p>
      </section>
    </main>
  );
}

export default async function ProteinBarsPage() {
  const result = await getCachedProteinBarsComparison();
  assertLifecycleDataAvailable(result, pagePath);
  return <ProteinBarsPageContent result={result} />;
}
