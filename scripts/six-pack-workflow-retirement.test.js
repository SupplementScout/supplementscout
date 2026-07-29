const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const yaml = require("js-yaml");

const workflowsDirectory = path.join(process.cwd(), ".github", "workflows");
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
  const source = fs.readFileSync(
    path.join(workflowsDirectory, activeWorkflow),
    "utf8"
  );

  assert.match(source, /^  schedule:/m);
  assert.match(source, /^  workflow_dispatch:/m);
  assert.doesNotMatch(source, /if:\s*\$\{\{\s*false\s*\}\}/);
});

test("historical Six Pack workflows cannot execute while awaiting archival", () => {
  const historical = sixPackWorkflowFiles().filter(
    (name) => name !== activeWorkflow
  );

  for (const name of historical) {
    const source = fs.readFileSync(path.join(workflowsDirectory, name), "utf8");
    assert.match(
      source,
      /if:\s*\$\{\{\s*false\s*\}\}/,
      `${name} must remain fail-closed until it leaves the active directory`
    );
  }
});

test("no malformed workflow_dispatch path list remains", () => {
  for (const name of sixPackWorkflowFiles()) {
    const source = fs.readFileSync(path.join(workflowsDirectory, name), "utf8");
    assert.doesNotMatch(
      source,
      /^  workflow_dispatch:\s*\r?\n\s+-\s+/m,
      name
    );
  }
});
