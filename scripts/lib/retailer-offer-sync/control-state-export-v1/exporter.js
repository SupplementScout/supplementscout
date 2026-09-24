const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson } = require("../../canonical-json");
const { hash } = require("../../retailer-snapshot/fingerprints");
const { validateAuthorization } = require("./authorization");
const {
  ALLOWED_PROVIDER_METHODS,
  SCHEMA_VERSION,
  SOURCE_NAMES,
  SOURCE_REGISTRY,
  assertOutputShape,
} = require("./schema");

const MUTATION_METHOD = /^(?:insert|update|upsert|delete|mutate|rpc|query|sql|transaction|create|approve|apply|acquire|publish|write)/i;
const SENSITIVE_VALUE = /(?:postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|(?:token|password|secret)=)[^\s]*/ig;
const PAGE_SIZE = 100;

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function functionsOn(value) {
  const entries = new Map();
  let current = value;
  while (current && current !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(current)) {
      if (name === "constructor" || entries.has(name)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (typeof descriptor?.value === "function") entries.set(name, descriptor.value);
    }
    current = Object.getPrototypeOf(current);
  }
  return entries;
}

function createReadOnlyCapability(provider, counters = { mutation_attempt_count: 0 }) {
  if (!provider || typeof provider !== "object") fail("CONTROL_EXPORT_PROVIDER_INVALID", "provider is required");
  for (const name of functionsOn(provider).keys()) {
    if (MUTATION_METHOD.test(name) || !ALLOWED_PROVIDER_METHODS.has(name)) fail("CONTROL_EXPORT_PROVIDER_MUTATION_CAPABILITY", `provider exposes forbidden method ${name}`);
  }
  for (const name of ALLOWED_PROVIDER_METHODS) if (typeof provider[name] !== "function") fail("CONTROL_EXPORT_PROVIDER_INVALID", `provider is missing ${name}`);
  const descriptor = provider.describe();
  if (!descriptor || descriptor.mutation_capabilities?.length || descriptor.service_role === true) fail("CONTROL_EXPORT_PROVIDER_MUTATION_CAPABILITY", "provider descriptor exposes mutation or service-role capability");
  if (descriptor.mode === "live-read-only") {
    if (descriptor.credential_type !== "DEDICATED_READ_ONLY_VALIDATOR" || descriptor.read_only_proven !== true) fail("CONTROL_EXPORT_PROVIDER_CREDENTIAL_BLOCKED", "live credential is not proven read-only");
    const missingInterface = SOURCE_REGISTRY.find((source) => !source.live_interface);
    if (missingInterface) fail("CONTROL_EXPORT_LIVE_PROVIDER_BLOCKED", `${missingInterface.name}: ${missingInterface.unavailable_reason}`);
  } else if (descriptor.mode !== "fixture" || descriptor.credential_type !== "NONE") {
    fail("CONTROL_EXPORT_PROVIDER_CREDENTIAL_BLOCKED", "fixture provider must expose no credential");
  }
  return new Proxy(provider, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property === "string" && (MUTATION_METHOD.test(property) || (typeof value === "function" && !ALLOWED_PROVIDER_METHODS.has(property)))) {
        counters.mutation_attempt_count += 1;
        fail("CONTROL_EXPORT_MUTATION_ATTEMPT", `forbidden capability ${property}`);
      }
      return value;
    },
  });
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, /^(?:secret|token|password|credential|connection_string|authorization|authorization_header|cookie|headers?|database_url|service_role_key)$/i.test(key) ? "[REDACTED]" : redact(child)]));
  }
  return typeof value === "string" ? value.replace(SENSITIVE_VALUE, "[REDACTED]") : value;
}

function timestamp(value) {
  const epoch = new Date(value).getTime();
  if (!Number.isFinite(epoch)) fail("CONTROL_EXPORT_SOURCE_INVALID", `invalid timestamp ${value}`);
  return new Date(epoch).toISOString();
}

function recordId(record, source) {
  const id = record?.id === undefined || record?.id === null ? "" : String(record.id).trim();
  if (!id) fail("CONTROL_EXPORT_SOURCE_INVALID", `${source} record lacks id`);
  return id;
}

function stableRecords(records, source) {
  const seen = new Set();
  const registry = SOURCE_REGISTRY.find((entry) => entry.name === source);
  return records.map((record) => redact(record)).sort((left, right) => recordId(left, source).localeCompare(recordId(right, source))).map((record) => {
    const id = recordId(record, source);
    for (const field of registry.required_fields) if (!Object.hasOwn(record, field)) fail("CONTROL_EXPORT_SOURCE_INVALID", `${source} ${id} lacks ${field}`);
    if (seen.has(id)) fail("CONTROL_EXPORT_DUPLICATE_RECORD", `${source} duplicate ${id}`);
    seen.add(id);
    return record;
  });
}

