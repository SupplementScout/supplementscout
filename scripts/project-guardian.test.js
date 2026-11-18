const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const guardian = require("./project-guardian");

function currentDocs() {
  return guardian.loadDocuments(root);
}

function setLedgerStatus(seo, id, status) {
  const pattern = new RegExp(`(^\\|\\s*${id}\\s*\\|[^\\n]*?\\|\\s*)\`?[A-Z ]+\`?(\\s*\\|)`, "m");
  assert.match(seo, pattern, `missing ledger row ${id}`);
  return seo.replace(pattern, `$1\`${status}\`$2`);
}

test("current authoritative project documents pass structural guardian checks", () => {
  const result = guardian.validateDocuments(currentDocs(), new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.match(result.nextTask, /^SEO-\d+[A-Z]?$/);
  assert.ok(result.inProgress.length <= 2);
  if (result.inProgress.length === 2) assert.deepEqual(result.inProgress, ["SEO-20", "SEO-26"]);
  assert.ok(result.checkedTasks >= 18);
});

test("guardian blocks multiple active SEO implementations", () => {
  const docs = currentDocs();
  const planned = guardian.parseSeoLedger(docs.seo, []).filter((row) => row.status === "PLANNED");
  assert.ok(planned.length >= 2);
  docs.seo = setLedgerStatus(docs.seo, planned[0].id, "IN PROGRESS");
  docs.seo = setLedgerStatus(docs.seo, planned[1].id, "IN PROGRESS");
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /More than one SEO task is IN PROGRESS/);
});

function approvedPair() {
  const docs = currentDocs();
  docs.seo = setLedgerStatus(docs.seo, "SEO-20", "IN PROGRESS");
  docs.seo = setLedgerStatus(docs.seo, "SEO-26", "IN PROGRESS");
  return docs;
}

test("guardian permits only the dated owner-approved Content Growth pair", () => {
  const result = guardian.validateDocuments(approvedPair());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.nextTask, "SEO-20");
  assert.deepEqual(result.inProgress, ["SEO-20", "SEO-26"]);
});

test("guardian rejects the active pair when any authority omits the owner decision", () => {
  for (const key of ["agents", "operating", "seo", "agentModel"]) {
    const docs = approvedPair();
    docs[key] = docs[key].replaceAll(
      "Content Growth exception: SEO-26 beside frozen SEO-20; Draft PR only.", ""
    );
    const result = guardian.validateDocuments(docs);
    assert.equal(result.ok, false, key);
    assert.match(result.errors.join("\n"), /More than one SEO task is IN PROGRESS/);
  }
});

test("guardian rejects an unrelated third task, changed scope or changed binding next task", () => {
  const third = approvedPair();
  third.seo = setLedgerStatus(third.seo, "SEO-17", "IN PROGRESS");
  assert.match(guardian.validateDocuments(third).errors.join("\n"), /More than one SEO task/);
  const scope = approvedPair();
  scope.seo = scope.seo.replace(
    /^(\| SEO-26 \|[^\n]*)$/m, (row) => row.replace("/guides/mass-gainer-under-40", "/another-page")
  );
  assert.match(guardian.validateDocuments(scope).errors.join("\n"), /More than one SEO task/);
  const next = approvedPair();
  next.seo = next.seo.replace("**Next executable task:** SEO-20", "**Next executable task:** SEO-26");
  assert.match(guardian.validateDocuments(next).errors.join("\n"), /must preserve SEO-20/);
});

test("Content Growth authorization does not replace or close the frozen experiment", () => {
  const docs = approvedPair();
  docs.seo = setLedgerStatus(docs.seo, "SEO-20", "PLANNED");
  const result = guardian.validateDocuments(docs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /IN PROGRESS task SEO-26 does not match/);
});

test("Sprint 6 cannot reopen SEO-21/SEO-22/SEO-23/SEO-24/SEO-25 or reuse their retired concurrency exceptions", () => {
  for (const closedId of ["SEO-21", "SEO-22", "SEO-23", "SEO-24", "SEO-25"]) {
    const docs = approvedPair();
    docs.seo = setLedgerStatus(docs.seo, "SEO-26", "PLANNED");
    docs.seo = setLedgerStatus(docs.seo, closedId, "IN PROGRESS");
    assert.match(guardian.validateDocuments(docs).errors.join("\n"), /More than one SEO task/);
    const reopened = approvedPair();
    reopened.seo = setLedgerStatus(reopened.seo, closedId, "PLANNED");
    assert.match(guardian.validateDocuments(reopened).errors.join("\n"), /More than one SEO task/);
  }
});

