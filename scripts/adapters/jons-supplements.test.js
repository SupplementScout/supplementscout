const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const { buildPilots, parseAndJoin } = require("./jons-supplements");

const inventory = [
  ["10018787557714", "50561871413586", "per4m-whey-protein-powder-2010g", "Flavour", "Strawberry Creme", "PFM01007", "5060660080021", "2010", "53.95"],
  ["10018787557714", "50561870397778", "per4m-whey-protein-powder-2010g", "Flavour", "Banana Creme", "PFM01004", "5060660080144", "2010", "53.95"],
  ["10018787557714", "50561870987602", "per4m-whey-protein-powder-2010g", "Flavour", "Double Chocolate", "PFM01001", "5060660080007", "2010", "53.95"],
  ["10018787557714", "50561871348050", "per4m-whey-protein-powder-2010g", "Flavour", "Salted Caramel", "PFM01002", "5060660080106", "2010", "53.95"],
  ["10018787557714", "50561871479122", "per4m-whey-protein-powder-2010g", "Flavour", "Vanilla Creme", "PFM01006", "5060660080045", "2010", "53.95"],
  ["10850777465170", "53687090151762", "per4m-eaa-xtra-420g", "Flavour", "Blackberry", "PFM09010", "5061097261892", "420", "23.49"],
  ["10921949692242", "53925321277778", "per4m-pre-workout-stim-570g", "Flavour", "Blackberry", "PFPRESTM014", "5061097261878", "570", "32.49"],
  ["10904679186770", "53868239389010", "per4m-creatine-sherbet-100-servings", "Flavour", "Cherry Fizz", "", "5061097264619", "310", "16.99"],
  ["10913416249682", "53896427798866", "per4m-mult-vita-min-multivitamins-30-capsules", "Title", "Default Title", "PFMMULT010", "5060660089758", "200", "12.99"],
  ["10114493514066", "50927006581074", "trained-by-jp-oh-mega-pharma-pro-180-capsules", "Title", "Default Title", "TBJ24001", "703818267275", "100", "29.99"],
];

function fixture() {
  const header = ["Handle", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams", "Variant Price", "Variant Barcode"];
  const csvText = `${header.join(",")}\n${inventory.map((row) => [row[2], row[3], row[4], row[5], row[7], row[8], row[6]].join(",")).join("\n")}\n`;
  const groups = new Map();
  for (const row of inventory) {
    const group = groups.get(row[0]) || { id: row[0], title: row[2], handle: row[2], updated_at: "2026-07-16T00:00:00Z", options: [{ name: row[3] }], images: [{ src: `https://cdn.example/${row[0]}.webp` }], variants: [] };
    group.variants.push({ id: row[1], title: row[4], option1: row[4], sku: row[5], price: row[8], available: true, updated_at: "2026-07-16T00:00:00Z" });
    groups.set(row[0], group);
  }
  return { csvText, jsonText: JSON.stringify({ products: [...groups.values()] }) };
}

test("joins every sellable CSV row one-to-one with Shopify JSON", () => {
  const input = fixture();
  const result = parseAndJoin(input.csvText, input.jsonText);
  assert.equal(result.csvVariants, 10);
  assert.equal(result.joined.length, 10);
  assert.equal(result.products, 6);
});

test("builds the exact five-plus-two in-stock pilot with authoritative identity", () => {
  const built = buildPilots(fixture());
  const per4m = parse(built.per4mCsv, { columns: true });
  const fresh = parse(built.newCsv, { columns: true });
  assert.equal(per4m.length, 5);
  assert.equal(fresh.length, 2);
  assert.equal(new Set([...per4m, ...fresh].map((row) => row.external_variant_id)).size, 7);
  assert.ok([...per4m, ...fresh].every((row) => typeof row.external_product_id === "string" && typeof row.external_variant_id === "string"));
  assert.ok([...per4m, ...fresh].every((row) => row.in_stock === "true" && row.external_url.endsWith(`variant=${row.external_variant_id}`)));
  assert.deepEqual(per4m.map((row) => row.product_variant_id), ["1003", "", "", "", ""]);
  assert.ok(per4m.every((row) => row.size === "2000" && row.size_unit === "g"));
  assert.equal(JSON.parse(per4m[0].external_options).Flavour, "Strawberry Cream");
  assert.ok([...per4m, ...fresh].every((row) => row.shipping_known === "true" && row.shipping_cost === "3.99" && row.total_price === (Number(row.price) + 3.99).toFixed(2)));
});

test("keeps capsule unit count out of multipack evidence", () => {
  const built = buildPilots(fixture());
  const fresh = parse(built.newCsv, { columns: true });
  assert.deepEqual(fresh.map((row) => row.source_unit_count), ["30", "180"]);
  assert.deepEqual(fresh.map((row) => row.source_unit_type), ["capsule", "capsule"]);
  assert.deepEqual(fresh.map((row) => row.pack_count), ["", ""]);
  assert.deepEqual(fresh.map((row) => row.servings), ["30", ""]);
  const seven = parse(built.sevenCsv, { columns: true });
  assert.equal(seven.length, 7);
});

test("fails closed on source price drift", () => {
  const input = fixture();
  const payload = JSON.parse(input.jsonText);
  payload.products[0].variants[0].price = "1.00";
  assert.throws(() => parseAndJoin(input.csvText, JSON.stringify(payload)), /Price mismatch/);
});

test("fails closed on missing and multiple CSV to Shopify matches", () => {
  const missing = fixture();
  const missingPayload = JSON.parse(missing.jsonText);
  missingPayload.products[0].variants.pop();
  assert.throws(() => parseAndJoin(missing.csvText, JSON.stringify(missingPayload)), /Exact join mismatch/);

  const multiple = fixture();
  const multiplePayload = JSON.parse(multiple.jsonText);
  multiplePayload.products[0].variants.push({ ...multiplePayload.products[0].variants[0] });
  assert.throws(() => parseAndJoin(multiple.csvText, JSON.stringify(multiplePayload)), /Multiple Shopify matches/);
});

test("fails closed on source SKU drift", () => {
  const input = fixture();
  const payload = JSON.parse(input.jsonText);
  payload.products[0].variants[0].sku = "DRIFTED-SKU";
  assert.throws(() => parseAndJoin(input.csvText, JSON.stringify(payload)), /SKU mismatch/);
});

test("fails closed on duplicate external variant identity", () => {
  const input = fixture();
  const payload = JSON.parse(input.jsonText);
  payload.products[1].variants[0].id = payload.products[0].variants[0].id;
  assert.throws(() => buildPilots({ csvText: input.csvText, jsonText: JSON.stringify(payload) }), /Duplicate external variant identity/);
});

test("fails closed on out-of-stock pilot inventory", () => {
  const input = fixture();
  const payload = JSON.parse(input.jsonText);
  payload.products[0].variants[0].available = false;
  assert.throws(() => buildPilots({ csvText: input.csvText, jsonText: JSON.stringify(payload) }), /out of stock/);
});

test("does not write outside explicit main invocation", () => {
  assert.equal(fs.existsSync(path.join(__dirname, "jons-supplements.test-output.csv")), false);
});
