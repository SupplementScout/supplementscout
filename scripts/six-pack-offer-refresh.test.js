const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const manifest = require("../config/retailers/six-pack-approved-offer-manifest.json");
// Frozen pre-withdrawal source/approved-artifact regressions. The current v2
// 504+2 scope and real withdrawal are exercised separately in PostgreSQL.
const legacyRuntimeConfig = require("../config/retailers/six-pack-supplements-woocommerce.json");
Object.assign(legacyRuntimeConfig.automation, { manifest_path: "config/retailers/six-pack-approved-offer-manifest.json",
  manifest_sha256: "62f88fabc33e339d1106e597091217eabbbfaa4c5015b5625fb5257eacf0e7ff", approved_mapping_count: 506, approved_product_page_count: 279 });
legacyRuntimeConfig.guardrails.required_matched_offers = 506;
const { loadDryRunArtifact } = require("./import-products");
const { WooCommerceSourceError, readWooCommerceProductPage, isPermanentSourceError } = require("./lib/woocommerce-product-page-reader");
const {
  isolateDefaultVariantConflicts,
  approvedSourceFailureDisposition,
  loadApprovedManifest,
  loadReviewedMassOosManifest,
  parseArgs,
  parseSixPackProductPage,
  run,
  shippingForPrice,
} = require("./six-pack-offer-refresh");

const ROOT = path.resolve(__dirname, "..");

test("current owner EXCLUDE and DEFER block Six Pack before any source request without trimming 506 mappings", async () => {
  const source = fixture(), beforeManifest = structuredClone(loadApprovedManifest()), output = paths();
  source.state.records.find(r => r.mapping.external_product_id === "4110").product.name = "7Nutrition Melatonin 1mg 60 Capsules";
  source.state.records.find(r => r.mapping.external_product_id === "29928").product.name = "Ultra Nutrio Limitless Nootropic 100 Capsules";
  const before = structuredClone(source.state); let sourceCalls = 0;
  await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
    state: source.state, readLive: async () => { sourceCalls++; throw new Error("source must not be requested"); },
  }), error => error.code === "CATALOGUE_POLICY_SCOPE_BLOCKED" && error.detail.blocked_records.length === 2);
  assert.equal(sourceCalls, 0);
  assert.equal(fs.existsSync(output.artifact), false);
  assert.deepEqual(source.state, before);
  assert.deepEqual(loadApprovedManifest(), beforeManifest);
  assert.equal(beforeManifest.manifest.rows.length, 506);
});

test("owner catalogue block exits 2 and cannot cause a full source retry", () => {
  const code = `require(${JSON.stringify(path.join(__dirname, "six-pack-offer-refresh.js"))}).main({target:'production'},
    {state:{records:[{product:{name:'Melatonin 1mg'},mapping:{id:'random'},offer:{id:'random'}}]},readLive:()=>{throw Error('network forbidden')}});`;
  const result = spawnSync(process.execPath, ["-e", code], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CATALOGUE_SCOPE_NOT_ACTIVATED/);
  assert.doesNotMatch(result.stderr, /network forbidden/);
});

const unbuyableHtml = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-unbuyable-parent.html"), "utf8");
const unbuyableUrl = "https://6pack-supplements.co.uk/product/skull-labs-angel-dust-pump-pre-workout-fruit-killer-flavor/";
const unbuyableName = "Skull Labs Angel Dust PUMP Pre-Workout";
const unbuyableReason = "UNBUYABLE_PARENT_VARIANTS_UNRESOLVED";
const simpleHtml = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-unbuyable-simple.html"), "utf8");
const simpleUrl = "https://6pack-supplements.co.uk/product/zmb-gmc-90-caps/";
const simpleName = "Zmb + Gmc 90 Vege Caps 7Nutrition";
const simpleReason = "UNBUYABLE_SIMPLE_OFFER_UNRESOLVED";
function simpleFixture() {
  const source = unbuyableFixture();
  const record = source.state.records.find((r) => r.mapping.external_product_id === "2819");
  record.mapping.external_name = "7Nutrition ZMB + GMC 90 Caps";
  record.mapping.external_url = simpleUrl;
  return source;
}
function simpleRead(html = simpleHtml, response = {}) {
  return (id, context) => readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: id,
    capturedAt: context.capturedAt, maximumAttempts: 5, sleepImpl: async () => {}, parseProductPage: parseSixPackProductPage,
    fetchImpl: async () => ({ status: 200, url: simpleUrl, headers: { get: () => "text/html" },
      text: async () => html, ...response }),
  });
}

test("complete unavailable simple uses exact approved identity only for manual review", async () => {
  const source = simpleFixture(), before = structuredClone(source.state), capturedAt = new Date().toISOString();
  let failure;
  try { await simpleRead()("2819", { capturedAt }); } catch (e) { failure = e; }
  assert.equal(failure.cause.detail.reason_code, simpleReason);
  assert.equal(failure.detail.last_attempt, 1);
  const disposition = approvedSourceFailureDisposition(failure, "2819", loadApprovedManifest(), capturedAt, source.state.records);
  assert.equal(disposition.scope, "PRODUCT");
  assert.equal(disposition.reason, simpleReason);
  assert.deepEqual(disposition.approved_variation_ids, ["2819"]);
  assert.deepEqual(disposition.identity.observed_capsule_qualifiers, ["vegetarian"]);
  assert.equal(disposition.identity.authority, "MANUAL_REVIEW_ONLY");
  assert.equal(failure.cause.detail.price, undefined);
  assert.equal(failure.cause.detail.in_stock, undefined);
  assert.deepEqual(source.state, before);
  for (const change of [
    r => { r.mapping.external_name = "Other Brand ZMB + GMC 90 Caps"; },
    r => { r.mapping.external_name = "7Nutrition ZMB + GMC 120 Caps"; },
    r => { r.mapping.external_name = "7Nutrition ZMB + GMC 90 Tablets"; },
    r => { r.offer.retailer_product_id = 999; }, r => { r.mapping.product_variant_id = 999; },
    r => { r.mapping.retailer_id = 999; }, r => { r.offer.product_id = 999; },
    r => { r.mapping.external_url = "https://other.example/product/"; },
  ]) {
    const records = structuredClone(source.state.records); change(records.find(r=>r.mapping.external_product_id === "2819"));
    assert.equal(approvedSourceFailureDisposition(failure, "2819", loadApprovedManifest(), capturedAt, records).scope, "RETAILER");
  }
});

for (const [label, change] of [
  ["wrong ID", h => h.replace("postid-2819", "postid-9999")],
  ["unknown type", h => h.replace("product-type-simple", "product-type-unknown")],
  ["mixed type", h => h.replace("product-type-simple", "product-type-simple product-type-variable")],
  ["variable cannot use simple scope", h => h.replace("product-type-simple", "product-type-variable")],
  ["incomplete HTML", h => h.replace("</body></html>", "")],
  ["foreign canonical", h => h.replace('href="'+simpleUrl+'"', 'href="https://other.example/product/"')],
  ["contradictory stock", h => h.replace('first outofstock', 'first instock')],
  ["contradictory price metadata", h => h.replace('property="product:price:amount" content="14.99"', 'property="product:price:amount" content="9.99"')],
  ["foreign currency metadata", h => h.replace('property="product:price:currency" content="GBP"', 'property="product:price:currency" content="USD"')],
  ["contradictory offer", h => h.replace('"@type":"ItemPage"', '"@type":"Product","offers":{"price":"2.99"}')],
  ["alternate commerce", h => h.replace("</main>", '<div data-variant-id="999"></div></main>')],
]) test(`unbuyable simple stays BLOCK for ${label}`, async () => {
  const source = simpleFixture(), output = paths();
  await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
    state: source.state, readLive: (id, context) => id === "2819" ? simpleRead(change(simpleHtml))(id, context) : source.byProduct.get(id),
  }));
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(report.result, "BLOCK");
  assert.equal(report.executable_plan_count, 0);
  assert.equal(report.review_row_count, 0);
  assert.equal(report.database_writes, 0);
  assert.equal(fs.existsSync(output.artifact), false);
});

test("simple isolation has no product ID exception and rejects unclosed manifest dependencies", async () => {
  const source = simpleFixture(), id = "4110", capturedAt = new Date().toISOString();
  const html = simpleHtml.replaceAll("2819", id).replaceAll(simpleUrl, "https://6pack-supplements.co.uk/product/generic-simple/")
    .replaceAll(simpleName, "Generic Brand Product 90 Caps");
  const record = source.state.records.find(r=>r.mapping.external_product_id===id);
  record.mapping.external_name = "Generic Brand Product 90 Caps";
  record.mapping.external_url = "https://6pack-supplements.co.uk/product/generic-simple/";
  let error;
  try { await simpleRead(html, { url: record.mapping.external_url })(id, { capturedAt }); } catch (e) { error = e; }
  assert.equal(approvedSourceFailureDisposition(error, id, loadApprovedManifest(), capturedAt, source.state.records).scope, "PRODUCT");
  for (const modify of [
    a => a.manifest.rows.push({ ...a.manifest.rows.find(r=>r.external_product_id===id), mapping_id:"999999" }),
    a => { a.manifest.rows.find(r=>r.external_product_id!==id).canonical_variant_id = String(record.variant.id); },
    a => { a.manifest.rows.find(r=>r.external_product_id===id).external_variant_id="999999"; },
  ]) {
    const approved = structuredClone(loadApprovedManifest()); modify(approved);
    assert.equal(approvedSourceFailureDisposition(error, id, approved, capturedAt, source.state.records).scope, "RETAILER");
  }
});

function missingProduct(id) {
  return new WooCommerceSourceError("SOURCE_HTTP_ERROR", "missing", { product_id:id, error_type:"WooCommerceSourceError",
    request_url:`https://6pack-supplements.co.uk/?p=${id}`, http_status:404, network_code:null, timeout:false, last_attempt:5 });
}

