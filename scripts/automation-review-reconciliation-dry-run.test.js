const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildManifestRows,
  buildOutput,
  currentReviewStateRows,
  operationForReview,
  parseArgs,
  verifySourceArtifact,
} = require("./automation-review-reconciliation-dry-run");
const { sha256 } = require("./lib/automation-review-publisher");
const {
  bindSource: bindSharedRetailerSource,
  buildManifestRows: buildFitHouseManifestRows,
  buildOutput: buildFitHouseOutput,
  buildSourceContract: buildFitHouseSourceContract,
  verifySourceContract: verifyFitHouseSourceContract,
} = require("./shared-retailer-automation-review-source");

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

test("source artifact verification binds run, artifact hashes, commit and dynamic review scope", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = verifySourceArtifact(options);

  assert.equal(source.contract.run_id, SOURCE.run);
  assert.equal(source.contract.commit_sha, SOURCE.commit);
  assert.deepEqual(source.report.review_rows.map((row) => row.offer_id), ["2554", "2686"]);
  assert.equal(source.report.review_rows.some((row) => row.offer_id === "2748"), false);
});

test("source artifact verification permits offer 2748 when current signed evidence places it in review", () => {
  const fixture = writeFixture();
  fixture.report.execution_offer_ids = fixture.report.execution_offer_ids.map((offerId) => offerId === "2748" ? "2686" : offerId);
  fixture.report.review_rows[1] = { offer_id: "2748", decision: "REJECT", blockers: ["LISTING_OUT_OF_STOCK"], review_type: "IDENTITY_CONFLICT" };
  fixture.report.semantic_source_rows[1] = semantic("2686", "2872", { decision: "PASS", price: "20.99" });
  fixture.report.semantic_source_rows[2] = semantic("2748", "2934", { decision: "REJECT", price: "20.99", blockers: ["LISTING_OUT_OF_STOCK"] });
  fixture.report.source_row_fingerprints[1].scope = "EXECUTABLE";
  fixture.report.source_row_fingerprints[2].scope = "REVIEW";
  fixture.contract.review_offer_ids = ["2554", "2748"];
  fixture.contract.executable_offer_ids = ["2686"];
  writeJson(path.join(fixture.directory, "production-dry-run.json"), fixture.report);
  fixture.contract.report_sha256 = fileSha(path.join(fixture.directory, "production-dry-run.json"));
  writeJson(path.join(fixture.directory, "production-dry-run-contract.json"), fixture.contract);

  const source = verifySourceArtifact(sourceOptions(fixture.directory));
  assert.deepEqual(source.report.review_rows.map((row) => row.offer_id), ["2554", "2748"]);
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

test("matching approved evidence stays immutable instead of becoming REFRESH", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = { ...verifySourceArtifact(options), options };
  const rows = buildManifestRows(source, activeRows());
  const matchingApproved = activeRows().map((row, index) => ({ ...row, review_status: "APPROVED", decision_actor: "authenticated-admin", source_row_fingerprint: rows[index].source_row_fingerprint }));
  const output = buildOutput(source, baseline(matchingApproved), rows, options.output, {});

  assert.equal(output.operations.CREATE, 0);
  assert.equal(output.operations.REFRESH, 0);
  assert.equal(output.operations.SUPERSEDE, 0);
  assert.equal(output.operations.RESOLVE_BY_SOURCE, 0);
  assert.equal(output.request.operations.length, 0);
  assert.equal(output.expected.final_active_review_count_for_ebay, 2);
});

test("one transaction can refresh unchanged evidence and supersede changed evidence", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = { ...verifySourceArtifact(options), options };
  const rows = buildManifestRows(source, activeRows());
  const mixedActive = activeRows().map((row, index) => index === 0 ? { ...row, source_row_fingerprint: rows[index].source_row_fingerprint } : row);
  const output = buildOutput(source, baseline(mixedActive), rows, options.output, {});

  assert.equal(output.operations.CREATE, 1);
  assert.equal(output.operations.REFRESH, 1);
  assert.equal(output.operations.SUPERSEDE, 1);
  assert.equal(output.expected.final_active_review_count_for_ebay, 2);
  assert.equal(output.production_writes, 0);
});

test("full 237-offer observation resolves an old review problem absent from the new review scope", () => {
  const fixture = writeFixture();
  const options = sourceOptions(fixture.directory);
  const source = { ...verifySourceArtifact(options), options };
  const rows = buildManifestRows(source, activeRows());
  const oldResolved = active("600", "2748", "c".repeat(64), "MANUAL_REVIEW_IDENTITY", "IDENTITY_CONFLICT");
  const output = buildOutput(source, baseline([...activeRows(), oldResolved]), rows, options.output, {});

  assert.equal(output.operations.RESOLVE_BY_SOURCE, 1);
  assert.equal(output.expected.final_active_review_count_for_ebay, 2);
  assert.equal(output.request.operations.find((operation) => operation.op === "RESOLVE_BY_SOURCE").expected.review_id, "600");
});

test("review row normalization uses current allowlisted operations", () => {
  assert.equal(operationForReview({ action: "UPDATE_PRICE" }).operation_type, "UPDATE_PRICE");
  assert.equal(operationForReview({ review_type: "SOURCE_FAILURE" }).operation_type, "SOURCE_MISSING");
  assert.equal(operationForReview({ review_type: "IDENTITY_CONFLICT" }).operation_type, "MANUAL_REVIEW_IDENTITY");
});

test("missing queue history uses exact current DB offer and mapping state", () => {
  const source = [semantic("2554", "2739", { decision: "REVIEW", price: "29.23" })];
  const rows = currentReviewStateRows(source, [{ id: "2554", retailer_id: "12", retailer_product_id: "2739", product_id: "67", product_variant_id: "1033", price: 20, shipping_cost: 0, total_price: 20, in_stock: true, url: "https://www.ebay.co.uk/itm/2554" }], [{ id: "2739", retailer_id: "12", product_id: "67", product_variant_id: "1033", external_product_id: "2554", external_variant_id: null, external_url: "https://www.ebay.co.uk/itm/2554" }]);
  assert.deepEqual(rows[0].before_state, { offer_id: "2554", retailer_product_id: "2739", product_id: "67", product_variant_id: "1033", price: "20", shipping_cost: "0", total_price: "20", in_stock: true, url: "https://www.ebay.co.uk/itm/2554", external_url: "https://www.ebay.co.uk/itm/2554", external_product_id: "2554", external_variant_id: null });
  assert.throws(() => currentReviewStateRows(source, [], []), /Missing current DB state/);
  assert.throws(() => currentReviewStateRows(source, [{ id: "2554", retailer_id: "12", retailer_product_id: "2739", product_id: "67", product_variant_id: "999", price: 20 }], [{ id: "2739", retailer_id: "12", product_id: "67", product_variant_id: "1033" }]), /identity drift/);
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
  assert.match(workflow, /options: \[catalogue-refresh, review-queue-reconciliation\]/);
  assert.match(workflow, /inputs\.operation == 'dry-run' && inputs\.execution_mode == 'review-queue-reconciliation'/);
  assert.match(workflow, /automation-review-reconciliation-dry-run\.js/);
  assert.match(workflow, /--download-source-artifact/);
  assert.match(workflow, /reconciliation_source_binding/);
  assert.doesNotMatch(workflow, /review-queue-reconciliation[\s\S]*publish_automation_review_queue_changes/);
});

