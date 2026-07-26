const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  REVIEWED_VARIANTS,
  build,
} = require("./build-reviewed-variant-nutrition-manifest-batch-2");
const {
  sha256Buffer,
  validateReviewedManifest,
} = require("./lib/reviewed-variant-nutrition");

const output = path.resolve(
  "data/verified/variant-nutrition-reviewed-batch-2.json",
);

test("reviewed nutrition batch 2 is deterministic and exactly scoped", () => {
  const first = build();
  const second = build();
  assert.equal(first, second);
  const manifest = validateReviewedManifest(JSON.parse(first));
  assert.equal(manifest.changes.length, 5);
  assert.deepEqual(
    manifest.changes.map((row) => row.variant_id),
    ["930", "931", "980", "982", "983"],
  );
  assert.deepEqual(
    [...new Set(manifest.changes.map((row) => row.product_id))],
    ["767", "780", "781"],
  );
  assert.ok(
    manifest.changes.every(
      (row) =>
        Object.keys(row.before_nutrition_override).length === 0 &&
        row.after_nutrition_override.protein_per_serving_g === null &&
        row.after_nutrition_override.creatine_per_serving_g > 0,
    ),
  );
});

test("reviewed nutrition batch 2 preserves exact variant-specific evidence", () => {
  assert.equal(REVIEWED_VARIANTS.length, 5);
  const manifest = JSON.parse(build());
  const values = new Map(
    manifest.changes.map((row) => [
      row.expected_variant_key,
      row.after_nutrition_override.creatine_per_serving_g,
    ]),
  );
  assert.deepEqual(Object.fromEntries(values), {
    "orange-300g": 3,
    "unflavored-300g": 2.64,
    "lemon-1000g": 2.288,
    "green-apple-500g": 3,
    "mango-500g": 3,
  });
});

test("tracked reviewed nutrition batch 2 equals the deterministic build", () => {
  const expected = build();
  const actual = fs.readFileSync(output, "utf8");
  assert.equal(actual, expected);
  assert.match(sha256Buffer(Buffer.from(actual)), /^[0-9a-f]{64}$/);
});
