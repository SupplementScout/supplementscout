const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  sha256File,
  validateDatabaseOwner,
  validateSelection,
} = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "supabase", "migrations");
const ALLOWED_MODES = new Set(["rehearse", "apply"]);
const CATALOGUE_TABLES = Object.freeze([
  "products",
  "product_variants",
  "retailer_products",
  "offers",
  "price_history",
]);

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["environment", "project-ref", "mode", "env-file", "confirm"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(
      match && allowed.has(match[1]) && values[match[1]] === undefined,
      `invalid argument ${argument}`,
    );
    values[match[1]] = match[2];
  }
  invariant(values.environment && values["project-ref"] && values.mode, "missing required arguments");
  invariant(ALLOWED_MODES.has(values.mode), "mode must be rehearse or apply");

  const production = values.environment === "PRODUCTION";
  return {
    environment: values.environment,
    projectRef: values["project-ref"],
    mode: values.mode,
    confirm: values.confirm || null,
    envFile: values["env-file"]
      ? path.resolve(values["env-file"])
      : production
        ? path.join(
            process.env.USERPROFILE || "",
            ".supplementscout",
            "credentials",
            "production-owner.env",
          )
        : path.join(ROOT, ".env.staging.audit.local"),
  };
}

function loadEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function pendingConfirmation(contract) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(contract.pending))
    .digest("hex")
    .slice(0, 16);
}

function unwrapTransaction(sql, filename) {
  const match = sql.match(/^\s*begin\s*;\s*([\s\S]*?)\s*commit\s*;\s*$/i);
  invariant(match, `${filename} must have one explicit begin/commit wrapper`);
  invariant(!/\b(begin|commit|rollback)\s*;/i.test(match[1]), `${filename} contains a nested transaction`);
  return match[1];
}

async function databaseState(client) {
  const identity = (await client.query(`
    select current_user,current_database(),
           current_setting('transaction_read_only') read_only,
           current_setting('app.safe_update',true) safe_update
  `)).rows[0];
  const databaseTarget = (await client.query(
    "select public.retailer_catalogue_actual_database_target() target",
  )).rows[0].target;
  const remoteLedger = (await client.query(`
    select version,name
    from supabase_migrations.schema_migrations
    order by version
  `)).rows;
  return { identity, databaseTarget, remoteLedger };
}

async function catalogueCounts(client) {
  const expressions = CATALOGUE_TABLES.map(
    (table) => `(select count(*)::bigint from public.${table}) "${table}"`,
  );
  return (await client.query(`select ${expressions.join(",")}`)).rows[0];
}

