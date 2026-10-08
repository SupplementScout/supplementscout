const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  CONFIRMATION,
  buildDiscoveryReport,
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
        row_count: 50,
        row_approvals: 0,
        batch_approvals: 1,
        successful_apply_runs: 0,
        other_apply_runs: 0,
        ready_recovery_manifests: 0,
        other_recovery_manifests: 0,
      },
      {
        batch_index: 1,
        child_plan_id: "6f2eae9d-7b35-4e32-afa0-8ee02a72b240",
        child_plan_fingerprint: "c".repeat(64),
        status: "PLANNED",
        approval_id: null,
        approval_expires_at: null,
        approval_consumed_at: null,
        row_count: 50,
        row_approvals: 0,
        batch_approvals: 0,
        successful_apply_runs: 0,
        other_apply_runs: 0,
        ready_recovery_manifests: 0,
        other_recovery_manifests: 0,
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

function partialSnapshot() {
  const snapshot = recoverableSnapshot();
  const expired = snapshot.parent_approval_expires_at;
  snapshot.parent_status = "PARTIALLY_APPLIED";
  snapshot.parent_approval_consumed_at = "2026-10-05T07:00:00.000Z";
  snapshot.children = Array.from({ length: 19 }, (_, index) => {
    const applied = index < 12;
    const approved = index === 12;
    const rowCount = applied ? (index === 11 ? 41 : 50) : 50;
    return {
      batch_index: index,
      child_plan_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      child_plan_fingerprint: (index + 1).toString(16).padStart(64, "0"),
      status: applied ? "APPLIED" : approved ? "APPROVED" : "PLANNED",
      approval_id: applied || approved ? `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` : null,
      approval_expires_at: applied || approved ? expired : null,
      approval_consumed_at: applied ? "2026-10-05T07:30:00.000Z" : null,
      row_count: rowCount,
      row_approvals: applied ? rowCount : 0,
      batch_approvals: applied || approved ? 1 : 0,
      successful_apply_runs: applied ? 1 : 0,
      other_apply_runs: 0,
      ready_recovery_manifests: applied ? 1 : 0,
      other_recovery_manifests: 0,
    };
  });
  snapshot.approval = {
    ...snapshot.approval,
    child_plan_id: snapshot.children[12].child_plan_id,
    artifact_fingerprint: snapshot.children[12].child_plan_fingerprint,
  };
  snapshot.apply_runs = 12;
  snapshot.row_approvals = 591;
  snapshot.batch_approvals = 13;
  snapshot.recovery_manifests = 12;
  return snapshot;
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
  const partialMigration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261006120000_extend_partial_sequential_plan_close.sql"), "utf8");
  assert.doesNotMatch(source, /10 Reps|Simply Supplements|Fit House|retailer_id\s*[=!]==?\s*["']?\d+/i);
  assert.doesNotMatch(source, /\b(?:insert\s+into|update|delete\s+from)\s+public\./i);
  assert.match(source, /close_expired_retailer_offer_sync_approval/);
  assert.doesNotMatch(partialMigration, /10 Reps|Simply Supplements|Fit House|retailer_id\s*[=!<>]+\s*14/i);
  assert.doesNotMatch(partialMigration, /\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:retailers|products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(workflow, /expired-control-plan-recovery:/);
  assert.match(workflow, /OWNER_APPROVED_EXPIRED_CONTROL_CLOSE/);
  assert.match(workflow, /SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.equal(fs.existsSync(path.join(__dirname, "close-simply-expired-reviewed-plan.js")), false);
});

test("shared recovery accepts only an expired wholly unexecuted sequential tree", () => {
  const snapshot = recoverableSnapshot();
  const recovery = validateRecoverable(snapshot, recoveryOptions, recoveryNow);
  assert.equal(recovery.approvedChild.batch_index, 0);
  assert.equal(recovery.appliedChildCount, 0);
  assert.equal(recovery.pendingChildCount, 2);
  assert.notEqual(snapshot.approval.approval_id, recovery.approvedChild.approval_id);
  const preflight = buildPreflight(snapshot, recoveryOptions, recoveryNow);
  assert.equal(validatePreflight(preflight, recoveryOptions, recoveryNow).result, "READY_TO_CLOSE");
  const request = closeRequest(snapshot, recoveryNow);
  assert.equal(request.parent_plan_id, recoveryOptions.parentPlanId);
  assert.equal(request.child_plan_id, recovery.approvedChild.child_plan_id);
  assert.equal(request.expected_migration_fingerprint, snapshot.ledger.fingerprint);
  assert.equal(request.approval_expected_migration_fingerprint, snapshot.approval.expected_migration_fingerprint);
  assert.notEqual(request.approval_expected_migration_fingerprint, request.expected_migration_fingerprint);
  assert.match(request.request_fingerprint, /^[0-9a-f]{64}$/);
});

test("shared recovery preserves a proven 12-child prefix and closes only the 1+6 suffix", () => {
  const snapshot = partialSnapshot();
  const options = { ...recoveryOptions, expectedChildCount: 19 };
  const recovery = validateRecoverable(snapshot, options, recoveryNow);
  assert.equal(recovery.kind, "EXPIRED_PARTIAL_SEQUENTIAL_PLAN");
  assert.equal(recovery.appliedChildCount, 12);
  assert.equal(recovery.pendingChildCount, 7);
  assert.equal(recovery.approvedChild.batch_index, 12);
  const preflight = buildPreflight(snapshot, options, recoveryNow);
  assert.equal(preflight.scope.preserved_applied_child_count, 12);
  assert.equal(preflight.scope.close_child_count, 7);
  assert.equal(validatePreflight(preflight, options, recoveryNow).kind, "EXPIRED_PARTIAL_SEQUENTIAL_PLAN");
  assert.match(closeRequest(snapshot, recoveryNow).reason, /Preserve exact applied prefix/);
});

test("partial recovery fails closed on gaps, failed runs or missing historical proof", () => {
  const options = { ...recoveryOptions, expectedChildCount: 19 };
  for (const mutate of [
    (value) => { value.children[5].status = "PLANNED"; },
    (value) => { value.children[3].successful_apply_runs = 0; value.children[3].other_apply_runs = 1; },
    (value) => { value.children[8].ready_recovery_manifests = 0; value.recovery_manifests = 11; },
    (value) => { value.children[1].row_approvals = 49; value.row_approvals = 590; },
    (value) => { value.children[12].other_apply_runs = 1; value.apply_runs = 13; },
  ]) {
    const snapshot = partialSnapshot();
    mutate(snapshot);
    assert.throws(() => validateRecoverable(snapshot, options, recoveryNow));
  }
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

test("shared discovery accepts only a retailer identity and returns one exact no-write target", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.equal((workflow.match(/inputs\.operation != 'control-discovery'/g) || []).length, 3);
  assert.match(workflow, /--mode=discover --retailer-id="\$RETAILER_ID"/);
  const options = parseArgs(["--mode=discover", "--retailer-id=3", "--output=tmp/discovery.json"]);
  assert.equal(options.parentPlanId, null);
  assert.throws(() => parseArgs(["--mode=discover", "--retailer-id=3", `--parent-plan-id=${recoveryOptions.parentPlanId}`, "--output=tmp/discovery.json"]), /accepts only/);
  const report = buildDiscoveryReport([{
    parent_plan_id: recoveryOptions.parentPlanId,
    parent_plan_fingerprint: "a".repeat(64),
    parent_status: "APPROVED",
    approval_expires_at: "2026-10-08T09:30:00.000Z",
    approval_consumed_at: null,
    child_count: 12,
    planned_child_count: 11,
    approved_child_count: 1,
    applying_child_count: 0,
    applied_child_count: 0,
    apply_run_count: 0,
  }], options, { catalogue_counts: {}, migration_ledger: { count: 229, fingerprint: "f".repeat(64) } }, recoveryNow);
  assert.equal(report.result, "FOUND_EXACTLY_ONE");
  assert.deepEqual(report.exact_target, { retailer_id: "3", parent_plan_id: recoveryOptions.parentPlanId, expected_child_count: 12 });
  assert.deepEqual(report.accounting, { read_transactions: 1, automatic_retries: 0, close_calls: 0, control_writes: 0, business_writes: 0, price_history_writes: 0 });
});

test("shared discovery reports clear and ambiguous state without selecting a target", () => {
  const options = parseArgs(["--mode=discover", "--retailer-id=3", "--output=tmp/discovery.json"]);
  const proof = { catalogue_counts: {}, migration_ledger: { count: 229, fingerprint: "f".repeat(64) } };
  assert.equal(buildDiscoveryReport([], options, proof, recoveryNow).result, "CLEAR");
  const row = {
    parent_plan_id: recoveryOptions.parentPlanId, parent_plan_fingerprint: "a".repeat(64), parent_status: "APPROVED",
    approval_expires_at: "2026-10-08T09:30:00.000Z", approval_consumed_at: null, child_count: 2,
    planned_child_count: 1, approved_child_count: 1, applying_child_count: 0, applied_child_count: 0, apply_run_count: 0,
  };
  const second = { ...row, parent_plan_id: "11111111-1111-4111-8111-111111111111", parent_plan_fingerprint: "b".repeat(64) };
  const report = buildDiscoveryReport([row, second], options, proof, recoveryNow);
  assert.equal(report.result, "AMBIGUOUS");
  assert.equal(report.exact_target, null);
});
