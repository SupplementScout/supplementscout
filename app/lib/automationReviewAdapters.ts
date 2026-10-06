import "server-only";
import * as registry from "../../config/automation-review-execution-adapters.json";

export type ReviewAdapter = {
  retailerId: string;
  retailerSlug: string;
  operations: readonly string[];
  reasonCodes: readonly string[];
  workflow: string;
  environment: string;
  builder: string;
  approvalRpc: string;
  applyRpc: string;
  postflight: string;
  idempotency: string;
  autonomous: boolean;
  ownerDecisionRequired: boolean;
  maximumBatch: number;
  isolation: "per-row";
  reviewBinding: "immutable-review-record";
  manualCatalogueBinding: {
    kind: "control-plane-request";
    requiredEvidence: readonly string[];
    semanticTimestampPolicy: "capture-time-only";
  };
};

const REQUIRED_EVIDENCE = Object.freeze(["execution_request_id", "review_item_id", "review_fingerprint", "review_plan_fingerprint", "execution_idempotency_key"]);

export const REVIEW_ADAPTERS: readonly ReviewAdapter[] = Object.freeze(registry.adapters.map((adapter) => Object.freeze({
  retailerId: adapter.retailer_id,
  retailerSlug: adapter.retailer_slug,
  operations: Object.freeze([...adapter.operations]),
  reasonCodes: Object.freeze([...adapter.reason_codes]),
  workflow: registry.workflow,
  environment: registry.environment,
  builder: adapter.builder,
  approvalRpc: adapter.approval_rpc,
  applyRpc: adapter.apply_rpc,
  postflight: adapter.postflight,
  idempotency: adapter.idempotency,
  autonomous: true,
  ownerDecisionRequired: true,
  maximumBatch: 1,
  isolation: "per-row" as const,
  reviewBinding: "immutable-review-record" as const,
  manualCatalogueBinding: Object.freeze({
    kind: "control-plane-request" as const,
    requiredEvidence: REQUIRED_EVIDENCE,
    semanticTimestampPolicy: "capture-time-only" as const,
  }),
})));

function parsedReasons(value: string | null | undefined) {
  return String(value || "").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

export function resolveReviewAdapter(retailerId: string | number | null, operationType: string | null, reasonCodes: string | null) {
  const adapter = REVIEW_ADAPTERS.find((candidate) => candidate.retailerId === String(retailerId)) || null;
  if (!adapter) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: "No protected review worker is registered for this retailer." } as const;
  if (!operationType || !adapter.operations.includes(operationType)) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: `The protected adapter does not support ${operationType || "an unknown operation"}.` } as const;
  const reasons = parsedReasons(reasonCodes);
  if (!reasons.length || reasons.some((reason) => !adapter.reasonCodes.includes(reason))) return { adapter: null, code: "EXECUTION_UNSUPPORTED", reason: "The review reason is not in the adapter allowlist." } as const;
  return { adapter, code: "SUPPORTED", reason: null } as const;
}

export function reviewQueueConfigured() {
  return process.env.AUTOMATION_REVIEW_QUEUE_ENABLED !== "false";
}

export function reviewDispatchConfigured() {
  return reviewQueueConfigured();
}
