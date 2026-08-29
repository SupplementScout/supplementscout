const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CONTRACTS,
  ledgerRowsFingerprint,
  materializeSelectedWorkdir,
  parseArgs,
  sha256File,
  validateDatabaseOwner,
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
  const pending = new Set(CONTRACT.pending.map(({ filename }) => filename));
  return fs.readdirSync(sourceDir)
    .filter((filename) =>
      /^\d{14}_[a-z0-9_]+\.sql$/.test(filename) &&
      !excluded.has(filename) &&
      !pending.has(filename))
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

test("staging records the reviewed Predators v3 policy as applied", () => {
  const result = validateSelection(validInput());
  assert.equal(result.ledger_count, 87);
  assert.equal(result.ledger_fingerprint, CONTRACT.ledgerFingerprint);
  assert.deepEqual(result.pending, []);
  assert.equal(result.selected_files.length, 87);
});

test("the local-only migration is the exact shared-policy exclusion", () => {
  const result = validateSelection(validInput());
  assert.ok(result.excluded_files.includes("20260717130000_add_local_retailer_catalogue_child_executor.sql"));
  assert.ok(!result.selected_files.includes("20260717130000_add_local_retailer_catalogue_child_executor.sql"));
  assert.ok(!result.excluded_files.includes("20260824160000_add_identity_proven_price_observations.sql"));
  assert.ok(result.selected_files.includes("20260824160000_add_identity_proven_price_observations.sql"));
});

