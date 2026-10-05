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
const PROFILES = Object.freeze({
  "fit-house": Object.freeze({
    key: "fit-house",
    retailer: Object.freeze({ id: "9", name: "Fit House", slug: "fit-house" }),
    approvedMappingCount: 286,
    maximumReviewCount: 14,
    sourceDirectory: "fit-house-offer-refresh",
    artifactPrefix: "fit-house-offer-refresh",
    reconciliationFile: "fit-house-reconciliation-dry-run.json",
    contractName: "fit-house-automation-review-source-v1",
  }),
  "10-reps": Object.freeze({
    key: "10-reps",
    retailer: Object.freeze({ id: "14", name: "10 Reps", slug: "10-reps" }),
    approvedMappingCount: 950,
    maximumReviewCount: 16,
    sourceDirectory: "10reps-offer-refresh",
    artifactPrefix: "10reps-offer-refresh",
    reconciliationFile: "10reps-reconciliation-dry-run.json",
    contractName: "10-reps-automation-review-source-v1",
  }),
});
const RETAILER = PROFILES["fit-house"].retailer;
const SOURCE_FILES = Object.freeze({
  report: "production-apply.json",
  diagnostic: "production-apply-diagnostic.json",
  idempotency: "production-idempotency-diagnostic.json",
  baseline: "production-db-baseline.json",
  postflight: "production-db-postflight.json",
});
const CONTRACT_FILE = "automation-review-source-contract.json";
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
function profileFor(value = "fit-house") {
  const profile = PROFILES[value];
  invariant(profile, `Unknown retailer review profile ${value}`);
  return profile;
}
function profileLabel(profile) { return profile.retailer.name; }
function defaultSource(profile) { return path.join(ROOT, "tmp", profile.sourceDirectory); }
function defaultOutput(profile) { return path.join(ROOT, "tmp", "automation-review-reconciliation", profile.reconciliationFile); }

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

