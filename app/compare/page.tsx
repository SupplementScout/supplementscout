import type { Metadata } from "next";
import Link from "next/link";
import CategoryViewAnalytics from "../components/CategoryViewAnalytics";
import ComparisonCompletionAnalytics from "../components/ComparisonCompletionAnalytics";
import {
  ComparisonProductHeroImage,
  OfferCheckedBadge,
} from "../components/ComparisonProductVisuals";
import SearchableComparisonSelectors from "../components/SearchableComparisonSelectors";
import ComparisonTransparencyLinks from "../components/ComparisonTransparencyLinks";
import StatusBadge from "../components/StatusBadge";
import SupplementScoutIcon from "../components/SupplementScoutIcon";
import {
  assertLifecycleDataAvailable,
  getLifecycleRobots,
  type RouteSearchParams,
} from "../lib/indexabilityLifecycle";
import { createLifecycleDataLoader } from "../lib/lifecycleDataCache";
import { OFFER_PRESENTATION_LABELS } from "../lib/offerFreshness";
import { comparisonProductHref } from "../lib/comparisonProductLinks";
import {
  COMPARISON_PATH,
  comparisonHref,
  sortComparisonSelectorOptions,
} from "../lib/comparisonSelector";
import { buildBestOfferPricePresentation } from "../lib/productOfferPresentation";
import {
  buildProductComparisonMetrics,
  buildQuickComparisonVerdict,
  isCrossCategoryComparison,
  type ProductComparisonMetric,
} from "../lib/productComparisonMetrics";
import {
  getTwoProductComparison,
  getTwoProductPriceHistory,
  normalizeComparisonProductId,
  selectTwoProducts,
  type TwoProductComparisonResult,
  type TwoProductComparisonRow,
  type TwoProductPriceHistory,
} from "../lib/twoProductComparison";

const siteUrl = "https://www.supplementscout.co.uk";
const pagePath = COMPARISON_PATH;
const pageUrl = `${siteUrl}${pagePath}`;
const description =
  "Compare two supplement products side by side using recently checked UK prices, exact pack identity and verified nutrition metrics.";
const getCachedTwoProductComparison = createLifecycleDataLoader(
  pagePath,
  "two-product-comparison-v2",
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

function SelectionMessage({
  state,
  selectedCount,
}: {
  state: string;
  selectedCount: number;
}) {
  if (state === "invalid") {
    return <p>An invalid product selection was ignored. Choose from the current list.</p>;
  }
  if (state === "partial") {
    return <p>{selectedCount} of 2 selected. Choose the second product to compare.</p>;
  }
  if (state === "duplicate") {
    return <p>Choose two different products. A product cannot be compared with itself.</p>;
  }
  if (state === "not_found") {
    return <p>One selection is no longer available. Choose again from the current list.</p>;
  }
  if (state === "ready") {
    return <p>2 of 2 selected. Change either product to replace it, or compare below.</p>;
  }
  return <p>0 of 2 selected. Choose two products to start a comparison.</p>;
}

function ComparisonIdentityCard({
  row,
  productLabel,
}: {
  row: TwoProductComparisonRow;
  productLabel: "Product A" | "Product B";
}) {
  const productHref = comparisonProductHref(row.productUrl, row.exactVariantId);
  const offersHref = comparisonProductHref(
    row.productUrl,
    row.exactVariantId,
    "retailer-offers"
  );
  const deliveryComparisonComplete =
    row.offers.length > 0 &&
    row.offers.every((offer) => offer.deliveredPrice !== null);
  const price = row.bestOffer
    ? buildBestOfferPricePresentation({
        price: row.bestOffer.productPrice,
        shipping_cost: row.bestOffer.shippingCost,
      }, {
        deliveryComparisonComplete,
      })
    : null;

  return (
    <article className="ss-card flex min-w-0 flex-col overflow-hidden p-3 sm:p-5 lg:p-6">
      <StatusBadge tone="comparison" className="self-start">
        {productLabel}
      </StatusBadge>
      <div className="mt-3">
        <ComparisonProductHeroImage
          image={row.image}
          name={row.name}
          productUrl={productHref}
        />
      </div>
      <p className="mt-4 break-words text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">
        {row.brand || "Brand not stated"}
      </p>
      <Link href={productHref} className="block min-w-0">
        <h2 className="mt-1.5 break-words text-base font-bold leading-snug text-[var(--ss-ink)] hover:underline sm:text-xl">
          {row.name}
        </h2>
      </Link>
      <p className="mt-2 break-words text-xs font-semibold leading-5 text-zinc-600 sm:text-sm">
        {row.exactVariantLabel
          ? `Selected variant: ${row.exactVariantLabel}`
          : "Exact variant unavailable"}
      </p>

      <div className="mt-4 border-t border-zinc-200 pt-4">
        {price && row.bestOffer ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">
              {price.label}
            </p>
            <p className="mt-1.5 break-words text-2xl font-extrabold tracking-[-0.035em] text-[var(--ss-ink)] sm:text-3xl">
              {price.primaryPrice}
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-zinc-700 sm:text-sm">
              {price.breakdown}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-600 sm:text-sm">
              {row.bestOffer.retailer.name} · {row.retailerCount} current retailer
              {row.retailerCount === 1 ? "" : "s"}
            </p>
            <OfferCheckedBadge checkedAt={row.bestOffer.lastCheckedAt} />
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-[var(--ss-ink)]">
              {OFFER_PRESENTATION_LABELS[row.presentationState]}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-600 sm:text-sm">
              No stale price is shown as current.
              {row.observedRetailerCount > 0
                ? ` Evidence exists from ${row.observedRetailerCount} retailer${
                    row.observedRetailerCount === 1 ? "" : "s"
                  }.`
                : ""}
            </p>
          </>
        )}
      </div>

      <Link
        href={offersHref}
        className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--ss-border-strong)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--ss-ink)] hover:bg-[var(--ss-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
      >
        View offers
        <SupplementScoutIcon name="store" size={16} />
      </Link>
    </article>
  );
}

