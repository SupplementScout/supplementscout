const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
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
