const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildPublicationRpcRequest,
  planPublication,
  publishReviewManifest,
  publishReviewManifestViaRpc,
  sha256,
  validateManifest,
} = require("./lib/automation-review-publisher");

function row(overrides = {}) {
  const semantic = {
    retailer_id: "12",
    offer_id: "2748",
    operation_type: "IDENTITY_PROMOTION",
    reason_codes: "IDENTITY_CONFLICT",
    before_state: { offer: { id: "2748", price: "24.99", in_stock: true } },
    proposed_state: { source: "review" },
  };
  return {
    retailer_id: "12",
    retailer: "eBay UK",
    retailer_product_id: "2748",
    offer_id: "2748",
    current_product_id: "100",
    current_variant_id: "200",
    proposed_product_id: null,
    proposed_variant_id: null,
    review_status: "PENDING",
    review_kind: "IDENTITY_CONFLICT",
    operation_type: "IDENTITY_PROMOTION",
    reason_codes: "IDENTITY_CONFLICT",
    confidence: "LOW",
    before_state: semantic.before_state,
    proposed_state: semantic.proposed_state,
    impact_summary: { direct_catalogue_writes: 0 },
    source_evidence: { workflow_run_id: "33382627453", artifact_id: "9754436306" },
    source_row_fingerprint: sha256(semantic),
    plan_fingerprint: null,
    plan_artifact_sha256: null,
    source_captured_at: "2026-08-31T10:30:00.000Z",
    expires_at: "2026-09-07T10:30:00.000Z",
    workflow_run_url: "https://github.com/SupplementScout/supplementscout/actions/runs/33382627453",
    artifact_url: "https://github.com/SupplementScout/supplementscout/actions/runs/33382627453/artifacts/9754436306",
    ...overrides,
  };
}

function manifest(overrides = {}) {
  const rows = overrides.rows || [row()];
  return {
    schema_version: 1,
    kind: "automation-review-publisher-manifest",
    generated_at: "2026-08-31T10:31:00.000Z",
    retailer_id: "12",
    retailer: "eBay UK",
    retailer_slug: "ebay-uk",
    observed_offer_ids: rows.map((item) => String(item.offer_id)),
    workflow_run_id: "33382627453",
    artifact_id: "9754436306",
    commit_sha: "d88db10b16565756d6247665790d214e3b51e0d4",
    report_sha256: "a".repeat(64),
    artifact_sha256: "b".repeat(64),
    rows,
    ...overrides,
  };
}

function active(overrides = {}) {
  const base = row();
  return {
    id: "501",
    retailer_id: base.retailer_id,
    retailer: base.retailer,
    offer_id: base.offer_id,
    review_status: "PENDING",
    source_row_fingerprint: base.source_row_fingerprint,
    ...overrides,
  };
}

function store({ activeRows = [], retailers = [{ id: "12", name: "eBay UK" }], failOn = null } = {}) {
  const calls = [];
  return {
    calls,
    async transaction(callback) {
      calls.push(["begin"]);
      if (failOn === "begin") throw new Error("begin failed");
      try {
        const result = await callback({
          async fetchRetailers(ids) {
            calls.push(["fetchRetailers", ids]);
            return retailers;
          },
          async fetchActiveRows(retailerId, offerIds) {
            calls.push(["fetchActiveRows", retailerId, offerIds]);
            return activeRows;
          },
          async insertReviewRow(payload) {
            calls.push(["insertReviewRow", payload.offer_id]);
            if (failOn === "insert") throw new Error("insert failed");
            return { id: `new-${payload.offer_id}` };
          },
          async refreshReviewRow(id, fingerprint, payload) {
            calls.push(["refreshReviewRow", id, fingerprint, payload.decision_actor]);
            if (failOn === "refresh") throw new Error("refresh failed");
            return { id };
          },
          async expireReviewRow(id, fingerprint, payload) {
            calls.push(["expireReviewRow", id, fingerprint, payload.execution_error_code, payload.superseded_by_review_id]);
            if (failOn === "expire") throw new Error("expire failed");
            return { id };
          },
        });
        calls.push(["commit"]);
        return result;
      } catch (error) {
        calls.push(["rollback"]);
        throw error;
      }
    },
  };
}

