const assert = require("node:assert/strict");
const test = require("node:test");
const { REQUIRED_COLUMNS, digest, merchantLink, projectPartnerizeRows } = require("./lib/partnerize-product-feed-projector");
const { readPartnerizeProductFeed, safeFeedUrl } = require("./lib/partnerize-product-feed-reader");
const { classifyExistingOffers, partitionExecutableRows } = require("./lib/retailer-offer-sync/classifier");

const storeUrl = "https://store.example.test";
const destination = `${storeUrl}/shop/product/fixture-500mg-100-capsules`;
function source(overrides = {}) {
  return {
    ...Object.fromEntries(REQUIRED_COLUMNS.map(key => [key, ""])),
    sku: "001234", mpn: "fixture-mpn", product_name: "Fixture 500mg 100 Capsules", brand: "Fixture Brand",
    currency: "GBP", price: "10.00 GBP", condition: "new", availability: "in stock", shipping_cost: "3.49",
    product_url: `https://prf.hn/click/camref:fixture/destination:${encodeURIComponent(destination)}`,
    gtin: "0000000000123", description: 'Opis: "pełny skład" — 500 µg.', unit_pricing_measure: "100 ct", unit_pricing_base_measure: "1 ct",
    ...overrides,
  };
}
function feed(rows = [source()]) {
  return Buffer.from([REQUIRED_COLUMNS.join("|"), ...rows.map(row => REQUIRED_COLUMNS.map(key => row[key]).join("|"))].join("\n"));
}
function reviewed(row = source()) {
  const current = projectPartnerizeRows(feed([row]), { storeUrl }).sourceVariants[0];
  return { sku: row.sku, identity: current.source_identity, sha256: current.source_validation.observed_identity_sha256 };
}
function project(row = source(), identities = [reviewed()]) {
  return projectPartnerizeRows(feed([row]), { storeUrl, reviewedIdentities: identities }).sourceVariants[0];
}

test("Partnerize preserves textual source identity, literal quotation marks and Unicode evidence", () => {
  const result = projectPartnerizeRows(feed(), { storeUrl, reviewedIdentities: [reviewed()] });
  const row = result.sourceVariants[0];
  assert.equal(row.external_product_id, "001234");
  assert.equal(row.external_variant_id, "001234");
  assert.equal(row.external_sku, "001234");
  assert.equal(row.external_gtin, "0000000000123");
  assert.equal(result.evidenceRows[0].description, source().description);
  assert.equal(row.url, destination);
  assert.equal(new URL(row.affiliate_url).hostname, "prf.hn");
  assert.equal(row.source_validation.identity_status, "VERIFIED");
  assert.equal(row.source_validation.status, "VALID");
  assert.equal(row.source_updated_at, null);
  assert.equal(row.source_identity.description_sha256, digest(source().description));
});

test("sale price and known shipping are calculated exactly in minor units", () => {
  assert.deepEqual([project().price, project().shipping_cost, project().total_price], ["10.00", "3.49", "13.49"]);
  const sale = project(source({ sale_price: "8.25 GBP", shipping_cost: "0.00" }));
  assert.deepEqual([sale.price, sale.shipping_cost, sale.total_price], ["8.25", "0.00", "8.25"]);
  assert.equal(sale.source_validation.identity_status, "VERIFIED");
  assert.equal(project(source({ price: "0.01 GBP", shipping_cost: "0.01" })).total_price, "0.02");
  assert.equal(project(source({ availability: "out of stock" })).in_stock, false);
});