test("normal catalogue refresh publishes its fresh review cards through the guarded queue RPC", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /refresh-review-queue:[\s\S]*needs: refresh/);
  const queueJobCondition = workflow.match(/refresh-review-queue:\s*\n\s*needs: refresh\s*\n\s*if: ([^\n]+)/)?.[1] || "";
  assert.match(queueJobCondition, /github\.event_name == 'workflow_dispatch' && inputs\.operation == 'apply'/);
  assert.match(queueJobCondition, /github\.event_name == 'schedule' && vars\.EBAY_REFRESH_ENABLED == 'true'/);
  assert.doesNotMatch(queueJobCondition, /inputs\.operation == 'dry-run'/);
  const idempotencyStep = workflow.match(
    /- name: Verify fresh no-op after apply[\s\S]*?run: npm run ebay:refresh[^\n]+/,
  )?.[0] || "";
  assert.match(idempotencyStep, /run: npm run ebay:refresh -- --target=production --mode=dry-run --emit-approval-contract=true/);
  assert.match(workflow, /refresh-review-queue:[\s\S]*?if: \$\{\{[^\n]*needs\.refresh\.outputs\.contract_sha256 != ''[^\n]*needs\.refresh\.outputs\.report_sha256 != ''[^\n]*needs\.refresh\.outputs\.content_sha256 != ''[^\n]*needs\.refresh\.outputs\.review_scope_fingerprint != ''/);
  assert.match(workflow, /source-run-id=\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /source-artifact-id=\$\{\{ needs\.refresh\.outputs\.artifact_id \}\}/);
  assert.match(workflow, /Publish fresh cards to Automation Review Queue/);
  assert.match(workflow, /automation-review-reconciliation-apply\.js/);
});

test("dry-run builder has no direct queue writes or publication RPC apply call", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/automation-review-reconciliation-dry-run.js"), "utf8");
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.insert\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.update\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.delete\s*\(/);
  assert.doesNotMatch(source, /publish_automation_review_queue_changes/);
  assert.match(source, /buildPublicationRpcRequest/);
});

function writeFitHouseFixture({ executableCount = 272, reviewCount = 14 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fit-house-review-source-"));
  const sourceFingerprint = "8".repeat(64);
  const baselineRows = Array.from({ length: 286 }, (_, index) => ({
    mapping_id: String(1001 + index),
    retailer_id: "9",
    mapping_product_id: String(2001 + index),
    mapping_variant_id: String(3001 + index),
    external_product_id: `product-${index + 1}`,
    external_variant_id: `variant-${index + 1}`,
    external_sku: null,
    external_gtin: null,
    external_options: null,
    external_url: `https://fithouse.uk/products/product-${index + 1}`,
    offer_id: String(index + 1),
    offer_product_id: String(2001 + index),
    offer_variant_id: String(3001 + index),
    price: "10.00",
    shipping_cost: "3.99",
    total_price: "13.99",
    in_stock: index % 2 === 0,
    url: `https://fithouse.uk/products/product-${index + 1}`,
    last_checked_at: "2026-10-05T09:00:00.000Z",
  }));
  const changedRows = baselineRows.slice(0, reviewCount).map((row) => ({
    offer_id: row.offer_id,
    retailer_product_id: row.mapping_id,
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    action: "UPDATE_STOCK",
    changed_fields: { price: false, stock: true, url: false, blocked: false },
    old_price: row.price,
    new_price: row.price,
    old_stock: row.in_stock,
    new_stock: !row.in_stock,
  }));
  const reviewRows = changedRows.map((row, index) => ({
    ...row,
    reason: index === 0 ? "MASS_OOS" : "OWNER_DEFERRED_STOCK_REVIEW",
  }));
  const executionOfferIds = baselineRows.slice(reviewCount, reviewCount + executableCount).map((row) => row.offer_id);
  const report = {
    result: "PASS_WITH_REVIEW", mode: "dry-run", target: "production",
    source: { fingerprint: sourceFingerprint }, approved_mapping_count: 286,
    deferred_changed_offer_ids: reviewRows.filter((row) => row.reason === "OWNER_DEFERRED_STOCK_REVIEW").map((row) => row.offer_id), execution_offer_ids: executionOfferIds,
    verification_offer_ids: executionOfferIds, stock_change_offer_ids: [], executable_plan_count: executableCount,
    executed_plan_count: 0, review_row_count: reviewCount, blocked_row_count: 0,
    classification: { VERIFY_NO_CHANGE: executableCount },
    review_rows: reviewRows,
  };
  const diagnostic = { result: "PASS", timestamp: "2026-10-05T09:01:00.000Z", failure_stage: null, approved_mapping_count: 286, source: { fingerprint: sourceFingerprint }, database_writes_attempted: 0, database_writes_completed: 0, business_writes_completed: 0, control_writes_completed: 0, approvals_created: 0, approvals_consumed: 0, recovery_calls: 0, classifier_summary: { scope: { scope_row_ids: baselineRows.map((row) => row.offer_id), blocked_rows: 0, reconciled: true, reconciled_total: 286 }, action_counts: report.classification, changed_row_ids: [], changed_rows: [] } };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "fit-house", snapshot: { captured_at: "2026-10-05T09:00:59.000Z", retailer_id: "9", retailer_name: "Fit House", row_count: 286, rows: baselineRows }, evidence_hash: "a".repeat(64) };
  writeJson(path.join(directory, "production-dry-run.json"), report);
  writeJson(path.join(directory, "production-preflight-diagnostic.json"), diagnostic);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  return { directory, baselineRows, changedRows };
}

