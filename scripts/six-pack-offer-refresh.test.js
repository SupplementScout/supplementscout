const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
const { loadDryRunArtifact } = require("./import-products");
const { WooCommerceSourceError, readWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
const {
  isolateDefaultVariantConflicts,
  loadReviewedMassOosManifest,
  parseArgs,
  parseSixPackProductPage,
  run,
  shippingForPrice,
} = require("./six-pack-offer-refresh");

const ROOT = path.resolve(__dirname, "..");

const selectedHtml = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-product-4705.html"), "utf8");
const selectedUrl = "https://6pack-supplements.co.uk/product/7nutrition-bodybuilder-mass-gainer-7kg/";
const selectedOptions = { productId: "4705", canonicalUrl: selectedUrl };
function changeSelectedHtml(changePayload = () => {}, changeGraph = () => {}) {
  return selectedHtml.replace(/(<script type="application\/(json|ld\+json)"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (_, start, type, content, end) => {
      const data = JSON.parse(content);
      (type === "json" ? changePayload : changeGraph)(data);
      return start + JSON.stringify(data) + end;
    });
}

test("6 Pack retains explicitly selected 4708 omitted from dropdown options with exact JSON-LD corroboration", () => {
  const parsed = parseSixPackProductPage(selectedHtml, selectedOptions);
  assert.equal(parsed.external_product_id, "4705");
  assert.equal(parsed.variations.length, 6);
  assert.deepEqual(parsed.variations.map((r) => [r.external_variant_id, r.price, r.in_stock]), [
    ["4724", "59.99", false], ["4725", "59.99", false], ["4726", "59.99", false],
    ["4707", "59.99", false], ["4706", "59.99", false], ["4708", "59.99", true],
  ]);
  assert.equal(parsed.html_sha256, crypto.createHash("sha256").update(selectedHtml).digest("hex"));
});

test("6 Pack selected default requires unique complete selection and matching identity, price, currency and stock", () => {
  const invalid = [
    changeSelectedHtml((p) => { delete p.selected; }),
    changeSelectedHtml((p) => { p.selected = {}; }),
    changeSelectedHtml((p) => { p.selected.attribute_size = "7kg"; }),
    changeSelectedHtml((p) => { p.selected.attribute_flavours = "Unknown"; }),
    changeSelectedHtml((p) => { p.variations[0].attributes.attribute_flavours = "Unknown"; }),
    changeSelectedHtml((p) => { p.variations[0].attributes = p.variations[5].attributes; }),
    changeSelectedHtml((p) => { p.variations[5].id = 9999; }),
    changeSelectedHtml((p) => { p.variations.push({ id: 9999 }); }),
    changeSelectedHtml(() => {}, (g) => { g['@graph'][0].hasVariant.pop(); }),
    ...[
      (g) => { g.url = "https://other.example/product/"; },
      (g) => { g.hasVariant[5].isVariantOf['@id'] += "wrong"; },
      (g) => { g.hasVariant[5].url += "&attribute_size=7kg"; },
      (g) => { g.hasVariant[5].offers.url = selectedUrl; },
      (g) => { g.hasVariant[5].offers.price = "59.98"; },
      (g) => { g.hasVariant[5].offers.priceCurrency = "EUR"; },
      (g) => { g.hasVariant[5].offers.availability = "https://schema.org/OutOfStock"; },
      (g) => { g.hasVariant.push(structuredClone(g.hasVariant[5])); },
    ].map((change) => changeSelectedHtml(() => {}, (g) => change(g['@graph'][0]))),
  ];
  for (const html of invalid) assert.throws(() => parseSixPackProductPage(html, selectedOptions),
    (error) => error instanceof WooCommerceSourceError && ["SOURCE_SCHEMA_MISMATCH", "DUPLICATE_SOURCE_IDENTITY"].includes(error.code));
});

test("6 Pack bounded reader preserves parser schema, identity and duplicate error codes", async () => {
  for (const [html, code] of [
    [changeSelectedHtml((p) => { p.selected = {}; }), "SOURCE_SCHEMA_MISMATCH"],
    [selectedHtml.replace("postid-4705", "postid-9999"), "SOURCE_IDENTITY_DRIFT"],
    [changeSelectedHtml((p) => { p.variations.push(p.variations[0]); }), "DUPLICATE_SOURCE_IDENTITY"],
  ]) {
    await assert.rejects(readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: "4705",
      maximumAttempts: 1, parseProductPage: parseSixPackProductPage, fetchImpl: async () => ({ status: 200,
        url: selectedUrl, headers: { get: () => "text/html" }, text: async () => html }) }), { code });
  }
});