async function validateResult(client) {
  const result = (await client.query(`
    select
      to_regclass('public.product_match_review_queue') is not null queue_exists,
      exists(
        select 1 from information_schema.columns
        where table_schema='public'
          and table_name='ignored_duplicate_product_pairs'
          and column_name='decision'
      ) duplicate_decision_exists,
      not has_table_privilege('anon','public.product_match_review_queue','select') anon_cannot_read_queue,
      not has_table_privilege('authenticated','public.product_match_review_queue','select') authenticated_cannot_read_queue
  `)).rows[0];
  invariant(Object.values(result).every(Boolean), "post-migration schema or permission check failed");
  return result;
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const contract = CONTRACTS[options.environment];
  invariant(contract, `unsupported environment ${options.environment}`);
  invariant(options.projectRef === contract.projectRef, "project ref mismatch");
  invariant(contract.pending.length > 0, "there are no reviewed pending migrations");

  const confirmation = pendingConfirmation(contract);
  if (options.mode === "apply") {
    invariant(options.confirm === confirmation, `apply confirmation must equal ${confirmation}`);
  } else {
    invariant(options.confirm === null, "rehearsal does not accept apply confirmation");
  }

  const env = loadEnvFile(options.envFile);
  invariant(env[contract.projectRefEnvironmentKey] === options.projectRef, "environment file project ref mismatch");
  invariant(env[contract.databaseUrlEnvironmentKey], "owner database URL is missing");

  const pendingSql = contract.pending.map((pending) => {
    const filename = pending.filename;
    const file = path.join(SOURCE_DIR, filename);
    invariant(sha256File(file) === pending.sha256, `migration hash mismatch: ${filename}`);
    return {
      ...pending,
      sql: fs.readFileSync(file, "utf8"),
      body: unwrapTransaction(fs.readFileSync(file, "utf8"), filename),
    };
  });

  const client = new Client({
    connectionString: env[contract.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: `supplementscout-selected-migrations-${options.mode.toLowerCase()}`,
  });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('supplementscout:selected-migrations',0))",
    );

    const beforeState = await databaseState(client);
    validateDatabaseOwner(contract, beforeState.identity);
    invariant(beforeState.identity.read_only === "off", "migration transaction is read-only");
    invariant(!beforeState.identity.safe_update, "database SAFE_UPDATE must be unset");
    const selection = validateSelection({
      environment: options.environment,
      projectRef: options.projectRef,
      databaseTarget: beforeState.databaseTarget,
      remoteLedger: beforeState.remoteLedger,
      sourceDir: SOURCE_DIR,
    });
    invariant(
      JSON.stringify(selection.pending_files) ===
        JSON.stringify(contract.pending.map(({ filename }) => filename)),
      "validated pending migrations differ from the contract",
    );

    const beforeCounts = await catalogueCounts(client);
    for (const migration of pendingSql) {
      const identifier = migration.filename.slice(0, -4);
      const split = identifier.indexOf("_");
      await client.query(migration.body);
      await client.query(
        `insert into supabase_migrations.schema_migrations(version,name,statements)
         values($1,$2,$3::text[])`,
        [
          identifier.slice(0, split),
          identifier.slice(split + 1),
          [migration.sql],
        ],
      );
    }

    const checks = await validateResult(client);
    const afterCounts = await catalogueCounts(client);
    invariant(
      JSON.stringify(afterCounts) === JSON.stringify(beforeCounts),
      "catalogue row counts changed during schema migration",
    );

    let committedState = null;
    if (options.mode === "rehearse") {
      await client.query("rollback");
      transactionOpen = false;
    } else {
      await client.query("commit");
      transactionOpen = false;
      const afterCommitState = await databaseState(client);
      const expectedLedgerCount =
        beforeState.remoteLedger.length + contract.pending.length;
      invariant(
        afterCommitState.remoteLedger.length === expectedLedgerCount,
        "post-commit migration ledger count mismatch",
      );
      const applied = afterCommitState.remoteLedger
        .slice(-contract.pending.length)
        .map(ledgerIdentifier);
      invariant(
        JSON.stringify(applied) === JSON.stringify(selection.pending),
        "post-commit migration ledger sequence mismatch",
      );
      const committedCounts = await catalogueCounts(client);
      invariant(
        JSON.stringify(committedCounts) === JSON.stringify(beforeCounts),
        "catalogue row counts changed after commit",
      );
      await validateResult(client);
      committedState = {
        ledger_count: afterCommitState.remoteLedger.length,
        ledger_fingerprint: ledgerRowsFingerprint(afterCommitState.remoteLedger),
        applied,
        catalogue_counts: committedCounts,
      };
    }

    console.log(JSON.stringify({
      result: "PASS",
      mode: options.mode,
      environment: options.environment,
      project_ref: options.projectRef,
      pending: selection.pending,
      confirmation,
      catalogue_counts_before: beforeCounts,
      catalogue_counts_after: afterCounts,
      schema_checks: checks,
      committed: options.mode === "apply",
      committed_state: committedState,
    }, null, 2));
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => {});
    throw error;
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

module.exports = {
  catalogueCounts,
  databaseState,
  loadEnvFile,
  parseArgs,
  pendingConfirmation,
  validateResult,
  unwrapTransaction,
};
