const { reasonList } = require("./automation-review-publisher");

const STANDARD_CAPTURE_FILES = Object.freeze({
  report: "production-dry-run.json",
  diagnostic: "production-preflight-diagnostic.json",
  baseline: "production-db-baseline.json",
});
const STANDARD_SEALED_FILES = Object.freeze({
  report: "automation-review-classification.json",
  diagnostic: "automation-review-preflight-diagnostic.json",
  baseline: "automation-review-db-baseline.json",
});
const WHEY_CAPTURE_FILES = Object.freeze({
  report: "production-preflight-dry-run.json",
  diagnostic: "production-preflight-diagnostic.json",
  baseline: "production-db-baseline.json",
  immutable: "production-preflight-immutable.json",
});
const WHEY_SEALED_FILES = Object.freeze({
  report: "automation-review-classification.json",
  diagnostic: "automation-review-preflight-diagnostic.json",
  baseline: "automation-review-db-baseline.json",
  immutable: "automation-review-preflight-immutable.json",
});

function noWriteDiagnostic(diagnostic, label, invariant) {
  invariant(diagnostic.result === "PASS" && diagnostic.failure_stage == null, `${label} preflight diagnostic is not PASS`);
  for (const key of ["database_writes_attempted", "database_writes_completed", "business_writes_completed", "control_writes_completed", "approvals_created", "approvals_consumed", "recovery_calls"]) {
    invariant(Number(diagnostic[key] || 0) === 0, `${label} preflight diagnostic contains writes`);
  }
}

function normalizeMissingRows(report, baselineByOffer, label, invariant) {
  invariant(Array.isArray(report.review_rows), `${label} review rows are missing`);
  return [...report.review_rows].map((review) => {
    const offerId = String(review.offer_id);
    const before = baselineByOffer.get(offerId);
    invariant(before, `${label} baseline missing for review offer ${offerId}`);
    invariant(review.reason === "SOURCE_VARIANT_MISSING", `${label} review reason drifted for offer ${offerId}`);
    invariant(String(review.external_product_id) === String(before.external_product_id) && String(review.external_variant_id) === String(before.external_variant_id), `${label} source identity drift for offer ${offerId}`);
    return {
      offer_id: offerId,
      retailer_product_id: String(before.mapping_id),
      external_product_id: String(before.external_product_id),
      external_variant_id: String(before.external_variant_id),
      old_price: String(before.price),
      new_price: String(before.price),
      old_stock: before.in_stock === true,
      new_stock: before.in_stock === true,
      action: "SOURCE_MISSING",
      reason: review.reason,
    };
  }).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
}

function validateStandard(profile, context) {
  const { report, diagnostic, baselineByOffer, invariant, sameJson, sortedIds } = context;
  const label = profile.retailer.name;
  const executableCount = Number(report.executable_plan_count);
  const reviewCount = Number(report.review_row_count);
  invariant(Number.isInteger(executableCount) && executableCount >= 0 && Number(report.executed_plan_count) === 0, `${label} dry-run executable scope drifted`);
  invariant(Number.isInteger(reviewCount) && reviewCount >= 0 && reviewCount <= profile.maximumReviewCount, `${label} review scope drifted`);
  invariant(executableCount + reviewCount === profile.approvedMappingCount, `${label} ordinary partition is incomplete`);
  noWriteDiagnostic(diagnostic, label, invariant);

  const executionIds = sortedIds(Array.isArray(report.execution_offer_ids) ? report.execution_offer_ids : []);
  const verificationIds = sortedIds(Array.isArray(report.verification_offer_ids) ? report.verification_offer_ids : []);
  const stockChangeIds = sortedIds(Array.isArray(report.stock_change_offer_ids) ? report.stock_change_offer_ids : []);
  invariant(executionIds.length === executableCount && stockChangeIds.length === 0, `${label} executable offer IDs drifted`);
  invariant(verificationIds.length === executableCount, `${label} verification offer IDs drifted`);
  sameJson(executionIds, verificationIds, `${label} executable and verified scopes differ`);

  if (profile.reviewType === "stock") {
    invariant(Number(report.classification?.VERIFY_NO_CHANGE || 0) === executableCount && Number(report.classification?.UPDATE_STOCK || 0) === reviewCount, `${label} ordinary classification drifted`);
  } else {
    invariant(Number(report.classification?.VERIFY_NO_CHANGE || 0) === executableCount && Object.entries(report.classification || {}).every(([action, count]) => action === "VERIFY_NO_CHANGE" || Number(count) === 0), `${label} pre-execution scope contains a commercial action`);
  }
  const classifierScope = diagnostic.classifier_summary?.scope;
  invariant(classifierScope && Number(classifierScope.blocked_rows || 0) === 0 && classifierScope.reconciled === true && Number(classifierScope.reconciled_total) === executableCount, `${label} preflight classifier scope drifted`);
  sameJson(sortedIds(classifierScope.scope_row_ids || []), executionIds, `${label} preflight classifier IDs drifted`);
  sameJson(diagnostic.classifier_summary.action_counts || {}, report.classification || {}, `${label} preflight classifier actions drifted`);

  const changedRows = profile.reviewType === "stock"
    ? [...diagnostic.classifier_summary.changed_rows].map((row) => ({
      offer_id: String(row.offer_id), retailer_product_id: String(row.retailer_product_id),
      external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id),
      old_price: String(row.old_price), new_price: String(row.new_price),
      old_stock: row.old_stock === true, new_stock: row.new_stock === true, action: row.action,
    })).sort((a, b) => Number(a.offer_id) - Number(b.offer_id))
    : normalizeMissingRows(report, baselineByOffer, label, invariant);
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  if (profile.reviewType === "stock") sameJson(reviewIds, sortedIds(report.deferred_changed_offer_ids), `${label} deferred review IDs drifted`);
  return { executableCount, executionIds, changedRows, reviewIds };
}