test("6 Pack theme product6303 retains all exact variations through the bounded page reader", async () => {
  const html = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-product-6303.html"), "utf8");
  let calls = 0;
  const parsed = await readWooCommerceProductPage({
    storeUrl: "https://6pack-supplements.co.uk",
    productId: "6303",
    capturedAt: "2026-11-07T16:03:19.681Z",
    maximumAttempts: 1,
    parseProductPage: parseSixPackProductPage,
    fetchImpl: async () => {
      calls += 1;
      return {
        status: 200,
        url: "https://6pack-supplements.co.uk/product/bcaa-amino-hydrate-450g-applied-nutrition/",
        headers: { get: (name) => name === "content-type" ? "text/html" : null },
        text: async () => html,
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(parsed.external_product_id, "6303");
  assert.equal(parsed.product_name, "BCAA Amino Hydrate 450g Applied Nutrition");
  assert.equal(parsed.product_offer, null);
  assert.deepEqual(parsed.variations.map((row) => [row.external_variant_id, row.price, row.in_stock]), [
    ["6305", "24.99", true], ["6306", "24.99", false], ["6307", "24.99", true],
    ["6308", "24.99", true], ["6309", "24.99", true],
  ]);
  assert.equal(parsed.html_sha256, crypto.createHash("sha256").update(html).digest("hex"));
  assert.equal(parsed.html_bytes, Buffer.byteLength(html));
});

test("6 Pack theme parsing rejects ambiguous, malformed and unbound source data", () => {
  const html = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-product-6303.html"), "utf8");
  const options = { productId: "6303", canonicalUrl: "https://6pack-supplements.co.uk/product/bcaa-amino-hydrate-450g-applied-nutrition/" };
  const block = html.match(/<script type="application\/json" id="product-variations">([\s\S]*?)<\/script>/);
  const mutate = (change) => {
    const payload = JSON.parse(block[1]);
    change(payload);
    return html.replace(block[0], () => block[0].replace(block[1], () => JSON.stringify(payload)));
  };
  const invalid = [
    html.replace(block[1], "{"),
    html.replace(block[0], () => block[0] + block[0]),
    html.replace('type="application/json" id="product-variations"', 'type="text/plain" id="product-variations"'),
    html.replace('x-data="buyBox', 'data-unused="buyBox'),
    html.replace("&quot;name&quot;:&quot;BCAA", "&quot;name&quot;:&quot;Different"),
    mutate((p) => { p.variations = []; }),
    mutate((p) => { p.variations[0].price = 0; }),
    mutate((p) => { p.variations[0].price = 0.001; }),
    mutate((p) => { p.variations[0].price = "24.99"; }),
    mutate((p) => { delete p.variations[0].in_stock; }),
    mutate((p) => { p.variations[0].in_stock = "false"; }),
    mutate((p) => { p.variations[0].max_qty = 0; }),
    mutate((p) => { p.variations[0].attributes.attribute_flavour = "Unknown"; }),
    mutate((p) => { p.variations[0].attributes.attribute_size = "450g"; }),
    mutate((p) => { p.attributes.push(p.attributes[0]); }),
    mutate((p) => { p.variations.push(p.variations[0]); }),
    mutate((p) => { p.variations[1].attributes = p.variations[0].attributes; }),
  ];
  for (const source of invalid) {
    assert.throws(() => parseSixPackProductPage(source, options),
      (error) => ["SOURCE_SCHEMA_MISMATCH", "SOURCE_IDENTITY_DRIFT", "DUPLICATE_SOURCE_IDENTITY"].includes(error.code));
  }
  for (const source of [html.replace("postid-6303", "postid-9999"),
    html.replace("&quot;productId&quot;:6303", "&quot;productId&quot;:9999")]) {
    assert.throws(() => parseSixPackProductPage(source, options), { code: "SOURCE_IDENTITY_DRIFT" });
  }
});

const incompleteHtml = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-incomplete-attributes.html"), "utf8");
const incompleteOptions = { productId: "2769", canonicalUrl: "https://6pack-supplements.co.uk/product/high-protein-crunch-protein-bars/" };

test("6 Pack blocks blank row attributes despite default selection and matching flavour-only JSON-LD", () => {
  const block = incompleteHtml.match(/<script type="application\/json" id="product-variations">([\s\S]*?)<\/script>/);
  const payload = JSON.parse(block[1]);
  assert.equal(payload.variations.length, 7);
  assert.deepEqual(payload.attributes[1].options.map((option) => option.value), ["1pcs", "12pcs"]);
  assert.equal(payload.selected.attribute_size, "1pcs");
  assert.ok(payload.variations.every((row) => row.attributes.attribute_size === ""));
  // A page default, one dropdown option or an absent key cannot prove a row's size.
  for (const change of [() => {},
    (p) => { p.attributes[1].options = [p.attributes[1].options[0]]; },
    (p) => { delete p.variations[0].attributes.attribute_size; },
    (p) => { p.variations[0].attributes.attribute_size = null; },
    (p) => { p.variations[0].attributes.attribute_size = " "; },
  ]) {
    const modified = structuredClone(payload);
    change(modified);
    const html = incompleteHtml.replace(block[1], () => JSON.stringify(modified));
    assert.throws(() => parseSixPackProductPage(html, incompleteOptions),
      (error) => error instanceof WooCommerceSourceError && error.code === "SOURCE_SCHEMA_MISMATCH"
        && error.message === "6 Pack variation attribute keys are incomplete");
  }
});

test("6 Pack keeps legacy WooCommerce variations and other readers keep their default parser", () => {
  const row = { variation_id: 21, attributes: { attribute_flavour: "Cherry" }, display_price: 18.5,
    display_regular_price: 20, is_in_stock: true, is_purchasable: true, variation_is_active: true };
  const html = `<body class="postid-20"><h1 class="product_title">Legacy Product</h1><form data-product_variations='${JSON.stringify([row])}'>`;
  const legacy = parseSixPackProductPage(html, { productId: "20" });
  assert.equal(legacy.product_name, "Legacy Product");
  assert.equal(legacy.variations[0].external_variant_id, "21");
  assert.equal(legacy.variations[0].price, "18.50");
  const { parseWooCommerceProductPage } = require("./lib/woocommerce-product-page-reader");
  const theme = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-product-6303.html"), "utf8");
  assert.throws(() => parseWooCommerceProductPage(theme, { productId: "6303",
    canonicalUrl: "https://6pack-supplements.co.uk/product/bcaa-amino-hydrate-450g-applied-nutrition/" }),
  /Expected one matching Product JSON-LD block, found 5/);
});

test("owner-approved offer 2006 is bound to the existing exact 60 Servings variant", () => {
  const row = manifest.rows.find((entry) => String(entry.offer_id) === "2006");
  assert.equal(row.mapping_id, "2192");
  assert.equal(row.canonical_product_id, "982");
  assert.equal(row.canonical_variant_id, "3126");
});

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

function reviewedMassOosFixture() {
  const source = fixture();
  const productId = "3980";
  const url = "https://6pack-supplements.co.uk/product/whey-isolate-90-1000g-7nutrition/";
  const live = source.byProduct.get(productId);
  live.canonical_url = url;
  const flavours = new Map([
    ["3991", { attribute_flavours: "Chocolate" }],
    ["3995", { attribute_flavours: "Banana" }],
  ]);
  for (const record of source.state.records.filter((row) => row.mapping.external_product_id === productId)) {
    record.mapping.external_url = url;
    record.offer.url = url;
    const variation = live.variations.find(
      (candidate) => candidate.external_variant_id === record.mapping.external_variant_id
    );
    if (!flavours.has(record.mapping.external_variant_id)) continue;
    record.offer.price = "41.99";
    record.offer.shipping_cost = "4.99";
    record.offer.total_price = "46.98";
    record.variant.display_name = record.mapping.external_variant_id === "3991"
      ? "Belgian Chocolate / 1000g"
      : "Banana / 1000g";
    variation.attributes = flavours.get(record.mapping.external_variant_id);
    variation.price = "41.99";
    variation.in_stock = false;
    variation.active = true;
    variation.purchasable = true;
    variation.sku = "5903111089986";
  }
  return source;
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

test("systemic source failure blocks the whole run even when row isolation is enabled", async () => {
  for (const errorCode of ["SOURCE_UNAVAILABLE", "SOURCE_SCHEMA_MISMATCH", "SOURCE_IDENTITY_DRIFT", "DUPLICATE_SOURCE_IDENTITY"]) {
    const source = fixture();
    const output = paths();
    const failure = new WooCommerceSourceError(
      errorCode,
      "safe source failure",
      {
        error_type: "TypeError",
        network_code: "ENOTFOUND",
        timeout: false,
        last_attempt: 5,
        request_url: "https://6pack-supplements.co.uk/?p=4110",
        product_id: "4110",
        http_status: null,
      }
    );
    await assert.rejects(
      run(
        { target: "production", artifact: output.artifact, report: output.report, requireNoChange: false, isolateUnsafe: true },
        { state: source.state, readLive: async () => { throw failure; } }
      ),
      (error) => error === failure
    );
    const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.classification_state, "SOURCE_READ_FAILED");
    assert.equal(report.block_reason, errorCode);
    assert.equal(report.approved_mapping_count, manifest.rows.length);
    assert.equal(report.executable_plan_count, 0);
    assert.equal(report.executed_plan_count, 0);
    assert.equal(report.review_row_count, 0);
    assert.equal(report.blocked_row_count, manifest.rows.length);
    assert.equal(report.fetched_product_page_count, 0);
    assert.equal(report.database_writes, 0);
    assert.deepEqual(report.action_counts, {});
    assert.deepEqual(report.source_error, { error_code: errorCode, ...failure.detail });
    assert.equal(fs.existsSync(output.artifact), false);
  }
});

test("real incomplete-attribute source blocks downstream before plans or apply artifacts", async () => {
  const source = fixture();
  const output = paths();
  let requests = 0;
  await assert.rejects(run(
    { target: "production", artifact: output.artifact, report: output.report, requireNoChange: false, isolateUnsafe: true },
    { state: source.state, readLive: async (id) => {
      if (String(id) !== incompleteOptions.productId) return source.byProduct.get(String(id));
      return readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: id,
        maximumAttempts: 1, parseProductPage: parseSixPackProductPage,
        fetchImpl: async () => { requests += 1; return { status: 200, url: incompleteOptions.canonicalUrl,
          headers: { get: () => "text/html" }, text: async () => incompleteHtml }; } });
    } }), { code: "SOURCE_SCHEMA_MISMATCH" });
  assert.equal(requests, 1);
  const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
  assert.equal(report.result, "BLOCK");
  assert.equal(report.classification_state, "SOURCE_READ_FAILED");
  assert.equal(report.block_reason, "SOURCE_SCHEMA_MISMATCH");
  assert.equal(report.approved_mapping_count, manifest.rows.length);
  assert.equal(report.blocked_row_count, manifest.rows.length);
  assert.equal(report.executable_plan_count, 0);
  assert.equal(report.executed_plan_count, 0);
  assert.equal(report.review_row_count, 0);
  assert.equal(report.database_writes, 0);
  assert.deepEqual(report.action_counts, {});
  assert.equal(fs.existsSync(output.artifact), false);
});

test("exact product 4150 terminal 404 isolates only offer 2379 without inferring stock", async () => {
  const source = fixture();
  const output = paths();
  const failure = new WooCommerceSourceError(
    "SOURCE_HTTP_ERROR",
    "WooCommerce product 4150 returned HTTP 404 after bounded retries",
    {
      error_type: "WooCommerceSourceError",
      network_code: null,
      timeout: false,
      last_attempt: 5,
      request_url: "https://6pack-supplements.co.uk/?p=4150",
      product_id: "4150",
      http_status: 404,
    }
  );
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: false,
      isolateUnsafe: true,
    },
    {
      state: source.state,
      readLive: async (id) => {
        if (String(id) === "4150") throw failure;
        return source.byProduct.get(String(id));
      },
    }
  );
  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.equal(result.report.approved_mapping_count, 506);
  assert.equal(result.report.executable_plan_count, 505);
  assert.equal(result.report.review_row_count, 1);
  assert.equal(result.report.blocked_row_count, 0);
  assert.equal(result.report.fetched_product_page_count, 278);
  assert.equal(result.report.attempted_product_page_count, 279);
  assert.equal(result.report.source_failure_count, 1);
  assert.deepEqual(result.report.review_rows.map((row) => ({
    offer_id: row.offer_id,
    reason: row.reason,
    proposed_offer: row.proposed_offer,
    disposition: row.source_failure?.disposition,
  })), [{
    offer_id: "2379",
    reason: "SOURCE_VARIANT_MISSING",
    proposed_offer: null,
    disposition: "SOURCE_PRODUCT_NOT_FOUND",
  }]);
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.equal(artifact.plans.length, 505);
  assert.equal(artifact.plans.some((entry) => String(entry.resolved_plan.offer.id) === "2379"), false);
});

