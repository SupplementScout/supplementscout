const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260831110000_create_automation_review_queue_publication_rpc.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const forwardPath = path.join(process.cwd(), "supabase", "migrations", "20261104120000_allow_automation_review_hard_price_anomaly.sql");
const rollbackPath = path.join(process.cwd(), "supabase", "rollbacks", "20261104120000_allow_automation_review_hard_price_anomaly_rollback.sql");
const forwardSql = fs.readFileSync(forwardPath, "utf8");
const rollbackSql = fs.readFileSync(rollbackPath, "utf8");
const bindingForwardPath = path.join(process.cwd(), "supabase", "migrations", "20261105100000_refresh_pending_review_execution_binding.sql");
const bindingRollbackPath = path.join(process.cwd(), "supabase", "rollbacks", "20261105100000_refresh_pending_review_execution_binding_rollback.sql");
const bindingForwardSql = fs.readFileSync(bindingForwardPath, "utf8");
const bindingRollbackSql = fs.readFileSync(bindingRollbackPath, "utf8");
const auditTriggerSql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "20260830151000_extend_automation_review_execution_evidence.sql"), "utf8");
const reasonContract = require("../config/automation-review-reason-codes.json");

function functionDefinition(source) {
  return source.match(/create or replace function public\.publish_automation_review_queue_changes\(p_request jsonb\)[\s\S]*?\$\$;/i)?.[0] || "";
}

function publicationReasonCodes(source) {
  const block = functionDefinition(source).match(/btrim\(reason\) not in \(\s*([\s\S]*?)\s*\)\s*\n\s*\) then/i)?.[1] || "";
  return [...block.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]);
}

test("review queue publication migration is additive control-plane only", () => {
  assert.match(sql, /create table public\.automation_review_queue_publications/i);
  assert.match(sql, /create or replace function public\.publish_automation_review_queue_changes\(p_request jsonb\)/i);
  assert.doesNotMatch(sql, /\b(update|insert into|delete from)\s+public\.(products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(sql, /'catalogue_writes', 0/i);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_CATALOGUE_WRITE_DETECTED/);
});

test("review queue publication RPC is service-role only and browser unavailable", () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/i);
  assert.match(sql, /revoke all on function public\.publish_automation_review_queue_changes\(jsonb\) from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function public\.publish_automation_review_queue_changes\(jsonb\) to service_role/i);
  assert.match(sql, /alter table public\.automation_review_queue_publications force row level security/i);
  assert.match(sql, /revoke all on table public\.automation_review_queue_publications from public, anon, authenticated, service_role/i);
});

test("RPC contract validates binding, fingerprints, keys, operation allowlist and batch limit", () => {
  for (const marker of [
    "schema_version",
    "publisher_batch_fingerprint",
    "idempotency_key",
    "changeset_fingerprint",
    "workflow_run_id",
    "artifact_id",
    "commit_sha",
    "capture_timestamp",
    "expected_baseline",
    "operations",
    "AUTOMATION_REVIEW_PUBLICATION_BATCH_LIMIT_EXCEEDED",
    "AUTOMATION_REVIEW_PUBLICATION_RETAILER_MISMATCH",
    "AUTOMATION_REVIEW_PUBLICATION_ROW_KEYS_INVALID",
  ]) {
    assert.match(sql, new RegExp(marker));
  }
  assert.match(sql, /CREATE','REFRESH','SUPERSEDE','RESOLVE_BY_SOURCE','EXPIRE/);
  assert.match(sql, /IDENTITY_CONFLICT','COMMERCIAL_CHANGE','SOURCE_FAILURE','MAPPING_DRIFT','POLICY_REVIEW/);
  assert.match(sql, /VERIFY_NO_CHANGE','UPDATE_PRICE','UPDATE_STOCK','UPDATE_PRICE_AND_STOCK/);
});

test("RPC enforces transactional locking, stale-state protection, race protection and idempotency", () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended/i);
  assert.match(sql, /order by q\.id\s+for update/i);
  assert.match(sql, /op#>>'\{expected,review_id\}'/);
  assert.match(sql, /where idempotency_key = v_idempotency_key\s+for update/i);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_STALE_EXPECTED_STATE/);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_DUPLICATE_ACTIVE_ROW/);
  assert.match(sql, /review_status in \('PENDING','APPROVED'\)/i);
});

