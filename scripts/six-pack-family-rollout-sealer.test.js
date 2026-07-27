const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { build, parseArgs } = require("./six-pack-family-rollout-sealer");

const ROOT = path.resolve(__dirname, "..");
const CSV = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-family-21.csv"
);
const REPORT = path.join(
  ROOT,
  "tmp",
  "retailer-feeds",
  "six-pack-supplements",
  "six-pack-reviewed-family-21-import-report-v5.json"
);

test("family rollout sealer binds 21 rows and exactly 14 variant creates", () => {
  const rollout = build(
    fs.readFileSync(CSV),
    JSON.parse(fs.readFileSync(REPORT, "utf8"))
  );
  assert.equal(rollout.row_count, 21);
  assert.equal(rollout.expected_created_variant_count, 14);
  assert.equal(
    rollout.expected_bindings.filter(
      (row) => row.product_variant_id === null
    ).length,
    14
  );
  assert.equal(new Set(rollout.expected_external_variant_ids).size, 21);
});

test("family rollout output remains inside tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/retailers/unsafe.json"]),
    /inside repository tmp/
  );
});