test("a series of product-scoped 404s still trips the full-source collapse gate", async () => {
  const source = fixture();
  const output = paths();
  const failedProductIds = new Set([...source.byProduct.keys()].slice(0, 29));
  await assert.rejects(
    run(
      {
        target: "production",
        artifact: output.artifact,
        report: output.report,
        requireNoChange: false,
        isolateUnsafe: true,
      },
      {
        state: source.state,
        readLive: async (id) => {
          if (!failedProductIds.has(String(id))) return source.byProduct.get(String(id));
          throw new WooCommerceSourceError("SOURCE_HTTP_ERROR", "terminal product 404", {
            error_type: "WooCommerceSourceError",
            network_code: null,
            timeout: false,
            last_attempt: 5,
            request_url: `https://6pack-supplements.co.uk/?p=${id}`,
            product_id: String(id),
            http_status: 404,
          });
        },
      }
    ),
    (error) => error.code === "SOURCE_COLLAPSE"
  );
  const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
  assert.equal(report.result, "BLOCK");
  assert.equal(report.classification_state, "BLOCKED");
  assert.equal(report.block_reason, "SOURCE_COLLAPSE");
  assert.equal(report.source_failure_count, 29);
  assert.equal(report.executable_plan_count, 0);
  assert.equal(report.blocked_row_count, 506);
  assert.equal(fs.existsSync(output.artifact), false);
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
  const priceArtifact = loadDryRunArtifact(oneOutput.artifact).artifact;
  const pricePlan = priceArtifact.plans.find((entry) => entry.operation_type === "standard_import");
  assert.equal(pricePlan.resolved_plan.offer.action, "update");
  assert.equal(pricePlan.resolved_plan.price_history.action, "create");
  assert.equal(pricePlan.resolved_plan.retailer_product.action, "noop");

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

  const isolatedOutput = paths();
  const isolated = await run(
    {
      target: "production",
      artifact: isolatedOutput.artifact,
      report: isolatedOutput.report,
      requireNoChange: false,
      isolateUnsafe: true,
    },
    { state: mass.state, readLive: async (id) => mass.byProduct.get(String(id)) }
  );
  assert.equal(isolated.report.result, "PASS_WITH_REVIEW");
  assert.equal(isolated.report.review_rows.length, massChanges.size);
  assert.equal(isolated.report.review_rows.every((row) => /^MASS_(CHANGE|PRICE)$/.test(row.reason)), true);
  assert.equal(
    loadDryRunArtifact(isolatedOutput.artifact).artifact.plans.length,
    manifest.rows.length - massChanges.size
  );
});

