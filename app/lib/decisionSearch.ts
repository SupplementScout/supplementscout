import {
  DECISION_PRIORITY_DEFINITIONS,
  type DecisionPriority,
  type DecisionResult,
} from "./decisionEngine";
import {
  searchIntentParamsFromPlan,
  type SearchIntentPlan,
} from "./searchIntent";

export function decisionSearchHref(options: {
  plan: SearchIntentPlan;
  priority: DecisionPriority;
  category?: string | null;
}) {
  const params = searchIntentParamsFromPlan(options.plan);
  params.set("sort", DECISION_PRIORITY_DEFINITIONS[options.priority].sort);
  const category = options.category?.trim();
  if (category) params.set("category", category);
  return `/search?${params.toString()}`;
}

export function shouldShowDecisionSearchLink(result: DecisionResult) {
  return (
    result.status === "ANSWERED" &&
    result.shortlist.length > 0 &&
    result.candidateCount > result.shortlist.length
  );
}
