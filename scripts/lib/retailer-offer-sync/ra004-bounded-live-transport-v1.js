const { Client } = require("pg");
const {
  RPC_NAME: PREFLIGHT_RPC,
  LEDGER_FINGERPRINT_CONTRACT_VERSION,
  sanitizeError,
  validateEvidenceStore,
  validateProjectIdentity,
  validateTarget,
} = require("./ra004-staging-preflight-v1/contract");

const CONTROL_STATE_RPC = "public.read_retailer_control_state_v1";
const SAFE_ID = /^[a-z][a-z0-9_-]{2,127}$/;
const ACL_RLS_AUDIT_SQL = `select session_user::text session_user,
  current_setting('transaction_read_only') transaction_read_only,
  jsonb_build_object(
    'functions',coalesce((select jsonb_agg(jsonb_build_object(
      'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
      'security_definer',p.prosecdef,'volatility',p.provolatile::text,
      'search_path',coalesce(to_jsonb(p.proconfig),'[]'::jsonb),
      'acl',coalesce((select jsonb_agg(jsonb_build_object(
        'grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
        'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)
        order by case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,x.privilege_type)
        from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x),'[]'::jsonb))
      order by p.oid::regprocedure::text) from pg_catalog.pg_proc p where p.oid in (
        to_regprocedure('public.read_ra004_staging_preflight_v1(text,text,text,integer,text,text,integer)'),
        to_regprocedure('public.read_retailer_control_state_v1(bigint,text,text,text,timestamptz,text[],integer,integer)'),
        to_regprocedure('public.write_retailer_control_state_evidence_v1(uuid,integer,text,bigint,boolean,text,text,text,text,timestamptz,timestamptz,timestamptz,text,text,jsonb,text,text)'))),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(jsonb_build_object(
      'identity',n.nspname||'.'||c.relname,'kind',c.relkind::text,'owner',pg_get_userbyid(c.relowner),
      'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,
      'acl',coalesce((select jsonb_agg(jsonb_build_object(
        'grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
        'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)
        order by case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,x.privilege_type)
        from pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) x),'[]'::jsonb))
      order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where (n.nspname='public' and c.relname in ('retailers','retailer_control_state_evidence_v1'))
         or (n.nspname='public' and c.relkind='S' and c.relname like 'retailer_control_state_evidence_v1%')),'[]'::jsonb),
    'column_grants',coalesce((select jsonb_agg(jsonb_build_object(
      'schema',table_schema,'table',table_name,'column',column_name,'grantee',grantee,
      'privilege',privilege_type,'grantable',is_grantable)
      order by table_schema,table_name,column_name,grantee,privilege_type)
      from information_schema.column_privileges where table_schema='public'
        and table_name in ('retailers','retailer_control_state_evidence_v1')),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object(
      'table',c.relname,'policy',p.polname,'permissive',p.polpermissive,'command',p.polcmd::text,
      'roles',(select coalesce(jsonb_agg(pg_get_userbyid(role_oid) order by pg_get_userbyid(role_oid)),'[]'::jsonb) from unnest(p.polroles) role_oid),
      'using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid))
      order by c.relname,p.polname) from pg_catalog.pg_policy p
      join pg_catalog.pg_class c on c.oid=p.polrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('retailers','retailer_control_state_evidence_v1')
        and (c.relname='retailer_control_state_evidence_v1' or p.polname='ra004_staging_preflight_retailer_read_v1')),'[]'::jsonb),
    'roles',coalesce((select jsonb_agg(jsonb_build_object(
      'role',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'create_role',r.rolcreaterole,
      'create_db',r.rolcreatedb,'login',r.rolcanlogin,'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,
      'can_set_from_session_user',pg_has_role(session_user,r.oid,'SET'),
      'is_member_from_session_user',pg_has_role(session_user,r.oid,'MEMBER')) order by r.rolname)
      from pg_catalog.pg_roles r where r.rolname='postgres' or r.rolname like 'ra004\\_%' escape '\\'
        or r.rolname in (concat('service','_role'),'authenticated','anon','retailer_catalogue_staging_validator',
          'retailer_catalogue_staging_approver','retailer_catalogue_staging_executor',
          'retailer_catalogue_production_validator','retailer_catalogue_production_approver',
          'retailer_catalogue_production_executor','retailer_control_state_exporter')),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object(
      'member',mr.rolname,'role',gr.rolname,'grantor',grantor.rolname,'admin',m.admin_option,
      'set',coalesce((to_jsonb(m)->>'set_option')::boolean,true),
      'inherit',coalesce((to_jsonb(m)->>'inherit_option')::boolean,true)) order by mr.rolname,gr.rolname)
      from pg_catalog.pg_auth_members m join pg_catalog.pg_roles mr on mr.oid=m.member
      join pg_catalog.pg_roles gr on gr.oid=m.roleid join pg_catalog.pg_roles grantor on grantor.oid=m.grantor
      where mr.rolname='postgres' or gr.rolname='postgres' or mr.rolname like 'ra004\\_%' escape '\\'
        or gr.rolname like 'ra004\\_%' escape '\\' or mr.rolname like 'retailer_control_state%'
        or gr.rolname like 'retailer_control_state%' or mr.rolname like 'retailer_catalogue_%'
        or gr.rolname like 'retailer_catalogue_%'),'[]'::jsonb)
  ) data`;

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function exact(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) {
    fail("RA004_LIVE_TRANSPORT_CONFIGURATION_BLOCKED", `${label} fields are not closed`);
  }
}

