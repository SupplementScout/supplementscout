const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CLOSEOUT_KIND,
  parseArgs,
  pendingConfirmation,
  appliedPendingIdentifiers,
  assertDerivationMatchesContract,
  expectedCatalogueCounts,
  repositoryCloseoutForAttempt,
  validatePostApplyReadback,
  writeRepositoryCloseoutEvidence,
  writeRepositoryCloseoutEvidenceIfRequired,
  unwrapTransaction,
} = require("./apply-selected-migrations");
const { CONTRACTS } = require("./supabase-migration-selector");
const {
  PENDING_MIGRATIONS,
  derivePostApplyMigrationBinding,
} = require("./lib/environment-migrations");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "supabase", "migrations");
const HISTORICAL_PENDING = Object.freeze([Object.freeze({
  filename: "20261105100000_refresh_pending_review_execution_binding.sql",
  sha256: "015f0de7448c10fcca10174e74dfbf7ca9e3150951f49090d01cd6eee869024c",
})]);

function ledgerRows(identifiers) {
  return identifiers.map((identifier) => {
    const split = identifier.indexOf("_");
    return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
  });
}

test("rehearsal cannot receive an apply confirmation", () => {
  const parsed = parseArgs([
    "--environment=STAGING",
    `--project-ref=${CONTRACTS.STAGING.projectRef}`,
    "--mode=rehearse",
  ]);
  assert.equal(parsed.confirm, null);
  assert.equal(parsed.mode, "rehearse");
});

test("pending confirmation is deterministic and environment-bound", () => {
  const contract = {
    pending: [
      { filename: "20260728100000_one.sql", sha256: "a".repeat(64) },
      { filename: "20260728110000_two.sql", sha256: "b".repeat(64) },
    ],
  };
  assert.match(pendingConfirmation(contract), /^[0-9a-f]{16}$/);
  assert.equal(
    pendingConfirmation(contract),
    pendingConfirmation(contract),
  );
});

test("pending ledger verification accepts an older version applied after newer ledger rows", () => {
  const ledger = [
    { version: "20260908100000", name: "older_pending" },
    { version: "20260908110000", name: "already_present" },
    { version: "20260908123000", name: "newer_pending" },
  ];
  assert.deepEqual(appliedPendingIdentifiers(ledger, ["20260908100000_older_pending", "20260908123000_newer_pending"]), ["20260908100000_older_pending", "20260908123000_newer_pending"]);
  assert.throws(() => appliedPendingIdentifiers(ledger, ["20260908100000_missing"]), /ledger sequence mismatch/);
});

test("transaction wrapper is required and removed", () => {
  assert.equal(unwrapTransaction("begin;\nselect 1;\ncommit;", "one.sql").trim(), "select 1;");
  assert.throws(() => unwrapTransaction("select 1;", "one.sql"), /explicit begin\/commit/);
  assert.throws(
    () => unwrapTransaction("begin; begin; select 1; commit; commit;", "one.sql"),
    /nested transaction/,
  );
});

test("catalogue deltas default to zero and allow only exact declared table changes", () => {
  const before = { products: "10", product_variants: "20", retailer_products: "30", offers: "40", price_history: "50" };
  assert.deepEqual(expectedCatalogueCounts(before, [{}]), before);
  assert.deepEqual(expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { product_variants: 1 } }]), {
    ...before,
    product_variants: "21",
  });
  assert.throws(() => expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { unknown: 1 } }]), /invalid expected/);
  assert.throws(() => expectedCatalogueCounts(before, [{ expectedCatalogueDeltas: { offers: 0.5 } }]), /invalid expected/);
});

