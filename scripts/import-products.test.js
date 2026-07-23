const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { parse } = require("csv-parse/sync");

const {
  applyArtifactPlan,
  approveArtifactPlan,
  assessVariantCompatibility,
  buildRetailerProductPayload,
  buildRowLevelOfferResults,
  formatPreflightReport,
  getExternalGtin,
  getProductLevelGtin,
  getOfferUrl,
  getRetailerProductUrl,
  isAmbiguousFeedRow,
  isProductGtinVerified,
  loadDryRunArtifact,
  parseArgs,
  parseFlavour,
  parsePackCount,
  parseExternalOptions,
  parseProductFormat,
  parseStrictBoolean,
  parseSize,
  parseVariantIdentity,
  normalizeCategory,
  normalizeFlavour,
  normalizeCanonicalRetailerFeedRows,
  normalizeShippingForImport,
  priceHistoryTotal,
  resolvePlanTimestamp,
  runImportRows: runImportRowsRaw,
  setSupabaseForTests,
  shouldLogCategoryNormalization,
  validatePilotApply,
  writeDryRunArtifact,
} = require("./import-products");
const {
  getSafeCreateExclusionReasons,
  isSafeCreateRowAmbiguous,
  rowIdentityKey,
} = require("./lib/feed-variant-guards");
const {
  canonicalJson,
  normalizeDecimalString,
} = require("./lib/canonical-json");

test("mixed planning accepts one exact source capture while legacy planning still uses current UTC time", () => {
  const capture = "2026-07-18T16:09:19.507Z";
  assert.equal(resolvePlanTimestamp(capture), capture);
  assert.match(resolvePlanTimestamp(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.throws(() => resolvePlanTimestamp("2026-07-18T16:09:19Z"), /exact UTC RFC3339/);
  assert.throws(() => resolvePlanTimestamp("not-a-timestamp"), /Invalid time value/);
});

async function runImportRows(rows, options = {}) {
  if (options.dryRun) {
    return runImportRowsRaw(rows, options);
  }

  const preflight = await runImportRowsRaw(rows, { ...options, dryRun: true });
  const successfulRows = [];
  const failedRows = [];
  for (const item of preflight.report.approvedRows || []) {
    const row = rows[item.rowNumber - 2];
    const singlePreflight = {
      ...preflight,
      report: {
        ...preflight.report,
        approvedRows: [{
          ...item,
          rowNumber: 2,
        }],
      },
      blockedRows: [],
      skipped: 0,
    };
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-plan-test-"));
    const artifactPath = path.join(directory, "plan.json");
    try {
      const artifact = writeDryRunArtifact([row], singlePreflight, {
        artifactPath,
        sourceContent: JSON.stringify(row),
        sourceFileName: "test-row.json",
        environmentMarker: "test",
      });
      const fingerprint = artifact.artifact.plans[0].plan_fingerprint;
      const approved = await approveArtifactPlan({ artifactPath, planFingerprint: fingerprint });
      const applied = await applyArtifactPlan({
        artifactPath,
        planFingerprint: fingerprint,
        approvalId: approved.approvalId,
        pilotApply: true,
      });
      successfulRows.push(...applied.successfulRows);
    } catch (error) {
      failedRows.push({ error: error?.message || String(error) });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  return {
    ...preflight,
    successful: successfulRows.length,
    failed: failedRows.length + (options.mode === "manual" ? preflight.blockedRows.length : 0),
    planned: 0,
    successfulRows,
    failedRows,
  };
}

function baseFeedRow(overrides = {}) {
  return {
    retailer_name: "Retailer One",
    retailer_website: "https://retailer.test",
    product_name: "BioTech USA Iso Whey Zero 1816g Chocolate powder",
    slug: "biotech-usa-iso-whey-zero-1816g",
    brand: "BioTech USA",
    category: "Whey Protein",
    price: "29.99",
    shipping_cost: "0",
    in_stock: "true",
    url: "https://retailer.test/iso-whey-zero-chocolate",
    gtin: "0001234567890",
    ...overrides,
  };
}

function baseSafeCreateFeedRow(overrides = {}) {
  return baseFeedRow({
    retailer_name: "Simply Supplements",
    retailer_website: "https://www.simplysupplements.co.uk",
    merchant_id: "5959",
    merchant_name: "Simply Supplements",
    product_name: "Vitamin C 500mg Capsules",
    slug: "vitamin-c-500mg-capsules",
    brand: "Simply Supplements",
    category: "Vitamins",
    price: "4.99",
    shipping_cost: undefined,
    delivery_cost: "",
    in_stock: "true",
    is_for_sale: "1",
    image: "https://cdn.example.test/vitamin-c.jpg",
    merchant_image_url: "https://cdn.example.test/vitamin-c.jpg",
    gtin: "",
    external_gtin: "5056049515772",
    product_gtin_verified: "false",
    external_id: "C149",
    merchant_product_id: "C149",
    aw_product_id: "45010750732",
    external_name: "Vitamin C 500mg Capsules",
    external_url: "https://www.simplysupplements.co.uk/products/vitamin-c-500mg",
    merchant_deep_link: "https://www.simplysupplements.co.uk/products/vitamin-c-500mg",
    aw_deep_link: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    affiliate_url: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    url: "https://www.awin1.com/pclick.php?p=45010750732&a=2973875&m=5959",
    evidence_name: "Vitamin C 500mg Capsules",
    evidence_size: "500mg",
    evidence_format: "capsules",
    ...overrides,
  });
}

function baseCanonicalFeedRow(overrides = {}) {
  return {
    retailer_name: "Example Nutrition",
    retailer_website: "https://example.test",
    external_product_id: "prod_100",
    external_variant_id: "var_100_500",
    product_name: "Example Creatine Monohydrate 500g",
    variant_name: "Unflavoured / 500g",
    brand: "Example Nutrition",
    category: "Creatine",
    description: "Pure creatine monohydrate",
    image: "https://example.test/images/creatine.jpg",
    slug: "example-creatine-monohydrate-500g",
    external_url: "https://example.test/products/creatine?variant=var_100_500",
    affiliate_url: "https://example.test/products/creatine?variant=var_100_500",
    external_gtin: "5012345678901",
    price: "19.99",
    shipping_known: "false",
    shipping_cost: "",
    in_stock: "true",
    is_for_sale: "true",
    size: "500",
    size_unit: "g",
    flavour: "unflavoured",
    product_format: "powder",
    pack_count: "1",
    source_updated_at: "2026-07-10T09:30:00Z",
    ...overrides,
  };
}

function createVariantFixture(rowOverrides = {}, seedOverrides = {}) {
  const row = baseCanonicalFeedRow({
    retailer_name: "Example Nutrition",
    retailer_website: "https://example.test",
    external_product_id: "prod_100",
    external_variant_id: "var_100_choc",
    external_sku: "SKU-CHOC-500",
    external_options: JSON.stringify({ Flavour: "Chocolate" }),
    product_name: "Example Creatine Monohydrate 500g",
    variant_name: "Chocolate / 500g",
    slug: "example-creatine-monohydrate-500g",
    flavour: "Chocolate",
    size: "500",
    size_unit: "g",
    product_format: "powder",
    pack_count: "1",
    ...rowOverrides,
  });
  const seed = {
    retailers: [{ id: "r1", name: "Example Nutrition", slug: "example-nutrition", website: "https://example.test" }],
    products: [{
      id: "p100",
      name: "Example Creatine Monohydrate 500g",
      brand: "Example Nutrition",
      category: "Creatine",
      gtin: null,
      slug: "example-creatine-monohydrate-500g",
      is_active: true,
      merged_into_product_id: null,
      product_format: "powder",
    }],
    product_variants: [{
      id: "pv-default",
      product_id: "p100",
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
    }],
    retailer_products: [],
    offers: [],
    price_history: [],
    ...seedOverrides,
  };
  return { row, seed };
}

function baseReviewedParentVariantRow(overrides = {}) {
  return baseCanonicalFeedRow({
    retailer_name: "Jon's Supplements",
    retailer_website: "https://jonssupplements.co.uk",
    external_product_id: "10032290431314",
    external_variant_id: "50602336321874",
    external_sku: "CNP09007",
    external_options: JSON.stringify({ Flavour: "Cereal Milk" }),
    product_name: "CNP Premium Whey 2kg",
    variant_name: "Cereal Milk / 2000g",
    brand: "CNP",
    category: "Whey Protein",
    description: "",
    image: "https://cdn.shopify.com/s/files/1/0956/0047/6498/files/cnp-whey.webp",
    slug: "cnp-premium-whey-2kg",
    external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336321874",
    affiliate_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336321874",
    external_gtin: "",
    price: "49.99",
    shipping_known: "true",
    shipping_cost: "3.99",
    in_stock: "true",
    is_for_sale: "true",
    size: "2000",
    size_unit: "g",
    flavour: "Cereal Milk",
    product_format: "powder",
    pack_count: "1",
    ...overrides,
  });
}

function tbjpReviewedParentVariantRow(productName, overrides = {}) {
  const configs = {
    "Trained By JP ISO PRO 1.8kg": {
      variant: "Vanilla",
      size: "1.8kg",
      external_product_id: "10088772632914",
      external_variant_id: "50838844440914",
      external_sku: "TBJ06011",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-iso-pro-1-8kg?variant=50838844440914",
      category: "Whey Protein",
    },
    "Trained By JP Performance Isolate Tri Blend 2kg": {
      variant: "Coffee Caramel",
      size: "2kg",
      external_product_id: "10272336970066",
      external_variant_id: "51546965377362",
      external_sku: "TBJ14015",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-performance-isolate-tri-blend-2kg?variant=51546965377362",
      category: "Whey Protein",
    },
    "Trained By JP Performance Protein 1kg": {
      variant: "Chocolate Caramel",
      size: "1kg",
      external_product_id: "10088760148306",
      external_variant_id: "50838720446802",
      external_sku: "",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-performance-protein-1kg?variant=50838720446802",
      category: "Whey Protein",
    },
    "Trained By JP Performance Protein 2kg": {
      variant: "Vanilla Ice Cream",
      size: "2kg",
      external_product_id: "10088752939346",
      external_variant_id: "50883922198866",
      external_sku: "TBJ04006",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-performance-protein-2kg?variant=50883922198866",
      category: "Whey Protein",
    },
    "Trained By JP DNFM PRE 40 Servings": {
      variant: "Apple Sourz",
      size: "40 servings",
      external_product_id: "10022207160658",
      external_variant_id: "50570816651602",
      external_sku: "TBJ11001",
      url: "https://jonssupplements.co.uk/products/dnfm-high-stim-pre-workout-40-servings?variant=50570816651602",
      category: "Pre Workout",
      servings: "40",
    },
    "Trained By JP PrePare Pro 400g": {
      variant: "Blue Slushie",
      size: "400g",
      external_product_id: "10088778432850",
      external_variant_id: "50838880878930",
      external_sku: "TBJ08004",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-prepare-pro-400g?variant=50838880878930",
      category: "Pre Workout",
    },
    "Trained By JP Pumpage Pre Workout 400g": {
      variant: "Sour Peach Ring",
      size: "400g",
      external_product_id: "10022280986962",
      external_variant_id: "51000351097170",
      external_sku: "TBJ09008",
      url: "https://jonssupplements.co.uk/products/trained-by-jp-pumpage-pre-workout-400g-40-servings?variant=51000351097170",
      category: "Pre Workout",
    },
  };
  const config = configs[productName];
  if (!config) throw new Error(`missing TBJP test config: ${productName}`);
  return baseReviewedParentVariantRow({
    product_name: productName,
    slug: productName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    brand: "Trained By JP",
    category: config.category,
    external_product_id: config.external_product_id,
    external_variant_id: config.external_variant_id,
    external_sku: config.external_sku,
    external_options: JSON.stringify({ Flavour: config.variant, Size: config.size }),
    variant_name: `${config.variant} / ${config.size}`,
    flavour: config.variant,
    size: config.size,
    size_unit: "",
    servings: config.servings || "",
    price: config.category === "Whey Protein" ? "59.49" : "34.99",
    external_url: config.url,
    affiliate_url: config.url,
    ...overrides,
  });
}

function preworkoutReviewedParentVariantRow(productName, overrides = {}) {
  const configs = {
    "ABE All Black Everything Pre-Workout 375g": {
      brand: "ABE All",
      variant: "Baddy Berry",
      size: "375g",
      external_product_id: "10281884975442",
      external_variant_id: "51591755137362",
      external_sku: "",
      url: "https://jonssupplements.co.uk/products/abe-all-black-everything-pre-workout-375g?variant=51591755137362",
      price: "20.99",
    },
    "PER4M Energy Pre Workout 390g": {
      brand: "PER4M",
      variant: "Cherry Fizz",
      size: "390g",
      external_product_id: "10414854668626",
      external_variant_id: "52087824122194",
      external_sku: "PFM24001",
      url: "https://jonssupplements.co.uk/products/per4m-energy-pre-workout-390g?variant=52087824122194",
      price: "19.95",
    },
    "HR Labs DEFIB V3 Pre-Workout 420g": {
      brand: "HR Labs",
      variant: "Cherryade",
      size: "420g",
      external_product_id: "10289985454418",
      external_variant_id: "51634233737554",
      external_sku: "",
      url: "https://jonssupplements.co.uk/products/hr-labs-defib-v3-pre-workout-420g?variant=51634233737554",
      price: "31.49",
    },
    "Gas Mark 10 No Games Pre Workout 30 Servings": {
      brand: "Gas Mark 10",
      variant: "Apple Mango",
      size: "30 servings",
      external_product_id: "10289980834130",
      external_variant_id: "51634167284050",
      external_sku: "GMK01001",
      url: "https://jonssupplements.co.uk/products/gas-mark-10-no-games-pre-workout-30-servings?variant=51634167284050",
      price: "36.99",
      servings: "30",
    },
    "Innovapharm MVPRE 3.0 Pre Workout 437g": {
      brand: "Innovapharm",
      variant: "Jungle Juice",
      size: "437g",
      external_product_id: "10076138045778",
      external_variant_id: "50786195177810",
      external_sku: "INP01006",
      url: "https://jonssupplements.co.uk/products/innovapharm-mvpre-3-0-pre-workout-437g?variant=50786195177810",
      price: "34.99",
    },
  };
  const config = configs[productName];
  if (!config) throw new Error(`missing pre-workout test config: ${productName}`);
  return baseReviewedParentVariantRow({
    product_name: productName,
    slug: productName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    brand: config.brand,
    category: "Pre Workout",
    external_product_id: config.external_product_id,
    external_variant_id: config.external_variant_id,
    external_sku: config.external_sku,
    external_options: JSON.stringify({ Flavour: config.variant, Size: config.size }),
    variant_name: `${config.variant} / ${config.size}`,
    flavour: config.variant,
    size: config.size,
    size_unit: "",
    servings: config.servings || "",
    price: config.price,
    external_url: config.url,
    affiliate_url: config.url,
    ...overrides,
  });
}

function hydrationBarReviewedParentVariantRow(productName, overrides = {}) {
  const configs = {
    "Conteh Sports Hydra Flow 300g": {
      brand: "Conteh Sports", category: "Health Supplements", format: "powder",
      variant: "Mango", size: "300g", productId: "10341391466834", variantId: "51821171442002", sku: "CTH08003",
      handle: "conteh-sports-hydra-flow-300g", price: "24.99", packCount: "1",
    },
    "PER4M Hydrate Electrolyte Mix 210g": {
      brand: "PER4M", category: "Health Supplements", format: "powder",
      variant: "Blackberry", size: "210g", productId: "10460316533074", variantId: "52233394258258", sku: "PFM15015",
      handle: "per4m-hydrate-electrolyte-mix-210g", price: "21.99", packCount: "1",
    },
    "PER4M Protein Bars Box of 12 x 62g": {
      brand: "PER4M", category: "Protein Bars", format: "bar",
      variant: "Caramel Biscuit Box Of 12", size: "62g", productId: "10020052500818", variantId: "50565656609106", sku: "PFM26010",
      handle: "per4m-protein-bars-20g-per-bar", price: "23.99", packCount: "12",
    },
    "Strom Sports HydraMax 420g": {
      brand: "Strom", category: "Health Supplements", format: "powder",
      variant: "Acai Berry", size: "420g", productId: "10476113887570", variantId: "52294365413714", sku: "STM07055",
      handle: "strom-sports-hydramax-420g", price: "29.99", packCount: "1",
    },
    "Strom Sports HydraMax 1.08kg": {
      brand: "Strom", category: "Health Supplements", format: "powder",
      variant: "Acai Berry", size: "1.08kg", productId: "10031181627730", variantId: "50598416744786", sku: "STM07007",
      handle: "strom-sports-hydramax-1-08kg", price: "49.99", packCount: "1",
    },
  };
  const config = configs[productName];
  if (!config) throw new Error(`missing hydration/bar test config: ${productName}`);
  const url = `https://jonssupplements.co.uk/products/${config.handle}?variant=${config.variantId}`;
  return baseReviewedParentVariantRow({
    product_name: productName,
    slug: productName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    brand: config.brand,
    category: config.category,
    product_format: config.format,
    external_product_id: config.productId,
    external_variant_id: config.variantId,
    external_sku: config.sku,
    external_options: JSON.stringify({ Flavour: config.variant, Size: config.size, ...(config.packCount === "12" ? { Pack: "12" } : {}) }),
    variant_name: `${config.variant} / ${config.size}`,
    flavour: config.variant,
    size: config.size,
    size_unit: "",
    pack_count: config.packCount,
    price: config.price,
    external_url: url,
    affiliate_url: url,
    ...overrides,
  });
}

function nutritionReviewedParentVariantRow(productName, overrides = {}) {
  const configs = {
    "Strom Sports CarbMax 1.5kg": { brand: "Strom", category: "Health Supplements", size: "1.5kg", variant: "Cherry", productId: "10031206334802", variantId: "50598468845906", handle: "strom-sports-carbmax-1-5kg-50-servings" },
    "Strom Sports MealMAX 2.5kg": { brand: "Strom", category: "Health Supplements", size: "2.5kg", variant: "Chocolate", productId: "10085611667794", variantId: "50824956641618", handle: "strom-sports-mealmax-2-5kg" },
    "Strom Sports PerforMAX 900g": { brand: "Strom", category: "Health Supplements", size: "900g", variant: "Cherry", productId: "10085613699410", variantId: "50824993636690", handle: "strom-sports-performax-900g" },
    "PER4M Plant Protein 2kg": { brand: "PER4M", category: "Whey Protein", size: "2kg", variant: "Choconut", productId: "10109459431762", variantId: "50913923465554", handle: "per4m-plant-protein-2kg" },
    "Efectiv Hydration Electrolytes 330g": { brand: "Efectiv", category: "Health Supplements", size: "330g", variant: "Fresh Orange", productId: "10079896273234", variantId: "50804634059090", handle: "efectiv-hydration-electrolytes-330g" },
    "Strom Sports VelosiWhey 1.2kg": { brand: "Strom", category: "Whey Protein", size: "1.2kg", variant: "Custard Cream", productId: "10085538722130", variantId: "50824854176082", handle: "strom-sports-velosiwhey-1-2kg" },
    "Time 4 Pre Workout Professional 300g": { brand: "Time 4", category: "Pre Workout", size: "300g", variant: "Bubble Gum", productId: "10064791257426", variantId: "50756488954194", handle: "time-4-pre-workout-professional-300g" },
    "Conteh Sports Conviction ELITE Pre-Workout 375g": { brand: "Conteh Sports", category: "Pre Workout", size: "375g", variant: "Candy Apple", productId: "10286448578898", variantId: "51591944044882", handle: "conteh-sports-conviction-elite-pre-workout-375g" },
    "CNP Professional Full Tilt V2 Stim Pre Workout 570g": { brand: "CNP", category: "Pre Workout", size: "570g", variant: "Cherry Berry Bomb", productId: "10094528242002", variantId: "50845123576146", handle: "cnp-professional-full-tilt-v2-stim-pre-workout-570g" },
    "Strom Sports Nihpro Hydrolysed Protein Isolate 40 Servings": { brand: "Strom", category: "Whey Protein", size: "40 servings", variant: "Chocolate Cake Batter", productId: "10297152606546", variantId: "51680643875154", handle: "strom-sports-nihpro-hydrolysed-protein-isolate-40-servings" },
    "Conteh Sports The Pump 414g": { brand: "Conteh Sports", category: "Pre Workout", size: "414g", variant: "Berry", productId: "10564078928210", variantId: "52614983319890", handle: "conteh-sports-the-pump-414g" },
    "Efectiv Nutrition Legacy Pre-Workout 380g": { brand: "Efectiv", category: "Pre Workout", size: "380g", variant: "Tropical Storm", productId: "10143716700498", variantId: "51022738686290", handle: "efectiv-nutrition-legacy-pre-workout-380g" },
    "Strom Sports VelosiWhey ISO 1kg": { brand: "Strom", category: "Whey Protein", size: "1kg", variant: "Chocolate Caramel", productId: "10102141780306", variantId: "50886508511570", handle: "strom-sports-nutrition-velosiwhey-iso-1kg" },
    "Strom Sports FocusMax 36 Servings": { brand: "Strom", category: "Health Supplements", size: "36 servings", variant: "Raspberry Cloud", productId: "10373913674066", variantId: "51945135538514", handle: "strom-sports-focusmax-36-servings-raspberry-cloud" },
    "Strom Sports GlutathioneMAX 200g": { brand: "Strom", category: "Health Supplements", size: "200g", variant: "Cherry", productId: "10101053983058", variantId: "50816375128402", handle: "strom-sports-glutathionemax-200g" },
    "Strom Sports SystolMAX 495g": { brand: "Strom", category: "Health Supplements", size: "495g", variant: "Blueberry Lemonade", productId: "10109726097746", variantId: "50844865560914", handle: "strom-sports-systolmax-495g-blueberry-lemonade" },
    "Strom Sports DigestMax 480g": { brand: "Strom", category: "Health Supplements", size: "480g", variant: "Raspberry", productId: "10073152258386", variantId: "50781349183826", handle: "strom-sports-digestmax-480g" },
    "Strom MSM (Methylsulfonylmethane) 83 Servings": { brand: "Strom", category: "Health Supplements", size: "83 servings", variant: "Lemon Lime", productId: "10031241298258", variantId: "50598594347346", handle: "strom-msm-methylsulfonylmethane-83-servings-lemon-lime" },
  };
  const config = configs[productName];
  if (!config) throw new Error(`missing nutrition test config: ${productName}`);
  const url = `https://jonssupplements.co.uk/products/${config.handle}?variant=${config.variantId}`;
  return baseReviewedParentVariantRow({
    product_name: productName,
    slug: productName.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    brand: config.brand,
    category: config.category,
    product_format: "powder",
    external_product_id: config.productId,
    external_variant_id: config.variantId,
    external_sku: `SKU-${config.variantId}`,
    external_options: JSON.stringify({ Flavour: config.variant, Size: config.size }),
    variant_name: `${config.variant} / ${config.size}`,
    flavour: config.variant,
    size: config.size,
    size_unit: "",
    servings: config.size.endsWith("servings") ? config.size.split(" ")[0] : "",
    pack_count: "1",
    external_url: url,
    affiliate_url: url,
    ...overrides,
  });
}

function reviewedSeed(overrides = {}) {
  return {
    retailers: [{ id: "10", name: "Jon's Supplements", slug: "jon-s-supplements", website: "https://jonssupplements.co.uk" }],
    products: [],
    product_variants: [],
    retailer_products: [],
    offers: [],
    price_history: [],
    ...overrides,
  };
}

function createMockSupabase(seed = {}) {
  const tables = {
    retailers: seed.retailers || [
      { id: "r1", name: "Retailer One", slug: "retailer-one" },
    ],
    products: seed.products || [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: null,
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
    product_variants: seed.product_variants || [],
    retailer_products: seed.retailer_products || [],
    offers: seed.offers || [],
    price_history: seed.price_history || [],
  };
  if (seed.product_variants === undefined) {
    tables.product_variants = tables.products.map((product, index) => ({
      id: `default-variant-${index + 1}`,
      product_id: product.id,
      variant_key: "default",
      display_name: "Default",
      flavour_code: null,
      flavour_label: null,
      size_value: null,
      size_unit: null,
      pack_count: null,
      product_format: null,
      is_active: true,
      is_default: true,
    }));
  }
  const writes = [];
  const operations = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = "select";
      this.payload = null;
      this.limitCount = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    limit(count) {
      this.limitCount = count;
      return this;
    }

    insert(payload) {
      this.operation = "insert";
      this.payload = payload;
      return this;
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload) {
      this.operation = "upsert";
      this.payload = payload;
      return this;
    }

    matchingRows() {
      return tables[this.table].filter((row) =>
        this.filters.every((filter) => String(row[filter.field]) === String(filter.value))
      );
    }

    executeRead() {
      operations.push({ type: "read", table: this.table, filters: this.filters });
      const rows = this.matchingRows();
      return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
    }

    executeWrite() {
      operations.push({ type: "write", table: this.table, operation: this.operation });
      writes.push({ table: this.table, operation: this.operation, payload: this.payload });

      if (this.operation === "insert") {
        const row = {
          ...this.payload,
          id: this.payload.id || `${this.table}-${tables[this.table].length + 1}`,
        };
        tables[this.table].push(row);
        return row;
      }

      if (this.operation === "update") {
        const rows = this.matchingRows();
        for (const row of rows) {
          Object.assign(row, this.payload);
        }
        return rows[0] || null;
      }

      if (this.operation === "upsert") {
        const existing = tables[this.table].find((row) =>
          this.table === "retailer_products"
            ? row.retailer_id === this.payload.retailer_id &&
              (this.payload.external_variant_id
                ? row.external_variant_id === this.payload.external_variant_id
                : row.external_url === this.payload.external_url)
            : false
        );

        if (existing) {
          Object.assign(existing, this.payload);
          return existing;
        }

        const row = {
          ...this.payload,
          id: this.payload.id || `${this.table}-${tables[this.table].length + 1}`,
        };
        tables[this.table].push(row);
        return row;
      }

      return null;
    }

    maybeSingle() {
      return Promise.resolve({ data: this.executeRead()[0] || null, error: null });
    }

    single() {
      if (this.operation === "select") {
        return Promise.resolve({ data: this.executeRead()[0] || null, error: null });
      }

      return Promise.resolve({ data: this.executeWrite(), error: null });
    }

    then(resolve, reject) {
      try {
        if (this.operation === "select") {
          resolve({ data: this.executeRead(), error: null });
          return;
        }

        this.executeWrite();
        resolve({ error: null });
      } catch (error) {
        reject(error);
      }
    }
  }

  const approvedPlans = new Map();

  return {
    tables,
    writes,
    operations,
    async rpc(name, args) {
      operations.push({ type: "rpc", name, args });
      if (name === "approve_product_import_plan") {
        const id = `approval-${approvedPlans.size + 1}`;
        approvedPlans.set(id, {
          plan: structuredClone(args.p_plan),
          metadata: {
            artifact_sha256: args.p_artifact_sha256,
            run_id: args.p_run_id,
            plan_fingerprint: args.p_plan.meta.plan_fingerprint,
            source_row_fingerprint: args.p_plan.meta.source_row_fingerprint,
            retailer_id: args.p_plan.retailer.action === "existing" ? args.p_plan.retailer.id : null,
            plan_kind: args.p_plan.meta.plan_kind,
          },
          consumed: false,
        });
        return {
          data: {
            approval_id: id,
            expires_at: new Date(Date.now() + 900000).toISOString(),
            ...approvedPlans.get(id).metadata,
            status: "approved",
          },
          error: null,
        };
      }
      if (name !== "apply_approved_product_import_plan") {
        return { data: null, error: new Error(`Unknown RPC ${name}`) };
      }

      const approval = approvedPlans.get(args.p_approval_id);
      if (!approval) return { data: null, error: new Error("approved import plan not found") };
      if (approval.consumed) return { data: null, error: new Error("approved import plan already consumed") };
      for (const [key, value] of Object.entries(approval.metadata)) {
        const argument = {
          artifact_sha256: args.p_artifact_sha256,
          run_id: args.p_run_id,
          plan_fingerprint: args.p_plan_fingerprint,
          source_row_fingerprint: args.p_source_row_fingerprint,
          retailer_id: args.p_retailer_id,
          plan_kind: args.p_plan_kind,
        }[key];
        if ((argument ?? null) !== (value ?? null)) {
          return { data: null, error: new Error(`approved import plan ${key} mismatch`) };
        }
      }
      const snapshot = structuredClone(tables);
      const writesLength = writes.length;
      const plan = approval.plan;
      try {
        let retailerId = plan.retailer.id;
        if (plan.retailer.action === "create") {
          const row = {
            ...plan.retailer.values,
            id: `retailers-${tables.retailers.length + 1}`,
          };
          tables.retailers.push(row);
          writes.push({ table: "retailers", operation: "insert", payload: row });
          retailerId = row.id;
        }

        let productId = plan.product.id;
        if (plan.product.action === "create_or_reuse_reviewed") {
          const existing = tables.products.find((product) =>
            product.slug === plan.product.values.slug ||
            String(product.name).toLowerCase() === String(plan.product.values.name).toLowerCase()
          );
          if (existing) {
            productId = existing.id;
          } else {
            const row = {
              ...materializeDecimalFields(plan.product.values, [
                "price", "servings", "net_weight_g", "net_volume_ml", "serving_count_verified",
                "serving_size_g", "serving_size_ml", "protein_per_serving_g",
                "creatine_per_serving_g", "unit_count",
              ]),
              id: `products-${tables.products.length + 1}`,
              gtin: null,
              is_active: true,
              merged_into_product_id: null,
              merged_at: null,
            };
            tables.products.push(row);
            writes.push({ table: "products", operation: "insert", payload: row });
            productId = row.id;
          }
        } else if (plan.product.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.product.values, [
              "price", "servings", "net_weight_g", "net_volume_ml", "serving_count_verified",
              "serving_size_g", "serving_size_ml", "protein_per_serving_g",
              "creatine_per_serving_g", "unit_count",
            ]),
            id: `products-${tables.products.length + 1}`,
            gtin: null,
            is_active: true,
          };
          tables.products.push(row);
          writes.push({ table: "products", operation: "insert", payload: row });
          productId = row.id;
        }
        if (seed.rpc_failure_at === "after_product") throw new Error("after product");

        let productVariantId = plan.product_variant.id;
        if (plan.product_variant.action === "create_default") {
          const row = {
            id: `product_variants-${tables.product_variants.length + 1}`,
            product_id: productId,
            variant_key: "default",
            display_name: "Default",
            flavour_code: null,
            flavour_label: null,
            size_value: null,
            size_unit: null,
            pack_count: null,
            product_format: null,
            is_active: true,
            is_default: true,
          };
          tables.product_variants.push(row);
          writes.push({ table: "product_variants", operation: "insert", payload: row });
          productVariantId = row.id;
        } else if (["create_variant", "create_reviewed_variant"].includes(plan.product_variant.action)) {
          const row = {
            ...materializeDecimalFields(plan.product_variant.values, ["size_value", "pack_count"]),
            id: `product_variants-${tables.product_variants.length + 1}`,
            product_id: productId,
            is_active: true,
            is_default: false,
          };
          tables.product_variants.push(row);
          writes.push({ table: "product_variants", operation: "insert", payload: row });
          productVariantId = row.id;
        }
        if (seed.rpc_failure_at === "after_default_variant") {
          throw new Error("after default variant");
        }

        let mappingId = plan.retailer_product.id;
        if (plan.retailer_product.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.retailer_product.values, ["match_confidence"]),
            id: `retailer_products-${tables.retailer_products.length + 1}`,
            retailer_id: retailerId,
            product_id: productId,
            product_variant_id: productVariantId,
          };
          tables.retailer_products.push(row);
          writes.push({ table: "retailer_products", operation: "insert", payload: row });
          mappingId = row.id;
        } else if (plan.retailer_product.action === "update") {
          const row = tables.retailer_products.find(({ id }) => id === mappingId);
          if (!row) throw new Error("stale retailer product");
          Object.assign(row, materializeDecimalFields(plan.retailer_product.values, ["match_confidence"]), {
            retailer_id: retailerId,
            product_id: productId,
            product_variant_id: productVariantId,
          });
          writes.push({ table: "retailer_products", operation: "update", payload: plan.retailer_product.values });
        }
        if (seed.rpc_failure_at === "after_retailer_product") throw new Error("after retailer product");

        let offerId = plan.offer.id;
        if (plan.offer.action === "create") {
          const row = {
            ...materializeDecimalFields(plan.offer.values, ["price", "shipping_cost", "total_price"]),
            id: `offers-${tables.offers.length + 1}`,
            product_id: productId,
            retailer_id: retailerId,
            product_variant_id: productVariantId,
            retailer_product_id: mappingId,
          };
          tables.offers.push(row);
          writes.push({ table: "offers", operation: "insert", payload: row });
          offerId = row.id;
        } else if (plan.offer.action === "update") {
          const row = tables.offers.find(({ id }) => id === offerId);
          if (!row) throw new Error("stale offer");
          const materializedOfferValues = materializeDecimalFields(
            plan.offer.values,
            ["price", "shipping_cost", "total_price"]
          );
          const changed = Object.fromEntries(
            Object.entries(materializedOfferValues).filter(
              ([key, value]) => key === "last_checked_at" || !valuesEqualForTest(row[key], value)
            )
          );
          Object.assign(row, materializedOfferValues);
          writes.push({ table: "offers", operation: "update", payload: changed });
        }
        if (seed.rpc_failure_at === "after_offer") throw new Error("after offer");
        if (seed.rpc_failure_at === "before_price_history") throw new Error("before price history");

        if (plan.price_history.action === "create") {
          const row = {
            id: `price_history-${tables.price_history.length + 1}`,
            offer_id: offerId,
            price: Number(plan.offer.values.price),
            shipping_cost: plan.offer.values.shipping_cost === null ? null : Number(plan.offer.values.shipping_cost),
            total_price: plan.offer.values.total_price === null ? null : Number(plan.offer.values.total_price),
            checked_at: plan.offer.values.last_checked_at,
          };
          tables.price_history.push(row);
          writes.push({ table: "price_history", operation: "insert", payload: row });
        }

        approval.consumed = true;
        return {
          data: {
            approval_id: args.p_approval_id, product_id: productId,
            product_variant_id: productVariantId, retailer_product_id: mappingId, offer_id: offerId,
            consumed_at: new Date().toISOString(), ...approval.metadata,
          },
          error: null,
        };
      } catch (error) {
        for (const [table, rows] of Object.entries(snapshot)) {
          tables[table].splice(0, tables[table].length, ...rows);
        }
        writes.splice(writesLength);
        return { data: null, error };
      }
    },
    from(table) {
      return new Query(table);
    },
  };
}

