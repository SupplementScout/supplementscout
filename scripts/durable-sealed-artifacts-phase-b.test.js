const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CONTRACT_FIELD,
  ROLLOUT_CONTROL,
  bindDurableArtifactContract,
  createSealedArtifactsService,
  durableContractOf,
  guardDependentMutation,
  parseDurableUri,
  policyFor,
  rolloutState,
  sha256,
} = require("./lib/sealed-artifacts");
const { createInMemorySealedArtifactAdapters } = require("./lib/sealed-artifacts/testing");
const {
  captureMatchingWorkflowDispatchRunIds,
  normalizeDispatchStartToGitHubSecond,
  selectSingleNewWorkflowDispatchRun,
} = require("./lib/github-workflow-dispatch-selector");
const { run: applyReviewRegistration } = require("./automation-review-reconciliation-apply");
const { loadDryRunArtifact, writeDryRunArtifact } = require("./import-products");

const GIT_SHA = "a".repeat(40);
const FINGERPRINT = "b".repeat(64);
const ON = Object.freeze({ [ROLLOUT_CONTROL]: "ON" });
const OFF = Object.freeze({ [ROLLOUT_CONTROL]: "OFF" });

function artifact(overrides = {}) {
  return { schema_version: 1, kind: "phase-b-test", fingerprint: FINGERPRINT, rows: [], ...overrides };
}

function metadata(overrides = {}) {
  return {
    artifactKind: "APPROVED_PLAN",
    environment: "test",
    filename: "phase-b-plan.json",
    schemaVersion: 1,
    producer: "phase-b-tests",
    gitSha: GIT_SHA,
    runId: "phase-b-test-run",
    artifactFingerprint: FINGERPRINT,
    ...overrides,
  };
}

function bound(overrides = {}, metadataOverrides = {}) {
  const value = bindDurableArtifactContract(artifact(overrides), metadata(metadataOverrides), ON);
  return { artifact: value, exactBytes: Buffer.from(`${JSON.stringify(value, null, 2)}\n`) };
}

function memory(options = {}) {
  const adapters = createInMemorySealedArtifactAdapters(options);
  return { ...adapters, service: createSealedArtifactsService(adapters) };
}

async function guarded(value, service, mutation, overrides = {}) {
  return guardDependentMutation({
    artifact: value.artifact,
    exactBytes: value.exactBytes,
    expectedArtifactKind: "APPROVED_PLAN",
    expectedEnvironment: "test",
    serviceFactory: () => service,
    mutation,
    ...overrides,
  });
}

test("enforcement OFF preserves the legacy mutation result", async () => {
  const original = artifact();
  assert.equal(bindDurableArtifactContract(original, metadata(), OFF), original);
  assert.equal(await guardDependentMutation({ artifact: original, mutation: () => "legacy-result" }), "legacy-result");
});

test("enforcement OFF performs zero Storage and registry writes", async () => {
  const state = memory();
  await guardDependentMutation({ artifact: artifact(), mutation: () => "ok", serviceFactory: () => state.service });
  assert.equal(state.controls.objectCount(), 0);
  assert.equal(state.controls.registryCount(), 0);
});

test("enforcement OFF does not initialize credentials or a durable service", async () => {
  let factoryCalls = 0;
  await guardDependentMutation({
    artifact: artifact(),
    serviceFactory: () => { factoryCalls += 1; throw new Error("credentials must not be read"); },
    mutation: () => "ok",
  });
  assert.equal(factoryCalls, 0);
});

test("enforcement ON binds and seals a new durable-required artifact", async () => {
  const value = bound();
  const state = memory();
  await guarded(value, state.service, () => "mutated");
  assert.equal(state.controls.objectCount(), 1);
  assert.equal(state.controls.registryCount(), 1);
  assert.equal(state.controls.registryRows()[0].artifact_kind, "APPROVED_PLAN");
});

test("sealing and fresh verification both finish before dependent mutation", async () => {
  const value = bound();
  const state = memory();
  const order = [];
  const service = {
    seal: async (input) => { order.push("seal"); return state.service.seal(input); },
    verify: async (input) => { order.push("verify"); return state.service.verify(input); },
  };
  await guarded(value, service, () => order.push("mutation"));
  assert.deepEqual(order, ["seal", "verify", "mutation"]);
});

