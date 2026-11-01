import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import {
  DecisionPriorityLink,
  DecisionProductLink,
  DecisionViewAnalytics,
} from "../components/DecisionAnalytics";
import StatusBadge from "../components/StatusBadge";
import SupplementScoutIcon from "../components/SupplementScoutIcon";
import {
  createDecisionRequest,
  DECISION_PRIORITY_DEFINITIONS,
  decisionPriorityUrlValue,
  normalizeDecisionPriority,
  runDecisionEngine,
  type DecisionPriority,
  type DecisionResult,
  type DecisionShortlistItem,
  type DecisionTradeOff,
} from "../lib/decisionEngine";
import { formatCurrency } from "../lib/pricing";
import { normalizeSearchFilters, normalizeSearchQuery } from "../lib/products";
import {
  buildSearchIntentPlan,
  normalizeSearchIntentUrlState,
  searchIntentParamsFromPlan,
  type SearchIntentPlan,
} from "../lib/searchIntent";

export const dynamic = "force-dynamic";

type HelpMeChooseSearchParams = {
  q?: string | string[];
  priority?: string | string[];
  category?: string | string[];
  caffeine?: string | string[];
  servings_min?: string | string[];
  protein_min_g?: string | string[];
  caffeine_max_mg?: string | string[];
  format?: string | string[];
  ingredient?: string | string[];
  left?: string | string[];
  right?: string | string[];
};

type PageProps = {
  searchParams: Promise<HelpMeChooseSearchParams>;
};

const title = "Help Me Choose a Supplement";
const description =
  "Describe what matters to you and compare current delivered prices with verified product details.";

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const hasDecisionState = Object.values(params).some((value) =>
    Array.isArray(value) ? value.some(Boolean) : Boolean(value)
  );
  return {
    title,
    description,
    alternates: { canonical: "/help-me-choose" },
    robots: { index: !hasDecisionState, follow: true },
    openGraph: {
      title: `${title} | SupplementScout`,
      description,
      url: "/help-me-choose",
      type: "website",
    },
  };
}
function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function selectedProduct(value: string | string[] | undefined) {
  const id = firstValue(value);
  return id ? { productId: id } : null;
}

function decisionHref(options: {
  plan: SearchIntentPlan;
  priority: DecisionPriority;
  category: string;
}) {
  const params = searchIntentParamsFromPlan(options.plan);
  params.set("priority", decisionPriorityUrlValue(options.priority));
  if (options.category) params.set("category", options.category);
  return `/help-me-choose?${params.toString()}`;
}

function checkedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  }).format(new Date(value));
}

function comparedProduct(
  tradeOff: DecisionTradeOff,
  shortlist: DecisionShortlistItem[]
) {
  return shortlist.find(
    ({ productId }) => productId === tradeOff.comparedToProductId
  );
}

function tradeOffCopy(
  tradeOff: DecisionTradeOff,
  shortlist: DecisionShortlistItem[]
) {
  const compared = comparedProduct(tradeOff, shortlist);
  const comparedName = compared?.name || "another shortlisted option";
  if (tradeOff.type === "higher_upfront_price") {
    return `${formatCurrency(
      tradeOff.value - tradeOff.comparedValue
    )} higher delivered price than ${comparedName}.`;
  }
  if (tradeOff.type === "fewer_servings") {
    return `${Math.round(
      tradeOff.comparedValue - tradeOff.value
    ).toLocaleString("en-GB")} fewer verified servings than ${comparedName}.`;
  }
  return `Available from fewer current retailers than ${comparedName}.`;
}

