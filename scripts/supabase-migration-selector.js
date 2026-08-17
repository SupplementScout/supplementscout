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
    ledgerCount: 79,
    ledgerFingerprint:
      "00018acb7fb7f71a1c77ae2deb91268cb501997c89829e6934339eadd97b8a04",
    excluded: Object.freeze({
      "20260717130000_add_local_retailer_catalogue_child_executor.sql":
        "50965e74cd78f7aa7bcc99dea739123833b7904cf0e13507f48ea08d9cc9643c",
      "20260719100000_add_production_retailer_sync_enablement.sql":
        "0c1db39a193c98fb7cd41cfc3b75a03b35ebd59d429fe873e431aadb1aabadf9",
      "20260726140000_authorize_reviewed_jons_16_mapped_scope.sql":
        "57d7b193c42cd9950f7a6d6b91a18cc10ee1b7545242c96bcaa24edcfea91959",
      "20260729200000_authorize_reviewed_jons_11_stock_changes.sql":
        "1a99390a58544f173bd616cbe375708b15add5f027b7ce4d7f890314d114aa1b",
      "20260729210000_correct_strom_essentialmax_berrylicious_variant.sql":
        "881896d88dd33a240927543f9b871ac26c45fb00b9cffa3877bb177db1fa887b",
      "20260731120000_correct_jons_two_default_flavour_variants.sql":
        "b3d69a4594619d963918a47452a6034059bc51cd49d6ef3aa078b4cec1fad563",
      "20260801170000_support_reviewed_gym_high_no_sku_legacy_upgrade.sql":
        "2b9fc7fa6c9a9275d53127343435ab066f82e071a79f47806f5ae07286b1b1fd",
      "20260801180000_upgrade_reviewed_gym_high_accessory_and_wrong_legacy_identities.sql":
        "b66fb79a7177e354d273115dd5ddeaad8e17d5a7bd9295443df76171f2630e36",
      "20260801190000_allow_reviewed_gym_high_null_total_identity_upgrade.sql":
        "ad5feff19cad90d6ec8389224659bc75d06c9fca70cc3c5fde8989a94be721fd",
      "20260801200000_repair_reviewed_gym_high_legacy_control_binding.sql":
        "0fc0512b4d2b7923a429a461bc576555787a834a027454671c9eb898a8959c55",
      "20260801210000_allow_reviewed_gym_high_standalone_null_options.sql":
        "9142a62016a6b6cded67de7feb6eb90d0af37402b3164144d1358edad5b62612",
      "20260801220000_recognize_reviewed_gym_high_standalone_legacy_tuples.sql":
        "00178713c4bc9dff283e75ce080a557644bf676c81fd3c72ed0e118b494b94bf",
      "20260803120000_authorize_reviewed_jons_10_oos_changes.sql":
        "88a513d40af7a83e5d8ef14051f32159dd3f27e5fce4e79f937a62a7e49c573e",
      "20260803130000_correct_jons_creamax_lemonade_variant.sql":
        "f4e58a73599a6578e11db604c40c9f7e75f93eb9ff67e8f1876b757199f176f1",
      "20260803230000_authorize_simply_reviewed_commercial_baseline.sql":
        "a822db2f0cbda8040b30ac6b7e404211163e9f4806ef045f95fcac51f8f8445c",
      "20260803240000_normalize_simply_reviewed_commercial_money.sql":
        "c25765431978679283d2a6de5c2ad007e9cf34b6ec9effdcbe3ab5f7d55c2ef7",
      "20260803250000_support_simply_reviewed_commercial_registration.sql":
        "a284dcc718c96bbdf6a2772cae8964af4c3642befd75267ceb637b8cacb84c29",
      "20260803260000_align_existing_offer_option_evidence.sql":
        "cb6fdbaab004de4734db5755e0dc4498bfded6188f8337625a0db78b8b68cdf5",
      "20260803270000_verify_separate_offer_and_mapping_urls.sql":
        "b8010e370ef83983e2ce790d49e9f44ef585663fd6fcc408349186e17153bf42",
      "20260804000000_add_dolphin_vegan_protein_offer_sync_registration.sql":
        "12b17674f979ad0d42a5f6df9d75156d4b7e5cf1419e545bada0e75f2cb30429",
      "20260804010000_add_dolphin_single_offer_validation.sql":
        "a6400f646c636cba545c8510641fcdeec88f3751945812af6dc300a44e1f84d1",
      "20260804020000_correct_dolphin_scope_fingerprint.sql":
        "80ba2c95f23efb45d7abc533188b960f2f9de0f683bcbe11ad5b07c67ba723f8",
      "20260810160000_authorize_simply_offer_635_reviewed_sale.sql":
        "c84cdd9742e1e5f269fd51c303a3bc6054f37020417a63561723c78212d61cf1",
      "20260810170000_support_simply_offer_635_reviewed_sale_validation.sql":
        "e63fcebe84266a88ee750209c6fa25bf21631b124781e73dbf2226dfe24c142f",
      "20260810180000_support_simply_offer_635_reviewed_sale_registration.sql":
        "b117892b3c719eaa25b7b88cc6af7b2e126a0b9fe3e13bcb4e806c552c0501ca",
      "20260810190000_rebind_jons_loaded_eaa_fruit_twist_variant.sql":
        "9a0c4dd06b2047d9c50741865dd00c27935def11efd6c1f5ccab28ffd0f5343c",
      "20260810200000_rebind_two_reviewed_jons_variants.sql":
        "8a4713c5b6afdee070f0af5950f3d3ef3740ecabb1e97f9e94196f965431db52",
      "20260810210000_authorize_reviewed_jons_23_oos_changes.sql":
        "4d9be74c2aff36b258bb65380ae9a4e2051abb43605cafe8f16d8d9b09fa8337",
      "20260810220000_correct_jons_strom_buttered_pancake_variant.sql":
        "2fa4db1f530a53c19a8a74f6b6f15ce1a3dc2e006888a204e5ac929395bd1b58",
      "20260810230000_complete_jons_strom_buttered_pancake_variant_move.sql":
        "6e13a2ea76d0569d4e72dab8bbb6dcc8b9ecce643007cb9c28798d6756785efb",
      "20260810240000_create_reviewed_jons_17_explicit_variants.sql":
        "5067320e24d8c1a79eaea8adf98550ab440993a1531fb78c29f346f2c54c6411",
      "20260810250000_supersede_abandoned_partial_jons_plan.sql":
        "4f276cf2fe968d74625736afef5c9ca8817ee4fea4efa7df68144e82b78abe4e",
      "20260810260000_rebind_two_reviewed_fit_house_variants.sql":
        "faa54e06a552d1d67f0c49f527d0971be5092e202a9baf2949ac9df3e2038db3",
      "20260811000000_authorize_reviewed_fit_house_47_changes.sql":
        "338409d7377f99903a5026d70b3848fd3b98ba14a520836b22ae12ee94c570a3",
      "20260811010000_add_fit_house_stable_oos_validator.sql":
        "770c216405db745cbffd9260006910bdab9708664859fe22cfac56e3e0ef2169",
      "20260811020000_repair_fit_house_runtime_policy_fingerprint.sql":
        "64e76dcedbbbaa4e05823ed2e5c62cf7e58c63f13915dddfa9a48e082395cbab",
      "20260811030000_correct_reviewed_mass_gainer_metadata.sql":
        "fa34c95a734da3bd4f281a5a6d124885f86d9cbf5f539018556d67631b61b309",
      "20260811113000_add_two_reviewed_discount_multivitamin_offers.sql":
        "dfaf949e26a37f639008dd5c8d09d28a7e63a1d4c03bf04839c57ad7ff3a9783",
      "20260813170000_add_guarded_gtin_promotion.sql":
        "60114659dc4b3c8052f722a8d094768ea64ee5d11ae0afe7a9a8280c8a3ed129",
      "20260814213000_correct_critical_cookie_73g_identity.sql":
        "95bcd592f30a37072f960763b623e76911f1451440576986021a227031510f7e",
      "20260816173000_extend_guarded_gtin_promotion_exact_36.sql":
        "dd105cbcfe23116875ba8eb6aacb4c519d266088d1993eaf1ca27fb755cebccd",
      "20260817100000_rebind_whey_okay_manifest_after_creatine_merge.sql":
        "a586d67e2141d4139d7f39370e7562fb752b0ae1d9609cc730cac9b9195b74e6",
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
    ledgerCount: 114,
    ledgerFingerprint:
      "c783bd03207ff7b1e18fca8bd5dd4e2641a8330bd4b878dd3f53a68434da56a4",
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
    pending: Object.freeze([]),
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
