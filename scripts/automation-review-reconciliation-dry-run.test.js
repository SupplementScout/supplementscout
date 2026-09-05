const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildManifestRows,
  buildOutput,
  operationForReview,
  parseArgs,
  verifySourceArtifact,
} = require("./automation-review-reconciliation-dry-run");
const { sha256 } = require("./lib/automation-review-publisher");

const SOURCE = Object.freeze({
  run: "33409588643",
  artifact: "9764693519",
  commit: "57e9ecd5554b82d714d3b563f2ba322841fa1ef7",
  artifactDigest: "0e0f4bb7e6fbd068d1b3dc5aa263632445c8b112328170cd1a8c8d947d14ed88",
  artifactContent: "a7e47e3fea7938ceebd50e15fcca6813b54ba8865a885489f48a3401092abffc",
  reviewScope: "63067cd5432f9fc37898a32c38ce5348353648f262eb801ed6948095a04d2572",
});

function sourceOptions(directory, extra = {}) {
  const contractSha = fileSha(path.join(directory, "production-dry-run-contract.json"));
  const reportSha = fileSha(path.join(directory, "production-dry-run.json"));
  return {
    sourceArtifactDir: directory,
    sourceZip: path.join(directory, "source.zip"),
    sourceRunId: SOURCE.run,
    sourceArtifactId: SOURCE.artifact,
    sourceCommitSha: SOURCE.commit,
    sourceArtifactDigest: SOURCE.artifactDigest,
    sourceContractSha256: contractSha,
    sourceReportSha256: reportSha,
    sourceArtifactContentSha256: SOURCE.artifactContent,
    sourceReviewScopeFingerprint: SOURCE.reviewScope,
    output: path.join(process.cwd(), "tmp", "automation-review-reconciliation-tests", `${Date.now()}-${Math.random()}.json`),
    ...extra,
  };
}

function writeFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "review-reconciliation-source-"));
  const report = {
    result: "PASS_WITH_REVIEW",
    mode: "dry-run",
    commit_sha: SOURCE.commit,
    captured_at: "2026-08-31T15:38:44.505Z",
    approved_mapping_count: 237,
    executable_plan_count: 235,
    executed_plan_count: 0,
    review_row_count: 2,
    blocked_row_count: 0,
    execution_offer_ids: ["2748", ...Array.from({ length: 234 }, (_, index) => String(3000 + index))],
    review_rows: [
      { offer_id: "2554", action: "UPDATE_PRICE", review_type: "COMMERCIAL_CHANGE" },
      { offer_id: "2686", decision: "NOT_FOUND", blockers: ["SOURCE_READ_FAILED"], source_error: "SOURCE_READ_FAILED", review_type: "SOURCE_FAILURE" },
    ],
    blocked_rows: [],
    semantic_source_rows: [
      semantic("2554", "2739", { decision: "REVIEW", price: "29.23", returned_gtin: null, blockers: [], review_reasons: ["RETURNED_GTIN_UNPROVEN"] }),
      semantic("2686", "2872", { decision: "NOT_FOUND", price: null, source_error: "SOURCE_READ_FAILED", blockers: ["SOURCE_READ_FAILED"] }),
      semantic("2748", "2934", { decision: "PASS", price: "20.99" }),
    ],
    source_row_fingerprints: [
      { offer_id: "2554", mapping_id: "2739", semantic_fingerprint: "2".repeat(64), scope: "REVIEW" },
      { offer_id: "2686", mapping_id: "2872", semantic_fingerprint: "3".repeat(64), scope: "REVIEW" },
      { offer_id: "2748", mapping_id: "2934", semantic_fingerprint: "4".repeat(64), scope: "EXECUTABLE" },
    ],
    review_scope_fingerprint: SOURCE.reviewScope,
    full_capture_fingerprint: "5".repeat(64),
    executable_source_fingerprint: "6".repeat(64),
    plan_fingerprint: "7".repeat(64),
  };
  const contract = {
    schema_version: 2,
    kind: "ebay-offer-refresh-executable-scope-contract-v2",
    repository: "SupplementScout/supplementscout",
    workflow: ".github/workflows/ebay-offer-refresh.yml",
    run_id: SOURCE.run,
    run_attempt: "1",
    commit_sha: SOURCE.commit,
    created_at: "2026-08-31T15:38:44.505Z",
    expires_at: "2026-09-01T15:38:44.505Z",
    report_file: "production-dry-run.json",
    report_sha256: "",
    artifact_content_sha256: SOURCE.artifactContent,
    full_capture_fingerprint: report.full_capture_fingerprint,
    executable_source_fingerprint: report.executable_source_fingerprint,
    review_scope_fingerprint: SOURCE.reviewScope,
    plan_fingerprint: report.plan_fingerprint,
    approved_mapping_count: 237,
    executable_plan_count: 235,
    review_row_count: 2,
    blocked_row_count: 0,
    executable_operation_types: ["VERIFY_NO_CHANGE"],
    review_offer_ids: ["2554", "2686"],
    executable_offer_ids: ["2748"],
  };
  writeJson(path.join(directory, "production-dry-run.json"), report);
  contract.report_sha256 = fileSha(path.join(directory, "production-dry-run.json"));
  writeJson(path.join(directory, "production-dry-run-contract.json"), contract);
  return { directory, report, contract };
}