test("Fit House source adapter seals the fresh 272 safe plus 14 review classification before execution", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37313299039", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.approved_mapping_count, 286);
  assert.equal(contract.executable_plan_count, 272);
  assert.equal(contract.review_row_count, 14);
  assert.equal(contract.blocked_row_count, 0);
  assert.equal(contract.catalogue_offer_ids.length, 286);
  assert.equal(contract.review_offer_ids.length, 14);
  assert.equal(contract.catalogue_writes, 0);
  assert.match(contract.review_scope_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(contract.contract_fingerprint, /^[0-9a-f]{64}$/);
});

test("Fit House source adapter accepts the ordinary 272 safe confirmations plus 14 review rows", () => {
  const fixture = writeFitHouseFixture({ executableCount: 272, confirmationCount: 246 });
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37347458788", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.executable_plan_count, 272);
  assert.equal(contract.review_row_count, 14);
  assert.equal(contract.catalogue_writes, 0);

  const reportPath = path.join(fixture.directory, "production-dry-run.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.stock_change_offer_ids = [report.execution_offer_ids[0]];
  writeJson(reportPath, report);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /executable offer IDs drifted/);
});

test("Fit House source adapter accepts the exact natural 275 plus 11 isolated partition", () => {
  const fixture = writeFitHouseFixture({ executableCount: 275, reviewCount: 11 });
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "38039918378", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.executable_plan_count, 275);
  assert.equal(contract.review_row_count, 11);
  assert.equal(contract.catalogue_offer_ids.length, 286);
  assert.deepEqual(contract.review_offer_ids, fixture.changedRows.map((row) => row.offer_id));
});

test("Fit House source adapter keeps aggregate MASS_OOS review separate from owner-deferred IDs", () => {
  const fixture = writeFitHouseFixture({ executableCount: 275, reviewCount: 11 });
  const reportPath = path.join(fixture.directory, "production-dry-run.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.deferred_changed_offer_ids.push(fixture.changedRows[0].offer_id);
  writeJson(reportPath, report);
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "38049959238", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /deferred review IDs drifted/);
});

test("Fit House source adapter rejects count-to-row drift and accepts an exact repartition", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37313299039", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const reportPath = path.join(fixture.directory, "production-dry-run.json"), diagnosticPath = path.join(fixture.directory, "production-preflight-diagnostic.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")), diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, "utf8"));
  report.review_row_count = 13;
  writeJson(reportPath, report);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /ordinary partition is incomplete/);
  const removedReview = report.review_rows.pop();
  if (removedReview.reason === "OWNER_DEFERRED_STOCK_REVIEW") report.deferred_changed_offer_ids.pop();
  const resolvedOfferId = fixture.changedRows.at(-1).offer_id;
  report.execution_offer_ids.push(resolvedOfferId);
  report.verification_offer_ids.push(resolvedOfferId);
  report.executable_plan_count += 1;
  report.classification.VERIFY_NO_CHANGE += 1;
  diagnostic.classifier_summary.action_counts = report.classification;
  writeJson(reportPath, report); writeJson(diagnosticPath, diagnostic);
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.review_row_count, 13);
  assert.equal(contract.review_offer_ids.length, 13);
});

test("Fit House source adapter rejects a classifier scope that omits one of the 286 approved offers", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37442830504", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const diagnosticPath = path.join(fixture.directory, "production-preflight-diagnostic.json");
  const diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, "utf8"));
  diagnostic.classifier_summary.scope.scope_row_ids.pop();
  writeJson(diagnosticPath, diagnostic);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /preflight classifier IDs drifted/);
});

test("Fit House adapter builds one shared-publisher request with 14 review cards and no catalogue writes", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37313299039", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  writeJson(path.join(fixture.directory, "automation-review-source-contract.json"), contract);
  const options = { sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11336730617", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "c".repeat(64), sourceContractSha256: fileSha(path.join(fixture.directory, "automation-review-source-contract.json")), output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-05T10:00:00Z"));
  const reviewBaselineRows = fixture.baselineRows.slice(0, 14);
  const baseline = {
    catalogueCounts: { products: 1337, product_variants: 3632, retailer_products: 3758, offers: 3758, price_history: 27401 },
    activeRows: [{ id: "900", retailer_id: "9", offer_id: "200", review_status: "PENDING", review_kind: "IDENTITY_CONFLICT", operation_type: "MANUAL_REVIEW_IDENTITY", reason_codes: "IDENTITY_CONFLICT", source_row_fingerprint: "d".repeat(64), superseded_by_review_id: null }],
    offers: reviewBaselineRows.map((row) => ({ id: row.offer_id, retailer_id: "9", retailer_product_id: row.mapping_id, product_id: row.offer_product_id, product_variant_id: row.offer_variant_id, price: row.price, shipping_cost: row.shipping_cost, total_price: row.total_price, in_stock: row.in_stock, url: row.url })),
    mappings: reviewBaselineRows.map((row) => ({ id: row.mapping_id, retailer_id: "9", product_id: row.mapping_product_id, product_variant_id: row.mapping_variant_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, external_gtin: null, external_url: row.external_url })),
    products: reviewBaselineRows.map((row) => ({ id: row.offer_product_id, name: `Product ${row.offer_id}` })),
    variants: reviewBaselineRows.map((row) => ({ id: row.offer_variant_id, display_name: `Variant ${row.offer_id}` })),
  };
  const rows = buildFitHouseManifestRows(source, baseline, options);
  const output = buildFitHouseOutput(source, baseline, rows, options, env);
  assert.equal(rows.length, 14);
  assert.equal(rows.every((row) => row.operation_type === "UPDATE_STOCK" && row.reason_codes === "STOCK_CHANGE"), true);
  assert.equal(output.operations.CREATE, 14);
  assert.equal(output.operations.RESOLVE_BY_SOURCE, 0);
  assert.equal(output.request.operations.length, 14);
  assert.equal(output.request.expected_baseline.active_review_count, 1);
  assert.equal(output.request.operations.some((operation) => operation.expected.review_id === "900"), false);
  assert.equal(output.expected.catalogue_writes, 0);
  assert.equal(output.production_writes, 0);
  assert.equal(output.direct_rest_writes, 0);
});

function writeTenRepsFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ten-reps-review-source-"));
  const sourceFingerprint = "9".repeat(64);
  const reviewOfferIds = new Set(["2853", "2854", "2855", "2856", "2857", "2858", "2859", "2896", "2897", "2898", "2913", "2914", "3384", "3388", "3496", "3627"]);
  const offerIds = [
    ...reviewOfferIds,
    ...Array.from({ length: 934 }, (_, index) => String(4000 + index)),
  ];
  const baselineRows = offerIds.map((offerId, index) => ({
    mapping_id: String(5001 + index),
    retailer_id: "14",
    mapping_product_id: String(6001 + index),
    mapping_variant_id: String(7001 + index),
    external_product_id: `ten-product-${index + 1}`,
    external_variant_id: `ten-variant-${index + 1}`,
    external_sku: null,
    external_gtin: null,
    external_options: null,
    external_url: `https://www.10reps.co.uk/product-${index + 1}`,
    offer_id: offerId,
    offer_product_id: String(6001 + index),
    offer_variant_id: String(7001 + index),
    price: "10.00",
    shipping_cost: "3.99",
    total_price: "13.99",
    in_stock: true,
    url: `https://www.10reps.co.uk/product-${index + 1}`,
    last_checked_at: "2026-10-05T17:00:00.000Z",
  }));
  const byOffer = new Map(baselineRows.map((row) => [row.offer_id, row]));
  const reviewRows = [...reviewOfferIds].map((offerId) => ({
    offer_id: offerId,
    reason: "SOURCE_VARIANT_MISSING",
    external_product_id: byOffer.get(offerId).external_product_id,
    external_variant_id: byOffer.get(offerId).external_variant_id,
  }));
  const executionOfferIds = baselineRows.filter((row) => !reviewOfferIds.has(row.offer_id)).map((row) => row.offer_id);
  const report = {
    result: "PASS_WITH_REVIEW", mode: "dry-run", target: "production",
    source: { fingerprint: sourceFingerprint }, approved_mapping_count: 950,
    deferred_changed_offer_ids: [], execution_offer_ids: executionOfferIds,
    verification_offer_ids: executionOfferIds, stock_change_offer_ids: [], executable_plan_count: 934,
    executed_plan_count: 0, review_row_count: 16, blocked_row_count: 0,
    classification: { VERIFY_NO_CHANGE: 934 },
    review_rows: reviewRows,
  };
  const diagnostic = {
    result: "PASS", timestamp: "2026-10-05T17:01:00.000Z", failure_stage: null,
    approved_mapping_count: 950, source: { fingerprint: sourceFingerprint }, database_writes_attempted: 0, database_writes_completed: 0, business_writes_completed: 0, control_writes_completed: 0, approvals_created: 0, approvals_consumed: 0, recovery_calls: 0,
    classifier_summary: { scope: { scope_row_ids: executionOfferIds, blocked_rows: 0, reconciled: true, reconciled_total: 934 }, action_counts: report.classification, changed_row_ids: [], changed_rows: [] },
  };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "10-reps", snapshot: { captured_at: "2026-10-05T17:00:59.000Z", retailer_id: "14", retailer_name: "10 Reps", row_count: 950, rows: baselineRows }, evidence_hash: "e".repeat(64) };
  writeJson(path.join(directory, "production-dry-run.json"), report);
  writeJson(path.join(directory, "production-preflight-diagnostic.json"), diagnostic);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  return { directory, baselineRows, reviewRows };
}

test("10 Reps source adapter seals the fresh 934 safe plus 16 review partition without inferring changes", () => {
  const fixture = writeTenRepsFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37357956664", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "10-reps");
  assert.equal(contract.profile, "10-reps");
  assert.equal(contract.approved_mapping_count, 950);
  assert.equal(contract.executable_plan_count, 934);
  assert.equal(contract.review_row_count, 16);
  assert.deepEqual(contract.review_offer_ids, fixture.reviewRows.map((row) => row.offer_id).sort((a, b) => Number(a) - Number(b)));
  assert.equal(contract.catalogue_writes, 0);
});

test("10 Reps source adapter accepts safe executable stock changes alongside isolated source-missing reviews", () => {
  const fixture = writeTenRepsFixture();
  const reportPath = path.join(fixture.directory, "production-dry-run.json");
  const diagnosticPath = path.join(fixture.directory, "production-preflight-diagnostic.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, "utf8"));
  const stockChangeIds = report.execution_offer_ids.slice(0, 97);
  const verificationIds = report.execution_offer_ids.slice(97);
  const baselineByOffer = new Map(fixture.baselineRows.map((row) => [row.offer_id, row]));
  const changedRows = stockChangeIds.map((offerId) => {
    const row = baselineByOffer.get(offerId);
    return {
      offer_id: offerId,
      retailer_product_id: row.mapping_id,
      external_product_id: row.external_product_id,
      external_variant_id: row.external_variant_id,
      action: "UPDATE_STOCK",
      changed_fields: { price: false, stock: true, url: false, blocked: false },
      old_price: row.price,
      new_price: row.price,
      old_stock: row.in_stock,
      new_stock: !row.in_stock,
    };
  });
  report.stock_change_offer_ids = stockChangeIds;
  report.verification_offer_ids = verificationIds;
  report.classification = { UPDATE_STOCK: 97, VERIFY_NO_CHANGE: 837 };
  diagnostic.classifier_summary.action_counts = report.classification;
  diagnostic.classifier_summary.changed_row_ids = stockChangeIds;
  diagnostic.classifier_summary.changed_rows = changedRows;
  writeJson(reportPath, report);
  writeJson(diagnosticPath, diagnostic);

  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37886686256", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "10-reps");
  assert.equal(contract.executable_plan_count, 934);
  assert.equal(contract.review_row_count, 16);

  report.verification_offer_ids.push(stockChangeIds[0]);
  writeJson(reportPath, report);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env, "10-reps"), /changed and verified scopes overlap/);
});