test("seal failure blocks dependent mutation", async () => {
  const value = bound();
  let mutations = 0;
  await assert.rejects(guarded(value, { seal: async () => { throw new Error("seal failed"); }, verify: async () => {} }, () => { mutations += 1; }), /seal failed/);
  assert.equal(mutations, 0);
});

test("verify failure blocks dependent mutation", async () => {
  const value = bound();
  const state = memory();
  let mutations = 0;
  await assert.rejects(guarded(value, { seal: state.service.seal, verify: async () => { throw new Error("verify failed"); } }, () => { mutations += 1; }), /verify failed/);
  assert.equal(mutations, 0);
});

test("missing durable object blocks dependent mutation", async () => {
  const value = bound();
  const state = memory();
  const sealed = await state.service.seal({ ...durableContractOf(value.artifact), artifactKind: "APPROVED_PLAN", contentType: "application/json", schemaVersion: 1, gitSha: GIT_SHA, runId: "phase-b-test-run", artifactFingerprint: FINGERPRINT, containsSecrets: false, bytes: value.exactBytes });
  state.controls.deleteObject(parseDurableUri(sealed.artifact.durable_uri).objectPath);
  await assert.rejects(guarded(value, state.service, () => "forbidden"), /storage object is missing/i);
});

test("missing registry row blocks dependent mutation", async () => {
  const value = bound();
  const state = memory();
  const sealInput = { environment: "test", artifactKind: "APPROVED_PLAN", filename: "phase-b-plan.json", contentType: "application/json", bytes: value.exactBytes, containsSecrets: false, schemaVersion: 1, producer: "phase-b-tests", gitSha: GIT_SHA, runId: "phase-b-test-run", artifactFingerprint: FINGERPRINT };
  const sealed = await state.service.seal(sealInput);
  state.controls.deleteRegistry(sealed.artifact.durable_uri);
  await assert.rejects(guarded(value, state.service, () => "forbidden"), /object exists without a registry row/i);
});

test("tampered durable bytes block dependent mutation", async () => {
  const value = bound();
  const state = memory();
  const sealInput = { environment: "test", artifactKind: "APPROVED_PLAN", filename: "phase-b-plan.json", contentType: "application/json", bytes: value.exactBytes, containsSecrets: false, schemaVersion: 1, producer: "phase-b-tests", gitSha: GIT_SHA, runId: "phase-b-test-run", artifactFingerprint: FINGERPRINT };
  const sealed = await state.service.seal(sealInput);
  state.controls.tamperObjectBytes(parseDurableUri(sealed.artifact.durable_uri).objectPath, Buffer.from("{}"));
  await assert.rejects(guarded(value, state.service, () => "forbidden"), /byte size differs|SHA-256 differs/i);
});

test("wrong environment blocks dependent mutation before service initialization", async () => {
  const value = bound();
  let factories = 0;
  await assert.rejects(guarded(value, null, () => "forbidden", { expectedEnvironment: "production", serviceFactory: () => { factories += 1; } }), /another environment/i);
  assert.equal(factories, 0);
});

test("staging durable identity is rejected by a production boundary", async () => {
  const value = bound({}, { environment: "staging" });
  await assert.rejects(guardDependentMutation({ artifact: value.artifact, exactBytes: value.exactBytes, expectedArtifactKind: "APPROVED_PLAN", expectedEnvironment: "production", serviceFactory: () => memory().service, mutation: () => "forbidden" }), /another environment/i);
});

test("unsupported artifact kind is rejected", () => {
  assert.throws(() => bindDurableArtifactContract(artifact(), metadata({ artifactKind: "PRODUCT_123" }), ON), /not allowlisted/i);
});

test("durable-recommended artifacts do not become mandatory", () => {
  const original = artifact();
  const prepared = bindDurableArtifactContract(original, metadata({ artifactKind: "PREPARED_SCOPE" }), ON);
  assert.equal(prepared, original);
  assert.equal(policyFor("PREPARED_SCOPE"), "DURABLE_RECOMMENDED");
});

