const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { sha256, validateRpcResult } = require("./lib/automation-review-publisher");
const {
  createSealedArtifactsService,
  createSupabaseSealedArtifactAdapters,
  guardDependentMutation,
} = require("./lib/sealed-artifacts");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "reconciliation-dry-run.json");
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "automation-review-reconciliation", "reconciliation-apply.json");
const RETRY_MODE = "authorized-artifact-retry";
const REPOSITORY = "SupplementScout/supplementscout";
const RETRY_WORKFLOW_REF = `${REPOSITORY}/.github/workflows/automation-review-publication-retry.yml@refs/heads/main`;
const HEX64 = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const CATALOGUE_TABLES = ["products", "product_variants", "retailer_products", "offers", "price_history"];

function fail(message) { throw new Error(message); }
function normalizeDigest(value) { return String(value || "").replace(/^sha256:/, ""); }
function requireHex64(value, code) { if (!HEX64.test(String(value || ""))) fail(code); return String(value); }
function requirePositiveInteger(value, code) { if (!POSITIVE_INTEGER.test(String(value || ""))) fail(code); return String(value); }

function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, mode: "same-run" };
  for (const arg of argv) {
    const match = arg.match(/^--(input|output|mode)=(.+)$/);
    if (!match) fail(`Invalid argument ${arg}`);
    options[match[1]] = match[1] === "mode" ? match[2] : path.resolve(match[2]);
  }
  if (!["same-run", RETRY_MODE].includes(options.mode)) fail("RECONCILIATION_APPLY_MODE_INVALID");
  for (const file of [options.input, options.output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), file);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Reconciliation files must stay inside tmp");
  }
  return options;
}

function assertDryRunReport(report) {
  if (report?.schema_version !== 1
      || report.kind !== "automation-review-queue-reconciliation-dry-run"
      || report.result !== "PASS"
      || report.mode !== "dry-run"
      || report.production_writes !== 0
      || report.expected?.catalogue_writes !== 0) fail("RECONCILIATION_DRY_RUN_INVALID");
  if (!report.request
      || report.request.operations?.length !== report.request_summary?.operation_count
      || report.request.operations.length > 1000) fail("RECONCILIATION_REQUEST_SCOPE_INVALID");
}

function assertContext(report, env = process.env) {
  if (env.GITHUB_ACTIONS !== "true"
      || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)
      || env.GITHUB_REF !== "refs/heads/main"
      || env.GITHUB_REPOSITORY !== REPOSITORY) fail("RECONCILIATION_APPLY_CONTEXT_INVALID");
  assertDryRunReport(report);
  if (String(report.source?.run_id) !== String(env.GITHUB_RUN_ID)
      || report.source?.commit_sha !== env.GITHUB_SHA
      || report.github_context?.run_id !== String(env.GITHUB_RUN_ID)) fail("RECONCILIATION_SOURCE_CONTEXT_DRIFT");
}

function requestHash(request) {
  const withoutIdempotencyKey = { ...request };
  delete withoutIdempotencyKey.idempotency_key;
  return sha256(withoutIdempotencyKey);
}

function retryAuthorizationFromEnv(env = process.env) {
  const authorization = {
    reconciliationRunId: requirePositiveInteger(env.RETRY_RECONCILIATION_RUN_ID, "RETRY_RECONCILIATION_RUN_ID_INVALID"),
    reconciliationArtifactId: requirePositiveInteger(env.RETRY_RECONCILIATION_ARTIFACT_ID, "RETRY_RECONCILIATION_ARTIFACT_ID_INVALID"),
    reconciliationArtifactDigest: requireHex64(normalizeDigest(env.RETRY_RECONCILIATION_ARTIFACT_DIGEST), "RETRY_RECONCILIATION_ARTIFACT_DIGEST_INVALID"),
    sourceRunId: requirePositiveInteger(env.RETRY_SOURCE_RUN_ID, "RETRY_SOURCE_RUN_ID_INVALID"),
    sourceArtifactId: requirePositiveInteger(env.RETRY_SOURCE_ARTIFACT_ID, "RETRY_SOURCE_ARTIFACT_ID_INVALID"),
    sourceArtifactDigest: requireHex64(normalizeDigest(env.RETRY_SOURCE_ARTIFACT_DIGEST), "RETRY_SOURCE_ARTIFACT_DIGEST_INVALID"),
    batchFingerprint: requireHex64(env.RETRY_BATCH_FINGERPRINT, "RETRY_BATCH_FINGERPRINT_INVALID"),
    changesetFingerprint: requireHex64(env.RETRY_CHANGESET_FINGERPRINT, "RETRY_CHANGESET_FINGERPRINT_INVALID"),
    idempotencyKey: requireHex64(env.RETRY_IDEMPOTENCY_KEY, "RETRY_IDEMPOTENCY_KEY_INVALID"),
    expectedRequestHash: requireHex64(env.RETRY_REQUEST_HASH, "RETRY_REQUEST_HASH_INVALID"),
    expectedRetailerId: requirePositiveInteger(env.RETRY_EXPECTED_RETAILER_ID, "RETRY_EXPECTED_RETAILER_ID_INVALID"),
    expectedProjectRef: String(env.RETRY_EXPECTED_PROJECT_REF || ""),
    ownerConfirmation: String(env.RETRY_OWNER_CONFIRMATION || ""),
  };
  if (!/^[a-z0-9]{20}$/.test(authorization.expectedProjectRef)) fail("RETRY_EXPECTED_PROJECT_REF_INVALID");
  return authorization;
}

