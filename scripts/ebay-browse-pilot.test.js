const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DEFAULT_POLICY, assertConfig, browseIdentity, buildReport, evaluateIdentity, evaluateItem, getApplicationToken, resetTokenCache, sellerMatchesCurrentSource } = require("./lib/ebay-browse-pilot");
const { buildDiscoveryRows, buildTitleLeadInput, currentOfferEvidence, parseArgs, parseQuarantinedGtins, sealInput } = require("./ebay-browse-pilot");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { CONFIRMATION: REFRESH_CONFIRMATION, SCOPE: REFRESH_SCOPE, assertExecutionContext, buildSource: buildRefreshSource, parseArgs: parseRefreshArgs, rowFromEvaluation, validatePlan: validateRefreshPlan } = require("./ebay-offer-refresh");

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

test("an eBay seller matching the current retailer is not independent coverage", () => {
  const sameRetailer = { ...identity, source_locations: ["https://www.simplysupplements.co.uk/products/example"] };
  const result = evaluateItem(sameRetailer, item({ seller: { username: "simplyssupplements", feedbackPercentage: 99.8, feedbackScore: 50000 } }));
  assert.equal(result.decision, "REJECT");
  assert.ok(result.blockers.includes("SELLER_NOT_INDEPENDENT"));
  assert.equal(sellerMatchesCurrentSource(sameRetailer, "unrelated-seller"), false);
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

test("scaled discovery caps exact-GTIN result and detail reads", async () => {
  resetTokenCache();
  const requests = [];
  const mockFetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 7200 }) };
    if (String(url).includes("item_summary/search")) return { ok: true, json: async () => ({ itemSummaries: Array.from({ length: 5 }, (_, index) => ({ itemHref: `https://api.ebay.com/buy/browse/v1/item/${index}` })) }) };
    return { ok: true, json: async () => item() };
  };
  const rows = await browseIdentity(identity, { client_id: "id", client_secret: "secret", marketplace_id: "EBAY_GB", postcode: "SW1A 1AA", campaign_id: null }, mockFetch, { limit: 5, maxDetails: 2 });
  assert.equal(rows.length, 2);
  assert.match(requests.find((url) => url.includes("item_summary/search")), /limit=5/);
  assert.equal(requests.filter((url) => url.includes("\/buy\/browse\/v1\/item\/") && !url.includes("item_summary")).length, 2);
});

test("title-lead search remains GET-only and does not pretend to be exact-GTIN search", async () => {
  resetTokenCache();
  const requests = [];
  const mockFetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 7200 }) };
    return { ok: true, json: async () => ({ itemSummaries: [] }) };
  };
  await browseIdentity(identity, { client_id: "id", client_secret: "secret", marketplace_id: "EBAY_GB", postcode: "SW1A 1AA", campaign_id: null }, mockFetch, { limit: 5, maxDetails: 5, searchMode: "title" });
  const search = requests.find((url) => url.includes("item_summary/search"));
  assert.match(search, /[?&]q=/);
  assert.doesNotMatch(search, /[?&]gtin=/);
});

