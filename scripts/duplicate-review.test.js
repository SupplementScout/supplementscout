const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalTsLoader = require.extensions[".ts"];
const originalModuleLoad = Module._load;

require.extensions[".ts"] = function loadTypeScriptModule(mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  mod._compile(outputText, filename);
};

Module._load = function loadModule(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }

  return originalModuleLoad.call(this, request, parent, isMain);
};

test.after(() => {
  if (originalTsLoader) {
    require.extensions[".ts"] = originalTsLoader;
  } else {
    delete require.extensions[".ts"];
  }
  Module._load = originalModuleLoad;
});

const { buildDuplicateReviews } = require(
  path.join(process.cwd(), "app", "lib", "duplicateReview.ts")
);
const { findPossibleDuplicates } = require(
  path.join(process.cwd(), "app", "lib", "duplicates.ts")
);

function product(id, overrides = {}) {
  return {
    id,
    name: `Example Product ${id}`,
    slug: `example-${id}`,
    gtin: "0500000000001",
    brand: "Example",
    category: "Supplements",
    product_format: "powder",
    net_weight_g: 300,
    net_volume_ml: null,
    unit_count: null,
    unit_type: null,
    ...overrides,
  };
}

function match(productA, productB, score = 0.9) {
  return {
    productA,
    productB,
    score,
    level: score >= 0.85 ? "high" : score >= 0.7 ? "medium" : "low",
    kind: "possible-duplicate",
  };
}

function defaultVariant(id, productId, overrides = {}) {
  return {
    id,
    product_id: productId,
    variant_key: "default",
    display_name: "Default",
    flavour_label: null,
    size_value: 300,
    size_unit: "g",
    pack_count: 1,
    product_format: "powder",
    is_active: true,
    is_default: true,
    ...overrides,
  };
}

test("exact identity with default variants is presented as a merge candidate", () => {
  const productA = product(1);
  const productB = product(2, { name: "Example Product" });
  const [review] = buildDuplicateReviews(
    [match(productA, productB)],
    [defaultVariant(11, 1), defaultVariant(12, 2)],
    []
  );

  assert.equal(review.preflightStatus, "candidate");
  assert.deepEqual(review.blockers, []);
  assert(review.positiveSignals.includes("Exact same GTIN"));
});

test("catalogue detector finds CREA-4 despite retailer naming noise", () => {
  const matches = findPossibleDuplicates([
    product(1, {
      name: "GYM HIGH CREA-4 Elite Capsules",
      brand: "GYM HIGH",
      product_format: "capsule",
      servings: 60,
    }),
    product(967, {
      name: "Gym High CREA-4 Elite 60 servings",
      brand: "GYM HIGH",
      gtin: null,
      product_format: "capsule",
      servings: 60,
    }),
  ]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].level, "medium");
});

test("catalogue detector uses retailer aliases and known brand families", () => {
  const matches = findPossibleDuplicates(
    [
      product(10, {
        name: "Animal Flex 44 packs",
        brand: "Animal",
        gtin: null,
        product_format: null,
      }),
      product(20, {
        name: "Universal Nutrition Joint Support",
        brand: "Universal Nutrition",
        gtin: null,
        product_format: null,
      }),
    ],
    0.6,
    [
      {
        product_id: 20,
        external_name: "Universal Nutrition Animal Flex 44 Packs",
      },
    ]
  );

  assert.equal(matches.length, 1);
  assert(matches[0].score >= 0.6);
});

test("catalogue detector routes different structured sizes to family review", () => {
  const matches = findPossibleDuplicates([
    product(1, { name: "Example Whey", gtin: null, net_weight_g: 500 }),
    product(2, { name: "Example Whey", gtin: null, net_weight_g: 1000 }),
  ]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "product-family");
});

