import type {
  NutritionCandidateBatchItem,
  NutritionCandidateReport,
  NutritionCandidateRow,
  NutritionCandidateStatus,
} from "./nutritionCandidates";

export type NutritionCandidateBatchProgress = {
  totalProducts: number;
  dataEntered: number;
  dataRemaining: number;
  reviewCompleted: number;
  reviewRemaining: number;
};

export function getNutritionCandidateBatchProgress(
  items: NutritionCandidateBatchItem[],
  report: NutritionCandidateReport
): NutritionCandidateBatchProgress {
  const candidates = Object.values(report).flat();
  const key = (runId: string, productId: string | null, field: string) =>
    `${runId}:${productId}:${field}`;
  const candidateKeys = new Set(candidates.map((candidate) =>
    key(candidate.run_id, candidate.product_id, candidate.proposed_field)));
  const reviewedKeys = new Set(candidates
    .filter((candidate) => candidate.status !== "pending")
    .map((candidate) => key(candidate.run_id, candidate.product_id, candidate.proposed_field)));
  const pendingKeys = new Set(candidates
    .filter((candidate) => candidate.status === "pending")
    .map((candidate) => key(candidate.run_id, candidate.product_id, candidate.proposed_field)));
  const hasEveryField = (item: NutritionCandidateBatchItem, keys: Set<string>) =>
    item.missing_fields.every((field) => keys.has(key(item.run_id, item.product_id, field)));
  const dataEntered = items.filter((item) => hasEveryField(item, candidateKeys)).length;
  const reviewCompleted = items.filter((item) =>
    hasEveryField(item, reviewedKeys) &&
    !item.missing_fields.some((field) => pendingKeys.has(key(item.run_id, item.product_id, field)))
  ).length;
  return {
    totalProducts: items.length,
    dataEntered,
    dataRemaining: items.length - dataEntered,
    reviewCompleted,
    reviewRemaining: items.length - reviewCompleted,
  };
}

const STATUSES: NutritionCandidateStatus[] = [
  "pending",
  "approved",
  "rejected",
];

const FIELD_REVIEW_ORDER: Record<string, number> = {
  net_weight_g: 0,
  net_volume_ml: 1,
  serving_size_g: 2,
  serving_size_ml: 3,
  serving_count_verified: 4,
  protein_per_serving_g: 5,
  creatine_per_serving_g: 6,
};

const CONFIDENCE_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export type NutritionCandidateRunGroup = {
  run_id: string;
  latest_created_at: string;
  total: number;
  report: NutritionCandidateReport;
};

export type NutritionCandidateProductGroup = {
  key: string;
  product_id: string | null;
  product_name: string;
  candidates: NutritionCandidateRow[];
};

function emptyReport(): NutritionCandidateReport {
  return { pending: [], approved: [], rejected: [] };
}

export function groupNutritionCandidatesByRun(
  report: NutritionCandidateReport
): NutritionCandidateRunGroup[] {
  const groups = new Map<string, NutritionCandidateRunGroup>();

  for (const status of STATUSES) {
    for (const candidate of report[status]) {
      const group = groups.get(candidate.run_id) ?? {
        run_id: candidate.run_id,
        latest_created_at: candidate.created_at,
        total: 0,
        report: emptyReport(),
      };
      group.report[status].push(candidate);
      group.total += 1;
      if (Date.parse(candidate.created_at) > Date.parse(group.latest_created_at)) {
        group.latest_created_at = candidate.created_at;
      }
      groups.set(candidate.run_id, group);
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    const timeDifference = Date.parse(right.latest_created_at) - Date.parse(left.latest_created_at);
    return timeDifference || right.run_id.localeCompare(left.run_id);
  });
}

export function groupNutritionCandidatesByProduct(
  candidates: NutritionCandidateRow[]
): NutritionCandidateProductGroup[] {
  const groups = new Map<string, NutritionCandidateProductGroup>();

  for (const candidate of candidates) {
    const key = candidate.product_id
      ? `product:${candidate.product_id}`
      : `unmapped:${candidate.product_name}`;
    const group = groups.get(key) ?? {
      key,
      product_id: candidate.product_id,
      product_name: candidate.product_name,
      candidates: [],
    };
    group.candidates.push(candidate);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.candidates.sort((left, right) => {
      const fieldDifference =
        (FIELD_REVIEW_ORDER[left.proposed_field] ?? 99) -
        (FIELD_REVIEW_ORDER[right.proposed_field] ?? 99);
      if (fieldDifference) return fieldDifference;
      const confidenceDifference =
        CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence];
      if (confidenceDifference) return confidenceDifference;
      return Number(left.id) - Number(right.id);
    });
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.product_name.localeCompare(right.product_name, "en-GB", {
      sensitivity: "base",
      numeric: true,
    })
  );
}
