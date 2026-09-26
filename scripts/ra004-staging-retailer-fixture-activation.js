const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const selector = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const REF = "hxnrsyyqffztlvcrtgbf";
const PRODUCTION_REF = "aftboxmrdgyhizicfsfu";
const MIGRATION = "20260926100000_create_ra004_staging_10reps_retailer.sql";
const MIGRATION_SHA = "2948af2c348ebf7cca56b2f46966a393ad022bd4cbfef0876ac9bc899a92ba0e";
const ACTIVATION = path.join(
  ROOT,
  "docs",
  "retailer-automation",
  "evidence",
  "RA-004-staging-retailer-fixture-activation.json",
);
const CONFIRMATION = "APPLY_RA004_STAGING_10REPS_2948AF2C";
const BUSINESS_TABLES = Object.freeze([
  "retailers",
  "products",
  "product_variants",
  "retailer_products",
  "offers",
  "price_history",
]);

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\bsbp_[A-Za-z0-9._-]+/g, "[REDACTED_ACCESS_TOKEN]")
    .slice(0, 500);
}

function validateRuntimeEnvironment(environment) {
  invariant(environment.RA004_FIXTURE_CONFIRM === CONFIRMATION, "RA004_FIXTURE_CONFIRMATION_MISMATCH");
  const ownerUrl = environment.RA004_FIXTURE_OWNER_DATABASE_URL;
  const accessToken = environment.RA004_FIXTURE_SUPABASE_ACCESS_TOKEN;
  const cli = environment.RA004_FIXTURE_SUPABASE_CLI_PATH;
  invariant(ownerUrl && accessToken && cli, "RA004_FIXTURE_CREDENTIAL_INPUT_MISSING");
  let parsed;
  try { parsed = new URL(ownerUrl); } catch { throw new Error("RA004_FIXTURE_DATABASE_URL_INVALID"); }
  invariant(["postgres:", "postgresql:"].includes(parsed.protocol), "RA004_FIXTURE_DATABASE_PROTOCOL_REJECTED");
  invariant(
    parsed.hostname === `db.${REF}.supabase.co`
      || /^aws-0-[a-z0-9-]+\.pooler\.supabase\.com$/.test(parsed.hostname),
    "RA004_FIXTURE_DATABASE_HOST_REJECTED",
  );
  invariant(
    parsed.username === "postgres" || parsed.username === `postgres.${REF}`,
    "RA004_FIXTURE_DATABASE_USER_REJECTED",
  );
  invariant(!ownerUrl.includes(PRODUCTION_REF), "RA004_FIXTURE_PRODUCTION_TARGET_REJECTED");
  invariant(parsed.password.length > 0, "RA004_FIXTURE_DATABASE_PASSWORD_MISSING");
  invariant(/^sbp_[A-Za-z0-9._-]{20,}$/.test(accessToken), "RA004_FIXTURE_ACCESS_TOKEN_REJECTED");
  invariant(path.isAbsolute(cli) && fs.existsSync(cli), "RA004_FIXTURE_SUPABASE_CLI_MISSING");
  return { ownerUrl, accessToken, cli, databasePassword: decodeURIComponent(parsed.password) };
}

async function readFixtureSnapshot(databaseUrl, ClientClass = Client) {
  const client = new ClientClass({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: "ra004-staging-retailer-fixture-readback",
    options: "-c default_transaction_read_only=on -c statement_timeout=30000",
  });
  await client.connect();
  try {
    await client.query("begin read only");
    const identity = (await client.query(`
      select current_user,current_setting('transaction_read_only') read_only,
             current_setting('app.safe_update',true) safe_update
    `)).rows[0];
    invariant(identity.current_user === "postgres", "RA004_FIXTURE_DATABASE_OWNER_REJECTED");
    invariant(identity.read_only === "on" && !identity.safe_update, "RA004_FIXTURE_READBACK_NOT_READ_ONLY");
    const rows = (await client.query(`
      select id::text,name,slug,website,logo,affiliate_network,affiliate_id
      from public.retailers
      where lower(name)='10 reps' or lower(slug)='10-reps'
      order by id
    `)).rows;
    const counts = (await client.query(`select ${BUSINESS_TABLES.map(
      (table) => `(select count(*)::text from public.${table}) "${table}"`,
    ).join(",")}`)).rows[0];
    await client.query("rollback");
    return { rows, counts };
  } finally {
    await client.end();
  }
}

function assertBeforeSnapshot(snapshot) {
  invariant(snapshot.rows.length === 0, "RA004_FIXTURE_RETAILER_ALREADY_PRESENT_OR_AMBIGUOUS");
  for (const table of BUSINESS_TABLES) invariant(/^\d+$/.test(snapshot.counts[table]), `RA004_FIXTURE_COUNT_INVALID_${table}`);
}

function assertAfterSnapshot(before, after) {
  invariant(after.rows.length === 1, "RA004_FIXTURE_POST_RETAILER_COUNT_MISMATCH");
  const row = after.rows[0];
  invariant(
    row.id !== "14" && row.name === "10 Reps" && row.slug === "10-reps"
      && row.website === null && row.logo === null
      && row.affiliate_network === null && row.affiliate_id === null,
    "RA004_FIXTURE_POST_RETAILER_MISMATCH",
  );
  invariant(
    BigInt(after.counts.retailers) === BigInt(before.counts.retailers) + 1n,
    "RA004_FIXTURE_RETAILER_DELTA_MISMATCH",
  );
  for (const table of BUSINESS_TABLES.filter((name) => name !== "retailers")) {
    invariant(after.counts[table] === before.counts[table], `RA004_FIXTURE_FORBIDDEN_DELTA_${table}`);
  }
  return row;
}

