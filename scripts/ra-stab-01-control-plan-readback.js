const crypto = require("node:crypto");
const { X509Certificate } = crypto;
const fs = require("node:fs");
const path = require("node:path");
const { fork, spawnSync } = require("node:child_process");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");
const { ROLE, RPC } = require("./ra-stab-01-control-plan-credential-issuer");

const ROOT = path.resolve(__dirname, "..");
const PREPARATION_PATH = path.join(ROOT, "docs", "retailer-automation", "evidence",
  "RA-STAB-01-10REPS-CONTROL-PLAN-READBACK-PREPARATION-V2-2026-10-04.json");
const OUTPUT_DIR = path.join(ROOT, "tmp", "control-plan-readbacks");
const ATTEMPT_PATH = path.join(OUTPUT_DIR, "10reps-2026-10-04-v2.attempt.json");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "10reps-2026-10-04-v2.json");
const DIGEST_PATH = `${OUTPUT_PATH}.sha256`;
const SUPABASE_ROOT_CA_FINGERPRINT = "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";

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

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|confirm)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  const mode = values.mode || "status";
  invariant(new Set(["status", "execute", "cleanup"]).has(mode), "RA_STAB_MODE_INVALID");
  invariant((mode === "execute") === Boolean(values.confirm), "RA_STAB_CONFIRMATION_REQUIRED");
  return { mode, confirm: values.confirm || null };
}

function validatePreparation(value) {
  invariant(exactKeys(value, ["schema_version", "status", "task_id", "target", "scope",
    "owner_authorization", "credential", "execution", "implementation", "limitations"]), "RA_STAB_PREPARATION_KEYS_INVALID");
  invariant(value.schema_version === "ra-stab-01-control-plan-readback-preparation-v1"
    && new Set(["OWNER_AUTHORIZED_ONE_SHOT", "CONSUMED_FAILED_TLS_PREFLIGHT"]).has(value.status)
    && value.task_id === "RA-STAB-01",
  "RA_STAB_PREPARATION_INVALID");
  invariant(exactKeys(value.target, ["environment", "project_ref", "database_identity"])
    && value.target.environment === "PRODUCTION"
    && value.target.project_ref === "aftboxmrdgyhizicfsfu"
    && value.target.database_identity === "supplementscout-production:aftboxmrdgyhizicfsfu",
  "RA_STAB_TARGET_INVALID");
  invariant(exactKeys(value.scope, ["operation", "retailer_id", "retailer_name", "parent_plan_id",
    "parent_plan_fingerprint", "expected_child_count", "children"])
    && value.scope.operation === "READ_ONLY_CONTROL_PLAN_STATUS"
    && value.scope.retailer_id === "14"
    && value.scope.retailer_name === "10 Reps"
    && value.scope.parent_plan_id === "06ae81b7-4cc1-42b5-af6a-92bfd17e6dfa"
    && /^[0-9a-f]{64}$/.test(value.scope.parent_plan_fingerprint)
    && value.scope.expected_child_count === 19
    && Array.isArray(value.scope.children) && value.scope.children.length === 19,
  "RA_STAB_SCOPE_INVALID");
  const ids = new Set();
  for (const child of value.scope.children) {
    invariant(exactKeys(child, ["child_plan_id", "child_plan_fingerprint"])
      && /^[0-9a-f-]{36}$/.test(child.child_plan_id)
      && /^[0-9a-f]{64}$/.test(child.child_plan_fingerprint)
      && !ids.has(child.child_plan_id), "RA_STAB_CHILD_SCOPE_INVALID");
    ids.add(child.child_plan_id);
  }
  invariant(exactKeys(value.owner_authorization, ["authorized_by", "authorized_on", "exact_instruction",
    "interpreted_scope"])
    && exactKeys(value.credential, ["role", "maximum_ttl_minutes", "connection_limit",
      "default_transaction_read_only", "allowed_rpc", "table_privileges", "sequence_privileges",
      "role_memberships", "plaintext_password_in_sql_or_artifacts"])
    && exactKeys(value.execution, ["maximum_attempts", "automatic_retry", "business_writes_authorized",
      "control_writes_authorized", "close_authorized", "retailer_retry_authorized",
      "ra004_replay_authorized", "required_cleanup"])
    && exactKeys(value.implementation, ["issuer_sha256", "coordinator_sha256", "test_sha256",
      "lifecycle_integration_sha256", "rpc_migration_sha256"])
    && value.owner_authorization.authorized_by === "Marek Kalinka"
    && value.owner_authorization.authorized_on === "2026-10-04"
    && value.owner_authorization.exact_instruction === "Zatwierdzam nowy jednorazowy read-only eksport stanu 10 Reps, na tych samych warunkach: bez zapisów, retry, close i RA-004 replay"
    && value.owner_authorization.interpreted_scope.includes("one bounded current-state read")
    && value.credential.role === ROLE && value.credential.maximum_ttl_minutes === 10
    && value.credential.connection_limit === 1 && value.credential.default_transaction_read_only === true
    && value.credential.allowed_rpc === RPC && value.credential.table_privileges === false
    && value.credential.sequence_privileges === false && value.credential.role_memberships === false
    && value.credential.plaintext_password_in_sql_or_artifacts === false
    && value.execution.maximum_attempts === 1 && value.execution.automatic_retry === false
    && value.execution.business_writes_authorized === false && value.execution.control_writes_authorized === false
    && value.execution.close_authorized === false && value.execution.retailer_retry_authorized === false
    && value.execution.ra004_replay_authorized === false
    && value.execution.required_cleanup === "DISABLE_LOGIN_COMMIT_TERMINATE_REVOKE_DROP_VERIFY"
    && Object.values(value.implementation).every(hash => /^[0-9a-f]{64}$/.test(hash)),
  "RA_STAB_AUTHORIZATION_INVALID");
  return Object.freeze(value);
}