test("TEMPORARY_DEBUG is never accepted by the required path", () => {
  assert.throws(() => bindDurableArtifactContract(artifact(), metadata({ artifactKind: "TEMPORARY_DEBUG" }), ON), /temporary-only artifacts/i);
});

test("legacy artifact remains compatible while rollout is active", async () => {
  let calls = 0;
  const result = await guardDependentMutation({ artifact: artifact(), mutation: ({ legacy }) => { calls += 1; return legacy; } });
  assert.equal(result, true);
  assert.equal(calls, 1);
});

test("a bound new-contract artifact cannot downgrade when rollout returns OFF", async () => {
  const value = bound();
  assert.equal(rolloutState(OFF).enabled, false);
  let mutations = 0;
  await assert.rejects(guarded(value, { seal: async () => { throw new Error("still enforced"); }, verify: async () => {} }, () => { mutations += 1; }), /still enforced/);
  assert.equal(mutations, 0);
});

test("activation boundary is one generic shared control", () => {
  assert.equal(ROLLOUT_CONTROL, "DURABLE_SEALED_ARTIFACTS_ENFORCEMENT");
  assert.equal(rolloutState(ON).enabled, true);
});

test("shared rollout core has no retailer, product, run-id, Wave, or nutrition exceptions", () => {
  const source = fs.readFileSync(path.join(__dirname, "lib", "sealed-artifacts", "rollout.js"), "utf8");
  assert.doesNotMatch(source, /retailer|product[_ -]?id|old_run|wave|nutrition/i);
});

test("contract binding preserves approval payload and package fingerprints", () => {
  const original = artifact({ approval: { actor: "owner", exact: true }, plan_fingerprint: FINGERPRINT });
  const result = bindDurableArtifactContract(original, metadata(), ON);
  assert.deepEqual(result.approval, original.approval);
  assert.equal(result.plan_fingerprint, original.plan_fingerprint);
  assert.equal(original[CONTRACT_FIELD], undefined);
});

test("sealed SHA is computed from the exact supplied bytes", async () => {
  const value = bound();
  const state = memory();
  await guarded(value, state.service, () => "ok");
  assert.equal(state.controls.registryRows()[0].sha256, sha256(value.exactBytes));
});

test("duplicate same-byte guarded sealing is idempotent", async () => {
  const value = bound();
  const state = memory();
  await guarded(value, state.service, () => "first");
  await guarded(value, state.service, () => "second");
  assert.equal(state.controls.objectCount(), 1);
  assert.equal(state.controls.registryCount(), 1);
});

test("production configuration defaults enforcement OFF", () => {
  assert.deepEqual(rolloutState(OFF), { enabled: false, value: "OFF" });
});

test("missing rollout configuration means OFF", () => {
  assert.deepEqual(rolloutState({}), { enabled: false, value: "OFF" });
});

test("empty rollout configuration means OFF", () => {
  assert.deepEqual(rolloutState({ [ROLLOUT_CONTROL]: "" }), { enabled: false, value: "OFF" });
});

test("invalid rollout values fail closed without becoming another flag system", () => {
  assert.throws(() => rolloutState({ [ROLLOUT_CONTROL]: "production" }), /must be ON, OFF, or absent/);
});

function workflowRun(id, overrides = {}) {
  return {
    id,
    workflow_id: 320801274,
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: "9".repeat(40),
    created_at: "2026-10-31T10:07:34Z",
    ...overrides,
  };
}

const WORKFLOW_RUN_CRITERIA = Object.freeze({
  workflowId: "320801274",
  branch: "main",
  headSha: "9".repeat(40),
});

test("workflow dispatch selection normalizes millisecond start down to GitHub second precision", () => {
  assert.equal(normalizeDispatchStartToGitHubSecond("2026-10-31T10:07:33.206Z"), "2026-10-31T10:07:33.000Z");
  const selected = selectSingleNewWorkflowDispatchRun({
    runs: [workflowRun(2, { created_at: "2026-10-31T10:07:33Z" })],
    baselineRunIds: [],
    criteria: WORKFLOW_RUN_CRITERIA,
    dispatchStartedAt: "2026-10-31T10:07:33.206Z",
  });
  assert.equal(selected.id, 2);
});