test("Sprint 6 rejects either changed route and any additional guide scope", () => {
  for (const route of ["/guides/pre-workout-under-30", "/guides/mass-gainer-under-40"]) {
    const docs = approvedPair();
    docs.seo = docs.seo.replace(/^(\| SEO-26 \|[^\n]*)$/m, row => row.replace(route, "/guides/unapproved-topic"));
    assert.match(guardian.validateDocuments(docs).errors.join("\n"), /More than one SEO task/);
  }
  const extra = approvedPair();
  extra.seo = extra.seo.replace(/^(\| SEO-26 \|[^\n]*)$/m, row => row.replace("/guides/mass-gainer-under-40", "/guides/mass-gainer-under-40 and /guides/unapproved-topic"));
  assert.match(guardian.validateDocuments(extra).errors.join("\n"), /More than one SEO task/);
});

test("guardian blocks disagreement between the two authoritative plans", () => {
  const docs = currentDocs();
  const baseline = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  const alternate = guardian.parseSeoLedger(docs.seo, []).find((row) => row.id !== baseline.nextTask).id;
  docs.operating = docs.operating.replace(
    /(### Current active task[\s\S]*?)SEO-\d+[A-Z]?/,
    `$1${alternate}`,
  );
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), new RegExp(`Operating Plan active task ${alternate} does not match SEO next task ${baseline.nextTask}`));
});

test("guardian blocks a stale conflicting WheyWise response sequence", () => {
  const docs = currentDocs();
  const baseline = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  const alternate = guardian.parseSeoLedger(docs.seo, []).find((row) => row.id !== baseline.nextTask).id;
  docs.competitor = docs.competitor.replace(
    /(## Binding competitive-response sequence[\s\S]*?\n1\.[^\n]*?)SEO-\d+[A-Z]?/,
    `$1${alternate}`,
  );
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), new RegExp(`WheyWise response task ${alternate} does not match SEO next task ${baseline.nextTask}`));
});

test("guardian blocks unsupported completion without live evidence", () => {
  const docs = currentDocs();
  const fixtureId = "SEO-99";
  const fixtureRow = `| ${fixtureId} | P0 | Synthetic negative evidence fixture. | \`PLANNED\` | Test fixture only. |`;
  docs.seo = docs.seo.replace(
    "\n## 6. Current active task",
    `\n${fixtureRow}\n\n## 6. Current active task`,
  );
  assert.equal(
    guardian.parseSeoLedger(docs.seo, []).find((row) => row.id === fixtureId)?.status,
    "PLANNED",
  );
  docs.seo = setLedgerStatus(docs.seo, fixtureId, "LIVE VERIFIED");
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    `${fixtureId} is LIVE VERIFIED but has no matching live evidence entry.`,
  ]);
});

test("guardian permits the binding next roadmap task to remain explicitly blocked", () => {
  const docs = currentDocs();
  docs.seo = setLedgerStatus(docs.seo, "SEO-26", "PLANNED");
  const baseline = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  docs.seo = setLedgerStatus(docs.seo, baseline.nextTask, "BLOCKED");
  docs.seo = docs.seo.replace(
    new RegExp(`^\\|\\s*${baseline.nextTask}\\s*\\|.*$`, "m"),
    (row) => row.replace(/\|\s*$/, " Blocker: synthetic external dependency. |"),
  );
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.inProgress, []);
});

test("guardian blocks a stale SEO-07 authentication blocker after measurement exists", () => {
  const docs = currentDocs();
  docs.seo = docs.seo.replace(
    "## 6. Current active task",
    "## 6. Current active task\n\nSEO-07 awaits an authenticated report view."
  );
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /SEO-07 still claims authenticated measurement is unavailable/
  );
});

test("stale measurement and competitor reviews are reminders, not unsafe writes or false failures", () => {
  const result = guardian.validateDocuments(currentDocs(), new Date("2100-01-01T12:00:00Z"));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.match(result.warnings.join("\n"), /status date is more than 14 days old/);
  assert.match(result.warnings.join("\n"), /WheyWise comparison review is more than 35 days old/);
  assert.match(result.warnings.join("\n"), /Weekly GSC\/GA4 measurement evidence is more than 8 days old/);
});

test("guardian and workflow remain read-only and fail closed", () => {
  const source = fs.readFileSync(path.join(root, "scripts/project-guardian.js"), "utf8");
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/project-guardian.yml"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.doesNotMatch(source, /@supabase\/supabase-js|SERVICE_ROLE|fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(source, /writeFile|appendFile|unlink|rmSync|renameSync/i);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write|secrets\.|supabase|deploy/i);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /schedule:/);
  assert.equal(pkg.scripts["verify:project"], "node scripts/project-guardian.js");
});
