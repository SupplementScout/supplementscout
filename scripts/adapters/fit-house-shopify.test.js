const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");

const { atomicWrite } = require("./kior-shopify");
const {
  buildCanonical,
  batchOfferCounts,
  importerCommand,
  main,
  runImporter,
  sha256,
  validateConfig,
  validateGeneratedRows,
} = require("./fit-house-shopify");

const ROOT = path.resolve(__dirname, "../..");
const fullConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "config/retailers/fit-house-shopify.json"), "utf8"));
const config = {
  ...structuredClone(fullConfig),
  products: structuredClone(fullConfig.products.slice(0, 72)),
};
const header = fs.readFileSync(path.join(ROOT, "data/templates/retailer-feed-template.csv"), "utf8").split(/\r?\n/, 1)[0].split(",");
const forbidden = ["canonical_product_id", "gtin", "product_gtin_verified", "free_shipping_threshold", "net_weight_g", "net_volume_ml", "unit_count", "unit_type", "servings", "nutrition_verified", "Variant Grams", "Body HTML", "SKU", "inventory quantity"];

function sourceProduct(item, overrides = {}) {
  return {
    id: Number(item.shopify_product_id),
    title: item.canonical_name,
    handle: item.expected_handle,
    vendor: item.brand === "7Nutrition" ? "7 Nutrition" : item.brand,
    updated_at: "2026-07-11T12:00:00Z",
    body_html: "FORBIDDEN BODY",
    images: [{ src: `https://cdn.shopify.com/s/files/1/fit-house/${item.shopify_product_id}.jpg` }],
    variants: [{
      id: Number(item.shopify_variant_id), product_id: Number(item.shopify_product_id), title: "Default Title",
      price: item.approved_price.toFixed(2), available: item.approved_in_stock, sku: "FORBIDDEN-SKU",
      grams: 999, updated_at: "2026-07-11T12:00:00Z",
    }],
    ...overrides,
  };
}

function source(options = {}) {
  const products = config.products.map((item) => sourceProduct(item));
  if (options.unmapped) products.push({
    id: 999999999, title: "Unmapped", handle: "unmapped", vendor: "Other", updated_at: "2026-07-11T12:00:00Z",
    images: [{ src: "https://cdn.shopify.com/unmapped.jpg" }], variants: [{ id: 888888888, product_id: 999999999, price: "1.00", available: true }],
  });
  return { products };
}

function build(shopify = source(), configured = config) {
  return buildCanonical({ config: structuredClone(configured), shopify, templateHeader: header });
}

test("valid source produces exactly 72 approved canonical rows and reports unmapped products", () => {
  const result = build(source({ unmapped: true }));
  assert.equal(config.products.length, 72);
  assert.equal(result.rows.length, 72);
  assert.equal(result.unmapped_products.length, 1);
  assert.equal(result.rows.some((row) => row.external_product_id === "999999999"), false);
  assert.deepEqual(result.rows.map((row) => row.external_product_id), config.products.map((item) => item.shopify_product_id));
  for (const [index, row] of result.rows.entries()) {
    const item = config.products[index];
    assert.equal(row.slug, item.canonical_slug);
    assert.equal(row.product_name, item.canonical_name);
    assert.equal(row.brand, item.brand);
    assert.equal(row.external_url, `https://fithouse.uk/products/${item.expected_handle}?variant=${item.shopify_variant_id}`);
    assert.equal(row.affiliate_url, row.external_url);
  }
});

test("generated rows preserve the approved five-batch mapping order", () => {
  const result = build();
  assert.deepEqual(
    result.rows.slice(0, 10).map((row) => row.external_product_id),
    [
      "9678096761072", "9680364208368", "9680391831792", "9706776264944",
      "9706779279600", "9710810628336", "10019820470512", "10024895742192",
      "10028457820400", "10028467093744",
    ]
  );
  assert.deepEqual(
    result.rows.slice(10, 22).map((row) => row.external_product_id),
    [
      "10034753143024", "10079982584048", "10079982944496", "10081661419760",
      "10081679147248", "10083619340528", "10033393893616", "10028557009136",
      "10028561989872", "10028475810032", "10028500615408", "10077997170928",
    ]
  );
  assert.deepEqual(
    result.rows.slice(22, 38).map((row) => row.external_product_id),
    [
      "8271543730416", "8493486047472", "9370163708144", "9347715301616",
      "9347657269488", "9107338264816", "9060070064368", "9058975187184",
      "8969071853808", "8905761685744", "8816824549616", "8776332837104",
      "8776286798064", "8511414534384", "8493494370544", "8334171177200",
    ]
  );
  assert.deepEqual(
    result.rows.slice(38, 52).map((row) => row.external_product_id),
    [
      "8163807887600", "9370261913840", "9347456499952", "9179043856624",
      "8245425144048", "9059083157744", "8929298252016", "8776311636208",
      "8493540278512", "8479801114864", "8339449184496", "8333749092592",
      "8493491585264", "10077991993584",
    ]
  );
  assert.deepEqual(
    result.rows.slice(52).map((row) => row.external_product_id),
    [
      "8816846504176", "8693101330672", "8271509946608", "8968956084464",
      "8685938376944", "8147551846640", "9624501813488", "9623385932016",
      "9347614343408", "9176724177136", "9176635834608", "9174925803760",
      "9168643719408", "9097931817200", "8147560530160", "9060343709936",
      "9041428283632", "8333086884080", "9168824172784", "8273427333360",
    ]
  );
});

