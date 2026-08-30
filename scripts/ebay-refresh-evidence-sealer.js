const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "ebay-offer-refresh");
function invariant(condition, message) { if (!condition) throw new Error(message); }
function read(name) { return JSON.parse(fs.readFileSync(path.join(OUT, name), "utf8")); }
function ids(rows) { return rows.map((row) => String(row.offer_id)).sort((a, b) => Number(a) - Number(b)); }

function seal({ apply, postflight, idempotency, env = process.env }) {
  invariant(/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || ""), "Correlated eBay evidence requires the workflow commit SHA");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(apply.result) && apply.approved_mapping_count === 237 && apply.executable_plan_count > 0 && apply.executed_plan_count === apply.executable_plan_count && apply.review_row_count + apply.executable_plan_count === 237 && apply.blocked_row_count === 0, "eBay apply contract drift");
  invariant(apply.classification?.VERIFY_NO_CHANGE === apply.executable_plan_count && Object.keys(apply.classification).length === 1, "eBay apply contains a non-freshness action");
  invariant(apply.commit_sha === env.GITHUB_SHA && /^[0-9a-f]{64}$/.test(apply.manifest_sha256 || "") && /^[0-9a-f]{64}$/.test(apply.source_fingerprint || "") && /^[0-9a-f]{64}$/.test(apply.plan_fingerprint || ""), "eBay apply correlation binding missing");
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") invariant(/^[1-9][0-9]*$/.test(apply.approved_dry_run_id || "") && /^[1-9][0-9]*$/.test(apply.approved_artifact_id || "") && apply.approved_commit_sha === env.GITHUB_SHA && /^[0-9a-f]{64}$/.test(apply.approved_manifest_sha256 || "") && /^[0-9a-f]{64}$/.test(apply.approved_report_sha256 || ""), "eBay approved dry-run correlation binding missing");
  const logical = apply.expected_deltas?.logical_field_deltas || {}, rows = apply.expected_deltas?.row_count_deltas || {};
  invariant(logical.last_checked_at_updates === apply.executed_plan_count && ["offer_price_updates","offer_stock_updates","offer_shipping_updates","offer_total_updates","offer_url_updates","mapping_url_updates"].every((field) => logical[field] === 0) && ["products","product_variants","retailer_products","offers","price_history"].every((field) => rows[field] === 0), "eBay apply expected deltas drift");
  invariant(postflight.result === "PASS" && postflight.approved_mapping_count === 237 && postflight.executable_plan_count === apply.executable_plan_count && postflight.executed_plan_count === apply.executed_plan_count && postflight.review_row_count === apply.review_row_count && postflight.blocked_row_count === 0, "eBay DB postflight scope drift");
  invariant(postflight.freshness_change_count === apply.executed_plan_count && postflight.price_change_count === 0 && postflight.stock_change_count === 0 && postflight.shipping_change_count === 0 && postflight.total_change_count === 0 && postflight.offer_url_change_count === 0 && postflight.mapping_url_change_count === 0 && postflight.price_history_delta === 0 && /^[0-9a-f]{64}$/.test(postflight.postflight_hash || ""), "eBay DB postflight delta drift");
  invariant(["PASS", "PASS_WITH_REVIEW"].includes(idempotency.result) && idempotency.approved_mapping_count === 237 && idempotency.executable_plan_count === apply.executable_plan_count && idempotency.executed_plan_count === 0 && idempotency.review_row_count === apply.review_row_count && idempotency.blocked_row_count === 0, "eBay idempotency contract drift");
  invariant(idempotency.classification?.VERIFY_NO_CHANGE === apply.executable_plan_count && idempotency.execution_offer_ids.every((offerId) => idempotency.classifications?.[String(offerId)] === "VERIFY_NO_CHANGE"), "eBay idempotency executable scope contains a non-freshness action");
  invariant(JSON.stringify([...apply.execution_offer_ids].map(String).sort()) === JSON.stringify([...idempotency.execution_offer_ids].map(String).sort()), "eBay idempotency executable scope drift");
  invariant(JSON.stringify(ids(apply.review_rows)) === JSON.stringify(ids(idempotency.review_rows)), "eBay idempotency review scope drift");
  invariant(/^[0-9a-f]{64}$/.test(idempotency.source_fingerprint || "") && /^[0-9a-f]{64}$/.test(idempotency.plan_fingerprint || "") && idempotency.commit_sha === env.GITHUB_SHA, "eBay idempotency fingerprint binding missing");
  return {
    schema_version: 1,
    kind: "ebay-offer-refresh-correlated-evidence-v1",
    result: "PASS",
    retailer_id: "12",
    retailer: "eBay UK",
    run_id: String(env.GITHUB_RUN_ID),
    run_url: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    commit_sha: env.GITHUB_SHA,
    manifest_sha256: apply.manifest_sha256,
    source_fingerprint: apply.source_fingerprint,
    plan_fingerprint: apply.plan_fingerprint,
    approved_dry_run_id: apply.approved_dry_run_id,
    approved_artifact_id: apply.approved_artifact_id,
    approved_commit_sha: apply.approved_commit_sha,
    approved_manifest_sha256: apply.approved_manifest_sha256,
    approved_report_sha256: apply.approved_report_sha256,
    idempotency_source_fingerprint: idempotency.source_fingerprint,
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
  const evidence = seal({ apply: read("production-apply.json"), postflight: read("production-db-postflight.json"), idempotency: read("production-dry-run.json") });
  fs.writeFileSync(path.join(OUT, "production-correlated-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { seal };