function MetricValue({
  metric,
  side,
}: {
  metric: ProductComparisonMetric;
  side: "left" | "right";
}) {
  const value = metric[side];
  const isWinner = metric.outcome === side;
  return (
    <dd
      className={`min-w-0 rounded-xl border p-3 sm:p-4 ${
        isWinner
          ? "border-[#b9d8c6] bg-[#edf5f0]"
          : "border-[var(--ss-border)] bg-white"
      }`}
    >
      <span className="sr-only">{side === "left" ? "Product A" : "Product B"}: </span>
      <span className="block break-words text-sm font-bold text-[var(--ss-ink)] sm:text-base">
        {value?.display || "Not available"}
      </span>
      {isWinner && metric.winnerLabel && (
        <StatusBadge tone="availability" icon="check" className="mt-2">
          {metric.winnerLabel}
        </StatusBadge>
      )}
      {metric.outcome === "tie" && metric.tieLabel && (
        <StatusBadge tone="neutral" className="mt-2">
          {metric.tieLabel}
        </StatusBadge>
      )}
    </dd>
  );
}

function MetricSection({
  title,
  eyebrow,
  metrics,
}: {
  title: string;
  eyebrow: string;
  metrics: ProductComparisonMetric[];
}) {
  if (metrics.length === 0) return null;
  return (
    <section className="ss-card overflow-hidden p-4 sm:p-6 lg:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ss-accent)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-[var(--ss-ink)]">{title}</h2>
      <dl className="mt-5 divide-y divide-[var(--ss-border)]">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="grid min-w-0 grid-cols-2 gap-2 py-4 first:pt-0 last:pb-0 sm:gap-3 md:grid-cols-[minmax(11rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start"
          >
            <dt className="col-span-2 min-w-0 pb-1 md:col-span-1 md:pb-0 md:pr-4">
              <span className="block text-sm font-bold text-[var(--ss-ink)]">
                {metric.label}
              </span>
              {metric.explanation && (
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {metric.explanation}
                </span>
              )}
            </dt>
            <MetricValue metric={metric} side="left" />
            <MetricValue metric={metric} side="right" />
          </div>
        ))}
      </dl>
    </section>
  );
}