test("simple qualification rejects corrupt, stale, future and credential-bearing provenance", async () => {
  const source = simpleFixture(), capturedAt = new Date().toISOString();
  let failure;
  try { await simpleRead()("2819", { capturedAt }); } catch (error) { failure = error; }
  const original = structuredClone(failure.cause.detail.source_document);
  for (const mutate of [
    d => { d.html_sha256 = "f".repeat(64); },
    d => { d.html_bytes += 1; },
    d => { d.body_complete = false; },
    d => { d.captured_at = "2026-01-01T00:00:00Z"; },
    d => { d.captured_at = "2099-01-01T00:00:00Z"; },
    d => { d.canonical_url = "https://user:secret@6pack-supplements.co.uk/product/zmb-gmc-90-caps/"; },
    d => { d.request_url += "&credential=secret"; },
  ]) {
    failure.cause.detail.source_document = structuredClone(original);
    mutate(failure.cause.detail.source_document);
    assert.equal(approvedSourceFailureDisposition(failure, "2819", loadApprovedManifest(), capturedAt, source.state.records).scope, "RETAILER");
  }
});

for (const [label, code, detail] of [
  ["429", "SOURCE_HTTP_ERROR", { http_status: 429 }],
  ["503", "SOURCE_HTTP_ERROR", { http_status: 503 }],
  ["timeout", "SOURCE_UNAVAILABLE", { timeout: true }],
  ["unknown", "UNKNOWN", {}],
]) test(`source ${label} stops the existing loop without reading another parent`, async () => {
  const source = fixture(), output = paths(), called = [];
  await assert.rejects(run({ target: "production", ...output }, {
    state: source.state, readLive: async id => {
      called.push(id);
      throw new WooCommerceSourceError(code, "untrusted secret must not be retained", {
        product_id: id, error_type: "WooCommerceSourceError", http_status: null, timeout: false,
        network_code: null, last_attempt: 5, ...detail,
      });
    },
  }));
  const reportText = fs.readFileSync(output.report, "utf8"), report = JSON.parse(reportText);
  assert.equal(called.length, 1);
  assert.equal(report.not_reached_product_page_count, 278);
  assert.equal(report.source_errors[0].diagnostic_continuation_allowed, false);
  assert.equal(reportText.includes("untrusted secret"), false);
  assert.equal(fs.existsSync(output.artifact), false);
  assertSourcePartition(report);
});

test("fatal HTML has one bounded report budget while all source hashes and failures remain", async () => {
  const source = simpleFixture(), output = paths(), ids = ["4110", "2819"];
  const url = "https://6pack-supplements.co.uk/product/generic-simple/";
  source.state.records.filter(r => r.mapping.external_product_id === ids[0]).forEach(r => {
    r.mapping.external_name = "Generic Brand Product 90 Caps";
    r.mapping.external_url = url;
  });
  await assert.rejects(run({ target: "production", ...output }, {
    state: source.state, readLive: (id, context) => {
      if (!ids.includes(id)) return source.byProduct.get(id);
      let html = simpleHtml.replace("Not available to buy online", "Unrecognized purchase state")
        .replace("</head>", `<!--${"x".repeat(1_050_000)}--></head>`);
      if (id === ids[0]) html = html.replaceAll("2819", id).replaceAll(simpleUrl, url).replaceAll(simpleName, "Generic Brand Product 90 Caps");
      return simpleRead(html, { url: id === ids[0] ? url : simpleUrl })(id, context);
    },
  }), { code: "SOURCE_SCHEMA_MISMATCH" });
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(report.fatal_product_page_count, 2);
  assert.equal(report.source_errors.filter(e => e.source_document.html).length, 1);
  assert.equal(report.source_errors[1].source_document.html_retention, "REPORT_BUDGET_EXCEEDED");
  assert.ok(report.source_errors.every(e => e.source_document.html_bytes > 1_000_000 && /^[a-f0-9]{64}$/.test(e.source_document.html_sha256)));
  assertSourcePartition(report);
});
function assertSourcePartition(report) {
  const counts = report.source_coverage.counts;
  assert.equal(Object.values(counts).reduce((n,x)=>n+x.products,0),279);
  assert.equal(Object.values(counts).reduce((n,x)=>n+x.mappings,0),506);
  assert.equal(report.source_coverage.mappings.length,506);
  assert.equal(new Set(report.source_coverage.mappings.map(x=>x.mapping_id)).size,506);
  assert.equal(new Set(report.source_coverage.products.map(x=>x.external_product_id)).size,279);
  assert.equal(report.source_snapshot_fingerprint,undefined);
  assert.equal(report.artifact_sha256,undefined);
  for (const key of ["executable_plan_count","executed_plan_count","review_row_count","database_writes"]) assert.equal(report[key],0);
}

test("fatal product 21 preserves all 20 earlier outcomes, exact isolation IDs and bounded fatal HTML", async () => {
  const source = simpleFixture(), output = paths(), ids=[...source.byProduct.keys()], called=[];
  await assert.rejects(run({ target:"production", ...output, isolateUnsafe:true }, {
    state:source.state,readLive:async(id,ctx)=>{called.push(id);if(id===ids[0])throw missingProduct(id);
      return id==='2819' ? simpleRead(simpleHtml.replace('first outofstock','first instock').replace('id="main"','id="incomplete-main"'))(id,ctx)
        : source.byProduct.get(id);},
  }),{code:'SOURCE_SCHEMA_MISMATCH'});
  // Deliberately mismatched main identity is an integrity stop, not a reason to scan further.
  const report=JSON.parse(fs.readFileSync(output.report));
  assert.equal(called.length,21);assert.equal(new Set(called).size,21);
  assert.equal(report.attempted_product_page_count,21);assert.equal(report.parsed_product_page_count,19);
  assert.equal(report.isolated_product_page_count,1);assert.equal(report.fatal_product_page_count,1);
  assert.equal(report.not_reached_product_page_count,258);assert.equal(report.source_capture_complete,false);
  assert.equal(report.source_failures[0].product_id,ids[0]);
  assert.equal(report.source_failures[0].disposition,'SOURCE_PRODUCT_NOT_FOUND');
  assert.deepEqual(report.source_failures[0].approved_variation_ids,manifest.rows.filter(r=>r.external_product_id===ids[0]).map(r=>r.external_variant_id));
  assert.equal(report.source_failures[0].affected_mapping_count,report.source_failures[0].mapping_ids.length);
  assert.equal(report.source_errors[0].product_id,'2819');
  assert.ok(report.source_errors[0].source_document.html.includes('incomplete-main'));
  assert.equal(report.source_pages.length,19);assert.ok(report.source_pages.every(p=>/^[a-f0-9]{64}$/.test(p.html_sha256)));
  assertSourcePartition(report);assert.equal(fs.existsSync(output.artifact),false);
});

test("one existing source loop collects independent complete-page schema failures without plans or refetch", async () => {
  const source=simpleFixture(),output=paths(),called=[];
  const secondId='4110',secondUrl='https://6pack-supplements.co.uk/product/generic-simple/';
  const row=source.state.records.find(r=>r.mapping.external_product_id===secondId);
  row.mapping.external_name='Generic Brand Product 90 Caps';row.mapping.external_url=secondUrl;
  const second=simpleHtml.replaceAll('2819',secondId).replaceAll(simpleUrl,secondUrl).replaceAll(simpleName,row.mapping.external_name);
  await assert.rejects(run({target:'production',...output,isolateUnsafe:true},{state:source.state,readLive:async(id,ctx)=>{
    called.push(id);
    if(id==='2819'||id===secondId)return simpleRead((id==='2819'?simpleHtml:second).replace('Not available to buy online','Unrecognized purchase state'),
      {url:id==='2819'?simpleUrl:secondUrl})(id,ctx);
    return source.byProduct.get(id);
  }}),{code:'SOURCE_SCHEMA_MISMATCH'});
  const report=JSON.parse(fs.readFileSync(output.report));
  assert.equal(called.length,279);assert.equal(new Set(called).size,279);
  assert.equal(report.source_capture_complete,true);assert.equal(report.source_snapshot_complete,false);
  assert.equal(report.fatal_product_page_count,2);assert.equal(report.parsed_product_page_count,277);
  assert.deepEqual(report.source_errors.map(e=>e.product_id),[secondId,'2819']);
  assert.ok(report.source_errors.every(e=>e.diagnostic_continuation_allowed&&e.source_document.html));
  assertSourcePartition(report);assert.equal(fs.existsSync(output.artifact),false);
});

test("a transient failure stops diagnosis and retains prior fatal evidence without promoting transport", async () => {
  const source=simpleFixture(),output=paths(),ids=[...source.byProduct.keys()],called=[];
  // First parent is a complete product-local schema failure; next is rate limited.
  const first=ids[0],url='https://6pack-supplements.co.uk/product/generic-simple/';
  source.state.records.filter(r=>r.mapping.external_product_id===first).forEach(r=>{
    r.mapping.external_name='Generic Brand Product 90 Caps';r.mapping.external_url=url;
  });
  const html=simpleHtml.replaceAll('2819',first).replaceAll(simpleUrl,url).replaceAll(simpleName,'Generic Brand Product 90 Caps')
    .replace('Not available to buy online','Unrecognized purchase state');
  const rate=new WooCommerceSourceError('SOURCE_HTTP_ERROR','rate limited',{product_id:ids[1],error_type:'WooCommerceSourceError',
    request_url:`https://6pack-supplements.co.uk/?p=${ids[1]}`,http_status:429,last_attempt:5,network_code:null,timeout:false});
  await assert.rejects(run({target:'production',...output},{state:source.state,readLive:async(id,ctx)=>{
    called.push(id);if(id===first)return simpleRead(html,{url})(id,ctx);throw rate;
  }}),(error)=>isPermanentSourceError(error)&&error.code==='SOURCE_SCHEMA_MISMATCH');
  const report=JSON.parse(fs.readFileSync(output.report));
  assert.equal(called.length,2);assert.equal(isPermanentSourceError(rate),false);
  assert.equal(report.source_errors[1].http_status,429);assert.equal(report.capture_stopped_by.product_id,ids[1]);
  assert.equal(report.source_error.product_id,first);assert.equal(report.not_reached_product_page_count,277);
  assertSourcePartition(report);
});
function unbuyableFixture() {
  const source = fixture();
  for (const record of source.state.records.filter((r) => r.mapping.external_product_id === "28570")) {
    record.mapping.external_name = unbuyableName;
    record.mapping.external_url = unbuyableUrl;
  }
  return source;
}
function unbuyableRead(html = unbuyableHtml, response = {}) {
  return (id, context) => readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: id,
    capturedAt: context.capturedAt, maximumAttempts: 5, sleepImpl: async () => {}, parseProductPage: parseSixPackProductPage,
    fetchImpl: async () => ({ status: 200, url: unbuyableUrl, headers: { get: () => "text/html" },
      text: async () => html, ...response }),
  });
}