test("generated CSV exactly matches the template and excludes forbidden fields and raw metadata", () => {
  const result = build();
  assert.deepEqual(result.csv.split("\n", 1)[0].split(","), header);
  const rows = parse(result.csv, { columns: true, skip_empty_lines: true });
  assert.equal(rows.length, 72);
  for (const field of forbidden) assert.equal(header.includes(field), false);
  assert.equal(result.csv.includes("FORBIDDEN BODY"), false);
  assert.equal(result.csv.includes("FORBIDDEN-SKU"), false);
  assert.ok(rows.every((row) => row.description === "" && row.external_gtin === "" && row.shipping_cost === "3.99"));
});

test("config guard requires exactly 72 unique product IDs, variant IDs, slugs, and handles", () => {
  assert.doesNotThrow(() => validateConfig(structuredClone(config)));
  for (const key of ["shopify_product_id", "shopify_variant_id", "canonical_slug", "expected_handle"]) {
    const changed = structuredClone(config);
    changed.products[1][key] = changed.products[0][key];
    assert.throws(() => validateConfig(changed), /Duplicate or missing/);
  }
  const short = structuredClone(config); short.products.pop();
  assert.equal(short.products.length, 71);
  assert.throws(() => validateConfig(short), /exactly 72/);
  const extra = structuredClone(config); extra.products.push({ ...structuredClone(extra.products[0]), shopify_product_id: "999", shopify_variant_id: "998", canonical_slug: "extra", expected_handle: "extra" });
  assert.equal(extra.products.length, 73);
  assert.throws(() => validateConfig(extra), /exactly 72/);
});

test("production adapter rejects the full 73-product config before fetch or import", async () => {
  assert.equal(fullConfig.products.length, 73);
  let fetched = false;
  let imported = false;
  await assert.rejects(
    main({
      argv: [],
      fetchImpl: async () => {
        fetched = true;
      },
      runImporter: () => {
        imported = true;
      },
    }),
    /exactly 72/
  );
  assert.equal(fetched, false);
  assert.equal(imported, false);
});

test("batch five contains exactly twenty new canonical mappings", () => {
  const batchFive = config.products.slice(52);
  assert.equal(batchFive.length, 20);
  assert.ok(batchFive.every((item) => item.canonical_product_id === null));
});

test("duplicate generated external URL is rejected", () => {
  const rows = build().rows.map((row) => ({ ...row }));
  rows[1].external_url = rows[0].external_url;
  assert.throws(() => validateGeneratedRows(rows, header), /generated external URL/);
});

test("missing product, changed product ID, changed variant ID, and variant ownership mismatch block the run", () => {
  const missing = source(); missing.products.pop();
  assert.throws(() => build(missing), /Missing configured Shopify products/);
  const productId = source(); productId.products[0].id = 123;
  assert.throws(() => build(productId), /Missing configured Shopify products/);
  const variantId = source(); variantId.products[0].variants[0].id = 123;
  assert.throws(() => build(variantId), /Configured variant .* is missing/);
  const owner = source(); owner.products[0].variants[0].product_id = 123;
  assert.throws(() => build(owner), /variant product ID mismatch/);
});

test("handle and vendor drift block while stock drift is reported", () => {
  const handle = source(); handle.products[0].handle = "changed";
  assert.throws(() => build(handle), /handle changes/);
  const vendor = source(); vendor.products[0].vendor = "Unexpected Vendor";
  assert.throws(() => build(vendor), /vendor mismatches/);
  const stock = source(); stock.products[0].variants[0].available = false;
  const result = build(stock);
  assert.equal(result.stock_changes.length, 1);
  assert.equal(result.rows[0].in_stock, "false");
});

