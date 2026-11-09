const path = require("node:path");
const { Client } = require("pg");
const { postgresClientConfig } = require("./lib/secure-postgres");
const {
  derivePostApplyMigrationBinding,
} = require("./lib/environment-migrations");
const {
  assertDerivationMatchesContract,
  catalogueCounts,
  databaseState,
  loadEnvFile,
  repositoryCloseoutForAttempt,
  validateResult,
} = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerRowsFingerprint,
  validateDatabaseOwner,
  validateSelection,
} = require("./supabase-migration-selector");

const { verifySelectedMigrationPreflight } = require("./lib/selected-migration-preflight");
const SOURCE_DIR = path.resolve(__dirname, "..", "supabase", "migrations");

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(environment|project-ref|env-file|mode)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(values.environment && values["project-ref"], "missing required arguments");
  invariant(!values.mode || ["preflight", "postflight"].includes(values.mode), "mode must be preflight or postflight");
  const production = values.environment === "PRODUCTION";
  return {
    mode: values.mode || "postflight",
    environment: values.environment,
    projectRef: values["project-ref"],
    envFile: values["env-file"]
      ? path.resolve(values["env-file"])
      : production
        ? path.join(
            process.env.USERPROFILE || "",
            ".supplementscout",
            "credentials",
            "production-owner.env",
          )
        : path.resolve(__dirname, "..", ".env.staging.audit.local"),
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const contract = CONTRACTS[options.environment];
  invariant(contract && contract.projectRef === options.projectRef, "environment contract mismatch");
  const env = loadEnvFile(options.envFile);
  invariant(env[contract.projectRefEnvironmentKey] === options.projectRef, "environment file project ref mismatch");
  invariant(env[contract.databaseUrlEnvironmentKey], "owner database URL is missing");

  const client = new Client(
    postgresClientConfig({
      connectionString: env[contract.databaseUrlEnvironmentKey],
      applicationName: "supplementscout-selected-migrations-verifier",
      defaultReadOnly: true,
      statementTimeoutMs: 120000,
    }),
  );
  await client.connect();
  try {
    await client.query("begin read only");
    const state = await databaseState(client);
    validateDatabaseOwner(contract, state.identity);
    invariant(state.identity.read_only === "on", "verification transaction is not read-only");
    invariant(
      state.databaseTarget.target_environment === options.environment &&
        state.databaseTarget.project_ref === options.projectRef &&
        state.databaseTarget.database_identity === contract.databaseIdentity,
      "database target identity mismatch",
    );
    if (options.mode === "preflight") {
      const selection = validateSelection({ environment: options.environment,
        projectRef: options.projectRef, databaseTarget: state.databaseTarget,
        remoteLedger: state.remoteLedger, sourceDir: SOURCE_DIR });
      const checks = await verifySelectedMigrationPreflight(client, contract.pending, SOURCE_DIR);
      await client.query("rollback");
      console.log(JSON.stringify({ result: "PASS", mode: "preflight", environment: options.environment,
        project_ref: options.projectRef, database_state: "CURRENT", ledger_count: state.remoteLedger.length,
        ledger_fingerprint: ledgerRowsFingerprint(state.remoteLedger, { targetEnvironment: options.environment }),
        pending_files: selection.pending_files, control_preflight: checks, database_writes: 0 }, null, 2));
      return;
    }
    const closeoutDerivation = derivePostApplyMigrationBinding(options.environment);
    assertDerivationMatchesContract(closeoutDerivation, contract);
    const ledgerFingerprint = ledgerRowsFingerprint(state.remoteLedger, {
      targetEnvironment: options.environment,
    });
    const closeout = repositoryCloseoutForAttempt({
      mode: "apply",
      committed: true,
      derivation: closeoutDerivation,
      contract,
      projectRef: options.projectRef,
      remoteLedger: state.remoteLedger,
      remoteLedgerFingerprint: ledgerFingerprint,
    });
    const schemaChecks = await validateResult(client);
    const counts = await catalogueCounts(client);
    await client.query("rollback");
    console.log(JSON.stringify({
      result: "PASS",
      environment: options.environment,
      project_ref: options.projectRef,
      database_state: closeout.closeout_status === "ALREADY_CLOSED"
        ? "CURRENT"
        : "POST_APPLY_VERIFIED",
      repository_closeout: closeout.closeout_status,
      ledger_count: closeout.readback.ledger_count,
      ledger_fingerprint: closeout.readback.ledger_fingerprint,
      applied: closeout.readback.applied,
      expected_post_ledger_count: closeoutDerivation.post_ledger_count,
      expected_post_ledger_fingerprint: closeoutDerivation.post_ledger_fingerprint,
      catalogue_counts: counts,
      schema_checks: schemaChecks,
      database_writes: 0,
    }, null, 2));
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs };
