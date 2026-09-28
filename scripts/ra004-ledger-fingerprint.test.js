const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  CONTRACT_VERSION,
  canonicalLedger,
  ledgerDocument,
  ledgerFingerprint,
  normalizeRows,
} = require("./lib/ra004-ledger-fingerprint-v1");
const {
  migrationLedgerDocument,
  migrationLedgerFingerprint,
} = require("./lib/retailer-snapshot/staging-execution-contract");
const selector = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(__dirname, "test-fixtures", "ra004-ledger-fingerprint-v1", "staging-ledger-97.json");
const GOLDEN_PATH = path.join(__dirname, "test-fixtures", "ra004-ledger-fingerprint-v1", "golden-vectors.json");
const EXPECTED = "bbfc25a25826ebfd4901941099903921e1f5adeb9d952eb6aa93c64939e3849c";
const EXPECTED_CURRENT = "b4e72276ba2570d2da9957c53b6c209a3799087570302af92b295467a1d4e307";
const EXPECTED_PRODUCTION = "bddbdda9e913bdf262287c387e75e6aef3b5e1f78b4eb3c8648747ef881e1d3d";
const LEGACY_SELECTOR_FINGERPRINT = "1692043d963e98570cd69ea2f46654c35f35a78f26c35b3d96e04751d528331c";

function fixtureFromText(text) { return JSON.parse(text); }
function fixture() { return fixtureFromText(fs.readFileSync(FIXTURE_PATH, "utf8")); }

function repositoryLedger() {
  const contract = selector.CONTRACTS.STAGING;
  const excluded = new Set(Object.keys(contract.excluded));
  for (const filename of contract.appliedExcluded) excluded.delete(filename);
  const pending = new Set(contract.pending.map(({ filename }) => filename));
  return fs.readdirSync(path.join(ROOT, "supabase", "migrations"))
    .filter((filename) => /^\d{14}_[a-z0-9_]+\.sql$/.test(filename)
      && !excluded.has(filename) && !pending.has(filename))
    .sort()
    .map((filename) => {
      const identifier = filename.slice(0, -4);
      const split = identifier.indexOf("_");
      return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
    });
}

function productionRepositoryLedger() {
  const contract = selector.CONTRACTS.PRODUCTION;
  const excluded = new Set(Object.keys(contract.excluded));
  const pending = new Set(contract.pending.map(({ filename }) => filename));
  return fs.readdirSync(path.join(ROOT, "supabase", "migrations"))
    .filter((filename) => /^\d{14}_[a-z0-9_]+\.sql$/.test(filename)
      && !excluded.has(filename) && !pending.has(filename))
    .sort()
    .map((filename) => ({ version: filename.slice(0, 14), name: filename.slice(15, -4) }));
}

test("the neutral fixture preserves ledger 97 and the repository reconstructs current ledger 98", () => {
  const value = fixture();
  assert.equal(value.contract_version, CONTRACT_VERSION);
  assert.equal(value.expected_count, 97);
  assert.equal(value.expected_fingerprint, EXPECTED);
  const current = repositoryLedger();
  assert.equal(current.length, 98);
  assert.deepEqual(current.slice(0, 97), value.rows);
  assert.deepEqual(current[97], {
    version: "20260928100000",
    name: "diagnose_ra004_preflight_acl_rls",
  });
  assert.equal(ledgerFingerprint(value.rows, { targetEnvironment: "STAGING" }), EXPECTED);
  assert.equal(ledgerFingerprint(current, { targetEnvironment: "STAGING" }), EXPECTED_CURRENT);
  assert.equal(selector.CONTRACTS.STAGING.ledgerFingerprint, EXPECTED_CURRENT);
  assert.equal(selector.ledgerRowsFingerprint(value.rows, { targetEnvironment: "STAGING" }), EXPECTED);
});

test("every public fingerprint entry point requires an explicit target environment", () => {
  const rows = fixture().rows;
  const identifiers = rows.map(({ version, name }) => `${version}_${name}`);
  for (const operation of [
    () => ledgerDocument(rows),
    () => canonicalLedger(rows),
    () => ledgerFingerprint(rows),
    () => selector.ledgerRowsFingerprint(rows),
    () => migrationLedgerDocument(identifiers),
    () => migrationLedgerFingerprint(identifiers),
  ]) assert.throws(operation, /targetEnvironment is required/);
  assert.throws(
    () => ledgerFingerprint(rows, { targetEnvironment: "UNKNOWN" }),
    /unsupported target environment UNKNOWN/,
  );
});

test("the exact production ledger requires the explicit PRODUCTION domain", () => {
  const rows = productionRepositoryLedger();
  assert.equal(rows.length, 221);
  assert.equal(ledgerFingerprint(rows, { targetEnvironment: "PRODUCTION" }), EXPECTED_PRODUCTION);
  assert.notEqual(
    ledgerFingerprint(rows, { targetEnvironment: "STAGING" }),
    EXPECTED_PRODUCTION,
  );
});

