const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const yaml = require("js-yaml");

const workflowsDirectory = path.join(process.cwd(), ".github", "workflows");
const archiveDirectory = path.join(
  process.cwd(),
  "docs",
  "archive",
  "six-pack-workflows"
);
const activeWorkflow = "six-pack-offer-refresh.yml";

function sixPackWorkflowFiles() {
  return fs
    .readdirSync(workflowsDirectory)
    .filter((name) => name.startsWith("six-pack") && name.endsWith(".yml"))
    .sort();
}

test("all active-directory Six Pack workflow YAML is syntactically valid", () => {
  for (const name of sixPackWorkflowFiles()) {
    const source = fs.readFileSync(path.join(workflowsDirectory, name), "utf8");
    assert.doesNotThrow(() => yaml.load(source), name);
  }
});

test("the current Six Pack offer refresh remains active and scheduled", () => {
  assert.deepEqual(sixPackWorkflowFiles(), [activeWorkflow]);

  const source = fs.readFileSync(
    path.join(workflowsDirectory, activeWorkflow),
    "utf8"
  );

  assert.match(source, /^  schedule:/m);
  assert.match(source, /^  workflow_dispatch:/m);
  assert.doesNotMatch(source, /if:\s*\$\{\{\s*false\s*\}\}/);
});

test("Six Pack scheduled writes stay paused while manual dry-run remains read-only", () => {
  const source = fs.readFileSync(path.join(workflowsDirectory, activeWorkflow), "utf8");
  const workflow = yaml.load(source);
  assert.match(source, /SIX_PACK_SCHEDULE_PAUSED_PENDING_OWNER_APPROVAL/);
  assert.deepEqual(workflow.on.schedule, [{ cron: "17 3 * * *" }]);
  assert.equal(workflow.on.workflow_dispatch.inputs.operation.default, "dry-run");
  assert.deepEqual(Object.keys(workflow.jobs).sort(), ["refresh-review-queue", "six-pack-offer-refresh", "six-pack-reviewed-apply"]);
  const outputs = { artifact_id: "1", artifact_digest: "sealed", source_contract_sha256: "bound", review_scope_fingerprint: "scope" };
  const enabled = (job, event, operation, ref = "refs/heads/main", bound = outputs) => Boolean(vm.runInNewContext(
    job.if.replace(/^\$\{\{\s*|\s*\}\}$/g, "").replaceAll("needs.six-pack-offer-refresh", "needs.source"),
    { github: { ref, event_name: event }, inputs: { operation }, needs: { source: { outputs: bound } }, always: () => true, success: () => true },
    { timeout: 1000 }
  ));
  const main = workflow.jobs["six-pack-offer-refresh"], publication = workflow.jobs["refresh-review-queue"];
  for (const event of ["schedule", "push", "pull_request", "workflow_call"]) {
    // Even forged nonempty outputs and an apply input cannot admit scheduled jobs.
    for (const job of Object.values(workflow.jobs)) assert.equal(enabled(job, event, "apply"), false, event);
  }
  assert.equal(enabled(main, "workflow_dispatch", "dry-run"), true);
  assert.equal(enabled(publication, "workflow_dispatch", "dry-run"), false);
  assert.equal(enabled(workflow.jobs["six-pack-reviewed-apply"], "workflow_dispatch", "dry-run"), false);
  for (const job of Object.values(workflow.jobs)) assert.equal(enabled(job, "workflow_dispatch", "dry-run", "refs/heads/other"), false);
  for (const name of ["Capture 6 Pack DB baseline read-only", "Bind fresh 6 Pack Review Queue source", "Apply exact approved manifest",
    "Verify 6 Pack DB postflight read-only", "Verify idempotency against a fresh source capture"]) {
    const step = main.steps.find(row => row.name === name);
    assert.ok(step?.if, name);
    assert.equal(enabled(step, "workflow_dispatch", "dry-run"), false, name);
  }
  assert.equal(publication.needs, "six-pack-offer-refresh");
  assert.equal(enabled(publication, "workflow_dispatch", "apply"), true);
  for (const key of Object.keys(outputs)) assert.equal(enabled(publication, "workflow_dispatch", "apply", "refs/heads/main", { ...outputs, [key]: "" }), false);
  assert.equal(enabled(main, "workflow_dispatch", "apply-reviewed"), false);
  assert.equal(enabled(workflow.jobs["six-pack-reviewed-apply"], "workflow_dispatch", "apply-reviewed"), true);

  // The sole active Six Pack workflow owns every direct executor invocation.
  for (const file of fs.readdirSync(workflowsDirectory).filter(name => /\.ya?ml$/.test(name))) {
    const contents = fs.readFileSync(path.join(workflowsDirectory, file), "utf8");
    if (/node scripts\/six-pack-offer-refresh-executor\.js/.test(contents)) assert.equal(file, activeWorkflow);
  }
  assert.equal(require("../config/automation-review-execution-adapters.json").adapters
    .some(adapter => adapter.retailer_id === "11" || adapter.retailer_slug === "6-pack-supplements"), false,
  "the shared scheduled worker must not bypass the owner pause");
});

test("all 27 historical Six Pack workflows are preserved outside the active directory", () => {
  const historical = fs
    .readdirSync(archiveDirectory)
    .filter((name) => name.startsWith("six-pack") && name.endsWith(".yml"))
    .sort();

  assert.equal(historical.length, 27);
  for (const name of historical) {
    const source = fs.readFileSync(path.join(archiveDirectory, name), "utf8");
    assert.match(
      source,
      /if:\s*\$\{\{\s*false\s*\}\}/,
      `${name} must retain its fail-closed retirement guard`
    );
    assert.doesNotThrow(() => yaml.load(source), name);
  }
});

test("no malformed workflow_dispatch path list remains", () => {
  const workflowPaths = [
    ...sixPackWorkflowFiles().map((name) =>
      path.join(workflowsDirectory, name)
    ),
    ...fs
      .readdirSync(archiveDirectory)
      .filter((name) => name.endsWith(".yml"))
      .map((name) => path.join(archiveDirectory, name)),
  ];

  for (const workflowPath of workflowPaths) {
    const source = fs.readFileSync(workflowPath, "utf8");
    assert.doesNotMatch(
      source,
      /^  workflow_dispatch:\s*\r?\n\s+-\s+/m,
      workflowPath
    );
  }
});