test("selected migration paths require the shared verified PostgreSQL TLS helper", () => {
  for (const file of ["apply-selected-migrations.js", "supabase-migration-selector.js"]) {
    const source = fs.readFileSync(require.resolve(`./${file}`), "utf8");
    assert.match(source, /postgresClientConfig\(\{/);
    assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/);
  }
});

test("closed production derives an immutable ALREADY_CLOSED state without advancing the ledger", () => {
  const derivation = derivePostApplyMigrationBinding("PRODUCTION");
  assert.equal(derivation.status, "ALREADY_CLOSED");
  assert.equal(derivation.pending_count, 0);
  assert.equal(derivation.pre_ledger_count, 260);
  assert.equal(derivation.post_ledger_count, 260);
  assert.equal(derivation.pre_ledger_fingerprint,
    "17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e");
  assert.equal(derivation.post_ledger_fingerprint, derivation.pre_ledger_fingerprint);
  assert.deepEqual(derivation.pre_identifiers, derivation.post_identifiers);
  assert.ok(Object.isFrozen(derivation));
  assert.ok(Object.isFrozen(derivation.post_identifiers));
  assertDerivationMatchesContract(derivation, CONTRACTS.PRODUCTION);

  const closeout = repositoryCloseoutForAttempt({
    mode: "apply",
    committed: true,
    derivation,
    contract: CONTRACTS.PRODUCTION,
    projectRef: CONTRACTS.PRODUCTION.projectRef,
    remoteLedger: ledgerRows(derivation.post_identifiers),
  });
  assert.equal(closeout.closeout_status, "ALREADY_CLOSED");
  assert.equal(closeout.evidence, null);
  assert.equal(writeRepositoryCloseoutEvidenceIfRequired(closeout), null);
});

test("historical production pending migration deterministically derives ledger 260", () => {
  const derivation = derivePostApplyMigrationBinding("PRODUCTION", {
    sourceDir: SOURCE,
    pendingMigrations: HISTORICAL_PENDING,
  });
  assert.equal(derivation.status, "CLOSEOUT_REQUIRED");
  assert.equal(derivation.pre_ledger_count, 259);
  assert.equal(derivation.pre_ledger_fingerprint,
    "d21a4044df80270db476bd264a9a4da19e90fe15310b2b918487ce4c480978af");
  assert.equal(derivation.pending_count, 1);
  assert.deepEqual(derivation.consumed_pending, [{
    ...HISTORICAL_PENDING[0],
    identifier: HISTORICAL_PENDING[0].filename.slice(0, -4),
  }]);
  assert.equal(derivation.post_ledger_count, 260);
  assert.equal(derivation.post_ledger_fingerprint,
    "17a00891dff4e0a4f53050a018594fd505aa0aabc02b5281580b42895d7fd61e");
});

test("current staging pending migrations derive one exact ordered 120 to 122 transition", () => {
  const derivation = derivePostApplyMigrationBinding("STAGING");
  assert.equal(derivation.pre_ledger_count, 120);
  assert.equal(derivation.pre_ledger_fingerprint,
    "31dc3e6e90dab56dd00843bef441cfba400e1d9480d2940f41b46cfff6e32277");
  assert.deepEqual(
    derivation.consumed_pending.map(({ filename }) => filename),
    PENDING_MIGRATIONS.STAGING.map(({ filename }) => filename),
  );
  assert.equal(derivation.pending_count, 2);
  assert.equal(derivation.post_ledger_count, 122);
  assert.equal(derivation.post_ledger_fingerprint,
    "df0638a3a565af873e123809c4b1498d630e22fe49030078c704b9b57a13e27b");
  assertDerivationMatchesContract(derivation, CONTRACTS.STAGING);
});

test("closeout derivation rejects duplicate, unordered, missing and SHA-drifted pending files", () => {
  assert.throws(
    () => derivePostApplyMigrationBinding("PRODUCTION", {
      sourceDir: SOURCE,
      pendingMigrations: [HISTORICAL_PENDING[0], HISTORICAL_PENDING[0]],
    }),
    /duplicate pending migration filename/,
  );
  assert.throws(
    () => derivePostApplyMigrationBinding("STAGING", {
      sourceDir: SOURCE,
      pendingMigrations: [...PENDING_MIGRATIONS.STAGING].reverse(),
    }),
    /not in deterministic order/,
  );
  assert.throws(
    () => derivePostApplyMigrationBinding("PRODUCTION", {
      sourceDir: SOURCE,
      pendingMigrations: [{
        filename: "20990101000000_missing_pending_migration.sql",
        sha256: "0".repeat(64),
      }],
    }),
    /missing from inventory/,
  );
  assert.throws(
    () => derivePostApplyMigrationBinding("PRODUCTION", {
      sourceDir: SOURCE,
      pendingMigrations: [{ ...HISTORICAL_PENDING[0], sha256: "0".repeat(64) }],
    }),
    /SHA-256 mismatch/,
  );
});

test("missing pending bytes fail even when the filename is present in the supplied inventory", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "selected-migration-closeout-"));
  try {
    const filename = "20990101000000_missing_pending_migration.sql";
    assert.throws(
      () => derivePostApplyMigrationBinding("PRODUCTION", {
        sourceDir: directory,
        migrationFiles: [filename],
        pendingMigrations: [{ filename, sha256: "0".repeat(64) }],
      }),
      /expected pending migration is missing/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("post-apply readback rejects count, fingerprint, identity, partial and extra-ledger drift", () => {
  const derivation = derivePostApplyMigrationBinding("STAGING");
  const exact = ledgerRows(derivation.post_identifiers);
  const readback = validatePostApplyReadback(derivation, exact);
  assert.equal(readback.ledger_count, 122);
  assert.equal(readback.ledger_fingerprint, derivation.post_ledger_fingerprint);
  assert.deepEqual(readback.applied,
    derivation.consumed_pending.map(({ identifier }) => identifier));

  assert.throws(
    () => validatePostApplyReadback(derivation, exact.slice(0, -1)),
    /ledger count mismatch/,
  );
  assert.throws(
    () => validatePostApplyReadback(derivation, exact, "0".repeat(64)),
    /ledger fingerprint mismatch/,
  );
  const wrongIdentity = exact.map((row) => ({ ...row }));
  wrongIdentity[wrongIdentity.length - 1] = {
    version: "20990101000000",
    name: "wrong_pending_identity",
  };
  assert.throws(
    () => validatePostApplyReadback(derivation, wrongIdentity),
    /applied migration identity sequence mismatch/,
  );
  const partial = ledgerRows([
    ...derivation.pre_identifiers,
    derivation.consumed_pending[0].identifier,
  ].sort());
  assert.throws(
    () => validatePostApplyReadback(derivation, partial),
    /ledger count mismatch/,
  );
  const extra = [...exact, { version: "20990101000000", name: "extra_remote_migration" }];
  assert.throws(
    () => validatePostApplyReadback(derivation, extra),
    /ledger count mismatch/,
  );
});

test("rehearsed and failed attempts never produce repository closeout evidence", () => {
  const derivation = derivePostApplyMigrationBinding("STAGING");
  const shared = {
    derivation,
    contract: CONTRACTS.STAGING,
    projectRef: CONTRACTS.STAGING.projectRef,
  };
  assert.deepEqual(repositoryCloseoutForAttempt({
    ...shared,
    mode: "rehearse",
    committed: false,
  }), {
    closeout_status: "NOT_REQUIRED_REHEARSAL",
    evidence: null,
    readback: null,
  });
  assert.deepEqual(repositoryCloseoutForAttempt({
    ...shared,
    mode: "apply",
    committed: false,
  }), {
    closeout_status: "NOT_GENERATED",
    evidence: null,
    readback: null,
  });
});

test("exact committed readback emits deterministic operator-only CLOSEOUT_REQUIRED evidence", () => {
  const derivation = derivePostApplyMigrationBinding("STAGING");
  const closeout = repositoryCloseoutForAttempt({
    mode: "apply",
    committed: true,
    derivation,
    contract: CONTRACTS.STAGING,
    projectRef: CONTRACTS.STAGING.projectRef,
    remoteLedger: ledgerRows(derivation.post_identifiers),
  });
  assert.equal(closeout.closeout_status, "CLOSEOUT_REQUIRED");
  assert.equal(closeout.evidence.kind, CLOSEOUT_KIND);
  assert.equal(closeout.evidence.schema_version, 1);
  assert.equal(closeout.evidence.database_writes.migration_apply_count, 2);
  assert.deepEqual(closeout.evidence.repository_updates.map(({ field }) => field), [
    "PENDING_MIGRATIONS.STAGING",
    "CONTRACTS.STAGING.ledgerCount",
    "CONTRACTS.STAGING.ledgerFingerprint",
  ]);
  assert.deepEqual(closeout.evidence.repository_updates[0].to, []);
  assert.equal(closeout.evidence.post_state.ledger_count, 122);
  assert.equal(closeout.evidence.post_state.ledger_fingerprint,
    "df0638a3a565af873e123809c4b1498d630e22fe49030078c704b9b57a13e27b");
  assert.doesNotMatch(JSON.stringify(closeout.evidence), /password|credential|connection|string|begin;|commit;/i);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "selected-migration-evidence-"));
  try {
    const output = writeRepositoryCloseoutEvidence(closeout.evidence, directory);
    assert.equal(path.dirname(output), directory);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, "utf8")), closeout.evidence);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("verify-selected-migrations exposes only CURRENT or exact POST_APPLY_VERIFIED states", () => {
  const source = fs.readFileSync(require.resolve("./verify-selected-migrations"), "utf8");
  assert.match(source, /database_state:[\s\S]*"CURRENT"[\s\S]*"POST_APPLY_VERIFIED"/);
  assert.match(source, /repository_closeout: closeout\.closeout_status/);
  assert.match(source, /derivePostApplyMigrationBinding\(options\.environment\)/);
  assert.doesNotMatch(source, /APPROXIMATE|accept.*either|allowed.*ledger/i);
});
