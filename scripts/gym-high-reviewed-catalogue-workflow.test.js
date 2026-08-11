const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const activeWorkflow = path.join(__dirname, "..", ".github", "workflows", "gym-high-reviewed-catalogue-bootstrap.yml");
const archivedWorkflow = path.join(__dirname, "..", "docs", "archive", "completed-workflows", "gym-high-reviewed-catalogue-bootstrap.yml");
const workflow = fs.readFileSync(archivedWorkflow, "utf8");

test("completed reviewed bootstrap is archived outside active Actions and preserves its exact guards", () => {
  assert.equal(fs.existsSync(activeWorkflow), false);
  assert.equal(fs.existsSync(archivedWorkflow), true);
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|schedule):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.approval_fingerprint == 'feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59'/);
  assert.match(workflow, /planned_variant_create_count!==34/);
  assert.match(workflow, /inserted_variant_count!==34/);
  assert.match(workflow, /planned_variant_create_count!==0/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /cancel-in-progress: false/);
});
