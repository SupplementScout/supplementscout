import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
} from "../../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../../components/ComparisonTransparencyLinks";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../../lib/lifecycleDataCache";
import {
  getEbayUKRetailer,
  type EbayUKRetailerResult,
  type EbayUKRetailerRow,
} from "../../lib/ebayUKRetailer";
import { formatCurrency } from "../../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/retailers/ebay-uk";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare tracked eBay UK supplement offers with current prices from other UK retailers, including known delivery and 24-hour freshness checks.";
const getCachedEbayUKRetailer = createLifecycleDataLoader(
  pagePath,
  "ebay-uk-retailer-v1",
  getEbayUKRetailer
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export function isEbayUKStructuredDataValid(rows: EbayUKRetailerRow[]) {
  return (
    rows.length > 0 &&
    new Set(rows.map((row) => row.id)).size === rows.length &&
    rows.every(
      (row) =>
        row.name.trim().length > 0 &&
        /^\/product\/[a-z0-9-]+$/i.test(row.productUrl) &&
        row.ebayOffers.length > 0 &&
        row.ebayOffers.every((offer) => offer.retailer.id === "12")
    )
  );
}

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({ searchParams }: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));

  return {
    title: "Compare eBay UK Supplement Prices",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare eBay UK Supplement Prices | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare eBay UK Supplement Prices | SupplementScout",
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

function displayedPrice(offer: EbayUKRetailerRow["bestEbayOffer"]) {
  return offer.deliveredPrice?.totalPrice ?? offer.productPrice;
}

function priceScope(offer: EbayUKRetailerRow["bestEbayOffer"]) {
  return offer.deliveredPrice ? "Includes known delivery" : "Product price; delivery not known";
}

export function buildEbayUKStructuredData(rows: EbayUKRetailerRow[]) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Compare eBay UK Supplement Prices",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Tracked eBay UK supplements with current cross-retailer comparisons",
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
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "eBay UK", item: pageUrl },
        ],
      },
    ],
  };
}

function OfferPanel({
  label,
  offer,
}: {
  label: string;
  offer: EbayUKRetailerRow["bestEbayOffer"] | null;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">{label}</p>
      {offer ? (
        <>
          <p className="mt-1 break-words text-2xl font-extrabold text-zinc-950">
            {formatCurrency(displayedPrice(offer))}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{priceScope(offer)}</p>
          <p className="mt-1 break-words text-sm font-medium text-zinc-700">
            {offer.retailer.name}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          No other recently checked retailer offer is available.
        </p>
      )}
    </div>
  );
}

function ProductCard({ row, position }: { row: EbayUKRetailerRow; position: number }) {
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-4 lg:grid-cols-[128px_minmax(0,1fr)_24rem] lg:items-center lg:gap-5">
        <ComparisonProductThumbnail image={row.image} name={row.name} productUrl={row.productUrl} />
        <div className="min-w-0">
          <p className="break-words text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {position}. {row.category || "Other"} · {row.brand || "Brand not recorded"}
          </p>
          <Link href={row.productUrl} className="block min-w-0">
            <h3 className="mt-2 break-words text-xl font-bold text-zinc-950 hover:underline">
              {row.name}
            </h3>
          </Link>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.ebayOffers.length} tracked eBay UK offer{row.ebayOffers.length === 1 ? "" : "s"}; {" "}
            {row.bestAlternativeOffer
              ? `${row.retailerCount - 1} other retailer${row.retailerCount === 2 ? "" : "s"} in current coverage.`
              : "no current alternative retailer offer."}
          </p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>
        <div className="col-span-2 grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
          <OfferPanel label="Tracked eBay UK offer" offer={row.bestEbayOffer} />
          <OfferPanel label="Best other current offer" offer={row.bestAlternativeOffer} />
          <Link
            href={row.productUrl}
            className="flex min-h-11 min-w-0 items-center justify-center rounded-lg bg-zinc-950 px-4 text-center text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Compare all current offers
          </Link>
        </div>
      </div>
    </article>
  );
}

