const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  DIFFERENCE_CLASSES, PARITY_FIELDS, compareParityCollections, compareParityRows,
  createDeniedCapabilities, replaySingleSnapshot,
} = require("./test-support/ra004-single-snapshot-replay");

const root = path.resolve(__dirname, "..");
const fixturePath = path.join(__dirname, "test-fixtures/retailer-automation/ra004-10reps-single-snapshot.csv");
const fixtureBytes = fs.readFileSync(fixturePath);
const state = require("./test-fixtures/retailer-automation/ra004-10reps-state.json");
const text = fixtureBytes.toString("utf8");
const clone = (value) => structuredClone(value);

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
  assert.equal(report.difference_counts.EXACT_PARITY, 9);
  assert.equal(report.difference_counts.CANONICAL_DEFECT, 0);
  assert.equal(report.difference_counts.UNEXPLAINED_DIFFERENCE, 0);
  assert.equal(report.unclassified_record_count, 0);
  assert.deepEqual(report.capabilities, {
    source_read_count: 1, refetch_count: 0, network_attempt_count: 0, database_attempt_count: 0,
    write_attempt_count: 0, control_plan_attempt_count: 0, approval_attempt_count: 0,
    apply_attempt_count: 0, review_queue_publish_attempt_count: 0,
  });
  assert.deepEqual(report.authorization, { adapter: "READY_FOR_VERIFICATION", ra004: "IN_PROGRESS", shadow: "NOT_AUTHORIZED", production_execution_allowed: false });
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
    const comparison = compareParityRows(original.legacy, changed);
    assert.equal(comparison.difference_class, "UNEXPLAINED_DIFFERENCE", field);
    assert.ok(comparison.field_differences.includes(field), field);
  }
  const legacy = [original.legacy];
  assert.equal(compareParityCollections(legacy, [])[0].side, "LEGACY_ONLY");
  assert.equal(compareParityCollections([], [original.canonical])[0].side, "CANONICAL_ONLY");
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
    ["network", "network_attempt_count"], ["database", "database_attempt_count"], ["write", "write_attempt_count"],
    ["controlPlan", "control_plan_attempt_count"], ["approval", "approval_attempt_count"], ["apply", "apply_attempt_count"],
    ["reviewQueuePublish", "review_queue_publish_attempt_count"], ["refetch", "refetch_count"],
    ["fetch", "network_attempt_count"], ["fileWrite", "write_attempt_count"],
  ];
  for (const [method, counter] of cases) {
    const boundary = createDeniedCapabilities();
    assert.throws(() => boundary[method](), /denied/);
    assert.equal(boundary.metrics[counter], 1);
    assert.equal(Object.values(boundary.metrics).reduce((sum, value) => sum + value, 0), 1);
  }
  const secondRead = createDeniedCapabilities();
  secondRead.metrics.source_read_count = 1;
  assert.throws(() => replaySingleSnapshot(fixtureBytes, state, { boundary: secondRead }), { code: "RA004_SOURCE_READ_COUNT" });
  assert.equal(secondRead.metrics.source_read_count, 2);
});

test("RA-004 adapter dependency closure is test-only and excludes side-effect modules", () => {
  const entry = path.join(__dirname, "test-support/ra004-single-snapshot-replay.js");
  const visited = new Set();
  const visit = (file) => {
    const normalized = path.normalize(file);
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = fs.readFileSync(normalized, "utf8");
    for (const match of source.matchAll(/require\(["'](\.{1,2}\/[^"']+)["']\)/g)) {
      const resolved = require.resolve(path.resolve(path.dirname(normalized), match[1]));
      if (resolved.endsWith(".js")) visit(resolved);
    }
  };
  visit(entry);
  const relative = [...visited].map((file) => path.relative(root, file).replaceAll("\\", "/")).sort();
  assert.ok(relative.includes("scripts/lib/csv-product-feed-projector.js"));
  for (const forbidden of ["csv-product-feed-reader", "fit-house-offer-refresh.js", "supabase", "postgres", "executor", "approver", "review-publisher", ".github/workflows"]) {
    assert.equal(relative.some((file) => file.toLowerCase().includes(forbidden)), false, `${forbidden}: ${relative.join(", ")}`);
  }
  const runtimeModules = Object.keys(require.cache).map((file) => path.relative(root, file).replaceAll("\\", "/").toLowerCase());
  for (const forbidden of ["csv-product-feed-reader", "fit-house-offer-refresh.js", "@supabase", "node_modules/pg/", "executor", "approver", "review-publisher"]) {
    assert.equal(runtimeModules.some((file) => file.includes(forbidden)), false, `runtime ${forbidden}`);
  }
  const productionReferences = fs.readFileSync(path.join(root, ".github/workflows/fit-house-offer-refresh.yml"), "utf8");
  assert.doesNotMatch(productionReferences, /ra004-single-snapshot-replay|test-support/);
});