test("10 Reps adapter builds exactly 16 shared-publisher identity-review cards and zero catalogue writes", () => {
  const fixture = writeTenRepsFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37357956664", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "10-reps");
  writeJson(path.join(fixture.directory, "automation-review-source-contract.json"), contract);
  const options = { profile: "10-reps", sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11366475556", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "c".repeat(64), sourceContractSha256: fileSha(path.join(fixture.directory, "automation-review-source-contract.json")), output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-05T18:00:00Z"));
  const reviewBaselineRows = fixture.baselineRows.filter((row) => fixture.reviewRows.some((review) => review.offer_id === row.offer_id));
  const baseline = {
    catalogueCounts: { products: 1337, product_variants: 3632, retailer_products: 3758, offers: 3758, price_history: 27401 },
    activeRows: [],
    offers: reviewBaselineRows.map((row) => ({ id: row.offer_id, retailer_id: "14", retailer_product_id: row.mapping_id, product_id: row.offer_product_id, product_variant_id: row.offer_variant_id, price: row.price, shipping_cost: row.shipping_cost, total_price: row.total_price, in_stock: row.in_stock, url: row.url })),
    mappings: reviewBaselineRows.map((row) => ({ id: row.mapping_id, retailer_id: "14", product_id: row.mapping_product_id, product_variant_id: row.mapping_variant_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, external_gtin: null, external_url: row.external_url })),
    products: reviewBaselineRows.map((row) => ({ id: row.offer_product_id, name: `Product ${row.offer_id}` })),
    variants: reviewBaselineRows.map((row) => ({ id: row.offer_variant_id, display_name: `Variant ${row.offer_id}` })),
  };
  const rows = buildFitHouseManifestRows(source, baseline, options);
  const output = buildFitHouseOutput(source, baseline, rows, options, env);
  assert.equal(rows.length, 16);
  assert.equal(rows.every((row) => row.operation_type === "MANUAL_REVIEW_IDENTITY" && row.reason_codes === "SOURCE_MISSING"), true);
  assert.equal(rows.every((row) => row.before_state.in_stock === row.proposed_state.in_stock || row.proposed_state.catalogue_action === "KEEP_UNCHANGED"), true);
  assert.equal(output.operations.CREATE, 16);
  assert.equal(output.expected.catalogue_writes, 0);
  assert.equal(output.production_writes, 0);
  assert.equal(output.direct_rest_writes, 0);
});

test("10 Reps review evidence survives a later partial execution failure", () => {
  const fixture = writeTenRepsFixture();
  const outputFile = path.join(fixture.directory, "github-output.txt");
  fs.writeFileSync(outputFile, "");
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37364486648", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit, GITHUB_OUTPUT: outputFile };
  const binding = bindSharedRetailerSource(fixture.directory, env, "10-reps");

  writeJson(path.join(fixture.directory, "production-dry-run.json"), { result: "OVERWRITTEN_AFTER_PARTIAL_APPLY" });
  writeJson(path.join(fixture.directory, "production-preflight-diagnostic.json"), { result: "FAIL", error_code: "QUERY_READ_TIMEOUT" });

  const options = { profile: "10-reps", sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11368880858", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "c".repeat(64), sourceContractSha256: binding.contract_sha256, output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-05T18:00:00Z"));
  assert.equal(source.contract.evidence_stage, "pre-execution-review-classification");
  assert.equal(source.contract.review_row_count, 16);
  assert.equal(source.contract.executable_plan_count, 934);
});

function writeWheyOkayFixture() {
  const { canonicalHash } = require("./jons-offer-refresh");
  const { sealImmutablePreflight } = require("./whey-okay-offer-refresh");
  const wheyConfig = require("../config/retailers/whey-okay-offer-sync.json");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whey-okay-review-source-"));
  const sourceFingerprint = "7".repeat(64);
  const commit = "6".repeat(40);
  const capturedAt = "2026-10-06T10:00:00.000Z";
  const reviewOfferIds = new Set(Array.from({ length: 10 }, (_, index) => String(5100 + index)));
  const offerIds = [...reviewOfferIds, ...Array.from({ length: 579 }, (_, index) => String(6000 + index))];
  const baselineRows = offerIds.map((offerId, index) => ({
    mapping_id: String(8000 + index), retailer_id: "3",
    mapping_product_id: String(9000 + index), mapping_variant_id: String(10000 + index),
    external_product_id: `whey-product-${index + 1}`, external_variant_id: `whey-variant-${index + 1}`,
    external_sku: null, external_gtin: null, external_options: null,
    external_url: `https://wheyokay.com/item-${index + 1}-p.asp`, offer_id: offerId,
    offer_product_id: String(9000 + index), offer_variant_id: String(10000 + index),
    price: "19.99", shipping_cost: "3.99", total_price: "23.98", in_stock: true,
    url: `https://wheyokay.com/item-${index + 1}-p.asp`, last_checked_at: capturedAt,
  }));
  const byOffer = new Map(baselineRows.map((row) => [row.offer_id, row]));
  const reviewRows = [...reviewOfferIds].map((offerId) => ({
    offer_id: offerId, reason: "SOURCE_VARIANT_MISSING",
    external_product_id: byOffer.get(offerId).external_product_id,
    external_variant_id: byOffer.get(offerId).external_variant_id,
  }));
  const executableRows = baselineRows.filter((row) => !reviewOfferIds.has(row.offer_id)).map((row) => ({
    offer_id: row.offer_id, action: "VERIFY_NO_CHANGE",
    atomic_plan: { meta: { source_snapshot_sha256: sourceFingerprint, source_captured_at: capturedAt } },
  }));
  const artifactCore = { source_snapshot_fingerprint: sourceFingerprint, source_captured_at: capturedAt, rows: executableRows };
  const run = {
    target: "production", capturedAt, feed: { semantic_fingerprint: sourceFingerprint },
    artifacts: [{ ...artifactCore, artifact_fingerprint: canonicalHash(artifactCore) }],
    approvedManifestSha256: wheyConfig.manifest_sha256, manifestFingerprint: "5".repeat(64),
    reviewedMassOos: null, isolateUnsafe: true, head: commit, approvedMappingCount: 589,
    classification: {
      rows: executableRows,
      quarantined_rows: reviewRows,
    },
    discovery: { missing_rows: reviewRows.map((row) => ({ offer_id: row.offer_id })) },
  };
  const report = {
    result: "PASS_WITH_REVIEW", mode: "dry-run", target: "production",
    source: { semantic_fingerprint: sourceFingerprint }, approved_mapping_count: 589,
    executable_plan_count: 579, executed_plan_count: 0, review_row_count: 10,
    blocked_row_count: 0, classification: { VERIFY_NO_CHANGE: 579 }, review_rows: reviewRows,
  };
  const diagnostic = {
    result: "PASS", timestamp: capturedAt, completed_at: "2026-10-06T10:01:00.000Z", failure_stage: null,
    commit, approved_mapping_count: 589, source: { semantic_fingerprint: sourceFingerprint },
    database_writes_attempted: 0, database_writes_completed: 0, business_writes_completed: 0,
    control_writes_completed: 0, approvals_created: 0, approvals_consumed: 0, recovery_calls: 0,
  };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "whey-okay", snapshot: { captured_at: capturedAt, retailer_id: "3", retailer_name: "Whey Okay", row_count: 589, rows: baselineRows }, evidence_hash: "4".repeat(64) };
  writeJson(path.join(directory, "production-preflight-dry-run.json"), report);
  writeJson(path.join(directory, "production-preflight-diagnostic.json"), diagnostic);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  writeJson(path.join(directory, "production-preflight-immutable.json"), sealImmutablePreflight(run));
  return { directory, baselineRows, reviewRows, commit };
}

