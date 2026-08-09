const fs = require("node:fs");
const path = require("node:path");
const {
  FIELDS,
  assertRealPathInsideRoot,
  fingerprint,
} = require("./nutrition-candidates");
const { createCandidateSupabase } = require("../store-nutrition-candidates");

const PLAN_KIND = "nutrition-approved-product-update-plan-v2";
const AUDIT_KIND = "nutrition-approved-product-update-audit-v1";
const DERIVED_FIELDS = Object.freeze(["nutrition_verified"]);
const ALLOWED_FIELDS = Object.freeze([...FIELDS, ...DERIVED_FIELDS]);
const CANDIDATE_FIELD_SET = new Set(FIELDS);
const NUTRITION_SOURCE_FIELDS = new Set(["protein_per_serving_g", "creatine_per_serving_g"]);
const EXPECTED_UNITS = Object.freeze({
  net_weight_g: "g",
  net_volume_ml: "ml",
  serving_count_verified: "count",
  serving_size_g: "g",
  serving_size_ml: "ml",
  protein_per_serving_g: "g",
  creatine_per_serving_g: "g",
});
const UNSAFE_FLAGS = /CONFLICT|AMBIGUOUS|UNCLEAR|MISMATCH|EXCEEDS/i;

function fail(message) {
  throw new Error(message);
}

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

function candidateEvidence(candidate) {
  return {
    candidate_id: String(candidate.id),
    candidate_fingerprint: String(candidate.candidate_fingerprint),
    confidence: String(candidate.confidence),
    source_url: String(candidate.source_url),
    evidence_snippet: String(candidate.evidence_snippet),
    source_locator: String(candidate.source_locator),
    warning_flags: Array.isArray(candidate.warning_flags) ? candidate.warning_flags.map(String) : [],
    source_field: String(candidate.proposed_field),
    proposed_value: Number(candidate.proposed_value),
    source_value: Number(candidate.approved_value),
    owner_corrected: Number(candidate.approved_value) !== Number(candidate.proposed_value),
  };
}