function valuesEqualForTest(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function materializeDecimalFields(values, fields) {
  const result = { ...values };
  for (const field of fields) {
    if (result[field] !== null && result[field] !== undefined) result[field] = Number(result[field]);
  }
  return result;
}

async function assertInvalidFeedRowHasZeroWrites(overrides) {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow(overrides)], { mode: "feed" });

  assert.equal(result.report.invalidRows.length, 1);
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(supabase.writes.length, 0);
}

async function preflightExistingOffer({ rowOverrides = {}, offerOverrides = {} } = {}) {
  const row = baseFeedRow(rowOverrides);
  const supabase = createMockSupabase({
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1", external_url: row.url,
      external_gtin: row.gtin || null,
    }],
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp1",
        price: 29.99,
        shipping_cost: 0,
        total_price: 29.99,
        in_stock: true,
        url: baseFeedRow().url,
        ...offerOverrides,
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    dryRun: true,
  });

  return { report: result.report, result, supabase };
}

function outOfStockSafeCreateFixture(overrides = {}) {
  const row = baseSafeCreateFeedRow({
    price: "16.99",
    shipping_cost: "3.99",
    delivery_cost: "3.99",
    in_stock: "false",
    is_for_sale: "false",
    ...overrides,
  });
  const retailer = {
    id: "r1",
    name: row.retailer_name,
    slug: "simply-supplements",
  };
  const product = {
    id: "p458",
    name: row.product_name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    gtin: null,
  };

  return { row, retailer, product };
}

function buildFitHouseCanonicalRows(config) {
  return config.products.map((product) => {
    const url = `${config.retailer.website}/products/${product.expected_handle}?variant=${product.shopify_variant_id}`;

    return {
      retailer_name: config.retailer.name,
      retailer_website: config.retailer.website,
      external_product_id: product.shopify_product_id,
      external_variant_id: product.shopify_variant_id,
      product_name: product.canonical_name,
      variant_name: product.variant_name,
      brand: product.brand,
      category: product.category,
      description: "",
      image: `https://cdn.shopify.com/s/files/fit-house/${product.shopify_variant_id}.jpg`,
      slug: product.canonical_slug,
      external_url: url,
      affiliate_url: url,
      external_gtin: "",
      price: String(product.approved_price),
      shipping_known: String(config.shipping.known),
      shipping_cost: String(config.shipping.cost),
      in_stock: String(product.approved_in_stock),
      is_for_sale: String(product.is_for_sale),
      size: product.size === null ? "" : String(product.size),
      size_unit: product.size_unit || "",
      flavour: product.flavour || "",
      product_format: product.product_format,
      pack_count: String(product.pack_count),
      source_updated_at: "2026-07-11T14:18:26+01:00",
    };
  });
}

function assertFitHouseApprovedScope(config, rows) {
  const approvedMappings = new Set(
    config.products.map(
      (product) => `${product.shopify_product_id}:${product.shopify_variant_id}`
    )
  );

  if (
    rows.length !== config.products.length ||
    rows.some(
      (row) =>
        !approvedMappings.has(
          `${row.external_product_id}:${row.external_variant_id}`
        )
    )
  ) {
    throw new Error("Fit House preflight rows must exactly match approved config");
  }
}

test("feed safe-create plans a missing non-default variant under an existing product", async () => {
  const { row, seed } = createVariantFixture();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.productVariantsToCreate.length, 1);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product.action, "existing");
  assert.equal(plan.product.id, "p100");
  assert.equal(plan.product_variant.action, "create_variant");
  assert.equal(plan.product_variant.values.display_name, "Chocolate / 500g");
  assert.equal(plan.product_variant.values.flavour_code, "chocolate");
  assert.equal(plan.product_variant.values.size_value, "500");
  assert.equal(plan.retailer_product.action, "create");
  assert.equal(plan.offer.action, "create");
  assert.equal(plan.price_history.action, "create");
  assert.equal(plan.expected_state.product_variant, null);
});

test("feed safe-create plans a verified Shopify create_variant row without SKU", async () => {
  const { row, seed } = createVariantFixture({
    product_id: "p100",
    brand: "",
    slug: "shopify-source-handle-not-canonical-slug",
    external_product_id: "10538625761618",
    external_variant_id: "53629499965778",
    external_sku: "",
    external_gtin: "",
    external_options: JSON.stringify({ Flavour: "Chocolate", Size: "500g" }),
    external_url: "https://example.test/products/example-creatine?variant=53629499965778",
    affiliate_url: "https://example.test/products/example-creatine?variant=53629499965778",
  });
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product_variant.action, "create_variant");
  assert.equal(plan.retailer_product.values.external_sku, null);
  assert.equal(plan.retailer_product.values.external_variant_id, "53629499965778");
});

test("feed safe-create keeps SKU mandatory outside strict Shopify no-SKU create_variant evidence", async () => {
  const nonShopify = createVariantFixture({
    external_sku: "",
    external_options: JSON.stringify({ Flavour: "Chocolate", Size: "500g" }),
  });
  let supabase = createMockSupabase(nonShopify.seed);
  setSupabaseForTests(supabase);
  let result = await runImportRows([nonShopify.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].block_reason, /strict Shopify product and variant identity/);

  const bundle = createVariantFixture({
    external_product_id: "10538625761618",
    external_variant_id: "53629499965778",
    external_sku: "",
    external_gtin: "",
    external_options: JSON.stringify({ Flavour: "Chocolate", Size: "500g" }),
    external_url: "https://example.test/products/example-creatine?variant=53629499965778",
    affiliate_url: "https://example.test/products/example-creatine?variant=53629499965778",
    product_name: "Example Creatine Monohydrate 500g Bundle",
  });
  supabase = createMockSupabase(bundle.seed);
  setSupabaseForTests(supabase);
  result = await runImportRows([bundle.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].block_reason, /bundle\/free\/BBE\/dated/);
});

test("strict Shopify no-SKU identity may add a variant when the reviewed parent has no active default", async () => {
  const fixture = createVariantFixture({
    product_id: "p100",
    brand: "",
    external_product_id: "10460316533074",
    external_variant_id: "52233394127186",
    external_sku: "",
    external_gtin: "",
    external_options: JSON.stringify({ Flavour: "Lemon Sherbert Fizz", Size: "500g" }),
    flavour: "Lemon Sherbert Fizz",
    variant_name: "Lemon Sherbert Fizz / 500g",
    external_url: "https://example.test/products/example-creatine?variant=52233394127186",
    affiliate_url: "https://example.test/products/example-creatine?variant=52233394127186",
  }, { product_variants: [{
    id: "pv-vanilla", product_id: "p100", variant_key: "vanilla-500g", display_name: "Vanilla / 500g",
    flavour_code: "vanilla", flavour_label: "Vanilla", size_value: 500, size_unit: "g", pack_count: 1,
    product_format: "powder", is_active: true, is_default: false,
  }] });
  let supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);
  let result = await runImportRows([fixture.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.productVariantsToCreate.length, 1);

  supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);
  result = await runImportRows([{ ...fixture.row, external_sku: "DUPLICATE-SKU" }], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].block_reason, /exactly one active default/);

  supabase = createMockSupabase({ ...fixture.seed, product_variants: [defaultVariant({ product_id: "p100" }), defaultVariant({ id: "pv-default-2", product_id: "p100" })] });
  setSupabaseForTests(supabase);
  result = await runImportRows([fixture.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].block_reason, /exactly one active default/);
});

test("create_variant apply creates variant, mapping, offer and initial price history without creating product", async () => {
  const { row, seed } = createVariantFixture();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const beforeProducts = supabase.tables.products.length;
  const result = await runImportRows([row], { mode: "feed", safeCreate: true });
  assert.equal(result.successful, 1);
  assert.equal(result.failed, 0);
  assert.equal(supabase.tables.products.length, beforeProducts);
  assert.equal(supabase.tables.product_variants.length, 2);
  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.price_history.length, 1);
  const createdVariant = supabase.tables.product_variants.find((variant) => variant.id !== "pv-default");
  assert.equal(createdVariant.product_id, "p100");
  assert.equal(createdVariant.is_default, false);
  assert.equal(supabase.tables.retailer_products[0].product_variant_id, createdVariant.id);
  assert.equal(supabase.tables.offers[0].product_variant_id, createdVariant.id);
});

test("create_variant reuses an equivalent existing variant instead of creating a duplicate", async () => {
  const base = createVariantFixture();
  const { row, seed } = createVariantFixture({}, {
    product_variants: [
      base.seed.product_variants[0],
      {
        id: "pv-choc",
        product_id: "p100",
        variant_key: "chocolate-500g",
        display_name: "Chocolate / 500g",
        flavour_code: "chocolate",
        flavour_label: "Chocolate",
        size_value: 500,
        size_unit: "g",
        pack_count: 1,
        product_format: "powder",
        is_active: true,
        is_default: false,
      },
    ],
  });
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.productVariantsToCreate.length, 0);
  assert.equal(result.report.approvedRows[0].importPlan.product_variant.action, "existing");
  assert.equal(result.report.approvedRows[0].importPlan.product_variant.id, "pv-choc");
});

test("create_variant blocks duplicate Shopify variant ID and missing source identity", async () => {
  const duplicateVariant = createVariantFixture({}, {
    retailer_products: [{
      id: "rp-existing",
      retailer_id: "r1",
      product_id: "p100",
      product_variant_id: "pv-default",
      external_variant_id: "var_100_choc",
      external_url: "https://example.test/old",
      external_sku: "OTHER-SKU",
    }],
  });
  let supabase = createMockSupabase(duplicateVariant.seed);
  setSupabaseForTests(supabase);
  let result = await runImportRows([duplicateVariant.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].block_reason, /conflicting variant evidence|missing canonical product_variant/);

  const missingIdentity = createVariantFixture({ external_variant_id: "", external_sku: "" });
  supabase = createMockSupabase(missingIdentity.seed);
  setSupabaseForTests(supabase);
  await assert.rejects(
    () => runImportRows([missingIdentity.row], { mode: "feed", safeCreate: true, dryRun: true }),
    /missing external_variant_id/
  );
});

test("create_variant blocks inactive or merged products and rolls back injected failures", async () => {
  const inactive = createVariantFixture({}, {
    products: [{ ...createVariantFixture().seed.products[0], is_active: false }],
  });
  let supabase = createMockSupabase(inactive.seed);
  setSupabaseForTests(supabase);
  let result = await runImportRows([inactive.row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.blockedRows[0].block_reason, "canonical product is inactive or merged");

  const fixture = createVariantFixture({}, { rpc_failure_at: "after_retailer_product" });
  supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);
  result = await runImportRows([fixture.row], { mode: "feed", safeCreate: true });
  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.equal(supabase.tables.product_variants.length, 1);
  assert.equal(supabase.tables.retailer_products.length, 0);
  assert.equal(supabase.tables.offers.length, 0);
  assert.equal(supabase.tables.price_history.length, 0);
});

test("create_variant batch allows repeated retailer SKU when Shopify variant identity is distinct", async () => {
  const first = createVariantFixture().row;
  const second = createVariantFixture({
    external_variant_id: "var_100_vanilla",
    external_options: JSON.stringify({ Flavour: "Vanilla" }),
    variant_name: "Vanilla / 500g",
    flavour: "Vanilla",
  }).row;
  const supabase = createMockSupabase(createVariantFixture().seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([first, second], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.productVariantsToCreate.length, 2);
});

test("create_variant batch blocks duplicate planned canonical variant identities", async () => {
  const first = createVariantFixture().row;
  const second = createVariantFixture({
    external_variant_id: "var_100_choc_alt",
    external_sku: "SKU-CHOC-500-ALT",
    external_options: JSON.stringify({ Flavour: "Chocolate!" }),
    variant_name: "Chocolate! / 500g",
    flavour: "Chocolate!",
  }).row;
  const supabase = createMockSupabase(createVariantFixture().seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([first, second], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.blockedRows.length, 2);
  assert.equal(result.report.blockedRows[0].block_reason, "multiple unresolved feed variants share one retailer-product identity");
});

test("normalizes pre-workout variants to Pre Workout", () => {
  assert.equal(normalizeCategory("Pre-Workout"), "Pre Workout");
  assert.equal(normalizeCategory("pre-workout"), "Pre Workout");
  assert.equal(normalizeCategory(" PRE-WORKOUT "), "Pre Workout");
});

test("normalizes mapped supplement category aliases", () => {
  assert.equal(normalizeCategory("Creatine Supplements"), "Creatine");
  assert.equal(normalizeCategory("Amino Acid Supplements"), "Amino Acids");
});

test("leaves product-level categories unmapped except whitespace cleanup", () => {
  assert.equal(normalizeCategory("Health Supplements"), "Health Supplements");
  assert.equal(normalizeCategory("Protein Powder"), "Protein Powder");
  assert.equal(normalizeCategory("  Whey   Protein  "), "Whey Protein");
  assert.equal(normalizeCategory(" Weight Management "), "Weight Management");
});

test("logs only when canonical mapping changes category after whitespace cleanup", () => {
  assert.equal(
    shouldLogCategoryNormalization(" Pre-Workout ", normalizeCategory(" Pre-Workout ")),
    true
  );
  assert.equal(
    shouldLogCategoryNormalization("Whey   Protein", normalizeCategory("Whey   Protein")),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization(
      "Health Supplements",
      normalizeCategory("Health Supplements")
    ),
    false
  );
  assert.equal(
    shouldLogCategoryNormalization("pre-workout", normalizeCategory("pre-workout")),
    true
  );
});

test("feed GTIN is blocked from products.gtin unless explicitly product-verified", () => {
  const flavourSpecificRow = {
    import_mode: "awin",
    product_name: "Optimum Nutrition Gold Standard Whey 908g Chocolate",
    gtin: "5060469989242",
  };

  assert.equal(getExternalGtin(flavourSpecificRow), "5060469989242");
  assert.equal(getProductLevelGtin(flavourSpecificRow, "feed"), null);
  assert.equal(
    getProductLevelGtin({
      ...flavourSpecificRow,
      product_gtin_verified: "true",
    }, "feed"),
    "5060469989242"
  );
});

test("product GTIN verification flags stay false unless explicitly truthy", () => {
  for (const value of [false, undefined, null, "", "false", "0", "definitely"]) {
    assert.equal(isProductGtinVerified({ product_gtin_verified: value }), false);
    assert.equal(parseStrictBoolean(value), false);
  }

  assert.equal(isProductGtinVerified({ product_gtin_verified: "true" }), true);
  assert.equal(isProductGtinVerified({ product_gtin_verified: "1" }), true);
});

test("legacy manually imported GTIN behaviour remains intact", () => {
  assert.equal(
    getProductLevelGtin({
      product_name: "Verified Manual Product",
      gtin: "5060469983615",
    }),
    "5060469983615"
  );
});

test("variant parsing extracts conservative flavour, size, pack count, and format", () => {
  assert.equal(parseFlavour("Chocolate flavour"), "chocolate");
  assert.deepEqual(parseSize("908g"), {
    value: "908",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("0.908kg"), {
    value: "908",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("Optimum Nutrition Whey 2.27kg"), {
    value: "2270",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("2,27kg"), {
    value: "2270",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("1.8 kg"), {
    value: "1800",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("500ml"), {
    value: "500",
    unit: "ml",
    dimension: "volume",
  });
  assert.equal(parsePackCount("Barebells Vegan Protein Bars 12x55g"), 12);
  assert.equal(parsePackCount("Barebells Vegan Protein Bars 12 x 55 g"), 12);
  assert.equal(parsePackCount("pack of 12"), 12);
  assert.equal(parsePackCount("single bar"), 1);
  assert.equal(parsePackCount("30 servings"), null);
  assert.equal(parseProductFormat("60 capsules"), "capsule");
  assert.equal(parseProductFormat("60 caps"), "capsule");
  assert.equal(parseProductFormat("120 tablets"), "tablet");
  assert.equal(parseProductFormat("softgel"), "softgel");
  assert.equal(parseProductFormat("softgels"), "softgel");
  assert.equal(parseProductFormat("soft gel"), "softgel");
  assert.equal(parseProductFormat("soft gels"), "softgel");
  assert.equal(parseProductFormat("ready to drink liquid 500ml"), "liquid");
  assert.equal(parseProductFormat("ready-to-drink"), "liquid");
  assert.equal(parseProductFormat("ready_to_drink"), "liquid");
  assert.equal(parseProductFormat("330ml"), "liquid");
  assert.equal(parseProductFormat("330 ml"), "liquid");
  assert.equal(parseProductFormat("500ml"), "liquid");
  assert.equal(parseProductFormat("500mg"), null);
  assert.equal(parseProductFormat("SKU330mlX"), null);
  assert.equal(parseProductFormat("https://example.test/products/barebells-330mlx"), null);
  assert.equal(parseProductFormat("Barebells High Protein Milkshake 330ml"), "liquid");
  assert.equal(parseProductFormat("Strawberry Milkshake / 25 servings"), null);
  assert.equal(parseProductFormat("whey powder"), "powder");
  assert.equal(parseProductFormat("snack"), "snack");
  assert.equal(parseProductFormat("unclear merch item"), null);
  assert.deepEqual(parseSize("50 servings"), { value: "50", unit: "servings", dimension: "count" });
  assert.deepEqual(parseSize("20 serves"), { value: "20", unit: "servings", dimension: "count" });
  assert.deepEqual(parseVariantIdentity({ size: "30", size_unit: "servings" }).size, {
    value: "30",
    unit: "servings",
    dimension: "count",
  });
  assert.notEqual(parseVariantIdentity({ size: "30", size_unit: "servings" }).size.unit, "g");
});

test("908g feed row does not match 2.27kg product", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Optimum Nutrition Gold Standard Whey 908g Chocolate",
      brand: "Optimum Nutrition",
    },
    {
      name: "Optimum Nutrition Gold Standard Whey 2.27kg",
      brand: "Optimum Nutrition",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("size conflict"));
});

test("single bar does not match 12-pack", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Barebells Vegan Protein Bar single bar 55g Salty Peanut",
      brand: "Barebells",
    },
    {
      name: "Barebells Vegan Protein Bars 12x55g",
      brand: "Barebells",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(
    compatibility.reasons.includes("pack-count conflict") ||
      compatibility.reasons.includes("single item conflicts with multipack")
  );
});

test("powder does not match capsules", () => {
  const compatibility = assessVariantCompatibility(
    {
      import_mode: "awin",
      product_name: "Optimum Nutrition Creatine Powder 300g",
      brand: "Optimum Nutrition",
    },
    {
      name: "Optimum Nutrition Creatine 2500mg Capsules",
      brand: "Optimum Nutrition",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("format conflict"));
});

test("explicit product_format agrees with stored product_format when title has only serving evidence", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Strom Sports Creatine HCL - 80 Servings",
      brand: "Strom",
      product_format: "capsule",
    },
    {
      name: "Strom Sports Creatine HCL - 80 Servings",
      brand: "Strom",
      product_format: "capsule",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.reasons.includes("format conflict"), false);
});

test("explicit product_format agrees with stored product_format when title has no format evidence", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Example Daily Support",
      brand: "Example",
      product_format: "capsule",
    },
    {
      name: "Example Daily Support",
      brand: "Example",
      product_format: "capsule",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.reasons.includes("format conflict"), false);
});

test("explicit product_format still blocks stored format conflicts", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Example Daily Support",
      brand: "Example",
      product_format: "capsule",
    },
    {
      name: "Example Daily Support",
      brand: "Example",
      product_format: "powder",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("format conflict"));
});

test("explicit product_format still blocks clear conflicting title evidence", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Example Creatine Capsules 120 Capsules",
      brand: "Example",
      product_format: "powder",
    },
    {
      name: "Example Creatine Powder",
      brand: "Example",
      product_format: "powder",
    }
  );

  assert.equal(compatibility.compatible, false);
  assert(compatibility.reasons.includes("format conflict"));
});

test("title-derived product_format behaviour is preserved without explicit format", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Example Daily Capsules",
      brand: "Example",
    },
    {
      name: "Example Daily Capsules",
      brand: "Example",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.reasons.includes("format conflict"), false);
});

test("missing explicit and title format evidence remains compatible with warning", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "Example Daily Support",
      brand: "Example",
    },
    {
      name: "Example Daily Support",
      brand: "Example",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert(compatibility.warnings.includes("incomplete format evidence"));
});

test("missing optional variant data lowers evidence but does not block compatibility", () => {
  const compatibility = assessVariantCompatibility(
    {
      product_name: "BioTech USA Iso Whey Zero powder",
      brand: "BioTech USA",
    },
    {
      name: "BioTech USA Iso Whey Zero 1816g powder",
      brand: "BioTech USA",
    }
  );

  assert.equal(compatibility.compatible, true);
  assert(compatibility.warnings.includes("incomplete size evidence"));
});

