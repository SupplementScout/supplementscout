const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "gtin-promotion.yml"), "utf8");

test("workflow is manual, main-only, and exact-scope confirmed", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.owner_confirmation == 'OWNER_APPROVED_EXACT_45'/);
  assert.match(workflow, /default: preflight/);
  assert.match(workflow, /options: \[preflight, validate, apply\]/);
});

test("workflow never deploys migrations and defaults to production-free preflight", () => {
  assert.doesNotMatch(workflow, /supabase\s+(?:db push|migration up)|psql[^\n]*migrations/i);
  const integrationJob = workflow.slice(workflow.indexOf("  integration:"), workflow.indexOf("  promotion:"));
  assert.doesNotMatch(integrationJob, /secrets\.|environment:\s*production/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /promotion:\s*\n\s*needs: integration/);
});

test("workflow builds a fresh immutable plan before protected execution", () => {
  const integration = workflow.indexOf("scripts/gtin-promotion-postgres.integration.test.js");
  const plan = workflow.indexOf("--mode=plan --target=production");
  const protectedExecution = workflow.indexOf("--mode=${{ inputs.operation }} --target=production");
  assert.ok(integration >= 0);
  assert.ok(plan > integration);
  assert.ok(protectedExecution > plan);
  assert.match(workflow, /needs: integration/);
  assert.match(workflow, /inputs\.operation != 'preflight'/);
  assert.match(workflow, /--confirm=OWNER_APPROVED_EXACT_45/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});

test("protected step receives only role-separated database credentials", () => {
  const marker = "- name: Validate or apply with separated database roles";
  const protectedStep = workflow.slice(workflow.indexOf(marker), workflow.indexOf("- uses: actions/upload-artifact@v7"));
  assert.match(protectedStep, /GTIN_PROMOTION_APPROVER_DATABASE_URL/);
  assert.match(protectedStep, /GTIN_PROMOTION_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(protectedStep, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(protectedStep, /echo|printenv|set -x/i);
});
