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

export type NutritionCandidateBatchItem = {
  id: string;
  created_at: string;
  run_id: string;
  source_record_id: string;
  product_id: string;
  product_name: string;
  brand: string;
  manufacturer: string;
  source_url: string;
  source_domain: string;
  official_domains: string[];
  missing_fields: string[];
  current_values: Record<string, unknown>;
  manifest_note: string | null;
  page_status: "FETCHED" | "FAILED";
  page_error: string | null;
};

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

function normalizeBatchItem(row: Record<string, unknown>): NutritionCandidateBatchItem {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    run_id: String(row.run_id),
    source_record_id: String(row.source_record_id),
    product_id: String(row.product_id),
    product_name: String(row.product_name),
    brand: String(row.brand),
    manufacturer: String(row.manufacturer),
    source_url: String(row.source_url),
    source_domain: String(row.source_domain),
    official_domains: Array.isArray(row.official_domains) ? row.official_domains.map(String) : [],
    missing_fields: Array.isArray(row.missing_fields) ? row.missing_fields.map(String) : [],
    current_values: row.current_values && typeof row.current_values === "object" && !Array.isArray(row.current_values)
      ? row.current_values as Record<string, unknown>
      : {},
    manifest_note: rowString(row.manifest_note),
    page_status: String(row.page_status) as NutritionCandidateBatchItem["page_status"],
    page_error: rowString(row.page_error),
  };
}

export async function getNutritionCandidateBatchItems(runId?: string): Promise<NutritionCandidateBatchItem[]> {
  let selectedRun = runId;
  if (!selectedRun) {
    const { data, error } = await supabaseAdmin
      .from("nutrition_candidate_batch_items")
      .select("run_id")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    selectedRun = data?.run_id ? String(data.run_id) : undefined;
  }
  if (!selectedRun) return [];
  const { data, error } = await supabaseAdmin
    .from("nutrition_candidate_batch_items")
    .select("id,created_at,run_id,source_record_id,product_id,product_name,brand,manufacturer,source_url,source_domain,official_domains,missing_fields,current_values,manifest_note,page_status,page_error")
    .eq("run_id", selectedRun)
    .order("id", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []).map((row) => normalizeBatchItem(row as Record<string, unknown>));
}