function validateDatabaseUrl(databaseUrl, { projectReference, expectedSessionUser }) {
  if (typeof databaseUrl !== "string" || databaseUrl.length < 20 || databaseUrl.length > 4096) {
    fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "database credential is absent");
  }
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "database credential is invalid"); }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)
      || !parsed.password || parsed.pathname !== "/postgres" || parsed.port !== "5432"
      || parsed.hash || [...parsed.searchParams.keys()].some((key) => key !== "sslmode")) {
    fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "database credential target is not the closed PostgreSQL endpoint");
  }
  const username = decodeURIComponent(parsed.username);
  const direct = parsed.hostname === `db.${projectReference}.supabase.co`
    && username === expectedSessionUser;
  const pooler = parsed.hostname.endsWith(".pooler.supabase.com")
    && username === `${expectedSessionUser}.${projectReference}`;
  if (!direct && !pooler) {
    fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "database credential is not bound to the exact staging project and login");
  }
  if (/aftboxmrdgyhizicfsfu|(?:^|[._-])(?:prod|production)(?:[._-]|$)/i.test(`${parsed.hostname}|${username}`)) {
    fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "production database target rejected");
  }
  return databaseUrl;
}

function clientOptions(databaseUrl, applicationName) {
  const hostname = new URL(databaseUrl).hostname;
  return {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true, servername: hostname, minVersion: "TLSv1.2" },
    application_name: applicationName,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    keepAlive: false,
    options: "-c default_transaction_read_only=on -c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000",
  };
}

async function oneReadOnlyCall({ ClientClass, databaseUrl, applicationName, text, values, expectedSessionUser, repeatableRead = false }) {
  const client = new ClientClass(clientOptions(databaseUrl, applicationName));
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query(repeatableRead ? "begin isolation level repeatable read read only" : "begin read only");
    const response = await client.query({ text, values });
    if (!response || response.rowCount !== 1 || response.rows.length !== 1
        || response.rows[0].session_user !== expectedSessionUser
        || response.rows[0].transaction_read_only !== "on") {
      fail("RA004_LIVE_TRANSPORT_PROOF_INVALID", "read-only session proof mismatch");
    }
    await client.query("rollback");
    connected = false;
    return {
      session_user: response.rows[0].session_user,
      transaction_read_only: true,
      data: response.rows[0].data,
    };
  } catch (error) {
    if (connected) { try { await client.query("rollback"); } catch { /* retain primary failure */ } }
    throw sanitizeError(error);
  } finally {
    try { await client.end(); } catch { /* connection is unusable and must not be retried */ }
  }
}

