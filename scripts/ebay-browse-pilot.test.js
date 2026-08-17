const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const { DEFAULT_POLICY, assertConfig, browseIdentity, buildReport, evaluateIdentity, evaluateItem, getApplicationToken, resetTokenCache, sellerMatchesCurrentSource } = require("./lib/ebay-browse-pilot");
const { buildDiscoveryRows, buildItemRefreshInput, buildTitleLeadInput, currentOfferEvidence, parseArgs, parseQuarantinedGtins, readExactItem, sealInput } = require("./ebay-browse-pilot");
const { hash } = require("./lib/retailer-snapshot/fingerprints");
const { CONFIRMATION: REFRESH_CONFIRMATION, SCOPES: REFRESH_SCOPES, SCOPE: REFRESH_SCOPE, assertExecutionContext, buildSource: buildRefreshSource, classifyContinuity, parseArgs: parseRefreshArgs, rowFromEvaluation, validatePlan: validateRefreshPlan, validatePreparedArtifact } = require("./ebay-offer-refresh");
const { CONFIRMATION: CANARY_CONFIRMATION, EXPECTED_SCOPE: CANARY_SCOPE, parseArgs: parseCanaryArgs, validateLiveSources, validateRollout } = require("./ebay-offer-canary-executor");

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

test("eBay refresh is frozen to the exact 22 approved existing offers", () => {
  assert.deepEqual(parseRefreshArgs(["--target=production", "--mode=dry-run"]), { target: "production", mode: "dry-run" });
  assert.deepEqual(parseRefreshArgs(["--target=production", "--mode=execute-apply"]), { target: "production", mode: "execute-apply" });
  assert.throws(() => parseRefreshArgs(["--target=staging", "--mode=execute-apply"]), /production/);
  assert.throws(() => assertExecutionContext("execute-apply", { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", EBAY_REFRESH_OWNER_CONFIRMATION: "wrong" }), /exact owner confirmation/);
  assert.doesNotThrow(() => assertExecutionContext("execute-apply", { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch", EBAY_REFRESH_OWNER_CONFIRMATION: REFRESH_CONFIRMATION }));
  assert.equal(REFRESH_SCOPE.offer_id, "2558");
  assert.equal(REFRESH_SCOPE.retailer_product_id, "2743");
  assert.equal(REFRESH_SCOPE.external_variant_id, "v1|204137434720|0");
  assert.equal(REFRESH_SCOPES.length, 22);
  assert.deepEqual(REFRESH_SCOPES.map((scope) => scope.offer_id), Array.from({ length: 22 }, (_, index) => String(2539 + index)));
  assert.deepEqual(REFRESH_SCOPES.map((scope) => scope.retailer_product_id), Array.from({ length: 22 }, (_, index) => String(2724 + index)));
  assert.equal(new Set(REFRESH_SCOPES.map((scope) => scope.external_variant_id)).size, 22);
  assert.equal(new Set(REFRESH_SCOPES.map((scope) => scope.gtin)).size, 22);
  assert.deepEqual(REFRESH_SCOPES.slice(-2).map((scope) => ({
    product_id: scope.product_id,
    product_variant_id: scope.product_variant_id,
    external_variant_id: scope.external_variant_id,
    retailer_product_id: scope.retailer_product_id,
    offer_id: scope.offer_id,
  })), [
    { product_id: "520", product_variant_id: "1025", external_variant_id: "v1|407021140091|677211935188", retailer_product_id: "2744", offer_id: "2559" },
    { product_id: "134", product_variant_id: "1644", external_variant_id: "v1|306694054274|0", retailer_product_id: "2745", offer_id: "2560" },
  ]);
});

test("eBay refresh converts only a fully qualified exact listing into importer input", () => {
  const evaluation = evaluateItem({ ...identity, product_id: REFRESH_SCOPE.product_id, variant_id: REFRESH_SCOPE.product_variant_id, gtin: REFRESH_SCOPE.gtin, brand: REFRESH_SCOPE.brand, product_name: REFRESH_SCOPE.product_name, flavour_label: REFRESH_SCOPE.flavour_label, size_value: 400, size_unit: "g" }, item({
    itemId: REFRESH_SCOPE.external_variant_id, legacyItemId: REFRESH_SCOPE.external_product_id,
    gtin: REFRESH_SCOPE.gtin, brand: REFRESH_SCOPE.brand,
    title: "Trec Nutrition Creatine Monohydrate Taurine Unflavoured 400g Powder",
    localizedAspects: [{ name: "Flavour", value: "Unflavoured" }, { name: "Size", value: "400g" }, { name: "Formulation", value: "Powder" }],
    itemWebUrl: REFRESH_SCOPE.direct_url,
  }), { ...DEFAULT_POLICY, affiliate_campaign_configured: true });
  const row = rowFromEvaluation(REFRESH_SCOPE, evaluation);
  assert.equal(row.product_id, "1107");
  assert.equal(row.product_variant_id, "2401");
  assert.equal(row.external_gtin, REFRESH_SCOPE.gtin);
  assert.equal(row.price, "29.00");
  assert.equal(row.affiliate_url, REFRESH_SCOPE.affiliate_url);
  assert.notEqual(row.affiliate_url, evaluation.affiliate_url);
  assert.throws(() => rowFromEvaluation(REFRESH_SCOPE, { ...evaluation, returned_gtin: identity.gtin }), /no longer eligible/);
});

test("eBay existing-listing continuity tolerates only narrow evidence disappearance", () => {
  const base = {
    decision: "AUTO_ELIGIBLE", item_id: REFRESH_SCOPE.external_variant_id,
    legacy_item_id: REFRESH_SCOPE.external_product_id, returned_gtin: REFRESH_SCOPE.gtin,
    blockers: [], review_reasons: [], affiliate_ready: true,
    affiliate_url: REFRESH_SCOPE.affiliate_url,
  };
  assert.equal(classifyContinuity(REFRESH_SCOPE, base).tier, "live_exact_gtin");
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, decision: "REVIEW", review_reasons: ["FORMAT_UNPROVEN"] }).tier, "live_exact_gtin_with_metadata_gap");
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, decision: "REVIEW", returned_gtin: null, review_reasons: ["RETURNED_GTIN_UNPROVEN"] }).tier, "sealed_existing_identity_continuity");
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, decision: "REVIEW", returned_gtin: null, review_reasons: ["RETURNED_GTIN_UNPROVEN", "FORMAT_UNPROVEN"] }).eligible, false);
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, decision: "REJECT", returned_gtin: "842595109191", blockers: ["GTIN_MISMATCH"] }).eligible, false);
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, item_id: "v1|other|0" }).eligible, false);
  assert.equal(classifyContinuity(REFRESH_SCOPE, { ...base, affiliate_ready: false, affiliate_url: null }).eligible, false);
});

