const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { canonicalJson } = require("./canonical-json");
const { canonicalTimestamp, canonicalizeTimestamps, timestampEpochNanoseconds } = require("./canonical-timestamp");

const ROOT = path.resolve(__dirname, "../..");
const BATCH_DIRECTORY = path.join(ROOT, "config/retailers/six-pack-reviewed-batches");
const MAX_CAPTURE_AGE_MS = 24 * 60 * 60 * 1000;
const ALLOWED_ACTIONS = new Set(["UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK"]);
const STABLE_TOP_LEVEL_FIELDS = [
  "schema_version", "kind", "retailer_id", "retailer_slug", "implementation_commit_sha",
  "manifest_sha256", "offer_ids", "product_ids", "product_variant_ids",
  "retailer_product_ids", "source_semantic_fingerprint", "expected_price_history_delta",
  "expected_mapping_delta", "review_reason", "approved_guard", "rows",
];
const TOP_LEVEL_FIELDS = [...STABLE_TOP_LEVEL_FIELDS, "source_captured_at", "expires_at", "status", "reviewed_batch_fingerprint"].sort();
const ROW_FIELDS = ["offer_id", "product_id", "product_variant_id", "retailer_product_id", "external_product_id", "external_variant_id", "operation_type", "before", "after", "source_captured_at", "review_reason", "approved_guard"].sort();
const STATE_FIELDS = ["price", "shipping_cost", "total_price", "in_stock", "url", "last_checked_at"].sort();

function fail(message, code = "REVIEWED_BATCH_BLOCKED") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(canonicalizeTimestamps(value))).digest("hex");
}

function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}

function sortedUnique(values) {
  return [...new Set(values.map(String))].sort((a, b) => Number(a) - Number(b));
}

function approvedDataProjection(batch) {
  return Object.fromEntries(STABLE_TOP_LEVEL_FIELDS.map((key) => [key, key === "rows"
    ? batch.rows.map((row) => ({
      ...row,
      source_captured_at: undefined,
      after: { ...row.after, last_checked_at: undefined },
    })).map((row) => JSON.parse(JSON.stringify(row)))
    : batch[key]]));
}

function reviewedBatchFingerprint(batch) {
  const exact = { ...batch };
  delete exact.reviewed_batch_fingerprint;
  return sha256(exact);
}

function semanticSourceRows(rows) {
  return [...rows].map((row) => ({
    external_product_id: String(row.external_product_id),
    external_variant_id: String(row.external_variant_id),
    external_url: row.after.url,
    price: money(row.after.price),
    in_stock: Boolean(row.after.in_stock),
  })).sort((a, b) => Number(a.external_variant_id) - Number(b.external_variant_id));
}

function semanticSourceFingerprint(rows) {
  return sha256(semanticSourceRows(rows));
}

function operationType(before, after) {
  const price = money(before.price) !== money(after.price);
  const stock = Boolean(before.in_stock) !== Boolean(after.in_stock);
  if (price && stock) return "UPDATE_PRICE_AND_STOCK";
  if (price) return "UPDATE_PRICE";
  if (stock) return "UPDATE_STOCK";
  fail("Reviewed row has no approved commercial change", "REVIEWED_BATCH_ROW_INVALID");
}

function validateRow(row) {
  if (canonicalJson(Object.keys(row).sort()) !== canonicalJson(ROW_FIELDS) || canonicalJson(Object.keys(row.before || {}).sort()) !== canonicalJson(STATE_FIELDS) || canonicalJson(Object.keys(row.after || {}).sort()) !== canonicalJson(STATE_FIELDS)) fail("Reviewed row schema is not closed", "REVIEWED_BATCH_ROW_INVALID");
  const requiredIds = ["offer_id", "product_id", "product_variant_id", "retailer_product_id", "external_product_id", "external_variant_id"];
  for (const key of requiredIds) if (!/^\d+$/.test(String(row[key] || ""))) fail(`Reviewed row ${key} is invalid`, "REVIEWED_BATCH_ROW_INVALID");
  if (!ALLOWED_ACTIONS.has(row.operation_type) || row.operation_type !== operationType(row.before, row.after)) fail("Reviewed row operation type mismatch", "REVIEWED_BATCH_ROW_INVALID");
  if (row.before.url !== row.after.url) fail("Reviewed approval cannot authorize URL changes", "REVIEWED_BATCH_URL_DRIFT");
  if (!Number.isFinite(Number(row.before.price)) || !Number.isFinite(Number(row.after.price)) || Number(row.after.price) <= 0) fail("Reviewed row price is invalid", "REVIEWED_BATCH_PRICE_INVALID");
  for (const side of [row.before, row.after]) {
    try { canonicalTimestamp(side.last_checked_at, "last_checked_at"); } catch { fail("Reviewed row state is incomplete", "REVIEWED_BATCH_ROW_INVALID"); }
    if (typeof side.in_stock !== "boolean") fail("Reviewed row state is incomplete", "REVIEWED_BATCH_ROW_INVALID");
  }
  if (canonicalTimestamp(row.after.last_checked_at) !== canonicalTimestamp(row.source_captured_at)) fail("Reviewed after timestamp must equal source capture", "REVIEWED_BATCH_ROW_INVALID");
  if (timestampEpochNanoseconds(row.after.last_checked_at) <= timestampEpochNanoseconds(row.before.last_checked_at)) fail("Reviewed capture is not newer than current state", "REVIEWED_BATCH_STALE_STATE");
  if (row.review_reason !== "MASS_OOS" || row.approved_guard !== "MASS_OOS") fail("Only MASS_OOS can be owner-reviewed", "REVIEWED_BATCH_GUARD_INVALID");
}