async function runAclRlsMetadataAudit(configuration, dependencies = {}) {
  exact(configuration, ["databaseUrl", "projectReference", "expectedSessionUser"], "ACL/RLS audit configuration");
  const ClientClass = dependencies.ClientClass || Client;
  if (typeof ClientClass !== "function" || configuration.expectedSessionUser !== "postgres") {
    fail("RA004_ACL_RLS_AUDIT_CONFIGURATION_BLOCKED", "exact migration user and client required");
  }
  const databaseUrl = validateDatabaseUrl(configuration.databaseUrl, configuration);
  return oneReadOnlyCall({
    ClientClass,
    databaseUrl,
    expectedSessionUser: "postgres",
    applicationName: "ra004-acl-rls-readonly-audit-v1",
    text: ACL_RLS_AUDIT_SQL,
    values: [],
    repeatableRead: true,
  });
}

function validateRevokeReceipt(receipt, { credentialId, runnerProcessId }) {
  exact(receipt, ["access_revoked", "credential_id", "issuer_process_id", "runner_process_id"], "revoke receipt");
  if (receipt.access_revoked !== true || receipt.credential_id !== credentialId
      || !Number.isSafeInteger(receipt.issuer_process_id) || receipt.issuer_process_id < 1
      || receipt.runner_process_id !== runnerProcessId
      || receipt.issuer_process_id === runnerProcessId) {
    fail("RA004_LIVE_TRANSPORT_REVOKE_FAILED", "separate issuer revoke proof mismatch");
  }
  return receipt;
}

function createPreflightPostgresTransport(configuration, dependencies = {}) {
  exact(configuration, [
    "databaseUrl", "projectReference", "canonicalHost", "expectedSessionUser",
    "credentialId", "projectIdentity", "evidenceStoreMetadata", "revokeCredential",
  ], "preflight transport configuration");
  const ClientClass = dependencies.ClientClass || Client;
  const runnerProcessId = dependencies.runnerProcessId || process.pid;
  if (typeof ClientClass !== "function" || !Number.isSafeInteger(runnerProcessId) || runnerProcessId < 1
      || typeof configuration.revokeCredential !== "function" || !SAFE_ID.test(configuration.credentialId)
      || !/^[a-z][a-z0-9_]{2,62}$/.test(configuration.expectedSessionUser)) {
    fail("RA004_LIVE_TRANSPORT_CONFIGURATION_BLOCKED", "preflight transport dependencies are invalid");
  }
  validateTarget({
    projectReference: configuration.projectReference,
    canonicalHost: configuration.canonicalHost,
    hostAllowlist: [configuration.canonicalHost],
  }, "RA004_LIVE_TRANSPORT_TARGET_BLOCKED");
  const projectIdentity = structuredClone(validateProjectIdentity(configuration.projectIdentity));
  const evidenceStoreMetadata = structuredClone(validateEvidenceStore(configuration.evidenceStoreMetadata));
  if (projectIdentity.project_reference !== configuration.projectReference
      || projectIdentity.canonical_host !== configuration.canonicalHost) {
    fail("RA004_LIVE_TRANSPORT_TARGET_BLOCKED", "project attestation differs from the transport target");
  }
  const databaseUrl = validateDatabaseUrl(configuration.databaseUrl, configuration);
  let rpcCalled = false;
  let revokeCalled = false;
  let closed = false;
  return Object.freeze({
    async readProjectIdentity() { return structuredClone(projectIdentity); },
    async readEvidenceStoreMetadata() { return structuredClone(evidenceStoreMetadata); },
    async callMetadataRpc(request) {
      if (rpcCalled || revokeCalled || closed) fail("RA004_LIVE_TRANSPORT_CALL_LIMIT", "metadata RPC may be called once");
      exact(request, ["function_name", "parameters"], "metadata RPC request");
      exact(request.parameters, [
        "p_environment", "p_retailer_name", "p_retailer_slug", "p_expected_ledger_count",
        "p_expected_ledger_fingerprint", "p_expected_session_user", "p_max_bytes",
        "p_ledger_fingerprint_contract_version",
      ], "metadata RPC parameters");
      if (request.function_name !== PREFLIGHT_RPC
          || request.parameters.p_ledger_fingerprint_contract_version !== LEDGER_FINGERPRINT_CONTRACT_VERSION
          || request.parameters.p_expected_session_user !== configuration.expectedSessionUser) {
        fail("RA004_LIVE_TRANSPORT_RPC_BLOCKED", "metadata RPC identity mismatch");
      }
      rpcCalled = true;
      const result = await oneReadOnlyCall({
        ClientClass, databaseUrl, expectedSessionUser: configuration.expectedSessionUser,
        applicationName: "ra004-staging-preflight-v1",
        text: `select session_user::text session_user,
                      current_setting('transaction_read_only') transaction_read_only,
                      public.read_ra004_staging_preflight_v1($1,$2,$3,$4,$5,$6,$7) data`,
        values: [
          request.parameters.p_environment, request.parameters.p_retailer_name,
          request.parameters.p_retailer_slug, request.parameters.p_expected_ledger_count,
          request.parameters.p_expected_ledger_fingerprint,
          request.parameters.p_expected_session_user, request.parameters.p_max_bytes,
        ],
      });
      return { function_name: PREFLIGHT_RPC, ...result };
    },
    async revoke() {
      if (revokeCalled) fail("RA004_LIVE_TRANSPORT_REVOKE_FAILED", "credential revoke may be called once");
      revokeCalled = true;
      const receipt = await configuration.revokeCredential(Object.freeze({
        credential_id: configuration.credentialId,
        expected_session_user: configuration.expectedSessionUser,
        runner_process_id: runnerProcessId,
      }));
      validateRevokeReceipt(receipt, { credentialId: configuration.credentialId, runnerProcessId });
      return { access_revoked: true };
    },
    async close() {
      if (closed) fail("RA004_LIVE_TRANSPORT_CLOSE_FAILED", "transport close may be called once");
      closed = true;
      return { connection_closed: true };
    },
  });
}