test("one hard price anomaly is isolated without blocking ordinary rows", async () => {
  const source = fixture(new Map([["4110", 999.99]]));
  const output = paths();
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: false,
      isolateUnsafe: true,
    },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.deepEqual(result.report.review_rows.map((row) => row.reason), ["HARD_PRICE_ANOMALY"]);
  assert.equal(loadDryRunArtifact(output.artifact).artifact.plans.length, manifest.rows.length - 1);
});

test("preflight isolates a changed default variant when an active sibling exists", async () => {
  const source = fixture();
  const record = source.state.records.find((row) => row.variant.is_default === true);
  record.active_variants = [
    record.variant,
    {
      ...record.variant,
      id: Number(record.variant.id) + 100000,
      variant_key: "30-servings",
      display_name: "30 Servings",
      is_default: false,
      is_active: true,
    },
  ];
  source.byProduct.get(String(record.mapping.external_product_id)).product_offer.price =
    (Number(record.offer.price) + 0.25).toFixed(2);
  const output = paths();
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: false,
      isolateUnsafe: true,
    },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.equal(result.report.executable_plan_count, manifest.rows.length - 1);
  assert.deepEqual(
    result.report.review_rows.map((row) => ({ offer_id: row.offer_id, reason: row.reason, original_action: row.original_action })),
    [{ offer_id: String(record.offer.id), reason: "DEFAULT_VARIANT_CONFLICT", original_action: "UPDATE_PRICE" }]
  );
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.equal(artifact.plans.some((entry) => String(entry.resolved_plan.offer.id) === String(record.offer.id)), false);
});

