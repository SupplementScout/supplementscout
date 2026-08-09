const assert = require("node:assert/strict");
const test = require("node:test");
const { buildArtifact, namedWeight } = require("./nutrition-owner-transcript-candidates");
const { validateArtifact } = require("./store-nutrition-candidates");

function manifest(name = "Protein 900g", missingFields = ["net_weight_g", "serving_count_verified", "serving_size_g"]) {
  return { schema_version: 1, kind: "nutrition-ocr-page-source-list-v1", pages: [{
    source_record_id: "manual-protein", product_id: "77", product_variant_id: null,
    product_name: name, brand: "Brand", manufacturer: "Brand", identity_binding: "EXACT_PRODUCT",
    source_page_url: "https://brand.example/products/protein", expected_domain: "brand.example",
    official_domains: ["brand.example"], missing_fields: missingFields, current_values: { nutrition_verified: false },
    notes: "Owner transcribes the official label and must still review every candidate.",
  }] };
}

test("owner transcript creates only pending low-confidence standard candidates", () => {
  const artifact = buildArtifact(manifest(), {
    schema_version: 1, kind: "nutrition-owner-transcript-v1", run_id: "NCR1-owner-test",
    products: [{ product_id: "77", package_weight_g: 900, values: {
      net_weight_g: 900, serving_count_verified: 40, serving_size_g: 22.5,
    } }],
  }, "tmp/owner-transcript.json", Buffer.from("evidence"), "2026-08-09T09:00:00.000Z");
  assert.equal(artifact.candidates.length, 3);
  assert.equal(artifact.candidates[0].review_status, "PENDING");
  assert.equal(artifact.candidates[0].overall_confidence, "LOW");
  assert.equal(validateArtifact(artifact).length, 3);
});

test("owner transcript flags catalogue-name and package arithmetic mismatches", () => {
  const artifact = buildArtifact(manifest("Protein 868g"), {
    schema_version: 1, kind: "nutrition-owner-transcript-v1", run_id: "NCR1-owner-test",
    products: [{ product_id: "77", package_weight_g: 868, values: {
      net_weight_g: 868, serving_count_verified: 29, serving_size_g: 31,
    } }],
  }, "tmp/owner-transcript.json", Buffer.from("evidence"));
  assert.ok(artifact.candidates.every((candidate) => candidate.flags.includes("PACKAGE_SERVING_MISMATCH")));
  assert.equal(namedWeight("Protein 1.8kg"), 1800);
});

test("owner transcript rejects facts outside the manifest missing-field scope", () => {
  assert.throws(() => buildArtifact(manifest("Protein 900g", ["serving_size_g"]), {
    schema_version: 1, kind: "nutrition-owner-transcript-v1", run_id: "NCR1-owner-test",
    products: [{ product_id: "77", package_weight_g: 900, values: { net_weight_g: 900 } }],
  }, "tmp/owner-transcript.json", Buffer.from("evidence")), /non-missing/);
});
