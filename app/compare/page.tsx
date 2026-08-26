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
import { formatCurrency, formatUnitPrice } from "../lib/pricing";
import {
  getTwoProductComparison,
  normalizeComparisonProductId,
  selectTwoProducts,
  type TwoProductComparisonResult,
  type TwoProductComparisonRow,
} from "../lib/twoProductComparison";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = "/compare";
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare two supplement products side by side using recently checked UK prices, exact pack identity and verified nutrition metrics.";
const getCachedTwoProductComparison = createLifecycleDataLoader(
  pagePath,
  "two-product-comparison-v1",
  getTwoProductComparison
);

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<RouteSearchParams> };

export async function generateMetadata({
  searchParams,
}: PageProps = {}): Promise<Metadata> {
  const params = await (searchParams || Promise.resolve({}));
  return {
    title: "Compare Two Supplements Side by Side",
    description,
    robots: getLifecycleRobots(pagePath, params),
    alternates: { canonical: pagePath },
    openGraph: {
      title: "Compare Two Supplements | SupplementScout",
      description,
      url: pagePath,
      type: "website",
    },
  };
}

export function buildTwoProductComparisonStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: "Compare Two Supplements Side by Side",
        description,
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
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
            name: "Compare two supplements",
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

function ProductSelector({
  name,
  label,
  rows,
  selectedId,
}: {
  name: "left" | "right";
  label: string;
  rows: TwoProductComparisonRow[];
  selectedId: string | null;
}) {
  const options = [...rows].sort(
    (left, right) =>
      (left.brand || "").localeCompare(right.brand || "") ||
      left.name.localeCompare(right.name) ||
      left.exactPackLabel.localeCompare(right.exactPackLabel)
  );
  return (
    <label className="block">
      <span className="text-sm font-bold text-zinc-800">{label}</span>
      <select
        name={name}
        defaultValue={selectedId || ""}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950"
      >
        <option value="">Choose a product</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {[row.brand, row.name, row.exactVariantLabel]
              .filter(Boolean)
              .join(" - ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-zinc-950">{value}</dd>
    </div>
  );
}

function ComparisonCard({ row }: { row: TwoProductComparisonRow }) {
  const delivered = row.bestOffer.deliveredPrice;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <ComparisonProductThumbnail
          image={row.image}
          name={row.name}
          productUrl={row.productUrl}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {row.brand || "Brand unavailable"}
          </p>
          <Link href={row.productUrl}>
            <h2 className="mt-2 break-words text-xl font-bold hover:underline sm:text-2xl">
              {row.name}
            </h2>
          </Link>
          <p className="mt-2 text-sm font-semibold text-zinc-700">
            Exact variant: {row.exactVariantLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Lowest known delivered total
        </p>
        <p className="mt-1 text-3xl font-black">
          {delivered ? formatCurrency(delivered.totalPrice) : "Unavailable"}
        </p>
        {delivered && (
          <p className="mt-1 text-sm text-zinc-600">
            {formatCurrency(delivered.productPrice)} product + {formatCurrency(delivered.shippingCost)} delivery
          </p>
        )}
        <p className="mt-3 text-sm text-zinc-700">
          From {row.bestOffer.retailer.name}; {row.offerCount} current offer
          {row.offerCount === 1 ? "" : "s"} across {row.retailerCount} retailer
          {row.retailerCount === 1 ? "" : "s"}.
        </p>
        <OfferCheckedBadge checkedAt={row.bestOffer.lastCheckedAt} />
        <a
          href={`/go/${row.bestOffer.id}?source=two_product_comparison`}
          rel="sponsored nofollow"
          className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
        >
          Check retailer price
        </a>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Exact pack" value={row.exactPackLabel} />
        {row.verifiedServingCount !== null && (
          <Metric label="Verified servings" value={String(row.verifiedServingCount)} />
        )}
        {row.proteinPerServingG !== null && (
          <Metric label="Protein per serving" value={`${row.proteinPerServingG}g`} />
        )}
        {row.pricePerServing !== null && (
          <Metric label="Delivered price per serving" value={formatUnitPrice(row.pricePerServing)} />
        )}
        {row.pricePerKg !== null && (
          <Metric label="Delivered price per kg" value={formatCurrency(row.pricePerKg)} />
        )}
        {row.costPer25gProtein !== null && (
          <Metric label="Delivered cost per 25g protein" value={formatCurrency(row.costPer25gProtein)} />
        )}
      </dl>
    </article>
  );
}

function SelectionMessage({ state }: { state: string }) {
  if (state === "partial") return <p>Select the second product to compare.</p>;
  if (state === "duplicate") return <p>Choose two different products.</p>;
  if (state === "not_found") {
    return <p>One selection is not currently eligible. Choose again from the verified list.</p>;
  }
  return <p>Choose two products to see their current evidence side by side.</p>;
}

export function TwoProductComparisonPageContent({
  result,
  params,
}: {
  result: TwoProductComparisonResult;
  params: RouteSearchParams;
}) {
  const leftId = normalizeComparisonProductId(params.left);
  const rightId = normalizeComparisonProductId(params.right);
  const selection = selectTwoProducts(result.rows, leftId, rightId);
  const jsonLd = buildTwoProductComparisonStructuredData();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <CategoryViewAnalytics category="Two product comparison" sourcePage="two_product_comparison" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-bold">SupplementScout</Link>
          <Link href="/search" className="text-sm font-semibold hover:underline">Search products</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <Link href="/" className="hover:underline">Home</Link> / Compare
        </nav>
        <div className="mt-6 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Evidence-based comparison</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare two supplements side by side</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-700">
            Compare recently checked delivered prices, exact pack identity and verified nutrition fields. Missing evidence stays hidden and no product is declared a winner.
          </p>
        </div>

        <form action={pagePath} method="get" className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <ProductSelector name="left" label="First product" rows={result.rows} selectedId={leftId} />
            <ProductSelector name="right" label="Second product" rows={result.rows} selectedId={rightId} />
          </div>
          <button type="submit" className="mt-5 rounded-lg bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700">Compare products</button>
          <p className="mt-3 text-sm text-zinc-600">
            {result.rows.length} products currently have a fresh offer, known delivery and complete exact-pack evidence.
            When several exact variants qualify, the selector uses one variant
            consistently, prioritising broader current retailer coverage.
          </p>
        </form>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        {result.rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-bold">No eligible products right now</h2>
            <p className="mt-2 text-zinc-600">Older, incomplete or identity-unresolved offers remain excluded.</p>
          </div>
        ) : selection.state === "ready" && selection.left && selection.right ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonCard row={selection.left} />
            <ComparisonCard row={selection.right} />
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-zinc-700">
            <SelectionMessage state={selection.state} />
          </div>
        )}
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What qualifies?</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              A product must be active and unmerged, with an in-stock offer checked within 24 hours, known delivery and an active canonical variant containing explicit pack count, size and unit.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">What the comparison does not claim</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Price does not establish quality, effectiveness or suitability. Verify the retailer total and product label before buying or using a supplement.
            </p>
          </div>
        </div>
      </section>

      <aside className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h2 className="text-xl font-bold">Comparison information</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm"><ComparisonTransparencyLinks /></div>
      </aside>
    </main>
  );
}

export default async function TwoProductComparisonPage({
  searchParams,
}: PageProps = {}) {
  const params = await (searchParams || Promise.resolve({}));
  const result = await getCachedTwoProductComparison();
  assertLifecycleDataAvailable(result, pagePath);
  return <TwoProductComparisonPageContent result={result} params={params} />;
}
