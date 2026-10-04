const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { APPROVED_IDENTITIES, SCOPE_CONFIGS } = require("./gtin-promotion-operation");
const { EXACT36_CONFIRMATION, MIGRATION, MIGRATION_CONTRACT, QUARANTINED_GTINS, RELEASE_CONFIGS, classifyProductionMigrationLedger, deploy, exactRowDiff, migrationPreflight, parseArgs, snapshotSummary } = require("./gtin-promotion-release");
const { CONTRACTS, ledgerRowsFingerprint } = require("./supabase-migration-selector");

function productionLedger() {
  const contract = CONTRACTS.PRODUCTION;
  const excluded = new Set(Object.keys(contract.excluded));
  for (const filename of contract.appliedExcluded || []) excluded.delete(filename);
  const pending = new Set(contract.pending.map(({ filename }) => filename));
  return fs.readdirSync(path.join(__dirname, "..", "supabase", "migrations"))
    .filter((filename) => /^\d{14}_[a-z0-9_]+\.sql$/.test(filename)
      && !excluded.has(filename) && !pending.has(filename))
    .sort()
    .map((filename) => ({ version: filename.slice(0, 14), name: filename.slice(15, -4) }));
}

async function isolatedMigrationPreflight(rows, { schema = true, migrationFile } = {}) {
  let schemaReads = 0;
  const client = {
    query: async (sql) => {
      assert.match(sql, /to_regprocedure/);
      schemaReads += 1;
      return { rows: [{ apply_exists: schema, quarantine_exists: schema }] };
    },
  };
  const result = await migrationPreflight(
    { "env-file": "test-only" },
    {
      migrationFile,
      ownerRead: async (_envFile, callback) => callback(client, { remoteLedger: rows }),
    },
  );
  return { result, schemaReads };
}

test("release accepts only production and exact owner confirmation", () => {
  const parsed = parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]);
  assert.equal(parsed.mode, "deploy");
  assert.throws(() => parseArgs(["--mode=deploy", "--target=production", "--env-file=tmp/owner.env", "--confirm=WRONG"]), /OWNER_APPROVED_EXACT_45/);
  assert.throws(() => parseArgs(["--mode=deploy", "--target=staging", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_45"]), /target=production/);
});

test("owner-reviewed exact 36 release has a separate fixed write confirmation and cannot deploy schema", () => {
  const parsed = parseArgs(["--mode=capture", "--target=production", "--scope=owner-reviewed-36", "--artifact=tmp/artifact.json", "--output=tmp/baseline.json", "--env-file=tmp/owner.env", `--confirm=${EXACT36_CONFIRMATION}`]);
  assert.equal(parsed.scope, "owner-reviewed-36");
  assert.equal(RELEASE_CONFIGS["owner-reviewed-36"].identities.length, 36);
  assert.deepEqual(RELEASE_CONFIGS["owner-reviewed-36"].identities, SCOPE_CONFIGS["owner-reviewed-36"].identities);
  assert.throws(() => parseArgs(["--mode=capture", "--target=production", "--scope=owner-reviewed-36", "--artifact=tmp/artifact.json", "--output=tmp/baseline.json", "--env-file=tmp/owner.env", "--confirm=OWNER_APPROVED_EXACT_36"]), /OWNER_APPROVED_EXACT_36_APPLY/);
  assert.throws(() => parseArgs(["--mode=deploy", "--target=production", "--scope=owner-reviewed-36", "--env-file=tmp/owner.env", `--confirm=${EXACT36_CONFIRMATION}`]), /limited to the frozen exact-45/);
});

test("release contract is exactly 45 writes and 16 quarantined conflicts", () => {
  assert.equal(APPROVED_IDENTITIES.length, 45);
  assert.equal(new Set(APPROVED_IDENTITIES.map((row) => `${row.product_id}:${row.variant_id}:${row.gtin}`)).size, 45);
  assert.equal(QUARANTINED_GTINS.length, 16);
  assert.equal(new Set(QUARANTINED_GTINS).size, 16);
});

test("post-write fingerprint changes only the exact approved variant destinations", () => {
  const variants = APPROVED_IDENTITIES.map((row) => ({ id: row.variant_id, product_id: row.product_id, gtin: null }));
  const data = { products: [{ id: "1", gtin: "0742978960459" }], variants, offers: [{ id: "1", price: 1 }], mappings: [{ id: "1", external_gtin: "x" }] };
  const summary = snapshotSummary(data, APPROVED_IDENTITIES);
  assert.notEqual(summary.variants_gtin_before_fingerprint, summary.variants_gtin_expected_fingerprint);
  assert.equal(summary.products_count, 1);
  assert.equal(summary.offers_count, 1);
  assert.equal(summary.retailer_products_count, 1);
});

test("deployed GTIN, Whey Okay rebind and traffic classification migrations remain frozen", () => {
  const pending = new Set(CONTRACTS.PRODUCTION.pending.map(({ filename }) => filename));
  for (const filename of [
    MIGRATION,
    "20260816173000_extend_guarded_gtin_promotion_exact_36.sql",
    "20260817114500_add_outbound_click_traffic_classification.sql",
  ]) assert.equal(pending.has(filename), false);
  assert.equal(CONTRACTS.PRODUCTION.ledgerCount, 223);
  assert.equal(CONTRACTS.PRODUCTION.ledgerFingerprint, "c891240d8ed411b3bc0ad5e2abc6a8c90bfeb442c1cd0824f3c5a4577ee0c7b0");
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", MIGRATION)), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", "20260816173000_extend_guarded_gtin_promotion_exact_36.sql")), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "supabase/migrations", "20260817114500_add_outbound_click_traffic_classification.sql")), true);
});