test("complete unavailable parent is manifest-bound review evidence, never child price/stock evidence", async () => {
  const source = unbuyableFixture(), capturedAt = new Date().toISOString();
  let failure;
  try { await unbuyableRead()("28570", { capturedAt }); } catch (error) { failure = error; }
  assert.equal(failure.code, "SOURCE_SCHEMA_MISMATCH");
  assert.equal(failure.detail.last_attempt, 1);
  assert.equal(failure.cause.detail.reason_code, unbuyableReason);
  const disposition = approvedSourceFailureDisposition(failure, "28570", loadApprovedManifest(), capturedAt, source.state.records);
  assert.equal(disposition.scope, "PRODUCT");
  assert.deepEqual(disposition.approved_variation_ids, ["29091", "29094", "29097"]);
  assert.equal(disposition.reason, unbuyableReason);
  assert.equal(disposition.source_document.html, unbuyableHtml);
  assert.equal(disposition.source_document.html_sha256, crypto.createHash("sha256").update(unbuyableHtml).digest("hex"));
  assert.equal(disposition.source_document.html_bytes, Buffer.byteLength(unbuyableHtml));
  assert.equal(disposition.source_document.captured_at, capturedAt);
  assert.equal(failure.cause.detail.price, undefined);
  assert.equal(failure.cause.detail.in_stock, undefined);
});

const unbuyableNegatives = [
  ["random HTTP 200 page", () => "<!doctype html><html><head></head><body>Not available to buy online</body></html>"],
  ["empty response", () => ""],
  ["infrastructure error", () => "<!doctype html><html><head></head><body><h1>Bad Gateway</h1></body></html>"],
  ["wrong product ID", (h) => h.replace("postid-28570", "postid-99999")],
  ["wrong product container", (h) => h.replace('id="product-28570"', 'id="product-99999"')],
  ["wrong heading", (h) => h.replace(/(<h1\b[^>]*>)[\s\S]*?<\/h1>/, "$1Other Product</h1>")],
  ["incomplete document", (h) => h.replace("</body></html>", "")],
  ["missing main close", (h) => h.replace("</main>", "")],
  ["unknown variation IDs", (h) => h.replace("</head>", '<script type="application/json" id="other-variants">{"variation_id":99999}</script></head>')],
  ["alternative payload", (h) => h.replace("</head>", '<script type="application/json" id="product-variations">{"variations":[]}</script></head>')],
  ["broken variation payload", (h) => h.replace("</head>", '<script type="application/json" id="product-variations">{</script></head>')],
  ["broken JSON-LD", (h) => h.replace(/(<script type="application\/ld\+json">)[\s\S]*?<\/script>/, "$1{</script>")],
  ["conflicting price metadata", (h) => h.replace("55.00", "54.00")],
  ["conflicting body stock", (h) => h.replace('first outofstock', 'first instock')],
  ["conflicting stock metadata", (h) => h.replace('content="Out of stock"', 'content="In stock"')],
  ["conflicting stock label", (h) => h.replace('>Out of stock</p>', '>In stock</p>')],
  ["unknown structure", (h) => h.replace('id="main"', 'id="unknown-main"')],
  ["changed stock structure", (h) => h.replace("data-product-stock", "data-new-stock")],
  ["notice only in a comment", (h) => h.replace("Not available to buy online", "<!-- Not available to buy online -->")],
  ["missing notice", (h) => h.replace("Not available to buy online", "Available soon")],
  ["foreign canonical", (h) => h.replace('<link rel="canonical" href="https://6pack-supplements.co.uk/', '<link rel="canonical" href="https://other.example/')],
  ["purchase form", (h) => h.replace("Not available to buy online</p>", 'Not available to buy online</p><form><button type="submit">Buy</button></form>')],
  ["contradictory structured offer", (h) => h.replace('"@type":"ItemPage"', '"offers":{"price":"99.99"},"@type":"ItemPage"')],
  ["unknown JSON data", (h) => h.replace("</head>", '<script type="application/json" id="unknown-data">{}</script></head>')],
  ["unknown variant attribute", (h) => h.replace("</main>", '<div data-variant-id="99999"></div></main>')],
  ["unknown variant JSON in allowed container", (h) => h.replace("</head>", '<script type="application/json" id="sixpack-wishlist">{"variants":[99999]}</script></head>')],
  ["contradictory price meta", (h) => h.replace("</head>", '<meta property="product:price:amount" content="99.99"></head>')],
  ["contradictory stock outside hero", (h) => h.replace("</main>", '<div data-product-stock>In stock</div></main>')],
  ["unexpected section", (h) => h.replace("</main>", '<section>Unknown structure</section></main>')],
  ["data-id is not main identity", (h) => h.replace('id="main"', 'data-id="main"')],
  ["duplicate main identity attribute", (h) => h.replace('id="main"', 'id="main" id="other"')],
  ["unknown nested schema", (h) => h.replace('"@type":"ItemPage"', '"extra":{"@type":"ProductVariant"},"@type":"ItemPage"')],
  ["unquoted alternative variation data", (h) => h.replace("</head>", '<script>window.variants = [{id:99999}];</script></head>')],
  ["mismatched identity quotes", (h) => h.replace('id="main"', "id=\"main'")],
  ["alternative structured price value", (h) => h.replace('"@type":"ItemPage"', '"extra":{"@type":["PropertyValue"],"name":"price","value":"99.99"},"@type":"ItemPage"')],
];
for (const [label, change] of unbuyableNegatives) {
  test(`unbuyable parent keeps retailer BLOCK for ${label}`, async () => {
    const source = unbuyableFixture(), output = paths(), before = structuredClone(source.state);
    await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
      state: source.state, readLive: (id, context) => id === "28570" ? unbuyableRead(change(unbuyableHtml))(id, context)
        : source.byProduct.get(id),
    }));
    const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.blocked_row_count, 506);
    assert.equal(report.executable_plan_count, 0);
    assert.equal(report.review_row_count, 0);
    assert.equal(report.database_writes, 0);
    assert.equal(fs.existsSync(output.artifact), false);
    assert.deepEqual(source.state, before);
  });
}

test("unbuyable review rejects stale/corrupt provenance and any incomplete approved-child binding", async () => {
  const source = unbuyableFixture(), capturedAt = new Date().toISOString(), approved = loadApprovedManifest();
  let failure;
  try { await unbuyableRead()("28570", { capturedAt }); } catch (error) { failure = error; }
  const original = structuredClone(failure.cause.detail);
  for (const change of [
    (d) => { d.reason_code = "UNKNOWN"; }, (d) => { d.product_id = "99999"; },
    (d) => { d.source_document.captured_at = "2026-01-01T00:00:00Z"; },
    (d) => { d.source_document.html_sha256 = "0".repeat(64); },
    (d) => { d.source_document.html_bytes += 1; }, (d) => { d.source_document.body_complete = false; },
    (d) => { d.source_document.http_status = 503; },
    (d) => { d.source_document.response_url = "https://other.example/product/"; },
    (d) => { d.source_document.request_url = "https://other.example/?p=28570"; },
    (d) => { d.product_name = "Other Product"; },
  ]) {
    failure.cause.detail = structuredClone(original); change(failure.cause.detail);
    assert.equal(approvedSourceFailureDisposition(failure, "28570", approved, capturedAt, source.state.records).scope, "RETAILER");
  }
  failure.cause.detail = original;
  for (const change of [
    (records) => records.splice(records.findIndex((r) => r.mapping.external_variant_id === "29091"), 1),
    (records) => { records.find((r) => r.mapping.external_variant_id === "29091").variant.id = 99999; },
    (records) => { records.find((r) => r.mapping.external_variant_id === "29091").mapping.external_variant_id = "99999"; },
  ]) {
    const records = structuredClone(source.state.records); change(records);
    assert.equal(approvedSourceFailureDisposition(failure, "28570", approved, capturedAt, records).scope, "RETAILER");
  }
  const forged = structuredClone(approved); forged.manifest.rows = forged.manifest.rows.filter((r) => r.external_variant_id !== "29091");
  assert.equal(approvedSourceFailureDisposition(failure, "28570", forged, capturedAt,
    source.state.records.filter((r) => r.mapping.external_variant_id !== "29091")).scope, "RETAILER");
  for (const response of [{ url: "https://6pack-supplements.co.uk/" }, { url: "https://other.example/product/" },
    { status: 503 }, { headers: { get: () => "application/json" } },
    { text: async () => { throw Object.assign(new Error("transport"), { code: "ECONNRESET" }); } }]) {
    await assert.rejects(unbuyableRead(unbuyableHtml, response)("28570", { capturedAt }));
  }
});

