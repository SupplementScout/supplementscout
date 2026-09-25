const { RPC_NAME, fail, validateTarget } = require("./contract");

const TRANSPORT_METHODS = Object.freeze([
  "readProjectIdentity", "readEvidenceStoreMetadata", "callMetadataRpc", "revoke", "close",
]);

function functionNames(value) {
  const names = new Set();
  for (let current = value; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === "constructor") continue;
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (typeof descriptor?.value === "function") names.add(name);
      else if (descriptor?.get || descriptor?.set) fail("RA004_PREFLIGHT_PROVIDER_CAPABILITY_BLOCKED", "transport accessors are forbidden");
    }
  }
  return [...names].sort();
}

function createCounters() {
  return Object.fromEntries(["project_identity","evidence_store","connection","metadata_rpc","revoke","close","retry","prohibited"].map((name) => [name, { attempt_count: 0, performed_count: 0, denied_count: 0 }]));
}

function createClosedProvider({ configuration, transport }) {
  if (!configuration || !transport) fail("RA004_PREFLIGHT_PROVIDER_INVALID", "configuration and injected transport are required");
  const allowedConfig = ["environment","project_reference","canonical_host","host_allowlist","expected_session_user"];
  if (Object.keys(configuration).sort().join("|") !== allowedConfig.sort().join("|")) fail("RA004_PREFLIGHT_PROVIDER_INVALID", "configuration is not closed");
  if (configuration.environment !== "STAGING") fail("RA004_PREFLIGHT_PROVIDER_TARGET_BLOCKED", "only an allowlisted staging target is accepted");
  validateTarget({ projectReference: configuration.project_reference, canonicalHost: configuration.canonical_host, hostAllowlist: configuration.host_allowlist }, "RA004_PREFLIGHT_PROVIDER_TARGET_BLOCKED");
  if (functionNames(transport).join("|") !== [...TRANSPORT_METHODS].sort().join("|")) fail("RA004_PREFLIGHT_PROVIDER_CAPABILITY_BLOCKED", "transport exposes a general or incomplete capability");
  const counters = createCounters();
  let revoked = false, closed = false;
  const once = async (name, operation) => {
    const counter = counters[name]; counter.attempt_count += 1;
    const cleanupAfterRevoke = name === "close" && revoked && !closed;
    if (counter.performed_count > 0 || closed || (revoked && !cleanupAfterRevoke)) { counter.denied_count += 1; fail("RA004_PREFLIGHT_CAPABILITY_LIMIT", `${name} may be performed once`); }
    try { const result = await operation(); counter.performed_count += 1; return result; }
    catch (error) { counter.denied_count += 1; throw error; }
  };
  const provider = Object.freeze({
    readProjectIdentity: () => once("project_identity", () => transport.readProjectIdentity(Object.freeze({
      project_reference: configuration.project_reference, canonical_host: configuration.canonical_host,
      host_allowlist: Object.freeze([...configuration.host_allowlist]),
    }))),
    readEvidenceStoreMetadata: () => once("evidence_store", () => transport.readEvidenceStoreMetadata()),
    callMetadataRpc: async (parameters) => {
      counters.connection.attempt_count += 1;
      if (counters.connection.performed_count > 0 || revoked || closed) {
        counters.connection.denied_count += 1; counters.metadata_rpc.attempt_count += 1; counters.metadata_rpc.denied_count += 1;
        fail("RA004_PREFLIGHT_CONNECTION_LIMIT", "a second connection or RPC is forbidden");
      }
      return once("metadata_rpc", async () => {
        const response = await transport.callMetadataRpc(Object.freeze({ function_name: RPC_NAME, parameters: Object.freeze({ ...parameters }) }));
        counters.connection.performed_count += 1;
        if (!response || response.function_name !== RPC_NAME || response.session_user !== configuration.expected_session_user
            || response.transaction_read_only !== true) fail("RA004_PREFLIGHT_PROVIDER_PROOF_INVALID", "RPC session proof mismatch");
        return response.data;
      });
    },
    revokeAndClose: async () => {
      let revokeError;
      try { await once("revoke", async () => { const receipt = await transport.revoke(); if (!receipt?.access_revoked) fail("RA004_PREFLIGHT_REVOKE_FAILED", "access was not revoked"); revoked = true; }); }
      catch (error) { revokeError = error; }
      await once("close", async () => { const receipt = await transport.close(); if (!receipt?.connection_closed) fail("RA004_PREFLIGHT_CLOSE_FAILED", "connection was not closed"); closed = true; });
      if (revokeError) throw revokeError;
      return { access_revoked: revoked, connection_closed: closed };
    },
  });
  return Object.freeze({ provider, snapshotCounters: () => structuredClone(counters) });
}

module.exports = { TRANSPORT_METHODS, createClosedProvider, createCounters, functionNames };
