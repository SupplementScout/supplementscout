const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
}

const consent = loadTypeScriptModule("app/lib/analyticsConsent.ts");
const analytics = loadTypeScriptModule("app/lib/analytics.ts");
const layoutSource = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
const componentSource = fs.readFileSync(path.join(process.cwd(), "app/components/AnalyticsConsent.tsx"), "utf8");
const offerLinkSource = fs.readFileSync(path.join(process.cwd(), "app/components/ProductAnalytics.tsx"), "utf8");
const nextConfigSource = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

test("Consent Mode v2 defaults deny analytics and every advertising signal", () => {
  assert.match(layoutSource, /analytics_storage:\"denied\"/);
  for (const field of ["ad_storage", "ad_user_data", "ad_personalization"]) assert.match(layoutSource, new RegExp(`${field}:\\"denied\\"`));
  assert.match(layoutSource, /strategy="beforeInteractive"/);
});

test("consent preference persists and invalid storage values fail closed", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  assert.equal(consent.readAnalyticsConsent(storage), null);
  assert.equal(consent.persistAnalyticsConsent(storage, "accepted"), true);
  assert.equal(consent.readAnalyticsConsent(storage), "accepted");
  values.set(consent.ANALYTICS_CONSENT_STORAGE_KEY, "invalid");
  assert.equal(consent.readAnalyticsConsent(storage), null);
});

test("accept grants only analytics while reject and withdrawal deny it", () => {
  assert.deepEqual(consent.googleConsentUpdate("accepted"), { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  assert.deepEqual(consent.googleConsentUpdate("rejected"), { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
});

test("missing or invalid Measurement ID safely disables analytics", () => {
  assert.equal(consent.isAnalyticsAvailable(true, ""), false);
  assert.equal(consent.isAnalyticsAvailable(true, "G-TEST123"), true);
  assert.equal(consent.isAnalyticsAvailable(false, "G-TEST123"), false);
});

test("Google tag loads only for accepted analytics and settings can reopen", () => {
  assert.match(componentSource, /analyticsAvailable && preference === "accepted"/);
  assert.match(componentSource, /Reject non-essential/);
  assert.match(componentSource, /Accept all/);
  assert.match(componentSource, /Manage preferences/);
  assert.match(componentSource, /Cookie settings/);
  assert.match(componentSource, /clearAnalyticsCookies/);
});

test("page-view routing deduplicates the current navigation and suppresses raw query text", () => {
  assert.equal(consent.shouldTrackRoute(null, "/creatine?", true), true);
  assert.equal(consent.shouldTrackRoute("/creatine?", "/creatine?", true), false);
  assert.equal(consent.shouldTrackRoute("/creatine?", "/hydration?", true), true);
  assert.match(componentSource, /send_page_view: false/);
  assert.match(componentSource, /page_location: `\$\{window\.location\.origin\}\$\{pathname\}`/);
  assert.doesNotMatch(componentSource, /page_location:[^\n]*searchParams/);
});

test("analytics events remain denied before consent and after withdrawal", () => {
  const calls = [];
  global.window = { __supplementScoutAnalyticsConsent: "denied", __supplementScoutAnalyticsReady: true, gtag: (...args) => calls.push(args) };
  assert.equal(analytics.sendAnalyticsEvent("view_category", { category: "Creatine", source_page: "/creatine" }), false);
  assert.equal(calls.length, 0);
  delete global.window;
});

test("retailer_offer_click emits exactly once with its non-personal payload", () => {
  const calls = [];
  global.window = { __supplementScoutAnalyticsConsent: "granted", __supplementScoutAnalyticsReady: true, gtag: (...args) => calls.push(args) };
  const payload = { product_id: "7", product_name: "Example Creatine", variant_id: "9", category: "Creatine", retailer_id: "10", retailer_name: "Retailer", offer_price: 12.99, position: 1, source_page: "product_offer_list", is_affiliate: false };
  assert.equal(analytics.sendAnalyticsEvent("retailer_offer_click", payload), true);
  assert.deepEqual(calls, [["event", "retailer_offer_click", payload]]);
  delete global.window;
});

test("analytics failure is swallowed and cannot block the existing retailer anchor", () => {
  global.window = { __supplementScoutAnalyticsConsent: "granted", __supplementScoutAnalyticsReady: true, gtag: () => { throw new Error("offline"); } };
  assert.equal(analytics.sendAnalyticsEvent("retailer_offer_click", { product_id: "7", product_name: "Example", position: 1, source_page: "product_best_offer", is_affiliate: false }), false);
  assert.match(offerLinkSource, /href=\{href\}/);
  assert.doesNotMatch(offerLinkSource, /preventDefault/);
  delete global.window;
});

test("custom event schema exposes no personal-data parameter names", () => {
  const keys = Object.values(analytics.ANALYTICS_EVENT_PARAMETER_KEYS).flat();
  for (const prohibited of ["email", "name", "telephone", "phone", "address", "ip", "query", "search_term"]) {
    assert.equal(keys.includes(prohibited), false, prohibited);
  }
  assert.deepEqual(analytics.ANALYTICS_EVENT_PARAMETER_KEYS.search, ["result_count", "has_filters", "search_context"]);
});

test("CSP permits only the GA script and collection endpoints required", () => {
  assert.match(nextConfigSource, /script-src[^\n]*https:\/\/www\.googletagmanager\.com/);
  assert.match(nextConfigSource, /connect-src[^\n]*https:\/\/www\.google-analytics\.com https:\/\/region1\.google-analytics\.com/);
  assert.doesNotMatch(nextConfigSource, /googleadservices|doubleclick|googlesyndication/);
  assert.match(nextConfigSource, /frame-src https:\/\/tally\.so/);
});
