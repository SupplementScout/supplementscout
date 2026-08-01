const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs } = require("./gym-high-legacy-identity-executor");

const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/gym-high-legacy-identity-upgrade.yml"), "utf8");
test("executor output is confined to tmp", () => {
  assert.equal(parseArgs(["--mode=validate", "--report=a", "--artifacts=b", "--output=tmp/gym-high/out.json"]).mode, "validate");
  assert.throws(() => parseArgs(["--mode=apply", "--report=a", "--artifacts=b", "--output=outside.json"]), /inside repository tmp/);
});
test("workflow is manual, exact and keeps approver and executor credentials separate", () => {
  assert.match(workflow, /^  workflow_dispatch:/m); assert.doesNotMatch(workflow, /^  (push|schedule):/m);
  assert.match(workflow, /inputs\.approval_fingerprint == 'feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59'/);
  assert.match(workflow, /GYM_HIGH_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /GYM_HIGH_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /remaining_upgrade_count!==0/); assert.match(workflow, /completed_mapping_count!==21/);
  assert.match(workflow, /persist-credentials: false/);
});