test("RPC fails closed when the expected baseline no longer matches live state", () => {
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_BASELINE_HASH_MISMATCH/);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_BASELINE_CATALOGUE_COUNT_MISMATCH/);
  assert.match(sql, /AUTOMATION_REVIEW_PUBLICATION_BASELINE_ACTIVE_REVIEW_COUNT_MISMATCH/);
  assert.match(sql, /public\.retailer_catalogue_sha256_json\(v_catalog_before\) <> p_request#>>'\{expected_baseline,catalogue_hash_without_review_queue\}'/);
  assert.match(sql, /p_request->'expected_baseline'->'catalogue_counts' <> v_catalog_before/);
  assert.match(sql, /\(p_request#>>'\{expected_baseline,active_review_count\}'\)::bigint <> v_active_review_count/);
});

test("RPC catalogue baseline hash is direct numeric JSONB counts and excludes Review Queue", () => {
  assert.match(sql, /jsonb_build_object\(\s*'products', \(select count\(\*\) from public\.products\),\s*'product_variants', \(select count\(\*\) from public\.product_variants\),\s*'retailer_products', \(select count\(\*\) from public\.retailer_products\),\s*'offers', \(select count\(\*\) from public\.offers\),\s*'price_history', \(select count\(\*\) from public\.price_history\)/i);
  assert.match(sql, /public\.retailer_catalogue_sha256_json\(v_catalog_before\)/);
  assert.doesNotMatch(sql, /catalogue_counts'\s*,\s*v_catalog_before/);
  assert.doesNotMatch(sql, /product_match_review_queue[^;]*v_catalog_before/i);
  assert.doesNotMatch(sql, /automation_review_queue_publications[^;]*v_catalog_before/i);
});

test("RPC result is deterministic and audit-trigger aware without double audit insertion", () => {
  assert.match(sql, /select count\(\*\) into v_audit_before from public\.product_match_review_events/i);
  assert.match(sql, /select count\(\*\) into v_audit_after from public\.product_match_review_events/i);
  assert.doesNotMatch(sql, /insert into public\.product_match_review_events/i);
  for (const marker of [
    "created_count",
    "refreshed_count",
    "superseded_count",
    "resolved_by_source_count",
    "expired_count",
    "audit_event_delta",
    "final_active_fingerprints",
    "already_applied",
  ]) {
    assert.match(sql, new RegExp(marker));
  }
});

test("historical publication migration is immutable and the forward migration changes only the reason contract", () => {
  assert.equal(crypto.createHash("sha256").update(sql).digest("hex"), "8680e3303a8b4b22025f85af83a59a8dafbebc91e97719e423af8dff79f28409");
  const forwardFunction = functionDefinition(forwardSql);
  const rollbackFunction = functionDefinition(rollbackSql);
  assert.ok(forwardFunction);
  assert.equal(forwardFunction.replace("'HARD_PRICE_ANOMALY','STOCK_CHANGE'", "'STOCK_CHANGE'"), rollbackFunction);
  assert.doesNotMatch(forwardSql, /create table/i);
  assert.doesNotMatch(forwardSql, /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
});

test("canonical and SQL publication reason contracts are exact and fail closed", () => {
  const sqlReasons = publicationReasonCodes(forwardSql);
  assert.equal(sqlReasons.includes("HARD_PRICE_ANOMALY"), true);
  assert.equal(sqlReasons.includes("UNKNOWN_REASON"), false);
  assert.deepEqual([...sqlReasons].sort(), [...reasonContract.reason_codes].sort());
  assert.match(forwardSql, /AUTOMATION_REVIEW_PUBLICATION_ROW_CONTRACT_INVALID/);
});

test("forward publication function preserves security, grants and idempotent control-plane protections", () => {
  for (const marker of [
    /security definer/i,
    /set search_path = ''/i,
    /coalesce\(auth\.role\(\), ''\) <> 'service_role'/i,
    /AUTOMATION_REVIEW_PUBLICATION_IDEMPOTENCY_CONFLICT/,
    /AUTOMATION_REVIEW_PUBLICATION_DUPLICATE_ACTIVE_ROW/,
    /AUTOMATION_REVIEW_PUBLICATION_CATALOGUE_WRITE_DETECTED/,
    /revoke all on function public\.publish_automation_review_queue_changes\(jsonb\) from public, anon, authenticated, service_role/i,
    /grant execute on function public\.publish_automation_review_queue_changes\(jsonb\) to service_role/i,
  ]) assert.match(forwardSql, marker);
  assert.match(rollbackSql, /commit;\s*$/i);
  assert.equal(publicationReasonCodes(rollbackSql).includes("HARD_PRICE_ANOMALY"), false);
});

test("shared PENDING refresh migration atomically replaces the complete commercial execution binding", () => {
  for (const marker of [
    "AUTOMATION_REVIEW_PUBLICATION_REFRESH_CONTRACT_INVALID",
    "AUTOMATION_REVIEW_PUBLICATION_REFRESH_IDENTITY_DRIFT",
    "AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_REQUIRED",
    "AUTOMATION_REVIEW_PUBLICATION_REFRESH_BINDING_INVALID",
    "AUTOMATION_REVIEW_PUBLICATION_REFRESH_OPERATION_MISMATCH",
    "source_price =",
    "source_url =",
    "before_state =",
    "proposed_state =",
    "impact_summary =",
    "artifact_fingerprint =",
    "plan_fingerprint =",
    "plan_artifact_sha256 =",
  ]) assert.match(bindingForwardSql, new RegExp(marker));
  assert.match(bindingForwardSql, /v_existing_review\.review_status <> 'PENDING'/);
  assert.match(bindingForwardSql, /v_row->'source_evidence' is not distinct from v_existing_review\.source_evidence/);
  assert.match(bindingForwardSql, /from public\.offers o\s+join public\.retailer_products rp/i);
  assert.match(bindingForwardSql, /execution_binding,before_state,in_stock[\s\S]*execution_binding,proposed_state,offer,in_stock/);
  assert.match(bindingForwardSql, /execution_binding,before_state,url[\s\S]*execution_binding,proposed_state,offer,url/);
});

test("shared refresh migration remains one service-role control-plane function with zero catalogue writes", () => {
  assert.doesNotMatch(bindingForwardSql, /create table|alter table|create (?:unique )?index/i);
  assert.doesNotMatch(bindingForwardSql, /\b(?:insert into|update|delete from)\s+public\.(?:products|product_variants|retailer_products|offers|price_history)\b/i);
  assert.match(bindingForwardSql, /security definer/i);
  assert.match(bindingForwardSql, /set search_path = ''/i);
  assert.match(bindingForwardSql, /revoke all on function public\.publish_automation_review_queue_changes\(jsonb\) from public, anon, authenticated, service_role/i);
  assert.match(bindingForwardSql, /grant execute on function public\.publish_automation_review_queue_changes\(jsonb\) to service_role/i);
  assert.deepEqual(publicationReasonCodes(bindingForwardSql).sort(), [...reasonContract.reason_codes].sort());
});

test("shared refresh audit trigger captures full old and new snapshots as EVIDENCE_REFRESHED", () => {
  assert.match(auditTriggerSql, /v_event_type := 'EVIDENCE_REFRESHED'/);
  assert.match(auditTriggerSql, /to_jsonb\(old\)/i);
  assert.match(auditTriggerSql, /to_jsonb\(new\)/i);
  assert.match(bindingForwardSql, /select count\(\*\) into v_audit_before from public\.product_match_review_events/i);
  assert.match(bindingForwardSql, /select count\(\*\) into v_audit_after from public\.product_match_review_events/i);
});

test("shared refresh rollback restores the immediately preceding hard-price-aware RPC", () => {
  assert.equal(functionDefinition(bindingRollbackSql), functionDefinition(forwardSql));
  assert.equal(publicationReasonCodes(bindingRollbackSql).includes("HARD_PRICE_ANOMALY"), true);
  assert.match(bindingRollbackSql, /commit;\s*$/i);
  assert.doesNotMatch(bindingRollbackSql, /create table|alter table|create (?:unique )?index/i);
});
