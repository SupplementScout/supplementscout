const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { writeOnce } = require("./lib/immutable-evidence");
const { loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, ledgerRowsFingerprint, validateDatabaseOwner } = require("./supabase-migration-selector");
const { scram, validateOwnerUrl } = require("./ra-stab-01-control-plan-credential-issuer");
const { validateReadback, validateTlsCa } = require("./ra-stab-01-control-plan-readback");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION = CONTRACTS.PRODUCTION;
const ROLE = "retailer_control_plan_readback_caller";
const RPC = "retailer_readback.read_control_plan_status_v1(uuid)";
const MIGRATION_VERSION = "20261004120000";
const MIGRATION_NAME = "add_central_control_plan_readback";
const MIGRATION_SHA256 = "cdcad9de57122fd4a78b8fd3cdad4ba19558e7981861c585e2e4fdeef816a3d8";
const PREPARATION_PATH = path.join(ROOT, "docs", "retailer-automation", "evidence",
  "RA-STAB-01-10REPS-CENTRAL-READBACK-PREPARATION-V4-2026-10-04.json");
const OUTPUT_DIR = path.join(ROOT, "tmp", "control-plan-readbacks");
const ATTEMPT_PATH = path.join(OUTPUT_DIR, "10reps-central-v4-2026-10-04.attempt.json");
const PROVISIONAL_PATH = path.join(OUTPUT_DIR, "10reps-central-v4-2026-10-04.pending.json");
const RECEIPT_PATH = path.join(OUTPUT_DIR, "10reps-central-v4-2026-10-04.receipt.json");

function invariant(value, code) { if (!value) throw new Error(code); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function sourceHash(file) {
  const bytes = fs.readFileSync(file);
  return sha256(Buffer.from([...bytes].filter((byte, index) => byte !== 13 || bytes[index + 1] !== 10)));
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validatePreparation(value) {
  invariant(exactKeys(value, ["schema_version", "status", "task_id", "target", "scope",
    "owner_authorization", "execution", "implementation"]), "CENTRAL_V4_PREPARATION_KEYS_INVALID");
  invariant(value.schema_version === "ra-stab-central-readback-preparation-v2"
    && value.status === "OWNER_AUTHORIZED_ONE_SHOT" && value.task_id === "RA-STAB-01",
  "CENTRAL_V4_PREPARATION_INVALID");
  invariant(value.target?.environment === "PRODUCTION" && value.target.project_ref === PRODUCTION.projectRef
    && value.target.database_identity === PRODUCTION.databaseIdentity, "CENTRAL_V4_TARGET_INVALID");
  invariant(value.scope?.operation === "READ_ONLY_CONTROL_PLAN_STATUS"
    && value.scope.retailer_id === "14" && value.scope.retailer_name === "10 Reps"
    && value.scope.parent_plan_id === "06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa"
    && /^[0-9a-f]{64}$/.test(value.scope.parent_plan_fingerprint)
    && value.scope.expected_child_count === 19 && Array.isArray(value.scope.children)
    && value.scope.children.length === 19, "CENTRAL_V4_SCOPE_INVALID");
  const children = new Set();
  for (const child of value.scope.children) {
    invariant(/^[0-9a-f-]{36}$/.test(child.child_plan_id)
      && /^[0-9a-f]{64}$/.test(child.child_plan_fingerprint)
      && !children.has(child.child_plan_id), "CENTRAL_V4_CHILD_SCOPE_INVALID");
    children.add(child.child_plan_id);
  }
  invariant(value.owner_authorization?.authorized_by === "Marek Kalinka"
    && value.owner_authorization.authorized_on === "2026-10-04"
    && value.owner_authorization.exact_instruction === "To weź się za to zrób te wszystkie 5 punktów które wymieniłeś i nie zawracam gitary tylko to zrób",
  "CENTRAL_V4_AUTHORIZATION_INVALID");
  invariant(value.execution?.maximum_read_attempts === 1 && value.execution.automatic_retry === false
    && value.execution.business_writes_authorized === false
    && value.execution.control_data_writes_authorized === false
    && value.execution.close_authorized === false && value.execution.ra004_replay_authorized === false
    && value.execution.result_before_cleanup === true && value.execution.cleanup_required === true,
  "CENTRAL_V4_EXECUTION_INVALID");
  invariant(value.implementation?.runner_sha256 === sourceHash(__filename)
    && value.implementation.central_migration_sha256 === MIGRATION_SHA256,
  "CENTRAL_V4_IMPLEMENTATION_DRIFT");
  return Object.freeze(value);
}

function preparationHash(value) { return sha256(`${canonicalJson(value)}\n`); }
function confirmation(value) {
  return sha256(canonicalJson({ preparation_sha256: preparationHash(value), target: value.target,
    parent_plan_id: value.scope.parent_plan_id,
    children: value.scope.children.map(row => row.child_plan_fingerprint).sort(),
    operation: "ONE_CENTRAL_READ_PERSIST_BEFORE_CLEANUP" })).slice(0, 20);
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|confirm)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `CENTRAL_V4_ARGUMENT_INVALID:${argument}`);
    values[match[1]] = match[2];
  }
  const mode = values.mode || "status";
  invariant(new Set(["status", "execute", "cleanup-finalize"]).has(mode), "CENTRAL_V4_MODE_INVALID");
  invariant(mode === "status" || Boolean(values.confirm), "CENTRAL_V4_CONFIRMATION_REQUIRED");
  return { mode, confirm: values.confirm || null };
}

