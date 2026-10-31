const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  bindAutomationReviewDecision,
  fingerprint,
  prepareAutomationReviewDecision,
  prepareAutomationReviewIdempotencyTransition,
  verifyAutomationReviewIdempotencyTransition,
} = require("./lib/retailer-offer-sync/automation-review-decision");

test("owner decision contract binds one immutable Review Queue request", () => {
  const review = {
    id: 1121,
    retailer_id: 9,
    review_status: "APPROVED",
    operation_type: "UPDATE_STOCK",
    source_row_fingerprint: "a".repeat(64),
    plan_fingerprint: "b".repeat(64),
    decision_actor: "authenticated-admin",
    decision_at: "2026-10-06T13:30:00.000Z",
    expires_at: "2026-10-06T15:00:00.000Z",
  };
  const executionRequest = {
    id: "11111111-1111-4111-8111-111111111111",
    review_id: 1121,
    retailer_id: 9,
    retailer_slug: "fit-house",
    operation_type: "UPDATE_STOCK",
    review_fingerprint: review.source_row_fingerprint,
    plan_fingerprint: review.plan_fingerprint,
    idempotency_key: "c".repeat(64),
    requested_by: "authenticated-admin",
    requested_at: "2026-10-06T13:31:00.000Z",
    status: "DISPATCHED",
  };
  const prepared = prepareAutomationReviewDecision({
    review,
    request: executionRequest,
    adapter: { retailerId: "9", retailerSlug: "fit-house" },
    now: new Date("2026-10-06T13:32:00.000Z"),
  });
  const request = {
    artifact: { artifact_fingerprint: "d".repeat(64) },
    artifact_fingerprint: "d".repeat(64),
    package_fingerprint: null,
  };
  const bound = bindAutomationReviewDecision(request, prepared);
  const contract = bound.automation_review_execution_contract;
  const contractCore = Object.fromEntries(
    Object.entries(contract).filter(([key]) => key !== "contract_hash"),
  );
  assert.equal(contract.execution_request_id, executionRequest.id);
  assert.equal(contract.review_id, "1121");
  assert.equal(contract.contract_hash, fingerprint(contractCore));
  assert.equal(bound.package_fingerprint, fingerprint({ ...bound, package_fingerprint: null }));
  assert.throws(
    () => prepareAutomationReviewDecision({
      review: { ...review, review_status: "FAILED" },
      request: executionRequest,
      adapter: { retailerId: "9", retailerSlug: "fit-house" },
    }),
    /AUTOMATION_REVIEW_DECISION_STATE_INVALID/,
  );
});

test("idempotency transition is sealed to the exact applied stock decision", () => {
  const review = {
    id: 1121,
    offer_id: 1982,
    operation_type: "UPDATE_STOCK",
    source_row_fingerprint: "a".repeat(64),
    plan_fingerprint: "b".repeat(64),
    before_state: { in_stock: true },
    proposed_state: { in_stock: false },
  };
  const decision = {
    kind: "automation-review-owner-decision-v1",
    execution_request_id: "11111111-1111-4111-8111-111111111111",
    review_id: "1121",
    retailer_id: "9",
    retailer_slug: "fit-house",
    review_fingerprint: review.source_row_fingerprint,
    plan_fingerprint: review.plan_fingerprint,
    idempotency_key: "c".repeat(64),
  };
  const transition = prepareAutomationReviewIdempotencyTransition({ review, decision });
  assert.equal(transition.offer_id, "1982");
  assert.equal(transition.before_in_stock, true);
  assert.equal(transition.after_in_stock, false);
  assert.equal(verifyAutomationReviewIdempotencyTransition(transition), transition);
  assert.throws(
    () => verifyAutomationReviewIdempotencyTransition({ ...transition, offer_id: "1983" }),
    /AUTOMATION_REVIEW_IDEMPOTENCY_TRANSITION_HASH_DRIFT/,
  );
});

test("shared engines bind the owner decision before database validation", () => {
  for (const file of ["fit-house-offer-refresh.js", "whey-okay-offer-refresh.js"]) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.match(source, /bindAutomationReviewDecision/);
    assert.match(source, /run\.automationReviewDecision/);
  }
  const worker = fs.readFileSync(
    path.join(__dirname, "automation-review-shared-retailer-worker.js"),
    "utf8",
  );
  assert.match(worker, /prepareAutomationReviewDecision/);
  assert.match(worker, /automationReviewDecision/);
});

