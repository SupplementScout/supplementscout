const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const adapter = require("./six-pack-supplements-woocommerce");

test("CLI requires an input and confines generated evidence to tmp", () => {
  assert.throws(() => adapter.parseArgs([]), /Required --csv/);
  assert.throws(
    () => adapter.parseArgs(["--csv=input.csv", "--output-dir=outside"]),
    /inside repository tmp/
  );
  const parsed = adapter.parseArgs(["--csv=input.csv"]);
  assert.equal(parsed.outputDir, adapter.DEFAULT_OUTPUT_DIR);
});

test("source health fails closed below configured completeness thresholds", () => {
  const config = {
    source: {
      baseline_csv_rows: 100,
      baseline_variations: 50,
      minimum_count_ratio: 0.9,
      genuine_collapse_ratio: 0.75,
    },
  };
  assert.equal(adapter.healthReport({ counts: { csv_rows: 100, variation_rows: 50 } }, config).result, "PASS");
  assert.deepEqual(
    adapter.healthReport({ counts: { csv_rows: 80, variation_rows: 45 } }, config),
    {
      result: "BLOCK",
      code: "SOURCE_DEGRADED",
      baseline_csv_rows: 100,
      actual_csv_rows: 80,
      baseline_variations: 50,
      actual_variations: 45,
      row_ratio: 0.8,
      variation_ratio: 0.9,
      observed_ratio: 0.8,
      minimum_count_ratio: 0.9,
      genuine_collapse_ratio: 0.75,
    }
  );
  assert.equal(adapter.healthReport({ counts: { csv_rows: 70, variation_rows: 50 } }, config).code, "GENUINE_SOURCE_COLLAPSE");
});

test("approved automation scope is one exact full retailer manifest", () => {
  const loaded = adapter.loadApprovedAutomationManifest();
  assert.equal(loaded.manifest.retailer.id, 11);
  assert.equal(loaded.manifest.rows.length, 506);
  assert.equal(new Set(loaded.manifest.rows.map((row) => row.external_variant_id)).size, 506);
});

test("current food policy allows every owner-approved ordinary food type", () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../config/retailers/six-pack-supplements-woocommerce.json"),
      "utf8"
    )
  );
  const allowed = config.category_policy.reviewed_food_exceptions_allowed;
  assert.deepEqual(
    [
      "pourable sauces",
      "syrups",
      "jams",
      "porridge and oats",
      "pancake mixes",
      "ready-to-drink shakes",
      "liquid egg whites",
    ].filter((foodType) => !allowed.includes(foodType)),
    []
  );
  assert.deepEqual(config.category_policy.reviewed_food_exceptions_not_allowed, []);
});

test("atomic evidence writer leaves only the requested final file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "six-pack-adapter-"));
  const file = path.join(directory, "report.json");
  adapter.atomicWrite(file, "{\"ok\":true}\n");
  assert.equal(fs.readFileSync(file, "utf8"), "{\"ok\":true}\n");
  assert.deepEqual(fs.readdirSync(directory), ["report.json"]);
});
