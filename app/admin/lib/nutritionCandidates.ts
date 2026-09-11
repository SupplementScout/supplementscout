import "server-only";

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  isMissingNutritionPreworkoutFactColumn,
  readNutritionCandidatesWithSchemaCompatibility,
} from "./nutritionCandidateSchemaCompatibility";

export type NutritionCandidateStatus = "pending" | "approved" | "rejected";

export type NutritionCandidateRow = {
  id: string;
  created_at: string;
  product_id: string | null;
  product_variant_id: string | null;
  retailer_id: string | null;
  source_type: string;
  source_url: string;
  source_file_sha256: string;
  source_snapshot_ref: string;
  source_archive_uri: string | null;
  source_domain: string;
  product_name: string;
  brand: string;
  proposed_field: string;
  proposed_value: string | null;
  approved_value: string | null;
  proposed_unit: string | null;
  information_state: string | null;
  source_quantity_value: string | null;
  source_quantity_unit: string | null;
  quantity_basis: string | null;
  serving_basis_value: string | null;
  serving_basis_unit: string | null;
  serving_basis_text: string | null;
  ingredient_form: string | null;
  ingredient_ratio: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence_snippet: string;
  source_locator: string;
  warning_flags: string[];
  status: NutritionCandidateStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  run_id: string;
  candidate_fingerprint: string;
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

const NUT02B_CANDIDATE_SELECT =
  "id,created_at,product_id,product_variant_id,retailer_id,source_type,source_url,source_file_sha256,source_snapshot_ref,source_archive_uri,source_domain,product_name,brand,proposed_field,proposed_value,approved_value,proposed_unit,information_state,source_quantity_value,source_quantity_unit,quantity_basis,serving_basis_value,serving_basis_unit,serving_basis_text,ingredient_form,ingredient_ratio,confidence,evidence_snippet,source_locator,warning_flags,status,reviewed_at,reviewed_by,review_note,run_id,candidate_fingerprint";
const NUT02A_CANDIDATE_SELECT =
  "id,created_at,product_id,product_variant_id,retailer_id,source_type,source_url,source_file_sha256,source_snapshot_ref,source_archive_uri,source_domain,product_name,brand,proposed_field,proposed_value,approved_value,proposed_unit,confidence,evidence_snippet,source_locator,warning_flags,status,reviewed_at,reviewed_by,review_note,run_id,candidate_fingerprint";
const LEGACY_CANDIDATE_SELECT =
  "id,created_at,product_id,retailer_id,source_type,source_url,source_file_sha256,source_snapshot_ref,source_domain,product_name,brand,proposed_field,proposed_value,approved_value,proposed_unit,confidence,evidence_snippet,source_locator,warning_flags,status,reviewed_at,reviewed_by,review_note,run_id,candidate_fingerprint";

function rowString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function normalizeRow(row: Record<string, unknown>): NutritionCandidateRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    product_id: rowString(row.product_id),
    product_variant_id: rowString(row.product_variant_id),
    retailer_id: rowString(row.retailer_id),
    source_type: String(row.source_type),
    source_url: String(row.source_url),
    source_file_sha256: String(row.source_file_sha256),
    source_snapshot_ref: String(row.source_snapshot_ref),
    source_archive_uri: rowString(row.source_archive_uri),
    source_domain: String(row.source_domain),
    product_name: String(row.product_name),
    brand: String(row.brand),
    proposed_field: String(row.proposed_field),
    proposed_value: rowString(row.proposed_value),
    approved_value: rowString(row.approved_value),
    proposed_unit: rowString(row.proposed_unit),
    information_state: rowString(row.information_state),
    source_quantity_value: rowString(row.source_quantity_value),
    source_quantity_unit: rowString(row.source_quantity_unit),
    quantity_basis: rowString(row.quantity_basis),
    serving_basis_value: rowString(row.serving_basis_value),
    serving_basis_unit: rowString(row.serving_basis_unit),
    serving_basis_text: rowString(row.serving_basis_text),
    ingredient_form: rowString(row.ingredient_form),
    ingredient_ratio: rowString(row.ingredient_ratio),
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
    candidate_fingerprint: String(row.candidate_fingerprint),
  };
}

export async function getNutritionCandidateReport(runId?: string): Promise<NutritionCandidateReport> {
  const read = async (columns: string) => {
    let query = supabaseAdmin.from("nutrition_candidates").select(columns);
    if (runId) query = query.eq("run_id", runId);
    const result = await query.order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);
    return {
      data: result.data as unknown as Record<string, unknown>[] | null,
      error: result.error,
    };
  };
  const current = await read(NUT02B_CANDIDATE_SELECT);
  let rows: Record<string, unknown>[];
  if (!current.error) {
    rows = current.data || [];
  } else {
    const compatible = isMissingNutritionPreworkoutFactColumn(current.error)
      ? await readNutritionCandidatesWithSchemaCompatibility(
        () => read(NUT02A_CANDIDATE_SELECT),
        () => read(LEGACY_CANDIDATE_SELECT),
        true
      )
      : await readNutritionCandidatesWithSchemaCompatibility(
        async () => ({ data: null, error: current.error }),
        () => read(LEGACY_CANDIDATE_SELECT),
        true
      );
    rows = compatible.rows.map((row) => ({
      ...row,
      information_state: null,
      source_quantity_value: null,
      source_quantity_unit: null,
      quantity_basis: null,
      serving_basis_value: null,
      serving_basis_unit: null,
      serving_basis_text: null,
      ingredient_form: null,
      ingredient_ratio: null,
    }));
  }

  const report: NutritionCandidateReport = {
    pending: [],
    approved: [],
    rejected: [],
  };
  for (const raw of rows) {
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