test("a technically bound unavailable variable parent reports unverified names only through manual review", async () => {
  const source = unbuyableFixture(), output = paths();
  const html = unbuyableHtml.replaceAll(unbuyableName, "Different unverified merchant title");
  const before = structuredClone(source.state), called = [];
  const result = await run({target:'production',...output,isolateUnsafe:true}, {
    state:source.state, readLive:async(id,ctx)=>{
      called.push(id); return id==='28570'?unbuyableRead(html)(id,ctx):source.byProduct.get(id);
    }
  });
  assert.equal(result.report.result,'PASS_WITH_REVIEW');
  assert.equal(called.length,279); assert.equal(new Set(called).size,279);
  assert.equal(result.report.executable_plan_count,503); assert.equal(result.report.review_row_count,3);
  const reviewed = new Set(['2427','2428','2429']);
  for(const row of result.report.review_rows){
    assert.equal(row.proposed_offer,null);
    assert.deepEqual(row.changed_fields,{price:false,stock:false,url:false,blocked:true});
    assert.equal(row.source_failure.identity.technical_parent_binding,'VERIFIED');
    assert.equal(row.source_failure.identity.commercial_identity,'UNVERIFIED');
    assert.equal(row.source_failure.identity.name_equivalence_verified,false);
    assert.equal(row.source_failure.identity.authority,'MANUAL_REVIEW_ONLY');
  }
  const artifact=loadDryRunArtifact(output.artifact).artifact;
  assert.ok(artifact.plans.every(p=>!reviewed.has(String(p.resolved_plan.offer.id))));
  assert.ok(artifact.source_rows.every(r=>r.normalized_source_row.source.external_product_id!=='28570'));
  assert.doesNotThrow(()=>require('./six-pack-offer-refresh-executor').validateArtifactScope(artifact,manifest));
  await assert.rejects(run({target:'production',...paths(),isolateUnsafe:false},{state:source.state,
    readLive:async(id,ctx)=>id==='28570'?unbuyableRead(html)(id,ctx):source.byProduct.get(id)}),{code:'SOURCE_SCHEMA_MISMATCH'});
  assert.deepEqual(source.state,before);
});

test("unbuyable parent qualification is generic for another existing approved parent and all its children", async () => {
  const source = fixture(), capturedAt = new Date().toISOString(), parent = "6582", name = "Generic Unavailable Parent";
  const url = omittedOptions.canonicalUrl;
  const html = unbuyableHtml.replaceAll("28570", parent).replaceAll(unbuyableUrl, url).replaceAll(unbuyableName, name);
  for (const record of source.state.records.filter((r) => r.mapping.external_product_id === parent)) {
    record.mapping.external_name = name; record.mapping.external_url = url;
  }
  let failure;
  try { await unbuyableRead(html, { url })(parent, { capturedAt }); } catch (error) { failure = error; }
  const disposition = approvedSourceFailureDisposition(failure, parent, loadApprovedManifest(), capturedAt, source.state.records);
  assert.equal(disposition.scope, "PRODUCT");
  assert.equal(disposition.reason, unbuyableReason);
  assert.deepEqual(disposition.approved_variation_ids, ["6583", "6584", "6585", "6586", "6587"]);
  await assert.rejects(run({ target: "production", ...paths(), isolateUnsafe: false }, {
    state: source.state, readLive: (id, context) => id === parent ? unbuyableRead(html, { url })(id, context)
      : source.byProduct.get(id),
  }), { code: "SOURCE_SCHEMA_MISMATCH" });
});

const omittedHtml = fs.readFileSync(path.join(__dirname, "test-fixtures/six-pack-theme-product-6582.html"), "utf8");
const omittedOptions = { productId: "6582", canonicalUrl: "https://6pack-supplements.co.uk/product/cream-of-rice-2kg-nxt/" };
function changeOmittedHtml(changePayload = () => {}, changeGroup = () => {}) {
  return omittedHtml.replace(/(<script\b[^>]*type="application\/(json|ld\+json)"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (_, start, type, content, end) => {
      const data = JSON.parse(content);
      if (type === "json") changePayload(data);
      else changeGroup(data["@graph"][0]);
      return start + JSON.stringify(data) + end;
    });
}

test("captured complete nondefault 6585/6586 omitted from dropdown retain all five exact commercial rows", async () => {
  const parsed = await readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: "6582",
    maximumAttempts: 5, parseProductPage: parseSixPackProductPage,
    fetchImpl: async () => ({ status: 200, url: omittedOptions.canonicalUrl,
      headers: { get: () => "text/html" }, text: async () => omittedHtml }),
  });
  assert.equal(parsed.external_product_id, "6582");
  assert.deepEqual(parsed.variations.map((r) => [r.external_variant_id, r.attributes.attribute_flavour, r.price, r.in_stock]), [
    ["6583", "chocolate coconut", "15.99", true], ["6584", "apple pie", "15.99", true],
    ["6585", "cinnamon cereal", "15.99", false], ["6586", "gingerbread", "15.99", false],
    ["6587", "strawberry cheesecake", "15.99", false],
  ]);
});

test("complete omitted-variant corroboration has no product or variation ID allowlist", () => {
  const html = omittedHtml.replace(/658[2-7]/g, (id) => String(Number(id) + 100000));
  const parsed = parseSixPackProductPage(html, { ...omittedOptions, productId: "106582" });
  assert.deepEqual(parsed.variations.map((r) => r.external_variant_id), ["106583", "106584", "106585", "106586", "106587"]);
});

const omittedNegatives = [
  ["missing SKU", () => {}, (g) => { delete g.hasVariant[2].sku; }],
  ["wrong SKU", () => {}, (g) => { g.hasVariant[2].sku = "9999"; }],
  ["wrong JSON-LD variation ID", () => {}, (g) => { g.hasVariant[2]["@id"] += "wrong"; }],
  ["wrong payload variation ID", (p) => { p.variations[2].id = 9999; }],
  ["foreign variant URL", () => {}, (g) => { g.hasVariant[2].url = "https://other.example/product/rice/?attribute_flavour=cinnamon+cereal"; }],
  ["wrong variant URL attributes", () => {}, (g) => { g.hasVariant[2].url = omittedOptions.canonicalUrl + "?attribute_flavour=gingerbread"; }],
  ["duplicate URL attributes", () => {}, (g) => { g.hasVariant[2].url += "&attribute_flavour=cinnamon+cereal"; }],
  ["foreign offer URL", () => {}, (g) => { g.hasVariant[2].offers.url = "https://other.example/product/rice/"; }],
  ["wrong parent", () => {}, (g) => { g.hasVariant[2].isVariantOf["@id"] += "wrong"; }],
  ["unbound ProductGroup", () => {}, (g) => { g.url += "wrong"; }],
  ["missing Product", () => {}, (g) => { g.hasVariant.splice(2, 1); }],
  ["duplicate JSON-LD Product", () => {}, (g) => { g.hasVariant.push(structuredClone(g.hasVariant[2])); }],
  ["conflicting JSON-LD identity", () => {}, (g) => {
    const duplicate = structuredClone(g.hasVariant[2]); duplicate["@id"] += "wrong"; g.hasVariant.push(duplicate);
  }],
  ["wrong currency", () => {}, (g) => { g.hasVariant[2].offers.priceCurrency = "EUR"; }],
  ["wrong price", () => {}, (g) => { g.hasVariant[2].offers.price = "15.98"; }],
  ["wrong stock", () => {}, (g) => { g.hasVariant[2].offers.availability = "https://schema.org/InStock"; }],
  ["missing attributes", (p) => { p.variations[2].attributes = {}; }],
  ["unknown flavour", (p) => { p.variations[2].attributes.attribute_flavour = "unknown"; }],
  ["duplicate complete combination", (p) => { p.variations[3].attributes = p.variations[2].attributes; }],
  ["missing selection", (p) => { delete p.selected; }],
  ["unknown selection", (p) => { p.selected.attribute_flavour = "unknown"; }],
];
for (const [label, payload, graph] of omittedNegatives) {
  test(`complete omitted variants still block ${label}`, () => {
    assert.throws(() => parseSixPackProductPage(changeOmittedHtml(payload, graph), omittedOptions),
      { code: "SOURCE_SCHEMA_MISMATCH" });
  });
}