function semantic(offerId, mappingId, extra = {}) {
  return {
    offer_id: offerId,
    mapping_id: mappingId,
    retailer_id: "12",
    product_id: offerId === "2554" ? "67" : "468",
    product_variant_id: offerId === "2554" ? "1033" : "2710",
    external_product_id: `external-${offerId}`,
    external_variant_id: `v1|external-${offerId}|variant`,
    external_url: `https://www.ebay.co.uk/itm/external-${offerId}?var=variant`,
    affiliate_url: `https://www.ebay.co.uk/itm/external-${offerId}?var=variant&mkevt=1`,
    returned_item_id: `v1|external-${offerId}|variant`,
    returned_legacy_item_id: `external-${offerId}`,
    returned_gtin: extra.returned_gtin ?? null,
    decision: extra.decision || "REVIEW",
    blockers: extra.blockers || [],
    review_reasons: extra.review_reasons || [],
    source_error: extra.source_error || null,
    continuity_tier: "sealed_existing_identity_continuity",
    seller: "seller",
    seller_account_type: "BUSINESS",
    price: extra.price,
    shipping: extra.price == null ? null : "0.00",
    total: extra.price,
    affiliate_ready: true,
    affiliate_url_returned: `https://www.ebay.co.uk/itm/external-${offerId}?campid=5339189922&var=variant`,
  };
}

function activeRows() {
  return [
    active("548", "2554", "a".repeat(64), "UPDATE_PRICE", "COMMERCIAL_CHANGE"),
    active("575", "2686", "b".repeat(64), "MANUAL_REVIEW", "SOURCE_FAILURE"),
  ];
}

function active(id, offerId, fingerprint, operation, kind) {
  return {
    id,
    retailer_id: "12",
    retailer: "eBay UK",
    offer_id: offerId,
    retailer_product_id: offerId === "2554" ? "2739" : "2872",
    current_product_id: offerId === "2554" ? "67" : "468",
    current_variant_id: offerId === "2554" ? "1033" : "2710",
    product_title: `Product ${offerId}`,
    variant_title: null,
    review_status: "PENDING",
    review_kind: kind,
    operation_type: operation,
    source_row_fingerprint: fingerprint,
    superseded_by_review_id: null,
    before_state: {
      offer_id: offerId,
      retailer_product_id: offerId === "2554" ? "2739" : "2872",
      product_id: offerId === "2554" ? "67" : "468",
      product_variant_id: offerId === "2554" ? "1033" : "2710",
      price: "1.00",
      shipping_cost: "0.00",
      total_price: "1.00",
      in_stock: true,
      url: `https://www.ebay.co.uk/itm/external-${offerId}?var=variant&mkevt=1`,
      external_url: `https://www.ebay.co.uk/itm/external-${offerId}?var=variant`,
      external_product_id: `external-${offerId}`,
      external_variant_id: `v1|external-${offerId}|variant`,
    },
  };
}

