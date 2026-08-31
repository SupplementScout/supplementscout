const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");
const { canonicalizeTimestamps, timestampEpochNanoseconds } = require("./canonical-timestamp");

const TRANSITIONS = Object.freeze({
  PENDING: new Set(["APPROVED", "REJECTED", "IGNORED", "EXPIRED"]),
  APPROVED: new Set(["QUEUED", "EXPIRED"]),
  QUEUED: new Set(["EXECUTING", "FAILED", "EXPIRED"]),
  EXECUTING: new Set(["EXECUTED", "FAILED"]),
  REJECTED: new Set(),
  IGNORED: new Set(),
  EXPIRED: new Set(),
  EXECUTED: new Set(),
  FAILED: new Set(),
});

const RETAILER_CAPABILITIES = Object.freeze({
  "12": Object.freeze({
    workflow: "ebay-offer-refresh.yml",
    operations: Object.freeze(["VERIFY_NO_CHANGE"]),
    reason_codes: Object.freeze(["FRESHNESS_CONFIRMATION", "STALE_OFFER", "NO_CHANGE_CONFIRMATION"]),
    environment: "production-readonly",
    maximum_batch: 1,
    isolation: "per-row",
    review_binding: "immutable-review-record",
    manual_catalogue_binding: Object.freeze({ kind: "github-artifact", semantic_timestamp_policy: "capture-time-only" }),
  }),
});

