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
  assert.ok(result.inProgress.length <= 1);
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
    /(## Binding competitive-response sequence[\s\S]*?\n1\.\s+Complete\s+`)SEO-\d+[A-Z]?/,
    `$1${alternate}`,
  );
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), new RegExp(`WheyWise response task ${alternate} does not match SEO next task ${baseline.nextTask}`));
});

test("guardian blocks unsupported completion without live evidence", () => {
  const docs = currentDocs();
  const baseline = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  docs.seo = setLedgerStatus(docs.seo, baseline.nextTask, "LIVE VERIFIED");
  const result = guardian.validateDocuments(docs, new Date("2026-08-01T12:00:00Z"));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), new RegExp(`${baseline.nextTask} cannot have status LIVE VERIFIED`));
  assert.match(result.errors.join("\n"), new RegExp(`${baseline.nextTask} is LIVE VERIFIED but has no matching live evidence entry`));
});

test("stale measurement and competitor reviews are reminders, not unsafe writes or false failures", () => {
  const result = guardian.validateDocuments(currentDocs(), new Date("2026-10-01T12:00:00Z"));
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.match(result.warnings.join("\n"), /status date is more than 14 days old/);
  assert.match(result.warnings.join("\n"), /WheyWise comparison review is more than 35 days old/);
  assert.match(result.warnings.join("\n"), /Weekly GSC\/GA4 measurement evidence is not yet recorded/);
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
