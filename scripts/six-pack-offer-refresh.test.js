const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const { loadDryRunArtifact } = require("./import-products");
const { parseArgs, run, shippingForPrice } = require("./six-pack-offer-refresh");

const ROOT = path.resolve(__dirname, "..");

function fixture(priceChanges = new Map()) {
  const captured = "2026-07-27T13:43:04.000Z";
  const retailer = { id: 11, name: "6 Pack Supplements", slug: "6-pack-supplements", website: "https://6pack-supplements.co.uk" };
  const records = manifest.rows.map((binding, index) => {
    const simple = binding.external_product_id === binding.external_variant_id;
    const url = `https://6pack-supplements.co.uk/product/test-${binding.external_product_id}/`;
    const price = (10 + index).toFixed(2);
    const shipping = shippingForPrice(price);
    return {
      product: { id: Number(binding.canonical_product_id), name: `Test Product ${binding.external_product_id} 100mg`, is_active: true, merged_into_product_id: null, product_format: "capsule" },
      variant: { id: Number(binding.canonical_variant_id), product_id: Number(binding.canonical_product_id), variant_key: simple ? "default" : `flavour-${index}`, display_name: simple ? "Default" : `Flavour ${index}`, flavour_code: simple ? null : `flavour-${index}`, flavour_label: simple ? null : `Flavour ${index}`, size_value: null, size_unit: null, pack_count: null, product_format: null, is_active: true, is_default: simple },
      retailer,
      mapping: { id: Number(binding.mapping_id), retailer_id: 11, product_id: Number(binding.canonical_product_id), product_variant_id: Number(binding.canonical_variant_id), external_product_id: binding.external_product_id, external_variant_id: binding.external_variant_id, external_sku: null, external_options: {}, external_name: `Test ${index}`, external_slug: `test-${index}`, external_gtin: null, external_url: url, match_method: "slug", match_confidence: 90, updated_at: captured },
      offer: { id: Number(binding.offer_id), product_id: Number(binding.canonical_product_id), retailer_id: 11, product_variant_id: Number(binding.canonical_variant_id), retailer_product_id: Number(binding.mapping_id), price, shipping_cost: shipping, total_price: (Number(price) + Number(shipping)).toFixed(2), in_stock: true, url, last_checked_at: captured },
    };
  });
  const byProduct = new Map();
  for (const record of records) {
    const productId = String(record.mapping.external_product_id);
    if (!byProduct.has(productId)) {
      byProduct.set(productId, {
        external_product_id: productId,
        canonical_url: record.mapping.external_url,
        product_name: record.product.name,
        product_offer: null,
        variations: [],
        html_sha256: crypto.createHash("sha256").update(productId).digest("hex"),
      });
    }
    const live = byProduct.get(productId);
    const nextPrice = priceChanges.get(String(record.mapping.external_variant_id)) || Number(record.offer.price);
    if (record.mapping.external_product_id === record.mapping.external_variant_id) {
      live.product_offer = { price: Number(nextPrice).toFixed(2), in_stock: true };
    } else {
      live.variations.push({ external_variant_id: String(record.mapping.external_variant_id), price: Number(nextPrice).toFixed(2), in_stock: true, active: true, purchasable: true });
    }
  }
  return { state: { records }, byProduct };
}

function paths() {
  const id = crypto.randomUUID();
  return {
    artifact: path.join(ROOT, "tmp", "six-pack-offer-refresh-tests", `${id}.json`),
    report: path.join(ROOT, "tmp", "six-pack-offer-refresh-tests", `${id}-report.json`),
  };
}

test("refresh creates one exact verified-no-change plan per approved mapping", async () => {
  const source = fixture();
  const output = paths();
  const result = await run(
    { target: "production", artifact: output.artifact, report: output.report, requireNoChange: true },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  assert.deepEqual(result.report.action_counts, { VERIFY_NO_CHANGE: manifest.rows.length });
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.equal(artifact.plans.length, manifest.rows.length);
  assert.equal(artifact.plans.every((entry) => entry.resolved_plan.offer.action === "verify_no_change"), true);
});

test("refresh compares live identity with the retailer name before the shorter canonical name", async () => {
  const source = fixture();
  const record = source.state.records.find(
    (row) => row.mapping.external_variant_id === "3899"
  );
  record.product.name = "7Nutrition Zinc Citrate 100 Capsules";
  record.mapping.external_name = "ZINC CITRATE 15mg 100caps 7Nutrition";
  source.byProduct.get("3899").product_name =
    "7Nutrition Zinc Citrate 15mg 100 caps";
  const output = paths();
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: true,
    },
    {
      state: source.state,
      readLive: async (id) => source.byProduct.get(String(id)),
    }
  );
  assert.equal(result.report.result, "PASS");
});

test("one price change is planned atomically while a mass price change blocks", async () => {
  const one = fixture(new Map([["4110", 11.25]]));
  const oneOutput = paths();
  const planned = await run(
    { target: "production", artifact: oneOutput.artifact, report: oneOutput.report, requireNoChange: false },
    { state: one.state, readLive: async (id) => one.byProduct.get(String(id)) }
  );
  assert.equal(planned.report.action_counts.UPDATE_PRICE, 1);
  assert.equal(planned.report.action_counts.VERIFY_NO_CHANGE, manifest.rows.length - 1);

  const massChanges = new Map(
    manifest.rows.slice(0, Math.floor(manifest.rows.length * 0.2) + 1)
      .map((row, index) => [row.external_variant_id, 10.25 + index])
  );
  const mass = fixture(massChanges);
  const massOutput = paths();
  await assert.rejects(
    run(
      { target: "production", artifact: massOutput.artifact, report: massOutput.report, requireNoChange: false },
      { state: mass.state, readLive: async (id) => mass.byProduct.get(String(id)) }
    ),
    /Classifier blocked: MASS_(CHANGE|PRICE)/
  );
});

test("CLI is production-only and confines artifacts to tmp", () => {
  assert.throws(() => parseArgs([]), /target=production/);
  assert.throws(
    () => parseArgs(["--target=production", "--artifact=outside.json", "--report=tmp/report.json"]),
    /inside repository tmp/
  );
});

test("confirmed delivery is £4.99 below £99.99 and free at the threshold", () => {
  assert.equal(shippingForPrice("99.98"), "4.99");
  assert.equal(shippingForPrice("99.99"), "0.00");
  assert.equal(shippingForPrice("120.00"), "0.00");
});
