const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  buildPublicationRpcRequest,
  canonicalJson,
  sha256,
} = require("./lib/automation-review-publisher");
const {
  extractZip,
  githubJson,
} = require("./ebay-artifact-bound-verifier");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "reconciliation-dry-run.json");
const DEFAULT_SOURCE_DIR = path.join(ROOT, "tmp", "automation-review-reconciliation", "source-artifact");
const DEFAULT_SOURCE_ZIP = path.join(ROOT, "tmp", "automation-review-reconciliation", "source-artifact.zip");
const REPOSITORY = "SupplementScout/supplementscout";
const WORKFLOW = ".github/workflows/ebay-offer-refresh.yml";
const RETAILER_ID = "12";
const RETAILER = "eBay UK";
const RETAILER_SLUG = "ebay-uk";
const CATALOGUE_TABLES = Object.freeze(["products", "product_variants", "retailer_products", "offers", "price_history"]);
const ACTIVE_STATUSES = Object.freeze(["PENDING", "APPROVED"]);
const SOURCE_KIND = "ebay-offer-refresh-executable-scope-contract-v2";
const OUTPUT_KIND = "automation-review-queue-reconciliation-dry-run";
const HEX64 = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    sourceArtifactDir: DEFAULT_SOURCE_DIR,
    sourceZip: DEFAULT_SOURCE_ZIP,
    downloadSourceArtifact: false,
  };
  for (const arg of argv) {
    const match = arg.match(/^--([a-z0-9-]+)(?:=(.*))?$/i);
    if (!match) fail(`Invalid argument ${arg}`);
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];
    if (key === "downloadSourceArtifact") {
      if (value !== undefined) fail("--download-source-artifact does not take a value");
      options.downloadSourceArtifact = true;
    } else if ([
      "sourceBinding",
      "sourceArtifactDir",
      "sourceZip",
      "sourceRunId",
      "sourceArtifactId",
      "sourceCommitSha",
      "sourceArtifactDigest",
      "sourceContractSha256",
      "sourceReportSha256",
      "sourceArtifactContentSha256",
      "sourceReviewScopeFingerprint",
      "output",
    ].includes(key)) {
      if (!value) fail(`Missing value for ${arg}`);
      options[key] = value;
    } else {
      fail(`Unknown argument ${arg}`);
    }
  }
  if (options.sourceBinding) {
    const parts = options.sourceBinding.split(":");
    if (parts.length !== 8) fail("--source-binding must contain 8 colon-delimited fields");
    const [
      sourceRunId,
      sourceArtifactId,
      sourceCommitSha,
      sourceArtifactDigest,
      sourceContractSha256,
      sourceReportSha256,
      sourceArtifactContentSha256,
      sourceReviewScopeFingerprint,
    ] = parts;
    Object.assign(options, {
      sourceRunId,
      sourceArtifactId,
      sourceCommitSha,
      sourceArtifactDigest,
      sourceContractSha256,
      sourceReportSha256,
      sourceArtifactContentSha256,
      sourceReviewScopeFingerprint,
    });
  }
  for (const key of [
    "sourceRunId",
    "sourceArtifactId",
    "sourceCommitSha",
    "sourceArtifactDigest",
    "sourceContractSha256",
    "sourceReportSha256",
    "sourceArtifactContentSha256",
    "sourceReviewScopeFingerprint",
  ]) {
    if (!options[key]) fail(`Missing --${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (!/^[1-9][0-9]*$/.test(options.sourceRunId) || !/^[1-9][0-9]*$/.test(options.sourceArtifactId)) fail("Source run or artifact ID is invalid");
  if (!/^[0-9a-f]{40}$/.test(options.sourceCommitSha)) fail("Source commit SHA is invalid");
  for (const key of ["sourceArtifactDigest", "sourceContractSha256", "sourceReportSha256", "sourceArtifactContentSha256", "sourceReviewScopeFingerprint"]) {
    if (!HEX64.test(String(options[key]).toLowerCase())) fail(`${key} must be a SHA-256 hex value`);
    options[key] = String(options[key]).toLowerCase();
  }
  return {
    ...options,
    sourceArtifactDir: path.resolve(options.sourceArtifactDir),
    sourceZip: path.resolve(options.sourceZip),
    output: path.resolve(options.output),
  };
}

function fileSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function safeTmpPath(file) {
  const resolved = path.resolve(file);
  const tmpRoot = path.join(ROOT, "tmp");
  const relative = path.relative(tmpRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output and downloaded artifacts must stay inside tmp");
  return resolved;
}

async function downloadSourceArtifact(options, dependencies = {}) {
  const env = dependencies.env || process.env;
  const fetchImpl = dependencies.fetchImpl || fetch;
  const spawn = dependencies.spawn || undefined;
  if (!options.downloadSourceArtifact) return;
  if (!env.GITHUB_TOKEN) fail("GITHUB_TOKEN is required to download the source artifact");
  safeTmpPath(options.sourceZip);
  safeTmpPath(options.sourceArtifactDir);
  if (fs.existsSync(options.sourceZip) || fs.existsSync(options.sourceArtifactDir)) fail("Source artifact target already exists; remove stale tmp files before retrying");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const run = await githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${options.sourceRunId}`, env.GITHUB_TOKEN, fetchImpl);
  if (String(run.id) !== options.sourceRunId || run.repository?.full_name !== REPOSITORY) fail("Source run repository or ID mismatch");
  if (String(run.path || "").split("@")[0] !== WORKFLOW || run.name !== "eBay Offer Refresh") fail("Source run belongs to another workflow");
  if (run.conclusion !== "success" || run.status !== "completed" || run.event !== "workflow_dispatch" || run.head_branch !== "main" || run.head_sha !== options.sourceCommitSha) fail("Source run status, branch, event or commit mismatch");
  const artifact = await githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${options.sourceArtifactId}`, env.GITHUB_TOKEN, fetchImpl);
  if (String(artifact.id) !== options.sourceArtifactId || String(artifact.workflow_run?.id) !== options.sourceRunId) fail("Source artifact does not belong to source run");
  if (artifact.name !== `ebay-offer-refresh-${options.sourceRunId}-1` || artifact.expired !== false) fail("Source artifact name drifted or expired");
  if (artifact.digest !== `sha256:${options.sourceArtifactDigest}`) fail("Source artifact digest mismatch");
  const response = await fetchImpl(`${api}/repos/${REPOSITORY}/actions/artifacts/${options.sourceArtifactId}/zip`, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GITHUB_TOKEN}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Review-Reconciliation/1.0" }, redirect: "follow" });
  if (!response.ok) fail(`Source artifact download failed with HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(options.sourceZip), { recursive: true });
  fs.writeFileSync(options.sourceZip, archive, { flag: "wx" });
  if (fileSha256(options.sourceZip) !== options.sourceArtifactDigest) fail("Downloaded source artifact SHA-256 mismatch");
  extractZip(options.sourceZip, options.sourceArtifactDir, spawn);
}

