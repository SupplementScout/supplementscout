const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const {
  catalogueCounts,
  databaseState,
  loadEnvFile,
  unwrapTransaction,
} = require("./apply-selected-migrations");
const {
  CONTRACTS,
  ledgerIdentifier,
  ledgerRowsFingerprint,
  sha256File,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const PREPARATION_PATH = path.join(
  ROOT,
  "docs",
  "retailer-automation",
  "evidence",
  "RA-STAB-01-PRODUCTION-RECOVERY-PREPARATION.json",
);
const PHASES = new Set(["status", "schema-deploy", "schema-verify", "control-close", "control-verify"]);
const WRITE_PHASES = new Set(["schema-deploy", "control-close"]);
const AUTHORIZATION_PHASES = Object.freeze({
  "schema-deploy": "SCHEMA_DEPLOYMENT",
  "control-close": "CONTROL_RECOVERY",
});
const PRODUCTION = CONTRACTS.PRODUCTION;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function preparationSha256(file = PREPARATION_PATH) {
  return sha256(fs.readFileSync(file));
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validatePreparation(preparation, file = PREPARATION_PATH) {
  invariant(preparation?.schema_version === "ra-stab-01-production-sequential-close-preparation-v1", "preparation schema mismatch");
  invariant(preparation?.status === "NOT_AUTHORIZED", "preparation must remain NOT_AUTHORIZED");
  invariant(preparation?.task_id === "RA-STAB-01", "preparation task mismatch");
  invariant(preparation?.target?.environment === "PRODUCTION", "preparation environment mismatch");
  invariant(preparation?.target?.project_ref === PRODUCTION.projectRef, "preparation project mismatch");
  invariant(preparation?.target?.database_identity === PRODUCTION.databaseIdentity, "preparation database identity mismatch");
  invariant(preparation?.fresh_readback?.pre_migration_ledger_count === PRODUCTION.ledgerCount, "pre-migration ledger count mismatch");
  invariant(preparation?.fresh_readback?.pre_migration_ledger_fingerprint === PRODUCTION.ledgerFingerprint, "pre-migration ledger fingerprint mismatch");
  invariant(preparation?.fresh_readback?.post_migration_ledger_count === PRODUCTION.ledgerCount + 1, "post-migration ledger count mismatch");
  invariant(/^[0-9a-f]{64}$/.test(preparation?.fresh_readback?.post_migration_ledger_fingerprint), "post-migration ledger fingerprint invalid");
  invariant(exactKeys(preparation?.fresh_readback?.business_counts, ["products", "product_variants", "retailer_products", "offers", "price_history"]), "business count keys mismatch");
  invariant(Object.values(preparation.fresh_readback.business_counts).every(value => /^\d+$/.test(value)), "business counts invalid");
  invariant(preparation?.migration?.ordinary_selector_status === "EXCLUDED", "recovery migration must stay outside the ordinary selector");
  invariant(preparation?.migration?.maximum_attempts === 1 && preparation?.migration?.automatic_retry === false, "migration retry contract mismatch");
  invariant(preparation?.authorization?.production_schema_write === false, "preparation must not authorize schema writes");
  invariant(preparation?.authorization?.production_control_write === false, "preparation must not authorize control writes");
  invariant(preparation?.authorization?.business_write === false, "business writes must remain forbidden");
  invariant(preparation?.execution?.automatic_transition_between_phases === false, "automatic phase transition must remain disabled");
  const migrationPath = path.join(ROOT, "supabase", "migrations", preparation.migration.filename);
  invariant(sha256File(migrationPath) === preparation.migration.sha256, "recovery migration hash mismatch");
  return { preparation, preparationPath: file, preparationSha256: preparationSha256(file), migrationPath };
}

function authorizationScope(preparation, phase) {
  if (phase === "SCHEMA_DEPLOYMENT") {
    return {
      migration_filename: preparation.migration.filename,
      migration_sha256: preparation.migration.sha256,
      pre_ledger_fingerprint: preparation.fresh_readback.pre_migration_ledger_fingerprint,
      post_ledger_fingerprint: preparation.fresh_readback.post_migration_ledger_fingerprint,
    };
  }
  return {
    approval_id: preparation.control_target.approval_id,
    parent_plan_id: preparation.control_target.parent_plan_id,
    child_plan_id: preparation.control_target.approved_child_id,
    post_ledger_fingerprint: preparation.fresh_readback.post_migration_ledger_fingerprint,
  };
}

function phaseConfirmation(preparationHash, preparation, phase) {
  return sha256(canonicalJson({
    phase,
    preparation_sha256: preparationHash,
    scope: authorizationScope(preparation, phase),
  })).slice(0, 20);
}

function validateAuthorization(authorization, context, cliConfirmation, now = new Date()) {
  const phase = AUTHORIZATION_PHASES[context.phase];
  invariant(phase, "authorization is accepted only for a write phase");
  invariant(exactKeys(authorization, [
    "schema_version", "status", "task_id", "phase", "preparation_sha256", "target",
    "scope", "scope_fingerprint", "business_write", "maximum_attempts", "automatic_retry",
    "automatic_next_phase", "authorized_by", "authorized_at", "expires_at", "confirmation",
  ]), "authorization keys mismatch");
  invariant(authorization.schema_version === "ra-stab-01-phase-authorization-v1", "authorization schema mismatch");
  invariant(authorization.status === "OWNER_AUTHORIZED", "phase is not owner authorized");
  invariant(authorization.task_id === "RA-STAB-01" && authorization.phase === phase, "authorization phase mismatch");
  invariant(authorization.preparation_sha256 === context.preparationSha256, "authorization preparation hash mismatch");
  invariant(canonicalJson(authorization.target) === canonicalJson(context.preparation.target), "authorization target mismatch");
  const expectedScope = authorizationScope(context.preparation, phase);
  invariant(canonicalJson(authorization.scope) === canonicalJson(expectedScope), "authorization scope mismatch");
  invariant(authorization.scope_fingerprint === sha256(canonicalJson(expectedScope)), "authorization scope fingerprint mismatch");
  invariant(authorization.business_write === false, "authorization must forbid business writes");
  invariant(authorization.maximum_attempts === 1 && authorization.automatic_retry === false, "authorization must be one-shot without retry");
  invariant(authorization.automatic_next_phase === false, "authorization must not chain phases");
  invariant(typeof authorization.authorized_by === "string" && authorization.authorized_by.trim(), "authorization actor is required");
  const authorizedAt = Date.parse(authorization.authorized_at);
  const expiresAt = Date.parse(authorization.expires_at);
  invariant(Number.isFinite(authorizedAt) && Number.isFinite(expiresAt), "authorization timestamps invalid");
  invariant(expiresAt > now.getTime() && expiresAt <= authorizedAt + 24 * 60 * 60 * 1000, "authorization is expired or too broad");
  const expectedConfirmation = phaseConfirmation(context.preparationSha256, context.preparation, phase);
  invariant(authorization.confirmation === expectedConfirmation && cliConfirmation === expectedConfirmation, `confirmation must equal ${expectedConfirmation}`);
  return authorization;
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["phase", "authorization-file", "confirm"]);
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.+)$/);
    invariant(match && allowed.has(match[1]) && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  const phase = values.phase || "status";
  invariant(PHASES.has(phase), `unsupported phase ${phase}`);
  if (WRITE_PHASES.has(phase)) invariant(values["authorization-file"] && values.confirm, `${phase} requires authorization file and confirmation`);
  else invariant(!values["authorization-file"] && !values.confirm, `${phase} does not accept authorization or confirmation`);
  return {
    phase,
    authorizationFile: values["authorization-file"] ? path.resolve(values["authorization-file"]) : null,
    confirm: values.confirm || null,
  };
}

