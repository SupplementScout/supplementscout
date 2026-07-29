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

const {
  buildProductStructuredData,
  productCanonicalUrl,
  serializeJsonLd,
} = loadStructuredDataModule();

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
  assert.doesNotMatch(source, /from "next\/script"/);
});
