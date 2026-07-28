const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DECISION_ARTIFACT_FINGERPRINT,
  EXPECTED_DECISIONS,
  FAMILY_SPECS,
  SNAPSHOT_ID,
  build,
  parseArgs,
} = require("./six-pack-reviewed-decision-execution-builder");

function fixtures() {
  const records = FAMILY_SPECS.flatMap((family) =>
    family.rows.map((row) => ({
      source_record_id: row.id,
      external_product_id: row.id,
      external_variant_id: row.id,
      external_options: {},
      policy_state: "ELIGIBLE",
      published: true,
      price: "10.00",
      image_url: null,
      in_stock: true,
    }))
  );
  const rows = [...EXPECTED_DECISIONS].map(([source_record_id, expected]) => ({
    source_record_id,
    reviewer_decision: expected.decision,
    selected_canonical_product_id: expected.product_id,
    selected_canonical_variant_id: expected.variant_id,
    decision_fingerprint: `decision-${source_record_id}`,
  }));
  return {
    source: {
      snapshot_fingerprint: SNAPSHOT_ID,
      records,
    },
    decisions: {
      snapshot_id: SNAPSHOT_ID,
      artifact_fingerprint: DECISION_ARTIFACT_FINGERPRINT,
      rows,
    },
  };
}

test("builder seals exactly 50 reviewed decisions into 35 families", () => {
  const { source, decisions } = fixtures();
  const approval = build(source, decisions);
  assert.equal(approval.kind, "six-pack-reviewed-large-family-batch-v14");
  assert.equal(approval.family_count, 35);
  assert.equal(approval.new_product_count, 29);
  assert.equal(approval.row_count, 50);
  assert.equal(approval.decision_artifact_fingerprint, DECISION_ARTIFACT_FINGERPRINT);
});

test("builder stops when a reviewed decision changes", () => {
  const { source, decisions } = fixtures();
  decisions.rows[0].reviewer_decision = "DEFER";
  assert.throws(
    () => build(source, decisions),
    /Reviewed actionable decision scope drift/
  );
});

test("builder output is restricted to repository tmp", () => {
  assert.throws(
    () => parseArgs(["--output=../outside.json"]),
    /Output must be inside repository tmp/
  );
});
