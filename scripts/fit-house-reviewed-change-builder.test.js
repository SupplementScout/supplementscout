const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { APPROVED_OFFER_IDS, AUTHORITY, parseArgs } = require("./fit-house-reviewed-change-builder");

test("builder has an immutable exact owner-approved 47-offer scope", () => {
  assert.equal(APPROVED_OFFER_IDS.length, 47);
  assert.equal(new Set(APPROVED_OFFER_IDS).size, 47);
  assert.equal(AUTHORITY, "owner-approved-chat-2026-08-10-all-three-fit-house-points-47-current-changes");
  assert.deepEqual(parseArgs(["--output=tmp/fit-house.json"]), { output: path.resolve("tmp/fit-house.json") });
  assert.throws(() => parseArgs([]), /exactly --output/);
  assert.throws(() => parseArgs(["--output=a", "--output=b"]), /exactly --output/);
});