test("ambiguous feed rows are skipped", () => {
  const row = {
    product_name: "Mystery Supplement",
    brand: "Unknown",
  };

  assert.equal(isAmbiguousFeedRow(row), true);
});

test("external_gtin is the storage target for unverified feed GTINs", () => {
  const row = {
    import_mode: "awin",
    product_name: "Rule1 R1 Protein 2.2kg Vanilla powder",
    gtin: "858925004081",
  };
  const identity = parseVariantIdentity({
    ...row,
  });
  const payload = buildRetailerProductPayload({
    row,
    retailerId: "3",
    productId: "182",
    name: row.product_name,
    slug: "rule1-r1-protein-22kg-vanilla",
    offerUrl: "https://example.com/rule1-r1-protein-22kg-vanilla",
    matchMethod: "slug",
    matchConfidence: 90,
  });

  assert.equal(identity.flavour, "vanilla");
  assert.equal(identity.productFormat, "powder");
  assert.equal(getExternalGtin({ gtin: "858925004081" }), "858925004081");
  assert.equal(getProductLevelGtin(row, "feed"), null);
  assert.equal(payload.external_gtin, "858925004081");
  assert.equal(payload.product_id, "182");
});

test("feed mode is explicit and ordinary CSV columns do not activate it", () => {
  assert.equal(parseArgs([]).mode, "manual");
  assert.equal(parseArgs(["--mode=feed"]).mode, "feed");
  assert.equal(parseArgs(["--mode=feed", "--safe-create"]).safeCreate, true);
  assert.throws(() => parseArgs(["--safe-create"]), /only supported with --mode=feed/);
  assert.equal(getProductLevelGtin({ import_mode: "awin", gtin: "123" }), "123");
  assert.equal(getProductLevelGtin({ import_mode: "awin", gtin: "123" }, "feed"), null);
});

test("approval and pilot apply require an artifact, fingerprint and one approval ID", () => {
  const artifact = "tmp/import-plans/review.json";
  const fingerprint = "a".repeat(32);
  const pilot = parseArgs([
    "--mode=feed", "--pilot-apply", `--artifact=${artifact}`,
    `--plan-fingerprint=${fingerprint}`, "--approval-id=approval-1",
  ]);
  assert.equal(pilot.pilotApply, true);
  assert.equal(pilot.approvalId, "approval-1");
  assert.equal(parseArgs([
    "--mode=feed", "--approve-plan", `--artifact=${artifact}`,
    `--plan-fingerprint=${fingerprint}`,
  ]).approvePlan, true);
  assert.throws(
    () => parseArgs(["--mode=feed", "--pilot-apply", "--dry-run"]),
    /cannot be combined/i
  );
  assert.throws(() => parseArgs(["--pilot-apply"]), /artifact and --plan-fingerprint/i);
  assert.throws(() => validatePilotApply([{}], { dryRun: false }), /artifact approval workflow/i);
  assert.doesNotThrow(() => validatePilotApply([{}, {}], { dryRun: true }));
});

test("safe-create blocks canonical feed rows with flavour and size evidence", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseCanonicalFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.blockedRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's parent plus explicit variant safe-create plans one parent and one named variant", async () => {
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseReviewedParentVariantRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.productVariantsToCreate.length, 1);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product.action, "create_or_reuse_reviewed");
  assert.equal(plan.product_variant.action, "create_reviewed_variant");
  assert.equal(plan.product_variant.values.display_name, "Cereal Milk / 2000g");
  assert.notEqual(plan.product_variant.values.variant_key, "default");
  assert.equal(plan.approval.approval_type, "reviewed_parent_variant_safe_create");
  assert.equal(plan.approval.has_variant_evidence, true);
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's multiple flavours under one new parent count parent once", async () => {
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const rows = [
    baseReviewedParentVariantRow(),
    baseReviewedParentVariantRow({
      external_variant_id: "50602336256338",
      external_sku: "CNP09004",
      external_options: JSON.stringify({ Flavour: "Banana" }),
      variant_name: "Banana / 2000g",
      flavour: "Banana",
      external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336256338",
      affiliate_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336256338",
    }),
  ];
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.productVariantsToCreate.length, 2);
  assert.deepEqual(
    result.report.productVariantsToCreate.map((row) => row.values.display_name).sort(),
    ["Banana / 2000g", "Cereal Milk / 2000g"]
  );
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's CNP sizes/families and Strom versions stay separate", async () => {
  const rows = [
    baseReviewedParentVariantRow({
      product_name: "CNP Premium Whey 900g",
      slug: "cnp-premium-whey-900g",
      external_product_id: "10032497394002",
      external_variant_id: "50603324637522",
      external_sku: "CNP09056",
      external_options: JSON.stringify({ Flavour: "Banana" }),
      variant_name: "Banana / 900g",
      flavour: "Banana",
      size: "900",
      external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-900g?variant=50603324637522",
      affiliate_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-900g?variant=50603324637522",
    }),
    baseReviewedParentVariantRow(),
    baseReviewedParentVariantRow({
      product_name: "CNP Whey Isolate 1.8kg",
      slug: "cnp-whey-isolate-1-8kg",
      external_product_id: "10136944968018",
      external_variant_id: "51006403641682",
      external_sku: "CNP48013",
      external_options: JSON.stringify({ Size: "1.8kg", Flavour: "Cereal Milk" }),
      variant_name: "Cereal Milk / 1800g",
      flavour: "Cereal Milk",
      size: "1800",
      external_url: "https://jonssupplements.co.uk/products/cnp-whey-protein-isolate-100-whey-isolate-powder-900g-1-8kg-v2?variant=51006403641682",
      affiliate_url: "https://jonssupplements.co.uk/products/cnp-whey-protein-isolate-100-whey-isolate-powder-900g-1-8kg-v2?variant=51006403641682",
    }),
    baseReviewedParentVariantRow({
      product_name: "Strom StimuMAX OG Pre Workout 360g",
      slug: "strom-stimumax-og-pre-workout-360g",
      brand: "Strom",
      category: "Pre Workout",
      external_product_id: "10101107884370",
      external_variant_id: "50884219863378",
      external_sku: "STM041",
      external_options: JSON.stringify({ Flavour: "Cola" }),
      variant_name: "Cola / 360g",
      flavour: "Cola",
      size: "360",
      price: "23.99",
      external_url: "https://jonssupplements.co.uk/products/strom-stimumax-og-pre-workout-360g-30-servings?variant=50884219863378",
      affiliate_url: "https://jonssupplements.co.uk/products/strom-stimumax-og-pre-workout-360g-30-servings?variant=50884219863378",
    }),
    baseReviewedParentVariantRow({
      product_name: "Strom StimuMAX PRO Pre Workout 360g",
      slug: "strom-stimumax-pro-pre-workout-360g",
      brand: "Strom",
      category: "Pre Workout",
      external_product_id: "10020406231378",
      external_variant_id: "50566788415826",
      external_sku: "STM15002",
      external_options: JSON.stringify({ Flavour: "Strawberry Kiwi" }),
      variant_name: "Strawberry Kiwi / 360g",
      flavour: "Strawberry Kiwi",
      size: "360",
      price: "29.95",
      external_url: "https://jonssupplements.co.uk/products/strom-stimumax-pro-pre-workout-360g-30-servings?variant=50566788415826",
      affiliate_url: "https://jonssupplements.co.uk/products/strom-stimumax-pro-pre-workout-360g-30-servings?variant=50566788415826",
    }),
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 5);
  assert.equal(result.report.newProductsToCreate.length, 5);
  assert.deepEqual(
    result.report.newProductsToCreate.map((row) => row.slug).sort(),
    [
      "cnp-premium-whey-2kg",
      "cnp-premium-whey-900g",
      "cnp-whey-isolate-1-8kg",
      "strom-stimumax-og-pre-workout-360g",
      "strom-stimumax-pro-pre-workout-360g",
    ]
  );
});

test("reviewed Jon's TBJP parent explicit-variant allowlist covers only approved families", async () => {
  const productNames = [
    "Trained By JP ISO PRO 1.8kg",
    "Trained By JP Performance Isolate Tri Blend 2kg",
    "Trained By JP Performance Protein 1kg",
    "Trained By JP Performance Protein 2kg",
    "Trained By JP DNFM PRE 40 Servings",
    "Trained By JP PrePare Pro 400g",
    "Trained By JP Pumpage Pre Workout 400g",
  ];
  const rows = productNames.map((productName) => tbjpReviewedParentVariantRow(productName));
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 7);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 7);
  assert.equal(result.report.productVariantsToCreate.length, 7);
  assert.deepEqual(
    result.report.newProductsToCreate.map((row) => row.productName).sort(),
    productNames.sort()
  );
  assert(result.report.productVariantsToCreate.every((row) => row.values.display_name !== "Default"));
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's TBJP multiple flavours under one parent count parent once", async () => {
  const rows = [
    tbjpReviewedParentVariantRow("Trained By JP Performance Protein 2kg"),
    tbjpReviewedParentVariantRow("Trained By JP Performance Protein 2kg", {
      external_variant_id: "50838709633362",
      external_sku: "TBJ025",
      external_options: JSON.stringify({ Flavour: "Chocolate Orange", Size: "2kg" }),
      variant_name: "Chocolate Orange / 2kg",
      flavour: "Chocolate Orange",
      external_url: "https://jonssupplements.co.uk/products/trained-by-jp-performance-protein-2kg?variant=50838709633362",
      affiliate_url: "https://jonssupplements.co.uk/products/trained-by-jp-performance-protein-2kg?variant=50838709633362",
    }),
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.productVariantsToCreate.length, 2);
  assert.deepEqual(
    result.report.productVariantsToCreate.map((row) => row.values.display_name).sort(),
    ["Chocolate Orange / 2kg", "Vanilla Ice Cream / 2kg"]
  );
});

test("reviewed Jon's TBJP exact family, size and formula blockers remain closed", async () => {
  const cases = [
    ["ISO PRO mixed with Tri Blend size", tbjpReviewedParentVariantRow("Trained By JP ISO PRO 1.8kg", { size: "2kg", external_options: JSON.stringify({ Flavour: "Vanilla", Size: "2kg" }), variant_name: "Vanilla / 2kg" }), /exact size mismatch/],
    ["Performance Protein 1kg mixed with 2kg", tbjpReviewedParentVariantRow("Trained By JP Performance Protein 1kg", { size: "2kg", external_options: JSON.stringify({ Flavour: "Chocolate Caramel", Size: "2kg" }), variant_name: "Chocolate Caramel / 2kg" }), /exact size mismatch/],
    ["DNFM mixed with PrePare Pro", tbjpReviewedParentVariantRow("Trained By JP DNFM PRE 40 Servings", { product_name: "Trained By JP PrePare Pro 400g", slug: "trained-by-jp-prepare-pro-400g" }), /exact size mismatch|requires strict Shopify variant URL identity/],
    ["Pumpage mixed with stimulant pre-workout", tbjpReviewedParentVariantRow("Trained By JP Pumpage Pre Workout 400g", { product_name: "Trained By JP DNFM PRE 40 Servings", slug: "trained-by-jp-dnfm-pre-40-servings" }), /exact size mismatch|requires strict Shopify variant URL identity/],
    ["wrong category for newly reviewed TBJP family", tbjpReviewedParentVariantRow("Trained By JP ISO PRO 1.8kg", { product_name: "Trained By JP Hydration 300g", slug: "trained-by-jp-hydration-300g" }), /category mismatch/],
    ["missing size", tbjpReviewedParentVariantRow("Trained By JP PrePare Pro 400g", { size: "", external_options: JSON.stringify({ Flavour: "Blue Slushie" }), variant_name: "Blue Slushie" }), /exact size mismatch|invalid size evidence/],
    ["missing flavour", tbjpReviewedParentVariantRow("Trained By JP PrePare Pro 400g", { flavour: "", external_options: JSON.stringify({ Size: "400g" }), variant_name: "400g" }), /requires explicit flavour/],
    ["brand mismatch", tbjpReviewedParentVariantRow("Trained By JP Pumpage Pre Workout 400g", { brand: "TBJP Nutrition" }), /brand mismatch/],
    ["bundle/free", tbjpReviewedParentVariantRow("Trained By JP Pumpage Pre Workout 400g", { product_name: "Trained By JP Pumpage Pre Workout 400g Plus Free Shaker" }), /does not allow this canonical family|bundle/],
    ["out of stock", tbjpReviewedParentVariantRow("Trained By JP Pumpage Pre Workout 400g", { in_stock: "false" }), /requires in-stock for-sale source row/],
  ];

  for (const [name, row, pattern] of cases) {
    const supabase = createMockSupabase(reviewedSeed());
    setSupabaseForTests(supabase);
    const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });

    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report.blockedRows.length, 1, name);
    assert.match(result.report.blockedRows[0].reason, pattern, name);
  }
});

test("reviewed Jon's pre-workout parent explicit-variant allowlist covers only Marek-approved families", async () => {
  const productNames = [
    "ABE All Black Everything Pre-Workout 375g",
    "PER4M Energy Pre Workout 390g",
    "HR Labs DEFIB V3 Pre-Workout 420g",
    "Gas Mark 10 No Games Pre Workout 30 Servings",
    "Innovapharm MVPRE 3.0 Pre Workout 437g",
  ];
  const rows = productNames.map((productName) => preworkoutReviewedParentVariantRow(productName));
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 5);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 5);
  assert.equal(result.report.productVariantsToCreate.length, 5);
  assert.deepEqual(
    result.report.newProductsToCreate.map((row) => row.productName).sort(),
    productNames.sort()
  );
  assert(result.report.productVariantsToCreate.every((row) => row.values.display_name !== "Default"));
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's pre-workout multiple flavours under one parent count parent once", async () => {
  const rows = [
    preworkoutReviewedParentVariantRow("PER4M Energy Pre Workout 390g"),
    preworkoutReviewedParentVariantRow("PER4M Energy Pre Workout 390g", {
      external_variant_id: "52087824154962",
      external_sku: "PFM24002",
      external_options: JSON.stringify({ Flavour: "Pineapple Rings", Size: "390g" }),
      variant_name: "Pineapple Rings / 390g",
      flavour: "Pineapple Rings",
      external_url: "https://jonssupplements.co.uk/products/per4m-energy-pre-workout-390g?variant=52087824154962",
      affiliate_url: "https://jonssupplements.co.uk/products/per4m-energy-pre-workout-390g?variant=52087824154962",
    }),
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.productVariantsToCreate.length, 2);
  assert.deepEqual(
    result.report.productVariantsToCreate.map((row) => row.values.display_name).sort(),
    ["Cherry Fizz / 390g", "Pineapple Rings / 390g"]
  );
});

test("reviewed Jon's pre-workout exact family, size and formula blockers remain closed", async () => {
  const cases = [
    ["DEFIB V3 mixed with Original", preworkoutReviewedParentVariantRow("HR Labs DEFIB V3 Pre-Workout 420g", { product_name: "HR Labs DEFIB Original Pre-Workout 420g", slug: "hr-labs-defib-original-pre-workout-420g" }), /does not allow this canonical family/],
    ["DEFIB V3 wrong size", preworkoutReviewedParentVariantRow("HR Labs DEFIB V3 Pre-Workout 420g", { size: "480g", external_options: JSON.stringify({ Flavour: "Cherryade", Size: "480g" }), variant_name: "Cherryade / 480g" }), /exact size mismatch/],
    ["MVPRE 3.0 mixed with legacy family", preworkoutReviewedParentVariantRow("Innovapharm MVPRE 3.0 Pre Workout 437g", { product_name: "Innovapharm MVPRE Pre-Workout 3.0 40/20 servings", slug: "innovapharm-mvpre-pre-workout-3-0-40-20-servings" }), /does not allow this canonical family|exact size mismatch/],
    ["No Games wrong serving count", preworkoutReviewedParentVariantRow("Gas Mark 10 No Games Pre Workout 30 Servings", { size: "40 servings", servings: "40", external_options: JSON.stringify({ Flavour: "Apple Mango", Size: "40 servings" }), variant_name: "Apple Mango / 40 servings" }), /exact size mismatch/],
    ["missing flavour", preworkoutReviewedParentVariantRow("PER4M Energy Pre Workout 390g", { flavour: "", external_options: JSON.stringify({ Size: "390g" }), variant_name: "390g" }), /requires explicit flavour/],
    ["brand mismatch", preworkoutReviewedParentVariantRow("ABE All Black Everything Pre-Workout 375g", { brand: "ABE" }), /brand mismatch/],
    ["bundle/free", preworkoutReviewedParentVariantRow("PER4M Energy Pre Workout 390g", { product_name: "PER4M Energy Pre Workout 390g Plus Free Shaker" }), /does not allow this canonical family|bundle/],
    ["out of stock", preworkoutReviewedParentVariantRow("Gas Mark 10 No Games Pre Workout 30 Servings", { in_stock: "false" }), /requires in-stock for-sale source row/],
    ["unreviewed ABE product", preworkoutReviewedParentVariantRow("ABE All Black Everything Pre-Workout 375g", { product_name: "ABE Energy 315g", slug: "abe-energy-315g" }), /does not allow this canonical family/],
  ];

  for (const [name, row, pattern] of cases) {
    const supabase = createMockSupabase(reviewedSeed());
    setSupabaseForTests(supabase);
    const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });

    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report.blockedRows.length, 1, name);
    assert.match(result.report.blockedRows[0].reason, pattern, name);
  }
});

test("reviewed Jon's hydration and bar allowlist covers only the five approved canonical families", async () => {
  const productNames = [
    "Conteh Sports Hydra Flow 300g",
    "PER4M Hydrate Electrolyte Mix 210g",
    "PER4M Protein Bars Box of 12 x 62g",
    "Strom Sports HydraMax 420g",
    "Strom Sports HydraMax 1.08kg",
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows(productNames.map(hydrationBarReviewedParentVariantRow), {
    mode: "feed", safeCreate: true, dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 5);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 5);
  assert.equal(result.report.productVariantsToCreate.length, 5);
  assert.equal(
    result.report.productVariantsToCreate.find((row) => row.productName === "PER4M Protein Bars Box of 12 x 62g").values.pack_count,
    "12"
  );
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's hydration and bar family boundaries remain closed", async () => {
  const cases = [
    ["HydraMax sizes mixed", hydrationBarReviewedParentVariantRow("Strom Sports HydraMax 420g", { size: "1080g", external_options: JSON.stringify({ Flavour: "Acai Berry", Size: "1.08kg" }) }), /exact size mismatch|conflicting variant evidence/],
    ["bar pack count missing", hydrationBarReviewedParentVariantRow("PER4M Protein Bars Box of 12 x 62g", { pack_count: "", variant_name: "Caramel Biscuit Box Of 12 / 62g" }), /exact pack count mismatch/],
    ["bar weight conflict", hydrationBarReviewedParentVariantRow("PER4M Protein Bars Box of 12 x 62g", { size: "60g", external_options: JSON.stringify({ Flavour: "Caramel Biscuit Box Of 12", Size: "60g", Pack: "12" }) }), /exact size mismatch|conflicting variant evidence/],
    ["bars collapsed with powder", hydrationBarReviewedParentVariantRow("PER4M Protein Bars Box of 12 x 62g", { product_format: "powder" }), /product format mismatch|conflicting variant evidence/],
    ["unreviewed hydration family", hydrationBarReviewedParentVariantRow("Conteh Sports Hydra Flow 300g", { product_name: "Conteh Sports Hydra Flow 500g", slug: "conteh-sports-hydra-flow-500g" }), /does not allow this canonical family/],
    ["missing flavour", hydrationBarReviewedParentVariantRow("PER4M Hydrate Electrolyte Mix 210g", { flavour: "", external_options: JSON.stringify({ Size: "210g" }), variant_name: "210g" }), /requires explicit flavour/],
    ["bundle", hydrationBarReviewedParentVariantRow("Strom Sports HydraMax 420g", { product_name: "Strom Sports HydraMax 420g Plus Free Shaker" }), /does not allow this canonical family|bundle/],
    ["OOS", hydrationBarReviewedParentVariantRow("Conteh Sports Hydra Flow 300g", { in_stock: "false" }), /requires in-stock for-sale source row/],
  ];

  for (const [name, row, pattern] of cases) {
    const supabase = createMockSupabase(reviewedSeed());
    setSupabaseForTests(supabase);
    const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report.blockedRows.length, 1, name);
    assert.match(result.report.blockedRows[0].block_reason || result.report.blockedRows[0].reason, pattern, name);
    assert.equal(supabase.writes.length, 0, name);
  }
});

test("reviewed Jon's nutrition allowlist covers only the thirteen approved canonical families", async () => {
  const productNames = [
    "Strom Sports CarbMax 1.5kg", "Strom Sports MealMAX 2.5kg", "Strom Sports PerforMAX 900g",
    "PER4M Plant Protein 2kg", "Efectiv Hydration Electrolytes 330g", "Strom Sports VelosiWhey 1.2kg",
    "Time 4 Pre Workout Professional 300g", "Conteh Sports Conviction ELITE Pre-Workout 375g",
    "CNP Professional Full Tilt V2 Stim Pre Workout 570g", "Strom Sports Nihpro Hydrolysed Protein Isolate 40 Servings",
    "Conteh Sports The Pump 414g", "Efectiv Nutrition Legacy Pre-Workout 380g", "Strom Sports VelosiWhey ISO 1kg",
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows(productNames.map(nutritionReviewedParentVariantRow), { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 13);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 13);
  assert.equal(result.report.productVariantsToCreate.length, 13);
  assert.ok(result.report.productVariantsToCreate.every((row) => row.values.display_name !== "Default"));
  assert.equal(supabase.writes.length, 0);
});

test("final Jon's closeout reviewed-parent allowlist covers only the exact eight approved families", async () => {
  const configs = [
    ["CNP ProDough Protein Bars Box of 12 x 60g", "CNP", "Protein Bars", "bar", "60g", "Biscuit Spread", "12"],
    ["Efectiv Whey Protein 2kg", "Efectiv", "Whey Protein", "powder", "2000g", "Honey Nut Cereal", "1"],
    ["PER4M Hydrate Unflavoured 159g", "PER4M", "Health Supplements", "powder", "159g", "Unflavoured", "1"],
    ["Strom Sports LipidMax 400g", "Strom", "Health Supplements", "powder", "400g", "Passion Fruit", "1"],
    ["Time 4 Whey Protein Professional 1.8kg", "Time 4", "Whey Protein", "powder", "1800g", "Jaffa Cake", "1"],
    ["Trained By JP Collagen Powder 300g", "Trained By JP", "Health Supplements", "powder", "300g", "Peach", "1"],
    ["Trained By JP Hydration 300g", "Trained By JP", "Health Supplements", "powder", "300g", "Pink Lemonade", "1"],
    ["Trained By JP Join-In 210g", "Trained By JP", "Health Supplements", "powder", "210g", "Cherry", "1"],
  ];
  const rows = configs.map(([name, brand, category, format, size, flavour, pack], index) => {
    const externalVariantId = String(53000000000000 + index);
    const externalProductId = String(52000000000000 + index);
    return baseReviewedParentVariantRow({
      product_name: name, slug: `final-family-${index}`, brand, category, product_format: format,
      external_product_id: externalProductId, external_variant_id: externalVariantId,
      external_sku: `FINAL-${index}`, external_options: JSON.stringify({ Flavour: flavour, Size: size, ...(pack === "12" ? { Pack: pack } : {}) }),
      variant_name: `${flavour} / ${size}`, flavour, size, size_unit: "", pack_count: pack,
      external_url: `https://jonssupplements.co.uk/products/final-family-${index}?variant=${externalVariantId}`,
      affiliate_url: `https://jonssupplements.co.uk/products/final-family-${index}?variant=${externalVariantId}`,
    });
  });
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 8);
  assert.equal(result.report.blockedRows.length, 0);

  const wrongSize = { ...rows[1], size: "1800g", external_options: JSON.stringify({ Flavour: "Honey Nut Cereal", Size: "1800g" }), variant_name: "Honey Nut Cereal / 1800g" };
  const blocked = await runImportRows([wrongSize], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(blocked.report.approvedRows.length, 0);
  assert.match(blocked.report.blockedRows[0].block_reason, /exact size mismatch/);
});

test("Cellucor C4 Ripped safe-create exception is exact", () => {
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Cellucor C4 Ripped 180g", category: "Pre Workout", product_format: "powder", size: "180g" }), []);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Cellucor C4 Original 180g", category: "Pre Workout", product_format: "powder", size: "180g" }), ["category is not allowed for safe-create"]);
});

test("final reviewed variant families remain eligible on idempotent feed reruns", () => {
  const reviewed = [
    { product_name: "CNP ProDough Protein Bars Box of 12 x 60g", category: "Protein Bars", product_format: "bar", size: "60g" },
    { product_name: "Time 4 Whey Protein Professional 1.8kg", external_name: "Time 4 Whey Protein Professional 1.8kg / Custard Cream", category: "Whey Protein", product_format: "powder", size: "1800g" },
    { product_name: "Trained By JP Performance Protein 1kg", category: "Whey Protein", product_format: "powder", size: "1000g" },
    { product_name: "Trained By JP Performance Protein 2kg", category: "Whey Protein", product_format: "powder", size: "2000g" },
  ];
  for (const row of reviewed) assert.deepEqual(getSafeCreateExclusionReasons(row), [], row.product_name);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Unreviewed Protein Bars Box of 12 x 60g", category: "Protein Bars", product_format: "bar", size: "60g" }), ["category is not allowed for safe-create"]);
  assert.deepEqual(getSafeCreateExclusionReasons({ product_name: "Time 4 Whey Protein Professional 2.5kg", category: "Whey Protein", product_format: "powder", size: "2500g" }), ["category is not allowed for safe-create"]);
});

test("reviewed parent no-SKU row may use exact parent-policy size with an exact Shopify flavour option", async () => {
  const row = nutritionReviewedParentVariantRow("Conteh Sports The Pump 414g", {
    external_sku: "",
    external_options: JSON.stringify({ Flavour: "Berry" }),
  });
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.productVariantsToCreate[0].values.display_name, "Berry / 414g");
  assert.equal(supabase.writes.length, 0);
});

test("reviewed nutrition families preserve exact family, size, and formula boundaries", async () => {
  const cases = [
    ["CarbMax cannot collapse into MealMAX", nutritionReviewedParentVariantRow("Strom Sports CarbMax 1.5kg", { product_name: "Strom Sports MealMAX 1.5kg" }), /does not allow this canonical family/],
    ["MealMAX exact size", nutritionReviewedParentVariantRow("Strom Sports MealMAX 2.5kg", { size: "1.5kg", external_options: JSON.stringify({ Flavour: "Chocolate", Size: "1.5kg" }) }), /exact size mismatch|conflicting variant evidence/],
    ["PerforMAX exact size", nutritionReviewedParentVariantRow("Strom Sports PerforMAX 900g", { size: "1.5kg", external_options: JSON.stringify({ Flavour: "Cherry", Size: "1.5kg" }) }), /exact size mismatch|conflicting variant evidence/],
    ["Plant Protein stays separate from whey", nutritionReviewedParentVariantRow("PER4M Plant Protein 2kg", { product_name: "PER4M Whey Protein 2kg" }), /does not allow this canonical family/],
    ["Hydration stays separate from EAA", nutritionReviewedParentVariantRow("Efectiv Hydration Electrolytes 330g", { product_name: "Efectiv EAA 330g" }), /does not allow this canonical family/],
    ["missing flavour", nutritionReviewedParentVariantRow("Strom Sports VelosiWhey 1.2kg", { flavour: "", external_options: JSON.stringify({ Size: "1.2kg" }) }), /requires explicit flavour/],
    ["OOS", nutritionReviewedParentVariantRow("Time 4 Pre Workout Professional 300g", { in_stock: "false" }), /requires in-stock for-sale source row/],
    ["bundle", nutritionReviewedParentVariantRow("Conteh Sports The Pump 414g", { product_name: "Conteh Sports The Pump 414g Plus Free Shaker" }), /does not allow this canonical family|bundle/],
  ];
  for (const [name, row, pattern] of cases) {
    const supabase = createMockSupabase(reviewedSeed());
    setSupabaseForTests(supabase);
    const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report.blockedRows.length, 1, name);
    assert.match(result.report.blockedRows[0].block_reason || result.report.blockedRows[0].reason, pattern, name);
    assert.equal(supabase.writes.length, 0, name);
  }
});

