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
const SIX_PACK_CAPTURE_FILES = Object.freeze({
  report: "production-preflight-report.json",
  artifact: "production-preflight-artifact.json",
  baseline: "production-db-baseline.json",
});
const SIX_PACK_SEALED_FILES = Object.freeze({
  report: "automation-review-classification.json",
  artifact: "automation-review-executable-artifact.json",
  baseline: "automation-review-db-baseline.json",
});

function noWriteDiagnostic(diagnostic, label, invariant) {
  invariant(diagnostic.result === "PASS" && diagnostic.failure_stage == null, `${label} preflight diagnostic is not PASS`);
  for (const key of ["database_writes_attempted", "database_writes_completed", "business_writes_completed", "control_writes_completed", "approvals_created", "approvals_consumed", "recovery_calls"]) {
    invariant(Number(diagnostic[key] || 0) === 0, `${label} preflight diagnostic contains writes`);
  }
}

function validateStandardCapture(profile, { report, diagnostic, invariant }) {
  const label = profile.retailer.name;
  const expectedResult = Number(report.review_row_count) > 0 ? "PASS_WITH_REVIEW" : "PASS";
  invariant(report.result === expectedResult && report.mode === "dry-run" && report.target === "production", `${label} pre-execution report is not publishable`);
  invariant(report.approved_mapping_count === profile.approvedMappingCount && report.blocked_row_count === 0, `${label} apply scope drifted`);
  invariant(diagnostic && diagnostic.approved_mapping_count === profile.approvedMappingCount && profile.sourceFingerprint({ source: diagnostic.source }) === profile.sourceFingerprint(report), `${label} preflight source binding drifted`);
}

function validateJonsCapture(profile, { report, diagnostic, invariant }) {
  const label = profile.retailer.name;
  const expectedResult = Number(report.review_row_count) > 0 ? "PASS_WITH_REVIEW" : "PASS";
  invariant(report.result === expectedResult && report.mode === "dry-run" && report.target === "production", `${label} pre-execution report is not publishable`);
  invariant(report.approved_mapping_count === profile.approvedMappingCount && report.blocked_row_count === 0, `${label} apply scope drifted`);
  invariant(diagnostic && diagnostic.approved_mapping_count === profile.approvedMappingCount, `${label} preflight source binding drifted`);
}

function validateStandardChangedRows(profile, changedRows, invariant) {
  const valid = profile.reviewType === "stock"
    ? changedRows.every((row) => row.action === "UPDATE_STOCK" && row.old_price === row.new_price && row.old_stock !== row.new_stock)
    : changedRows.every((row) => row.action === "SOURCE_MISSING" && row.old_price === row.new_price && row.old_stock === row.new_stock);
  invariant(valid, `${profile.retailer.name} review scope contains an unsafe catalogue change`);
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
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  const classifierCoversReview = profile.classifierCoverage === "full-partition";
  const expectedClassifierIds = classifierCoversReview
    ? sortedIds([...executionIds, ...reviewIds])
    : executionIds;
  const expectedClassifierCount = classifierCoversReview ? profile.approvedMappingCount : executableCount;
  invariant(classifierScope && Number(classifierScope.blocked_rows || 0) === 0 && classifierScope.reconciled === true && Number(classifierScope.reconciled_total) === expectedClassifierCount, `${label} preflight classifier scope drifted`);
  sameJson(sortedIds(classifierScope.scope_row_ids || []), expectedClassifierIds, `${label} preflight classifier IDs drifted`);
  sameJson(diagnostic.classifier_summary.action_counts || {}, report.classification || {}, `${label} preflight classifier actions drifted`);
  if (classifierCoversReview) sameJson(sortedIds(diagnostic.classifier_summary.changed_row_ids || []), reviewIds, `${label} preflight changed IDs drifted`);

  const changedRows = profile.reviewType === "stock"
    ? [...diagnostic.classifier_summary.changed_rows].map((row) => ({
      offer_id: String(row.offer_id), retailer_product_id: String(row.retailer_product_id),
      external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id),
      old_price: String(row.old_price), new_price: String(row.new_price),
      old_stock: row.old_stock === true, new_stock: row.new_stock === true, action: row.action,
    })).sort((a, b) => Number(a.offer_id) - Number(b.offer_id))
    : normalizeMissingRows(report, baselineByOffer, label, invariant);
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

