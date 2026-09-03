const fs = require("node:fs");
const path = require("node:path");
const { canonicalHash, sortedStrings } = require("./lib/ebay-artifact-bound-contract");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
function invariant(condition, message) { if (!condition) throw new Error(message); }
function read(name) { return JSON.parse(fs.readFileSync(path.join(OUT, name), "utf8")); }

function seal({ apply, baseline, postflight, idempotency, env = process.env }) {
  invariant(/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || ""), "Correlated eBay evidence requires the workflow commit SHA");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(apply.result) && apply.approved_mapping_count === 237 && apply.executable_plan_count > 0 && apply.executed_plan_count === apply.executable_plan_count && apply.review_row_count + apply.executable_plan_count === 237 && apply.blocked_row_count === 0, "eBay apply contract drift");
  invariant(apply.classification?.VERIFY_NO_CHANGE === apply.executable_plan_count && Object.keys(apply.classification).length === 1, "eBay apply contains a non-freshness action");
  invariant(apply.commit_sha === env.GITHUB_SHA && /^[0-9a-f]{64}$/.test(apply.manifest_sha256 || "") && ["full_capture_fingerprint","executable_source_fingerprint","review_scope_fingerprint","plan_fingerprint"].every((field) => /^[0-9a-f]{64}$/.test(apply[field] || "")), "eBay apply correlation binding missing");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") invariant(/^[1-9][0-9]*$/.test(apply.approved_dry_run_id || "") && /^[1-9][0-9]*$/.test(apply.approved_artifact_id || "") && apply.approved_commit_sha === env.GITHUB_SHA && /^[0-9a-f]{64}$/.test(apply.approved_manifest_sha256 || "") && /^[0-9a-f]{64}$/.test(apply.approved_report_sha256 || ""), "eBay approved dry-run correlation binding missing");
  const logical = apply.expected_deltas?.logical_field_deltas || {}, rows = apply.expected_deltas?.row_count_deltas || {};
  invariant(logical.last_checked_at_updates === apply.executed_plan_count && ["offer_price_updates","offer_stock_updates","offer_shipping_updates","offer_total_updates","offer_url_updates","mapping_url_updates"].every((field) => logical[field] === 0) && ["products","product_variants","retailer_products","offers","price_history"].every((field) => rows[field] === 0), "eBay apply expected deltas drift");
  invariant(postflight.result === "PASS" && postflight.approved_mapping_count === 237 && postflight.executable_plan_count === apply.executable_plan_count && postflight.executed_plan_count === apply.executed_plan_count && postflight.review_row_count === apply.review_row_count && postflight.blocked_row_count === 0, "eBay DB postflight scope drift");
  invariant(postflight.freshness_change_count === apply.executed_plan_count && postflight.price_change_count === 0 && postflight.stock_change_count === 0 && postflight.shipping_change_count === 0 && postflight.total_change_count === 0 && postflight.offer_url_change_count === 0 && postflight.mapping_url_change_count === 0 && postflight.price_history_delta === 0 && /^[0-9a-f]{64}$/.test(postflight.postflight_hash || ""), "eBay DB postflight delta drift");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(idempotency.result) && idempotency.approved_mapping_count === 237 && idempotency.executed_plan_count === 0 && idempotency.blocked_row_count === 0, "eBay idempotency contract drift");
  const approvedIds = sortedStrings(apply.execution_offer_ids), idempotencyIds = new Set(idempotency.execution_offer_ids.map(String));
  invariant(approvedIds.every((offerId) => idempotencyIds.has(offerId) && idempotency.classifications?.[offerId] === "VERIFY_NO_CHANGE"), "eBay idempotency approved executable scope contains drift or a non-freshness action");
  const sourceMap = new Map(idempotency.semantic_source_rows.map((row) => [String(row.offer_id), row]));
  invariant(canonicalHash(approvedIds.map((id) => sourceMap.get(id))) === apply.executable_source_fingerprint, "eBay idempotency executable source fingerprint drift");
  const planMap = new Map(idempotency.semantic_plan_rows.executable.map((row) => [String(row.offer_id), row]));
  const baselineMap = new Map((baseline?.snapshot?.rows || []).map((row) => [String(row.offer_id), row]));
  const expectedPlanFingerprints = new Map((apply.plan_row_fingerprints || []).map((row) => [String(row.offer_id), row.semantic_fingerprint]));
  invariant(baseline?.result === "PASS" && baseline?.profile === "ebay-uk" && baseline?.snapshot?.row_count === 237 && baselineMap.size === 237, "eBay idempotency baseline evidence missing");
  invariant(expectedPlanFingerprints.size === approvedIds.length && approvedIds.every((id) => expectedPlanFingerprints.has(id)), "eBay apply plan-row fingerprints missing");
  const restoredPlans = approvedIds.map((id) => {
    const freshPlan = planMap.get(id), before = baselineMap.get(id);
    invariant(freshPlan?.before_state?.offer && before?.last_checked_at, `eBay idempotency plan or baseline missing for offer ${id}`);
    const restored = JSON.parse(JSON.stringify(freshPlan));
    restored.before_state.offer.last_checked_at = before.last_checked_at;
    invariant(canonicalHash(restored) === expectedPlanFingerprints.get(id), `eBay idempotency plan drift outside freshness for offer ${id}`);
    return restored;
  });
  invariant(canonicalHash({ executable_offer_ids: approvedIds, executable: restoredPlans, expected_deltas: apply.expected_deltas }) === apply.plan_fingerprint, "eBay idempotency approved plan fingerprint drift outside freshness");
  invariant(idempotency.commit_sha === env.GITHUB_SHA, "eBay idempotency commit binding missing");
  return {
    schema_version: 2,
    kind: "ebay-offer-refresh-correlated-evidence-v2",
    result: "PASS",
    retailer_id: "12",
    retailer: "eBay UK",
    run_id: String(env.GITHUB_RUN_ID),
    run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    commit_sha: env.GITHUB_SHA,
    manifest_sha256: apply.manifest_sha256,
    source_fingerprint: apply.source_fingerprint,
    full_capture_fingerprint: apply.full_capture_fingerprint,
    executable_source_fingerprint: apply.executable_source_fingerprint,
    review_scope_fingerprint: apply.review_scope_fingerprint,
    approved_full_capture_fingerprint: apply.approved_full_capture_fingerprint,
    approved_review_scope_fingerprint: apply.approved_review_scope_fingerprint,
    plan_fingerprint: apply.plan_fingerprint,
    approved_dry_run_id: apply.approved_dry_run_id,
    approved_artifact_id: apply.approved_artifact_id,
    approved_commit_sha: apply.approved_commit_sha,
    approved_manifest_sha256: apply.approved_manifest_sha256,
    approved_report_sha256: apply.approved_report_sha256,
    idempotency_full_capture_fingerprint: idempotency.full_capture_fingerprint,
    idempotency_executable_source_fingerprint: idempotency.executable_source_fingerprint,
    idempotency_review_scope_fingerprint: idempotency.review_scope_fingerprint,
    idempotency_plan_fingerprint: idempotency.plan_fingerprint,
    postflight_hash: postflight.postflight_hash,
    approved_mapping_count: 237,
    executable_plan_count: apply.executable_plan_count,
    executed_plan_count: apply.executed_plan_count,
    review_row_count: apply.review_row_count,
    blocked_row_count: 0,
    execution_offer_ids: apply.execution_offer_ids.map(String),
    review_rows: apply.review_rows,
    expected_deltas: apply.expected_deltas,
    actual_deltas: { freshness: apply.executed_plan_count, price: 0, stock: 0, shipping: 0, total: 0, offer_url: 0, mapping_url: 0, price_history: 0 },
    price_history_delta: 0,
    database_writes: apply.executed_plan_count,
    idempotency_result: "PASS",
    completed_at: postflight.completed_at,
  };
}

function main() {
  const evidence = seal({ apply: read("production-apply.json"), baseline: read("production-db-baseline.json"), postflight: read("production-db-postflight.json"), idempotency: read("production-dry-run.json") });
  fs.writeFileSync(path.join(OUT, "production-correlated-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { seal };
