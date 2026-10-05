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
  buildManifestRows: buildFitHouseManifestRows,
  buildOutput: buildFitHouseOutput,
  buildSourceContract: buildFitHouseSourceContract,
  verifySourceContract: verifyFitHouseSourceContract,
} = require("./fit-house-automation-review-source");

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

function writeFitHouseFixture({ executableCount = 0, confirmationCount = 0 } = {}) {
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
  const changedRows = baselineRows.slice(0, 14).map((row) => ({
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
  const reviewRows = changedRows.map((row) => ({ offer_id: row.offer_id, reason: "OWNER_DEFERRED_STOCK_REVIEW", external_product_id: row.external_product_id, external_variant_id: row.external_variant_id }));
  const executionOfferIds = baselineRows.slice(14, 14 + executableCount).map((row) => row.offer_id);
  const report = {
    result: "PASS_WITH_REVIEW", mode: "apply", target: "production",
    source: { fingerprint: sourceFingerprint }, approved_mapping_count: 286,
    deferred_changed_offer_ids: changedRows.map((row) => row.offer_id), execution_offer_ids: executionOfferIds,
    verification_offer_ids: executionOfferIds, stock_change_offer_ids: [], executable_plan_count: executableCount,
    executed_plan_count: executableCount, review_row_count: 14, blocked_row_count: 0,
    classification: { VERIFY_NO_CHANGE: executableCount, UPDATE_STOCK: 14 },
    review_rows: reviewRows,
    business: { products_delta: 0, variants_delta: 0, mappings_delta: 0, offers_delta: 0, price_history_delta: confirmationCount, offers_refreshed: executableCount },
  };
  const diagnostic = { result: "PASS", timestamp: "2026-10-05T09:01:00.000Z", failure_stage: null, source: { fingerprint: sourceFingerprint }, business_writes_completed: executableCount, control_writes_completed: executableCount > 0 ? 1 : 0, classifier_summary: { action_counts: report.classification, changed_rows: changedRows } };
  const idempotency = { ...diagnostic, business_writes_completed: 0, control_writes_completed: 0 };
  const baseline = { schema_version: 1, kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "fit-house", snapshot: { captured_at: "2026-10-05T09:00:59.000Z", retailer_id: "9", retailer_name: "Fit House", row_count: 286, rows: baselineRows }, evidence_hash: "a".repeat(64) };
  const postflight = { schema_version: 1, kind: "retailer-offer-refresh-db-postflight", result: "PASS", profile: "fit-house", approved_mapping_count: 286, executable_plan_count: executableCount, executed_plan_count: executableCount, review_row_count: 14, blocked_row_count: 0, price_change_count: 0, stock_change_count: 0, shipping_change_count: 0, total_change_count: 0, offer_url_change_count: 0, mapping_url_change_count: 0, freshness_change_count: executableCount, price_history_delta: 0, daily_confirmation_delta: confirmationCount, raw_price_history_delta: confirmationCount, baseline_hash: baseline.evidence_hash, postflight_hash: "b".repeat(64) };
  writeJson(path.join(directory, "production-apply.json"), report);
  writeJson(path.join(directory, "production-apply-diagnostic.json"), diagnostic);
  writeJson(path.join(directory, "production-idempotency-diagnostic.json"), idempotency);
  writeJson(path.join(directory, "production-db-baseline.json"), baseline);
  writeJson(path.join(directory, "production-db-postflight.json"), postflight);
  return { directory, baselineRows, changedRows };
}

test("Fit House source adapter seals exactly the fresh 286/0/14/0 zero-write result", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37313299039", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.approved_mapping_count, 286);
  assert.equal(contract.executable_plan_count, 0);
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

  const reportPath = path.join(fixture.directory, "production-apply.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.stock_change_offer_ids = [report.execution_offer_ids[0]];
  writeJson(reportPath, report);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /executable offer IDs drifted/);
});

test("Fit House source adapter accepts a resolved subset and rejects count-to-row drift", () => {
  const fixture = writeFitHouseFixture();
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "37313299039", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: SOURCE.commit };
  const reportPath = path.join(fixture.directory, "production-apply.json"), diagnosticPath = path.join(fixture.directory, "production-apply-diagnostic.json"), idempotencyPath = path.join(fixture.directory, "production-idempotency-diagnostic.json"), postflightPath = path.join(fixture.directory, "production-db-postflight.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8")), diagnostic = JSON.parse(fs.readFileSync(diagnosticPath, "utf8")), postflight = JSON.parse(fs.readFileSync(postflightPath, "utf8"));
  report.review_row_count = 13; postflight.review_row_count = 13;
  writeJson(reportPath, report); writeJson(postflightPath, postflight);
  assert.throws(() => buildFitHouseSourceContract(fixture.directory, env), /review row count drifted/);
  report.review_rows.pop(); report.deferred_changed_offer_ids.pop(); diagnostic.classifier_summary.changed_rows.pop();
  writeJson(reportPath, report); writeJson(diagnosticPath, diagnostic); writeJson(idempotencyPath, diagnostic);
  const contract = buildFitHouseSourceContract(fixture.directory, env);
  assert.equal(contract.review_row_count, 13);
  assert.equal(contract.review_offer_ids.length, 13);
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

test("shared retailer workflow publishes Fit House cards only from a successful bound apply artifact", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.match(workflow, /Bind fresh Fit House Review Queue source/);
  assert.match(workflow, /refresh-fit-house-review-queue:[\s\S]*needs: fit-house-offer-refresh/);
  assert.match(workflow, /needs\.fit-house-offer-refresh\.result == 'success'/);
  assert.match(workflow, /github\.event_name == 'schedule'|inputs\.operation == 'apply'/);
  assert.match(workflow, /actions\/download-artifact@v8/);
  assert.match(workflow, /fit-house-automation-review-source\.js[\s\S]*--mode=reconcile/);
  assert.match(workflow, /automation-review-reconciliation-apply\.js/);
  const source = fs.readFileSync(path.join(process.cwd(), "scripts/fit-house-automation-review-source.js"), "utf8");
  assert.match(source, /buildPublicationRpcRequest/);
  assert.doesNotMatch(source, /publish_automation_review_queue_changes/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.insert\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.update\s*\(/);
  assert.doesNotMatch(source, /\.from\s*\([^)]*\)\.delete\s*\(/);
});