test("omitted variants require same-page JSON-LD and approved product origin/identity", () => {
  assert.throws(() => parseSixPackProductPage(omittedHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ""),
    omittedOptions), { code: "SOURCE_SCHEMA_MISMATCH" });
  assert.throws(() => parseSixPackProductPage(omittedHtml, { ...omittedOptions,
    canonicalUrl: "https://other.example/product/cream-of-rice-2kg-nxt/" }), { code: "SOURCE_SCHEMA_MISMATCH" });
  assert.throws(() => parseSixPackProductPage(omittedHtml, { ...omittedOptions, productId: "9999" }),
    { code: "SOURCE_IDENTITY_DRIFT" });
});

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
      (g) => { g.hasVariant[5].sku = "not-4708"; },
      (g) => { g.hasVariant[5].url = "https://other.example/product/?attribute_flavours=Fruit"; },
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
function changeWildcardHtml(changePayload = () => {}, changeGraph = () => {}) {
  return incompleteHtml.replace(/(<script type="application\/(json|ld\+json)"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (_, start, type, content, end) => {
      const data = JSON.parse(content);
      (type === "json" ? changePayload : changeGraph)(data);
      return start + JSON.stringify(data) + end;
    });
}

const approvedWarriorBindings = [
  ["3290", "2306", "2492", "2286", "Milk Chocolate Coconut"],
  ["3291", "2307", "2493", "2287", "Dark Chocolate Peanut"],
  ["3292", "2308", "2494", "2288", "Raspberry Lemon Cheesecake"],
  ["3293", "2309", "2495", "2289", "Salted Caramel"],
  ["3294", "2310", "2496", "2290", "White Chocolate"],
  ["3295", "2311", "2497", "2291", "Banoffee Pie"],
  ["3297", "2312", "2498", "2292", "Key Lime Pie"],
];
const wildcardIssue = {
  reason_code: "WILDCARD_COMMERCIAL_UNIT_UNRESOLVED",
  variation_ids: approvedWarriorBindings.map(([id]) => id),
  wildcard_attributes: ["attribute_size"],
};

test("6 Pack blocks blank row attributes despite default selection and matching flavour-only JSON-LD", () => {
  const block = incompleteHtml.match(/<script type="application\/json" id="product-variations">([\s\S]*?)<\/script>/);
  const payload = JSON.parse(block[1]);
  assert.equal(payload.variations.length, 7);
  assert.deepEqual(payload.attributes[1].options.map((option) => option.value), ["1pcs", "12pcs"]);
  assert.equal(payload.selected.attribute_size, "1pcs");
  assert.ok(payload.variations.every((row) => row.attributes.attribute_size === ""));
  // A page default, one dropdown option or an absent key cannot prove a row's size.
  for (const [index, change] of [() => {},
    (p) => { p.attributes[1].options = [p.attributes[1].options[0]]; },
    (p) => { delete p.variations[0].attributes.attribute_size; },
    (p) => { p.variations[0].attributes.attribute_size = null; },
    (p) => { p.variations[0].attributes.attribute_size = " "; },
  ].entries()) {
    const modified = structuredClone(payload);
    change(modified);
    const html = incompleteHtml.replace(block[1], () => JSON.stringify(modified));
    assert.throws(() => parseSixPackProductPage(html, incompleteOptions),
      (error) => error instanceof WooCommerceSourceError && error.code === "SOURCE_SCHEMA_MISMATCH"
        && (index < 2 ? error.detail.reason_code === wildcardIssue.reason_code
          : error.message === "6 Pack variation attribute keys are incomplete"));
  }
});

test("all seven owner-reviewed Warrior identities remain exact while wildcard commercial units stay blocked", () => {
  assert.deepEqual(manifest.rows.filter((row) => row.external_product_id === "2769")
    .map((row) => [row.external_variant_id, row.offer_id, row.mapping_id, row.canonical_product_id, row.canonical_variant_id]),
  approvedWarriorBindings.map(([id, offer, mapping, variant]) => [id, offer, mapping, "1074", variant]));
  assert.throws(() => parseSixPackProductPage(incompleteHtml, incompleteOptions), (error) => {
    assert.equal(error.code, "SOURCE_SCHEMA_MISMATCH");
    assert.deepEqual(error.detail, { ...wildcardIssue, product_id: "2769" });
    return true;
  });
  for (const [id, , , , flavour] of approvedWarriorBindings) {
    const html = changeWildcardHtml((p) => {
      p.variations = p.variations.filter((row) => String(row.id) === id);
      assert.equal(p.variations[0].attributes.attribute_flavours, flavour);
    });
    assert.throws(() => parseSixPackProductPage(html, incompleteOptions), (error) => {
      assert.deepEqual(error.detail.variation_ids, [id]);
      assert.equal(error.detail.reason_code, wildcardIssue.reason_code);
      return true;
    });
  }
});

test("wildcard detection is generic and does not replace absent or malformed attributes", () => {
  const otherProduct = incompleteHtml.replaceAll("postid-2769", "postid-98765")
    .replaceAll("&quot;productId&quot;:2769", "&quot;productId&quot;:98765");
  assert.throws(() => parseSixPackProductPage(otherProduct, { ...incompleteOptions, productId: "98765" }),
    (error) => error.detail.product_id === "98765" && error.detail.reason_code === wildcardIssue.reason_code);
  const anyFlavour = changeWildcardHtml((p) => {
    p.variations = [p.variations[0]];
    p.variations[0].attributes = { attribute_flavours: "", attribute_size: "12pcs" };
  });
  assert.throws(() => parseSixPackProductPage(anyFlavour, incompleteOptions),
    (error) => error.detail.wildcard_attributes[0] === "attribute_flavours");
  for (const value of [undefined, null, 0, false, [], {}, " "]) {
    const html = changeWildcardHtml((p) => { p.variations[0].attributes.attribute_size = value; });
    assert.throws(() => parseSixPackProductPage(html, incompleteOptions),
      (error) => error.code === "SOURCE_SCHEMA_MISMATCH" && !error.detail.reason_code);
  }
});

test("complete explicit size rows remain parseable without inheriting a wildcard or page default", () => {
  const html = changeWildcardHtml((p) => {
    for (const row of p.variations) row.attributes.attribute_size = "12pcs";
  });
  const parsed = parseSixPackProductPage(html, incompleteOptions);
  assert.equal(parsed.variations.length, 7);
  assert.ok(parsed.variations.every((row) => row.attributes.attribute_size === "12pcs"));
});

test("wildcard does not authorize a unit from defaults, labels, prices or size-dependent stock", () => {
  const cases = [
    () => {}, // No owner confirmation or sales-unit contract.
    (p) => { p.selected.attribute_size = "12pcs"; },
    (p) => { for (const row of p.variations) row.price_html = "<p>1 x 64g bar</p>"; },
    (p) => { p.variations[0].price = 1.99; },
    (p) => { p.variations[0].in_stock = true; },
    ...["price", "stock"].map((field) => (p) => {
      const concrete = structuredClone(p.variations[0]);
      concrete.id = 99999;
      concrete.attributes.attribute_size = "1pcs";
      if (field === "price") concrete.price = 1.99;
      else concrete.in_stock = true;
      p.variations.unshift(concrete);
    }),
    (p) => { p.variations[0].id = 99999; },
  ];
  for (const change of cases) {
    assert.throws(() => parseSixPackProductPage(changeWildcardHtml(change), incompleteOptions),
      (error) => error.code === "SOURCE_SCHEMA_MISMATCH" && error.detail.reason_code === wildcardIssue.reason_code);
  }
  for (const change of [
    (p) => { p.variations[0].id = 0; },
    (p) => { p.variations[0].id = "3290"; },
    (p) => { p.variations.push(p.variations[0]); },
    (p) => { p.variations[0].attributes.attribute_flavours = "Unknown"; },
  ]) assert.throws(() => parseSixPackProductPage(changeWildcardHtml(change), incompleteOptions),
    (error) => ["SOURCE_SCHEMA_MISMATCH", "DUPLICATE_SOURCE_IDENTITY"].includes(error.code));
});

test("wildcard cannot turn conflicting SKU, product identity or source URL into an accepted offer", async () => {
  const invalidSku = changeWildcardHtml(() => {}, (graph) => {
    const group = graph['@graph'].find((node) => node['@type'] === "ProductGroup");
    group.hasVariant[0].sku = "wrong-sku";
  });
  assert.throws(() => parseSixPackProductPage(invalidSku, incompleteOptions), { code: "SOURCE_SCHEMA_MISMATCH" });
  assert.throws(() => parseSixPackProductPage(incompleteHtml.replace("postid-2769", "postid-99999"), incompleteOptions),
    { code: "SOURCE_IDENTITY_DRIFT" });
  await assert.rejects(readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: "2769",
    maximumAttempts: 1, parseProductPage: parseSixPackProductPage, fetchImpl: async () => ({ status: 200,
      url: "https://other.example/product/warrior/", headers: { get: () => "text/html" }, text: async () => incompleteHtml }) }),
  { code: "SOURCE_REDIRECT_ERROR" });
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

test("all eight approved 3980 bindings survive equivalent 1kg/1000g identity without mutation", async () => {
  const source = fixture(), output = paths();
  const records = source.state.records.filter((r) => r.mapping.external_product_id === "3980");
  assert.deepEqual(records.map((r) => r.mapping.external_variant_id), ["3989", "3992", "3995", "5962", "5963", "3988", "3994", "3991"]);
  for (const record of records) record.mapping.external_name = "7Nutrition Whey Isolate 90 1kg";
  source.byProduct.get("3980").product_name = "7Nutrition Whey Isolate 90 1000g";
  const before = structuredClone(source.state);
  const { report } = await run({ target: "production", ...output, requireNoChange: true }, {
    state: source.state, readLive: async (id) => source.byProduct.get(id),
  });
  assert.equal(report.result, "PASS");
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.doesNotThrow(() => require("./six-pack-offer-refresh-executor").validateArtifactScope(artifact, manifest));
  for (const record of records) {
    const plan = artifact.plans.find((p) => String(p.resolved_plan.offer.id) === String(record.offer.id)).resolved_plan;
    assert.equal(String(plan.offer.id), String(record.offer.id));
    const row = artifact.source_rows.find((r) => r.normalized_source_row.source.external_variant_id === record.mapping.external_variant_id);
    assert.equal(String(row.normalized_source_row.target.retailer_product.id), String(record.mapping.id));
    assert.equal(String(row.normalized_source_row.target.product_variant.id), String(record.variant.id));
    assert.equal(String(row.normalized_source_row.target.product.id), String(record.product.id));
  }
  assert.deepEqual(source.state, before);
});

function conflictingIdentityFixture() {
  const source = fixture();
  for (const id of ["3980", "4110"]) {
    for (const record of source.state.records.filter((r) => r.mapping.external_product_id === id)) {
      record.mapping.external_name = "Example Vanilla 1kg";
    }
    Object.assign(source.byProduct.get(id), { product_name: "Example Vanilla 1.5kg", html_bytes: 1234 });
  }
  return source;
}

test("post-capture BLOCK retains every independent identity conflict and page evidence without plans", async () => {
  const source = conflictingIdentityFixture(), before = structuredClone(source.state), output = paths();
  const requests = [];
  await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
    state: source.state, readLive: async (id, context) => {
      requests.push(id);
      return { ...source.byProduct.get(id), captured_at: context.capturedAt };
    },
  }), (error) => error instanceof WooCommerceSourceError && isPermanentSourceError(error)
    && error.code === "SOURCE_IDENTITY_DRIFT");
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(requests.length, 279);
  assert.equal(new Set(requests).size, 279);
  assert.equal(report.result, "BLOCK");
  assert.equal(report.classification_state, "SOURCE_NORMALIZATION_FAILED");
  assert.equal(report.error_stage, "SOURCE_NORMALIZATION");
  assert.equal(report.source_capture_complete, true);
  assert.equal(report.source_snapshot_complete, false);
  assert.equal(report.normalization_complete, true);
  assert.equal(report.fetched_product_page_count, 279);
  assert.equal(report.attempted_product_page_count, 279);
  assert.equal(report.parsed_source_variant_count, 506);
  assert.equal(report.manifest_sha256, loadApprovedManifest().sha256);
  assert.ok(Date.parse(report.source_captured_at));
  assert.equal(report.source_pages.length, 279);
  const page = report.source_pages.find((r) => r.external_product_id === "3980");
  assert.equal(page.html_bytes, 1234);
  assert.equal(page.html_sha256, source.byProduct.get("3980").html_sha256);
  assert.equal(page.captured_at, report.source_captured_at);
  assert.deepEqual([...new Set(report.post_capture_errors.map((e) => e.product_id))], ["4110", "3980"]);
  assert.equal(report.post_capture_errors.length, 9);
  const error = report.post_capture_errors.find((e) => e.external_variant_id === "3989");
  assert.equal(error.mapping_id, "2213");
  assert.equal(error.offer_id, "2027");
  assert.equal(error.error_code, "SOURCE_IDENTITY_DRIFT");
  assert.equal(error.permanent, true);
  assert.deepEqual(error.identity.csv_identity_tokens, ["1000g"]);
  assert.deepEqual(error.identity.live_identity_tokens, ["1500g"]);
  assert.equal(error.identity.csv_product_name, "Example Vanilla 1kg");
  for (const key of ["executable_plan_count", "executed_plan_count", "review_row_count", "database_writes"]) assert.equal(report[key], 0);
  assert.equal(report.blocked_row_count, 506);
  assert.equal(report.source_snapshot_fingerprint, undefined);
  assert.equal(report.artifact_sha256, undefined);
  assert.equal(fs.existsSync(output.artifact), false);
  assert.deepEqual(source.state, before);
});

