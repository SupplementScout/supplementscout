const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "simply-supplements-no-change-end-to-end-rehearsal.js"),
  "utf8",
);

test("ordinary Simply rehearsal covers all 120 rows and is rollback-only", () => {
  assert.match(source, /rows\.length === 120/);
  assert.match(source, /every\(\(row\) => row\.action === "VERIFY_NO_CHANGE"\)/);
  assert.match(source, /await client\.query\("rollback"\)/);
  assert.doesNotMatch(source, /client\.query\("commit"\)/);
  assert.match(source, /rollback_verified: true/);
});

test("ordinary Simply rehearsal protects business values, URLs and identity", () => {
  assert.match(source, /actual\.price.*prior\.price/);
  assert.match(source, /actual\.url === prior\.url/);
  assert.match(source, /actual\.external_url === prior\.external_url/);
  assert.match(source, /actual\.mapping_id === prior\.mapping_id/);
  assert.match(source, /actual\.product_variant_id === prior\.product_variant_id/);
  assert.match(source, /afterCounts.*beforeCounts/);
});