function verifySourceArtifact(options) {
  const contractPath = path.join(options.sourceArtifactDir, "production-dry-run-contract.json");
  const reportPath = path.join(options.sourceArtifactDir, "production-dry-run.json");
  if (!fs.existsSync(contractPath) || !fs.existsSync(reportPath)) fail("Source artifact contract or report missing");
  if (fileSha256(contractPath) !== options.sourceContractSha256) fail("Source contract SHA-256 mismatch");
  if (fileSha256(reportPath) !== options.sourceReportSha256) fail("Source report SHA-256 mismatch");
  const contract = readJson(contractPath);
  const report = readJson(reportPath);
  if (contract.schema_version !== 2 || contract.kind !== SOURCE_KIND) fail("Source contract schema mismatch");
  if (contract.repository !== REPOSITORY || contract.workflow !== WORKFLOW) fail("Source contract repository or workflow mismatch");
  if (contract.run_id !== options.sourceRunId || contract.artifact_content_sha256 !== options.sourceArtifactContentSha256) fail("Source contract run or content hash mismatch");
  if (contract.commit_sha !== options.sourceCommitSha || report.commit_sha !== options.sourceCommitSha) fail("Source commit mismatch");
  if (contract.report_sha256 !== options.sourceReportSha256) fail("Source contract report hash mismatch");
  if (contract.review_scope_fingerprint !== options.sourceReviewScopeFingerprint || report.review_scope_fingerprint !== options.sourceReviewScopeFingerprint) fail("Source review scope fingerprint mismatch");
  const executableCount = contract.executable_plan_count;
  const reviewCount = contract.review_row_count;
  if (contract.approved_mapping_count !== 237 || !Number.isInteger(executableCount) || executableCount < 0 || !Number.isInteger(reviewCount) || reviewCount < 0 || executableCount + reviewCount !== 237 || contract.blocked_row_count !== 0) fail("Source review scope count mismatch");
  if (report.approved_mapping_count !== 237 || report.executable_plan_count !== executableCount || report.executed_plan_count !== 0 || report.review_row_count !== reviewCount || report.blocked_row_count !== 0) fail("Source report scope count mismatch");
  if (!Array.isArray(contract.executable_operation_types) || contract.executable_operation_types.length !== 1 || contract.executable_operation_types[0] !== "VERIFY_NO_CHANGE") fail("Source executable operation drift");
  const reviewIds = sortedStrings(report.review_rows.map((row) => row.offer_id));
  if (canonicalJson(reviewIds) !== canonicalJson(sortedStrings(contract.review_offer_ids))) fail("Source report and contract review IDs mismatch");
  if (reviewIds.length !== reviewCount || sortedStrings(report.execution_offer_ids).length !== executableCount) fail("Source report offer ID count mismatch");
  return { contract, report, contractPath, reportPath };
}

