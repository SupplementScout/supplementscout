const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const ROOT = process.cwd();

function compileModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (request) => Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : originalRequire(request);
  mod._compile(outputText, filename);
  return mod.exports;
}

const storage = compileModule(path.join(ROOT, "app/lib/mySupplements.ts"));
const calculations = compileModule(path.join(ROOT, "app/lib/mySupplementsCalculations.ts"), { "./mySupplements": {} });
const pack = compileModule(path.join(ROOT, "app/lib/mySupplementsPack.ts"), { "./mySupplements": {} });

function entry(overrides = {}) {
  return {
    productId: "123",
    slug: "example",
    variantId: "456",
    display: { name: "Example", brand: "Brand", pack: "30 servings" },
    remaining: { amount: 30, unit: "serving" },
    dailyUse: { amount: 1, unit: "serving" },
    countDate: "2026-10-15T12:00:00.000Z",
    reorderBufferDays: 3,
    lastPricePaid: 20,
    currency: "GBP",
    createdAt: "2026-10-15T12:00:00.000Z",
    updatedAt: "2026-10-15T12:00:00.000Z",
    ...overrides,
  };
}

test("local document validates exact variants and fails closed", () => {
  const valid = { version: 1, items: [entry()] };
  assert.deepEqual(storage.parseMySupplementsDocument(JSON.stringify(valid)), valid);
  assert.equal(storage.parseMySupplementsDocument(JSON.stringify({ ...valid, version: 2 })), null);
  assert.equal(storage.parseMySupplementsDocument(JSON.stringify({ version: 1, items: [entry({ variantId: "all" })] })), null);
  assert.equal(storage.parseMySupplementsDocument(JSON.stringify({ version: 1, items: [entry({ dailyUse: { amount: 1, unit: "gram" } })] })), null);
  assert.equal(storage.parseMySupplementsDocument("x".repeat(storage.MY_SUPPLEMENTS_MAX_BYTES + 1)), null);
});

test("storage keeps one owner, preserves creation time and never overwrites on invalid import", () => {
  const current = { version: 1, items: [entry()] };
  const updated = storage.upsertMySupplement(current, entry({ remaining: { amount: 10, unit: "serving" }, createdAt: "2026-10-16T12:00:00.000Z", updatedAt: "2026-10-16T12:00:00.000Z" }));
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].remaining.amount, 10);
  assert.equal(updated.items[0].createdAt, current.items[0].createdAt);
  assert.equal(storage.previewMySupplementsImport('{"version":99}', current), null);
  assert.deepEqual(storage.readMySupplements(null), { version: 1, items: [] });
  assert.equal(storage.persistMySupplements(null, current), false);
  assert.equal(storage.persistMySupplements({ getItem() { return null; }, setItem() { throw new Error("quota"); } }, current), false);
  assert.deepEqual(storage.readMySupplements({ getItem() { throw new Error("blocked"); }, setItem() {} }), { version: 1, items: [] });
});

test("import requires preview and supports explicit merge or replace", () => {
  const current = { version: 1, items: [entry()] };
  const second = entry({ productId: "999", variantId: "888", display: { name: "Second", brand: null, pack: null } });
  const preview = storage.previewMySupplementsImport(JSON.stringify({ version: 1, items: [second] }), current);
  assert.equal(preview.incomingCount, 1);
  assert.equal(preview.newCount, 1);
  assert.equal(storage.applyMySupplementsImport(current, preview.document, "merge").items.length, 2);
  assert.deepEqual(storage.applyMySupplementsImport(current, preview.document, "replace").items, [second]);
});