function VerdictCard({
  label,
  name,
  reasons,
}: {
  label: string;
  name: string;
  reasons: string[];
}) {
  return (
    <article className="rounded-2xl border border-[#cfe1d6] bg-white p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--ss-accent)]">
        {label}
      </p>
      <h3 className="mt-2 break-words text-lg font-bold text-[var(--ss-ink)]">
        {name}
      </h3>
      {reasons.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-700">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <SupplementScoutIcon
                name="check"
                size={16}
                className="mt-1 shrink-0 text-[var(--ss-accent)]"
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          No distinct advantage is supported by the comparable metrics shown.
        </p>
      )}
    </article>
  );
}

function QuickVerdict({
  left,
  right,
  metrics,
}: {
  left: TwoProductComparisonRow;
  right: TwoProductComparisonRow;
  metrics: ProductComparisonMetric[];
}) {
  const verdict = buildQuickComparisonVerdict(metrics);
  return (
    <section className="rounded-3xl border border-[#cfe1d6] bg-[#edf5f0] p-5 sm:p-7 lg:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ss-accent)]">
        Quick comparison
      </p>
      <h2 className="mt-2 text-2xl font-bold text-[var(--ss-ink)] sm:text-3xl">
        Best fit by measurable priority
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700 sm:text-base">
        These are factual differences from the rows below, not an overall score or a quality recommendation.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <VerdictCard
          label={verdict.left.length > 0
            ? "Choose Product A if your priority is"
            : "No clear measurable advantage"}
          name={left.name}
          reasons={verdict.left}
        />
        <VerdictCard
          label={verdict.right.length > 0
            ? "Choose Product B if your priority is"
            : "No clear measurable advantage"}
          name={right.name}
          reasons={verdict.right}
        />
      </div>
    </section>
  );
}