function createControlStatePostgresTransport(configuration, dependencies = {}) {
  exact(configuration, ["databaseUrl", "projectReference", "expectedSessionUser"], "control-state transport configuration");
  const ClientClass = dependencies.ClientClass || Client;
  if (typeof ClientClass !== "function" || !/^[a-z][a-z0-9_]{2,62}$/.test(configuration.expectedSessionUser)) {
    fail("RA004_LIVE_TRANSPORT_CONFIGURATION_BLOCKED", "control-state transport dependencies are invalid");
  }
  const databaseUrl = validateDatabaseUrl(configuration.databaseUrl, configuration);
  let called = false;
  return Object.freeze({
    async callReadOnlyRpc(request) {
      if (called) fail("RA004_LIVE_TRANSPORT_CALL_LIMIT", "control-state RPC may be called once");
      exact(request, ["function_name", "expected_session_user", "parameters"], "control-state RPC request");
      exact(request.parameters, [
        "p_retailer_id", "p_retailer_name", "p_baseline_sha", "p_authorization_fingerprint",
        "p_authorization_valid_until", "p_required_sources", "p_max_records", "p_max_bytes",
      ], "control-state RPC parameters");
      if (request.function_name !== CONTROL_STATE_RPC
          || request.expected_session_user !== configuration.expectedSessionUser) {
        fail("RA004_LIVE_TRANSPORT_RPC_BLOCKED", "control-state RPC identity mismatch");
      }
      called = true;
      return oneReadOnlyCall({
        ClientClass, databaseUrl, expectedSessionUser: configuration.expectedSessionUser,
        applicationName: "ra004-control-state-canary-v1",
        text: `select session_user::text session_user,
                      current_setting('transaction_read_only') transaction_read_only,
                      public.read_retailer_control_state_v1($1,$2,$3,$4,$5,$6,$7,$8) data`,
        values: [
          request.parameters.p_retailer_id, request.parameters.p_retailer_name,
          request.parameters.p_baseline_sha, request.parameters.p_authorization_fingerprint,
          request.parameters.p_authorization_valid_until, request.parameters.p_required_sources,
          request.parameters.p_max_records, request.parameters.p_max_bytes,
        ],
      });
    },
  });
}

module.exports = {
  ACL_RLS_AUDIT_SQL,
  CONTROL_STATE_RPC,
  createControlStatePostgresTransport,
  createPreflightPostgresTransport,
  runAclRlsMetadataAudit,
  validateDatabaseUrl,
  validateRevokeReceipt,
};