function validateJons(profile, context) {
  const { report, diagnostic, baselineByOffer, invariant, sameJson, sortedIds } = context;
  const label = profile.retailer.name;
  const executableCount = Number(report.executable_plan_count);
  const reviewCount = Number(report.review_row_count);
  invariant(Number.isInteger(executableCount) && executableCount >= 0 && report.executed_plan_count === 0, `${label} dry-run executable scope drifted`);
  invariant(Number.isInteger(reviewCount) && reviewCount >= 0 && reviewCount <= profile.maximumReviewCount && executableCount + reviewCount === profile.approvedMappingCount, `${label} ordinary partition is incomplete`);
  noWriteDiagnostic(diagnostic, label, invariant);
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  const classifier = diagnostic.classifier_summary;
  invariant(classifier?.scope?.reconciled === true && classifier.scope.reconciled_total === executableCount && classifier.scope.blocked_rows === 0, `${label} preflight classifier scope drifted`);
  const executionIds = sortedIds(classifier.scope.scope_row_ids || []);
  invariant(executionIds.length === executableCount && new Set([...executionIds, ...reviewIds]).size === profile.approvedMappingCount, `${label} preflight classifier IDs drifted`);
  sameJson(sortedIds((classifier.quarantined_rows || []).map((row) => row.offer_id)), reviewIds, `${label} quarantined review scope drifted`);
  sameJson(classifier.action_counts || {}, report.classification || {}, `${label} preflight classifier actions drifted`);
  invariant(executionIds.every((offerId) => !reviewIds.includes(offerId)), `${label} executable offer IDs drifted`);
  const changedRows = normalizeMissingRows(report, baselineByOffer, label, invariant);
  return { executableCount, executionIds, changedRows, reviewIds };
}

function validateSixPackCapture(profile, { report, diagnostic, files, invariant }) {
  const label = profile.retailer.name;
  invariant(diagnostic === null, `${label} must not invent a diagnostic envelope`);
  invariant(report.schema_version === 1 && report.kind === "six-pack-approved-offer-refresh-dry-run", `${label} report schema drifted`);
  invariant(report.result === (Number(report.review_row_count) > 0 ? "PASS_WITH_REVIEW" : "PASS") && report.classification_state === (Number(report.review_row_count) > 0 ? "DRY_RUN_READY_WITH_REVIEW" : "DRY_RUN_READY"), `${label} pre-execution report is not publishable`);
  invariant(report.approved_mapping_count === profile.approvedMappingCount && report.blocked_row_count === 0 && report.database_writes === 0, `${label} apply scope drifted`);
  const artifact = JSON.parse(require("node:fs").readFileSync(files.artifact, "utf8"));
  invariant(Number(artifact.artifact_version) === 1 && Number(artifact.row_count) === report.executable_plan_count && artifact.plans?.length === report.executable_plan_count && artifact.source_rows?.length === report.executable_plan_count && artifact.blocked_rows?.length === 0, `${label} executable artifact drifted`);
  invariant(artifact.created_at === report.source_captured_at, `${label} capture timestamp drifted`);
  invariant(artifact.source_rows.every((row) => row.normalized_source_row?.source_snapshot_sha256 === report.source_snapshot_fingerprint && row.normalized_source_row?.source_captured_at === report.source_captured_at), `${label} executable source binding drifted`);
  const artifactOfferIds = artifact.source_rows.map((row) => String(row.normalized_source_row?.target?.offer?.id || ""));
  invariant(artifactOfferIds.every(Boolean) && new Set(artifactOfferIds).size === artifactOfferIds.length, `${label} executable offer IDs drifted`);
}

