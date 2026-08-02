const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CSV_COLUMNS,
  MODE,
  STATUS,
  buildArtifact,
  exportCandidateCsv,
  fieldDefinition,
  parseCandidateCsv,
  parseQuantity,
  parseSnapshot,
  resolveSnapshotPath,
  sha256,
  validateManifest,
  writeArtifactFiles,
} = require("./lib/nutrition-candidates");
const {
  assertOutputInsideTmp,
  parseArgs,
  runCli,
} = require("./nutrition-candidate-extractor");

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-nutrition-candidates-"));
  test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function record(overrides = {}) {
  return {
    source_record_id: "retailer-product-501",
    product_id: "178",
    product_variant_id: "733",
    retailer_id: "11",
    retailer_product_id: "9001",
    source_url: "https://shop.example.test/product/iso-xp/?variant=733",
    source_type: "retailer_product_page",
    identity_binding: "EXACT_VARIANT",
    snapshot_file: "product.html",
    snapshot_sha256: "0".repeat(64),
    content_type: "text/html",
    current_values: {
      net_weight_g: null,
      serving_count_verified: null,
      serving_size_g: null,
      protein_per_serving_g: null,
      creatine_per_serving_g: null,
      net_volume_ml: null,
    },
    ...overrides,
  };
}

function manifest(records) {
  return {
    schema_version: 1,
    kind: "nutrition-candidate-source-snapshot-v1",
    mode: "OFFLINE",
    captured_at: "2026-08-02T10:00:00.000Z",
    records,
  };
}

function fixture(input, records = null) {
  const directory = temporaryDirectory();
  const snapshotPath = path.join(directory, "product.html");
  fs.writeFileSync(snapshotPath, input);
  const sourceRecord = record({ snapshot_sha256: sha256(Buffer.from(input)) });
  const sourceManifest = manifest(records || [sourceRecord]);
  const manifestPath = path.join(directory, "manifest.json");
  const manifestBytes = Buffer.from(`${JSON.stringify(sourceManifest, null, 2)}\n`);
  fs.writeFileSync(manifestPath, manifestBytes);
  return { directory, manifest: sourceManifest, manifestBytes, manifestPath, sourceRecord };
}

test("normalizes supported weights, volumes and serving counts", () => {
  assert.deepEqual(parseQuantity("1 kg", "weight"), { value: 1000, unit: "g", flags: [] });
  assert.deepEqual(parseQuantity("3,4 g", "weight"), { value: 3.4, unit: "g", flags: [] });
  assert.deepEqual(parseQuantity("3000 mg", "weight"), { value: 3, unit: "g", flags: [] });
  assert.deepEqual(parseQuantity("0.5 l", "volume"), { value: 500, unit: "ml", flags: [] });
  assert.deepEqual(parseQuantity("approximately 30 servings", "count"), { value: 30, unit: "count", flags: ["APPROXIMATE_VALUE"] });
  assert.equal(parseQuantity("30", "weight"), null);
  assert.equal(parseQuantity("20-30 g", "weight"), null);
});

test("recognizes only explicit target labels and rejects creatine compound ambiguity", () => {
  assert.equal(fieldDefinition("Protein per serving").field_name, "protein_per_serving_g");
  assert.equal(fieldDefinition("Creatine per serving").field_name, "creatine_per_serving_g");
  assert.equal(fieldDefinition("Creatine monohydrate per serving"), null);
  assert.equal(fieldDefinition("Protein blend 80%"), null);
  assert.equal(fieldDefinition("Net weight").field_name, "net_weight_g");
});

test("extracts per-serving facts from a semantic nutrition table", () => {
  const html = `<table>
    <tr><th>Typical values</th><th>Per 100g</th><th>Per serving (30 g)</th></tr>
    <tr><th>Protein</th><td>80 g</td><td>24 g</td></tr>
    <tr><th>Creatine</th><td>10 g</td><td>3 g</td></tr>
    <tr><th>Servings per container</th><td>33</td></tr>
    <tr><th>Net weight</th><td>1 kg</td></tr>
  </table>`;
  const observations = parseSnapshot(html, "text/html");
  const values = Object.fromEntries(observations.map((row) => [row.field_name, row.value_numeric]));
  assert.equal(values.serving_size_g, 30);
  assert.equal(values.protein_per_serving_g, 24);
  assert.equal(values.creatine_per_serving_g, 3);
  assert.equal(values.serving_count_verified, 33);
  assert.equal(values.net_weight_g, 1000);
  assert.equal(observations.some((row) => row.value_numeric === 80 && row.field_name === "protein_per_serving_g"), false);
});

