import type { Metadata } from "next";
import Link from "next/link";
import {
  getCreatineComparison,
  type CreatineComparisonResult,
  type CreatineComparisonRow,
} from "../lib/creatineComparison";
import { CREATINE_LAUNCH_STATUS } from "../lib/creatineLaunch";
import { formatCurrency } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pageUrl = `${siteUrl}/creatine`;
const description =
  "Compare creatine supplement prices, delivery costs and retailer availability from UK supplement retailers.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Compare Creatine Supplements & Prices UK",
  description,
  robots: {
    index: CREATINE_LAUNCH_STATUS.allowIndexing,
    follow: true,
  },
  alternates: {
    canonical: "/creatine",
  },
  openGraph: {
    title: "Compare Creatine Supplements & Prices UK | SupplementScout",
    description,
    url: "/creatine",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Compare Creatine Supplements & Prices UK | SupplementScout",
    description,
  },
};

function safeBackgroundImage(value: string) {
  return `url("${value.replace(/["\\\n\r]/g, "")}")`;
}

function formatOptionalNumber(value: number | null, suffix: string) {
  return value === null ? null : `${value.toLocaleString("en-GB")} ${suffix}`;
}

function formatCheckedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function buildCreatineStructuredData(rows: CreatineComparisonRow[], lastUpdated: string | null) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const structuredDataRows = rows.filter(
    (row): row is CreatineComparisonRow & { bestOffer: NonNullable<CreatineComparisonRow["bestOffer"]> } =>
      row.bestOffer !== null
  );
  const collectionPage: Record<string, unknown> = {
    "@type": "CollectionPage",
    "@id": pageUrl,
    url: pageUrl,
    name: "Compare Creatine Supplements & Prices UK",
    description,
    mainEntity: { "@id": itemListId },
    breadcrumb: { "@id": breadcrumbId },
  };

  if (lastUpdated) {
    collectionPage.dateModified = lastUpdated;
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      collectionPage,
      {
        "@type": "ItemList",
        "@id": itemListId,
        numberOfItems: structuredDataRows.length,
        itemListElement: structuredDataRows.map((row, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Product",
            name: row.name,
            url: `${siteUrl}${row.productUrl}`,
            offers: {
              "@type": "Offer",
              priceCurrency: "GBP",
              price: row.bestOffer.productPrice.toFixed(2),
              availability: "https://schema.org/InStock",
              seller: row.bestOffer.retailer?.name
                ? {
                    "@type": "Organization",
                    name: row.bestOffer.retailer.name,
                  }
                : undefined,
            },
          },
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
            name: "Creatine",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function ProductIdentity({ row }: { row: CreatineComparisonRow }) {
  const packSize = formatOptionalNumber(row.netWeightG, "g");
  const servings = formatOptionalNumber(row.verifiedServingCount, "verified servings");
  const creatine = formatOptionalNumber(row.creatinePerServingG, "g creatine / serving");

  return (
    <div className="flex min-w-64 items-center gap-3">
      <Link
        href={row.productUrl}
        aria-label={`View ${row.name}`}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-1"
      >
        {row.image ? (
          <span
            role="img"
            aria-label={row.name}
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: safeBackgroundImage(row.image) }}
          />
        ) : (
          <span className="text-center text-xs font-semibold text-zinc-500">No image</span>
        )}
      </Link>
      <div className="min-w-0">
        <Link href={row.productUrl} className="font-bold text-zinc-950 hover:underline">
          {row.name}
        </Link>
        {(packSize || servings || creatine) && (
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            {[packSize, servings, creatine].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function CreatinePageContent({ result }: { result: CreatineComparisonResult }) {
  const lastUpdated = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildCreatineStructuredData(result.rows, result.summary.latestOfferCheckedAt);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-zinc-50 text-zinc-950">
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
          <Link href="/search?q=Creatine" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">
            Search creatine
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Creatine</li>
          </ol>
        </nav>

        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Creatine comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare Creatine Supplements UK</h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            This page compares creatine products available from UK supplement retailers. Where retailer data allows, delivered prices include both the product price and delivery. Cost per 5 g is shown only when the product weight and creatine data meet our verification rules. Prices, delivery charges and stock can change, so check the retailer before buying.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.activeProducts} active product{result.summary.activeProducts === 1 ? "" : "s"}, {result.summary.activeOffers} recently verified in-stock offer{result.summary.activeOffers === 1 ? "" : "s"} and {result.summary.retailers} current retailer{result.summary.retailers === 1 ? "" : "s"}.
              {result.summary.staleOffersExcluded > 0 ? ` ${result.summary.staleOffersExcluded} older in-stock offer${result.summary.staleOffersExcluded === 1 ? " is" : "s are"} excluded from current-price ranking until refreshed.` : ""}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="comparison-heading" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Retailer comparison</p>
            <h2 id="comparison-heading" className="mt-2 text-2xl font-bold sm:text-3xl">Creatine prices and availability</h2>
          </div>
          <p className="text-sm text-zinc-600">
            {lastUpdated ? `Latest retailer check: ${lastUpdated}` : "No retailer check time is available."}
          </p>
        </div>

        {result.error && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h3 className="text-lg font-bold">The comparison is temporarily unavailable</h3>
            <p className="mt-2 text-zinc-700">We could not safely load current retailer pricing. No prices have been estimated or reused.</p>
            <Link href="/search?q=Creatine" className="mt-4 inline-flex font-semibold underline">Search Creatine products</Link>
          </div>
        )}

        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 text-center sm:p-8">
            <h3 className="text-xl font-bold">No Creatine products are available to compare</h3>
            <p className="mx-auto mt-2 max-w-2xl text-zinc-600">There are no active Creatine catalogue products to show right now. Try the broader search while retailer coverage is updated.</p>
            <Link href="/search?q=Creatine" className="mt-4 inline-flex font-semibold underline">Search Creatine</Link>
          </div>
        )}

        {!result.error && result.rows.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm" data-mobile-overflow="controlled">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <caption className="sr-only">Creatine supplement retailer and delivered-price comparison</caption>
              <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Product</th>
                  <th scope="col" className="px-4 py-3">Brand</th>
                  <th scope="col" className="px-4 py-3">Best available retailer</th>
                  <th scope="col" className="px-4 py-3">Product price</th>
                  <th scope="col" className="px-4 py-3">Delivered price</th>
                  <th scope="col" className="px-4 py-3">Retailer count</th>
                  <th scope="col" className="px-4 py-3">Cost per 5 g</th>
                  <th scope="col" className="px-4 py-3">Stock/status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Compare or view details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {result.rows.map((row) => {
                  const offer = row.bestOffer;
                  const checkedAt = formatCheckedAt(row.lastCheckedAt);

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-4"><ProductIdentity row={row} /></td>
                      <td className="px-4 py-4 font-medium">{row.brand || "Brand not stated"}</td>
                      <td className="px-4 py-4">{offer?.retailer?.name || "No retailer available"}</td>
                      <td className="px-4 py-4 font-semibold">{offer ? formatCurrency(offer.productPrice) : "Not available"}</td>
                      <td className="px-4 py-4">
                        {offer?.deliveredPrice ? (
                          <>
                            <span className="font-bold">{formatCurrency(offer.deliveredPrice.totalPrice)}</span>
                            <span className="mt-1 block text-xs text-zinc-600">Includes {offer.shippingCost === 0 ? "free delivery" : `${formatCurrency(offer.shippingCost || 0)} delivery`}</span>
                          </>
                        ) : (
                          <span>Delivery not known</span>
                        )}
                      </td>
                      <td className="px-4 py-4">{row.retailerCount} retailer{row.retailerCount === 1 ? "" : "s"}<span className="mt-1 block text-xs text-zinc-600">{row.offerCount} recently verified offer{row.offerCount === 1 ? "" : "s"}</span></td>
                      <td className="px-4 py-4 font-semibold">{row.verifiedCostPer5g === null ? "Not yet verified" : formatCurrency(row.verifiedCostPer5g)}</td>
                      <td className="px-4 py-4">
                        <span className={offer ? "font-semibold text-emerald-700" : "font-semibold text-zinc-600"}>{offer ? "Recently verified in stock" : "No recently verified offer"}</span>
                        <span className="mt-1 block text-xs text-zinc-600">{checkedAt ? `Checked ${checkedAt}` : "Check time unavailable"}</span>
                      </td>
                      <td className="px-4 py-4"><Link href={row.productUrl} className="inline-flex min-h-11 items-center rounded-lg bg-zinc-950 px-4 font-semibold text-white hover:bg-zinc-800">Compare details</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">How this creatine comparison works</h2>
            <p className="mt-3 leading-7 text-zinc-700">For each canonical product, we compare recently verified active in-stock retailer offers. Older offer prices are excluded from current-price ranking until they are refreshed. Offers with a known product price and delivery charge are ordered by total delivered price. An offer with unknown delivery cannot outrank an offer with a known delivered total.</p>
            <p className="mt-3 leading-7 text-zinc-700">Cost per 5 g uses the shared verified-pricing calculation. It requires verified unit pricing and nutrition data, positive creatine per serving, a known delivered price, and either verified servings or complete powder weight and serving-size data. Products that do not meet every requirement are marked “Not yet verified”.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Retailer data is checked when source updates are processed; we show the latest timestamp supplied by the qualifying offers rather than claiming a fixed update frequency.</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Data sources and freshness</h2>
            <p className="mt-3 leading-7 text-zinc-700">Offer prices, delivery charges, stock and check times come from retailer data mapped to SupplementScout’s reviewed canonical catalogue. Prices and availability can change after the displayed check time, so confirm the final amount and stock on the retailer’s site.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Some links may be affiliate links. This does not change the price you pay. <Link href="/affiliate-disclosure" className="font-semibold underline">Read our affiliate disclosure</Link> or <Link href="/contact" className="font-semibold underline">report incorrect product or price information</Link>.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div>
            <h2 className="text-2xl font-bold">Comparison limitations</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-zinc-700">
              <li>Missing product, delivery or nutrition data is not filled in by guessing.</li>
              <li>Cost per 5 g appears only when the required weight, serving and verification data is complete.</li>
              <li>A product listed by one retailer may not represent the full UK market.</li>
              <li>Different formulations, pack sizes and variants remain separate when their product identity requires it.</li>
            </ul>
          </div>
          <aside className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">Explore further</h2>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm">
              <Link href="/search?q=Creatine" className="font-semibold underline">Search all Creatine results</Link>
              <Link href="/about" className="font-semibold underline">About SupplementScout comparisons</Link>
              <Link href="/" className="font-semibold underline">Browse supplement categories</Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default async function CreatinePage() {
  const result = await getCreatineComparison();
  return <CreatinePageContent result={result} />;
}
