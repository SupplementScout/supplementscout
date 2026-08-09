const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("binding plan preserves retailer-current protein pack identity", () => {
  const plan = read("docs/SupplementScout-Operating-Plan-2026-07-15.md");
  assert.match(plan, /Protein pack-transition policy/);
  assert.match(plan, /pack that each retailer\s+is\s+currently selling/i);
  assert.match(plan, /Do not copy the manufacturer's newer smaller[\s\S]+net weight or serving count/i);
  assert.match(plan, /approved_value.*authoritative value consumed by the planner/is);
  assert.match(plan, /Keep the larger variant active while any retailer still sells it/i);
  assert.match(plan, /retailer page or feed may be used as commercial pack-identity evidence[\s\S]+never as nutrition evidence/i);
});

test("nutrition workflow routes a confirmed smaller pack through guarded variants", () => {
  const workflow = read("docs/nutrition-candidate-extractor.md");
  assert.match(workflow, /current retailer identity wins over a newer pack/i);
  assert.match(workflow, /APPROVE_NEW_VARIANT_SEED/);
  assert.match(workflow, /net_weight_g.*serving_count_verified.*pack-specific/is);

  const planner = read("scripts/lib/nutrition-approved-updates.js");
  assert.match(planner, /PACK_SIZE_CHANGE_REQUIRES_VARIANT_TRANSITION/);
  assert.match(planner, /PACKAGE_SERVING_MISMATCH/);
  assert.match(planner, /candidate\.approved_value/);
});
