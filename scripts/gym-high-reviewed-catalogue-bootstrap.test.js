const assert = require("node:assert/strict");
const test = require("node:test");
const approval = require("../config/retailers/gym-high-reviewed-full-catalogue-2026-08-01.json");
const { assertApproval, inspectVariants, intendedVariant, parseArgs } = require("./gym-high-reviewed-catalogue-bootstrap");

test("approval is immutable, complete and contains only reviewed variant creates", () => {
  assert.equal(assertApproval(approval), approval);
  const changed = structuredClone(approval);
  changed.families[0].product_id = "999";
  assert.throws(() => assertApproval(changed), /contract mismatch/);
  assert.deepEqual(approval.excluded_source_rows, ["3449:3452", "3449:3453", "3449:3454", "3449:3455"]);
  assert.deepEqual(approval.exception_source_rows, ["639:644"]);
});

test("canonical identities are deterministic for supplements and accessories", () => {
  const liquid = approval.families.find((row) => row.external_product_id === "3955");
  assert.deepEqual(intendedVariant(liquid, liquid.variants[0]), {
    variant_key: "orange-500ml", display_name: "Orange / 500ml", flavour_code: "orange", flavour_label: "Orange", size_value: 500, size_unit: "ml", pack_count: 1, product_format: "liquid", is_active: true, is_default: false,
  });
  const shirt = approval.families.find((row) => row.external_product_id === "719");
  assert.equal(intendedVariant(shirt, shirt.variants[0]).variant_key, "l");
  assert.equal(intendedVariant(shirt, shirt.variants[0]).display_name, "L");
});

test("inspection is fail-closed and idempotent", () => {
  const family = approval.families.find((row) => row.external_product_id === "3955");
  const empty = inspectVariants(family, []);
  assert.equal(empty.filter((row) => row.action === "CREATE_VARIANT").length, 2);
  const intended = intendedVariant(family, family.variants[0]);
  const complete = inspectVariants({ ...family, variants: [family.variants[0]] }, [{ id: 9001, product_id: 527, ...intended }]);
  assert.equal(complete[0].action, "VERIFY_COMPLETE");
  assert.throws(() => inspectVariants({ ...family, variants: [family.variants[0]] }, [{ id: 9001, product_id: 527, ...intended, display_name: "Wrong" }]), /identity drift/);
});

test("CLI accepts only the guarded tmp output contract", () => {
  assert.equal(parseArgs(["--mode=dry-run", "--output=tmp/gym-high/preflight.json"]).mode, "dry-run");
  assert.throws(() => parseArgs(["--mode=apply", "--output=outside.json"]), /inside repository tmp/);
});
