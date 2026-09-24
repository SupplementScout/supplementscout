const { SOURCE_NAMES } = require("./schema");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function providerError(code, message) { const error = new Error(`${code}: ${message}`); error.code = code; throw error; }

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

function createLiveReadOnlyProvider({ authorization, providerConfiguration } = {}) {
  if (!authorization) providerError("CONTROL_EXPORT_UNAUTHORIZED", "live provider requires authorization before construction");
  if (!providerConfiguration) providerError("CONTROL_EXPORT_PROVIDER_CONFIG_REQUIRED", "live provider configuration is required");
  providerError("CONTROL_EXPORT_LIVE_PROVIDER_BLOCKED", "No approved complete read-only 10 Reps control-state interface exists; new RPC and direct SQL are forbidden");
}

module.exports = { FixtureControlStateProvider, createLiveReadOnlyProvider };
