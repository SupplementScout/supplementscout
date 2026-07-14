const assert = require("node:assert/strict");
const fs = require("fs");
const Module = require("module");
const path = require("path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadModule() {
  const filename = path.join(process.cwd(), "app", "lib", "productOfferGroups.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);

  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);

  return mod.exports;
}

const {
  getBestProductOffer,
  getGroupOfferDisplayLabels,
  getOfferDeliveredTotal,
  getOfferVariantLabel,
  groupProductOffers,
  productOfferHref,
  selectGroupOffer,
} = loadModule();

function loadRetailerOfferCard() {
  const filename = path.join(process.cwd(), "app", "components", "RetailerOfferCard.tsx");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && request === "../lib/productOfferGroups") return loadModule();
    if (parent === mod && request === "../lib/pricing") {
      return {
        formatCurrency: (value) => `£${Number(value).toFixed(2)}`,
        getKnownProductPrice: (value) => {
          const number = Number(value);
          return Number.isFinite(number) && number > 0 ? number : null;
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports.default;
}

function offer(overrides = {}) {
  const id = overrides.id || "offer-chocolate";
  const flavour = overrides.flavour || "Chocolate";

  return {
    id,
    retailer_id: Object.prototype.hasOwnProperty.call(overrides, "retailer_id")
      ? overrides.retailer_id
      : "4",
    product_variant_id: overrides.product_variant_id || "712",
    price: overrides.price ?? "89.95",
    shipping_cost: overrides.shipping_cost ?? "4.99",
    total_price: overrides.total_price ?? "94.94",
    in_stock: overrides.in_stock ?? true,
    url: overrides.url || `https://retailer.test/product?variant=${id}`,
    last_checked_at: "2026-07-14T12:00:00Z",
    retailer: Object.prototype.hasOwnProperty.call(overrides, "retailer")
      ? overrides.retailer
      : {
        id: overrides.retailer_id || "4",
        name: overrides.retailer_name || "Discount Supplements",
        slug: "discount-supplements",
        website: "https://retailer.test",
        logo: null,
      },
    product_variant: Object.prototype.hasOwnProperty.call(overrides, "product_variant")
      ? overrides.product_variant
      : {
        id: overrides.product_variant_id || "712",
        variant_key: flavour.toLowerCase().replaceAll(" ", "-") + "-2000g",
        display_name: overrides.display_name || `${flavour} / 2kg`,
        flavour_label: flavour,
        size_value: "2000",
        size_unit: "g",
        is_default: false,
      },
    external_options: overrides.external_options || {
      Flavour: flavour,
      Size: "2kg",
    },
  };
}

test("same retailer Chocolate and Vanilla become one shared-price group", () => {
  const groups = groupProductOffers([
    offer(),
    offer({
      id: "offer-vanilla",
      flavour: "Vanilla",
      product_variant_id: "713",
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].offers.length, 2);
  assert.equal(groups[0].hasSharedPricing, true);
  assert.deepEqual(groups[0].offers.map(getOfferVariantLabel), [
    "Chocolate / 2kg",
    "Vanilla / 2kg",
  ]);
  assert.equal(groups[0].lowestProductPrice, 89.95);
  assert.equal(groups[0].lowestDeliveredTotal, 94.94);
});

test("different prices remain visible per variant and selection changes CTA offer ID", () => {
  const groups = groupProductOffers([
    offer({ id: "offer-expensive", flavour: "Vanilla", price: "91.95", total_price: "96.94" }),
    offer({ id: "offer-cheap", flavour: "Chocolate", price: "89.95", total_price: "94.94" }),
  ]);
  const group = groups[0];

  assert.equal(group.hasSharedPricing, false);
  assert.equal(selectGroupOffer(group).id, "offer-cheap");
  assert.equal(selectGroupOffer(group, "offer-expensive").price, "91.95");
  assert.equal(
    productOfferHref(selectGroupOffer(group, "offer-expensive").id, "product_offer_list"),
    "/go/offer-expensive?source=product_offer_list"
  );
});

test("default selection ties by full label before offer ID, not product price", () => {
  const group = groupProductOffers([
    offer({ id: "offer-vanilla", flavour: "Vanilla", price: "10.00", shipping_cost: "5.00", total_price: "15.00" }),
    offer({ id: "offer-apple", flavour: "Apple", price: "11.00", shipping_cost: "4.00", total_price: "15.00" }),
  ])[0];

  assert.equal(group.offers[0].id, "offer-apple");
  assert.equal(selectGroupOffer(group).id, "offer-apple");
});

test("same product price with different shipping exposes per-variant delivered totals", () => {
  const group = groupProductOffers([
    offer({ id: "offer-low-shipping", flavour: "Chocolate", shipping_cost: "2.00", total_price: "91.95" }),
    offer({ id: "offer-high-shipping", flavour: "Vanilla", shipping_cost: "5.00", total_price: "94.95" }),
  ])[0];

  assert.equal(group.hasSharedPricing, false);
  assert.equal(group.offers[0].id, "offer-low-shipping");
});

test("two retailers produce two cards and preserve offer and retailer counts", () => {
  const offers = [
    offer(),
    offer({ id: "offer-vanilla", flavour: "Vanilla", product_variant_id: "713" }),
    offer({
      id: "offer-other",
      retailer_id: "5",
      retailer_name: "Other Retailer",
      retailer: { id: "5", name: "Other Retailer", slug: "other", website: null, logo: null },
    }),
  ];
  const groups = groupProductOffers(offers);

  assert.equal(offers.length, 3);
  assert.equal(groups.length, 2);
});

test("default variant never renders the text Default", () => {
  const defaultOffer = offer({
    product_variant: {
      id: "7",
      variant_key: "default",
      display_name: "Default",
      flavour_label: null,
      size_value: null,
      size_unit: null,
      is_default: true,
    },
    external_options: { Flavour: "Legacy flavour", Size: "2.27kg" },
  });

  assert.equal(getOfferVariantLabel(defaultOffer), null);
});

test("variant label falls back through flavour/size and external options", () => {
  assert.equal(
    getOfferVariantLabel(offer({
      product_variant: {
        id: "900",
        variant_key: "rainbow-unicorn-2000g",
        display_name: "",
        flavour_label: "Rainbow Unicorn",
        size_value: "2000",
        size_unit: "g",
        is_default: false,
      },
    })),
    "Rainbow Unicorn / 2000 g"
  );
  assert.equal(
    getOfferVariantLabel(offer({ product_variant: null, external_options: { Flavour: "Pineapple Millions", Size: "390g" } })),
    "Pineapple Millions / 390g"
  );
});

test("duplicate display names are disambiguated by different sizes", () => {
  const offers = [
    offer({
      id: "offer-1kg",
      product_variant: { id: "1", variant_key: "chocolate-1000g", display_name: "Chocolate", flavour_label: "Chocolate", size_value: "1000", size_unit: "g", is_default: false },
    }),
    offer({
      id: "offer-2kg",
      product_variant: { id: "2", variant_key: "chocolate-2000g", display_name: "Chocolate", flavour_label: "Chocolate", size_value: "2000", size_unit: "g", is_default: false },
    }),
  ];
  const labels = getGroupOfferDisplayLabels(offers);

  assert.equal(labels.get("offer-1kg"), "Chocolate · 1000 g");
  assert.equal(labels.get("offer-2kg"), "Chocolate · 2000 g");
});

test("identical labels and prices receive stable Option suffixes", () => {
  const offers = [
    offer({ id: "offer-a" }),
    offer({ id: "offer-b" }),
  ];
  const first = getGroupOfferDisplayLabels(offers);
  const second = getGroupOfferDisplayLabels([...offers].reverse());

  assert.equal(first.get("offer-a"), "Chocolate / 2kg · Option 1");
  assert.equal(first.get("offer-b"), "Chocolate / 2kg · Option 2");
  assert.deepEqual([...first], [...second]);
});

test("duplicate labels use price and delivered total when those distinguish offers", () => {
  const priceLabels = getGroupOfferDisplayLabels([
    offer({ id: "price-a", price: "89.95", total_price: "94.94" }),
    offer({ id: "price-b", price: "91.95", total_price: "96.94" }),
  ]);
  const shippingLabels = getGroupOfferDisplayLabels([
    offer({ id: "shipping-a", shipping_cost: "2.00", total_price: "91.95" }),
    offer({ id: "shipping-b", shipping_cost: "5.00", total_price: "94.95" }),
  ]);

  assert.equal(priceLabels.get("price-a"), "Chocolate / 2kg · £89.95");
  assert.equal(priceLabels.get("price-b"), "Chocolate / 2kg · £91.95");
  assert.equal(shippingLabels.get("shipping-a"), "Chocolate / 2kg · £91.95 delivered");
  assert.equal(shippingLabels.get("shipping-b"), "Chocolate / 2kg · £94.95 delivered");
});

test("missing variant metadata produces stable Option labels without crashing", () => {
  const offers = [
    offer({ id: "offer-a", product_variant: null, external_options: {} }),
    offer({ id: "offer-b", product_variant: null, external_options: {} }),
  ];
  const labels = getGroupOfferDisplayLabels(offers);

  assert.equal(labels.get("offer-a"), "Option 1");
  assert.equal(labels.get("offer-b"), "Option 2");
  for (const item of offers) {
    assert.equal(
      productOfferHref(selectGroupOffer({ offers, retailerKey: "4" }, String(item.id)).id, "product_offer_list"),
      `/go/${item.id}?source=product_offer_list`
    );
  }
});

test("malformed offers without retailer identity never share an undefined group", () => {
  const groups = groupProductOffers([
    offer({ id: "missing-a", retailer_id: null, retailer: null }),
    offer({ id: "missing-b", retailer_id: null, retailer: null }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.retailerKey).sort(), [
    "missing-retailer:missing-a",
    "missing-retailer:missing-b",
  ]);
});

test("Best UK Price keeps real-offer ranking and correct variant tracking ID", () => {
  const winner = offer({
    id: "offer-winner",
    flavour: "Vanilla",
    price: "80.00",
    shipping_cost: "0",
    total_price: "80.00",
  });
  const best = getBestProductOffer([
    offer({ id: "offer-loser", price: "79.00", shipping_cost: "5.00", total_price: "84.00" }),
    winner,
  ]);

  assert.equal(best.id, "offer-winner");
  assert.equal(getOfferVariantLabel(best), "Vanilla / 2kg");
  assert.equal(productOfferHref(best.id, "product_best_offer"), "/go/offer-winner?source=product_best_offer");
});

test("single variant has no selector model and keeps its direct offer", () => {
  const group = groupProductOffers([offer()])[0];

  assert.equal(group.offers.length, 1);
  assert.equal(selectGroupOffer(group).id, "offer-chocolate");
});

test("selection falls back to the first current offer when props remove the old selection", () => {
  const oldGroup = groupProductOffers([
    offer({ id: "old-chocolate", flavour: "Chocolate" }),
    offer({ id: "old-vanilla", flavour: "Vanilla" }),
  ])[0];
  const newGroup = groupProductOffers([
    offer({ id: "new-apple", flavour: "Apple" }),
  ])[0];

  assert.equal(selectGroupOffer(oldGroup, "old-vanilla").id, "old-vanilla");
  const selectedAfterUpdate = selectGroupOffer(newGroup, "old-vanilla");
  assert.equal(selectedAfterUpdate.id, "new-apple");
  assert.equal(
    productOfferHref(selectedAfterUpdate.id, "product_offer_list"),
    "/go/new-apple?source=product_offer_list"
  );
});

test("out-of-stock offers are excluded before retailer rendering", () => {
  const groups = groupProductOffers([
    offer(),
    offer({ id: "offer-disabled", flavour: "Vanilla", in_stock: false }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].offers.map((item) => item.id), ["offer-chocolate"]);
});

test("client card renders one accessible card, two chips and the selected tracking CTA", () => {
  const RetailerOfferCard = loadRetailerOfferCard();
  const group = groupProductOffers([
    offer({ id: "chocolate-id", flavour: "Chocolate" }),
    offer({ id: "vanilla-id", flavour: "Vanilla" }),
  ])[0];
  const html = renderToStaticMarkup(React.createElement(RetailerOfferCard, { group }));

  assert.equal((html.match(/<article/g) || []).length, 1);
  assert.equal((html.match(/<button/g) || []).length, 2);
  const buttons = html.match(/<button[\s\S]*?<\/button>/g) || [];
  assert.equal(buttons.every((button) => !button.includes("£")), true);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Chocolate \/ 2kg/);
  assert.match(html, /Vanilla \/ 2kg/);
  assert.match(html, /href="\/go\/chocolate-id\?source=product_offer_list"/);
});

test("rendered duplicate and missing labels remain visually distinct", () => {
  const RetailerOfferCard = loadRetailerOfferCard();
  const duplicateGroup = groupProductOffers([
    offer({ id: "same-a" }),
    offer({ id: "same-b" }),
  ])[0];
  const missingGroup = groupProductOffers([
    offer({ id: "missing-a", product_variant: null, external_options: {} }),
    offer({ id: "missing-b", product_variant: null, external_options: {} }),
  ])[0];
  const duplicateHtml = renderToStaticMarkup(React.createElement(RetailerOfferCard, { group: duplicateGroup }));
  const missingHtml = renderToStaticMarkup(React.createElement(RetailerOfferCard, { group: missingGroup }));

  assert.match(duplicateHtml, /Chocolate \/ 2kg · Option 1/);
  assert.match(duplicateHtml, /Chocolate \/ 2kg · Option 2/);
  assert.match(missingHtml, /Option 1/);
  assert.match(missingHtml, /Option 2/);
});

test("fourteen long variant labels render without hiding chips", () => {
  const RetailerOfferCard = loadRetailerOfferCard();
  const offers = Array.from({ length: 14 }, (_, index) => offer({
    id: `long-${String(index + 1).padStart(2, "0")}`,
    flavour: `Pineapple Millions Special Edition ${index + 1}`,
    product_variant_id: String(1000 + index),
  }));
  const group = groupProductOffers(offers)[0];
  const html = renderToStaticMarkup(React.createElement(RetailerOfferCard, { group }));

  assert.equal((html.match(/<button/g) || []).length, 14);
  assert.match(html, /Pineapple Millions Special Edition 14/);
  assert.match(html, /flex-wrap/);
  assert.match(html, /break-words/);
});

test("selection helpers update price, delivered total and CTA for each offer", () => {
  const group = groupProductOffers([
    offer({ id: "chocolate-offer", flavour: "Chocolate", price: "89.95", shipping_cost: "4.99" }),
    offer({ id: "vanilla-offer", flavour: "Vanilla", price: "91.95", shipping_cost: "5.99" }),
  ])[0];

  for (const offerId of ["chocolate-offer", "vanilla-offer"]) {
    const selected = selectGroupOffer(group, offerId);
    assert.equal(selected.id, offerId);
    assert.equal(
      productOfferHref(selected.id, "product_offer_list"),
      `/go/${offerId}?source=product_offer_list`
    );
  }
  assert.equal(getOfferDeliveredTotal(selectGroupOffer(group, "chocolate-offer")), 94.94);
  assert.equal(getOfferDeliveredTotal(selectGroupOffer(group, "vanilla-offer")), 97.94);
});

test("product page keeps in-stock filtering and uses variant-aware Best UK Price", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );

  assert.match(page, /\.eq\("in_stock", true\)/);
  assert.match(page, /const \{ data: offers \} = await supabase/);
  assert.match(page, /await supabaseAdmin[\s\S]*\.from\("retailer_products"\)/);
  assert.match(page, /getBestProductOffer\(sortedOffers\)/);
  assert.match(page, /Variant: \{getOfferVariantLabel\(cheapestOffer\)\}/);
  assert.match(page, /productOfferHref\(cheapestOffer\.id, "product_best_offer"\)/);
});
