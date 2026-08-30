const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson } = require("./canonical-json");

const CONTRACT_FILE = "production-dry-run-contract.json";
const REPORT_FILE = "production-dry-run.json";
const KIND = "ebay-offer-refresh-executable-scope-contract-v2";
const WORKFLOW = ".github/workflows/ebay-offer-refresh.yml";
const REPOSITORY = "SupplementScout/supplementscout";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function invariant(condition, message) { if (!condition) throw new Error(message); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function canonicalHash(value) { return sha256(canonicalJson(value)); }
function fileSha256(file) { return sha256(fs.readFileSync(file)); }
function sortedStrings(values) { return [...new Set((values || []).map(String))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)); }
function withoutTechnicalTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutTechnicalTimestamps);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["source_captured_at", "captured_at", "created_at", "updated_at"].includes(key))
    .map(([key, item]) => [key, withoutTechnicalTimestamps(item)]));
}
function serializable(value) { return JSON.parse(JSON.stringify(value)); }
function money(value) {
  if (value?.value === undefined || value?.value === null) return null;
  const number = Number(value.value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value.value);
}
function stableAffiliateUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.searchParams.delete("amdata");
    url.searchParams.sort();
    return url.toString();
  } catch { return String(value); }
}

function buildSemanticSourceRows(scopes, evaluations) {
  return scopes.map((scope, index) => serializable((() => {
    const value = evaluations[index] || {};
    return {
      offer_id: String(scope.offer_id), mapping_id: String(scope.retailer_product_id), retailer_id: String(scope.retailer_id),
      product_id: String(scope.product_id), product_variant_id: String(scope.product_variant_id),
      external_product_id: String(scope.external_product_id), external_variant_id: String(scope.external_variant_id),
      external_url: scope.external_url || null, affiliate_url: scope.affiliate_url || null,
      returned_item_id: value.item_id || null, returned_legacy_item_id: value.legacy_item_id || null,
      returned_gtin: value.returned_gtin || null, decision: value.decision || null,
      blockers: [...(value.blockers || [])].sort(), review_reasons: [...(value.review_reasons || [])].sort(),
      source_error: value.source_error || null, continuity_tier: value.continuity?.tier || null,
      seller: value.seller?.username || null, seller_account_type: value.seller?.account_type || null,
      price: money(value.item_price), shipping: money(value.uk_shipping), total: money(value.delivered_price),
      affiliate_ready: value.affiliate_ready === true, affiliate_url_returned: stableAffiliateUrl(value.affiliate_url),
    };
  })())).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
}

function buildSemanticPlanRows(preparedRows, reviewRows, blockedRows) {
  const executable = preparedRows.filter((row) => row.action === "VERIFY_NO_CHANGE").map((row) => {
    const entry = row.approved.entry, plan = entry.resolved_plan;
    const after = withoutTechnicalTimestamps(plan.offer.values);
    delete after.last_checked_at;
    return {
      offer_id: String(row.offer_id), operation_type: row.action, importer_operation_type: entry.operation_type || null,
      plan_kind: entry.plan_kind, retailer_id: String(entry.retailer_id),
      product: withoutTechnicalTimestamps(plan.product), product_variant: withoutTechnicalTimestamps(plan.product_variant),
      retailer: withoutTechnicalTimestamps(plan.retailer), retailer_product: withoutTechnicalTimestamps(plan.retailer_product),
      offer: { action: plan.offer.action, id: String(plan.offer.id), values: after },
      price_history: withoutTechnicalTimestamps(plan.price_history),
      before_state: withoutTechnicalTimestamps(plan.expected_state),
    };
  }).map(serializable).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const review = [...reviewRows].map(withoutTechnicalTimestamps).map(serializable).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const blocked = [...blockedRows].map(withoutTechnicalTimestamps).map(serializable).sort((a, b) => Number(a.offer_id || 0) - Number(b.offer_id || 0));
  return { executable, review, blocked };
}

function inventoryMappingRows(rows) {
  const fields = ["offer_id", "mapping_id", "retailer_id", "product_id", "product_variant_id", "external_product_id", "external_variant_id", "external_url", "affiliate_url"];
  return [...rows].map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])))
    .sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
}

