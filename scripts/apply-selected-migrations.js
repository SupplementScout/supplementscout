const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { postgresClientConfig } = require("./lib/secure-postgres");
const {
  derivePostApplyMigrationBinding,
} = require("./lib/environment-migrations");
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
const DEFAULT_CLOSEOUT_DIR = path.join(ROOT, "tmp", "selected-migrations");
const CLOSEOUT_KIND = "selected-migration-repository-closeout-v1";
const ALLOWED_MODES = new Set(["rehearse", "apply"]);
const CATALOGUE_TABLES = Object.freeze([
  "products",
  "product_variants",
  "retailer_products",
  "offers",
  "price_history",
]);

function expectedCatalogueCounts(before, pending) {
  invariant(before && Array.isArray(pending), "catalogue count inputs are required");
  const deltas = Object.fromEntries(CATALOGUE_TABLES.map((table) => [table, 0]));
  for (const migration of pending) {
    const declared = migration.expectedCatalogueDeltas || {};
    invariant(
      declared && typeof declared === "object" && !Array.isArray(declared)
        && Object.keys(declared).every((key) => CATALOGUE_TABLES.includes(key))
        && Object.values(declared).every(Number.isInteger),
      "invalid expected catalogue deltas",
    );
    for (const [table, delta] of Object.entries(declared)) deltas[table] += delta;
  }
  return Object.fromEntries(CATALOGUE_TABLES.map((table) => {
    invariant(/^\d+$/.test(String(before[table])), `invalid before count for ${table}`);
    const expected = BigInt(before[table]) + BigInt(deltas[table]);
    invariant(expected >= 0n, `negative expected count for ${table}`);
    return [table, expected.toString()];
  }));
}

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

function appliedPendingIdentifiers(remoteLedger, pendingIdentifiers) {
  const remote = new Set(remoteLedger.map(ledgerIdentifier));
  const applied = pendingIdentifiers.filter(identifier => remote.has(identifier));
  invariant(applied.length === pendingIdentifiers.length, "post-commit migration ledger sequence mismatch");
  return applied;
}

function assertDerivationMatchesContract(derivation, contract) {
  invariant(derivation?.environment === contract?.environment, "closeout derivation environment mismatch");
  invariant(
    derivation.pre_ledger_count === contract.ledgerCount,
    "closeout pre-apply ledger count differs from the frozen contract",
  );
  invariant(
    derivation.pre_ledger_fingerprint === contract.ledgerFingerprint,
    "closeout pre-apply ledger fingerprint differs from the frozen contract",
  );
  const contractPending = contract.pending.map(({ filename, sha256 }) => ({ filename, sha256 }));
  const derivedPending = derivation.consumed_pending.map(({ filename, sha256 }) => ({ filename, sha256 }));
  invariant(
    JSON.stringify(derivedPending) === JSON.stringify(contractPending),
    "closeout pending migrations differ from the frozen contract",
  );
}

function validatePostApplyReadback(derivation, remoteLedger, actualFingerprint = null) {
  invariant(derivation && Array.isArray(remoteLedger), "post-apply readback is required");
  const identifiers = remoteLedger.map(ledgerIdentifier);
  invariant(
    identifiers.length === derivation.post_ledger_count,
    "post-commit migration ledger count mismatch",
  );
  const expectedApplied = derivation.consumed_pending.map(({ identifier }) => identifier);
  const expectedAppliedSet = new Set(expectedApplied);
  const actualApplied = identifiers.filter((identifier) => expectedAppliedSet.has(identifier));
  invariant(
    JSON.stringify(actualApplied) === JSON.stringify(expectedApplied),
    "post-commit applied migration identity sequence mismatch",
  );
  invariant(
    JSON.stringify(identifiers) === JSON.stringify(derivation.post_identifiers),
    "post-commit migration ledger identity sequence mismatch",
  );
  const fingerprint = actualFingerprint || ledgerRowsFingerprint(remoteLedger, {
    targetEnvironment: derivation.environment,
  });
  invariant(
    fingerprint === derivation.post_ledger_fingerprint,
    "post-commit migration ledger fingerprint mismatch",
  );
  return {
    ledger_count: identifiers.length,
    ledger_fingerprint: fingerprint,
    identifiers,
    applied: actualApplied,
  };
}

