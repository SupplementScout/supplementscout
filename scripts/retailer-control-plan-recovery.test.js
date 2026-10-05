const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  CONFIRMATION,
  buildPreflight,
  closeRequest,
  parseArgs,
  validatePreflight,
  validateRecoverable,
} = require("./retailer-control-plan-recovery");

function recoverableSnapshot() {
  const expired = "2026-10-05T08:00:00.000Z";
  return {
    retailer_id: "14",
    parent_plan_id: "06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa",
    parent_plan_fingerprint: "a".repeat(64),
    parent_status: "APPROVED",
    parent_approval_id: "00000000-0000-4000-8000-000000000001",
    parent_approval_expires_at: expired,
    parent_approval_consumed_at: null,
    children: [
      {
        batch_index: 0,
        child_plan_id: "f5d476e6-7eea-40f1-a7d8-8b9d0a7ad23d",
        child_plan_fingerprint: "b".repeat(64),
        status: "APPROVED",
        approval_id: "11111111-1111-4111-8111-111111111111",
        approval_expires_at: expired,
        approval_consumed_at: null,
      },
      {
        batch_index: 1,
        child_plan_id: "6f2eae9d-7b35-4e32-afa0-8ee02a72b240",
        child_plan_fingerprint: "c".repeat(64),
        status: "PLANNED",
        approval_id: null,
        approval_expires_at: null,
        approval_consumed_at: null,
      },
    ],
    approval: {
      approval_id: "22222222-2222-4222-8222-222222222222",
      child_plan_id: "f5d476e6-7eea-40f1-a7d8-8b9d0a7ad23d",
      artifact_fingerprint: "b".repeat(64),
      execution_fingerprint: "d".repeat(64),
      expected_migration_fingerprint: "f".repeat(64),
      expires_at: expired,
      target_environment: "PRODUCTION",
      project_ref: "aftboxmrdgyhizicfsfu",
      database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
      manifest_matches_child: true,
      consumed_at: null,
      closed_at: null,
      result: null,
    },
    apply_runs: 0,
    row_approvals: 0,
    batch_approvals: 1,
    recovery_manifests: 0,
    recovery_approvals: 0,
    recovery_audit: 0,
    business_counts: { products: "1337", product_variants: "3632", retailer_products: "3758", offers: "3758", price_history: "26840" },
    ledger: { count: 1, versions: ["20261004120000_add_central_control_plan_readback"], fingerprint: "e".repeat(64) },
  };
}

const recoveryOptions = {
  parentPlanId: "06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa",
  retailerId: "14",
  expectedChildCount: 2,
};
const recoveryNow = new Date("2026-10-05T10:00:00.000Z");

test("one retailer-neutral recovery path replaces the retired store-specific close", () => {
  const source = fs.readFileSync(path.join(__dirname, "retailer-control-plan-recovery.js"), "utf8");
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.doesNotMatch(source, /10 Reps|Simply Supplements|Fit House|retailer_id\s*[=!]==?\s*["']?\d+/i);
  assert.doesNotMatch(source, /\b(?:insert\s+into|update|delete\s+from)\s+public\./i);
  assert.match(source, /close_expired_retailer_offer_sync_approval/);
  assert.match(workflow, /expired-control-plan-recovery:/);
  assert.match(workflow, /OWNER_APPROVED_EXPIRED_CONTROL_CLOSE/);
  assert.match(workflow, /SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.equal(fs.existsSync(path.join(__dirname, "close-simply-expired-reviewed-plan.js")), false);
});

test("shared recovery accepts only an expired wholly unexecuted sequential tree", () => {
  const snapshot = recoverableSnapshot();
  const approved = validateRecoverable(snapshot, recoveryOptions, recoveryNow);
  assert.equal(approved.batch_index, 0);
  assert.notEqual(snapshot.approval.approval_id, approved.approval_id);
  const preflight = buildPreflight(snapshot, recoveryOptions, recoveryNow);
  assert.equal(validatePreflight(preflight, recoveryOptions, recoveryNow).result, "READY_TO_CLOSE");
  const request = closeRequest(snapshot, recoveryNow);
  assert.equal(request.parent_plan_id, recoveryOptions.parentPlanId);
  assert.equal(request.child_plan_id, approved.child_plan_id);
  assert.equal(request.expected_migration_fingerprint, snapshot.ledger.fingerprint);
  assert.equal(request.approval_expected_migration_fingerprint, snapshot.approval.expected_migration_fingerprint);
  assert.notEqual(request.approval_expected_migration_fingerprint, request.expected_migration_fingerprint);
  assert.match(request.request_fingerprint, /^[0-9a-f]{64}$/);
});

test("shared recovery fails closed when execution, recovery or partial child state exists", () => {
  for (const mutate of [
    (value) => { value.apply_runs = 1; },
    (value) => { value.row_approvals = 1; },
    (value) => { value.recovery_manifests = 1; },
    (value) => { value.children[1].status = "FAILED"; },
    (value) => { value.children[1].approval_id = "22222222-2222-4222-8222-222222222222"; },
  ]) {
    const snapshot = recoverableSnapshot();
    mutate(snapshot);
    assert.throws(() => validateRecoverable(snapshot, recoveryOptions, recoveryNow));
  }
});

test("shared recovery CLI separates read-only preflight from one confirmed close", () => {
  const common = [
    `--parent-plan-id=${recoveryOptions.parentPlanId}`,
    "--retailer-id=14",
    "--expected-child-count=2",
  ];
  assert.equal(parseArgs(["--mode=preflight", ...common, "--output=tmp/preflight.json"]).mode, "preflight");
  assert.throws(() => parseArgs(["--mode=close", ...common, "--input=tmp/preflight.json", "--output=tmp/result.json"]), /confirmation/);
  assert.equal(parseArgs(["--mode=close", ...common, "--input=tmp/preflight.json", "--output=tmp/result.json", `--confirm=${CONFIRMATION}`]).mode, "close");
});
