import { formatCurrency } from "../lib/pricing";
import type {
  CategoryDecisionAnswer,
  CategoryDecisionReason,
} from "../lib/categoryDecision";
import { OfferCheckedBadge } from "./ComparisonProductVisuals";
import {
  CategoryDecisionCompareLink,
  CategoryDecisionProductLink,
} from "./CategoryDecisionLink";
import { CategoryDecisionViewAnalytics } from "./CategoryDecisionAnalytics";

function reasonLabel(reason: CategoryDecisionReason) {
  if (reason.type === "lowest_delivered_total") {
    return `Lowest delivered total: ${formatCurrency(reason.value)}`;
  }

  if (reason.type === "broadest_retailer_coverage") {
    return `Broadest coverage: ${reason.value} retailers`;
  }

  if (reason.valueBasis === "cost_per_5g_creatine") {
    return `Best verified value: ${formatCurrency(reason.value)} per 5 g creatine`;
  }

  return `Best verified value: ${formatCurrency(reason.value)} per 25 g protein`;
}

export default function CategoryDecisionPanel({
  answers,
  category,
}: {
  answers: CategoryDecisionAnswer[];
  category: string;
}) {
  if (answers.length === 0) return null;

  const reasonTypes = answers.flatMap((answer) =>
    answer.reasons.map((reason) => reason.type)
  );

  return (
    <section
      aria-labelledby="quick-decision-heading"
      className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14"
    >
      <CategoryDecisionViewAnalytics
        category={category}
        answerCount={answers.length}
        reasonTypes={reasonTypes}
      />
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Quick decision
        </p>
        <h2 id="quick-decision-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
          Your quickest answers, using only verified current data
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-zinc-700">
          One product can earn more than one answer. We show fewer cards when
          the evidence does not support three different products.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {answers.map((answer, index) => (
            <article
              key={answer.id}
              className="flex min-w-0 flex-col rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap gap-2">
                {answer.reasons.map((reason) => (
                  <span
                    key={reason.type}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900"
                  >
                    {reasonLabel(reason)}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {answer.brand || "Brand not stated"}
              </p>
              <h3 className="mt-2 break-words text-lg font-bold text-zinc-950">
                {answer.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {answer.retailerCount} current retailer
                {answer.retailerCount === 1 ? "" : "s"} and {answer.offerCount}{" "}
                recently checked offer{answer.offerCount === 1 ? "" : "s"}.
              </p>
              <OfferCheckedBadge checkedAt={answer.lastCheckedAt} />
              <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <CategoryDecisionProductLink
                  href={answer.productUrl}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-4 text-center text-sm font-semibold text-white hover:bg-zinc-800"
                  category={category}
                  productId={answer.id}
                  position={index + 1}
                  reasonType={answer.reasons[0].type}
                >
                  See product
                </CategoryDecisionProductLink>
                <CategoryDecisionCompareLink
                  href={`/compare?left=${encodeURIComponent(answer.id)}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                  category={category}
                  productId={answer.id}
                  position={index + 1}
                >
                  Add to comparison
                </CategoryDecisionCompareLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