test("Whey Okay profile seals exactly 579 executable rows plus 10 source-missing reviews", () => {
  const fixture = writeWheyOkayFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37440000001", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: fixture.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "whey-okay");
  assert.equal(contract.profile, "whey-okay");
  assert.equal(contract.workflow, ".github/workflows/whey-okay-offer-refresh.yml");
  assert.equal(contract.executable_plan_count, 579);
  assert.equal(contract.review_row_count, 10);
  assert.deepEqual(contract.review_offer_ids, fixture.reviewRows.map((row) => row.offer_id));
  assert.equal(contract.catalogue_writes, 0);
});

test("Whey Okay profile creates review-only source-missing cards and rejects immutable scope drift", () => {
  const fixture = writeWheyOkayFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37440000001", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: fixture.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "whey-okay");
  writeJson(path.join(fixture.directory, "automation-review-source-contract.json"), contract);
  const options = { profile: "whey-okay", sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11400000001", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "3".repeat(64), sourceContractSha256: fileSha(path.join(fixture.directory, "automation-review-source-contract.json")), output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-06T11:00:00Z"));
  const reviewBaselineRows = fixture.baselineRows.filter((row) => fixture.reviewRows.some((review) => review.offer_id === row.offer_id));
  const baseline = {
    catalogueCounts: { products: 1337, product_variants: 3632, retailer_products: 3758, offers: 3758, price_history: 27401 }, activeRows: [],
    offers: reviewBaselineRows.map((row) => ({ id: row.offer_id, retailer_id: "3", retailer_product_id: row.mapping_id, product_id: row.offer_product_id, product_variant_id: row.offer_variant_id, price: row.price, shipping_cost: row.shipping_cost, total_price: row.total_price, in_stock: row.in_stock, url: row.url })),
    mappings: reviewBaselineRows.map((row) => ({ id: row.mapping_id, retailer_id: "3", product_id: row.mapping_product_id, product_variant_id: row.mapping_variant_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, external_gtin: null, external_url: row.external_url })),
    products: reviewBaselineRows.map((row) => ({ id: row.offer_product_id, name: `Product ${row.offer_id}` })),
    variants: reviewBaselineRows.map((row) => ({ id: row.offer_variant_id, display_name: `Variant ${row.offer_id}` })),
  };
  const rows = buildFitHouseManifestRows(source, baseline, options);
  const output = buildFitHouseOutput(source, baseline, rows, options, env);
  assert.equal(rows.length, 10);
  assert.equal(rows.every((row) => row.operation_type === "MANUAL_REVIEW_IDENTITY" && row.reason_codes === "SOURCE_MISSING" && row.proposed_state.catalogue_action === "KEEP_UNCHANGED"), true);
  assert.equal(output.operations.CREATE, 10);
  assert.equal(output.expected.catalogue_writes, 0);

  const immutablePath = path.join(fixture.directory, "production-preflight-immutable.json");
  const immutable = JSON.parse(fs.readFileSync(immutablePath, "utf8"));
  immutable.run.classification.rows.pop();
  writeJson(immutablePath, immutable);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env, "whey-okay"), /payload hash mismatch/);
});

function publicationBaseline(fixture, retailerId) {
  const reviewIds = new Set(fixture.reviewRows.map((row) => String(row.offer_id)));
  const selected = fixture.baselineRows.filter((row) => reviewIds.has(String(row.offer_id)));
  return {
    catalogueCounts: { products: 1337, product_variants: 3632, retailer_products: 3758, offers: 3758, price_history: 27401 },
    activeRows: [],
    offers: selected.map((row) => ({ id: row.offer_id, retailer_id: retailerId, retailer_product_id: row.mapping_id, product_id: row.offer_product_id, product_variant_id: row.offer_variant_id, price: row.price, shipping_cost: row.shipping_cost, total_price: row.total_price, in_stock: row.in_stock, url: row.url })),
    mappings: selected.map((row) => ({ id: row.mapping_id, retailer_id: retailerId, product_id: row.mapping_product_id, product_variant_id: row.mapping_variant_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, external_sku: null, external_gtin: null, external_url: row.external_url })),
    products: selected.map((row) => ({ id: row.offer_product_id, name: `Product ${row.offer_id}` })),
    variants: selected.map((row) => ({ id: row.offer_variant_id, display_name: `Variant ${row.offer_id}` })),
  };
}

function writeJonsFixture(reviewCount = 5) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "jons-review-source-"));
  const capturedAt = "2026-10-07T04:48:00.000Z";
  const sourceFingerprint = "8".repeat(64);
  const knownReviewIds = ["1197", "1209", "1453", "1456", "1457", "1458"];
  const reviewIds = new Set(knownReviewIds.slice(0, reviewCount));
  const executableCount = 506 - reviewIds.size;
  const offerIds = [...reviewIds, ...Array.from({ length: executableCount }, (_, index) => String(5000 + index))];
  const baselineRows = offerIds.map((offerId, index) => ({
    mapping_id: String(6000 + index), retailer_id: "10", mapping_product_id: String(7000 + index), mapping_variant_id: String(8000 + index),
    external_product_id: `jons-product-${index}`, external_variant_id: `jons-variant-${index}`, external_sku: null, external_gtin: null, external_options: null,
    external_url: `https://jonssupplements.co.uk/products/${index}`, offer_id: offerId, offer_product_id: String(7000 + index), offer_variant_id: String(8000 + index),
    price: "19.99", shipping_cost: "0.00", total_price: "19.99", in_stock: true, url: `https://jonssupplements.co.uk/products/${index}`, last_checked_at: capturedAt,
  }));
  const byOffer = new Map(baselineRows.map((row) => [row.offer_id, row]));
  const reviewRows = [...reviewIds].map((offerId) => ({ offer_id: offerId, retailer_product_id: byOffer.get(offerId).mapping_id, external_product_id: byOffer.get(offerId).external_product_id, external_variant_id: byOffer.get(offerId).external_variant_id, reason: "SOURCE_VARIANT_MISSING", old_price: "19.99", new_price: null, old_stock: true, new_stock: null }));
  const executionIds = baselineRows.filter((row) => !reviewIds.has(row.offer_id)).map((row) => row.offer_id);
  const report = { result: "PASS_WITH_REVIEW", mode: "dry-run", target: "production", approved_mapping_count: 506, executable_plan_count: executableCount, executed_plan_count: 0, review_row_count: reviewIds.size, blocked_row_count: 0, source: { fingerprint: sourceFingerprint }, classification: { VERIFY_NO_CHANGE: executableCount }, review_rows: reviewRows };
  const diagnostic = { result: "PASS", timestamp: capturedAt, completed_at: capturedAt, failure_stage: null, approved_mapping_count: 506, source: { pagination_completed: true }, database_writes_attempted: 0, database_writes_completed: 0, business_writes_completed: 0, control_writes_completed: 0, approvals_created: 0, approvals_consumed: 0, recovery_calls: 0, classifier_summary: { scope: { scope_row_ids: executionIds, blocked_rows: 0, reconciled: true, reconciled_total: executableCount }, action_counts: report.classification, changed_row_ids: [], changed_rows: [], quarantined_rows: reviewRows } };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "jons-supplements", snapshot: { captured_at: capturedAt, retailer_id: "10", retailer_name: "Jon's Supplements", row_count: 506, rows: baselineRows }, evidence_hash: "7".repeat(64) };
  writeJson(path.join(directory, "production-dry-run.json"), report);
  writeJson(path.join(directory, "production-preflight-diagnostic.json"), diagnostic);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  return { directory, baselineRows, reviewRows };
}

