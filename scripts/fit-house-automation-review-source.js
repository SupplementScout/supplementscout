const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const {
  buildPublicationRpcRequest,
  reasonList,
  sha256,
} = require("./lib/automation-review-publisher");

const ROOT = path.resolve(__dirname, "..");
const REPOSITORY = "SupplementScout/supplementscout";
const WORKFLOW = ".github/workflows/fit-house-offer-refresh.yml";
const WORKFLOW_NAME = "Shared Retailer Offer Refresh";
const RETAILER = Object.freeze({ id: "9", name: "Fit House", slug: "fit-house" });
const SOURCE_FILES = Object.freeze({
  report: "production-apply.json",
  diagnostic: "production-apply-diagnostic.json",
  idempotency: "production-idempotency-diagnostic.json",
  baseline: "production-db-baseline.json",
  postflight: "production-db-postflight.json",
});
const CONTRACT_FILE = "automation-review-source-contract.json";
const DEFAULT_SOURCE = path.join(ROOT, "tmp", "fit-house-offer-refresh");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "fit-house-reconciliation-dry-run.json");
const ACTIVE_STATUSES = Object.freeze(["PENDING", "APPROVED"]);
const CATALOGUE_TABLES = Object.freeze(["products", "product_variants", "retailer_products", "offers", "price_history"]);
const HEX64 = /^[0-9a-f]{64}$/;

