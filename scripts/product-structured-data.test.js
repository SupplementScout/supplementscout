const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadStructuredDataModule() {
  const filename = path.join(
    process.cwd(),
    "app",
    "lib",
    "productStructuredData.ts"
  );
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

function loadCategoryRoutesModule() {
  const filename = path.join(process.cwd(), "app", "lib", "categoryRoutes.ts");
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  const mod = new Module(filename, module);
  const subtypeFilename = path.join(
    process.cwd(),
    "app",
    "lib",
    "proteinSubtypes.ts"
  );
  const subtypeSource = fs.readFileSync(subtypeFilename, "utf8");
  const subtypeOutput = ts.transpileModule(subtypeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: subtypeFilename,
  }).outputText;
  const subtypeModule = new Module(subtypeFilename, module);
  subtypeModule.filename = subtypeFilename;
  subtypeModule.paths = Module._nodeModulePaths(path.dirname(subtypeFilename));
  subtypeModule._compile(subtypeOutput, subtypeFilename);
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent === mod && request === "./proteinSubtypes") return subtypeModule.exports;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(outputText, filename);
  } finally {
    Module._load = originalLoad;
  }

  return mod.exports;
}

const {
  buildProductStructuredData,
  productCanonicalUrl,
  serializeJsonLd,
} = loadStructuredDataModule();
const {
  categoryBrowseHref,
  COMPARISON_CATEGORY_LINKS,
  comparisonLinkForCategory,
  comparisonLinkForProduct,
} = loadCategoryRoutesModule();

function product(overrides = {}) {
  return {
    id: "42",
    brand: "Example Brand",
    image: "https://cdn.example.com/product.jpg",
    name: "Example Creatine 300g",
    slug: "example-creatine-300g",
    ...overrides,
  };
}

function offer(overrides = {}) {
  return {
    id: "1",
    in_stock: true,
    price: "19.99",
    product_variant_id: "100",
    ...overrides,
  };
}

test("single-variant retailer prices produce a truthful AggregateOffer", () => {
  const data = buildProductStructuredData({
    description: "Visible product summary.",
    product: product(),
    offers: [
      offer(),
      offer({ id: "2", price: "24.50" }),
      offer({ id: "3", price: "17.00", in_stock: false }),
      offer({ id: "4", price: "not-a-price" }),
      offer({ id: "2", price: "1.00" }),
    ],
  });
  const productEntity = data["@graph"][0];

  assert.deepEqual(productEntity.offers, {
    "@type": "AggregateOffer",
    availability: "https://schema.org/InStock",
    highPrice: 24.5,
    lowPrice: 19.99,
    offerCount: 2,
    priceCurrency: "GBP",
    url: "https://www.supplementscout.co.uk/product/example-creatine-300g",
  });
  assert.equal(productEntity.offers.seller, undefined);
  assert.equal(productEntity.description, "Visible product summary.");
});

test("different product variants are never collapsed into AggregateOffer", () => {
  const data = buildProductStructuredData({
    description: "Visible product summary.",
    product: product(),
    offers: [
      offer({ id: "1", product_variant_id: "100" }),
      offer({ id: "2", product_variant_id: "200" }),
    ],
  });

  assert.equal(
    data["@graph"].some((entity) => entity["@type"] === "Product"),
    false
  );
  assert.equal(data["@graph"][0]["@type"], "BreadcrumbList");
});

test("Product and BreadcrumbList use one canonical identity", () => {
  const data = buildProductStructuredData({
    description: "Visible product summary.",
    product: product(),
    offers: [offer()],
  });
  const [productEntity, breadcrumbs] = data["@graph"];
  const canonical =
    "https://www.supplementscout.co.uk/product/example-creatine-300g";

  assert.equal(data["@context"], "https://schema.org");
  assert.equal(productEntity["@id"], `${canonical}#product`);
  assert.equal(productEntity.url, canonical);
  assert.deepEqual(productEntity.brand, {
    "@type": "Brand",
    name: "Example Brand",
  });
  assert.deepEqual(productEntity.image, [
    "https://cdn.example.com/product.jpg",
  ]);
  assert.equal(breadcrumbs["@type"], "BreadcrumbList");
  assert.deepEqual(
    breadcrumbs.itemListElement.map(({ position, name, item }) => ({
      position,
      name,
      item,
    })),
    [
      {
        position: 1,
        name: "SupplementScout",
        item: "https://www.supplementscout.co.uk",
      },
      { position: 2, name: "Example Creatine 300g", item: canonical },
    ]
  );
});