export function EbayUKPageContent({ result }: { result: EbayUKRetailerResult }) {
  const structuredDataValid = isEbayUKStructuredDataValid(result.rows);
  const jsonLd = structuredDataValid ? buildEbayUKStructuredData(result.rows) : null;
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);

  return (
    <main className="min-h-screen min-w-0 w-full max-w-full overflow-x-hidden bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="eBay UK" sourcePage="ebay_uk_retailer" />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">SupplementScout</Link>
          <Link href="/search?q=ebay" className="shrink-0 text-right text-sm font-semibold text-zinc-700 hover:text-zinc-950">
            Search products
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">eBay UK</li>
          </ol>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Marketplace offers compared with UK retailers
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare eBay UK Supplement Prices
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            See tracked eBay UK supplement offers beside recently checked prices
            from other UK retailers. Products with a real alternative appear first,
            and known delivery is included when the evidence supports it.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current tracked coverage: {result.summary.visibleProducts} products, {" "}
              {result.summary.targetFreshOffers} eBay UK offers and {" "}
              {result.summary.freshOffers} recently checked offers across {" "}
              {result.summary.freshRetailers} retailers. {" "}
              {result.summary.productsWithMultipleFreshRetailers} products have a current alternative.
            </p>
          )}
        </div>
      </section>

      {!result.error && result.categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-2xl font-bold">Tracked categories</h2>
            <p className="mt-3 max-w-4xl leading-7 text-zinc-700">
              These counts describe current tracked coverage, not the complete eBay marketplace
              and not a ranking of product or seller quality.
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.categories.map((category) => (
                <div key={category.name} className="min-w-0 rounded-xl bg-zinc-50 p-4">
                  <dt className="break-words font-bold">{category.name}</dt>
                  <dd className="mt-1 text-sm leading-6 text-zinc-600">
                    {category.products} tracked product{category.products === 1 ? "" : "s"}; {" "}
                    {category.comparableProducts} with another retailer
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
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Current comparison</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">eBay UK offers and alternatives</h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}
          </p>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Products with another current retailer are shown first. Ordering does not imply
          effectiveness, suitability, seller quality or endorsement.
        </p>

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Current retailer data is unavailable</h2>
            <p className="mt-2 text-zinc-700">
              No old prices or arbitrary marketplace listings have been substituted.
            </p>
            <Link href="/search" className="mt-4 inline-flex font-semibold underline">Search the catalogue</Link>
          </div>
        )}
        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No recently checked eBay UK offers</h2>
            <p className="mt-2 text-zinc-600">Older listings remain hidden until their data is checked again.</p>
          </div>
        )}
        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => <ProductCard key={row.id} row={row} position={index + 1} />)}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How tracked eBay offers qualify</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Only stored eBay UK listings already admitted through SupplementScout&apos;s
              guarded identity review can appear. Offers must be mapped, in stock,
              positive-priced, use a valid destination and be checked within 24 hours.
              The page never browses arbitrary eBay listings during a visit.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Marketplace and coverage limits</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              eBay is a marketplace for independent sellers. SupplementScout does not
              represent eBay, verify seller quality or endorse a listing. Coverage is a
              small tracked subset, and the final seller, price, delivery, returns and
              availability must be confirmed on eBay before purchase.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">eBay UK comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-bold">Is this every supplement listed on eBay?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. Only exact listings already matched to active SupplementScout products
              through the guarded review process are shown.
            </p>
          </div>
          <div>
            <h3 className="font-bold">Does the cheapest displayed number always win?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. Delivered totals are comparable only when delivery is known. Missing
              delivery is labelled and never assumed to be free.
            </p>
          </div>
          <div>
            <h3 className="font-bold">How often are offers checked?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              Only checks from the last 24 hours qualify. Marketplace listings can change
              afterwards, so verify the checkout details before buying.
            </p>
          </div>
          <div>
            <h3 className="font-bold">Does SupplementScout recommend a seller?</h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. The page compares tracked price evidence and does not score seller
              authenticity, service, returns or product suitability.
            </p>
          </div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">Related comparisons and information</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link>
            <Link href="/pre-workout" className="font-semibold underline">Pre Workout comparison</Link>
            <Link href="/creatine" className="font-semibold underline">Creatine comparison</Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          This page remains indexable only while its exact retailer scope, current
          comparison depth, fresh offer count, category breadth and structured data
          all pass the fail-closed gate.
        </p>
      </section>
    </main>
  );
}

export default async function EbayUKRetailerPage() {
  const result = await getCachedEbayUKRetailer();
  assertLifecycleDataAvailable(result, pagePath);
  return <EbayUKPageContent result={result} />;
}