function credential(kind) {
  const file = path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", `production-${kind}.env`);
  const values = loadEnvFile(file);
  const raw = kind === "owner"
    ? values[PRODUCTION.databaseUrlEnvironmentKey]
    : Object.entries(values).find(([name]) => name.endsWith("_DATABASE_URL"))?.[1];
  invariant(raw, `missing production ${kind} database URL`);
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  invariant(url.href.includes(PRODUCTION.projectRef), `production ${kind} target mismatch`);
  return url.href;
}

function createClient(connectionString, applicationName, readOnly = false) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: applicationName,
    ...(readOnly ? { options: "-c default_transaction_read_only=on" } : {}),
  });
}

function assertCounts(actual, preparation) {
  invariant(canonicalJson(actual) === canonicalJson(preparation.fresh_readback.business_counts), "business catalogue counts drifted");
}

function assertLedger(state, count, fingerprint) {
  invariant(state.remoteLedger.length === count, `ledger count mismatch: expected ${count}, received ${state.remoteLedger.length}`);
  invariant(ledgerRowsFingerprint(state.remoteLedger, { targetEnvironment: "PRODUCTION" }) === fingerprint, "ledger fingerprint mismatch");
}

async function assertProductionOwner(client) {
  const state = await databaseState(client);
  validateDatabaseOwner(PRODUCTION, state.identity);
  invariant(state.databaseTarget?.target_environment === "PRODUCTION", "database environment mismatch");
  invariant(state.databaseTarget?.project_ref === PRODUCTION.projectRef, "database project mismatch");
  invariant(state.databaseTarget?.database_identity === PRODUCTION.databaseIdentity, "database identity mismatch");
  return state;
}