test("default variant conflicts fail closed when isolation is not authorized", () => {
  const record = {
    offer: { id: 10 },
    variant: { id: 20, is_default: true, is_active: true },
    active_variants: [
      { id: 20, is_default: true, is_active: true },
      { id: 21, is_default: false, is_active: true },
    ],
  };
  const classification = {
    state: "DRY_RUN_READY",
    rows: [{ offer_id: "10", action: "UPDATE_STOCK", changed_fields: { in_stock: true } }],
    quarantined_rows: [],
  };
  assert.throws(
    () => isolateDefaultVariantConflicts(classification, [record], {}, {}, false),
    (error) => error.code === "DEFAULT_VARIANT_CONFLICT"
  );
});

test("safe price, stock, and combined updates use the existing protected plans", async () => {
  const source = fixture();
  const [priceBinding, stockBinding, combinedBinding] = manifest.rows.slice(0, 3);
  const liveOffer = (binding) => {
    const live = source.byProduct.get(binding.external_product_id);
    return binding.external_product_id === binding.external_variant_id
      ? live.product_offer
      : live.variations.find((row) => row.external_variant_id === binding.external_variant_id);
  };
  liveOffer(priceBinding).price = "11.25";
  source.state.records.find((record) => String(record.offer.id) === stockBinding.offer_id).offer.in_stock = false;
  source.state.records.find((record) => String(record.offer.id) === combinedBinding.offer_id).offer.in_stock = false;
  liveOffer(combinedBinding).price = "13.25";

  const output = paths();
  const result = await run(
    { target: "production", artifact: output.artifact, report: output.report, requireNoChange: false },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  const updates = artifact.plans.filter((entry) => entry.operation_type === "standard_import");

  assert.equal(result.report.result, "PASS");
  assert.equal(result.report.executable_plan_count, 506);
  assert.equal(result.report.review_row_count, 0);
  assert.equal(result.report.action_counts.UPDATE_PRICE, 1);
  assert.equal(result.report.action_counts.UPDATE_STOCK, 1);
  assert.equal(result.report.action_counts.UPDATE_PRICE_AND_STOCK, 1);
  assert.equal(updates.length, 3);
  assert.deepEqual(
    updates.map((entry) => entry.resolved_plan.price_history.action).sort(),
    ["create", "create", "noop"]
  );
  assert.equal(updates.every((entry) => entry.resolved_plan.offer.action === "update"), true);
});

test("mixed 492/8/1/5 review partition preserves every safe freshness confirmation", async () => {
  const source = fixture();
  const priceOnly = manifest.rows.slice(0, 8);
  const stockOnly = manifest.rows.slice(8, 9);
  const priceAndStock = manifest.rows.slice(9, 14);
  const setLive = (binding, change) => {
    const live = source.byProduct.get(binding.external_product_id);
    const offer = binding.external_product_id === binding.external_variant_id
      ? live.product_offer
      : live.variations.find((row) => row.external_variant_id === binding.external_variant_id);
    Object.assign(offer, change);
  };
  for (const binding of priceOnly) setLive(binding, { price: "11.25" });
  for (const binding of stockOnly) setLive(binding, { in_stock: false });
  for (const binding of priceAndStock) setLive(binding, { price: "12.50", in_stock: false });

  const output = paths();
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: false,
      isolateUnsafe: true,
    },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  const artifact = loadDryRunArtifact(output.artifact).artifact;

  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.equal(result.report.approved_mapping_count, 506);
  assert.equal(result.report.executable_plan_count, 492);
  assert.equal(result.report.executed_plan_count, 0);
  assert.equal(result.report.review_row_count, 14);
  assert.equal(result.report.blocked_row_count, 0);
  assert.deepEqual(result.report.action_counts, { VERIFY_NO_CHANGE: 492 });
  assert.deepEqual(result.report.full_scope_guard_evidence.action_counts, {
    VERIFY_NO_CHANGE: 492,
    UPDATE_PRICE: 8,
    UPDATE_STOCK: 1,
    UPDATE_PRICE_AND_STOCK: 5,
    UPDATE_URL: 0,
    UPDATE_PRICE_STOCK_URL: 0,
  });
  assert.equal(result.report.guard_evidence.guards.every((guard) => guard.result === "PASS"), true);
  assert.equal(artifact.plans.length, 492);
  assert.equal(artifact.plans.every((entry) => entry.operation_type === "verify_offer_no_change"), true);
  const reviewOfferIds = new Set(result.report.review_rows.map((row) => row.offer_id));
  assert.equal(reviewOfferIds.size, 14);
  assert.equal(artifact.plans.some((entry) => reviewOfferIds.has(String(entry.resolved_plan.offer.id))), false);
});

