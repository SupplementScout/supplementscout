const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const matrix = require("./test-fixtures/retailer-canonical-v1/scenario-matrix.json");
const { CANONICAL_RECORD_V1_SCHEMA } = require("./lib/retailer-offer-sync/canonical-v1/schema");
const { createCanonicalRecord, moneyValue, validateCanonicalRecord } = require("./lib/retailer-offer-sync/canonical-v1/contract");
const taxonomy = require("./lib/retailer-offer-sync/canonical-v1/taxonomy");
const harnessModule = require("./lib/retailer-offer-sync/canonical-v1/zero-write-harness");
const { createZeroWriteBoundary, runZeroWriteHarness } = harnessModule;

function fixture(scenario) {
  return {
    fixture_id: scenario.fixture_id,
    run_id: `run:${scenario.fixture_id}`,
    captured_at: matrix.base.captured_at,
    source: structuredClone(matrix.base.source),
    raw_records: scenario.raw_records.map((row) => ({ product_name: "Recorded product", brand: "Recorded brand", variant: "Recorded variant", source_url: `https://fixture.invalid/${row.source_record_id}`, ...row })),
    expected_state: structuredClone(scenario.expected_state),
    controls: structuredClone(scenario.controls || {}),
  };
}

test("canonical contract v1 uses exact minor-unit money and structured validation", () => {
  assert.deepEqual(moneyValue("19.99", "GBP"), { state: "PRESENT", amount_minor: "1999", currency: "GBP" });
  assert.deepEqual(moneyValue("19.9", "GBP"), { state: "PRESENT", amount_minor: "1990", currency: "GBP" });
  assert.equal(moneyValue(19.99, "GBP").state, "INVALID");
  const built = createCanonicalRecord(fixture(matrix.scenarios[0]).raw_records[0], { ...matrix.base.source, run_id: "fixed-run", captured_at: matrix.base.captured_at, source_fingerprint: "a".repeat(64) });
  assert.equal(validateCanonicalRecord(built).valid, true);
  const mutated = structuredClone(built); mutated.unexpected = true;
  const invalid = validateCanonicalRecord(mutated);
  assert.equal(invalid.valid, false); assert.equal(invalid.reason_codes[0], "CANONICAL_SOURCE_INVALID");
});

test("unknown, missing and absent-from-source states remain distinct", () => {
  const input = fixture(matrix.scenarios[0]);
  const raw = { ...input.raw_records[0], sku: null };
  delete raw.gtin;
  const record = createCanonicalRecord(raw, { ...matrix.base.source, run_id: "fixed-run", captured_at: matrix.base.captured_at, source_fingerprint: "b".repeat(64) });
  assert.deepEqual(record.sku, { state: "UNKNOWN", value: null });
  assert.deepEqual(record.gtin, { state: "MISSING", value: null });
  const absent = runZeroWriteHarness(fixture(matrix.scenarios.find((entry) => entry.fixture_id === "source-missing-not-oos"))).rows[0].canonical_record;
  assert.equal(absent.source_presence, "MISSING_FROM_SOURCE"); assert.equal(absent.availability, "SOURCE_MISSING");
});

test("canonical schema is retailer-neutral and does not fix a retailer identity", () => {
  assert.equal(CANONICAL_RECORD_V1_SCHEMA.properties.source.properties.retailer_ref.const, undefined);
  assert.equal(CANONICAL_RECORD_V1_SCHEMA.properties.source.properties.retailer_ref.enum, undefined);
  const root = path.join(__dirname, "lib", "retailer-offer-sync", "canonical-v1");
  for (const file of fs.readdirSync(root).filter((name) => name.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /config[\\/]retailers|10 Reps|Fit House|KIOR|eBay|GYM HIGH|Predators Gear/);
  }
});

test("canonical taxonomy v1 contains the six independent dimensions and complete reasons", () => {
  assert.equal(taxonomy.validateTaxonomy(), true);
  assert.deepEqual(taxonomy.RUN_OUTCOMES, ["PASS", "PASS_WITH_REVIEW", "SKIPPED_EQUIVALENT_ACTIVE", "NO_AUTHORIZED_SCOPE", "BLOCKED_SOURCE", "BLOCKED_GUARDRAIL", "FAILED_SYSTEM"]);
  assert.ok(taxonomy.SOURCE_STATES.length >= 5); assert.ok(taxonomy.CHANGE_CLASSIFICATIONS.length >= 5); assert.ok(taxonomy.EXECUTION_STATES.length >= 8);
  for (const reason of taxonomy.REASON_REGISTRY) assert.deepEqual(Object.keys(reason), ["code", "scope", "category", "terminal", "review_required", "blocking_scope", "alert_level", "next_action"]);
  assert.throws(() => taxonomy.getReason("RETAILER_SPECIFIC_FREE_TEXT"), (error) => error.code === "CANONICAL_REASON_UNKNOWN");
});

