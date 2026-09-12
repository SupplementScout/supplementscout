const fs = require("node:fs");
const path = require("node:path");
const {
  FIELDS, assertRealPathInsideRoot, fingerprint,
  isMissingNutritionPreworkoutFactColumn, isMissingNutritionVariantProvenanceColumn, validateSourceArchiveUri,
} = require("./nutrition-candidates");
const { createCandidateSupabase } = require("../store-nutrition-candidates");
const {
  PREWORKOUT_FIELD_SET,
  TARGET_FIELD_BY_CANDIDATE_FIELD,
  ingredientFact,
} = require("./nutrition-preworkout-facts");

const PLAN_KIND = "nutrition-approved-update-plan-v3";
const AUDIT_KIND = "nutrition-approved-update-audit-v2";
const DERIVED_FIELDS = Object.freeze(["nutrition_verified"]);
const NUT02B_PREWORKOUT_TARGET_FIELDS = Object.freeze(["caffeine", "citrulline", "beta_alanine"]);
const PREWORKOUT_TARGET_FIELDS = Object.freeze([...NUT02B_PREWORKOUT_TARGET_FIELDS, "creatine"]);
const LEGACY_ALLOWED_FIELDS = Object.freeze([...FIELDS, ...DERIVED_FIELDS]);
const NUT02B_ALLOWED_FIELDS = Object.freeze([...LEGACY_ALLOWED_FIELDS, ...NUT02B_PREWORKOUT_TARGET_FIELDS]);
const ALLOWED_FIELDS = Object.freeze([...LEGACY_ALLOWED_FIELDS, ...PREWORKOUT_TARGET_FIELDS]);
const CANDIDATE_FIELD_SET = new Set(FIELDS);
const NUTRITION_SOURCE_FIELDS = new Set(["protein_per_serving_g", "creatine_per_serving_g"]);
const EXPECTED_UNITS = Object.freeze({
  net_weight_g: "g", net_volume_ml: "ml", serving_count_verified: "count",
  serving_size_g: "g", serving_size_ml: "ml", protein_per_serving_g: "g", creatine_per_serving_g: "g",
});
const UNSAFE_FLAGS = /CONFLICT|AMBIGUOUS|UNCLEAR|MISMATCH|EXCEEDS/i;

