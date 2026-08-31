const crypto = require("node:crypto");

const ACTIVE_STATUSES = new Set(["PENDING", "APPROVED"]);
const TERMINAL_STATUSES = new Set(["EXPIRED", "REJECTED", "IGNORED", "EXECUTED", "FAILED"]);
const REVIEW_KINDS = new Set(["IDENTITY_CONFLICT", "COMMERCIAL_CHANGE", "SOURCE_FAILURE", "MAPPING_DRIFT", "POLICY_REVIEW"]);
const OPERATIONS = new Set([
  "VERIFY_NO_CHANGE",
  "UPDATE_PRICE",
  "UPDATE_STOCK",
  "UPDATE_PRICE_AND_STOCK",
  "IDENTITY_PROMOTION",
  "REBIND_EXISTING_VARIANT",
  "SOURCE_MISSING",
  "UNAVAILABLE_DECISION",
  "MANUAL_REVIEW",
  "MANUAL_REVIEW_IDENTITY",
  "SCOPE_EXPANSION_REVIEW",
]);
const REASON_CODES = new Set([
  "FRESHNESS_CONFIRMATION",
  "STALE_OFFER",
  "NO_CHANGE_CONFIRMATION",
  "PRICE_CHANGE",
  "STOCK_CHANGE",
  "PRICE_AND_STOCK_CHANGE",
  "SOURCE_FAILURE",
  "SOURCE_MISSING",
  "MISSING_FROM_SOURCE",
  "IDENTITY_CONFLICT",
  "MAPPING_DRIFT",
  "POLICY_REVIEW",
  "SCOPE_EXPANSION_REVIEW",
  "MANUAL_REVIEW",
  "OUTSIDE_APPROVED_SCOPE",
]);
const HEX64 = /^[0-9a-f]{64}$/;
const MAX_BATCH_ROWS = 1000;

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function reasonList(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,|]/);
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function activeProblemKey(row) {
  return `${row.retailer_id}:${row.offer_id}`;
}

function rowProblemKey(row) {
  return `${activeProblemKey(row)}:${row.source_row_fingerprint}`;
}

function validateManifest(manifest, options = {}) {
  if (!manifest || typeof manifest !== "object") fail("Review publisher manifest must be an object");
  if (manifest.schema_version !== 1 || manifest.kind !== "automation-review-publisher-manifest") fail("Unexpected review publisher manifest schema");
  if (!manifest.generated_at || Number.isNaN(Date.parse(manifest.generated_at))) fail("Manifest generated_at is required");
  if (!Array.isArray(manifest.rows) || manifest.rows.length > (options.maxRows || MAX_BATCH_ROWS)) fail("Manifest row batch limit exceeded");
  if (!Array.isArray(manifest.observed_offer_ids)) fail("Manifest observed_offer_ids is required");
  const rows = manifest.rows.map((row, index) => validateRow(row, index));
  const observed = manifest.observed_offer_ids.map((id) => String(id));
  if (new Set(rows.map(rowProblemKey)).size !== rows.length) fail("Manifest contains duplicate active problem fingerprints");
  if (rows.some((row) => !observed.includes(String(row.offer_id)))) fail("Every review row offer must be present in observed_offer_ids");
  if (!manifest.retailer || !manifest.retailer_id) fail("Manifest retailer binding is required");
  if (rows.some((row) => String(row.retailer_id) !== String(manifest.retailer_id) || row.retailer !== manifest.retailer)) fail("Manifest row retailer binding mismatch");
  if (manifest.report_sha256 && !HEX64.test(manifest.report_sha256)) fail("Invalid report_sha256");
  if (manifest.artifact_sha256 && !HEX64.test(manifest.artifact_sha256)) fail("Invalid artifact_sha256");
  if (manifest.commit_sha && !/^[0-9a-f]{7,40}$/.test(manifest.commit_sha)) fail("Invalid commit_sha");
  return { ...manifest, rows, observed_offer_ids: observed };
}