test("source price, currency, shipping and availability failures remain explicit row outcomes", () => {
  const cases = [
    [{ currency: "EUR" }, "CURRENCY_NOT_GBP"],
    [{ price: "0.00 GBP" }, "PRICE_INVALID"],
    [{ price: "1e2 GBP" }, "PRICE_INVALID"],
    [{ price: "10.001 GBP" }, "PRICE_INVALID"],
    [{ price: "-1.00 GBP" }, "PRICE_INVALID"],
    [{ sale_price: "11.00 GBP" }, "SALE_PRICE_INVALID"],
    [{ sale_price: "unknown" }, "SALE_PRICE_INVALID"],
    [{ shipping_cost: "" }, "SHIPPING_UNKNOWN_OR_INVALID"],
    [{ shipping_cost: "unknown" }, "SHIPPING_UNKNOWN_OR_INVALID"],
    [{ availability: "unknown" }, "AVAILABILITY_UNKNOWN"],
  ];
  for (const [change, code] of cases) {
    const row = project(source(change));
    assert.equal(row.source_validation.status, "INVALID", code);
    assert.ok(row.source_validation.errors.includes(code), code);
    if (change.shipping_cost !== undefined) assert.equal(row.shipping_cost, null);
    if (change.availability) assert.equal(row.in_stock, null);
  }
  const mixed = projectPartnerizeRows(feed([source(), source({ sku: "001235", availability: "unknown" })]), { storeUrl });
  assert.equal(mixed.sourceVariants.length, 2);
  assert.equal(mixed.sourceVariants[0].source_validation.status, "VALID");
  assert.equal(mixed.sourceVariants[1].source_validation.status, "INVALID");
});

test("verified identity compares all retained product evidence without approving new source records", () => {
  for (const field of ["gtin", "mpn", "product_name", "brand", "color", "condition", "unit_pricing_measure", "unit_pricing_base_measure", "description"]) {
    const row = project(source({ [field]: `${source()[field]} changed` }));
    assert.equal(row.source_validation.identity_status, "DRIFT", field);
    assert.ok(row.source_validation.changed_identity_fields.includes(field === "description" ? "description_sha256" : field));
    assert.equal(row.external_gtin, field === "gtin" ? "0000000000123 changed" : "0000000000123");
  }
  assert.equal(project(source(), []).source_validation.identity_status, "UNREVIEWED");
  const badSeal = { ...reviewed(), sha256: "0".repeat(64) };
  assert.throws(() => project(source(), [badSeal]), /PARTNERIZE_REVIEWED_IDENTITIES_INVALID/);
  assert.throws(() => project(source(), [reviewed(), reviewed()]), /PARTNERIZE_REVIEWED_IDENTITIES_INVALID/);
  for (const identity of [{ ...reviewed().identity, extra: "unbound" }, { ...reviewed().identity, gtin: null }]) {
    assert.throws(() => project(source(), [{ sku: source().sku, identity, sha256: digest(identity) }]), /PARTNERIZE_REVIEWED_IDENTITIES_INVALID/);
  }
});

test("merchant and affiliate destinations are separately validated without URL or GTIN rewriting", () => {
  assert.equal(merchantLink(destination, storeUrl).merchant_url, destination);
  for (const invalid of [
    "http://prf.hn/click/destination:" + encodeURIComponent(destination),
    "https://evil.example/click/destination:" + encodeURIComponent(destination),
    "https://prf.hn/click/destination:" + encodeURIComponent("https://other.example/product"),
    "https://prf.hn/click/destination:" + encodeURIComponent(encodeURIComponent(destination)),
    "https://prf.hn/click/destination:" + encodeURIComponent("https://user:password@store.example.test/product"),
    "https://prf.hn/click/destination:" + encodeURIComponent(destination + "#fragment"),
    "https://prf.hn/click/destination:" + encodeURIComponent(destination + "\t"),
    "https://prf.hn/click/destination:" + encodeURIComponent(destination) + "?unexpected=1",
  ]) {
    assert.throws(() => merchantLink(invalid, storeUrl), /PARTNERIZE_PRODUCT_URL_INVALID/);
    const row = project(source({ product_url: invalid }));
    assert.equal(row.source_validation.status, "INVALID");
    assert.equal(row.url, null);
  }
});

const feedUrl = "https://feeds.performancehorizon.com/fixture/private-token?secret=fixture";
const response = (body = feed(), options = {}) => new Response(body, { headers: { "content-type": "text/plain; charset=UTF-8" }, ...options });