function validateReviewedBatch(batch, options = {}) {
  if (canonicalJson(Object.keys(batch).sort()) !== canonicalJson(TOP_LEVEL_FIELDS)) fail("Reviewed batch schema is not closed");
  if (batch.schema_version !== 1 || batch.kind !== "six-pack-reviewed-owner-approval-v1" || batch.retailer_id !== 11 || batch.retailer_slug !== "6-pack-supplements") fail("Reviewed batch identity mismatch");
  if (batch.status !== "AWAITING_OWNER_APPLY_APPROVAL" || batch.approved_guard !== "MASS_OOS" || batch.review_reason !== "MASS_OOS") fail("Reviewed batch status or guard mismatch");
  if (!/^[0-9a-f]{40}$/.test(batch.implementation_commit_sha || "") || !/^[0-9a-f]{64}$/.test(batch.manifest_sha256 || "")) fail("Reviewed batch implementation commit or manifest hash invalid");
  if (!Array.isArray(batch.rows) || batch.rows.length === 0) fail("Reviewed batch rows are empty");
  batch.rows.forEach(validateRow);
  const ids = (key) => sortedUnique(batch.rows.map((row) => row[key]));
  for (const [field, key] of [["offer_ids", "offer_id"], ["product_ids", "product_id"], ["product_variant_ids", "product_variant_id"], ["retailer_product_ids", "retailer_product_id"]]) {
    if (canonicalJson(batch[field]) !== canonicalJson(ids(key))) fail(`Reviewed batch ${field} mismatch`);
  }
  if (new Set(batch.offer_ids).size !== batch.rows.length || new Set(batch.retailer_product_ids).size !== batch.rows.length) fail("Reviewed row identity is duplicated");
  const expectedHistory = batch.rows.filter((row) => row.operation_type !== "UPDATE_STOCK").length;
  if (batch.expected_price_history_delta !== expectedHistory || batch.expected_mapping_delta !== 0) fail("Reviewed batch expected deltas mismatch");
  if (batch.source_semantic_fingerprint !== semanticSourceFingerprint(batch.rows)) fail("Reviewed source semantic fingerprint mismatch", "REVIEWED_SOURCE_FINGERPRINT_MISMATCH");
  if (batch.reviewed_batch_fingerprint !== reviewedBatchFingerprint(batch)) fail("Reviewed batch fingerprint mismatch", "REVIEWED_BATCH_FINGERPRINT_MISMATCH");
  let captured, expires;
  try { captured = timestampEpochNanoseconds(batch.source_captured_at); expires = timestampEpochNanoseconds(batch.expires_at); }
  catch { fail("Reviewed source capture is expired", "REVIEWED_BATCH_EXPIRED"); }
  const nowDate = options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(nowDate.getTime())) fail("Reviewed source capture is expired", "REVIEWED_BATCH_EXPIRED");
  const now = BigInt(nowDate.getTime()) * 1_000_000n, maxAge = BigInt(MAX_CAPTURE_AGE_MS) * 1_000_000n;
  if (expires <= captured || expires - captured > maxAge || now > expires || now - captured > maxAge) fail("Reviewed source capture is expired", "REVIEWED_BATCH_EXPIRED");
  if (options.expectedFingerprint && options.expectedFingerprint !== batch.reviewed_batch_fingerprint) fail("Dispatched reviewed fingerprint mismatch", "REVIEWED_BATCH_FINGERPRINT_MISMATCH");
  return batch;
}