function fail(message) { throw new Error(message); }
function validateRunId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,200}$/.test(value)) fail("Invalid --run-id");
  return value;
}
function positiveId(value) {
  const text = String(value || "");
  return /^[1-9][0-9]*$/.test(text) ? text : null;
}
function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function candidateEvidence(candidate) {
  return {
    candidate_id: String(candidate.id),
    candidate_fingerprint: String(candidate.candidate_fingerprint),
    product_id: String(candidate.product_id),
    product_variant_id: candidate.product_variant_id == null ? null : String(candidate.product_variant_id),
    confidence: String(candidate.confidence),
    source_url: String(candidate.source_url),
    source_file_sha256: String(candidate.source_file_sha256),
    source_archive_uri: candidate.source_archive_uri == null ? null : String(candidate.source_archive_uri),
    evidence_snippet: String(candidate.evidence_snippet),
    source_locator: String(candidate.source_locator),
    warning_flags: Array.isArray(candidate.warning_flags) ? candidate.warning_flags.map(String) : [],
    source_field: String(candidate.proposed_field),
    proposed_value: candidate.proposed_value == null ? null : Number(candidate.proposed_value),
    source_value: candidate.approved_value == null ? null : Number(candidate.approved_value),
    owner_corrected: PREWORKOUT_FIELD_SET.has(String(candidate.proposed_field))
      ? false
      : Number(candidate.approved_value) !== Number(candidate.proposed_value),
    information_state: candidate.information_state == null ? null : String(candidate.information_state),
    source_quantity_value: candidate.source_quantity_value == null ? null : Number(candidate.source_quantity_value),
    source_quantity_unit: candidate.source_quantity_unit == null ? null : String(candidate.source_quantity_unit),
    quantity_basis: candidate.quantity_basis == null ? null : String(candidate.quantity_basis),
    serving_basis_value: candidate.serving_basis_value == null ? null : Number(candidate.serving_basis_value),
    serving_basis_unit: candidate.serving_basis_unit == null ? null : String(candidate.serving_basis_unit),
    serving_basis_text: candidate.serving_basis_text == null ? null : String(candidate.serving_basis_text),
    ingredient_form: candidate.ingredient_form == null ? null : String(candidate.ingredient_form),
    ingredient_ratio: candidate.ingredient_ratio == null ? null : String(candidate.ingredient_ratio),
  };
}
function validateEvidenceIdentity(candidate, candidateId, productId, variantId, blockers) {
  if (!/^[0-9a-f]{64}$/.test(String(candidate.source_file_sha256 || ""))) {
    blockers.push({ code: "INVALID_SOURCE_HASH", candidate_id: candidateId, product_id: productId });
    return false;
  }
  if (variantId) {
    try { validateSourceArchiveUri(candidate.source_archive_uri, { required: true }); }
    catch {
      blockers.push({ code: "INVALID_VARIANT_SOURCE_ARCHIVE", candidate_id: candidateId, product_id: productId, product_variant_id: variantId });
      return false;
    }
  }
  return true;
}
function buildApprovedPlan(candidates, products, runId, generatedAt = new Date().toISOString(), variants = []) {
  validateRunId(runId);
  if (!Array.isArray(candidates) || !candidates.length) fail(`No approved candidates found for run ${runId}`);
  const productById = new Map((products || []).map((product) => [String(product.id), product]));
  const variantById = new Map((variants || []).map((variant) => [String(variant.id), variant]));
  const blockers = [];
  const groups = new Map();

  for (const candidate of candidates) {
    const candidateId = String(candidate.id || "unknown");
    const productId = positiveId(candidate.product_id);
    const variantId = candidate.product_variant_id == null ? null : positiveId(candidate.product_variant_id);
    const sourceField = String(candidate.proposed_field || "");
    const structured = PREWORKOUT_FIELD_SET.has(sourceField);
    const field = structured ? TARGET_FIELD_BY_CANDIDATE_FIELD[sourceField] : sourceField;
    let value = numeric(candidate.approved_value);
    const flags = Array.isArray(candidate.warning_flags) ? candidate.warning_flags.map(String) : [];
    if (candidate.status !== "approved" || candidate.run_id !== runId) {
      blockers.push({ code: "CANDIDATE_NOT_APPROVED_FOR_RUN", candidate_id: candidateId });
      continue;
    }
    if (!productId) {
      blockers.push({ code: "NEEDS_PRODUCT_MAPPING", candidate_id: candidateId });
      continue;
    }
    if (candidate.product_variant_id != null && !variantId) {
      blockers.push({ code: "INVALID_VARIANT_ID", candidate_id: candidateId, product_id: productId });
      continue;
    }
    if (!validateEvidenceIdentity(candidate, candidateId, productId, variantId, blockers)) continue;
    if (structured) {
      if (!variantId) {
        blockers.push({ code: "PREWORKOUT_FACT_REQUIRES_EXACT_VARIANT", candidate_id: candidateId, product_id: productId, field: sourceField });
        continue;
      }
      try {
        value = ingredientFact({ ...candidate, field_name: sourceField, value_numeric: candidate.proposed_value, unit: candidate.proposed_unit, basis: candidate.quantity_basis });
      } catch {
        blockers.push({ code: "UNSUPPORTED_OR_INVALID_FACT", candidate_id: candidateId, product_id: productId, product_variant_id: variantId, field: sourceField });
        continue;
      }
    } else if (!CANDIDATE_FIELD_SET.has(field) || EXPECTED_UNITS[field] !== candidate.proposed_unit || !Number.isFinite(value) || value <= 0) {
      blockers.push({ code: "UNSUPPORTED_OR_INVALID_FACT", candidate_id: candidateId, product_id: productId, field });
      continue;
    }
    if (field === "serving_count_verified" && !Number.isInteger(value)) {
      blockers.push({ code: "SERVING_COUNT_MUST_BE_INTEGER", candidate_id: candidateId, product_id: productId, field });
      continue;
    }
    const key = `${productId}|${variantId || "PRODUCT"}|${field}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ candidate, productId, variantId, field, sourceField, value, flags, structured });
  }

  const changesByProduct = new Map();
  const changesByVariant = new Map();
  for (const group of groups.values()) {
    const first = group[0];
    const values = new Set(group.map((item) => canonicalJson(item.value)));
    if (values.size !== 1) {
      blockers.push({
        code: "CONFLICTING_APPROVED_VALUES", product_id: first.productId,
        ...(first.variantId ? { product_variant_id: first.variantId } : {}),
        field: first.field, candidate_ids: group.map((item) => String(item.candidate.id)),
      });
      continue;
    }
    const unsafe = group.filter((item) =>
      item.flags.some((flag) => UNSAFE_FLAGS.test(flag)) &&
      !(item.structured && item.value.information_state === "conflicting_information")
    );
    if (unsafe.length) {
      const ownerResolvedSourceConflict = group.some((item) => Number(item.candidate.approved_value) !== Number(item.candidate.proposed_value)) &&
        unsafe.every((item) => item.flags.filter((flag) => UNSAFE_FLAGS.test(flag))
          .every((flag) => /CONFLICT/i.test(flag) && !/MISMATCH|EXCEEDS|AMBIGUOUS|UNCLEAR/i.test(flag)));
      if (!ownerResolvedSourceConflict) {
        for (const item of unsafe) blockers.push({
          code: "UNSAFE_WARNING_FLAG", candidate_id: String(item.candidate.id), product_id: item.productId,
          ...(item.variantId ? { product_variant_id: item.variantId } : {}), field: item.field,
        });
        continue;
      }
    }

    const { productId, variantId, field, value } = first;
    const product = productById.get(productId);
    if (!product) {
      blockers.push({ code: "PRODUCT_NOT_FOUND", product_id: productId, field });
      continue;
    }
    if (variantId) {
      const variant = variantById.get(variantId);
      if (!variant) {
        blockers.push({ code: "VARIANT_NOT_FOUND", product_id: productId, product_variant_id: variantId, field });
        continue;
      }
      if (String(variant.product_id) !== productId) {
        blockers.push({ code: "VARIANT_PRODUCT_MISMATCH", product_id: productId, product_variant_id: variantId, field });
        continue;
      }
      if (!changesByVariant.has(variantId)) {
        const beforeOverride = jsonObject(variant.nutrition_override);
        changesByVariant.set(variantId, {
          product_id: productId, product_variant_id: variantId, variant_name: String(variant.name || ""),
          before_nutrition_override: beforeOverride, after_nutrition_override: { ...beforeOverride }, changes: {},
        });
      }
      const update = changesByVariant.get(variantId);
      if (first.structured) {
        const beforeRaw = Object.hasOwn(update.before_nutrition_override, field)
          ? update.before_nutrition_override[field]
          : null;
        const before = beforeRaw === null ? null : jsonObject(beforeRaw);
        if (beforeRaw !== null && (!beforeRaw || typeof beforeRaw !== "object" || Array.isArray(beforeRaw) || !before.information_state)) {
          blockers.push({ code: "INVALID_CURRENT_VARIANT_VALUE", product_id: productId, product_variant_id: variantId, field });
          continue;
        }
        if (["no_information", "conflicting_information"].includes(value.information_state) &&
            before && !["no_information", "conflicting_information"].includes(before.information_state)) {
          blockers.push({ code: "INDETERMINATE_STATE_WOULD_OVERWRITE_APPROVED_FACT", product_id: productId, product_variant_id: variantId, field });
          continue;
        }
        const evidence = group.map((item) => candidateEvidence(item.candidate));
        update.changes[field] = {
          before, after: value, no_change: canonicalJson(before) === canonicalJson(value), evidence,
        };
        update.after_nutrition_override[field] = value;
        continue;
      }
      const before = Object.hasOwn(update.before_nutrition_override, field) ? numeric(update.before_nutrition_override[field]) : null;
      if (Number.isNaN(before)) {
        blockers.push({ code: "INVALID_CURRENT_VARIANT_VALUE", product_id: productId, product_variant_id: variantId, field });
        continue;
      }
      update.changes[field] = { before, after: value, no_change: before === value, evidence: group.map((item) => candidateEvidence(item.candidate)) };
      update.after_nutrition_override[field] = value;
      if (NUTRITION_SOURCE_FIELDS.has(field)) {
        const verifiedBefore = update.before_nutrition_override.nutrition_verified === true;
        const evidence = group.map((item) => candidateEvidence(item.candidate));
        const existing = update.changes.nutrition_verified;
        update.changes.nutrition_verified = {
          before: verifiedBefore, after: true, no_change: verifiedBefore,
          derived_from_reviewed_nutrition: true, evidence: existing ? [...existing.evidence, ...evidence] : evidence,
        };
        update.after_nutrition_override.nutrition_verified = true;
      }
      continue;
    }

    const before = numeric(product[field]);
    if (Number.isNaN(before)) {
      blockers.push({ code: "INVALID_CURRENT_PRODUCT_VALUE", product_id: productId, field });
      continue;
    }
    if (!changesByProduct.has(productId)) {
      changesByProduct.set(productId, { product_id: productId, product_name: String(product.name || ""), changes: {} });
    }
    const update = changesByProduct.get(productId);
    update.changes[field] = { before, after: value, no_change: before === value, evidence: group.map((item) => candidateEvidence(item.candidate)) };
    if (NUTRITION_SOURCE_FIELDS.has(field)) {
      const verifiedBefore = product.nutrition_verified === true;
      const evidence = group.map((item) => candidateEvidence(item.candidate));
      const existing = update.changes.nutrition_verified;
      update.changes.nutrition_verified = {
        before: verifiedBefore, after: true, no_change: verifiedBefore,
        derived_from_reviewed_nutrition: true, evidence: existing ? [...existing.evidence, ...evidence] : evidence,
      };
    }
  }

  const productUpdates = [...changesByProduct.values()].sort((a, b) => Number(a.product_id) - Number(b.product_id));
  for (const update of productUpdates) {
    const product = productById.get(update.product_id);
    const effective = (field) => update.changes[field]?.after ?? numeric(product?.[field]);
    const beforeWeight = numeric(product?.net_weight_g);
    const afterWeight = effective("net_weight_g");
    if (beforeWeight !== null && afterWeight !== null && beforeWeight !== afterWeight) {
      blockers.push({ code: "PACK_SIZE_CHANGE_REQUIRES_VARIANT_TRANSITION", product_id: update.product_id, before_net_weight_g: beforeWeight, proposed_net_weight_g: afterWeight });
    }
    const servingCount = effective("serving_count_verified");
    const servingSize = effective("serving_size_g");
    for (const field of NUTRITION_SOURCE_FIELDS) {
      const nutrient = effective(field);
      if (servingSize !== null && nutrient !== null && nutrient > servingSize) {
        blockers.push({ code: "NUTRIENT_EXCEEDS_SERVING_SIZE", product_id: update.product_id, field, nutrient_per_serving_g: nutrient, serving_size_g: servingSize });
      }
    }
    const packageTolerance = afterWeight === null ? null : Math.max(1, afterWeight * 0.01);
    if (afterWeight !== null && servingCount !== null && servingSize !== null && servingCount * servingSize > afterWeight + packageTolerance) {
      blockers.push({ code: "PACKAGE_SERVING_MISMATCH", product_id: update.product_id, net_weight_g: afterWeight, serving_count_verified: servingCount, serving_size_g: servingSize, implied_weight_g: servingCount * servingSize });
    }
  }

  const variantUpdates = [...changesByVariant.values()].sort((a, b) => Number(a.product_variant_id) - Number(b.product_variant_id));
  const core = {
    schema_version: 3, kind: PLAN_KIND, run_id: runId, generated_at: new Date(generatedAt).toISOString(),
    status: blockers.length ? "BLOCKED" : "READY_FOR_EXPLICIT_APPLY", allowed_fields: ALLOWED_FIELDS,
    source_candidate_ids: candidates.map((candidate) => String(candidate.id)).sort((a, b) => Number(a) - Number(b)),
    blockers, product_updates: productUpdates, variant_updates: variantUpdates, database_writes: 0,
  };
  return { ...core, plan_fingerprint: fingerprint("APPROVED_UPDATE_PLAN", core) };
}

function validEvidence(evidence, productId, variantId) {
  if (!evidence || evidence.product_id !== productId || evidence.product_variant_id !== variantId ||
      !/^[0-9a-f]{64}$/.test(evidence.candidate_fingerprint) ||
      !/^[0-9a-f]{64}$/.test(evidence.source_file_sha256)) return false;
  const structured = PREWORKOUT_FIELD_SET.has(evidence.source_field);
  if (structured) {
    try {
      ingredientFact({
        ...evidence,
        field_name: evidence.source_field,
        value_numeric: evidence.proposed_value,
        unit: evidence.source_value == null ? null : "mg",
        proposed_value: evidence.proposed_value,
        proposed_unit: evidence.source_value == null ? null : "mg",
        basis: evidence.quantity_basis,
        product_variant_id: evidence.product_variant_id,
      }, evidence.source_value);
    } catch { return false; }
    if (evidence.owner_corrected !== false) return false;
  } else if (!Number.isFinite(evidence.proposed_value) || evidence.proposed_value <= 0 ||
      !Number.isFinite(evidence.source_value) || evidence.source_value <= 0 ||
      typeof evidence.owner_corrected !== "boolean" ||
      evidence.owner_corrected !== (evidence.proposed_value !== evidence.source_value)) return false;
  if (variantId) {
    try { validateSourceArchiveUri(evidence.source_archive_uri, { required: true }); } catch { return false; }
  } else if (evidence.source_archive_uri !== null) {
    try { validateSourceArchiveUri(evidence.source_archive_uri); } catch { return false; }
  }
  return true;
}
function validateChanges(changes, productId, variantId) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) fail("Invalid update changes");
  for (const [field, change] of Object.entries(changes)) {
    const evidenceOk = Array.isArray(change?.evidence) && change.evidence.length &&
      change.evidence.every((row) => validEvidence(row, productId, variantId));
    const derived = field === "nutrition_verified" && change?.after === true &&
      typeof change.before === "boolean" && change.derived_from_reviewed_nutrition === true &&
      evidenceOk && change.evidence.every((row) => NUTRITION_SOURCE_FIELDS.has(row.source_field));
    const numericChange = FIELDS.includes(field) && Number.isFinite(change?.after) && change.after > 0 &&
      (change.before === null || Number.isFinite(change.before)) && evidenceOk;
    const structuredChange = PREWORKOUT_TARGET_FIELDS.includes(field) && variantId !== null &&
      change?.after && typeof change.after === "object" && !Array.isArray(change.after) &&
      (change.before === null || (change.before && typeof change.before === "object" && !Array.isArray(change.before))) &&
      evidenceOk && change.evidence.every((row) => TARGET_FIELD_BY_CANDIDATE_FIELD[row.source_field] === field) &&
      canonicalJson(ingredientFact({
        ...change.evidence[0], field_name: change.evidence[0].source_field,
        value_numeric: change.evidence[0].proposed_value,
        unit: change.evidence[0].source_value == null ? null : "mg",
        proposed_value: change.evidence[0].proposed_value,
        proposed_unit: change.evidence[0].source_value == null ? null : "mg",
        basis: change.evidence[0].quantity_basis,
      }, change.evidence[0].source_value)) === canonicalJson(change.after);
    if (!derived && !numericChange && !structuredChange) fail("Invalid change in approved plan");
  }
}
function validatePlan(plan) {
  if (!plan || plan.schema_version !== 3 || plan.kind !== PLAN_KIND ||
      plan.status !== "READY_FOR_EXPLICIT_APPLY" || !Array.isArray(plan.allowed_fields) ||
      ![
        JSON.stringify(ALLOWED_FIELDS),
        JSON.stringify(NUT02B_ALLOWED_FIELDS),
        JSON.stringify(LEGACY_ALLOWED_FIELDS),
      ].includes(JSON.stringify(plan.allowed_fields)) ||
      !Array.isArray(plan.source_candidate_ids) || !plan.source_candidate_ids.length ||
      !Array.isArray(plan.blockers) || plan.blockers.length ||
      !Array.isArray(plan.product_updates) || !Array.isArray(plan.variant_updates)) {
    fail("Approved nutrition update plan is invalid or blocked");
  }
  const core = { ...plan }; delete core.plan_fingerprint;
  if (plan.plan_fingerprint !== fingerprint("APPROVED_UPDATE_PLAN", core)) fail("Approved nutrition update plan fingerprint mismatch");
  validateRunId(plan.run_id);
  for (const update of plan.product_updates) {
    if (!positiveId(update.product_id)) fail("Invalid product update entry");
    validateChanges(update.changes, update.product_id, null);
  }
  for (const update of plan.variant_updates) {
    if (!positiveId(update.product_id) || !positiveId(update.product_variant_id) ||
        !update.before_nutrition_override || !update.after_nutrition_override ||
        Array.isArray(update.before_nutrition_override) || Array.isArray(update.after_nutrition_override)) fail("Invalid variant update entry");
    validateChanges(update.changes, update.product_id, update.product_variant_id);
    const expected = { ...update.before_nutrition_override };
    for (const [field, change] of Object.entries(update.changes)) expected[field] = change.after;
    if (JSON.stringify(expected) !== JSON.stringify(update.after_nutrition_override)) fail("Variant nutrition override does not match planned changes");
  }
  return plan;
}
function resolveTmpFile(file, cwd = process.cwd()) {
  const tmpRoot = fs.realpathSync.native(path.resolve(cwd, "tmp"));
  const resolved = fs.realpathSync.native(path.resolve(cwd, file));
  const relative = path.relative(tmpRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) fail("Plan must be a file inside repository tmp/");
  if (fs.statSync(resolved).size > 5_000_000) fail("Plan exceeds 5 MB");
  return resolved;
}
function writePlan(plan, cwd = process.cwd()) {
  const root = path.resolve(cwd, "tmp");
  const directory = path.join(root, "nutrition-approved-plan");
  assertRealPathInsideRoot(root, directory);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${plan.run_id.replace(/[^A-Za-z0-9._-]/g, "-")}-${plan.plan_fingerprint.slice(0, 12)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  return file;
}
const CANDIDATE_SELECT = "id,product_id,product_variant_id,proposed_field,proposed_value,approved_value,proposed_unit,information_state,source_quantity_value,source_quantity_unit,quantity_basis,serving_basis_value,serving_basis_unit,serving_basis_text,ingredient_form,ingredient_ratio,confidence,source_url,source_file_sha256,source_archive_uri,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint";
const NUT02A_CANDIDATE_SELECT = "id,product_id,product_variant_id,proposed_field,proposed_value,approved_value,proposed_unit,confidence,source_url,source_file_sha256,source_archive_uri,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint";
const LEGACY_CANDIDATE_SELECT = "id,product_id,proposed_field,proposed_value,approved_value,proposed_unit,confidence,source_url,source_file_sha256,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint";
async function runApprovedCandidateQuery(supabase, columns, runId, candidateIds) {
  let query = supabase.from("nutrition_candidates").select(columns)
    .eq("run_id", runId).eq("status", "approved");
  if (candidateIds) query = query.in("id", candidateIds);
  return query.order("id", { ascending: true });
}
async function loadApprovedCandidateRows(supabase, runId, candidateIds) {
  let current = await runApprovedCandidateQuery(supabase, CANDIDATE_SELECT, runId, candidateIds);
  if (!current.error) return current.data || [];
  if (isMissingNutritionPreworkoutFactColumn(current.error)) {
    current = await runApprovedCandidateQuery(supabase, NUT02A_CANDIDATE_SELECT, runId, candidateIds);
    if (!current.error) return (current.data || []).map((row) => ({
      ...row, information_state: null, source_quantity_value: null, source_quantity_unit: null,
      quantity_basis: null, serving_basis_value: null, serving_basis_unit: null,
      serving_basis_text: null, ingredient_form: null, ingredient_ratio: null,
    }));
  }
  if (!isMissingNutritionVariantProvenanceColumn(current.error)) throw current.error;
  const legacy = await runApprovedCandidateQuery(supabase, LEGACY_CANDIDATE_SELECT, runId, candidateIds);
  if (legacy.error) throw legacy.error;
  return (legacy.data || []).map((row) => ({
    ...row,
    product_variant_id: null,
    source_archive_uri: null,
  }));
}
async function loadApprovedCandidates(supabase, runId, candidateIds) {
  return loadApprovedCandidateRows(supabase, runId, candidateIds);
}
async function loadApprovedCandidatesForRun(supabase, runId) {
  return loadApprovedCandidateRows(supabase, runId);
}
async function loadProducts(supabase, productIds) {
  if (!productIds.length) return [];
  const { data, error } = await supabase.from("products").select(`id,name,${LEGACY_ALLOWED_FIELDS.join(",")}`).in("id", productIds);
  if (error) throw error;
  return data || [];
}
async function loadVariants(supabase, variantIds) {
  if (!variantIds.length) return [];
  const { data, error } = await supabase.from("product_variants").select("id,product_id,name,nutrition_override").in("id", variantIds);
  if (error) throw error;
  return data || [];
}
function createSupabase(dependencies) { return dependencies.supabase || createCandidateSupabase(); }

module.exports = {
  ALLOWED_FIELDS, AUDIT_KIND, PLAN_KIND, buildApprovedPlan, createSupabase,
  loadApprovedCandidates, loadApprovedCandidatesForRun, loadProducts, loadVariants,
  resolveTmpFile, validatePlan, validateRunId, writePlan,
};
