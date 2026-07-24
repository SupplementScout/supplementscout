const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  classifyExistingOffers,
} = require("./lib/retailer-offer-sync/classifier");
const {
  buildExistingOfferUpdatePlan,
} = require("./lib/retailer-offer-sync/existing-offer-plan");
const {
  RefreshError,
  balancedExecutionBatches,
  changeSummary,
  deliveredTotalForSourcePrice,
  guardrailsFor,
  loadManifest,
  parseArgs,
  runWithDiagnostic,
  sourceHealth,
} = require("./whey-okay-offer-refresh");
const config = require("../config/retailers/whey-okay-offer-sync.json");

function target(index, overrides = {}) {
  return {
    offer_id: String(index),
    retailer_product_id: String(index + 1000),
    external_product_id: String(index + 2000),
    external_variant_id: String(index + 3000),
    external_sku: `SKU-${index}`,
    price: "10.00",
    shipping_cost: "3.99",
    total_price: null,
    in_stock: true,
    url: `https://wheyokay.com/item-${index + 2000}-p.asp`,
    external_url: `https://wheyokay.com/item-${index + 2000}-p.asp`,
    last_checked_at: "2026-07-24T01:00:00.000Z",
    ...overrides,
  };
}
function source(row, overrides = {}) {
  return {
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    external_sku: null,
    product_handle: null,
    price: row.price,
    shipping_cost: row.shipping_cost,
    total_price: row.total_price,
    in_stock: row.in_stock,
    url: row.url,
    ...overrides,
  };
}
function policy(required, overrides = {}) {
  return {
    ...config.guardrails,
    required_matched_offers: required,
    store_url: config.store_url,
    ...overrides,
  };
}
function classify(targets, sources, overrides = {}) {
  return classifyExistingOffers({
    targets,
    sourceVariants: sources,
    policy: policy(targets.length, overrides),
    sourceCapturedAt: "2026-07-24T02:00:00.000Z",
    now: new Date("2026-07-24T02:00:00.000Z"),
    sourceProductCount: 520,
    previousSourceProductCount: 520,
  });
}

test("frozen manifest contains exactly 586 unique approved mappings", () => {
  const { manifest, sha256 } = loadManifest();
  assert.equal(sha256, config.manifest_sha256);
  assert.equal(manifest.rows.length, 586);
  assert.equal(new Set(manifest.rows.map((row) => row.source_key)).size, 586);
  assert.equal(
    new Set(
      manifest.rows.map(
        (row) =>
          `${row.canonical_target.product_id}:${JSON.stringify(
            row.canonical_target,
          )}`,
      ),
    ).size,
    586,
  );
  for (const id of [11, 150, 191, 249]) {
    assert.equal(
      manifest.rows.some(
        (row) =>
          row.environment_bindings.staging.mapping_id === id ||
          row.environment_bindings.production.mapping_id === id,
      ),
      false,
    );
  }
  assert.equal(manifest.permanent_q3_q4_exception_count, 80);
});

test("all 586 exact manifest identities classify idempotently", () => {
  const targets = Array.from({ length: 586 }, (_, index) => target(index + 1));
  const result = classify(targets, targets.map((row) => source(row)));
  assert.equal(result.state, "DRY_RUN_READY");
  assert.equal(result.rows.length, 586);
  assert.equal(
    result.rows.filter((row) => row.action === "VERIFY_NO_CHANGE").length,
    586,
  );
});

test("missing approved identity blocks while a new row remains discovery-only", () => {
  const targets = [target(1), target(2)];
  const missing = classify(targets, [source(targets[0])]);
  assert.equal(missing.state, "BLOCKED");
  assert.equal(missing.reason, "IDENTITY_DRIFT");
  const discovery = classify(targets, [
    ...targets.map((row) => source(row)),
    source(target(3)),
  ]);
  assert.equal(discovery.state, "DRY_RUN_READY");
  assert.equal(discovery.rows.length, 2);
});

test("price, stock, return-to-stock and URL changes classify exactly", () => {
  let row = target(1);
  assert.equal(
    classify([row], [source(row, { price: "11.00" })], {
      maximum_changed_record_ratio: 1,
      mass_price_change_block_ratio: 2,
    }).rows[0].action,
    "UPDATE_PRICE",
  );
  assert.equal(
    classify([row], [source(row, { in_stock: false })], {
      mass_oos_block_count: 2,
      maximum_total_oos_ratio: 1,
      maximum_oos_increase_percentage_points: 1,
      maximum_changed_record_ratio: 1,
    }).rows[0].action,
    "UPDATE_STOCK",
  );
  row = target(1, { in_stock: false });
  assert.equal(
    classify([row], [source(row, { in_stock: true })], {
      maximum_changed_record_ratio: 1,
    }).rows[0].action,
    "UPDATE_STOCK",
  );
  row = target(1);
  assert.equal(
    classify(
      [row],
      [source(row, { url: "https://wheyokay.com/new-item-2001-p.asp" })],
      { maximum_changed_record_ratio: 1 },
    )
      .rows[0].action,
    "UPDATE_URL",
  );
});