function buildApprovedPlan(candidates, products, runId, generatedAt = new Date().toISOString()) {
  validateRunId(runId);
  if (!Array.isArray(candidates) || !candidates.length) fail(`No approved candidates found for run ${runId}`);
  const productById = new Map((products || []).map((product) => [String(product.id), product]));
  const blockers = [];
  const groups = new Map();
  for (const candidate of candidates) {
    const candidateId = String(candidate.id || "unknown");
    const productId = positiveId(candidate.product_id);
    const field = String(candidate.proposed_field || "");
    const value = numeric(candidate.approved_value);
    const flags = Array.isArray(candidate.warning_flags) ? candidate.warning_flags.map(String) : [];
    if (candidate.status !== "approved" || candidate.run_id !== runId) {
      blockers.push({ code: "CANDIDATE_NOT_APPROVED_FOR_RUN", candidate_id: candidateId });
      continue;
    }
    if (!productId) {
      blockers.push({ code: "NEEDS_PRODUCT_MAPPING", candidate_id: candidateId });
      continue;
    }
    if (!CANDIDATE_FIELD_SET.has(field) || EXPECTED_UNITS[field] !== candidate.proposed_unit || !Number.isFinite(value) || value <= 0) {
      blockers.push({ code: "UNSUPPORTED_OR_INVALID_FACT", candidate_id: candidateId, product_id: productId, field });
      continue;
    }
    if (field === "serving_count_verified" && !Number.isInteger(value)) {
      blockers.push({ code: "SERVING_COUNT_MUST_BE_INTEGER", candidate_id: candidateId, product_id: productId, field });
      continue;
    }
    if (flags.some((flag) => UNSAFE_FLAGS.test(flag))) {
      blockers.push({ code: "UNSAFE_WARNING_FLAG", candidate_id: candidateId, product_id: productId, field });
      continue;
    }
    const key = `${productId}|${field}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ candidate, productId, field, value });
  }
  const changesByProduct = new Map();
  for (const group of groups.values()) {
    const values = new Set(group.map((item) => String(item.value)));
    if (values.size !== 1) {
      blockers.push({
        code: "CONFLICTING_APPROVED_VALUES",
        product_id: group[0].productId,
        field: group[0].field,
        candidate_ids: group.map((item) => String(item.candidate.id)),
      });
      continue;
    }
    const { productId, field, value } = group[0];
    const product = productById.get(productId);
    if (!product) {
      blockers.push({ code: "PRODUCT_NOT_FOUND", product_id: productId, field });
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
    changesByProduct.get(productId).changes[field] = {
      before,
      after: value,
      no_change: before === value,
      evidence: group.map((item) => candidateEvidence(item.candidate)),
    };
    if (NUTRITION_SOURCE_FIELDS.has(field)) {
      const verifiedBefore = product.nutrition_verified === true;
      const existing = changesByProduct.get(productId).changes.nutrition_verified;
      const evidence = group.map((item) => candidateEvidence(item.candidate));
      changesByProduct.get(productId).changes.nutrition_verified = {
        before: verifiedBefore,
        after: true,
        no_change: verifiedBefore,
        derived_from_reviewed_nutrition: true,
        evidence: existing ? [...existing.evidence, ...evidence] : evidence,
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
      blockers.push({
        code: "PACK_SIZE_CHANGE_REQUIRES_VARIANT_TRANSITION",
        product_id: update.product_id,
        before_net_weight_g: beforeWeight,
        proposed_net_weight_g: afterWeight,
      });
    }
    const servingCount = effective("serving_count_verified");
    const servingSize = effective("serving_size_g");
    const packageTolerance = afterWeight === null ? null : Math.max(1, afterWeight * 0.01);
    if (afterWeight !== null && servingCount !== null && servingSize !== null &&
        servingCount * servingSize > afterWeight + packageTolerance) {
      blockers.push({
        code: "PACKAGE_SERVING_MISMATCH",
        product_id: update.product_id,
        net_weight_g: afterWeight,
        serving_count_verified: servingCount,
        serving_size_g: servingSize,
        implied_weight_g: servingCount * servingSize,
      });
    }
  }
  const core = {
    schema_version: 2,
    kind: PLAN_KIND,
    run_id: runId,
    generated_at: new Date(generatedAt).toISOString(),
    status: blockers.length ? "BLOCKED" : "READY_FOR_EXPLICIT_APPLY",
    allowed_fields: ALLOWED_FIELDS,
    source_candidate_ids: candidates.map((candidate) => String(candidate.id)).sort((a, b) => Number(a) - Number(b)),
    blockers,
    product_updates: productUpdates,
    database_writes: 0,
  };
  return { ...core, plan_fingerprint: fingerprint("APPROVED_UPDATE_PLAN", core) };
}

function validatePlan(plan) {
  if (!plan || plan.schema_version !== 2 || plan.kind !== PLAN_KIND ||
      plan.status !== "READY_FOR_EXPLICIT_APPLY" || !Array.isArray(plan.allowed_fields) ||
      JSON.stringify(plan.allowed_fields) !== JSON.stringify(ALLOWED_FIELDS) ||
      !Array.isArray(plan.source_candidate_ids) || !plan.source_candidate_ids.length ||
      !Array.isArray(plan.blockers) || plan.blockers.length || !Array.isArray(plan.product_updates)) {
    fail("Approved product update plan is invalid or blocked");
  }
  const core = { ...plan };
  delete core.plan_fingerprint;
  if (plan.plan_fingerprint !== fingerprint("APPROVED_UPDATE_PLAN", core)) fail("Approved product update plan fingerprint mismatch");
  validateRunId(plan.run_id);
  for (const product of plan.product_updates) {
    if (!positiveId(product.product_id) || !product.changes || typeof product.changes !== "object") fail("Invalid product update entry");
    for (const [field, change] of Object.entries(product.changes)) {
      const validEvidence = Array.isArray(change?.evidence) && change.evidence.length &&
        change.evidence.every((evidence) => Number.isFinite(evidence.proposed_value) && evidence.proposed_value > 0 &&
          Number.isFinite(evidence.source_value) && evidence.source_value > 0 &&
          typeof evidence.owner_corrected === "boolean" &&
          evidence.owner_corrected === (evidence.proposed_value !== evidence.source_value));
      const validDerivedVerification = field === "nutrition_verified" && change && change.after === true &&
        typeof change.before === "boolean" && change.derived_from_reviewed_nutrition === true &&
        validEvidence &&
        change.evidence.every((evidence) => NUTRITION_SOURCE_FIELDS.has(evidence.source_field) &&
          Number.isFinite(evidence.source_value) && evidence.source_value > 0);
      const validNumericChange = FIELDS.includes(field) && change && Number.isFinite(change.after) && change.after > 0 &&
        (change.before === null || Number.isFinite(change.before)) && validEvidence;
      if (!validDerivedVerification && !validNumericChange) {
        fail("Invalid product change in approved plan");
      }
    }
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

async function loadApprovedCandidates(supabase, runId, candidateIds) {
  const query = supabase.from("nutrition_candidates")
    .select("id,product_id,proposed_field,proposed_value,approved_value,proposed_unit,confidence,source_url,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint")
    .eq("run_id", runId).eq("status", "approved").in("id", candidateIds).order("id", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function loadApprovedCandidatesForRun(supabase, runId) {
  const { data, error } = await supabase.from("nutrition_candidates")
    .select("id,product_id,proposed_field,proposed_value,approved_value,proposed_unit,confidence,source_url,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint")
    .eq("run_id", runId).eq("status", "approved").order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadProducts(supabase, productIds) {
  if (!productIds.length) return [];
  const { data, error } = await supabase.from("products")
    .select(`id,name,${ALLOWED_FIELDS.join(",")}`).in("id", productIds);
  if (error) throw error;
  return data || [];
}

async function updateProduct(supabase, product) {
  const patch = {};
  let query = supabase.from("products");
  for (const [field, change] of Object.entries(product.changes)) {
    if (!change.no_change) patch[field] = change.after;
  }
  if (!Object.keys(patch).length) return { changed: false };
  query = query.update(patch).eq("id", product.product_id);
  for (const [field, change] of Object.entries(product.changes)) {
    query = change.before === null ? query.is(field, null) : query.eq(field, change.before);
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) fail(`Product ${product.product_id} changed after plan generation`);
  return { changed: true, fields: Object.keys(patch) };
}

function createSupabase(dependencies) {
  return dependencies.supabase || createCandidateSupabase();
}

module.exports = {
  ALLOWED_FIELDS,
  AUDIT_KIND,
  PLAN_KIND,
  buildApprovedPlan,
  createSupabase,
  loadApprovedCandidates,
  loadApprovedCandidatesForRun,
  loadProducts,
  resolveTmpFile,
  updateProduct,
  validatePlan,
  validateRunId,
  writePlan,
};