function validateSixPack(profile, context) {
  const { report, baselineByOffer, files, invariant, sortedIds } = context;
  const label = profile.retailer.name;
  invariant(Array.isArray(report.review_rows) && report.review_rows.length === report.review_row_count, `${label} review rows drifted`);
  const artifact = JSON.parse(require("node:fs").readFileSync(files.artifact, "utf8"));
  const executionIds = sortedIds(artifact.source_rows.map((row) => row.normalized_source_row.target.offer.id));
  const changedRows = report.review_rows.map((review) => {
    const offerId = String(review.offer_id);
    const before = baselineByOffer.get(offerId);
    invariant(before && String(review.mapping_id) === String(before.mapping_id), `${label} baseline missing for review offer ${offerId}`);
    invariant(String(review.external_product_id) === String(before.external_product_id) && String(review.external_variant_id) === String(before.external_variant_id), `${label} source identity drift for offer ${offerId}`);
    invariant(review.current_offer && Number.isFinite(Number(review.current_offer.price)) && Number.isFinite(Number(before.price)) && Number(review.current_offer.price).toFixed(2) === Number(before.price).toFixed(2) && Boolean(review.current_offer.in_stock) === Boolean(before.in_stock), `${label} current state drift for offer ${offerId}`);
    invariant(["SOURCE_VARIANT_MISSING", "HARD_PRICE_ANOMALY", "MASS_OOS"].includes(review.reason), `${label} review reason drifted for offer ${offerId}`);
    const proposed = review.proposed_offer || review.current_offer;
    return {
      offer_id: offerId,
      retailer_product_id: String(before.mapping_id),
      external_product_id: String(before.external_product_id),
      external_variant_id: String(before.external_variant_id),
      old_price: String(review.current_offer.price),
      new_price: String(proposed.price),
      old_stock: before.in_stock === true,
      new_stock: proposed.in_stock === true,
      action: review.reason === "SOURCE_VARIANT_MISSING" ? "SOURCE_MISSING" : "MANUAL_REVIEW",
      evidence_reason: review.reason,
      proposed_url: proposed.url || before.url || null,
    };
  }).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const reviewIds = sortedIds(changedRows.map((row) => row.offer_id));
  invariant(executionIds.length === report.executable_plan_count && new Set([...executionIds, ...reviewIds]).size === profile.approvedMappingCount, `${label} ordinary partition is incomplete`);
  invariant(executionIds.every((offerId) => !reviewIds.includes(offerId)), `${label} executable and review scopes overlap`);
  return { executableCount: executionIds.length, executionIds, changedRows, reviewIds };
}

function validateSixPackChangedRows(profile, changedRows, invariant) {
  invariant(changedRows.every((row) => row.action === "SOURCE_MISSING"
    ? row.old_price === row.new_price && row.old_stock === row.new_stock
    : row.action === "MANUAL_REVIEW" && ["HARD_PRICE_ANOMALY", "MASS_OOS"].includes(row.evidence_reason)), `${profile.retailer.name} review scope contains an unsafe catalogue change`);
}

function sixPackReviewCard(beforeState, changed) {
  if (changed.action === "SOURCE_MISSING") return reviewCard({ reviewType: "source-missing" }, beforeState, changed);
  return {
    proposedState: { ...beforeState, price: changed.new_price, in_stock: changed.new_stock, url: changed.proposed_url },
    reasonCodes: "POLICY_REVIEW", confidence: "LOW", sourcePrice: changed.new_price,
    reviewKind: "POLICY_REVIEW", operationType: "MANUAL_REVIEW", evidenceReason: changed.evidence_reason,
  };
}

function sixPackMatchesActiveReview(row) {
  return (row.review_kind === "IDENTITY_CONFLICT" && row.operation_type === "MANUAL_REVIEW_IDENTITY" && reasonList(row.reason_codes).includes("SOURCE_MISSING"))
    || (row.review_kind === "POLICY_REVIEW" && row.operation_type === "MANUAL_REVIEW" && reasonList(row.reason_codes).includes("POLICY_REVIEW"));
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
    postflightProfile: values.postflightProfile || values.retailer.slug,
    captureFiles: values.captureFiles || STANDARD_CAPTURE_FILES,
    sealedFiles: values.sealedFiles || STANDARD_SEALED_FILES,
    sourceFingerprint: values.sourceFingerprint || ((report) => report.source?.fingerprint),
    captureTimestamp: values.captureTimestamp || ((source) => source.diagnostic.timestamp),
    validateCapture: values.validateCapture || validateStandardCapture,
    validate: values.validate || validateStandard,
    validateChangedRows: values.validateChangedRows || validateStandardChangedRows,
    reviewCard: values.reviewCard || function card(beforeState, changed) { return reviewCard(this, beforeState, changed); },
    matchesActiveReview: values.matchesActiveReview || function activeReview(row) { return matchesActiveReview(this, row); },
  });
}