test("run-out, reorder and recurring cost calculations are deterministic", () => {
  const schedule = calculations.calculateMySupplementSchedule(entry());
  assert.equal(schedule.daysRemaining, 30);
  assert.equal(schedule.runOutAt.toISOString(), "2026-11-14T12:00:00.000Z");
  assert.equal(schedule.reorderAt.toISOString(), "2026-11-11T12:00:00.000Z");
  assert.deepEqual(calculations.calculateRecurringCost({ packAmount: 30, packUnit: "serving", dailyAmount: 1, dailyUnit: "serving", price: 15 }), { daily: 0.5, monthly: 15, yearly: 182.5 });
  assert.equal(calculations.calculateRecurringCost({ packAmount: 30, packUnit: "serving", dailyAmount: 1, dailyUnit: "gram", price: 15 }), null);
  const fractional = calculations.calculateMySupplementSchedule(entry({ remaining: { amount: 2.9, unit: "serving" }, dailyUse: { amount: 1, unit: "serving" } }));
  assert.equal(fractional.daysRemaining, 2);
  assert.equal(fractional.runOutAt.toISOString(), "2026-10-17T12:00:00.000Z");
});

test("pack selection uses verified units and otherwise falls back to one pack", () => {
  assert.deepEqual(pack.selectMySupplementPack({ unitCount: 90, unitType: "capsule", netWeightG: null, servingCount: null, unitPricingVerified: true, variantLabel: "90 caps" }), { packAmount: 90, packUnit: "unit", packLabel: "90 capsules" });
  assert.deepEqual(pack.selectMySupplementPack({ unitCount: null, unitType: null, netWeightG: 500, servingCount: 20, unitPricingVerified: true, variantLabel: "500 g" }), { packAmount: 500, packUnit: "gram", packLabel: "500 g" });
  assert.deepEqual(pack.selectMySupplementPack({ unitCount: null, unitType: null, netWeightG: 500, servingCount: 20, unitPricingVerified: false, variantLabel: "Vanilla" }), { packAmount: 1, packUnit: "pack", packLabel: "Vanilla" });
});

test("public route is private-by-device, noindex and absent from sitemap", () => {
  const page = fs.readFileSync(path.join(ROOT, "app/my-supplements/page.tsx"), "utf8");
  const sitemap = fs.readFileSync(path.join(ROOT, "app/sitemap.ts"), "utf8");
  const route = fs.readFileSync(path.join(ROOT, "app/api/my-supplements/current/route.ts"), "utf8");
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  assert.doesNotMatch(sitemap, /my-supplements/);
  assert.match(route, /MAX_ITEMS = 30/);
  assert.match(route, /private, no-store/);
  assert.match(route, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});

test("implementation reuses shared pricing, freshness, nutrition and exact variant contracts", () => {
  const current = fs.readFileSync(path.join(ROOT, "app/lib/mySupplementsCurrent.server.ts"), "utf8");
  const product = fs.readFileSync(path.join(ROOT, "app/product/[id]/page.tsx"), "utf8");
  const analytics = fs.readFileSync(path.join(ROOT, "app/lib/analytics.ts"), "utf8");
  assert.match(current, /getDeliveredPrice/);
  assert.match(current, /isOfferFresh/);
  assert.match(current, /getEffectiveNutritionMetrics/);
  assert.match(current, /selectMySupplementPack/);
  assert.match(product, /variantId:\s*selectedVariantId/);
  assert.match(product, /SaveToMySupplementsButton/);
  assert.doesNotMatch(analytics, /saved_product_id|saved_variant_id|supplement_name/);
});

test("current endpoint rejects bad input and returns bounded no-store data", async () => {
  const calls = [];
  const route = compileModule(path.join(ROOT, "app/api/my-supplements/current/route.ts"), {
    "../../../lib/mySupplementsCurrent.server": {
      loadMySupplementsCurrent: async (items) => {
        calls.push(items);
        return items.map((item) => ({ ...item, key: `${item.productId}:${item.variantId}` }));
      },
    },
  });
  const bad = await route.POST(new Request("https://example.test/api/my-supplements/current", { method: "POST", body: "{}" }));
  assert.equal(bad.status, 400);
  const valid = await route.POST(new Request("https://example.test/api/my-supplements/current", { method: "POST", body: JSON.stringify({ items: [{ productId: "1", variantId: "2" }] }) }));
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "private, no-store");
  assert.equal(valid.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.deepEqual(calls, [[{ productId: "1", variantId: "2" }]]);
});