function ownerConfirmationFor(authorization) {
  return [
    "OWNER_AUTHORIZED_REVIEW_QUEUE_PUBLICATION_RETRY",
    authorization.reconciliationRunId,
    authorization.reconciliationArtifactId,
    authorization.reconciliationArtifactDigest,
    authorization.batchFingerprint,
    authorization.changesetFingerprint,
    authorization.idempotencyKey,
    authorization.expectedRequestHash,
  ].join(":");
}

function assertRetryContext(report, env = process.env, now = new Date()) {
  if (env.GITHUB_ACTIONS !== "true") fail("RETRY_GITHUB_ACTIONS_REQUIRED");
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch") fail("RETRY_WORKFLOW_DISPATCH_REQUIRED");
  if (env.GITHUB_REF !== "refs/heads/main") fail("RETRY_MAIN_REF_REQUIRED");
  if (env.GITHUB_REPOSITORY !== REPOSITORY) fail("RETRY_REPOSITORY_INVALID");
  if (env.GITHUB_WORKFLOW_REF !== RETRY_WORKFLOW_REF) fail("RETRY_WORKFLOW_REF_INVALID");
  if (!POSITIVE_INTEGER.test(String(env.GITHUB_RUN_ID || "")) || !/^[0-9a-f]{40}$/.test(String(env.GITHUB_SHA || ""))) fail("RETRY_WORKFLOW_IDENTITY_INVALID");
  assertDryRunReport(report);

  const authorization = retryAuthorizationFromEnv(env);
  if (authorization.ownerConfirmation !== ownerConfirmationFor(authorization)) fail("RETRY_OWNER_CONFIRMATION_INVALID");
  if (String(report.github_context?.run_id) !== authorization.reconciliationRunId) fail("RETRY_RECONCILIATION_RUN_MISMATCH");
  if (String(report.source?.run_id) !== authorization.sourceRunId) fail("RETRY_SOURCE_RUN_MISMATCH");
  if (String(report.source?.artifact_id) !== authorization.sourceArtifactId) fail("RETRY_SOURCE_ARTIFACT_ID_MISMATCH");
  if (normalizeDigest(report.source?.artifact_digest) !== authorization.sourceArtifactDigest) fail("RETRY_SOURCE_ARTIFACT_DIGEST_MISMATCH");
  if (report.request.publisher_batch_fingerprint !== authorization.batchFingerprint) fail("RETRY_BATCH_FINGERPRINT_MISMATCH");
  if (report.request.changeset_fingerprint !== authorization.changesetFingerprint) fail("RETRY_CHANGESET_FINGERPRINT_MISMATCH");
  if (report.request.idempotency_key !== authorization.idempotencyKey) fail("RETRY_IDEMPOTENCY_KEY_MISMATCH");
  if (requestHash(report.request) !== authorization.expectedRequestHash) fail("RETRY_REQUEST_HASH_MISMATCH");
  if (String(report.request.retailer?.id) !== authorization.expectedRetailerId) fail("RETRY_RETAILER_BINDING_MISMATCH");
  if (String(report.request.workflow_run_id) !== authorization.sourceRunId
      || String(report.request.artifact_id) !== authorization.sourceArtifactId
      || report.request.commit_sha !== report.source?.commit_sha) fail("RETRY_REQUEST_SOURCE_BINDING_MISMATCH");

  const expiryValues = [
    report.expected?.expiry,
    report.source?.contract_expires_at,
    ...report.request.operations.flatMap((operation) => [operation.row?.expires_at, operation.replacement_row?.expires_at]),
  ].filter(Boolean);
  if (!expiryValues.length || expiryValues.some((value) => Number.isNaN(Date.parse(value)) || Date.parse(value) <= now.getTime())) fail("RETRY_EVIDENCE_EXPIRED");
  return authorization;
}