const PROFILES = Object.freeze({
  "fit-house": profile({ key: "fit-house", retailer: Object.freeze({ id: "9", name: "Fit House", slug: "fit-house" }), approvedMappingCount: 286, maximumReviewCount: 14, sourceDirectory: "fit-house-offer-refresh", artifactPrefix: "fit-house-offer-refresh", reconciliationFile: "fit-house-reconciliation-dry-run.json", contractName: "fit-house-automation-review-source-v1", workflow: ".github/workflows/fit-house-offer-refresh.yml", workflowName: "Shared Retailer Offer Refresh", reviewType: "stock", classifierCoverage: "full-partition" }),
  "10-reps": profile({ key: "10-reps", retailer: Object.freeze({ id: "14", name: "10 Reps", slug: "10-reps" }), approvedMappingCount: 950, maximumReviewCount: 16, sourceDirectory: "10reps-offer-refresh", artifactPrefix: "10reps-offer-refresh", reconciliationFile: "10reps-reconciliation-dry-run.json", contractName: "10-reps-automation-review-source-v1", workflow: ".github/workflows/fit-house-offer-refresh.yml", workflowName: "Shared Retailer Offer Refresh", reviewType: "source-missing", classifierCoverage: "executable-only" }),
  "whey-okay": profile({ key: "whey-okay", retailer: Object.freeze({ id: "3", name: "Whey Okay", slug: "whey-okay" }), approvedMappingCount: 589, maximumReviewCount: 10, sourceDirectory: "whey-okay-offer-refresh", artifactPrefix: "whey-okay-offer-refresh", reconciliationFile: "whey-okay-reconciliation-dry-run.json", contractName: "whey-okay-automation-review-source-v1", workflow: ".github/workflows/whey-okay-offer-refresh.yml", workflowName: "Whey Okay Offer Refresh", reviewType: "source-missing", captureFiles: WHEY_CAPTURE_FILES, sealedFiles: WHEY_SEALED_FILES, sourceFingerprint: (report) => report.source?.semantic_fingerprint, validate: validateWhey }),
  "jons-supplements": profile({ key: "jons-supplements", retailer: Object.freeze({ id: "10", name: "Jon's Supplements", slug: "jon-s-supplements" }), postflightProfile: "jons-supplements", approvedMappingCount: 506, maximumReviewCount: 5, sourceDirectory: "jons-offer-refresh", artifactPrefix: "jons-offer-refresh", reconciliationFile: "jons-reconciliation-dry-run.json", contractName: "jons-automation-review-source-v1", workflow: ".github/workflows/jons-offer-refresh.yml", workflowName: "Jon's Offer Refresh", reviewType: "source-missing", validateCapture: validateJonsCapture, validate: validateJons }),
  "six-pack-supplements": profile({ key: "six-pack-supplements", retailer: Object.freeze({ id: "11", name: "6 Pack Supplements", slug: "six-pack-supplements" }), approvedMappingCount: 506, maximumReviewCount: 14, sourceDirectory: "six-pack-offer-refresh", artifactPrefix: "six-pack-offer-refresh", reconciliationFile: "six-pack-reconciliation-dry-run.json", contractName: "six-pack-automation-review-source-v1", workflow: ".github/workflows/six-pack-offer-refresh.yml", workflowName: "6 Pack Supplements Offer Refresh", reviewType: "mixed-policy", captureFiles: SIX_PACK_CAPTURE_FILES, sealedFiles: SIX_PACK_SEALED_FILES, sourceFingerprint: (report) => report.source_snapshot_fingerprint, captureTimestamp: (source) => source.report.source_captured_at, validateCapture: validateSixPackCapture, validate: validateSixPack, validateChangedRows: validateSixPackChangedRows, reviewCard: sixPackReviewCard, matchesActiveReview: sixPackMatchesActiveReview }),
});

function profileFor(value = "fit-house", invariant = (condition, message) => { if (!condition) throw new Error(message); }) {
  const selected = PROFILES[value];
  invariant(selected, `Unknown retailer review profile ${value}`);
  return selected;
}

module.exports = { PROFILES, profileFor };