function validateTlsCa(dependencies = {}) {
  const env = dependencies.env || process.env;
  const caPath = env.NODE_EXTRA_CA_CERTS;
  invariant(typeof caPath === "string" && path.isAbsolute(caPath), "RA_STAB_TLS_CA_REQUIRED");
  const bytes = (dependencies.readFile || fs.readFileSync)(caPath);
  const Certificate = dependencies.X509Class || X509Certificate;
  const certificate = new Certificate(bytes);
  const now = dependencies.now?.() || new Date();
  invariant(certificate.fingerprint256 === SUPABASE_ROOT_CA_FINGERPRINT
    && certificate.subject.includes("CN=Supabase Root 2021 CA")
    && certificate.issuer === certificate.subject
    && Date.parse(certificate.validFrom) <= now.getTime()
    && Date.parse(certificate.validTo) > now.getTime(), "RA_STAB_TLS_CA_INVALID");
  return { path: caPath, fingerprint256: certificate.fingerprint256, valid_to: certificate.validTo };
}

function validateImplementationBindings(preparation) {
  const files = {
    issuer_sha256: path.join(__dirname, "ra-stab-01-control-plan-credential-issuer.js"),
    coordinator_sha256: __filename,
    test_sha256: path.join(__dirname, "ra-stab-01-control-plan-readback.test.js"),
    lifecycle_integration_sha256: path.join(__dirname,
      "ra-stab-01-control-plan-credential-lifecycle.integration.test.js"),
    rpc_migration_sha256: path.join(ROOT, "supabase", "migrations", "20260719100000_add_production_retailer_sync_enablement.sql"),
  };
  for (const [key, file] of Object.entries(files)) {
    invariant(sourceHash(file) === preparation.implementation[key], `RA_STAB_IMPLEMENTATION_DRIFT:${key}`);
  }
}

function preparationHash(value) { return sha256(`${canonicalJson(value)}\n`); }
function confirmation(value) {
  return sha256(canonicalJson({ operation: value.scope.operation, preparation_sha256: preparationHash(value),
    target: value.target, parent_plan_id: value.scope.parent_plan_id,
    child_fingerprints: value.scope.children.map(row => row.child_plan_fingerprint).sort() })).slice(0, 20);
}

