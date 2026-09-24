const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const childProcess = require("node:child_process");
const {
  DIFFERENCE_CLASSES, PARITY_FIELDS, compareParityCollections, compareParityRows,
  compareParityReport, createDeniedCapabilities, replaySingleSnapshot: replayFromSource,
} = require("./test-support/ra004-single-snapshot-replay");
const { connectTenRepsCsv } = require("./test-support/ra004-10reps-canonical-connector");
const goldens = require("./test-fixtures/retailer-automation/ra004-10reps-goldens.json");

const root = path.resolve(__dirname, "..");
const fixturePath = path.join(__dirname, "test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv");
const fixtureBytes = createDeniedCapabilities({ fixturePath }).readOnce();
const state = require("./test-fixtures/retailer-automation/ra004-10reps-state.json");
const text = fixtureBytes.toString("utf8");
const clone = (value) => structuredClone(value);
function replaySingleSnapshot(bytes, replayState, options = {}) {
  const boundary = options.boundary || createDeniedCapabilities(bytes === fixtureBytes ? { fixturePath } : { sourceReader: () => Buffer.from(bytes) });
  return replayFromSource(replayState, { ...options, boundary });
}

test("RA-004 replays one exact 17-column 10 Reps snapshot through legacy and canonical paths", () => {
  const report = replaySingleSnapshot(fixtureBytes, state);
  assert.deepEqual(text.split(/\r?\n/, 1)[0].split(","), report.required_headers);
  assert.equal(report.required_headers.length, 17);
  assert.deepEqual(report.snapshot_contract, {
    contract_version: "RA004_SINGLE_SNAPSHOT_V1",
    retailer: { id: "14", name: "10 Reps", slug: "10-reps" },
    source_type: "CSV_PRODUCT_FEED", capture_id: "ra004-synthetic-fixture-001",
    capture_timestamp_utc: state.captured_at, content_type: "text/csv", byte_length: fixtureBytes.length,
    raw_bytes_sha256: report.raw_snapshot_sha256,
    issued_copy_sha256: { legacy: report.raw_snapshot_sha256, canonical: report.raw_snapshot_sha256 },
    source_read_count: 1,
    provenance: "scripts/test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv",
  });
  assert.equal(report.raw_snapshot_sha256, report.legacy_snapshot_sha256);
  assert.equal(report.raw_snapshot_sha256, report.canonical_snapshot_sha256);
  assert.equal(report.legacy.state, "DRY_RUN_READY_WITH_REVIEW");
  assert.equal(report.canonical.run_outcome, "PASS_WITH_REVIEW");
  assert.deepEqual(report.difference_classes, DIFFERENCE_CLASSES);
  assert.equal(compareParityReport(report).difference_class, "EXACT_PARITY");
  assert.equal(report.raw_snapshot_sha256, goldens.raw_lf_sha256);
  assert.equal(report.legacy.action_manifest_fingerprint, goldens.legacy_output_fingerprint);
  assert.equal(report.canonical.output_fingerprint, goldens.canonical_output_fingerprint);
  assert.equal(report.report_fingerprint, goldens.parity_report_fingerprint);
  assert.equal(report.difference_counts.EXACT_PARITY, 9);
  assert.equal(report.difference_counts.CANONICAL_DEFECT, 0);
  assert.equal(report.difference_counts.UNEXPLAINED_DIFFERENCE, 0);
  assert.equal(report.unclassified_record_count, 0);
  assert.deepEqual(report.capabilities, {
    source_read_attempt_count: 1, source_read_count: 1, refetch_attempt_count: 0, refetch_performed_count: 0,
    network_attempt_count: 0, network_performed_count: 0, http_attempt_count: 0, http_performed_count: 0,
    dns_attempt_count: 0, dns_performed_count: 0, database_attempt_count: 0, database_performed_count: 0,
    file_write_attempt_count: 0, file_write_performed_count: 0, control_plan_attempt_count: 0, control_plan_performed_count: 0,
    approval_attempt_count: 0, approval_performed_count: 0, apply_attempt_count: 0, apply_performed_count: 0,
    review_queue_publish_attempt_count: 0, review_queue_publish_performed_count: 0,
    workflow_dispatch_attempt_count: 0, workflow_dispatch_performed_count: 0,
    secret_loader_attempt_count: 0, secret_loader_performed_count: 0,
  });
  assert.deepEqual(report.authorization, { adapter: "READY_FOR_REVERIFICATION", ra004: "IN_PROGRESS", shadow: "NOT_AUTHORIZED", production_execution_allowed: false });
});

