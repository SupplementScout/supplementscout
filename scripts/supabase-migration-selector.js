const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  excludedMigrationIds,
  MIGRATION_FILE,
  migrationIdentifier,
} = require("./lib/environment-migrations");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE_DIR = path.join(ROOT, "supabase", "migrations");
const DEFAULT_CONFIG_FILE = path.join(ROOT, "supabase", "config.toml");
const DEFAULT_WORKDIR = path.join(ROOT, "tmp", "supabase-staging-selected");
const DEFAULT_ENV_FILE = path.join(ROOT, ".env.staging.audit.local");
const DEFAULT_PRODUCTION_WORKDIR = path.join(ROOT, "tmp", "supabase-production-selected");
const DEFAULT_PRODUCTION_ENV_FILE = path.join(
  process.env.USERPROFILE || "",
  ".supplementscout",
  "credentials",
  "production-owner.env",
);
const SHA256 = /^[0-9a-f]{64}$/;

const CONTRACTS = Object.freeze({
  STAGING: Object.freeze({
    environment: "STAGING",
    projectRef: "hxnrsyyqffztlvcrtgbf",
    databaseIdentity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
    projectRefEnvironmentKey: "SUPPLEMENTSCOUT_STAGING_PROJECT_REF",
    databaseUrlEnvironmentKey: "SUPPLEMENTSCOUT_STAGING_DATABASE_URL",
    requiredDatabaseUser: "postgres",
    ledgerCount: 65,
    ledgerFingerprint:
      "b97a37c4368963cc795ebd5d3bc4064b4910dfa347ee204ed231a5581477e42f",
    excluded: Object.freeze({
      "20260717130000_add_local_retailer_catalogue_child_executor.sql":
        "50965e74cd78f7aa7bcc99dea739123833b7904cf0e13507f48ea08d9cc9643c",
      "20260719100000_add_production_retailer_sync_enablement.sql":
        "0c1db39a193c98fb7cd41cfc3b75a03b35ebd59d429fe873e431aadb1aabadf9",
      "20260726140000_authorize_reviewed_jons_16_mapped_scope.sql":
        "57d7b193c42cd9950f7a6d6b91a18cc10ee1b7545242c96bcaa24edcfea91959",
    }),
    pending: Object.freeze([]),
  }),
  PRODUCTION: Object.freeze({
    environment: "PRODUCTION",
    projectRef: "aftboxmrdgyhizicfsfu",
    databaseIdentity: "supplementscout-production:aftboxmrdgyhizicfsfu",
    projectRefEnvironmentKey: "SUPPLEMENTSCOUT_PRODUCTION_PROJECT_REF",
    databaseUrlEnvironmentKey: "SUPPLEMENTSCOUT_PRODUCTION_OWNER_DATABASE_URL",
    requiredDatabaseUser: "postgres",
    ledgerCount: 59,
    ledgerFingerprint:
      "bb365f594464301d1e74c045c18c4ba37c43a37bf9d2716630392f0cbd0bd54a",
    excluded: Object.freeze({
      "20260717120000_create_retailer_catalogue_control_ledger.sql":
        "df8539d1b63cdd37ac58fce40c1bd7fc6165982294b1554ed1f2945a62988270",
      "20260717130000_add_local_retailer_catalogue_child_executor.sql":
        "50965e74cd78f7aa7bcc99dea739123833b7904cf0e13507f48ea08d9cc9643c",
      "20260717140000_add_staging_retailer_catalogue_executor.sql":
        "6dbdc5c2912c9c04a8c24e7905b7c705711c2f1b68b2eff51fab85e132f56512",
      "20260718150000_add_verified_no_change_offer_refresh.sql":
        "9c97854bc8469e1ba376e25803a4c82c81de69c701df6e65870bb0fafefd97e2",
      "20260718160000_add_retailer_offer_mixed_batch_executor.sql":
        "29098f16a10e0aaab2e1fdca1dadf33791ad470e3bfe0cc46bd7b24e60b0f7d1",
      "20260718170000_add_read_only_mixed_batch_validator.sql":
        "09ece7d68328ee7e383375f6d13f55933e7c18be88137fa0108046d69f121510",
      "20260719090000_add_expired_retailer_offer_sync_approval_close.sql":
        "978ee878cbdc93ec4ef942a30aa51da4ae40c8400bceec2ba07a641d3ca72893",
    }),
    pending: Object.freeze([
      Object.freeze({
        filename:
          "20260726200000_allow_public_read_active_product_variants.sql",
        sha256:
          "04c5a3bc7746c497040e3f2b5e496332d76a5c4d340acc63d7d7d8e08d92653d",
      }),
      Object.freeze({
        filename:
          "20260726210000_add_reviewed_variant_nutrition_apply.sql",
        sha256:
          "ad165f24cc4f72f879645320116ffbade5dc51ab5a09f1a2cf2a5a2f9d0cd0ec",
      }),
    ]),
  }),
});

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function ledgerRowsFingerprint(rows) {
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function selectorContract(environment) {
  const contract = CONTRACTS[environment];
  invariant(contract, `unsupported selector environment ${environment}`);
  const sharedExclusions = excludedMigrationIds(environment);
  const contractExclusions = new Set(
    Object.keys(contract.excluded).map(migrationIdentifier),
  );
  invariant(
    sharedExclusions.size === contractExclusions.size &&
      [...sharedExclusions].every((identifier) => contractExclusions.has(identifier)),
    `${environment} selector exclusions differ from the shared migration policy`,
  );
  return contract;
}

function ledgerIdentifier(row) {
  invariant(
    row &&
      /^\d{14}$/.test(String(row.version)) &&
      /^[a-z0-9_]+$/.test(String(row.name)),
    "invalid remote migration ledger row",
  );
  return `${row.version}_${row.name}`;
}

function validateDatabaseOwner(contract, identity) {
  invariant(
    identity?.current_user === contract.requiredDatabaseUser,
    `${contract.environment} selector requires database owner ${contract.requiredDatabaseUser}`,
  );
}

function validateSelection({
  environment,
  projectRef,
  databaseTarget,
  remoteLedger,
  sourceDir = DEFAULT_SOURCE_DIR,
}) {
  const contract = selectorContract(environment);
  invariant(projectRef === contract.projectRef, "selector project ref mismatch");
  invariant(databaseTarget?.target_environment === environment, "database target environment mismatch");
  invariant(databaseTarget?.project_ref === contract.projectRef, "database target project ref mismatch");
  invariant(
    databaseTarget?.database_identity === contract.databaseIdentity,
    "database target identity mismatch",
  );
  invariant(Array.isArray(remoteLedger), "remote migration ledger is required");
  invariant(fs.statSync(sourceDir).isDirectory(), "migration source directory is missing");

  const allFiles = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  invariant(
    allFiles.every((filename) => MIGRATION_FILE.test(filename)),
    "unexpected SQL file in migration source directory",
  );

  for (const [filename, expected] of Object.entries(contract.excluded)) {
    const file = path.join(sourceDir, filename);
    invariant(fs.existsSync(file), `excluded migration is missing: ${filename}`);
    const actual = sha256File(file);
    invariant(SHA256.test(actual) && actual === expected, `excluded migration SHA-256 mismatch: ${filename}`);
  }
  const pendingHashes = {};
  for (const pending of contract.pending) {
    const pendingFile = path.join(sourceDir, pending.filename);
    invariant(fs.existsSync(pendingFile), `expected pending migration is missing: ${pending.filename}`);
    const pendingHash = sha256File(pendingFile);
    invariant(
      SHA256.test(pendingHash) && pendingHash === pending.sha256,
      `pending migration SHA-256 mismatch: ${pending.filename}`,
    );
    pendingHashes[pending.filename] = pendingHash;
  }

  const excluded = excludedMigrationIds(environment);
  const selectedFiles = allFiles.filter(
    (filename) => !excluded.has(migrationIdentifier(filename)),
  );
  invariant(
    allFiles.length - selectedFiles.length === excluded.size,
    "selector excluded an unexpected number of migrations",
  );

  const selectedIdentifiers = selectedFiles.map(migrationIdentifier);
  const selectedSet = new Set(selectedIdentifiers);
  const remoteIdentifiers = remoteLedger.map(ledgerIdentifier);
  invariant(remoteLedger.length === contract.ledgerCount, "remote ledger count mismatch");
  invariant(
    new Set(remoteIdentifiers).size === remoteIdentifiers.length,
    "duplicate remote migration ledger identifier",
  );
  const remoteOnly = remoteIdentifiers.filter((identifier) => !selectedSet.has(identifier));
  invariant(remoteOnly.length === 0, `remote-only migrations: ${remoteOnly.join(",")}`);

  const remoteSet = new Set(remoteIdentifiers);
  const pending = selectedIdentifiers.filter((identifier) => !remoteSet.has(identifier));
  const expectedPending = contract.pending.map(({ filename }) => migrationIdentifier(filename));
  invariant(
    pending.length === expectedPending.length,
    `pending migration count mismatch: ${pending.join(",")}`,
  );
  invariant(
    pending.every((identifier, index) => identifier === expectedPending[index]),
    `unexpected local migration sequence: ${pending.join(",")}`,
  );
  const ledgerFingerprint = ledgerRowsFingerprint(remoteLedger);
  invariant(
    ledgerFingerprint === contract.ledgerFingerprint,
    "remote ledger fingerprint mismatch",
  );

  const pendingFiles = contract.pending.map(({ filename }) => filename);
  const singlePending = contract.pending.length === 1;
  return {
    result: "PASS",
    environment,
    project_ref: projectRef,
    database_target: databaseTarget,
    ledger_count: remoteLedger.length,
    ledger_fingerprint: ledgerFingerprint,
    excluded_files: Object.keys(contract.excluded),
    selected_files: selectedFiles,
    remote_only: [],
    unexpected_local: [],
    pending: expectedPending,
    pending_files: pendingFiles,
    pending_sha256s: pendingHashes,
    pending_file: singlePending ? pendingFiles[0] : null,
    pending_sha256: singlePending ? pendingHashes[pendingFiles[0]] : null,
  };
}

function assertWithin(allowedRoot, target) {
  const root = path.resolve(allowedRoot);
  const resolved = path.resolve(target);
  invariant(resolved !== root, "workdir cannot equal its allowed root");
  invariant(
    resolved.startsWith(`${root}${path.sep}`),
    "workdir must remain inside its allowed root",
  );
  return resolved;
}

function materializeSelectedWorkdir({
  selection,
  sourceDir = DEFAULT_SOURCE_DIR,
  configFile = DEFAULT_CONFIG_FILE,
  workdir = DEFAULT_WORKDIR,
  allowedWorkdirRoot = path.join(ROOT, "tmp"),
  copyFile = fs.copyFileSync,
}) {
  invariant(selection?.result === "PASS", "validated selection is required");
  const destination = assertWithin(allowedWorkdirRoot, workdir);
  const build = assertWithin(
    allowedWorkdirRoot,
    `${destination}.build-${crypto.randomUUID()}`,
  );
  const sourceBefore = new Map(
    fs.readdirSync(sourceDir)
      .filter((filename) => MIGRATION_FILE.test(filename))
      .map((filename) => [filename, sha256File(path.join(sourceDir, filename))]),
  );

  try {
    const supabaseDir = path.join(build, "supabase");
    const migrationsDir = path.join(supabaseDir, "migrations");
    fs.mkdirSync(migrationsDir, { recursive: true });
    copyFile(configFile, path.join(supabaseDir, "config.toml"));
    for (const filename of selection.selected_files) {
      const source = path.join(sourceDir, filename);
      const copied = path.join(migrationsDir, filename);
      copyFile(source, copied);
      invariant(sha256File(copied) === sha256File(source), `copied SQL content mismatch: ${filename}`);
    }

    for (const [filename, before] of sourceBefore) {
      invariant(
        sha256File(path.join(sourceDir, filename)) === before,
        `original migration mutated: ${filename}`,
      );
    }

    fs.writeFileSync(
      path.join(build, "selection-manifest.json"),
      `${JSON.stringify({
        schema_version: 1,
        generated_at: new Date().toISOString(),
        environment: selection.environment,
        project_ref: selection.project_ref,
        ledger_count: selection.ledger_count,
        ledger_fingerprint: selection.ledger_fingerprint,
        excluded_files: selection.excluded_files,
        pending: selection.pending,
        pending_files: selection.pending_files,
        pending_sha256s: selection.pending_sha256s,
        pending_file: selection.pending_file,
        pending_sha256: selection.pending_sha256,
        selected_file_count: selection.selected_files.length,
      }, null, 2)}\n`,
    );

    if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true });
    fs.renameSync(build, destination);
    return destination;
  } catch (error) {
    if (fs.existsSync(build)) fs.rmSync(build, { recursive: true });
    throw error;
  }
}

function loadEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["environment", "project-ref", "workdir", "env-file"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(match && allowed.has(match[1]) && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(values.environment && values["project-ref"], "--environment and --project-ref are required");
  const production = values.environment === "PRODUCTION";
  return {
    environment: values.environment,
    projectRef: values["project-ref"],
    workdir: values.workdir
      ? path.resolve(values.workdir)
      : production ? DEFAULT_PRODUCTION_WORKDIR : DEFAULT_WORKDIR,
    envFile: values["env-file"]
      ? path.resolve(values["env-file"])
      : production ? DEFAULT_PRODUCTION_ENV_FILE : DEFAULT_ENV_FILE,
  };
}

async function readRemoteState(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: "supabase-environment-migration-selector",
    options: "-c default_transaction_read_only=on -c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query("begin read only");
    const identity = (await client.query(`
      select current_user,current_database(),
             current_setting('transaction_read_only') read_only,
             current_setting('app.safe_update',true) safe_update
    `)).rows[0];
    invariant(identity.read_only === "on", "database transaction is not read-only");
    invariant(!identity.safe_update, "database SAFE_UPDATE must be unset");
    const databaseTarget = (await client.query(
      "select public.retailer_catalogue_actual_database_target() target",
    )).rows[0].target;
    const remoteLedger = (await client.query(`
      select version,name
      from supabase_migrations.schema_migrations
      order by version
    `)).rows;
    await client.query("rollback");
    return { identity, databaseTarget, remoteLedger };
  } finally {
    await client.end();
  }
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const contract = selectorContract(options.environment);
  const env = loadEnvFile(options.envFile);
  invariant(
    env[contract.projectRefEnvironmentKey] === options.projectRef,
    "environment file project ref mismatch",
  );
  invariant(env[contract.databaseUrlEnvironmentKey], `${options.environment} database URL is missing`);
  const remote = await readRemoteState(env[contract.databaseUrlEnvironmentKey]);
  validateDatabaseOwner(contract, remote.identity);
  const selection = validateSelection({
    environment: options.environment,
    projectRef: options.projectRef,
    databaseTarget: remote.databaseTarget,
    remoteLedger: remote.remoteLedger,
  });
  const workdir = materializeSelectedWorkdir({
    selection,
    workdir: options.workdir,
  });
  console.log(JSON.stringify({
    ...selection,
    selected_files: undefined,
    workdir,
    database_identity: remote.identity,
    database_writes: 0,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  materializeSelectedWorkdir,
  parseArgs,
  readRemoteState,
  selectorContract,
  sha256File,
  validateDatabaseOwner,
  validateSelection,
};