test("Jon's profile publishes the exact five isolated source-missing rows through the shared queue", () => {
  const fixture = writeJonsFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37457004820", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "jons-supplements");
  writeJson(path.join(fixture.directory, "automation-review-source-contract.json"), contract);
  const options = { profile: "jons-supplements", sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11409956021", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "a".repeat(64), sourceContractSha256: fileSha(path.join(fixture.directory, "automation-review-source-contract.json")), output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-07T05:00:00Z"));
  const baseline = publicationBaseline(fixture, "10");
  const rows = buildFitHouseManifestRows(source, baseline, options);
  assert.equal(contract.executable_plan_count, 501);
  assert.equal(rows.length, 5);
  assert.equal(rows.every((row) => row.operation_type === "MANUAL_REVIEW_IDENTITY" && row.reason_codes === "SOURCE_MISSING" && row.impact_summary.executable === false), true);
  assert.equal(buildFitHouseOutput(source, baseline, rows, options, env).expected.catalogue_writes, 0);
});

test("Jon's profile accepts a grown no-write review partition without a retailer count patch", () => {
  const fixture = writeJonsFixture(6);
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37771317361", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "jons-supplements");
  assert.equal(contract.executable_plan_count, 500);
  assert.equal(contract.review_row_count, 6);
  assert.equal(contract.review_offer_ids.length, 6);
  assert.deepEqual(contract.review_offer_ids, fixture.reviewRows.map((row) => row.offer_id).sort((a, b) => Number(a) - Number(b)));
});

function writeSixPackFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "six-pack-review-source-"));
  const capturedAt = "2026-10-07T03:18:00.000Z";
  const sourceFingerprint = "6".repeat(64);
  const offerIds = Array.from({ length: 506 }, (_, index) => String(9000 + index));
  const reviewIds = new Set(offerIds.slice(0, 14));
  const baselineRows = offerIds.map((offerId, index) => ({
    mapping_id: String(10000 + index), retailer_id: "11", mapping_product_id: String(11000 + index), mapping_variant_id: String(12000 + index),
    external_product_id: String(13000 + index), external_variant_id: String(14000 + index), external_sku: null, external_gtin: null, external_options: null,
    external_url: `https://6pack-supplements.co.uk/product/${index}`, offer_id: offerId, offer_product_id: String(11000 + index), offer_variant_id: String(12000 + index),
    price: index === 1 ? "12" : "19.99", shipping_cost: "4.99", total_price: index === 1 ? "16.99" : "24.98", in_stock: true, url: `https://6pack-supplements.co.uk/product/${index}`, last_checked_at: capturedAt,
  }));
  const reviewRows = baselineRows.slice(0, 14).map((row, index) => ({
    offer_id: row.offer_id, mapping_id: row.mapping_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id,
    reason: index === 0 ? "SOURCE_VARIANT_MISSING" : index === 1 ? "HARD_PRICE_ANOMALY" : "MASS_OOS",
    source_failure: index === 0 ? { disposition: "SOURCE_PRODUCT_NOT_FOUND" } : null,
    original_action: index < 2 ? null : "UPDATE_STOCK",
    current_offer: { price: index === 1 ? "12.00" : row.price, in_stock: row.in_stock, url: row.url },
    proposed_offer: index === 0 ? null : { price: index === 1 ? "44.99" : row.price, in_stock: index === 1 ? true : false, url: row.url, source_captured_at: capturedAt },
  }));
  const executableRows = baselineRows.filter((row) => !reviewIds.has(row.offer_id));
  const report = { schema_version: 1, kind: "six-pack-approved-offer-refresh-dry-run", result: "PASS_WITH_REVIEW", source_snapshot_fingerprint: sourceFingerprint, source_captured_at: capturedAt, approved_mapping_count: 506, executable_plan_count: 492, executed_plan_count: 0, review_row_count: 14, blocked_row_count: 0, classification_state: "DRY_RUN_READY_WITH_REVIEW", review_rows: reviewRows, action_counts: { VERIFY_NO_CHANGE: 492 }, database_writes: 0 };
  const artifact = { artifact_version: 1, created_at: capturedAt, row_count: "492", plans: executableRows.map(() => ({ retailer_id: "11", operation_type: "verify_offer_no_change" })), source_rows: executableRows.map((row) => ({ normalized_source_row: { source_snapshot_sha256: sourceFingerprint, source_captured_at: capturedAt, target: { offer: { id: row.offer_id } } } })), blocked_rows: [] };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "six-pack-supplements", snapshot: { captured_at: capturedAt, retailer_id: "11", retailer_name: "6 Pack Supplements", row_count: 506, rows: baselineRows }, evidence_hash: "5".repeat(64) };
  writeJson(path.join(directory, "production-preflight-report.json"), report);
  writeJson(path.join(directory, "production-preflight-artifact.json"), artifact);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  return { directory, baselineRows, reviewRows };
}