function bindSemanticEvidence(report, sourceRows, planRows) {
  const rows = [...sourceRows].sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const executableIds = sortedStrings(report.execution_offer_ids);
  const reviewIds = sortedStrings(report.review_rows.map((row) => row.offer_id));
  const select = (ids) => { const wanted = new Set(ids); return rows.filter((row) => wanted.has(String(row.offer_id))); };
  const executableRows = select(executableIds), reviewRows = select(reviewIds);
  const executablePlans = planRows.executable.filter((row) => executableIds.includes(String(row.offer_id)));
  const planBinding = { executable_offer_ids: executableIds, executable: executablePlans, expected_deltas: report.expected_deltas };
  const sourceRowFingerprints = rows.map((row) => ({ offer_id: String(row.offer_id), mapping_id: String(row.mapping_id), semantic_fingerprint: canonicalHash(row), scope: executableIds.includes(String(row.offer_id)) ? "EXECUTABLE" : reviewIds.includes(String(row.offer_id)) ? "REVIEW" : "BLOCKED" }));
  const planRowFingerprints = executablePlans.map((row) => ({ offer_id: String(row.offer_id), semantic_fingerprint: canonicalHash(row), scope: "EXECUTABLE" }));
  const fullCaptureFingerprint = canonicalHash(rows);
  const executableSourceFingerprint = canonicalHash(executableRows);
  const reviewScopeFingerprint = canonicalHash(reviewRows);
  return {
    ...report,
    source_fingerprint: fullCaptureFingerprint,
    full_capture_fingerprint: fullCaptureFingerprint,
    executable_source_fingerprint: executableSourceFingerprint,
    review_scope_fingerprint: reviewScopeFingerprint,
    plan_fingerprint: canonicalHash(planBinding),
    source_row_fingerprints: sourceRowFingerprints,
    plan_row_fingerprints: planRowFingerprints,
    semantic_source_rows: rows,
    semantic_plan_rows: planRows,
    semantic_plan_binding: planBinding,
  };
}

function inventoryJsonFiles(directory) {
  return fs.readdirSync(directory).filter((name) => name.endsWith(".json") && name !== CONTRACT_FILE).sort()
    .map((name) => ({ path: name, sha256: fileSha256(path.join(directory, name)) }));
}