test("the production-only migration is the exact shared-policy exclusion", () => {
  const result = validateSelection(validInput());
  assert.ok(result.excluded_files.includes("20260719100000_add_production_retailer_sync_enablement.sql"));
  assert.ok(!result.selected_files.includes("20260719100000_add_production_retailer_sync_enablement.sql"));
  assert.ok(result.excluded_files.includes(
    "20260726140000_authorize_reviewed_jons_16_mapped_scope.sql",
  ));
  assert.ok(!result.selected_files.includes(
    "20260726140000_authorize_reviewed_jons_16_mapped_scope.sql",
  ));
  assert.ok(result.excluded_files.includes(
    "20260729200000_authorize_reviewed_jons_11_stock_changes.sql",
  ));
  assert.ok(!result.selected_files.includes(
    "20260729200000_authorize_reviewed_jons_11_stock_changes.sql",
  ));
  assert.ok(result.excluded_files.includes(
    "20260729210000_correct_strom_essentialmax_berrylicious_variant.sql",
  ));
  assert.ok(!result.selected_files.includes(
    "20260729210000_correct_strom_essentialmax_berrylicious_variant.sql",
  ));
  assert.ok(result.excluded_files.includes(
    "20260731120000_correct_jons_two_default_flavour_variants.sql",
  ));
  assert.ok(!result.selected_files.includes(
    "20260731120000_correct_jons_two_default_flavour_variants.sql",
  ));
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

test("production records the reviewed CM3 trigger follow-up as applied and only Predators v3 as pending", () => {
  const contract = CONTRACTS.PRODUCTION;
  assert.deepEqual(contract.pending, [
    {
      filename: "20260829100000_allow_predators_gear_reviewed_new_products_v3.sql",
      sha256: "50433e868203dfd1d411d03dfcaeb10288bd38999d0cfa2c194682e307f19129",
    },
  ]);
  assert.equal(contract.ledgerCount, 156);
  assert.equal(
    contract.ledgerFingerprint,
    "ac26506535da00896f300feaf30f4b195686d64400a9ccba4d76354ede8f7e6e",
  );
});

test("an additional pending migration fails closed", () => {
  const sourceDir = sourceCopy();
  fs.copyFileSync(
    path.join(sourceDir, "20260726150000_seed_reviewed_fit_house_catalogue_closeout.sql"),
    path.join(sourceDir, "20260726110000_unexpected_pending.sql"),
  );
  assert.throws(() => validateSelection(validInput({ sourceDir })), /pending migration count mismatch/);
});

test("a missing applied staging migration fails closed against the ledger", () => {
  const sourceDir = sourceCopy();
  fs.rmSync(path.join(sourceDir, "20260726150000_seed_reviewed_fit_house_catalogue_closeout.sql"));
  assert.throws(() => validateSelection(validInput({ sourceDir })), /remote-only migrations/);
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
  assert.equal(fs.readdirSync(path.join(workdir, "supabase", "migrations")).length, 87);
  for (const [filename, hash] of before) {
    assert.equal(sha256File(path.join(SOURCE, filename)), hash);
  }
  for (const pending of CONTRACT.pending) {
    const copiedPending = path.join(workdir, "supabase", "migrations", pending.filename);
    assert.equal(sha256File(copiedPending), pending.sha256);
  }
});

test("the frozen fixture reproduces the approved staging ledger fingerprint", () => {
  const rows = currentRemoteLedger();
  assert.equal(rows.length, CONTRACT.ledgerCount);
  assert.equal(ledgerRowsFingerprint(rows), CONTRACT.ledgerFingerprint);
});

test("production binds its exact ledger with only the reviewed Predators v3 migration pending", () => {
  const contract = CONTRACTS.PRODUCTION;
  const excluded = new Set(Object.keys(contract.excluded));
  const pending = new Set(contract.pending.map(({ filename }) => filename));
  const remoteLedger = fs.readdirSync(SOURCE)
    .filter((filename) =>
      /^\d{14}_[a-z0-9_]+\.sql$/.test(filename) &&
      !excluded.has(filename) &&
      !pending.has(filename))
    .sort()
    .map((filename) => {
      const identifier = filename.slice(0, -4);
      const split = identifier.indexOf("_");
      return { version: identifier.slice(0, split), name: identifier.slice(split + 1) };
    });
  const result = validateSelection({
    environment: "PRODUCTION",
    projectRef: contract.projectRef,
    databaseTarget: {
      target_environment: "PRODUCTION",
      project_ref: contract.projectRef,
      database_identity: contract.databaseIdentity,
    },
    remoteLedger,
    sourceDir: SOURCE,
  });
  assert.equal(result.ledger_count, 156);
  assert.equal(result.ledger_fingerprint, contract.ledgerFingerprint);
  assert.deepEqual(result.pending, [
    "20260829100000_allow_predators_gear_reviewed_new_products_v3",
  ]);
  assert.equal(result.selected_files.length, 157);
  assert.deepEqual(result.pending_files, [
    "20260829100000_allow_predators_gear_reviewed_new_products_v3.sql",
  ]);
  assert.equal(
    result.pending_file,
    "20260829100000_allow_predators_gear_reviewed_new_products_v3.sql",
  );
  assert.equal(
    result.pending_sha256,
    "50433e868203dfd1d411d03dfcaeb10288bd38999d0cfa2c194682e307f19129",
  );
  assert.deepEqual(result.pending_sha256s, {
    "20260829100000_allow_predators_gear_reviewed_new_products_v3.sql":
      "50433e868203dfd1d411d03dfcaeb10288bd38999d0cfa2c194682e307f19129",
  });
  assert.ok(result.selected_files.includes(
    "20260825163000_create_jons_exact_pack_canary_5.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260825170000_create_jons_exact_pack_ready_servings_10.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826090000_enable_gym_high_price_observation_producer.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826100000_create_gym_high_exact_pack_9.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826110000_create_gym_high_shred_mode_exact_pack.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826120000_create_fit_house_exact_pack_batch_15.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826130000_create_fit_house_retailer_evidence_exact_pack_11.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826140000_create_fit_house_retailer_evidence_exact_pack_27.sql",
    "20260826150000_create_fit_house_owner_reviewed_exact_pack_24.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826160000_create_fit_house_owner_reviewed_exact_pack_10.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826170000_create_fit_house_sodium_butyrate_exact_pack.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826180000_resolve_fit_house_six_exact_pack_conflicts.sql",
  ));
  assert.ok(result.selected_files.includes(
    "20260826190000_enable_fit_house_price_observation_producer.sql",
  ));
});

test("production exclusions are exact and the approved identity foundation is selected", () => {
  const contract = CONTRACTS.PRODUCTION;
  assert.equal(Object.keys(contract.excluded).length, 7);
  assert.ok(!Object.hasOwn(
    contract.excluded,
    "20260824160000_add_identity_proven_price_observations.sql",
  ));
  assert.ok(!Object.hasOwn(
    contract.excluded,
    "20260816173000_extend_guarded_gtin_promotion_exact_36.sql",
  ));
  assert.ok(!Object.hasOwn(
    contract.excluded,
    "20260719100000_add_production_retailer_sync_enablement.sql",
  ));
  assert.equal(contract.requiredDatabaseUser, "postgres");
  assert.equal(contract.databaseUrlEnvironmentKey, "SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL");
});

test("production CLI defaults to an explicit owner credential and production workdir", () => {
  const parsed = parseArgs([
    "--environment=PRODUCTION",
    `--project-ref=${CONTRACTS.PRODUCTION.projectRef}`,
  ]);
  assert.equal(path.basename(parsed.envFile), "production-owner.env");
  assert.equal(path.basename(parsed.workdir), "supabase-production-selected");
});

test("production owner guard rejects service role and accepts postgres only", () => {
  const contract = CONTRACTS.PRODUCTION;
  assert.throws(
    () => validateDatabaseOwner(contract, { current_user: "service_role" }),
    /requires database owner postgres/,
  );
  assert.doesNotThrow(() => validateDatabaseOwner(contract, { current_user: "postgres" }));
});

test("staging output reports no pending migration after the reviewed Predators v3 policy apply", () => {
  const result = validateSelection(validInput());
  assert.equal(result.pending_file, null);
  assert.equal(result.pending_sha256, null);
  assert.deepEqual(result.pending_files, []);
  assert.deepEqual(result.pending_sha256s, {});
});

test("staging excludes the production-only exact-pack migrations byte-for-byte", () => {
  const result = validateSelection(validInput());
  for (const filename of [
    "20260825163000_create_jons_exact_pack_canary_5.sql",
    "20260825170000_create_jons_exact_pack_ready_servings_10.sql",
    "20260825200000_create_jons_exact_pack_ready_servings_2.sql",
    "20260825201000_create_jons_exact_pack_ready_grams_4.sql",
    "20260825210000_create_jons_exact_pack_ordinary_servings_a_10.sql",
    "20260825211000_create_jons_exact_pack_ordinary_servings_b_10.sql",
    "20260825212000_create_jons_exact_pack_ordinary_servings_c_10.sql",
    "20260825213000_create_jons_exact_pack_ordinary_servings_d_9.sql",
    "20260825214000_create_jons_exact_pack_ordinary_grams_a_10.sql",
    "20260825215000_create_jons_exact_pack_ordinary_grams_b_1.sql",
    "20260825220000_rebind_jons_existing_exact_pack_1.sql",
    "20260825230000_create_jons_exact_pack_special_evidence_a_10.sql",
    "20260825231000_create_jons_exact_pack_special_evidence_b_3.sql",
    "20260826090000_enable_gym_high_price_observation_producer.sql",
    "20260826120000_create_fit_house_exact_pack_batch_15.sql",
    "20260826130000_create_fit_house_retailer_evidence_exact_pack_11.sql",
    "20260826140000_create_fit_house_retailer_evidence_exact_pack_27.sql",
    "20260826150000_create_fit_house_owner_reviewed_exact_pack_24.sql",
    "20260826160000_create_fit_house_owner_reviewed_exact_pack_10.sql",
    "20260826170000_create_fit_house_sodium_butyrate_exact_pack.sql",
    "20260826180000_resolve_fit_house_six_exact_pack_conflicts.sql",
    "20260826190000_enable_fit_house_price_observation_producer.sql",
  ]) {
    assert.ok(result.excluded_files.includes(filename));
    assert.ok(!result.selected_files.includes(filename));
  }
});
