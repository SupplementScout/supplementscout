const path = require("node:path");
const { Client } = require("pg");
const {
  catalogueCounts,
  databaseState,
  loadEnvFile,
  validateResult,
} = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(environment|project-ref|env-file)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(values.environment && values["project-ref"], "missing required arguments");
  const production = values.environment === "PRODUCTION";
  return {
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

  const client = new Client({
    connectionString: env[contract.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-selected-migrations-verifier",
    options: "-c default_transaction_read_only=on -c statement_timeout=120000",
  });
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
    invariant(
      state.remoteLedger.length === contract.ledgerCount + contract.pending.length,
      "post-migration ledger count mismatch",
    );
    const expected = contract.pending.map(({ filename }) => filename.slice(0, -4));
    const applied = expected.length
      ? state.remoteLedger.slice(-expected.length).map(ledgerIdentifier)
      : [];
    invariant(
      JSON.stringify(applied) === JSON.stringify(expected),
      "applied migration sequence mismatch",
    );
    const schemaChecks = await validateResult(client);
    const counts = await catalogueCounts(client);
    await client.query("rollback");
    console.log(JSON.stringify({
      result: "PASS",
      environment: options.environment,
      project_ref: options.projectRef,
      ledger_count: state.remoteLedger.length,
      ledger_fingerprint: ledgerRowsFingerprint(state.remoteLedger),
      applied,
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
