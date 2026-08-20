import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
} from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import { formatCurrency, formatUnitPrice } from "../lib/pricing";
import {
  evaluateVeganProteinIndexability,
  getVeganProteinComparison,
  type VeganProteinComparisonResult,
  type VeganProteinComparisonRow,
} from "../lib/veganProteinComparison";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/vegan-protein";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Vegan Protein prices from UK supplement retailers using recently checked offers, known delivery and verified value metrics.";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getVeganProteinComparison();
  const readiness = evaluateVeganProteinIndexability(result.summary, true);
  const indexable = !result.error && readiness.indexable;

  return {
    title: "Compare Vegan Protein Prices UK",
    description,
    robots: { index: indexable, follow: true },
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Vegan Protein Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Vegan Protein Prices UK | SupplementScout",
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

export function buildVeganProteinStructuredData(
  rows: VeganProteinComparisonRow[]
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
        name: "Compare Vegan Protein Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Vegan Protein powders with recently checked UK retailer offers",
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
            name: "Vegan Protein",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function VeganProteinProductCard({
  row,
  position,
}: {
  row: VeganProteinComparisonRow;
  position: number;
}) {
  const retailerNames = [...new Set(row.offers.map((offer) => offer.retailer.name))];
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;

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
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>
        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {row.retailerCount >= 2 ? "Lowest current delivered price" : "Current available price"}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{formatCurrency(displayedPrice)}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {row.bestOffer.deliveredPrice ? "Includes known delivery" : "Product price; delivery not known"}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-700">Available at {row.bestOffer.retailer.name}</p>
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

export function VeganProteinPageContent({
  result,
}: {
  result: VeganProteinComparisonResult;
}) {
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const jsonLd = buildVeganProteinStructuredData(result.rows);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Vegan Protein" sourcePage="vegan_protein_comparison" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-bold">SupplementScout</Link>
          <Link href="/search?q=vegan%20protein" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">Search Vegan Protein</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2"><li><Link href="/">Home</Link></li><li aria-hidden="true">/</li><li aria-current="page">Vegan Protein</li></ol>
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">UK retailer price comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare Vegan Protein Prices UK</h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg">
            Compare recently checked offers for clearly identified vegan and plant-based protein powders. Known delivery is included when available; missing delivery, serving and nutrition values are never estimated.
          </p>
          {!result.error && <p className="mt-4 text-sm leading-6 text-zinc-600">Current coverage: {result.summary.visibleProducts} products, {result.summary.freshOffers} fresh offers and {result.summary.freshRetailers} retailers. {result.summary.productsWithMultipleFreshRetailers} products currently have multiple retailers.</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-bold">Current Vegan Protein comparison</h2><p className="text-sm text-zinc-600">{latestCheck ? `Latest retailer check: ${latestCheck}` : "No current check time available"}</p></div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">Products with broader retailer coverage appear first. This is a coverage-first price comparison, not a ranking of taste, formulation, effectiveness or suitability.</p>
        {result.error && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold">Current Vegan Protein data is temporarily unavailable</h2><p className="mt-2">No old prices have been substituted.</p></div>}
        {!result.error && result.rows.length === 0 && <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">No recently checked Vegan Protein offers</h2><p className="mt-2 text-zinc-600">Older prices remain hidden until retailer data is checked again.</p></div>}
        {result.rows.length > 0 && <div className="mt-6 space-y-4">{result.rows.map((row, index) => <VeganProteinProductCard key={row.id} row={row} position={index + 1} />)}</div>}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div><h2 className="text-2xl font-bold">Reviewed inclusion boundary</h2><p className="mt-3 leading-7 text-zinc-700">A canonical product name must explicitly identify vegan, plant-based, pea, rice or hemp protein. Bars, bites, cookies, snacks, drinks, meals and other food formats are excluded. Any whey, casein, collagen, beef, egg or milk-protein conflict in the canonical or retailer label excludes the product rather than guessing.</p></div>
          <div><h2 className="text-2xl font-bold">How current prices work</h2><p className="mt-3 leading-7 text-zinc-700">Only mapped, in-stock offers checked within 24 hours are shown. Known delivered totals rank ahead of offers with unknown delivery. Verified per-kilogram, serving and protein metrics appear only when the required evidence is available.</p><p className="mt-3 text-sm leading-6 text-zinc-600">{result.summary.staleOrUnusableOffersExcluded} older or unusable in-stock offer{result.summary.staleOrUnusableOffersExcluded === 1 ? " is" : "s are"} excluded. Confirm final price and stock with the retailer.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold">Vegan Protein comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div><h3 className="font-bold">Are protein bars included?</h3><p className="mt-2 leading-7 text-zinc-700">No. This comparison is limited to explicit plant-protein powder identities, so bars and other snack products are kept separate.</p></div>
          <div><h3 className="font-bold">Does vegan mean every product is equivalent?</h3><p className="mt-2 leading-7 text-zinc-700">No. Protein sources, flavours, pack sizes and labels differ. Check the retailer label and product details before choosing.</p></div>
          <div><h3 className="font-bold">Does the first result mean the best product?</h3><p className="mt-2 leading-7 text-zinc-700">No. Ordering favours current retailer coverage and offer coverage. We do not make an unsupported quality or health ranking.</p></div>
          <div><h3 className="font-bold">Why can a value calculation be missing?</h3><p className="mt-2 leading-7 text-zinc-700">A price may be current while package, serving or nutrition evidence is incomplete. Unverified calculations remain hidden.</p></div>
        </div>
        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-bold">Related comparisons and information</h2><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/whey-protein" className="font-semibold underline">Whey Protein comparison</Link><Link href="/whey-isolate" className="font-semibold underline">Whey Isolate comparison</Link><Link href="/amino-acids" className="font-semibold underline">Amino Acids comparison</Link><Link href="/search?q=vegan%20protein" className="font-semibold underline">Search Vegan Protein</Link><ComparisonTransparencyLinks /></div></aside>
        <p className="mt-8 text-xs leading-5 text-zinc-500">We only feature this comparison in search when it includes enough recently checked offers from multiple UK retailers. If coverage is temporarily limited, you can still use the page, but we will not present it as a complete market comparison.</p>
      </section>
    </main>
  );
}

export default async function VeganProteinPage() {
  const result = await getVeganProteinComparison();
  return <VeganProteinPageContent result={result} />;
}