test("database bridge validates the queue decision and contains no retailer exception", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261006170000_add_automation_review_owner_decision_validation.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "rollbacks", "20261006170000_add_automation_review_owner_decision_validation.sql"),
    "utf8",
  );
  assert.match(migration, /create function public\.validate_automation_review_owner_decision\(p_request jsonb\)/);
  assert.match(migration, /v_request\.status<>'DISPATCHED'/);
  assert.match(migration, /v_review\.review_status<>'APPROVED'/);
  assert.match(migration, /event\.previous_status='PENDING'[\s\S]+event\.new_status='APPROVED'[\s\S]+event\.actor='authenticated-admin'/);
  assert.match(migration, /jsonb_array_length\(v_artifact->'rows'\)<>20/);
  assert.match(migration, /v_changed_count<>1 or v_confirmation_count<>19/);
  assert.match(migration, /v_review\.before_state-'in_stock' is distinct from v_review\.proposed_state-'in_stock'/);
  assert.match(migration, /retailer_offer_sync_validate_batch_read_only_unreviewed_interna\(v_base\)/);
  assert.match(migration, /if p_request \? 'automation_review_execution_contract'/);
  assert.doesNotMatch(migration, /retailer_id\s*=\s*(?:3|9|14)\b/i);
  assert.doesNotMatch(
    migration,
    /(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i,
  );
  assert.match(rollback, /drop function public\.validate_automation_review_owner_decision\(jsonb\)/);
});

test("verified stock-transition reader is generic, bounded, SELECT-only and validator-exclusive", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261031120000_add_verified_automation_review_stock_transition_reader.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "rollbacks", "20261031120000_add_verified_automation_review_stock_transition_reader_rollback.sql"),
    "utf8",
  );
  const body = migration.slice(
    migration.indexOf("create function public.read_verified_automation_review_stock_transitions_v1"),
    migration.indexOf("alter function public.read_verified_automation_review_stock_transitions_v1"),
  );
  assert.match(body, /\(\s*p_retailer_id bigint\s*\) returns table/);
  assert.match(body, /language plpgsql\s+stable\s+security definer\s+set search_path=pg_catalog,public,pg_temp/);
  assert.match(body, /current_setting\('role',true\) is distinct from 'retailer_catalogue_production_validator'/);
  assert.match(body, /review\.retailer_id=p_retailer_id/);
  assert.match(body, /execution\.retailer_id=p_retailer_id/);
  assert.match(body, /review\.review_status='EXECUTED'/);
  assert.match(body, /execution\.status='EXECUTED'/);
  assert.match(body, /review\.operation_type='UPDATE_STOCK'/);
  assert.doesNotMatch(body, /\b(?:insert\s+into|update|delete\s+from|execute\s+format)\b/i);
  assert.match(migration, /rolcanlogin=false[\s\S]+rolinherit=false[\s\S]+rolsuper=false[\s\S]+rolcreaterole=false[\s\S]+rolcreatedb=false[\s\S]+rolreplication=false[\s\S]+rolbypassrls=true/);
  assert.match(migration, /20260820130000[\s\S]+bounded catalogue reads[\s\S]+table privileges remain explicitly revoked/);
  assert.doesNotMatch(migration, /\balter\s+role\s+retailer_catalogue_production_validator\b/i);
  assert.doesNotMatch(migration, /retailer_id\s*=\s*(?:3|9|14)\b/i);
  assert.doesNotMatch(migration, /\b(?:697|983|1859|1982)\b/);
  assert.match(migration, /grant execute on function public\.read_verified_automation_review_stock_transitions_v1\(bigint\)\s+to retailer_catalogue_production_validator/);
  assert.match(migration, /revoke all on function public\.read_verified_automation_review_stock_transitions_v1\(bigint\)[\s\S]+from public,anon,authenticated,service_role/);
  assert.match(migration, /revoke all on table public\.product_match_review_queue\s+from retailer_catalogue_production_validator/);
  assert.match(migration, /revoke all on table public\.automation_review_execution_requests\s+from retailer_catalogue_production_validator/);
  assert.match(migration, /'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'/);
  assert.match(rollback, /drop function public\.read_verified_automation_review_stock_transitions_v1\(bigint\)/);
  const selector = fs.readFileSync(path.join(__dirname, "lib", "environment-migrations.js"), "utf8");
  assert.equal((selector.match(/20261031120000_add_verified_automation_review_stock_transition_reader/g) || []).length, 2);
});

test("verified postflight recovery is control-only, replay-safe and retailer-neutral", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "migrations", "20261006190000_add_automation_review_verified_postflight_recovery.sql"),
    "utf8",
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "rollbacks", "20261006190000_add_automation_review_verified_postflight_recovery.sql"),
    "utf8",
  );
  assert.match(migration, /create function public\.reconcile_automation_review_verified_postflight/);
  assert.match(migration, /v_request\.status <> 'FAILED'/);
  assert.match(migration, /v_review\.review_status <> 'FAILED'/);
  assert.match(migration, /jsonb_array_length\(p_evidence->'executed_offer_ids'\) <> 1/);
  assert.match(migration, /jsonb_array_length\(p_evidence->'freshness_confirmation_offer_ids'\) <> 19/);
  assert.match(migration, /AUTOMATION_RECOVERY_CURRENT_STATE_DRIFT/);
  assert.match(migration, /'FAILED','EXECUTED','VERIFIED_POSTFLIGHT_RECOVERY'/);
  assert.doesNotMatch(migration, /retailer_id\s*=\s*(?:3|9|14)\b/i);
  assert.doesNotMatch(migration, /(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)/i);
  assert.match(rollback, /AUTOMATION_RECOVERY_ROLLBACK_BLOCKED_BY_USED_EVIDENCE/);
  assert.match(rollback, /drop function public\.reconcile_automation_review_verified_postflight/);
});