test("source collapse, MASS_OOS, MASS_PRICE and MASS_CHANGE fail closed", () => {
  const rows = Array.from({ length: 10 }, (_, index) => target(index + 1));
  const collapsed = classifyExistingOffers({
    targets: rows,
    sourceVariants: rows.map((row) => source(row)),
    policy: policy(10),
    sourceCapturedAt: "2026-07-24T02:00:00Z",
    now: new Date("2026-07-24T02:00:00Z"),
    sourceProductCount: 100,
    previousSourceProductCount: 520,
  });
  assert.equal(collapsed.reason, "SOURCE_COLLAPSE");
  assert.equal(
    classify(
      rows,
      rows.map((row) => source(row, { in_stock: false })),
    ).reason,
    "MASS_OOS",
  );
  assert.equal(
    classify(
      rows,
      rows.map((row, index) =>
        source(row, { price: index < 2 ? "11.00" : "10.00" }),
      ),
      { maximum_changed_record_ratio: 1 },
    ).reason,
    "MASS_PRICE",
  );
  assert.equal(
    classify(
      rows,
      rows.map((row, index) =>
        source(row, { in_stock: index < 3 ? false : true }),
      ),
      {
        mass_oos_block_count: 10,
        maximum_total_oos_ratio: 1,
        maximum_oos_increase_percentage_points: 1,
      },
    ).reason,
    "MASS_CHANGE",
  );
});

test("a genuine price update preserves shipping and calculates delivered total", () => {
  const state = {
    product: {
      id: 1,
      name: "Test",
      is_active: true,
      merged_into_product_id: null,
      product_format: "powder",
    },
    variant: {
      id: 2,
      product_id: 1,
      variant_key: "default",
      display_name: "Default",
      flavour_code: null,
      flavour_label: null,
      size_value: null,
      size_unit: null,
      pack_count: null,
      product_format: "powder",
      is_active: true,
      is_default: true,
    },
    retailer: {
      id: 3,
      name: "Whey Okay",
      slug: "whey-okay",
      website: "https://wheyokay.com",
    },
    mapping: {
      id: 4,
      retailer_id: 3,
      product_id: 1,
      product_variant_id: 2,
      external_product_id: "100",
      external_variant_id: "101",
      external_sku: null,
      external_options: null,
      external_name: "Test",
      external_slug: "test",
      external_gtin: null,
      external_url: "https://wheyokay.com/test-100-p.asp",
      match_method: "EXACT",
      match_confidence: "1",
      updated_at: "2026-07-24T01:00:00.000Z",
    },
    offer: {
      id: 5,
      product_id: 1,
      retailer_id: 3,
      product_variant_id: 2,
      retailer_product_id: 4,
      price: "10.00",
      shipping_cost: "3.99",
      total_price: null,
      in_stock: true,
      url: "https://wheyokay.com/test-100-p.asp",
      last_checked_at: "2026-07-24T01:00:00.000Z",
    },
  };
  const built = buildExistingOfferUpdatePlan({
    ...state,
    source: {
      external_product_id: "100",
      external_variant_id: "101",
      price: "11.00",
      shipping_cost: "3.99",
      total_price: deliveredTotalForSourcePrice("11.00", {
        price: state.offer.price,
        shipping_cost: state.offer.shipping_cost,
        total_price: state.offer.total_price,
      }),
      in_stock: true,
      url: state.offer.url,
    },
    sourceCapturedAt: "2026-07-24T02:00:00Z",
    sourceSnapshotFingerprint: "a".repeat(64),
  });
  assert.equal(built.plan.offer.values.shipping_cost, "3.99");
  assert.equal(built.plan.offer.values.total_price, "14.99");
  assert.equal(built.plan.price_history.action, "create");
});

test("delivered total remains untouched when the source price does not change", () => {
  assert.equal(
    deliveredTotalForSourcePrice("10.00", {
      price: "10.00",
      shipping_cost: "3.99",
      total_price: null,
    }),
    null,
  );
});

test("URL updates bind both mapping and offer to the approved source URL", () => {
  const row = target(1);
  const result = classify(
    [row],
    [source(row, { url: "https://wheyokay.com/new-item-2001-p.asp" })],
    { maximum_changed_record_ratio: 1 },
  );
  assert.equal(result.rows[0].changed_fields.url, true);
});

