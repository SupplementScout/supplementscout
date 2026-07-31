const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PLAN, confirmation, parseArgs } = require("./apply-family-cleanup-followup");

test("follow-up covers the four catalogue variants missed in the review queue", () => {
  assert.deepEqual(PLAN.map((row) => row.candidate), [262, 279, 281, 474]);
  assert.equal(new Set(PLAN.map((row) => `${row.canonical}:${row.key}`)).size, 4);
});

test("follow-up apply requires a deterministic confirmation", () => {
  assert.match(confirmation(), /^[0-9a-f]{16}$/);
  assert.deepEqual(parseArgs([]), { mode: "rehearse", confirm: null });
  assert.throws(() => parseArgs(["--mode=apply", "--confirm=wrong"]), /apply requires/);
});

test("follow-up is transactional and never deletes catalogue evidence", () => {
  const source = fs.readFileSync(path.join(__dirname, "apply-family-cleanup-followup.js"), "utf8");
  assert.match(source, /begin/);
  assert.match(source, /rollback/);
  assert.match(source, /merge_product_into_existing_variant/);
  assert.doesNotMatch(source, /delete\s+from/i);
});