test("unknown post-capture exceptions and transient/forged codes remain retryable and untrusted", async () => {
  for (const error of [Object.assign(new Error("unknown"), { code: "SOURCE_IDENTITY_DRIFT" }),
    Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }), new Error("unknown"),
    new WooCommerceSourceError("SOURCE_UNAVAILABLE", "network"),
    ...[429, 500, 502, 503].map((status) => new WooCommerceSourceError("SOURCE_HTTP_ERROR", "HTTP", { http_status: status }))]) {
    assert.equal(isPermanentSourceError(error), false);
  }
  const source = fixture(), output = paths(), error = Object.assign(new Error("not a proven contract error"), { code: "SOURCE_IDENTITY_DRIFT" });
  Object.defineProperty(source.byProduct.get("3980").variations[0], "price", { get() { throw error; } });
  await assert.rejects(run({ target: "production", ...output }, {
    state: source.state, readLive: async (id) => source.byProduct.get(id),
  }), (caught) => caught === error && !isPermanentSourceError(caught));
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(report.normalization_complete, false);
  assert.equal(report.post_capture_errors[0].permanent, false);
  assert.equal(report.executable_plan_count, 0);
  assert.equal(fs.existsSync(output.artifact), false);
});

test("post-capture duplicate coverage is a typed permanent BLOCK with an existing failure report", async () => {
  const source = fixture(), output = paths();
  source.state.records.push(structuredClone(source.state.records[0]));
  await assert.rejects(run({ target: "production", ...output }, {
    state: source.state, readLive: async (id) => source.byProduct.get(id),
  }), (error) => error.code === "SOURCE_COLLAPSE" && isPermanentSourceError(error));
  assert.equal(isPermanentSourceError(Object.assign(new Error("untrusted"), { code: "SOURCE_COLLAPSE" })), false);
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(report.error_stage, "SOURCE_COVERAGE");
  assert.equal(report.block_reason, "SOURCE_COLLAPSE");
  assert.equal(report.source_error.normalized_row_count, 507);
  assert.equal(report.source_error.unique_normalized_variant_count, 506);
  assert.equal(report.executable_plan_count, 0);
  assert.equal(fs.existsSync(output.artifact), false);
});

test("an unknown normalization row cannot hide independent proven identity conflicts in captured data", async () => {
  const source = conflictingIdentityFixture(), output = paths();
  const record = source.state.records.find((r) => !["4110", "3980"].includes(r.mapping.external_product_id));
  const page = source.byProduct.get(record.mapping.external_product_id);
  const row = page.product_offer || page.variations[0];
  Object.defineProperty(row, "price", { get() { throw Object.assign(new Error("unknown"), { code: "SOURCE_IDENTITY_DRIFT" }); } });
  await assert.rejects(run({ target: "production", ...output }, {
    state: source.state, readLive: async (id) => source.byProduct.get(id),
  }), (error) => isPermanentSourceError(error) && Boolean(error.detail.identity));
  const report = JSON.parse(fs.readFileSync(output.report));
  assert.equal(report.normalization_complete, false);
  assert.equal(report.post_capture_errors.filter((e) => e.permanent).length, 9);
  assert.ok(report.post_capture_errors.some((e) => e.permanent === false));
  assert.equal(report.source_error.permanent, true);
  assert.equal(report.executable_plan_count, 0);
  assert.equal(fs.existsSync(output.artifact), false);
});

test("actual Bash source retry loop invokes CLI once for post-capture identity BLOCK, five times for unknown failure", () => {
  const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/six-pack-offer-refresh.yml"), "utf8");
  const loop = workflow.match(/for attempt in 1 2 3 4 5; do[\s\S]*?\n          done/)[0]
    .replace(/node scripts\/six-pack-offer-refresh\.js \\\r?\n[\s\S]*?"\$\{reviewed_args\[@\]\}" && break/, 'node "$OFFLINE_RUNNER" && break');
  assert.ok(loop.includes('node "$OFFLINE_RUNNER" && break'));
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  for (const mode of ["identity", "unknown"]) {
    const output = paths(), dir = path.dirname(output.report), runner = `${output.report}-runner.cjs`, countFile = `${output.report}-calls.txt`;
    fs.mkdirSync(dir, { recursive: true });
    const source = conflictingIdentityFixture();
    fs.writeFileSync(`${runner}.json`, JSON.stringify({ state: source.state, pages: Object.fromEntries(source.byProduct) }));
    fs.writeFileSync(runner, `const fs=require('node:fs');const config=require(${JSON.stringify(path.join(ROOT, "config/retailers/six-pack-supplements-woocommerce.json"))});
Object.assign(config.automation,${JSON.stringify(legacyRuntimeConfig.automation)});config.guardrails.required_matched_offers=506;
const {main}=require(${JSON.stringify(path.join(__dirname, "six-pack-offer-refresh.js"))});
const data=JSON.parse(fs.readFileSync(__filename+'.json'));fs.appendFileSync(${JSON.stringify(countFile)},'START\\n');
main(${JSON.stringify({ target: "production", ...output })},{state:data.state,readLive:async id=>{
fs.appendFileSync(${JSON.stringify(countFile)},id+'\\n');
if(process.env.OFFLINE_MODE==='unknown')throw Object.assign(new Error('unknown'),{code:'SOURCE_IDENTITY_DRIFT'});
return data.pages[id];}});`);
    const child = spawnSync(bash, ["--noprofile", "--norc", "-c", `set -e\nsleep() { :; }\n${loop}`], {
      cwd: ROOT, env: { ...process.env, OFFLINE_RUNNER: runner.replaceAll("\\", "/"), OFFLINE_MODE: mode }, encoding: "utf8", timeout: 30_000,
    });
    assert.ifError(child.error);
    assert.equal(child.status, mode === "identity" ? 2 : 1, child.stdout + child.stderr);
    const calls = fs.readFileSync(countFile, "utf8").trim().split("\n");
    assert.equal(calls.filter((v) => v === "START").length, mode === "identity" ? 1 : 5);
    assert.equal(calls.filter((v) => v !== "START").length, mode === "identity" ? 279 : 5);
    assert.equal(fs.existsSync(output.artifact), false);
    const report = JSON.parse(fs.readFileSync(output.report));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.database_writes, 0);
  }
});

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
  for (const record of source.state.records.filter((row) => row.mapping.external_product_id === "2769")) {
    const approved = approvedWarriorBindings.find(([id]) => id === record.mapping.external_variant_id);
    record.mapping.external_options = { Pack: "12", Flavour: approved[4] };
    Object.assign(record.variant, { size_value: "64", size_unit: "g", pack_count: 12 });
  }
  const before = structuredClone(source.state);
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
  assert.deepEqual(report.source_error.sales_unit_binding, wildcardIssue);
  assert.deepEqual(source.state, before);
  assert.equal(fs.existsSync(output.artifact), false);
});

const completeWildcardHtml = `<!doctype html><html>${incompleteHtml}</html>`;
function wildcardRead(html = completeWildcardHtml, changeError = null) {
  return async (id, context) => {
    try {
      return await readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: id,
        capturedAt: context?.capturedAt, maximumAttempts: 1, parseProductPage: parseSixPackProductPage,
        fetchImpl: async () => ({ status: 200, url: incompleteOptions.canonicalUrl,
          headers: { get: () => "text/html" }, text: async () => html }) });
    } catch (error) { if (changeError) changeError(error); throw error; }
  };
}

