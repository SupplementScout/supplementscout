const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildArtifact, sha256 } = require("./lib/nutrition-candidates");
const { parseArgs, runCli, validateArtifact } = require("./store-nutrition-candidates");

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
  const { storeRows } = require("./store-nutrition-candidates");
  await storeRows([{ candidate_fingerprint: "a".repeat(64) }], { supabase });
  assert.equal(calls[0], "nutrition_candidates");
  assert.equal(calls[1].options.ignoreDuplicates, true);
});
