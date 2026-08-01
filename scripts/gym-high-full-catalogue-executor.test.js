const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs, validateScheduledPlans } = require("./gym-high-full-catalogue-executor");

const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/gym-high-full-catalogue-apply.yml"), "utf8");

test("full-catalogue executor confines evidence output to tmp", () => {
  assert.equal(parseArgs(["--mode=validate", "--report=tmp/report.json", "--artifact=tmp/artifact.json", "--output=tmp/gym-high/out.json"]).mode, "validate");
  assert.throws(() => parseArgs(["--mode=apply", "--report=a", "--artifact=b", "--output=outside.json"]), /inside repository tmp/);
});

test("workflow is manual, exact, and separates production roles", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /^  schedule:/m);
  assert.match(workflow, /cron: "13 4 \* \* \*"/);
  assert.match(workflow, /inputs\.approval_fingerprint == 'feda6c5cc6f03556dbadfb2e56dc7216150d502a70cee03b1880ec35ec37ad59'/);
  assert.match(workflow, /GYM_HIGH_APPROVER_DATABASE_URL:[\s\S]*JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /GYM_HIGH_EXECUTOR_DATABASE_URL:[\s\S]*JONS_SYNC_EXECUTOR_DATABASE_URL/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /status=success&per_page=1/);
  assert.match(workflow, /unzip -p[\s\S]*report\.json/);
  assert.match(workflow, /options: \[validate, apply, postflight\]/);
  assert.match(workflow, /approved-catalogue-report\.json --output=tmp\/gym-high-reviewed-catalogue\/post-apply\.csv/);
  assert.match(workflow, /mapping_create_count!==0/);
  assert.match(workflow, /offer_create_count!==0/);
});

function scheduledPlan(overrides = {}) {
  const before = { price: "10.00", shipping_cost: null, in_stock: true, url: "https://gymhigh.co.uk/product/test/" };
  return {
    row_number: "2",
    resolved_plan: {
      expected_state: { retailer_product: { id: "1" }, offer: before },
      retailer_product: { action: "update" },
      offer: { action: "update", values: { ...before, last_checked_at: "2026-08-02T04:13:00.000Z", ...overrides } },
    },
  };
}

test("scheduled guard allows existing no-change rows and blocks creates or price anomalies", () => {
  const complete = { existing_mapping_count: 66, mapping_create_count: 0, existing_offer_count: 66, offer_create_count: 0 };
  const plans = Array.from({ length: 66 }, (_, index) => ({ ...scheduledPlan(), row_number: String(index + 2) }));
  assert.doesNotThrow(() => validateScheduledPlans({ plans }, complete));
  const create = structuredClone(plans); create[0].resolved_plan.offer.action = "create";
  assert.throws(() => validateScheduledPlans({ plans: create }, complete), /contains a create/);
  const anomaly = structuredClone(plans); anomaly[0].resolved_plan.offer.values.price = "30.00";
  assert.throws(() => validateScheduledPlans({ plans: anomaly }, complete), /hard price anomaly/);
});