function sortedStrings(values) {
  return [...new Set((values || []).map(String))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

function loadOfferArtifacts(sourceArtifactDir) {
  const map = new Map();
  for (const name of fs.readdirSync(sourceArtifactDir)) {
    const match = name.match(/^artifact-([0-9]+)-.*\.json$/);
    if (!match) continue;
    map.set(match[1], readJson(path.join(sourceArtifactDir, name)));
  }
  return map;
}

function sourceRowByOffer(report) {
  return new Map((report.semantic_source_rows || []).map((row) => [String(row.offer_id), row]));
}

function sourceFingerprintByOffer(report, scope) {
  return new Map((report.source_row_fingerprints || []).filter((row) => !scope || row.scope === scope).map((row) => [String(row.offer_id), row.semantic_fingerprint]));
}

function operationForReview(review, semantic) {
  if (review.action === "UPDATE_PRICE") return { review_kind: "COMMERCIAL_CHANGE", operation_type: "UPDATE_PRICE", reason_codes: "PRICE_CHANGE", confidence: "MEDIUM", suggested_action: "MANUAL_REVIEW" };
  if (review.action === "UPDATE_STOCK") return { review_kind: "COMMERCIAL_CHANGE", operation_type: "UPDATE_STOCK", reason_codes: "STOCK_CHANGE", confidence: "MEDIUM", suggested_action: "MANUAL_REVIEW" };
  if (review.action === "UPDATE_PRICE_AND_STOCK") return { review_kind: "COMMERCIAL_CHANGE", operation_type: "UPDATE_PRICE_AND_STOCK", reason_codes: "PRICE_AND_STOCK_CHANGE", confidence: "MEDIUM", suggested_action: "MANUAL_REVIEW" };
  if (review.review_type === "SOURCE_FAILURE" || semantic?.source_error) return { review_kind: "SOURCE_FAILURE", operation_type: "SOURCE_MISSING", reason_codes: "SOURCE_FAILURE", confidence: "LOW", suggested_action: "MANUAL_REVIEW" };
  if (review.review_type === "MAPPING_DRIFT") return { review_kind: "MAPPING_DRIFT", operation_type: "MANUAL_REVIEW", reason_codes: "MAPPING_DRIFT", confidence: "LOW", suggested_action: "MANUAL_REVIEW" };
  return { review_kind: "IDENTITY_CONFLICT", operation_type: "MANUAL_REVIEW_IDENTITY", reason_codes: "IDENTITY_CONFLICT", confidence: "LOW", suggested_action: "MANUAL_REVIEW" };
}

function beforeStateFromPlan(plan) {
  const state = plan?.plans?.[0]?.resolved_plan?.expected_state;
  if (!state) return null;
  const offer = state.offer || {};
  const mapping = state.retailer_product || {};
  return {
    offer_id: String(offer.id),
    retailer_product_id: String(mapping.id || offer.retailer_product_id),
    product_id: String(offer.product_id || mapping.product_id),
    product_variant_id: String(offer.product_variant_id || mapping.product_variant_id),
    price: String(offer.price),
    shipping_cost: String(offer.shipping_cost),
    total_price: String(offer.total_price),
    in_stock: offer.in_stock === true,
    url: offer.url || null,
    external_url: mapping.external_url || null,
    external_product_id: mapping.external_product_id || null,
    external_variant_id: mapping.external_variant_id || null,
  };
}

function beforeStateFromActive(row) {
  if (row?.before_state && typeof row.before_state === "object") return row.before_state;
  return null;
}

function buildManifestRows(source, activeRows, currentStateRows = []) {
  const byOffer = sourceRowByOffer(source.report);
  const sourceFingerprints = sourceFingerprintByOffer(source.report, "REVIEW");
  const offerArtifacts = loadOfferArtifacts(source.options.sourceArtifactDir);
  const activeByOffer = new Map(activeRows.map((row) => [String(row.offer_id), row]));
  const currentStateByOffer = new Map(currentStateRows.map((row) => [String(row.offer_id), row]));
  return source.report.review_rows.map((review) => {
    const offerId = String(review.offer_id);
    const semantic = byOffer.get(offerId);
    if (!semantic) fail(`Missing semantic source row for review offer ${offerId}`);
    const sourceRowFingerprint = sourceFingerprints.get(offerId);
    if (!sourceRowFingerprint) fail(`Missing review source fingerprint for offer ${offerId}`);
    const op = operationForReview(review, semantic);
    const active = activeByOffer.get(offerId);
    const artifact = offerArtifacts.get(offerId);
    const expectedState = artifact?.plans?.[0]?.resolved_plan?.expected_state || null;
    const before = beforeStateFromActive(active) || beforeStateFromActive(currentStateByOffer.get(offerId)) || beforeStateFromPlan(artifact);
    if (!before) fail(`Missing before_state for review offer ${offerId}`);
    return {
      snapshot_id: `automation-review-${RETAILER_ID}-${offerId}`,
      review_item_id: `${RETAILER_ID}:${offerId}:${sourceRowFingerprint}`,
      source_record_id: `${RETAILER_ID}:${offerId}`,
      retailer: RETAILER,
      product_title: expectedState?.product?.name || active?.product_title || `Offer ${offerId}`,
      variant_title: expectedState?.product_variant?.display_name || active?.variant_title || null,
      primary_status: "PENDING",
      reason_codes: op.reason_codes,
      confidence: op.confidence,
      canonical_candidates: [],
      source_sku: null,
      source_gtin: semantic.returned_gtin || null,
      source_weight: null,
      source_price: semantic.price == null ? null : String(semantic.price),
      source_url: semantic.affiliate_url_returned || semantic.affiliate_url || semantic.external_url || null,
      suggested_action: op.suggested_action,
      retailer_id: RETAILER_ID,
      retailer_product_id: String(semantic.mapping_id),
      offer_id: offerId,
      current_product_id: String(semantic.product_id),
      current_variant_id: String(semantic.product_variant_id),
      proposed_product_id: null,
      proposed_variant_id: null,
      review_status: "PENDING",
      review_kind: op.review_kind,
      operation_type: op.operation_type,
      before_state: before,
      proposed_state: {},
      impact_summary: { catalogue_writes: 0, executable: false, review_only: true },
      source_evidence: {
        workflow_run_id: source.options.sourceRunId,
        artifact_id: source.options.sourceArtifactId,
        artifact_digest: source.options.sourceArtifactDigest,
        contract_sha256: source.options.sourceContractSha256,
        report_sha256: source.options.sourceReportSha256,
        artifact_content_sha256: source.options.sourceArtifactContentSha256,
        source_fingerprint: source.contract.full_capture_fingerprint,
        executable_source_fingerprint: source.contract.executable_source_fingerprint,
        review_scope_fingerprint: source.contract.review_scope_fingerprint,
        decision: semantic.decision || review.action || null,
        blockers: semantic.blockers || review.blockers || [],
        review_reasons: semantic.review_reasons || review.review_reasons || [],
        source_error: semantic.source_error || review.source_error || null,
        returned_gtin: semantic.returned_gtin || review.returned_gtin || null,
        item_id: semantic.returned_item_id || review.item_id || null,
      },
      source_captured_at: source.report.captured_at || source.contract.created_at,
      expires_at: source.contract.expires_at,
      workflow_run_url: `https://github.com/${REPOSITORY}/actions/runs/${source.options.sourceRunId}`,
      artifact_url: `https://github.com/${REPOSITORY}/actions/runs/${source.options.sourceRunId}/artifacts/${source.options.sourceArtifactId}`,
      source_row_fingerprint: sourceRowFingerprint,
      artifact_fingerprint: source.contract.review_scope_fingerprint,
      plan_fingerprint: source.contract.plan_fingerprint,
      plan_artifact_sha256: source.options.sourceContractSha256,
    };
  });
}

function nullableString(value) {
  return value == null ? null : String(value);
}

function currentReviewStateRows(sourceRows, offers, mappings) {
  const offersById = new Map((offers || []).map((row) => [String(row.id), row]));
  const mappingsById = new Map((mappings || []).map((row) => [String(row.id), row]));
  return sourceRows.map((source) => {
    const offerId = String(source.offer_id);
    const mappingId = String(source.mapping_id);
    const offer = offersById.get(offerId);
    const mapping = mappingsById.get(mappingId);
    if (!offer || !mapping) fail(`Missing current DB state for review offer ${offerId}`);
    if (String(offer.retailer_id) !== RETAILER_ID || String(mapping.retailer_id) !== RETAILER_ID || String(offer.retailer_product_id) !== mappingId || String(offer.product_id) !== String(source.product_id) || String(mapping.product_id) !== String(source.product_id) || String(offer.product_variant_id) !== String(source.product_variant_id) || String(mapping.product_variant_id) !== String(source.product_variant_id)) fail(`Current DB identity drift for review offer ${offerId}`);
    return {
      offer_id: offerId,
      before_state: {
        offer_id: offerId,
        retailer_product_id: mappingId,
        product_id: String(offer.product_id),
        product_variant_id: String(offer.product_variant_id),
        price: nullableString(offer.price),
        shipping_cost: nullableString(offer.shipping_cost),
        total_price: nullableString(offer.total_price),
        in_stock: offer.in_stock === true,
        url: offer.url || null,
        external_url: mapping.external_url || null,
        external_product_id: nullableString(mapping.external_product_id),
        external_variant_id: nullableString(mapping.external_variant_id),
      },
    };
  });
}

async function fetchBaseline(db, sourceRows = []) {
  const catalogueCounts = {};
  for (const table of CATALOGUE_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    catalogueCounts[table] = count;
  }
  const catalogueHash = sha256(catalogueCounts);
  const { count: queueCount, error: queueError } = await db.from("product_match_review_queue").select("*", { count: "exact", head: true });
  if (queueError) throw queueError;
  const { count: auditCount, error: auditError } = await db.from("product_match_review_events").select("*", { count: "exact", head: true });
  if (auditError) throw auditError;
  const { count: publicationCount, error: publicationError } = await db.from("automation_review_queue_publications").select("*", { count: "exact", head: true });
  if (publicationError) throw publicationError;
  const { data: allEbayRows, error: statusError } = await db.from("product_match_review_queue").select("review_status").eq("retailer_id", RETAILER_ID);
  if (statusError) throw statusError;
  const statusCounts = {};
  for (const row of allEbayRows || []) statusCounts[row.review_status] = (statusCounts[row.review_status] || 0) + 1;
  const { data: activeRows, error: activeError } = await db.from("product_match_review_queue").select("*").eq("retailer_id", RETAILER_ID).in("review_status", ACTIVE_STATUSES).order("id", { ascending: true });
  if (activeError) throw activeError;
  let reviewStateRows = [];
  if (sourceRows.length) {
    const offerIds = sortedStrings(sourceRows.map((row) => row.offer_id));
    const mappingIds = sortedStrings(sourceRows.map((row) => row.mapping_id));
    if (offerIds.length !== sourceRows.length || mappingIds.length !== sourceRows.length) fail("Duplicate source identity in review scope");
    const [{ data: offers, error: offerError }, { data: mappings, error: mappingError }] = await Promise.all([
      db.from("offers").select("id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url").in("id", offerIds),
      db.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_url").in("id", mappingIds),
    ]);
    if (offerError) throw offerError;
    if (mappingError) throw mappingError;
    reviewStateRows = currentReviewStateRows(sourceRows, offers, mappings);
  }
  const stableActive = activeRows.map((row) => ({
    id: String(row.id),
    retailer_id: String(row.retailer_id),
    offer_id: String(row.offer_id),
    review_status: row.review_status,
    review_kind: row.review_kind,
    operation_type: row.operation_type,
    source_row_fingerprint: row.source_row_fingerprint,
    superseded_by_review_id: row.superseded_by_review_id == null ? null : String(row.superseded_by_review_id),
  }));
  return {
    catalogue_counts: catalogueCounts,
    catalogue_hash_without_review_queue: catalogueHash,
    queue_count: queueCount,
    audit_count: auditCount,
    publication_count: publicationCount,
    ebay_status_counts: statusCounts,
    active_ebay_review_count: activeRows.length,
    queue_snapshot_hash: sha256(stableActive),
    active_rows: activeRows,
    current_review_state_rows: reviewStateRows,
    active_row_locks: stableActive.map((row) => row.id).sort((a, b) => Number(a) - Number(b)),
  };
}

function buildOutput(source, baseline, manifestRows, outputPath, env = process.env) {
  const manifest = {
    schema_version: 1,
    kind: "automation-review-publisher-manifest",
    generated_at: source.contract.created_at,
    retailer: RETAILER,
    retailer_id: RETAILER_ID,
    retailer_slug: RETAILER_SLUG,
    workflow_run_id: source.options.sourceRunId,
    artifact_id: source.options.sourceArtifactId,
    commit_sha: source.options.sourceCommitSha,
    report_sha256: source.options.sourceReportSha256,
    artifact_sha256: source.options.sourceArtifactDigest,
    source_hashes: {
      artifact_digest: source.options.sourceArtifactDigest,
      contract_sha256: source.options.sourceContractSha256,
      report_sha256: source.options.sourceReportSha256,
      artifact_content_sha256: source.options.sourceArtifactContentSha256,
      review_scope_fingerprint: source.options.sourceReviewScopeFingerprint,
    },
    observed_offer_ids: sortedStrings(source.report.semantic_source_rows.map((row) => row.offer_id)),
    rows: manifestRows,
  };
  const request = buildPublicationRpcRequest(manifest, baseline.active_rows, { catalogueCounts: baseline.catalogue_counts });
  const operationCounts = { CREATE: 0, REFRESH: 0, SUPERSEDE: 0, RESOLVE_BY_SOURCE: 0, EXPIRE: 0 };
  for (const operation of request.operations) operationCounts[operation.op] += 1;
  const expectedAuditDelta = request.operations.length;
  const finalActiveEbayRows = baseline.active_ebay_review_count + operationCounts.CREATE - operationCounts.SUPERSEDE - operationCounts.RESOLVE_BY_SOURCE - operationCounts.EXPIRE;
  if (request.expected_baseline.catalogue_hash_without_review_queue !== baseline.catalogue_hash_without_review_queue) fail("Corrected catalogue hash mismatch between baseline and RPC request");
  if (request.expected_baseline.active_review_count !== baseline.active_ebay_review_count) fail("Active review count mismatch between baseline and RPC request");
  const output = {
    schema_version: 1,
    kind: OUTPUT_KIND,
    result: "PASS",
    mode: "dry-run",
    production_writes: 0,
    direct_rest_writes: 0,
    source: {
      run_id: source.options.sourceRunId,
      artifact_id: source.options.sourceArtifactId,
      artifact_name: `ebay-offer-refresh-${source.options.sourceRunId}-1`,
      commit_sha: source.options.sourceCommitSha,
      artifact_digest: source.options.sourceArtifactDigest,
      contract_sha256: source.options.sourceContractSha256,
      report_sha256: source.options.sourceReportSha256,
      artifact_content_sha256: source.options.sourceArtifactContentSha256,
      review_scope_fingerprint: source.options.sourceReviewScopeFingerprint,
      contract_expires_at: source.contract.expires_at,
      review_offer_ids: sortedStrings(source.report.review_rows.map((row) => row.offer_id)),
      offer_2748_in_review_scope: source.report.review_rows.some((row) => String(row.offer_id) === "2748"),
    },
    github_context: {
      run_id: env.GITHUB_RUN_ID || null,
      run_attempt: env.GITHUB_RUN_ATTEMPT || null,
      commit_sha: env.GITHUB_SHA || null,
      event_name: env.GITHUB_EVENT_NAME || null,
      ref: env.GITHUB_REF || null,
    },
    baseline: {
      catalogue_counts: baseline.catalogue_counts,
      catalogue_hash_without_review_queue: baseline.catalogue_hash_without_review_queue,
      queue_count: baseline.queue_count,
      audit_count: baseline.audit_count,
      publication_count: baseline.publication_count,
      ebay_status_counts: baseline.ebay_status_counts,
      active_ebay_review_count: baseline.active_ebay_review_count,
      queue_snapshot_hash: baseline.queue_snapshot_hash,
    },
    operations: operationCounts,
    expected: {
      audit_delta: expectedAuditDelta,
      final_active_review_count_for_ebay: finalActiveEbayRows,
      catalogue_writes: 0,
      future_rpc_batches: 1,
      expiry: source.contract.expires_at,
    },
    request_summary: {
      publisher_batch_fingerprint: request.publisher_batch_fingerprint,
      changeset_fingerprint: request.changeset_fingerprint,
      idempotency_key: request.idempotency_key,
      operation_count: request.operations.length,
      deterministic_expected_review_lock_ids: baseline.active_row_locks,
    },
    lifecycle_consistency: {
      source_review_row_count: source.report.review_rows.length,
      manifest_row_count: manifestRows.length,
      duplicate_manifest_fingerprints: manifestRows.length - new Set(manifestRows.map((row) => `${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`)).size,
      known_reason_codes: true,
      retailer_binding: `${RETAILER_ID}:${RETAILER_SLUG}`,
      one_future_rpc: true,
      no_direct_rest_writes: true,
    },
    offer_2748: {
      in_review_scope: source.report.review_rows.some((row) => String(row.offer_id) === "2748"),
      in_executable_scope: source.report.execution_offer_ids.map(String).includes("2748"),
      active_queue_row: baseline.active_rows.some((row) => String(row.offer_id) === "2748"),
      included_in_manifest: manifestRows.some((row) => String(row.offer_id) === "2748"),
    },
    manifest,
    request,
  };
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  return { ...output, reconciliation_manifest_sha256: fileSha256(outputPath) };
}

function createDb(env = process.env) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Supabase read-only baseline credentials missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function run(options, dependencies = {}) {
  const parsed = typeof options.sourceRunId === "string" ? options : parseArgs(options);
  await downloadSourceArtifact(parsed, dependencies);
  const sourceFiles = verifySourceArtifact(parsed);
  const db = dependencies.db || createDb(dependencies.env || process.env);
  const reviewOfferIds = new Set(sourceFiles.report.review_rows.map((row) => String(row.offer_id)));
  const baseline = await fetchBaseline(db, sourceFiles.report.semantic_source_rows.filter((row) => reviewOfferIds.has(String(row.offer_id))));
  const manifestRows = buildManifestRows({ ...sourceFiles, options: parsed }, baseline.active_rows, baseline.current_review_state_rows);
  const output = buildOutput({ ...sourceFiles, options: parsed }, baseline, manifestRows, safeTmpPath(parsed.output), dependencies.env || process.env);
  return output;
}

if (require.main === module) {
  run(process.argv.slice(2)).then((result) => {
    console.log(JSON.stringify({
      result: result.result,
      source_run_id: result.source.run_id,
      source_artifact_id: result.source.artifact_id,
      operations: result.operations,
      reconciliation_manifest_sha256: result.reconciliation_manifest_sha256,
      publisher_batch_fingerprint: result.request_summary.publisher_batch_fingerprint,
      changeset_fingerprint: result.request_summary.changeset_fingerprint,
      idempotency_key: result.request_summary.idempotency_key,
      expected: result.expected,
    }, null, 2));
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildManifestRows,
  buildOutput,
  currentReviewStateRows,
  fetchBaseline,
  operationForReview,
  parseArgs,
  run,
  verifySourceArtifact,
};