test("every runtime fingerprint caller binds its own target environment", () => {
  const sources = Object.fromEntries([
    "apply-selected-migrations.js",
    "verify-selected-migrations.js",
    "ra004-staging-execution-coordinator.js",
    "ra004-staging-schema-inventory.js",
    "gtin-promotion-release.js",
    "supabase-migration-selector.js",
    path.join("lib", "environment-migrations.js"),
    path.join("lib", "retailer-snapshot", "staging-execution-contract.js"),
  ].map((relative) => [relative, fs.readFileSync(path.join(__dirname, relative), "utf8")]));

  assert.match(sources["apply-selected-migrations.js"], /ledgerRowsFingerprint\(afterCommitState\.remoteLedger,\s*\{\s*targetEnvironment: options\.environment/);
  assert.match(sources["verify-selected-migrations.js"], /ledgerRowsFingerprint\(state\.remoteLedger,\s*\{\s*targetEnvironment: options\.environment/);
  assert.equal((sources["ra004-staging-execution-coordinator.js"].match(/targetEnvironment:\s*"STAGING"/g) || []).length, 4);
  assert.match(sources["ra004-staging-schema-inventory.js"], /ledgerRowsFingerprint\(ledger, \{ targetEnvironment: "STAGING" \}\)/);
  assert.equal((sources["gtin-promotion-release.js"].match(/ledgerRowsFingerprint\(/g) || []).length, 1);
  assert.match(sources["gtin-promotion-release.js"], /ledgerRowsFingerprint\(remoteLedger, \{ targetEnvironment: "PRODUCTION" \}\)/);
  assert.match(sources["gtin-promotion-release.js"], /classifyProductionMigrationLedger\(state\.remoteLedger\)/);
  assert.match(sources["supabase-migration-selector.js"], /targetEnvironment: contract\.environment/);
  assert.doesNotMatch(sources["supabase-migration-selector.js"], /targetEnvironment:\s*options\.targetEnvironment\s*\?\?/);
  assert.match(sources[path.join("lib", "environment-migrations.js")], /migrationLedgerFingerprint\(versions, environment\)/);
  assert.match(sources[path.join("lib", "retailer-snapshot", "staging-execution-contract.js")], /canonicalLedgerFingerprint\(rowsFromIdentifiers\(identifiers\), \{ targetEnvironment \}\)/);
});

test("golden vectors bind canonical bytes and lowercase SHA-256", () => {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));
  assert.equal(golden.contract_version, CONTRACT_VERSION);
  for (const vector of golden.vectors) {
    assert.equal(canonicalLedger(vector.rows, { targetEnvironment: vector.target_environment }), vector.canonical_input);
    assert.equal(ledgerFingerprint(vector.rows, { targetEnvironment: vector.target_environment }), vector.fingerprint);
    assert.match(vector.fingerprint, /^[0-9a-f]{64}$/);
  }
});

test("the diagnosed legacy selector hash is not the canonical contract hash", () => {
  const rows = fixture().rows;
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex"), LEGACY_SELECTOR_FINGERPRINT);
  assert.notEqual(LEGACY_SELECTOR_FINGERPRINT, ledgerFingerprint(rows, { targetEnvironment: "STAGING" }));
});

test("input order, JSON key order, metadata, LF, CRLF and timezone fields are irrelevant", () => {
  const source = fs.readFileSync(FIXTURE_PATH, "utf8");
  const rows = fixtureFromText(source).rows;
  const reversed = [...rows].reverse().map(({ version, name }) => ({
    statements: ["ignored"], observed_at: "2026-09-28T08:00:00+01:00", name, version,
  }));
  assert.equal(ledgerFingerprint(reversed, { targetEnvironment: "STAGING" }), EXPECTED);
  assert.equal(ledgerFingerprint(fixtureFromText(source.replaceAll("\n", "\r\n")).rows, { targetEnvironment: "STAGING" }), EXPECTED);
});

test("every projected field mutation and same-count content drift changes the fingerprint", () => {
  const rows = fixture().rows;
  for (const [index, key, value] of [
    [0, "version", "20260712211121"],
    [0, "name", "baseline_current_public_schema_changed"],
    [rows.length - 1, "name", "consolidate_ra004_supabase_ownership_interface"],
  ]) {
    const changed = structuredClone(rows);
    changed[index][key] = value;
    assert.notEqual(ledgerFingerprint(changed, { targetEnvironment: "STAGING" }), EXPECTED);
  }
  const sameCount = rows.slice(1).concat({ version: "20260928120000", name: "replacement" });
  assert.equal(sameCount.length, rows.length);
  assert.notEqual(ledgerFingerprint(sameCount, { targetEnvironment: "STAGING" }), EXPECTED);
});

test("missing, duplicate, invalid and unknown-version ledgers fail closed", () => {
  const rows = fixture().rows;
  assert.notEqual(ledgerFingerprint(rows.slice(0, -1), { targetEnvironment: "STAGING" }), EXPECTED);
  assert.throws(() => ledgerFingerprint([...rows, { ...rows[0] }], { targetEnvironment: "STAGING" }), /duplicate migration version/);
  assert.throws(() => ledgerFingerprint([{ version: rows[0].version, name: `${rows[0].name}.sql` }], { targetEnvironment: "STAGING" }), /name is invalid/);
  assert.throws(() => ledgerFingerprint(rows, { contractVersion: "RA004_LEDGER_V2", targetEnvironment: "STAGING" }), /unknown contract version/);
  assert.throws(() => normalizeRows([{ version: null, name: "bad" }]), /version is invalid/);
});

test("canonical ordinals express logical sorted order, not arrival order", () => {
  const rows = fixture().rows;
  const document = ledgerDocument([...rows].reverse(), { targetEnvironment: "STAGING" });
  assert.equal(document.migrations[0].ordinal, 1);
  assert.equal(document.migrations[0].identifier, `${rows[0].version}_${rows[0].name}`);
  assert.equal(document.migrations.at(-1).ordinal, 97);
  assert.equal(document.migrations.at(-1).identifier, `${rows.at(-1).version}_${rows.at(-1).name}`);
});
