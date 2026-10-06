const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "automation-review-owner-decision-audit.json");
const PAGE_SIZE = 500;
const OWNER = "authenticated-admin";
const DECISIONS = new Set(["APPROVED", "REJECTED", "IGNORED"]);
const ACTIVE_REVIEW = new Set(["PENDING", "APPROVED", "EXECUTING"]);
const ACTIVE_EXECUTION = new Set(["QUEUED", "DISPATCHED", "EXECUTING"]);
const SYSTEM_FAILURE_CODES = new Set([
  "ACTIVE_REVIEW_DUPLICATE",
  "EXECUTED_EVIDENCE_INCOMPLETE",
  "EXECUTION_EVENT_STATUS_DRIFT",
  "EXECUTION_STUCK",
  "FAILED_AFTER_POSSIBLE_WRITE",
  "POSSIBLE_EXECUTION_DUPLICATE",
  "SUPERSESSION_LINK_INVALID",
]);

function invariant(condition, code) { if (!condition) { const error = new Error(code); error.code = code; throw error; } }
function insideTmp(value) {
  const resolved = path.resolve(value || DEFAULT_OUTPUT), relative = path.relative(path.join(ROOT, "tmp"), resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "AUDIT_OUTPUT_MUST_STAY_IN_TMP");
  return resolved;
}
function parseArgs(argv) {
  invariant(argv.length <= 1 && !argv.some((value) => /^--mode(?:=|$)/.test(value)), "AUDIT_MODE_NOT_ALLOWED");
  if (!argv.length) return { output: DEFAULT_OUTPUT };
  const match = argv[0].match(/^--output=(.+)$/);
  invariant(match, "AUDIT_ARGUMENT_INVALID");
  return { output: insideTmp(match[1]) };
}
function database(env = process.env) {
  invariant(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "AUDIT_READ_CREDENTIAL_MISSING");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function readAll(db, table, configure = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select("*", { count: from === 0 ? "exact" : undefined }).order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    query = configure(query);
    const { data, error, count } = await query;
    invariant(!error, `AUDIT_READ_FAILED_${table.toUpperCase()}`);
    rows.push(...(data || []));
    if ((count != null && rows.length >= count) || !data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
function latest(rows) { return [...rows].sort((a, b) => Date.parse(b.created_at || b.requested_at) - Date.parse(a.created_at || a.requested_at) || Number(b.id) - Number(a.id))[0] || null; }
function isHex64(value) { return /^[0-9a-f]{64}$/.test(String(value || "")); }
function array(value) { return Array.isArray(value) ? value : []; }
function minutesOld(value, now) { return value ? (now.getTime() - Date.parse(value)) / 60000 : Infinity; }

function auditData({ decisionEvents, reviews, requests, executionEvents }, now = new Date()) {
  const anomalies = [], summaries = [];
  const reviewById = new Map(reviews.map((row) => [String(row.id), row]));
  const requestsByReview = new Map();
  const eventsByRequest = new Map();
  for (const request of requests) (requestsByReview.get(String(request.review_id)) || requestsByReview.set(String(request.review_id), []).get(String(request.review_id))).push(request);
  for (const event of executionEvents) (eventsByRequest.get(String(event.execution_request_id)) || eventsByRequest.set(String(event.execution_request_id), []).get(String(event.execution_request_id))).push(event);

  const decisionCount = new Map();
  for (const event of decisionEvents) decisionCount.set(String(event.review_id), (decisionCount.get(String(event.review_id)) || 0) + 1);
  for (const event of decisionEvents) {
    const id = String(event.review_id), review = reviewById.get(id), reviewRequests = requestsByReview.get(id) || [];
    if (decisionCount.get(id) !== 1) anomalies.push({ code: "OWNER_DECISION_DUPLICATE", review_id: id, count: decisionCount.get(id) });
    if (!review) { anomalies.push({ code: "OWNER_DECISION_REVIEW_MISSING", review_id: id }); continue; }
    if (event.source_row_fingerprint !== review.source_row_fingerprint || event.plan_fingerprint !== review.plan_fingerprint) anomalies.push({ code: "OWNER_DECISION_EVIDENCE_DRIFT", review_id: id });
    const newest = latest(reviewRequests), decision = event.new_status;
    let outcome = decision === "REJECTED" ? "REJECTED" : decision === "IGNORED" ? "IGNORED" : "WAITING";
    if (decision === "APPROVED" && newest) outcome = newest.status;
    if (decision === "APPROVED" && !newest && !["APPROVED", "PENDING"].includes(review.review_status)) anomalies.push({ code: "APPROVED_WITHOUT_EXECUTION_REQUEST", review_id: id, review_status: review.review_status });
    for (const request of reviewRequests) {
      if (String(request.retailer_id) !== String(review.retailer_id) || request.operation_type !== review.operation_type || request.review_fingerprint !== review.source_row_fingerprint || request.plan_fingerprint !== review.plan_fingerprint) anomalies.push({ code: "EXECUTION_REQUEST_BINDING_DRIFT", review_id: id, execution_request_id: request.id });
      const requestEvents = eventsByRequest.get(String(request.id)) || [], lastEvent = latest(requestEvents);
      if (lastEvent && lastEvent.new_status !== request.status) anomalies.push({ code: "EXECUTION_EVENT_STATUS_DRIFT", review_id: id, execution_request_id: request.id, request_status: request.status, event_status: lastEvent.new_status });
      if (ACTIVE_EXECUTION.has(request.status)) {
        const threshold = request.status === "QUEUED" ? 10 : request.status === "DISPATCHED" ? 20 : 30;
        if (minutesOld(request.updated_at || request.requested_at, now) > threshold) anomalies.push({ code: "EXECUTION_STUCK", review_id: id, execution_request_id: request.id, status: request.status, threshold_minutes: threshold });
      }
      if (request.status === "EXECUTED") {
        const valid = request.completed_at && isHex64(request.postflight_hash) && request.idempotency_result === "PASS"
          && array(request.failed_offer_ids).length === 0 && array(request.remaining_offer_ids).length === 0
          && array(request.executed_offer_ids).map(String).includes(String(review.offer_id))
          && request.expected_deltas && request.actual_deltas && review.review_status === "EXECUTED";
        if (!valid) anomalies.push({ code: "EXECUTED_EVIDENCE_INCOMPLETE", review_id: id, execution_request_id: request.id });
      }
      if (request.status === "EXPIRED" && (Number(request.database_writes || 0) !== 0 || !request.error_code)) anomalies.push({ code: "EXPIRED_EVIDENCE_INVALID", review_id: id, execution_request_id: request.id });
      if (request.status === "FAILED" && Number(request.database_writes || 0) > 0) anomalies.push({ code: "FAILED_AFTER_POSSIBLE_WRITE", review_id: id, execution_request_id: request.id, database_writes: request.database_writes });
    }
    const executed = reviewRequests.filter((request) => request.status === "EXECUTED");
    const writeBearing = reviewRequests.filter((request) => Number(request.database_writes || 0) > 0);
    if (executed.length > 1 || writeBearing.length > 1) anomalies.push({ code: "POSSIBLE_EXECUTION_DUPLICATE", review_id: id, executed_count: executed.length, write_bearing_count: writeBearing.length });
    summaries.push({ review_id: id, retailer_id: String(review.retailer_id), offer_id: review.offer_id == null ? null : String(review.offer_id), decision, decided_at: event.created_at, current_review_status: review.review_status, outcome, execution_request_count: reviewRequests.length, latest_execution_request_id: newest?.id || null, latest_execution_status: newest?.status || null, github_artifact_verification_required: newest?.status === "EXECUTED" });
  }

  const activeByOffer = new Map();
  for (const review of reviews.filter((row) => ACTIVE_REVIEW.has(row.review_status))) {
    const key = `${review.retailer_id}:${review.offer_id}`;
    (activeByOffer.get(key) || activeByOffer.set(key, []).get(key)).push(String(review.id));
  }
  for (const [key, ids] of activeByOffer) if (ids.length > 1) anomalies.push({ code: "ACTIVE_REVIEW_DUPLICATE", retailer_offer: key, review_ids: ids });
  for (const review of reviews.filter((row) => row.superseded_by_review_id != null)) {
    const replacement = reviewById.get(String(review.superseded_by_review_id));
    if (!replacement || String(replacement.retailer_id) !== String(review.retailer_id) || String(replacement.offer_id) !== String(review.offer_id) || Number(replacement.id) <= Number(review.id)) anomalies.push({ code: "SUPERSESSION_LINK_INVALID", review_id: String(review.id), superseded_by_review_id: String(review.superseded_by_review_id) });
  }
  return { summaries, anomalies };
}

function monitorStatus({ reviews, requests, anomalies }) {
  const pendingOwnerDecisionCount = reviews.filter((row) => row.review_status === "PENDING").length;
  const activeExecutionCount = requests.filter((row) => ACTIVE_EXECUTION.has(row.status)).length;
  const systemFailureCount = anomalies.filter((row) => SYSTEM_FAILURE_CODES.has(row.code)).length;
  const reviewAttentionCount = anomalies.length - systemFailureCount;
  const monitorStatus = systemFailureCount
    ? "FAILED_SYSTEM"
    : pendingOwnerDecisionCount || reviewAttentionCount
      ? "WAITING_FOR_DECISION"
      : "SUCCESS";
  return { monitor_status: monitorStatus, pending_owner_decision_count: pendingOwnerDecisionCount, active_execution_count: activeExecutionCount, review_attention_count: reviewAttentionCount, system_failure_count: systemFailureCount };
}

function auditExitCode(report) {
  return report.monitor_status === "FAILED_SYSTEM" ? 1 : 0;
}

async function run(options = parseArgs(process.argv.slice(2)), dependencies = {}) {
  const db = dependencies.client || database(dependencies.env || process.env);
  const [decisionEvents, reviews, requests, executionEvents] = await Promise.all([
    readAll(db, "product_match_review_events", (query) => query.eq("actor", OWNER).eq("previous_status", "PENDING").in("new_status", [...DECISIONS])),
    readAll(db, "product_match_review_queue"),
    readAll(db, "automation_review_execution_requests"),
    readAll(db, "automation_review_execution_events"),
  ]);
  const audited = auditData({ decisionEvents, reviews, requests, executionEvents }, dependencies.now || new Date());
  const monitoring = monitorStatus({ reviews, requests, anomalies: audited.anomalies });
  const result = monitoring.monitor_status === "SUCCESS" ? "PASS" : monitoring.monitor_status === "WAITING_FOR_DECISION" ? "PASS_WITH_REVIEW" : "FAILED_SYSTEM";
  const report = { schema_version: 2, kind: "automation-review-owner-decision-read-only-audit", result, ...monitoring, generated_at: (dependencies.now || new Date()).toISOString(), owner_actor: OWNER, decision_count: decisionEvents.length, summary_count: audited.summaries.length, anomaly_count: audited.anomalies.length, github_artifact_verification_required_count: audited.summaries.filter((row) => row.github_artifact_verification_required).length, catalogue_writes: 0, execution_calls: 0, ...audited };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) run().then((report) => { console.log(JSON.stringify({ result: report.result, monitor_status: report.monitor_status, decisions: report.decision_count, pending_owner_decisions: report.pending_owner_decision_count, review_attention: report.review_attention_count, system_failures: report.system_failure_count })); process.exitCode = auditExitCode(report) || undefined; }).catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { auditData, auditExitCode, monitorStatus, parseArgs, readAll, run };
