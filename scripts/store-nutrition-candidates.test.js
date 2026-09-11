const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildArtifact, sealCandidate, sha256 } = require("./lib/nutrition-candidates");
const { parseArgs, runCli, storeRows, validateArtifact } = require("./store-nutrition-candidates");

function artifactFixture(directory) {
  const html = "<p>Protein per serving: 24 g</p>";
  const batch = directory;
  fs.mkdirSync(path.join(batch, "raw"), { recursive: true });
  fs.writeFileSync(path.join(batch, "raw", "product.html"), html);
  const manifest = {
    schema_version: 2,
    kind: "nutrition-candidate-source-snapshot-v2",
    mode: "OFFLINE",
    captured_at: "2026-08-02T12:00:00.000Z",
    records: [{
      source_record_id: "manufacturer-1",
      product_id: "337",
      product_variant_id: null,
      retailer_id: null,
      retailer_product_id: null,
      product_name: "Official Whey",
      brand: "Example Nutrition",
      manufacturer: "Example Nutrition",
      source_url: "https://manufacturer.example/products/whey",
      source_type: "manufacturer_product_page",
      identity_binding: "EXACT_PRODUCT",
      snapshot_file: "raw/product.html",
      source_snapshot_ref: "tmp/manufacturer-batch/raw/product.html",
      snapshot_sha256: sha256(Buffer.from(html)),
      content_type: "text/html",
      current_values: {},
    }],
  };
  return buildArtifact({
    manifest,
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
    manifestPath: path.join(batch, "manifest.json"),
  });
}

test("candidate artifact maps only to pending nutrition_candidates rows", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-store-shape-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = artifactFixture(directory);
  const rows = validateArtifact(artifact);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].proposed_field, "protein_per_serving_g");
  assert.equal(rows[0].product_id, "337");
  assert.equal(rows[0].retailer_id, null);
  assert.equal(Object.hasOwn(rows[0], "nutrition_verified"), false);
});

test("candidate storage preserves exact variant identity and private archive provenance", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-store-variant-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = artifactFixture(directory);
  const core = { ...artifact.candidates[0] };
  delete core.candidate_id;
  delete core.candidate_fingerprint;
  core.product_id = "38";
  core.product_variant_id = "726";
  core.source_sha256 = "1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842";
  core.source_archive_uri = "supabase-storage://nutrition-sources/labels/nut-01/batch-01/applied-nutrition/38/1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842/38-Applied-Pump-3G-375g.jpg";
  artifact.candidates = [sealCandidate(core)];
  const [row] = validateArtifact(artifact);
  assert.equal(row.product_id, "38");
  assert.equal(row.product_variant_id, "726");
  assert.equal(row.source_file_sha256, core.source_sha256);
  assert.equal(row.source_archive_uri, core.source_archive_uri);
});

test("variant candidate requires a durable credential-free archive reference", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-store-variant-invalid-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = artifactFixture(directory);
  const core = { ...artifact.candidates[0], product_variant_id: "726", source_archive_uri: null };
  delete core.candidate_id;
  delete core.candidate_fingerprint;
  artifact.candidates = [sealCandidate(core)];
  assert.throws(() => validateArtifact(artifact), /require source_archive_uri/);
});

function structuredCandidate(artifact, overrides = {}) {
  const core = { ...artifact.candidates[0] };
  delete core.candidate_id;
  delete core.candidate_fingerprint;
  Object.assign(core, {
    product_id: "38",
    product_variant_id: "726",
    field_name: "caffeine_per_serving_mg",
    value_numeric: 200,
    unit: "mg",
    basis: "per_serving",
    information_state: "present_with_amount",
    source_quantity_value: 0.2,
    source_quantity_unit: "g",
    serving_basis_value: 15,
    serving_basis_unit: "g",
    serving_basis_text: "Per 15 g serving",
    ingredient_form: null,
    ingredient_ratio: null,
    source_archive_uri: "supabase-storage://nutrition-sources/test-only/38/726/label.jpg",
  }, overrides);
  return sealCandidate(core);
}

test("structured candidates preserve state, source units, serving basis and citrulline form", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-store-structured-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = artifactFixture(directory);
  artifact.candidates = [structuredCandidate(artifact), structuredCandidate(artifact, {
    field_name: "citrulline_per_serving_mg",
    value_numeric: 6000,
    source_quantity_value: 6,
    ingredient_form: "citrulline_malate",
    ingredient_ratio: "2:1",
  })];
  const rows = validateArtifact(artifact);
  assert.equal(rows[0].proposed_value, 200);
  assert.equal(rows[0].source_quantity_value, 0.2);
  assert.equal(rows[0].source_quantity_unit, "g");
  assert.equal(rows[0].serving_basis_text, "Per 15 g serving");
  assert.equal(rows[1].ingredient_form, "citrulline_malate");
  assert.equal(rows[1].ingredient_ratio, "2:1");
  const changedAmount = structuredCandidate(artifact, { value_numeric: 201, source_quantity_value: 0.201 });
  const changedServing = structuredCandidate(artifact, { serving_basis_text: "Per 1 scoop (15 g)" });
  const changedState = structuredCandidate(artifact, {
    information_state: "confirmed_absent", value_numeric: null, unit: null, basis: null,
    source_quantity_value: null, source_quantity_unit: null, serving_basis_value: null,
    serving_basis_unit: null, serving_basis_text: null,
  });
  assert.notEqual(changedAmount.candidate_fingerprint, artifact.candidates[0].candidate_fingerprint);
  assert.notEqual(changedServing.candidate_fingerprint, artifact.candidates[0].candidate_fingerprint);
  assert.notEqual(changedState.candidate_fingerprint, artifact.candidates[0].candidate_fingerprint);
});

