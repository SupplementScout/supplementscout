const assert = require("node:assert/strict");
const test = require("node:test");
const { exactOptions, parseArgs } = require("./simply-supplements-options-audit");

test("Simply options are exact Size and Subscription source values", () => {
  assert.deepEqual(exactOptions({ id: 1, options: [{ name: "Size" }, { name: "Subscription" }] }, { id: 2, option1: "120 Capsules", option2: "[Multibuy 1]" }), { Size: "120 Capsules", Subscription: "[Multibuy 1]" });
  assert.throws(() => exactOptions({ id: 1, options: [{ name: "Size" }, { name: "Flavour" }] }, { id: 2, option1: "120 Capsules", option2: "Berry" }), /schema/);
  assert.throws(() => exactOptions({ id: 1, options: [{ name: "Size" }, { name: "Subscription" }] }, { id: 2, option1: "120 Capsules", option2: "[Multibuy 2]" }), /values/);
});

test("options audit CLI accepts only repository tmp paths", () => {
  assert.equal(parseArgs(["--identity=tmp/i.json", "--output=tmp/o.json"]).output.endsWith("o.json"), true);
  assert.throws(() => parseArgs(["--identity=tmp/i.json", "--output=../o.json"]), /inside tmp/);
});