test("Partnerize transport is confined to the source origin and never leaks its authenticated endpoint", async () => {
  for (const endpoint of ["http://feeds.performancehorizon.com/feed", "https://evil.example/feed", "https://feeds.performancehorizon.com.evil.example/feed", "https://user:password@feeds.performancehorizon.com/feed", feedUrl + "#secret", feedUrl + "\t"]) {
    assert.throws(() => safeFeedUrl(endpoint), { message: "PARTNERIZE_FEED_ENDPOINT_INVALID" });
  }
  let calls = 0;
  await assert.rejects(readPartnerizeProductFeed({ feedUrl, storeUrl, maximumAttempts: 2, sleepImpl: async () => {}, fetchImpl: async () => {
    calls += 1; throw new Error(`failed ${feedUrl}`);
  } }), { message: "PARTNERIZE_FEED_TRANSPORT_FAILED" });
  assert.equal(calls, 2);
  const result = await readPartnerizeProductFeed({ feedUrl, storeUrl, reviewedIdentities: [reviewed()], now: () => new Date("2026-11-16T19:00:00Z"), fetchImpl: async (endpoint, options) => {
    assert.equal(endpoint.href, feedUrl);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return response(feed(), { headers: { "content-type": "text/csv", date: "Mon, 16 Nov 2026 18:59:50 GMT", "last-modified": "unknown" } });
  } });
  assert.equal(result.captured_at, "2026-11-16T19:00:00.000Z");
  assert.equal(result.source_diagnostic.pagination_completed, true);
  assert.equal(result.source_diagnostic.supplier_generated_at, null);
  assert.equal(result.source_diagnostic.http_date, "2026-11-16T18:59:50.000Z");
  assert.equal(result.source_diagnostic.http_last_modified, null);
  assert.equal(result.source_variants[0].source_validation.identity_status, "VERIFIED");
  assert.equal(result.raw_source_fingerprint, digest(feed()));
  assert.ok(!JSON.stringify(result).includes("private-token"));
});

test("Partnerize transport rejects redirects, wrong content types, truncated and oversized streams", async () => {
  for (const [makeResponse, code] of [
    [() => response("login", { headers: { "content-type": "text/html" } }), "PARTNERIZE_FEED_CONTENT_TYPE_INVALID"],
    [() => response(feed(), { headers: { "content-type": "text/plain; charset=latin1" } }), "PARTNERIZE_FEED_CONTENT_TYPE_INVALID"],
    [() => response(feed(), { status: 401 }), "PARTNERIZE_FEED_HTTP_INVALID"],
    [() => response(feed(), { headers: { "content-type": "text/csv", "content-length": "10000000" } }), "PARTNERIZE_FEED_SIZE_INVALID"],
    [() => { const r = response(); Object.defineProperty(r, "redirected", { value: true }); return r; }, "PARTNERIZE_FEED_REDIRECT_REJECTED"],
    [() => response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(600)); controller.enqueue(new Uint8Array(600)); controller.close(); } })), "PARTNERIZE_FEED_SIZE_INVALID"],
    [() => response(new ReadableStream({ start(controller) { controller.error(new Error(feedUrl)); } })), "PARTNERIZE_FEED_TRANSPORT_FAILED"],
    [() => response(""), "PARTNERIZE_FEED_SIZE_INVALID"],
  ]) {
    let calls = 0;
    await assert.rejects(readPartnerizeProductFeed({ feedUrl, storeUrl, maximumBytes: 1000, fetchImpl: async () => { calls += 1; return makeResponse(); } }), { message: code });
    assert.equal(calls, 1, code);
  }
  let cancelled = false;
  await assert.rejects(readPartnerizeProductFeed({ feedUrl, storeUrl, maximumBytes: 1000, fetchImpl: async () => response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1001)); }, cancel() { cancelled = true; },
  })) }), /PARTNERIZE_FEED_SIZE_INVALID/);
  assert.equal(cancelled, true);
});

test("Partnerize transient HTTP retries are bounded and malformed snapshots are not retried", async () => {
  let calls = 0;
  const delays = [];
  const result = await readPartnerizeProductFeed({ feedUrl, storeUrl, retryBaseDelayMs: 5, sleepImpl: async ms => delays.push(ms), fetchImpl: async () => {
    calls += 1; return calls < 3 ? response("unavailable", { status: calls === 1 ? 429 : 503 }) : response();
  } });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [5, 10]);
  assert.equal(result.source_diagnostic.retry_count, 2);
  calls = 0;
  await assert.rejects(readPartnerizeProductFeed({ feedUrl, storeUrl, fetchImpl: async () => { calls += 1; return response("changed|schema\n1|2"); } }), /PARTNERIZE_FEED_COLUMNS_CHANGED/);
  assert.equal(calls, 1);
  await assert.rejects(readPartnerizeProductFeed({ feedUrl, storeUrl, maximumAttempts: 4 }), /PARTNERIZE_FETCH_POLICY_INVALID/);
});

