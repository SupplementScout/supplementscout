const assert = require("node:assert/strict");
const test = require("node:test");

const {
  analyzeRows,
  buildReviewSql,
  parseArgs,
  parseBoolean,
  parseCsvContent,
  parseUpdates,
  summarizeResults,
} = require("./import-verified-product-data");

function product(overrides = {}) {
  return {
    id: "337",
    name: "GYM HIGH Whey Pro Synergy 600g",
    net_weight_g: null,
    net_volume_ml: null,
    serving_count_verified: null,
    serving_size_g: null,
    serving_size_ml: null,
    protein_per_serving_g: null,
    creatine_per_serving_g: null,
    unit_count: null,
    unit_type: null,
    product_format: null,
    unit_pricing_verified: false,
    nutrition_verified: false,
    ...overrides,
  };
}

function currentMap(products) {
  return new Map(products.map((item) => [String(item.id), item]));
}

function analyze(csv, products = [product()]) {
  const parsed = parseCsvContent(csv);
  const results = analyzeRows(parsed.rows, currentMap(products));

  return {
    parsed,
    results,
    summary: summarizeResults(results, parsed.fileErrors),
  };
}

test("valid one-row dry run reports one changed product and no apply", () => {
  const { results, summary } = analyze(
    "id,expected_name,net_weight_g,product_format,unit_pricing_verified\n337,GYM HIGH Whey Pro Synergy 600g,600,powder,true\n"
  );

  assert.equal(results[0].valid, true);
  assert.equal(summary.productsToUpdate, 1);
  assert.equal(summary.applyAllowed, false);
});

test("multiple valid rows are accepted", () => {
  const { summary } = analyze(
    "id,net_weight_g\n337,600\n510,600\n",
    [product({ id: "337" }), product({ id: "510", name: "GYM HIGH Whey Pro Synergy Dynamic 600g" })]
  );

  assert.equal(summary.validRows, 2);
  assert.equal(summary.invalidRows, 0);
});

test("missing id is rejected", () => {
  const { results } = analyze("id,net_weight_g\n,600\n");

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /id is required/);
});

test("invalid id format is rejected and bigint ids remain strings", () => {
  const { results } = analyze("id,net_weight_g\n001,600\n");

  assert.equal(results[0].valid, false);
  assert.equal(typeof results[0].id, "string");
  assert.match(results[0].errors.join(" "), /positive integer string/);
});

test("unknown product id is rejected", () => {
  const { results } = analyze("id,net_weight_g\n999999999999999999,600\n", []);

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /does not exist/);
});

test("duplicate product id is rejected", () => {
  const { results } = analyze("id,net_weight_g\n337,600\n337,700\n");

  assert.equal(results[1].valid, false);
  assert.match(results[1].errors.join(" "), /duplicate product id/);
});

test("expected_name mismatch is rejected", () => {
  const { results } = analyze("id,expected_name\n337,Wrong Name\n");

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /expected_name/);
});

test("unknown CSV column is rejected", () => {
  const parsed = parseCsvContent("id,mystery\n337,value\n");

  assert.match(parsed.fileErrors.join(" "), /Unknown CSV column/);
});

test("duplicate headers are rejected", () => {
  const parsed = parseCsvContent("id,id,net_weight_g\n337,510,600\n");

  assert.match(parsed.fileErrors.join(" "), /Duplicate CSV header/);
});

test("missing headers are rejected", () => {
  const parsed = parseCsvContent("");

  assert.match(parsed.fileErrors.join(" "), /CSV header is required/);
});

test("missing id header is rejected", () => {
  const parsed = parseCsvContent("expected_name,net_weight_g\nName,600\n");

  assert.match(parsed.fileErrors.join(" "), /Missing required CSV column: id/);
});

test("quoted commas and quoted double quotes are parsed safely", () => {
  const { results } = analyze('id,expected_name,notes\n337,"GYM HIGH Whey Pro Synergy 600g","Label says ""verified"", tub"\n');

  assert.equal(results[0].valid, true);
});

test("UTF-8 BOM, CRLF, LF, trailing blanks, and whitespace are handled", () => {
  const parsed = parseCsvContent("\uFEFFid, expected_name , net_weight_g\r\n 337 , GYM HIGH Whey Pro Synergy 600g , 600 \r\n\n");
  const results = analyzeRows(parsed.rows, currentMap([product()]));

  assert.equal(parsed.fileErrors.length, 0);
  assert.equal(results[0].id, "337");
  assert.equal(results[0].valid, true);
});

test("blank fields leave values unchanged", () => {
  const { results } = analyze("id,net_weight_g\n337,\n", [
    product({ net_weight_g: 600 }),
  ]);

  assert.deepEqual(results[0].changes, []);
});

test("positive decimals are accepted for decimal fields", () => {
  const updates = parseUpdates(
    {
      net_weight_g: "600.5",
      net_volume_ml: "500.5",
      serving_size_g: "30.5",
      serving_size_ml: "25.5",
    },
    2
  );

  assert.equal(updates.net_weight_g, 600.5);
  assert.equal(updates.net_volume_ml, 500.5);
  assert.equal(updates.serving_size_g, 30.5);
  assert.equal(updates.serving_size_ml, 25.5);
});