function repositoryCloseoutEvidence({ derivation, contract, projectRef }) {
  assertDerivationMatchesContract(derivation, contract);
  invariant(derivation.status === "CLOSEOUT_REQUIRED", "repository closeout evidence is not required");
  return {
    schema_version: 1,
    kind: CLOSEOUT_KIND,
    environment: derivation.environment,
    project_ref: projectRef,
    pre_state: {
      ledger_count: derivation.pre_ledger_count,
      ledger_fingerprint: derivation.pre_ledger_fingerprint,
    },
    consumed_pending: {
      count: derivation.pending_count,
      ordered_filenames: derivation.consumed_pending.map(({ filename }) => filename),
      ordered_identifiers: derivation.consumed_pending.map(({ identifier }) => identifier),
      ordered_sha256: derivation.consumed_pending.map(({ sha256 }) => sha256),
    },
    post_state: {
      ledger_count: derivation.post_ledger_count,
      ledger_fingerprint: derivation.post_ledger_fingerprint,
    },
    repository_updates: [
      {
        file: "scripts/lib/environment-migrations.js",
        field: `PENDING_MIGRATIONS.${derivation.environment}`,
        from: JSON.parse(JSON.stringify(contract.pending)),
        to: [],
      },
      {
        file: "scripts/supabase-migration-selector.js",
        field: `CONTRACTS.${derivation.environment}.ledgerCount`,
        from: derivation.pre_ledger_count,
        to: derivation.post_ledger_count,
      },
      {
        file: "scripts/supabase-migration-selector.js",
        field: `CONTRACTS.${derivation.environment}.ledgerFingerprint`,
        from: derivation.pre_ledger_fingerprint,
        to: derivation.post_ledger_fingerprint,
      },
    ],
    status: "CLOSEOUT_REQUIRED",
    database_writes: {
      migration_apply_count: derivation.pending_count,
    },
  };
}

function repositoryCloseoutForAttempt({
  mode,
  committed,
  derivation,
  contract,
  projectRef,
  remoteLedger = null,
  remoteLedgerFingerprint = null,
}) {
  assertDerivationMatchesContract(derivation, contract);
  if (mode === "rehearse") {
    return { closeout_status: "NOT_REQUIRED_REHEARSAL", evidence: null, readback: null };
  }
  if (!committed) {
    return { closeout_status: "NOT_GENERATED", evidence: null, readback: null };
  }
  const readback = validatePostApplyReadback(derivation, remoteLedger, remoteLedgerFingerprint);
  if (derivation.status === "ALREADY_CLOSED") {
    return { closeout_status: "ALREADY_CLOSED", evidence: null, readback };
  }
  return {
    closeout_status: "CLOSEOUT_REQUIRED",
    evidence: repositoryCloseoutEvidence({ derivation, contract, projectRef }),
    readback,
  };
}

function writeRepositoryCloseoutEvidence(evidence, outputDirectory = DEFAULT_CLOSEOUT_DIR) {
  invariant(evidence?.kind === CLOSEOUT_KIND && evidence.status === "CLOSEOUT_REQUIRED",
    "invalid repository closeout evidence");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const filename = `${evidence.environment.toLowerCase()}-${evidence.post_state.ledger_fingerprint}-repository-closeout.json`;
  const output = path.join(outputDirectory, filename);
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  return output;
}