test("eBay refresh is frozen to the exact approved existing offer", () => {
  assert.deepEqual(parseRefreshArgs(["--target=production", "--mode=dry-run"]), { target: "production", mode: "dry-run" });
  assert.throws(() => parseRefreshArgs(["--target=staging", "--mode=apply"]), /production/);
  assert.throws(() => assertExecutionContext("apply", { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", EBAY_REFRESH_OWNER_CONFIRMATION: "wrong" }), /exact owner confirmation/);
  assert.doesNotThrow(() => assertExecutionContext("apply", { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", EBAY_REFRESH_OWNER_CONFIRMATION: REFRESH_CONFIRMATION }));
  assert.equal(REFRESH_SCOPE.offer_id, "2558");
  assert.equal(REFRESH_SCOPE.retailer_product_id, "2743");
  assert.equal(REFRESH_SCOPE.external_variant_id, "v1|204137434720|0");
});

test("eBay refresh converts only a fully qualified exact listing into importer input", () => {
  const evaluation = evaluateItem({ ...identity, product_id: REFRESH_SCOPE.product_id, variant_id: REFRESH_SCOPE.product_variant_id, gtin: REFRESH_SCOPE.gtin, brand: REFRESH_SCOPE.brand, product_name: REFRESH_SCOPE.product_name, flavour_label: REFRESH_SCOPE.flavour_label, size_value: 400, size_unit: "g" }, item({
    itemId: REFRESH_SCOPE.external_variant_id, legacyItemId: REFRESH_SCOPE.external_product_id,
    gtin: REFRESH_SCOPE.gtin, brand: REFRESH_SCOPE.brand,
    title: "Trec Nutrition Creatine Monohydrate Taurine Unflavoured 400g Powder",
    localizedAspects: [{ name: "Flavour", value: "Unflavoured" }, { name: "Size", value: "400g" }, { name: "Formulation", value: "Powder" }],
    itemWebUrl: REFRESH_SCOPE.direct_url,
  }), { ...DEFAULT_POLICY, affiliate_campaign_configured: true });
  const row = rowFromEvaluation(evaluation);
  assert.equal(row.product_id, "1107");
  assert.equal(row.product_variant_id, "2401");
  assert.equal(row.external_gtin, REFRESH_SCOPE.gtin);
  assert.equal(row.price, "29.00");
  assert.match(row.affiliate_url, /campid=5339189922/);
  assert.throws(() => rowFromEvaluation({ ...evaluation, returned_gtin: identity.gtin }), /no longer eligible/);
});

test("eBay refresh reads the approved item directly and remains GET-only", async () => {
  resetTokenCache();
  const requests = [];
  const exact = item({ itemId: REFRESH_SCOPE.external_variant_id, legacyItemId: REFRESH_SCOPE.external_product_id, gtin: REFRESH_SCOPE.gtin, brand: REFRESH_SCOPE.brand, title: "Trec Nutrition Creatine Monohydrate Taurine Unflavoured 400g Powder", localizedAspects: [{ name: "Flavour", value: "Unflavoured" }, { name: "Size", value: "400g" }, { name: "Formulation", value: "Powder" }] });
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "private", expires_in: 7200 }) };
    return { ok: true, json: async () => exact };
  };
  const result = await buildRefreshSource({ client_id: "id", client_secret: "secret", marketplace_id: "EBAY_GB", postcode: "SW1A 1AA", campaign_id: "123" }, fetchImpl);
  assert.equal(result.returned_gtin, REFRESH_SCOPE.gtin);
  assert.match(requests[1].url, /\/item\/v1%7C204137434720%7C0$/);
  assert.ok(requests.slice(1).every((request) => !request.options.method || request.options.method === "GET"));
  resetTokenCache();
});

test("eBay refresh plan permits only noop or bounded update of offer 2558", () => {
  const plan = {
    product: { action: "existing", id: "1107" }, product_variant: { action: "existing", id: "2401" },
    retailer: { action: "existing", id: "12" }, retailer_product: { action: "noop", id: "2743" },
    offer: { action: "update", id: "2558", values: { price: "20.95", shipping_cost: "0", total_price: "20.95", in_stock: true, url: REFRESH_SCOPE.affiliate_url } },
    price_history: { action: "create" }, expected_state: { offer: { price: "19.95", retailer_product_id: "2743" } },
  };
  const loaded = { artifact: { blocked_rows: [], plans: [{ plan_kind: "manual", retailer_id: "12", resolved_plan: plan }] }, artifactSha256: "a".repeat(64) };
  assert.equal(validateRefreshPlan(loaded).entry.resolved_plan.offer.id, "2558");
  assert.throws(() => validateRefreshPlan({ ...loaded, artifact: { ...loaded.artifact, plans: [{ ...loaded.artifact.plans[0], resolved_plan: { ...plan, product: { action: "existing", id: "999" } } }] } }), /escaped/);
  assert.throws(() => validateRefreshPlan({ ...loaded, artifact: { ...loaded.artifact, plans: [{ ...loaded.artifact.plans[0], resolved_plan: { ...plan, offer: { ...plan.offer, values: { ...plan.offer.values, price: "45.00", total_price: "45.00" } } } }] } }), /hard limit/);
});

test("eBay refresh workflow is scheduled, default dry-run and has no push trigger", () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /name: eBay Offer Refresh/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /default: dry-run/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.match(workflow, /OWNER_APPROVED_EBAY_REFRESH_EXACT_1/);
  assert.match(workflow, /EBAY_CLIENT_ID/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /vars\.EBAY_REFRESH_ENABLED == 'true'/);
  assert.match(workflow, /Verify fresh no-op after apply/);
});

test("title-lead input accepts only intact read-only discovery reports and one row per missing product", () => {
  const report = {
    operation_type: "EBAY_BROWSE_API_DISCOVERY", write_enabled: false,
    rows: [{ ...identity, decision: "NOT_FOUND" }, { ...identity, variant_id: "1003", decision: "NOT_FOUND" }, { ...identity, product_id: "12", decision: "REVIEW" }],
    artifact_fingerprint: null,
  };
  report.artifact_fingerprint = hash("EBAY-BROWSE-REPORT:1", report);
  const input = buildTitleLeadInput(report, 10, "2026-08-14T14:00:00.000Z");
  assert.equal(input.rows.length, 1);
  assert.equal(input.rows[0].product_id, "11");
  assert.equal(buildTitleLeadInput({ ...report, operation_type: "EBAY_BROWSE_API_PILOT", artifact_fingerprint: hash("EBAY-BROWSE-REPORT:1", { ...report, operation_type: "EBAY_BROWSE_API_PILOT", artifact_fingerprint: null }) }, 10).rows.length, 1);
  assert.throws(() => buildTitleLeadInput({ ...report, artifact_fingerprint: "tampered" }, 10), /fingerprint mismatch/);
});

test("one-retailer discovery excludes canonical, quarantined, duplicate and ambiguous GTIN identities", () => {
  const products = [{ id: 1, name: "Safe", brand: "Brand", category: "Creatine", unit_count: 60, is_active: true, gtin: null }, { id: 2, name: "Other", brand: "Brand", category: "Vitamins", unit_count: 30, is_active: true, gtin: "12345670" }];
  const variants = [{ id: 11, product_id: 1, display_name: "60 caps", product_format: "capsule", is_active: true, gtin: null }, { id: 12, product_id: 2, display_name: "30 caps", product_format: "capsule", is_active: true, gtin: null }];
  const mappings = [
    { id: 101, retailer_id: 7, product_id: 1, product_variant_id: 11, external_gtin: "96385074", external_url: "https://retailer.example/safe" },
    { id: 102, retailer_id: 7, product_id: 2, product_variant_id: 12, external_gtin: "12345670" },
  ];
  const offers = [{ retailer_product_id: 101, retailer_id: 7, price: 10, shipping_cost: 0, in_stock: true }];
  const rows = buildDiscoveryRows({ products, variants, mappings, offers }, "", 10);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].gtin, "96385074");
  assert.deepEqual([...parseQuarantinedGtins("| x | `96385074` | `CONFLICT` |")], ["96385074"]);
  assert.equal(buildDiscoveryRows({ products, variants, mappings, offers }, "| x | `96385074` | `CONFLICT` |", 10).length, 0);
});

test("runner and library contain no production mutation or public publication path", () => {
  const source = ["scripts/ebay-browse-pilot.js", "scripts/lib/ebay-browse-pilot.js"].map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(/);
  assert.doesNotMatch(source, /offers\).*insert|retailer_products\).*insert/);
  assert.deepEqual(parseArgs(["--prepare-input"]).prepareInput, true);
  assert.equal(parseArgs(["--discover-one-retailer", "--max-identities=200"]).maxIdentities, 200);
  assert.equal(parseArgs(["--scope=owner-reviewed-36"]).scope, "owner-reviewed-36");
  assert.throws(() => parseArgs(["--scope=other"]), /Unsupported eBay pilot identity scope/);
  assert.throws(() => parseArgs(["--discover-one-retailer", "--scope=owner-reviewed-36"]), /cannot be combined/);
  assert.throws(() => parseArgs(["--max-identities=200"]), /requires --discover-one-retailer/);
  assert.throws(() => parseArgs(["--title-leads-from=tmp/ebay-uk-coverage/report.json"]), /requires --discover-one-retailer/);
  assert.throws(() => parseArgs(["--apply"]), /Unsupported argument/);
});