test("pre-dispatch matching run in the same second is excluded by run-ID set difference", () => {
  const before = workflowRun(1, { created_at: "2026-10-31T10:07:33Z" });
  const after = workflowRun(2, { created_at: "2026-10-31T10:07:33Z" });
  const baselineRunIds = captureMatchingWorkflowDispatchRunIds([before], WORKFLOW_RUN_CRITERIA);
  assert.deepEqual(baselineRunIds, ["1"]);
  const selected = selectSingleNewWorkflowDispatchRun({
    runs: [before, after],
    baselineRunIds,
    criteria: WORKFLOW_RUN_CRITERIA,
    dispatchStartedAt: "2026-10-31T10:07:33.206Z",
  });
  assert.equal(selected.id, 2);
});

test("exactly one new matching workflow dispatch run passes", () => {
  const selected = selectSingleNewWorkflowDispatchRun({
    runs: [workflowRun(10), workflowRun(11)],
    baselineRunIds: ["10"],
    criteria: WORKFLOW_RUN_CRITERIA,
  });
  assert.equal(selected.id, 11);
});

test("zero new matching workflow dispatch runs fail closed", () => {
  assert.throws(() => selectSingleNewWorkflowDispatchRun({
    runs: [workflowRun(10)],
    baselineRunIds: ["10"],
    criteria: WORKFLOW_RUN_CRITERIA,
  }), /found 0/);
});

test("multiple new matching workflow dispatch runs fail closed", () => {
  assert.throws(() => selectSingleNewWorkflowDispatchRun({
    runs: [workflowRun(10), workflowRun(11)],
    baselineRunIds: [],
    criteria: WORKFLOW_RUN_CRITERIA,
  }), /found 2/);
});

test("wrong workflow, SHA, event, and branch are rejected", () => {
  const mismatches = [
    workflowRun(1, { workflow_id: 999 }),
    workflowRun(2, { head_sha: "8".repeat(40) }),
    workflowRun(3, { event: "schedule" }),
    workflowRun(4, { head_branch: "feature" }),
  ];
  for (const run of mismatches) {
    assert.throws(() => selectSingleNewWorkflowDispatchRun({
      runs: [run],
      baselineRunIds: [],
      criteria: WORKFLOW_RUN_CRITERIA,
    }), /found 0/);
  }
});

test("bound artifacts require exact original bytes and never reserialize", async () => {
  const value = bound();
  await assert.rejects(guardDependentMutation({ artifact: value.artifact, serviceFactory: () => memory().service, mutation: () => "forbidden" }), /exact original bytes/i);
});

test("bound artifact object must match the exact original bytes", async () => {
  const value = bound();
  await assert.rejects(guarded({ ...value, artifact: { ...value.artifact, rows: [{ changed: true }] } }, memory().service, () => "forbidden"), /differs from its exact original bytes/i);
});

test("a mutation boundary rejects the wrong durable artifact class", async () => {
  const value = bound();
  await assert.rejects(guarded(value, memory().service, () => "forbidden", { expectedArtifactKind: "REVIEW_REGISTRATION" }), /kind differs/i);
});

test("independent artifacts retain per-item isolation", async () => {
  const clean = bound({ item: "clean" }, { filename: "clean.json", runId: "clean" });
  const broken = bound({ item: "broken" }, { filename: "broken.json", runId: "broken" });
  const state = memory();
  const completed = [];
  await assert.rejects(guarded(broken, { seal: async () => { throw new Error("broken item"); }, verify: async () => {} }, () => completed.push("broken")), /broken item/);
  await guarded(clean, state.service, () => completed.push("clean"));
  assert.deepEqual(completed, ["clean"]);
});

test("one atomic package is not partially mutated after verification failure", async () => {
  const value = bound({ rows: [{ id: 1 }, { id: 2 }] });
  let packageWrites = 0;
  await assert.rejects(guarded(value, { seal: async () => { throw new Error("package seal failed"); }, verify: async () => {} }, () => { packageWrites += 2; }), /package seal failed/);
  assert.equal(packageWrites, 0);
});

