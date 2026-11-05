const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const reasonContract = require("../config/automation-review-reason-codes.json");
const {
  buildPublicationRpcRequest,
  planPublication,
  publishReviewManifest,
  publishReviewManifestViaRpc,
  sha256,
  sqlJsonCatalogueCounts,
  validateManifest,
} = require("./lib/automation-review-publisher");

function loadReviewAdapters() {
  const filename = path.join(process.cwd(), "app", "lib", "automationReviewAdapters.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalLoad = Module._load;
  Module._load = function loadModule(request, parent, isMain) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    mod._compile(outputText, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

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
    retailer_product_id: base.retailer_product_id,
    offer_id: base.offer_id,
    current_product_id: base.current_product_id,
    current_variant_id: base.current_variant_id,
    proposed_product_id: base.proposed_product_id,
    proposed_variant_id: base.proposed_variant_id,
    review_status: "PENDING",
    review_kind: base.review_kind,
    operation_type: base.operation_type,
    reason_codes: base.reason_codes,
    source_row_fingerprint: base.source_row_fingerprint,
    ...overrides,
  };
}

function catalogueCounts(overrides = {}) {
  return {
    products: "1130",
    product_variants: "2849",
    retailer_products: "2808",
    offers: "2808",
    price_history: "7113",
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
            calls.push(["refreshReviewRow", id, fingerprint, payload]);
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

test("canonical Review Queue reason contract includes hard-price anomalies and the publisher accepts them", () => {
  assert.equal(reasonContract.schema_version, 1);
  assert.equal(reasonContract.reason_codes.includes("HARD_PRICE_ANOMALY"), true);
  const hardPrice = row({
    review_kind: "COMMERCIAL_CHANGE",
    operation_type: "UPDATE_PRICE",
    reason_codes: "HARD_PRICE_ANOMALY",
    source_row_fingerprint: "9".repeat(64),
  });
  const validated = validateManifest(manifest({ rows: [hardPrice] }));
  const plan = planPublication(validated, []);
  assert.equal(validated.rows[0].reason_codes, "HARD_PRICE_ANOMALY");
  assert.equal(plan.counts.created, 1);
  assert.equal(plan.counts.catalogue_writes, 0);
});

test("eBay adapter binds each commercial reason to exactly one protected operation", () => {
  const { REVIEW_EXECUTION_ADAPTERS } = require("./lib/automation-review-adapter-registry");
  const { resolveReviewAdapter } = loadReviewAdapters();
  const ebay = REVIEW_EXECUTION_ADAPTERS.find((adapter) => adapter.retailerSlug === "ebay-uk");
  assert.deepEqual(ebay.operations, ["VERIFY_NO_CHANGE", "UPDATE_PRICE", "UPDATE_STOCK", "UPDATE_PRICE_AND_STOCK"]);
  assert.deepEqual(ebay.operationReasonCodes.UPDATE_PRICE, ["PRICE_CHANGE", "HARD_PRICE_ANOMALY"]);
  assert.deepEqual(ebay.operationReasonCodes.UPDATE_STOCK, ["STOCK_CHANGE"]);
  assert.deepEqual(ebay.operationReasonCodes.UPDATE_PRICE_AND_STOCK, ["PRICE_AND_STOCK_CHANGE"]);
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE", "HARD_PRICE_ANOMALY").adapter?.retailerSlug, "ebay-uk");
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE", "PRICE_CHANGE").adapter?.retailerSlug, "ebay-uk");
  assert.equal(resolveReviewAdapter("12", "UPDATE_STOCK", "STOCK_CHANGE").adapter?.retailerSlug, "ebay-uk");
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE_AND_STOCK", "PRICE_AND_STOCK_CHANGE").adapter?.retailerSlug, "ebay-uk");
  assert.equal(resolveReviewAdapter("12", "UPDATE_STOCK", "HARD_PRICE_ANOMALY").adapter, null);
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE_AND_STOCK", "HARD_PRICE_ANOMALY").adapter, null);
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE", "PRICE_AND_STOCK_CHANGE").adapter, null);
  assert.equal(resolveReviewAdapter("12", "UPDATE_STOCK", "PRICE_AND_STOCK_CHANGE").adapter, null);
  assert.equal(resolveReviewAdapter("12", "UPDATE_PRICE_AND_STOCK", "UNKNOWN_REASON").adapter, null);
  assert.equal(resolveReviewAdapter("12", "REBIND_EXISTING_VARIANT", "HARD_PRICE_ANOMALY").adapter, null);
  const capabilityMatrix = fs.readFileSync(path.join(process.cwd(), "app", "lib", "automationReviewCapabilityMatrix.ts"), "utf8");
  assert.match(capabilityMatrix, /UPDATE_PRICE_AND_STOCK: registeredExecution\("12", "UPDATE_PRICE_AND_STOCK"/);
});

test("failed-batch-shaped hard-price row crosses producer, publisher, adapter and worker contracts without writes", () => {
  const { operationForReview } = require("./automation-review-reconciliation-dry-run");
  const { assertHardPriceReviewExecution } = require("./automation-review-ebay-worker");
  const { resolveReviewAdapter } = loadReviewAdapters();
  const normalized = operationForReview({ action: "UPDATE_PRICE", reason: "HARD_PRICE_ANOMALY" });
  assert.deepEqual(normalized, { review_kind: "COMMERCIAL_CHANGE", operation_type: "UPDATE_PRICE", reason_codes: "HARD_PRICE_ANOMALY", confidence: "MEDIUM", suggested_action: "MANUAL_REVIEW" });

  const before = { id: "99001", retailer_product_id: "88001", product_id: "77001", product_variant_id: "66001", price: "149.00", shipping_cost: "0.00", total_price: "149.00", in_stock: true, url: "https://example.test/affiliate/item-1" };
  const mapping = { id: "88001", external_product_id: "item-1", external_variant_id: "item-1", external_url: "https://example.test/source/item-1" };
  const proposed = { price: "49.00", shipping_cost: "0.00", total_price: "49.00", in_stock: true, url: before.url };
  const review = {
    retailer_id: "12", retailer: "eBay UK", retailer_product_id: "88001", offer_id: "99001",
    current_product_id: "77001", current_variant_id: "66001", proposed_product_id: null, proposed_variant_id: null,
    review_status: "PENDING", ...normalized, source_price: "49.00",
    source_row_fingerprint: "a".repeat(64), plan_fingerprint: "b".repeat(64),
    before_state: { offer_id: "99001", retailer_product_id: "88001", product_id: "77001", product_variant_id: "66001", price: "149.00", shipping_cost: "0.00", total_price: "149.00", in_stock: true, url: before.url, external_url: mapping.external_url, external_product_id: mapping.external_product_id, external_variant_id: mapping.external_variant_id },
    proposed_state: { offer: proposed }, impact_summary: { direct_catalogue_writes: 0 }, source_evidence: { workflow_run_id: "fixture-run", artifact_id: "fixture-artifact" },
    source_captured_at: "2026-11-04T10:00:00.000Z", expires_at: "2026-11-11T10:00:00.000Z",
  };
  const input = { schema_version: 1, kind: "automation-review-publisher-manifest", generated_at: "2026-11-04T10:01:00.000Z", retailer_id: "12", retailer: "eBay UK", retailer_slug: "ebay-uk", observed_offer_ids: ["99001"], rows: [review] };
  const validated = validateManifest(input);
  const publication = planPublication(validated, []);
  assert.equal(publication.counts.created, 1);
  assert.equal(publication.counts.catalogue_writes, 0);
  assert.equal(resolveReviewAdapter("12", validated.rows[0].operation_type, validated.rows[0].reason_codes).adapter?.retailerSlug, "ebay-uk");
  assert.doesNotThrow(() => assertHardPriceReviewExecution(review, { offer: { action: "update", id: "99001", values: proposed }, price_history: { action: "create" }, expected_state: { offer: before, retailer_product: mapping } }));
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
    preserved: 0,
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
  assert.equal(request.operations[0].row.execution_binding, null);

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
  }, { activeRows: [active()], catalogueCounts: catalogueCounts() });
  assert.deepEqual(calls.map((call) => call[0]), ["publish_automation_review_queue_changes"]);
  assert.equal(result.mode, "apply");
  assert.equal(result.database_writes, 3);
});

test("same semantic PENDING commercial problem refreshes one internally consistent execution binding", async () => {
  const fingerprint = "c".repeat(64);
  const oldBefore = { offer_id: "2748", retailer_product_id: "2748", product_id: "100", product_variant_id: "200", price: "10.00", shipping_cost: "0.00", total_price: "10.00", in_stock: true, url: "https://example.test/offer", external_url: "https://example.test/source", external_product_id: "external-2748", external_variant_id: "variant-2748" };
  const freshBefore = { ...oldBefore, in_stock: false };
  const freshProposed = { offer: { price: "11.00", shipping_cost: "0.00", total_price: "11.00", in_stock: true, url: oldBefore.url } };
  const incoming = row({
    review_kind: "COMMERCIAL_CHANGE",
    operation_type: "UPDATE_PRICE_AND_STOCK",
    reason_codes: "PRICE_AND_STOCK_CHANGE",
    source_row_fingerprint: fingerprint,
    source_price: "11.00",
    source_url: oldBefore.url,
    before_state: freshBefore,
    proposed_state: freshProposed,
    impact_summary: { catalogue_writes: 0, executable: false, review_only: true },
    source_evidence: { workflow_run_id: "fresh-run", artifact_id: "fresh-artifact" },
    artifact_fingerprint: "d".repeat(64),
    plan_fingerprint: "e".repeat(64),
    plan_artifact_sha256: "f".repeat(64),
  });
  const existing = active({
    review_kind: incoming.review_kind,
    operation_type: incoming.operation_type,
    reason_codes: incoming.reason_codes,
    source_row_fingerprint: fingerprint,
    before_state: oldBefore,
    proposed_state: { offer: { ...freshProposed.offer, in_stock: true } },
    plan_fingerprint: "1".repeat(64),
  });
  const request = buildPublicationRpcRequest(manifest({ rows: [incoming] }), [existing], { catalogueCounts: catalogueCounts() });
  assert.equal(request.operations.length, 1);
  assert.equal(request.operations[0].op, "REFRESH");
  assert.equal(request.operations[0].expected.source_row_fingerprint, fingerprint);
  assert.deepEqual(request.operations[0].row.execution_binding.before_state, freshBefore);
  assert.deepEqual(request.operations[0].row.execution_binding.proposed_state, freshProposed);
  assert.equal(request.operations[0].row.execution_binding.plan_fingerprint, "e".repeat(64));

  const fake = store({ activeRows: [existing] });
  const result = await publishReviewManifest(manifest({ rows: [incoming] }), fake, { mode: "apply" });
  const refresh = fake.calls.find((call) => call[0] === "refreshReviewRow");
  assert.equal(result.counts.refreshed, 1);
  assert.deepEqual(refresh[3].execution_binding.before_state, freshBefore);
  assert.deepEqual(refresh[3].execution_binding.proposed_state, freshProposed);
  assert.equal(refresh[3].execution_binding.plan_fingerprint, "e".repeat(64));
  assert.equal(refresh[3].identity.source_row_fingerprint, fingerprint);
});

test("PENDING refresh fails closed on canonical identity drift while APPROVED evidence remains frozen", () => {
  const incoming = row();
  assert.throws(() => planPublication(manifest(), [active({ current_variant_id: "999" })]), /immutable identity drift: current_variant_id/);
  const approved = active({ review_status: "APPROVED", current_variant_id: "999", decision_actor: "authenticated-admin" });
  const plan = planPublication(manifest({ rows: [incoming] }), [approved]);
  assert.equal(plan.counts.preserved, 1);
  assert.equal(plan.counts.refreshed, 0);
});

test("matching approved evidence is frozen and never refreshed by the publisher", () => {
  const approved = active({ review_status: "APPROVED", decision_actor: "authenticated-admin", decision_at: "2026-10-05T16:30:26.280178Z" });
  const request = buildPublicationRpcRequest(manifest(), [approved], { catalogueCounts: catalogueCounts() });
  const plan = planPublication(manifest(), [approved]);
  assert.equal(request.operations.length, 0);
  assert.equal(plan.counts.refreshed, 0);
  assert.equal(plan.counts.preserved, 1);
  assert.equal(plan.preserved[0].existing.decision_actor, "authenticated-admin");
});

test("mixed pending and approved evidence refreshes only the pending row", () => {
  const pendingRow = row();
  const approvedRow = row({ offer_id: "2749", source_row_fingerprint: "c".repeat(64) });
  const approved = active({
    id: "502",
    offer_id: "2749",
    source_row_fingerprint: "c".repeat(64),
    review_status: "APPROVED",
    decision_actor: "authenticated-admin",
    decision_at: "2026-10-05T16:30:26.280178Z",
  });
  const input = manifest({ rows: [pendingRow, approvedRow], observed_offer_ids: ["2748", "2749"] });
  const request = buildPublicationRpcRequest(input, [active(), approved], { catalogueCounts: catalogueCounts() });
  const plan = planPublication(input, [active(), approved]);

  assert.deepEqual(request.operations.map((operation) => [operation.op, operation.expected.review_id]), [["REFRESH", "501"]]);
  assert.equal(plan.counts.refreshed, 1);
  assert.equal(plan.counts.preserved, 1);
  assert.equal(plan.preserved[0].existing.id, "502");
  assert.equal(plan.preserved[0].existing.decision_actor, "authenticated-admin");
});

test("RPC publisher dry-run prepares request without database writes and rejects unsafe RPC echoes", async () => {
  const dryRun = await publishReviewManifestViaRpc(manifest(), {
    async callRpc() {
      throw new Error("RPC should not be called in dry-run");
    },
  }, { activeRows: [active()], mode: "dry-run", catalogueCounts: catalogueCounts() });
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
  }, { activeRows: [active()], catalogueCounts: catalogueCounts() }), /catalogue writes/);
});