test("SARM and peptide catalogue identities are permanently excluded without blocking protein peptides", async () => {
  for (const product_name of [
    "Optimised Research Labs AN-VAR Oxandro 60 Capsules",
    "Research Ostarine MK-2866 60 Capsules",
    "BPC-157 Peptide 10mg",
  ]) {
    assert.deepEqual(getSafeCreateExclusionReasons({ product_name, category: "Health Supplements", product_format: "capsule", size: "60 capsules" }), ["prohibited catalogue type: SARM or peptide"]);
  }
  assert.doesNotMatch(
    (getSafeCreateExclusionReasons({ product_name: "CNP Peptide Whey Protein Blend 2.27kg", category: "Whey Protein", product_format: "powder", size: "2.27kg" }) || []).join(" "),
    /prohibited catalogue type/i
  );
  const row = nutritionReviewedParentVariantRow("Strom Sports VelosiWhey 1.2kg", { product_name: "Research RAD-140 1.2kg" });
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, 0);
  assert.match(result.report.blockedRows[0].reason, /prohibited catalogue type/);
});

test("reviewed whey flavour names may contain cream without allowing topical cream products", () => {
  const reviewedFlavour = nutritionReviewedParentVariantRow("Strom Sports VelosiWhey 1.2kg", {
    external_name: "Strom Sports VelosiWhey 1.2kg - Custard Cream",
    flavour: "Custard Cream",
    variant_name: "Custard Cream / 1.2kg",
  });

  assert.deepEqual(getSafeCreateExclusionReasons(reviewedFlavour), []);
  assert.deepEqual(
    getSafeCreateExclusionReasons({
      product_name: "Generic Skin Cream 120g",
      category: "Health Supplements",
      product_format: "powder",
      size: "120g",
    }),
    ["excluded product type"],
  );
});

test("reviewed Strom health-support families preserve exact named formula boundaries", async () => {
  const names = [
    "Strom Sports FocusMax 36 Servings",
    "Strom Sports GlutathioneMAX 200g",
    "Strom Sports SystolMAX 495g",
    "Strom Sports DigestMax 480g",
    "Strom MSM (Methylsulfonylmethane) 83 Servings",
  ];
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const result = await runImportRows(names.map(nutritionReviewedParentVariantRow), { mode: "feed", safeCreate: true, dryRun: true });
  assert.equal(result.report.approvedRows.length, names.length);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, names.length);
  assert.equal(result.report.productVariantsToCreate.length, names.length);
  assert.ok(result.report.productVariantsToCreate.every((row) => row.values.display_name !== "Default"));
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Strom health-support products cannot cross formula, size, format, or scope", async () => {
  const cases = [
    ["DigestMax into FocusMax", nutritionReviewedParentVariantRow("Strom Sports DigestMax 480g", { product_name: "Strom Sports FocusMax 480g" }), /does not allow this canonical family/],
    ["GlutathioneMAX into LipidMax", nutritionReviewedParentVariantRow("Strom Sports GlutathioneMAX 200g", { product_name: "Strom Sports LipidMax 200g" }), /does not allow this canonical family/],
    ["wrong size", nutritionReviewedParentVariantRow("Strom Sports SystolMAX 495g", { size: "400g", external_options: JSON.stringify({ Flavour: "Blueberry Lemonade", Size: "400g" }) }), /exact size mismatch|conflicting variant evidence/],
    ["wrong format", nutritionReviewedParentVariantRow("Strom Sports GlutathioneMAX 200g", { product_format: "capsule" }), /product format mismatch|conflicting variant evidence/],
    ["unreviewed Strom", nutritionReviewedParentVariantRow("Strom Sports DigestMax 480g", { product_name: "Strom Sports UnknownMAX 480g" }), /does not allow this canonical family/],
    ["missing flavour", nutritionReviewedParentVariantRow("Strom Sports FocusMax 36 Servings", { flavour: "", external_options: JSON.stringify({ Size: "36 servings" }) }), /requires explicit flavour|requires exact Shopify flavour option/],
    ["OOS", nutritionReviewedParentVariantRow("Strom MSM (Methylsulfonylmethane) 83 Servings", { in_stock: "false" }), /requires in-stock for-sale source row/],
    ["bundle", nutritionReviewedParentVariantRow("Strom Sports DigestMax 480g", { product_name: "Strom Sports DigestMax 480g Plus Free Shaker" }), /does not allow this canonical family|bundle/],
  ];
  for (const [name, row, pattern] of cases) {
    const supabase = createMockSupabase(reviewedSeed());
    setSupabaseForTests(supabase);
    const result = await runImportRows([row], { mode: "feed", safeCreate: true, dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report.blockedRows.length, 1, name);
    assert.match(result.report.blockedRows[0].block_reason || result.report.blockedRows[0].reason, pattern, name);
    assert.equal(supabase.writes.length, 0, name);
  }
});

test("reviewed Jon's parent explicit-variant policy keeps hard blockers closed", async () => {
  const cases = [
    ["missing Shopify variant ID", { external_variant_id: "", external_url: "https://jonssupplements.co.uk/products/cnp?variant=" }, /missing external_variant_id|requires Shopify product and variant IDs/],
    ["missing exact size", { size: "", variant_name: "Cereal Milk", external_options: JSON.stringify({ Flavour: "Cereal Milk" }) }, /exact size mismatch|explicit size evidence/],
    ["missing flavour", { flavour: "", variant_name: "2000g", external_options: JSON.stringify({ Size: "2kg" }) }, /requires explicit flavour/],
    ["inactive canonical parent collision", {}, /inactive|merged|collision|possible duplicate/],
    ["SKU conflict", { external_variant_id: "50602336354642", external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336354642" }, /SKU conflict/],
    ["GTIN conflict", { external_gtin: "1234567890123" }, /GTIN conflict/],
    ["brand mismatch", { brand: "Wrong" }, /brand mismatch/],
    ["family mismatch", { product_name: "CNP Full Tilt Pre Workout 435g", slug: "cnp-full-tilt-pre-workout-435g" }, /does not allow this canonical family/],
    ["bundle/free", { product_name: "CNP Premium Whey 2kg Plus Free Shaker" }, /does not allow this canonical family|bundle/],
    ["unsupported category", { category: "Accessories" }, /category mismatch/],
    ["mixed format", { product_format: "capsule" }, /product format mismatch|conflicting variant evidence/],
    ["unreviewed family", { product_name: "Trained By JP ISO PRO 2kg", slug: "trained-by-jp-iso-pro-2kg", brand: "Trained By JP" }, /does not allow this canonical family/],
  ];

  for (const [name, overrides, pattern] of cases) {
    const seed = reviewedSeed();
    if (name === "inactive canonical parent collision") {
      seed.products = [{
        id: "p-existing",
        name: "CNP Premium Whey 2kg",
        slug: "cnp-premium-whey-2kg",
        brand: "CNP",
        category: "Whey Protein",
        gtin: null,
        is_active: false,
        merged_into_product_id: null,
        product_format: "powder",
      }];
      seed.product_variants = [{
        id: "pv-existing",
        product_id: "p-existing",
        variant_key: "default",
        display_name: "Default",
        is_active: true,
        is_default: true,
      }];
    }
    if (name === "SKU conflict") {
      seed.retailer_products = [{
        id: "rp-existing",
        retailer_id: "10",
        product_id: "p-other",
        product_variant_id: "pv-other",
        external_sku: "CNP09007",
        external_variant_id: "different",
      }];
    }
    if (name === "GTIN conflict") {
      seed.retailer_products = [{
        id: "rp-existing",
        retailer_id: "99",
        product_id: "p-other",
        product_variant_id: "pv-other",
        external_gtin: "1234567890123",
        external_variant_id: "different",
      }];
    }
    const supabase = createMockSupabase(seed);
    setSupabaseForTests(supabase);
    try {
      const result = await runImportRows([baseReviewedParentVariantRow(overrides)], {
        mode: "feed",
        safeCreate: true,
        dryRun: true,
      });
      assert.equal(result.report.approvedRows.length, 0, name);
      assert.match(result.report.blockedRows[0].block_reason || result.report.blockedRows[0].reason || (result.report.blockedRows[0].reasons || []).join("; "), pattern, name);
      assert.equal(supabase.writes.length, 0, name);
    } catch (error) {
      assert.match(error?.message || String(error), pattern, name);
      assert.equal(supabase.writes.length, 0, name);
    }
  }
});

test("reviewed Jon's parent explicit-variant batch blocks duplicate planned flavour", async () => {
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const rows = [
    baseReviewedParentVariantRow(),
    baseReviewedParentVariantRow({
      external_variant_id: "50602336354642",
      external_sku: "CNP09001",
      external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336354642",
      affiliate_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336354642",
    }),
  ];
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.collisionGroups.length, 1);
  assert.match(result.report.blockedRows[0].block_reason, /multiple unresolved feed variants/);
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's parent explicit-variant batch blocks duplicate Shopify variant ID", async () => {
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);
  const rows = [
    baseReviewedParentVariantRow(),
    baseReviewedParentVariantRow({
      external_sku: "CNP-DIFFERENT",
      flavour: "Banana",
      variant_name: "Banana / 2000g",
      external_options: JSON.stringify({ Flavour: "Banana" }),
    }),
  ];
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true, dryRun: true });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.invalidRows.length, 2);
  assert.match(result.report.blockedRows[0].block_reason, /duplicate variant identity/);
  assert.equal(supabase.writes.length, 0);
});

test("reviewed Jon's parent explicit-variant apply is idempotent through exact parent reuse", async () => {
  const supabase = createMockSupabase(reviewedSeed());
  setSupabaseForTests(supabase);

  const rows = [
    baseReviewedParentVariantRow(),
    baseReviewedParentVariantRow({
      external_variant_id: "50602336256338",
      external_sku: "CNP09004",
      external_options: JSON.stringify({ Flavour: "Banana" }),
      variant_name: "Banana / 2000g",
      flavour: "Banana",
      external_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336256338",
      affiliate_url: "https://jonssupplements.co.uk/products/cnp-professional-premium-whey-protein-2kg?variant=50602336256338",
    }),
  ];
  const result = await runImportRows(rows, { mode: "feed", safeCreate: true });

  assert.equal(result.successful, 2);
  assert.equal(result.failed, 0);
  assert.equal(supabase.tables.products.length, 1);
  assert.equal(supabase.tables.product_variants.length, 2);
  assert.equal(supabase.tables.retailer_products.length, 2);
  assert.equal(supabase.tables.offers.length, 2);
  assert.equal(supabase.tables.price_history.length, 2);
  assert.equal(
    supabase.tables.product_variants.some((variant) => variant.display_name === "Default"),
    false
  );
});

test("canonical signature triggers full required-header validation", async () => {
  const row = baseCanonicalFeedRow();
  delete row.affiliate_url;

  await assert.rejects(
    () => runImportRows([row], { mode: "feed", dryRun: true }),
    /missing required column\(s\): affiliate_url/
  );
});

test("variant_name alone does not activate canonical normalization", () => {
  const rows = [baseFeedRow({ variant_name: "Chocolate" })];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("size_unit alone does not activate canonical normalization", () => {
  const rows = [baseFeedRow({ size_unit: "g" })];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("external IDs without shipping_known do not activate canonical normalization", () => {
  const rows = [
    baseFeedRow({ external_product_id: "prod_100", external_variant_id: "var_100" }),
  ];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("canonical retailer feed rejects forbidden product verification columns", async () => {
  await assert.rejects(
    () =>
      runImportRows(
        [baseCanonicalFeedRow({ serving_count_verified: "50" })],
        { mode: "feed", dryRun: true }
      ),
    /forbidden column\(s\): serving_count_verified/
  );
});

test("canonical shipping validation distinguishes unknown, free, and paid shipping", () => {
  const unknown = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "false", shipping_cost: "" }),
  ])[0];
  const free = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "0" }),
  ])[0];
  const paid = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "2.99" }),
  ])[0];

  assert.equal(unknown.shipping_cost, null);
  assert.equal(free.shipping_cost, 0);
  assert.equal(paid.shipping_cost, 2.99);
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({ shipping_known: "false", shipping_cost: "2.99" }),
      ]),
    /shipping_cost must be blank when shipping_known is false/
  );
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({ shipping_known: "true", shipping_cost: "" }),
      ]),
    /shipping_cost is required when shipping_known is true/
  );
});

test("canonical variant fields map to evidence understood by variant guards", () => {
  const originalRow = baseCanonicalFeedRow({
    variant_name: "Unflavoured / 500g",
    size: "500",
    size_unit: "g",
    pack_count: "2",
  });
  const [row] = normalizeCanonicalRetailerFeedRows([originalRow]);
  const identity = parseVariantIdentity(row);

  assert.notStrictEqual(row, originalRow);
  assert.equal(originalRow.size, "500");
  assert.equal(Object.prototype.hasOwnProperty.call(originalRow, "variant"), false);
  assert.equal(row.size, "500 g");
  assert.match(row.variant, /Unflavoured \/ 500g/);
  assert.equal(identity.size.value, "500");
  assert.equal(identity.size.unit, "g");
  assert.equal(identity.flavour, "unflavoured");
  assert.equal(identity.packCount, 2);
});

test("canonical shipping ignores delivery_cost as an alternative", () => {
  const [unknown] = normalizeCanonicalRetailerFeedRows([
    baseCanonicalFeedRow({
      shipping_known: "false",
      shipping_cost: "",
      delivery_cost: "4.99",
    }),
  ]);

  assert.equal(unknown.shipping_cost, null);
  assert.equal(unknown.delivery_cost, undefined);
  assert.throws(
    () =>
      normalizeCanonicalRetailerFeedRows([
        baseCanonicalFeedRow({
          shipping_known: "true",
          shipping_cost: "",
          delivery_cost: "4.99",
        }),
      ]),
    /shipping_cost is required when shipping_known is true/
  );
});

test("legacy Awin-shaped feeds bypass canonical normalization", () => {
  const rows = [baseSafeCreateFeedRow()];

  assert.strictEqual(normalizeCanonicalRetailerFeedRows(rows), rows);
});

test("default feed mode remains match-only for unmatched rows", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseSafeCreateFeedRow()], { mode: "feed" });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.unmatchedRows.length, 1);
  assert.equal(result.report.newRetailersToCreate.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create approves safe unmatched rows for planned creation", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.unmatchedRows.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 1);
  assert.equal(result.report.newProductsToCreate.length, 1);
  assert.equal(result.report.retailerProductsToCreate.length, 1);
  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(result.report.shippingInferredFromPolicy.length, 1);
  assert.equal(result.report.productGtinBlocked.length, 1);
  assert.equal(result.report.externalGtinStoredOrUpdated.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create emits a closed v2 plan with integrity fingerprints and approval metadata", async () => {
  const supabase = createMockSupabase({
    retailers: [], products: [], retailer_products: [], offers: [], price_history: [],
  });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed", safeCreate: true, dryRun: true,
  });
  const plan = result.report.approvedRows[0].importPlan;
  assert.deepEqual(Object.keys(plan).sort(), [
    "approval", "expected_state", "meta", "offer", "price_history",
    "product", "product_variant", "retailer", "retailer_product",
  ]);
  assert.equal(plan.meta.version, "2");
  assert.equal(plan.meta.plan_kind, "feed");
  assert.equal(plan.meta.operation_type, "standard_import");
  assert.match(plan.meta.source_row_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(plan.meta.plan_fingerprint, /^[0-9a-f]{32}$/);
  assert.equal(plan.approval.approved, true);
  assert.equal(plan.approval.approval_type, "safe_create");
  assert.equal(plan.approval.approved_category, plan.product.values.category);
  assert.equal(plan.approval.canonical_name, plan.product.values.name);
  assert.equal(plan.approval.source_row_fingerprint, plan.meta.source_row_fingerprint);
  assert.equal(plan.approval.has_variant_evidence, false);
  assert.match(plan.approval.approval_fingerprint, /^[0-9a-f]{32}$/);
});

test("Fit House safe-create plans only neutral rows and blocks variant evidence", { concurrency: false }, async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 10);
  const rows = buildFitHouseCanonicalRows(config);
  const uniqueCount = (field) => new Set(rows.map((row) => row[field])).size;

  assert.equal(config.products.length, 10);
  assert.equal(rows.length, 10);
  assert.equal(uniqueCount("external_product_id"), 10);
  assert.equal(uniqueCount("external_variant_id"), 10);
  assert.equal(uniqueCount("slug"), 10);
  assert.equal(uniqueCount("external_url"), 10);
  assertFitHouseApprovedScope(config, rows);

  for (const row of rows) {
    assert.equal(
      priceHistoryTotal(row.price, row.shipping_cost),
      Math.round((Number(row.price) + 3.99) * 100) / 100
    );
  }

  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const logs = [];
  const originalLog = console.log;
  let result;

  console.log = (...values) => logs.push(values.join(" "));
  try {
    result = await runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(result.report.approvedRows.length, 4);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 6);
  assert.equal(result.report.exclusions.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 1);
  assert.equal(result.report.newRetailersToCreate[0].slug, "fit-house");
  assert.equal(result.report.newProductsToCreate.length, 4);
  assert.equal(result.report.retailerProductsToCreate.length, 4);
  assert.equal(result.report.offersToCreate.length, 4);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 4);
  assert.equal(result.report.blockedRows.length, 6);
  assert.equal(result.planned, 4);
  assert.equal(result.skipped, 6);
  assert.equal(supabase.writes.length, 0);
  assert.equal(
    logs.some((line) => line.includes("Dry run: no database writes performed.")),
    true
  );
});

test("Fit House existing defaults pass while unsafe new variant rows stay blocked", { concurrency: false }, async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 22);
  const rows = buildFitHouseCanonicalRows(config);
  const batchOneRows = rows.slice(0, 10);
  const products = batchOneRows.map((row, index) => ({
    id: `fit-product-${index + 1}`,
    name: row.product_name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    product_format: row.product_format,
    gtin: null,
  }));
  const retailerProducts = batchOneRows.map((row, index) => ({
    id: `fit-mapping-${index + 1}`,
    retailer_id: "fit-house-retailer",
    product_id: products[index].id,
    product_variant_id: `default-variant-${index + 1}`,
    external_url: row.external_url,
    external_gtin: null,
  }));
  const offers = batchOneRows.map((row, index) => ({
    id: `fit-offer-${index + 1}`,
    retailer_id: "fit-house-retailer",
    product_id: products[index].id,
    product_variant_id: `default-variant-${index + 1}`,
    retailer_product_id: `fit-mapping-${index + 1}`,
    price: Number(row.price),
    shipping_cost: Number(row.shipping_cost),
    total_price: priceHistoryTotal(row.price, row.shipping_cost),
    in_stock: true,
    url: row.affiliate_url,
  }));
  const supabase = createMockSupabase({
    retailers: [{
      id: "fit-house-retailer",
      name: "Fit House",
      slug: "fit-house",
      website: "https://fithouse.uk",
    }],
    products,
    retailer_products: retailerProducts,
    offers,
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const softgelRows = rows.filter((row) => row.product_format === "softgel");
  assert.equal(softgelRows.length, 4);
  assert.ok(softgelRows.every((row) => !isSafeCreateRowAmbiguous(row)));

  const originalLog = console.log;
  let result;
  console.log = () => {};
  try {
    result = await runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(result.report.approvedRows.length, 12);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 10);
  assert.equal(result.report.collisionGroups.length, 0);
  assert.equal(result.report.newRetailersToCreate.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 8);
  assert.equal(result.report.retailerProductsToCreate.length, 8);
  assert.equal(result.report.offersToCreate.length, 8);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 4);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 8);
  assert.equal(result.report.blockedRows.length, 10);
  assert.equal(supabase.writes.length, 0);
});

test("Fit House scope guard rejects an unmapped eleventh row before importer", async () => {
  const config = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../config/retailers/fit-house-shopify.json"),
      "utf8"
    )
  );
  config.products = config.products.slice(0, 10);
  const rows = buildFitHouseCanonicalRows(config);
  rows.push({
    ...rows[0],
    external_product_id: "9999999999999",
    external_variant_id: "99999999999999",
    slug: "unmapped-fit-house-product",
    external_url: "https://fithouse.uk/products/unmapped?variant=99999999999999",
    affiliate_url: "https://fithouse.uk/products/unmapped?variant=99999999999999",
  });
  let importerCalls = 0;

  async function guardedRun() {
    assertFitHouseApprovedScope(config, rows);
    importerCalls += 1;
    return runImportRows(rows, {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });
  }

  await assert.rejects(guardedRun, /must exactly match approved config/);
  assert.equal(importerCalls, 0);
});

test("offer preflight plans a new offer and price history row", async () => {
  const supabase = createMockSupabase({ offers: [] });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 0);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("offer preflight marks an identical offer unchanged", async () => {
  const { report, supabase } = await preflightExistingOffer();

  assert.equal(report.offersToCreate.length, 0);
  assert.equal(report.offersToUpdate.length, 0);
  assert.equal(report.offersUnchanged.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
});

test("offer preflight plans price changes with price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { price: "31.99" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.priceChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 1);
});

test("offer preflight plans shipping changes with price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { shipping_cost: "1.49" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.shippingChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 1);
});

test("offer preflight preserves existing shipping when feed shipping is unknown", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { shipping_cost: undefined, delivery_cost: "" },
    offerOverrides: { shipping_cost: 2.99, total_price: 32.98 },
  });

  assert.equal(report.offersToUpdate.length, 0);
  assert.equal(report.offersUnchanged.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight classifies stock-only changes without price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { in_stock: "false" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 1);
  assert.equal(report.urlOnlyChanges.length, 0);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight classifies URL-only changes without price history", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: { affiliate_url: "https://affiliate.test/new-offer" },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 0);
  assert.equal(report.urlOnlyChanges.length, 1);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

test("offer preflight does not call combined stock and URL changes only changes", async () => {
  const { report } = await preflightExistingOffer({
    rowOverrides: {
      in_stock: "false",
      affiliate_url: "https://affiliate.test/new-offer",
    },
  });

  assert.equal(report.offersToUpdate.length, 1);
  assert.equal(report.stockOnlyChanges.length, 0);
  assert.equal(report.urlOnlyChanges.length, 0);
  assert.equal(report.priceHistoryRowsToCreate.length, 0);
});

async function applyExistingOffer(rowOverrides = {}, offerOverrides = {}) {
  const row = baseFeedRow(rowOverrides);
  const supabase = createMockSupabase({
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1", external_url: row.url,
      external_gtin: row.gtin || null,
    }],
    offers: [{
      id: "o1", product_id: "p1", retailer_id: "r1", price: 29.99,
      product_variant_id: "default-variant-1", retailer_product_id: "rp1",
      shipping_cost: 0, total_price: 29.99, in_stock: true,
      url: baseFeedRow().url, ...offerOverrides,
    }],
  });
  setSupabaseForTests(supabase);
  const messages = [];
  const originalLog = console.log;
  console.log = (...args) => messages.push(args.join(" "));
  try {
    const result = await runImportRows([row], { mode: "feed" });
    return { result, supabase, messages };
  } finally {
    console.log = originalLog;
  }
}

test("unchanged offer is a true atomic-plan noop", async () => {
  const { result, supabase } = await applyExistingOffer();
  const offerUpdate = supabase.writes.find((write) => write.table === "offers");
  assert.equal(offerUpdate, undefined);
  assert.equal(supabase.writes.some((write) => write.table === "price_history"), false);
  assert.deepEqual(result.rowLevelOffers, [{ rowNumber: 2, slug: baseFeedRow().slug, offerAction: "unchanged" }]);
});

test("business offer changes keep full updates and price history rules", async () => {
  const cases = [
    { overrides: { price: "31.99" }, action: "update", history: true },
    { overrides: { shipping_cost: "1.49" }, action: "update", history: true },
    { overrides: { in_stock: "false" }, action: "update", history: false },
    { overrides: { affiliate_url: "https://affiliate.test/new-offer" }, action: "update", history: false },
  ];
  for (const item of cases) {
    const { result, supabase } = await applyExistingOffer(item.overrides);
    const offerUpdate = supabase.writes.find((write) => write.table === "offers");
    assert.equal(Object.hasOwn(offerUpdate.payload, "last_checked_at"), true);
    assert.equal(Object.hasOwn(offerUpdate.payload, "product_id"), false);
    assert.equal(Object.hasOwn(offerUpdate.payload, "retailer_product_id"), false);
    assert.equal(supabase.writes.some((write) => write.table === "price_history"), item.history);
    assert.equal(result.rowLevelOffers[0].offerAction, item.action);
  }
});

test("new offer reports row-level create", async () => {
  const supabase = createMockSupabase({ offers: [] });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseFeedRow()], { mode: "feed", dryRun: true });
  assert.deepEqual(result.rowLevelOffers, [{ rowNumber: 2, slug: baseFeedRow().slug, offerAction: "create" }]);
  assert.deepEqual(buildRowLevelOfferResults(result.report), result.rowLevelOffers);
});

test("formatPreflightReport includes detailed offer plan counters", async () => {
  const { report } = await preflightExistingOffer();
  const output = formatPreflightReport(report);

  assert.match(output, /offers would be created: 0/);
  assert.match(output, /offers would be updated: 0/);
  assert.match(output, /offers unchanged: 1/);
  assert.match(output, /price_history rows would be created: 0/);
  assert.match(output, /price changes: 0/);
  assert.match(output, /shipping changes: 0/);
  assert.match(output, /stock-only changes: 0/);
  assert.match(output, /URL-only changes: 0/);
});

test("safe-create requires is_for_sale to be present and a valid boolean", async () => {
  for (const overrides of [
    { is_for_sale: undefined },
    { is_for_sale: "" },
    { is_for_sale: "not-sure" },
  ]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow(overrides)], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.invalidRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }

  for (const is_for_sale of ["true", "1", "yes"]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow({ is_for_sale })], {
      mode: "feed",
      safeCreate: true,
      dryRun: true,
    });

    assert.equal(result.report.approvedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("safe-create allows an out-of-stock offer for an existing canonical product", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [product],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.invalidRows.length, 0);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToCreate.length, 1);
  assert.equal(result.report.offersToCreate.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create apply writes an out-of-stock offer without writing products", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [{ ...product }],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  await runImportRows([row], { mode: "feed", safeCreate: true });

  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].in_stock, false);
  assert.equal(supabase.tables.price_history.length, 1);
  assert.equal(
    supabase.writes.some((write) => write.table === "products"),
    false
  );
});