test("invalid and excessive live prices are rejected", () => {
  for (const price of ["", "0", "NaN", "Infinity"]) {
    const shopify = source(); shopify.products[0].variants[0].price = price;
    assert.throws(() => build(shopify), /Invalid live price/);
  }
  const drift = source(); drift.products[0].variants[0].price = (config.products[0].approved_price * 1.251).toFixed(2);
  assert.throws(() => build(drift), /exceeds 25%/);
});

test("duplicate source product and variant IDs block the run", () => {
  const products = source(); products.products.push(structuredClone(products.products[0]));
  assert.throws(() => build(products), /Duplicate Shopify product ID/);
  const variants = source(); variants.products[1].variants[0].id = variants.products[0].variants[0].id;
  assert.throws(() => build(variants), /Duplicate Shopify variant ID/);
});

test("invalid image and retailer URLs are rejected", () => {
  const image = source(); image.products[0].images[0].src = "http://cdn.shopify.com/image.jpg";
  assert.throws(() => build(image), /Invalid Shopify images/);
  const retailer = structuredClone(config); retailer.retailer.website = "https://evil.example";
  assert.throws(() => validateConfig(retailer), /Unexpected Fit House retailer identity/);
  const timestamp = source(); timestamp.products[0].variants[0].updated_at = "not-a-date";
  assert.throws(() => build(timestamp), /Invalid source_updated_at/);
});

