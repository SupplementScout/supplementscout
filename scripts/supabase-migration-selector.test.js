const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CONTRACTS,
  ledgerRowsFingerprint,
  materializeSelectedWorkdir,
  sha256File,
  validateSelection,
} = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "supabase", "migrations");
const CONFIG = path.join(ROOT, "supabase", "config.toml");
const CONTRACT = CONTRACTS.STAGING;
const TARGET = Object.freeze({
  target_environment: "STAGING",
  project_ref: CONTRACT.projectRef,
  database_identity: CONTRACT.databaseIdentity,
});
const temporaryRoots = [];

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-migration-selector-"));
  temporaryRoots.push(root);
  return root;
}

function sourceCopy() {
  const root = temporaryRoot();
  const source = path.join(root, "migrations");
  fs.cpSync(SOURCE, source, { recursive: true });
  return source;
}

function currentRemoteLedger(sourceDir = SOURCE) {
  const excluded = new Set(Object.keys(CONTRACT.excluded));
  return fs.readdirSync(sourceDir)
    .filter((filename) =>
      /^\d{14}_[a-z0-9_]+\.sql$/.test(filename) &&
      !excluded.has(filename) &&
      filename !== CONTRACT.pending.filename)
    .sort()
    .map((filename) => {
      const identifier = filename.slice(0, -4);
      const split = identifier.indexOf("_");
      return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
    });
}

function validInput(overrides = {}) {
  return {
    environment: "STAGING",
    projectRef: CONTRACT.projectRef,
    databaseTarget: TARGET,
    remoteLedger: currentRemoteLedger(),
    sourceDir: SOURCE,
    ...overrides,
  };
}

test.after(() => {
  for (const root of temporaryRoots) {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir())));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test("staging happy path binds the exact ledger and one pending migration", () => {
  const result = validateSelection(validInput());
  assert.equal(result.ledger_count, 57);
  assert.equal(result.ledger_fingerprint, CONTRACT.ledgerFingerprint);
  assert.deepEqual(result.pending, ["20260726120000_add_scoped_reviewed_mixed_change_fingerprints"]);
  assert.equal(result.selected_files.length, 58);
});

test("the local-only migration is the exact shared-policy exclusion", () => {
  const result = validateSelection(validInput());
  assert.ok(result.excluded_files.includes("20260717130000_add_local_retailer_catalogue_child_executor.sql"));
  assert.ok(!result.selected_files.includes("20260717130000_add_local_retailer_catalogue_child_executor.sql"));
});

test("the production-only migration is the exact shared-policy exclusion", () => {
  const result = validateSelection(validInput());
  assert.ok(result.excluded_files.includes("20260719100000_add_production_retailer_sync_enablement.sql"));
  assert.ok(!result.selected_files.includes("20260719100000_add_production_retailer_sync_enablement.sql"));
});

test("unknown selector environments fail closed", () => {
  assert.throws(() => validateSelection(validInput({ environment: "UNKNOWN" })), /unsupported selector environment/);
});

test("a different explicit project ref fails closed", () => {
  assert.throws(() => validateSelection(validInput({ projectRef: "wrongprojectref000000" })), /project ref mismatch/);
});

test("a different database target fails closed", () => {
  assert.throws(
    () => validateSelection(validInput({ databaseTarget: { ...TARGET, project_ref: "wrongprojectref000000" } })),
    /database target project ref mismatch/,
  );
});

test("a wrong ledger count fails closed", () => {
  const ledger = currentRemoteLedger();
  ledger.push({ ...ledger[0] });
  assert.throws(() => validateSelection(validInput({ remoteLedger: ledger })), /ledger count mismatch/);
});

test("a wrong ledger fingerprint fails closed", () => {
  const ledger = currentRemoteLedger();
  [ledger[0], ledger[1]] = [ledger[1], ledger[0]];
  assert.throws(() => validateSelection(validInput({ remoteLedger: ledger })), /fingerprint mismatch/);
});

test("a changed excluded migration SHA fails closed", () => {
  const sourceDir = sourceCopy();
  fs.appendFileSync(path.join(sourceDir, Object.keys(CONTRACT.excluded)[0]), "\n-- drift\n");
  assert.throws(() => validateSelection(validInput({ sourceDir })), /excluded migration SHA-256 mismatch/);
});

test("a changed pending migration SHA fails closed", () => {
  const sourceDir = sourceCopy();
  fs.appendFileSync(path.join(sourceDir, CONTRACT.pending.filename), "\n-- drift\n");
  assert.throws(() => validateSelection(validInput({ sourceDir })), /pending migration SHA-256 mismatch/);
});

test("an additional pending migration fails closed", () => {
  const sourceDir = sourceCopy();
  fs.copyFileSync(
    path.join(sourceDir, CONTRACT.pending.filename),
    path.join(sourceDir, "20260726110000_unexpected_pending.sql"),
  );
  assert.throws(() => validateSelection(validInput({ sourceDir })), /more than one pending migration/);
});

test("a missing expected pending migration fails closed", () => {
  const sourceDir = sourceCopy();
  fs.rmSync(path.join(sourceDir, CONTRACT.pending.filename));
  assert.throws(() => validateSelection(validInput({ sourceDir })), /expected pending migration is missing/);
});

test("a remote-only migration fails closed", () => {
  const ledger = currentRemoteLedger();
  ledger[0] = { version: "20260712000000", name: "remote_only" };
  assert.throws(() => validateSelection(validInput({ remoteLedger: ledger })), /remote-only migrations/);
});

test("modified copied SQL is detected and no workdir is published", () => {
  const selection = validateSelection(validInput());
  const allowedRoot = temporaryRoot();
  const workdir = path.join(allowedRoot, "selected");
  assert.throws(
    () => materializeSelectedWorkdir({
      selection,
      sourceDir: SOURCE,
      configFile: CONFIG,
      workdir,
      allowedWorkdirRoot: allowedRoot,
      copyFile(source, destination) {
        fs.copyFileSync(source, destination);
        if (destination.endsWith(".sql")) fs.appendFileSync(destination, "\n-- mutation\n");
      },
    }),
    /copied SQL content mismatch/,
  );
  assert.equal(fs.existsSync(workdir), false);
});

test("materialization preserves every original migration byte-for-byte", () => {
  const before = new Map(
    fs.readdirSync(SOURCE)
      .filter((filename) => filename.endsWith(".sql"))
      .map((filename) => [filename, sha256File(path.join(SOURCE, filename))]),
  );
  const selection = validateSelection(validInput());
  const allowedRoot = temporaryRoot();
  const workdir = materializeSelectedWorkdir({
    selection,
    sourceDir: SOURCE,
    configFile: CONFIG,
    workdir: path.join(allowedRoot, "selected"),
    allowedWorkdirRoot: allowedRoot,
  });
  assert.equal(fs.readdirSync(path.join(workdir, "supabase", "migrations")).length, 58);
  for (const [filename, hash] of before) {
    assert.equal(sha256File(path.join(SOURCE, filename)), hash);
  }
  const copiedPending = path.join(workdir, "supabase", "migrations", CONTRACT.pending.filename);
  assert.equal(sha256File(copiedPending), CONTRACT.pending.sha256);
});

test("the frozen fixture reproduces the approved staging ledger fingerprint", () => {
  const rows = currentRemoteLedger();
  assert.equal(rows.length, CONTRACT.ledgerCount);
  assert.equal(ledgerRowsFingerprint(rows), CONTRACT.ledgerFingerprint);
});
