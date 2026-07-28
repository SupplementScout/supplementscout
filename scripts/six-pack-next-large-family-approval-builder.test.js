const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  build,
  flavourFor,
  parseArgs,
} = require("./six-pack-next-large-family-approval-builder");

const ROOT = path.resolve(__dirname, "..");
const source = JSON.parse(
  fs.readFileSync(
    path.join(
      ROOT,
      "tmp",
      "retailer-feeds",
      "six-pack-supplements",
      "six-pack-source-snapshot.json"
    ),
    "utf8"
  )
);

test("next large family approval binds 34 non-food supplement offers", () => {
  const approval = build(source);
  assert.equal(approval.family_count, 8);
  assert.equal(approval.new_product_count, 8);
  assert.equal(approval.row_count, 34);
  assert.equal(
    approval.families.flatMap((family) => family.variants).length,
    34
  );
  assert.equal(approval.policy.food, "EXCLUDE");
  assert.equal(approval.policy.peptides, "EXCLUDE");
  assert.equal(approval.policy.collagen_supplements, "ALLOW");
});

test("retailer flavour aliases remain explicit", () => {
  assert.deepEqual(
    flavourFor({
      source_record_id: "x",
      external_options: { FLAVOUR: "cookie cream" },
    }),
    {
      source_flavour: "cookie cream",
      flavour: "Cookies & Cream",
    }
  );
});

test("approval output is confined to tmp", () => {
  assert.throws(
    () => parseArgs(["--output=config/unsafe.json"]),
    /inside repository tmp/
  );
});