function assertServiceRoleConfiguration(env, authorization) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail("RECONCILIATION_CONTROL_CREDENTIAL_MISSING");
  let projectRef;
  try { projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]; }
  catch { fail("RETRY_SUPABASE_URL_INVALID"); }
  if (projectRef !== authorization.expectedProjectRef) fail("RETRY_PROJECT_BINDING_MISMATCH");
}

function db(env = process.env) {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("RECONCILIATION_CONTROL_CREDENTIAL_MISSING");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "SupplementScout-Review-Publication-Retry/1.0",
    },
  });
  if (!response.ok) fail(`RETRY_GITHUB_METADATA_HTTP_${response.status}`);
  return response.json();
}

function assertRunMetadata(run, expectedRunId, expectedSha) {
  if (String(run?.id) !== expectedRunId
      || run.repository?.full_name !== REPOSITORY
      || run.status !== "completed"
      || run.conclusion !== "success"
      || run.head_branch !== "main"
      || run.head_sha !== expectedSha
      || !["schedule", "workflow_dispatch"].includes(run.event)) fail("RETRY_GITHUB_RUN_METADATA_MISMATCH");
}

function assertArtifactMetadata(artifact, expectedArtifactId, expectedRunId, expectedDigest) {
  if (String(artifact?.id) !== expectedArtifactId
      || String(artifact.workflow_run?.id) !== expectedRunId
      || artifact.expired !== false
      || normalizeDigest(artifact.digest) !== expectedDigest
      || !Number.isFinite(Number(artifact.size_in_bytes))
      || Number(artifact.size_in_bytes) <= 0
      || Number(artifact.size_in_bytes) > 50 * 1024 * 1024) fail("RETRY_GITHUB_ARTIFACT_METADATA_MISMATCH");
}

async function verifyRetryArtifactMetadata(report, authorization, env, fetchImpl = fetch) {
  if (!env.GITHUB_TOKEN) fail("RETRY_GITHUB_TOKEN_REQUIRED");
  const api = env.GITHUB_API_URL || "https://api.github.com";
  const [reconciliationRun, reconciliationArtifact, sourceRun, sourceArtifact] = await Promise.all([
    githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${authorization.reconciliationRunId}`, env.GITHUB_TOKEN, fetchImpl),
    githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${authorization.reconciliationArtifactId}`, env.GITHUB_TOKEN, fetchImpl),
    githubJson(`${api}/repos/${REPOSITORY}/actions/runs/${authorization.sourceRunId}`, env.GITHUB_TOKEN, fetchImpl),
    githubJson(`${api}/repos/${REPOSITORY}/actions/artifacts/${authorization.sourceArtifactId}`, env.GITHUB_TOKEN, fetchImpl),
  ]);
  assertRunMetadata(reconciliationRun, authorization.reconciliationRunId, report.github_context.commit_sha);
  assertArtifactMetadata(reconciliationArtifact, authorization.reconciliationArtifactId, authorization.reconciliationRunId, authorization.reconciliationArtifactDigest);
  assertRunMetadata(sourceRun, authorization.sourceRunId, report.source.commit_sha);
  assertArtifactMetadata(sourceArtifact, authorization.sourceArtifactId, authorization.sourceRunId, authorization.sourceArtifactDigest);
  return {
    reconciliation_run_id: authorization.reconciliationRunId,
    reconciliation_artifact_id: authorization.reconciliationArtifactId,
    reconciliation_artifact_digest: authorization.reconciliationArtifactDigest,
    source_run_id: authorization.sourceRunId,
    source_artifact_id: authorization.sourceArtifactId,
    source_artifact_digest: authorization.sourceArtifactDigest,
  };
}

async function supabaseResult(promise, code) {
  const response = await promise;
  if (response.error) fail(`${code}: ${response.error.message || "query failed"}`);
  return response;
}

async function readPublicationSeal(client, idempotencyKey) {
  const response = await supabaseResult(
    client.from("automation_review_queue_publications")
      .select("retailer_id,batch_fingerprint,changeset_fingerprint,idempotency_key,request_hash,result")
      .eq("idempotency_key", idempotencyKey),
    "RETRY_SERVICE_ROLE_SEAL_READ_FAILED",
  );
  return response.data || [];
}

async function countTable(client, table) {
  const response = await supabaseResult(client.from(table).select("id", { count: "exact", head: true }), `RETRY_${table.toUpperCase()}_COUNT_FAILED`);
  if (!Number.isSafeInteger(response.count) || response.count < 0) fail(`RETRY_${table.toUpperCase()}_COUNT_INVALID`);
  return response.count;
}