test("validates retailer binding, schema, reason codes and batch limit", () => {
  assert.equal(validateManifest(manifest()).rows.length, 1);
  assert.throws(() => validateManifest({ ...manifest(), kind: "other" }), /Unexpected review publisher manifest schema/);
  assert.throws(() => validateManifest(manifest({ rows: [row({ reason_codes: "NOPE" })] })), /Unknown reason code/);
  assert.throws(() => validateManifest(manifest({ rows: [row({ retailer_id: "99" })] })), /retailer binding mismatch/);
  assert.throws(() => validateManifest(manifest({ rows: Array.from({ length: 2 }, () => row()) })), /duplicate active problem/);
  assert.throws(() => validateManifest(manifest({ rows: [row()], observed_offer_ids: [] })), /Every review row offer/);
  assert.throws(() => validateManifest(manifest({ rows: [row(), row({ offer_id: "2749", source_row_fingerprint: "c".repeat(64) })] }), { maxRows: 1 }), /batch limit/);
});

test("plans create, refresh, supersede and resolved-by-source without catalogue writes", () => {
  const current = row();
  const replacement = row({
    source_row_fingerprint: sha256({ retailer_id: "12", offer_id: "2748", operation_type: "IDENTITY_PROMOTION", reason_codes: "MAPPING_DRIFT" }),
    reason_codes: "MAPPING_DRIFT",
    review_kind: "MAPPING_DRIFT",
    operation_type: "REBIND_EXISTING_VARIANT",
  });
  const incoming = row({ offer_id: "2750", source_row_fingerprint: "d".repeat(64) });
  const plan = planPublication(manifest({ rows: [current, replacement, incoming], observed_offer_ids: ["2748", "2749", "2750"] }), [
    active(),
    active({ id: "502", offer_id: "2748", source_row_fingerprint: "e".repeat(64) }),
    active({ id: "503", offer_id: "2749", source_row_fingerprint: "f".repeat(64) }),
  ]);
  assert.deepEqual(plan.counts, {
    incoming: 3,
    active_existing: 3,
    created: 2,
    refreshed: 1,
    expired: 2,
    catalogue_writes: 0,
  });
  assert.equal(plan.expired.find((item) => item.existing.id === "502").code, "EVIDENCE_SUPERSEDED");
  assert.equal(plan.expired.find((item) => item.existing.id === "503").code, "RESOLVED_BY_SOURCE");
});

test("apply requires transaction-capable store and records idempotent lifecycle writes only", async () => {
  await assert.rejects(() => publishReviewManifest(manifest(), {}, { mode: "apply" }), /transaction-capable store/);
  const fake = store({ activeRows: [active()] });
  const result = await publishReviewManifest(manifest(), fake, { mode: "apply" });
  assert.equal(result.database_writes, 1);
  assert.equal(result.counts.refreshed, 1);
  assert.equal(result.counts.created, 0);
  assert.equal(result.counts.catalogue_writes, 0);
  assert.deepEqual(fake.calls.map((call) => call[0]), ["begin", "fetchRetailers", "fetchActiveRows", "refreshReviewRow", "commit"]);
});

test("new fingerprint creates replacement and expires old row with supersede link", async () => {
  const incoming = row({ source_row_fingerprint: "c".repeat(64) });
  const fake = store({ activeRows: [active()] });
  const result = await publishReviewManifest(manifest({ rows: [incoming] }), fake, { mode: "apply" });
  assert.equal(result.counts.created, 1);
  assert.equal(result.counts.expired, 1);
  assert.deepEqual(fake.calls.map((call) => call[0]), ["begin", "fetchRetailers", "fetchActiveRows", "insertReviewRow", "expireReviewRow", "commit"]);
  const expire = fake.calls.find((call) => call[0] === "expireReviewRow");
  assert.equal(expire[3], "EVIDENCE_SUPERSEDED");
  assert.equal(expire[4], "new-2748");
});

test("problem disappearance expires active row as resolved by source", async () => {
  const fake = store({ activeRows: [active()] });
  const result = await publishReviewManifest(manifest({ rows: [], observed_offer_ids: ["2748"] }), fake, { mode: "apply" });
  assert.equal(result.counts.created, 0);
  assert.equal(result.counts.expired, 1);
  const expire = fake.calls.find((call) => call[0] === "expireReviewRow");
  assert.equal(expire[3], "RESOLVED_BY_SOURCE");
  assert.equal(expire[4], null);
});

