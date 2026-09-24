const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const incidentManifest = require("../docs/retailer-automation/evidence/RA-003-incidents.json");
const fixtureLibrary = require("./test-fixtures/retailer-canonical-v1/historical-incident-fixtures.json");
const goldenLibrary = require("./test-fixtures/retailer-canonical-v1/historical-incident-goldens.json");
const compatibilityMatrix = require("./test-fixtures/retailer-canonical-v1/legacy-compatibility-matrix.json");
const { canonicalFingerprint, validateCanonicalRecord } = require("./lib/retailer-offer-sync/canonical-v1/contract");
const { mapLegacyStatus, validateMatrix } = require("./lib/retailer-offer-sync/canonical-v1/legacy-compatibility-adapter");
const { createZeroWriteBoundary, runZeroWriteHarness } = require("./lib/retailer-offer-sync/canonical-v1/zero-write-harness");
const taxonomy = require("./lib/retailer-offer-sync/canonical-v1/taxonomy");

const root = path.resolve(__dirname, "..");
const fixtureById = new Map(fixtureLibrary.fixtures.map((entry) => [entry.fixture_id, entry]));
const goldenById = new Map(goldenLibrary.expectations.map((entry) => [entry.fixture_id, entry]));
const fullFixture = (entry) => ({ ...structuredClone(entry), source: structuredClone(fixtureLibrary.source), captured_at: fixtureLibrary.captured_at });
const rowSummary = (row) => ({
  source_record_id: row.source_record_id,
  source_state: row.source_state,
  change_classification: row.change_classification,
  execution_state: row.execution_state,
  availability: row.canonical_record.availability,
  contract_valid: row.contract_valid,
});

function assertGolden(report, golden) {
  assert.equal(report.run_outcome, golden.run_outcome);
  assert.equal(report.output_fingerprint, golden.output_fingerprint);
  assert.deepEqual(Object.keys(report.reason_counts), golden.reason_codes);
  assert.ok(Object.hasOwn(report.reason_counts, golden.primary_reason.reason_code));
  const primaryReason = taxonomy.getReason(golden.primary_reason.reason_code);
  assert.equal(primaryReason.alert_level, golden.primary_reason.alert_level);
  assert.equal(primaryReason.next_action, golden.primary_reason.next_action);
  assert.equal(primaryReason.blocking_scope, golden.primary_reason.blocking_scope);
  assert.deepEqual(report.rows.map(rowSummary), golden.rows);
  assert.equal(report.write_attempt_count, goldenLibrary.invariants.write_attempt_count);
  assert.equal(report.network_attempt_count, goldenLibrary.invariants.network_attempt_count);
  for (const row of report.rows) {
    assert.equal(row.policy_authorized, goldenLibrary.invariants.policy_authorized);
    assert.equal(row.manifest_approved, goldenLibrary.invariants.manifest_approved);
    assert.equal(row.execution_attempted, goldenLibrary.invariants.execution_attempted);
    assert.equal(validateCanonicalRecord(row.canonical_record).valid, true);
  }
}