async function deploySchema(context, dependencies) {
  const { preparation, migrationPath } = context;
  const sql = fs.readFileSync(migrationPath, "utf8");
  const body = unwrapTransaction(sql, preparation.migration.filename);
  const identifier = preparation.migration.filename.slice(0, -4);
  const split = identifier.indexOf("_");
  const client = dependencies.createClient(dependencies.credential("owner"), "ra-stab-01-schema-deploy");
  await client.connect();
  let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:selected-migrations',0))");
    const beforeState = await assertProductionOwner(client);
    invariant(beforeState.identity.read_only === "off", "schema deployment transaction is read-only");
    invariant(!beforeState.identity.safe_update, "database SAFE_UPDATE must be unset");
    assertLedger(beforeState, preparation.fresh_readback.pre_migration_ledger_count, preparation.fresh_readback.pre_migration_ledger_fingerprint);
    assertCounts(await catalogueCounts(client), preparation);
    await client.query(body);
    await client.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])",
      [identifier.slice(0, split), identifier.slice(split + 1), [sql]],
    );
    const afterState = await databaseState(client);
    assertLedger(afterState, preparation.fresh_readback.post_migration_ledger_count, preparation.fresh_readback.post_migration_ledger_fingerprint);
    assertCounts(await catalogueCounts(client), preparation);
    await client.query("commit"); open = false;
    const committedState = await assertProductionOwner(client);
    assertLedger(committedState, preparation.fresh_readback.post_migration_ledger_count, preparation.fresh_readback.post_migration_ledger_fingerprint);
    assertCounts(await catalogueCounts(client), preparation);
    return { result: "PASS", phase: "SCHEMA_DEPLOYMENT", committed: true, ledger_count: committedState.remoteLedger.length };
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function verifySchema(context, dependencies) {
  const { preparation } = context;
  const client = dependencies.createClient(dependencies.credential("owner"), "ra-stab-01-schema-verify", true);
  await client.connect();
  try {
    await client.query("begin read only");
    const state = await assertProductionOwner(client);
    assertLedger(state, preparation.fresh_readback.post_migration_ledger_count, preparation.fresh_readback.post_migration_ledger_fingerprint);
    assertCounts(await catalogueCounts(client), preparation);
    const identifier = preparation.migration.filename.slice(0, -4);
    const split = identifier.indexOf("_");
    const row = (await client.query(
      "select statements from supabase_migrations.schema_migrations where version=$1 and name=$2",
      [identifier.slice(0, split), identifier.slice(split + 1)],
    )).rows[0];
    invariant(row?.statements?.length === 1 && sha256(row.statements[0].replaceAll("\r\n", "\n")) === preparation.migration.sha256, "deployed migration evidence mismatch");
    const rpc = (await client.query("select to_regprocedure('public.close_expired_retailer_offer_sync_approval(jsonb)') is not null rpc_exists")).rows[0];
    invariant(rpc?.rpc_exists === true, "close RPC is missing");
    await client.query("rollback");
    return { result: "PASS", phase: "SCHEMA_VERIFICATION", writes: 0, ledger_count: state.remoteLedger.length };
  } finally {
    await client.end();
  }
}