test("safe-create blocks an out-of-stock row without a canonical match", async () => {
  const { row, retailer } = outOfStockSafeCreateFixture();
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.invalidRows.length, 1);
  assert.equal(result.report.newProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 0);
  assert.equal(result.report.offersToCreate.length, 0);
  assert.deepEqual(result.report.invalidRows[0].reasons, [
    "in_stock must be true to create a new canonical product",
    "is_for_sale must be true to create a new canonical product",
  ]);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create plans an out-of-stock offer returning to stock as stock-only", async () => {
  const { row, retailer, product } = outOfStockSafeCreateFixture({
    in_stock: "true",
    is_for_sale: "true",
  });
  const supabase = createMockSupabase({
    retailers: [retailer],
    products: [product],
    retailer_products: [{
      id: "rp458",
      retailer_id: retailer.id,
      product_id: product.id,
      product_variant_id: "default-variant-1",
      external_url: getRetailerProductUrl(row),
      external_gtin: row.external_gtin,
    }],
    offers: [
      {
        id: "o458",
        product_id: product.id,
        retailer_id: retailer.id,
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp458",
        price: 16.99,
        shipping_cost: 3.99,
        total_price: 20.98,
        in_stock: false,
        url: getOfferUrl(row),
      },
    ],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.offersToUpdate.length, 1);
  assert.equal(result.report.stockOnlyChanges.length, 1);
  assert.equal(result.report.priceHistoryRowsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create blocks variant-ambiguous new product rows", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [
      baseSafeCreateFeedRow({
        product_name: "Mystery Supplement",
        external_name: "Mystery Supplement",
        slug: "mystery-supplement",
        description: "Unclear supplement with no useful product identity evidence",
        evidence_name: "",
        evidence_size: "",
        evidence_format: "",
      }),
    ],
    { mode: "feed", safeCreate: true }
  );

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create only allows approved supplement categories", async () => {
  for (const category of ["Vitamins", "Health Supplements", "Amino Acids", "Creatine"]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [baseSafeCreateFeedRow({ category, product_name: `${category} 500mg Capsules`, slug: `${category.toLowerCase().replace(/\s+/g, "-")}-500mg-capsules` })],
      { mode: "feed", safeCreate: true, dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }

  for (const category of [
    "Accessories",
    "Whey Protein",
    "Protein Bars",
    "Mass Gainer",
    "Pre Workout",
    "Weight Management",
    "Unclear",
  ]) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow({ category })], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.exclusions.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("safe-create allows only Marek-reviewed Jon's supplement families beyond the base allowlist", async () => {
  const cases = [
    {
      product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      slug: "efectiv-whey-protein-60-serving-1-8kg",
      brand: "Efectiv",
      category: "Whey Protein",
    },
    {
      product_name: "Efectiv Grass Fed Whey Protein Isolate 2kg",
      slug: "efectiv-grass-fed-whey-protein-isolate-2kg",
      brand: "Efectiv",
      category: "Whey Protein",
    },
    {
      product_name: "PER4M Egg White Protein 1.8kg",
      slug: "per4m-egg-white-protein-1-8kg",
      brand: "Per4m",
      category: "Whey Protein",
    },
    {
      product_name: "Gas Mark 10 Pitbull Pump Pre Workout 25 Servings",
      slug: "gas-mark-10-pitbull-pump-pre-workout-25-servings",
      brand: "Gas Mark 10",
      category: "Pre Workout",
    },
    {
      product_name: "Conteh Sports Mega Pump Elite 30 Servings",
      slug: "conteh-sports-mega-pump-elite-30-servings",
      brand: "Conteh Sports",
      category: "Pre Workout",
    },
    {
      product_name: "Conteh Sports Essential Gains EAA 465g",
      slug: "conteh-sports-essential-gains-eaa-465g",
      brand: "Conteh Sports",
      category: "Amino Acids",
    },
    {
      product_name: "PER4M Greens 150g",
      slug: "per4m-greens-150g",
      brand: "Per4m",
      category: "Health Supplements",
    },
    {
      product_name: "Strom Sports Cream of Rice 2kg",
      slug: "strom-sports-cream-of-rice-2kg",
      brand: "Strom",
      category: "Health Supplements",
    },
    {
      product_name: "Apex Formulas Cream of Oats 2kg",
      slug: "apex-formulas-cream-of-oats-2kg",
      brand: "Apex Formulas",
      category: "Health Supplements",
    },
    {
      product_name: "PER4M Protein Pancakes 16 Servings",
      slug: "per4m-protein-pancakes-16-servings",
      brand: "Per4m",
      category: "Health Supplements",
    },
  ];

  for (const [index, item] of cases.entries()) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [baseSafeCreateFeedRow({
        ...item,
        product_format: "powder",
        evidence_format: "powder",
        external_gtin: "",
        external_id: `JONS-PRODUCT-${index}`,
        merchant_product_id: `JONS-PRODUCT-${index}`,
        aw_product_id: `JONS-AW-${index}`,
        external_name: item.product_name,
        external_url: `https://jonssupplements.co.uk/products/${item.slug}?variant=${5000 + index}`,
        merchant_deep_link: `https://jonssupplements.co.uk/products/${item.slug}?variant=${5000 + index}`,
        aw_deep_link: `https://jonssupplements.co.uk/products/${item.slug}?variant=${5000 + index}`,
        affiliate_url: `https://jonssupplements.co.uk/products/${item.slug}?variant=${5000 + index}`,
        url: `https://jonssupplements.co.uk/products/${item.slug}?variant=${5000 + index}`,
      })],
      { mode: "feed", safeCreate: true, dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 1, item.product_name);
    assert.equal(result.report.exclusions.length, 0, item.product_name);
    assert.equal(result.report.ambiguousRows.length, 0, item.product_name);
    assert.equal(supabase.writes.length, 0);
  }
});

test("safe-create keeps reviewed-family negative safeguards fail-closed", async () => {
  const blockedCases = [
    {
      name: "bundle/free item",
      overrides: {
        product_name: "Efectiv Whey Protein 60 Serving 1.8kg Plus Free Shaker",
        slug: "efectiv-whey-protein-plus-free-shaker",
        brand: "Efectiv",
        category: "Whey Protein",
        product_format: "powder",
        evidence_format: "powder",
      },
      reportKey: "exclusions",
    },
    {
      name: "dated/BBE title",
      overrides: {
        product_name: "Efectiv Whey Protein 60 Serving 1.8kg BBE 08/26",
        slug: "efectiv-whey-protein-bbe",
        brand: "Efectiv",
        category: "Whey Protein",
        product_format: "powder",
        evidence_format: "powder",
      },
      reportKey: "exclusions",
    },
    {
      name: "unsupported unrelated category",
      overrides: {
        product_name: "Example Lifting Straps",
        slug: "example-lifting-straps",
        brand: "Example",
        category: "Accessories",
        product_format: "",
        evidence_format: "",
      },
      reportKey: "exclusions",
    },
    {
      name: "missing source URL identity",
      overrides: {
        product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
        slug: "efectiv-whey-protein-missing-url",
        brand: "Efectiv",
        category: "Whey Protein",
        product_format: "powder",
        evidence_format: "powder",
        external_url: "",
        merchant_deep_link: "",
        aw_deep_link: "",
        affiliate_url: "",
        url: "",
      },
      reportKey: "invalidRows",
    },
    {
      name: "conflicting product format",
      overrides: {
        product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
        slug: "efectiv-whey-protein-capsules",
        brand: "Efectiv",
        category: "Whey Protein",
        product_format: "capsule",
        evidence_format: "capsules",
      },
      reportKey: "exclusions",
    },
    {
      name: "unclear formula/version",
      overrides: {
        product_name: "HR Labs DEFIB V3 480g",
        slug: "hr-labs-defib-v3-480g",
        brand: "HR Labs",
        category: "Pre Workout",
        product_format: "powder",
        evidence_format: "powder",
      },
      reportKey: "exclusions",
    },
  ];

  for (const { name, overrides, reportKey } of blockedCases) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [baseSafeCreateFeedRow({
        ...overrides,
        external_name: overrides.product_name,
      })],
      { mode: "feed", safeCreate: true, dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 0, name);
    assert.equal(result.report[reportKey].length, 1, name);
    assert.equal(supabase.writes.length, 0);
  }

  const duplicateSupabase = createMockSupabase({
    retailers: [],
    products: [{
      id: "existing-whey",
      name: "Efectiv Whey Protein 60 Serving 1.8kg",
      slug: "existing-efectiv-whey-protein",
      brand: "Efectiv",
      category: "Whey Protein",
      gtin: null,
    }],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(duplicateSupabase);
  const duplicateResult = await runImportRows(
    [baseSafeCreateFeedRow({
      product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      slug: "efectiv-whey-protein-60-serving-1-8kg",
      brand: "Efectiv",
      category: "Whey Protein",
      product_format: "powder",
      evidence_format: "powder",
      external_name: "Efectiv Whey Protein 60 Serving 1.8kg",
    })],
    { mode: "feed", safeCreate: true, dryRun: true }
  );

  assert.equal(duplicateResult.report.approvedRows.length, 0);
  assert.equal(duplicateResult.report.invalidRows.length, 1);
  assert.match(duplicateResult.report.invalidRows[0].reasons.join(" "), /possible duplicate product/);
  assert.equal(duplicateSupabase.writes.length, 0);

  const duplicateVariantSupabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(duplicateVariantSupabase);
  const duplicateVariantRows = [
    baseSafeCreateFeedRow({
      product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      slug: "efectiv-whey-protein-60-serving-1-8kg",
      brand: "Efectiv",
      category: "Whey Protein",
      product_format: "powder",
      evidence_format: "powder",
      external_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      external_product_id: "jons-product-1",
      external_variant_id: "jons-variant-1",
      price: "29.99",
    }),
    baseSafeCreateFeedRow({
      product_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      slug: "efectiv-whey-protein-60-serving-1-8kg",
      brand: "Efectiv",
      category: "Whey Protein",
      product_format: "powder",
      evidence_format: "powder",
      external_name: "Efectiv Whey Protein 60 Serving 1.8kg",
      external_product_id: "jons-product-1",
      external_variant_id: "jons-variant-1",
      price: "31.99",
    }),
  ];
  const duplicateVariantResult = await runImportRows(duplicateVariantRows, {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(duplicateVariantResult.report.approvedRows.length, 0);
  assert.equal(duplicateVariantResult.report.invalidRows.length, 2);
  assert.equal(duplicateVariantSupabase.writes.length, 0);

  const brandConflict = assessVariantCompatibility(
    { product_name: "Apex Formulas Cream of Oats 2kg", brand: "Wrong Brand", product_format: "powder" },
    { name: "Apex Formulas Cream of Oats 2kg", brand: "Apex Formulas", product_format: "powder" }
  );
  assert.equal(brandConflict.compatible, false);
  assert(brandConflict.reasons.includes("brand conflict"));

  const sizeConflict = assessVariantCompatibility(
    { product_name: "Efectiv Whey Protein 1kg", brand: "Efectiv", product_format: "powder" },
    { name: "Efectiv Whey Protein 60 Serving 1.8kg", brand: "Efectiv", product_format: "powder" }
  );
  assert.equal(sizeConflict.compatible, false);
  assert(sizeConflict.reasons.includes("size conflict"));
});

test("safe-create dry-run reports planned rows instead of skipped approved rows", async () => {
  const safeSupabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(safeSupabase);

  const safeResult = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(safeResult.planned, 1);
  assert.equal(safeResult.skipped, 0);
  assert.equal(safeSupabase.writes.length, 0);

  const matchOnlySupabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(matchOnlySupabase);

  const matchOnlyResult = await runImportRows([baseSafeCreateFeedRow()], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(matchOnlyResult.planned, 0);
  assert.equal(matchOnlyResult.skipped, 1);
  assert.equal(matchOnlySupabase.writes.length, 0);
});

test("Simply Supplements sample-shaped safe-create rows still approve twenty rows", async () => {
  const productNames = [
    "Vitamin C 500mg Capsules",
    "Immunity Support with Vitamin C, Vitamin D & Zinc",
    "Multivitamins A,B,C,D & E 100% NRV",
    "Vitamin D3 Tablets 2,000iu",
    "Gentle Vitamin C 1000mg Capsules",
    "Glucosamine Sulphate 500mg",
    "Glucosamine Sulphate 1,000mg - Tablets",
    "Vitamin B Complex Tablets",
    "Zinc Tablets 15mg",
    "Cod Liver Oil Capsules 550mg",
    "Omega 3 Capsules 500mg",
    "Omega 3 for Kids 500mg",
    "Selenium 220mcg with Multivitamins & Iron",
    "Folic Acid 400mcg",
    "Glucosamine 1,000mg with Vitamin C Tablets",
    "Potassium Chloride 1000mg",
    "Biotin Tablets 10,000mcg",
    "Chewable Calcium & Vitamin D3 Tablets",
    "Cod Liver Oil Capsules 1,000mg",
    "Max Strength Glucosamine Sulphate 1858mg 2KCl",
  ];
  const rows = productNames.map((product_name, index) =>
    baseSafeCreateFeedRow({
      product_name,
      external_name: product_name,
      slug: `simply-sample-${index + 1}`,
      category: index === 5 || index === 6 || index === 14 || index === 15 || index === 19
        ? "Health Supplements"
        : "Vitamins",
      external_gtin: `505604951${String(1000 + index).padStart(4, "0")}`,
      external_id: `C${100 + index}`,
      merchant_product_id: `C${100 + index}`,
      merchant_deep_link: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      external_url: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      direct_url: `https://www.simplysupplements.co.uk/products/sample-${index + 1}`,
      aw_deep_link: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      affiliate_url: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      url: `https://www.awin1.com/pclick.php?p=${45010750000 + index}&a=2973875&m=5959`,
      description: `${product_name} capsules tablets supplement`,
      evidence_name: product_name,
      evidence_size: product_name,
      evidence_format: product_name,
    })
  );
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(rows, {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 20);
  assert.equal(result.report.ambiguousRows.length, 0);
  assert.equal(result.planned, 20);
  assert.equal(result.skipped, 0);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create writes direct retailer URL to mapping and affiliate URL to offer", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const row = baseSafeCreateFeedRow();
  const result = await runImportRows([row], {
    mode: "feed",
    safeCreate: true,
  });
  const mappingWrite = supabase.writes.find(
    (write) => write.table === "retailer_products"
  );
  const offerWrite = supabase.writes.find((write) => write.table === "offers");
  const productWrite = supabase.writes.find((write) => write.table === "products");

  assert.equal(result.successful, 1);
  assert.equal(getRetailerProductUrl(row), row.merchant_deep_link);
  assert.equal(getOfferUrl(row), row.aw_deep_link);
  assert.equal(mappingWrite.payload.external_url, row.merchant_deep_link);
  assert.equal(mappingWrite.payload.external_gtin, row.external_gtin);
  assert.equal(offerWrite.payload.url, row.aw_deep_link);
  assert.equal(offerWrite.payload.shipping_cost, 1.99);
  assert.equal(offerWrite.payload.total_price, 6.98);
  assert.equal(productWrite.payload.gtin, null);
});

test("safe-create blocks excluded and unsafe rows", async () => {
  const cases = [
    { product_name: "CBD Oil Capsules", description: "CBD supplement" },
    { product_name: "Dog Multivitamin Tablets", description: "pet vitamins" },
    { product_name: "Magnesium Massage Gel", description: "topical massage gel" },
    { product_name: "Vitamin D Blood Test Kit", description: "medical test kit" },
    { aw_deep_link: "", affiliate_url: "", url: "" },
    { merchant_deep_link: "", external_url: "", direct_url: "" },
  ];

  for (const overrides of cases) {
    const supabase = createMockSupabase({
      retailers: [],
      products: [],
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseSafeCreateFeedRow(overrides)], {
      mode: "feed",
      safeCreate: true,
    });

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(supabase.writes.length, 0);
  }
});

test("feed collision group produces zero writes and is order independent", async () => {
  const rows = [
    baseFeedRow(),
    baseFeedRow({
      product_name: "BioTech USA Iso Whey Zero 1816g Vanilla powder",
      url: "https://retailer.test/iso-whey-zero-vanilla",
      gtin: "0001234567891",
    }),
  ];

  for (const orderedRows of [rows, [...rows].reverse()]) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);

    const result = await runImportRows(orderedRows, { mode: "feed" });

    assert.equal(result.report.collisionGroups.length, 1);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.externalGtinStoredOrUpdated.length, 0);
    assert.equal(result.report.productGtinBlocked.length, 0);
    assert.equal(supabase.writes.length, 0);
  }
});

test("no writes occur before complete feed preflight", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ gtin: "" })], { mode: "feed" });

  const firstWrite = supabase.operations.findIndex((operation) => operation.type === "rpc");
  const readsBeforeFirstWrite = supabase.operations
    .slice(0, firstWrite)
    .filter((operation) => operation.type === "read");

  assert(firstWrite > -1);
  assert(readsBeforeFirstWrite.length >= 3);
});

test("conflicting verified product GTIN produces zero product GTIN update", async () => {
  const supabase = createMockSupabase({
    products: [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: "existing-gtin",
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [baseFeedRow({ product_gtin_verified: "true", gtin: "different-gtin" })],
    { mode: "feed" }
  );

  assert.equal(result.report.gtinConflicts.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("identical existing product GTIN is accepted unchanged", async () => {
  const supabase = createMockSupabase({
    products: [
      {
        id: "p1",
        name: "BioTech USA Iso Whey Zero 1816g powder",
        brand: "BioTech USA",
        category: "Whey Protein",
        gtin: "0001234567890",
        slug: "biotech-usa-iso-whey-zero-1816g",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [baseFeedRow({ product_gtin_verified: "true" })],
    { mode: "feed" }
  );
  assert.equal(result.report.gtinConflicts.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
});

test("existing canonical product is never updated by a canonical retailer feed", async () => {
  const existingProduct = {
    id: "p1",
    name: "BioTech USA Iso Whey Zero 1816g powder",
    slug: "biotech-usa-iso-whey-zero-1816g",
    brand: "BioTech USA",
    category: "Whey Protein",
    servings: 50,
    description: "Existing canonical description",
    image: "https://canonical.test/existing.jpg",
    price: 44.99,
    gtin: "0001234567890",
    net_weight_g: 1816,
    net_volume_ml: 500,
    serving_count_verified: 50,
    serving_size_g: 36,
    serving_size_ml: 10,
    protein_per_serving_g: 25,
    creatine_per_serving_g: 3,
    unit_count: 60,
    unit_type: "scoop",
    product_format: "powder",
    unit_pricing_verified: true,
    nutrition_verified: true,
  };
  const supabase = createMockSupabase({
    products: [{ ...existingProduct }],
  });
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ description: "", image: "https://retailer.test/new.jpg", price: "29.99" })],
    { mode: "feed" }
  );

  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
  assert.deepEqual(supabase.tables.products[0], existingProduct);
  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.retailer_products[0].external_gtin, "0001234567890");
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].price, 29.99);
  assert.equal(supabase.tables.price_history.length, 1);
  assert.equal(supabase.tables.price_history[0].price, 29.99);
});

test("new product create keeps validated metrics but isolates retailer GTIN", async () => {
  const supabase = createMockSupabase({ products: [] });
  setSupabaseForTests(supabase);

  await runImportRows(
    [
      baseSafeCreateFeedRow({
        gtin: "5056049515772",
        external_gtin: "5056049515772",
        product_gtin_verified: "true",
        net_weight_g: "60",
        serving_count_verified: "60",
        serving_size_g: "1",
        protein_per_serving_g: "0.5",
        creatine_per_serving_g: "0.2",
        unit_count: "60",
        unit_type: "capsule",
        product_format: "capsule",
        unit_pricing_verified: "true",
        nutrition_verified: "true",
      }),
    ],
    { mode: "feed", safeCreate: true }
  );

  const productInsert = supabase.writes.find(
    (write) => write.table === "products" && write.operation === "insert"
  );

  assert(productInsert);
  assert.equal(productInsert.payload.gtin, null);
  assert.equal(productInsert.payload.net_weight_g, 60);
  assert.equal(productInsert.payload.serving_count_verified, 60);
  assert.equal(productInsert.payload.product_format, "capsule");
  assert.equal(productInsert.payload.unit_pricing_verified, true);
  assert.equal(productInsert.payload.nutrition_verified, true);
});

test("existing mapping stores compatible external_gtin", async () => {
  const supabase = createMockSupabase({
    retailer_products: [
      {
        id: "rp1",
        retailer_id: "r1",
        product_id: "p1",
        product_variant_id: "default-variant-1",
        external_url: "https://retailer.test/iso-whey-zero-chocolate",
        external_gtin: null,
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], { mode: "feed" });

  assert.equal(result.report.externalGtinStoredOrUpdated.length, 1);
  assert.equal(result.report.retailerProductsToUpdate.length, 1);
  assert.deepEqual(
    result.report.retailerProductsToUpdate[0].changes.external_gtin,
    { before: null, after: "0001234567890" }
  );
  assert.equal(result.report.retailerProductsUnchanged.length, 0);
  assert.equal(
    supabase.writes.some(
      (write) =>
        write.table === "retailer_products" &&
        write.payload.external_gtin === "0001234567890"
    ),
    true
  );
});

test("conflicting existing external_gtin is blocked", async () => {
  const supabase = createMockSupabase({
    retailer_products: [
      {
        retailer_id: "r1",
        product_id: "p1",
        external_url: "https://retailer.test/iso-whey-zero-chocolate",
        external_gtin: "existing-external-gtin",
      },
    ],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow()], { mode: "feed" });

  assert.equal(result.report.externalGtinConflicts.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("repeated identical feed rows are deduplicated and reruns are idempotent", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const rows = [baseFeedRow({ gtin: "" }), baseFeedRow({ gtin: "" })];
  const first = await runImportRows(rows, { mode: "feed" });
  const writesAfterFirstRun = supabase.writes.length;
  const second = await runImportRows(rows, { mode: "feed" });

  assert.equal(first.report.deduplicatedRows.length, 1);
  assert.equal(first.report.approvedRows.length, 1);
  assert.equal(second.report.deduplicatedRows.length, 1);
  assert.equal(second.report.approvedRows.length, 1);
  assert.equal(supabase.writes.length, writesAfterFirstRun);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(
    supabase.writes.some(
      (write) => write.table === "products" && write.operation === "update"
    ),
    false
  );
});

test("invalid feed prices produce zero writes", async () => {
  await assertInvalidFeedRowHasZeroWrites({ price: undefined });
  await assertInvalidFeedRowHasZeroWrites({ price: "" });
  await assertInvalidFeedRowHasZeroWrites({ price: "0" });
  await assertInvalidFeedRowHasZeroWrites({ price: "-1" });
  await assertInvalidFeedRowHasZeroWrites({ price: "NaN" });
  await assertInvalidFeedRowHasZeroWrites({ price: "Infinity" });
});

test("invalid feed shipping produces zero writes", async () => {
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "NaN" });
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "Infinity" });
  await assertInvalidFeedRowHasZeroWrites({ shipping_cost: "-1" });
  await assertInvalidFeedRowHasZeroWrites({
    shipping_cost: undefined,
    delivery_cost: "NaN",
  });
});

test("unknown feed shipping remains allowed", async () => {
  for (const shipping_cost of [undefined, "", null]) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);

    const result = await runImportRows([baseFeedRow({ gtin: "", shipping_cost })], {
      mode: "feed",
    });

    assert.equal(result.report.invalidRows.length, 0);
    assert.equal(result.report.approvedRows.length, 1);
    assert(supabase.writes.length > 0);
  }
});

test("existing offer keeps known shipping when feed shipping is unknown", async () => {
  const supabase = createMockSupabase({
    retailer_products: [{
      id: "rp1", retailer_id: "r1", product_id: "p1",
      product_variant_id: "default-variant-1",
      external_url: baseFeedRow().url, external_gtin: null,
    }],
    offers: [
      {
        id: "o1",
        product_id: "p1",
        retailer_id: "r1",
        product_variant_id: "default-variant-1",
        retailer_product_id: "rp1",
        price: 10,
        shipping_cost: 2.99,
        total_price: 12.99,
      },
    ],
  });
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ price: "10", shipping_cost: undefined, delivery_cost: "", gtin: "" })],
    { mode: "feed" }
  );

  const historyWrites = supabase.writes.filter(
    (write) => write.table === "price_history"
  );

  assert.equal(supabase.tables.offers[0].shipping_cost, 2.99);
  assert.equal(supabase.tables.offers[0].total_price, 12.99);
  assert.equal(historyWrites.length, 0);
});

test("existing offer records explicit shipping changes including free delivery", async () => {
  for (const [shipping_cost, expectedTotal] of [["0", 10], ["1.49", 11.49]]) {
    const supabase = createMockSupabase({
      retailer_products: [{
        id: "rp1", retailer_id: "r1", product_id: "p1",
        product_variant_id: "default-variant-1",
        external_url: baseFeedRow().url, external_gtin: null,
      }],
      offers: [
        {
          id: "o1",
          product_id: "p1",
          retailer_id: "r1",
          product_variant_id: "default-variant-1",
          retailer_product_id: "rp1",
          price: 10,
          shipping_cost: 2.99,
          total_price: 12.99,
        },
      ],
    });
    setSupabaseForTests(supabase);

    await runImportRows(
      [baseFeedRow({ price: "10", shipping_cost, gtin: "" })],
      { mode: "feed" }
    );

    const offerUpdate = supabase.writes.find(
      (write) => write.table === "offers" && write.operation === "update"
    );
    const historyWrite = supabase.writes.find(
      (write) => write.table === "price_history"
    );

    assert.equal(offerUpdate.payload.shipping_cost, Number(shipping_cost));
    assert.equal(offerUpdate.payload.total_price, expectedTotal);
    assert.equal(historyWrite.payload.shipping_cost, Number(shipping_cost));
    assert.equal(historyWrite.payload.total_price, expectedTotal);
  }
});

test("new offer without shipping keeps null shipping and total", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ shipping_cost: undefined, delivery_cost: "", gtin: "" })],
    { mode: "feed" }
  );

  const offerInsert = supabase.writes.find(
    (write) => write.table === "offers" && write.operation === "insert"
  );

  assert.equal(offerInsert.payload.shipping_cost, null);
  assert.equal(offerInsert.payload.total_price, null);
});

test("Simply Supplements blank delivery is inferred from retailer policy", async () => {
  const cases = [
    { price: "4.99", expectedShipping: 1.99, expectedTotal: 6.98 },
    { price: "19.99", expectedShipping: 1.99, expectedTotal: 21.98 },
    { price: "20.00", expectedShipping: 0, expectedTotal: 20 },
    { price: "23.99", expectedShipping: 0, expectedTotal: 23.99 },
    { price: "25.00", expectedShipping: 0, expectedTotal: 25 },
  ];

  for (const { price, expectedShipping, expectedTotal } of cases) {
    const row = baseFeedRow({
      retailer_name: "Simply Supplements",
      retailer_website: "https://www.simplysupplements.co.uk",
      merchant_id: "5959",
      merchant_name: "Simply Supplements",
      price,
      shipping_cost: undefined,
      delivery_cost: "",
      gtin: "",
    });
    const supabase = createMockSupabase({
      retailers: [
        { id: "r1", name: "Simply Supplements", slug: "simply-supplements" },
      ],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([row], { mode: "feed" });
    const offerWrite = supabase.writes.find((write) => write.table === "offers");

    assert.equal(result.report.shippingInferredFromPolicy.length, 1);
    assert.equal(
      result.report.shippingInferredFromPolicy[0].reason,
      "shipping inferred from retailer policy"
    );
    assert.equal(offerWrite.payload.shipping_cost, expectedShipping);
    assert.equal(offerWrite.payload.total_price, expectedTotal);
    assert.notEqual(offerWrite.payload.total_price, 0);
  }
});

test("other retailer blank delivery does not infer shipping", () => {
  const result = normalizeShippingForImport(
    baseFeedRow({ shipping_cost: undefined, delivery_cost: "" }),
    "feed"
  );

  assert.equal(result.shippingInferredFromPolicy, false);
  assert.equal(result.row.shipping_cost, null);
});

test("valid feed delivery_cost overrides inferred Simply Supplements rule", () => {
  const result = normalizeShippingForImport(
    baseFeedRow({
      retailer_name: "Simply Supplements",
      merchant_id: "5959",
      merchant_name: "Simply Supplements",
      price: "25.00",
      shipping_cost: undefined,
      delivery_cost: "2.49",
    }),
    "feed"
  );

  assert.equal(result.shippingInferredFromPolicy, false);
  assert.equal(result.row.shipping_cost, 2.49);
});

test("price history total is null when shipping is unknown", async () => {
  assert.equal(priceHistoryTotal("19.99", null), null);
  assert.equal(priceHistoryTotal("19.99", ""), null);
  assert.equal(priceHistoryTotal("19.99", 0), 19.99);

  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows(
    [baseFeedRow({ gtin: "", shipping_cost: undefined, delivery_cost: "" })],
    { mode: "feed" }
  );

  const historyWrite = supabase.writes.find(
    (write) => write.table === "price_history"
  );
  const offerWrite = supabase.writes.find((write) => write.table === "offers");

  assert.equal(offerWrite.payload.shipping_cost, null);
  assert.equal(offerWrite.payload.total_price, null);
  assert.equal(historyWrite.payload.shipping_cost, null);
  assert.equal(historyWrite.payload.total_price, null);
});

test("manual import offer total_price uses known shipping", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ shipping_cost: "2.50" })]);

  const offerWrite = supabase.writes.find((write) => write.table === "offers");
  const historyWrite = supabase.writes.find(
    (write) => write.table === "price_history"
  );

  assert.equal(offerWrite.payload.total_price, 32.49);
  assert.equal(historyWrite.payload.total_price, 32.49);
  assert.notEqual(offerWrite.payload.total_price, 0);
});

