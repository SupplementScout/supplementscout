const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { build } = require("./build-reviewed-variant-nutrition-manifest");
const {
  validateReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");

const candidate = path.resolve(
  "tmp/nutrition-data/priority-batch-1-candidates.json",
);

test("reviewed nutrition batch is deterministic and exactly scoped", () => {
  const first = build(fs.readFileSync(candidate));
  const second = build(fs.readFileSync(candidate));
  assert.equal(first, second);
  const manifest = validateReviewedManifest(JSON.parse(first));
  assert.equal(manifest.changes.length, 16);
  assert.deepEqual(
    [...new Set(manifest.changes.map((row) => row.product_id))],
    ["178", "409", "746"],
  );
  assert.ok(
    manifest.changes.every(
      (row) =>
        Object.keys(row.before_nutrition_override).length === 0 &&
        row.after_nutrition_override.creatine_per_serving_g === null,
    ),
  );
});

test("candidate drift is rejected before reviewed output", () => {
  const bytes = fs.readFileSync(candidate);
  const drift = Buffer.from(bytes);
  drift[drift.length - 2] = drift[drift.length - 2] === 32 ? 10 : 32;
  assert.throws(() => build(drift), /candidate manifest SHA-256 mismatch/);
});