function normalizedFitHouseReviewRows(diagnostic) {
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

function normalizedTenRepsReviewRows(report, baselineByOffer) {
  invariant(Array.isArray(report.review_rows), "10 Reps review rows are missing");
  return [...report.review_rows].map((review) => {
    const offerId = String(review.offer_id);
    const before = baselineByOffer.get(offerId);
    invariant(before, `10 Reps baseline missing for review offer ${offerId}`);
    invariant(review.reason === "SOURCE_VARIANT_MISSING", `10 Reps review reason drifted for offer ${offerId}`);
    invariant(String(review.external_product_id) === String(before.external_product_id) && String(review.external_variant_id) === String(before.external_variant_id), `10 Reps source identity drift for offer ${offerId}`);
    return {
      offer_id: offerId,
      retailer_product_id: String(before.mapping_id),
      external_product_id: String(before.external_product_id),
      external_variant_id: String(before.external_variant_id),
      old_price: String(before.price),
      new_price: String(before.price),
      old_stock: before.in_stock === true,
      new_stock: before.in_stock === true,
      action: "SOURCE_MISSING",
      reason: review.reason,
    };
  }).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
}

function validateApplyPartition(profile, report, diagnostic, idempotency, postflight) {
  const label = profileLabel(profile);
  const executableCount = Number(report.executable_plan_count);
  const reviewCount = Number(report.review_row_count);
  invariant(Number.isInteger(executableCount) && executableCount >= 0 && Number(report.executed_plan_count) === executableCount, `${label} executable scope drifted`);
  invariant(Number.isInteger(reviewCount) && reviewCount >= 0 && reviewCount <= profile.maximumReviewCount, `${label} review scope drifted`);

  const catalogueDeltaKeys = ["products_delta", "variants_delta", "mappings_delta", "offers_delta"];
  invariant(report.business && catalogueDeltaKeys.every((key) => Number(report.business[key] || 0) === 0), `${label} apply report contains catalogue changes`);
  invariant(Number(report.business.offers_refreshed || 0) === executableCount, `${label} refreshed-offer count drifted`);
  const confirmationCount = Number(report.business.price_history_delta || 0);
  invariant(Number.isInteger(confirmationCount) && confirmationCount >= 0 && confirmationCount <= executableCount, `${label} price-history count drifted`);

  invariant(diagnostic.result === "PASS" && diagnostic.failure_stage == null && Number(diagnostic.business_writes_completed || 0) === executableCount, `${label} apply diagnostic execution count drifted`);
  invariant(Number(diagnostic.control_writes_completed || 0) === (executableCount > 0 ? 1 : 0), `${label} apply diagnostic control count drifted`);
  invariant(idempotency.result === "PASS" && idempotency.failure_stage == null && Number(idempotency.business_writes_completed || 0) === 0 && Number(idempotency.control_writes_completed || 0) === 0, `${label} idempotency diagnostic is not zero-write PASS`);

  const executionIds = sortedIds(Array.isArray(report.execution_offer_ids) ? report.execution_offer_ids : []);
  const verificationIds = sortedIds(Array.isArray(report.verification_offer_ids) ? report.verification_offer_ids : []);
  const stockChangeIds = sortedIds(Array.isArray(report.stock_change_offer_ids) ? report.stock_change_offer_ids : []);
  invariant(executionIds.length === executableCount && stockChangeIds.length === 0, `${label} executable offer IDs drifted`);
  if (profile.key === "fit-house" && executableCount > 0) {
    invariant(verificationIds.length === executableCount, "Fit House verification offer IDs drifted");
    sameJson(executionIds, verificationIds, "Fit House executable and verified scopes differ");
    invariant(executableCount + reviewCount === profile.approvedMappingCount, "Fit House ordinary partition is incomplete");
    invariant(Number(report.classification?.VERIFY_NO_CHANGE || 0) === executableCount && Number(report.classification?.UPDATE_STOCK || 0) === reviewCount, "Fit House ordinary classification drifted");
  } else if (profile.key === "10-reps") {
    const priceChangeIds = sortedIds(diagnostic?.classifier_summary?.changed_row_ids || []);
    const commercialExecutionIds = executionIds.filter((offerId) => !verificationIds.includes(offerId));
    invariant(executableCount + reviewCount === profile.approvedMappingCount, "10 Reps ordinary partition is incomplete");
    invariant(Number(report.classification?.VERIFY_NO_CHANGE || 0) + Number(report.classification?.UPDATE_PRICE || 0) === executableCount && Number(report.classification?.UPDATE_PRICE || 0) <= 1, "10 Reps ordinary classification drifted");
    invariant(verificationIds.length === Number(report.classification?.VERIFY_NO_CHANGE || 0), "10 Reps verification offer IDs drifted");
    sameJson(commercialExecutionIds, priceChangeIds, "10 Reps commercial execution IDs drifted");
    invariant(priceChangeIds.length === Number(report.classification?.UPDATE_PRICE || 0), "10 Reps price-change scope drifted");
  }

  invariant(postflight.executable_plan_count === executableCount && postflight.executed_plan_count === executableCount, `${label} postflight execution binding drifted`);
  invariant(Number(postflight.freshness_change_count || 0) === executableCount, `${label} postflight freshness count drifted`);
  if (profile.key === "fit-house") {
    for (const key of ["price_change_count", "stock_change_count", "shipping_change_count", "total_change_count", "offer_url_change_count", "mapping_url_change_count", "price_history_delta"]) invariant(Number(postflight[key] || 0) === 0, `Fit House postflight ${key} is not zero`);
    invariant(Number(postflight.daily_confirmation_delta || 0) === confirmationCount && Number(postflight.raw_price_history_delta || 0) === confirmationCount, "Fit House postflight confirmation count drifted");
  } else {
    const priceChanges = Number(report.classification?.UPDATE_PRICE || 0);
    invariant(Number(postflight.price_change_count || 0) === priceChanges && Number(postflight.total_change_count || 0) === priceChanges && Number(postflight.price_history_delta || 0) === priceChanges && Number(postflight.raw_price_history_delta || 0) === priceChanges, "10 Reps postflight price deltas drifted");
    for (const key of ["stock_change_count", "shipping_change_count", "offer_url_change_count", "mapping_url_change_count", "daily_confirmation_delta"]) invariant(Number(postflight[key] || 0) === 0, `10 Reps postflight ${key} is not zero`);
  }
  return { executableCount, executionIds };
}

function loadAndValidateSource(directory, profileValue = "fit-house") {
  const profile = profileFor(profileValue);
  const retailer = profile.retailer;
  const label = profileLabel(profile);
  const files = pathsFor(directory);
  for (const file of Object.values(files)) invariant(fs.existsSync(file), `Missing ${label} source file ${path.basename(file)}`);
  const report = readJson(files.report);
  const diagnostic = readJson(files.diagnostic);
  const idempotency = readJson(files.idempotency);
  const baseline = readJson(files.baseline);
  const postflight = readJson(files.postflight);

  invariant(report.result === "PASS_WITH_REVIEW" && report.mode === "apply" && report.target === "production", `${label} apply report is not publishable`);
  invariant(report.approved_mapping_count === profile.approvedMappingCount && report.blocked_row_count === 0, `${label} apply scope drifted`);
  invariant(baseline.schema_version === 1 && baseline.kind === "retailer-offer-refresh-db-baseline" && baseline.result === "PASS" && baseline.profile === retailer.slug, `${label} DB baseline is invalid`);
  invariant(baseline.snapshot?.retailer_id === retailer.id && baseline.snapshot?.retailer_name === retailer.name && baseline.snapshot?.row_count === profile.approvedMappingCount && Array.isArray(baseline.snapshot?.rows) && baseline.snapshot.rows.length === profile.approvedMappingCount, `${label} DB baseline scope drifted`);
  invariant(postflight.schema_version === 1 && postflight.kind === "retailer-offer-refresh-db-postflight" && postflight.result === "PASS" && postflight.profile === retailer.slug, `${label} DB postflight is invalid`);
  invariant(postflight.baseline_hash === baseline.evidence_hash && postflight.approved_mapping_count === profile.approvedMappingCount && postflight.review_row_count === report.review_row_count && postflight.blocked_row_count === 0, `${label} postflight binding drifted`);
  const partition = validateApplyPartition(profile, report, diagnostic, idempotency, postflight);

  const baselineByOffer = new Map(baseline.snapshot.rows.map((row) => [String(row.offer_id), row]));
  invariant(baselineByOffer.size === profile.approvedMappingCount, `${label} baseline contains duplicate offers`);
  const changedRows = profile.key === "fit-house" ? normalizedFitHouseReviewRows(diagnostic) : normalizedTenRepsReviewRows(report, baselineByOffer);
  if (profile.key === "fit-house") sameJson(normalizedFitHouseReviewRows(idempotency), changedRows, "Fit House review scope changed during idempotency");
  const reviewIds = sortedIds(report.review_rows.map((row) => row.offer_id));
  invariant(report.review_row_count === report.review_rows.length && report.review_row_count === changedRows.length, `${label} review row count drifted`);
  if (profile.key === "fit-house") sameJson(reviewIds, sortedIds(report.deferred_changed_offer_ids), "Fit House deferred review IDs drifted");
  sameJson(reviewIds, changedRows.map((row) => row.offer_id), `${label} report and normalized review IDs drifted`);
  invariant(partition.executionIds.every((offerId) => !reviewIds.includes(offerId)), `${label} executable and review scopes overlap`);
  invariant(diagnostic.source?.fingerprint === report.source?.fingerprint && idempotency.source?.fingerprint === report.source?.fingerprint, `${label} source fingerprint changed during the run`);
  if (profile.key === "fit-house") invariant(changedRows.every((row) => row.action === "UPDATE_STOCK" && row.old_price === row.new_price && row.old_stock !== row.new_stock), "Fit House review scope contains a non-stock change");
  else invariant(changedRows.every((row) => row.action === "SOURCE_MISSING" && row.old_price === row.new_price && row.old_stock === row.new_stock), "10 Reps review scope contains an inferred catalogue change");
  for (const changed of changedRows) {
    const row = baselineByOffer.get(changed.offer_id);
    invariant(row && String(row.mapping_id) === changed.retailer_product_id, `${label} baseline mapping missing for offer ${changed.offer_id}`);
    invariant(String(row.external_product_id) === changed.external_product_id && String(row.external_variant_id) === changed.external_variant_id, `${label} source identity drift for offer ${changed.offer_id}`);
    invariant(String(row.price) === changed.old_price && row.in_stock === changed.old_stock, `${label} before-state drift for offer ${changed.offer_id}`);
  }
  return { profile, retailer, files, report, diagnostic, idempotency, baseline, postflight, changedRows, baselineByOffer };
}

function contractCore(source, env) {
  const profile = source.profile;
  const retailer = source.retailer;
  const fileHashes = Object.fromEntries(Object.entries(source.files).map(([key, file]) => [key, fileSha256(file)]));
  const catalogueOfferIds = sortedIds(source.baseline.snapshot.rows.map((row) => row.offer_id));
  const reviewScopeFingerprint = sha256({
    contract: profile.contractName,
    retailer_id: retailer.id,
    source_fingerprint: source.report.source.fingerprint,
    changed_rows: source.changedRows,
  });
  const createdAt = source.diagnostic.timestamp;
  invariant(createdAt && Number.isFinite(Date.parse(createdAt)), `${profileLabel(profile)} capture timestamp is invalid`);
  return {
    schema_version: 1,
    kind: "automation-review-source-contract",
    profile: retailer.slug,
    repository: REPOSITORY,
    workflow: WORKFLOW,
    workflow_name: WORKFLOW_NAME,
    run_id: String(env.GITHUB_RUN_ID || ""),
    run_attempt: String(env.GITHUB_RUN_ATTEMPT || ""),
    commit_sha: String(env.GITHUB_SHA || ""),
    created_at: createdAt,
    expires_at: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
    retailer,
    approved_mapping_count: profile.approvedMappingCount,
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
    plan_fingerprint: sha256({ retailer_id: retailer.id, catalogue_offer_ids: catalogueOfferIds, review_scope_fingerprint: reviewScopeFingerprint, source_fingerprint: source.report.source.fingerprint }),
    catalogue_writes: 0,
  };
}

function buildSourceContract(directory, env = process.env, profileValue = "fit-house") {
  const profile = profileFor(profileValue);
  invariant(env.GITHUB_ACTIONS === "true" && ["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === REPOSITORY, "RETAILER_REVIEW_SOURCE_CONTEXT_INVALID");
  invariant(/^[1-9][0-9]*$/.test(String(env.GITHUB_RUN_ID || "")) && /^[0-9a-f]{40}$/.test(String(env.GITHUB_SHA || "")), "RETAILER_REVIEW_SOURCE_IDENTITY_INVALID");
  const source = loadAndValidateSource(directory, profile.key);
  const core = contractCore(source, env);
  return { ...core, contract_fingerprint: sha256(core) };
}

function bindSource(directory, env = process.env, profileValue = "fit-house") {
  const profile = profileFor(profileValue);
  invariant(env.GITHUB_OUTPUT, "GITHUB_OUTPUT_MISSING");
  const contract = buildSourceContract(directory || defaultSource(profile), env, profile.key);
  directory ||= defaultSource(profile);
  const output = path.join(directory, CONTRACT_FILE);
  fs.writeFileSync(output, `${JSON.stringify(contract, null, 2)}\n`, { flag: "wx" });
  const values = { contract_sha256: fileSha256(output), review_scope_fingerprint: contract.review_scope_fingerprint };
  fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
  return values;
}

function parseArgs(argv) {
  const options = { mode: null, profile: "fit-house", sourceArtifactDir: null, output: null };
  for (const argument of argv) {
    const match = argument.match(/^--([a-z0-9-]+)(?:=(.*))?$/i);
    invariant(match, `Invalid argument ${argument}`);
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    invariant(["mode", "profile", "sourceArtifactDir", "sourceRunId", "sourceArtifactId", "sourceCommitSha", "sourceArtifactDigest", "sourceContractSha256", "output"].includes(key) && match[2], `Invalid argument ${argument}`);
    options[key] = match[2];
  }
  invariant(["bind", "reconcile"].includes(options.mode), "Mode must be bind or reconcile");
  const profile = profileFor(options.profile);
  options.sourceArtifactDir ||= defaultSource(profile);
  options.output ||= defaultOutput(profile);
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
  const profile = profileFor(options.profile);
  const retailer = profile.retailer;
  const label = profileLabel(profile);
  const contractPath = path.join(options.sourceArtifactDir, CONTRACT_FILE);
  invariant(fs.existsSync(contractPath) && fileSha256(contractPath) === options.sourceContractSha256, `${label} source contract hash mismatch`);
  const contract = readJson(contractPath);
  invariant(contract.schema_version === 1 && contract.kind === "automation-review-source-contract" && contract.profile === retailer.slug, `${label} source contract schema mismatch`);
  invariant(contract.repository === REPOSITORY && contract.workflow === WORKFLOW && contract.workflow_name === WORKFLOW_NAME, `${label} source workflow mismatch`);
  invariant(contract.run_id === options.sourceRunId && contract.commit_sha === options.sourceCommitSha && contract.retailer?.id === retailer.id && contract.retailer?.name === retailer.name, `${label} source identity mismatch`);
  invariant(contract.approved_mapping_count === profile.approvedMappingCount && Number.isInteger(contract.executable_plan_count) && contract.executable_plan_count >= 0 && contract.executable_plan_count <= profile.approvedMappingCount && contract.review_row_count >= 0 && contract.review_row_count <= profile.maximumReviewCount && contract.blocked_row_count === 0 && contract.catalogue_writes === 0, `${label} source contract scope mismatch`);
  invariant(Date.parse(contract.expires_at) > Date.parse(contract.created_at) && Date.parse(contract.expires_at) > now.getTime(), `${label} source contract expiry is invalid`);
  invariant(contract.contract_fingerprint === sha256(Object.fromEntries(Object.entries(contract).filter(([key]) => key !== "contract_fingerprint"))), `${label} source contract fingerprint mismatch`);
  const source = loadAndValidateSource(options.sourceArtifactDir, profile.key);
  for (const [key, file] of Object.entries(source.files)) invariant(contract.file_hashes[key] === fileSha256(file), `${label} ${key} hash mismatch`);
  sameJson(contract.catalogue_offer_ids, sortedIds(source.baseline.snapshot.rows.map((row) => row.offer_id)), `${label} catalogue offer scope mismatch`);
  sameJson(contract.review_offer_ids, source.changedRows.map((row) => row.offer_id), `${label} review offer scope mismatch`);
  invariant(contract.review_scope_fingerprint === contractCore(source, { GITHUB_RUN_ID: contract.run_id, GITHUB_RUN_ATTEMPT: contract.run_attempt, GITHUB_SHA: contract.commit_sha }).review_scope_fingerprint, `${label} review scope fingerprint mismatch`);
  invariant(contract.executable_plan_count === source.report.executable_plan_count, `${label} source contract executable count drifted`);
  invariant(contract.review_row_count === source.changedRows.length, `${label} source contract review count drifted`);
  return { contract, ...source };
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "SupplementScout-Shared-Retailer-Review-Source/1.0" } });
  invariant(response.ok, `GitHub source metadata request failed with HTTP ${response.status}`);
  return response.json();
}