test("captured complete omitted variants flow through full approved-scope classification and sealing beside Warrior isolation", async () => {
  const source = fixture(), output = paths();
  const live = parseSixPackProductPage(omittedHtml, omittedOptions);
  for (const record of source.state.records.filter((r) => r.mapping.external_product_id === "6582")) {
    const row = live.variations.find((v) => v.external_variant_id === record.mapping.external_variant_id);
    assert.ok(row);
    record.mapping.external_name = live.product_name;
    record.mapping.external_url = live.canonical_url;
    record.mapping.external_options = { Flavour: row.attributes.attribute_flavour };
    Object.assign(record.variant, { flavour_label: row.attributes.attribute_flavour,
      display_name: row.attributes.attribute_flavour });
    Object.assign(record.offer, { price: row.price, shipping_cost: "4.99", total_price: "20.98",
      in_stock: row.in_stock, url: live.canonical_url });
  }
  const before = structuredClone(source.state);
  const result = await run({ target: "production", ...output, isolateUnsafe: true }, {
    state: source.state, readLive: async (id, context) => String(id) === "2769" ? wildcardRead()(id, context)
      : String(id) === "6582" ? live : source.byProduct.get(String(id)),
  });
  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.equal(result.report.approved_mapping_count, 506);
  assert.equal(result.report.executable_plan_count, 499);
  assert.equal(result.report.review_row_count, 7);
  assert.equal(result.report.blocked_row_count, 0);
  assert.equal(result.report.database_writes, 0);
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.doesNotThrow(() => require("./six-pack-offer-refresh-executor").validateArtifactScope(artifact, manifest));
  const capturedRows = artifact.source_rows.filter((r) => r.normalized_source_row.source.external_product_id === "6582");
  assert.equal(capturedRows.length, 5);
  const warriorOffers = new Set(approvedWarriorBindings.map(([, id]) => id));
  assert.ok(artifact.plans.every((r) => !warriorOffers.has(String(r.resolved_plan.offer.id))));
  assert.ok(result.report.review_rows.every((r) => r.proposed_offer === null));
  assert.deepEqual(source.state, before);
});

for (const mode of ["wildcard", "variable", "simple"]) test(mode === "simple"
  ? "complete offline scope: 506 = 495 executable + 11 unchanged Warrior/variable/simple review"
  : mode === "variable"
  ? "complete offline scope: 506 = 496 executable + 10 unchanged Warrior/unbuyable review"
  : "complete approved wildcard product uses existing isolation: 506 = 499 executable + 7 unchanged review", async () => {
  const includeSimple = mode === "simple", includeUnbuyable = mode !== "wildcard";
  const source = includeSimple ? simpleFixture() : includeUnbuyable ? unbuyableFixture() : fixture();
  const executableCount = includeSimple ? 495 : includeUnbuyable ? 496 : 499, reviewCount = 506 - executableCount;
  for (const record of source.state.records.filter((row) => row.mapping.external_product_id === "2769")) {
    const binding = approvedWarriorBindings.find(([id]) => id === record.mapping.external_variant_id);
    record.mapping.external_options = { Pack: "12", Flavour: binding[4] };
    Object.assign(record.variant, { size_value: "64", size_unit: "g", pack_count: 12 });
  }
  const before = structuredClone(source.state);
  const output = paths();
  const result = await run({ target: "production", ...output, isolateUnsafe: true }, {
    state: source.state,
    readLive: async (id, context) => String(id) === "2769" ? wildcardRead()(id, context)
      : includeSimple && String(id) === "2819" ? simpleRead()(id, context)
      : includeUnbuyable && String(id) === "28570" ? unbuyableRead()(id, context) : source.byProduct.get(String(id)),
  });
  assert.equal(result.report.result, "PASS_WITH_REVIEW");
  assert.equal(result.report.approved_mapping_count, 506);
  assert.equal(result.report.executable_plan_count, executableCount);
  assert.equal(result.report.review_row_count, reviewCount);
  assert.equal(result.report.blocked_row_count, 0);
  assert.equal(result.report.attempted_product_page_count, 279);
  assert.equal(result.report.source_failure_count, includeSimple ? 3 : includeUnbuyable ? 2 : 1);
  assert.equal(result.report.database_writes, 0);
  assert.equal(result.report.executed_plan_count, 0);
  const failure = result.report.source_failures.find((row) => row.product_id === "2769");
  assert.equal(failure.disposition, wildcardIssue.reason_code);
  assert.equal(failure.manifest_sha256, result.report.manifest_sha256);
  assert.deepEqual(failure.approved_variation_ids, wildcardIssue.variation_ids);
  assert.equal(failure.source_document.html, completeWildcardHtml);
  assert.equal(failure.source_document.html_sha256, crypto.createHash("sha256").update(completeWildcardHtml).digest("hex"));
  if (includeUnbuyable) {
    const retained = JSON.parse(fs.readFileSync(output.report, "utf8")).source_failures
      .filter((row) => row.product_id === "28570");
    assert.equal(retained.length, 1);
    assert.equal(retained[0].disposition, unbuyableReason);
    assert.deepEqual(retained[0].approved_variation_ids, ["29091", "29094", "29097"]);
    assert.equal(retained[0].manifest_sha256, result.report.manifest_sha256);
    assert.equal(retained[0].source_document.html, unbuyableHtml);
    assert.equal(retained[0].source_document.captured_at, result.report.source_captured_at);
    assert.equal(retained[0].source_document.html_bytes, Buffer.byteLength(unbuyableHtml));
    assert.equal(retained[0].source_document.html_sha256, crypto.createHash("sha256").update(unbuyableHtml).digest("hex"));
  }
  const reviewedIds = new Set([...approvedWarriorBindings.map(([, id]) => id),
    ...(includeUnbuyable ? ["2427", "2428", "2429"] : []), ...(includeSimple ? ["2055"] : [])]);
  assert.deepEqual(new Set(result.report.review_rows.map((row) => row.offer_id)), reviewedIds);
  for (const row of result.report.review_rows) {
    assert.equal(row.proposed_offer, null);
    assert.equal(row.changed_fields.price, false);
    assert.equal(row.changed_fields.stock, false);
    assert.equal(row.source_failure.disposition, row.external_product_id === "2819" ? simpleReason : row.external_product_id === "28570" ? unbuyableReason : wildcardIssue.reason_code);
    assert.equal(row.source_failure.source_document.html, undefined);
  }
  const artifact = loadDryRunArtifact(output.artifact).artifact;
  assert.equal(artifact.plans.length, executableCount);
  assert.doesNotThrow(() => require("./six-pack-offer-refresh-executor").validateArtifactScope(artifact, manifest));
  assert.ok(artifact.plans.every((row) => !reviewedIds.has(String(row.resolved_plan.offer.id))));
  assert.ok(artifact.source_rows.every((row) => row.normalized_source_row.source.external_product_id !== "2769"));
  if (includeUnbuyable) assert.ok(artifact.source_rows.every((row) => row.normalized_source_row.source.external_product_id !== "28570"));
  if (includeSimple) {
    assert.ok(artifact.source_rows.every((row) => row.normalized_source_row.source.external_product_id !== "2819"));
    const failure = result.report.source_failures.find(row => row.product_id === "2819");
    assert.equal(failure.disposition, simpleReason);
    assert.deepEqual(failure.identity.observed_capsule_qualifiers, ["vegetarian"]);
  }
  assert.deepEqual(source.state, before);

  const { baselineHash, verifyPostflight } = require("./retailer-offer-refresh-postflight");
  const snapshot = { row_count: 506, price_history_count: 0, business_price_history_count: 0, daily_confirmation_count: 0,
    rows: before.records.map(({ mapping: m, offer: o }) => ({
      mapping_id: String(m.id), retailer_id: "11", mapping_product_id: String(m.product_id), mapping_variant_id: String(m.product_variant_id),
      external_product_id: m.external_product_id, external_variant_id: m.external_variant_id, external_sku: m.external_sku,
      external_gtin: m.external_gtin, external_options: m.external_options, external_url: m.external_url,
      offer_id: String(o.id), offer_product_id: String(o.product_id), offer_variant_id: String(o.product_variant_id),
      price: o.price, shipping_cost: o.shipping_cost, total_price: o.total_price, in_stock: o.in_stock, url: o.url,
      last_checked_at: o.last_checked_at,
    })) };
  const baseline = { kind: "retailer-offer-refresh-db-baseline", result: "PASS", profile: "six-pack-supplements", snapshot };
  baseline.evidence_hash = baselineHash(baseline);
  const after = structuredClone(snapshot);
  for (const row of after.rows) if (!reviewedIds.has(row.offer_id)) row.last_checked_at = result.report.source_captured_at;
  const execution = { ...result.report, executed_plan_count: executableCount,
    execution_offer_ids: artifact.plans.map((row) => String(row.resolved_plan.offer.id)) };
  assert.equal(verifyPostflight(baseline, after, execution).result, "PASS");
  for (const [field, value] of [["last_checked_at", result.report.source_captured_at], ["price", "1.99"], ["in_stock", false]]) {
    const changed = structuredClone(after);
    changed.rows.find((row) => reviewedIds.has(row.offer_id))[field] = value;
    assert.throws(() => verifyPostflight(baseline, changed, execution), /Review offer .* changed/);
  }
  for (const record of source.state.records) if (!reviewedIds.has(String(record.offer.id))) {
    record.offer.last_checked_at = result.report.source_captured_at;
  }
  const second = await run({ target: "production", ...paths(), isolateUnsafe: true }, {
    state: source.state,
    readLive: async (id, context) => String(id) === "2769" ? wildcardRead()(id, context)
      : includeSimple && String(id) === "2819" ? simpleRead()(id, context)
      : includeUnbuyable && String(id) === "28570" ? unbuyableRead()(id, context) : source.byProduct.get(String(id)),
  });
  assert.deepEqual(second.report.action_counts, { VERIFY_NO_CHANGE: executableCount });
  assert.deepEqual(new Set(second.report.review_rows.map((row) => row.offer_id)), reviewedIds);
  assert.equal(second.report.database_writes, 0);

  const profile = require("./lib/automation-review-publication-profiles").PROFILES["six-pack-supplements"];
  const captureContext = { report: result.report, diagnostic: null, files: { artifact: output.artifact }, invariant: assert.ok };
  profile.validateCapture(profile, captureContext);
  assert.throws(() => profile.validateCapture(profile, { ...captureContext,
    report: { ...result.report, source_snapshot_fingerprint: "f".repeat(64) } }), /source binding drifted/);
  const baselineByOffer = new Map(snapshot.rows.map((row) => [row.offer_id, row]));
  const partition = profile.validate(profile, { report: result.report, baselineByOffer,
    files: { artifact: output.artifact }, invariant: assert.ok, sortedIds: (ids) => [...new Set(ids.map(String))].sort((a, b) => Number(a) - Number(b)) });
  assert.equal(partition.executableCount, executableCount);
  assert.equal(partition.changedRows.length, reviewCount);
  profile.validateChangedRows(profile, partition.changedRows, assert.ok);
  for (const changed of partition.changedRows) {
    const card = profile.reviewCard({}, changed);
    assert.equal(card.sourcePrice, null);
    assert.equal(card.evidenceReason, changed.external_product_id === "2819" ? simpleReason : changed.external_product_id === "28570" ? unbuyableReason : wildcardIssue.reason_code);
    assert.equal(card.proposedState.price, undefined);
    assert.equal(card.proposedState.in_stock, undefined);
    assert.equal(card.proposedState.last_checked_at, undefined);
    assert.equal(card.operationType, "MANUAL_REVIEW_IDENTITY");
    assert.equal(card.proposedState.automatic_action, false);
  }
});

