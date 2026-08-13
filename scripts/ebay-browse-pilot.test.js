const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DEFAULT_POLICY, assertConfig, browseIdentity, buildReport, evaluateIdentity, evaluateItem, getApplicationToken, resetTokenCache } = require("./lib/ebay-browse-pilot");
const { currentOfferEvidence, parseArgs, sealInput } = require("./ebay-browse-pilot");

const identity = {
  product_id: "11", variant_id: "1002", brand: "USN", product_name: "USN Blue Lab Whey 2kg",
  variant: "Caramel Chocolate / 2kg", flavour_label: "Caramel Chocolate", size_value: 2, size_unit: "kg",
  pack_count: 1, unit_count: null, unit_type: null, net_weight_g: 2000, product_format: "powder",
  gtin: "6009544910770", category: "Whey Protein", current_retailer_count: 1, current_best_delivered_price: 35,
};

function item(overrides = {}) {
  return {
    itemId: "v1|123|0", legacyItemId: "123", title: "USN Blue Lab Whey Caramel Chocolate 2kg Powder",
    listingMarketplaceId: "EBAY_GB", condition: "New", conditionId: "1000", buyingOptions: ["FIXED_PRICE"],
    gtin: identity.gtin, brand: "USN", price: { value: "29.00", currency: "GBP" },
    shippingOptions: [{ shippingCost: { value: "3.00", currency: "GBP" } }],
    seller: { username: "trusted-seller", sellerAccountType: "BUSINESS", feedbackPercentage: "99.8", feedbackScore: 5000 },
    localizedAspects: [{ name: "Flavour", value: "Caramel Chocolate" }, { name: "Size", value: "2 kg" }, { name: "Formulation", value: "Powder" }],
    itemWebUrl: "https://www.ebay.co.uk/itm/123", itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/123?campid=redacted",
    ...overrides,
  };
}

test("an exact new fixed-price GB listing with complete shipping is AUTO_ELIGIBLE", () => {
  const result = evaluateItem(identity, item());
  assert.equal(result.decision, "AUTO_ELIGIBLE");
  assert.deepEqual(result.delivered_price, { value: 32, currency: "GBP" });
  assert.equal(result.match_tier, "A");
  assert.equal(result.affiliate_ready, false);
  assert.equal(evaluateItem(identity, item(), { ...DEFAULT_POLICY, affiliate_campaign_configured: true }).affiliate_ready, true);
});

test("hard listing and identity conflicts are rejected", () => {
  const fixtures = [
    [item({ buyingOptions: ["AUCTION"] }), "NOT_FIXED_PRICE"],
    [item({ condition: "Used", conditionId: "3000" }), "CONDITION_NOT_NEW"],
    [item({ gtin: "6009544910718" }), "GTIN_MISMATCH"],
    [item({ brand: "Other", localizedAspects: item().localizedAspects }), "BRAND_MISMATCH"],
    [item({ title: "USN sample sachet", localizedAspects: [] }), "TITLE_HARD_BLOCKER"],
    [item({ localizedAspects: [{ name: "Flavour", value: "Vanilla" }, { name: "Size", value: "2 kg" }, { name: "Formulation", value: "Powder" }] }), "FLAVOUR_MISMATCH"],
    [item({ localizedAspects: [{ name: "Flavour", value: "Caramel Chocolate" }, { name: "Size", value: "500 g" }, { name: "Formulation", value: "Powder" }] }), "SIZE_MISMATCH"],
  ];
  for (const [fixture, code] of fixtures) {
    const result = evaluateItem(identity, fixture);
    assert.equal(result.decision, "REJECT", code);
    assert.ok(result.blockers.includes(code), code);
  }
});