test("incident manifest gives every candidate an explicit evidence-backed coverage state", () => {
  const allowed = new Set(incidentManifest.coverage_statuses);
  const coverageCounts = Object.fromEntries([...allowed].map((status) => [status, incidentManifest.incidents.filter((entry) => entry.coverage_status === status).length]));
  assert.equal(incidentManifest.baseline_sha, "87cc53cff4af585ac626db26c54d94f053972762");
  assert.equal(new Set(incidentManifest.incidents.map((entry) => entry.incident_id)).size, incidentManifest.incidents.length);
  assert.equal(incidentManifest.incidents.length, 23);
  assert.deepEqual(coverageCounts, { COVERED: 16, BLOCKED_EVIDENCE: 3, DEFERRED_OUT_OF_SCOPE: 1, DUPLICATE_COVERAGE: 3 });
  for (const incident of incidentManifest.incidents) {
    assert.ok(allowed.has(incident.coverage_status), `${incident.incident_id} has invalid coverage`);
    assert.ok(incident.evidence_ref && incident.assessment && incident.historical_behavior);
    if (incident.coverage_status === "COVERED") {
      assert.ok(incident.fixture_id && incident.fixture_path && incident.golden_path && /^[0-9a-f]{64}$/.test(incident.fixture_fingerprint));
      assert.ok(fs.existsSync(path.join(root, incident.fixture_path)) && fs.existsSync(path.join(root, incident.golden_path)));
      assert.ok(fixtureById.has(incident.fixture_id), `${incident.incident_id} fixture is missing`);
      assert.ok(goldenById.has(incident.fixture_id), `${incident.incident_id} golden is missing`);
      assert.equal(incident.fixture_fingerprint, goldenById.get(incident.fixture_id).fixture_fingerprint);
      for (const key of ["source_state", "change_classification", "execution_state", "run_outcome", "reason_code", "alert_level", "next_action", "blocking_scope"]) assert.ok(incident.expected[key], `${incident.incident_id} expected.${key} is missing`);
    }
    if (incident.coverage_status === "DUPLICATE_COVERAGE") {
      const sharedFixture = incident.duplicate_of && fixtureById.has(incident.fixture_id);
      const existingRegression = incident.existing_regression_path && fs.existsSync(path.join(root, incident.existing_regression_path));
      assert.ok(sharedFixture || existingRegression, `${incident.incident_id} duplicate coverage is not traceable`);
      const primary = incidentManifest.incidents.find((entry) => entry.incident_id === incident.duplicate_of);
      if (incident.duplicate_of) assert.ok(primary && primary.coverage_status === "COVERED", `${incident.incident_id} duplicate target is not covered`);
    }
    if (["BLOCKED_EVIDENCE", "DEFERRED_OUT_OF_SCOPE"].includes(incident.coverage_status)) {
      assert.equal(incident.fixture_id, null);
      assert.equal(incident.expected, null);
    }
  }
});

test("every historical fixture has a sealed golden and deterministic zero-write replay", () => {
  assert.equal(fixtureById.size, goldenById.size);
  for (const [fixtureId, entry] of fixtureById) {
    const fixture = fullFixture(entry);
    const golden = goldenById.get(fixtureId);
    assert.ok(golden, `${fixtureId} golden is missing`);
    assert.equal(canonicalFingerprint("INCIDENT-FIXTURE", fixture), golden.fixture_fingerprint);
    const first = runZeroWriteHarness(fixture, { clock: () => fixtureLibrary.captured_at });
    const second = runZeroWriteHarness(structuredClone(fixture), { clock: () => fixtureLibrary.captured_at });
    assert.deepEqual(first, second, `${fixtureId} replay drifted`);
    assertGolden(first, golden);
  }
});

test("covered incident expectations agree with replay outcomes and reason metadata", () => {
  for (const incident of incidentManifest.incidents.filter((entry) => entry.coverage_status === "COVERED")) {
    const report = runZeroWriteHarness(fullFixture(fixtureById.get(incident.fixture_id)));
    assert.equal(report.run_outcome, incident.expected.run_outcome, incident.incident_id);
    assert.ok(Object.hasOwn(report.reason_counts, incident.expected.reason_code), `${incident.incident_id} reason missing`);
    const reason = taxonomy.getReason(incident.expected.reason_code);
    assert.equal(reason.alert_level, incident.expected.alert_level);
    assert.equal(reason.next_action, incident.expected.next_action);
    assert.equal(reason.blocking_scope, incident.expected.blocking_scope);
    if (report.rows.length) {
      assert.ok(report.rows.some((row) => row.source_state === incident.expected.source_state && row.change_classification === incident.expected.change_classification && row.execution_state === incident.expected.execution_state), `${incident.incident_id} canonical tuple missing`);
    }
  }
});

test("goldens fail closed when any required semantic expectation is changed", () => {
  const fixture = fullFixture(fixtureById.get("incident-pass-with-review-not-failure"));
  const report = runZeroWriteHarness(fixture);
  const mutations = [
    ["reason_code", "CANONICAL_SYSTEM_EXCEPTION"],
    ["alert_level", "CRITICAL_PLATFORM"],
    ["next_action", "ENGINEERING_RESPONSE"],
    ["blocking_scope", "PLATFORM"],
  ];
  for (const [field, value] of mutations) {
    const changed = structuredClone(goldenById.get(fixture.fixture_id));
    changed.primary_reason[field] = value;
    assert.throws(() => assertGolden(report, changed), `${field} mutation did not fail`);
  }
  const changedOutcome = structuredClone(goldenById.get(fixture.fixture_id));
  changedOutcome.run_outcome = "FAILED_SYSTEM";
  assert.throws(() => assertGolden(report, changedOutcome), "run_outcome mutation did not fail");
});