function fail(message) { throw new Error(message); }
function invariant(condition, message) { if (!condition) fail(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function fileSha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function sortedIds(values) { return [...new Set(values.map(String))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)); }
function sameJson(left, right, message) { invariant(JSON.stringify(left) === JSON.stringify(right), message); }
function nullable(value) { return value == null ? null : String(value); }

function insideTmp(value, label) {
  const resolved = path.resolve(value);
  const relative = path.relative(path.join(ROOT, "tmp"), resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${label} must stay inside tmp`);
  return resolved;
}

function pathsFor(directory) {
  const source = path.resolve(directory);
  return Object.fromEntries(Object.entries(SOURCE_FILES).map(([key, name]) => [key, path.join(source, name)]));
}

function normalizedChangedRows(diagnostic) {
  const rows = diagnostic?.classifier_summary?.changed_rows;
  invariant(Array.isArray(rows), "Fit House diagnostic changed rows are missing");
  return [...rows].map((row) => ({
    offer_id: String(row.offer_id),
    retailer_product_id: String(row.retailer_product_id),
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    old_price: String(row.old_price),
    new_price: String(row.new_price),
    old_stock: row.old_stock === true,
    new_stock: row.new_stock === true,
    action: row.action,
  })).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
}

function validateApplyPartition(report, diagnostic, idempotency, postflight) {
  const executableCount = Number(report.executable_plan_count);
  const reviewCount = Number(report.review_row_count);
  invariant(Number.isInteger(executableCount) && executableCount >= 0 && Number(report.executed_plan_count) === executableCount, "Fit House executable scope drifted");
  invariant(Number.isInteger(reviewCount) && reviewCount >= 0 && reviewCount <= 14, "Fit House review scope drifted");

  const catalogueDeltaKeys = ["products_delta", "variants_delta", "mappings_delta", "offers_delta"];
  invariant(report.business && catalogueDeltaKeys.every((key) => Number(report.business[key] || 0) === 0), "Fit House apply report contains catalogue changes");
  invariant(Number(report.business.offers_refreshed || 0) === executableCount, "Fit House refreshed-offer count drifted");
  const confirmationCount = Number(report.business.price_history_delta || 0);
  invariant(Number.isInteger(confirmationCount) && confirmationCount >= 0 && confirmationCount <= executableCount, "Fit House daily confirmation count drifted");

  invariant(diagnostic.result === "PASS" && diagnostic.failure_stage == null && Number(diagnostic.business_writes_completed || 0) === executableCount, "Fit House apply diagnostic execution count drifted");
  invariant(Number(diagnostic.control_writes_completed || 0) === (executableCount > 0 ? 1 : 0), "Fit House apply diagnostic control count drifted");
  invariant(idempotency.result === "PASS" && idempotency.failure_stage == null && Number(idempotency.business_writes_completed || 0) === 0 && Number(idempotency.control_writes_completed || 0) === 0, "Fit House idempotency diagnostic is not zero-write PASS");

  const executionIds = sortedIds(Array.isArray(report.execution_offer_ids) ? report.execution_offer_ids : []);
  const verificationIds = sortedIds(Array.isArray(report.verification_offer_ids) ? report.verification_offer_ids : []);
  const stockChangeIds = sortedIds(Array.isArray(report.stock_change_offer_ids) ? report.stock_change_offer_ids : []);
  invariant(executionIds.length === executableCount && verificationIds.length === executableCount && stockChangeIds.length === 0, "Fit House executable offer IDs drifted");
  sameJson(executionIds, verificationIds, "Fit House executable scope is not freshness-only");
  if (executableCount > 0) {
    invariant(executableCount + reviewCount === 286, "Fit House ordinary partition is incomplete");
    invariant(Number(report.classification?.VERIFY_NO_CHANGE || 0) === executableCount && Number(report.classification?.UPDATE_STOCK || 0) === reviewCount, "Fit House ordinary classification drifted");
  }

  invariant(postflight.executable_plan_count === executableCount && postflight.executed_plan_count === executableCount, "Fit House postflight execution binding drifted");
  for (const key of ["price_change_count", "stock_change_count", "shipping_change_count", "total_change_count", "offer_url_change_count", "mapping_url_change_count", "price_history_delta"]) invariant(Number(postflight[key] || 0) === 0, `Fit House postflight ${key} is not zero`);
  invariant(Number(postflight.freshness_change_count || 0) === executableCount, "Fit House postflight freshness count drifted");
  invariant(Number(postflight.daily_confirmation_delta || 0) === confirmationCount && Number(postflight.raw_price_history_delta || 0) === confirmationCount, "Fit House postflight confirmation count drifted");
  return { executableCount, executionIds };
}

function loadAndValidateSource(directory) {
  const files = pathsFor(directory);
  for (const file of Object.values(files)) invariant(fs.existsSync(file), `Missing Fit House source file ${path.basename(file)}`);
  const report = readJson(files.report);
  const diagnostic = readJson(files.diagnostic);
  const idempotency = readJson(files.idempotency);
  const baseline = readJson(files.baseline);
  const postflight = readJson(files.postflight);

  invariant(report.result === "PASS_WITH_REVIEW" && report.mode === "apply" && report.target === "production", "Fit House apply report is not publishable");
  invariant(report.approved_mapping_count === 286 && report.blocked_row_count === 0, "Fit House apply scope drifted");
  invariant(baseline.schema_version === 1 && baseline.kind === "retailer-offer-refresh-db-baseline" && baseline.result === "PASS" && baseline.profile === RETAILER.slug, "Fit House DB baseline is invalid");
  invariant(baseline.snapshot?.retailer_id === RETAILER.id && baseline.snapshot?.retailer_name === RETAILER.name && baseline.snapshot?.row_count === 286 && Array.isArray(baseline.snapshot?.rows) && baseline.snapshot.rows.length === 286, "Fit House DB baseline scope drifted");
  invariant(postflight.schema_version === 1 && postflight.kind === "retailer-offer-refresh-db-postflight" && postflight.result === "PASS" && postflight.profile === RETAILER.slug, "Fit House DB postflight is invalid");
  invariant(postflight.baseline_hash === baseline.evidence_hash && postflight.approved_mapping_count === 286 && postflight.review_row_count === report.review_row_count && postflight.blocked_row_count === 0, "Fit House postflight binding drifted");
  const partition = validateApplyPartition(report, diagnostic, idempotency, postflight);

  const changedRows = normalizedChangedRows(diagnostic);
  const idempotentRows = normalizedChangedRows(idempotency);
  sameJson(idempotentRows, changedRows, "Fit House review scope changed during idempotency");
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  invariant(report.review_row_count === report.review_rows.length && report.review_row_count === changedRows.length, "Fit House review row count drifted");
  sameJson(reviewIds, sortedIds(report.deferred_changed_offer_ids), "Fit House deferred review IDs drifted");
  sameJson(reviewIds, changedRows.map((row) => row.offer_id), "Fit House report and diagnostic review IDs drifted");
  invariant(partition.executionIds.every((offerId) => !reviewIds.includes(offerId)), "Fit House executable and review scopes overlap");
  invariant(changedRows.every((row) => row.action === "UPDATE_STOCK" && row.old_price === row.new_price && row.old_stock !== row.new_stock), "Fit House review scope contains a non-stock change");
  invariant(diagnostic.source?.fingerprint === report.source?.fingerprint && idempotency.source?.fingerprint === report.source?.fingerprint, "Fit House source fingerprint changed during the run");

  const baselineByOffer = new Map(baseline.snapshot.rows.map((row) => [String(row.offer_id), row]));
  invariant(baselineByOffer.size === 286, "Fit House baseline contains duplicate offers");
  for (const changed of changedRows) {
    const row = baselineByOffer.get(changed.offer_id);
    invariant(row && String(row.mapping_id) === changed.retailer_product_id, `Fit House baseline mapping missing for offer ${changed.offer_id}`);
    invariant(String(row.external_product_id) === changed.external_product_id && String(row.external_variant_id) === changed.external_variant_id, `Fit House source identity drift for offer ${changed.offer_id}`);
    invariant(String(row.price) === changed.old_price && row.in_stock === changed.old_stock, `Fit House before-state drift for offer ${changed.offer_id}`);
  }
  return { files, report, diagnostic, idempotency, baseline, postflight, changedRows, baselineByOffer };
}

function contractCore(source, env) {
  const fileHashes = Object.fromEntries(Object.entries(source.files).map(([key, file]) => [key, fileSha256(file)]));
  const catalogueOfferIds = sortedIds(source.baseline.snapshot.rows.map((row) => row.offer_id));
  const reviewScopeFingerprint = sha256({
    contract: "fit-house-automation-review-source-v1",
    retailer_id: RETAILER.id,
    source_fingerprint: source.report.source.fingerprint,
    changed_rows: source.changedRows,
  });
  const createdAt = source.diagnostic.timestamp;
  invariant(createdAt && Number.isFinite(Date.parse(createdAt)), "Fit House capture timestamp is invalid");
  return {
    schema_version: 1,
    kind: "automation-review-source-contract",
    profile: RETAILER.slug,
    repository: REPOSITORY,
    workflow: WORKFLOW,
    workflow_name: WORKFLOW_NAME,
    run_id: String(env.GITHUB_RUN_ID || ""),
    run_attempt: String(env.GITHUB_RUN_ATTEMPT || ""),
    commit_sha: String(env.GITHUB_SHA || ""),
    created_at: createdAt,
    expires_at: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
    retailer: RETAILER,
    approved_mapping_count: 286,
    executable_plan_count: source.report.executable_plan_count,
    review_row_count: source.changedRows.length,
    blocked_row_count: 0,
    catalogue_offer_ids: catalogueOfferIds,
    review_offer_ids: source.changedRows.map((row) => row.offer_id),
    source_fingerprint: source.report.source.fingerprint,
    review_scope_fingerprint: reviewScopeFingerprint,
    file_hashes: fileHashes,
    baseline_evidence_hash: source.baseline.evidence_hash,
    postflight_hash: source.postflight.postflight_hash,
    plan_fingerprint: sha256({ retailer_id: RETAILER.id, catalogue_offer_ids: catalogueOfferIds, review_scope_fingerprint: reviewScopeFingerprint, source_fingerprint: source.report.source.fingerprint }),
    catalogue_writes: 0,
  };
}

function buildSourceContract(directory, env = process.env) {
  invariant(env.GITHUB_ACTIONS === "true" && ["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === REPOSITORY, "FIT_HOUSE_REVIEW_SOURCE_CONTEXT_INVALID");
  invariant(/^[1-9][0-9]*$/.test(String(env.GITHUB_RUN_ID || "")) && /^[0-9a-f]{40}$/.test(String(env.GITHUB_SHA || "")), "FIT_HOUSE_REVIEW_SOURCE_IDENTITY_INVALID");
  const source = loadAndValidateSource(directory);
  const core = contractCore(source, env);
  return { ...core, contract_fingerprint: sha256(core) };
}

function bindSource(directory = DEFAULT_SOURCE, env = process.env) {
  invariant(env.GITHUB_OUTPUT, "GITHUB_OUTPUT_MISSING");
  const contract = buildSourceContract(directory, env);
  const output = path.join(directory, CONTRACT_FILE);
  fs.writeFileSync(output, `${JSON.stringify(contract, null, 2)}\n`, { flag: "wx" });
  const values = { contract_sha256: fileSha256(output), review_scope_fingerprint: contract.review_scope_fingerprint };
  fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  return values;
}

function parseArgs(argv) {
  const options = { mode: null, sourceArtifactDir: DEFAULT_SOURCE, output: DEFAULT_OUTPUT };
  for (const argument of argv) {
    const match = argument.match(/^--([a-z0-9-]+)(?:=(.*))?$/i);
    invariant(match, `Invalid argument ${argument}`);
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    invariant(["mode", "sourceArtifactDir", "sourceRunId", "sourceArtifactId", "sourceCommitSha", "sourceArtifactDigest", "sourceContractSha256", "output"].includes(key) && match[2], `Invalid argument ${argument}`);
    options[key] = match[2];
  }
  invariant(["bind", "reconcile"].includes(options.mode), "Mode must be bind or reconcile");
  options.sourceArtifactDir = insideTmp(options.sourceArtifactDir, "Source artifact directory");
  options.output = insideTmp(options.output, "Reconciliation output");
  if (options.mode === "reconcile") {
    invariant(/^[1-9][0-9]*$/.test(options.sourceRunId || "") && /^[1-9][0-9]*$/.test(options.sourceArtifactId || ""), "Source run or artifact ID is invalid");
    invariant(/^[0-9a-f]{40}$/.test(options.sourceCommitSha || ""), "Source commit SHA is invalid");
    invariant(HEX64.test(options.sourceArtifactDigest || "") && HEX64.test(options.sourceContractSha256 || ""), "Source artifact or contract digest is invalid");
  }
  return options;
}

function verifySourceContract(options, now = new Date()) {
  const contractPath = path.join(options.sourceArtifactDir, CONTRACT_FILE);
  invariant(fs.existsSync(contractPath) && fileSha256(contractPath) === options.sourceContractSha256, "Fit House source contract hash mismatch");
  const contract = readJson(contractPath);
  invariant(contract.schema_version === 1 && contract.kind === "automation-review-source-contract" && contract.profile === RETAILER.slug, "Fit House source contract schema mismatch");
  invariant(contract.repository === REPOSITORY && contract.workflow === WORKFLOW && contract.workflow_name === WORKFLOW_NAME, "Fit House source workflow mismatch");
  invariant(contract.run_id === options.sourceRunId && contract.commit_sha === options.sourceCommitSha && contract.retailer?.id === RETAILER.id && contract.retailer?.name === RETAILER.name, "Fit House source identity mismatch");
  invariant(contract.approved_mapping_count === 286 && Number.isInteger(contract.executable_plan_count) && contract.executable_plan_count >= 0 && contract.executable_plan_count <= 286 && contract.review_row_count >= 0 && contract.review_row_count <= 14 && contract.blocked_row_count === 0 && contract.catalogue_writes === 0, "Fit House source contract scope mismatch");
  invariant(Date.parse(contract.expires_at) > Date.parse(contract.created_at) && Date.parse(contract.expires_at) > now.getTime(), "Fit House source contract expiry is invalid");
  invariant(contract.contract_fingerprint === sha256(Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "contract_fingerprint"))), "Fit House source contract fingerprint mismatch");
  const source = loadAndValidateSource(options.sourceArtifactDir);
  for (const [key, file] of Object.entries(source.files)) invariant(contract.file_hashes[key] === fileSha256(file), `Fit House ${key} hash mismatch`);
  sameJson(contract.catalogue_offer_ids, sortedIds(source.baseline.snapshot.rows.map((row) => row.offer_id)), "Fit House catalogue offer scope mismatch");
  sameJson(contract.review_offer_ids, source.changedRows.map((row) => row.offer_id), "Fit House review offer scope mismatch");
  invariant(contract.review_scope_fingerprint === contractCore(source, { GITHUB_RUN_ID: contract.run_id, GITHUB_RUN_ATTEMPT: contract.run_attempt, GITHUB_SHA: contract.commit_sha }).review_scope_fingerprint, "Fit House review scope fingerprint mismatch");
  invariant(contract.executable_plan_count === source.report.executable_plan_count, "Fit House source contract executable count drifted");
  invariant(contract.review_row_count === source.changedRows.length, "Fit House source contract review count drifted");
  return { contract, ...source };
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Fit-House-Review-Source/1.0" } });
  invariant(response.ok, `GitHub source metadata request failed with HTTP ${response.status}`);
  return response.json();
}

async function verifyGithubBinding(options, env = process.env, fetchImpl = fetch) {
  invariant(env.GITHUB_TOKEN, "GITHUB_TOKEN is required for source metadata verification");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const run = await githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${options.sourceRunId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(run.id) === options.sourceRunId && run.repository?.full_name === REPOSITORY && String(run.path || "").split("@")[0] === WORKFLOW && run.name === WORKFLOW_NAME, "Fit House source run binding mismatch");
  const sameRun = env.GITHUB_ACTIONS === "true" && String(env.GITHUB_RUN_ID) === options.sourceRunId && run.status === "in_progress";
  invariant((run.status === "completed" && run.conclusion === "success") || sameRun, "Fit House source run is not usable");
  invariant(["schedule", "workflow_dispatch"].includes(run.event) && run.head_branch === "main" && run.head_sha === options.sourceCommitSha, "Fit House source branch or commit mismatch");
  const artifact = await githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${options.sourceArtifactId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(artifact.id) === options.sourceArtifactId && String(artifact.workflow_run?.id) === options.sourceRunId && artifact.name === `fit-house-offer-refresh-${options.sourceRunId}-1` && artifact.expired === false, "Fit House source artifact binding mismatch");
  invariant(artifact.digest === `sha256:${options.sourceArtifactDigest}`, "Fit House source artifact digest mismatch");
}

async function fetchPublicationBaseline(db, source) {
  const catalogueCounts = {};
  for (const table of CATALOGUE_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    catalogueCounts[table] = count;
  }
  const { data: retailers, error: retailerError } = await db.from("retailers").select("id,name,slug").eq("id", RETAILER.id);
  if (retailerError) throw retailerError;
  invariant(retailers?.length === 1 && String(retailers[0].id) === RETAILER.id && retailers[0].name === RETAILER.name && retailers[0].slug === RETAILER.slug, "Fit House retailer binding mismatch");
  const { data: activeRows, error: activeError } = await db.from("product_match_review_queue").select("*").eq("retailer_id", RETAILER.id).in("review_status", ACTIVE_STATUSES).order("id", { ascending: true });
  if (activeError) throw activeError;
  const baselineRows = source.changedRows.map((changed) => source.baselineByOffer.get(changed.offer_id));
  const offerIds = baselineRows.map((row) => String(row.offer_id));
  const mappingIds = baselineRows.map((row) => String(row.mapping_id));
  const productIds = sortedIds(baselineRows.map((row) => row.offer_product_id));
  const variantIds = sortedIds(baselineRows.map((row) => row.offer_variant_id));
  const results = await Promise.all([
    db.from("offers").select("id,retailer_id,retailer_product_id,product_id,product_variant_id,price,shipping_cost,total_price,in_stock,url").in("id", offerIds),
    db.from("retailer_products").select("id,retailer_id,product_id,product_variant_id,external_product_id,external_variant_id,external_sku,external_gtin,external_url").in("id", mappingIds),
    db.from("products").select("id,name").in("id", productIds),
    db.from("product_variants").select("id,display_name").in("id", variantIds),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return { catalogueCounts, activeRows: activeRows || [], offers: results[0].data || [], mappings: results[1].data || [], products: results[2].data || [], variants: results[3].data || [] };
}

function buildManifestRows(source, baseline, options) {
  const offers = new Map(baseline.offers.map((row) => [String(row.id), row]));
  const mappings = new Map(baseline.mappings.map((row) => [String(row.id), row]));
  const products = new Map(baseline.products.map((row) => [String(row.id), row]));
  const variants = new Map(baseline.variants.map((row) => [String(row.id), row]));
  const expiresAt = source.contract.expires_at;
  return source.changedRows.map((changed) => {
    const before = source.baselineByOffer.get(changed.offer_id);
    const offer = offers.get(changed.offer_id);
    const mapping = mappings.get(changed.retailer_product_id);
    invariant(offer && mapping, `Current Fit House state missing for offer ${changed.offer_id}`);
    invariant(String(offer.retailer_id) === RETAILER.id && String(mapping.retailer_id) === RETAILER.id && String(offer.retailer_product_id) === String(mapping.id), `Current Fit House retailer binding drift for offer ${changed.offer_id}`);
    invariant(String(offer.product_id) === String(before.offer_product_id) && String(offer.product_variant_id) === String(before.offer_variant_id) && String(mapping.product_id) === String(before.mapping_product_id) && String(mapping.product_variant_id) === String(before.mapping_variant_id), `Current Fit House canonical identity drift for offer ${changed.offer_id}`);
    invariant(String(mapping.external_product_id) === changed.external_product_id && String(mapping.external_variant_id) === changed.external_variant_id, `Current Fit House source identity drift for offer ${changed.offer_id}`);
    invariant(String(offer.price) === changed.old_price && offer.in_stock === changed.old_stock && nullable(offer.url) === nullable(before.url) && nullable(mapping.external_url) === nullable(before.external_url), `Current Fit House commercial state drift for offer ${changed.offer_id}`);
    const beforeState = { offer_id: changed.offer_id, retailer_product_id: changed.retailer_product_id, product_id: String(offer.product_id), product_variant_id: String(offer.product_variant_id), price: String(offer.price), shipping_cost: nullable(offer.shipping_cost), total_price: nullable(offer.total_price), in_stock: offer.in_stock === true, url: offer.url || null, external_url: mapping.external_url || null, external_product_id: nullable(mapping.external_product_id), external_variant_id: nullable(mapping.external_variant_id) };
    const proposedState = { ...beforeState, in_stock: changed.new_stock };
    const sourceRowFingerprint = sha256({ contract: "fit-house-automation-review-row-v1", retailer_id: RETAILER.id, offer_id: changed.offer_id, source_fingerprint: source.contract.source_fingerprint, before_state: beforeState, proposed_state: proposedState });
    return {
      snapshot_id: `automation-review-${RETAILER.id}-${options.sourceRunId}`,
      review_item_id: `${RETAILER.id}:${changed.offer_id}:${options.sourceRunId}:${sourceRowFingerprint}`,
      source_record_id: `${RETAILER.id}:${changed.offer_id}`,
      retailer: RETAILER.name,
      product_title: products.get(String(offer.product_id))?.name || `Offer ${changed.offer_id}`,
      variant_title: variants.get(String(offer.product_variant_id))?.display_name || null,
      primary_status: "PENDING",
      reason_codes: "STOCK_CHANGE",
      confidence: "HIGH",
      canonical_candidates: [],
      source_sku: mapping.external_sku || null,
      source_gtin: mapping.external_gtin || null,
      source_weight: null,
      source_price: changed.new_price,
      source_url: mapping.external_url || offer.url || null,
      suggested_action: "MANUAL_REVIEW",
      retailer_id: RETAILER.id,
      retailer_product_id: changed.retailer_product_id,
      offer_id: changed.offer_id,
      current_product_id: String(offer.product_id),
      current_variant_id: String(offer.product_variant_id),
      proposed_product_id: null,
      proposed_variant_id: null,
      review_status: "PENDING",
      review_kind: "COMMERCIAL_CHANGE",
      operation_type: "UPDATE_STOCK",
      before_state: beforeState,
      proposed_state: proposedState,
      impact_summary: { catalogue_writes: 0, executable: false, review_only: true },
      source_evidence: { workflow_run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, artifact_digest: options.sourceArtifactDigest, contract_sha256: options.sourceContractSha256, source_fingerprint: source.contract.source_fingerprint, review_scope_fingerprint: source.contract.review_scope_fingerprint, reason: "OWNER_DEFERRED_STOCK_REVIEW" },
      source_captured_at: source.contract.created_at,
      expires_at: expiresAt,
      workflow_run_url: `https://github.com/${REPOSITORY}/actions/runs/${options.sourceRunId}`,
      artifact_url: `https://github.com/${REPOSITORY}/actions/runs/${options.sourceRunId}/artifacts/${options.sourceArtifactId}`,
      source_row_fingerprint: sourceRowFingerprint,
      artifact_fingerprint: source.contract.review_scope_fingerprint,
      plan_fingerprint: source.contract.plan_fingerprint,
      plan_artifact_sha256: options.sourceContractSha256,
    };
  });
}