export function TwoProductComparisonPageContent({
  result,
  params,
  priceHistory = {},
}: {
  result: TwoProductComparisonResult;
  params: RouteSearchParams;
  priceHistory?: TwoProductPriceHistory;
}) {
  const leftId = normalizeComparisonProductId(params.left);
  const rightId = normalizeComparisonProductId(params.right);
  const invalidSelection =
    (params.left !== undefined && leftId === null) ||
    (params.right !== undefined && rightId === null);
  const selection = selectTwoProducts(result.rows, leftId, rightId);
  const state = invalidSelection ? "invalid" : selection.state;
  const selectedCount = Number(Boolean(leftId)) + Number(Boolean(rightId));
  const selectedIds = new Set([leftId, rightId].filter(Boolean));
  const selectableRows = result.rows.filter(
    (row) =>
      (row.bestOffer !== null && row.exactVariantLabel !== null) ||
      selectedIds.has(row.id)
  );
  const selectorOptions = sortComparisonSelectorOptions(
    selectableRows.map((row) => ({
      id: row.id,
      brand: row.brand,
      name: row.name,
      exactVariantLabel: row.exactVariantLabel,
      exactPackLabel: row.exactPackLabel,
    }))
  );
  const metrics = selection.state === "ready" && selection.left && selection.right
    ? buildProductComparisonMetrics(selection.left, selection.right, priceHistory)
    : [];
  const jsonLd = buildTwoProductComparisonStructuredData();

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--ss-page)] pb-28 text-[var(--ss-ink)]">
      <CategoryViewAnalytics category="Two product comparison" sourcePage="two_product_comparison" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="border-b border-[var(--ss-border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:min-h-20 sm:px-6">
          <Link href="/" className="text-lg font-extrabold tracking-[-0.03em] sm:text-xl">
            SupplementScout
          </Link>
          <nav aria-label="Comparison navigation" className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/search" className="hover:underline">Search</Link>
            <Link href="/deals" className="hidden hover:underline sm:inline">Deals</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
          <Link href="/" className="hover:underline">Home</Link> / Compare products
        </nav>
        <div className="mt-6 max-w-4xl">
          <StatusBadge tone="evidence" icon="shield">
            Decision-first product comparison
          </StatusBadge>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl lg:text-6xl">
            Compare two supplements side by side
          </h1>
          <p className="mt-5 text-base leading-7 text-zinc-700 sm:text-lg sm:leading-8">
            See current product and delivery prices, verified unit costs, exact pack sizes and evidence-backed supplement facts. No overall score and no invented data.
          </p>
        </div>

        <section
          id="comparison-selection"
          className="ss-card mt-8 scroll-mt-4 p-5 sm:p-6"
        >
          <div className="flex flex-col gap-2 border-b border-[var(--ss-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Choose two products</h2>
              <div aria-live="polite" className="mt-1 text-sm text-zinc-600">
                <SelectionMessage state={state} selectedCount={selectedCount} />
              </div>
            </div>
            <p className="text-xs font-semibold text-zinc-500">
              {selectableRows.length} current exact variants available
            </p>
          </div>
          <div className="mt-5">
            <SearchableComparisonSelectors
              options={selectorOptions}
              leftId={leftId}
              rightId={rightId}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {(leftId || rightId) && (
              <Link
                href={pagePath}
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--ss-border-strong)] px-4 text-sm font-semibold hover:bg-[var(--ss-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
              >
                Clear comparison
              </Link>
            )}
            {leftId && (
              <Link href={comparisonHref(rightId)} className="text-sm font-semibold text-zinc-600 underline underline-offset-4">
                Remove Product A
              </Link>
            )}
            {rightId && (
              <Link href={comparisonHref(leftId)} className="text-sm font-semibold text-zinc-600 underline underline-offset-4">
                Remove Product B
              </Link>
            )}
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Selecting a search result updates the URL with both product IDs, so this comparison remains reload-safe and shareable.
          </p>
        </section>
      </section>

      <section className="mx-auto max-w-7xl space-y-5 px-4 pb-12 sm:px-6">
        {result.rows.length === 0 ? (
          <div className="ss-card p-6">
            <h2 className="text-xl font-bold">No products are available right now</h2>
            <p className="mt-2 text-zinc-600">The complete comparison catalogue could not find a safe current selection.</p>
          </div>
        ) : selection.state === "ready" && selection.left && selection.right ? (
          <>
            <ComparisonCompletionAnalytics
              leftProductId={selection.left.id}
              rightProductId={selection.right.id}
            />
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
              <ComparisonIdentityCard row={selection.left} productLabel="Product A" />
              <ComparisonIdentityCard row={selection.right} productLabel="Product B" />
            </div>

            {isCrossCategoryComparison(selection.left, selection.right) && (
              <div className="rounded-2xl border border-[var(--ss-border-strong)] bg-white p-4 text-sm leading-6 text-zinc-700">
                These products are in different supplement categories. Universal price, pack and availability evidence is shown; category-specific ingredients are not ranked against each other.
              </div>
            )}

            <QuickVerdict left={selection.left} right={selection.right} metrics={metrics} />
            <MetricSection
              eyebrow="Price and availability"
              title="What you would pay"
              metrics={metrics.filter((metric) => metric.section === "price")}
            />
            <MetricSection
              eyebrow="Exact variant context"
              title="Pack and servings"
              metrics={metrics.filter((metric) => metric.section === "pack")}
            />
            <MetricSection
              eyebrow="Verified supplement facts"
              title="Relevant ingredient differences"
              metrics={metrics.filter((metric) => metric.section === "supplement")}
            />
          </>
        ) : (
          <div className="ss-card p-6 text-zinc-700">
            <SelectionMessage state={state} selectedCount={selectedCount} />
          </div>
        )}
      </section>

      <section className="border-y border-[var(--ss-border)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What counts as current?</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              Current prices require an in-stock retailer offer checked within 24 hours. Exact variant and pack evidence is kept visible, while missing delivery or nutrition data stays explicitly unavailable.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold">What this comparison does not claim</h2>
            <p className="mt-3 leading-7 text-zinc-700">
              A lower price or a larger measured amount does not establish overall quality, effectiveness or suitability. Check the retailer total and product label before buying or using a supplement.
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
  const params: RouteSearchParams = await (
    searchParams || Promise.resolve({} as RouteSearchParams)
  );
  const result = await getCachedTwoProductComparison();
  assertLifecycleDataAvailable(result, pagePath);
  const selection = selectTwoProducts(
    result.rows,
    normalizeComparisonProductId(params.left),
    normalizeComparisonProductId(params.right)
  );
  const priceHistory = selection.state === "ready" && selection.left && selection.right
    ? await getTwoProductPriceHistory([selection.left, selection.right])
    : {};
  return (
    <TwoProductComparisonPageContent
      result={result}
      params={params}
      priceHistory={priceHistory}
    />
  );
}