test("approved exact categories add the comparison page to product breadcrumbs", () => {
  const data = buildProductStructuredData({
    categoryComparison: { name: "Creatine", url: "/creatine" },
    description: "Visible product summary.",
    product: product(),
    offers: [offer()],
  });
  const breadcrumbs = data["@graph"][1];

  assert.deepEqual(
    breadcrumbs.itemListElement.map(({ position, name, item }) => ({
      position,
      name,
      item,
    })),
    [
      {
        position: 1,
        name: "SupplementScout",
        item: "https://www.supplementscout.co.uk",
      },
      {
        position: 2,
        name: "Creatine",
        item: "https://www.supplementscout.co.uk/creatine",
      },
      {
        position: 3,
        name: "Example Creatine 300g",
        item:
          "https://www.supplementscout.co.uk/product/example-creatine-300g",
      },
    ]
  );
});

test("unapproved category paths cannot enter product structured data", () => {
  const data = buildProductStructuredData({
    categoryComparison: {
      name: "External category",
      url: "https://example.com/category",
    },
    description: "Visible product summary.",
    product: product(),
    offers: [offer()],
  });
  const breadcrumbs = data["@graph"][1];

  assert.equal(breadcrumbs.itemListElement.length, 2);
  assert.equal(breadcrumbs.itemListElement[1].position, 2);
  assert.equal(breadcrumbs.itemListElement[1].name, "Example Creatine 300g");
});

test("comparison category routing is shared, exact and safely falls back", () => {
  assert.equal(COMPARISON_CATEGORY_LINKS.length, 14);
  assert.equal(
    new Set(COMPARISON_CATEGORY_LINKS.map(({ href }) => href)).size,
    COMPARISON_CATEGORY_LINKS.length
  );
  assert.deepEqual(comparisonLinkForCategory(" creatine "), {
    label: "Creatine",
    href: "/creatine",
  });
  assert.equal(comparisonLinkForCategory("Creatine blends"), null);
  assert.equal(categoryBrowseHref("Creatine"), "/creatine");
  assert.equal(
    categoryBrowseHref("Joint support & mobility"),
    "/search?q=Joint%20support%20%26%20mobility"
  );
});

test("reviewed protein subtype links prefer isolate and vegan hubs", () => {
  assert.equal(
    comparisonLinkForProduct({
      name: "Dymatize ISO 100 2.27kg",
      category: "Whey Protein",
      product_format: "powder",
    }).href,
    "/whey-isolate"
  );
  assert.equal(
    comparisonLinkForProduct({
      name: "Ghost Vegan Protein 989g",
      category: "Protein",
      product_format: "powder",
    }).href,
    "/vegan-protein"
  );
  assert.equal(
    comparisonLinkForProduct({
      name: "Per4m Whey Protein 2kg",
      category: "Whey Protein",
      product_format: "powder",
    }).href,
    "/whey-protein"
  );
});

test("unknown brands and unsafe image URLs are omitted", () => {
  const data = buildProductStructuredData({
    description: "Visible product summary.",
    product: product({ brand: "Unknown brand", image: "javascript:alert(1)" }),
    offers: [offer()],
  });
  const productEntity = data["@graph"][0];

  assert.equal(productEntity.brand, undefined);
  assert.equal(productEntity.image, undefined);
});

test("canonical URLs encode unsafe route characters and JSON-LD escapes HTML", () => {
  assert.equal(
    productCanonicalUrl(product({ slug: "unsafe slug/<tag>" })),
    "https://www.supplementscout.co.uk/product/unsafe%20slug%2F%3Ctag%3E"
  );
  assert.equal(
    serializeJsonLd({ name: "</script><script>alert(1)</script>" }),
    '{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}'
  );
});

test("product page renders native JSON-LD and visible breadcrumbs", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "product", "[id]", "page.tsx"),
    "utf8"
  );

  assert.match(source, /type="application\/ld\+json"/);
  assert.match(source, /serializeJsonLd\(structuredData\)/);
  assert.match(source, /<nav aria-label="Breadcrumb">/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /comparisonLinkForProduct\(product\)/);
  assert.match(source, /href=\{comparisonLink\.href\}/);
  assert.match(source, /categoryComparison: comparisonLink/);
  assert.doesNotMatch(source, /from "next\/script"/);
});
