const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { EXPECTED_SCOPE, parseArgs, validateRollout } = require("./seo13-vegan-protein-pilot-executor");

const ROOT = path.resolve(__dirname, "..");
const ROLLOUT = path.join(ROOT, "docs/rollouts/seo13-vegan-protein-pilot/rollout.json");

test("SEO-13 pilot accepts only the exact two reviewed plans", () => {
  const result = validateRollout(ROLLOUT);
  assert.equal(result.plans.length, 2);
  assert.deepEqual(result.rollout.entries.map(({ retailer_id, product_id, product_variant_id, retailer_product_action, offer_action }) => ({ retailer_id, product_id, product_variant_id, retailer_product_action, offer_action })), EXPECTED_SCOPE);
});

test("SEO-13 pilot CLI keeps output in tmp and limits modes", () => {
  const parsed = parseArgs(["--mode=validate", `--rollout=${ROLLOUT}`, "--output=tmp/seo13-vegan-protein-pilot/report.json"]);
  assert.equal(parsed.mode, "validate");
  assert.throws(() => parseArgs(["--mode=other", `--rollout=${ROLLOUT}`, "--output=tmp/x.json"]), /validate\|apply/);
  assert.throws(() => parseArgs(["--mode=apply", `--rollout=${ROLLOUT}`, "--output=docs/x.json"]), /inside repository tmp/);
});

test("SEO-13 workflow is manual, role-separated and has no service-role credential", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/seo13-vegan-protein-pilot.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /schedule:|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workflow, /JONS_SYNC_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /environment: production-readonly/);
});
