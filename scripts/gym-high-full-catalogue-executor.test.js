const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseArgs, validateScheduledPlans } = require("./gym-high-full-catalogue-executor");
const { parseArgs: parseRefreshArgs, sameBusinessOffer } = require("./gym-high-refresh-artifact");
const { UPGRADES } = require("./gym-high-legacy-identity-feed-builder");

const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/gym-high-full-catalogue-apply.yml"), "utf8");

test("owner-approved GYM HIGH control binding points to the live exact 400g variant", () => {
  const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");
  const family = approval.families.find((row) => String(row.external_product_id) === "4623");
  assert.equal(family.product_id, "529");
  assert.equal(family.variants[0].external_variant_id, "4623");
  assert.equal(family.variants[0].product_variant_id, "2973");
});

test("owner-approved GYM HIGH L-Arginine control keeps the live exact 500g binding", () => {
  const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");
  const family = approval.families.find((row) => String(row.external_product_id) === "3333");
  assert.equal(family.product_id, "516");
  assert.equal(family.variants[0].external_variant_id, "3333");
  assert.equal(family.variants[0].product_variant_id, "2972");
});

test("owner-approved GYM HIGH Shred Mode control keeps the live exact 60-serving binding", () => {
  const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");
  const family = approval.families.find((row) => String(row.external_product_id) === "2796");
  assert.equal(family.product_id, "508");
  assert.equal(family.variants[0].external_variant_id, "2796");
  assert.equal(family.variants[0].product_variant_id, "2975");
});

test("all nine owner-reviewed exact-pack mappings use their live production variants", () => {
  const expected = new Map([
    ["632", "2965"], ["702", "2966"], ["635", "2967"],
    ["638", "2968"], ["700", "2969"], ["707", "2970"],
    ["701", "2971"], ["3333", "2972"], ["4623", "2973"],
  ]);
  const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");
  for (const [externalId, variantId] of expected) {
    const family = approval.families.find((row) => String(row.external_product_id) === externalId);
    assert.equal(String(family.variants[0].product_variant_id), variantId);
    assert.equal(UPGRADES.find((row) => row.externalVariantId === externalId).variantId, variantId);
  }
});

test("full-catalogue executor confines evidence output to tmp", () => {
  assert.equal(parseArgs(["--mode=validate", "--report=tmp/report.json", "--artifact=tmp/artifact.json", "--output=tmp/gym-high/out.json"]).mode, "validate");
  assert.throws(() => parseArgs(["--mode=apply", "--report=a", "--artifact=b", "--output=outside.json"]), /inside repository tmp/);
});

test("workflow is manual, exact, and separates production roles", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /^  schedule:/m);
  assert.match(workflow, /cron: "13 4 \* \* \*"/);
  assert.match(workflow, /inputs\.approval_fingerprint == 'b5886eda9300b9cfb5319f868ad5b87e7e6b01b0b77d3d7c4ac270681c101919'/);
  assert.match(workflow, /OWNER_APPROVED_GYM_HIGH_SHIPPING_POLICY_2026_08_21_EXACT_66/);
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
  assert.match(workflow, /gym-high-refresh-artifact\.js/);
  assert.match(workflow, /refresh-report\.json --artifact=tmp\/gym-high-reviewed-catalogue\/refresh-artifact\.json/);
  assert.match(workflow, /expected_state\.offer\.last_checked_at/);
});

test("refresh artifact helper is tmp-confined and recognizes only exact business no-change", () => {
  const parsed = parseRefreshArgs([
    "--report=tmp/report.json", "--artifact=tmp/artifact.json",
    "--output=tmp/refresh.json", "--output-report=tmp/refresh-report.json",
  ]);
  assert.match(parsed.output, /tmp[\\/]refresh\.json$/);
  assert.throws(() => parseRefreshArgs(["--report=a", "--artifact=b", "--output=c", "--output-report=d"]), /inside repository tmp/);
  const offer = { price: "10.00", shipping_cost: null, total_price: null, in_stock: true, url: "https://gymhigh.co.uk/product/test/" };
  assert.equal(sameBusinessOffer(offer, { ...offer, last_checked_at: "2026-08-04T05:00:00Z" }), true);
  assert.equal(sameBusinessOffer(offer, { ...offer, price: "11.00" }), false);
});

function scheduledPlan(overrides = {}) {
  const before = { price: "10.00", shipping_cost: "3.99", in_stock: true, url: "https://gymhigh.co.uk/product/test/" };
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
  const badShipping = structuredClone(plans); badShipping[0].resolved_plan.offer.values.shipping_cost = "0";
  assert.throws(() => validateScheduledPlans({ plans: badShipping }, complete), /shipping policy/);
  const unknownFreeShipping = structuredClone(plans);
  unknownFreeShipping[0].resolved_plan.offer.values.price = "50.00";
  unknownFreeShipping[0].resolved_plan.offer.values.shipping_cost = null;
  assert.throws(() => validateScheduledPlans({ plans: unknownFreeShipping }, complete), /shipping policy/);
  const thresholdCrossing = structuredClone(plans);
  thresholdCrossing[0].resolved_plan.expected_state.offer.price = "49.99";
  thresholdCrossing[0].resolved_plan.expected_state.offer.shipping_cost = "3.99";
  thresholdCrossing[0].resolved_plan.offer.values.price = "50.00";
  thresholdCrossing[0].resolved_plan.offer.values.shipping_cost = "0";
  assert.doesNotThrow(() => validateScheduledPlans({ plans: thresholdCrossing }, complete));
});