test("unknown shipping and proposed seller threshold fail closed to REVIEW", () => {
  const unknownShipping = evaluateItem(identity, item({ shippingOptions: [] }));
  assert.equal(unknownShipping.decision, "REVIEW");
  assert.equal(unknownShipping.delivered_price, null);
  assert.ok(unknownShipping.review_reasons.includes("UK_SHIPPING_UNKNOWN"));
  const lowSeller = evaluateItem(identity, item({ seller: { username: "new", feedbackPercentage: 97, feedbackScore: 10 } }));
  assert.equal(lowSeller.decision, "REVIEW");
  assert.ok(lowSeller.review_reasons.includes("SELLER_FEEDBACK_BELOW_PROPOSED_THRESHOLD"));
  assert.ok(lowSeller.review_reasons.includes("SELLER_SCORE_BELOW_PROPOSED_THRESHOLD"));
  assert.equal(lowSeller.match_tier, "B");
});

test("unit-count mismatch and bundles are rejected", () => {
  const counted = { ...identity, unit_count: 120, unit_type: "capsule", size_value: null, size_unit: null };
  const mismatch = evaluateItem(counted, item({ title: "USN capsules 60 capsules", localizedAspects: [{ name: "Count", value: "60" }] }));
  assert.equal(mismatch.decision, "REJECT");
  assert.ok(mismatch.blockers.includes("UNIT_COUNT_MISMATCH"));
  const bundle = evaluateItem(identity, item({ title: "USN Blue Lab Whey Caramel Chocolate 2kg bundle" }));
  assert.equal(bundle.decision, "REJECT");
  assert.ok(bundle.blockers.includes("TITLE_HARD_BLOCKER"));
});

test("identity selection prioritizes qualification over a cheaper rejected listing and selects one", () => {
  const result = evaluateIdentity(identity, [item(), item({ itemId: "cheap", gtin: "6009544910718", price: { value: "1", currency: "GBP" } })]);
  assert.equal(result.selected_offer.item_id, "v1|123|0");
  assert.equal(result.decision, "AUTO_ELIGIBLE");
  assert.equal(result.ebay_would_be_second_retailer, true);
  assert.equal(result.ebay_is_lower_delivered_price, true);
  assert.equal(result.rejected_candidates.length, 1);
  assert.equal(result.candidate_evidence.length, 2);
});

test("ePID is not mistaken for a returned GTIN and marketplace ID is mandatory", () => {
  const noGtin = evaluateItem(identity, item({ gtin: undefined, epid: identity.gtin }));
  assert.equal(noGtin.decision, "REVIEW");
  assert.equal(noGtin.returned_gtin, null);
  const noMarketplace = evaluateItem(identity, item({ listingMarketplaceId: undefined, itemLocation: { country: "GB" } }));
  assert.equal(noMarketplace.decision, "REJECT");
  assert.ok(noMarketplace.blockers.includes("MARKETPLACE_MISMATCH"));
});

test("not found is explicit and report preserves zero-write KPI", () => {
  const missing = evaluateIdentity(identity, []);
  assert.equal(missing.decision, "NOT_FOUND");
  const input = { artifact_fingerprint: "input", rows: [identity] };
  const report = buildReport(input, [missing], DEFAULT_POLICY, { captured_at: "2026-08-13T12:00:00.000Z" });
  assert.equal(report.summary.NOT_FOUND, 1);
  assert.equal(report.summary.database_writes, 0);
  assert.match(report.artifact_fingerprint, /^[a-f0-9]{64}$/);
});

test("input fingerprint is stable across capture time and preview refresh", () => {
  const first = sealInput([identity], "2026-08-13T12:00:00.000Z", "preview-one");
  const second = sealInput([identity], "2026-08-14T12:00:00.000Z", "preview-two");
  assert.equal(first.artifact_fingerprint, second.artifact_fingerprint);
  assert.notEqual(first.captured_at, second.captured_at);
  assert.notEqual(first.source_preview_fingerprint, second.source_preview_fingerprint);
  assert.notEqual(sealInput([{ ...identity, gtin: "6009544910718" }], first.captured_at, "preview-one").artifact_fingerprint, first.artifact_fingerprint);
});

