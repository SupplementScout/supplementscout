const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { validateDecision } = require("./lib/retailer-snapshot/review-queue");
const { databaseRow } = require("./publish-product-match-review-queue");
const {
  exportDecisions,
  parseArgs,
  reviewRow,
} = require("./export-product-match-decisions");

function sourceRow() {
  return {
    review_item_id: "retailer-1",
    snapshot_id: "snapshot-1",
    source_record_id: "1",
    retailer: "Example Retailer",
    product_title: "Example Product",
    variant_title: "Chocolate",
    primary_status: "AMBIGUOUS_REVIEW",
    reason_codes: "AMBIGUOUS_REVIEW",
    confidence: "LOW",
    canonical_candidates: [{ product_id: "7", name: "Example Product" }],
    source_sku: "SKU",
    source_gtin: "",
    source_weight: "300g",
    source_price: "19.99",
    source_url: "https://example.com/product",
    suggested_action: "REVIEW_EXISTING_IDENTITY",
    reviewer_decision: "",
    selected_canonical_product_id: "",
    selected_canonical_variant_id: "",
    reviewer_notes: "",
    reviewed_by: "",
    reviewed_at: "",
    decision_fingerprint: "",
  };
}

function databaseDecision(overrides = {}) {
  const artifactFingerprint = "a".repeat(64);
  const pending = databaseRow(sourceRow(), artifactFingerprint);
  return {
    ...pending,
    decision: "APPROVE_EXISTING_VARIANT",
    selected_canonical_product_id: "7",
    selected_canonical_variant_id: "70",
    reviewer_notes: "Same formula and pack.",
    reviewed_by: "admin-panel",
    reviewed_at: "2026-07-28T12:00:00.000Z",
    artifact_fingerprint: artifactFingerprint,
    ...overrides,
  };
}

test("decision export is confined to tmp and explicit production", () => {
  const parsed = parseArgs([
    "--snapshot=snapshot-1",
    "--target=production",
    "--output-dir=tmp/product-match-decisions/test",
  ]);
  assert.equal(parsed.snapshot, "snapshot-1");
  assert.match(parsed.outputDir, /tmp[\\/]product-match-decisions[\\/]test$/);
  assert.throws(
    () =>
      parseArgs([
        "--snapshot=snapshot-1",
        "--target=production",
        "--output-dir=outside",
      ]),
    /inside repository tmp/
  );
});

test("stored decision exports as a sealed tamper-evident review row", () => {
  const exported = reviewRow(databaseDecision());
  assert.equal(exported.reviewer_decision, "APPROVE_EXISTING_VARIANT");
  assert.equal(exported.selected_canonical_product_id, "7");
  assert.equal(exported.selected_canonical_variant_id, "70");
  assert.equal(validateDecision(exported).valid, true);
});

test("source drift blocks decision export", () => {
  assert.throws(
    () => reviewRow(databaseDecision({ product_title: "Changed Product" })),
    /Stored review source drift/
  );
});

test("export writes review artifacts only and performs no database mutation", async () => {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "product-match-export-")
  );
  const rows = [databaseDecision()];
  const client = {
    from(table) {
      assert.equal(table, "product_match_review_queue");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        async limit() {
          return { data: rows, error: null };
        },
      };
    },
  };
  try {
    const result = await exportDecisions(
      {
        snapshot: "snapshot-1",
        target: "production",
        outputDir,
      },
      { client }
    );
    assert.equal(result.database_writes, 0);
    assert.equal(result.catalogue_writes, 0);
    assert.equal(result.decided_count, 1);
    assert.equal(result.outputs.length, 2);
    assert(result.outputs.every((file) => fs.existsSync(file)));
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