function writeDryRunContract(directory, report, env = process.env, now = new Date()) {
  invariant(env.GITHUB_ACTIONS === "true" && env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/main", "Approval contract may only be emitted by a manual main-branch GitHub dry-run");
  invariant(/^[0-9]+$/.test(env.GITHUB_RUN_ID || "") && /^[0-9a-f]{40}$/.test(env.GITHUB_SHA || ""), "Dry-run GitHub correlation is missing");
  invariant(report.commit_sha === env.GITHUB_SHA, "Dry-run report commit mismatch");
  const reportPath = path.join(directory, REPORT_FILE);
  invariant(fs.existsSync(reportPath), "Canonical dry-run report is missing");
  const inventory = inventoryJsonFiles(directory);
  invariant(inventory.some((entry) => entry.path === REPORT_FILE), "Canonical report is absent from artifact inventory");
  const manifest = {
    schema_version: 2, kind: KIND, repository: REPOSITORY, workflow: WORKFLOW,
    run_id: String(env.GITHUB_RUN_ID), run_attempt: String(env.GITHUB_RUN_ATTEMPT || "1"), commit_sha: env.GITHUB_SHA,
    created_at: now.toISOString(), expires_at: new Date(now.getTime() + MAX_AGE_MS).toISOString(),
    report_file: REPORT_FILE, report_sha256: fileSha256(reportPath), artifact_content_sha256: canonicalHash(inventory),
    source_fingerprint: report.source_fingerprint, full_capture_fingerprint: report.full_capture_fingerprint,
    executable_source_fingerprint: report.executable_source_fingerprint, review_scope_fingerprint: report.review_scope_fingerprint,
    plan_fingerprint: report.plan_fingerprint,
    approved_mapping_count: report.approved_mapping_count, executable_plan_count: report.executable_plan_count,
    review_row_count: report.review_row_count, blocked_row_count: report.blocked_row_count,
    executable_offer_ids: sortedStrings(report.execution_offer_ids), review_offer_ids: sortedStrings(report.review_rows.map((row) => row.offer_id)),
    blocked_offer_ids: sortedStrings(report.blocked_rows.map((row) => row.offer_id)),
    executable_operation_types: Object.freeze(["VERIFY_NO_CHANGE"]), expected_deltas: report.expected_deltas,
    source_row_fingerprints: report.source_row_fingerprints, plan_row_fingerprints: report.plan_row_fingerprints,
    semantic_source_rows: report.semantic_source_rows,
    semantic_plan_rows: report.semantic_plan_rows, semantic_plan_binding: report.semantic_plan_binding,
    files: inventory,
  };
  const target = path.join(directory, CONTRACT_FILE);
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return { manifest, manifestSha256: fileSha256(target), reportSha256: manifest.report_sha256, artifactContentSha256: manifest.artifact_content_sha256 };
}

function loadAndVerifyContract(directory, approved, now = new Date()) {
  const contractPath = path.join(directory, CONTRACT_FILE), reportPath = path.join(directory, REPORT_FILE);
  invariant(fs.existsSync(contractPath) && fs.existsSync(reportPath), "Approved artifact contract or report is missing");
  invariant(fileSha256(contractPath) === approved.manifestSha256, "Approved manifest SHA-256 mismatch");
  const manifest = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  invariant(manifest.schema_version === 2 && manifest.kind === KIND && manifest.repository === REPOSITORY && manifest.workflow === WORKFLOW, "Approved artifact contract identity mismatch");
  invariant(manifest.run_id === approved.runId && manifest.commit_sha === approved.commitSha, "Approved run or commit binding mismatch");
  invariant(manifest.full_capture_fingerprint === approved.fullCaptureFingerprint && manifest.executable_source_fingerprint === approved.executableSourceFingerprint && manifest.review_scope_fingerprint === approved.reviewScopeFingerprint && manifest.plan_fingerprint === approved.planFingerprint, "Approved capture, executable, review or plan fingerprint mismatch");
  invariant(manifest.report_sha256 === approved.reportSha256 && fileSha256(reportPath) === approved.reportSha256, "Approved report SHA-256 mismatch");
  invariant(Number.isFinite(Date.parse(manifest.expires_at)) && Date.parse(manifest.expires_at) > now.getTime(), "Approved dry-run artifact expired");
  const inventory = inventoryJsonFiles(directory);
  invariant(canonicalJson(inventory) === canonicalJson(manifest.files), "Approved artifact file set or content changed");
  invariant(canonicalHash(inventory) === manifest.artifact_content_sha256, "Approved artifact content SHA-256 mismatch");
  invariant(report.commit_sha === approved.commitSha && report.full_capture_fingerprint === approved.fullCaptureFingerprint && report.executable_source_fingerprint === approved.executableSourceFingerprint && report.review_scope_fingerprint === approved.reviewScopeFingerprint && report.plan_fingerprint === approved.planFingerprint, "Approved report correlation mismatch");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(report.result) && report.mode === "dry-run" && report.approved_mapping_count === 237 && report.executable_plan_count > 0 && report.review_row_count + report.executable_plan_count === 237 && report.blocked_row_count === 0 && report.executed_plan_count === 0, "Approved eBay dry-run scope mismatch");
  const exactScope = Array.from({ length: 237 }, (_, index) => String(2539 + index));
  const executableIds = sortedStrings(report.execution_offer_ids), reviewIds = sortedStrings(report.review_rows.map((row) => row.offer_id));
  invariant(canonicalJson(sortedStrings([...executableIds, ...reviewIds])) === canonicalJson(exactScope) && !executableIds.includes("2686"), "Approved eBay offer partition mismatch");
  invariant(report.semantic_source_rows.length === 237 && canonicalJson(sortedStrings(report.semantic_source_rows.map((row) => row.offer_id))) === canonicalJson(exactScope) && report.semantic_plan_rows.executable.length === report.executable_plan_count && report.semantic_plan_rows.blocked.length === 0 && report.semantic_plan_rows.executable.every((row) => row.operation_type === "VERIFY_NO_CHANGE") && canonicalJson(sortedStrings(report.semantic_plan_rows.executable.map((row) => row.offer_id))) === canonicalJson(executableIds), "Approved semantic plan scope mismatch");
  const rebound = bindSemanticEvidence({ ...report }, report.semantic_source_rows, report.semantic_plan_rows);
  invariant(rebound.full_capture_fingerprint === approved.fullCaptureFingerprint && rebound.executable_source_fingerprint === approved.executableSourceFingerprint && rebound.review_scope_fingerprint === approved.reviewScopeFingerprint && rebound.plan_fingerprint === approved.planFingerprint, "Approved semantic evidence fingerprint mismatch");
  invariant(manifest.report_sha256 === fileSha256(reportPath) && manifest.full_capture_fingerprint === report.full_capture_fingerprint && manifest.executable_source_fingerprint === report.executable_source_fingerprint && manifest.review_scope_fingerprint === report.review_scope_fingerprint && manifest.plan_fingerprint === report.plan_fingerprint && canonicalJson(manifest.executable_offer_ids) === canonicalJson(executableIds) && canonicalJson(manifest.review_offer_ids) === canonicalJson(reviewIds) && canonicalJson(manifest.source_row_fingerprints) === canonicalJson(rebound.source_row_fingerprints) && canonicalJson(manifest.plan_row_fingerprints) === canonicalJson(rebound.plan_row_fingerprints) && canonicalJson(report.source_row_fingerprints) === canonicalJson(rebound.source_row_fingerprints) && canonicalJson(report.plan_row_fingerprints) === canonicalJson(rebound.plan_row_fingerprints) && canonicalJson(manifest.semantic_source_rows) === canonicalJson(report.semantic_source_rows) && canonicalJson(manifest.semantic_plan_binding) === canonicalJson(report.semantic_plan_binding), "Approved manifest and report content binding mismatch");
  return { manifest, report, contractPath };
}