test("additional variant conflicts are blocked", () => {
  const sizeConflict = assessVariantCompatibility(
    { product_name: "Test Product 1.8kg powder", brand: "Test" },
    { name: "Test Product 2kg powder", brand: "Test" }
  );
  const formatConflict = assessVariantCompatibility(
    { product_name: "Test Product 60 capsules", brand: "Test" },
    { name: "Test Product 120 tablets", brand: "Test" }
  );
  const liquidPowderConflict = assessVariantCompatibility(
    { product_name: "Test Product liquid 500ml", brand: "Test" },
    { name: "Test Product powder 500g", brand: "Test" }
  );

  assert.equal(sizeConflict.compatible, false);
  assert(sizeConflict.reasons.includes("size conflict"));
  assert.equal(formatConflict.compatible, false);
  assert(formatConflict.reasons.includes("format conflict"));
  assert.equal(liquidPowderConflict.compatible, false);
  assert(liquidPowderConflict.reasons.includes("size conflict"));
  assert(liquidPowderConflict.reasons.includes("format conflict"));
});

test("feed dry-run performs zero writes", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  await runImportRows([baseFeedRow({ gtin: "" })], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(supabase.writes.length, 0);
});

test("manual import attaches an offer to an existing product without creating a product", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow({ gtin: "manual-retailer-gtin" })], {
    mode: "manual",
  });

  assert.equal(result.successful, 1);
  assert.equal(supabase.writes.some((write) => write.table === "products"), false);
  assert.equal(supabase.writes.some((write) => write.table === "retailer_products"), true);
  assert.equal(supabase.writes.some((write) => write.table === "offers"), true);
  assert.equal(supabase.writes.some((write) => write.table === "price_history"), true);
});

test("manual import blocks an unknown canonical product before all writes", async () => {
  const supabase = createMockSupabase({
    retailers: [],
    products: [],
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRows([baseFeedRow({ gtin: "manual-gtin" })], {
    mode: "manual",
  });

  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.match(result.report.blockedRows[0].reason, /existing canonical product/i);
  assert.equal(result.blockedRows.length, 1);
  assert.match(result.blockedRows[0].block_reason, /existing canonical product/i);
  assert.equal(supabase.writes.length, 0);
});

async function resolveDefaultFixture(rowOverrides, productVariants) {
  const row = baseFeedRow({ gtin: "", ...rowOverrides });
  const product = {
    id: "p1", name: row.product_name, slug: row.slug, brand: row.brand,
    category: row.category, product_format: row.product_format || null, gtin: null,
  };
  const supabase = createMockSupabase({ products: [product], product_variants: productVariants });
  setSupabaseForTests(supabase);
  return runImportRows([row], { mode: "feed", dryRun: true });
}

function defaultVariant(overrides = {}) {
  return {
    id: "pv-default", product_id: "p1", flavour_code: null, flavour_label: null,
    size_value: null, size_unit: null, pack_count: null, product_format: null,
    is_active: true, is_default: true, ...overrides,
  };
}

test("KIOR-like pack_count 1 capsule evidence resolves the neutral default", async () => {
  const result = await resolveDefaultFixture(
    { product_name: "KIOR Daily Capsules", slug: "kior-daily-capsules", brand: "KIOR", pack_count: "1", product_format: "capsule" },
    [defaultVariant()]
  );
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.approvedRows[0].importPlan.product_variant.id, "pv-default");
});

test("Fit House-like format-only evidence resolves one neutral default", async () => {
  const result = await resolveDefaultFixture(
    { product_name: "Fit House Creatine Powder", slug: "fit-house-creatine", brand: "Fit House", product_format: "powder", pack_count: "1" },
    [defaultVariant()]
  );
  assert.equal(result.report.approvedRows.length, 1);
});

test("Fit House Barebells milkshake resolves ready_to_drink canonical variant", async () => {
  const chocolate330 = {
    ...defaultVariant({ id: "pv-barebells-chocolate", is_default: false }),
    variant_key: "chocolate-330ml",
    display_name: "Chocolate / 330ml",
    flavour_code: "chocolate",
    flavour_label: "Chocolate",
    size_value: 330,
    size_unit: "ml",
    pack_count: 1,
    product_format: "ready_to_drink",
  };
  const result = await resolveDefaultFixture(
    {
      product_name: "Barebells High Protein Milkshake 330ml",
      slug: "barebells-high-protein-milkshake-330ml",
      brand: "Barebells",
      category: "Protein Bars",
      external_options: JSON.stringify({ Flavor: "Chocolate" }),
      variant_name: "Chocolate / 330ml",
      size: "330ml",
      size_unit: "",
      flavour: "Chocolate",
      product_format: "",
      pack_count: "1",
    },
    [defaultVariant(), chocolate330]
  );
  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.approvedRows[0].importPlan.product_variant.id, "pv-barebells-chocolate");
});

test("exact reviewed PER4M 12 x 62g bar family passes the final safe-create guard", () => {
  assert.deepEqual(getSafeCreateExclusionReasons({
    product_name: "PER4M Protein Bars Box of 12 x 62g",
    category: "Protein Bars",
    product_format: "bar",
    size: "62",
    size_unit: "g",
  }), []);
});

test("reviewed bar guard remains exact and blocks wrong format or unrelated bars", () => {
  assert.deepEqual(getSafeCreateExclusionReasons({
    product_name: "PER4M Protein Bars Box of 12 x 62g",
    category: "Protein Bars",
    product_format: "powder",
    size: "62",
    size_unit: "g",
  }), ["unsupported reviewed product format"]);
  assert.deepEqual(getSafeCreateExclusionReasons({
    product_name: "Unreviewed Protein Bars Box of 12 x 62g",
    category: "Protein Bars",
    product_format: "bar",
    size: "62",
    size_unit: "g",
  }), ["category is not allowed for safe-create"]);
});

test("liquid evidence still blocks a powder canonical variant", async () => {
  const chocolatePowder = {
    ...defaultVariant({ id: "pv-chocolate-powder", is_default: false }),
    variant_key: "chocolate-330ml",
    display_name: "Chocolate / 330ml",
    flavour_code: "chocolate",
    flavour_label: "Chocolate",
    size_value: 330,
    size_unit: "ml",
    pack_count: 1,
    product_format: "powder",
  };
  const result = await resolveDefaultFixture(
    {
      product_name: "Barebells High Protein Milkshake 330ml",
      slug: "barebells-high-protein-milkshake-330ml",
      brand: "Barebells",
      category: "Protein Bars",
      external_options: JSON.stringify({ Flavor: "Chocolate" }),
      variant_name: "Chocolate / 330ml",
      size: "330ml",
      size_unit: "",
      flavour: "Chocolate",
      product_format: "",
      pack_count: "1",
    },
    [defaultVariant(), chocolatePowder]
  );
  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.blockedRows.length, 1);
  assert.match(result.report.blockedRows[0].reason, /format conflict|canonical product_variant/i);
});

test("default fallback is fail-closed for non-default, missing, and duplicate defaults", async () => {
  const nonDefault = {
    ...defaultVariant({ id: "pv-chocolate", is_default: false }),
    flavour_code: "chocolate", flavour_label: "Chocolate",
  };
  for (const variants of [
    [defaultVariant(), nonDefault],
    [],
    [defaultVariant(), defaultVariant({ id: "pv-default-2" })],
  ]) {
    const result = await resolveDefaultFixture({}, variants);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.blockedRows.length, 1);
  }
});

test("non-default variants require complete distinguishing evidence or an approved mapping", async () => {
  const chocolate500 = {
    ...defaultVariant({ id: "pv-chocolate-500", is_default: false }),
    flavour_code: "chocolate", flavour_label: "Chocolate", size_value: 500, size_unit: "g",
  };
  const vanilla500 = {
    ...chocolate500, id: "pv-vanilla-500", flavour_code: "vanilla", flavour_label: "Vanilla",
  };
  for (const evidence of [
    { flavour: "chocolate" },
    { size: "500g" },
    { external_options: JSON.stringify({ Flavour: "Chocolate" }) },
  ]) {
    const result = await resolveDefaultFixture(evidence, [chocolate500, vanilla500]);
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.blockedRows.length, 1);
  }

  const exact = await resolveDefaultFixture(
    { flavour: "chocolate", size: "500g" },
    [chocolate500, vanilla500]
  );
  assert.equal(exact.report.approvedRows[0].importPlan.product_variant.id, "pv-chocolate-500");
});

test("manual Stage 2 existing-product import creates full identity, is idempotent, and dry-run shares the plan", async () => {
  const row = baseFeedRow({ gtin: "manual-retailer-gtin" });
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);

  const dryRun = await runImportRows([row], { mode: "manual", dryRun: true });
  assert.equal(dryRun.planned, 1);
  assert.equal(supabase.writes.length, 0);
  assert.equal(dryRun.report.approvedRows[0].importPlan.product_variant.action, "existing");
  assert.equal(dryRun.report.approvedRows[0].importPlan.approval.approved, false);

  const first = await runImportRows([row], { mode: "manual" });
  const second = await runImportRows([row], { mode: "manual" });
  assert.equal(first.successful, 1);
  assert.equal(second.successful, 1);
  assert.equal(supabase.tables.product_variants.length, 1);
  assert.equal(supabase.tables.retailer_products.length, 1);
  assert.equal(supabase.tables.offers.length, 1);
  assert.equal(supabase.tables.offers[0].retailer_product_id, supabase.tables.retailer_products[0].id);
  assert.equal(supabase.tables.offers[0].product_variant_id, supabase.tables.product_variants[0].id);
  assert.equal(supabase.writes.some((write) => write.table === "products"), false);
});

test("manual import with ambiguous defaults blocks before any write", async () => {
  const supabase = createMockSupabase({
    product_variants: [defaultVariant(), defaultVariant({ id: "pv-default-2" })],
  });
  setSupabaseForTests(supabase);
  const result = await runImportRows([baseFeedRow()], { mode: "manual" });
  assert.equal(result.successful, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.report.blockedRows.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("safe-create RPC failures roll back product, default, mapping, offer, and history", async () => {
  for (const rpc_failure_at of [
    "after_product", "after_default_variant", "after_retailer_product",
    "after_offer", "before_price_history",
  ]) {
    const supabase = createMockSupabase({
      retailers: [], products: [], retailer_products: [], offers: [], price_history: [], rpc_failure_at,
    });
    setSupabaseForTests(supabase);
    const result = await runImportRows([baseSafeCreateFeedRow()], { mode: "feed", safeCreate: true });
    assert.equal(result.failed, 1);
    assert.equal(result.failedRows.length, 1);
    for (const table of ["products", "product_variants", "retailer_products", "offers", "price_history"]) {
      assert.equal(supabase.tables[table].length, 0, `${rpc_failure_at} left ${table}`);
    }
  }
});

function discountStage2Fixture() {
  const retailer = {
    id: "discount-retailer",
    name: "Discount Supplements",
    slug: "discount-supplements",
  };
  const product = {
    id: "discount-product",
    name: "Applied Nutrition ISO-XP Whey Protein",
    slug: "applied-nutrition-iso-xp-whey-protein",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    product_format: "powder",
    gtin: "canonical-product-gtin",
  };
  const productVariants = [
    {
      id: "pv-chocolate-500g",
      product_id: product.id,
      variant_key: "chocolate-500g",
      display_name: "Chocolate / 500g",
      flavour_code: "chocolate",
      flavour_label: "Chocolate",
      size_value: 500,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
      is_active: true,
      is_default: false,
    },
    {
      id: "pv-vanilla-1kg",
      product_id: product.id,
      variant_key: "vanilla-1000g",
      display_name: "Vanilla / 1kg",
      flavour_code: "vanilla",
      flavour_label: "Vanilla",
      size_value: 1000,
      size_unit: "g",
      pack_count: 1,
      product_format: "powder",
      is_active: true,
      is_default: false,
    },
  ];
  const shared = {
    retailer_name: retailer.name,
    retailer_website: "https://www.discount-supplements.co.uk",
    external_product_id: "shopify-product-9001",
    product_name: product.name,
    brand: product.brand,
    category: product.category,
    description: "Applied Nutrition ISO-XP whey protein powder",
    image: "https://cdn.shopify.com/s/files/discount/iso-xp.webp",
    slug: product.slug,
    shipping_known: "true",
    shipping_cost: "4.99",
    in_stock: "true",
    is_for_sale: "true",
    product_format: "powder",
    pack_count: "1",
  };
  const rows = [
    baseCanonicalFeedRow({
      ...shared,
      external_variant_id: "shopify-variant-chocolate-500g",
      external_sku: "ISOXP-CHOC-500",
      external_options: JSON.stringify({ Size: "500g", Flavour: "Chocolate" }),
      variant_name: "Chocolate / 500g",
      external_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-chocolate-500g",
      affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-chocolate-500g",
      external_gtin: "retailer-gtin-chocolate",
      price: "24.99",
      size: "500",
      size_unit: "g",
      flavour: "Chocolate",
    }),
    baseCanonicalFeedRow({
      ...shared,
      external_variant_id: "shopify-variant-vanilla-1kg",
      external_sku: "ISOXP-VAN-1000",
      external_options: JSON.stringify({ Size: "1kg", Flavour: "Vanilla" }),
      variant_name: "Vanilla / 1kg",
      external_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-vanilla-1kg",
      affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-vanilla-1kg",
      external_gtin: "retailer-gtin-vanilla",
      price: "39.99",
      size: "1000",
      size_unit: "g",
      flavour: "Vanilla",
    }),
  ];

  return { product, productVariants, retailer, rows };
}

function stage2Seed({ withMappings = false, withOffers = false } = {}) {
  const fixture = discountStage2Fixture();
  const retailerProducts = withMappings
    ? fixture.rows.map((row, index) => ({
        id: `rp-${index + 1}`,
        retailer_id: fixture.retailer.id,
        product_id: fixture.product.id,
        product_variant_id: fixture.productVariants[index].id,
        external_product_id: row.external_product_id,
        external_variant_id: row.external_variant_id,
        external_sku: row.external_sku,
        external_options: JSON.parse(row.external_options),
        external_name: row.product_name,
        external_slug: row.slug,
        external_gtin: row.external_gtin,
        external_url: row.external_url,
        match_method: "slug",
        match_confidence: 90,
        updated_at: "2026-07-13T12:00:00.000Z",
      }))
    : [];
  const offers = withOffers
    ? fixture.rows.map((row, index) => ({
        id: `offer-${index + 1}`,
        product_id: fixture.product.id,
        retailer_id: fixture.retailer.id,
        retailer_product_id: retailerProducts[index].id,
        product_variant_id: fixture.productVariants[index].id,
        price: Number(row.price),
        shipping_cost: 4.99,
        total_price: priceHistoryTotal(Number(row.price), 4.99),
        url: row.affiliate_url,
        in_stock: true,
      }))
    : [];

  return {
    fixture,
    seed: {
      retailers: [fixture.retailer],
      products: [{ ...fixture.product }],
      product_variants: fixture.productVariants.map((variant) => ({ ...variant })),
      retailer_products: retailerProducts,
      offers,
      price_history: [],
    },
  };
}

function ekmSharedParentFixture({ mappedVariants = 1 } = {}) {
  const fixture = discountStage2Fixture();
  const retailer = {
    id: 3,
    name: "Whey Okay",
    slug: "whey-okay",
    website: "https://wheyokay.com",
  };
  const parentUrl = "https://wheyokay.com/exact-shared-parent-9000-p.asp";
  const rows = fixture.rows.map((row, index) => ({
    ...row,
    retailer_name: retailer.name,
    retailer_website: retailer.website,
    product_id: fixture.product.id,
    product_variant_id: fixture.productVariants[index].id,
    external_product_id: "9000",
    external_variant_id: String(9001 + index),
    external_sku: `EKM-SKU-${index + 1}`,
    external_gtin: `0500000000000${index + 1}`,
    external_url: parentUrl,
    affiliate_url: parentUrl,
  }));
  const retailerProducts = rows.slice(0, mappedVariants).map((row, index) => ({
    id: `ekm-mapping-${index + 1}`,
    retailer_id: retailer.id,
    product_id: fixture.product.id,
    product_variant_id: fixture.productVariants[index].id,
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    external_sku: row.external_sku,
    external_gtin: row.external_gtin,
    external_options: JSON.parse(row.external_options),
    external_name: row.product_name,
    external_slug: row.slug,
    external_url: parentUrl,
    match_method: "slug",
    match_confidence: 90,
    updated_at: "2026-07-23T12:00:00.000Z",
  }));
  const offers = retailerProducts.map((mapping, index) => ({
    id: `ekm-offer-${index + 1}`,
    retailer_id: retailer.id,
    product_id: fixture.product.id,
    product_variant_id: fixture.productVariants[index].id,
    retailer_product_id: mapping.id,
    price: Number(rows[index].price),
    shipping_cost: Number(rows[index].shipping_cost),
    total_price: priceHistoryTotal(
      rows[index].price,
      rows[index].shipping_cost
    ),
    in_stock: true,
    url: parentUrl,
    last_checked_at: "2026-07-23T12:00:00.000Z",
  }));
  return {
    fixture,
    parentUrl,
    retailer,
    rows,
    seed: {
      retailers: [retailer],
      products: [{ ...fixture.product }],
      product_variants: fixture.productVariants.map((variant) => ({ ...variant })),
      retailer_products: retailerProducts,
      offers,
      price_history: [],
    },
  };
}

const BATCH_A_PRODUCTS = {
  17: {
    name: "Optimum Nutrition Gold Standard Pre-Workout 330g",
    slug: "optimum-nutrition-gold-standard-pre-workout-330g",
    brand: "Optimum Nutrition",
    category: "Pre Workout",
    externalProductId: "4666319241263",
    price: "20.99",
    size: 330,
    path: "optimum-nutrition-gold-standard-pre-workout-330g",
  },
  36: {
    name: "Applied Nutrition Amino Fuel EAA 390g",
    slug: "applied-nutrition-amino-fuel-eaa-390g",
    brand: "Applied Nutrition",
    category: "Amino Acids",
    externalProductId: "7078560301252",
    price: "18.99",
    size: 390,
    path: "applied-nutrition-amino-fuel-eaa-390g",
  },
  38: {
    name: "Applied Nutrition Pump Pre Workout 375g",
    slug: "applied-nutrition-pump-pre-workout-375g",
    brand: "Applied Nutrition",
    category: "Pre Workout",
    externalProductId: "7060933935300",
    price: "18.99",
    size: 375,
    path: "applied-pump-3g-pre-workout-375g",
  },
  80: {
    name: "Optimum Nutrition Amino Energy 270g",
    slug: "optimum-nutrition-amino-energy-270g",
    brand: "Optimum Nutrition",
    category: "Amino Acids",
    externalProductId: "4666259931183",
    price: "21.99",
    size: 270,
    path: "optimum-nutrition-amin-o-energy-270g",
  },
  178: {
    name: "Applied Nutrition ISO-XP 1.8kg",
    slug: "applied-nutrition-iso-xp-18kg",
    brand: "Applied Nutrition",
    category: "Whey Protein",
    externalProductId: "7562236985540",
    price: "69.99",
    size: 1800,
    optionSize: "1.8kg",
    displaySize: "1.8kg",
    path: "applied-nutrition-iso-xp-whey-isolate-1-8kg",
  },
  248: {
    name: "Optimum Nutrition 100% Isolate 930g",
    slug: "optimum-nutrition-100-isolate-930g",
    brand: "Optimum Nutrition",
    category: "Health Supplements",
    externalProductId: "4666280181807",
    price: "49.99",
    size: 930,
    path: "optimum-nutrition-gold-standard-100-isolate-903g",
  },
};

const BATCH_A_VARIANTS = [
  [732, 178, "43894716432580", "APNU-0659", "Banana"],
  [733, 178, "42855717994692", "APNU-0635", "Chocolate"],
  [734, 178, "42855718027460", "APNU-0636", "Strawberry"],
  [735, 178, "42855718060228", "APNU-0637", "Vanilla"],
  [726, 38, "41231522627780", "APNU-0367", "Fruit Burst"],
  [727, 38, "41231522660548", "APNU-0368", "Icy Blue Razz"],
  [728, 38, "41859737485508", "APNU-0539", "Rainbow Unicorn"],
  [718, 36, "41292466880708", "APNU-0400", "Candy Ice Blast"],
  [719, 36, "55756327977338", "APNU-0740", "Cherry Limeade"],
  [720, 36, "55756328010106", "APNU-0741", "Cola Millions"],
  [721, 36, "41292466913476", "APNU-0401", "Fruit Burst"],
  [722, 36, "41859721396420", "APNU-0510", "Fruit Salad"],
  [723, 36, "41292466979012", "APNU-0402", "Icy Blue Razz"],
  [724, 36, "55756328042874", "APNU-0742", "Pineapple Millions"],
  [725, 36, "55756328075642", "APNU-0743", "Raspberry Mojito"],
  [714, 17, "32611701260335", "OPNU-0303", "Blue Raspberry"],
  [715, 17, "37383501349060", "OPNU-0130", "Fruit Punch"],
  [716, 17, "37383501381828", "OPNU-0127", "Green Apple"],
  [717, 17, "37383501480132", "OPNU-0128", "Watermelon"],
  [729, 80, "37383496892612", "OPNU-0007", "Fruit Fusion"],
  [730, 80, "37383496958148", "OPNU-0209", "Lemon Lime"],
  [731, 80, "37383497023684", "OPNU-0006", "Orange"],
  [736, 248, "32397723271215", "OPNU-0290", "Chocolate"],
  [737, 248, "32397723303983", "OPNU-0291", "Strawberry"],
  [738, 248, "32397723336751", "OPNU-0292", "Vanilla"],
];

function batchA25Fixture() {
  const products = Object.entries(BATCH_A_PRODUCTS).map(([id, product]) => ({
    id: Number(id),
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    category: product.category,
    gtin: null,
    is_active: true,
    merged_into_product_id: null,
    product_format: "powder",
  }));
  const defaultVariants = products.map((product) => ({
    id: `default-${product.id}`,
    product_id: product.id,
    variant_key: "default",
    display_name: "Default",
    flavour_code: null,
    flavour_label: null,
    size_value: null,
    size_unit: null,
    pack_count: null,
    product_format: null,
    is_active: true,
    is_default: true,
  }));
  const productVariants = BATCH_A_VARIANTS.map(
    ([id, productId, externalVariantId, sku, flavour]) => {
      const product = BATCH_A_PRODUCTS[productId];
      return {
        id,
        product_id: productId,
        variant_key: `${normalizeFlavour(flavour).replace(/ /g, "-")}-${product.size}g`,
        display_name: `${flavour} / ${product.displaySize || `${product.size}g`}`,
        flavour_code: normalizeFlavour(flavour),
        flavour_label: flavour,
        size_value: product.size,
        size_unit: "g",
        pack_count: 1,
        product_format: "powder",
        is_active: true,
        is_default: false,
        externalVariantId,
        sku,
      };
    }
  );
  const rows = parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "test-fixtures",
        "discount-supplements-batch-a-25-variants.csv"
      ),
      "utf8"
    ),
    { columns: true, skip_empty_lines: true, trim: true }
  );
  return { products, productVariants: [...defaultVariants, ...productVariants], rows };
}

function legacyMapping948Fixture({ offerOverrides = {} } = {}) {
  const updatedAt = "2026-07-12T12:37:52.563+00:00";
  const url = "https://www.discount-supplements.co.uk/products/cnp-pro-creatine-250g?variant=54879874810234";
  const row = baseCanonicalFeedRow({
    retailer_name: "Discount Supplements",
    retailer_website: "https://www.discount-supplements.co.uk",
    external_product_id: "6788065329348",
    external_variant_id: "54879874810234",
    external_sku: "CNP-0508",
    external_options: JSON.stringify({ Size: "250g", Flavour: "Unflavoured" }),
    product_name: "CNP Creatine Monohydrate 250g",
    variant_name: "250g / Unflavoured",
    brand: "CNP",
    category: "Creatine",
    slug: "cnp-creatine-monohydrate-250g",
    external_url: url,
    affiliate_url: url,
    external_gtin: "",
    price: "12.99",
    shipping_known: "true",
    shipping_cost: "4.99",
    in_stock: "true",
    is_for_sale: "true",
    size: "250",
    size_unit: "g",
    flavour: "Unflavoured",
    product_format: "powder",
    pack_count: "1",
    legacy_mapping_upgrade: "true",
    retailer_product_id: "948",
    expected_retailer_product_updated_at: updatedAt,
  });
  const mapping = {
    id: 948,
    retailer_id: 4,
    product_id: 407,
    product_variant_id: 386,
    external_product_id: null,
    external_variant_id: null,
    external_sku: null,
    external_options: null,
    external_name: row.product_name,
    external_slug: row.slug,
    external_gtin: null,
    external_url: url,
    match_method: "slug",
    match_confidence: 90,
    updated_at: updatedAt,
  };
  const offer = {
    id: 762,
    product_id: 407,
    retailer_id: 4,
    retailer_product_id: 948,
    product_variant_id: 386,
    price: 12.99,
    shipping_cost: 4.99,
    total_price: 17.98,
    in_stock: true,
    url,
    last_checked_at: "2026-07-12T12:37:52.674+00:00",
    ...offerOverrides,
  };
  const seed = {
    retailers: [{ id: 4, name: "Discount Supplements", slug: "discount-supplements", website: "https://www.discount-supplements.co.uk" }],
    products: [{ id: 407, name: row.product_name, slug: row.slug, brand: "CNP", category: "Creatine", gtin: null, is_active: true, merged_into_product_id: null, product_format: null }],
    product_variants: [{ id: 386, product_id: 407, variant_key: "default", display_name: "Default", flavour_code: null, flavour_label: null, size_value: null, size_unit: null, pack_count: null, product_format: null, is_default: true, is_active: true }],
    retailer_products: [mapping],
    offers: [offer],
    price_history: [],
  };
  return { row, seed, mapping, offer, url, updatedAt };
}

