const source = require("../../config/automation-review-execution-adapters.json");
const reasonContract = require("../../config/automation-review-reason-codes.json");

const WORKER_KINDS = new Set(["ebay", "shared-retailer"]);
const OPERATIONS = new Set(["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK"]);
const REVIEW_REASON_CODES = new Set(reasonContract.reason_codes);

function invariant(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function freezeAdapter(raw) {
  invariant(/^[1-9]\d*$/.test(raw.retailer_id), "REVIEW_ADAPTER_RETAILER_ID_INVALID");
  invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.retailer_slug), "REVIEW_ADAPTER_RETAILER_SLUG_INVALID");
  invariant(WORKER_KINDS.has(raw.worker_kind), "REVIEW_ADAPTER_WORKER_KIND_INVALID");
  invariant(Array.isArray(raw.operations) && raw.operations.length > 0 && raw.operations.every((value) => OPERATIONS.has(value)), "REVIEW_ADAPTER_OPERATIONS_INVALID");
  invariant(Array.isArray(raw.reason_codes) && raw.reason_codes.length > 0 && raw.reason_codes.every((value) => /^[A-Z][A-Z0-9_]*$/.test(value)), "REVIEW_ADAPTER_REASONS_INVALID");
  invariant(raw.reason_codes.every((value) => REVIEW_REASON_CODES.has(value)), "REVIEW_ADAPTER_REASON_UNKNOWN");
  invariant(new Set(raw.operations).size === raw.operations.length && new Set(raw.reason_codes).size === raw.reason_codes.length, "REVIEW_ADAPTER_ALLOWLIST_DUPLICATE");
  invariant(raw.operation_reason_codes && typeof raw.operation_reason_codes === "object" && !Array.isArray(raw.operation_reason_codes), "REVIEW_ADAPTER_OPERATION_REASONS_INVALID");
  invariant(Object.keys(raw.operation_reason_codes).length === raw.operations.length && raw.operations.every((operation) => Object.hasOwn(raw.operation_reason_codes, operation)), "REVIEW_ADAPTER_OPERATION_REASON_SCOPE_INVALID");
  const operationReasons = Object.values(raw.operation_reason_codes).flat();
  invariant(Object.values(raw.operation_reason_codes).every((reasons) => Array.isArray(reasons) && reasons.length > 0 && new Set(reasons).size === reasons.length && reasons.every((reason) => raw.reason_codes.includes(reason))), "REVIEW_ADAPTER_OPERATION_REASONS_INVALID");
  invariant(new Set(operationReasons).size === raw.reason_codes.length && raw.reason_codes.every((reason) => operationReasons.includes(reason)), "REVIEW_ADAPTER_REASON_SCOPE_INVALID");
  invariant([raw.builder, raw.approval_rpc, raw.apply_rpc, raw.postflight, raw.idempotency].every((value) => typeof value === "string" && value.length > 0), "REVIEW_ADAPTER_CONTRACT_INVALID");
  if (raw.worker_kind === "shared-retailer") {
    const engine = raw.shared_engine;
    invariant(engine && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(engine.profile) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(engine.postflight_profile), "REVIEW_ADAPTER_SHARED_PROFILE_INVALID");
    invariant(/^scripts\/[a-z0-9]+(?:-[a-z0-9]+)*\.js$/.test(engine.engine_module), "REVIEW_ADAPTER_ENGINE_MODULE_INVALID");
    invariant(/^[A-Z][A-Z0-9_]*$/.test(engine.role_prefix), "REVIEW_ADAPTER_ROLE_PREFIX_INVALID");
    invariant(Number.isInteger(engine.expected_execution_rows) && engine.expected_execution_rows > 1 && engine.expected_execution_rows <= 50, "REVIEW_ADAPTER_EXECUTION_ROWS_INVALID");
    invariant(engine.expected_commercial_changes === 1 && engine.freshness_confirmation_count === engine.expected_execution_rows - 1, "REVIEW_ADAPTER_EXECUTION_SCOPE_INVALID");
  } else {
    invariant(raw.shared_engine === undefined, "REVIEW_ADAPTER_ENGINE_SCOPE_INVALID");
  }
  return Object.freeze({
    retailerId: raw.retailer_id,
    retailerSlug: raw.retailer_slug,
    workerKind: raw.worker_kind,
    operations: Object.freeze([...raw.operations]),
    operationSet: new Set(raw.operations),
    reasonCodes: Object.freeze([...raw.reason_codes]),
    operationReasonCodes: Object.freeze(Object.fromEntries(
      Object.entries(raw.operation_reason_codes).map(([operation, reasons]) => [operation, Object.freeze([...reasons])]),
    )),
    workflow: source.workflow,
    environment: source.environment,
    builder: raw.builder,
    approvalRpc: raw.approval_rpc,
    applyRpc: raw.apply_rpc,
    postflight: raw.postflight,
    idempotency: raw.idempotency,
    sharedEngine: raw.shared_engine ? Object.freeze({
      engineModule: raw.shared_engine.engine_module,
      profile: raw.shared_engine.profile,
      postflightProfile: raw.shared_engine.postflight_profile,
      rolePrefix: raw.shared_engine.role_prefix,
      expectedExecutionRows: raw.shared_engine.expected_execution_rows,
      expectedCommercialChanges: raw.shared_engine.expected_commercial_changes,
      freshnessConfirmationCount: raw.shared_engine.freshness_confirmation_count,
    }) : null,
  });
}

invariant(source.schema_version === 1, "REVIEW_ADAPTER_SCHEMA_INVALID");
invariant(source.workflow === "automation-review-queue-worker.yml" && source.environment === "production-readonly", "REVIEW_ADAPTER_RUNTIME_BINDING_INVALID");
invariant(Array.isArray(source.adapters) && source.adapters.length > 0, "REVIEW_ADAPTER_REGISTRY_EMPTY");

const REVIEW_EXECUTION_ADAPTERS = Object.freeze(source.adapters.map(freezeAdapter));
invariant(new Set(REVIEW_EXECUTION_ADAPTERS.map((adapter) => adapter.retailerId)).size === REVIEW_EXECUTION_ADAPTERS.length, "REVIEW_ADAPTER_RETAILER_ID_DUPLICATE");
invariant(new Set(REVIEW_EXECUTION_ADAPTERS.map((adapter) => adapter.retailerSlug)).size === REVIEW_EXECUTION_ADAPTERS.length, "REVIEW_ADAPTER_RETAILER_SLUG_DUPLICATE");

function adaptersForWorkerKind(workerKind) {
  return REVIEW_EXECUTION_ADAPTERS.filter((adapter) => adapter.workerKind === workerKind);
}

module.exports = { REVIEW_EXECUTION_ADAPTERS, adaptersForWorkerKind };