test("structured candidate validation rejects per-100g, guessed or contradictory combinations", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "candidate-store-invalid-facts-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const overrides of [
    { basis: "per_100g" },
    { value_numeric: 201 },
    { serving_basis_value: 0 },
    { field_name: "citrulline_per_serving_mg", ingredient_form: "citrulline_malate", ingredient_ratio: "0:1" },
    { information_state: "confirmed_absent", value_numeric: 0, unit: "mg" },
  ]) {
    const artifact = artifactFixture(directory);
    artifact.candidates = [structuredCandidate(artifact, overrides)];
    assert.throws(() => validateArtifact(artifact), /Invalid candidate row/);
  }
});

test("database write requires explicit candidate-table confirmation", () => {
  assert.throws(() => parseArgs(["--input=tmp/a.json"]), /exactly one/);
  assert.throws(() => parseArgs(["--store-candidates", "--input=tmp/a.json"]), /confirm-candidate-table-only/);
  assert.throws(() => parseArgs(["--store-candidates", "--confirm-candidate-table-only=true", "--input=tmp/a.json", "--apply"]), /Unknown option/);
});

test("dry run never initializes Supabase and reports zero product updates", async () => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), "tmp", "candidate-store-test-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = artifactFixture(directory);
  const file = path.join(directory, "artifact.json");
  fs.writeFileSync(file, JSON.stringify(artifact));
  let touched = false;
  const result = await runCli(["--dry-run", `--input=${file}`], {
    cwd: process.cwd(),
    get supabase() { touched = true; throw new Error("must not initialize"); },
  });
  assert.equal(touched, false);
  assert.equal(result.destination, "nutrition_candidates");
  assert.equal(result.product_updates, 0);
  assert.equal(result.mode, "DRY_RUN_NO_DATABASE");
});

test("storage targets only nutrition_candidates", async () => {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
      return { async upsert(rows, options) { calls.push({ rows, options }); return { error: null }; } };
    },
  };
  await storeRows([{ candidate_fingerprint: "a".repeat(64) }], { supabase });
  assert.equal(calls[0], "nutrition_candidates");
  assert.equal(calls[1].options.ignoreDuplicates, true);
});

test("legacy product candidate storage retries without unavailable provenance columns", async () => {
  const writes = [];
  const missing = { code: "42703", message: "column nutrition_candidates.product_variant_id does not exist" };
  const supabase = {
    from(table) {
      assert.equal(table, "nutrition_candidates");
      return { async upsert(rows) {
        writes.push(rows);
        return { error: writes.length === 1 ? missing : null };
      } };
    },
  };
  await storeRows([{
    candidate_fingerprint: "a".repeat(64), product_variant_id: null, source_archive_uri: null,
  }], { supabase });
  assert.equal(writes.length, 2);
  assert.equal(Object.hasOwn(writes[1][0], "product_variant_id"), false);
  assert.equal(Object.hasOwn(writes[1][0], "source_archive_uri"), false);
});

test("variant storage fails closed on a schema without provenance columns", async () => {
  let writes = 0;
  const supabase = {
    from() {
      return { async upsert() {
        writes += 1;
        return { error: { code: "42703", message: "column nutrition_candidates.product_variant_id does not exist" } };
      } };
    },
  };
  await assert.rejects(storeRows([{
    candidate_fingerprint: "a".repeat(64), product_variant_id: "726", source_archive_uri: "supabase-storage://nutrition-sources/test.jpg",
  }], { supabase }), /migration is required/);
  assert.equal(writes, 1);
});

test("structured storage fails closed before NUT-02B and old NUT-02A rows still retry", async () => {
  const missing = { code: "42703", message: "column nutrition_candidates.information_state does not exist" };
  let writes = 0;
  const blocked = { from() { return { async upsert() { writes += 1; return { error: missing }; } }; } };
  await assert.rejects(storeRows([{
    candidate_fingerprint: "a".repeat(64), product_variant_id: "726",
    source_archive_uri: "supabase-storage://nutrition-sources/test.jpg",
    information_state: "confirmed_absent",
  }], { supabase: blocked }), /NUT-02B candidate schema migration is required/);
  assert.equal(writes, 1);

  const attempts = [];
  const compatible = { from() { return { async upsert(rows) {
    attempts.push(rows);
    return { error: attempts.length === 1 ? missing : null };
  } }; } };
  await storeRows([{
    candidate_fingerprint: "b".repeat(64), product_variant_id: "726",
    source_archive_uri: "supabase-storage://nutrition-sources/test.jpg",
    information_state: null, source_quantity_value: null, source_quantity_unit: null,
    quantity_basis: null, serving_basis_value: null, serving_basis_unit: null,
    serving_basis_text: null, ingredient_form: null, ingredient_ratio: null,
  }], { supabase: compatible });
  assert.equal(attempts.length, 2);
  assert.equal(Object.hasOwn(attempts[1][0], "information_state"), false);
  assert.equal(attempts[1][0].product_variant_id, "726");
});