test("source failure and scope-expansion review are accepted as review-only control-plane rows", () => {
  const sourceFailure = row({
    review_kind: "SOURCE_FAILURE",
    operation_type: "SOURCE_MISSING",
    reason_codes: "SOURCE_FAILURE",
    source_row_fingerprint: "1".repeat(64),
  });
  const scopeExpansion = row({
    offer_id: "3001",
    review_kind: "POLICY_REVIEW",
    operation_type: "SCOPE_EXPANSION_REVIEW",
    reason_codes: "SCOPE_EXPANSION_REVIEW",
    source_row_fingerprint: "2".repeat(64),
  });
  const plan = planPublication(manifest({ rows: [sourceFailure, scopeExpansion], observed_offer_ids: ["2748", "3001"] }), []);
  assert.equal(plan.counts.created, 2);
  assert.equal(plan.counts.catalogue_writes, 0);
});

test("transaction rolls back when any lifecycle write fails", async () => {
  const fake = store({ failOn: "insert" });
  await assert.rejects(() => publishReviewManifest(manifest(), fake, { mode: "apply" }), /insert failed/);
  assert.deepEqual(fake.calls.map((call) => call[0]), ["begin", "fetchRetailers", "fetchActiveRows", "insertReviewRow", "rollback"]);
});

test("unknown retailer fails before control-plane writes", async () => {
  const fake = store({ retailers: [] });
  await assert.rejects(() => publishReviewManifest(manifest(), fake, { mode: "apply" }), /retailer binding mismatch/);
  assert.deepEqual(fake.calls.map((call) => call[0]), ["begin", "fetchRetailers", "rollback"]);
});

test("RPC publisher builds a single transactional changeset and does not use REST-style lifecycle writes", async () => {
  const request = buildPublicationRpcRequest(manifest(), [active()], {
    expectedBaseline: {
      active_review_count: 1,
      catalogue_counts: { products: 10, product_variants: 11, retailer_products: 12, offers: 13, price_history: 14 },
      catalogue_hash_without_review_queue: "9".repeat(64),
    },
  });
  assert.equal(request.kind, "automation-review-queue-publication");
  assert.equal(request.retailer.slug, "ebay-uk");
  assert.equal(request.operations.length, 1);
  assert.equal(request.operations[0].op, "REFRESH");
  assert.equal(request.operations[0].expected.review_id, "501");
  assert.equal(request.operations[0].row.source_captured_at, row().source_captured_at);

  const calls = [];
  const result = await publishReviewManifestViaRpc(manifest(), {
    async callRpc(name, args) {
      calls.push([name, args]);
      return {
        status: "APPLIED",
        batch_fingerprint: args.p_request.publisher_batch_fingerprint,
        changeset_fingerprint: args.p_request.changeset_fingerprint,
        idempotency_key: args.p_request.idempotency_key,
        catalogue_writes: 0,
        database_writes: 3,
      };
    },
  }, { activeRows: [active()] });
  assert.deepEqual(calls.map((call) => call[0]), ["publish_automation_review_queue_changes"]);
  assert.equal(result.mode, "apply");
  assert.equal(result.database_writes, 3);
});

test("RPC publisher dry-run prepares request without database writes and rejects unsafe RPC echoes", async () => {
  const dryRun = await publishReviewManifestViaRpc(manifest(), {
    async callRpc() {
      throw new Error("RPC should not be called in dry-run");
    },
  }, { activeRows: [active()], mode: "dry-run" });
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.database_writes, 0);

  await assert.rejects(() => publishReviewManifestViaRpc(manifest(), {
    async callRpc(name, args) {
      return {
        batch_fingerprint: args.p_request.publisher_batch_fingerprint,
        changeset_fingerprint: args.p_request.changeset_fingerprint,
        idempotency_key: args.p_request.idempotency_key,
        catalogue_writes: 1,
      };
    },
  }, { activeRows: [active()] }), /catalogue writes/);
});

test("RPC changeset supersede links by replacement fingerprint instead of pre-known database id", () => {
  const replacement = row({
    source_row_fingerprint: "c".repeat(64),
    reason_codes: "MAPPING_DRIFT",
    review_kind: "MAPPING_DRIFT",
    operation_type: "REBIND_EXISTING_VARIANT",
  });
  const request = buildPublicationRpcRequest(manifest({ rows: [replacement] }), [active()]);
  assert.deepEqual(request.operations.map((operation) => operation.op), ["CREATE", "SUPERSEDE"]);
  assert.equal(request.operations[1].replacement_row.id, null);
  assert.equal(request.operations[1].replacement_row.offer_id, "2748");
  assert.equal(request.operations[1].replacement_row.source_row_fingerprint, "c".repeat(64));
});