test("importer child process has only fixed safe-create dry-run arguments and no apply", () => {
  let captured;
  const csvPath = "C:\\tmp\\fit-house.csv";
  const result = runImporter(csvPath, (command, args, options) => {
    captured = { command, args, options };
    fs.mkdirSync(path.dirname(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH,
      JSON.stringify({ runId: options.env.SUPPLEMENTSCOUT_IMPORT_RUN_ID, rowLevelOffers: [] })
    );
    return { status: 0, stdout: "Dry run: no database writes performed.\n", stderr: "" };
  });
  assert.deepEqual(captured.args.slice(1), ["--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`]);
  assert.equal(captured.args.some((arg) => /apply/i.test(arg)), false);
  assert.equal(result.database_writes, 0);
  assert.match(result.output, /no database writes/);
  assert.deepEqual(importerCommand(csvPath).slice(2), ["--mode=feed", "--safe-create", "--dry-run", `--csv=${csvPath}`]);
});

test("importer report must be newly created, valid JSON, and match the current run", () => {
  const ok = "Dry run: no database writes performed.\n";
  assert.throws(() => runImporter("C:\\tmp\\fit-house.csv", () => ({ status: 0, stdout: ok, stderr: "" })), /did not create/);
  assert.throws(() => runImporter("C:\\tmp\\fit-house.csv", (_command, _args, options) => {
    fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, "not-json");
    return { status: 0, stdout: ok, stderr: "" };
  }), /empty or invalid/);
  assert.throws(() => runImporter("C:\\tmp\\fit-house.csv", (_command, _args, options) => {
    fs.writeFileSync(options.env.SUPPLEMENTSCOUT_IMPORT_REPORT_PATH, JSON.stringify({ runId: "old", rowLevelOffers: [] }));
    return { status: 0, stdout: ok, stderr: "" };
  }), /stale or belongs/);
});

function rowLevelActions(batchOne, batchTwo, batchThree, batchFour, batchFive) {
  return config.products.map((item, index) => ({
    rowNumber: index + 2,
    slug: item.canonical_slug,
    offerAction: index < 10
      ? batchOne[index]
      : index < 22
        ? batchTwo[index - 10]
        : index < 38
          ? batchThree[index - 22]
          : index < 52
            ? batchFour[index - 38]
            : batchFive[index - 52],
  }));
}

test("batch offer reporting splits pre-apply and post-apply actions by canonical slug", () => {
  const before = batchOfferCounts(
    config,
    rowLevelActions(Array(10).fill("unchanged"), Array(12).fill("unchanged"), Array(16).fill("unchanged"), Array(14).fill("unchanged"), Array(20).fill("create"))
  );
  assert.deepEqual(before.batch_1, { offers_created: 0, offers_updated: 0, offers_unchanged: 10 });
  assert.deepEqual(before.batch_2, { offers_created: 0, offers_updated: 0, offers_unchanged: 12 });
  assert.deepEqual(before.batch_3, { offers_created: 0, offers_updated: 0, offers_unchanged: 16 });
  assert.deepEqual(before.batch_4, { offers_created: 0, offers_updated: 0, offers_unchanged: 14 });
  assert.deepEqual(before.batch_5, { offers_created: 20, offers_updated: 0, offers_unchanged: 0 });

  const after = batchOfferCounts(
    config,
    rowLevelActions(Array(10).fill("unchanged"), Array(12).fill("unchanged"), Array(16).fill("unchanged"), Array(14).fill("unchanged"), Array(20).fill("unchanged"))
  );
  assert.deepEqual(after.batch_1, { offers_created: 0, offers_updated: 0, offers_unchanged: 10 });
  assert.deepEqual(after.batch_2, { offers_created: 0, offers_updated: 0, offers_unchanged: 12 });
  assert.deepEqual(after.batch_3, { offers_created: 0, offers_updated: 0, offers_unchanged: 16 });
  assert.deepEqual(after.batch_4, { offers_created: 0, offers_updated: 0, offers_unchanged: 14 });
  assert.deepEqual(after.batch_5, { offers_created: 0, offers_updated: 0, offers_unchanged: 20 });
});

test("batch offer reporting supports mixed actions and preserves global totals", () => {
  const counts = batchOfferCounts(
    config,
    rowLevelActions(
      [...Array(8).fill("unchanged"), ...Array(2).fill("update")],
      [...Array(10).fill("unchanged"), "update", "create"],
      [...Array(13).fill("unchanged"), "update", "update", "create"],
      [...Array(11).fill("unchanged"), "update", "update", "create"],
      [...Array(17).fill("unchanged"), "update", "update", "create"]
    )
  );
  assert.deepEqual(counts.batch_1, { offers_created: 0, offers_updated: 2, offers_unchanged: 8 });
  assert.deepEqual(counts.batch_2, { offers_created: 1, offers_updated: 1, offers_unchanged: 10 });
  assert.deepEqual(counts.batch_3, { offers_created: 1, offers_updated: 2, offers_unchanged: 13 });
  assert.deepEqual(counts.batch_4, { offers_created: 1, offers_updated: 2, offers_unchanged: 11 });
  assert.deepEqual(counts.batch_5, { offers_created: 1, offers_updated: 2, offers_unchanged: 17 });
  assert.deepEqual(
    Object.fromEntries(Object.keys(counts.batch_1).map((key) => [key, counts.batch_1[key] + counts.batch_2[key] + counts.batch_3[key] + counts.batch_4[key] + counts.batch_5[key]])),
    { offers_created: 4, offers_updated: 9, offers_unchanged: 59 }
  );
});

test("batch offer reporting rejects unknown, missing, and duplicate slugs", () => {
  const valid = rowLevelActions(Array(10).fill("unchanged"), Array(12).fill("unchanged"), Array(16).fill("unchanged"), Array(14).fill("unchanged"), Array(20).fill("create"));
  assert.throws(() => batchOfferCounts(config, [...valid.slice(0, -1), { ...valid.at(-1), slug: "unknown" }]), /unknown slug/);
  assert.throws(() => batchOfferCounts(config, valid.slice(0, -1)), /missing approved slug/);
  assert.throws(() => batchOfferCounts(config, [...valid.slice(0, -1), valid[0]]), /duplicate slug/);
});

test("batch offer reporting requires one exact row-level result per approved row", () => {
  const valid = rowLevelActions(Array(10).fill("unchanged"), Array(12).fill("unchanged"), Array(16).fill("unchanged"), Array(14).fill("unchanged"), Array(20).fill("create"));
  assert.throws(() => batchOfferCounts(config, valid.slice(0, -1)), /missing approved slug/);
  assert.throws(() => batchOfferCounts(config, valid.map((item, index) => index ? item : { ...item, extra: true })), /contain exactly/);
});

test("adapter report keeps existing batches and batch-five plans separate", async () => {
  const rowLevelOffers = rowLevelActions(
    Array(10).fill("unchanged"),
    Array(12).fill("unchanged"),
    Array(16).fill("unchanged"),
    Array(14).fill("unchanged"),
    Array(20).fill("create")
  );
  const output = [
    "new products would be created: 20",
    "retailer_products would be created: 20",
    "offers would be created: 20",
    "offers would be updated: 0",
    "offers unchanged: 52",
    "price_history rows would be created: 20",
    "Dry run: no database writes performed.",
  ].join("\n");
  const originalReadFileSync = fs.readFileSync;
  fs.readFileSync = (file, ...args) =>
    path.resolve(file) === path.join(ROOT, "config/retailers/fit-house-shopify.json")
      ? JSON.stringify(config)
      : originalReadFileSync(file, ...args);

  let result;
  try {
    result = await main({
      argv: [],
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(source()),
      }),
      runImporter: () => ({
        command: importerCommand("generated.csv"),
        status: 0,
        output,
        rowLevelOffers,
        database_writes: 0,
      }),
    });
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  assert.deepEqual(result.report.batches.batch_1, {
    configured: 10, mapped: 10, existing_products: 10,
    offers_created: 0, offers_updated: 0, offers_unchanged: 10,
  });
  assert.deepEqual(result.report.batches.batch_2, {
    configured: 12, mapped: 12, existing_products: 12,
    offers_created: 0, offers_updated: 0, offers_unchanged: 12,
  });
  assert.deepEqual(result.report.batches.batch_3, {
    configured: 16, mapped: 16, existing_canonical_mappings: 1,
    offers_created: 0, offers_updated: 0, offers_unchanged: 16,
  });
  assert.deepEqual(result.report.batches.batch_4, {
    configured: 14, mapped: 14,
    offers_created: 0, offers_updated: 0, offers_unchanged: 14,
  });
  assert.deepEqual(result.report.batches.batch_5, {
    configured: 20, mapped: 20,
    offers_created: 20, offers_updated: 0, offers_unchanged: 0,
    new_products_planned: 20,
    new_retailer_products_planned: 20,
    new_offers_planned: 20,
    new_price_history_rows_planned: 20,
  });
  assert.equal(result.report.database_writes, 0);
});

test("batch four preserves approved identities and excludes blocked products", () => {
  const batchFour = config.products.slice(38, 52);
  const serialized = JSON.stringify(batchFour).toLowerCase();
  assert.equal(batchFour.length, 14);
  assert.ok(batchFour.every((item) => item.canonical_product_id === null));
  assert.equal(serialized.includes("8816846504176"), false);
  assert.equal(serialized.includes("8693101330672"), false);
  assert.equal(serialized.includes("8271509946608"), false);
  assert.equal(serialized.includes("8968956084464"), false);
  assert.equal(serialized.includes("8262988988656"), false);
  assert.equal(serialized.includes("10081729544432"), false);
  assert.equal(serialized.includes("10028522373360"), false);
  assert.ok(batchFour.some((item) => item.canonical_name === "Osavi Fenugreek 550mg 60 Capsules" && item.canonical_slug === "osavi-fenugreek-550mg-60-capsules"));
  assert.ok(batchFour.some((item) => item.canonical_name === "Osavi Colostrum Powder 100g" && item.canonical_slug === "osavi-colostrum-powder-100g"));
  assert.equal(batchFour.some((item) => item.canonical_name.includes("1200mg") || item.canonical_slug.includes("1200mg")), false);

  const existing = structuredClone(config);
  existing.products[38].canonical_product_id = 1;
  assert.throws(() => validateConfig(existing), /14 new canonical/);

  const blocked = structuredClone(config);
  blocked.products[38].shopify_product_id = "8262988988656";
  assert.throws(() => validateConfig(blocked), /blocked product/);

  const wrongFenugreek = structuredClone(config);
  wrongFenugreek.products.find((item) => item.shopify_product_id === "8479801114864").canonical_name = "Osavi Fenugreek 60 Capsules";
  assert.throws(() => validateConfig(wrongFenugreek), /Fenugreek identity/);

  const wrongColostrum = structuredClone(config);
  wrongColostrum.products.find((item) => item.shopify_product_id === "8333749092592").canonical_name = "Osavi Colostrum 1200mg Powder 100g";
  assert.throws(() => validateConfig(wrongColostrum), /Colostrum identity/);
});

test("adapter rejects every additional CLI argument before fetching or importing", async () => {
  let fetched = false;
  let imported = false;
  await assert.rejects(main({ argv: ["--dry-run"], fetchImpl: async () => { fetched = true; }, runImporter: () => { imported = true; } }), /does not accept CLI arguments/);
  assert.equal(fetched, false);
  assert.equal(imported, false);
});

test("atomic output replaces complete files, cleans temporary files, and checksum is deterministic", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fit-house-atomic-"));
  const target = path.join(directory, "output.csv");
  atomicWrite(target, "old");
  assert.throws(() => atomicWrite(target, Symbol("invalid")), TypeError);
  assert.equal(fs.readFileSync(target, "utf8"), "old");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
  atomicWrite(target, "complete");
  assert.equal(fs.readFileSync(target, "utf8"), "complete");
  assert.deepEqual(fs.readdirSync(directory), ["output.csv"]);
  assert.equal(sha256(build().csv), sha256(build().csv));
});