test("mixed incident replay preserves independent valid row and quarantines invalid row", () => {
  const report = runZeroWriteHarness(fullFixture(fixtureById.get("incident-mixed-row-isolation")));
  assert.equal(report.run_outcome, "PASS_WITH_REVIEW");
  assert.equal(report.rows.find((row) => row.source_record_id === "mixed-safe").change_classification, "NO_CHANGE");
  assert.equal(report.rows.find((row) => row.source_record_id === "mixed-invalid").change_classification, "REVIEW_REQUIRED");
});

test("guardrail remains business guardrail and real exception remains system failure", () => {
  for (const fixtureId of ["incident-balanced-price-guardrail", "incident-mass-stock-guardrail", "incident-stale-fingerprint-drift", "incident-post-apply-drift"]) {
    assert.equal(runZeroWriteHarness(fullFixture(fixtureById.get(fixtureId))).run_outcome, "BLOCKED_GUARDRAIL");
  }
  assert.equal(runZeroWriteHarness(fullFixture(fixtureById.get("incident-system-failure"))).run_outcome, "FAILED_SYSTEM");
});

test("SOURCE_MISSING remains distinct from OUT_OF_STOCK", () => {
  const report = runZeroWriteHarness(fullFixture(fixtureById.get("incident-source-missing-not-oos")));
  assert.equal(report.rows[0].source_state, "SOURCE_MISSING");
  assert.equal(report.rows[0].canonical_record.availability, "SOURCE_MISSING");
  assert.notEqual(report.rows[0].canonical_record.availability, "OUT_OF_STOCK");
});

test("zero-write boundary still rejects injected write and network capabilities", () => {
  const fixture = fullFixture(fixtureById.get("incident-verify-no-change"));
  const writeBoundary = createZeroWriteBoundary();
  assert.throws(() => runZeroWriteHarness(fixture, { boundary: writeBoundary, adapter: (_raw, { boundary }) => boundary.writer.write() }), (error) => error.code === "ZERO_WRITE_WRITE_ATTEMPT");
  assert.deepEqual(writeBoundary.metrics, { write_attempt_count: 1, network_attempt_count: 0 });
  const networkBoundary = createZeroWriteBoundary();
  assert.throws(() => runZeroWriteHarness(fixture, { boundary: networkBoundary, adapter: (_raw, { boundary }) => boundary.network.request() }), (error) => error.code === "ZERO_WRITE_NETWORK_ATTEMPT");
  assert.deepEqual(networkBoundary.metrics, { write_attempt_count: 0, network_attempt_count: 1 });
});