for (const scenario of matrix.scenarios) test(`zero-write replay: ${scenario.fixture_id}`, () => {
  const report = runZeroWriteHarness(fixture(scenario));
  for (const [key, expected] of Object.entries(scenario.expected)) assert.equal(report[key], expected, `${scenario.fixture_id}.${key}`);
  assert.equal(report.write_attempt_count, 0); assert.equal(report.network_attempt_count, 0);
  assert.equal(report.authorization.production_execution_allowed, false);
  assert.ok(report.rows.every((row) => row.execution_attempted === false && row.policy_authorized === false));
});

test("source missing is review evidence and never automatic out of stock", () => {
  const report = runZeroWriteHarness(fixture(matrix.scenarios.find((entry) => entry.fixture_id === "source-missing-not-oos")));
  assert.equal(report.rows[0].canonical_record.source_presence, "MISSING_FROM_SOURCE");
  assert.equal(report.rows[0].canonical_record.availability, "SOURCE_MISSING");
  assert.notEqual(report.rows[0].canonical_record.availability, "OUT_OF_STOCK");
  assert.equal(report.rows[0].change_classification, "REVIEW_REQUIRED");
});

test("mixed batch preserves per-row isolation and PASS_WITH_REVIEW", () => {
  const report = runZeroWriteHarness(fixture(matrix.scenarios.find((entry) => entry.fixture_id === "mixed-isolated")));
  assert.equal(report.rows.length, 2); assert.equal(report.safe_candidate_count, 1); assert.equal(report.invalid_record_count, 1);
  assert.equal(report.run_outcome, "PASS_WITH_REVIEW");
});

test("absence of approved policy never authorizes or attempts apply", () => {
  const report = runZeroWriteHarness(fixture(matrix.scenarios.find((entry) => entry.fixture_id === "normal-price-change-no-policy")));
  assert.equal(report.run_outcome, "NO_AUTHORIZED_SCOPE");
  assert.deepEqual(report.authorization, { policy_state: "NOT_APPROVED", manifest_approval_state: "NOT_PRESENT", production_execution_allowed: false });
  assert.equal(report.rows[0].change_classification, "SAFE_CANDIDATE"); assert.equal(report.rows[0].execution_state, "NOT_AUTHORIZED");
});

test("identical fixture and injected time produce an identical output fingerprint", () => {
  const input = fixture(matrix.scenarios.find((entry) => entry.fixture_id === "mixed-isolated"));
  const first = runZeroWriteHarness(input, { clock: () => matrix.base.captured_at });
  const second = runZeroWriteHarness(structuredClone(input), { clock: () => matrix.base.captured_at });
  assert.equal(first.output_fingerprint, second.output_fingerprint); assert.deepEqual(first, second);
});

test("real adapter exception maps to FAILED_SYSTEM without disguising it as review", () => {
  const input = fixture(matrix.scenarios[0]);
  const report = runZeroWriteHarness(input, { adapter: () => { throw new Error("synthetic parser failure"); } });
  assert.equal(report.run_outcome, "FAILED_SYSTEM"); assert.equal(report.review_count, 0);
  assert.equal(report.reason_counts.CANONICAL_SYSTEM_EXCEPTION, 1);
});

test("network and write attempts fail closed and are counted", () => {
  const input = fixture(matrix.scenarios[0]);
  const networkBoundary = createZeroWriteBoundary();
  assert.throws(() => runZeroWriteHarness(input, { boundary: networkBoundary, adapter: (_raw, { boundary }) => boundary.network.request() }), (error) => error.code === "ZERO_WRITE_NETWORK_ATTEMPT");
  assert.equal(networkBoundary.metrics.network_attempt_count, 1); assert.equal(networkBoundary.metrics.write_attempt_count, 0);
  const writeBoundary = createZeroWriteBoundary();
  assert.throws(() => runZeroWriteHarness(input, { boundary: writeBoundary, adapter: (_raw, { boundary }) => boundary.writer.write() }), (error) => error.code === "ZERO_WRITE_WRITE_ATTEMPT");
  assert.equal(writeBoundary.metrics.write_attempt_count, 1); assert.equal(writeBoundary.metrics.network_attempt_count, 0);
});

test("harness dependency graph excludes production executors, database clients and network modules", () => {
  const seen = new Set();
  const visit = (module) => { if (!module || seen.has(module.id)) return; seen.add(module.id); for (const child of module.children) visit(child); };
  visit(require.cache[require.resolve("./lib/retailer-offer-sync/canonical-v1/zero-write-harness")]);
  const joined = [...seen].join("\n");
  assert.doesNotMatch(joined, /import-products|executor|production-role-session|node:http|node:https|node:net|node:tls|@supabase|[\\/]pg[\\/]/);
});

test("legacy retailer-snapshot runtime validator remains compatible", () => {
  const { validateContract } = require("./lib/retailer-snapshot/schemas");
  const invalid = validateContract("RetailerBulkImportPolicyConfig", { schema_version: 1 }, { throwOnError: false });
  assert.equal(invalid.valid, false); assert.ok(invalid.errors.length > 0);
});
