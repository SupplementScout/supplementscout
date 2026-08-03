const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  PAGE_LIST_KIND,
  discoverImageCandidates,
  imageDomainAcceptance,
  runCanary,
  validatePageList,
} = require("./lib/nutrition-ocr");
const { isUsefulCandidate, parseArgs, runCli } = require("./nutrition-candidate-batch");

const repositoryRoot = path.resolve(__dirname, "..");

function sourcePage(index = 1) {
  return {
    source_record_id: `official-${index}`,
    product_id: String(300 + index),
    product_variant_id: null,
    product_name: `Official Whey ${index}`,
    brand: "Official Nutrition",
    manufacturer: "Official Nutrition",
    identity_binding: "EXACT_PRODUCT",
    source_page_url: `https://official.example/products/whey-${index}`,
    expected_domain: "official.example",
    official_domains: ["official.example"],
    notes: "Explicit official manufacturer page.",
  };
}

function officialPage(overrides = {}) {
  return {
    ...sourcePage(),
    source_record_id: "applied-clear-whey-official",
    product_id: 338,
    product_name: "Applied Nutrition Clear Whey Protein 875g",
    brand: "Applied Nutrition",
    manufacturer: "Applied Nutrition",
    source_page_url: "https://appliednutrition.uk/products/clear-whey-protein",
    expected_domain: "appliednutrition.uk",
    official_domains: ["appliednutrition.uk"],
    ...overrides,
  };
}

function pageList(page) {
  return { schema_version: 1, kind: PAGE_LIST_KIND, pages: [page] };
}

test("candidate batch requires bounded explicit storage confirmations", () => {
  assert.throws(() => parseArgs(["--input=tmp/a.json", "--max-products=10"]), /official-pages-only/);
  assert.throws(() => parseArgs(["--input=tmp/a.json", "--max-products=10", "--confirm-official-pages-only=true"]), /store-candidates/);
  assert.throws(() => parseArgs(["--input=tmp/a.json", "--max-products=11", "--confirm-official-pages-only=true", "--store-candidates=true"]), /1 to 10/);
  assert.throws(() => parseArgs(["--input=tmp/a.json", "--max-products=1", "--confirm-official-pages-only=true", "--store-candidates=true", "--apply"]), /Unknown option/);
});

test("official manufacturer allowlists accept Applied Nutrition and Optimum Nutrition", () => {
  const applied = officialPage();
  delete applied.brand;
  assert.equal(validatePageList(pageList(applied)).pages[0].brand, "Applied Nutrition");
  const optimum = officialPage({
    source_record_id: "on-gold-standard-official",
    product_id: "7",
    product_name: "Optimum Nutrition Gold Standard Whey 2.27kg",
    brand: "Optimum Nutrition",
    manufacturer: "Optimum Nutrition",
    source_page_url: "https://www.optimumnutrition.com/en-gb/products/gold-standard-whey",
    expected_domain: "optimumnutrition.com",
    official_domains: ["optimumnutrition.com"],
  });
  assert.equal(validatePageList(pageList(optimum)).pages[0].expected_domain, "optimumnutrition.com");
});

test("operator confirmation cannot admit marketplaces, retailers or comparison sites", () => {
  assert.equal(parseArgs([
    "--input=tmp/a.json", "--max-products=1",
    "--confirm-official-pages-only=true", "--store-candidates=true",
  ]).officialPagesOnly, true);
  for (const [domain, label] of [
    ["amazon.co.uk", "Amazon"],
    ["ebay.co.uk", "eBay"],
    ["discount-supplements.co.uk", "known retailer"],
    ["wheywise.co.uk", "comparison site"],
  ]) {
    assert.throws(() => validatePageList(pageList(officialPage({
      source_record_id: `blocked-${label.replace(/\W+/g, "-").toLowerCase()}`,
      source_page_url: `https://${domain}/products/example`,
      expected_domain: domain,
      official_domains: [domain],
    }))), /forbidden retailer, marketplace or comparison domain/);
  }
});

test("official_domains is mandatory and must contain expected_domain", () => {
  const missing = officialPage();
  delete missing.official_domains;
  assert.throws(() => validatePageList(pageList(missing)), /invalid schema/);
  assert.throws(() => validatePageList(pageList(officialPage({
    official_domains: ["appliednutrition.com"],
  }))), /expected_domain is not in official_domains/);
  assert.throws(() => validatePageList(pageList(officialPage({
    source_page_url: "https://shop.appliednutrition.uk/products/clear-whey",
  }))), /expected domain mismatch/);
});