test("Batch F refresh continuity is exact to each reviewed item, seller and missing-evidence set", () => {
  const [olimp, dymatize] = REFRESH_SCOPES.slice(-2);
  const evaluation = (scope, seller, review_reasons) => ({
    decision: "REVIEW",
    item_id: scope.external_variant_id,
    legacy_item_id: scope.external_product_id,
    returned_gtin: null,
    blockers: [],
    review_reasons,
    affiliate_ready: true,
    affiliate_url: scope.affiliate_url,
    seller: { username: seller },
  });

  assert.equal(classifyContinuity(olimp, evaluation(olimp, "muscle-factory-co-uk", ["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"])).tier, "sealed_owner_reviewed_missing_gtin_continuity");
  assert.equal(classifyContinuity(dymatize, evaluation(dymatize, "snober_trade_ltd", ["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"])).tier, "sealed_owner_reviewed_missing_gtin_continuity");
  assert.equal(classifyContinuity(olimp, evaluation(olimp, "different-seller", ["FORMAT_UNPROVEN", "RETURNED_GTIN_UNPROVEN"])).eligible, false);
  assert.equal(classifyContinuity(olimp, evaluation(olimp, "muscle-factory-co-uk", ["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"])).eligible, false);
  assert.equal(classifyContinuity(dymatize, { ...evaluation(dymatize, "snober_trade_ltd", ["RETURNED_GTIN_UNPROVEN", "SIZE_UNPROVEN"]), item_id: "v1|other|0" }).eligible, false);
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
  const result = await buildRefreshSource(REFRESH_SCOPE, { client_id: "id", client_secret: "secret", marketplace_id: "EBAY_GB", postcode: "SW1A 1AA", campaign_id: "123" }, fetchImpl);
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
  assert.equal(validateRefreshPlan(REFRESH_SCOPE, loaded).entry.resolved_plan.offer.id, "2558");
  assert.throws(() => validateRefreshPlan(REFRESH_SCOPE, { ...loaded, artifact: { ...loaded.artifact, plans: [{ ...loaded.artifact.plans[0], resolved_plan: { ...plan, product: { action: "existing", id: "999" } } }] } }), /escaped/);
  assert.throws(() => validateRefreshPlan(REFRESH_SCOPE, { ...loaded, artifact: { ...loaded.artifact, plans: [{ ...loaded.artifact.plans[0], resolved_plan: { ...plan, offer: { ...plan.offer, values: { ...plan.offer.values, price: "45.00", total_price: "45.00" } } } }] } }), /hard limit/);
  const fresh = { ...loaded, artifact: { ...loaded.artifact, environment_marker: "production", created_at: "2026-08-17T10:00:00.000Z" } };
  assert.equal(validatePreparedArtifact(REFRESH_SCOPE, fresh, new Date("2026-08-17T10:14:59.000Z")).entry.resolved_plan.offer.id, "2558");
  assert.throws(() => validatePreparedArtifact(REFRESH_SCOPE, fresh, new Date("2026-08-17T10:15:01.000Z")), /not fresh/);
});

