const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { build, parseArgs } = require("./six-pack-expansion-rollout-sealer");

test("seals the exact reviewed expansion dry-run", () => {
  const csv = fs.readFileSync("tmp/retailer-feeds/six-pack-supplements/six-pack-reviewed-expansion-35.csv");
  const report = JSON.parse(fs.readFileSync("tmp/retailer-feeds/six-pack-supplements/six-pack-reviewed-expansion-35-import-report.json", "utf8"));
  const rollout = build(csv, report);
  assert.equal(rollout.row_count, 35);
  assert.equal(rollout.expected_created_variant_count, 0);
  assert.equal(rollout.expected_bindings.length, 35);
  assert.match(rollout.rollout_fingerprint, /^[0-9a-f]{64}$/);
});

test("sealer output is confined to tmp", () => {
  assert.match(parseArgs([]).output, /six-pack-production-expansion-v4\.json$/);
  assert.throws(() => parseArgs(["--output=config/no.json"]), /inside repository tmp/);
});
