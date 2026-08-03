const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { evaluateCapture, loadScope, main, parseArgs } = require("./gym-high-source-monitor");

function capture(overrides = {}) {
  return {
    external_product_id: "703",
    canonical_url: "https://gymhigh.co.uk/product/gym-high-vegan-plant-based-protein-blend/",
    captured_at: "2026-08-01T12:00:00.000Z",
    product_name: "GYM HIGH Vegan Plant-Based-Protein Blend",
    html_sha256: "a".repeat(64),
    variations: [
      { external_variant_id: "704", attributes: { attribute_pa_flavour: "berry-bliss" }, price: "21.99", regular_price: "21.99", in_stock: true, purchasable: true, active: true, sku: null },
      { external_variant_id: "705", attributes: { attribute_pa_flavour: "caramel-chocolate" }, price: "21.99", regular_price: "21.99", in_stock: true, purchasable: true, active: true, sku: null }
    ],
    ...overrides
  };
}

test("approved GYM HIGH source passes and other variants remain discovery-only", () => {
  const scope = loadScope();
  const report = evaluateCapture(capture(), scope, "2026-08-01T12:01:00.000Z");
  assert.equal(report.result, "PASS");
  assert.equal(report.production_writes, 0);
  assert.equal(report.catalogue_creates, 0);
  assert.equal(report.approved.external_variant_id, "704");
  assert.equal(report.approved.price_gbp, "21.99");
  assert.deepEqual(report.discovery_only.map((row) => row.external_variant_id), ["705"]);
});

test("identity, option and purchasability drift fail closed", () => {
  const scope = loadScope();
  const cases = [
    capture({ external_product_id: "999" }),
    capture({ product_name: "Different product" }),
    capture({ variations: [] }),
    capture({ variations: [{ external_variant_id: "704", attributes: { attribute_pa_flavour: "vanilla-delight" }, price: "21.99", regular_price: "21.99", in_stock: true, purchasable: true, active: true, sku: null }] }),
    capture({ variations: [{ external_variant_id: "704", attributes: { attribute_pa_flavour: "berry-bliss" }, price: "21.99", regular_price: "21.99", in_stock: false, purchasable: false, active: true, sku: null }] })
  ];
  for (const value of cases) assert.throws(() => evaluateCapture(value, scope), /drift|missing|purchasable/i);
});

test("monitor only reads once and writes one report", async () => {
  const scope = loadScope();
  const calls = [];
  const writes = [];
  const report = await main({
    args: { output: "ignored" }, scope,
    read: async (options) => { calls.push(options); return capture(); },
    write: (output, value) => writes.push({ output, value }),
    capturedAt: "2026-08-01T12:01:00.000Z"
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].productId, "703");
  assert.equal(writes.length, 1);
  assert.equal(report.production_writes, 0);
});

test("output is confined to tmp", () => {
  assert.throws(() => parseArgs(["--output=report.json"]), /inside repository tmp/);
  assert.doesNotThrow(() => parseArgs(["--output=tmp/gym-high-source-monitor/report.json"]));
});

test("scheduled source monitor retries transient source failures without weakening guards", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "gym-high-source-monitor.yml"),
    "utf8"
  );
  assert.match(workflow, /for attempt in 1 2 3 4 5/);
  assert.match(workflow, /gym-high-catalogue-audit\.js --output=tmp\/gym-high-source-monitor\/report\.json/);
  assert.match(workflow, /cron: "43 3 \* \* \*"/);
  assert.match(workflow, /cron: "43 15 \* \* \*"/);
  assert.match(workflow, /delays=\(30 60 120 240\)/);
  assert.match(workflow, /sleep "\$\{delays\[\$\(\(attempt - 1\)\)\]\}"/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});
