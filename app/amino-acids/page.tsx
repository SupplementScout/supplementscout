import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
} from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  evaluateAminoAcidsIndexability,
  getAminoAcidsComparison,
  type AminoAcidsComparisonResult,
  type AminoAcidsComparisonRow,
} from "../lib/aminoAcidsComparison";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/amino-acids";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current amino acid, BCAA and EAA prices from UK supplement retailers using recently checked offers and known delivery costs.";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getAminoAcidsComparison();
  const readiness = evaluateAminoAcidsIndexability(result.summary, true);
  const indexable = !result.error && readiness.indexable;

  return {
    title: "Compare Amino Acid, BCAA & EAA Prices UK",
    description,
    robots: { index: indexable, follow: true },
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Amino Acid, BCAA & EAA Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Amino Acid, BCAA & EAA Prices UK | SupplementScout",
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

function productFacts(row: AminoAcidsComparisonRow) {
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

export function buildAminoAcidsStructuredData(
  rows: AminoAcidsComparisonRow[]
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
        name: "Compare Amino Acid, BCAA & EAA Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Amino acid, BCAA and EAA products with recently checked UK offers",
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
            name: "Amino Acids, BCAA and EAA",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function AminoAcidsProductCard({
  row,
  position,
}: {
  row: AminoAcidsComparisonRow;
  position: number;
}) {
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
                  <dd className="font-semibold">{formatCurrency(row.pricePerKg)}</dd>
                </div>
              )}
              {row.pricePerServing !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Delivered price / serving</dt>
                  <dd className="font-semibold">{formatUnitPrice(row.pricePerServing)}</dd>
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

export function AminoAcidsPageContent({
  result,
}: {
  result: AminoAcidsComparisonResult;
}) {
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildAminoAcidsStructuredData(result.rows);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics
        category="Amino Acids"
        sourcePage="amino_acids_comparison"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">SupplementScout</Link>
          <Link href="/search?q=amino%20acids" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">
            Search amino acids
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Amino Acids, BCAA and EAA</li>
          </ol>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">UK retailer price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Amino Acid, BCAA &amp; EAA Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Compare recently checked offers for clearly identified amino acid,
            BCAA and EAA products. We use known delivery costs when available
            and do not infer ingredients, servings or suitability from unclear names.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} recently checked offers from {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have offers from multiple retailers.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Current comparison</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Amino acid prices and retailer coverage</h2>
          </div>
          <p className="text-sm text-zinc-600">{latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}</p>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Products with broader retailer coverage appear first. This is a
          coverage-first price comparison, not a ranking of formulation,
          effectiveness or suitability.
        </p>

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">Current amino acid data is temporarily unavailable</h2>
            <p className="mt-2 text-zinc-700">No old prices have been substituted.</p>
            <Link href="/search?q=amino%20acids" className="mt-4 inline-flex font-semibold underline">Search amino acids</Link>
          </div>
        )}
        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No recently checked amino acid offers</h2>
            <p className="mt-2 text-zinc-600">Older prices remain hidden until retailer data is checked again.</p>
          </div>
        )}
        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => (
              <AminoAcidsProductCard key={row.id} row={row} position={index + 1} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Reviewed inclusion boundary</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              A product must be active in the reviewed Amino Acids category and
              its canonical name must explicitly identify amino acids, BCAA,
              EAA or a named amino-acid ingredient. Opaque blends, bundles,
              NAC, 5-HTP and glutathione products are excluded rather than guessed.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">How prices are compared</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Only mapped, in-stock offers checked within 24 hours are shown.
              Known delivered totals are compared first; missing delivery is
              disclosed and never estimated. Verified unit values appear only
              when the required package or serving data is available.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {result.summary.staleOrUnusableOffersExcluded} older or unusable in-stock offer{result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} excluded. Confirm the final price and stock with the retailer.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">Amino acid comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Are BCAA and EAA products included?</h3><p className="mt-2 leading-7 text-zinc-700">Yes, when the reviewed canonical category and product name identify them clearly and a recently checked offer is available.</p></div>
          <div><h3 className="font-bold">Are all products directly equivalent?</h3><p className="mt-2 leading-7 text-zinc-700">No. The page includes blends and single-ingredient products in different formats. Compare the current label, pack size and directions before choosing.</p></div>
          <div><h3 className="font-bold">Does the first result mean the best product?</h3><p className="mt-2 leading-7 text-zinc-700">No. Ordering favours current retailer coverage and then offer coverage. We do not rank effects or personal suitability.</p></div>
          <div><h3 className="font-bold">Why can a value calculation be missing?</h3><p className="mt-2 leading-7 text-zinc-700">A price may be current while package or serving data is incomplete. Unverified per-kilogram or per-serving values stay hidden.</p></div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">Related comparisons and information</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link>
            <Link href="/pre-workout" className="font-semibold underline">Pre Workout comparison</Link>
            <Link href="/hydration" className="font-semibold underline">Hydration comparison</Link>
            <Link href="/creatine" className="font-semibold underline">Creatine comparison</Link>
            <Link href="/search?q=amino%20acids" className="font-semibold underline">Search amino acid products</Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          We only feature this comparison in search when it includes enough recently checked offers from multiple UK retailers. If coverage is temporarily limited, you can still use the page, but we will not present it as a complete market comparison.
        </p>
      </section>
    </main>
  );
}

export default async function AminoAcidsPage() {
  const result = await getAminoAcidsComparison();
  return <AminoAcidsPageContent result={result} />;
}