test("current retailer evidence never treats unknown shipping as free", () => {
  const mappings = [{ id: "1", product_id: "11", product_variant_id: "1002" }, { id: "2", product_id: "11", product_variant_id: "1002" }];
  const evidence = currentOfferEvidence(identity, mappings, [
    { retailer_product_id: "1", retailer_id: "1", price: 10, shipping_cost: null, in_stock: true },
    { retailer_product_id: "2", retailer_id: "2", price: 12, shipping_cost: 2, in_stock: true },
  ]);
  assert.deepEqual(evidence, { current_retailer_count: 2, current_best_delivered_price: 14 });
});

test("product-level GTIN identity includes its product-level mapping without broadening variant identity", () => {
  const productIdentity = { ...identity, destination_field: "products.gtin" };
  const evidence = currentOfferEvidence(productIdentity, [{ id: "1", product_id: "11", product_variant_id: null }], [
    { retailer_product_id: "1", retailer_id: "1", price: 10, shipping_cost: 0, in_stock: true },
  ]);
  assert.deepEqual(evidence, { current_retailer_count: 1, current_best_delivered_price: 10 });
});

test("configuration is explicit and fixed to EBAY_GB", () => {
  assert.throws(() => assertConfig({}), /EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_UK_DELIVERY_POSTCODE/);
  assert.throws(() => assertConfig({ EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secret", EBAY_UK_DELIVERY_POSTCODE: "SW1A1AA", EBAY_MARKETPLACE_ID: "EBAY_US" }), /must be EBAY_GB/);
  const config = assertConfig({ EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secret", EBAY_UK_DELIVERY_POSTCODE: "SW1A 1AA" });
  assert.equal(config.marketplace_id, "EBAY_GB");
  assert.equal(config.campaign_id, null);
});

test("OAuth uses client credentials, caches only in memory and redacts failures", async () => {
  resetTokenCache();
  let calls = 0;
  const mockFetch = async (_url, options) => {
    calls += 1;
    assert.match(options.headers.Authorization, /^Basic /);
    assert.equal(String(options.body), "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope");
    return { ok: true, json: async () => ({ access_token: "private-token", expires_in: 7200 }) };
  };
  const config = { client_id: "client", client_secret: "secret" };
  assert.equal(await getApplicationToken(config, mockFetch, 0), "private-token");
  assert.equal(await getApplicationToken(config, mockFetch, 1), "private-token");
  assert.equal(calls, 1);
  resetTokenCache();
  await assert.rejects(() => getApplicationToken(config, async () => ({ ok: false, status: 401 }), 0), (error) => {
    assert.doesNotMatch(error.message, /secret|private-token/);
    return true;
  });
});

test("mock Browse request has exact read-only filters, follows safe detail URL and no write method", async () => {
  resetTokenCache();
  const requests = [];
  const mockFetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 7200 }) };
    if (String(url).includes("item_summary/search")) return { ok: true, json: async () => ({ itemSummaries: [{ itemHref: "https://api.ebay.com/buy/browse/v1/item/v1%7C123%7C0" }] }) };
    return { ok: true, json: async () => item() };
  };
  const rows = await browseIdentity(identity, { client_id: "id", client_secret: "secret", marketplace_id: "EBAY_GB", postcode: "SW1A 1AA", campaign_id: null }, mockFetch);
  assert.equal(rows.length, 1);
  const search = requests.find((request) => request.url.includes("item_summary/search"));
  assert.match(search.url, /gtin=6009544910770/);
  assert.match(decodeURIComponent(search.url), /buyingOptions:\{FIXED_PRICE\},conditions:\{NEW\},deliveryCountry:GB/);
  assert.equal(search.options.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_GB");
  assert.match(search.options.headers["X-EBAY-C-ENDUSERCTX"], /contextualLocation=/);
  assert.ok(requests.slice(1).every((request) => !request.options.method || request.options.method === "GET"));
});

test("runner and library contain no production mutation or public publication path", () => {
  const source = ["scripts/ebay-browse-pilot.js", "scripts/lib/ebay-browse-pilot.js"].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(/);
  assert.doesNotMatch(source, /offers\).*insert|retailer_products\).*insert/);
  assert.deepEqual(parseArgs(["--prepare-input"]).prepareInput, true);
  assert.throws(() => parseArgs(["--apply"]), /Unsupported argument/);
});