function optionedLegacyMappingFixture({
  rowOverrides = {},
  seedMutate = null,
  offerOverrides = {},
} = {}) {
  const updatedAt = "2026-07-15T20:00:00.000+00:00";
  const url = "https://www.wheyokay.co.uk/time-4-mass-6000g-banana-686-p.asp?variant=687";
  const row = baseCanonicalFeedRow({
    retailer_name: "Whey Okay",
    retailer_website: "https://www.wheyokay.co.uk",
    external_product_id: "686",
    external_variant_id: "687",
    external_sku: "T4M-BAN-6000",
    external_options: JSON.stringify({ Size: "6000g", Flavour: "Banana" }),
    product_name: "Time 4 Mass 6000g",
    variant_name: "Banana / 6000g",
    brand: "Time 4 Nutrition",
    category: "Mass Gainer",
    slug: "time-4-mass-6000g",
    external_url: url,
    affiliate_url: url,
    external_gtin: "",
    price: "39.99",
    shipping_known: "true",
    shipping_cost: "4.99",
    in_stock: "true",
    is_for_sale: "true",
    size: "6000",
    size_unit: "g",
    flavour: "Banana",
    product_format: "powder",
    pack_count: "1",
    product_id: "124",
    product_variant_id: "771",
    legacy_mapping_upgrade: "true",
    legacy_mapping_optioned: "true",
    legacy_duplicate_source_listing: "false",
    legacy_identity_drift: "false",
    retailer_product_id: "161",
    expected_retailer_product_updated_at: updatedAt,
    ...rowOverrides,
  });
  const mapping = {
    id: 161,
    retailer_id: 3,
    product_id: 124,
    product_variant_id: 700,
    external_product_id: null,
    external_variant_id: null,
    external_sku: null,
    external_options: null,
    external_name: row.product_name,
    external_slug: row.slug,
    external_gtin: null,
    external_url: url,
    match_method: "slug",
    match_confidence: 90,
    updated_at: updatedAt,
  };
  const offer = {
    id: 1610,
    product_id: 124,
    retailer_id: 3,
    retailer_product_id: 161,
    product_variant_id: 700,
    price: 39.99,
    shipping_cost: 4.99,
    total_price: 44.98,
    in_stock: true,
    url,
    last_checked_at: "2026-07-15T20:01:00.000+00:00",
    ...offerOverrides,
  };
  const seed = {
    retailers: [{ id: 3, name: "Whey Okay", slug: "whey-okay", website: "https://www.wheyokay.co.uk" }],
    products: [{
      id: 124, name: row.product_name, slug: row.slug, brand: "Time 4 Nutrition",
      category: "Mass Gainer", gtin: null, is_active: true,
      merged_into_product_id: null, product_format: "powder",
    }],
    product_variants: [
      {
        id: 700, product_id: 124, variant_key: "default", display_name: "Default",
        flavour_code: null, flavour_label: null, size_value: null, size_unit: null,
        pack_count: null, product_format: null, is_default: true, is_active: true,
      },
      {
        id: 771, product_id: 124, variant_key: "banana-6000g",
        display_name: "Banana / 6000g", flavour_code: "banana",
        flavour_label: "Banana", size_value: 6000, size_unit: "g",
        pack_count: 1, product_format: "powder", is_default: false, is_active: true,
      },
      {
        id: 772, product_id: 124, variant_key: "chocolate-6000g",
        display_name: "Chocolate / 6000g", flavour_code: "chocolate",
        flavour_label: "Chocolate", size_value: 6000, size_unit: "g",
        pack_count: 1, product_format: "powder", is_default: false, is_active: true,
      },
    ],
    retailer_products: [mapping],
    offers: [offer],
    price_history: [],
  };
  if (seedMutate) seedMutate(seed);
  return { row, seed, mapping, offer, url, updatedAt };
}

test("legacy mapping upgrade fixture 948 produces one exact update and no offer write", async () => {
  const fixture = legacyMapping948Fixture();
  const supabase = createMockSupabase(structuredClone(fixture.seed));
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });

  assert.equal(result.blockedRows.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  const item = result.report.approvedRows[0];
  const plan = item.importPlan;
  assert.equal(plan.meta.operation_type, "legacy_mapping_upgrade");
  assert.equal(item.product.id, 407);
  assert.equal(item.productVariant.id, 386);
  assert.equal(item.mapping.id, 948);
  assert.equal(item.existingOffer.id, 762);
  assert.equal(plan.retailer_product.action, "update");
  assert.equal(plan.retailer_product.id, "948");
  assert.equal(plan.offer.action, "noop");
  assert.equal(plan.offer.id, "762");
  assert.equal(plan.price_history.action, "noop");
  assert.equal(plan.product.action, "existing");
  assert.equal(plan.product_variant.action, "existing");
  assert.equal(plan.product_variant.id, "386");
  assert.equal(plan.expected_state.retailer_product.id, "948");
  assert.equal(plan.expected_state.retailer_product.product_id, "407");
  assert.equal(plan.expected_state.retailer_product.retailer_id, "4");
  assert.equal(plan.expected_state.retailer_product.product_variant_id, "386");
  assert.equal(plan.expected_state.retailer_product.updated_at, fixture.updatedAt);
  assert.equal(plan.expected_state.retailer_product.external_variant_id, null);
  assert.deepEqual(plan.retailer_product.values, {
    external_product_id: "6788065329348",
    external_variant_id: "54879874810234",
    external_sku: "CNP-0508",
    external_options: { Size: "250g", Flavour: "Unflavoured" },
    external_name: fixture.mapping.external_name,
    external_slug: fixture.mapping.external_slug,
    external_gtin: null,
    external_url: fixture.url,
    match_method: "slug",
    match_confidence: "90",
    product_variant_id: "386",
  });
  assert.equal(result.report.retailerProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToUpdate.length, 1);
  assert.equal(result.report.offersToCreate.length, 0);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 1);
  assert.equal(supabase.writes.length, 0);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-mapping-948-"));
  try {
    const written = writeDryRunArtifact([fixture.row], result, {
      artifactPath: path.join(directory, "legacy-948.json"),
      sourceContent: JSON.stringify(fixture.row),
      sourceFileName: "legacy-948.json",
      environmentMarker: "test",
    });
    const entry = written.artifact.plans[0];
    assert.equal(entry.operation_type, "legacy_mapping_upgrade");
    assert.equal(entry.operation_type, entry.resolved_plan.meta.operation_type);
    assert.equal(entry.retailer_product_id, "948");
    assert.deepEqual(entry.before, plan.expected_state.retailer_product);
    assert.deepEqual(entry.after, plan.retailer_product.values);
    assert.equal(entry.exact_url_evidence, fixture.url);
    assert.equal(entry.expected_updated_at, fixture.updatedAt);

    const mismatchedArtifact = structuredClone(written.artifact);
    mismatchedArtifact.plans[0].operation_type = "standard_import";
    const mismatchedPath = path.join(directory, "legacy-948-mismatched.json");
    const mismatchedBytes = Buffer.from(`${JSON.stringify(mismatchedArtifact, null, 2)}\n`);
    fs.writeFileSync(mismatchedPath, mismatchedBytes);
    fs.writeFileSync(
      `${mismatchedPath}.sha256`,
      `${crypto.createHash("sha256").update(mismatchedBytes).digest("hex")}\n`
    );
    assert.throws(
      () => loadDryRunArtifact(mismatchedPath),
      /artifact plan metadata mismatch/i
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("optioned legacy mapping upgrade moves current default mapping to exact existing non-default variant", async () => {
  const fixture = optionedLegacyMappingFixture();
  const supabase = createMockSupabase(structuredClone(fixture.seed));
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });

  assert.equal(result.blockedRows.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  const item = result.report.approvedRows[0];
  const plan = item.importPlan;
  assert.equal(plan.meta.operation_type, "legacy_mapping_upgrade");
  assert.equal(item.mapping.id, 161);
  assert.equal(item.productVariant.id, 771);
  assert.equal(plan.product_variant.id, "771");
  assert.equal(plan.expected_state.product_variant.is_default, false);
  assert.equal(plan.expected_state.retailer_product.product_variant_id, "700");
  assert.equal(plan.retailer_product.values.product_variant_id, "771");
  assert.equal(plan.retailer_product.values.external_product_id, "686");
  assert.equal(plan.retailer_product.values.external_variant_id, "687");
  assert.deepEqual(plan.retailer_product.values.external_options, {
    Size: "6000g",
    Flavour: "Banana",
  });
  assert.equal(plan.product_variant.evidence.flavour, "banana");
  assert.equal(plan.product_variant.evidence.size_value, "6000");
  assert.equal(plan.product_variant.evidence.size_unit, "g");
  assert.equal(plan.offer.action, "identity_update");
  assert.equal(plan.expected_state.offer.product_variant_id, "700");
  assert.equal(plan.offer.values.product_variant_id, "771");
  assert.equal(plan.offer.values.price, "39.99");
  assert.equal(plan.price_history.action, "noop");
  assert.equal(result.report.retailerProductsToUpdate.length, 1);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("optioned legacy mapping upgrade accepts flavour-only source option with parent size evidence", async () => {
  const fixture = optionedLegacyMappingFixture({
    rowOverrides: {
      external_options: JSON.stringify({ Flavour: "Banana" }),
      legacy_option_tuple_mode: "flavour_only_parent_size",
      legacy_parent_size_value: "6000",
      legacy_parent_size_unit: "g",
      legacy_parent_size_source: "parent_product_title",
      legacy_parent_size_all_variants_same: "true",
    },
  });
  const supabase = createMockSupabase(structuredClone(fixture.seed));
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });

  assert.equal(result.blockedRows.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.retailer_product.values.product_variant_id, "771");
  assert.deepEqual(plan.retailer_product.values.external_options, { Flavour: "Banana" });
  assert.deepEqual(plan.product_variant.evidence.external_options, { Flavour: "Banana" });
  assert.equal(plan.product_variant.evidence.size_value, "6000");
  assert.equal(plan.product_variant.evidence.size_unit, "g");
  assert.equal(plan.product_variant.evidence.legacy_option_tuple_mode, "flavour_only_parent_size");
  assert.equal(plan.product_variant.evidence.legacy_parent_size_value, "6000");
  assert.equal(plan.product_variant.evidence.legacy_parent_size_unit, "g");
  assert.equal(plan.product_variant.evidence.legacy_parent_size_source, "parent_product_title");
  assert.equal(plan.product_variant.evidence.legacy_parent_size_all_variants_same, true);
  assert.equal(plan.offer.action, "identity_update");
  assert.equal(plan.offer.values.product_variant_id, "771");
  assert.equal(plan.price_history.action, "noop");
  assert.equal(supabase.writes.length, 0);
});

test("optioned legacy mapping upgrade fails closed for identity and mutation guards", async () => {
  const scenarios = [
    ["missing optioned flag keeps default/non-default block", ({ row }) => { delete row.legacy_mapping_optioned; }, /cannot use a default variant/i],
    ["standalone and optioned are mutually exclusive", ({ row }) => { row.legacy_mapping_standalone = "true"; }, /cannot be both standalone and optioned/i],
    ["missing duplicate source proof", ({ row }) => { delete row.legacy_duplicate_source_listing; }, /duplicate source listings/i],
    ["identity drift proof true", ({ row }) => { row.legacy_identity_drift = "true"; }, /identity drift/i],
    ["matching product and variant IDs", ({ row }) => { row.external_variant_id = row.external_product_id; }, /distinct EKM product and variant IDs/i],
    ["missing size option", ({ row }) => { row.external_options = JSON.stringify({ Flavour: "Banana" }); }, /exactly Size and Flavour/i],
    ["missing flavour option", ({ row }) => { row.external_options = JSON.stringify({ Size: "6000g" }); }, /exactly Size and Flavour/i],
    ["flavour mismatch", ({ row }) => { row.flavour = "Chocolate"; row.external_options = JSON.stringify({ Size: "6000g", Flavour: "Chocolate" }); }, /missing canonical product_variant/i],
    ["size mismatch", ({ row }) => { row.size = "5000"; row.external_options = JSON.stringify({ Size: "5000g", Flavour: "Banana" }); }, /conflicting variant evidence: size/i],
    ["target default", ({ row }) => { row.product_variant_id = "700"; }, /missing canonical product_variant/i],
    ["target inactive", ({ seed }) => { seed.product_variants.find((variant) => variant.id === 771).is_active = false; }, /missing canonical product_variant/i],
    ["current mapping no longer on default", ({ seed }) => { seed.retailer_products[0].product_variant_id = 772; }, /requires current default variant/i],
    ["offer update", ({ row }) => { row.price = "41.99"; }, /cannot change offer/i],
    ["offer identity drift", ({ seed }) => { seed.offers[0].retailer_product_id = 999; }, /offer identity mismatch/i],
    ["second mapping", ({ seed }) => { seed.retailer_products.push({ ...seed.retailer_products[0], id: 162, external_url: "https://example.test/other" }); }, /exactly one retailer\/product mapping/i],
  ];

  for (const [label, mutate, reason] of scenarios) {
    const fixture = optionedLegacyMappingFixture();
    mutate(fixture);
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, label);
    assert.equal(result.blockedRows.length, 1, label);
    assert.match(result.blockedRows[0].block_reason, reason, label);
    assert.equal(supabase.writes.length, 0, label);
  }
});

test("optioned legacy mapping flavour-only parent-size mode fails closed for parent size drift", async () => {
  const scenarios = [
    ["missing parent size", ({ row }) => { row.legacy_parent_size_value = ""; }, /parent size evidence/i],
    ["parent size mismatch", ({ row }) => { row.legacy_parent_size_value = "5000"; }, /parent size evidence mismatch/i],
    ["missing parent proof source", ({ row }) => { row.legacy_parent_size_source = ""; }, /parent size proof source/i],
    ["mixed parent sizes", ({ row }) => { row.legacy_parent_size_all_variants_same = "false"; }, /parent size to be constant/i],
    ["hidden size option", ({ row }) => { row.external_options = JSON.stringify({ Size: "6000g", Flavour: "Banana" }); }, /requires exactly Flavour external option/i],
    ["missing flavour option", ({ row }) => { row.external_options = JSON.stringify({}); }, /requires exactly Flavour external option/i],
  ];

  for (const [label, mutate, reason] of scenarios) {
    const fixture = optionedLegacyMappingFixture({
      rowOverrides: {
        external_options: JSON.stringify({ Flavour: "Banana" }),
        legacy_option_tuple_mode: "flavour_only_parent_size",
        legacy_parent_size_value: "6000",
        legacy_parent_size_unit: "g",
        legacy_parent_size_source: "parent_product_title",
        legacy_parent_size_all_variants_same: "true",
      },
    });
    mutate(fixture);
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, label);
    assert.equal(result.blockedRows.length, 1, label);
    assert.match(result.blockedRows[0].block_reason, reason, label);
    assert.equal(supabase.writes.length, 0, label);
  }
});

test("legacy mapping upgrade treats historical null total_price as mapping-only noop", async () => {
  const fixture = legacyMapping948Fixture({ offerOverrides: { total_price: null } });
  const supabase = createMockSupabase(structuredClone(fixture.seed));
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });

  assert.equal(result.blockedRows.length, 0);
  assert.equal(result.report.approvedRows.length, 1);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.meta.operation_type, "legacy_mapping_upgrade");
  assert.equal(plan.retailer_product.action, "update");
  assert.equal(plan.offer.action, "noop");
  assert.equal(plan.offer.values.total_price, null);
  assert.equal(plan.expected_state.offer.total_price, null);
  assert.equal(plan.price_history.action, "noop");
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 1);
  assert.equal(supabase.writes.length, 0);
});

test("standard import still treats historical null total_price as offer drift", async () => {
  const { result, supabase } = await applyExistingOffer({}, { total_price: null });
  const offerUpdate = supabase.writes.find((write) => write.table === "offers");
  const historyWrite = supabase.writes.find((write) => write.table === "price_history");

  assert.equal(result.successful, 1);
  assert.equal(result.rowLevelOffers[0].offerAction, "update");
  assert.equal(offerUpdate.payload.total_price, 29.99);
  assert.equal(historyWrite.payload.total_price, 29.99);
});

test("legacy mapping upgrade with existing correct total_price remains mapping-only noop", async () => {
  const fixture = legacyMapping948Fixture();
  const supabase = createMockSupabase(structuredClone(fixture.seed));
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });

  assert.equal(result.blockedRows.length, 0);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.meta.operation_type, "legacy_mapping_upgrade");
  assert.equal(plan.offer.action, "noop");
  assert.equal(plan.offer.values.total_price, "17.98");
  assert.equal(plan.price_history.action, "noop");
});

test("legacy mapping upgrade fixture 948 fails closed for every identity and mutation guard", async () => {
  const scenarios = [
    ["operation type cannot enable legacy without the input flag", ({ row }) => { delete row.legacy_mapping_upgrade; row.operation_type = "legacy_mapping_upgrade"; }, /operation_type is derived/i],
    ["missing flag keeps the existing block", ({ row }) => { delete row.legacy_mapping_upgrade; delete row.retailer_product_id; delete row.expected_retailer_product_updated_at; }, /conflicting variant evidence/i],
    ["missing mapping id", ({ row }) => { delete row.retailer_product_id; }, /requires retailer_product_id/i],
    ["missing expected timestamp", ({ row }) => { delete row.expected_retailer_product_updated_at; }, /requires expected_retailer_product_updated_at/i],
    ["stale timestamp", ({ row }) => { row.expected_retailer_product_updated_at = "2026-07-12T12:37:51.000+00:00"; }, /updated_at is stale/i],
    ["different URL", ({ row }) => { row.external_url += "-different"; row.affiliate_url = row.external_url; }, /exact external_url/i],
    ["existing different external variant", ({ seed }) => { seed.retailer_products[0].external_variant_id = "other-variant"; }, /null legacy external_variant_id/i],
    ["external variant collision", ({ seed }) => { seed.retailer_products.push({ ...seed.retailer_products[0], id: 949, product_id: 999, external_variant_id: "54879874810234", external_url: "https://example.test/other" }); }, /external_variant_id conflicts/i],
    ["second retailer product", ({ seed }) => { seed.retailer_products.push({ ...seed.retailer_products[0], id: 949, external_url: "https://example.test/other" }); }, /exactly one retailer\/product mapping/i],
    ["second offer", ({ seed }) => { seed.offers.push({ ...seed.offers[0], id: 763, retailer_product_id: 949 }); }, /exactly one retailer\/product offer/i],
    ["offer points to another mapping", ({ seed }) => { seed.offers[0].retailer_product_id = 949; }, /offer identity mismatch/i],
    ["offer points to another variant", ({ seed }) => { seed.offers[0].product_variant_id = 999; }, /offer identity mismatch/i],
    ["attempted product variant change", ({ row }) => { row.product_variant_id = "999"; }, /cannot change product_variant_id/i],
    ["different size evidence", ({ row }) => { row.external_options = JSON.stringify({ Size: "1kg", Flavour: "Unflavoured" }); }, /conflicting variant evidence/i],
    ["different flavour evidence", ({ row }) => { row.external_options = JSON.stringify({ Size: "250g", Flavour: "Chocolate" }); }, /conflicting variant evidence/i],
    ["price change", ({ row }) => { row.price = "13.99"; }, /cannot change offer/i],
    ["shipping change", ({ row }) => { row.shipping_cost = "5.99"; }, /cannot change offer/i],
    ["stock change", ({ row }) => { row.in_stock = "false"; }, /cannot change offer/i],
    ["non-null total drift", ({ seed }) => { seed.offers[0].total_price = 99.99; }, /cannot change offer/i],
  ];

  for (const [label, mutate, reason] of scenarios) {
    const fixture = legacyMapping948Fixture();
    mutate(fixture);
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });
    assert.equal(result.report.approvedRows.length, 0, label);
    assert.equal(result.blockedRows.length, 1, label);
    assert.match(result.blockedRows[0].block_reason, reason, label);
    assert.equal(supabase.writes.length, 0, label);
  }
});

test("legacy mapping upgrade rerun is an exact idempotent noop", async () => {
  const fixture = legacyMapping948Fixture();
  Object.assign(fixture.seed.retailer_products[0], {
    external_product_id: fixture.row.external_product_id,
    external_variant_id: fixture.row.external_variant_id,
    external_sku: fixture.row.external_sku,
    external_options: JSON.parse(fixture.row.external_options),
    external_gtin: null,
  });
  const supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.row], { mode: "feed", dryRun: true });
  assert.equal(result.blockedRows.length, 0);
  assert.equal(result.report.approvedRows[0].importPlan.retailer_product.action, "noop");
  assert.equal(result.report.approvedRows[0].importPlan.meta.operation_type, "legacy_mapping_upgrade");
  assert.equal(result.report.approvedRows[0].importPlan.offer.action, "noop");
  assert.equal(result.report.approvedRows[0].importPlan.price_history.action, "noop");
  assert.equal(supabase.writes.length, 0);
});

test("EKM shared-parent URL creates an exact sibling only from distinct complete source identity", async () => {
  const { rows, seed } = ekmSharedParentFixture();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRowsRaw([rows[1]], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product.id, String(seed.products[0].id));
  assert.equal(plan.product_variant.id, String(seed.product_variants[1].id));
  assert.equal(plan.retailer_product.action, "create");
  assert.equal(plan.retailer_product.values.external_product_id, "9000");
  assert.equal(plan.retailer_product.values.external_variant_id, "9002");
  assert.equal(plan.offer.action, "create");
  assert.equal(plan.price_history.action, "create");
  assert.equal(supabase.writes.length, 0);
});

test("EKM shared-parent URL seals a planned canonical variant without a pre-existing variant ID", async () => {
  const parentUrl = "https://wheyokay.com/planned-shared-parent-100-p.asp";
  const fixture = createVariantFixture({
    product_id: "p100",
    external_url: parentUrl,
    affiliate_url: parentUrl,
  });
  fixture.seed.retailer_products.push({
    id: "existing-parent-sibling",
    retailer_id: "r1",
    product_id: "p100",
    product_variant_id: "pv-default",
    external_product_id: "prod_100",
    external_variant_id: "var_100_default",
    external_sku: "SKU-DEFAULT-500",
    external_gtin: "5012345678900",
    external_options: { Flavour: "Unflavoured" },
    external_url: parentUrl,
  });
  const supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);

  const result = await runImportRowsRaw([fixture.row], {
    mode: "feed",
    safeCreate: true,
    dryRun: true,
  });

  assert.equal(result.report.approvedRows.length, 1);
  assert.equal(result.report.blockedRows.length, 0);
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product_variant.action, "create_variant");
  assert.equal(plan.retailer_product.values.product_variant_id, null);
  assert.equal(plan.retailer_product.identity_contract.version, "1");
  assert.equal(
    plan.retailer_product.identity_contract.approved_url_peers.length,
    2
  );
  assert.equal(supabase.writes.length, 0);
});

test("EKM shared-parent identity collisions remain fail-closed", async () => {
  const scenarios = [
    ["duplicate variant ID", ({ rows }) => {
      rows[1].external_variant_id = rows[0].external_variant_id;
    }, /missing canonical product_variant|conflicting variant evidence/i],
    ["SKU collision", ({ rows }) => {
      rows[1].external_sku = rows[0].external_sku;
    }, /external SKU collision/i],
    ["GTIN collision", ({ rows }) => {
      rows[1].external_gtin = rows[0].external_gtin;
    }, /external GTIN collision/i],
    ["option tuple collision", ({ rows, seed }) => {
      seed.retailer_products[0].external_options =
        JSON.parse(rows[1].external_options);
    }, /option tuple collision/i],
    ["parent ID drift", ({ seed }) => {
      seed.retailer_products[0].external_product_id = "different-parent";
    }, /external product ID drift/i],
    ["variant ID drift", ({ seed }) => {
      seed.retailer_products[0].product_variant_id =
        seed.product_variants[1].id;
    }, /canonical variant collision|variant ID drift/i],
    ["inactive canonical variant", ({ seed }) => {
      seed.product_variants[1].is_active = false;
    }, /missing canonical product_variant/i],
    ["merged canonical product", ({ seed }) => {
      seed.products[0].merged_into_product_id = "merged-product";
    }, /inactive or merged/i],
  ];

  {
    const fixture = ekmSharedParentFixture();
    fixture.rows[1].external_variant_id = "";
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    await assert.rejects(
      runImportRowsRaw([fixture.rows[1]], { mode: "feed", dryRun: true }),
      /missing external_variant_id/i
    );
    assert.equal(supabase.writes.length, 0);
  }

  for (const [label, mutate, reason] of scenarios) {
    const fixture = ekmSharedParentFixture();
    mutate(fixture);
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([fixture.rows[1]], {
      mode: "feed",
      dryRun: true,
    });
    assert.equal(result.report.approvedRows.length, 0, label);
    assert.equal(result.report.blockedRows.length, 1, label);
    assert.match(
      result.report.blockedRows[0].reason ||
        result.report.blockedRows[0].reasons?.join(" ") ||
        "",
      reason,
      label
    );
    assert.equal(supabase.writes.length, 0, label);
  }
});

test("EKM shared-parent batch blocks duplicate SKU, GTIN, option and canonical identities", async () => {
  const mutations = [
    ["SKU", (rows) => { rows[1].external_sku = rows[0].external_sku; }],
    ["GTIN", (rows) => { rows[1].external_gtin = rows[0].external_gtin; }],
    ["option tuple", (rows) => { rows[1].external_options = rows[0].external_options; }],
    ["parent drift", (rows) => { rows[1].external_product_id = "other-parent"; }],
    ["canonical variant", (rows) => {
      rows[1].product_variant_id = rows[0].product_variant_id;
      rows[1].variant_name = rows[0].variant_name;
      rows[1].size = rows[0].size;
      rows[1].flavour = rows[0].flavour;
      rows[1].external_options = rows[0].external_options;
    }],
  ];
  for (const [label, mutate] of mutations) {
    const fixture = ekmSharedParentFixture({ mappedVariants: 0 });
    mutate(fixture.rows);
    fixture.seed.retailer_products.push({
      id: "legacy-parent-peer",
      retailer_id: fixture.retailer.id,
      product_id: fixture.fixture.product.id,
      product_variant_id: "legacy-default",
      external_product_id: null,
      external_variant_id: null,
      external_sku: null,
      external_gtin: null,
      external_options: null,
      external_url: fixture.parentUrl,
    });
    const supabase = createMockSupabase(fixture.seed);
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw(fixture.rows, {
      mode: "feed",
      dryRun: true,
    });
    assert.equal(result.report.approvedRows.length, 0, label);
    assert.equal(result.report.blockedRows.length, 2, label);
    assert.equal(
      result.report.blockedRows.some((row) =>
        (row.reasons || [row.reason]).some((reason) =>
          /batch (?:source identity .* collision|shared parent URL external product ID drift)/i
            .test(reason)
        )
      ),
      true,
      label
    );
  }
});

test("EKM shared-parent evidence preserves exact flavour and size separation", async () => {
  const { rows, seed } = ekmSharedParentFixture();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  const plan = result.report.approvedRows[0].importPlan;
  assert.equal(plan.product_variant.id, String(seed.product_variants[1].id));
  assert.equal(plan.product_variant.evidence.flavour, "vanilla");
  assert.equal(plan.product_variant.evidence.size_value, "1000");
  assert.equal(plan.product_variant.evidence.size_unit, "g");
});

test("EKM shared-parent pack and format evidence selects only the exact variant", async () => {
  const fixture = ekmSharedParentFixture();
  const baseVariant = fixture.seed.product_variants[1];
  const exactVariant = {
    ...baseVariant,
    id: "pv-vanilla-1kg-2-pack-capsule",
    variant_key: "vanilla-1kg-2-pack-capsule",
    display_name: "Vanilla / 1kg / 2 pack / Capsule",
    pack_count: 2,
    product_format: "capsule",
  };
  fixture.seed.products[0].product_format = null;
  fixture.seed.product_variants[1] = exactVariant;
  fixture.rows[1] = {
    ...fixture.rows[1],
    product_variant_id: exactVariant.id,
    external_options: JSON.stringify({
      Size: "1kg",
      Flavour: "Vanilla",
      Pack: "2",
      Format: "Capsule",
    }),
    variant_name: exactVariant.display_name,
    pack_count: "2",
    product_format: "capsule",
  };
  const supabase = createMockSupabase(fixture.seed);
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(result.report.approvedRows.length, 1);
  const evidence = result.report.approvedRows[0].importPlan.product_variant.evidence;
  assert.equal(evidence.pack_count, "2");
  assert.equal(evidence.product_format, "capsule");
  assert.equal(
    result.report.approvedRows[0].importPlan.product_variant.id,
    exactVariant.id
  );
});