function baseline(rows = activeRows()) {
  const catalogueCounts = { products: 1130, product_variants: 2849, retailer_products: 2808, offers: 2808, price_history: 7113 };
  return {
    catalogue_counts: catalogueCounts,
    catalogue_hash_without_review_queue: sha256(catalogueCounts),
    queue_count: 516,
    audit_count: 422,
    publication_count: 0,
    ebay_status_counts: { PENDING: rows.length },
    active_ebay_review_count: rows.length,
    queue_snapshot_hash: sha256(rows.map((row) => ({ id: row.id, offer_id: row.offer_id, source_row_fingerprint: row.source_row_fingerprint }))),
    active_rows: rows,
    active_row_locks: rows.map((row) => row.id),
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("source artifact verification binds run, artifact hashes, commit and excludes offer 2748 from review scope", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = verifySourceArtifact(options);

  assert.equal(source.contract.run_id, SOURCE.run);
  assert.equal(source.contract.commit_sha, SOURCE.commit);
  assert.deepEqual(source.report.review_rows.map((row) => row.offer_id), ["2554", "2686"]);
  assert.equal(source.report.review_rows.some((row) => row.offer_id === "2748"), false);
});

test("source artifact verification derives the split dynamically and rejects count drift", () => {
  const fixture = writeFixture();
  assert.equal(verifySourceArtifact(sourceOptions(fixture.directory)).contract.review_row_count, 2);

  fixture.contract.review_row_count = 3;
  writeJson(path.join(fixture.directory, "production-dry-run-contract.json"), fixture.contract);
  assert.throws(() => verifySourceArtifact(sourceOptions(fixture.directory)), /scope count mismatch/);
});

test("review reconciliation dry-run uses shared publisher and computes CREATE/SUPERSEDE from current active rows", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = { ...verifySourceArtifact(options), options };
  const rows = buildManifestRows(source, activeRows());
  const output = buildOutput(source, baseline(), rows, options.output, { GITHUB_RUN_ID: "999", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" });

  assert.equal(output.source.run_id, SOURCE.run);
  assert.equal(output.operations.CREATE, 2);
  assert.equal(output.operations.SUPERSEDE, 2);
  assert.equal(output.operations.REFRESH, 0);
  assert.equal(output.operations.RESOLVE_BY_SOURCE, 0);
  assert.equal(output.operations.EXPIRE, 0);
  assert.equal(output.expected.audit_delta, 4);
  assert.equal(output.expected.final_active_review_count_for_ebay, 2);
  assert.equal(output.expected.catalogue_writes, 0);
  assert.equal(output.request.expected_baseline.catalogue_hash_without_review_queue, "7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51");
  assert.equal(output.lifecycle_consistency.one_future_rpc, true);
  assert.equal(output.lifecycle_consistency.no_direct_rest_writes, true);
  assert.equal(output.offer_2748.included_in_manifest, false);
  assert.equal(output.offer_2748.in_review_scope, false);
  assert.equal(output.offer_2748.in_executable_scope, true);
  assert.match(output.reconciliation_manifest_sha256, /^[0-9a-f]{64}$/);
});

test("matching fingerprints become REFRESH and missing source baseline stays isolated before writes", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = { ...verifySourceArtifact(options), options };
  const rows = buildManifestRows(source, activeRows());
  const matchingActive = activeRows().map((row, index) => ({ ...row, source_row_fingerprint: rows[index].source_row_fingerprint }));
  const output = buildOutput(source, baseline(matchingActive), rows, options.output, {});

  assert.equal(output.operations.CREATE, 0);
  assert.equal(output.operations.SUPERSEDE, 0);
  assert.equal(output.operations.REFRESH, 2);
  assert.equal(output.production_writes, 0);
  assert.equal(output.direct_rest_writes, 0);
});

test("review row normalization uses current allowlisted operations", () => {
  assert.equal(operationForReview({ action: "UPDATE_PRICE" }).operation_type, "UPDATE_PRICE");
  assert.equal(operationForReview({ review_type: "SOURCE_FAILURE" }).operation_type, "SOURCE_MISSING");
  assert.equal(operationForReview({ review_type: "IDENTITY_CONFLICT" }).operation_type, "MANUAL_REVIEW_IDENTITY");
});

test("CLI parser requires immutable source binding inputs", () => {
  assert.throws(() => parseArgs(["--source-run-id=33409588643"]), /Missing --source-artifact-id/);
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const parsed = parseArgs([
    `--source-artifact-dir=${fixture.directory}`,
    `--source-run-id=${options.sourceRunId}`,
    `--source-artifact-id=${options.sourceArtifactId}`,
    `--source-commit-sha=${options.sourceCommitSha}`,
    `--source-artifact-digest=${options.sourceArtifactDigest}`,
    `--source-contract-sha256=${options.sourceContractSha256}`,
    `--source-report-sha256=${options.sourceReportSha256}`,
    `--source-artifact-content-sha256=${options.sourceArtifactContentSha256}`,
    `--source-review-scope-fingerprint=${options.sourceReviewScopeFingerprint}`,
  ]);

  assert.equal(parsed.sourceRunId, SOURCE.run);
  assert.equal(parsed.sourceArtifactId, SOURCE.artifact);

  const bound = parseArgs([
    `--source-artifact-dir=${fixture.directory}`,
    `--source-binding=${[
      options.sourceRunId,
      options.sourceArtifactId,
      options.sourceCommitSha,
      options.sourceArtifactDigest,
      options.sourceContractSha256,
      options.sourceReportSha256,
      options.sourceArtifactContentSha256,
      options.sourceReviewScopeFingerprint,
    ].join(":")}`,
  ]);
  assert.equal(bound.sourceRunId, SOURCE.run);
  assert.equal(bound.sourceReviewScopeFingerprint, SOURCE.reviewScope);
});

test("workflow exposes a dry-run-only Review Queue reconciliation path", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /options: \[catalogue-refresh, review-queue, review-queue-reconciliation\]/);
  assert.match(workflow, /inputs\.operation == 'dry-run' && inputs\.execution_mode == 'review-queue-reconciliation'/);
  assert.match(workflow, /automation-review-reconciliation-dry-run\.js/);
  assert.match(workflow, /--download-source-artifact/);
  assert.match(workflow, /reconciliation_source_binding/);
  assert.doesNotMatch(workflow, /review-queue-reconciliation[\s\S]*publish_automation_review_queue_changes/);
});

test("dry-run builder has no direct queue writes or publication RPC apply call", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/automation-review-reconciliation-dry-run.js"), "utf8");
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.insert\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.update\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.delete\s*\(/);
  assert.doesNotMatch(source, /publish_automation_review_queue_changes/);
  assert.match(source, /buildPublicationRpcRequest/);
});
