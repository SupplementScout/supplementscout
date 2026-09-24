const { SOURCE_NAMES } = require("./schema");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function providerError(code, message) { const error = new Error(`${code}: ${message}`); error.code = code; throw error; }
function methodNames(value) {
  const names = new Set();
  for (let current = value; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name !== "constructor" && typeof current[name] === "function") names.add(name);
    }
  }
  return [...names];
}

class FixtureControlStateProvider {
  constructor(fixture, faults = {}) {
    this.fixture = clone(fixture);
    this.faults = { ...faults };
  }

  describe() {
    return {
      mode: "fixture",
      provider_id: "local-fixture-control-state-v1",
      credential_type: "NONE",
      read_only_proven: true,
      service_role: false,
      mutation_capabilities: [],
      approved_interfaces: SOURCE_NAMES.map((source) => `fixture:${source}`),
    };
  }

  async readConsistencyMarker(source) {
    if (!SOURCE_NAMES.includes(source)) providerError("CONTROL_EXPORT_SOURCE_NOT_ALLOWED", source);
    const calls = this.faults.markerCalls || (this.faults.markerCalls = {});
    calls[source] = (calls[source] || 0) + 1;
    if (this.faults.inconsistentSource === source && calls[source] > 1) return { sequence: "changed", total_count: (this.fixture.sources[source] || []).length };
    return { sequence: this.fixture.consistency_sequence || "fixture-sequence-1", total_count: (this.fixture.sources[source] || []).length };
  }

  async readPage(source, { cursor, page_size }) {
    if (!SOURCE_NAMES.includes(source)) providerError("CONTROL_EXPORT_SOURCE_NOT_ALLOWED", source);
    if (this.faults.unavailableSource === source) providerError("CONTROL_EXPORT_SOURCE_UNAVAILABLE", source);
    const rows = this.fixture.sources[source];
    if (!Array.isArray(rows)) providerError("CONTROL_EXPORT_SOURCE_UNAVAILABLE", source);
    const offset = cursor === null ? 0 : Number(cursor);
    const pageNumber = Math.floor(offset / page_size) + 1;
    if (this.faults.missingPageSource === source && pageNumber === 2) return { page_number: 3, records: [], next_cursor: null, total_count: rows.length };
    const pageRows = rows.slice(offset, offset + page_size);
    let nextCursor = offset + pageRows.length < rows.length ? String(offset + pageRows.length) : null;
    if (this.faults.repeatedCursorSource === source && pageNumber > 1 && nextCursor !== null) nextCursor = String(cursor);
    const totalDelta = this.faults.totalChangeSource === source && pageNumber > 1 ? 1 : 0;
    return { page_number: pageNumber, records: clone(pageRows), next_cursor: nextCursor, total_count: rows.length + totalDelta };
  }
}

function createLiveReadOnlyProvider({ authorization, providerConfiguration, transport } = {}) {
  if (!authorization) providerError("CONTROL_EXPORT_UNAUTHORIZED", "live provider requires authorization before construction");
  if (!providerConfiguration) providerError("CONTROL_EXPORT_PROVIDER_CONFIG_REQUIRED", "live provider configuration is required");
  const allowedConfiguration = new Set(["provider_id", "credential_type", "rpc_name", "expected_session_user"]);
  for (const key of Object.keys(providerConfiguration)) {
    if (!allowedConfiguration.has(key)) providerError("CONTROL_EXPORT_PROVIDER_CONFIG_INVALID", `unsupported configuration field ${key}`);
  }
  if (providerConfiguration.credential_type !== "DEDICATED_CONTROL_STATE_EXPORTER"
      || providerConfiguration.rpc_name !== "public.read_retailer_control_state_v1"
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(providerConfiguration.provider_id || "")
      || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(providerConfiguration.expected_session_user || "")) {
    providerError("CONTROL_EXPORT_PROVIDER_CONFIG_INVALID", "live provider must bind the dedicated exporter role and v1 RPC");
  }
  if (!transport || typeof transport !== "object") providerError("CONTROL_EXPORT_TRANSPORT_REQUIRED", "live transport must be injected by a separately reviewed runtime");
  const transportFunctions = methodNames(transport);
  if (transportFunctions.length !== 1 || transportFunctions[0] !== "callReadOnlyRpc") {
    providerError("CONTROL_EXPORT_TRANSPORT_CAPABILITY_BLOCKED", "transport must expose only callReadOnlyRpc");
  }
  let called = false;
  return Object.freeze({
    describe() {
      return {
        mode: "live-read-only",
        provider_id: providerConfiguration.provider_id,
        credential_type: providerConfiguration.credential_type,
        session_user: providerConfiguration.expected_session_user,
        read_only_proven: true,
        service_role: false,
        mutation_capabilities: [],
        approved_interfaces: [providerConfiguration.rpc_name],
      };
    },
    async readSnapshot(request) {
      if (called) providerError("CONTROL_EXPORT_READ_LIMIT_EXCEEDED", "transactional snapshot may be requested only once");
      called = true;
      const response = await transport.callReadOnlyRpc(Object.freeze({
        function_name: providerConfiguration.rpc_name,
        expected_session_user: providerConfiguration.expected_session_user,
        parameters: Object.freeze({
          p_retailer_id: Number(request.retailer_id),
          p_retailer_name: request.retailer_name,
          p_baseline_sha: request.baseline_sha,
          p_authorization_fingerprint: request.authorization_fingerprint,
          p_authorization_valid_until: request.authorization_valid_until,
          p_required_sources: [...SOURCE_NAMES],
          p_max_records: 10000,
          p_max_bytes: 8388608,
        }),
      }));
      if (!response || response.session_user !== providerConfiguration.expected_session_user || response.transaction_read_only !== true) {
        providerError("CONTROL_EXPORT_PROVIDER_CREDENTIAL_BLOCKED", "transport did not prove the dedicated read-only session");
      }
      return response.data;
    },
  });
}

module.exports = { FixtureControlStateProvider, createLiveReadOnlyProvider };