function runCli(cli, args, secretEnvironment, spawn = spawnSync) {
  const environment = Object.fromEntries([
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP",
    "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ComSpec",
  ].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(environment, secretEnvironment);
  const result = spawn(cli, args, {
    cwd: ROOT,
    env: environment,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
  });
  invariant(!result.error && result.status === 0, `RA004_FIXTURE_SUPABASE_CLI_FAILED_${result.status ?? "START"}`);
  return String(result.stdout || "").trim();
}

async function executeActivation({
  environment = process.env,
  selectorApi = selector,
  snapshotReader = readFixtureSnapshot,
  spawn = spawnSync,
  workdir = path.join(ROOT, "tmp", "ra004-staging-retailer-fixture-selected"),
} = {}) {
  const runtime = validateRuntimeEnvironment(environment);
  const manifest = JSON.parse(fs.readFileSync(ACTIVATION, "utf8"));
  invariant(manifest.execution.started === false && manifest.execution.application_attempt_count === 0,
    "RA004_FIXTURE_ACTIVATION_ALREADY_STARTED");

  const beforeRemote = await selectorApi.readRemoteState(runtime.ownerUrl);
  const selection = selectorApi.validateSelection({
    environment: "STAGING",
    projectRef: REF,
    databaseTarget: beforeRemote.databaseTarget,
    remoteLedger: beforeRemote.remoteLedger,
    activationManifest: manifest,
  });
  invariant(
    selection.pending_files.length === 1
      && selection.pending_file === MIGRATION
      && selection.pending_sha256 === MIGRATION_SHA,
    "RA004_FIXTURE_SELECTOR_NOT_EXACT",
  );
  selectorApi.materializeSelectedWorkdir({ selection, workdir });
  const before = await snapshotReader(runtime.ownerUrl);
  assertBeforeSnapshot(before);

  invariant(runCli(runtime.cli, ["--version"], {}, spawn) === "2.111.0", "RA004_FIXTURE_CLI_VERSION_MISMATCH");
  runCli(runtime.cli, ["link", "--project-ref", REF, "--workdir", workdir, "--yes"], {
    SUPABASE_ACCESS_TOKEN: runtime.accessToken,
  }, spawn);
  let applicationAttemptCount = 0;
  applicationAttemptCount += 1;
  runCli(runtime.cli, ["db", "push", "--linked", "--workdir", workdir, "--yes"], {
    SUPABASE_ACCESS_TOKEN: runtime.accessToken,
    SUPABASE_DB_PASSWORD: runtime.databasePassword,
  }, spawn);
  invariant(applicationAttemptCount === 1, "RA004_FIXTURE_APPLICATION_ATTEMPT_MISMATCH");

  const afterRemote = await selectorApi.readRemoteState(runtime.ownerUrl);
  const postSelection = selectorApi.validateSelection({
    environment: "STAGING",
    projectRef: REF,
    databaseTarget: afterRemote.databaseTarget,
    remoteLedger: afterRemote.remoteLedger,
  });
  invariant(
    postSelection.ledger_count === manifest.post_activation_ledger.count
      && postSelection.ledger_fingerprint === manifest.post_activation_ledger.fingerprint,
    "RA004_FIXTURE_POST_LEDGER_MISMATCH",
  );
  const after = await snapshotReader(runtime.ownerUrl);
  const retailer = assertAfterSnapshot(before, after);
  return {
    status: "VERIFIED_COMPLETE",
    activation_id: manifest.activation_id,
    project_ref: REF,
    migration: MIGRATION,
    migration_sha256: MIGRATION_SHA,
    application_attempt_count: applicationAttemptCount,
    ledger_count_before: beforeRemote.remoteLedger.length,
    ledger_count_after: afterRemote.remoteLedger.length,
    ledger_fingerprint_after: postSelection.ledger_fingerprint,
    retailer: { id: retailer.id, name: retailer.name, slug: retailer.slug },
    row_count_deltas: Object.fromEntries(BUSINESS_TABLES.map((table) => [
      table,
      (BigInt(after.counts[table]) - BigInt(before.counts[table])).toString(),
    ])),
    production_actions: 0,
    canary_actions: 0,
  };
}

if (require.main === module) {
  executeActivation()
    .then((receipt) => process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${redact(error.message)}\n`);
      process.exitCode = 1;
    })
    .finally(() => {
      process.env.RA004_FIXTURE_OWNER_DATABASE_URL = "";
      process.env.RA004_FIXTURE_SUPABASE_ACCESS_TOKEN = "";
    });
}

module.exports = {
  ACTIVATION,
  BUSINESS_TABLES,
  CONFIRMATION,
  MIGRATION,
  MIGRATION_SHA,
  REF,
  assertAfterSnapshot,
  assertBeforeSnapshot,
  executeActivation,
  readFixtureSnapshot,
  redact,
  runCli,
  validateRuntimeEnvironment,
};