test("exact reviewed MASS_OOS selector permits only the two sealed stock transitions", async () => {
  const source = reviewedMassOosFixture();
  await assert.rejects(
    run(
      { target: "production", ...paths(), requireNoChange: false, reviewedMassOosSelector: null },
      { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
    ),
    /Classifier blocked: MASS_OOS/
  );
  const output = paths();
  const result = await run(
    {
      target: "production",
      artifact: output.artifact,
      report: output.report,
      requireNoChange: false,
      reviewedMassOosSelector: "2026-08-11-whey-isolate-stock",
    },
    { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
  );
  assert.equal(result.report.result, "PASS");
  assert.deepEqual(result.report.action_counts, {
    VERIFY_NO_CHANGE: manifest.rows.length - 2,
    UPDATE_STOCK: 2,
  });
  assert.equal(result.report.reviewed_mass_oos.row_count, 2);
  assert.match(
    loadDryRunArtifact(output.artifact).artifact.run_id,
    /^six-pack-reviewed-mass-oos-[0-9a-f]{64}-\d+$/
  );
});

test("reviewed MASS_OOS fails closed on semantic source drift", async () => {
  const source = reviewedMassOosFixture();
  source.byProduct.get("3980").variations.find((row) => row.external_variant_id === "3995").sku = "changed";
  await assert.rejects(
    run(
      {
        target: "production",
        ...paths(),
        requireNoChange: false,
        reviewedMassOosSelector: "2026-08-11-whey-isolate-stock",
      },
      { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
    ),
    /live semantic source drift/
  );
});

test("reviewed MASS_OOS replay fails closed after the two stock transitions are already applied", async () => {
  const source = reviewedMassOosFixture();
  for (const record of source.state.records.filter((row) => ["3991", "3995"].includes(row.mapping.external_variant_id))) {
    record.offer.in_stock = false;
  }
  await assert.rejects(
    run(
      {
        target: "production",
        ...paths(),
        requireNoChange: false,
        reviewedMassOosSelector: "2026-08-11-whey-isolate-stock",
      },
      { state: source.state, readLive: async (id) => source.byProduct.get(String(id)) }
    ),
    /selector is not applicable/
  );
});

test("reviewed MASS_OOS manifest is SHA-bound to the approved 2-row scope", () => {
  const reviewed = loadReviewedMassOosManifest(
    "2026-08-11-whey-isolate-stock",
    manifest
  );
  assert.equal(reviewed.manifest.row_count, 2);
  assert.deepEqual(reviewed.manifest.rows.map((row) => row.offer_id), ["2029", "2422"]);
  assert.equal(reviewed.sha256, require("../config/retailers/six-pack-supplements-woocommerce.json").automation.reviewed_mass_oos_manifest_sha256);
});

test("CLI is production-only and confines artifacts to tmp", () => {
  assert.throws(() => parseArgs([]), /target=production/);
  assert.throws(
    () => parseArgs(["--target=production", "--artifact=outside.json", "--report=tmp/report.json"]),
    /inside repository tmp/
  );
  assert.throws(
    () => parseArgs([
      "--target=production",
      "--artifact=tmp/a.json",
      "--report=tmp/b.json",
      "--reviewed-mass-oos=unknown",
    ]),
    /Unknown reviewed MASS_OOS selector/
  );
  assert.equal(parseArgs([
    "--target=production",
    "--artifact=tmp/a.json",
    "--report=tmp/b.json",
    "--isolate-unsafe=true",
  ]).isolateUnsafe, true);
  assert.throws(
    () => parseArgs([
      "--target=production",
      "--artifact=tmp/a.json",
      "--report=tmp/b.json",
      "--isolate-unsafe=yes",
    ]),
    /isolate-unsafe must be true\|false/
  );
});

test("confirmed delivery is £4.99 below £99.99 and free at the threshold", () => {
  assert.equal(shippingForPrice("99.98"), "4.99");
  assert.equal(shippingForPrice("99.99"), "0.00");
  assert.equal(shippingForPrice("120.00"), "0.00");
});
