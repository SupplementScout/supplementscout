import { createHash } from "node:crypto";

export const MANUAL_NUTRITION_FIELDS = [
  "net_weight_g",
  "net_volume_ml",
  "serving_count_verified",
  "serving_size_g",
  "serving_size_ml",
  "protein_per_serving_g",
  "creatine_per_serving_g",
] as const;

export type ManualNutritionField = (typeof MANUAL_NUTRITION_FIELDS)[number];

export type ManualNutritionCandidateInput = {
  workItemId: string;
  runId: string;
  values: Partial<Record<ManualNutritionField, number>>;
  note: string | null;
};

export type NutritionBatchWorkItemForManualCandidate = {
  id: string | number;
  run_id: string;
  product_id: string;
  product_name: string;
  brand: string;
  source_url: string;
  source_domain: string;
  official_domains: string[];
  missing_fields: string[];
  current_values: Record<string, unknown>;
  page_status: "FETCHED" | "FAILED";
  source_file_sha256: string | null;
  source_snapshot_ref: string | null;
  source_context_sha256: string;
};

const UNITS: Record<ManualNutritionField, string> = {
  net_weight_g: "g",
  net_volume_ml: "ml",
  serving_count_verified: "count",
  serving_size_g: "g",
  serving_size_ml: "ml",
  protein_per_serving_g: "g",
  creatine_per_serving_g: "g",
};

function isField(value: string): value is ManualNutritionField {
  return (MANUAL_NUTRITION_FIELDS as readonly string[]).includes(value);
}

export function parseManualNutritionCandidateInput(formData: FormData): ManualNutritionCandidateInput | null {
  const workItemId = formData.get("workItemId");
  const runId = formData.get("runId");
  const noteValue = formData.get("sourceNote");
  if (
    typeof workItemId !== "string" || !/^[1-9]\d*$/.test(workItemId) ||
    typeof runId !== "string" || !/^[A-Za-z0-9._:-]{1,200}$/.test(runId) ||
    (noteValue !== null && typeof noteValue !== "string")
  ) return null;
  const note = noteValue?.trim() || null;
  if (note && note.length > 200) return null;
  const values: Partial<Record<ManualNutritionField, number>> = {};
  for (const field of MANUAL_NUTRITION_FIELDS) {
    const raw = formData.get(`value_${field}`);
    if (raw === null || raw === "") continue;
    if (typeof raw !== "string") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (field === "serving_count_verified" && !Number.isInteger(value)) return null;
    values[field] = value;
  }
  if (!Object.keys(values).length) return null;
  return { workItemId, runId, values, note };
}

function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function validateManualValuesAgainstWorkItem(
  input: ManualNutritionCandidateInput,
  item: NutritionBatchWorkItemForManualCandidate
) {
  if (input.workItemId !== String(item.id) || input.runId !== item.run_id) return false;
  const missing = new Set(item.missing_fields);
  if (Object.keys(input.values).some((field) => !isField(field) || !missing.has(field))) return false;
  const resolved = { ...item.current_values, ...input.values };
  const count = positive(resolved.serving_count_verified);
  const servingSize = positive(resolved.serving_size_g);
  const weight = positive(resolved.net_weight_g);
  const protein = positive(resolved.protein_per_serving_g);
  const creatine = positive(resolved.creatine_per_serving_g);
  if (count !== null && !Number.isInteger(count)) return false;
  if (count && servingSize && weight && count * servingSize > weight + Math.max(1, weight * 0.01)) return false;
  if (protein && servingSize && protein > servingSize) return false;
  if (creatine && servingSize && creatine > servingSize) return false;
  return true;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildManualCandidateRows(
  input: ManualNutritionCandidateInput,
  item: NutritionBatchWorkItemForManualCandidate
) {
  if (!validateManualValuesAgainstWorkItem(input, item)) {
    throw new Error("Manual nutrition values do not match the batch work item");
  }
  const sourceHost = new URL(item.source_url).hostname.toLowerCase().replace(/^www\./, "");
  if (!item.official_domains.map((domain) => domain.replace(/^www\./, "")).includes(sourceHost)) {
    throw new Error("Manual nutrition source is outside official_domains");
  }
  return Object.entries(input.values).map(([fieldName, value]) => {
    const field = fieldName as ManualNutritionField;
    const flags = ["OWNER_TRANSCRIBED_OFFICIAL_PAGE_REQUIRES_REVIEW"];
    if (item.page_status === "FAILED") flags.push("OFFICIAL_PAGE_NOT_CAPTURED_BY_BATCH");
    const note = input.note ? ` Owner note: ${input.note}` : "";
    return {
      product_id: item.product_id,
      retailer_id: null,
      source_type: item.page_status === "FETCHED"
        ? "manufacturer_product_page"
        : "owner_transcribed_official_page",
      source_url: item.source_url,
      source_file_sha256: item.source_file_sha256 || item.source_context_sha256,
      source_snapshot_ref: item.source_snapshot_ref || `db:nutrition_candidate_batch_items/${item.id}`,
      source_domain: item.source_domain,
      product_name: item.product_name,
      brand: item.brand,
      proposed_field: field,
      proposed_value: value,
      approved_value: null,
      proposed_unit: UNITS[field],
      confidence: "LOW",
      evidence_snippet: `Owner transcribed official manufacturer page: ${field} = ${value} ${UNITS[field]}.${note}`.slice(0, 300),
      source_locator: `admin-batch-item:${item.id}:field:${field}`,
      warning_flags: flags,
      status: "pending",
      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
      run_id: item.run_id,
      candidate_fingerprint: sha256(["ADMIN_MANUAL_V1", item.id, field, String(value)].join("\0")),
    };
  });
}