test("guard invokes a dependent mutation once and does not create a replay engine", async () => {
  const value = bound();
  const state = memory();
  let mutations = 0;
  await guarded(value, state.service, () => { mutations += 1; return { uncertain: true }; });
  assert.equal(mutations, 1);
});

function reviewReport() {
  return {
    schema_version: 1,
    kind: "automation-review-queue-reconciliation-dry-run",
    result: "PASS",
    mode: "dry-run",
    production_writes: 0,
    source: { run_id: "12345", commit_sha: GIT_SHA },
    github_context: { run_id: "12345" },
    expected: { catalogue_writes: 0 },
    request_summary: { operation_count: 0 },
    request: { operations: [], changeset_fingerprint: FINGERPRINT, publisher_batch_fingerprint: "c".repeat(64), idempotency_key: "d".repeat(64) },
  };
}

function reviewEnv(overrides = {}) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "schedule",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "SupplementScout/supplementscout",
    GITHUB_RUN_ID: "12345",
    GITHUB_SHA: GIT_SHA,
    ...overrides,
  };
}

async function withReviewFiles(report, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase-b-review-"));
  const input = path.join(directory, "input.json");
  const output = path.join(directory, "output.json");
  fs.writeFileSync(input, `${JSON.stringify(report, null, 2)}\n`);
  try { return await callback({ input, output }); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test("shared Review Queue apply keeps OFF/legacy behavior and needs no Storage API", async () => {
  let rpcCalls = 0;
  await withReviewFiles(reviewReport(), async (options) => {
    await applyReviewRegistration(options, {
      env: reviewEnv(),
      client: { rpc: async (_name, args) => { rpcCalls += 1; return { data: { batch_fingerprint: args.p_request.publisher_batch_fingerprint, changeset_fingerprint: args.p_request.changeset_fingerprint, idempotency_key: args.p_request.idempotency_key, catalogue_writes: 0, database_writes: 0 }, error: null }; } },
      sealedArtifactsServiceFactory: () => { throw new Error("must stay lazy"); },
    });
  });
  assert.equal(rpcCalls, 1);
});

test("shared Review Queue apply seals and verifies exact input before its RPC", async () => {
  const state = memory();
  const order = [];
  const report = bindDurableArtifactContract(reviewReport(), metadata({
    artifactKind: "REVIEW_REGISTRATION",
    environment: "production",
    filename: "input.json",
    producer: "automation-review-reconciliation",
    runId: "12345",
  }), ON);
  await withReviewFiles(report, async (options) => {
    const service = {
      seal: async (input) => { order.push("seal"); return state.service.seal(input); },
      verify: async (input) => { order.push("verify"); return state.service.verify(input); },
    };
    await applyReviewRegistration(options, {
      env: reviewEnv(),
      client: { rpc: async (_name, args) => { order.push("rpc"); return { data: { batch_fingerprint: args.p_request.publisher_batch_fingerprint, changeset_fingerprint: args.p_request.changeset_fingerprint, idempotency_key: args.p_request.idempotency_key, catalogue_writes: 0, database_writes: 1 }, error: null }; } },
      sealedArtifactsServiceFactory: () => service,
    });
  });
  assert.deepEqual(order, ["seal", "verify", "rpc"]);
});

test("shared import artifact writer binds exact persisted bytes only when ON and target-bound", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase-b-import-"));
  const artifactPath = path.join(directory, "plan.json");
  try {
    const written = writeDryRunArtifact([], { report: { approvedRows: [] }, blockedRows: [], skipped: 0 }, {
      artifactPath,
      environmentMarker: "test",
      gitSha: GIT_SHA,
      runId: "phase-b-import",
      rolloutEnv: ON,
    });
    const loaded = loadDryRunArtifact(artifactPath);
    assert.equal(durableContractOf(written.artifact).artifact_kind, "APPROVED_PLAN");
    assert.equal(sha256(loaded.artifactBytes), written.artifactSha256);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