function loadVerifiedCa(dependencies = {}) {
  let bytes;
  const readFile = dependencies.readFile || fs.readFileSync;
  const proof = validateTlsCa({ ...(dependencies.tls || {}), readFile(file) { bytes = readFile(file); return bytes; } });
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0, "CENTRAL_V4_TLS_CA_INVALID");
  return Object.freeze({ bytes, fingerprint256: proof.fingerprint256, valid_to: proof.valid_to });
}

function validateGitState(run = spawnSync) {
  const command = (...args) => run("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const fetch = command("fetch", "--quiet", "origin", "main");
  const head = command("rev-parse", "HEAD"), main = command("rev-parse", "origin/main");
  const branch = command("branch", "--show-current"), status = command("status", "--porcelain", "--untracked-files=no");
  invariant(fetch.status === 0 && head.status === 0 && main.status === 0 && branch.status === 0 && status.status === 0
    && branch.stdout.trim() === "main" && head.stdout.trim() === main.stdout.trim()
    && status.stdout.trim() === "", "CENTRAL_V4_REQUIRES_CLEAN_MERGED_MAIN");
  return head.stdout.trim();
}

function ownerUrl() {
  const file = path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  return validateOwnerUrl(loadEnvFile(file)[PRODUCTION.databaseUrlEnvironmentKey]);
}
function client(url, name, ca, ClientClass = Client) {
  const host = new URL(url).hostname;
  return new ClientClass({ connectionString: url,
    ssl: { ca, rejectUnauthorized: true, servername: host, minVersion: "TLSv1.2" },
    application_name: name, connectionTimeoutMillis: 10000, query_timeout: 30000 });
}

async function ownerIdentity(db) {
  const identity = (await db.query("select current_user,current_database(),current_setting('transaction_read_only') read_only,current_setting('app.safe_update',true) safe_update")).rows[0];
  validateDatabaseOwner(PRODUCTION, identity);
  invariant(identity.read_only === "off" && !identity.safe_update, "CENTRAL_V4_OWNER_SESSION_INVALID");
}
async function roleProof(db, expectedLogin, expectedBackends) {
  const proof = (await db.query(`select r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolcreatedb,r.rolcreaterole,
    r.rolreplication,r.rolbypassrls,r.rolconnlimit,
    has_function_privilege($1,$2::regprocedure,'EXECUTE') wrapper_execute,
    has_function_privilege($1,'public.get_retailer_catalogue_plan_status(uuid)'::regprocedure,'EXECUTE') source_execute,
    has_function_privilege('public','public.rls_auto_enable()'::regprocedure,'EXECUTE') admin_public_execute,
    exists(select 1 from pg_auth_members m join pg_roles x on x.oid=m.member where x.rolname=$1) memberships,
    (select count(*)::int from pg_stat_activity where usename=$1) backend_count
    from pg_roles r where r.rolname=$1`, [ROLE, RPC])).rows[0];
  invariant(proof && proof.rolcanlogin === expectedLogin && proof.rolinherit === false && proof.rolsuper === false
    && proof.rolcreatedb === false && proof.rolcreaterole === false && proof.rolreplication === false
    && proof.rolbypassrls === false && proof.rolconnlimit === 1 && proof.wrapper_execute === true
    && proof.source_execute === false && proof.admin_public_execute === false && proof.memberships === false
    && (expectedBackends === null || proof.backend_count === expectedBackends), "CENTRAL_V4_ROLE_PROOF_FAILED");
  return proof;
}

async function productionPreflight(db) {
  await ownerIdentity(db);
  const target = (await db.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
  invariant(target.target_environment === "PRODUCTION" && target.project_ref === PRODUCTION.projectRef
    && target.database_identity === PRODUCTION.databaseIdentity, "CENTRAL_V4_DATABASE_TARGET_DRIFT");
  const ledger = (await db.query("select version,name,statements from supabase_migrations.schema_migrations order by version")).rows;
  invariant(ledger.length === 224
    && ledgerRowsFingerprint(ledger, { targetEnvironment: "PRODUCTION" }) === PRODUCTION.ledgerFingerprint,
  "CENTRAL_V4_LEDGER_DRIFT");
  const migration = ledger.find(row => row.version === MIGRATION_VERSION && row.name === MIGRATION_NAME);
  invariant(migration && Array.isArray(migration.statements) && migration.statements.length === 1
    && sha256(Buffer.from(migration.statements[0].replaceAll("\r\n", "\n"))) === MIGRATION_SHA256,
  "CENTRAL_V4_MIGRATION_DRIFT");
  await roleProof(db, false, 0);
  return { ledger_count: ledger.length, ledger_fingerprint: PRODUCTION.ledgerFingerprint,
    migration_sha256: MIGRATION_SHA256, role_login: false, backend_count: 0 };
}

async function activate(db, baseUrl) {
  const password = crypto.randomBytes(36).toString("base64url");
  const verifier = scram(password);
  invariant(/^SCRAM-SHA-256\$/.test(verifier), "CENTRAL_V4_SCRAM_INVALID");
  const expires = new Date(Date.now() + 8 * 60 * 1000).toISOString();
  await db.query("begin");
  try {
    await db.query(`alter role ${ROLE} login password '${verifier}' valid until '${expires}'`);
    await db.query("commit");
  } catch (error) { await db.query("rollback").catch(() => {}); throw error; }
  await roleProof(db, true, 0);
  const login = new URL(baseUrl);
  login.username = login.hostname.endsWith(".pooler.supabase.com") ? `${ROLE}.${PRODUCTION.projectRef}` : ROLE;
  login.password = password;
  return { database_url: login.toString(), expires_at: expires };
}

async function oneRead(databaseUrl, preparation, ca, ClientClass = Client) {
  const db = client(databaseUrl, "ra-stab-central-v4-read-once", ca, ClientClass);
  let open = false; let validated = null; let transportCleanupError = null;
  try {
    await db.connect();
    await db.query("begin isolation level repeatable read read only"); open = true;
    const result = await db.query({ text: `select session_user::text session_user,current_user::text current_user,
      current_setting('transaction_read_only') read_only,retailer_readback.read_control_plan_status_v1($1::uuid) data`,
    values: [preparation.scope.parent_plan_id] });
    invariant(result.rowCount === 1 && result.rows[0].session_user === ROLE
      && result.rows[0].current_user === ROLE && result.rows[0].read_only === "on",
    "CENTRAL_V4_READ_IDENTITY_FAILED");
    validated = validateReadback(result.rows[0].data, preparation);
    await db.query("rollback"); open = false;
  } finally {
    if (open) await db.query("rollback").catch(error => { transportCleanupError = error; });
    await db.end().catch(error => { transportCleanupError ||= error; });
  }
  invariant(validated, "CENTRAL_V4_READ_NOT_VALIDATED");
  return { readback: validated, transport_cleanup_confirmed: !transportCleanupError };
}

async function disable(db, dependencies = {}) {
  await db.query("begin");
  try {
    await db.query(`alter role ${ROLE} nologin valid until '1970-01-01 00:00:00+00'`);
    await db.query("select pg_terminate_backend(pid) from pg_stat_activity where usename=$1 and pid<>pg_backend_pid()", [ROLE]);
    await db.query("commit");
  } catch (error) { await db.query("rollback").catch(() => {}); throw error; }
  const delay = dependencies.delay || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  let proof;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try { proof = await roleProof(db, false, 0); break; } catch (error) {
      if (attempt === 9) throw error;
      await delay(200);
    }
  }
  return { login_disabled: true, backend_count: proof.backend_count, memberships: false,
    wrapper_execute_only: true, grants_preserved_for_reuse: true };
}

async function runReadbackLifecycle({ readOnce, persistValidated, cleanup, finalize }) {
  let provisional = null; let readError = null; let cleanupResult = null; let cleanupError = null;
  try { provisional = await persistValidated(await readOnce()); } catch (error) { readError = error; }
  try { cleanupResult = await cleanup(); } catch (error) { cleanupError = error; }
  if (readError || cleanupError) {
    const error = new Error([readError?.message, cleanupError && `CLEANUP:${cleanupError.message}`].filter(Boolean).join(";"));
    error.provisional = provisional;
    error.cleanup_required = Boolean(cleanupError);
    throw error;
  }
  return finalize({ provisional, cleanup: cleanupResult });
}

function persistValidated({ preparation, commit, tls, preflight, result }, output = PROVISIONAL_PATH) {
  return writeOnce(output, { schema_version: "ra-stab-central-readback-result-v1",
    status: "VALIDATED_RESULT_PENDING_CLEANUP", task_id: "RA-STAB-01", generated_at: new Date().toISOString(),
    repository_commit: commit, preparation_sha256: preparationHash(preparation), target: preparation.target,
    scope: { parent_plan_id: preparation.scope.parent_plan_id, expected_child_count: 19 },
    transport: { tls_fingerprint256: tls.fingerprint256,
      reader_cleanup_confirmed: result.transport_cleanup_confirmed },
    production_preflight: preflight, readback: result.readback,
    accounting: { read_attempts: 1, rpc_calls: 1, automatic_retries: 0, business_writes: 0,
      control_data_writes: 0, close_calls: 0, ra004_calls: 0 } });
}

function finalize({ preparation, commit, provisional, cleanup }, output = RECEIPT_PATH) {
  invariant(provisional?.sha256 && fs.existsSync(provisional.path), "CENTRAL_V4_PROVISIONAL_REQUIRED");
  const bytes = fs.readFileSync(provisional.path);
  invariant(sha256(bytes) === provisional.sha256, "CENTRAL_V4_PROVISIONAL_DRIFT");
  const value = JSON.parse(bytes.toString("utf8"));
  invariant(value.status === "VALIDATED_RESULT_PENDING_CLEANUP"
    && value.preparation_sha256 === preparationHash(preparation) && value.repository_commit === commit,
  "CENTRAL_V4_PROVISIONAL_BINDING_DRIFT");
  return writeOnce(output, { schema_version: "ra-stab-central-readback-receipt-v1",
    status: "VERIFIED_READ_ONLY_CLEANUP_COMPLETE", task_id: "RA-STAB-01", generated_at: new Date().toISOString(),
    repository_commit: commit, preparation_sha256: preparationHash(preparation),
    provisional: { path: path.relative(ROOT, provisional.path).replaceAll("\\", "/"), sha256: provisional.sha256,
      bytes: provisional.bytes }, cleanup,
    accounting: { read_attempts: 1, rpc_calls: 1, cleanup_rpc_calls: 0, automatic_retries: 0,
      business_writes: 0, control_data_writes: 0, close_calls: 0, ra004_calls: 0 } });
}

function readProvisional(preparation, commit, file = PROVISIONAL_PATH) {
  invariant(fs.existsSync(file) && fs.existsSync(`${file}.sha256`), "CENTRAL_V4_PROVISIONAL_REQUIRED");
  const bytes = fs.readFileSync(file), digest = sha256(bytes);
  const sidecar = fs.readFileSync(`${file}.sha256`, "utf8").trim();
  invariant(sidecar === `${digest}  ${path.basename(file)}`, "CENTRAL_V4_PROVISIONAL_DIGEST_DRIFT");
  const value = JSON.parse(bytes.toString("utf8"));
  invariant(value.status === "VALIDATED_RESULT_PENDING_CLEANUP"
    && value.preparation_sha256 === preparationHash(preparation)
    && value.repository_commit === commit && value.accounting?.rpc_calls === 1,
  "CENTRAL_V4_PROVISIONAL_BINDING_DRIFT");
  return Object.freeze({ path: file, sha256: digest, bytes: bytes.length, readback_sha256: digest });
}

async function cleanupFinalize(preparation, dependencies = {}) {
  const tls = dependencies.loadVerifiedCa ? dependencies.loadVerifiedCa() : loadVerifiedCa(dependencies);
  const commit = (dependencies.validateGitState || validateGitState)();
  const paths = dependencies.paths || { attempt: ATTEMPT_PATH, provisional: PROVISIONAL_PATH, receipt: RECEIPT_PATH };
  invariant(fs.existsSync(paths.attempt) && !fs.existsSync(paths.receipt)
    && !fs.existsSync(`${paths.receipt}.sha256`), "CENTRAL_V4_CLEANUP_STATE_INVALID");
  const provisional = readProvisional(preparation, commit, paths.provisional);
  const baseUrl = (dependencies.ownerUrl || ownerUrl)();
  const owner = client(baseUrl, "ra-stab-central-v4-cleanup-finalize", tls.bytes, dependencies.ClientClass || Client);
  try {
    await owner.connect();
    await ownerIdentity(owner);
    const cleanup = await disable(owner, dependencies);
    await productionPreflight(owner);
    return finalize({ preparation, commit, provisional, cleanup }, paths.receipt);
  } finally { await owner.end().catch(() => {}); }
}

async function execute(preparation, dependencies = {}) {
  const tls = dependencies.loadVerifiedCa ? dependencies.loadVerifiedCa() : loadVerifiedCa(dependencies);
  const commit = (dependencies.validateGitState || validateGitState)();
  const paths = dependencies.paths || { attempt: ATTEMPT_PATH, provisional: PROVISIONAL_PATH, receipt: RECEIPT_PATH };
  invariant(!fs.existsSync(paths.attempt) && !fs.existsSync(paths.provisional)
    && !fs.existsSync(`${paths.provisional}.sha256`) && !fs.existsSync(paths.receipt)
    && !fs.existsSync(`${paths.receipt}.sha256`), "CENTRAL_V4_ATTEMPT_ALREADY_EXISTS");
  writeOnce(paths.attempt, { schema_version: "ra-stab-central-readback-attempt-v1", status: "STARTED",
    started_at: new Date().toISOString(), repository_commit: commit,
    preparation_sha256: preparationHash(preparation), maximum_read_attempts: 1, automatic_retries: 0 });
  const baseUrl = (dependencies.ownerUrl || ownerUrl)();
  const owner = client(baseUrl, "ra-stab-central-v4-owner", tls.bytes, dependencies.ClientClass || Client);
  let credential = null; let activationStarted = false;
  try {
    await owner.connect();
    const preflight = await productionPreflight(owner);
    activationStarted = true;
    credential = await activate(owner, baseUrl);
    return await runReadbackLifecycle({
      readOnce: () => oneRead(credential.database_url, preparation, tls.bytes, dependencies.ClientClass || Client),
      persistValidated: result => persistValidated({ preparation, commit, tls, preflight, result }, paths.provisional),
      cleanup: () => disable(owner, dependencies),
      finalize: ({ provisional, cleanup }) => finalize({ preparation, commit, provisional, cleanup }, paths.receipt),
    });
  } finally {
    if (activationStarted) {
      const proof = await roleProof(owner, false, 0).catch(() => null);
      if (!proof) await disable(owner, dependencies).catch(() => {});
    }
    await owner.end().catch(() => {});
  }
}

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const preparation = validatePreparation(dependencies.preparation || readJson(PREPARATION_PATH));
  const expected = confirmation(preparation);
  if (options.mode === "status") return { result: "PASS", executable: true,
    preparation_sha256: preparationHash(preparation), confirmation: expected,
    production_connection: false, credential_read: false };
  invariant(options.confirm === expected, `CENTRAL_V4_CONFIRMATION_MISMATCH:${expected}`);
  if (options.mode === "cleanup-finalize") return cleanupFinalize(preparation, dependencies);
  return execute(preparation, dependencies);
}

if (require.main === module) run().then(value => console.log(JSON.stringify(value, null, 2)))
  .catch(error => { console.error(JSON.stringify({ error: error.message, provisional: error.provisional || null,
    cleanup_required: error.cleanup_required === true })); process.exitCode = 1; });

module.exports = { ATTEMPT_PATH, MIGRATION_SHA256, PREPARATION_PATH, PROVISIONAL_PATH, RECEIPT_PATH,
  ROLE, RPC, cleanupFinalize, confirmation, disable, execute, finalize, loadVerifiedCa, oneRead, parseArgs,
  persistValidated, preparationHash, productionPreflight, roleProof, run, runReadbackLifecycle,
  readProvisional, sha256, sourceHash, validatePreparation };