async function readProductionBaseline(client, request) {
  const counts = Object.fromEntries(await Promise.all(CATALOGUE_TABLES.map(async (table) => [table, await countTable(client, table)])));
  const activeResponse = await supabaseResult(
    client.from("product_match_review_queue")
      .select("id,retailer_id,offer_id,review_status,source_row_fingerprint,superseded_by_review_id")
      .eq("retailer_id", request.retailer.id)
      .in("review_status", ["PENDING", "APPROVED"]),
    "RETRY_ACTIVE_REVIEW_READ_FAILED",
  );
  return { catalogueCounts: counts, activeRows: activeResponse.data || [] };
}

function validateSealRows(rows, request, expectedRequestHash) {
  if (!Array.isArray(rows) || rows.length > 1) fail("RETRY_PUBLICATION_SEAL_COUNT_INVALID");
  if (rows.length === 0) return null;
  const seal = rows[0];
  if (String(seal.retailer_id) !== String(request.retailer.id)
      || seal.batch_fingerprint !== request.publisher_batch_fingerprint
      || seal.changeset_fingerprint !== request.changeset_fingerprint
      || seal.idempotency_key !== request.idempotency_key
      || seal.request_hash !== expectedRequestHash) fail("RETRY_PUBLICATION_SEAL_CONFLICT");
  return seal;
}

function validateProductionBaseline(baseline, request) {
  const expected = request.expected_baseline;
  for (const table of CATALOGUE_TABLES) {
    if (Number(baseline.catalogueCounts?.[table]) !== Number(expected.catalogue_counts?.[table])) fail(`RETRY_CATALOGUE_BASELINE_DRIFT_${table}`);
  }
  if (sha256(baseline.catalogueCounts) !== expected.catalogue_hash_without_review_queue) fail("RETRY_CATALOGUE_HASH_DRIFT");
  if (baseline.activeRows.length !== Number(expected.active_review_count)) fail("RETRY_ACTIVE_REVIEW_COUNT_DRIFT");

  const byId = new Map(baseline.activeRows.map((row) => [String(row.id), row]));
  const byProblem = new Map(baseline.activeRows.map((row) => [`${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`, row]));
  for (const operation of request.operations) {
    const expectedRow = operation.expected;
    if (expectedRow.review_id != null) {
      const live = byId.get(String(expectedRow.review_id));
      if (!live
          || live.review_status !== expectedRow.review_status
          || live.source_row_fingerprint !== expectedRow.source_row_fingerprint
          || String(live.superseded_by_review_id ?? "") !== String(expectedRow.superseded_by_review_id ?? "")) fail(`RETRY_ACTIVE_REVIEW_LOCK_DRIFT_${expectedRow.review_id}`);
    }
    if (operation.op === "CREATE") {
      const row = operation.row;
      if (byProblem.has(`${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`)) fail("RETRY_CREATE_ALREADY_ACTIVE");
    }
  }
  return { catalogueCounts: baseline.catalogueCounts, activeReviewCount: baseline.activeRows.length };
}

function applyOutput(report, data, extra = {}) {
  return {
    schema_version: 1,
    kind: "automation-review-queue-reconciliation-apply",
    result: "PASS",
    source_run_id: report.source.run_id,
    operation_count: report.request.operations.length,
    created_count: Number(data.created_count || 0),
    refreshed_count: Number(data.refreshed_count || 0),
    superseded_count: Number(data.superseded_count || 0),
    resolved_by_source_count: Number(data.resolved_by_source_count || 0),
    expired_count: Number(data.expired_count || 0),
    catalogue_writes: 0,
    database_writes: Number(data.database_writes || 0),
    already_applied: data.already_applied === true,
    ...extra,
  };
}

function writeOutput(outputPath, output) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

async function callPublicationRpc(client, request) {
  const response = await client.rpc("publish_automation_review_queue_changes", { p_request: request });
  if (response.error) throw response.error;
  return response.data;
}

async function runSameRun(parsed, report, exactBytes, env, dependencies) {
  assertContext(report, env);
  const client = dependencies.client || db(env);
  const data = await guardDependentMutation({
    artifact: report,
    exactBytes,
    expectedArtifactKind: "REVIEW_REGISTRATION",
    expectedEnvironment: "production",
    serviceFactory: dependencies.sealedArtifactsServiceFactory || (() => (
      createSealedArtifactsService(createSupabaseSealedArtifactAdapters(client))
    )),
    mutation: () => callPublicationRpc(client, report.request),
  });
  validateRpcResult(report.request, data);
  if (Number(data.catalogue_writes || 0) !== 0) fail("RECONCILIATION_CATALOGUE_WRITE_DETECTED");
  return writeOutput(parsed.output, applyOutput(report, data));
}