test("6 Pack profile publishes 14 mixed rows as non-executable shared review cards", () => {
  const fixture = writeSixPackFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37448175548", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env, "six-pack-supplements");
  assert.equal(contract.profile, "6-pack-supplements");
  writeJson(path.join(fixture.directory, "automation-review-source-contract.json"), contract);
  const options = { profile: "six-pack-supplements", sourceArtifactDir: fixture.directory, sourceRunId: env.GITHUB_RUN_ID, sourceArtifactId: "11407901475", sourceCommitSha: env.GITHUB_SHA, sourceArtifactDigest: "b".repeat(64), sourceContractSha256: fileSha(path.join(fixture.directory, "automation-review-source-contract.json")), output: path.join(fixture.directory, "output.json") };
  const source = verifyFitHouseSourceContract(options, new Date("2026-10-07T04:00:00Z"));
  const baseline = publicationBaseline(fixture, "11");
  const rows = buildFitHouseManifestRows(source, baseline, options);
  assert.equal(contract.executable_plan_count, 492);
  assert.equal(rows.length, 14);
  assert.deepEqual([...new Set(rows.map((row) => row.operation_type))].sort(), ["MANUAL_REVIEW", "MANUAL_REVIEW_IDENTITY"]);
  assert.equal(rows.every((row) => row.impact_summary.catalogue_writes === 0 && row.impact_summary.executable === false), true);
  assert.equal(buildFitHouseOutput(source, baseline, rows, options, env).expected.catalogue_writes, 0);
});

test("Jon's and 6 Pack workflows reuse the publisher but receive no execution adapter", () => {
  const jons = fs.readFileSync(path.join(process.cwd(), ".github/workflows/jons-offer-refresh.yml"), "utf8");
  const sixPack = fs.readFileSync(path.join(process.cwd(), ".github/workflows/six-pack-offer-refresh.yml"), "utf8");
  assert.match(jons, /Capture Jon's Supplements DB baseline read-only[\s\S]*Bind fresh Jon's Review Queue source[\s\S]*Apply all approved Jon's offer refresh/);
  assert.match(jons, /refresh-review-queue:[\s\S]*--profile=jons-supplements[\s\S]*Publish fresh Jon's cards to Automation Review Queue/);
  assert.match(sixPack, /Capture 6 Pack DB baseline read-only[\s\S]*Bind fresh 6 Pack Review Queue source[\s\S]*Apply exact approved manifest/);
  assert.match(sixPack, /refresh-review-queue:[\s\S]*--profile=six-pack-supplements[\s\S]*Publish fresh 6 Pack cards to Automation Review Queue/);
  const adapters = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config/automation-review-execution-adapters.json"), "utf8"));
  assert.equal(adapters.adapters.some((adapter) => ["10", "11"].includes(String(adapter.retailer_id))), false);
});

test("shared retailer workflow publishes bound Fit House and 10 Reps cards through one queue job", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.match(workflow, /Bind fresh Fit House Review Queue source/);
  assert.match(workflow, /Bind fresh 10 Reps Review Queue source/);
  assert.match(workflow, /refresh-review-queue:[\s\S]*needs: \[fit-house-offer-refresh, ten-reps-offer-refresh\]/);
  assert.doesNotMatch(workflow, /needs\.fit-house-offer-refresh\.result == 'success'/);
  assert.doesNotMatch(workflow, /needs\.ten-reps-offer-refresh\.result == 'success'/);
  assert.match(workflow, /Capture Fit House DB baseline read-only[\s\S]*Bind fresh Fit House Review Queue source[\s\S]*Apply all approved Fit House offer refresh/);
  assert.match(workflow, /Capture 10 Reps DB baseline read-only[\s\S]*Bind fresh 10 Reps Review Queue source[\s\S]*Apply all approved 10 Reps offer refresh/);
  assert.match(workflow, /- review-only/);
  const tenRepsApply = workflow.match(/- name: Apply all approved 10 Reps offer refresh[\s\S]*?run: node scripts\/fit-house-offer-refresh\.js --target=production --mode=apply --isolate-unsafe=true/)?.[0] || "";
  assert.doesNotMatch(tenRepsApply, /review-only/);
  assert.match(workflow, /refresh-review-queue:[\s\S]*inputs\.operation == 'review-only'/);
  assert.match(workflow, /github\.event_name == 'schedule'|inputs\.operation == 'apply'/);
  assert.match(workflow, /actions\/download-artifact@v8/);
  assert.match(workflow, /shared-retailer-automation-review-source\.js[\s\S]*--profile=fit-house/);
  assert.match(workflow, /shared-retailer-automation-review-source\.js[\s\S]*--profile=10-reps/);
  assert.match(workflow, /Publish fresh 10 Reps cards to Automation Review Queue/);
  assert.match(workflow, /automation-review-reconciliation-apply\.js/);
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/shared-retailer-automation-review-source.js"), "utf8");
  assert.match(source, /buildPublicationRpcRequest/);
  assert.doesNotMatch(source, /publish_automation_review_queue_changes/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.insert\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.update\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.delete\s*\(/);
  assert.doesNotMatch(source, /profile\.key\s*===/);
});

test("Whey Okay reuses the shared queue publisher without a retailer branch in shared core", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/whey-okay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /- review-only/);
  assert.match(workflow, /run_review_publication/);
  assert.match(workflow, /Capture Whey Okay DB baseline read-only[\s\S]*Bind fresh Whey Okay Review Queue source[\s\S]*Apply all approved Whey Okay offer refreshes/);
  assert.match(workflow, /refresh-review-queue:[\s\S]*needs: \[route-operation, whey-okay-offer-refresh\]/);
  assert.match(workflow, /Test shared Whey Okay Review Queue publication contracts[\s\S]*automation-review-reconciliation-dry-run\.test\.js/);
  assert.match(workflow, /shared-retailer-automation-review-source\.js[\s\S]*--profile=whey-okay/);
  assert.match(workflow, /Publish fresh Whey Okay cards to Automation Review Queue[\s\S]*automation-review-reconciliation-apply\.js/);
  const standardJob = workflow.slice(workflow.indexOf("\n  whey-okay-offer-refresh:"), workflow.indexOf("\n  refresh-review-queue:"));
  assert.doesNotMatch(standardJob, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(standardJob, /production-preflight-immutable\.json/);
  const sharedSource = fs.readFileSync(path.join(process.cwd(), "scripts/shared-retailer-automation-review-source.js"), "utf8");
  assert.doesNotMatch(sharedSource, /profile\.key\s*===|profile\.key\s*!==/);
});
