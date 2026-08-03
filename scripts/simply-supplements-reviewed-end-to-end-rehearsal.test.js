const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "simply-supplements-reviewed-end-to-end-rehearsal.js"),
  "utf8",
);

test("end-to-end Simply rehearsal is rollback-only and exact to 49 reviewed rows", () => {
  assert.match(source, /rows\.length === 49/);
  assert.match(source, /price_history - beforeCounts\.price_history === 43/);
  assert.match(source, /await client\.query\("rollback"\)/);
  assert.doesNotMatch(source, /client\.query\("commit"\)/);
  assert.match(source, /rollback_verified: true/);
});

test("rehearsal verifies no mapping, URL or identity drift", () => {
  assert.match(source, /actual\.url === prior\.url/);
  assert.match(source, /actual\.external_url === prior\.external_url/);
  assert.match(source, /actual\.mapping_id === prior\.mapping_id/);
  assert.match(source, /actual\.product_variant_id === prior\.product_variant_id/);
  assert.match(source, /actual\.updated_at.*prior\.updated_at/);
});
