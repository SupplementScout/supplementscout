const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, ledgerRowsFingerprint, validateDatabaseOwner } = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const PRODUCTION = CONTRACTS.PRODUCTION;
const ROLE = "ra_stab_plan_read_20261004_a";
const CREDENTIAL_ID = "ra-stab-plan-read-20261004-a";
const RPC = "public.get_retailer_catalogue_plan_status(uuid)";
const MAX_TTL_MS = 10 * 60 * 1000;
const MIGRATION = path.join(ROOT, "supabase", "migrations", "20260719100000_add_production_retailer_sync_enablement.sql");
const MIGRATION_SHA256 = "0c1db39a193c98fb7cd41cfc3b75a03b35ebd59d429fe873e431aadb1aabadf9";

function invariant(value, code) { if (!value) throw new Error(code); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function qident(value) { invariant(/^[a-z][a-z0-9_]{2,62}$/.test(value), "RA_STAB_ROLE_INVALID"); return `"${value}"`; }

function expectedRpcSource() {
  const sql = fs.readFileSync(MIGRATION, "utf8").replaceAll("\r\n", "\n");
  invariant(sha256(sql) === MIGRATION_SHA256, "RA_STAB_RPC_SOURCE_MIGRATION_DRIFT");
  const marker = "$get_status$";
  const signature = "create or replace function public.get_retailer_catalogue_plan_status(p_parent_plan_id uuid)";
  const start = sql.indexOf(signature);
  const bodyStart = sql.indexOf(marker, start) + marker.length;
  const bodyEnd = sql.indexOf(`${marker};`, bodyStart);
  invariant(start >= 0 && bodyStart >= marker.length && bodyEnd > bodyStart, "RA_STAB_RPC_SOURCE_MISSING");
  return sql.slice(bodyStart, bodyEnd);
}

function validateExpiry(expiresAt, now = new Date()) {
  const expiry = Date.parse(expiresAt);
  invariant(Number.isFinite(expiry) && expiry > now.getTime() && expiry <= now.getTime() + MAX_TTL_MS,
    "RA_STAB_CREDENTIAL_WINDOW_INVALID");
  return new Date(expiry).toISOString();
}

function validateOwnerUrl(raw) {
  const url = new URL(raw);
  const user = decodeURIComponent(url.username);
  invariant(new Set(["postgres:", "postgresql:"]).has(url.protocol)
    && url.password && url.pathname === "/postgres" && url.port === "5432"
    && (url.hostname === `db.${PRODUCTION.projectRef}.supabase.co`
      ? user === "postgres"
      : url.hostname.endsWith(".pooler.supabase.com") && user === `postgres.${PRODUCTION.projectRef}`),
  "RA_STAB_OWNER_TARGET_INVALID");
  url.searchParams.delete("sslmode");
  return url.toString();
}

function ownerUrl() {
  const file = path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env");
  return validateOwnerUrl(loadEnvFile(file)[PRODUCTION.databaseUrlEnvironmentKey]);
}

function client(url, applicationName, ClientClass = Client) {
  const hostname = new URL(url).hostname;
  return new ClientClass({ connectionString: url,
    ssl: { rejectUnauthorized: true, servername: hostname, minVersion: "TLSv1.2" },
    application_name: applicationName, connectionTimeoutMillis: 10_000, query_timeout: 30_000 });
}

async function ownerIdentity(db) {
  const identity = (await db.query(`select current_user,current_database(),
    current_setting('transaction_read_only') read_only,
    current_setting('app.safe_update',true) safe_update`)).rows[0];
  validateDatabaseOwner(PRODUCTION, identity);
  invariant(identity.current_database === "postgres", "RA_STAB_DATABASE_IDENTITY_MISMATCH");
  return identity;
}

async function targetOnly(db) {
  await ownerIdentity(db);
  const target = (await db.query("select public.retailer_catalogue_actual_database_target() target")).rows[0]?.target;
  invariant(target?.target_environment === "PRODUCTION" && target?.project_ref === PRODUCTION.projectRef
    && target?.database_identity === PRODUCTION.databaseIdentity, "RA_STAB_PRODUCTION_TARGET_MISMATCH");
}

async function targetAndLedger(db) {
  await targetOnly(db);
  const settings = (await db.query(`select current_setting('transaction_read_only') read_only,
    current_setting('app.safe_update',true) safe_update`)).rows[0];
  invariant(settings.read_only === "off" && !settings.safe_update, "RA_STAB_OWNER_SESSION_INVALID");
  const rows = (await db.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  invariant(rows.length === PRODUCTION.ledgerCount
    && ledgerRowsFingerprint(rows, { targetEnvironment: "PRODUCTION" }) === PRODUCTION.ledgerFingerprint,
  "RA_STAB_PRODUCTION_LEDGER_DRIFT");
}

function scram(password, salt = crypto.randomBytes(18), iterations = 4096) {
  const salted = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = crypto.createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = crypto.createHash("sha256").update(clientKey).digest();
  const serverKey = crypto.createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

async function rpcContract(db) {
  const rpc = (await db.query(`select p.prosrc,pg_get_userbyid(p.proowner) owner,p.provolatile::text volatility,
    p.prosecdef security_definer,p.proconfig,
    has_function_privilege('public',$1::regprocedure,'EXECUTE') public_execute,
    has_function_privilege('anon',$1::regprocedure,'EXECUTE') anon_execute,
    has_function_privilege('authenticated',$1::regprocedure,'EXECUTE') authenticated_execute
    from pg_proc p where p.oid=$1::regprocedure`, [RPC])).rows[0];
  invariant(rpc && rpc.owner === "postgres" && rpc.volatility === "s" && rpc.security_definer === true
    && Array.isArray(rpc.proconfig) && rpc.proconfig.includes("search_path=pg_catalog, public, pg_temp")
    && rpc.public_execute === false && rpc.anon_execute === false && rpc.authenticated_execute === false
    && rpc.prosrc === expectedRpcSource(), "RA_STAB_RPC_CONTRACT_DRIFT");
}

async function capabilityProof(db) {
  return (await db.query(`select
    exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname=$1) memberships,
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname not in ('pg_catalog','information_schema') and c.relkind in ('r','p','v','m','f')
        and has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) relation_privileges,
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname not in ('pg_catalog','information_schema') and c.relkind='S'
        and has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE')) sequence_privileges,
    exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and p.oid<>$2::regprocedure
        and has_function_privilege($1,p.oid,'EXECUTE')) other_security_definer_execute,
    has_function_privilege($1,$2::regprocedure,'EXECUTE') target_execute,
    has_schema_privilege($1,'public','CREATE') public_schema_create`, [ROLE, RPC])).rows[0];
}

function assertNarrowCapability(value) {
  invariant(value && value.memberships === false && value.relation_privileges === false
    && value.sequence_privileges === false && value.other_security_definer_execute === false
    && value.target_execute === true && value.public_schema_create === false,
  "RA_STAB_EPHEMERAL_CAPABILITY_TOO_BROAD");
}

async function createCredential({ expires_at }, dependencies = {}) {
  const expiresAt = validateExpiry(expires_at, dependencies.now?.() || new Date());
  const databaseUrl = dependencies.ownerUrl || ownerUrl();
  const db = client(databaseUrl, "ra-stab-plan-read-issuer-v2", dependencies.ClientClass || Client);
  const password = crypto.randomBytes(36).toString("base64url");
  const verifier = scram(password);
  const id = qident(ROLE);
  let open = false;
  try {
    await db.connect();
    await db.query("begin isolation level repeatable read"); open = true;
    await db.query("set local lock_timeout='5s'");
    await db.query("set local statement_timeout='30s'");
    await targetAndLedger(db);
    await rpcContract(db);
    await db.query(`do $issuer$ begin
      if exists(select 1 from pg_roles where rolname='${ROLE}') then raise exception 'RA_STAB_ROLE_ALREADY_EXISTS'; end if;
      execute 'create role ${id} nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 1';
      execute 'alter role ${id} set default_transaction_read_only=on';
      execute 'alter role ${id} set statement_timeout=''15s''';
      execute 'alter role ${id} set lock_timeout=''5s''';
      execute 'alter role ${id} set idle_in_transaction_session_timeout=''15s''';
      execute 'alter role ${id} set idle_session_timeout=''1min''';
      execute 'grant usage on schema public to ${id}';
      execute 'grant execute on function ${RPC} to ${id}';
    end $issuer$`);
    assertNarrowCapability(await capabilityProof(db));
    await db.query(`alter role ${id} login password '${verifier}' valid until '${expiresAt}'`);
    const role = (await db.query(`select rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
      rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil,rolconfig from pg_roles where rolname=$1`, [ROLE])).rows[0];
    invariant(role?.rolcanlogin === true && role.rolinherit === false && role.rolsuper === false
      && role.rolcreatedb === false && role.rolcreaterole === false && role.rolreplication === false
      && role.rolbypassrls === false && role.rolconnlimit === 1
      && new Date(role.rolvaliduntil).toISOString() === expiresAt
      && ["default_transaction_read_only=on", "statement_timeout=15s", "lock_timeout=5s",
        "idle_in_transaction_session_timeout=15s", "idle_session_timeout=1min"].every(
        setting => role.rolconfig?.includes(setting)),
    "RA_STAB_EPHEMERAL_ROLE_POSTFLIGHT_FAILED");
    await db.query("commit"); open = false;
    const login = new URL(databaseUrl);
    login.username = login.hostname.endsWith(".pooler.supabase.com") ? `${ROLE}.${PRODUCTION.projectRef}` : ROLE;
    login.password = password;
    return { role: ROLE, credential_id: CREDENTIAL_ID, database_url: login.toString(), expires_at: expiresAt,
      issuer_process_id: process.pid };
  } catch (error) {
    if (open) await db.query("rollback").catch(() => {});
    throw error;
  } finally { await db.end().catch(() => {}); }
}

async function disableLogin(db) {
  const id = qident(ROLE);
  await db.query("begin");
  try {
    await db.query("set local lock_timeout='5s'");
    await db.query(`do $cleanup$ begin if exists(select 1 from pg_roles where rolname='${ROLE}')
      then execute 'alter role ${id} nologin valid until ''1970-01-01 00:00:00+00'''; end if; end $cleanup$`);
    await db.query("commit");
  } catch (error) { await db.query("rollback").catch(() => {}); throw error; }
}

async function revokeCredential({ role = ROLE, runner_process_id = process.pid } = {}, dependencies = {}) {
  invariant(role === ROLE && Number.isSafeInteger(runner_process_id) && runner_process_id > 0,
    "RA_STAB_REVOKE_REQUEST_INVALID");
  const databaseUrl = dependencies.ownerUrl || ownerUrl();
  const db = client(databaseUrl, "ra-stab-plan-read-revoke-v2", dependencies.ClientClass || Client);
  const id = qident(ROLE);
  let cleanupError = null;
  try {
    await db.connect();
    await ownerIdentity(db);
    const rolePresentBeforeCleanup = (await db.query(
      "select exists(select 1 from pg_roles where rolname=$1) role_present", [ROLE])).rows[0]?.role_present === true;
    await disableLogin(db);
    await db.query("select pg_terminate_backend(pid) from pg_stat_activity where usename=$1 and pid<>pg_backend_pid()", [ROLE]);
    const delay = dependencies.delay || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    let backendAbsent = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      backendAbsent = (await db.query(
        "select not exists(select 1 from pg_stat_activity where usename=$1) backend_absent", [ROLE])).rows[0]?.backend_absent;
      if (backendAbsent) break;
      await delay(200);
    }
    await db.query("begin");
    try {
      await db.query("set local lock_timeout='5s'");
      await db.query(`do $cleanup$ begin if exists(select 1 from pg_roles where rolname='${ROLE}') then
        execute 'revoke execute on function ${RPC} from ${id}';
        execute 'revoke usage on schema public from ${id}'; end if; end $cleanup$`);
      await db.query("commit");
    } catch (error) { await db.query("rollback").catch(() => {}); throw error; }
    const grantsGone = (await db.query(`select
      case when exists(select 1 from pg_roles where rolname=$1)
        then not has_function_privilege($1,$2::regprocedure,'EXECUTE') else true end target_execute_absent,
      not exists(select 1 from pg_namespace n
        cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
        join pg_roles grantee on grantee.oid=a.grantee
        where n.nspname='public' and grantee.rolname=$1 and a.privilege_type='USAGE') schema_usage_direct_absent`,
      [ROLE, RPC])).rows[0];
    invariant(grantsGone?.target_execute_absent && grantsGone?.schema_usage_direct_absent,
      "RA_STAB_REVOKE_GRANTS_UNVERIFIED");
    try {
      await db.query("begin");
      await db.query("set local lock_timeout='5s'");
      await db.query(`do $cleanup$ begin if exists(select 1 from pg_roles where rolname='${ROLE}')
        then execute 'drop role ${id}'; end if; end $cleanup$`);
      await db.query("commit");
    } catch (error) { cleanupError = error; await db.query("rollback").catch(() => {}); }
    const proof = (await db.query(`select
      not exists(select 1 from pg_roles where rolname=$1) role_absent,
      coalesce((select not rolcanlogin and rolvaliduntil<=now() from pg_roles where rolname=$1),true) login_disabled,
      not exists(select 1 from pg_auth_members m join pg_roles a on a.oid=m.member join pg_roles b on b.oid=m.roleid
        where a.rolname=$1 or b.rolname=$1) membership_absent,
      not exists(select 1 from pg_stat_activity where usename=$1) backend_absent,
      case when exists(select 1 from pg_roles where rolname=$1)
        then not has_function_privilege($1,$2::regprocedure,'EXECUTE') else true end target_execute_absent,
      not exists(select 1 from pg_namespace n
        cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
        join pg_roles grantee on grantee.oid=a.grantee
        where n.nspname='public' and grantee.rolname=$1 and a.privilege_type='USAGE') schema_usage_direct_absent`,
      [ROLE, RPC])).rows[0];
    invariant(proof?.login_disabled && proof?.membership_absent && proof?.backend_absent
      && proof.schema_usage_direct_absent && (proof.role_absent || proof.target_execute_absent),
    "RA_STAB_REVOKE_UNVERIFIED");
    return { access_revoked: true, credential_id: CREDENTIAL_ID, role: ROLE,
      issuer_process_id: process.pid, runner_process_id, role_present_before_cleanup: rolePresentBeforeCleanup,
      cleanup_status: cleanupError ? "ACCESS_REVOKED_RESIDUAL_ROLE"
        : rolePresentBeforeCleanup ? "ROLE_DROPPED" : "ROLE_ALREADY_ABSENT_VERIFIED", ...proof };
  } finally { await db.end().catch(() => {}); }
}

async function handle(message) {
  if (message.action === "create") return createCredential(message);
  if (message.action === "revoke") return revokeCredential(message);
  throw new Error("RA_STAB_ISSUER_ACTION_INVALID");
}

if (require.main === module) {
  let custody = false;
  let cleaning = null;
  let queue = Promise.resolve();
  const cleanup = () => {
    if (!custody) return Promise.resolve();
    if (!cleaning) cleaning = revokeCredential().finally(() => { custody = false; });
    return cleaning;
  };
  const exitAfterCleanup = () => { queue = queue.then(() => cleanup()).finally(() => process.exit(cleaning ? 1 : 0)); };
  process.once("disconnect", exitAfterCleanup);
  process.once("SIGINT", exitAfterCleanup);
  process.once("SIGTERM", exitAfterCleanup);
  process.on("message", message => {
    queue = queue.then(async () => {
      if (message.action === "create") custody = true;
      try {
        const result = await handle(message);
        if (message.action === "revoke") custody = false;
        process.send?.({ request_id: message.request_id, ok: true, result }, error => { if (error) cleanup(); });
      } catch (error) {
        if (message.action === "create") {
          try { await cleanup(); }
          catch (cleanupError) { error = new Error(`${error.message};CLEANUP:${cleanupError.message}`); }
        }
        process.send?.({ request_id: message.request_id, ok: false, error: String(error.message).slice(0, 240) },
          sendError => { if (sendError) cleanup(); });
      }
    });
  });
}

module.exports = { CREDENTIAL_ID, MAX_TTL_MS, MIGRATION_SHA256, ROLE, RPC, assertNarrowCapability,
  capabilityProof, createCredential, expectedRpcSource, revokeCredential, scram, validateExpiry, validateOwnerUrl };