async function readControlState(context, dependencies) {
  const client = dependencies.createClient(dependencies.credential("owner"), "ra-stab-01-control-readback", true);
  await client.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const state = await assertProductionOwner(client);
    assertLedger(state, context.preparation.fresh_readback.post_migration_ledger_count, context.preparation.fresh_readback.post_migration_ledger_fingerprint);
    const counts = await catalogueCounts(client);
    assertCounts(counts, context.preparation);
    const target = context.preparation.control_target;
    const result = (await client.query(`
      select p.id::text parent_plan_id,p.parent_plan_fingerprint,p.retailer_id::text retailer_id,p.status parent_status,
             public.retailer_catalogue_sha256_json(p.child_manifest) child_manifest_fingerprint,
             c.id::text child_plan_id,c.child_plan_fingerprint,c.status child_status,
             a.id::text approval_id,a.artifact_fingerprint,a.execution_fingerprint,
             a.expected_migration_fingerprint,a.closed_at,a.consumed_at,
             (select count(*)::int from public.retailer_catalogue_child_plans x where x.parent_plan_id=p.id) child_count,
             (select count(*)::int from public.retailer_catalogue_child_plans x where x.parent_plan_id=p.id and x.status='APPROVED') approved_child_count,
             (select count(*)::int from public.retailer_catalogue_child_plans x where x.parent_plan_id=p.id and x.status='PLANNED') planned_child_count,
             (select count(*)::int from public.retailer_catalogue_child_plans x where x.parent_plan_id=p.id and x.status='EXPIRED') expired_child_count,
             (select count(*)::int from public.retailer_catalogue_apply_runs x where x.parent_plan_id=p.id) apply_runs,
             (select count(*)::int from public.approved_import_plans x join public.retailer_catalogue_child_plans y on y.child_plan_fingerprint=x.artifact_sha256 where y.parent_plan_id=p.id and x.source='retailer_offer_mixed_batch') row_approvals,
             (select count(*)::int from public.retailer_offer_sync_batch_approvals x join public.retailer_catalogue_child_plans y on y.id=x.child_plan_id where y.parent_plan_id=p.id) batch_approvals,
             (select count(*)::int from public.retailer_catalogue_production_recovery_manifests x join public.retailer_catalogue_child_plans y on y.id=x.child_plan_id where y.parent_plan_id=p.id) recovery_manifests,
             (select count(*)::int from public.retailer_catalogue_production_recovery_approvals x join public.retailer_catalogue_production_recovery_manifests m on m.id=x.recovery_manifest_id join public.retailer_catalogue_child_plans y on y.id=m.child_plan_id where y.parent_plan_id=p.id) recovery_approvals,
             (select count(*)::int from public.retailer_catalogue_production_recovery_audit x join public.retailer_catalogue_production_recovery_manifests m on m.id=x.recovery_manifest_id join public.retailer_catalogue_child_plans y on y.id=m.child_plan_id where y.parent_plan_id=p.id) recovery_audit
      from public.retailer_catalogue_parent_plans p
      join public.retailer_catalogue_child_plans c on c.id=$2::uuid and c.parent_plan_id=p.id
      join public.retailer_offer_sync_batch_approvals a on a.id=$3::uuid and a.child_plan_id=c.id
      where p.id=$1::uuid
    `, [target.parent_plan_id, target.approved_child_id, target.approval_id])).rows[0];
    await client.query("rollback");
    invariant(result, "control target not found");
    return { state, counts, target: result };
  } finally {
    await client.end();
  }
}

function assertPreClose(readback, preparation) {
  const actual = readback.target;
  const expected = preparation.control_target;
  invariant(actual.retailer_id === expected.retailer_id, "control retailer drifted");
  invariant(actual.child_manifest_fingerprint === expected.child_manifest_fingerprint, "control child manifest drifted");
  for (const field of ["parent_plan_id", "parent_plan_fingerprint", "child_plan_id", "child_plan_fingerprint", "approval_id", "execution_fingerprint"])
    invariant(actual[field] === ({ child_plan_id: expected.approved_child_id, child_plan_fingerprint: expected.approved_child_fingerprint, ...expected })[field], `control ${field} drifted`);
  invariant(actual.artifact_fingerprint === expected.approved_child_fingerprint, "approval artifact fingerprint drifted");
  invariant(actual.expected_migration_fingerprint === expected.approval_expected_migration_fingerprint, "approval ledger binding drifted");
  invariant(actual.parent_status === "APPROVED" && actual.child_status === "APPROVED", "control target is not approved");
  invariant(!actual.closed_at && !actual.consumed_at, "control approval is closed or consumed");
  invariant(actual.child_count === expected.child_count && actual.approved_child_count === expected.approved_child_count && actual.planned_child_count === expected.planned_child_count, "control child state drifted");
  invariant(actual.batch_approvals === expected.batch_approvals, "batch approval count drifted");
  invariant(actual.apply_runs === 0 && actual.row_approvals === 0, "execution evidence exists; close is forbidden");
  invariant(actual.recovery_manifests === 0 && actual.recovery_approvals === 0 && actual.recovery_audit === 0, "recovery evidence exists; close is forbidden");
}

function assertPostClose(readback, preparation) {
  const actual = readback.target;
  invariant(actual.parent_status === "EXPIRED" && actual.child_status === "EXPIRED", "control target is not expired");
  invariant(actual.expired_child_count === preparation.expected_result.expired_child_count, "not all children are expired");
  invariant(actual.approved_child_count === 0 && actual.planned_child_count === 0, "active children remain after close");
  invariant(actual.closed_at && !actual.consumed_at, "approval close evidence mismatch");
  invariant(actual.apply_runs === 0 && actual.row_approvals === 0, "execution evidence appeared after close");
  invariant(actual.recovery_manifests === 0 && actual.recovery_approvals === 0 && actual.recovery_audit === 0, "recovery evidence appeared after close");
}

