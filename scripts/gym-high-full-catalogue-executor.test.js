const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs } = require("./gym-high-full-catalogue-executor");

const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/gym-high-full-catalogue-apply.yml"), "utf8");

test("full-catalogue executor confines evidence output to tmp", () => {
  assert.equal(parseArgs(["--mode=validate", "--report=tmp/report.json", "--artifact=tmp/artifact.json", "--output=tmp/gym-high/out.json"]).mode, "validate");
  assert.throws(() => parseArgs(["--mode=apply", "--report=a", "--artifact=b", "--output=outside.json"]), /inside repository tmp/);
});

test("workflow is manual, exact, and separates production roles", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|schedule):/m);
  assert.match(workflow, /inputs\.approval_fingerprint == 'feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59'/);
  assert.match(workflow, /GYM_HIGH_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /GYM_HIGH_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /status=success&per_page=1/);
  assert.match(workflow, /unzip -p[\s\S]*report\.json/);
  assert.match(workflow, /options: \[validate, apply, postflight\]/);
  assert.match(workflow, /approved-catalogue-report\.json --output=tmp\/gym-high-reviewed-catalogue\/post-apply\.csv/);
  assert.match(workflow, /mapping_create_count!==0/);
  assert.match(workflow, /offer_create_count!==0/);
});
