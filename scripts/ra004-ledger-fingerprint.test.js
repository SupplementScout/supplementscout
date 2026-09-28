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
const selector = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(__dirname, "test-fixtures", "ra004-ledger-fingerprint-v1", "staging-ledger-97.json");
const GOLDEN_PATH = path.join(__dirname, "test-fixtures", "ra004-ledger-fingerprint-v1", "golden-vectors.json");
const EXPECTED = "bbfc25a25826ebfd4901941099903921e1f5adeb9d952eb6aa93c64939e3849c";
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

test("the neutral fixture reconstructs the exact terminal 97-row staging ledger", () => {
  const value = fixture();
  assert.equal(value.contract_version, CONTRACT_VERSION);
  assert.equal(value.expected_count, 97);
  assert.equal(value.expected_fingerprint, EXPECTED);
  assert.deepEqual(value.rows, repositoryLedger());
  assert.equal(ledgerFingerprint(value.rows), EXPECTED);
  assert.equal(selector.CONTRACTS.STAGING.ledgerFingerprint, EXPECTED);
  assert.equal(selector.ledgerRowsFingerprint(value.rows), EXPECTED);
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
  assert.notEqual(LEGACY_SELECTOR_FINGERPRINT, ledgerFingerprint(rows));
});

test("input order, JSON key order, metadata, LF, CRLF and timezone fields are irrelevant", () => {
  const source = fs.readFileSync(FIXTURE_PATH, "utf8");
  const rows = fixtureFromText(source).rows;
  const reversed = [...rows].reverse().map(({ version, name }) => ({
    statements: ["ignored"], observed_at: "2026-09-28T08:00:00+01:00", name, version,
  }));
  assert.equal(ledgerFingerprint(reversed), EXPECTED);
  assert.equal(ledgerFingerprint(fixtureFromText(source.replaceAll("\n", "\r\n")).rows), EXPECTED);
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
    assert.notEqual(ledgerFingerprint(changed), EXPECTED);
  }
  const sameCount = rows.slice(1).concat({ version: "20260928120000", name: "replacement" });
  assert.equal(sameCount.length, rows.length);
  assert.notEqual(ledgerFingerprint(sameCount), EXPECTED);
});

test("missing, duplicate, invalid and unknown-version ledgers fail closed", () => {
  const rows = fixture().rows;
  assert.notEqual(ledgerFingerprint(rows.slice(0, -1)), EXPECTED);
  assert.throws(() => ledgerFingerprint([...rows, { ...rows[0] }]), /duplicate migration version/);
  assert.throws(() => ledgerFingerprint([{ version: rows[0].version, name: `${rows[0].name}.sql` }]), /name is invalid/);
  assert.throws(() => ledgerFingerprint(rows, { contractVersion: "RA004_LEDGER_V2" }), /unknown contract version/);
  assert.throws(() => normalizeRows([{ version: null, name: "bad" }]), /version is invalid/);
});

test("canonical ordinals express logical sorted order, not arrival order", () => {
  const rows = fixture().rows;
  const document = ledgerDocument([...rows].reverse());
  assert.equal(document.migrations[0].ordinal, 1);
  assert.equal(document.migrations[0].identifier, `${rows[0].version}_${rows[0].name}`);
  assert.equal(document.migrations.at(-1).ordinal, 97);
  assert.equal(document.migrations.at(-1).identifier, `${rows.at(-1).version}_${rows.at(-1).name}`);
});