async function readAllPages(capability, source, counters) {
  let cursor = null;
  let expectedPage = 1;
  let expectedTotal = null;
  const cursors = new Set();
  const rows = [];
  const pages = [];
  do {
    const cursorKey = cursor === null ? "<START>" : String(cursor);
    if (cursors.has(cursorKey)) fail("CONTROL_EXPORT_CURSOR_REPEATED", `${source} repeated cursor ${cursorKey}`);
    cursors.add(cursorKey);
    counters.read_attempt_count += 1;
    const page = await capability.readPage(source, { cursor, page_size: PAGE_SIZE });
    if (!page || page.page_number !== expectedPage || !Array.isArray(page.records)) fail("CONTROL_EXPORT_PAGE_MISSING", `${source} expected page ${expectedPage}`);
    if (!Number.isSafeInteger(page.total_count) || page.total_count < 0) fail("CONTROL_EXPORT_SOURCE_INVALID", `${source} invalid total count`);
    if (expectedTotal === null) expectedTotal = page.total_count;
    if (expectedTotal !== page.total_count) fail("CONTROL_EXPORT_TOTAL_COUNT_CHANGED", `${source} total changed during pagination`);
    pages.push({ page_number: page.page_number, record_count: page.records.length, cursor_in: cursor, cursor_out: page.next_cursor ?? null, total_count: page.total_count });
    rows.push(...page.records);
    cursor = page.next_cursor ?? null;
    expectedPage += 1;
  } while (cursor !== null);
  if (rows.length !== expectedTotal) fail("CONTROL_EXPORT_INCOMPLETE_SOURCE", `${source} returned ${rows.length}/${expectedTotal}`);
  return { rows: stableRecords(rows, source), evidence: { page_size: PAGE_SIZE, page_count: pages.length, record_count: rows.length, pages } };
}

function inPast(value, now) { return value ? new Date(value).getTime() <= new Date(now).getTime() : false; }
function includesRetailer(record, retailerId) {
  const ids = Array.isArray(record.retailer_ids) ? record.retailer_ids.map(String) : [];
  return record.scope === "GLOBAL" || ids.includes(String(retailerId));
}
function latest(rows, field) {
  return rows.length ? [...rows].sort((a, b) => String(b[field] || "").localeCompare(String(a[field] || "")) || String(b.id).localeCompare(String(a.id)))[0] : null;
}

function derivedConflicts({ activePlans, sessions, activeLocks, approvals }) {
  const conflicts = [];
  const crossScope = [
    ["PLAN", activePlans], ["SESSION", sessions], ["LOCK", activeLocks], ["APPROVAL", approvals],
  ];
  for (const [kind, rows] of crossScope) {
    for (const row of rows) {
      if (row.scope === "GLOBAL" || (row.retailer_ids || []).length > 1) conflicts.push({
        id: `derived-cross-${kind.toLowerCase()}-${row.id}`,
        reason_code: `CROSS_RETAILER_${kind}`,
        source_reference: `${kind.toLowerCase()}:${row.id}`,
        scope: row.scope === "GLOBAL" ? "GLOBAL" : "CROSS_RETAILER",
        retailer_ids: [...(row.retailer_ids || [])].map(String).sort(),
      });
    }
  }
  const byFingerprint = new Map();
  for (const plan of activePlans) {
    if (!plan.source_fingerprint) continue;
    const rows = byFingerprint.get(plan.source_fingerprint) || [];
    rows.push(plan);
    byFingerprint.set(plan.source_fingerprint, rows);
  }
  for (const [fingerprint, rows] of byFingerprint) if (rows.length > 1) conflicts.push({
    id: `derived-equivalent-${fingerprint}`,
    reason_code: "EQUIVALENT_ACTIVE_PLAN",
    source_reference: rows.map((row) => `plan:${row.id}`).sort().join(","),
    scope: "RETAILER",
    retailer_ids: [...new Set(rows.flatMap((row) => row.retailer_ids || []).map(String))].sort(),
  });
  if (byFingerprint.size > 1) conflicts.push({
    id: "derived-conflicting-source-fingerprints",
    reason_code: "CONFLICTING_SOURCE_FINGERPRINTS",
    source_reference: [...byFingerprint.keys()].sort().join(","),
    scope: "RETAILER",
    retailer_ids: [...new Set(activePlans.flatMap((row) => row.retailer_ids || []).map(String))].sort(),
  });
  return conflicts;
}

