const { Client } = require("pg");
const {
  RPC_NAME: PREFLIGHT_RPC,
  sanitizeError,
  validateEvidenceStore,
  validateProjectIdentity,
  validateTarget,
} = require("./ra004-staging-preflight-v1/contract");

const CONTROL_STATE_RPC = "public.read_retailer_control_state_v1";
const SAFE_ID = /^[a-z][a-z0-9_-]{2,127}$/;

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
  return {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    application_name: applicationName,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    keepAlive: false,
    options: "-c default_transaction_read_only=on -c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000",
  };
}

async function oneReadOnlyCall({ ClientClass, databaseUrl, applicationName, text, values, expectedSessionUser }) {
  const client = new ClientClass(clientOptions(databaseUrl, applicationName));
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query("begin read only");
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
      ], "metadata RPC parameters");
      if (request.function_name !== PREFLIGHT_RPC
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
  CONTROL_STATE_RPC,
  createControlStatePostgresTransport,
  createPreflightPostgresTransport,
  validateDatabaseUrl,
  validateRevokeReceipt,
};
