const fs = require("node:fs");
const path = require("node:path");
const { actionForPlan } = require("./ebay-offer-refresh");
const { buildSemanticPlanRows, canonicalHash, fileSha256, sortedStrings } = require("./lib/ebay-artifact-bound-contract");

const ROOT = path.resolve(__dirname, "..");
const APPROVED = path.join(ROOT, "tmp", "ebay-offer-refresh", "download-33329160827", "files", "production-dry-run.json");
const FAILED = path.join(ROOT, "tmp", "ebay-offer-refresh", "download-33330111793", "files");
const OUTPUT = path.join(ROOT, "docs", "rollouts", "ebay-fresh-source-drift-33330111793.json");
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function invariant(condition, message) { if (!condition) throw new Error(message); }
function differences(before, after, prefix = "", output = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return output;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) differences(before[key], after[key], prefix ? `${prefix}.${key}` : key, output);
    return output;
  }
  output.push({ field: prefix, before: before === undefined ? "__MISSING__" : before, after: after === undefined ? "__MISSING__" : after });
  return output;
}

function build() {
  const approved = read(APPROVED);
  const pendingFiles = fs.readdirSync(FAILED).filter((name) => /^pending-\d+\.json$/.test(name)).sort();
  const prepared = pendingFiles.map((name) => {
    const artifact = read(path.join(FAILED, name));
    const entry = artifact.plans[0], plan = entry.resolved_plan;
    return { offer_id: String(plan.offer.id), action: actionForPlan(plan), approved: { entry } };
  });
  const freshExecutable = buildSemanticPlanRows(prepared, [], []).executable;
  const approvedMap = new Map(approved.semantic_plan_rows.executable.map((row) => [String(row.offer_id), row]));
  const freshMap = new Map(freshExecutable.map((row) => [String(row.offer_id), row]));
  const approvedIds = sortedStrings([...approvedMap.keys()]);
  const freshIds = sortedStrings([...freshMap.keys()]);
  const rows = approvedIds.map((offerId) => {
    const before = approvedMap.get(offerId), after = freshMap.get(offerId);
    return { offer_id: offerId, mapping_id: before?.before_state?.retailer_product?.id || null, differences: differences(before, after) };
  }).filter((row) => row.differences.length);
  const fields = {};
  for (const row of rows) for (const difference of row.differences) fields[difference.field] = (fields[difference.field] || 0) + 1;
  const staleMatchesApprovedTestEvidence = fileSha256(path.join(FAILED, "production-dry-run.json")) === fileSha256(path.join(ROOT, "tmp", "ebay-offer-refresh", "download-33329160827", "files", "dry-run-2026-08-30T18-49-52-597Z.json"));
  invariant(approvedIds.length === 197 && freshIds.length === 197 && rows.length === 197, "Unexpected reconstructed executable scope");
  invariant(Object.keys(fields).length === 1 && fields["offer.values.last_checked_at"] === 197, "Unexpected executable plan drift");
  return {
    schema_version: 1,
    kind: "ebay-fresh-source-drift-field-level-diagnostic",
    approved: { run_id: "33329160827", artifact_id: "9737191533", report_sha256: fileSha256(APPROVED), full_source_fingerprint_legacy: approved.source_fingerprint, plan_fingerprint_legacy: approved.plan_fingerprint },
    failed_apply: { run_id: "33330111793", result: "BLOCK", failed_step: "Prepare exact approved existing-offer refresh", error: "Fresh source_fingerprint drift", approval_apply_rpc_count: 0, database_writes: 0 },
    evidence_integrity: {
      final_fresh_semantic_source_rows_persisted: false,
      reason: "verifyFreshReport threw before the final prepare-apply report was written",
      artifact_production_dry_run_is_stale_test_output: staleMatchesApprovedTestEvidence,
      stale_test_output_sha256: fileSha256(path.join(FAILED, "production-dry-run.json")),
      exact_source_field_diff_available: false,
      exact_plan_and_database_before_state_diff_available_for_all_approved_executable_rows: true,
    },
    inventory: { approved_source_rows: approved.semantic_source_rows.length, approved_executable_rows: approvedIds.length, fresh_pending_plans: prepared.length, fresh_verify_no_change_plans: freshIds.length, missing_approved_executable_offer_ids: approvedIds.filter((id) => !freshMap.has(id)), unexpected_fresh_executable_offer_ids: freshIds.filter((id) => !approvedMap.has(id)), executable_order_changed: JSON.stringify(approvedIds) !== JSON.stringify(freshIds) },
    executable_plan_diff: { differing_offer_count: rows.length, differing_mapping_count: new Set(rows.map((row) => String(row.mapping_id))).size, field_counts: fields, rows },
    protected_field_changes: { price: 0, stock: 0, shipping: 0, total: 0, offer_url: 0, mapping: 0, product: 0, variant: 0, price_history: 0, last_checked_at_target_timestamp_only: 197 },
    diagnosis: {
      categories: ["VOLATILE_FIELD_IN_FINGERPRINT", "CANONICALIZATION_BUG"],
      executable_row_semantic_drift_proven: false,
      executable_plan_nontechnical_drift_count: 0,
      review_only_source_drift_proven: false,
      source_inventory_drift_proven: false,
      row_order_drift_proven: false,
      systemic_source_failure_proven: false,
      evidence_gap: "The failed run did not persist final fresh source rows, so the exact source field and review-only attribution cannot be reconstructed from its artifact.",
      legacy_contract_defects: ["plan fingerprint included the newly generated offer.values.last_checked_at", "one source fingerprint bound executable and review rows together", "raw returned affiliate URL could include volatile amdata", "failure evidence was written after the throwing comparison"],
    },
    canonical_reconstruction_fingerprint: canonicalHash({ approved_ids: approvedIds, fresh_ids: freshIds, rows }),
  };
}

if (require.main === module) {
  const report = build();
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: "PASS", output: path.relative(ROOT, OUTPUT), differing_rows: report.executable_plan_diff.differing_offer_count, field_counts: report.executable_plan_diff.field_counts, fingerprint: report.canonical_reconstruction_fingerprint }));
}
module.exports = { build, differences };