function validateGitState(run = spawnSync) {
  const command = (...args) => run("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const fetch = command("fetch", "--quiet", "origin", "main");
  const head = command("rev-parse", "HEAD");
  const main = command("rev-parse", "origin/main");
  const branch = command("branch", "--show-current");
  const status = command("status", "--porcelain", "--untracked-files=no");
  invariant(fetch.status === 0 && head.status === 0 && main.status === 0 && branch.status === 0 && status.status === 0
    && String(branch.stdout).trim() === "main"
    && String(head.stdout).trim() === String(main.stdout).trim()
    && String(status.stdout).trim() === "", "RA_STAB_EXECUTION_REQUIRES_CLEAN_MERGED_MAIN");
  return String(head.stdout).trim();
}

function issuerProcess(forkProcess = fork, timeoutMs = 60_000) {
  let sequence = 0;
  const pending = new Map();
  const child = forkProcess(path.join(__dirname, "ra-stab-01-control-plan-credential-issuer.js"), [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let resolveExit;
  const exitPromise = new Promise(resolve => { resolveExit = resolve; });
  child.on("message", (message) => {
    const request = pending.get(message.request_id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(message.request_id);
    if (message.ok) request.resolve(message.result); else request.reject(new Error(message.error));
  });
  const rejectAll = code => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(code)); }
    pending.clear();
  };
  child.once("error", () => rejectAll("RA_STAB_ISSUER_PROCESS_ERROR"));
  child.once("exit", () => { rejectAll("RA_STAB_ISSUER_PROCESS_EXITED"); resolveExit(); });
  child.once("disconnect", () => rejectAll("RA_STAB_ISSUER_PROCESS_DISCONNECTED"));
  return {
    call(message) { return new Promise((resolve, reject) => {
      const request_id = ++sequence;
      const timer = setTimeout(() => { pending.delete(request_id); reject(new Error("RA_STAB_ISSUER_TIMEOUT")); }, timeoutMs);
      pending.set(request_id, { resolve, reject, timer });
      child.send({ ...message, request_id }, error => {
        if (!error) return;
        const request = pending.get(request_id);
        if (request) { clearTimeout(request.timer); pending.delete(request_id); reject(new Error("RA_STAB_ISSUER_SEND_FAILED")); }
      });
    }); },
    close() { if (child.connected) child.disconnect(); },
    async stop() {
      if (child.connected) child.disconnect();
      await Promise.race([exitPromise, new Promise((_, reject) => setTimeout(
        () => reject(new Error("RA_STAB_ISSUER_STOP_TIMEOUT")), 90_000))]);
    },
  };
}

async function oneRead(databaseUrl, preparation, ClientClass = Client) {
  const parsed = new URL(databaseUrl);
  const username = decodeURIComponent(parsed.username);
  invariant((parsed.hostname === `db.${preparation.target.project_ref}.supabase.co` && username === ROLE)
    || (parsed.hostname.endsWith(".pooler.supabase.com")
      && username === `${ROLE}.${preparation.target.project_ref}`), "RA_STAB_EPHEMERAL_TARGET_INVALID");
  const db = new ClientClass({ connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true, servername: parsed.hostname, minVersion: "TLSv1.2" },
    application_name: "ra-stab-control-plan-readback-v2", connectionTimeoutMillis: 10_000,
    query_timeout: 15_000, options: "-c default_transaction_read_only=on -c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000 -c idle_session_timeout=60000" });
  let open = false;
  try {
    await db.connect();
    await db.query("begin isolation level repeatable read read only"); open = true;
    const response = await db.query({ text: `select session_user::text session_user,current_user::text current_user,
      current_setting('transaction_read_only') transaction_read_only,
      public.get_retailer_catalogue_plan_status($1::uuid) data`,
    values: [preparation.scope.parent_plan_id] });
    const proof = response.rows[0];
    invariant(response.rowCount === 1 && response.rows.length === 1 && proof?.session_user === ROLE
      && proof?.current_user === ROLE && proof?.transaction_read_only === "on" && proof?.data,
      "RA_STAB_CONTROL_PLAN_RESPONSE_INVALID");
    await db.query("rollback"); open = false;
    return proof.data;
  } finally {
    if (open) await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
}

function validateReadback(data, preparation) {
  const parent = data?.parent;
  const children = Array.isArray(data?.children) ? data.children : [];
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  invariant(parent?.parent_plan_id === preparation.scope.parent_plan_id
    && parent?.parent_plan_fingerprint === preparation.scope.parent_plan_fingerprint
    && String(parent?.retailer_id) === preparation.scope.retailer_id
    && parent?.target_environment === "PRODUCTION", "RA_STAB_PARENT_IDENTITY_DRIFT");
  invariant(children.length === preparation.scope.expected_child_count, "RA_STAB_CHILD_COUNT_DRIFT");
  const expected = new Map(preparation.scope.children.map(row => [row.child_plan_id, row.child_plan_fingerprint]));
  const seen = new Set();
  for (const child of children) {
    invariant(!seen.has(child.child_plan_id) && expected.get(child.child_plan_id) === child.child_plan_fingerprint,
      "RA_STAB_CHILD_IDENTITY_DRIFT");
    seen.add(child.child_plan_id);
  }
  invariant(seen.size === expected.size, "RA_STAB_CHILD_SET_DRIFT");
  const statuses = Object.fromEntries([...new Set(children.map(row => row.status))].sort()
    .map(status => [status, children.filter(row => row.status === status).length]));
  return {
    parent: { parent_plan_id: parent.parent_plan_id, parent_plan_fingerprint: parent.parent_plan_fingerprint,
      retailer_id: String(parent.retailer_id), target_environment: parent.target_environment,
      status: parent.status, approval_expires_at: parent.approval_expires_at ?? null },
    children: children.map(row => ({ child_plan_id: row.child_plan_id, child_plan_fingerprint: row.child_plan_fingerprint,
      batch_index: row.batch_index, status: row.status, approval_expires_at: row.approval_expires_at ?? null }))
      .sort((a, b) => a.batch_index - b.batch_index),
    runs: runs.map(row => ({ run_id: row.run_id, child_plan_id: row.child_plan_id, run_type: row.run_type,
      status: row.status, started_at: row.started_at, completed_at: row.completed_at ?? null })),
    status_counts: statuses,
    final_assessment: runs.length ? "EXECUTION_EVIDENCE_PRESENT_REQUIRES_REVIEW"
      : new Set(["COMPLETED", "EXPIRED", "SUPERSEDED", "FAILED"]).has(parent.status)
        ? "REGISTRATION_TERMINAL_NO_RUNS" : "REGISTRATION_NON_TERMINAL_NO_RUNS",
  };
}

function writeOnce(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
  return sha256(bytes);
}

async function execute(preparation, dependencies = {}) {
  validateImplementationBindings(preparation);
  validateTlsCa(dependencies.tls || {});
  const commit = dependencies.validateGitState ? dependencies.validateGitState() : validateGitState();
  invariant(!fs.existsSync(ATTEMPT_PATH) && !fs.existsSync(OUTPUT_PATH) && !fs.existsSync(DIGEST_PATH),
    "RA_STAB_ONE_SHOT_ALREADY_ATTEMPTED");
  const startedAt = (dependencies.now?.() || new Date()).toISOString();
  writeOnce(ATTEMPT_PATH, { operation: preparation.scope.operation, parent_plan_id: preparation.scope.parent_plan_id,
    started_at: startedAt, commit, automatic_retry: false });
  const expiresAt = new Date(Date.parse(startedAt) + 8 * 60 * 1000).toISOString();
  const issuer = dependencies.issuer || issuerProcess();
  let credential = null;
  let readback = null;
  let primaryError = null;
  let revoke = null;
  try {
    credential = await issuer.call({ action: "create", expires_at: expiresAt });
    readback = validateReadback(await oneRead(credential.database_url, preparation,
      dependencies.ClientClass || Client), preparation);
  } catch (error) { primaryError = error; }
  finally {
    let cleanupError = null;
    try { revoke = await issuer.call({ action: "revoke", role: ROLE, runner_process_id: process.pid }); }
    catch (error) { cleanupError = error; }
    issuer.close();
    if (revoke && (!revoke.access_revoked || !revoke.role_absent)) {
      cleanupError = new Error("RA_STAB_ACCESS_REVOKED_RESIDUAL_ROLE");
      revoke = null;
    }
    if (cleanupError) {
      try { await issuer.stop?.(); } catch (stopError) {
        cleanupError = new Error(`${cleanupError.message};STOP:${stopError.message}`);
      }
      const rescue = dependencies.rescueIssuer ? dependencies.rescueIssuer() : issuerProcess();
      try {
        revoke = await rescue.call({ action: "revoke", role: ROLE, runner_process_id: process.pid });
        if (!revoke.access_revoked || !revoke.role_absent) throw new Error("RA_STAB_ACCESS_REVOKED_RESIDUAL_ROLE");
      }
      catch (rescueError) {
        cleanupError = new Error(`RA_STAB_CLEANUP_FAILED:${cleanupError.message};RESCUE:${rescueError.message}`);
      } finally { rescue.close(); }
    }
    if (cleanupError && !revoke) {
      primaryError = new AggregateError([cleanupError, ...(primaryError ? [primaryError] : [])],
        "RA_STAB_RESIDUAL_ACCESS_CLEANUP_UNVERIFIED");
    }
  }
  if (primaryError) throw primaryError;
  invariant(revoke?.access_revoked === true && revoke.role_absent && revoke.membership_absent
    && revoke.backend_absent, "RA_STAB_REVOKE_UNVERIFIED");
  const report = {
    schema_version: "ra-stab-01-control-plan-readback-v1", status: "VERIFIED_READ_ONLY",
    task_id: "RA-STAB-01", generated_at: (dependencies.now?.() || new Date()).toISOString(),
    repository_commit: commit, target: preparation.target, operation: preparation.scope.operation,
    rpc: RPC, credential: { credential_id: credential.credential_id, role: credential.role,
      expires_at: credential.expires_at, access_revoked: true, role_absent: true,
      membership_absent: true, backend_absent: true },
    readback, accounting: { rpc_calls: 1, read_statements: 1, automatic_retries: 0, business_writes: 0,
      control_writes: 0, catalogue_writes: 0, auth_catalog_lifecycle: ["CREATE_ROLE", "GRANT", "REVOKE", "DROP_ROLE"] },
    limitations: preparation.limitations,
  };
  report.report_fingerprint = sha256(canonicalJson(report));
  const digest = writeOnce(OUTPUT_PATH, report);
  fs.writeFileSync(DIGEST_PATH, `${digest}  ${path.basename(OUTPUT_PATH)}\n`, { flag: "wx", mode: 0o600 });
  return { output: OUTPUT_PATH, sha256: digest, final_assessment: readback.final_assessment,
    parent_status: readback.parent.status, status_counts: readback.status_counts, run_count: readback.runs.length };
}

async function cleanupOnly(dependencies = {}) {
  const issuer = dependencies.issuer || issuerProcess();
  try {
    const proof = await issuer.call({ action: "revoke", role: ROLE, runner_process_id: process.pid });
    return { result: proof.role_absent ? "CLEANUP_VERIFIED" : "ACCESS_REVOKED_RESIDUAL_ROLE",
      rpc_calls: 0, ...proof };
  } finally { issuer.close(); }
}

async function run(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.mode === "cleanup") return cleanupOnly(dependencies);
  const preparation = validatePreparation(dependencies.preparation || readJson(PREPARATION_PATH));
  const expected = confirmation(preparation);
  if (options.mode === "status") return { result: "PASS", status: preparation.status,
    executable: preparation.status === "OWNER_AUTHORIZED_ONE_SHOT",
    preparation_sha256: preparationHash(preparation),
    confirmation: preparation.status === "OWNER_AUTHORIZED_ONE_SHOT" ? expected : null,
    credential_read: false, production_connection: false };
  invariant(preparation.status === "OWNER_AUTHORIZED_ONE_SHOT", "RA_STAB_AUTHORIZATION_NOT_EXECUTABLE");
  invariant(options.confirm === expected, `RA_STAB_CONFIRMATION_MISMATCH:${expected}`);
  return execute(preparation, dependencies);
}

if (require.main === module) run().then(value => console.log(JSON.stringify(value, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { ATTEMPT_PATH, DIGEST_PATH, OUTPUT_PATH, PREPARATION_PATH, cleanupOnly, confirmation,
  SUPABASE_ROOT_CA_FINGERPRINT, execute, issuerProcess, oneRead, parseArgs, preparationHash, run, sha256,
  sourceHash, validateImplementationBindings, validatePreparation, validateReadback, validateTlsCa, writeOnce };