function loadReviewedBatch(fingerprint, options = {}) {
  if (!/^[0-9a-f]{64}$/.test(fingerprint || "")) fail("A full reviewed batch fingerprint is required");
  const directory = options.directory || BATCH_DIRECTORY;
  const candidates = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith(".json")) : [];
  const matches = candidates.map((name) => ({ path: path.join(directory, name), batch: JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")) })).filter(({ batch }) => batch.reviewed_batch_fingerprint === fingerprint);
  if (matches.length !== 1) fail("Reviewed batch fingerprint must resolve to exactly one manifest");
  if (path.basename(matches[0].path) !== `${fingerprint}.json`) fail("Reviewed batch filename must equal its fingerprint");
  validateReviewedBatch(matches[0].batch, { ...options, expectedFingerprint: fingerprint });
  return { ...matches[0], relativePath: path.relative(ROOT, matches[0].path).replaceAll("\\", "/") };
}

function assertFreshBatchMatch(approved, live) {
  validateReviewedBatch(approved);
  validateReviewedBatch(live);
  if (canonicalJson(approvedDataProjection(live)) !== canonicalJson(approvedDataProjection(approved))) fail("Fresh capture differs from the owner-approved batch", "REVIEWED_BATCH_LIVE_DRIFT");
  return true;
}

function expectedConfirmation(fingerprint) {
  return `APPLY_REVIEWED:${fingerprint}`;
}

function git(command, cwd = ROOT) {
  return execFileSync("git", command, { cwd, encoding: "utf8" }).trim();
}

async function assertOwnerExecutionContext(batch, env = process.env, dependencies = {}) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout") fail("Reviewed apply requires manual GitHub Actions dispatch on main", "REVIEWED_CONTEXT_INVALID");
  if (env.REVIEWED_BATCH_FINGERPRINT !== batch.reviewed_batch_fingerprint || env.REVIEWED_OWNER_CONFIRMATION !== expectedConfirmation(batch.reviewed_batch_fingerprint)) fail("Exact reviewed batch confirmation is missing", "REVIEWED_CONFIRMATION_INVALID");
  const gitFn = dependencies.git || git;
  const head = gitFn(["rev-parse", "HEAD"]);
  const originMain = gitFn(["rev-parse", "origin/main"]);
  if (head !== originMain) fail("HEAD is not the exact origin/main commit", "REVIEWED_COMMIT_INVALID");
  if (head === batch.implementation_commit_sha) fail("Runtime HEAD must be the separate reviewed manifest commit", "REVIEWED_COMMIT_INVALID");
  try { gitFn(["merge-base", "--is-ancestor", batch.implementation_commit_sha, head]); } catch { fail("Implementation commit is not an ancestor of runtime HEAD", "REVIEWED_COMMIT_INVALID"); }
  if (gitFn(["rev-list", "--count", `${batch.implementation_commit_sha}..${head}`]) !== "1") fail("Runtime must be exactly one manifest-only commit after implementation", "REVIEWED_COMMIT_INVALID");
  const changed = gitFn(["diff", "--name-only", `${batch.implementation_commit_sha}..${head}`]).split(/\r?\n/).filter(Boolean);
  const expected = `config/retailers/six-pack-reviewed-batches/${batch.reviewed_batch_fingerprint}.json`;
  if (changed.length !== 1 || changed[0].replaceAll("\\", "/") !== expected) fail("Implementation-to-runtime diff is not the exact reviewed manifest", "REVIEWED_COMMIT_INVALID");
  const getPermission = dependencies.getPermission || (async () => {
    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/collaborators/${encodeURIComponent(env.GITHUB_ACTOR)}/permission`, { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" } });
    if (!response.ok) fail(`GitHub actor permission lookup failed (${response.status})`, "REVIEWED_PERMISSION_INVALID");
    return (await response.json()).permission;
  });
  const permission = await getPermission(env.GITHUB_ACTOR);
  if (!new Set(["maintain", "admin"]).has(permission)) fail("GitHub actor lacks maintain/admin permission", "REVIEWED_PERMISSION_INVALID");
  return { actor: env.GITHUB_ACTOR, permission, implementation_commit_sha: batch.implementation_commit_sha, runtime_commit_sha: head, origin_main_commit_sha: originMain };
}

function buildReviewedBatch({ rows, implementationCommitSha, manifestSha256, sourceCapturedAt, expiresAt }) {
  const normalized = [...rows].map((row) => ({ ...row, operation_type: row.operation_type || operationType(row.before, row.after), review_reason: "MASS_OOS", approved_guard: "MASS_OOS", source_captured_at: sourceCapturedAt })).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const batch = {
    schema_version: 1, kind: "six-pack-reviewed-owner-approval-v1", retailer_id: 11, retailer_slug: "6-pack-supplements",
    implementation_commit_sha: implementationCommitSha, manifest_sha256: manifestSha256,
    offer_ids: sortedUnique(normalized.map((row) => row.offer_id)), product_ids: sortedUnique(normalized.map((row) => row.product_id)),
    product_variant_ids: sortedUnique(normalized.map((row) => row.product_variant_id)), retailer_product_ids: sortedUnique(normalized.map((row) => row.retailer_product_id)),
    source_semantic_fingerprint: semanticSourceFingerprint(normalized), expected_price_history_delta: normalized.filter((row) => row.operation_type !== "UPDATE_STOCK").length,
    expected_mapping_delta: 0, review_reason: "MASS_OOS", approved_guard: "MASS_OOS", rows: normalized,
    source_captured_at: sourceCapturedAt, expires_at: expiresAt, status: "AWAITING_OWNER_APPLY_APPROVAL",
  };
  batch.reviewed_batch_fingerprint = reviewedBatchFingerprint(batch);
  validateReviewedBatch(batch, { now: sourceCapturedAt });
  return batch;
}

module.exports = {
  ALLOWED_ACTIONS, MAX_CAPTURE_AGE_MS,
  assertFreshBatchMatch, assertOwnerExecutionContext,
  buildReviewedBatch, expectedConfirmation, loadReviewedBatch,
  operationType, reviewedBatchFingerprint, semanticSourceFingerprint, semanticSourceRows,
  approvedDataProjection, validateReviewedBatch,
};