function verifyFreshReport(approved, fresh) {
  invariant(fresh.approved_mapping_count === approved.report.approved_mapping_count && fresh.blocked_row_count === 0 && fresh.semantic_source_rows.length === approved.report.semantic_source_rows.length, "Fresh inventory or global blocker drift");
  invariant(canonicalJson(inventoryMappingRows(fresh.semantic_source_rows)) === canonicalJson(inventoryMappingRows(approved.report.semantic_source_rows)), "Fresh inventory or mapping drift");
  const approvedExecutable = sortedStrings(approved.report.execution_offer_ids), approvedReview = sortedStrings(approved.report.review_rows.map((row) => row.offer_id));
  const freshCandidates = new Set(fresh.execution_offer_ids.map(String));
  invariant(approvedExecutable.every((id) => freshCandidates.has(id)), "Fresh approved executable row missing or no longer VERIFY_NO_CHANGE");
  const sourceMap = new Map(fresh.semantic_source_rows.map((row) => [String(row.offer_id), row]));
  const executableRows = approvedExecutable.map((id) => sourceMap.get(id));
  invariant(executableRows.every(Boolean) && canonicalHash(executableRows) === approved.report.executable_source_fingerprint, "Fresh executable_source_fingerprint drift");
  const planMap = new Map(fresh.semantic_plan_rows.executable.map((row) => [String(row.offer_id), row]));
  const executablePlans = approvedExecutable.map((id) => planMap.get(id));
  invariant(executablePlans.every(Boolean), "Fresh approved executable plan missing");
  const expectedDeltas = approved.report.expected_deltas;
  const planBinding = { executable_offer_ids: approvedExecutable, executable: executablePlans, expected_deltas: expectedDeltas };
  invariant(canonicalHash(planBinding) === approved.report.plan_fingerprint, "Fresh approved executable plan fingerprint drift");
  const freshReviewById = new Map(fresh.review_rows.map((row) => [String(row.offer_id), row]));
  const reviewRows = approvedReview.map((id) => freshReviewById.get(id) || ({ offer_id: id, review_type: "UNAPPROVED_EXECUTABLE_CANDIDATE", action: fresh.classifications?.[id] || "VERIFY_NO_CHANGE" }));
  const reviewSourceRows = approvedReview.map((id) => sourceMap.get(id));
  invariant(reviewSourceRows.every(Boolean), "Fresh review inventory drift");
  const freshFullCaptureFingerprint = canonicalHash([...fresh.semantic_source_rows].sort((a, b) => Number(a.offer_id) - Number(b.offer_id)));
  const freshReviewScopeFingerprint = canonicalHash(reviewSourceRows);
  const boundedPlanRows = { executable: executablePlans, review: reviewRows, blocked: [] };
  const bounded = bindSemanticEvidence({
    ...fresh,
    result: reviewRows.length ? "PASS_WITH_REVIEW" : "PASS",
    executable_plan_count: approvedExecutable.length,
    review_row_count: reviewRows.length,
    blocked_row_count: 0,
    execution_offer_ids: approvedExecutable,
    review_rows: reviewRows,
    blocked_rows: [],
    classification: { VERIFY_NO_CHANGE: approvedExecutable.length },
    expected_deltas: expectedDeltas,
    fresh_candidate_classification: fresh.classification,
    fresh_candidate_executable_offer_ids: sortedStrings(fresh.execution_offer_ids),
    drift_scope: freshFullCaptureFingerprint === approved.report.full_capture_fingerprint ? "NONE" : freshReviewScopeFingerprint === approved.report.review_scope_fingerprint ? "EXECUTABLE_OR_GLOBAL" : "REVIEW_ONLY",
  }, fresh.semantic_source_rows, boundedPlanRows);
  invariant(bounded.executable_source_fingerprint === approved.report.executable_source_fingerprint && bounded.plan_fingerprint === approved.report.plan_fingerprint, "Bounded manual executable contract drift");
  bounded.approved_full_capture_fingerprint = approved.report.full_capture_fingerprint;
  bounded.approved_review_scope_fingerprint = approved.report.review_scope_fingerprint;
  bounded.fresh_full_capture_fingerprint = bounded.full_capture_fingerprint;
  bounded.fresh_review_scope_fingerprint = bounded.review_scope_fingerprint;
  return bounded;
}