function closeRequest(readback, preparation, now = new Date()) {
  const target = preparation.control_target;
  const request = {
    schema_version: 1,
    approval_id: target.approval_id,
    parent_plan_id: target.parent_plan_id,
    child_plan_id: target.approved_child_id,
    parent_plan_fingerprint: target.parent_plan_fingerprint,
    child_plan_fingerprint: target.approved_child_fingerprint,
    artifact_fingerprint: target.approved_child_fingerprint,
    execution_fingerprint: target.execution_fingerprint,
    approval_expected_migration_fingerprint: target.approval_expected_migration_fingerprint,
    expected_migration_versions: readback.state.remoteLedger.map(ledgerIdentifier),
    expected_migration_fingerprint: preparation.fresh_readback.post_migration_ledger_fingerprint,
    migration_fingerprint_algorithm: "SHA-256",
    migration_fingerprint_version: "RSBI-CJ1",
    target_environment: "PRODUCTION",
    production_project_ref: preparation.target.project_ref,
    production_database_identity: preparation.target.database_identity,
    reason: "RA-STAB-01: close exact expired unexecuted sequential control tree; no business writes",
    closed_by: "supplementscout-owner-approved-ra-stab-01",
    requested_at: now.toISOString(),
    request_fingerprint: null,
  };
  request.request_fingerprint = sha256(canonicalJson(request));
  return request;
}

async function closeControl(context, dependencies) {
  const readback = await readControlState(context, dependencies);
  assertPreClose(readback, context.preparation);
  const request = closeRequest(readback, context.preparation, dependencies.now());
  const client = dependencies.createClient(dependencies.credential("approver"), "ra-stab-01-control-close");
  await client.connect();
  let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query("set local role retailer_catalogue_production_approver");
    const identity = (await client.query("select current_user,session_user")).rows[0];
    invariant(identity?.current_user === "retailer_catalogue_production_approver", "production approver role mismatch");
    const result = (await client.query("select public.close_expired_retailer_offer_sync_approval($1::jsonb) result", [request])).rows[0]?.result;
    invariant(result?.status === "EXPIRED" && result.already_closed === false, "control close result mismatch");
    invariant(Number(result.expired_child_count) === context.preparation.expected_result.expired_child_count, "expired child count mismatch");
    invariant(Number(result.control_writes) === context.preparation.expected_result.control_writes, "control write count mismatch");
    invariant(Number(result.business_writes) === 0 && Number(result.price_history_writes) === 0, "business write boundary violated");
    await client.query("commit"); open = false;
    const verified = await readControlState(context, dependencies);
    assertPostClose(verified, context.preparation);
    return { result: "PASS", phase: "CONTROL_RECOVERY", close: result, postflight: { writes: 0, expired_child_count: verified.target.expired_child_count } };
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function verifyControl(context, dependencies) {
  const readback = await readControlState(context, dependencies);
  assertPostClose(readback, context.preparation);
  return { result: "PASS", phase: "CONTROL_VERIFICATION", writes: 0, expired_child_count: readback.target.expired_child_count };
}

async function run(argv = process.argv.slice(2), overrides = {}) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const preparationPath = overrides.preparationPath || PREPARATION_PATH;
  const context = { phase: options.phase, ...validatePreparation(readJson(preparationPath), preparationPath) };
  const confirmations = Object.fromEntries(Object.values(AUTHORIZATION_PHASES).map(phase => [phase, phaseConfirmation(context.preparationSha256, context.preparation, phase)]));
  if (options.phase === "status") return { result: "PASS", phase: "STATUS", writes: 0, status: context.preparation.status, preparation_sha256: context.preparationSha256, confirmations };

  const dependencies = {
    credential,
    createClient,
    now: () => new Date(),
    ...overrides,
  };
  if (WRITE_PHASES.has(options.phase)) {
    const authorization = readJson(options.authorizationFile);
    validateAuthorization(authorization, context, options.confirm, dependencies.now());
  }
  if (options.phase === "schema-deploy") return deploySchema(context, dependencies);
  if (options.phase === "schema-verify") return verifySchema(context, dependencies);
  if (options.phase === "control-close") return closeControl(context, dependencies);
  return verifyControl(context, dependencies);
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = {
  AUTHORIZATION_PHASES,
  PREPARATION_PATH,
  authorizationScope,
  closeRequest,
  parseArgs,
  phaseConfirmation,
  run,
  validateAuthorization,
  validatePreparation,
};