test("RA-004 covers no-change, price, stock, missing and mixed per-row isolation", () => {
  const report = replaySingleSnapshot(fixtureBytes, state);
  const classes = report.parity_rows.map((row) => row.legacy.change_classification);
  assert.ok(classes.includes("NO_CHANGE"));
  assert.ok(classes.includes("PRICE_CHANGE"));
  assert.ok(classes.includes("STOCK_CHANGE"));
  assert.ok(classes.includes("SOURCE_MISSING"));
  const missing = report.parity_rows.find((row) => row.key === "2009");
  assert.equal(missing.legacy.availability, "SOURCE_MISSING");
  assert.equal(missing.canonical.availability, "SOURCE_MISSING");
  assert.notEqual(missing.legacy.availability, "OUT_OF_STOCK");
  assert.equal(missing.legacy.execution_attempted, false);
  assert.equal(report.parity_rows.find((row) => row.key === "2002").legacy.change_classification, "PRICE_CHANGE");
});

test("RA-004 rejects malformed or unsafe snapshots before classification", () => {
  assert.throws(() => replaySingleSnapshot(Buffer.alloc(0), state), { code: "RA004_EMPTY_RESPONSE" });
  assert.throws(() => replaySingleSnapshot(Buffer.from("<html>challenge</html>"), state), { code: "RA004_HTML_RESPONSE" });
  assert.throws(() => replaySingleSnapshot(fixtureBytes, state, { contentType: "text/html" }), { code: "RA004_UNEXPECTED_CONTENT_TYPE" });
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.split(/\r?\n/)[0] + "\n"), state), /CSV feed is empty/);
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.replace("current_price,stock_status", "wrong_price,stock_status")), state), /CSV feed columns changed/);
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.replace(",21.49,instock,", ",free,instock,")), state), /invalid current price/);
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.replace(",12.00,outofstock,", ",12.00,unknown,")), state), /unknown stock status/);
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.replace("1001,2001,Alpha", ",2001,Alpha")), state), /invalid or duplicate source identity/);
  assert.throws(() => replaySingleSnapshot(Buffer.from(text.replace("1002,2002,Beta", "1002,2001,Beta")), state), /invalid or duplicate source identity/);
});

test("RA-004 state identity conflict fails closed before either result can be accepted", () => {
  const conflicted = clone(state);
  conflicted.targets.push({ ...conflicted.targets[0], offer_id: "99" });
  assert.throws(() => replaySingleSnapshot(fixtureBytes, conflicted), { code: "RA004_IDENTITY_CONFLICT" });
});

test("RA-004 parity comparator detects every contract-field mutation and row-set drift", () => {
  const original = replaySingleSnapshot(fixtureBytes, state).parity_rows[0];
  for (const field of PARITY_FIELDS) {
    const changed = clone(original.canonical);
    changed[field] = typeof changed[field] === "boolean" ? !changed[field] : `${changed[field]}-MUTATED`;
    const comparison = compareParityRows(original.legacy, changed, goldens.native_records[original.key]);
    assert.equal(comparison.difference_class, "UNEXPLAINED_DIFFERENCE", field);
    assert.ok(comparison.field_differences.some((difference) => difference === field || difference.endsWith(`.${field}`)), field);
  }
  const legacy = [original.legacy];
  assert.equal(compareParityCollections(legacy, [])[0].side, "LEGACY_ONLY");
  assert.equal(compareParityCollections([], [original.canonical])[0].side, "CANONICAL_ONLY");
  const missing = clone(original.canonical);
  delete missing.currency;
  assert.notEqual(compareParityRows(original.legacy, missing, goldens.native_records[original.key]).difference_class, "EXACT_PARITY");
  const extra = clone(original.canonical);
  extra.contract_probe = true;
  assert.notEqual(compareParityRows(original.legacy, extra, goldens.native_records[original.key]).difference_class, "EXACT_PARITY");
});