function writeRepositoryCloseoutEvidenceIfRequired(closeout, outputDirectory = DEFAULT_CLOSEOUT_DIR) {
  if (closeout?.closeout_status === "ALREADY_CLOSED" && closeout.evidence === null) return null;
  invariant(closeout?.closeout_status === "CLOSEOUT_REQUIRED",
    "repository closeout evidence has an unsupported status");
  return writeRepositoryCloseoutEvidence(closeout.evidence, outputDirectory);
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

  const client = new Client(postgresClientConfig({
    connectionString: env[contract.databaseUrlEnvironmentKey],
    applicationName: `supplementscout-selected-migrations-${options.mode.toLowerCase()}`,
  }));
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
    const closeoutDerivation = derivePostApplyMigrationBinding(options.environment, {
      sourceDir: SOURCE_DIR,
    });
    assertDerivationMatchesContract(closeoutDerivation, contract);

    const beforeCounts = await catalogueCounts(client);
    const expectedAfterCounts = expectedCatalogueCounts(beforeCounts, contract.pending);
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
    invariant(JSON.stringify(afterCounts) === JSON.stringify(expectedAfterCounts),
      "catalogue row counts differ from exact reviewed migration deltas");

    let committedState = null;
    let closeout = repositoryCloseoutForAttempt({
      mode: options.mode,
      committed: false,
      derivation: closeoutDerivation,
      contract,
      projectRef: options.projectRef,
    });
    let closeoutEvidencePath = null;
    if (options.mode === "rehearse") {
      await client.query("rollback");
      transactionOpen = false;
    } else {
      await client.query("commit");
      transactionOpen = false;
      const afterCommitState = await databaseState(client);
      const afterCommitFingerprint = ledgerRowsFingerprint(afterCommitState.remoteLedger, {
        targetEnvironment: options.environment,
      });
      closeout = repositoryCloseoutForAttempt({
        mode: options.mode,
        committed: true,
        derivation: closeoutDerivation,
        contract,
        projectRef: options.projectRef,
        remoteLedger: afterCommitState.remoteLedger,
        remoteLedgerFingerprint: afterCommitFingerprint,
      });
      const committedCounts = await catalogueCounts(client);
      invariant(JSON.stringify(committedCounts) === JSON.stringify(expectedAfterCounts),
        "catalogue row counts differ from exact reviewed deltas after commit");
      await validateResult(client);
      committedState = {
        ledger_count: closeout.readback.ledger_count,
        ledger_fingerprint: closeout.readback.ledger_fingerprint,
        applied: closeout.readback.applied,
        catalogue_counts: committedCounts,
      };
      closeoutEvidencePath = writeRepositoryCloseoutEvidenceIfRequired(closeout);
    }

    console.log(JSON.stringify({
      result: "PASS",
      mode: options.mode,
      environment: options.environment,
      project_ref: options.projectRef,
      pending: selection.pending,
      confirmation,
      catalogue_counts_before: beforeCounts,
      catalogue_counts_expected: expectedAfterCounts,
      catalogue_counts_after: afterCounts,
      schema_checks: checks,
      committed: options.mode === "apply",
      committed_state: committedState,
      closeout_status: closeout.closeout_status,
      closeout_evidence_path: closeoutEvidencePath
        ? path.relative(ROOT, closeoutEvidencePath).replaceAll(path.sep, "/")
        : null,
      post_ledger_count: closeout.readback?.ledger_count || null,
      post_ledger_fingerprint: closeout.readback?.ledger_fingerprint || null,
      consumed_pending_count: options.mode === "apply" ? closeoutDerivation.pending_count : 0,
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
    console.error(error.position ? `${error.message} (position ${error.position})` : error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CLOSEOUT_KIND,
  DEFAULT_CLOSEOUT_DIR,
  catalogueCounts,
  databaseState,
  expectedCatalogueCounts,
  appliedPendingIdentifiers,
  assertDerivationMatchesContract,
  loadEnvFile,
  parseArgs,
  pendingConfirmation,
  repositoryCloseoutEvidence,
  repositoryCloseoutForAttempt,
  validatePostApplyReadback,
  validateResult,
  writeRepositoryCloseoutEvidence,
  writeRepositoryCloseoutEvidenceIfRequired,
  unwrapTransaction,
};
