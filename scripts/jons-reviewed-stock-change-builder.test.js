const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { parseArgs } = require("./jons-reviewed-stock-change-builder");

test("reviewed stock builder requires an exact owner-approved offer scope", () => {
  const parsed = parseArgs([
    "--output=tmp/review.json",
    "--approved-offer-ids=1061,1183",
    "--authority=owner-approved-chat-2026-08-03",
  ]);
  assert.equal(parsed.output, path.resolve("tmp/review.json"));
  assert.deepEqual(parsed.offerIds, ["1061", "1183"]);
  assert.equal(parsed.authority, "owner-approved-chat-2026-08-03");
  assert.throws(() => parseArgs([
    "--output=tmp/review.json",
    "--approved-offer-ids=1061,1061",
    "--authority=owner-approved-chat-2026-08-03",
  ]), /approved offer IDs are invalid/);
  assert.throws(() => parseArgs([
    "--output=tmp/review.json",
    "--approved-offer-ids=1061",
  ]), /required/);
});
