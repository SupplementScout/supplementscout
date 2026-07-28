const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  exportReviewQueueJson,
} = require("./lib/retailer-snapshot/review-queue");
const {
  databaseRow,
  parseArgs,
  publish,
  readArtifact,
} = require("./publish-product-match-review-queue");

function row(overrides = {}) {
  return {
    review_item_id: "retailer-1",
    snapshot_id: "snapshot-1",
    source_record_id: "1",
    retailer: "Example Retailer",
    product_title: "Example Product 300g",
    variant_title: "Chocolate",
    primary_status: "AMBIGUOUS_REVIEW",
    reason_codes: "AMBIGUOUS_REVIEW",
    confidence: "LOW",
    canonical_candidates: [
      { product_id: "7", name: "Example Product", score: 88 },
    ],
    source_sku: "SKU-1",
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
    ...overrides,
  };
}

function artifactFile(rows = [row()]) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "product-match-review-")
  );
  const artifact = exportReviewQueueJson(rows, { snapshot_id: "snapshot-1" });
  const file = path.join(directory, "queue.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  return { directory, file, artifact };
}

function client(existing = []) {
  const inserted = [];
  return {
    inserted,
    from(table) {
      assert.equal(table, "product_match_review_queue");
      return {
        select() {
          return this;
        },
        async eq() {
          return { data: existing, error: null };
        },
        async insert(rows) {
          inserted.push(...rows);
          return { error: null };
        },
      };
    },
  };
}

test("publisher only accepts an explicit production target", () => {
  assert.deepEqual(parseArgs([
    "--input=tmp/queue.json",
    "--target=production",
    "--confirm-review-only=true",
  ]), {
    input: path.resolve("tmp/queue.json"),
    target: "production",
    confirmReviewOnly: true,
  });
  assert.throws(
    () => parseArgs([
      "--input=tmp/queue.json",
      "--target=local",
      "--confirm-review-only=true",
    ]),
    /Required --target=production/
  );
  assert.throws(
    () => parseArgs(["--input=tmp/queue.json", "--target=production"]),
    /Required --confirm-review-only=true/
  );
  assert.throws(
    () => parseArgs([
      "--input=queue.json",
      "--target=production",
      "--confirm-review-only=true",
    ]),
    /inside repository tmp/
  );
});

test("review artifact is fingerprint-bound and normalized for pending review", () => {
  const { directory, file, artifact } = artifactFile();
  try {
    const parsed = readArtifact(file);
    const output = databaseRow(parsed.rows[0], artifact.artifact_fingerprint);
    assert.equal(output.decision, "PENDING");
    assert.equal(output.source_price, "19.99");
    assert.equal(output.canonical_candidates[0].product_id, "7");
    assert.match(output.source_row_fingerprint, /^[0-9a-f]{64}$/);
    assert.equal("product_id" in output, false);
    assert.equal("offer_id" in output, false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("publishing inserts only missing review rows and preserves decisions", async () => {
  const { directory, file, artifact } = artifactFile();
  try {
    const prepared = databaseRow(artifact.rows[0], artifact.artifact_fingerprint);
    const firstClient = client([]);
    const first = await publish(
      { input: file, target: "production" },
      { client: firstClient }
    );
    assert.equal(first.catalogue_writes, 0);
    assert.equal(first.inserted, 1);
    assert.equal(firstClient.inserted.length, 1);

    const replayClient = client([
      {
        review_item_id: prepared.review_item_id,
        source_row_fingerprint: prepared.source_row_fingerprint,
        decision: "DEFER_POLICY",
      },
    ]);
    const replay = await publish(
      { input: file, target: "production" },
      { client: replayClient }
    );
    assert.equal(replay.inserted, 0);
    assert.equal(replay.preserved_existing_decisions, 1);
    assert.equal(replayClient.inserted.length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("publishing rejects drift under an existing review item identity", async () => {
  const { directory, file } = artifactFile();
  try {
    await assert.rejects(
      publish(
        { input: file, target: "production" },
        {
          client: client([
            {
              review_item_id: "retailer-1",
              source_row_fingerprint: "0".repeat(64),
              decision: "PENDING",
            },
          ]),
        }
      ),
      /Published review item drift/
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
