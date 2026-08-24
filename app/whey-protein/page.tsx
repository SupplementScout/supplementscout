import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import {
  ComparisonProductThumbnail,
  OfferCheckedBadge,
} from "../components/ComparisonProductVisuals";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import {
  evaluateWheyIndexability,
  getWheyComparison,
  type WheyComparisonResult,
  type WheyComparisonRow,
} from "../lib/wheyComparison";
import {
  formatCurrency,
  formatUnitPrice,
} from "../lib/pricing";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/whey-protein";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare current Whey Protein prices from UK supplement retailers, including known delivery, retailer coverage and verified value metrics.";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getWheyComparison();
  const readiness = evaluateWheyIndexability(result.summary, true);
  const indexable = !result.error && readiness.indexable;

  return {
    title: "Compare Whey Protein Prices UK",
    description,
    robots: { index: indexable, follow: true },
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Whey Protein Prices UK | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Compare Whey Protein Prices UK | SupplementScout",
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

function productFacts(row: WheyComparisonRow) {
  return [
    row.netWeightG
      ? `${row.netWeightG.toLocaleString("en-GB")} g`
      : null,
    row.verifiedServingCount
      ? `${row.verifiedServingCount.toLocaleString("en-GB")} verified servings`
      : null,
    row.nutritionVerified && row.proteinPerServingG
      ? `${row.proteinPerServingG.toLocaleString("en-GB")} g verified protein per serving`
      : null,
  ].filter((value): value is string => Boolean(value));
}

export function buildWheyStructuredData(rows: WheyComparisonRow[]) {
  const itemListId = `${pageUrl}#products`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Compare Whey Protein Prices UK",
        description,
        mainEntity: { "@id": itemListId },
        breadcrumb: { "@id": breadcrumbId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: "Whey Protein products with recently checked UK retailer offers",
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
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Whey Protein",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function WheyProductCard({
  row,
  position,
}: {
  row: WheyComparisonRow;
  position: number;
}) {
  const facts = productFacts(row);
  const retailerNames = [
    ...new Set(row.offers.map((offer) => offer.retailer.name)),
  ];
  const displayedPrice =
    row.bestOffer.deliveredPrice?.totalPrice ?? row.bestOffer.productPrice;
  const hasComparison = row.retailerCount >= 2;

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
            <h3 className="mt-2 break-words text-xl font-bold text-zinc-950 hover:underline">
              {row.name}
            </h3>
          </Link>
          {facts.length > 0 && (
            <p className="mt-2 text-sm text-zinc-600">
              {facts.join(" · ")}
            </p>
          )}
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {row.offerCount} recently checked in-stock offer
            {row.offerCount === 1 ? "" : "s"} from{" "}
            {retailerNames.join(", ")}.
          </p>
          <OfferCheckedBadge checkedAt={row.lastCheckedAt} />
        </div>

        <div className="col-span-2 w-full shrink-0 rounded-xl bg-zinc-50 p-4 lg:col-span-1 lg:w-80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            {hasComparison
              ? "Lowest current delivered price"
              : "Current available price"}
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

          {(row.pricePerKg !== null ||
            row.pricePerServing !== null ||
            row.costPer25gProtein !== null) && (
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
              {row.costPer25gProtein !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">Cost / 25 g protein</dt>
                  <dd className="font-semibold">
                    {formatCurrency(row.costPer25gProtein)}
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

export function WheyProteinPageContent({
  result,
}: {
  result: WheyComparisonResult;
}) {
  const jsonLd = buildWheyStructuredData(result.rows);
  const latestCheck = formatCheckedAt(result.summary.latestOfferCheckedAt);
  const lowestDeliveredRow = result.rows.reduce<WheyComparisonRow | null>(
    (lowest, row) => {
      const total = row.bestOffer.deliveredPrice?.totalPrice;
      const lowestTotal = lowest?.bestOffer.deliveredPrice?.totalPrice;

      if (total === undefined || total === null) return lowest;
      if (lowestTotal === undefined || lowestTotal === null || total < lowestTotal) {
        return row;
      }
      return lowest;
    },
    null
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics
        category="Whey Protein"
        sourcePage="whey_protein_comparison"
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
            href="/search?q=whey%20protein"
            className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          >
            Search whey
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">Whey Protein</li>
          </ol>
        </nav>

        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            UK retailer price comparison
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compare Whey Protein Prices UK
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            Compare recently checked Whey Protein offers from UK supplement
            retailers. We show the lowest known delivered total for each
            product when delivery is available, without estimating missing
            prices or nutrition.
          </p>
          {!result.error && (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Current coverage: {result.summary.visibleProducts} Whey Protein
              product{result.summary.visibleProducts === 1 ? "" : "s"},{" "}
              {result.summary.freshOffers} recently checked offer
              {result.summary.freshOffers === 1 ? "" : "s"} from{" "}
              {result.summary.freshRetailers} retailer
              {result.summary.freshRetailers === 1 ? "" : "s"}.{" "}
              {result.summary.productsWithMultipleFreshRetailers} product
              {result.summary.productsWithMultipleFreshRetailers === 1
                ? " has"
                : "s have"}{" "}
              current offers from multiple retailers.
            </p>
          )}
        </div>
      </section>

      {lowestDeliveredRow?.bestOffer.deliveredPrice && (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12">
          <div className="max-w-4xl rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Quick price answer
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              What is the lowest current Whey Protein delivered price?
            </h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Across {result.summary.visibleProducts} Whey Protein products with
              recently checked offers, the lowest known delivered price is{" "}
              <strong>
                {formatCurrency(
                  lowestDeliveredRow.bestOffer.deliveredPrice.totalPrice
                )}
              </strong>{" "}
              for{" "}
              <Link
                href={lowestDeliveredRow.productUrl}
                className="font-semibold text-zinc-950 underline"
              >
                {lowestDeliveredRow.name}
              </Link>
              .
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This is the lowest recently checked total in SupplementScout&apos;s
              current retailer coverage, including known delivery costs. It is
              not a claim about every UK seller. Confirm the final price and
              stock with the retailer before buying.
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Current comparison
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Whey Protein prices and retailer coverage
            </h2>
          </div>
          <p className="text-sm text-zinc-600">
            {latestCheck
              ? `Latest retailer check: ${latestCheck}`
              : "No current check time available"}
          </p>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-zinc-600">
          Products with broader retailer coverage appear first. Within each
          product, recently checked offers are ordered by known delivered
          total. This is a coverage-first comparison, not a claim that the
          first product is nutritionally superior.
        </p>

        {result.error && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-xl font-bold">
              Current Whey Protein data is temporarily unavailable
            </h2>
            <p className="mt-2 text-zinc-700">
              No old prices have been substituted. Try the broader search
              while current retailer data is restored.
            </p>
            <Link
              href="/search?q=whey%20protein"
              className="mt-4 inline-flex font-semibold underline"
            >
              Search Whey Protein
            </Link>
          </div>
        )}

        {!result.error && result.rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              No recently checked Whey Protein offers
            </h2>
            <p className="mt-2 text-zinc-600">
              Older prices remain hidden until retailer data is checked again.
            </p>
          </div>
        )}

        {result.rows.length > 0 && (
          <div className="mt-6 space-y-4">
            {result.rows.map((row, index) => (
              <WheyProductCard
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
            <h2 className="text-2xl font-bold">How prices are compared</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              We use active, mapped, in-stock retailer offers checked within
              24 hours. Where both the product price and delivery charge are
              known, the delivered total decides the lowest current offer for
              that product. An offer with unknown delivery cannot outrank one
              with a complete delivered total.
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {result.summary.staleOrUnusableOffersExcluded} older or unusable
              in-stock offer
              {result.summary.staleOrUnusableOffersExcluded === 1
                ? " is"
                : "s are"}{" "}
              currently excluded. Prices and stock can change after the shown
              check time, so confirm the final amount at the retailer.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              When value metrics are shown
            </h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Price per kilogram and cost per 25 g of protein appear only when
              the required package, serving and nutrition fields have been
              reviewed and marked as verified. Missing information is left
              blank rather than estimated from a product name or retailer
              description.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold">Whey Protein comparison questions</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-bold">
              What is included in this comparison?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              The page covers reviewed Whey Protein powders and whey-based
              blends in the SupplementScout catalogue. Plant, beef, collagen,
              egg and casein-only products are excluded even if a retailer
              placed them in a broad protein category.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Are concentrate, isolate and clear whey the same?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              They are different product types and formulations. This page
              groups them as Whey Protein but keeps each canonical product and
              pack size separate so prices are not compared as if the products
              were identical.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Does the first product mean the best Whey Protein?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              No. The order favours products with more current retailer
              coverage. SupplementScout does not make a quality or health
              ranking without evidence that supports it.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              Why is a value calculation sometimes missing?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              A current price can be valid even when package or nutrition data
              is incomplete. We still show the retailer comparison but hide
              any per-kilogram, per-serving or protein calculation that cannot
              be verified safely.
            </p>
          </div>
          <div>
            <h3 className="font-bold">
              How often are prices checked?
            </h3>
            <p className="mt-2 leading-7 text-zinc-700">
              Only offers checked within the last 24 hours are eligible for
              this page. Each product shows its latest check time, and stale
              prices are removed from the current ranking.
            </p>
          </div>
        </div>

        <aside className="mt-10 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-bold">
            Related comparisons and information
          </h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/deals" className="font-semibold underline">
              Best supplement prices today
            </Link>
            <Link href="/creatine" className="font-semibold underline">
              Creatine comparison
            </Link>
            <Link href="/hydration" className="font-semibold underline">
              Hydration comparison
            </Link>
            <Link href="/pre-workout" className="font-semibold underline">
              Pre Workout comparison
            </Link>
            <Link href="/amino-acids" className="font-semibold underline">
              Amino Acids, BCAA and EAA comparison
            </Link>
            <Link href="/whey-isolate" className="font-semibold underline">
              Whey Isolate comparison
            </Link>
            <Link href="/vegan-protein" className="font-semibold underline">
              Vegan Protein comparison
            </Link>
            <Link href="/mass-gainer" className="font-semibold underline">
              Mass Gainer comparison
            </Link>
            <Link href="/protein-bars" className="font-semibold underline">
              Protein Bars comparison
            </Link>
            <Link
              href="/search?q=whey%20protein"
              className="font-semibold underline"
            >
              Search all protein products
            </Link>
            <Link href="/about" className="font-semibold underline">
              How SupplementScout works
            </Link>
            <ComparisonTransparencyLinks />
          </div>
        </aside>

        <p className="mt-8 text-xs leading-5 text-zinc-500">
          We only feature this comparison in search when it includes enough
          recently checked offers from multiple UK retailers. If coverage is
          temporarily limited, you can still use the page, but we will not
          present it as a complete market comparison.
        </p>
      </section>
    </main>
  );
}

export default async function WheyProteinPage() {
  const result = await getWheyComparison();
  return <WheyProteinPageContent result={result} />;
}