function verifyDatabaseBaseline(contract, baseline) {
  invariant(baseline?.result === "PASS" && baseline?.profile === "ebay-uk" && baseline.snapshot?.row_count === 237, "Artifact-bound DB baseline invalid");
  const rows = new Map(baseline.snapshot.rows.map((row) => [String(row.offer_id), row]));
  invariant(rows.size === 237 && canonicalJson(sortedStrings([...rows.keys()])) === canonicalJson(sortedStrings(contract.report.semantic_source_rows.map((row) => row.offer_id))), "Artifact-bound DB baseline offer scope drift");
  for (const planRow of contract.report.semantic_plan_rows.executable) {
    const current = rows.get(planRow.offer_id), before = planRow.before_state.offer, mapping = planRow.before_state.retailer_product;
    invariant(current, `Approved offer ${planRow.offer_id} missing from DB baseline`);
    const expected = {
      mapping_id: String(mapping.id), retailer_id: String(mapping.retailer_id), mapping_product_id: String(mapping.product_id), mapping_variant_id: String(mapping.product_variant_id),
      external_product_id: mapping.external_product_id, external_variant_id: mapping.external_variant_id, external_sku: mapping.external_sku,
      external_gtin: mapping.external_gtin, external_options: mapping.external_options, external_url: mapping.external_url,
      offer_id: String(before.id), offer_product_id: String(before.product_id), offer_variant_id: String(before.product_variant_id),
      price: String(before.price), shipping_cost: String(before.shipping_cost), total_price: String(before.total_price), in_stock: before.in_stock, url: before.url,
      last_checked_at: before.last_checked_at,
    };
    for (const [field, value] of Object.entries(expected)) invariant(canonicalJson(current[field]) === canonicalJson(value), `DB before-state drift for offer ${planRow.offer_id}: ${field}`);
  }
  return true;
}

function approvalConfirmation(planFingerprint, manifestSha256) { return `OWNER_APPROVED_EBAY_REFRESH:${planFingerprint}:${manifestSha256}`; }

function approvedFromEnv(env = process.env) {
  const approved = {
    runId: env.EBAY_APPROVED_DRY_RUN_ID,
    artifactId: env.EBAY_APPROVED_ARTIFACT_ID,
    commitSha: env.EBAY_APPROVED_COMMIT_SHA,
    fullCaptureFingerprint: env.EBAY_APPROVED_FULL_CAPTURE_FINGERPRINT,
    executableSourceFingerprint: env.EBAY_APPROVED_EXECUTABLE_SOURCE_FINGERPRINT,
    reviewScopeFingerprint: env.EBAY_APPROVED_REVIEW_SCOPE_FINGERPRINT,
    planFingerprint: env.EBAY_APPROVED_PLAN_FINGERPRINT,
    manifestSha256: env.EBAY_APPROVED_MANIFEST_SHA256,
    reportSha256: env.EBAY_APPROVED_REPORT_SHA256,
    ownerConfirmation: env.EBAY_REFRESH_OWNER_CONFIRMATION,
  };
  invariant(/^[1-9][0-9]*$/.test(approved.runId || "") && /^[1-9][0-9]*$/.test(approved.artifactId || ""), "Approved run or artifact ID is missing");
  for (const field of ["commitSha", "fullCaptureFingerprint", "executableSourceFingerprint", "reviewScopeFingerprint", "planFingerprint", "manifestSha256", "reportSha256"]) {
    const length = field === "commitSha" ? 40 : 64;
    invariant(new RegExp(`^[0-9a-f]{${length}}$`).test(approved[field] || ""), `Approved ${field} is missing or invalid`);
  }
  invariant(approved.ownerConfirmation === approvalConfirmation(approved.planFingerprint, approved.manifestSha256), "Exact artifact-bound owner confirmation is missing");
  return approved;
}

module.exports = { CONTRACT_FILE, KIND, MAX_AGE_MS, REPORT_FILE, REPOSITORY, WORKFLOW, approvalConfirmation, approvedFromEnv, bindSemanticEvidence, buildSemanticPlanRows, buildSemanticSourceRows, canonicalHash, fileSha256, inventoryJsonFiles, inventoryMappingRows, loadAndVerifyContract, money, sha256, sortedStrings, stableAffiliateUrl, verifyDatabaseBaseline, verifyFreshReport, withoutTechnicalTimestamps, writeDryRunContract };