test("extracts strict label-value text but ignores marketing names", () => {
  const html = `<h1>Ultra Whey Protein 2kg 24g Protein</h1>
    <p>Net weight: 2 kg</p>
    <p>Serving size: 30 g</p>
    <p>Protein per serving: 24 g</p>
    <p>Creatine monohydrate per serving: 3.4 g</p>`;
  const observations = parseSnapshot(html, "text/html");
  assert.deepEqual(observations.map((row) => row.field_name).sort(), [
    "net_weight_g",
    "protein_per_serving_g",
    "serving_size_g",
  ]);
});

test("extracts numeric JSON-LD facts without scanning description copy", () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Example Protein 1kg",
    description: "Marketing says 99 servings and 50g protein",
    netWeight: { value: 1, unitText: "kg" },
    nutrition: {
      servingSize: "25 g",
      proteinContent: "22 g",
      numberOfServings: 40,
    },
  };
  const observations = parseSnapshot(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`, "text/html");
  const values = Object.fromEntries(observations.map((row) => [row.field_name, row.value_numeric]));
  assert.deepEqual(values, {
    net_weight_g: 1000,
    serving_size_g: 25,
    protein_per_serving_g: 22,
    serving_count_verified: 40,
  });
  assert.equal(observations.some((row) => row.value_numeric === 99), false);
});

test("multiple Product JSON-LD nodes are retained for review at low confidence", () => {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Product", name: "Chocolate", protein_per_serving_g: 22 },
      { "@type": "Product", name: "Vanilla", protein_per_serving_g: 22 },
    ],
  };
  const source = fixture(`<script type="application/ld+json">${JSON.stringify(graph)}</script>`);
  const artifact = buildArtifact(source);
  assert.equal(artifact.candidates.length, 1);
  assert.ok(artifact.candidates[0].flags.includes("MULTIPLE_JSON_LD_PRODUCTS"));
  assert.equal(artifact.candidates[0].overall_confidence, "LOW");
});

test("extracts dedicated fields from JSON feeds", () => {
  const feed = JSON.stringify({
    product_id: "501",
    facts: {
      net_volume_ml: 500,
      servings_per_container: "20 servings",
      serving_size_g: "5 g",
      creatine_per_serving_g: "3 g",
    },
    description: "Protein per serving: 100 g",
  });
  const observations = parseSnapshot(feed, "application/json");
  assert.deepEqual(new Set(observations.map((row) => row.field_name)), new Set([
    "net_volume_ml",
    "serving_count_verified",
    "serving_size_g",
    "creatine_per_serving_g",
  ]));
});

test("JSON numbers require an encoded or explicit unit", () => {
  const observations = parseSnapshot(JSON.stringify({
    netWeight: 1,
    net_weight_g: 500,
    proteinPerServing: 22,
    protein_per_serving_g: 20,
  }), "application/json");
  assert.deepEqual(observations.map((row) => [row.field_name, row.value_numeric]), [
    ["net_weight_g", 500],
    ["protein_per_serving_g", 20],
  ]);
});

test("manifest is exact, offline and cannot contain verification fields", () => {
  const valid = manifest([record()]);
  assert.equal(validateManifest(valid), valid);
  assert.throws(
    () => validateManifest({ ...valid, network: true }),
    /Invalid offline source manifest/,
  );
  assert.throws(
    () => validateManifest(manifest([record({ current_values: { nutrition_verified: true } })])),
    /unsupported field nutrition_verified/,
  );
  assert.throws(
    () => validateManifest(manifest([record({ source_url: "https://shop.example.test/product/?token=secret" })])),
    /forbidden sensitive parameter token/,
  );
  assert.throws(
    () => validateManifest(manifest([record({ source_url: "https://shop.example.test/product/?key=secret" })])),
    /forbidden sensitive parameter key/,
  );
  assert.throws(
    () => validateManifest(manifest([record({ source_url: "https://shop.example.test/product/#access_token=secret" })])),
    /fragments are forbidden/,
  );
});

test("snapshot paths cannot escape the manifest directory", () => {
  const manifestPath = path.join("C:\\safe", "manifest.json");
  assert.throws(() => resolveSnapshotPath(manifestPath, "../secret.html"), /escapes manifest directory/);
});

test("snapshot paths cannot escape through a symbolic link or junction", () => {
  const directory = temporaryDirectory();
  const manifestDirectory = path.join(directory, "manifest");
  const outsideDirectory = path.join(directory, "outside");
  fs.mkdirSync(manifestDirectory);
  fs.mkdirSync(outsideDirectory);
  fs.writeFileSync(path.join(outsideDirectory, "product.html"), "<p>Net weight: 1 kg</p>");
  fs.symlinkSync(outsideDirectory, path.join(manifestDirectory, "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(
    () => resolveSnapshotPath(path.join(manifestDirectory, "manifest.json"), "linked/product.html"),
    /resolves outside manifest directory/,
  );
});

test("snapshot hash mismatch fails before candidate generation", () => {
  const source = fixture("<p>Net weight: 1 kg</p>");
  source.manifest.records[0].snapshot_sha256 = "f".repeat(64);
  const bytes = Buffer.from(JSON.stringify(source.manifest));
  assert.throws(() => buildArtifact({
    manifest: source.manifest,
    manifestBytes: bytes,
    manifestPath: source.manifestPath,
  }), /Snapshot hash mismatch/);
});

test("artifact is candidate-only, fingerprinted and records zero network/database writes", () => {
  const source = fixture(`<p>Net weight: 1 kg</p><p>Serving size: 25 g</p><p>Protein per serving: 22 g</p>`);
  const artifact = buildArtifact(source);
  assert.equal(artifact.status, STATUS);
  assert.equal(artifact.mode, MODE);
  assert.equal(artifact.summary.database_writes, 0);
  assert.equal(artifact.summary.network_requests, 0);
  assert.equal(artifact.candidates.length, 3);
  assert.match(artifact.artifact_fingerprint, /^[0-9a-f]{64}$/);
  assert.ok(artifact.candidates.every((row) => row.review_status === "PENDING"));
  assert.ok(artifact.candidates.every((row) => row.candidate_status === STATUS));
  assert.equal(JSON.stringify(artifact).includes("nutrition_verified"), false);
});

test("conflicting values across source records are explicit and low confidence", () => {
  const directory = temporaryDirectory();
  const left = "<p>Protein per serving: 22 g</p>";
  const right = "<p>Protein per serving: 24 g</p>";
  fs.writeFileSync(path.join(directory, "left.html"), left);
  fs.writeFileSync(path.join(directory, "right.html"), right);
  const records = [
    record({ source_record_id: "left", snapshot_file: "left.html", snapshot_sha256: sha256(Buffer.from(left)) }),
    record({ source_record_id: "right", retailer_product_id: "9002", snapshot_file: "right.html", snapshot_sha256: sha256(Buffer.from(right)) }),
  ];
  const sourceManifest = manifest(records);
  const artifact = buildArtifact({
    manifest: sourceManifest,
    manifestBytes: Buffer.from(JSON.stringify(sourceManifest)),
    manifestPath: path.join(directory, "manifest.json"),
  });
  assert.equal(artifact.candidates.length, 2);
  assert.ok(artifact.candidates.every((row) => row.flags.includes("CROSS_SOURCE_CONFLICT")));
  assert.ok(artifact.candidates.every((row) => row.overall_confidence === "LOW"));
});

test("exact product bindings cannot become high-confidence variant facts", () => {
  const html = `<p>Protein per serving: 22 g</p>`;
  const directory = temporaryDirectory();
  fs.writeFileSync(path.join(directory, "product.html"), html);
  const sourceRecord = record({
    product_variant_id: null,
    identity_binding: "EXACT_PRODUCT",
    snapshot_sha256: sha256(Buffer.from(html)),
  });
  const sourceManifest = manifest([sourceRecord]);
  const artifact = buildArtifact({
    manifest: sourceManifest,
    manifestBytes: Buffer.from(JSON.stringify(sourceManifest)),
    manifestPath: path.join(directory, "manifest.json"),
  });
  assert.equal(artifact.candidates[0].identity_confidence, "MEDIUM");
  assert.equal(artifact.candidates[0].overall_confidence, "MEDIUM");
});

test("conflicts and cross-field inconsistencies remain visible but low confidence", () => {
  const source = fixture(`<table>
    <tr><th>Serving size</th><td>5 g</td></tr>
    <tr><th>Protein per serving</th><td>6 g</td></tr>
    <tr><th>Protein per serving</th><td>4 g</td></tr>
    <tr><th>Net weight</th><td>400 g</td></tr>
    <tr><th>Servings per container</th><td>20</td></tr>
  </table>`);
  const artifact = buildArtifact(source);
  const proteins = artifact.candidates.filter((row) => row.field_name === "protein_per_serving_g");
  assert.equal(proteins.length, 2);
  assert.ok(proteins.every((row) => row.flags.includes("CONFLICTING_SOURCE_VALUES")));
  assert.ok(proteins.every((row) => row.overall_confidence === "LOW"));
  assert.ok(artifact.candidates.find((row) => row.field_name === "net_weight_g").flags.includes("PACKAGE_SERVING_MISMATCH"));
});

test("product and retailer ID filters select an exact offline scope", () => {
  const html = `<p>Net weight: 1 kg</p>`;
  const directory = temporaryDirectory();
  fs.writeFileSync(path.join(directory, "product.html"), html);
  fs.writeFileSync(path.join(directory, "other.html"), html);
  const hash = sha256(Buffer.from(html));
  const records = [
    record({ snapshot_sha256: hash }),
    record({ source_record_id: "other", product_id: "999", retailer_id: "12", retailer_product_id: "9002", snapshot_file: "other.html", snapshot_sha256: hash }),
  ];
  const sourceManifest = manifest(records);
  const artifact = buildArtifact({
    manifest: sourceManifest,
    manifestBytes: Buffer.from(JSON.stringify(sourceManifest)),
    manifestPath: path.join(directory, "manifest.json"),
    filters: { product_ids: ["178"], retailer_ids: ["11"] },
  });
  assert.equal(artifact.summary.selected_source_records, 1);
  assert.ok(artifact.candidates.every((row) => row.product_id === "178" && row.retailer_id === "11"));
  assert.throws(() => buildArtifact({
    manifest: sourceManifest,
    manifestBytes: Buffer.from(JSON.stringify(sourceManifest)),
    manifestPath: path.join(directory, "manifest.json"),
    filters: { product_ids: ["404"] },
  }), /No source records matched/);
});

test("candidate CSV has a frozen RFC4180 schema and round trips quoted evidence", () => {
  const source = fixture(`<p>Protein per serving: 22 g</p>`);
  const artifact = buildArtifact(source);
  artifact.candidates[0].evidence_text = 'Label says "22 g", per serving';
  const csv = exportCandidateCsv(artifact.candidates);
  assert.equal(csv.split(/\r?\n/, 1)[0], CSV_COLUMNS.join(","));
  const parsed = parseCandidateCsv(csv);
  assert.equal(parsed[0].product_id, "178");
  assert.equal(parsed[0].evidence_text, 'Label says "22 g", per serving');
  assert.equal(parsed[0].candidate_status, STATUS);
  assert.equal(CSV_COLUMNS.includes("nutrition_verified"), false);
});

test("CLI requires explicit offline and candidate-only flags and has no apply option", () => {
  assert.throws(() => parseArgs(["--input=file.json", "--confirm-candidates-only=true"]), /--offline/);
  assert.throws(() => parseArgs(["--offline", "--input=file.json"]), /confirm-candidates-only/);
  assert.throws(() => parseArgs(["--offline", "--confirm-candidates-only=true", "--input=file.json", "--apply"]), /Unknown option/);
  const parsed = parseArgs(["--offline", "--confirm-candidates-only=true", "--input=file.json", "--product-id=178,999", "--retailer-id=11"]);
  assert.deepEqual(parsed.productIds, ["178", "999"]);
  assert.deepEqual(parsed.retailerIds, ["11"]);
});

test("runtime source has no network, Supabase, PostgreSQL or apply path", () => {
  const runtime = [
    fs.readFileSync(path.join(__dirname, "nutrition-candidate-extractor.js"), "utf8"),
    fs.readFileSync(path.join(__dirname, "lib", "nutrition-candidates.js"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(runtime, /\bfetch\s*\(|createClient|@supabase|require\(["']pg["']\)|\.from\s*\(|\.rpc\s*\(/);
  assert.doesNotMatch(runtime, /--apply|\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\./i);
});

test("CLI confines output to tmp and writes byte-stable review artifacts", () => {
  const source = fixture(`<p>Net weight: 1 kg</p>`);
  fs.mkdirSync(path.join(source.directory, "tmp"));
  assert.throws(() => assertOutputInsideTmp("outside", source.directory), /inside the repository tmp/);
  const args = [
    "--offline",
    "--confirm-candidates-only=true",
    `--input=${source.manifestPath}`,
    "--output-dir=tmp/nutrition-candidates",
  ];
  const first = runCli(args, { cwd: source.directory });
  const second = runCli(args, { cwd: source.directory });
  assert.equal(fs.readFileSync(first.files.jsonPath, "utf8"), fs.readFileSync(second.files.jsonPath, "utf8"));
  assert.equal(first.artifact.summary.network_requests, 0);
  assert.equal(first.artifact.summary.database_writes, 0);
  assert.doesNotThrow(() => writeArtifactFiles(first.artifact, path.dirname(first.files.jsonPath), path.join(source.directory, "tmp")));
});

test("artifact output cannot escape tmp through a symbolic link or junction", () => {
  const source = fixture("<p>Net weight: 1 kg</p>");
  const artifact = buildArtifact(source);
  const tmpRoot = path.join(source.directory, "tmp");
  const outside = path.join(source.directory, "outside");
  fs.mkdirSync(tmpRoot);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(tmpRoot, "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(
    () => writeArtifactFiles(artifact, path.join(tmpRoot, "linked"), tmpRoot),
    /resolves outside its allowed root/,
  );
  assert.throws(
    () => writeArtifactFiles(artifact, path.join(tmpRoot, "nutrition-candidates")),
    /output root is required/,
  );
});