test("integer fields reject decimal values", () => {
  assert.throws(
    () => parseUpdates({ serving_count_verified: "20.5" }, 2),
    /positive integer/
  );
});

test("negative and zero values are rejected where forbidden", () => {
  assert.throws(() => parseUpdates({ net_weight_g: "0" }, 2), /greater than 0/);
  assert.throws(() => parseUpdates({ net_volume_ml: "-1" }, 2), /greater than 0/);
  assert.throws(() => parseUpdates({ unit_count: "-1" }, 2), /greater than 0/);
});

test("liquid CSV row accepts volume fields and serving count", () => {
  const { results } = analyze(
    "id,net_volume_ml,serving_count_verified,serving_size_ml,product_format,unit_pricing_verified\n337,500,16,30,liquid,true\n"
  );

  assert.equal(results[0].valid, true);
  assert.deepEqual(
    results[0].changes.map((change) => change.field),
    [
      "net_volume_ml",
      "serving_count_verified",
      "serving_size_ml",
      "product_format",
      "unit_pricing_verified",
    ]
  );
});

test("liquid CSV row rejects gram fields", () => {
  const withWeight = analyze(
    "id,net_weight_g,net_volume_ml,product_format,unit_pricing_verified\n337,500,500,liquid,true\n"
  );
  const withServingSizeG = analyze(
    "id,net_volume_ml,serving_size_g,product_format,unit_pricing_verified\n337,500,30,liquid,true\n"
  );

  assert.equal(withWeight.results[0].valid, false);
  assert.match(withWeight.results[0].errors.join(" "), /net_volume_ml instead of net_weight_g/);
  assert.equal(withServingSizeG.results[0].valid, false);
  assert.match(withServingSizeG.results[0].errors.join(" "), /serving_size_ml instead of serving_size_g/);
});

test("non-liquid CSV row rejects volume fields", () => {
  const { results } = analyze(
    "id,net_volume_ml,product_format,unit_pricing_verified\n337,500,powder,true\n"
  );

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /net_volume_ml requires product_format liquid/);
});

test("liquid unit pricing requires net_volume_ml", () => {
  const { results } = analyze(
    "id,serving_count_verified,product_format,unit_pricing_verified\n337,16,liquid,true\n"
  );

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /liquid unit_pricing_verified requires net_volume_ml/);
});

test("boolean parsing accepts documented values", () => {
  assert.equal(parseBoolean("yes", "flag", 2), true);
  assert.equal(parseBoolean("N", "flag", 2), false);
  assert.equal(parseBoolean("1", "flag", 2), true);
  assert.equal(parseBoolean("0", "flag", 2), false);
});

test("invalid boolean is rejected", () => {
  assert.throws(() => parseBoolean("maybe", "nutrition_verified", 2), /boolean/);
});

test("invalid product_format is rejected", () => {
  assert.throws(() => parseUpdates({ product_format: "jar" }, 2), /unknown value/);
});

test("invalid unit_type is rejected", () => {
  assert.throws(() => parseUpdates({ unit_type: "bottle" }, 2), /unknown value/);
});

test("protein above serving size is rejected using effective values", () => {
  const { results } = analyze("id,protein_per_serving_g\n337,31\n", [
    product({ serving_size_g: 30 }),
  ]);

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /protein_per_serving_g cannot exceed/);
});

test("creatine above serving size is rejected using effective values", () => {
  const { results } = analyze("id,creatine_per_serving_g\n337,6\n", [
    product({ serving_size_g: 5 }),
  ]);

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /creatine_per_serving_g cannot exceed/);
});

test("nutrition_verified true requires nutrition data", () => {
  const { results } = analyze("id,nutrition_verified\n337,true\n");

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /nutrition_verified requires/);
});

test("unit_pricing_verified true requires a unit field", () => {
  const { results } = analyze("id,unit_pricing_verified\n337,true\n");

  assert.equal(results[0].valid, false);
  assert.match(results[0].errors.join(" "), /unit_pricing_verified requires/);
});

test("default dry-run summary does not allow writes", () => {
  const { summary } = analyze("id,net_weight_g\n337,600\n");

  assert.equal(summary.applyAllowed, false);
});

test("apply would be blocked when one row is invalid", () => {
  const { summary } = analyze("id,net_weight_g\n337,600\nbad,700\n");

  assert.equal(summary.invalidRows, 1);
  assert.equal(summary.applyAllowed, false);
});

test("review SQL wraps updates in one manual transaction", () => {
  const { results } = analyze("id,net_weight_g\n337,600\n");
  const sql = buildReviewSql(results);

  assert.match(sql, /^begin;/);
  assert.match(sql, /select id, name/);
  assert.match(sql, /where id = '337';/);
  assert.match(sql, /rollback;$/);
});

test("legacy servings is not updated", () => {
  const parsed = parseCsvContent("id,servings\n337,20\n");

  assert.match(parsed.fileErrors.join(" "), /Unknown CSV column/);
});

test("unknown CLI flags fail safely", () => {
  assert.throws(() => parseArgs(["file.csv", "--force"]), /Unknown option/);
});

test("multiple CSV paths fail safely", () => {
  assert.throws(() => parseArgs(["one.csv", "two.csv"]), /Only one CSV/);
});