function classify(records, request) {
  const now = request.now;
  const plans = records.control_plans.filter((row) => includesRetailer(row, request.retailer_id));
  const activePlans = plans.filter((row) => ["PLANNED", "APPROVED", "APPLYING", "PARTIALLY_APPLIED"].includes(row.status) && !inPast(row.expires_at, now));
  const incompletePlans = plans.filter((row) => ["FAILED", "PARTIALLY_APPLIED", "APPLYING", "INCOMPLETE"].includes(row.status));
  const expiredPlans = plans.filter((row) => row.status === "EXPIRED" || inPast(row.expires_at, now));
  const supersededPlans = plans.filter((row) => row.status === "SUPERSEDED");
  const recoveryPlans = [...plans.filter((row) => row.kind === "RECOVERY"), ...records.recovery_state.filter((row) => includesRetailer(row, request.retailer_id) && row.status !== "COMPLETED")];
  const sessions = records.sessions.filter((row) => includesRetailer(row, request.retailer_id));
  const openSessions = sessions.filter((row) => row.status === "OPEN");
  const staleSessions = openSessions.filter((row) => row.heartbeat_status === "STALE" || inPast(row.heartbeat_expires_at, now));
  const activeLocks = records.locks.filter((row) => includesRetailer(row, request.retailer_id) && row.status === "ACTIVE" && !inPast(row.expires_at, now));
  const expiredLocks = records.locks.filter((row) => row.status === "EXPIRED" || inPast(row.expires_at, now));
  const sessionIds = new Set(records.sessions.map((row) => String(row.id)));
  const orphanedLocks = records.locks.filter((row) => row.status === "ORPHANED" || (row.owner_session_id && !sessionIds.has(String(row.owner_session_id))));
  const approvals = records.approval_contracts.filter((row) => includesRetailer(row, request.retailer_id));
  const pendingApprovals = approvals.filter((row) => row.status === "PENDING");
  const unusedApprovals = approvals.filter((row) => ["APPROVED", "UNUSED"].includes(row.status) && !row.consumed_at && !inPast(row.expires_at, now));
  const expiredApprovals = approvals.filter((row) => row.status === "EXPIRED" || inPast(row.expires_at, now));
  const consumedApprovals = approvals.filter((row) => row.status === "CONSUMED" || row.consumed_at);
  const revokedApprovals = approvals.filter((row) => row.status === "REVOKED");
  const conflicts = stableRecords([
    ...records.global_conflicts.filter((row) => includesRetailer(row, request.retailer_id)),
    ...derivedConflicts({ activePlans, sessions: openSessions, activeLocks, approvals: [...pendingApprovals, ...unusedApprovals] }),
  ], "global_conflicts");
  return {
    active_plans: activePlans, incomplete_plans: incompletePlans, expired_plans: expiredPlans,
    superseded_plans: supersededPlans, recovery_plans: recoveryPlans, sessions, open_sessions: openSessions,
    stale_sessions: staleSessions, active_locks: activeLocks, expired_locks: expiredLocks,
    orphaned_locks: orphanedLocks, pending_approvals: pendingApprovals,
    unused_approvals: unusedApprovals, expired_approvals: expiredApprovals,
    consumed_approvals: consumedApprovals, revoked_approvals: revokedApprovals,
    last_apply: latest(records.apply_ledger.filter((row) => includesRetailer(row, request.retailer_id)), "completed_at"),
    last_postflight: latest(records.postflight_state.filter((row) => includesRetailer(row, request.retailer_id)), "completed_at"),
    last_watchdog_result: latest(records.watchdog_state.filter((row) => includesRetailer(row, request.retailer_id)), "completed_at"),
    overlapping_scope_conflicts: conflicts,
  };
}

function assessment(classified, consistency, unavailable) {
  if (unavailable.length) return "BLOCKED_INCOMPLETE_EXPORT";
  if (consistency !== "CONSISTENT") return "BLOCKED_INCONSISTENT_SNAPSHOT";
  if (classified.recovery_plans.length) return "BLOCKED_RECOVERY";
  if (classified.active_plans.length) return "BLOCKED_ACTIVE_PLAN";
  if (classified.open_sessions.length) return "BLOCKED_ACTIVE_SESSION";
  if (classified.active_locks.length || classified.orphaned_locks.length) return "BLOCKED_LOCK";
  if (classified.pending_approvals.length || classified.unused_approvals.length) return "BLOCKED_APPROVAL";
  if (classified.incomplete_plans.length || classified.stale_sessions.length) return "BLOCKED_INCOMPLETE_STATE";
  if (classified.overlapping_scope_conflicts.length) return "BLOCKED_UNKNOWN";
  return "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION";
}