test("malformed feed schemas and duplicate/invalid source identifiers fail closed", () => {
  assert.throws(() => projectPartnerizeRows(Buffer.from(""), { storeUrl }), /PARTNERIZE_FEED_EMPTY/);
  assert.throws(() => projectPartnerizeRows(feed().subarray(1), { storeUrl }), /PARTNERIZE_FEED_COLUMNS_CHANGED/);
  assert.throws(() => projectPartnerizeRows(Buffer.concat([feed(), Buffer.from([0xff])]), { storeUrl }), /PARTNERIZE_FEED_ENCODING_OR_SCHEMA_INVALID/);
  assert.throws(() => projectPartnerizeRows(feed([source(), source()]), { storeUrl }), /PARTNERIZE_SOURCE_IDENTITY_INVALID_OR_DUPLICATE/);
  assert.throws(() => project(source({ sku: " 001234" })), /PARTNERIZE_SOURCE_IDENTITY_INVALID_OR_DUPLICATE/);
  assert.throws(() => projectPartnerizeRows(Buffer.from(feed().toString().replaceAll("|", ",")), { storeUrl }), /PARTNERIZE_FEED_/);
});

test("raw and semantic fingerprints distinguish price, stock, shipping and identity drift", () => {
  const baseline = projectPartnerizeRows(feed(), { storeUrl });
  for (const change of [{ price: "9.00 GBP" }, { shipping_cost: "0.00" }, { availability: "out of stock" }, { gtin: "0000000000456" }, { description: "changed formulation" }]) {
    const next = projectPartnerizeRows(feed([source(change)]), { storeUrl });
    assert.notEqual(next.raw_source_fingerprint, baseline.raw_source_fingerprint);
    assert.notEqual(next.semantic_source_fingerprint, baseline.semantic_source_fingerprint);
  }
  assert.equal(projectPartnerizeRows(feed(), { storeUrl }).semantic_source_fingerprint, baseline.semantic_source_fingerprint);
});

function classificationInput() {
  const rows = [source(), source({ sku: "001235" })];
  const projected = projectPartnerizeRows(feed(rows), { storeUrl, reviewedIdentities: rows.map(reviewed) });
  return {
    targets: projected.sourceVariants.map((row, index) => ({ ...row, offer_id: String(index + 1), retailer_product_id: String(index + 11),
      source_identity_sha256: row.source_validation.observed_identity_sha256 })),
    sourceVariants: projected.sourceVariants, sourceCapturedAt: "2026-11-16T19:00:00Z", now: new Date("2026-11-16T19:01:00Z"),
    sourceProductCount: 2, previousSourceProductCount: 2, quarantineUnsafeRows: true,
    policy: { store_url: storeUrl, source_url_mode: "provided", require_source_identity: true, quarantine_shipping_policy_drift: true, required_matched_offers: 2,
      source_freshness_hours: 24, future_clock_skew_minutes: 5, full_snapshot_minimum_source_count_ratio: 0.9,
      maximum_changed_record_ratio: 0.75, mass_price_change_block_ratio: 0.75,
      maximum_total_oos_ratio: 0.75, maximum_oos_increase_percentage_points: 0.75, mass_oos_block_count: 4,
      per_row_price_hard_block_ratio: 0.25, per_row_price_hard_block_absolute_gbp: "20.00" },
  };
}

