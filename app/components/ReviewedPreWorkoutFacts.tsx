import {
  ingredientFormLabel,
  nutritionSourceKindLabel,
  type AppliedPreWorkoutFact,
  type AppliedPreWorkoutFacts,
} from "../lib/reviewedPreWorkoutFacts";

const FACT_LABELS: Record<AppliedPreWorkoutFact["key"], string> = {
  serving_size_g: "Serving",
  caffeine: "Caffeine",
  beta_alanine: "Beta-alanine",
  citrulline: "Citrulline",
  creatine: "Creatine",
};

function formatAmount(value: number) {
  return `${value.toLocaleString("en-GB")} mg`;
}

function factValue(fact: AppliedPreWorkoutFact) {
  if (fact.key === "serving_size_g" && fact.servingSizeG !== null) {
    return fact.servingBasisText || `${fact.servingSizeG.toLocaleString("en-GB")} g per serving`;
  }
  if (fact.informationState === "confirmed_absent") return "Confirmed absent";
  if (fact.informationState === "present_amount_not_disclosed") {
    return "Present; amount not disclosed";
  }
  if (fact.informationState === "no_information") return "Not resolved; no information";
  if (fact.informationState === "conflicting_information") {
    return "Not resolved; sources conflict";
  }
  if (fact.amountPerServingMg === null) return "Not resolved";

  const form = ingredientFormLabel(fact.ingredientForm);
  const ratio = fact.ingredientRatio ? ` ${fact.ingredientRatio}` : "";
  const serving = fact.servingBasisText ? ` per ${fact.servingBasisText}` : " per serving";
  const subject = fact.key === "creatine" && form
    ? ` of ${form} (declared form mass)`
    : fact.key === "citrulline" && form
      ? ` of ${form}${ratio}${fact.ingredientForm === "citrulline_malate" ? " (declared malate mass)" : ""}`
      : "";

  return `${formatAmount(fact.amountPerServingMg)}${subject}${serving}`;
}

export default function ReviewedPreWorkoutFacts({
  facts,
  variantName,
}: {
  facts: AppliedPreWorkoutFacts;
  variantName: string;
}) {
  return (
    <section
      data-reviewed-preworkout-facts
      data-product-variant-id={facts.productVariantId}
      className="mt-5 w-full min-w-0 max-w-full rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm sm:mt-7 sm:p-6 lg:mt-8 lg:rounded-3xl lg:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        Reviewed facts for this exact variant
      </p>
      <h2 className="mt-2 break-words text-2xl font-bold text-gray-900">
        Pre-workout ingredients
      </h2>
      <p className="mt-2 break-words text-sm font-medium text-gray-700">
        Variant: {variantName}
      </p>
      <dl className="mt-5 divide-y divide-emerald-200/70">
        {facts.facts.map((fact) => (
          <div key={fact.key} className="py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-semibold text-gray-900">
              {FACT_LABELS[fact.key]}
            </dt>
            <dd className="mt-1 break-words text-sm leading-6 text-gray-800 [overflow-wrap:anywhere]">
              {factValue(fact)}
            </dd>
            <dd className="mt-1 text-xs text-gray-600">
              Source: {fact.sourceKinds.map(nutritionSourceKindLabel).join(" + ")}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-t border-emerald-200/70 pt-4 text-xs leading-5 text-gray-600">
        Each shown fact matches an approved candidate and the value applied to
        this variant. This does not verify the entire formulation. Compound
        amounts describe the named form on the source, not an inferred pure
        ingredient amount.
      </p>
    </section>
  );
}
