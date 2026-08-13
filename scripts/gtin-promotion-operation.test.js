const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { buildArtifact, parseArgs, validateArtifact } = require("./gtin-promotion-operation");

function fixture() {
  const products = [];
  const variants = [];
  const rows = [];
  for (let index = 1; index <= 45; index += 1) {
    const productId = String(1000 + index);
    const variantId = String(2000 + index);
    products.push({ id: productId, name: `Product ${index}`, brand: "Brand", product_format: "powder", gtin: null, is_active: true, merged_into_product_id: null });
    variants.push({ id: variantId, product_id: productId, display_name: `Variant ${index}`, flavour_label: `Flavour ${index}`, size_value: 300, size_unit: "g", pack_count: 1, product_format: "powder", gtin: null, is_active: true, is_default: false });
    rows.push({
      product_id: productId,
      variant_id: variantId,
      gtin: String(1000000000000 + index),
      destination_field: "product_variants.gtin",
      current_value: null,
      proposed_value: String(1000000000000 + index),
      evidence_count: 2,
      evidence_sources: ["source:a", "source:b"],
      blockers: [],
      decision: "READY_TO_PROMOTE",
      candidate_source: "TEST",
      candidate_fingerprint: String(index).padStart(64, "0"),
    });
  }
  return {
    preview: {
      rows,
      preview_fingerprint: "a".repeat(64),
      canonical_snapshot_fingerprint: "b".repeat(64),
    },
    products,
    variants,
  };
}

test("builds one immutable exact-45 plan bound to owner scope and expected state", () => {
  const input = fixture();
  const artifact = buildArtifact(input.preview, input.products, input.variants, {
    createdAt: "2099-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:15:00.000Z",
    runId: "00000000-0000-4000-8000-000000000045",
  });
  assert.equal(validateArtifact(artifact), artifact);
  assert.equal(artifact.plan.rows.length, 45);
  assert.equal(artifact.plan.owner_review.decision, "APPROVED_EXACT_SCOPE");
  assert.match(artifact.plan.meta.plan_fingerprint, /^[0-9a-f]{32}$/);
  assert.match(artifact.artifact_fingerprint, /^[0-9a-f]{64}$/);
  assert.ok(artifact.plan.rows.every((row) => row.expected_current_gtin === null && row.destination_field === "product_variants.gtin"));
});

test("rejects artifact and plan tampering", () => {
  const input = fixture();
  const artifact = buildArtifact(input.preview, input.products, input.variants, { expiresAt: "2099-01-01T00:15:00.000Z" });
  assert.throws(() => validateArtifact({ ...artifact, row_count: "44" }), /envelope/);
  const tampered = structuredClone(artifact);
  tampered.plan.rows[0].gtin = "9999999999999";
  assert.throws(() => validateArtifact(tampered), /artifact fingerprint/);
});

test("CLI separates plan, validation and explicit apply authority", () => {
  assert.deepEqual(parseArgs(["--mode=plan", "--target=production"]), { mode: "plan", target: "production" });
  assert.throws(() => parseArgs(["--mode=apply", "--target=production", "--artifact=tmp/a.json"]), /confirm/);
  const parsed = parseArgs(["--mode=apply", "--target=production", "--artifact=tmp/a.json", "--confirm=OWNER_APPROVED_EXACT_45"]);
  assert.equal(parsed.mode, "apply");
  assert.equal(parsed.confirm, "OWNER_APPROVED_EXACT_45");
});

test("protected operation has no generic importer or service-role write path", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "gtin-promotion-operation.js"), "utf8");
  assert.match(source, /GTIN_PROMOTION_APPROVER_DATABASE_URL/);
  assert.match(source, /GTIN_PROMOTION_EXECUTOR_DATABASE_URL/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY must not be present during protected approval\/apply/);
  assert.match(source, /GITHUB_ACTIONS.*workflow_dispatch/s);
  assert.doesNotMatch(source, /import-products\.js/);
  assert.match(source, /apply_approved_gtin_promotion_plan\(\$1::uuid,\$2,\$3,\$4,\$5\)/);
  assert.doesNotMatch(source, /apply_approved_gtin_promotion_plan\([^\n]*gtin/i);
});