test("shared classifier isolates invalid source values before Boolean or monetary coercion", () => {
  for (const mutate of [
    row => { row.in_stock = null; }, row => { row.in_stock = "false"; }, row => { row.price = null; },
    row => { row.shipping_cost = null; }, row => { row.total_price = "999.00"; },
    row => { row.price = "999999999999999999999.00"; row.total_price = "999999999999999999999.00"; },
    row => { delete row.source_validation; }, row => { row.source_validation.status = "INVALID"; row.source_validation.errors = ["AVAILABILITY_UNKNOWN"]; },
  ]) {
    const input = classificationInput(); mutate(input.sourceVariants[0]);
    const result = classifyExistingOffers(input);
    const partition = partitionExecutableRows(result);
    assert.equal(result.state, "DRY_RUN_READY_WITH_REVIEW");
    assert.deepEqual(partition.executable_rows.map(row => row.offer_id), ["2"]);
    assert.equal(partition.review_rows[0].reason, "SOURCE_RECORD_INVALID");
    assert.equal(partition.review_rows[0].changed_fields.blocked, true);
    assert.equal(partition.review_rows[0].expected_deltas.row_count_deltas.price_history, 0);
    assert.equal(result.expected_deltas.logical_field_deltas.last_checked_at_updates, 1);
    input.quarantineUnsafeRows = false;
    assert.equal(classifyExistingOffers(input).reason, "SOURCE_RECORD_INVALID");
  }
});

test("shared classifier requires the source identity seal bound to the existing mapped target", () => {
  for (const mutate of [
    row => { row.source_validation.identity_status = "UNREVIEWED"; },
    row => { row.source_validation.identity_status = "DRIFT"; },
    row => { row.external_gtin = "0000000000456"; },
    row => { row.source_identity.product_name = "changed formulation"; },
    row => { row.source_validation.expected_identity_sha256 = "a".repeat(64); },
    row => { row.source_validation.observed_identity_sha256 = "b".repeat(64); },
    row => { row.source_validation.changed_identity_fields = ["gtin"]; },
  ]) {
    const input = classificationInput(); mutate(input.sourceVariants[0]);
    const result = classifyExistingOffers(input);
    assert.deepEqual(result.rows.map(row => row.offer_id), ["2"]);
    assert.equal(result.quarantined_rows[0].reason, "SOURCE_IDENTITY_DRIFT");
    assert.equal(result.quarantined_rows[0].action, "BLOCK_IDENTITY_DRIFT");
  }
  const input = classificationInput(); delete input.targets[0].source_identity_sha256;
  assert.equal(classifyExistingOffers(input).quarantined_rows[0].reason, "SOURCE_IDENTITY_DRIFT");
});

test("shared classifier quarantines delivery-only changes without guessing a price action", () => {
  const input = classificationInput();
  input.sourceVariants[0].shipping_cost = "0.00"; input.sourceVariants[0].total_price = "10.00";
  const result = classifyExistingOffers(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.quarantined_rows[0].reason, "SHIPPING_POLICY_DRIFT");
  assert.equal(result.expected_deltas.logical_field_deltas.offer_shipping_updates, 0);
  assert.equal(result.expected_deltas.row_count_deltas.price_history, 0);
  input.quarantineUnsafeRows = false;
  assert.equal(classifyExistingOffers(input).reason, "SHIPPING_POLICY_DRIFT");
  input.quarantineUnsafeRows = true; input.policy.require_unchanged_shipping = true;
  input.sourceVariants[0].price = "11.00"; input.sourceVariants[0].total_price = "11.00";
  assert.equal(classifyExistingOffers(input).quarantined_rows[0].reason, "SHIPPING_POLICY_DRIFT");
  delete input.policy.quarantine_shipping_policy_drift;
  assert.equal(classifyExistingOffers(input).reason, "SHIPPING_POLICY_DRIFT");
});

test("unmapped source records stay outside the executable partition and missing records are not OOS", () => {
  const input = classificationInput();
  input.sourceVariants.push(project(source({ sku: "009999" }), []));
  assert.deepEqual(classifyExistingOffers(input).rows.map(row => row.offer_id), ["1", "2"]);
  input.sourceVariants.shift();
  const result = classifyExistingOffers(input);
  assert.deepEqual(result.rows.map(row => row.offer_id), ["2"]);
  assert.equal(result.quarantined_rows[0].reason, "SOURCE_VARIANT_MISSING");
  assert.equal(result.quarantined_rows[0].source, null);
  assert.equal(result.expected_deltas.logical_field_deltas.offer_stock_updates, 0);
});