function validateWhey(profile, context) {
  const { report, diagnostic, baselineByOffer, files, invariant, sameJson, sortedIds } = context;
  const label = profile.retailer.name;
  const executableCount = Number(report.executable_plan_count);
  const reviewCount = Number(report.review_row_count);
  invariant(Number.isInteger(executableCount) && executableCount >= 0 && Number(report.executed_plan_count) === 0, `${label} dry-run executable scope drifted`);
  invariant(Number.isInteger(reviewCount) && reviewCount >= 0 && reviewCount <= profile.maximumReviewCount, `${label} review scope drifted`);
  invariant(executableCount + reviewCount === profile.approvedMappingCount, `${label} ordinary partition is incomplete`);
  noWriteDiagnostic(diagnostic, label, invariant);
  invariant(diagnostic.commit && /^[0-9a-f]{40}$/.test(diagnostic.commit), `${label} diagnostic commit is missing`);

  const { loadImmutablePreflight } = require("../whey-okay-offer-refresh");
  const loaded = loadImmutablePreflight(files.immutable, { target: "production", mode: "apply", isolateUnsafe: true }, {
    currentHead: diagnostic.commit,
    now: new Date(diagnostic.completed_at || diagnostic.timestamp),
  });
  const run = loaded.run;
  invariant(run.approvedMappingCount === profile.approvedMappingCount, `${label} immutable approved scope drifted`);
  invariant(run.feed?.semantic_fingerprint === report.source?.semantic_fingerprint, `${label} immutable source fingerprint drifted`);
  invariant(run.classification?.rows?.length === executableCount && run.classification?.quarantined_rows?.length === reviewCount, `${label} immutable partition drifted`);
  const executionIds = sortedIds(run.classification.rows.map((row) => row.offer_id));
  const artifactIds = sortedIds(run.artifacts.flatMap((artifact) => artifact.rows.map((row) => row.offer_id)));
  sameJson(executionIds, artifactIds, `${label} executable artifacts drifted`);
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  sameJson(reviewIds, sortedIds(run.classification.quarantined_rows.map((row) => row.offer_id)), `${label} quarantined review scope drifted`);
  sameJson(reviewIds, sortedIds(run.discovery.missing_rows.map((row) => row.offer_id)), `${label} missing-source scope drifted`);
  invariant(executionIds.every((offerId) => !reviewIds.includes(offerId)), `${label} executable and review scopes overlap`);
  invariant(new Set([...executionIds, ...reviewIds]).size === profile.approvedMappingCount, `${label} approved scope is incomplete`);
  const actionCounts = {};
  for (const row of run.classification.rows) actionCounts[row.action] = (actionCounts[row.action] || 0) + 1;
  sameJson(actionCounts, report.classification || {}, `${label} classification counts drifted`);
  const changedRows = normalizeMissingRows(report, baselineByOffer, label, invariant);
  return { executableCount, executionIds, changedRows, reviewIds, codeCommit: run.head };
}

