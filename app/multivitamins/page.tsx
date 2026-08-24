import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
} from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import {
  getMultivitaminsComparison,
  type MultivitaminsComparisonResult,
  type MultivitaminsComparisonRow,
} from "../lib/multivitaminsComparison";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/multivitamins";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Multivitamin prices from UK supplement retailers using recently checked offers, known delivery and verified pack information.";
const getCachedMultivitaminsComparison = createLifecycleDataLoader(
  pagePath,
  "multivitamins-comparison-v1",
  getMultivitaminsComparison
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return {
    title: "Compare Multivitamin Prices UK",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Multivitamin Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Multivitamin Prices UK | SupplementScout",
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

function formatPack(row: MultivitaminsComparisonRow) {
  if (!row.unitCount || !row.unitType) return null;
  const unit = row.unitCount === 1 ? row.unitType : `${row.unitType}s`;
  return `${row.unitCount} ${unit}`;
}

export function buildMultivitaminsStructuredData(
  rows: MultivitaminsComparisonRow[]
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
        name: "Compare Multivitamin Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Multivitamins with recently checked UK retailer offers",
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
          { "@type": "ListItem", position: 2, name: "Multivitamins", item: pageUrl },
        ],
      },
    ],
  };
}

function MultivitaminsProductCard({
  row,
  position,
}: {
  row: MultivitaminsComparisonRow;
  position: number;
}) {
  const retailerNames = [...new Set(row.offers.map((offer) => offer.retailer.name))];
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;
  const pack = formatPack(row);
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 lg:grid-cols-[128px_minmax(0,1fr)_20rem] lg:items-center lg:gap-5">
        <ComparisonProductThumbnail image={row.image} name={row.name} productUrl={row.productUrl} />
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
          {pack && <p className="mt-1 text-sm font-medium text-zinc-700">Verified pack: {pack}</p>}
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>
        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{row.retailerCount >= 2 ? "Lowest current delivered price" : "Current available price"}</p>
          <p className="mt-1 text-2xl font-extrabold">{formatCurrency(displayedPrice)}</p>
          <p className="mt-1 text-sm text-zinc-600">{row.bestOffer.deliveredPrice ? "Includes known delivery" : "Product price; delivery not known"}</p>
          <p className="mt-1 text-sm font-medium text-zinc-700">Available at {row.bestOffer.retailer.name}</p>
          {row.pricePerServing !== null && <p className="mt-3 border-t border-zinc-200 pt-3 text-sm">Delivered price / serving: <strong>{formatUnitPrice(row.pricePerServing)}</strong></p>}
          <Link href={row.productUrl} className="mt-4 flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800">Compare this product</Link>
        </div>
      </div>
    </article>
  );
}

export function MultivitaminsPageContent({ result }: { result: MultivitaminsComparisonResult }) {
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildMultivitaminsStructuredData(result.rows);
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Multivitamins" sourcePage="multivitamins_comparison" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link href="/" className="text-xl font-bold">SupplementScout</Link><Link href="/search?q=multivitamin" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">Search Multivitamins</Link></div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600"><ol className="flex items-center gap-2"><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li aria-current="page">Multivitamins</li></ol></nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">UK retailer price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare Multivitamin Prices UK</h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">Compare recently checked UK offers for products explicitly identified as multivitamins. Known delivery is included when available; missing pack, serving and formulation values are never estimated.</p>
          {!result.error && <p className="mt-4 text-sm leading-6 text-zinc-600">Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} fresh offers and {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have multiple retailers.</p>}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-bold">Current Multivitamins comparison</h2><p className="text-sm text-zinc-600">{latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}</p></div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">Products with broader retailer coverage appear first. This is a coverage-first price comparison, not a ranking of formulation, effectiveness or suitability.</p>
        {result.error && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold">Current Multivitamins data is temporarily unavailable</h2><p className="mt-2">No old prices have been substituted.</p></div>}
        {!result.error && result.rows.length === 0 && <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">No recently checked Multivitamin offers</h2><p className="mt-2 text-zinc-600">Older prices remain hidden until retailer data is checked again.</p></div>}
        {result.rows.length > 0 && <div className="mt-6 space-y-4">{result.rows.map((row, index) => <MultivitaminsProductCard key={row.id} row={row} position={index + 1} />)}</div>}
      </section>
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div><h2 className="text-2xl font-bold">Reviewed inclusion boundary</h2><p className="mt-3 leading-7 text-zinc-700">Only active, unmerged products in the Vitamins or Health Supplements catalogue whose canonical name explicitly identifies a multivitamin are included. Mineral-only products and products with unresolved identity stay outside this comparison.</p></div>
          <div><h2 className="text-2xl font-bold">How current prices work</h2><p className="mt-3 leading-7 text-zinc-700">Only mapped, in-stock offers checked within 24 hours are shown. Known delivered totals rank ahead of offers with unknown delivery. Pack and serving values appear only when verified.</p><p className="mt-3 text-sm leading-6 text-zinc-600">{result.summary.staleOrUnusableOffersExcluded} older or unusable in-stock offer{result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} excluded. Confirm final price, stock and exact label with the retailer.</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold">Multivitamin comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Does the first result mean the best Multivitamin?</h3><p className="mt-2 leading-7 text-zinc-700">No. Ordering favours current retailer and offer coverage. We do not make an unsupported health, effectiveness or formulation ranking.</p></div>
          <div><h3 className="font-bold">Are tablets, capsules and gummies equivalent?</h3><p className="mt-2 leading-7 text-zinc-700">No. Formats, pack counts, directions and formulations can differ. Check the exact retailer label before buying.</p></div>
          <div><h3 className="font-bold">Why can a product have only one retailer?</h3><p className="mt-2 leading-7 text-zinc-700">A recently checked offer can still be useful, but a product needs offers from more than one retailer before it provides a direct price comparison.</p></div>
          <div><h3 className="font-bold">Why is a pack or serving value missing?</h3><p className="mt-2 leading-7 text-zinc-700">A price may be current while pack or serving evidence is incomplete. Unverified calculations remain hidden.</p></div>
        </div>
        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Related comparisons and information</h2><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link><Link href="/mass-gainer" className="font-semibold underline">Mass Gainer comparison</Link><Link href="/creatine" className="font-semibold underline">Creatine comparison</Link><Link href="/search?q=multivitamin" className="font-semibold underline">Search Multivitamins</Link><ComparisonTransparencyLinks /></div></aside>
        <p className="mt-8 text-xs leading-5 text-zinc-500">We only feature this comparison in search when it includes enough recently checked offers from multiple UK retailers. If coverage is temporarily limited, you can still use the page, but we will not present it as a complete market comparison.</p>
      </section>
    </main>
  );
}

export default async function MultivitaminsPage() {
  const result = await getCachedMultivitaminsComparison();
  assertLifecycleDataAvailable(result, pagePath);
  return <MultivitaminsPageContent result={result} />;
}
