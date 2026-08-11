const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs, validatePackage } = require("./discount-reviewed-stock-executor");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "docs/rollouts/discount-stock-2026-08-11/manifest.json");

test("reviewed package binds exactly 11 OOS and one restock without commercial drift", () => {
  const pkg = validatePackage(MANIFEST);
  assert.equal(pkg.selected.length, 12);
  assert.equal(pkg.selected.filter(({ row }) => row.before_in_stock && !row.after_in_stock).length, 11);
  assert.equal(pkg.selected.filter(({ row }) => !row.before_in_stock && row.after_in_stock).length, 1);
  assert.deepEqual(pkg.selected.map(({ row }) => Number(row.offer_id)).sort((a, b) => a - b), [773,822,852,872,878,879,881,882,886,891,893,1502]);
});

test("CLI is restricted to validate/apply and tmp evidence", () => {
  assert.equal(parseArgs(["--mode=validate", `--manifest=${MANIFEST}`, "--output=tmp/discount-stock/validate.json"]).mode, "validate");
  assert.throws(() => parseArgs(["--mode=other", `--manifest=${MANIFEST}`, "--output=tmp/x.json"]), /validate\|apply/);
  assert.throws(() => parseArgs(["--mode=apply", `--manifest=${MANIFEST}`, "--output=docs/x.json"]), /inside repository tmp/);
});

test("workflow is manual-only, role-separated and exact-selector gated", () => {
  const activeWorkflow = path.join(ROOT, ".github/workflows/discount-reviewed-stock-apply.yml");
  const archivedWorkflow = path.join(ROOT, "docs/archive/completed-workflows/discount-reviewed-stock-apply.yml");
  assert.equal(fs.existsSync(activeWorkflow), false);
  assert.equal(fs.existsSync(archivedWorkflow), true);
  const workflow = fs.readFileSync(archivedWorkflow, "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  (push|schedule):/m);
  assert.match(workflow, /inputs\.selector == 'discount-stock-12-2026-08-11'/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:[\s\S]*discount-reviewed-stock-executor/);
});

test("execution reuses role-separated importer RPCs and one executor transaction", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts/discount-reviewed-stock-executor.js"), "utf8");
  assert.match(source, /approve_product_import_plan\(\$1::jsonb,\$2,\$3,\$4,now\(\)\+interval '15 minutes'\)/);
  assert.match(source, /apply_approved_product_import_plan\(\$1::uuid,\$2,\$3,\$4,\$5::bigint,\$6,\$7\)/);
  assert.match(source, /return roleTransaction\("executor", async \(client\) => \{[\s\S]*for \(const \{ approval, entry \} of approvals\)[\s\S]*\}, true\);/);
  assert.match(source, /rollback-preflight[\s\S]*\}, false\);/);
  assert.doesNotMatch(source, /update public\.|insert into public\.|delete from public\./i);
});
