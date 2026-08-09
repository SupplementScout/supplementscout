import "server-only";

import { supabaseAdmin } from "../../lib/supabaseAdmin";

export type NutritionCandidateStatus = "pending" | "approved" | "rejected";

export type NutritionCandidateRow = {
  id: string;
  created_at: string;
  product_id: string | null;
  retailer_id: string | null;
  source_type: string;
  source_url: string;
  source_file_sha256: string;
  source_snapshot_ref: string;
  source_domain: string;
  product_name: string;
  brand: string;
  proposed_field: string;
  proposed_value: string;
  approved_value: string | null;
  proposed_unit: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence_snippet: string;
  source_locator: string;
  warning_flags: string[];
  status: NutritionCandidateStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  run_id: string;
};

export type NutritionCandidateReport = Record<
  NutritionCandidateStatus,
  NutritionCandidateRow[]
>;

function rowString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function normalizeRow(row: Record<string, unknown>): NutritionCandidateRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    product_id: rowString(row.product_id),
    retailer_id: rowString(row.retailer_id),
    source_type: String(row.source_type),
    source_url: String(row.source_url),
    source_file_sha256: String(row.source_file_sha256),
    source_snapshot_ref: String(row.source_snapshot_ref),
    source_domain: String(row.source_domain),
    product_name: String(row.product_name),
    brand: String(row.brand),
    proposed_field: String(row.proposed_field),
    proposed_value: String(row.proposed_value),
    approved_value: rowString(row.approved_value),
    proposed_unit: String(row.proposed_unit),
    confidence: String(row.confidence) as NutritionCandidateRow["confidence"],
    evidence_snippet: String(row.evidence_snippet),
    source_locator: String(row.source_locator),
    warning_flags: Array.isArray(row.warning_flags)
      ? row.warning_flags.map(String)
      : [],
    status: String(row.status) as NutritionCandidateStatus,
    reviewed_at: rowString(row.reviewed_at),
    reviewed_by: rowString(row.reviewed_by),
    review_note: rowString(row.review_note),
    run_id: String(row.run_id),
  };
}

export async function getNutritionCandidateReport(runId?: string): Promise<NutritionCandidateReport> {
  let query = supabaseAdmin
    .from("nutrition_candidates")
    .select(
      "id,created_at,product_id,retailer_id,source_type,source_url,source_file_sha256,source_snapshot_ref,source_domain,product_name,brand,proposed_field,proposed_value,approved_value,proposed_unit,confidence,evidence_snippet,source_locator,warning_flags,status,reviewed_at,reviewed_by,review_note,run_id"
    );
  if (runId) query = query.eq("run_id", runId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const report: NutritionCandidateReport = {
    pending: [],
    approved: [],
    rejected: [],
  };
  for (const raw of data || []) {
    const row = normalizeRow(raw as Record<string, unknown>);
    if (row.status in report) report[row.status].push(row);
  }
  return report;
}