test("EKM shared-parent rerun is idempotent and variant-addressed Shopify semantics stay unchanged", async () => {
  const ekm = ekmSharedParentFixture({ mappedVariants: 2 });
  let supabase = createMockSupabase(ekm.seed);
  setSupabaseForTests(supabase);
  const rerun = await runImportRowsRaw(ekm.rows, {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(rerun.report.approvedRows.length, 2);
  assert.equal(rerun.report.retailerProductsUnchanged.length, 2);
  assert.equal(rerun.report.offersUnchanged.length, 2);
  assert.equal(rerun.report.priceHistoryRowsToCreate.length, 0);
  assert.equal(supabase.writes.length, 0);

  const shopify = stage2Seed({ withMappings: true, withOffers: true });
  shopify.seed.retailer_products[0].external_product_id = null;
  shopify.seed.retailer_products[0].external_variant_id = null;
  supabase = createMockSupabase(shopify.seed);
  setSupabaseForTests(supabase);
  const unchanged = await runImportRowsRaw([shopify.fixture.rows[0]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(unchanged.report.approvedRows.length, 1);
  assert.equal(
    unchanged.report.approvedRows[0].importPlan.retailer_product.action,
    "update"
  );
  assert.equal(unchanged.report.approvedRows[0].mapping.id, "rp-1");
});

test("Stage 2 retailer product payload preserves Shopify variant identity and retailer-only GTIN", () => {
  const { fixture } = stage2Seed();
  const row = fixture.rows[0];
  const payload = buildRetailerProductPayload({
    row,
    retailerId: fixture.retailer.id,
    productId: fixture.product.id,
    name: row.product_name,
    slug: row.slug,
    offerUrl: row.affiliate_url,
    matchMethod: "external_variant_id",
    matchConfidence: 100,
  });

  assert.equal(payload.external_product_id, row.external_product_id);
  assert.equal(payload.external_variant_id, row.external_variant_id);
  assert.equal(payload.external_sku, row.external_sku);
  assert.deepEqual(payload.external_options, JSON.parse(row.external_options));
  assert.equal(payload.external_gtin, row.external_gtin);
  assert.equal(Object.hasOwn(payload, "gtin"), false);
});

test("Stage 2 external_options accepts only JSON objects and blocks invalid rows", async () => {
  assert.deepEqual(parseExternalOptions('{"Size":"500g"}'), { Size: "500g" });
  assert.throws(() => parseExternalOptions("not-json"), /valid JSON object/i);
  assert.throws(() => parseExternalOptions('["500g"]'), /JSON object/i);
  assert.throws(() => parseExternalOptions('"500g"'), /JSON object/i);

  for (const externalOptions of ["not-json", '["500g"]', '"500g"']) {
    const { fixture, seed } = stage2Seed();
    const supabase = createMockSupabase(seed);
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [{ ...fixture.rows[0], external_options: externalOptions }],
      { mode: "feed", dryRun: true }
    );

    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.report.invalidRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("Stage 2 identity distinguishes two Shopify variants where product plus retailer does not", () => {
  const { fixture } = stage2Seed();
  const legacyKeys = new Set(
    fixture.rows.map(() => `${fixture.product.id}:${fixture.retailer.id}`)
  );
  const stage2Keys = new Set(
    fixture.rows.map(
      (row) => `${fixture.retailer.id}:${row.external_variant_id}`
    )
  );

  assert.equal(legacyKeys.size, 1);
  assert.equal(stage2Keys.size, 2);
});

test("Stage 2 dry-run plans two retailer products and two offers for one retailer and canonical product", async () => {
  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed", dryRun: true });

  assert.equal(result.report.collisionGroups.length, 0);
  assert.equal(result.report.approvedRows.length, 2);
  assert.equal(result.report.retailerProductsToCreate.length, 2);
  assert.equal(result.report.offersToCreate.length, 2);
  assert.equal(result.planned, 2);
  assert.equal(supabase.writes.length, 0);
});

test("Stage 2 mixed batch never reuses variant A offer when variant B mapping is new", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.retailer_products = seed.retailer_products.slice(0, 1);
  seed.offers = seed.offers.slice(0, 1);
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const dryRun = await runImportRows([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(dryRun.report.retailerProductsToCreate.length, 1);
  assert.equal(dryRun.report.offersToCreate.length, 1);
  assert.equal(dryRun.report.offersToUpdate.length, 0);
  assert.equal(dryRun.report.approvedRows[0].existingOffer, null);

  const apply = await runImportRows([fixture.rows[1]], { mode: "feed" });
  assert.equal(apply.successful, 1);
  assert.equal(apply.successfulRows.length, 1);
  assert.equal(apply.failedRows.length, 0);
  assert.equal(supabase.tables.retailer_products.length, 2);
  assert.equal(supabase.tables.offers.length, 2);
  assert.equal(supabase.tables.offers[0].retailer_product_id, "rp-1");
  assert.notEqual(supabase.tables.offers[1].retailer_product_id, "rp-1");
  assert.equal(supabase.tables.offers[1].product_variant_id, "pv-vanilla-1kg");
});

test("Stage 2 apply creates separate linked retailer products and offers without changing products.gtin", async () => {
  const { fixture, seed } = stage2Seed();
  const originalProduct = structuredClone(seed.products[0]);
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed" });

  assert.equal(result.successful, 2);
  assert.equal(supabase.tables.retailer_products.length, 2);
  assert.equal(supabase.tables.offers.length, 2);
  assert.equal(new Set(supabase.tables.retailer_products.map((row) => row.id)).size, 2);
  assert.equal(new Set(supabase.tables.retailer_products.map((row) => row.external_variant_id)).size, 2);
  for (let index = 0; index < fixture.rows.length; index += 1) {
    const row = fixture.rows[index];
    const mapping = supabase.tables.retailer_products.find(
      (candidate) => candidate.external_variant_id === row.external_variant_id
    );
    const offer = supabase.tables.offers.find(
      (candidate) => candidate.retailer_product_id === mapping?.id
    );

    assert(mapping);
    assert(offer);
    assert.equal(mapping.external_product_id, row.external_product_id);
    assert.equal(mapping.external_sku, row.external_sku);
    assert.deepEqual(mapping.external_options, JSON.parse(row.external_options));
    assert.equal(mapping.external_gtin, row.external_gtin);
    assert.equal(mapping.product_variant_id, fixture.productVariants[index].id);
    assert.equal(offer.product_variant_id, fixture.productVariants[index].id);
  }
  assert.deepEqual(supabase.tables.products[0], originalProduct);
});

test("Stage 2 rerun is idempotent and looks up offers by retailer product identity", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(fixture.rows, { mode: "feed", dryRun: true });

  assert.equal(result.report.retailerProductsToCreate.length, 0);
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 2);
  assert.equal(result.report.offersToCreate.length, 0);
  assert.equal(result.report.offersToUpdate.length, 0);
  assert.equal(result.report.offersUnchanged.length, 2);
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "retailer_products" &&
        operation.filters.some((filter) => filter.field === "external_variant_id")
    ),
    true
  );
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "offers" &&
        operation.filters.some((filter) => filter.field === "retailer_product_id")
    ),
    true
  );
  assert.equal(
    supabase.operations.some(
      (operation) =>
        operation.type === "read" &&
        operation.table === "offers" &&
        operation.filters.some((filter) => filter.field === "product_id") &&
        operation.filters.some((filter) => filter.field === "retailer_id")
    ),
    false
  );
  assert.equal(supabase.writes.length, 0);
});

test("Stage 2 price update changes only the selected Shopify variant offer", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  const originalFirstOffer = structuredClone(seed.offers[0]);
  const updatedVanilla = { ...fixture.rows[1], price: "37.49" };
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows([updatedVanilla], { mode: "feed" });

  assert.equal(result.successful, 1);
  assert.deepEqual(result.report.offersToUpdate[0].changes.price, {
    before: 39.99,
    after: "37.49",
  });
  assert.deepEqual(supabase.tables.offers[0], originalFirstOffer);
  assert.equal(supabase.tables.offers[1].price, 37.49);
  assert.equal(supabase.tables.offers[1].retailer_product_id, "rp-2");
  const offerUpdate = supabase.writes.find(
    (write) => write.table === "offers" && write.operation === "update"
  );
  assert.deepEqual(
    Object.keys(offerUpdate.payload).sort(),
    ["last_checked_at", "price", "total_price"].sort()
  );
});

test("Stage 2 stock and URL updates remain scoped to the selected Shopify variant", async () => {
  const scenarios = [
    {
      overrides: { in_stock: "false" },
      expected: { in_stock: false },
      keys: ["in_stock", "last_checked_at"],
    },
    {
      overrides: {
        affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp-vanilla-new?variant=shopify-variant-vanilla-1kg",
      },
      expected: {
        url: "https://www.discount-supplements.co.uk/products/iso-xp-vanilla-new?variant=shopify-variant-vanilla-1kg",
      },
      keys: ["last_checked_at", "url"],
    },
  ];

  for (const scenario of scenarios) {
    const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
    const originalFirstOffer = structuredClone(seed.offers[0]);
    const supabase = createMockSupabase(seed);
    setSupabaseForTests(supabase);

    const result = await runImportRows(
      [{ ...fixture.rows[1], ...scenario.overrides }],
      { mode: "feed" }
    );

    assert.equal(result.successful, 1);
    assert.deepEqual(supabase.tables.offers[0], originalFirstOffer);
    assert.equal(supabase.tables.offers[1].retailer_product_id, "rp-2");
    for (const [field, value] of Object.entries(scenario.expected)) {
      assert.equal(supabase.tables.offers[1][field], value);
    }
    const offerUpdate = supabase.writes.find(
      (write) => write.table === "offers" && write.operation === "update"
    );
    assert.equal(Object.hasOwn(offerUpdate.payload, "last_checked_at"), true);
    for (const key of Object.keys(scenario.expected)) {
      assert.equal(Object.hasOwn(offerUpdate.payload, key), true);
    }
    assert.equal(Object.hasOwn(offerUpdate.payload, "retailer_product_id"), false);
  }
});

test("Stage 2 resolves flavour and size evidence to the exact canonical product variant", async () => {
  const { fixture, seed } = stage2Seed();

  for (let index = 0; index < fixture.rows.length; index += 1) {
    const isolatedSeed = {
      ...seed,
      products: seed.products.map((row) => ({ ...row })),
      product_variants: seed.product_variants.map((row) => ({ ...row })),
      retailer_products: [],
      offers: [],
      price_history: [],
    };
    const supabase = createMockSupabase(isolatedSeed);
    setSupabaseForTests(supabase);

    const result = await runImportRows([fixture.rows[index]], { mode: "feed" });
    const mapping = supabase.tables.retailer_products[0];
    const offer = supabase.tables.offers[0];

    assert.equal(result.successful, 1);
    assert.equal(mapping.product_variant_id, fixture.productVariants[index].id);
    assert.equal(offer.retailer_product_id, mapping.id);
    assert.equal(offer.product_variant_id, fixture.productVariants[index].id);
  }
});

test("explicit Shopify flavour evidence preserves full multi-word identity", () => {
  const flavours = [
    "Fruit Burst",
    "Fruit Fusion",
    "Fruit Punch",
    "Fruit Salad",
    "Icy Blue Razz",
    "Blue Raspberry",
    "Rainbow Unicorn",
    "Candy Ice Blast",
    "Green Apple",
    "Watermelon",
    "Pineapple Millions",
    "Cola Millions",
    "Cherry Limeade",
    "Raspberry Mojito",
  ];
  const normalized = flavours.map(normalizeFlavour);

  assert.equal(new Set(normalized).size, flavours.length);
  assert.notEqual(normalizeFlavour("Fruit Burst"), normalizeFlavour("Fruit Fusion"));
  assert.notEqual(normalizeFlavour("Fruit Burst"), normalizeFlavour("Fruit Punch"));
  assert.notEqual(normalizeFlavour("Fruit Burst"), normalizeFlavour("Fruit Salad"));
  assert.notEqual(normalizeFlavour("Blue Raspberry"), normalizeFlavour("Icy Blue Razz"));
  assert.notEqual(normalizeFlavour("Cola Millions"), normalizeFlavour("Pineapple Millions"));

  for (const flavour of flavours) {
    const row = {
      retailer_name: "Discount Supplements",
      retailer_website: "https://www.discount-supplements.co.uk",
      external_variant_id: `variant-${normalizeFlavour(flavour).replace(/ /g, "-")}`,
      external_options: JSON.stringify({ Size: "390g", Flavour: flavour }),
      flavour,
      product_name: "Applied Nutrition Amino Fuel EAA 390g",
      product_format: "powder",
    };
    assert.equal(parseVariantIdentity(row).flavour, normalizeFlavour(flavour));
    assert.match(rowIdentityKey(row), new RegExp(`\\|${row.external_variant_id}$`));
  }
});

test("Batch A exact 25-row fixture produces 25 isolated create plans", async () => {
  const fixture = batchA25Fixture();
  const supabase = createMockSupabase({
    retailers: [{
      id: 4,
      name: "Discount Supplements",
      slug: "discount-supplements",
      website: "https://www.discount-supplements.co.uk",
    }],
    products: fixture.products,
    product_variants: fixture.productVariants,
    retailer_products: [],
    offers: [],
    price_history: [],
  });
  setSupabaseForTests(supabase);

  const result = await runImportRowsRaw(fixture.rows, { mode: "feed", dryRun: true });
  const plans = result.report.approvedRows.map((item) => item.importPlan);
  const externalVariantIds = plans.map(
    (plan) => plan.retailer_product.values.external_variant_id
  );
  const planFingerprints = plans.map((plan) => plan.meta.plan_fingerprint);

  assert.equal(result.planned, 25);
  assert.equal(result.report.blockedRows.length, 0);
  assert.equal(result.report.deduplicatedRows.length, 0);
  assert.equal(new Set(externalVariantIds).size, 25);
  assert.equal(new Set(planFingerprints).size, 25);
  assert.equal(plans.every((plan) => plan.meta.operation_type === "standard_import"), true);
  assert.equal(plans.every((plan) => plan.retailer_product.action === "create"), true);
  assert.equal(plans.every((plan) => plan.offer.action === "create"), true);
  assert.equal(plans.every((plan) => plan.price_history.action === "create"), true);

  for (let index = 0; index < plans.length; index += 1) {
    const expectedVariant = fixture.productVariants.find(
      (variant) => variant.externalVariantId === fixture.rows[index].external_variant_id
    );
    assert.equal(plans[index].product_variant.id, String(expectedVariant.id));
    assert.equal(
      plans[index].product_variant.evidence.flavour,
      normalizeFlavour(fixture.rows[index].flavour)
    );
  }

  const formerlyProblematicRows = [5, 6, 7, 8, 11, 12, 13, 14, 17, 18, 19];
  for (const rowNumber of formerlyProblematicRows) {
    const item = result.report.approvedRows.find((row) => row.rowNumber === rowNumber + 1);
    assert(item, `source row ${rowNumber} must produce a plan`);
    assert.equal(
      item.importPlan.product_variant.evidence.flavour,
      normalizeFlavour(fixture.rows[rowNumber - 1].flavour)
    );
  }
});

test("Shopify flavour conflicts and external variant duplicate drift are fail-closed", async () => {
  const fixture = batchA25Fixture();
  const seed = {
    retailers: [{ id: 4, name: "Discount Supplements", slug: "discount-supplements" }],
    products: fixture.products,
    product_variants: fixture.productVariants,
    retailer_products: [],
    offers: [],
    price_history: [],
  };

  let supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const mismatch = await runImportRowsRaw([{
    ...fixture.rows[4],
    flavour: "Fruit Fusion",
  }], { mode: "feed", dryRun: true });
  assert.equal(mismatch.report.approvedRows.length, 0);
  assert.match(mismatch.report.blockedRows[0].block_reason, /conflicting variant evidence/i);

  supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const identical = await runImportRowsRaw(
    [fixture.rows[4], structuredClone(fixture.rows[4])],
    { mode: "feed", dryRun: true }
  );
  assert.equal(identical.report.approvedRows.length, 1);
  assert.equal(identical.report.deduplicatedRows.length, 1);

  supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const drift = await runImportRowsRaw(
    [fixture.rows[4], { ...fixture.rows[4], price: "19.99" }],
    { mode: "feed", dryRun: true }
  );
  assert.equal(drift.report.approvedRows.length, 0);
  assert.equal(drift.report.deduplicatedRows.length, 0);
  assert.equal(drift.report.blockedRows.length, 2);
  assert.equal(
    drift.report.blockedRows.every((row) =>
      /duplicate variant identity has conflicting source row data/i.test(row.block_reason)
    ),
    true
  );
});

test("Stage 2 dry-run blocks missing and ambiguous canonical variant resolution", async () => {
  const { fixture, seed } = stage2Seed();
  const cases = [
    {
      label: "missing",
      variants: seed.product_variants.slice(1),
      reason: /missing canonical product_variant/i,
    },
    {
      label: "ambiguous",
      variants: [
        seed.product_variants[0],
        {
          ...seed.product_variants[0],
          id: "pv-chocolate-500g-duplicate",
          variant_key: "chocolate-500g-duplicate",
        },
      ],
      reason: /ambiguous canonical product_variant/i,
    },
  ];

  for (const scenario of cases) {
    const supabase = createMockSupabase({
      ...seed,
      product_variants: scenario.variants,
      retailer_products: [],
      offers: [],
      price_history: [],
    });
    setSupabaseForTests(supabase);

    const result = await runImportRows([fixture.rows[0]], {
      mode: "feed",
      dryRun: true,
    });

    assert.equal(result.report.approvedRows.length, 0, scenario.label);
    assert.equal(result.report.ambiguousRows.length, 1, scenario.label);
    assert.match(result.report.ambiguousRows[0].reason, scenario.reason);
    assert.equal(supabase.writes.length, 0);
  }
});

test("Stage 2 dry-run blocks conflicting row and external option evidence", async () => {
  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const result = await runImportRows(
    [
      {
        ...fixture.rows[0],
        external_options: JSON.stringify({ Size: "1kg", Flavour: "Chocolate" }),
      },
    ],
    { mode: "feed", dryRun: true }
  );

  assert.equal(result.report.approvedRows.length, 0);
  assert.equal(result.report.ambiguousRows.length, 1);
  assert.match(result.report.ambiguousRows[0].reason, /conflicting variant evidence/i);
  assert.equal(supabase.writes.length, 0);
});

test("size normalization uses base mass and volume units and rejects invalid evidence", async () => {
  assert.deepEqual(parseSize("0.5kg"), {
    value: "500",
    unit: "g",
    dimension: "mass",
  });
  assert.deepEqual(parseSize("1L"), {
    value: "1000",
    unit: "ml",
    dimension: "volume",
  });
  assert.equal(parseSize("500oz"), null);
  assert.equal(parseSize("0kg"), null);

  const { fixture, seed } = stage2Seed();
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const accepted = await runImportRowsRaw([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });
  assert.equal(accepted.report.approvedRows.length, 1);
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_value, "1000");
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_unit, "g");

  for (const Size of ["1L", "500oz", "0kg"]) {
    const blocked = await runImportRowsRaw(
      [{ ...fixture.rows[1], external_options: JSON.stringify({ Size, Flavour: "Vanilla" }) }],
      { mode: "feed", dryRun: true }
    );
    assert.equal(blocked.report.approvedRows.length, 0);
    assert.equal(blocked.report.blockedRows.length, 1);
  }
});

test("canonical feed rows accept explicit servings as count size evidence", async () => {
  const { fixture, seed } = stage2Seed();
  fixture.rows[1] = {
    ...fixture.rows[1],
    external_variant_id: "shopify-variant-sberry-peaches-25-servings",
    external_sku: "ISOXP-SBERRY-25SERV",
    external_options: JSON.stringify({ Size: "25 servings", Flavour: "S'Berry & Peaches" }),
    variant_name: "S'Berry & Peaches / 25 servings",
    external_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-sberry-peaches-25-servings",
    affiliate_url: "https://www.discount-supplements.co.uk/products/iso-xp?variant=shopify-variant-sberry-peaches-25-servings",
    size: "25",
    size_unit: "servings",
    flavour: "S'Berry & Peaches",
  };
  seed.product_variants[1] = {
    ...seed.product_variants[1],
    variant_key: "s-berry-and-peaches-25-servings",
    display_name: "S'Berry & Peaches / 25 servings",
    flavour_code: "s'berry and peaches",
    flavour_label: "S'Berry & Peaches",
    size_value: 25,
    size_unit: "servings",
  };

  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const accepted = await runImportRowsRaw([fixture.rows[1]], {
    mode: "feed",
    dryRun: true,
  });

  assert.equal(accepted.report.approvedRows.length, 1);
  assert.equal(accepted.report.blockedRows.length, 0);
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.flavour, "s'berry and peaches");
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_value, "25");
  assert.equal(accepted.report.approvedRows[0].importPlan.product_variant.evidence.size_unit, "servings");
});

test("total_price-only drift updates once, records one history row, then becomes noop", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.offers[1].total_price = 999;
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);

  const applied = await runImportRows([fixture.rows[1]], { mode: "feed" });
  assert.equal(applied.successful, 1);
  assert.deepEqual(applied.report.offersToUpdate[0].changes.total_price, {
    before: 999,
    after: "44.98",
  });
  assert.equal(supabase.tables.offers[1].price, 39.99);
  assert.equal(supabase.tables.offers[1].shipping_cost, 4.99);
  assert.equal(supabase.tables.offers[1].total_price, 44.98);
  assert.equal(supabase.tables.price_history.length, 1);

  const rerun = await runImportRowsRaw([fixture.rows[1]], { mode: "feed", dryRun: true });
  assert.equal(rerun.report.offersToUpdate.length, 0);
  assert.equal(rerun.report.offersUnchanged.length, 1);
  assert.equal(supabase.tables.price_history.length, 1);
});

test("external_options key order is canonically equal and does not cause an update", async () => {
  const { fixture, seed } = stage2Seed({ withMappings: true, withOffers: true });
  seed.retailer_products[1].external_options = { Flavour: "Vanilla", Size: "1kg" };
  const supabase = createMockSupabase(seed);
  setSupabaseForTests(supabase);
  const result = await runImportRowsRaw([fixture.rows[1]], { mode: "feed", dryRun: true });
  assert.equal(result.report.retailerProductsToUpdate.length, 0);
  assert.equal(result.report.retailerProductsUnchanged.length, 1);
  assert.deepEqual(result.report.retailerProductsUnchanged[0].changes, {});
});

test("manual import strictly blocks invalid shared input fields", async () => {
  const scenarios = [
    { in_stock: "maybe" },
    { url: "", aw_deep_link: "", affiliate_url: "", external_url: "", merchant_deep_link: "" },
    { price: "not-a-price" },
    { external_options: "{broken" },
  ];
  for (const overrides of scenarios) {
    const supabase = createMockSupabase();
    setSupabaseForTests(supabase);
    const result = await runImportRowsRaw([baseFeedRow(overrides)], {
      mode: "manual",
      dryRun: true,
    });
    assert.equal(result.report.approvedRows.length, 0);
    assert.equal(result.blockedRows.length, 1);
    assert.equal(supabase.writes.length, 0);
  }
});

test("programmatic CSV writes are disabled in favour of the artifact workflow", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], { mode: "feed" }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow(), baseFeedRow()], {
      mode: "feed",
      pilotApply: true,
      approvalId: "approval-1",
    }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], { mode: "feed", pilotApply: true }),
    /artifact approval workflow/i
  );
  await assert.rejects(
    runImportRowsRaw([baseFeedRow()], {
      mode: "feed",
      pilotApply: true,
      approvalIds: ["approval-1", "approval-2"],
    }),
    /artifact approval workflow/i
  );
});

test("canonical JSON rejects undefined and decimal strings cover cross-runtime vectors", () => {
  for (const [input, expected] of [
    ["0.0000001", "0.0000001"],
    ["0.000001", "0.000001"],
    ["1e21", "1000000000000000000000"],
    ["1000.0", "1000"],
    [-0, "0"],
  ]) {
    assert.equal(normalizeDecimalString(input), expected);
  }
  assert.throws(() => canonicalJson({ value: undefined }), /undefined is not allowed/);
  assert.throws(() => canonicalJson([undefined]), /undefined is not allowed/);
  assert.equal(canonicalJson({ value: null }), '{"value":null}');
});

test("dry-run artifact is the sole immutable input for approval and pilot apply", async () => {
  const supabase = createMockSupabase();
  setSupabaseForTests(supabase);
  const rowA = baseFeedRow();
  const rowB = baseFeedRow({ price: "31.25" });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-artifact-workflow-"));
  const sourceA = Buffer.from(JSON.stringify(rowA));
  const sourceBPath = path.join(directory, "source-b.json");
  fs.writeFileSync(sourceBPath, JSON.stringify(rowB));
  try {
    const dryRunA = await runImportRowsRaw([rowA], { mode: "feed", dryRun: true });
    const artifactAPath = path.join(directory, "artifact-a.json");
    const artifactA = writeDryRunArtifact([rowA], dryRunA, {
      artifactPath: artifactAPath,
      runId: "artifact-run-a",
      sourceBytes: sourceA,
      sourceFileName: "source-a.json",
      environmentMarker: "test",
    });
    const entryA = artifactA.artifact.plans[0];
    assert.equal(artifactA.artifact.row_count, "1");
    assert.equal(entryA.operation_type, "standard_import");
    assert.equal(entryA.operation_type, entryA.resolved_plan.meta.operation_type);
    assert.equal(entryA.resolved_plan.offer.values.price, "29.99");
    assert.equal(typeof entryA.resolved_plan.retailer.id, "string");
    assert.equal(supabase.writes.length, 0);

    const approvedA = await approveArtifactPlan({
      artifactPath: artifactAPath,
      planFingerprint: entryA.plan_fingerprint,
    });
    assert.equal(approvedA.artifactSha256, artifactA.artifactSha256);
    assert.equal(approvedA.sourceRowFingerprint, entryA.source_row_fingerprint);
    assert.ok(approvedA.expiresAt);
    assert.equal(supabase.writes.length, 0);

    const dryRunB = await runImportRowsRaw([rowB], { mode: "feed", dryRun: true });
    const artifactBPath = path.join(directory, "artifact-b.json");
    const artifactB = writeDryRunArtifact([rowB], dryRunB, {
      artifactPath: artifactBPath,
      runId: "artifact-run-b",
      sourceContent: JSON.stringify(rowB),
      sourceFileName: "source-b.json",
      environmentMarker: "test",
    });
    await assert.rejects(
      applyArtifactPlan({
        artifactPath: artifactBPath,
        planFingerprint: artifactB.artifact.plans[0].plan_fingerprint,
        approvalId: approvedA.approvalId,
        pilotApply: true,
      }),
      /artifact_sha256 mismatch/
    );
    await assert.rejects(
      approveArtifactPlan({
        artifactPath: artifactAPath,
        planFingerprint: entryA.plan_fingerprint,
        sourcePath: sourceBPath,
      }),
      /Source file SHA-256/
    );

    fs.appendFileSync(artifactAPath, " ");
    await assert.rejects(
      applyArtifactPlan({
        artifactPath: artifactAPath,
        planFingerprint: entryA.plan_fingerprint,
        approvalId: approvedA.approvalId,
        pilotApply: true,
      }),
      /artifact SHA-256 mismatch/i
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