test("catalogue detector treats retailer GTIN evidence as exact identity", () => {
  const matches = findPossibleDuplicates(
    [
      product(1, { name: "Example Original", gtin: null }),
      product(2, { name: "Example Retail Name", gtin: null }),
    ],
    0.6,
    [
      { product_id: 1, external_name: null, external_gtin: "0500000000001" },
      { product_id: 2, external_name: null, external_gtin: "0500000000001" },
    ]
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "exact-product");
  assert.equal(matches[0].score, 1);
});

test("non-default variants and candidate mappings fail closed", () => {
  const productA = product(1);
  const productB = product(2);
  const [review] = buildDuplicateReviews(
    [match(productA, productB)],
    [
      defaultVariant(11, 1),
      defaultVariant(12, 2, {
        variant_key: "chocolate",
        is_default: false,
        flavour_label: "Chocolate",
      }),
    ],
    [
      {
        id: 21,
        product_id: 2,
        retailer_id: 7,
        external_product_id: "source-product",
        external_variant_id: "source-variant",
        external_sku: "SKU",
        external_gtin: null,
        match_method: "reviewed",
        retailer: { name: "Example Retailer" },
      },
    ]
  );

  assert.equal(review.preflightStatus, "blocked");
  assert(
    review.blockers.includes(
      "Active non-default variants require variant-to-variant review"
    )
  );
  assert(
    review.blockers.includes(
      "Candidate has retailer mappings; automation reconciliation is required before merge"
    )
  );
});

test("structured commercial differences block a merge recommendation", () => {
  const productA = product(1);
  const productB = product(2, {
    gtin: null,
    net_weight_g: 500,
    product_format: "capsule",
  });
  const [review] = buildDuplicateReviews(
    [match(productA, productB, 0.8)],
    [defaultVariant(11, 1), defaultVariant(12, 2)],
    []
  );

  assert.equal(review.preflightStatus, "blocked");
  assert(review.blockers.includes("Different structured net weights"));
  assert(review.blockers.includes("Different product formats"));
});

test("missing safety evidence fails closed", () => {
  const [review] = buildDuplicateReviews(
    [match(product(1), product(2))],
    [],
    [],
    false
  );

  assert.equal(review.preflightStatus, "blocked");
  assert(
    review.blockers.includes(
      "Safety evidence could not be loaded; merge remains fail-closed"
    )
  );
});

test("decision migration keeps old rows separate and constrains new states", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260728100000_extend_duplicate_review_decisions.sql"
    ),
    "utf8"
  );

  assert.match(migration, /decision text not null default 'separate'/);
  assert.match(migration, /decision in \('separate', 'deferred'\)/);
  assert.match(migration, /length\(note\) <= 500/);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
});

test("retailer review queue cannot directly authorize catalogue writes", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260728110000_create_product_match_review_queue.sql"
    ),
    "utf8"
  );

  assert.match(migration, /decision text not null default 'PENDING'/);
  assert.match(migration, /source_row_fingerprint/);
  assert.match(migration, /consumed_at timestamptz/);
  assert.match(migration, /Rows never authorize direct catalogue writes/);
  assert.doesNotMatch(
    migration,
    /\b(insert|update|delete)\s+(into\s+|from\s+)?public\.(products|product_variants|retailer_products|offers|price_history)\b/i
  );
});

test("family review migration keeps family decisions review-only and guarded", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260728170000_add_product_match_family_decisions.sql"
    ),
    "utf8"
  );

  assert.match(migration, /selected_family_seed_review_item_id bigint/);
  assert.match(migration, /selected_family_seed_review_item_id = id/);
  assert.match(migration, /invalid product match family seed/);
  assert.match(migration, /family seed has active dependent variants/);
  assert.match(migration, /snapshot_id <> new\.snapshot_id/);
  assert.match(migration, /retailer <> new\.retailer/);
  assert.match(migration, /It never points directly to catalogue data/);
  assert.doesNotMatch(
    migration,
    /\b(insert|update|delete)\s+(into\s+|from\s+)?public\.(products|product_variants|retailer_products|offers|price_history)\b/i
  );
});