function validateRow(row, index) {
  if (!row || typeof row !== "object") fail(`Review row ${index} must be an object`);
  const required = ["retailer_id", "retailer", "offer_id", "review_status", "review_kind", "operation_type", "reason_codes", "source_row_fingerprint", "source_captured_at", "expires_at"];
  for (const key of required) if (row[key] === undefined || row[key] === null || row[key] === "") fail(`Review row ${index} missing ${key}`);
  if (row.review_status !== "PENDING") fail(`Review row ${index} must be PENDING`);
  if (!REVIEW_KINDS.has(row.review_kind)) fail(`Unknown review kind ${row.review_kind}`);
  if (!OPERATIONS.has(row.operation_type)) fail(`Unknown operation ${row.operation_type}`);
  const reasons = reasonList(row.reason_codes);
  if (!reasons.length || reasons.some((reason) => !REASON_CODES.has(reason))) fail(`Unknown reason code in row ${index}`);
  if (!HEX64.test(row.source_row_fingerprint)) fail(`Invalid source_row_fingerprint in row ${index}`);
  if (row.plan_fingerprint !== undefined && row.plan_fingerprint !== null && row.plan_fingerprint !== "" && !HEX64.test(row.plan_fingerprint)) fail(`Invalid plan_fingerprint in row ${index}`);
  if (Number.isNaN(Date.parse(row.source_captured_at)) || Number.isNaN(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.parse(row.source_captured_at)) fail(`Invalid timestamps in row ${index}`);
  for (const key of ["before_state", "proposed_state", "impact_summary", "source_evidence"]) {
    if (row[key] !== null && row[key] !== undefined && (typeof row[key] !== "object" || Array.isArray(row[key]))) fail(`Review row ${index} ${key} must be an object or null`);
  }
  return {
    ...row,
    retailer_id: String(row.retailer_id),
    offer_id: String(row.offer_id),
    retailer_product_id: row.retailer_product_id == null ? null : String(row.retailer_product_id),
    current_product_id: row.current_product_id == null ? null : String(row.current_product_id),
    current_variant_id: row.current_variant_id == null ? null : String(row.current_variant_id),
    proposed_product_id: row.proposed_product_id == null ? null : String(row.proposed_product_id),
    proposed_variant_id: row.proposed_variant_id == null ? null : String(row.proposed_variant_id),
    before_state: row.before_state || null,
    proposed_state: row.proposed_state || null,
    impact_summary: row.impact_summary || {},
    source_evidence: row.source_evidence || {},
  };
}

function validateRetailerBinding(manifest, retailers) {
  const matched = (retailers || []).find((row) => String(row.id) === String(manifest.retailer_id));
  if (!matched || matched.name !== manifest.retailer) fail("Review publisher retailer binding mismatch");
}

function planPublication(manifestInput, activeRowsInput, options = {}) {
  const manifest = validateManifest(manifestInput, options);
  const activeRows = (activeRowsInput || []).filter((row) => ACTIVE_STATUSES.has(row.review_status));
  const incomingByProblem = new Map(manifest.rows.map((row) => [rowProblemKey(row), row]));
  const incomingByOffer = new Map();
  for (const row of manifest.rows) {
    if (!incomingByOffer.has(activeProblemKey(row))) incomingByOffer.set(activeProblemKey(row), []);
    incomingByOffer.get(activeProblemKey(row)).push(row);
  }
  const created = [];
  const refreshed = [];
  const expired = [];
  const activeByProblem = new Map(activeRows.map((row) => [rowProblemKey(row), row]));
  for (const row of manifest.rows) {
    const existing = activeByProblem.get(rowProblemKey(row));
    if (existing) refreshed.push({ existing, row });
    else created.push(row);
  }
  const newRowsByOffer = new Map(created.map((row) => [activeProblemKey(row), row]));
  const observed = new Set(manifest.observed_offer_ids.map((id) => `${manifest.retailer_id}:${id}`));
  for (const active of activeRows) {
    const key = activeProblemKey(active);
    if (incomingByProblem.has(rowProblemKey(active))) continue;
    if (!observed.has(key)) continue;
    const replacement = newRowsByOffer.get(key) || null;
    expired.push({
      existing: active,
      replacement,
      code: replacement ? "EVIDENCE_SUPERSEDED" : "RESOLVED_BY_SOURCE",
      message: replacement ? "Fresh evidence produced a new semantic problem fingerprint for this offer." : "Fresh evidence no longer reports this active review problem.",
    });
  }
  return {
    result: "PASS",
    manifest,
    counts: {
      incoming: manifest.rows.length,
      active_existing: activeRows.length,
      created: created.length,
      refreshed: refreshed.length,
      expired: expired.length,
      catalogue_writes: 0,
    },
    created,
    refreshed,
    expired,
    plan_hash: sha256({ manifest: { retailer_id: manifest.retailer_id, rows: manifest.rows.map(rowProblemKey), observed_offer_ids: manifest.observed_offer_ids }, created: created.map(rowProblemKey), refreshed: refreshed.map((item) => item.existing.id), expired: expired.map((item) => item.existing.id) }),
  };
}

function expectedState(row) {
  return {
    review_id: row && row.id != null ? String(row.id) : null,
    review_status: row && row.review_status ? row.review_status : null,
    source_row_fingerprint: row && row.source_row_fingerprint ? row.source_row_fingerprint : null,
    superseded_by_review_id: row && row.superseded_by_review_id != null ? String(row.superseded_by_review_id) : null,
  };
}

function publicationRow(row) {
  const textOrNull = (value) => value == null || value === "" ? null : String(value);
  const numberOrNull = (value) => value == null || value === "" ? null : String(value);
  return {
    snapshot_id: textOrNull(row.snapshot_id) || `automation-review-${row.retailer_id}-${row.offer_id}`,
    review_item_id: textOrNull(row.review_item_id) || `${row.retailer_id}:${row.offer_id}:${row.source_row_fingerprint}`,
    source_record_id: textOrNull(row.source_record_id) || `${row.retailer_id}:${row.offer_id}`,
    retailer: row.retailer,
    product_title: row.product_title || `Offer ${row.offer_id}`,
    variant_title: textOrNull(row.variant_title),
    primary_status: row.primary_status || row.review_status || "PENDING",
    reason_codes: Array.isArray(row.reason_codes) ? row.reason_codes.join(",") : String(row.reason_codes || ""),
    confidence: row.confidence || "LOW",
    canonical_candidates: Array.isArray(row.canonical_candidates) ? row.canonical_candidates : [],
    source_sku: textOrNull(row.source_sku),
    source_gtin: textOrNull(row.source_gtin),
    source_weight: textOrNull(row.source_weight),
    source_price: row.source_price == null || row.source_price === "" ? null : String(row.source_price),
    source_url: textOrNull(row.source_url),
    suggested_action: row.suggested_action || row.operation_type || "",
    retailer_id: String(row.retailer_id),
    retailer_product_id: numberOrNull(row.retailer_product_id),
    offer_id: String(row.offer_id),
    current_product_id: numberOrNull(row.current_product_id),
    current_variant_id: numberOrNull(row.current_variant_id),
    proposed_product_id: numberOrNull(row.proposed_product_id),
    proposed_variant_id: numberOrNull(row.proposed_variant_id),
    review_status: row.review_status,
    review_kind: row.review_kind,
    operation_type: row.operation_type,
    before_state: row.before_state || null,
    proposed_state: row.proposed_state || null,
    impact_summary: row.impact_summary || {},
    source_evidence: row.source_evidence || {},
    source_captured_at: row.source_captured_at,
    expires_at: row.expires_at,
    workflow_run_url: textOrNull(row.workflow_run_url),
    artifact_url: textOrNull(row.artifact_url),
    source_row_fingerprint: row.source_row_fingerprint,
    artifact_fingerprint: row.artifact_fingerprint || row.source_row_fingerprint,
    plan_fingerprint: textOrNull(row.plan_fingerprint),
    plan_artifact_sha256: textOrNull(row.plan_artifact_sha256),
  };
}

function refreshPayload(row) {
  return {
    source_evidence: row.source_evidence || {},
    source_captured_at: row.source_captured_at,
    expires_at: row.expires_at,
    workflow_run_url: row.workflow_run_url || null,
    artifact_url: row.artifact_url || null,
    plan_fingerprint: row.plan_fingerprint || null,
    plan_artifact_sha256: row.plan_artifact_sha256 || null,
  };
}

function buildPublicationChangeset(manifestInput, activeRowsInput, options = {}) {
  const plan = planPublication(manifestInput, activeRowsInput, options);
  const insertedIdsByKey = options.insertedIdsByProblemKey || {};
  const operations = [];
  for (const row of plan.created) {
    operations.push({
      op: "CREATE",
      expected: expectedState(null),
      row: publicationRow(row),
      replacement_row: null,
    });
  }
  for (const item of plan.refreshed) {
    operations.push({
      op: "REFRESH",
      expected: expectedState(item.existing),
      row: refreshPayload(item.row),
      replacement_row: null,
    });
  }
  for (const item of plan.expired) {
    const op = item.replacement ? "SUPERSEDE" : "RESOLVE_BY_SOURCE";
    operations.push({
      op,
      expected: expectedState(item.existing),
      row: null,
      replacement_row: item.replacement
        ? {
          id: insertedIdsByKey[rowProblemKey(item.replacement)] || null,
          offer_id: String(item.replacement.offer_id),
          source_row_fingerprint: item.replacement.source_row_fingerprint,
        }
        : null,
    });
  }
  return {
    ...plan,
    operations,
    changeset_fingerprint: sha256({
      retailer_id: plan.manifest.retailer_id,
      observed_offer_ids: plan.manifest.observed_offer_ids,
      operations,
    }),
  };
}

function buildPublicationRpcRequest(manifestInput, activeRowsInput, options = {}) {
  const activeRows = activeRowsInput || [];
  const changeset = buildPublicationChangeset(manifestInput, activeRows, options);
  const manifest = changeset.manifest;
  const idempotencySeed = {
    retailer_id: manifest.retailer_id,
    publisher_batch_fingerprint: changeset.plan_hash,
    changeset_fingerprint: changeset.changeset_fingerprint,
    workflow_run_id: manifest.workflow_run_id || null,
    artifact_id: manifest.artifact_id || null,
    commit_sha: manifest.commit_sha || null,
  };
  return {
    schema_version: 1,
    kind: "automation-review-queue-publication",
    retailer: {
      id: String(manifest.retailer_id),
      slug: manifest.retailer_slug || manifest.retailer_slug_hint || String(manifest.retailer).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    },
    publisher_batch_fingerprint: changeset.plan_hash,
    idempotency_key: options.idempotencyKey || sha256(idempotencySeed),
    changeset_fingerprint: changeset.changeset_fingerprint,
    workflow_run_id: String(manifest.workflow_run_id || ""),
    artifact_id: String(manifest.artifact_id || ""),
    commit_sha: String(manifest.commit_sha || ""),
    capture_timestamp: manifest.generated_at,
    expected_baseline: options.expectedBaseline || {
      active_review_count: activeRows.length,
      catalogue_counts: options.catalogueCounts || {},
      catalogue_hash_without_review_queue: options.catalogueHashWithoutReviewQueue || sha256({ catalogue_counts: options.catalogueCounts || {} }),
    },
    operations: changeset.operations,
  };
}

function validateRpcResult(request, result) {
  if (!result || typeof result !== "object") fail("Review publisher RPC returned no result");
  if (result.batch_fingerprint !== request.publisher_batch_fingerprint) fail("Review publisher RPC batch fingerprint mismatch");
  if (result.changeset_fingerprint !== request.changeset_fingerprint) fail("Review publisher RPC changeset fingerprint mismatch");
  if (result.idempotency_key !== request.idempotency_key) fail("Review publisher RPC idempotency key mismatch");
  if (Number(result.catalogue_writes || 0) !== 0) fail("Review publisher RPC reported catalogue writes");
}

async function publishReviewManifestViaRpc(manifestInput, store, options = {}) {
  if (!store || typeof store.callRpc !== "function") fail("Review publisher requires a single-RPC store");
  const activeRows = options.activeRows || [];
  const request = buildPublicationRpcRequest(manifestInput, activeRows, options);
  if (options.mode === "dry-run") return { request, mode: "dry-run", database_writes: 0 };
  const result = await store.callRpc("publish_automation_review_queue_changes", { p_request: request });
  validateRpcResult(request, result);
  return { request, result, mode: "apply", database_writes: Number(result.database_writes || 0) };
}

async function publishReviewManifest(manifestInput, store, options = {}) {
  if (!store || typeof store.transaction !== "function") fail("Review publisher requires a transaction-capable store");
  const manifest = validateManifest(manifestInput, options);
  return store.transaction(async (tx) => {
    validateRetailerBinding(manifest, await tx.fetchRetailers([manifest.retailer_id]));
    const activeRows = await tx.fetchActiveRows(manifest.retailer_id, manifest.observed_offer_ids);
    const plan = planPublication(manifest, activeRows, options);
    if (options.mode === "dry-run") return { ...plan, mode: "dry-run", database_writes: 0 };
    const insertedByKey = new Map();
    for (const row of plan.created) {
      const inserted = await tx.insertReviewRow({ ...row, decision_actor: "automation-review-publisher", decision_at: null });
      insertedByKey.set(rowProblemKey(row), inserted);
    }
    for (const item of plan.refreshed) {
      await tx.refreshReviewRow(item.existing.id, item.existing.source_row_fingerprint, {
        source_evidence: item.row.source_evidence,
        source_captured_at: item.row.source_captured_at,
        expires_at: item.row.expires_at,
        workflow_run_url: item.row.workflow_run_url || null,
        artifact_url: item.row.artifact_url || null,
        plan_fingerprint: item.row.plan_fingerprint || null,
        plan_artifact_sha256: item.row.plan_artifact_sha256 || null,
        decision_actor: "automation-review-publisher",
      });
    }
    for (const item of plan.expired) {
      const replacement = item.replacement ? insertedByKey.get(rowProblemKey(item.replacement)) : null;
      await tx.expireReviewRow(item.existing.id, item.existing.source_row_fingerprint, {
        superseded_by_review_id: replacement ? replacement.id : null,
        execution_error_code: item.code,
        execution_error_message: item.message,
        decision_actor: "automation-review-publisher",
      });
    }
    return {
      ...plan,
      mode: "apply",
      database_writes: plan.created.length + plan.refreshed.length + plan.expired.length,
      inserted_review_ids: [...insertedByKey.values()].map((row) => row.id),
    };
  });
}

module.exports = {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  MAX_BATCH_ROWS,
  activeProblemKey,
  buildPublicationChangeset,
  buildPublicationRpcRequest,
  canonicalJson,
  planPublication,
  publishReviewManifest,
  publishReviewManifestViaRpc,
  reasonList,
  rowProblemKey,
  sha256,
  validateRpcResult,
  validateManifest,
};
