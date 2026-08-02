import type {
  NutritionCandidateReport,
  NutritionCandidateStatus,
} from "./nutritionCandidates";

const STATUSES: NutritionCandidateStatus[] = [
  "pending",
  "approved",
  "rejected",
];

export type NutritionCandidateRunGroup = {
  run_id: string;
  latest_created_at: string;
  total: number;
  report: NutritionCandidateReport;
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
