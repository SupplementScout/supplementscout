const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "gtin-promotion.yml"), "utf8");

function position(text) {
  const value = workflow.indexOf(text);
  assert.ok(value >= 0, `missing workflow contract: ${text}`);
  return value;
}

test("default operation is manual, main-only and non-writing", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(?:push|schedule):/m);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.owner_confirmation == 'OWNER_APPROVED_EXACT_45'/);
  assert.match(workflow, /inputs\.operation == 'preflight_exact_36' && inputs\.owner_confirmation == 'OWNER_APPROVED_EXACT_36'/);
  assert.match(workflow, /inputs\.operation == 'deploy_exact_36_migration' && inputs\.owner_confirmation == 'OWNER_APPROVED_EXACT_36_MIGRATION'/);
  assert.match(workflow, /default: preflight/);
  assert.match(workflow, /options: \[preflight, preflight_exact_36, deploy_exact_36_migration, validate, apply, release_exact_45\]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
});

test("exact-36 migration operation deploys schema only and cannot reach GTIN apply", () => {
  const preflight = position("Exact-36 migration preflight");
  const deploy = position("Deploy exact-36 migration only");
  const verify = position("Verify exact-36 migration deployment");
  assert.ok(preflight < deploy && deploy < verify);
  assert.match(workflow, /--mode=exact36-deploy[^\n]*--confirm=OWNER_APPROVED_EXACT_36_MIGRATION/);
  assert.match(workflow, /Production preflight[^\n]*build fresh exact artifact[\s\S]*?if: \$\{\{ inputs\.operation != 'deploy_exact_36_migration' \}\}/);
  assert.match(workflow, /Validate exact 45 after migration\s*\n\s*if: \$\{\{ inputs\.operation != 'deploy_exact_36_migration' \}\}/);
  assert.doesNotMatch(workflow, /--mode=apply[^\n]*OWNER_APPROVED_EXACT_36/);
  assert.doesNotMatch(workflow, /release_exact_36/);
});

test("preflight failure stops migration and has no production secrets", () => {
  const integration = workflow.slice(position("  integration:"), position("  production:"));
  assert.match(integration, /GTIN_PROMOTION_REQUIRE_DOCKER: "true"/);
  assert.match(integration, /npm run verify:full/);
  assert.doesNotMatch(integration, /secrets\.|environment:\s*production|continue-on-error/);
  assert.match(workflow, /production:\s*\n\s*needs: integration/);
  assert.match(workflow, /inputs\.operation != 'preflight' && inputs\.operation != 'preflight_exact_36'/);
  assert.doesNotMatch(workflow, /release_exact_36|--scope=owner-reviewed-36[\s\S]*--mode=apply/);
});

test("release steps are strictly ordered and each failure stops its successors", () => {
  const capture = position("Production preflight — seal no-change baseline");
  const migration = position("Deploy exact reviewed migration or verify it is already present");
  const validate = position("Validate exact 45 after migration");
  const apply = position("Apply exact 45 atomically");
  const verify = position("Post-write verification");
  assert.ok(capture < migration && migration < validate && validate < apply && apply < verify);
  assert.doesNotMatch(workflow, /continue-on-error/);
  assert.match(workflow, /if: \$\{\{ inputs\.operation == 'release_exact_45' \}\}[\s\S]*?--mode=apply/);
  assert.match(workflow, /environment: production-readonly/);
});

test("validate mismatch or incorrect count/fingerprint cannot reach apply", () => {
  assert.match(workflow, /--mode=capture[^\n]*--confirm=OWNER_APPROVED_EXACT_45/);
  assert.match(workflow, /--mode=validate[^\n]*--artifact=tmp\/gtin-promotion\/release-exact-45\.json[^\n]*--confirm=OWNER_APPROVED_EXACT_45/);
  assert.match(workflow, /--mode=apply[^\n]*--artifact=tmp\/gtin-promotion\/release-exact-45\.json[^\n]*--confirm=OWNER_APPROVED_EXACT_45/);
  assert.doesNotMatch(workflow, /--mode=apply[^\n]*(?:inputs\.artifact|inputs\.count|inputs\.fingerprint)/);
});

test("apply success triggers exact post-write verification and rerun cannot widen scope", () => {
  assert.match(workflow, /--mode=verify[^\n]*--baseline=tmp\/gtin-promotion\/release-baseline\.json/);
  assert.match(workflow, /release-exact-45\.json/);
  assert.doesNotMatch(workflow, /inputs\.(?:artifact|gtin|count|fingerprint)/);
  assert.match(workflow, /concurrency:[\s\S]*cancel-in-progress: false/);
});

test("secrets are step-scoped and logs do not print them", () => {
  const applyStep = workflow.slice(position("- name: Apply exact 45 atomically"), position("- name: Post-write verification"));
  assert.match(applyStep, /GTIN_PROMOTION_APPROVER_DATABASE_URL/);
  assert.match(applyStep, /GTIN_PROMOTION_EXECUTOR_DATABASE_URL/);
  assert.match(applyStep, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(applyStep, /JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.doesNotMatch(applyStep, /SUPABASE_SERVICE_ROLE_KEY|PRODUCTION_OWNER_DATABASE_URL/);
  assert.doesNotMatch(workflow, /printenv|set -x|echo \$\{\{ secrets/i);
});