test("only complete product-bound, fresh, manifest-closed wildcard evidence is product-scoped", async () => {
  const capturedAt = new Date().toISOString();
  let failure;
  try { await wildcardRead()("2769", { capturedAt }); } catch (error) { failure = error; }
  assert.ok(failure);
  const approved = loadApprovedManifest();
  assert.equal(approvedSourceFailureDisposition(failure, "2769", approved, capturedAt).scope, "PRODUCT");
  const issue = () => failure.cause.detail;
  const original = structuredClone(issue());
  for (const change of [
    (d) => { d.reason_code = "UNKNOWN"; },
    (d) => { d.product_id = "99999"; },
    (d) => { d.variation_ids.pop(); },
    (d) => { d.variation_ids[0] = "99999"; },
    (d) => { d.wildcard_attributes = ["attribute_flavours"]; },
    (d) => { d.source_document.http_status = 404; },
    (d) => { d.source_document.body_complete = false; },
    (d) => { d.source_document.html_sha256 = "f".repeat(64); },
    (d) => { d.source_document.html_bytes += 1; },
    (d) => { d.source_document.html += "truncated"; },
    (d) => { d.source_document.variation_ids.pop(); },
    (d) => { d.source_document.captured_at = "2026-01-01T00:00:00Z"; },
    (d) => { d.source_document.request_url = "https://other.example/?p=2769"; },
    (d) => { d.source_document.response_url = "https://other.example/product/warrior/"; },
    (d) => { d.source_document.content_type = "application/json"; },
  ]) {
    failure.cause.detail = structuredClone(original);
    change(issue());
    assert.equal(approvedSourceFailureDisposition(failure, "2769", approved, capturedAt).scope, "RETAILER");
  }
  failure.cause.detail = original;
  for (const key of ["timeout", "network_code", "product_id", "http_status"]) {
    const previous = failure.detail[key];
    failure.detail[key] = { timeout: true, network_code: "ECONNRESET", product_id: "99999", http_status: 503 }[key];
    assert.equal(approvedSourceFailureDisposition(failure, "2769", approved, capturedAt).scope, "RETAILER");
    failure.detail[key] = previous;
  }
  assert.equal(approvedSourceFailureDisposition(failure, "2769", { ...approved, sha256: "f".repeat(64) }, capturedAt).scope, "RETAILER");
  assert.equal(approvedSourceFailureDisposition(failure, "2769", approved, "2026-01-01T00:00:00Z").scope, "RETAILER");

  const groups = new Map();
  for (const row of manifest.rows) {
    if (!groups.has(row.external_product_id)) groups.set(row.external_product_id, []);
    groups.get(row.external_product_id).push(row);
  }
  const [otherId, bindings] = [...groups].find(([id, rows]) => id !== "2769"
    && rows.length > 1 && rows.length < 7 && rows.every((row) => row.external_variant_id !== id)
    && !manifest.rows.some((row) => row.external_product_id !== id
      && rows.some((inside) => row.canonical_variant_id === inside.canonical_variant_id)));
  const otherHtml = `<!doctype html><html>${changeWildcardHtml((p) => {
    p.variations = p.variations.slice(0, bindings.length);
    p.variations.forEach((row, index) => { row.id = Number(bindings[index].external_variant_id); });
  }, (g) => {
    const group = g['@graph'].find((node) => node['@type'] === "ProductGroup");
    group.hasVariant = group.hasVariant.slice(0, bindings.length);
    group.hasVariant.forEach((row, index) => {
      row.sku = bindings[index].external_variant_id;
      row['@id'] = row['@id'].replace(/#variant-\d+$/, `#variant-${row.sku}`);
    });
  }).replace("postid-2769", `postid-${otherId}`).replace("&quot;productId&quot;:2769", `&quot;productId&quot;:${otherId}`)}</html>`;
  let otherFailure;
  try { await wildcardRead(otherHtml)(otherId, { capturedAt }); } catch (error) { otherFailure = error; }
  assert.equal(approvedSourceFailureDisposition(otherFailure, otherId, approved, capturedAt).scope, "PRODUCT");
});

test("other schema, identity, duplicates, unknown wildcards and incomplete documents keep retailer-wide BLOCK", async () => {
  const graphProduct = (graph) => graph['@graph'].find((node) => node['@type'] === "ProductGroup");
  const full = (html) => `<!doctype html><html>${html}</html>`;
  const cases = [
    completeWildcardHtml.replace("postid-2769", "postid-99999"),
    full(changeWildcardHtml((p) => { p.variations.push(p.variations[0]); })),
    full(changeWildcardHtml((p) => { delete p.variations[0].attributes.attribute_size; })),
    full(changeWildcardHtml((p) => { p.variations[0].attributes.attribute_flavours = "Unknown"; })),
    full(changeWildcardHtml(() => {}, (g) => { graphProduct(g).hasVariant[0].sku = "wrong"; })),
    full(changeWildcardHtml(() => {}, (g) => { graphProduct(g).hasVariant[0].url = "https://other.example/product/"; })),
    full(changeWildcardHtml((p) => { p.variations[0].id = 99999; }, (g) => {
      const v = graphProduct(g).hasVariant[0]; v.sku = "99999"; v['@id'] = v['@id'].replace("3290", "99999");
    })),
    full(changeWildcardHtml((p) => { p.variations[0].attributes.attribute_size = "12pcs"; })),
    ...["price", "in_stock"].map((field) => full(changeWildcardHtml((p) => {
      const extra = structuredClone(p.variations[0]); extra.id = 99999; extra.attributes.attribute_size = "1pcs";
      extra[field] = field === "price" ? 1.99 : true; p.variations.push(extra);
    }))),
    incompleteHtml,
    completeWildcardHtml.slice(0, -8),
  ];
  for (const html of cases) {
    const source = fixture(), output = paths();
    await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
      state: source.state, readLive: async (id, context) => String(id) === "2769"
        ? wildcardRead(html)(id, context) : source.byProduct.get(String(id)),
    }));
    const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.executable_plan_count, 0);
    assert.equal(report.review_row_count, 0);
    assert.equal(report.database_writes, 0);
    assert.equal(fs.existsSync(output.artifact), false);
  }
});

test("wildcard isolation does not weaken source collapse or the isolateUnsafe switch", async () => {
  for (const isolateUnsafe of [false, true]) {
    const source = fixture(), output = paths();
    const otherFailures = new Set([...source.byProduct.keys()].filter((id) => id !== "2769").slice(0, 28));
    await assert.rejects(run({ target: "production", ...output, isolateUnsafe }, {
      state: source.state, readLive: async (id, context) => {
        if (String(id) === "2769") return wildcardRead()(id, context);
        if (isolateUnsafe && otherFailures.has(String(id))) throw new WooCommerceSourceError("SOURCE_HTTP_ERROR", "404", {
          product_id: String(id), http_status: 404, network_code: null, timeout: false,
        });
        return source.byProduct.get(String(id));
      },
    }));
    const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.executable_plan_count, 0);
    assert.equal(report.database_writes, 0);
    assert.equal(fs.existsSync(output.artifact), false);
    assert.equal(report.block_reason, isolateUnsafe ? "SOURCE_COLLAPSE" : "SOURCE_SCHEMA_MISMATCH");
  }
});

test("incomplete HTTP reads, bad redirects, wrong origin and wrong content type cannot become wildcard review", async () => {
  for (const response of [
    { status: 200, url: incompleteOptions.canonicalUrl, headers: { get: () => "text/html" },
      text: async () => { throw Object.assign(new Error("incomplete"), { code: "ECONNRESET" }); } },
    { status: 200, url: "https://other.example/product/warrior/", headers: { get: () => "text/html" }, text: async () => completeWildcardHtml },
    { status: 404, url: "https://other.example/product/warrior/", headers: { get: () => "text/html" }, text: async () => completeWildcardHtml },
    { status: 404, url: "https://6pack-supplements.co.uk/cart/", headers: { get: () => "text/html" }, text: async () => completeWildcardHtml },
    { status: 200, url: "https://6pack-supplements.co.uk:8443/product/warrior/", headers: { get: () => "text/html" }, text: async () => completeWildcardHtml },
    { status: 200, url: "https://6pack-supplements.co.uk/cart/", headers: { get: () => "text/html" }, text: async () => completeWildcardHtml },
    { status: 200, url: incompleteOptions.canonicalUrl, headers: { get: () => "text/plain" }, text: async () => completeWildcardHtml },
  ]) {
    const source = fixture(), output = paths();
    await assert.rejects(run({ target: "production", ...output, isolateUnsafe: true }, {
      state: source.state, readLive: async (id, context) => String(id) === "2769"
        ? readWooCommerceProductPage({ storeUrl: "https://6pack-supplements.co.uk", productId: id, capturedAt: context.capturedAt,
          maximumAttempts: 1, parseProductPage: parseSixPackProductPage, fetchImpl: async () => response })
        : source.byProduct.get(String(id)),
    }));
    const report = JSON.parse(fs.readFileSync(output.report, "utf8"));
    assert.equal(report.result, "BLOCK");
    assert.equal(report.executable_plan_count, 0);
    assert.equal(report.review_row_count, 0);
    assert.equal(report.database_writes, 0);
    assert.equal(fs.existsSync(output.artifact), false);
  }
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
