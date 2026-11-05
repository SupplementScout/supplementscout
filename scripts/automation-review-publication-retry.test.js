const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  RETRY_MODE,
  RETRY_WORKFLOW_REF,
  assertRetryContext,
  ownerConfirmationFor,
  requestHash,
  retryAuthorizationFromEnv,
  run,
  verifyRetryArtifactMetadata,
} = require("./automation-review-reconciliation-apply");
const { sha256 } = require("./lib/automation-review-publisher");

const SOURCE_RUN = "111";
const RECONCILIATION_RUN = "222";
const SOURCE_ARTIFACT = "333";
const RECONCILIATION_ARTIFACT = "444";
const SOURCE_DIGEST = "1".repeat(64);
const RECONCILIATION_DIGEST = "2".repeat(64);
const BATCH = "3".repeat(64);
const CHANGESET = "4".repeat(64);
const IDEMPOTENCY = "5".repeat(64);
const SOURCE_SHA = "a".repeat(40);
const WORKFLOW_SHA = "b".repeat(40);
const EXPIRY = "2026-11-06T10:00:00.000Z";
const NOW = new Date("2026-11-05T10:00:00.000Z");
const PROJECT_REF = "abcdefghijklmnopqrst";
const COUNTS = Object.freeze({ products: 1, product_variants: 2, retailer_products: 3, offers: 4, price_history: 5 });

function report(overrides = {}) {
  const value = {
    schema_version: 1,
    kind: "automation-review-queue-reconciliation-dry-run",
    result: "PASS",
    mode: "dry-run",
    production_writes: 0,
    source: {
      run_id: SOURCE_RUN,
      artifact_id: SOURCE_ARTIFACT,
      artifact_digest: SOURCE_DIGEST,
      commit_sha: SOURCE_SHA,
      contract_expires_at: EXPIRY,
    },
    github_context: { run_id: RECONCILIATION_RUN, commit_sha: SOURCE_SHA },
    expected: { catalogue_writes: 0, expiry: EXPIRY },
    request_summary: { operation_count: 0 },
    request: {
      schema_version: 1,
      kind: "automation-review-queue-publication",
      retailer: { id: "12", slug: "generic-retailer" },
      publisher_batch_fingerprint: BATCH,
      idempotency_key: IDEMPOTENCY,
      changeset_fingerprint: CHANGESET,
      workflow_run_id: SOURCE_RUN,
      artifact_id: SOURCE_ARTIFACT,
      commit_sha: SOURCE_SHA,
      capture_timestamp: "2026-11-05T09:00:00.000Z",
      expected_baseline: {
        active_review_count: 0,
        catalogue_counts: COUNTS,
        catalogue_hash_without_review_queue: sha256(COUNTS),
      },
      operations: [],
    },
  };
  return { ...value, ...overrides };
}

function retryEnv(value = report(), overrides = {}) {
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "SupplementScout/supplementscout",
    GITHUB_WORKFLOW_REF: RETRY_WORKFLOW_REF,
    GITHUB_RUN_ID: "999",
    GITHUB_SHA: WORKFLOW_SHA,
    GITHUB_TOKEN: "test-token",
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    RETRY_RECONCILIATION_RUN_ID: RECONCILIATION_RUN,
    RETRY_RECONCILIATION_ARTIFACT_ID: RECONCILIATION_ARTIFACT,
    RETRY_RECONCILIATION_ARTIFACT_DIGEST: RECONCILIATION_DIGEST,
    RETRY_SOURCE_RUN_ID: SOURCE_RUN,
    RETRY_SOURCE_ARTIFACT_ID: SOURCE_ARTIFACT,
    RETRY_SOURCE_ARTIFACT_DIGEST: SOURCE_DIGEST,
    RETRY_BATCH_FINGERPRINT: value.request.publisher_batch_fingerprint,
    RETRY_CHANGESET_FINGERPRINT: value.request.changeset_fingerprint,
    RETRY_IDEMPOTENCY_KEY: value.request.idempotency_key,
    RETRY_REQUEST_HASH: requestHash(value.request),
    RETRY_EXPECTED_RETAILER_ID: value.request.retailer.id,
    RETRY_EXPECTED_PROJECT_REF: PROJECT_REF,
    RETRY_OWNER_CONFIRMATION: "",
    ...overrides,
  };
  env.RETRY_OWNER_CONFIRMATION = overrides.RETRY_OWNER_CONFIRMATION === undefined
    ? ownerConfirmationFor(retryAuthorizationFromEnv(env))
    : overrides.RETRY_OWNER_CONFIRMATION;
  return env;
}