test("RPC changeset supersede links by replacement fingerprint instead of pre-known database id", () => {
  const replacement = row({
    source_row_fingerprint: "c".repeat(64),
    reason_codes: "MAPPING_DRIFT",
    review_kind: "MAPPING_DRIFT",
    operation_type: "REBIND_EXISTING_VARIANT",
  });
  const request = buildPublicationRpcRequest(manifest({ rows: [replacement] }), [active()], { catalogueCounts: catalogueCounts() });
  assert.deepEqual(request.operations.map((operation) => operation.op), ["CREATE", "SUPERSEDE"]);
  assert.equal(request.operations[1].replacement_row.id, null);
  assert.equal(request.operations[1].replacement_row.offer_id, "2748");
  assert.equal(request.operations[1].replacement_row.source_row_fingerprint, "c".repeat(64));
});

test("RPC baseline catalogue hash matches PostgreSQL JSONB numeric counts contract", () => {
  const counts = catalogueCounts();
  const request = buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: counts });
  assert.deepEqual(request.expected_baseline.catalogue_counts, {
    products: 1130,
    product_variants: 2849,
    retailer_products: 2808,
    offers: 2808,
    price_history: 7113,
  });
  assert.equal(
    request.expected_baseline.catalogue_hash_without_review_queue,
    "7adab698d33a3a08b9b304b4d0f23e7ebbb7d3df9df3013ab0d90b5112ad6a51",
  );
  assert.equal(sha256(counts), "71961dec9830f74f9ee80996e6e69b670623733f4d6830bfa20cda61db4204bb");
  assert.notEqual(request.expected_baseline.catalogue_hash_without_review_queue, sha256(counts));
  assert.equal(request.expected_baseline.catalogue_hash_without_review_queue, sha256(sqlJsonCatalogueCounts(counts)));
});

test("RPC baseline catalogue hash is deterministic, table-scoped and fails on catalogue value changes", () => {
  const base = buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: catalogueCounts() });
  const repeated = buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: { price_history: "7113", offers: "2808", retailer_products: "2808", product_variants: "2849", products: "1130" } });
  const changed = buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: catalogueCounts({ offers: "2809" }) });
  assert.equal(base.expected_baseline.catalogue_hash_without_review_queue, repeated.expected_baseline.catalogue_hash_without_review_queue);
  assert.notEqual(base.expected_baseline.catalogue_hash_without_review_queue, changed.expected_baseline.catalogue_hash_without_review_queue);
  assert.deepEqual(Object.keys(base.expected_baseline.catalogue_counts), ["products", "product_variants", "retailer_products", "offers", "price_history"]);
  assert.throws(() => buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: { ...catalogueCounts(), product_match_review_queue: "516" } }), /Invalid catalogue count|Unexpected/);
  assert.throws(() => buildPublicationRpcRequest(manifest(), [active()], { catalogueCounts: { ...catalogueCounts(), offers: null } }), /Invalid catalogue count/);
});