test("source health separates healthy, degraded and collapsed feeds", () => {
  assert.equal(
    sourceHealth({ product_count: 520, row_count: 1678 }).result,
    "PASS",
  );
  assert.equal(
    sourceHealth({ product_count: 460, row_count: 1500 }).code,
    "SOURCE_DEGRADED",
  );
  assert.equal(
    sourceHealth({ product_count: 100, row_count: 200 }).code,
    "GENUINE_SOURCE_COLLAPSE",
  );
});

test("execution batches distribute current and new OOS rows without weakening guards", () => {
  const rows = Array.from({ length: 586 }, (_, index) => {
    const previousInStock = index >= 59;
    const nextInStock = index >= 62;
    return {
      offer_id: String(index + 1),
      atomic_plan: {
        expected_state: { offer: { in_stock: previousInStock } },
        offer: { values: { in_stock: nextInStock } },
      },
    };
  });
  const batches = balancedExecutionBatches(rows, 50);
  assert.equal(batches.length, 12);
  assert.equal(
    batches.reduce((count, batch) => count + batch.length, 0),
    586,
  );
  assert.equal(
    new Set(batches.flat().map((row) => row.offer_id)).size,
    586,
  );
  for (const batch of batches) {
    assert.ok(batch.length <= 50);
    assert.ok(
      batch.filter((row) => !row.atomic_plan.offer.values.in_stock).length /
        batch.length <
        0.2,
    );
    assert.ok(
      batch.filter(
        (row) =>
          row.atomic_plan.expected_state.offer.in_stock &&
          !row.atomic_plan.offer.values.in_stock,
      ).length <= 1,
    );
  }
});

test("change summary reads sealed execution rows with their atomic plans", () => {
  assert.deepEqual(
    changeSummary([
      {
        action: "UPDATE_STOCK",
        external_product_id: "100",
        external_variant_id: "101",
        retailer_product_id: "4",
        offer_id: "5",
        changed_fields: {
          price: false,
          stock: true,
          url: false,
          blocked: false,
        },
        atomic_plan: {
          expected_state: { offer: { in_stock: true } },
          offer: { values: { in_stock: false } },
        },
      },
    ]),
    [
      {
        source_key: "100:101",
        mapping_id: "4",
        offer_id: "5",
        action: "UPDATE_STOCK",
        changed_fields: {
          price: false,
          stock: true,
          url: false,
          blocked: false,
        },
        before: { in_stock: true },
        after: { in_stock: false },
      },
    ],
  );
});

test("validator guard evidence retains full-manifest safety limits", () => {
  const rows = [
    {
      action: "UPDATE_STOCK",
      changed_fields: { price: false },
      atomic_plan: {
        expected_state: { offer: { in_stock: true } },
        offer: { values: { in_stock: false } },
      },
    },
  ];
  const result = guardrailsFor(rows, 520, "a".repeat(64));
  assert.equal(result.new_oos_count, 1);
  assert.equal(result.limits.maximum_changed_record_ratio, "0.2");
  assert.equal(result.limits.mass_price_change_ratio, "0.1");
});

test("CLI is closed and diagnostic artifacts exist on success and failure", async () => {
  assert.deepEqual(parseArgs(["--target=production", "--mode=dry-run"]), {
    target: "production",
    mode: "dry-run",
  });
  assert.throws(() => parseArgs(["--target=other", "--mode=apply"]));
  const successDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "whey-refresh-success-"),
  );
  const completed = await runWithDiagnostic(
    ["--target=production", "--mode=dry-run"],
    {
      outDir: successDir,
      operation: async (_args, diagnostic) => {
        diagnostic.mappings_matched = 586;
        diagnostic.validator_result = "PASS";
        return { result: "PASS" };
      },
    },
  );
  assert.equal(JSON.parse(fs.readFileSync(completed.diagnostic_path)).result, "PASS");
  const failureDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "whey-refresh-failure-"),
  );
  await assert.rejects(
    runWithDiagnostic(["--target=production", "--mode=dry-run"], {
      outDir: failureDir,
      operation: async () => {
        throw new RefreshError(
          "SOURCE_INCOMPLETE",
          "missing row",
          "SOURCE_GUARD",
        );
      },
    }),
    /missing row/,
  );
  const failure = JSON.parse(
    fs.readFileSync(
      path.join(failureDir, "production-dry-run-diagnostic.json"),
    ),
  );
  assert.equal(failure.result, "FAIL");
  assert.equal(failure.database_writes_completed, 0);
  assert.equal(failure.approvals_created, 0);
  assert.equal(failure.recovery_calls, 0);
});