test("current product facts are validated and suppress only true no-op candidates", () => {
  const validated = validatePageList(pageList(officialPage({
    current_values: {
      net_weight_g: 875,
      serving_size_g: 25,
      protein_per_serving_g: 24,
      nutrition_verified: true,
    },
  }))).pages[0];
  assert.equal(validated.current_values.net_weight_g, 875);
  assert.equal(isUsefulCandidate({ field_name: "net_weight_g", value_numeric: 875 }, validated.current_values), false);
  assert.equal(isUsefulCandidate({ field_name: "serving_size_g", value_numeric: 30 }, validated.current_values), true);
  assert.equal(isUsefulCandidate({ field_name: "protein_per_serving_g", value_numeric: 24 }, validated.current_values), false);
  assert.equal(isUsefulCandidate(
    { field_name: "protein_per_serving_g", value_numeric: 24 },
    { protein_per_serving_g: 24, nutrition_verified: false },
  ), true);
  assert.throws(() => validatePageList(pageList(officialPage({
    current_values: { price_gbp: 19.99 },
  }))), /unsupported field price_gbp/);
});

test("redirect outside official_domains is rejected without following it", async () => {
  const batch = fs.mkdtempSync(path.join(repositoryRoot, "tmp", "official-redirect-test-"));
  test.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  const input = pageList(officialPage());
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const requested = [];
  const result = await runCanary(input, inputPath, {
    cwd: repositoryRoot,
    maxProducts: 1,
    fetchImpl: async (url) => {
      requested.push(String(url));
      return new Response(null, {
        status: 302,
        headers: { location: "https://appliednutrition.com/products/clear-whey-protein" },
      });
    },
    delay: async () => {},
  });
  assert.deepEqual(requested, [officialPage().source_page_url]);
  assert.equal(result.report.pages[0].selection_status, "PAGE_FETCH_FAILED");
  assert.equal(result.report.pages[0].source_page_url, null);
});

test("a CDN image is accepted only when directly referenced by official page content", () => {
  const page = validatePageList(pageList(officialPage())).pages[0];
  const imageUrl = "https://cdn.shopify.com/s/files/1/nutrition-label.jpg";
  const discovered = discoverImageCandidates(
    `<main class="product type-product"><img src="${imageUrl}" alt="Nutrition information panel"></main>`,
    page,
  );
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].image_domain_acceptance, "DIRECT_OFFICIAL_PAGE_CDN_REFERENCE");
  assert.equal(imageDomainAcceptance(imageUrl, page, false), null);
});

test("batch combines HTML and local OCR candidates and stores only the candidate queue", async () => {
  const batch = fs.mkdtempSync(path.join(repositoryRoot, "tmp", "nutrition-batch-test-"));
  test.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  fs.writeFileSync(inputPath, JSON.stringify({ schema_version: 1, kind: PAGE_LIST_KIND, pages: [sourcePage()] }));
  const pageHtml = `<main class="product type-product">
    <p>Protein 24g per serving</p>
    <img src="https://official.example/images/nutrition-label.jpg" alt="Nutrition facts label">
  </main>`;
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(table);
      return {
        async upsert(rows) {
          calls.push(rows);
          return { error: null };
        },
      };
    },
  };
  const fetchImpl = async (url) => {
    if (String(url).includes("nutrition-label.jpg")) {
      return new Response(Buffer.from("image"), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "5" },
      });
    }
    return new Response(pageHtml, {
      status: 200,
      headers: { "content-type": "text/html", "content-length": String(Buffer.byteLength(pageHtml)) },
    });
  };
  const result = await runCli([
    `--input=${path.relative(repositoryRoot, inputPath)}`,
    "--max-products=10",
    "--confirm-official-pages-only=true",
    "--store-candidates=true",
  ], {
    cwd: repositoryRoot,
    supabase,
    fetchImpl,
    delay: async () => {},
    imageNormalizer: async () => ({ bytes: Buffer.from("png"), width: 1000, height: 1000 }),
    ocrRunner(input, text, metadata) {
      fs.writeFileSync(text, "Serving Size: 1 Scoop (5g)\nServings Per Container: 50\n");
      fs.writeFileSync(metadata, JSON.stringify({ engine: "Windows.Media.Ocr", language: "en-GB" }));
      return {
        text: "Serving Size: 1 Scoop (5g)\nServings Per Container: 50\n",
        metadata: { engine: "Windows.Media.Ocr", language: "en-GB" },
      };
    },
  });
  assert.equal(calls[0], "nutrition_candidates");
  assert.ok(calls[1].some((row) => row.proposed_field === "protein_per_serving_g"));
  assert.ok(calls[1].some((row) => row.proposed_field === "serving_size_g"));
  assert.ok(calls[1].some((row) => row.proposed_field === "serving_count_verified"));
  assert.ok(calls[1].filter((row) => row.source_locator.startsWith("ocr:")).every((row) => row.confidence === "LOW"));
  assert.equal(result.destination, "nutrition_candidates");
  assert.equal(result.product_updates, 0);
  assert.equal(result.verified_csv_files, 0);
  assert.ok(result.stored_candidates >= 3);
  const report = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, result.report), "utf8"));
  assert.equal(report.products.length, 1);
  assert.equal(report.products[0].page_status, "FETCHED");
  assert.ok(report.products[0].html_candidates >= 1);
  assert.ok(report.products[0].ocr_candidates >= 2);
  assert.deepEqual([...new Set(calls.filter((item) => typeof item === "string"))], ["nutrition_candidates"]);
});