function DecisionCard({
  item,
  shortlist,
  priority,
}: {
  item: DecisionShortlistItem;
  shortlist: DecisionShortlistItem[];
  priority: DecisionPriority;
}) {
  return (
    <article
      data-decision-product-id={item.productId}
      data-decision-variant-id={item.variantId}
      data-decision-priority={priority}
      data-decision-primary-value={item.primaryReason.value}
      data-decision-delivered-total={item.deliveredPrice.totalPrice}
      data-decision-checked-at={item.freshness.checkedAt}
      className="ss-card min-w-0 overflow-hidden p-4 sm:p-5 lg:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusBadge tone="comparison">Pick {item.rank}</StatusBadge>
        <span className="text-xs font-semibold text-zinc-500">
          {item.retailerCount} current retailer
          {item.retailerCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[104px_minmax(0,1fr)]">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-[var(--ss-border)] bg-[var(--ss-surface-muted)]">
          {item.image ? (
            <Image
              src={item.image}
              alt=""
              fill
              unoptimized
              sizes="104px"
              className="object-contain p-2"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-xs font-semibold text-zinc-500">
              Image unavailable
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="break-words text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
            {item.brand || "Brand not stated"}
          </p>
          <h2 className="mt-1 break-words text-lg font-bold leading-snug text-[var(--ss-ink)] sm:text-xl">
            {item.name}
          </h2>
          <p className="mt-2 break-words text-sm leading-5 text-zinc-600">
            {item.exactVariantLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
          {item.primaryReason.label}
        </p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-950">
          {item.primaryReason.display}
        </p>
        <p className="mt-2 text-xs leading-5 text-emerald-900">
          {item.primaryReason.evidenceBasis}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-[var(--ss-surface-muted)] p-3">
          <dt className="text-zinc-500">Current delivered total</dt>
          <dd className="mt-1 font-bold text-zinc-950">
            {formatCurrency(item.deliveredPrice.totalPrice)}
          </dd>
        </div>
        <div className="rounded-xl bg-[var(--ss-surface-muted)] p-3">
          <dt className="text-zinc-500">Checked</dt>
          <dd className="mt-1 font-bold text-zinc-950">
            {checkedDate(item.freshness.checkedAt)}
          </dd>
        </div>
      </dl>

      {item.tradeOffs.length > 0 && (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <h3 className="text-sm font-bold text-zinc-950">Trade-offs</h3>
          <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-600">
            {item.tradeOffs.map((tradeOff) => (
              <li
                key={`${tradeOff.type}-${tradeOff.comparedToProductId}`}
                className="flex gap-2"
              >
                <span aria-hidden="true" className="text-zinc-400">
                  •
                </span>
                <span>{tradeOffCopy(tradeOff, shortlist)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DecisionProductLink
        href={item.productHref}
        productId={item.productId}
        variantId={item.variantId}
        priority={priority}
        position={item.rank}
      >
        View offers for this variant
      </DecisionProductLink>
    </article>
  );
}

function InterpretedRequest({ result }: { result: DecisionResult }) {
  const priority = result.interpretedRequest.primaryPriority;
  return (
    <section
      aria-labelledby="understood-heading"
      className="ss-card mt-6 p-4 sm:p-6"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ss-accent)]">
        What SupplementScout understood
      </p>
      <h2 id="understood-heading" className="mt-1 text-xl font-bold">
        {result.interpretedRequest.textQuery || "Your shopping request"}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.interpretedRequest.constraints.map((constraint) => (
          <span
            key={constraint.key}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700"
          >
            {constraint.label}
          </span>
        ))}
        {priority && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            Priority: {DECISION_PRIORITY_DEFINITIONS[priority].label}
          </span>
        )}
      </div>
    </section>
  );
}

export default async function HelpMeChoosePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const explicitPriority = normalizeDecisionPriority(params.priority);
  const normalizedFilters = normalizeSearchFilters(params);
  const explicitIntent = normalizeSearchIntentUrlState(params);
  const plan = buildSearchIntentPlan(query, {
    explicit: explicitIntent,
    caffeineFree: normalizedFilters.caffeine === "free",
  });
  const selectedProducts = [
    selectedProduct(params.left),
    selectedProduct(params.right),
  ].filter((product): product is { productId: string } => product !== null);
  const request = createDecisionRequest({
    intentPlan: plan,
    explicitPriority,
    categoryContext: normalizedFilters.category,
    selectedProducts,
  });
  const result = query ? await runDecisionEngine(request) : null;
  const resultPriority = result?.interpretedRequest.primaryPriority || null;
  const firstReasonType = result?.shortlist[0]?.primaryReason.type || null;
  const clarificationChoices =
    result?.clarification?.kind === "PRIMARY_PRIORITY"
      ? result.clarification.choices
      : [];

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[var(--ss-page)] pb-16 text-[var(--ss-ink)]">
      <DecisionViewAnalytics
        status={result?.status || null}
        priority={resultPriority}
        resultCount={result?.shortlist.length || 0}
        reasonType={firstReasonType}
        clarificationChoiceCount={clarificationChoices.length}
      />

      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          >
            SupplementScout
          </Link>
          <Link
            href="/search"
            className="text-sm font-semibold text-[var(--ss-accent)] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
          >
            Normal search
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="mx-auto max-w-3xl text-center">
          <StatusBadge tone="evidence" icon="shield" className="uppercase tracking-[0.14em] text-[var(--ss-accent)]">
            Current price and product matching
          </StatusBadge>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl">
            Help me choose
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-700 sm:text-lg">
            Describe the supplement and shopping details that matter to you.
            We compare current prices with verified product details.
          </p>

          <Form
            action="/help-me-choose"
            className="mt-7 rounded-3xl border border-emerald-100 bg-white p-3 text-left shadow-[0_18px_50px_rgba(8,116,90,0.12)] sm:mt-9 sm:p-4"
          >
            <label htmlFor="decision-query" className="block px-1 text-sm font-bold text-zinc-900">
              What are you looking for?
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="decision-query"
                name="q"
                type="search"
                required
                maxLength={240}
                defaultValue={query}
                placeholder="For example: Creatine under £20 with at least 100 servings"
                className="min-h-14 min-w-0 flex-1 rounded-2xl border border-zinc-300 px-4 py-3 text-base text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-[var(--ss-accent)] focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="min-h-14 rounded-2xl bg-[var(--ss-accent)] px-7 py-3 font-semibold text-white hover:bg-[var(--ss-accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
              >
                Find my options
              </button>
            </div>
          </Form>

          {!query && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
              {[
                "cheap creatine",
                "whey with at least 25g protein and lowest price per serving",
                "caffeine free pre workout",
              ].map((example) => (
                <Link
                  key={example}
                  href={{ pathname: "/help-me-choose", query: { q: example } }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-2 font-medium text-zinc-700 hover:border-[var(--ss-accent)] hover:text-[var(--ss-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
                >
                  {example}
                </Link>
              ))}
            </div>
          )}
        </section>

        {result && <InterpretedRequest result={result} />}

        {result?.status === "NEEDS_CLARIFICATION" && result.clarification && (
          <section
            aria-labelledby="clarification-heading"
            className="mx-auto mt-6 max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
              One choice needed
            </p>
            <h2 id="clarification-heading" className="mt-2 text-2xl font-bold text-amber-950">
              {result.clarification.question}
            </h2>
            {result.message && (
              <p className="mt-2 leading-6 text-amber-900">{result.message}</p>
            )}
            {result.clarification.kind === "PRIMARY_PRIORITY" ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {result.clarification.choices.map((choice) => (
                  <DecisionPriorityLink
                    key={choice.priority}
                    priority={choice.priority}
                    href={decisionHref({
                      plan,
                      priority: choice.priority,
                      category: normalizedFilters.category,
                    })}
                  >
                    {choice.label}
                  </DecisionPriorityLink>
                ))}
              </div>
            ) : (
              <Link
                href={result.clarification.actionHref}
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--ss-ink)] px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
              >
                Choose two products
              </Link>
            )}
          </section>
        )}

        {result?.status === "DATA_GAP" && (
          <section
            aria-labelledby="data-gap-heading"
            className="mx-auto mt-6 max-w-3xl rounded-3xl border border-sky-200 bg-sky-50 p-5 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-800">
              Verified data gap
            </p>
            <h2 id="data-gap-heading" className="mt-2 text-2xl font-bold text-sky-950">
              We cannot verify every requirement yet
            </h2>
            <p className="mt-3 leading-7 text-sky-950">{result.message}</p>
            <p className="mt-3 text-sm leading-6 text-sky-900">
              No product shortlist is being claimed for the unsupported requirement.
            </p>
          </section>
        )}

        {result?.status === "SAFETY_BOUNDARY" && (
          <section
            aria-labelledby="safety-heading"
            className="mx-auto mt-6 max-w-3xl rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-800">
              Personal suitability boundary
            </p>
            <h2 id="safety-heading" className="mt-2 text-2xl font-bold text-violet-950">
              We do not make medical suitability rankings
            </h2>
            <p className="mt-3 leading-7 text-violet-950">{result.message}</p>
          </section>
        )}

        {result?.status === "ANSWERED" && result.comparisonHandoff && (
          <section className="mx-auto mt-6 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7">
            <h2 className="text-2xl font-bold">Use Product Comparison</h2>
            <p className="mt-3 leading-7 text-zinc-700">{result.message}</p>
            <Link
              href={result.comparisonHandoff.href}
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--ss-ink)] px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[var(--ss-accent)] focus:ring-offset-2"
            >
              {result.comparisonHandoff.label}
            </Link>
          </section>
        )}

        {result?.status === "ANSWERED" &&
          result.shortlist.length > 0 &&
          resultPriority && (
            <section aria-labelledby="top-picks-heading" className="mt-8 sm:mt-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ss-accent)]">
                    Current matching products
                  </p>
                  <h2 id="top-picks-heading" className="mt-1 text-3xl font-extrabold tracking-tight">
                    Top picks
                  </h2>
                </div>
                <p className="text-sm text-zinc-600">
                  {result.eligibleCandidateCount.toLocaleString("en-GB")} current match
                  {result.eligibleCandidateCount === 1 ? "" : "es"} · showing {result.shortlist.length}
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {result.shortlist.map((item) => (
                  <DecisionCard
                    key={`${item.productId}:${item.variantId}`}
                    item={item}
                    shortlist={result.shortlist}
                    priority={resultPriority}
                  />
                ))}
              </div>

              {result.ineligible.length > 0 && (
                <p className="mt-5 text-sm leading-6 text-zinc-600">
                  Products without the required details, known delivery price or current offer were not included.
                </p>
              )}
            </section>
          )}

        <section className="mx-auto mt-10 max-w-3xl border-t border-zinc-200 pt-6 text-sm leading-6 text-zinc-600">
          <div className="flex items-start gap-3">
            <SupplementScoutIcon name="shield" size={20} className="mt-0.5 shrink-0 text-[var(--ss-accent)]" />
            <p>
              Help Me Choose uses current prices and verified shopping facts. It does not rank products for personal medical suitability.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