async function exportControlState({ provider, authorization, retailer_id, retailer_name, baseline_sha, provider_mode, now, task_id = "RA-004" }) {
  const request = { retailer_id: String(retailer_id), retailer_name, baseline_sha, provider_mode, now: timestamp(now), task_id };
  const approved = validateAuthorization(authorization, request, request.now);
  const counters = { read_attempt_count: 0, write_attempt_count: 0, mutation_attempt_count: 0 };
  const capability = createReadOnlyCapability(provider, counters);
  const descriptor = redact(capability.describe());
  if (descriptor.mode !== provider_mode) fail("CONTROL_EXPORT_PROVIDER_INVALID", "provider mode mismatch");
  const started = request.now;
  const before = {};
  const after = {};
  const records = {};
  const pagination = {};
  const unavailable = [];
  for (const source of SOURCE_NAMES) {
    counters.read_attempt_count += 1;
    before[source] = redact(await capability.readConsistencyMarker(source));
    try {
      const result = await readAllPages(capability, source, counters);
      records[source] = result.rows;
      pagination[source] = result.evidence;
    } catch (error) {
      if (error.code !== "CONTROL_EXPORT_SOURCE_UNAVAILABLE") throw error;
      unavailable.push({ source, reason: error.message });
      records[source] = [];
      pagination[source] = { page_size: PAGE_SIZE, page_count: 0, record_count: 0, pages: [] };
    }
    counters.read_attempt_count += 1;
    after[source] = redact(await capability.readConsistencyMarker(source));
  }
  const consistency = SOURCE_NAMES.every((source) => canonicalJson(before[source]) === canonicalJson(after[source])) ? "CONSISTENT" : "INCONSISTENT";
  const classified = classify(records, request);
  const blockingReasons = [];
  const finalAssessment = assessment(classified, consistency, unavailable);
  if (finalAssessment !== "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION") blockingReasons.push(finalAssessment);
  for (const conflict of classified.overlapping_scope_conflicts) blockingReasons.push(conflict.reason_code || "CONTROL_SCOPE_CONFLICT");
  const recordCounts = Object.fromEntries(SOURCE_NAMES.map((source) => [source, records[source].length]));
  const statePayload = { records, classified, record_counts: recordCounts, consistency_markers: { before, after } };
  const canonicalStateFingerprint = hash("RA:CONTROL-STATE:1", statePayload);
  const completed = request.now;
  const output = {
    schema_version: SCHEMA_VERSION,
    retailer_id: request.retailer_id,
    retailer_name,
    baseline_sha,
    export_started_at: started,
    export_completed_at: completed,
    capture_window: { started_at: started, completed_at: completed, consistency_markers: { before, after } },
    authorization_fingerprint: approved.authorization_fingerprint,
    provider_identity: descriptor,
    sources_queried: [...SOURCE_NAMES],
    sources_unavailable: unavailable,
    source_records: records,
    completeness_status: unavailable.length ? "INCOMPLETE" : "COMPLETE",
    consistency_status: consistency,
    ...classified,
    blocking_reasons: [...new Set(blockingReasons)].sort(),
    warnings: finalAssessment === "CLEAR_FOR_SEPARATE_SHADOW_AUTHORIZATION" ? ["This result does not authorize capture or shadow execution"] : [],
    record_counts: recordCounts,
    pagination_evidence: pagination,
    ...counters,
    canonical_state_fingerprint: canonicalStateFingerprint,
    export_fingerprint: null,
    final_assessment: finalAssessment,
  };
  output.export_fingerprint = hash("RA:CONTROL-STATE-EXPORT:1", output);
  return assertOutputShape(Object.freeze(output));
}

function writeArtifact(outputPath, output) {
  const resolved = path.resolve(outputPath);
  const temp = `${resolved}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const sidecar = `${resolved}.sha256`;
  if (fs.existsSync(resolved) || fs.existsSync(sidecar)) fail("CONTROL_EXPORT_OUTPUT_EXISTS", "artifact or digest already exists");
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(output, null, 2)}\n`, "utf8");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  let linked = false;
  try {
    fs.writeFileSync(temp, bytes, { flag: "wx", mode: 0o600 });
    fs.linkSync(temp, resolved);
    linked = true;
    fs.unlinkSync(temp);
    fs.writeFileSync(sidecar, `${digest}  ${path.basename(resolved)}\n`, { flag: "wx", mode: 0o600 });
    try { fs.chmodSync(resolved, 0o600); fs.chmodSync(sidecar, 0o600); } catch {}
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
    try { if (linked && fs.existsSync(resolved) && !fs.existsSync(sidecar)) fs.unlinkSync(resolved); } catch {}
    throw error;
  }
  return { path: resolved, sha256: digest, sha256_path: sidecar };
}

module.exports = {
  PAGE_SIZE,
  createReadOnlyCapability,
  exportControlState,
  redact,
  writeArtifact,
};