test("eBay refresh workflow is scheduled, default dry-run and has no push trigger", () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/ebay-offer-refresh.yml"), "utf8");
  assert.match(workflow, /name: eBay Offer Refresh/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /default: dry-run/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.match(workflow, /OWNER_APPROVED_EBAY_REFRESH_EXACT_22/);
  assert.doesNotMatch(workflow, /OWNER_APPROVED_EBAY_REFRESH_EXACT_1(?:\D|$)/);
  assert.match(workflow, /EBAY_CLIENT_ID/);
  assert.match(workflow, /JONS_SYNC_APPROVER_DATABASE_URL/);
  assert.match(workflow, /vars\.EBAY_REFRESH_ENABLED == 'true'/);
  assert.match(workflow, /Verify fresh no-op after apply/);
  const applyStep = workflow.match(/- name: Apply exact approved existing-offer refresh[\s\S]*?run: npm run ebay:refresh -- --target=production --mode=execute-apply/)?.[0] || "";
  assert.match(applyStep, /EBAY_CANARY_APPROVER_DATABASE_URL/);
  assert.doesNotMatch(applyStep, /SUPABASE_SERVICE_ROLE_KEY|EBAY_CLIENT_SECRET/);
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

test("exact-item refresh accepts only intact review evidence that still matches current identity", () => {
  const report = {
    operation_type: "EBAY_BROWSE_API_NEXT_30_REVIEW_REFRESH",
    write_enabled: false,
    rows: [{ ...identity, decision: "REVIEW", selected_offer: { item_id: "v1|123|0", legacy_item_id: "123" } }],
    artifact_fingerprint: null,
  };
  report.artifact_fingerprint = hash("EBAY-BROWSE-REPORT:1", report);
  const input = buildItemRefreshInput(report, [identity], "2026-08-17T15:00:00.000Z");
  assert.equal(input.rows.length, 1);
  assert.equal(input.rows[0].refresh_item_id, "v1|123|0");
  assert.equal(input.rows[0].refresh_legacy_item_id, "123");
  assert.throws(() => buildItemRefreshInput({ ...report, artifact_fingerprint: "tampered" }, [identity]), /fingerprint mismatch/);
  assert.throws(() => buildItemRefreshInput(report, [{ ...identity, gtin: "96385074" }]), /No current unresolved exact items/);
});

test("exact-item refresh reads only the sealed item and rejects identity drift", async () => {
  resetTokenCache();
  const current = { ...identity, refresh_item_id: "v1|123|0", refresh_legacy_item_id: "123" };
  const config = { marketplace_id: "EBAY_GB", postcode: "SW1A1AA", campaign_id: "campaign" };
  const requests = [];
  const fetchItem = async (url) => {
    requests.push(String(url));
    return { ok: true, status: 200, json: async () => ({ itemId: "v1|123|0", legacyItemId: "123" }) };
  };
  const items = await readExactItem(current, config, fetchItem, "token");
  assert.equal(items.length, 1);
  assert.deepEqual(requests, ["https://api.ebay.com/buy/browse/v1/item/v1%7C123%7C0"]);
  await assert.rejects(() => readExactItem(current, config, async () => ({ ok: true, status: 200, json: async () => ({ itemId: "v1|999|0", legacyItemId: "999" }) }), "token"), /identity drift/);
});

test("Batch F dry-run review is sealed to exactly two rows and cannot authorize apply", () => {
  const review = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/rollouts/ebay-offer-canary/batch-f-review.json"), "utf8"));
  const csvBuffer = fs.readFileSync(path.join(process.cwd(), review.csv));
  const rows = parse(csvBuffer, { columns: true, skip_empty_lines: true });
  assert.equal(crypto.createHash("sha256").update(csvBuffer).digest("hex"), review.csv_sha256);
  assert.equal(review.owner_approval.approved_for_production_dry_run, true);
  assert.equal(review.owner_approval.approved_for_production_apply, false);
  assert.equal(review.dry_run.plan_count, 2);
  assert.equal(review.dry_run.blocked_row_count, 0);
  assert.equal(review.dry_run.database_writes, 0);
  assert.deepEqual(rows.map((row) => `${row.product_id}:${row.product_variant_id}:${row.external_variant_id}`), [
    "520:1025:v1|407021140091|677211935188",
    "134:1644:v1|306694054274|0",
  ]);
  assert.deepEqual(review.entries.map((row) => `${row.product_id}:${row.product_variant_id}:${row.external_variant_id}`), [
    "520:1025:v1|407021140091|677211935188",
    "134:1644:v1|306694054274|0",
  ]);
  assert.ok(review.entries.every((row) => row.planned_actions.join(",") === "retailer_product:create,offer:create,price_history:create"));
});

test("Batch F production rollout is bound to the exact two approved plans", () => {
  const validated = validateRollout();
  assert.equal(CANARY_CONFIRMATION, "OWNER_APPROVED_EBAY_BATCH_F_EXACT_2");
  assert.equal(validated.entries.length, 2);
  assert.deepEqual(CANARY_SCOPE.map((row) => `${row.product_id}:${row.product_variant_id}:${row.external_variant_id}`), [
    "520:1025:v1|407021140091|677211935188",
    "134:1644:v1|306694054274|0",
  ]);
  assert.equal(parseCanaryArgs(["--mode=preflight", "--output=tmp/batch-f-preflight.json"]).mode, "preflight");
  assert.throws(() => parseCanaryArgs(["--mode=execute", "--output=tmp/batch-f.json"]), /preflight\|validate\|apply/);
});

test("Batch F live preflight rechecks both exact items and fails on drift", async () => {
  resetTokenCache();
  const olimp = item({
    itemId: "v1|407021140091|677211935188", legacyItemId: "407021140091",
    title: "Olimp Redweiler R-weiler Pre Workout 480g 80 Servings", gtin: "Does not apply", brand: "Olimp",
    price: { value: "34.99", currency: "GBP" }, shippingOptions: [{ shippingCost: { value: "3.99", currency: "GBP" } }],
    seller: { username: "muscle-factory-co-uk", sellerAccountType: "BUSINESS", feedbackPercentage: "100", feedbackScore: 270 },
    localizedAspects: [{ name: "Flavour", value: "Blueberry Madness" }],
    itemWebUrl: "https://www.ebay.co.uk/itm/407021140091?var=677211935188", itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/407021140091?var=677211935188&campid=123",
  });
  const dymatize = item({
    itemId: "v1|306694054274|0", legacyItemId: "306694054274",
    title: "Dymatize ISO 100 Hydrolyzed Gourmet Vanilla Protein Powder 2264g", gtin: "DoesNotApply", brand: "Dymatize",
    price: { value: "149.00", currency: "GBP" }, shippingOptions: [{ shippingCost: { value: "0.00", currency: "GBP" } }],
    seller: { username: "snober_trade_ltd", sellerAccountType: "BUSINESS", feedbackPercentage: "99.9", feedbackScore: 3656 },
    localizedAspects: [{ name: "Flavour", value: "Vanilla" }, { name: "Item Weight", value: "2264g" }, { name: "Formulation", value: "Powder" }],
    itemWebUrl: "https://www.ebay.co.uk/itm/306694054274", itemAffiliateWebUrl: "https://www.ebay.co.uk/itm/306694054274?campid=123",
  });
  const config = { EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secret", EBAY_UK_DELIVERY_POSTCODE: "SW1A 1AA", EBAY_EPN_CAMPAIGN_ID: "123" };
  const fetchImpl = async (url) => {
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 7200 }) };
    return { ok: true, status: 200, json: async () => String(url).includes("407021140091") ? olimp : dymatize };
  };
  const rows = await validateLiveSources(fetchImpl, config);
  assert.equal(rows.length, 2);
  await assert.rejects(() => validateLiveSources(async (url) => {
    if (String(url).includes("oauth2/token")) return { ok: true, json: async () => ({ access_token: "token", expires_in: 7200 }) };
    return { ok: true, status: 200, json: async () => String(url).includes("407021140091") ? { ...olimp, price: { value: "35.99", currency: "GBP" } } : dymatize };
  }, config), /live safety evidence drift/);
  resetTokenCache();
});

test("eBay canary workflow exposes only the exact Batch F apply and two-row postflight", () => {
  const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/ebay-offer-canary.yml"), "utf8");
  assert.match(workflow, /OWNER_APPROVED_EBAY_BATCH_F_EXACT_2/);
  assert.doesNotMatch(workflow, /OWNER_APPROVED_EBAY_BATCH_E_EXACT_1/);
  assert.match(workflow, /--mode=preflight/);
  assert.match(workflow, /batch-f\.csv/);
  assert.match(workflow, /a\.plans\.length!==2/);
  assert.doesNotMatch(workflow, /\bpush:/);
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
  assert.match(parseArgs(["--refresh-items-from=tmp/ebay-uk-coverage/report.json"]).refreshItemsReport, /report\.json$/);
  assert.throws(() => parseArgs(["--refresh-items-from=docs/report.json"]), /inside repository tmp/);
  assert.throws(() => parseArgs(["--refresh-items-from=tmp/report.json", "--discover-one-retailer"]), /cannot be combined/);
  assert.throws(() => parseArgs(["--apply"]), /Unsupported argument/);
});