test("RA-004 replay is deterministic across repeats, key order and timezone", () => {
  const first = replaySingleSnapshot(fixtureBytes, state);
  const second = replaySingleSnapshot(Buffer.from(fixtureBytes), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(first, second);
  assert.equal(first.report_fingerprint, second.report_fingerprint);
  const reordered = { targets: state.targets.map((target) => Object.fromEntries(Object.entries(target).reverse())), captured_at: state.captured_at, schema_version: 1 };
  assert.equal(first.report_fingerprint, replaySingleSnapshot(fixtureBytes, reordered).report_fingerprint);
  const lf = Buffer.from(text.replace(/\r\n/g, "\n"));
  const crlf = Buffer.from(text.replace(/\r?\n/g, "\r\n"));
  const lfReport = replaySingleSnapshot(lf, state), crlfReport = replaySingleSnapshot(crlf, state);
  assert.equal(lfReport.raw_snapshot_sha256, goldens.raw_lf_sha256);
  assert.equal(crlfReport.raw_snapshot_sha256, goldens.raw_crlf_sha256);
  assert.notEqual(lfReport.raw_snapshot_sha256, crlfReport.raw_snapshot_sha256);
  assert.deepEqual(lfReport.parity_rows.map((row) => row.legacy.change_classification), crlfReport.parity_rows.map((row) => row.legacy.change_classification));
  const priorTimezone = process.env.TZ;
  try {
    process.env.TZ = "Pacific/Auckland";
    assert.equal(first.report_fingerprint, replaySingleSnapshot(fixtureBytes, state).report_fingerprint);
  } finally {
    if (priorTimezone === undefined) delete process.env.TZ; else process.env.TZ = priorTimezone;
  }
});

test("RA-004 denied capabilities throw before effects and increment only their counters", () => {
  const cases = [
    ["network", "network_attempt_count"], ["http", "http_attempt_count"], ["dns", "dns_attempt_count"],
    ["database", "database_attempt_count"], ["write", "file_write_attempt_count"],
    ["controlPlan", "control_plan_attempt_count"], ["approval", "approval_attempt_count"], ["apply", "apply_attempt_count"],
    ["reviewQueuePublish", "review_queue_publish_attempt_count"], ["workflowDispatch", "workflow_dispatch_attempt_count"],
    ["secretLoader", "secret_loader_attempt_count"], ["refetch", "refetch_attempt_count"],
    ["fetch", "network_attempt_count"], ["fileWrite", "file_write_attempt_count"],
  ];
  for (const [method, counter] of cases) {
    const boundary = createDeniedCapabilities();
    assert.throws(() => boundary[method](), /denied/);
    assert.equal(boundary.metrics[counter], 1);
    assert.equal(Object.values(boundary.metrics).reduce((sum, value) => sum + value, 0), 1);
  }
  const secondRead = createDeniedCapabilities({ fixturePath });
  secondRead.readOnce();
  assert.throws(() => secondRead.readOnce(), { code: "RA004_SOURCE_READ_COUNT" });
  assert.equal(secondRead.metrics.source_read_attempt_count, 2);
  assert.equal(secondRead.metrics.source_read_count, 1);
});

test("RA-004 adapter dependency closure is test-only and excludes side-effect modules", () => {
  const entry = path.join(__dirname, "test-support/ra004-single-snapshot-replay.js");
  const visited = new Set();
  const forbiddenModules = new Set(["http", "https", "net", "tls", "dns", "undici", "pg", "@supabase/supabase-js", "node:http", "node:https", "node:net", "node:tls", "node:dns"]);
  const visit = (file) => {
    const normalized = path.normalize(file);
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = fs.readFileSync(normalized, "utf8");
    assert.doesNotMatch(source, /globalThis\.fetch\s*\(|TEN_REPS_FEED_URL|fs\.(?:writeFile|appendFile|createWriteStream)/);
    for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) assert.equal(forbiddenModules.has(match[1]), false, `${normalized}: ${match[1]}`);
    for (const match of source.matchAll(/require\(["'](\.{1,2}\/[^"']+)["']\)/g)) {
      const resolved = require.resolve(path.resolve(path.dirname(normalized), match[1]));
      if (resolved.endsWith(".js")) visit(resolved);
    }
  };
  visit(entry);
  const relative = [...visited].map((file) => path.relative(root, file).replaceAll("\\", "/")).sort();
  assert.ok(relative.includes("scripts/lib/csv-product-feed-projector.js"));
  assert.ok(relative.includes("scripts/test-support/ra004-10reps-canonical-connector.js"));
  for (const forbidden of ["csv-product-feed-reader", "fit-house-offer-refresh.js", "supabase", "postgres", "executor", "approver", "review-publisher", ".github/workflows"]) {
    assert.equal(relative.some((file) => file.toLowerCase().includes(forbidden)), false, `${forbidden}: ${relative.join(", ")}`);
  }
  const runtimeModules = Object.keys(require.cache).map((file) => path.relative(root, file).replaceAll("\\", "/").toLowerCase());
  for (const forbidden of ["csv-product-feed-reader", "fit-house-offer-refresh.js", "@supabase", "node_modules/pg/", "executor", "approver", "review-publisher"]) {
    assert.equal(runtimeModules.some((file) => file.includes(forbidden)), false, `runtime ${forbidden}`);
  }
  const productionReferences = fs.readFileSync(path.join(root, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.doesNotMatch(productionReferences, /ra004-single-snapshot-replay|test-support/);
  const connectorReferences = fs.readdirSync(path.join(__dirname, "test-support")).filter((name) => name.endsWith(".js") && fs.readFileSync(path.join(__dirname, "test-support", name), "utf8").includes("ra004-10reps-canonical-connector"));
  assert.deepEqual(connectorReferences, ["ra004-single-snapshot-replay.js"]);
});

test("RA-004 canonical connector independently parses the frozen 10 Reps contract", () => {
  const connectorPath = path.join(__dirname, "test-support/ra004-10reps-canonical-connector.js");
  const connectorSource = fs.readFileSync(connectorPath, "utf8");
  assert.doesNotMatch(connectorSource, /projectCsvRows|csv-product-feed-projector|classifyExistingOffers|legacyProjected|legacyNormalized|legacy-compatibility/);
  assert.doesNotMatch(connectorSource, /TEN_REPS_FEED_URL|process\.env|globalThis\.fetch|require\(["'](?:node:)?(?:http|https|net|tls|dns)["']\)|undici|supabase|postgres|workflowDispatch|secretLoader/i);
  const connected = connectTenRepsCsv(Buffer.from(fixtureBytes), { storeUrl: "https://www.10reps.co.uk", capturedAt: state.captured_at });
  assert.equal(connected.requiredColumns.length, 17);
  assert.equal(connected.rawRecords.length, 8);
  assert.equal(connected.evidenceRows[0].price_minor, "1999");
  assert.equal(connected.rawRecords[0].availability, "IN_STOCK");
  assert.equal(connected.rawRecords[0].currency, "GBP");
});

test("RA-004 regression: canonical path splits before the legacy retailer projector", () => {
  const source = fs.readFileSync(path.join(__dirname, "test-support/ra004-single-snapshot-replay.js"), "utf8");
  assert.equal([...source.matchAll(/projectCsvRows\(/g)].length, 1, "only the legacy branch may call projectCsvRows");
  assert.doesNotMatch(source, /canonicalProjected|legacyProjected\.evidenceRows\.map\(canonicalRaw\)/);
});

test("RA-004 regression: tracked CSV fixtures are checkout-stable LF", () => {
  const attributes = childProcess.execFileSync("git", ["check-attr", "text", "eol", "--", "scripts/test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv"], { cwd: root, encoding: "utf8" });
  assert.match(attributes, /text: set/);
  assert.match(attributes, /eol: lf/);
  assert.doesNotMatch(fixtureBytes.toString("utf8"), /\r\n/);
});

test("RA-004 regression: native and run-level contract mutations cannot remain exact", () => {
  const report = replaySingleSnapshot(fixtureBytes, state);
  for (const field of ["native_reason_codes", "native_record_fingerprint"]) {
    const changed = clone(report.parity_rows[0].canonical);
    changed[field] = field === "native_reason_codes" ? ["MUTATED"] : "mutated";
    assert.notEqual(compareParityRows(report.parity_rows[0].legacy, changed, goldens.native_records[report.parity_rows[0].key]).difference_class, "EXACT_PARITY", field);
  }
  assert.ok(PARITY_FIELDS.includes("native_reason_codes"));
  assert.ok(PARITY_FIELDS.includes("native_record_fingerprint"));
  const changedOutcome = clone(report);
  changedOutcome.canonical.run_outcome = "FAILED_SYSTEM";
  assert.notEqual(compareParityReport(changedOutcome).difference_class, "EXACT_PARITY");
  const changedCounter = clone(report);
  changedCounter.capabilities.http_attempt_count = 99;
  assert.notEqual(compareParityReport(changedCounter).difference_class, "EXACT_PARITY");
  const missingField = clone(report);
  delete missingField.canonical.output_fingerprint;
  assert.notEqual(compareParityReport(missingField).difference_class, "EXACT_PARITY");
  const extraField = clone(report);
  extraField.contract_probe = true;
  assert.notEqual(compareParityReport(extraField).difference_class, "EXACT_PARITY");
  const missingRecord = clone(report);
  missingRecord.parity_rows.pop();
  assert.notEqual(compareParityReport(missingRecord).difference_class, "EXACT_PARITY");
  const extraRecord = clone(report);
  extraRecord.parity_rows.push({ ...clone(extraRecord.parity_rows[0]), key: "9999" });
  assert.notEqual(compareParityReport(extraRecord).difference_class, "EXACT_PARITY");
});

test("RA-004 detects mutation of either defensive byte copy", () => {
  assert.throws(() => replaySingleSnapshot(fixtureBytes, state, {
    canonicalConnector(bytes, context) {
      const connected = connectTenRepsCsv(bytes, context);
      bytes[bytes.length - 1] = bytes[bytes.length - 1] === 10 ? 32 : 10;
      return connected;
    },
  }), { code: "RA004_FINGERPRINT_CHANGED_DURING_RUN" });
});

test("RA-004 regression: source read and every denied side effect are explicit capabilities", () => {
  const boundary = createDeniedCapabilities();
  for (const method of ["readOnce", "http", "dns", "workflowDispatch", "secretLoader"]) {
    assert.equal(typeof boundary[method], "function", method);
  }
  for (const counter of ["http_attempt_count", "dns_attempt_count", "workflow_dispatch_attempt_count", "secret_loader_attempt_count"]) {
    assert.equal(boundary.metrics[counter], 0, counter);
  }
});