async function verifyGithubBinding(options, env = process.env, fetchImpl = fetch) {
  const profile = profileFor(options.profile);
  const label = profileLabel(profile);
  invariant(env.GITHUB_TOKEN, "GITHUB_TOKEN is required for source metadata verification");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const run = await githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${options.sourceRunId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(run.id) === options.sourceRunId && run.repository?.full_name === REPOSITORY && String(run.path || "").split("@")[0] === WORKFLOW && run.name === WORKFLOW_NAME, `${label} source run binding mismatch`);
  const sameRun = env.GITHUB_ACTIONS === "true" && String(env.GITHUB_RUN_ID) === options.sourceRunId && run.status === "in_progress";
  invariant((run.status === "completed" && run.conclusion === "success") || sameRun, `${label} source run is not usable`);
  invariant(["schedule", "workflow_dispatch"].includes(run.event) && run.head_branch === "main" && run.head_sha === options.sourceCommitSha, `${label} source branch or commit mismatch`);
  const artifact = await githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${options.sourceArtifactId}`, env.GITHUB_TOKEN, fetchImpl);
  invariant(String(artifact.id) === options.sourceArtifactId && String(artifact.workflow_run?.id) === options.sourceRunId && artifact.name === `${profile.artifactPrefix}-${options.sourceRunId}-1` && artifact.expired === false, `${label} source artifact binding mismatch`);
  invariant(artifact.digest === `sha256:${options.sourceArtifactDigest}`, `${label} source artifact digest mismatch`);
}

async function fetchPublicationBaseline(db, source) {
  const retailer = source.retailer;
  const label = profileLabel(source.profile);
  const catalogueCounts = {};
  for (const table of CATALOGUE_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    catalogueCounts[table] = count;
  }
  const { data: retailers, error: retailerError } = await db.from("retailers").select("id,name,slug").eq("id", retailer.id);
  if (retailerError) throw retailerError;
  invariant(retailers?.length === 1 && String(retailers[0].id) === retailer.id && retailers[0].name === retailer.name && retailers[0].slug === retailer.slug, `${label} retailer binding mismatch`);
  const { data: activeRows, error: activeError } = await db.from("product_match_review_queue").select("*").eq("retailer_id", retailer.id).in("review_status", ACTIVE_STATUSES).order("id", { ascending: true });
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
  const profile = source.profile;
  const retailer = source.retailer;
  const label = profileLabel(profile);
  const offers = new Map(baseline.offers.map((row) => [String(row.id), row]));
  const mappings = new Map(baseline.mappings.map((row) => [String(row.id), row]));
  const products = new Map(baseline.products.map((row) => [String(row.id), row]));
  const variants = new Map(baseline.variants.map((row) => [String(row.id), row]));
  const expiresAt = source.contract.expires_at;
  return source.changedRows.map((changed) => {
    const before = source.baselineByOffer.get(changed.offer_id);
    const offer = offers.get(changed.offer_id);
    const mapping = mappings.get(changed.retailer_product_id);
    invariant(offer && mapping, `Current ${label} state missing for offer ${changed.offer_id}`);
    invariant(String(offer.retailer_id) === retailer.id && String(mapping.retailer_id) === retailer.id && String(offer.retailer_product_id) === String(mapping.id), `Current ${label} retailer binding drift for offer ${changed.offer_id}`);
    invariant(String(offer.product_id) === String(before.offer_product_id) && String(offer.product_variant_id) === String(before.offer_variant_id) && String(mapping.product_id) === String(before.mapping_product_id) && String(mapping.product_variant_id) === String(before.mapping_variant_id), `Current ${label} canonical identity drift for offer ${changed.offer_id}`);
    invariant(String(mapping.external_product_id) === changed.external_product_id && String(mapping.external_variant_id) === changed.external_variant_id, `Current ${label} source identity drift for offer ${changed.offer_id}`);
    invariant(String(offer.price) === changed.old_price && offer.in_stock === changed.old_stock && nullable(offer.url) === nullable(before.url) && nullable(mapping.external_url) === nullable(before.external_url), `Current ${label} commercial state drift for offer ${changed.offer_id}`);
    const beforeState = { offer_id: changed.offer_id, retailer_product_id: changed.retailer_product_id, product_id: String(offer.product_id), product_variant_id: String(offer.product_variant_id), price: String(offer.price), shipping_cost: nullable(offer.shipping_cost), total_price: nullable(offer.total_price), in_stock: offer.in_stock === true, url: offer.url || null, external_url: mapping.external_url || null, external_product_id: nullable(mapping.external_product_id), external_variant_id: nullable(mapping.external_variant_id) };
    const proposedState = profile.key === "fit-house" ? { ...beforeState, in_stock: changed.new_stock } : { catalogue_action: "KEEP_UNCHANGED", identity_review: "READ_ONLY", automatic_action: false };
    const sourceRowFingerprint = sha256({ contract: `${profile.key}-automation-review-row-v1`, retailer_id: retailer.id, offer_id: changed.offer_id, source_fingerprint: source.contract.source_fingerprint, before_state: beforeState, proposed_state: proposedState });
    const fitHouse = profile.key === "fit-house";
    return {
      snapshot_id: `automation-review-${retailer.id}-${options.sourceRunId}`,
      review_item_id: `${retailer.id}:${changed.offer_id}:${options.sourceRunId}:${sourceRowFingerprint}`,
      source_record_id: `${retailer.id}:${changed.offer_id}`,
      retailer: retailer.name,
      product_title: products.get(String(offer.product_id))?.name || `Offer ${changed.offer_id}`,
      variant_title: variants.get(String(offer.product_variant_id))?.display_name || null,
      primary_status: "PENDING",
      reason_codes: fitHouse ? "STOCK_CHANGE" : "SOURCE_MISSING",
      confidence: fitHouse ? "HIGH" : "LOW",
      canonical_candidates: [],
      source_sku: mapping.external_sku || null,
      source_gtin: mapping.external_gtin || null,
      source_weight: null,
      source_price: fitHouse ? changed.new_price : null,
      source_url: mapping.external_url || offer.url || null,
      suggested_action: "MANUAL_REVIEW",
      retailer_id: retailer.id,
      retailer_product_id: changed.retailer_product_id,
      offer_id: changed.offer_id,
      current_product_id: String(offer.product_id),
      current_variant_id: String(offer.product_variant_id),
      proposed_product_id: null,
      proposed_variant_id: null,
      review_status: "PENDING",
      review_kind: fitHouse ? "COMMERCIAL_CHANGE" : "IDENTITY_CONFLICT",
      operation_type: fitHouse ? "UPDATE_STOCK" : "MANUAL_REVIEW_IDENTITY",
      before_state: beforeState,
      proposed_state: proposedState,
      impact_summary: { catalogue_writes: 0, executable: false, review_only: true },
      source_evidence: { workflow_run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, artifact_digest: options.sourceArtifactDigest, contract_sha256: options.sourceContractSha256, source_fingerprint: source.contract.source_fingerprint, review_scope_fingerprint: source.contract.review_scope_fingerprint, reason: fitHouse ? "OWNER_DEFERRED_STOCK_REVIEW" : "SOURCE_VARIANT_MISSING" },
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
  const profile = source.profile;
  const retailer = source.retailer;
  const reviewShape = profile.key === "fit-house"
    ? (row) => row.review_kind === "COMMERCIAL_CHANGE" && row.operation_type === "UPDATE_STOCK" && reasonList(row.reason_codes).includes("STOCK_CHANGE")
    : (row) => row.review_kind === "IDENTITY_CONFLICT" && row.operation_type === "MANUAL_REVIEW_IDENTITY" && reasonList(row.reason_codes).includes("SOURCE_MISSING");
  const priorReviewIds = baseline.activeRows.filter((row) => String(row.retailer_id) === retailer.id && reviewShape(row)).map((row) => String(row.offer_id));
  const observedOfferIds = sortedIds([...source.contract.review_offer_ids, ...priorReviewIds]);
  invariant(observedOfferIds.every((offerId) => source.contract.catalogue_offer_ids.includes(offerId)), `${profileLabel(profile)} active review is outside the fresh catalogue scope`);
  const manifest = { schema_version: 1, kind: "automation-review-publisher-manifest", generated_at: source.contract.created_at, retailer_id: retailer.id, retailer: retailer.name, retailer_slug: retailer.slug, observed_offer_ids: observedOfferIds, workflow_run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, commit_sha: options.sourceCommitSha, report_sha256: source.contract.file_hashes.report, artifact_sha256: options.sourceArtifactDigest, rows };
  const request = buildPublicationRpcRequest(manifest, baseline.activeRows, { catalogueCounts: baseline.catalogueCounts });
  const operations = { CREATE: 0, REFRESH: 0, SUPERSEDE: 0, RESOLVE_BY_SOURCE: 0 };
  for (const operation of request.operations) operations[operation.op] = (operations[operation.op] || 0) + 1;
  return {
    schema_version: 1,
    kind: "automation-review-queue-reconciliation-dry-run",
    result: "PASS",
    mode: "dry-run",
    retailer,
    production_writes: 0,
    direct_rest_writes: 0,
    source: { run_id: options.sourceRunId, artifact_id: options.sourceArtifactId, artifact_name: `${profile.artifactPrefix}-${options.sourceRunId}-1`, commit_sha: options.sourceCommitSha, artifact_digest: options.sourceArtifactDigest, contract_sha256: options.sourceContractSha256, review_scope_fingerprint: source.contract.review_scope_fingerprint, contract_expires_at: source.contract.expires_at, review_offer_ids: source.contract.review_offer_ids },
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
  invariant(url && key, "Shared retailer Review Queue credentials are missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function reconcile(options, dependencies = {}) {
  const env = dependencies.env || process.env;
  invariant(env.GITHUB_ACTIONS === "true" && ["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME) && env.GITHUB_REF === "refs/heads/main" && env.GITHUB_REPOSITORY === REPOSITORY && String(env.GITHUB_RUN_ID) === options.sourceRunId && env.GITHUB_SHA === options.sourceCommitSha, "RETAILER_RECONCILIATION_CONTEXT_INVALID");
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
  if (options.mode === "bind") return bindSource(options.sourceArtifactDir, process.env, options.profile);
  return reconcile(options);
}

if (require.main === module) main().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { PROFILES, RETAILER, bindSource, buildManifestRows, buildOutput, buildSourceContract, contractCore, fetchPublicationBaseline, loadAndValidateSource, parseArgs, profileFor, reconcile, verifyGithubBinding, verifySourceContract };
