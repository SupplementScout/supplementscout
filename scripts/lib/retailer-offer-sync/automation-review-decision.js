const crypto = require("node:crypto");
const { canonicalJson } = require("../canonical-json");
const { canonicalTimestamp } = require("../canonical-timestamp");

const KIND = "automation-review-owner-decision-v1";

function invariant(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function prepareAutomationReviewDecision({ review, request, adapter, now = new Date() }) {
  invariant(review && request && adapter, "AUTOMATION_REVIEW_DECISION_INPUT_MISSING");
  invariant(String(request.review_id) === String(review.id), "AUTOMATION_REVIEW_DECISION_REQUEST_DRIFT");
  invariant(String(review.retailer_id) === String(adapter.retailerId)
    && request.retailer_slug === adapter.retailerSlug
    && review.operation_type === request.operation_type,
  "AUTOMATION_REVIEW_DECISION_ADAPTER_DRIFT");
  invariant(review.review_status === "APPROVED" && request.status === "DISPATCHED", "AUTOMATION_REVIEW_DECISION_STATE_INVALID");
  invariant(review.source_row_fingerprint === request.review_fingerprint
    && review.plan_fingerprint === request.plan_fingerprint,
  "AUTOMATION_REVIEW_DECISION_FINGERPRINT_DRIFT");
  invariant(review.decision_actor && review.decision_at && review.expires_at, "AUTOMATION_REVIEW_DECISION_AUDIT_MISSING");
  const expiry = new Date(Math.min(Date.parse(review.expires_at), now.getTime() + 14 * 60_000));
  invariant(Number.isFinite(expiry.getTime()) && expiry > now, "AUTOMATION_REVIEW_DECISION_EXPIRED");
  return Object.freeze({
    schema_version: 1,
    kind: KIND,
    execution_request_id: String(request.id),
    review_id: String(review.id),
    retailer_id: String(review.retailer_id),
    retailer_slug: request.retailer_slug,
    operation_type: review.operation_type,
    review_fingerprint: review.source_row_fingerprint,
    plan_fingerprint: review.plan_fingerprint,
    idempotency_key: request.idempotency_key,
    requested_by: request.requested_by,
    requested_at: canonicalTimestamp(request.requested_at, "requested_at"),
    decision_actor: review.decision_actor,
    decision_at: canonicalTimestamp(review.decision_at, "decision_at"),
    expires_at: expiry.toISOString(),
  });
}

function bindAutomationReviewDecision(request, prepared) {
  invariant(request?.artifact?.artifact_fingerprint === request?.artifact_fingerprint, "AUTOMATION_REVIEW_ARTIFACT_BINDING_DRIFT");
  const core = {
    ...prepared,
    artifact_fingerprint: request.artifact_fingerprint,
  };
  const contract = { ...core, contract_hash: fingerprint(core) };
  const bound = {
    ...request,
    automation_review_execution_contract: contract,
    package_fingerprint: null,
  };
  return { ...bound, package_fingerprint: fingerprint(bound) };
}

module.exports = {
  KIND,
  bindAutomationReviewDecision,
  fingerprint,
  prepareAutomationReviewDecision,
};