test("compatibility matrix is conflict-free and all canonical profiles use approved taxonomy", () => {
  assert.equal(validateMatrix(compatibilityMatrix), true);
  const counts = compatibilityMatrix.mappings.reduce((result, mapping) => ({ ...result, [mapping.compatibility_state]: (result[mapping.compatibility_state] || 0) + 1 }), {});
  assert.equal(compatibilityMatrix.mappings.length, 81);
  assert.deepEqual(counts, { EXACT: 29, CONTEXT_REQUIRED: 40, AMBIGUOUS_BLOCKED: 8, DEPRECATED_DUPLICATE: 1, HISTORICAL_ONLY: 3 });
  for (const mapping of compatibilityMatrix.mappings) {
    assert.ok(mapping.legacy_status && mapping.context_type && mapping.level && mapping.meaning);
    assert.ok(Array.isArray(mapping.emitter_paths) && mapping.emitter_paths.length > 0);
    assert.equal(mapping.historical_only, !mapping.active);
    if (mapping.active) {
      assert.ok(mapping.emitter_paths.every((emitterPath) => fs.existsSync(path.join(root, emitterPath))), `${mapping.mapping_id} emitter path is missing`);
      assert.ok(mapping.emitter_paths.some((emitterPath) => {
        const absolute = path.join(root, emitterPath);
        return fs.statSync(absolute).isDirectory() || fs.readFileSync(absolute, "utf8").includes(mapping.legacy_status);
      }), `${mapping.mapping_id} status is absent from its emitter`);
      assert.ok(mapping.emitter_paths.every((emitterPath) => !/\.test\.|^docs\//.test(emitterPath)), `${mapping.mapping_id} relies on test or documentation evidence`);
    }
  }
  for (const profile of Object.values(compatibilityMatrix.profiles)) {
    assert.ok(taxonomy.SOURCE_STATES.includes(profile.source_state));
    assert.ok(taxonomy.CHANGE_CLASSIFICATIONS.includes(profile.change_classification));
    assert.ok(taxonomy.EXECUTION_STATES.includes(profile.execution_state));
    assert.ok(taxonomy.RUN_OUTCOMES.includes(profile.run_outcome));
    assert.ok(taxonomy.ALERT_LEVELS.includes(profile.alert_level));
    assert.ok(taxonomy.NEXT_ACTIONS.includes(profile.next_action));
    assert.ok(taxonomy.BLOCKING_SCOPES.includes(profile.blocking_scope));
    taxonomy.getReason(profile.reason_code);
  }
});

test("compatibility adapter is deterministic and rejects unknown, incomplete and ambiguous input", () => {
  const exact = mapLegacyStatus("PASS_WITH_REVIEW", { context_type: "retailer_run" });
  assert.deepEqual(exact, mapLegacyStatus("PASS_WITH_REVIEW", { context_type: "retailer_run" }));
  assert.equal(exact.canonical.run_outcome, "PASS_WITH_REVIEW");
  assert.equal(Object.isFrozen(exact), true);
  assert.throws(() => mapLegacyStatus("DOES_NOT_EXIST", { context_type: "retailer_run" }), (error) => error.code === "LEGACY_STATUS_UNKNOWN");
  assert.throws(() => mapLegacyStatus("BLOCK", { context_type: "retailer_run" }), (error) => error.code === "LEGACY_STATUS_CONTEXT_REQUIRED");
  assert.equal(mapLegacyStatus("BLOCK", { context_type: "retailer_run", reason_family: "SOURCE" }).canonical.run_outcome, "BLOCKED_SOURCE");
  assert.throws(() => mapLegacyStatus("FAIL", { context_type: "retailer_run", error_class: "unknown", durable_outcome: "unknown" }), (error) => error.code === "LEGACY_STATUS_AMBIGUOUS");
});

test("all eight ambiguous mappings reject missing, partial, complete and conflicting context", () => {
  const ambiguous = compatibilityMatrix.mappings.filter((entry) => entry.compatibility_state === "AMBIGUOUS_BLOCKED");
  assert.deepEqual(ambiguous.map((entry) => entry.mapping_id), ["run-fail", "watchdog-fail", "child-failed", "parent-failed", "apply-failed", "review-failed", "request-failed", "workflow-failure"]);
  for (const mapping of ambiguous) {
    const context = { context_type: mapping.context_type };
    const complete = Object.fromEntries(mapping.required_context.map((field) => [field, `verified-${field}`]));
    const rejects = (input) => assert.throws(() => mapLegacyStatus(mapping.legacy_status, input), (error) => ["LEGACY_STATUS_CONTEXT_REQUIRED", "LEGACY_STATUS_AMBIGUOUS"].includes(error.code));
    rejects(context);
    rejects({ ...context, [mapping.required_context[0]]: complete[mapping.required_context[0]] });
    assert.throws(() => mapLegacyStatus(mapping.legacy_status, { ...context, ...complete }), (error) => error.code === "LEGACY_STATUS_AMBIGUOUS" && error.detail.evidence_needed === mapping.evidence_needed);
    assert.throws(() => mapLegacyStatus(mapping.legacy_status, { ...context, ...complete, durable_outcome: "CONTRADICTORY" }), (error) => error.code === "LEGACY_STATUS_AMBIGUOUS");
    assert.notEqual(compatibilityMatrix.profiles[mapping.profile].run_outcome, "FAILED_SYSTEM");
  }
});

function mappingExists(status, contextType) {
  return compatibilityMatrix.mappings.some((entry) => entry.legacy_status === status && entry.context_type === contextType);
}

function jsonPointer(object, pointer) {
  return pointer.split(".").reduce((value, key) => value?.[key], object);
}

function quotedStatuses(value) {
  return [...value.matchAll(/'([A-Z][A-Z0-9_]+)'/g)].map((match) => match[1]);
}

test("active legacy emitters cannot add an unclassified status", () => {
  const outputPattern = /\b(result|state|status|conclusion|outcome|review_status|validator_result|approver_result|executor_result|rollback_status|replay_status|classification_state)\s*[:=]\s*["']([A-Z][A-Z0-9_]+)["']/g;
  for (const scan of compatibilityMatrix.inventory_scans) {
    const sourcePath = path.join(root, scan.path);
    const source = fs.readFileSync(sourcePath, "utf8");
    if (scan.kind === "javascript-output-fields") {
      for (const match of source.matchAll(outputPattern)) {
        const contextType = scan.fields[match[1]];
        if (contextType) assert.ok(mappingExists(match[2], contextType), `${scan.path} emits unclassified ${match[1]}=${match[2]}`);
      }
    } else if (scan.kind === "json-enum") {
      const values = jsonPointer(JSON.parse(source), scan.pointer);
      assert.ok(Array.isArray(values));
      for (const status of values) assert.ok(mappingExists(status, scan.context_type), `${scan.path} enum has unclassified ${status}`);
    } else if (scan.path.includes("create_retailer_catalogue_control_ledger")) {
      const groups = [...source.matchAll(/status text not null default '[A-Z]+' check \(status in \(([^)]+)\)\)/g)].slice(0, 3).map((match) => quotedStatuses(match[1]));
      const contexts = ["parent_plan_state", "child_plan_state", "apply_run_state"];
      assert.equal(groups.length, contexts.length);
      groups.forEach((values, index) => values.forEach((status) => assert.ok(mappingExists(status, contexts[index]), `${scan.path} has unclassified ${contexts[index]}=${status}`)));
    } else if (scan.path.includes("extend_product_match_review_queue")) {
      const constraint = source.match(/review_status is null or review_status in \(\s*([\s\S]*?)\s*\)/);
      assert.ok(constraint);
      for (const status of quotedStatuses(constraint[1])) assert.ok(mappingExists(status, "review_state"), `${scan.path} has unclassified review_state=${status}`);
    } else if (scan.path.includes("create_automation_review_execution_requests")) {
      const constraint = source.match(/automation_review_execution_status_check check \(\s*status in \(([^)]+)\)/);
      assert.ok(constraint);
      for (const status of quotedStatuses(constraint[1])) assert.ok(mappingExists(status, "execution_request_state"), `${scan.path} has unclassified execution_request_state=${status}`);
    } else if (scan.kind === "declared-statuses") {
      for (const [contextType, values] of Object.entries(scan.contexts)) for (const status of values) {
        assert.ok(source.includes(`"${status}"`), `${scan.path} no longer emits ${status}`);
        assert.ok(mappingExists(status, contextType), `${scan.path} has unclassified ${contextType}=${status}`);
      }
    }
  }
});

test("compatibility adapter has no production wiring or side-effect capability", () => {
  const adapterPath = require.resolve("./lib/retailer-offer-sync/canonical-v1/legacy-compatibility-adapter");
  const source = fs.readFileSync(adapterPath, "utf8");
  assert.doesNotMatch(source, /\b(?:globalThis\.)?fetch\s*\(|\bprocess\.env\b|@supabase|\bpg\b|executor|approval contract/i);
  const productionRoots = ["app", ".github/workflows"];
  const references = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(relative);
      else if (/\.(?:js|ts|tsx|yml|yaml)$/.test(entry.name) && fs.readFileSync(path.join(root, relative), "utf8").includes("legacy-compatibility-adapter")) references.push(relative);
    }
  };
  productionRoots.forEach(visit);
  assert.deepEqual(references, []);
});