async function runAuthorizedRetry(parsed, report, exactBytes, env, dependencies) {
  const now = dependencies.now || new Date();
  const authorization = assertRetryContext(report, env, now);
  assertServiceRoleConfiguration(env, authorization);
  const artifactEvidence = await (dependencies.verifyArtifactMetadata || verifyRetryArtifactMetadata)(report, authorization, env, dependencies.fetchImpl);
  const client = dependencies.client || db(env);
  const readSeal = dependencies.readPublicationSeal || readPublicationSeal;
  const expectedRequestHash = requestHash(report.request);
  const firstSealRows = await readSeal(client, authorization.idempotencyKey);
  const existingSeal = validateSealRows(firstSealRows, report.request, expectedRequestHash);
  if (existingSeal) {
    const data = { ...existingSeal.result, already_applied: true, audit_event_delta: 0, database_writes: 0, catalogue_writes: 0 };
    validateRpcResult(report.request, data);
    return writeOutput(parsed.output, applyOutput(report, data, {
      mode: RETRY_MODE,
      publication_status: "ALREADY_APPLIED",
      rpc_mutation_attempts: 0,
      publication_seal_count: 1,
      request_hash: expectedRequestHash,
      service_role_context_verified: true,
      artifact_evidence: artifactEvidence,
    }));
  }

  const baseline = await (dependencies.readProductionBaseline || readProductionBaseline)(client, report.request);
  const baselineEvidence = validateProductionBaseline(baseline, report.request);
  let mutationAttempts = 0;
  let data;
  try {
    data = await guardDependentMutation({
      artifact: report,
      exactBytes,
      expectedArtifactKind: "REVIEW_REGISTRATION",
      expectedEnvironment: "production",
      serviceFactory: dependencies.sealedArtifactsServiceFactory || (() => (
        createSealedArtifactsService(createSupabaseSealedArtifactAdapters(client))
      )),
      mutation: () => {
        mutationAttempts += 1;
        if (mutationAttempts > 1) fail("RETRY_RPC_ATTEMPT_LIMIT_EXCEEDED");
        return callPublicationRpc(client, report.request);
      },
    });
  } catch (error) {
    const recoverySeal = validateSealRows(await readSeal(client, authorization.idempotencyKey), report.request, expectedRequestHash);
    if (!recoverySeal) throw error;
    data = { ...recoverySeal.result, already_applied: true, audit_event_delta: 0, database_writes: 0, catalogue_writes: 0 };
  }
  validateRpcResult(report.request, data);
  if (Number(data.catalogue_writes || 0) !== 0) fail("RECONCILIATION_CATALOGUE_WRITE_DETECTED");
  const finalSeal = validateSealRows(await readSeal(client, authorization.idempotencyKey), report.request, expectedRequestHash);
  if (!finalSeal) fail("RETRY_PUBLICATION_SEAL_MISSING_AFTER_RPC");
  return writeOutput(parsed.output, applyOutput(report, data, {
    mode: RETRY_MODE,
    publication_status: data.already_applied === true ? "APPLIED_CONFIRMED_BY_SEAL" : "APPLIED",
    rpc_mutation_attempts: mutationAttempts,
    publication_seal_count: 1,
    request_hash: expectedRequestHash,
    service_role_context_verified: true,
    artifact_evidence: artifactEvidence,
    pre_retry_baseline: baselineEvidence,
  }));
}

async function run(options, dependencies = {}) {
  const parsed = Array.isArray(options) ? parseArgs(options) : { mode: "same-run", ...options };
  const exactBytes = fs.readFileSync(parsed.input);
  const report = JSON.parse(exactBytes.toString("utf8"));
  const env = dependencies.env || process.env;
  return parsed.mode === RETRY_MODE
    ? runAuthorizedRetry(parsed, report, exactBytes, env, dependencies)
    : runSameRun(parsed, report, exactBytes, env, dependencies);
}

if (require.main === module) run(parseArgs(process.argv.slice(2)))
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = {
  RETRY_MODE,
  RETRY_WORKFLOW_REF,
  assertContext,
  assertRetryContext,
  assertServiceRoleConfiguration,
  ownerConfirmationFor,
  parseArgs,
  readProductionBaseline,
  requestHash,
  retryAuthorizationFromEnv,
  run,
  validateProductionBaseline,
  validateSealRows,
  verifyRetryArtifactMetadata,
};
