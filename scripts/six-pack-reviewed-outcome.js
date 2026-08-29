const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
function fail(message) { throw new Error(message); }

function finalizeOutcome({ execution, postflight, idempotencyOutcome, idempotencyReport }) {
  if (execution.result !== "PASS" || postflight.result !== "PASS" || execution.reviewed_owner_approval?.reviewed_batch_fingerprint !== postflight.reviewed_batch_fingerprint) fail("Reviewed execution or DB postflight did not pass");
  if (execution.executed_plan_count !== execution.reviewed_owner_approval.approved_reviewed_plan_count) fail("Reviewed execution count mismatch");
  const executedOfferIds = (execution.rows || []).map((row) => String(row.offer_id));
  if (executedOfferIds.length !== execution.executed_plan_count || new Set(executedOfferIds).size !== executedOfferIds.length) fail("Reviewed execution offer IDs are incomplete or duplicated");
  const evidence = { executed_offer_ids: executedOfferIds, apply_replay_allowed: false };
  if (idempotencyOutcome === "success") {
    if (idempotencyReport?.result !== "PASS" || Object.entries(idempotencyReport.action_counts || {}).some(([action, count]) => action !== "VERIFY_NO_CHANGE" && count !== 0)) fail("Live-source idempotency evidence is not a no-change pass");
    return { result: "APPLY_SUCCEEDED_POSTFLIGHT_PASSED_IDEMPOTENCY_PASSED", requires_read_only_idempotency_follow_up: false, recommended_action: null, ...evidence };
  }
  if (idempotencyReport?.classification_state === "SOURCE_READ_FAILED" && idempotencyReport?.source_error?.timeout === true) {
    return { result: "APPLY_SUCCEEDED_POSTFLIGHT_PASSED_IDEMPOTENCY_DEFERRED", requires_read_only_idempotency_follow_up: true, recommended_action: "RUN_READ_ONLY_IDEMPOTENCY_CHECK", ...evidence };
  }
  fail("Post-apply idempotency failed for a reason other than a source timeout");
}

function tmpPath(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(path.join(ROOT, "tmp"), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Outcome evidence must be inside repository tmp");
  return resolved;
}

function run(argv = process.argv.slice(2), env = process.env) {
  const values = {};
  for (const arg of argv) { const match = arg.match(/^--(execution|postflight|idempotency|output)=(.*)$/); if (!match || values[match[1]]) fail(`Invalid argument ${arg}`); values[match[1]] = tmpPath(match[2]); }
  for (const key of ["execution", "postflight", "output"]) if (!values[key]) fail(`Required --${key}`);
  const read = (file) => file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const result = finalizeOutcome({ execution: read(values.execution), postflight: read(values.postflight), idempotencyOutcome: env.IDEMPOTENCY_OUTCOME, idempotencyReport: read(values.idempotency) });
  const report = { schema_version: 1, kind: "six-pack-reviewed-owner-outcome", ...result, completed_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(values.output), { recursive: true }); fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`); return report;
}

if (require.main === module) { try { console.log(JSON.stringify(run(), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { finalizeOutcome, run };