function rpcResult(value = report()) {
  return {
    status: "APPLIED",
    batch_fingerprint: value.request.publisher_batch_fingerprint,
    changeset_fingerprint: value.request.changeset_fingerprint,
    idempotency_key: value.request.idempotency_key,
    created_count: 0,
    refreshed_count: 0,
    superseded_count: 0,
    resolved_by_source_count: 0,
    expired_count: 0,
    catalogue_writes: 0,
    database_writes: 1,
    already_applied: false,
  };
}

function publicationSeal(value = report(), result = rpcResult(value)) {
  return {
    retailer_id: value.request.retailer.id,
    batch_fingerprint: value.request.publisher_batch_fingerprint,
    changeset_fingerprint: value.request.changeset_fingerprint,
    idempotency_key: value.request.idempotency_key,
    request_hash: requestHash(value.request),
    result,
  };
}

function files(value = report()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "review-publication-retry-"));
  const input = path.join(directory, "reconciliation-dry-run.json");
  const output = path.join(directory, "reconciliation-apply.json");
  fs.writeFileSync(input, `${JSON.stringify(value, null, 2)}\n`);
  return { directory, input, output, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

function retryDependencies(value = report(), overrides = {}) {
  const result = rpcResult(value);
  const seal = publicationSeal(value, result);
  const sealReads = [[], [seal]];
  const state = { rpcCalls: 0, rpcRequest: null, sealReads: 0 };
  return {
    state,
    dependencies: {
      env: retryEnv(value),
      now: NOW,
      client: {
        rpc: async (name, args) => {
          state.rpcCalls += 1;
          state.rpcName = name;
          state.rpcRequest = args.p_request;
          return { data: result, error: null };
        },
      },
      verifyArtifactMetadata: async () => ({ result: "PASS" }),
      readPublicationSeal: async () => {
        const index = Math.min(state.sealReads, sealReads.length - 1);
        state.sealReads += 1;
        return sealReads[index];
      },
      readProductionBaseline: async () => ({ catalogueCounts: { ...COUNTS }, activeRows: [] }),
      ...overrides,
    },
  };
}

async function runRetry(value = report(), overrides = {}) {
  const fixture = files(value);
  const setup = retryDependencies(value, overrides);
  try {
    const output = await run({ mode: RETRY_MODE, input: fixture.input, output: fixture.output }, setup.dependencies);
    return { output, state: setup.state };
  } finally { fixture.cleanup(); }
}

test("normal same-run apply behavior remains unchanged", async () => {
  const value = report({ source: { ...report().source, run_id: "12345" }, github_context: { run_id: "12345", commit_sha: SOURCE_SHA } });
  value.request.workflow_run_id = "12345";
  const fixture = files(value);
  let calls = 0;
  try {
    const output = await run({ input: fixture.input, output: fixture.output }, {
      env: { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "schedule", GITHUB_REF: "refs/heads/main", GITHUB_REPOSITORY: "SupplementScout/supplementscout", GITHUB_RUN_ID: "12345", GITHUB_SHA: SOURCE_SHA },
      client: { rpc: async (_name, args) => { calls += 1; return { data: rpcResult({ ...value, request: args.p_request }), error: null }; } },
    });
    assert.equal(output.result, "PASS");
    assert.equal(calls, 1);
  } finally { fixture.cleanup(); }
});

for (const [name, change, pattern] of [
  ["retry mode is rejected outside GitHub Actions", { GITHUB_ACTIONS: "false" }, /GITHUB_ACTIONS_REQUIRED/],
  ["retry mode is rejected outside workflow_dispatch", { GITHUB_EVENT_NAME: "schedule" }, /WORKFLOW_DISPATCH_REQUIRED/],
  ["retry mode is rejected outside main", { GITHUB_REF: "refs/heads/feature" }, /MAIN_REF_REQUIRED/],
  ["retry mode is rejected for the wrong repository", { GITHUB_REPOSITORY: "Other/repository" }, /REPOSITORY_INVALID/],
]) {
  test(name, () => assert.throws(() => assertRetryContext(report(), retryEnv(report(), change), NOW), pattern));
}

test("wrong reconciliation run is rejected", () => {
  assert.throws(() => assertRetryContext(report(), retryEnv(report(), { RETRY_RECONCILIATION_RUN_ID: "223" }), NOW), /RECONCILIATION_RUN_MISMATCH/);
});

function githubMetadataFetch(overrides = {}) {
  const run = (id, sha) => ({ id, repository: { full_name: "SupplementScout/supplementscout" }, status: "completed", conclusion: "success", head_branch: "main", head_sha: sha, event: "workflow_dispatch" });
  const artifact = (id, runId, digest) => ({ id, workflow_run: { id: runId }, expired: false, digest: `sha256:${digest}`, size_in_bytes: 100 });
  return async (url) => {
    let body;
    if (url.endsWith(`/runs/${RECONCILIATION_RUN}`)) body = run(RECONCILIATION_RUN, SOURCE_SHA);
    else if (url.endsWith(`/artifacts/${RECONCILIATION_ARTIFACT}`)) body = artifact(RECONCILIATION_ARTIFACT, RECONCILIATION_RUN, RECONCILIATION_DIGEST);
    else if (url.endsWith(`/runs/${SOURCE_RUN}`)) body = run(SOURCE_RUN, SOURCE_SHA);
    else if (url.endsWith(`/artifacts/${SOURCE_ARTIFACT}`)) body = artifact(SOURCE_ARTIFACT, SOURCE_RUN, SOURCE_DIGEST);
    else body = {};
    return { ok: true, status: 200, json: async () => ({ ...body, ...overrides[url] }) };
  };
}

test("wrong reconciliation artifact ID is rejected by GitHub metadata binding", async () => {
  const value = report();
  const env = retryEnv(value, { RETRY_RECONCILIATION_ARTIFACT_ID: "445" });
  const authorization = assertRetryContext(value, env, NOW);
  await assert.rejects(verifyRetryArtifactMetadata(value, authorization, env, githubMetadataFetch()), /ARTIFACT_METADATA_MISMATCH/);
});

test("wrong reconciliation artifact digest is rejected by GitHub metadata binding", async () => {
  const value = report();
  const env = retryEnv(value, { RETRY_RECONCILIATION_ARTIFACT_DIGEST: "6".repeat(64) });
  const authorization = assertRetryContext(value, env, NOW);
  await assert.rejects(verifyRetryArtifactMetadata(value, authorization, env, githubMetadataFetch()), /ARTIFACT_METADATA_MISMATCH/);
});

for (const [name, field, value, pattern] of [
  ["wrong batch fingerprint is rejected", "RETRY_BATCH_FINGERPRINT", "6".repeat(64), /BATCH_FINGERPRINT_MISMATCH/],
  ["wrong changeset fingerprint is rejected", "RETRY_CHANGESET_FINGERPRINT", "6".repeat(64), /CHANGESET_FINGERPRINT_MISMATCH/],
  ["wrong idempotency key is rejected", "RETRY_IDEMPOTENCY_KEY", "6".repeat(64), /IDEMPOTENCY_KEY_MISMATCH/],
]) {
  test(name, () => assert.throws(() => assertRetryContext(report(), retryEnv(report(), { [field]: value }), NOW), pattern));
}

test("wrong owner confirmation is rejected", () => {
  assert.throws(() => assertRetryContext(report(), retryEnv(report(), { RETRY_OWNER_CONFIRMATION: "OWNER_AUTHORIZED_REVIEW_QUEUE_PUBLICATION_RETRY:wrong" }), NOW), /OWNER_CONFIRMATION_INVALID/);
});

test("expired reconciliation evidence is rejected", () => {
  assert.throws(() => assertRetryContext(report(), retryEnv(report()), new Date("2026-11-06T10:00:00.001Z")), /EVIDENCE_EXPIRED/);
});

test("an existing exact publication seal prevents the RPC", async () => {
  const value = report();
  const seal = publicationSeal(value);
  const result = await runRetry(value, { readPublicationSeal: async () => [seal] });
  assert.equal(result.output.publication_status, "ALREADY_APPLIED");
  assert.equal(result.output.rpc_mutation_attempts, 0);
  assert.equal(result.state.rpcCalls, 0);
});

test("a stale catalogue baseline prevents the RPC", async () => {
  const value = report();
  const fixture = files(value);
  const setup = retryDependencies(value, { readProductionBaseline: async () => ({ catalogueCounts: { ...COUNTS, offers: 99 }, activeRows: [] }) });
  try {
    await assert.rejects(run({ mode: RETRY_MODE, input: fixture.input, output: fixture.output }, setup.dependencies), /CATALOGUE_BASELINE_DRIFT_offers/);
    assert.equal(setup.state.rpcCalls, 0);
  } finally { fixture.cleanup(); }
});

test("the retry path requires the service-role credential", async () => {
  const env = retryEnv(report());
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const fixture = files(report());
  try {
    await assert.rejects(run({ mode: RETRY_MODE, input: fixture.input, output: fixture.output }, { env, now: NOW }), /CONTROL_CREDENTIAL_MISSING/);
  } finally { fixture.cleanup(); }
});

test("the exact artifact request object is passed unchanged to the existing RPC", async () => {
  const value = report();
  const result = await runRetry(value);
  assert.equal(result.state.rpcName, "publish_automation_review_queue_changes");
  assert.deepEqual(result.state.rpcRequest, value.request);
  assert.equal(result.state.rpcCalls, 1);
});

test("transport uncertainty performs one RPC attempt and only a seal readback", async () => {
  const value = report();
  const fixture = files(value);
  let rpcCalls = 0;
  const setup = retryDependencies(value, {
    client: { rpc: async () => { rpcCalls += 1; throw new Error("transport uncertain"); } },
    readPublicationSeal: async () => [],
  });
  try {
    await assert.rejects(run({ mode: RETRY_MODE, input: fixture.input, output: fixture.output }, setup.dependencies), /transport uncertain/);
    assert.equal(rpcCalls, 1);
  } finally { fixture.cleanup(); }
});

test("retry rejects reconciliation evidence that expects catalogue writes", () => {
  const value = report();
  value.expected.catalogue_writes = 1;
  assert.throws(() => assertRetryContext(value, retryEnv(value), NOW), /DRY_RUN_INVALID/);
});

test("workflow and retry runtime contain no owner-decision or execution path", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "automation-review-publication-retry.yml"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "automation-review-reconciliation-apply.js"), "utf8");
  assert.doesNotMatch(`${workflow}\n${source}`, /approve_automation_review|reject_automation_review|create_automation_review_execution_request|automation-review-worker/i);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /schedule:|push:|pull_request:/);
});

test("shared retry runtime has no retailer-specific IDs or eBay branch", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "automation-review-publication-retry.yml"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "automation-review-reconciliation-apply.js"), "utf8");
  assert.doesNotMatch(`${workflow}\n${source}`, /ebay|42012062652|42012826338|13407363148|13408475449/i);
  assert.doesNotMatch(source, /retailer\.id\s*===|offer_id\s*===|product_id\s*===/);
});

test("retry workflow is main-only, service-role-only, serialized, and reuses the apply script", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "automation-review-publication-retry.yml"), "utf8");
  assert.match(workflow, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(workflow, /environment: production-readonly/);
  assert.match(workflow, /group: retailer-offer-production-write[\s\S]*cancel-in-progress: false/);
  assert.match(workflow, /NEXT_PUBLIC_SUPABASE_URL: \$\{\{ secrets\.NEXT_PUBLIC_SUPABASE_URL \}\}/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(workflow, /automation-review-reconciliation-apply\.js[\s\S]*--mode=authorized-artifact-retry/);
  assert.doesNotMatch(workflow, /refresh|owner approval|execution request/i);
});