function buildOutput(source, baseline, rows, options, env = process.env) {
  const priorStockReviewIds = baseline.activeRows.filter((row) => String(row.retailer_id) === RETAILER.id && row.review_kind === "COMMERCIAL_CHANGE" && row.operation_type === "UPDATE_STOCK" && reasonList(row.reason_codes).includes("STOCK_CHANGE")).map((row) => String(row.offer_id));
  const observedOfferIds = sortedIds([...source.contract.review_offer_ids, ...priorStockReviewIds]);
  invariant(observedOfferIds.every((offerId) => source.contract.catalogue_offer_ids.includes(offerId)), "Fit House active stock review is outside the fresh catalogue scope");
  const manifest = { schema_version: 1, kind: "automation-review-publisher-manifest", generated_at: source.contract.created_at, retailer_id: RETAILER.id, retailer: RETAILER.name, retailer_slug: RETAILER.slug, observed_offer_ids: observedOfferIds, workflow_run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, commit_sha: options.sourceCommitSha, report_sha256: source.contract.file_hashes.report, artifact_sha256: options.sourceArtifactDigest, rows };
  const request = buildPublicationRpcRequest(manifest, baseline.activeRows, { catalogueCounts: baseline.catalogueCounts });
  const operations = { CREATE: 0, REFRESH: 0, SUPERSEDE: 0, RESOLVE_BY_SOURCE: 0 };
  for (const operation of request.operations) operations[operation.op] = (operations[operation.op] || 0) + 1;
  return {
    schema_version: 1,
    kind: "automation-review-queue-reconciliation-dry-run",
    result: "PASS",
    mode: "dry-run",
    retailer: RETAILER,
    production_writes: 0,
    direct_rest_writes: 0,
    source: { run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, artifact_name: `fit-house-offer-refresh-${options.sourceRunId}-1`, commit_sha: options.sourceCommitSha, artifact_digest: options.sourceArtifactDigest, contract_sha256: options.sourceContractSha256, review_scope_fingerprint: source.contract.review_scope_fingerprint, contract_expires_at: source.contract.expires_at, review_offer_ids: source.contract.review_offer_ids },
    github_context: { run_id: env.GITHUB_RUN_ID || null, run_attempt: env.GITHUB_RUN_ATTEMPT || null, commit_sha: env.GITHUB_SHA || null, event_name: env.GITHUB_EVENT_NAME || null, ref: env.GITHUB_REF || null },
    baseline: { catalogue_counts: baseline.catalogueCounts, active_review_count: baseline.activeRows.length },
    operations,
    expected: { catalogue_writes: 0, final_active_review_count: baseline.activeRows.length + operations.CREATE - operations.SUPERSEDE - operations.RESOLVE_BY_SOURCE },
    request_summary: { operation_count: request.operations.length, changeset_fingerprint: request.changeset_fingerprint, publisher_batch_fingerprint: request.publisher_batch_fingerprint, idempotency_key: request.idempotency_key },
    lifecycle_consistency: { one_future_rpc: true, no_direct_rest_writes: true, catalogue_writes: 0 },
    request,
    reconciliation_manifest_sha256: sha256(manifest),
  };
}

function database(env = process.env) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(url && key, "Fit House Review Queue credentials are missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function reconcile(options, dependencies = {}) {
  const env = dependencies.env || process.env;
  invariant(env.GITHUB_ACTIONS === "true" && ["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === REPOSITORY && String(env.GITHUB_RUN_ID) === options.sourceRunId && env.GITHUB_SHA === options.sourceCommitSha, "FIT_HOUSE_RECONCILIATION_CONTEXT_INVALID");
  await verifyGithubBinding(options, env, dependencies.fetchImpl || fetch);
  const source = verifySourceContract(options);
  const baseline = await fetchPublicationBaseline(dependencies.client || database(env), source);
  const rows = buildManifestRows(source, baseline, options);
  const output = buildOutput(source, baseline, rows, options, env);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
  return output;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.mode === "bind") return bindSource(options.sourceArtifactDir);
  return reconcile(options);
}

if (require.main === module) main().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { RETAILER, bindSource, buildManifestRows, buildOutput, buildSourceContract, contractCore, fetchPublicationBaseline, loadAndValidateSource, parseArgs, reconcile, verifyGithubBinding, verifySourceContract };
