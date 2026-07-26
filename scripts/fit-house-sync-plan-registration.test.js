const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(
  path.join(process.cwd(), ".github/workflows/fit-house-offer-refresh.yml"),
  "utf8",
);

test("Fit House workflow runs scoped dry-run, apply, and idempotency on main", () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.equal(
    (workflow.match(/node scripts\/fit-house-offer-refresh\.js --target=production --mode=dry-run/g) || []).length,
    2,
  );
  assert.equal(
    (workflow.match(/node scripts\/fit-house-offer-refresh\.js --target=production --mode=apply/g) || []).length,
    1,
  );
  assert.match(workflow, /cron: "47 2 \* \* \*"/);
  assert.match(workflow, /FIT_HOUSE_SYNC_VALIDATOR_DATABASE_URL/);
  assert.match(workflow, /secrets\.JONS_SYNC_VALIDATOR_DATABASE_URL/);
});

test("scheduled runs are fail-closed and never expose SAFE_UPDATE", () => {
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.doesNotMatch(workflow, /^\s+SAFE_UPDATE:/m);
  assert.doesNotMatch(workflow, /--reviewed-manifest/);
});