function invariant(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function hash(value) {
  return crypto.createHash("sha256").update(canonicalJson(canonicalizeTimestamps(value))).digest("hex");
}

function transitionAllowed(from, to) {
  return TRANSITIONS[from]?.has(to) === true;
}

function capabilityFor(retailerId, operationType) {
  const capability = RETAILER_CAPABILITIES[String(retailerId)] || null;
  if (!capability || !capability.operations.includes(operationType)) return null;
  return capability;
}

function commercialState(value) {
  return {
    price: value?.price ?? null,
    shipping_cost: value?.shipping_cost ?? null,
    total_price: value?.total_price ?? null,
    in_stock: value?.in_stock ?? null,
    url: value?.url ?? null,
  };
}

function expectedAfter(reviewItem) {
  return reviewItem.proposed_state || null;
}

function assertFreshReview(reviewItem, actor, now) {
  invariant(reviewItem?.review_status === "APPROVED", "REVIEW_NOT_APPROVED");
  invariant(typeof reviewItem.decision_actor === "string" && reviewItem.decision_actor.trim().length > 0, "OWNER_DECISION_MISSING");
  invariant(typeof actor === "string" && actor.trim().length > 0, "ACTOR_MISSING");
  let expiresAt;
  try { expiresAt = timestampEpochNanoseconds(reviewItem.expires_at); } catch {}
  invariant(expiresAt !== undefined && expiresAt > BigInt(now.getTime()) * 1_000_000n, "REVIEW_EVIDENCE_EXPIRED");
  invariant(/^[0-9a-f]{64}$/.test(reviewItem.source_row_fingerprint || ""), "SOURCE_FINGERPRINT_INVALID");
  invariant(reviewItem.before_state && typeof reviewItem.before_state === "object", "BEFORE_STATE_MISSING");
  invariant(expectedAfter(reviewItem), "PROPOSED_STATE_MISSING");
}

async function coordinateReviewExecution({ reviewItem, actor, adapter, mode = "dry-run", now = new Date(), checkpoint = async () => {} }) {
  assertFreshReview(reviewItem, actor, now);
  invariant(["dry-run", "apply"].includes(mode), "COORDINATOR_MODE_INVALID");
  const capability = capabilityFor(reviewItem.retailer_id, reviewItem.operation_type);
  invariant(capability, "RETAILER_OPERATION_UNSUPPORTED");
  for (const method of ["authorize", "capture", "loadDatabaseState", "buildProtectedPlan", "approveProtectedPlan", "applyProtectedPlan", "postflight", "idempotency"]) {
    invariant(typeof adapter?.[method] === "function", `ADAPTER_${method.toUpperCase()}_MISSING`);
  }
  invariant(await adapter.authorize(actor, reviewItem), "ACTOR_UNAUTHORIZED");

  const source = await adapter.capture(reviewItem);
  invariant(source?.fingerprint === reviewItem.source_row_fingerprint, "SOURCE_FINGERPRINT_DRIFT");
  let capturedAt;
  try { capturedAt = timestampEpochNanoseconds(source.captured_at); } catch {}
  invariant(capturedAt !== undefined && capturedAt <= BigInt(now.getTime()) * 1_000_000n, "SOURCE_CAPTURE_INVALID");
  const database = await adapter.loadDatabaseState(reviewItem);
  invariant(hash(database) === hash(reviewItem.before_state), "DATABASE_BEFORE_STATE_DRIFT");
  const plan = await adapter.buildProtectedPlan({ reviewItem, source, database });
  invariant(plan?.operation_type === reviewItem.operation_type, "PLAN_OPERATION_DRIFT");
  invariant(hash(plan.before_state) === hash(reviewItem.before_state), "PLAN_BEFORE_STATE_DRIFT");
  invariant(hash(plan.after_state) === hash(expectedAfter(reviewItem)), "PLAN_AFTER_STATE_DRIFT");
  invariant(/^[0-9a-f]{64}$/.test(plan.fingerprint || ""), "PLAN_FINGERPRINT_INVALID");
  if (reviewItem.plan_fingerprint) invariant(plan.fingerprint === reviewItem.plan_fingerprint, "PLAN_FINGERPRINT_DRIFT");
  if (reviewItem.operation_type === "VERIFY_NO_CHANGE") {
    invariant(hash(commercialState(plan.before_state.offer || plan.before_state)) === hash(commercialState(plan.after_state.offer || plan.after_state)), "FRESHNESS_ONLY_COMMERCIAL_DRIFT");
    invariant(Number(plan.expected_deltas?.price_history || 0) === 0, "FRESHNESS_ONLY_HISTORY_DRIFT");
  }
  const prepared = { result: "READY", mode, workflow: capability.workflow, review_id: String(reviewItem.id), offer_id: String(reviewItem.offer_id), source_fingerprint: source.fingerprint, full_capture_fingerprint: source.fingerprint, executable_source_fingerprint: source.fingerprint, review_scope_fingerprint: hash([]), source_row_fingerprints: [{ offer_id: String(reviewItem.offer_id), semantic_fingerprint: source.fingerprint, scope: "EXECUTABLE" }], executable_offer_ids: [String(reviewItem.offer_id)], review_offer_ids: [], plan_fingerprint: plan.fingerprint, expected_deltas: plan.expected_deltas };
  if (mode === "dry-run") return { ...prepared, database_writes: 0 };

  const executionId = await checkpoint("EXECUTING", prepared);
  let approval;
  try {
    approval = await adapter.approveProtectedPlan(plan, { actor, executionId, reviewItem });
    invariant(approval?.approval_id, "PROTECTED_APPROVAL_FAILED");
    const execution = await adapter.applyProtectedPlan(plan, approval, { executionId, reviewItem });
    invariant(execution?.executed === true, "PROTECTED_APPLY_FAILED");
    const postflight = await adapter.postflight({ reviewItem, plan, execution, executionId });
    invariant(postflight?.result === "PASS", "DB_POSTFLIGHT_FAILED");
    let idempotency;
    try {
      idempotency = await adapter.idempotency({ reviewItem, plan, execution, postflight, executionId });
      invariant(idempotency?.result === "PASS", "IDEMPOTENCY_FAILED");
    } catch (error) {
      invariant(error.code === "SOURCE_TIMEOUT", "IDEMPOTENCY_FAILED");
      idempotency = { result: "DEFERRED", reason: "SOURCE_TIMEOUT" };
    }
    await checkpoint("EXECUTED", { execution_id: executionId, approval_id: approval.approval_id, postflight, idempotency });
    return { ...prepared, result: idempotency.result === "PASS" ? "PASS" : "PASS_IDEMPOTENCY_DEFERRED", execution_id: executionId, approval_id: approval.approval_id, postflight, idempotency };
  } catch (error) {
    await checkpoint("FAILED", { execution_id: executionId, error_code: error.code || "PROTECTED_EXECUTION_FAILED", error_message: error.message });
    throw error;
  }
}

module.exports = { RETAILER_CAPABILITIES, TRANSITIONS, capabilityFor, coordinateReviewExecution, hash, transitionAllowed };