test("production migration preflight hashes the real 223-row ledger only in the PRODUCTION domain", () => {
  const rows = productionLedger();
  assert.equal(rows.length, 223);
  assert.equal(ledgerRowsFingerprint(rows, { targetEnvironment: "PRODUCTION" }), CONTRACTS.PRODUCTION.ledgerFingerprint);
  assert.notEqual(ledgerRowsFingerprint(rows, { targetEnvironment: "STAGING" }), CONTRACTS.PRODUCTION.ledgerFingerprint);
  assert.equal(classifyProductionMigrationLedger(rows), "ALREADY_PRESENT");
});

test("real migration preflight accepts the applied historical GTIN migration without current pending authorization", () => {
  const root = path.resolve(__dirname, "..");
  const script = `
    const fs = require("node:fs");
    const path = require("node:path");
    const root = ${JSON.stringify(root)};
    const selector = require(path.join(root, "scripts", "supabase-migration-selector"));
    const contract = selector.CONTRACTS.PRODUCTION;
    const excluded = new Set(Object.keys(contract.excluded));
    for (const filename of contract.appliedExcluded || []) excluded.delete(filename);
    const pending = new Set(contract.pending.map(({ filename }) => filename));
    const remoteLedger = fs.readdirSync(path.join(root, "supabase", "migrations"))
      .filter((filename) => /^\\d{14}_[a-z0-9_]+\\.sql$/.test(filename)
        && !excluded.has(filename) && !pending.has(filename))
      .sort()
      .map((filename) => ({ version: filename.slice(0, 14), name: filename.slice(15, -4) }));
    class FakeClient {
      async connect() {}
      async query(sql) {
        if (/to_regprocedure/.test(sql)) return { rows: [{ apply_exists: true, quarantine_exists: true }] };
        return { rows: [] };
      }
      async end() {}
    }
    const pgPath = require.resolve("pg", { paths: [root] });
    const pg = require(pgPath);
    require.cache[pgPath].exports = { ...pg, Client: FakeClient };
    const applyPath = require.resolve(path.join(root, "scripts", "apply-selected-migrations"));
    const apply = require(applyPath);
    require.cache[applyPath].exports = {
      ...apply,
      loadEnvFile: () => ({
        SUPPLEMENTSCOUT_PRODUCTION_PROJECT_REF: contract.projectRef,
        SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL: "redacted-test-only",
      }),
      databaseState: async () => ({
        identity: { current_user: "postgres", read_only: "on" },
        databaseTarget: { target_environment: "PRODUCTION", project_ref: contract.projectRef },
        remoteLedger,
      }),
    };
    const release = require(path.join(root, "scripts", "gtin-promotion-release"));
    release.run({ mode: "migration-preflight", scope: "exact-45", "env-file": "test-only" })
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  `;
  const child = spawnSync(process.execPath, ["-e", script], { cwd: root, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.deepEqual(JSON.parse(child.stdout), {
    result: "PASS",
    migration_status: "ALREADY_PRESENT",
    database_writes: 0,
  });
});

test("applied historical GTIN migration is SHA-bound and performs one schema read with zero writes", async () => {
  assert.deepEqual(MIGRATION_CONTRACT, {
    filename: MIGRATION,
    sha256: "60114659dc4b3c8052f722a8d094768ea64ee5d11ae0afe7a9a8280c8a3ed129",
  });
  const { result, schemaReads } = await isolatedMigrationPreflight(productionLedger());
  assert.deepEqual(result, {
    result: "PASS",
    migration_status: "ALREADY_PRESENT",
    database_writes: 0,
  });
  assert.equal(schemaReads, 1);
});

test("an absent historical GTIN migration is not currently authorized", async () => {
  const rows = productionLedger().filter(({ version, name }) => `${version}_${name}` !== MIGRATION.slice(0, -4));
  await assert.rejects(
    () => isolatedMigrationPreflight(rows),
    /GTIN migration is NOT_CURRENTLY_AUTHORIZED/,
  );
});

test("an unrelated current production pending migration cannot authorize historical GTIN deployment", async () => {
  assert.ok(CONTRACTS.PRODUCTION.pending.every(({ filename }) => filename !== MIGRATION));
  assert.equal(CONTRACTS.PRODUCTION.pending.some(({ filename }) => filename === MIGRATION), false);
  const rows = productionLedger().filter(({ version, name }) => `${version}_${name}` !== MIGRATION.slice(0, -4));
  await assert.rejects(
    () => isolatedMigrationPreflight(rows),
    /NOT_CURRENTLY_AUTHORIZED/,
  );
});

test("a changed local historical GTIN migration SHA is rejected before owner transport", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gtin-release-sha-"));
  const changed = path.join(directory, MIGRATION);
  fs.writeFileSync(changed, `${fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", MIGRATION), "utf8")}\n-- changed\n`);
  let transportAttempted = false;
  try {
    await assert.rejects(
      () => migrationPreflight(
        { "env-file": "test-only" },
        {
          migrationFile: changed,
          ownerRead: async () => { transportAttempted = true; },
        },
      ),
      /Reviewed GTIN migration SHA-256 mismatch/,
    );
    assert.equal(transportAttempted, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("an applied GTIN ledger without the required schema objects fails closed", async () => {
  await assert.rejects(
    () => isolatedMigrationPreflight(productionLedger(), { schema: false }),
    /Applied GTIN migration schema is incomplete/,
  );
});

test("deploy never invokes apply-selected-migrations for the applied historical GTIN migration", async () => {
  let spawnAttempts = 0;
  const result = await deploy(
    { "env-file": "test-only" },
    {
      migrationPreflight: async () => (await isolatedMigrationPreflight(productionLedger())).result,
      spawnSync: () => { spawnAttempts += 1; throw new Error("must not spawn"); },
    },
  );
  assert.deepEqual(result, {
    result: "PASS",
    migration_status: "ALREADY_PRESENT",
    database_writes: 0,
  });
  assert.equal(spawnAttempts, 0);
});

test("failed verification reports exact changed rows", () => {
  assert.deepEqual(exactRowDiff([{ id: "1", gtin: null }, { id: "2", gtin: "x" }], [{ id: "1", gtin: "y" }, { id: "3", gtin: "z" }]), [
    { id: "1", expected: { id: "1", gtin: null }, actual: { id: "1", gtin: "y" } },
    { id: "2", expected: { id: "2", gtin: "x" }, actual: null },
    { id: "3", expected: null, actual: { id: "3", gtin: "z" } },
  ]);
});

test("verification source checks dynamic exact scope, audit, no-ops and protected tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "gtin-promotion-release.js"), "utf8");
  for (const contract of ["products.gtin unchanged", "exact variant GTIN postcondition", "offers unchanged", "retailer_products unchanged", "16 quarantined unchanged", "audit write count", "approved now already present", "identity dry-run is no-op", "duplicate GTIN conflicts"]) assert.match(source, new RegExp(contract.replace(/[.]/g, "\\.")));
  assert.match(source, /FAILED_VERIFICATION/);
  assert.doesNotMatch(source, /gtin-promotion[^\n]*rollback\.sql|--mode=rollback/i);
  assert.match(source, /expectedState: config\.scope === "owner-reviewed-36" \? "post-apply"/);
});