function reviewCard(profile, beforeState, changed) {
  if (profile.reviewType === "stock") return {
    proposedState: { ...beforeState, in_stock: changed.new_stock },
    reasonCodes: "STOCK_CHANGE", confidence: "HIGH", sourcePrice: changed.new_price,
    reviewKind: "COMMERCIAL_CHANGE", operationType: "UPDATE_STOCK", evidenceReason: "OWNER_DEFERRED_STOCK_REVIEW",
  };
  return {
    proposedState: { catalogue_action: "KEEP_UNCHANGED", identity_review: "READ_ONLY", automatic_action: false },
    reasonCodes: "SOURCE_MISSING", confidence: "LOW", sourcePrice: null,
    reviewKind: "IDENTITY_CONFLICT", operationType: "MANUAL_REVIEW_IDENTITY", evidenceReason: "SOURCE_VARIANT_MISSING",
  };
}

function matchesActiveReview(profile, row) {
  return profile.reviewType === "stock"
    ? row.review_kind === "COMMERCIAL_CHANGE" && row.operation_type === "UPDATE_STOCK" && reasonList(row.reason_codes).includes("STOCK_CHANGE")
    : row.review_kind === "IDENTITY_CONFLICT" && row.operation_type === "MANUAL_REVIEW_IDENTITY" && reasonList(row.reason_codes).includes("SOURCE_MISSING");
}

function profile(values) {
  return Object.freeze({
    ...values,
    captureFiles: values.captureFiles || STANDARD_CAPTURE_FILES,
    sealedFiles: values.sealedFiles || STANDARD_SEALED_FILES,
    sourceFingerprint: values.sourceFingerprint || ((report) => report.source?.fingerprint),
    validate: values.validate || validateStandard,
    reviewCard(beforeState, changed) { return reviewCard(this, beforeState, changed); },
    matchesActiveReview(row) { return matchesActiveReview(this, row); },
  });
}

const PROFILES = Object.freeze({
  "fit-house": profile({ key: "fit-house", retailer: Object.freeze({ id: "9", name: "Fit House", slug: "fit-house" }), approvedMappingCount: 286, maximumReviewCount: 14, sourceDirectory: "fit-house-offer-refresh", artifactPrefix: "fit-house-offer-refresh", reconciliationFile: "fit-house-reconciliation-dry-run.json", contractName: "fit-house-automation-review-source-v1", workflow: ".github/workflows/fit-house-offer-refresh.yml", workflowName: "Shared Retailer Offer Refresh", reviewType: "stock" }),
  "10-reps": profile({ key: "10-reps", retailer: Object.freeze({ id: "14", name: "10 Reps", slug: "10-reps" }), approvedMappingCount: 950, maximumReviewCount: 16, sourceDirectory: "10reps-offer-refresh", artifactPrefix: "10reps-offer-refresh", reconciliationFile: "10reps-reconciliation-dry-run.json", contractName: "10-reps-automation-review-source-v1", workflow: ".github/workflows/fit-house-offer-refresh.yml", workflowName: "Shared Retailer Offer Refresh", reviewType: "source-missing" }),
  "whey-okay": profile({ key: "whey-okay", retailer: Object.freeze({ id: "3", name: "Whey Okay", slug: "whey-okay" }), approvedMappingCount: 589, maximumReviewCount: 10, sourceDirectory: "whey-okay-offer-refresh", artifactPrefix: "whey-okay-offer-refresh", reconciliationFile: "whey-okay-reconciliation-dry-run.json", contractName: "whey-okay-automation-review-source-v1", workflow: ".github/workflows/whey-okay-offer-refresh.yml", workflowName: "Whey Okay Offer Refresh", reviewType: "source-missing", captureFiles: WHEY_CAPTURE_FILES, sealedFiles: WHEY_SEALED_FILES, sourceFingerprint: (report) => report.source?.semantic_fingerprint, validate: validateWhey }),
});

function profileFor(value = "fit-house", invariant = (condition, message) => { if (!condition) throw new Error(message); }) {
  const selected = PROFILES[value];
  invariant(selected, `Unknown retailer review profile ${value}`);
  return selected;
}

module.exports = { PROFILES, profileFor };
