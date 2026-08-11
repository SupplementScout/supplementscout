const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  PAGE_LIST_KIND,
  buildDryPlan,
  buildOcrCandidates,
  discoverImageCandidates,
  fetchImage,
  normalizeImage,
  parseOcrFacts,
  runCanary,
  runWindowsOcr,
  selectImages,
  validatePageList,
} = require("./lib/nutrition-ocr");
const { parseArgs, resolveInputInsideTmp } = require("./nutrition-ocr-canary");

const repositoryRoot = path.resolve(__dirname, "..");

function page(overrides = {}) {
  return {
    source_record_id: "gym-high-whey-pro-synergy",
    product_id: "337",
    product_variant_id: null,
    product_name: "GYM HIGH Whey Pro Synergy",
    brand: "GYM HIGH",
    manufacturer: "GYM HIGH",
    identity_binding: "EXACT_PRODUCT",
    source_page_url: "https://gymhigh.co.uk/product/whey-pro-synergy/",
    expected_domain: "gymhigh.co.uk",
    official_domains: ["gymhigh.co.uk"],
    notes: "Official manufacturer page approved for bounded OCR canary.",
    ...overrides,
  };
}

function list(pages = [page()]) {
  return { schema_version: 1, kind: PAGE_LIST_KIND, pages };
}

function tempBatch(name) {
  const tmpRoot = path.join(repositoryRoot, "tmp");
  fs.mkdirSync(tmpRoot, { recursive: true });
  return fs.mkdtempSync(path.join(tmpRoot, `${name}-`));
}

test("page manifest requires exact identity binding and explicit safe domains", () => {
  assert.equal(validatePageList(list()).pages[0].product_id, "337");
  assert.deepEqual(validatePageList(list([page({
    missing_fields: ["serving_size_g", "protein_per_serving_g"],
  })])).pages[0].missing_fields, ["serving_size_g", "protein_per_serving_g"]);
  assert.deepEqual(validatePageList(list([page({
    missing_fields: ["net_volume_ml", "serving_size_ml", "protein_per_serving_g"],
  })])).pages[0].missing_fields, ["net_volume_ml", "serving_size_ml", "protein_per_serving_g"]);
  assert.deepEqual(validatePageList(list([page({
    missing_fields: ["serving_size_g", "creatine_per_serving_g"],
  })])).pages[0].missing_fields, ["serving_size_g", "creatine_per_serving_g"]);
  assert.throws(() => validatePageList(list([page({
    missing_fields: ["serving_size_g", "serving_size_g"],
  })])), /unique non-empty list/);
  assert.throws(() => validatePageList(list([page({
    missing_fields: ["unsupported_field"],
  })])), /supported fields/);
  assert.throws(() => validatePageList(list([page({ product_id: null })])), /invalid schema/);
  assert.throws(() => validatePageList(list([page({
    identity_binding: "UNMAPPED_SOURCE",
    product_id: "337",
  })])), /invalid schema/);
  assert.throws(() => validatePageList(list([page({
    source_page_url: "https://gymhigh.co.uk/product/whey/?token=secret",
  })])), /sensitive parameter|secret|credential|query/i);
  assert.throws(() => validatePageList(list([page({
    source_page_url: "https://gymhigh.co.uk/product/whey/#facts",
  })])), /fragment/i);
  assert.throws(() => validatePageList(list([page({ expected_domain: "127.0.0.1" })])), /public DNS|IP address/);
});

test("manifest is bounded to fifty unique explicit pages", () => {
  assert.throws(() => validatePageList(list([])), /1-50/);
  assert.throws(() => validatePageList(list(Array.from({ length: 51 }, (_, index) => page({
    source_record_id: `record-${index}`,
    source_page_url: `https://gymhigh.co.uk/product/item-${index}/`,
  })))), /1-50/);
  assert.throws(() => validatePageList(list([page(), page()])), /Duplicate OCR/);
});

test("dry plan is network-free and writes nothing", () => {
  const plan = buildDryPlan(list(), path.join(repositoryRoot, "tmp", "ocr", "pages.json"), repositoryRoot);
  assert.equal(plan.mode, "DRY_PLAN_NO_NETWORK");
  assert.equal(plan.network_requests, 0);
  assert.equal(plan.image_downloads, 0);
  assert.equal(plan.ocr_runs, 0);
  assert.equal(plan.files_written, 0);
});

test("image discovery selects only HIGH approved raster label images", () => {
  const html = `<main class="product type-product">
    <img src="https://cdn.gymhigh.co.uk/front.webp" alt="Front packshot">
    <img src="https://cdn.gymhigh.co.uk/back.webp" alt="Product back">
    <a href="https://cdn.gymhigh.co.uk/nutrition-panel.jpg"><img src="https://cdn.gymhigh.co.uk/nutrition-panel-thumb.jpg" alt="Nutrition information panel"></a>
    <img src="https://other.example/facts.jpg" alt="Supplement facts">
    <img src="https://cdn.gymhigh.co.uk/label.svg" alt="Supplement facts">
    <img src="https://cdn.gymhigh.co.uk/logo.png" alt="Logo supplement facts">
  </main>`;
  const discovered = discoverImageCandidates(html, validatePageList(list()).pages[0]);
  assert.ok(discovered.every((item) => item.domain === "cdn.gymhigh.co.uk"));
  assert.ok(discovered.every((item) => !item.url.endsWith(".svg")));
  assert.ok(discovered.some((item) => item.confidence === "HIGH"));
  const selection = selectImages(discovered);
  assert.equal(selection.status, "IMAGE_SELECTION_HIGH_CONFIDENCE");
  assert.ok(selection.selected.length <= 2);
  assert.ok(selection.selected.every((item) => item.confidence === "HIGH"));
  assert.ok(selection.selected.every((item) => !item.url.includes("logo")));
});

test("direct same-page Shopify CDN nutrition images are accepted without globally approving the CDN", () => {
  const appliedPage = validatePageList(list([page({
    source_record_id: "applied-clear-whey",
    product_id: "338",
    product_name: "Applied Nutrition Clear Whey Protein",
    brand: "Applied Nutrition",
    manufacturer: "Applied Nutrition",
    source_page_url: "https://appliednutrition.uk/products/clear-whey-protein",
    expected_domain: "appliednutrition.uk",
    official_domains: ["appliednutrition.uk"],
  })])).pages[0];
  const html = `<main class="product type-product">
    <img loading="lazy" data-src="https://cdn.shopify.com/front.webp" alt="Front packshot">
    <img srcset="https://cdn.shopify.com/nutrition.webp?width=500 500w, https://cdn.shopify.com/nutrition.webp?width=1000 1000w" alt="Nutritional Information">
  </main>`;
  const discovered = discoverImageCandidates(html, appliedPage);
  const selected = selectImages(discovered).selected;
  assert.equal(selected.length, 1);
  assert.equal(selected[0].url, "https://cdn.shopify.com/nutrition.webp?width=1000");
  assert.equal(selected[0].source_page_domain, "appliednutrition.uk");
  assert.equal(selected[0].image_domain, "cdn.shopify.com");
  assert.equal(selected[0].image_domain_acceptance, "DIRECT_OFFICIAL_PAGE_CDN_REFERENCE");
  assert.equal(selected[0].discovery_source, "HTML_SRCSET");
});

test("JSON-LD and embedded product media JSON images are discovered only from the current page", () => {
  const html = `<main class="product type-product">
    <script>window.theme = { image: "not-json" };</script>
    <script type="application/ld+json">{"@type":"Product","name":"Whey","image":["https://images.example-cdn.com/front.webp"]}</script>
    <script type="application/json">{"product":{"media":[{"src":"https://cdn.gymhigh.co.uk/back-label.jpg","alt":"Supplement Facts label"}]}}</script>
    <script type="application/json">{"tracking":{"url":"https://pixels.example/track.png"}}</script>
  </main>`;
  const discovered = discoverImageCandidates(html, validatePageList(list()).pages[0]);
  assert.ok(discovered.some((item) => item.discovery_source === "JSON_LD_PRODUCT_IMAGE"));
  assert.ok(discovered.some((item) => item.discovery_source === "EMBEDDED_PRODUCT_MEDIA_JSON"));
  assert.ok(discovered.every((item) => !item.url.includes("pixels.example")));
  assert.equal(selectImages(discovered).selected[0].url, "https://cdn.gymhigh.co.uk/back-label.jpg");
});

test("image discovery drops credentials, fragments, secret tokens and unapproved domains", () => {
  const html = `<main class="product type-product">
    <img src="https://user:pass@cdn.gymhigh.co.uk/facts.jpg" alt="Supplement facts">
    <img src="https://cdn.gymhigh.co.uk/facts.jpg#panel" alt="Supplement facts">
    <img src="https://cdn.gymhigh.co.uk/facts.jpg?token=secret" alt="Supplement facts">
    <img src="https://127.0.0.1/facts.jpg" alt="Supplement facts">
    <img src="https://competitor.example/facts.jpg" alt="Supplement facts">
  </main>`;
  assert.deepEqual(discoverImageCandidates(html, validatePageList(list()).pages[0]), []);
});

test("an explicit manufacturer origin embedded in an approved CDN URL is preferred", () => {
  const optimized = "https://cdn.gymhigh.co.uk/w:500/https://gymhigh.co.uk/wp-content/nutrition-facts.png";
  const html = `<main class="product type-product"><img data-src="${optimized}" alt="Supplement facts"></main>`;
  const [candidate] = discoverImageCandidates(html, validatePageList(list()).pages[0]);
  assert.equal(candidate.url, "https://gymhigh.co.uk/wp-content/nutrition-facts.png");
  assert.equal(candidate.discovery_url, optimized);
  assert.equal(candidate.descriptor, 500);
});

test("MEDIUM-only image selection is skipped for manual follow-up", () => {
  const selection = selectImages([{ confidence: "MEDIUM", score: 40 }]);
  assert.deepEqual(selection.selected, []);
  assert.equal(selection.status, "IMAGE_SELECTION_UNCERTAIN");
});

test("a front product image mentioning servings alone is not auto-downloaded", () => {
  const html = `<main class="product type-product"><img src="https://cdn.gymhigh.co.uk/whey-20-servings.webp" alt="Whey Protein 20 Servings front image"></main>`;
  const discovered = discoverImageCandidates(html, validatePageList(list()).pages[0]);
  assert.equal(discovered[0].confidence, "LOW");
  assert.equal(selectImages(discovered).status, "IMAGE_SELECTION_SKIPPED");
});

test("image fetch rejects redirects, unsupported types and oversized declarations", async () => {
  await assert.rejects(fetchImage("https://cdn.gymhigh.co.uk/facts.jpg", "cdn.gymhigh.co.uk", async () =>
    new Response(null, { status: 302, headers: { location: "https://cdn.gymhigh.co.uk/other.jpg" } })), /redirect rejected/i);
  await assert.rejects(fetchImage("https://cdn.gymhigh.co.uk/facts.jpg", "cdn.gymhigh.co.uk", async () =>
    new Response("svg", { status: 200, headers: { "content-type": "image/svg+xml" } })), /unsupported image/i);
  await assert.rejects(fetchImage("https://cdn.gymhigh.co.uk/facts.jpg", "cdn.gymhigh.co.uk", async () =>
    new Response("x", { status: 200, headers: { "content-type": "image/jpeg", "content-length": "9000000" } })), /8 MB/);
  await assert.rejects(fetchImage("https://cdn.gymhigh.co.uk/facts.jpg", "cdn.gymhigh.co.uk", async () =>
    new Response("123456", { status: 200, headers: { "content-type": "image/jpeg", "content-length": "6" } }), 15_000, 5), /remaining OCR canary byte budget/);
  await assert.rejects(fetchImage("https://cdn.gymhigh.co.uk/facts.jpg", "cdn.gymhigh.co.uk", async () =>
    new Response("x", { status: 200, headers: { "content-type": "image/jpeg" } }), 15_000, 0), /budget is exhausted/);
});

test("image normalization enforces decoded dimension and pixel limits", async () => {
  const sharpTooWide = () => ({ metadata: async () => ({ width: 10001, height: 10, format: "jpeg" }) });
  await assert.rejects(normalizeImage(Buffer.from("image"), sharpTooWide), /dimensions exceed/);
  const sharpBomb = () => ({ metadata: async () => ({ width: 8000, height: 6000, format: "jpeg" }) });
  await assert.rejects(normalizeImage(Buffer.from("image"), sharpBomb), /dimensions exceed/);
  const chain = {
    metadata: async () => ({ width: 1000, height: 1500, format: "jpeg" }),
    rotate() { return this; }, grayscale() { return this; }, normalize() { return this; },
    png() { return this; }, async toBuffer() { return Buffer.from("normalized"); },
  };
  const normalized = await normalizeImage(Buffer.from("image"), () => chain);
  assert.equal(normalized.width, 1000);
  assert.equal(normalized.height, 1500);
});

test("OCR parser extracts bounded numeric facts and candidate confidence remains capped", () => {
  const facts = parseOcrFacts("Serving size: 30 g\nServings per container: 25\nProtein per serving: 24 g");
  assert.deepEqual(facts.map((fact) => fact.field_name).sort(), [
    "protein_per_serving_g", "serving_count_verified", "serving_size_g",
  ]);
  const validatedPage = validatePageList(list()).pages[0];
  const base = {
    page: validatedPage,
    image: {
      url: "https://cdn.gymhigh.co.uk/facts.jpg", raw_file: "tmp/raw/facts.jpg",
      raw_sha256: "a".repeat(64), normalized_file: "tmp/normalized/facts.png",
      normalized_sha256: "b".repeat(64), score: 120, reasons: ["SUPPLEMENT_FACTS"],
    },
    ocr: {
      text: "Protein per serving: 24 g", text_file: "tmp/ocr/facts.txt",
      text_sha256: "c".repeat(64), metadata_file: "tmp/ocr/facts.json",
      metadata: { engine: "Windows.Media.Ocr", engine_version: "test", language: "en-GB" },
    },
    capturedAt: "2026-08-02T00:00:00.000Z",
  };
  const ocrOnly = buildOcrCandidates({ ...base, pageHtml: "<main class=\"product type-product\"></main>" });
  assert.equal(ocrOnly[0].confidence, "LOW");
  assert.equal(ocrOnly[0].candidate_status, "CANDIDATE_REQUIRES_REVIEW");
  assert.ok(ocrOnly[0].warning_flags.includes("OCR_ONLY"));
  const matching = buildOcrCandidates({ ...base, pageHtml: "<main class=\"product type-product\"><p>Protein per serving: 24 g</p></main>" });
  assert.equal(matching[0].confidence, "MEDIUM");
  assert.ok(matching[0].warning_flags.includes("OCR_HTML_MATCH"));
  const conflicting = buildOcrCandidates({ ...base, pageHtml: "<main class=\"product type-product\"><p>Protein per serving: 20 g</p></main>" });
  assert.equal(conflicting[0].confidence, "LOW");
  assert.ok(conflicting[0].warning_flags.includes("OCR_HTML_CONFLICT"));
  assert.deepEqual(parseOcrFacts("Protein per 100g: 75 g"), []);
  const ambiguous = buildOcrCandidates({
    ...base,
    pageHtml: "<main class=\"product type-product\"></main>",
    ocr: { ...base.ocr, text: "Protein per serving: 20 g\nProtein per serving: 24 g" },
  });
  assert.ok(ambiguous.every((candidate) => candidate.confidence === "LOW"));
  assert.ok(ambiguous.every((candidate) => candidate.warning_flags.includes("OCR_AMBIGUOUS_LAYOUT")));
});

test("OCR parser extracts a strict parenthetical serving size without nutrient inference", () => {
  const facts = parseOcrFacts("Serving Size: 1 Scoop (5g)\nServings Per Container: 50");
  assert.deepEqual(
    facts.map((fact) => [fact.field_name, fact.value_numeric]).sort(),
    [["serving_count_verified", 50], ["serving_size_g", 5]],
  );
  assert.equal(facts.some((fact) => fact.field_name === "creatine_per_serving_g"), false);
  assert.equal(facts.some((fact) => fact.field_name === "protein_per_serving_g"), false);

  const sameLine = parseOcrFacts("Serving Size: 1 Scoop (5g) - Servings Per Container: 50");
  assert.deepEqual(
    sameLine.map((fact) => [fact.field_name, fact.value_numeric]).sort(),
    [["serving_count_verified", 50], ["serving_size_g", 5]],
  );

  const manufacturerBag = parseOcrFacts("Serving Size: 4 Scoops (240g) - Serving Per Bag: 25");
  assert.deepEqual(
    manufacturerBag.map((fact) => [fact.field_name, fact.value_numeric]).sort(),
    [["serving_count_verified", 25], ["serving_size_g", 240]],
  );

  for (const value of [
    "Serving Size: 1-2 Scoops (5g-10g)",
    "Serving Size: 1 Scoop (5g) or 2 Scoops (10g)",
    "Suggested Serving: 1 Scoop (5g)",
    "Serving Size: approximately 5g",
    "Serving Size: 5-10g",
  ]) {
    assert.equal(
      parseOcrFacts(value).some((fact) => fact.field_name === "serving_size_g"),
      false,
      value,
    );
  }
});

function geometryMetadata(rows) {
  const lines = rows.map(({ text, x, y, width = 120, height = 20 }) => {
    const tokens = text.split(/\s+/);
    const step = width / tokens.length;
    return {
      text,
      words: tokens.map((token, index) => ({
        text: token,
        x: x + step * index,
        y,
        width: Math.max(1, step - 2),
        height,
      })),
    };
  });
  return {
    schema_version: 1,
    engine: "Windows.Media.Ocr",
    engine_version: "test",
    language: "en-GB",
    image_width: 1_000,
    image_height: 1_000,
    line_count: lines.length,
    confidence_available: false,
    lines,
  };
}

test("OCR geometry maps protein only from the explicit per-serving table column", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25 g)", x: 300, y: 40, width: 260 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (25 g) serving", x: 720, y: 100, width: 160 },
    { text: "Energy", x: 80, y: 160, width: 80 },
    { text: "Fat", x: 80, y: 190, width: 80 },
    { text: "Protein", x: 80, y: 220, width: 80 },
    { text: "85.06 g", x: 520, y: 220, width: 80 },
    { text: "21.27 g", x: 740, y: 220, width: 80 },
  ]);
  const text = metadata.lines.map((line) => line.text).join("\n");
  const facts = parseOcrFacts(text, metadata);
  const protein = facts.find((fact) => fact.field_name === "protein_per_serving_g");
  assert.equal(protein.value_numeric, 21.27);
  assert.equal(protein.evidence_text, "Protein | Per (25 g) serving | 21.27 g");
  assert.ok(protein.flags.includes("OCR_GEOMETRY_TABLE"));
  assert.equal(facts.some((fact) => fact.field_name === "protein_per_serving_g" && fact.value_numeric === 85.06), false);
});

test("OCR geometry extracts Diet Whey protein from the 25g serving column", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25g)", x: 300, y: 40, width: 250 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (25 g)", x: 720, y: 100 },
    { text: "Energy", x: 80, y: 150, width: 80 },
    { text: "Fat", x: 80, y: 180, width: 80 },
    { text: "Carbohydrates", x: 80, y: 210, width: 130 },
    { text: "Protein", x: 80, y: 240, width: 80 },
    { text: "80 g", x: 520, y: 240, width: 60 },
    { text: "20 g", x: 740, y: 240, width: 60 },
  ]);
  const protein = parseOcrFacts(metadata.lines.map((line) => line.text).join("\n"), metadata)
    .find((fact) => fact.field_name === "protein_per_serving_g");
  assert.equal(protein.value_numeric, 20);
  assert.equal(protein.evidence_text, "Protein | Per (25 g) | 20 g");
});

test("OCR geometry extracts BEEF-XP protein from the 30g serving column", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 1 Scoop (30 g)", x: 300, y: 40, width: 260 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (30 g)", x: 720, y: 100 },
    { text: "Energy", x: 80, y: 150, width: 80 },
    { text: "Fat", x: 80, y: 180, width: 80 },
    { text: "Carbohydrate", x: 80, y: 210, width: 130 },
    { text: "Protein", x: 80, y: 240, width: 80 },
    { text: "91 g", x: 520, y: 240, width: 60 },
    { text: "27.3 g", x: 740, y: 240, width: 70 },
  ]);
  const protein = parseOcrFacts(metadata.lines.map((line) => line.text).join("\n"), metadata)
    .find((fact) => fact.field_name === "protein_per_serving_g");
  assert.equal(protein.value_numeric, 27.3);
  assert.equal(protein.evidence_text, "Protein | Per (30 g) | 27.3 g");
});

test("OCR geometry extracts Beef Mass protein and creatine from the 125g serving column", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 3 Scoops (125 g)", x: 300, y: 40, width: 270 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (125 g)", x: 720, y: 100 },
    { text: "Energy", x: 80, y: 150, width: 80 },
    { text: "Fat", x: 80, y: 180, width: 80 },
    { text: "Carbohydrate", x: 80, y: 210, width: 130 },
    { text: "Protein", x: 80, y: 240, width: 80 },
    { text: "34 g", x: 520, y: 240, width: 60 },
    { text: "42 g", x: 740, y: 240, width: 60 },
    { text: "Creatine Monohydrate", x: 80, y: 300, width: 180 },
    { text: "2400 mg", x: 510, y: 300, width: 90 },
    { text: "3000 mg", x: 730, y: 300, width: 90 },
  ]);
  const facts = parseOcrFacts(metadata.lines.map((line) => line.text).join("\n"), metadata);
  assert.deepEqual(
    facts.filter((fact) => /^(?:protein|creatine)_per_serving_g$/.test(fact.field_name))
      .map((fact) => [fact.field_name, fact.value_numeric]).sort(),
    [["creatine_per_serving_g", 3], ["protein_per_serving_g", 42]],
  );
});

test("OCR geometry rejects a protein word outside the nutrition table label column", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25 g)", x: 300, y: 40, width: 260 },
    { text: "Per (25 g)", x: 720, y: 100 },
    { text: "Energy", x: 200, y: 160, width: 80 },
    { text: "Fat", x: 200, y: 190, width: 80 },
    { text: "Protein", x: 200, y: 220, width: 80 },
    { text: "20 g", x: 740, y: 220, width: 60 },
    { text: "PROTEIN", x: 20, y: 300, width: 80 },
    { text: "3 g", x: 740, y: 300, width: 60 },
  ]);
  const facts = parseOcrFacts(metadata.lines.map((line) => line.text).join("\n"), metadata)
    .filter((fact) => fact.field_name === "protein_per_serving_g");
  assert.deepEqual(facts.map((fact) => fact.value_numeric), [20]);
});

test("OCR geometry extracts a directly labelled creatine row but never infers it from serving size", () => {
  const metadata = geometryMetadata([
    { text: "Serving Size: 1 Scoop (5g)", x: 300, y: 40, width: 240 },
    { text: "Per Serving", x: 700, y: 100 },
    { text: "Creatine Monohydrate", x: 80, y: 220, width: 180 },
    { text: "5000 mg", x: 720, y: 220, width: 90 },
  ]);
  const text = metadata.lines.map((line) => line.text).join("\n");
  const facts = parseOcrFacts(text, metadata);
  const creatine = facts.find((fact) => fact.field_name === "creatine_per_serving_g");
  assert.equal(creatine.value_numeric, 5);
  assert.ok(creatine.flags.includes("OCR_CREATINE_MONOHYDRATE_LABEL"));
  assert.equal(parseOcrFacts("Serving Size: 1 Scoop (5g)").some((fact) =>
    fact.field_name === "creatine_per_serving_g"), false);
  assert.equal(parseOcrFacts("100% creatine\nServing Size: 1 Scoop (5g)").some((fact) =>
    fact.field_name === "creatine_per_serving_g"), false);
});

test("OCR geometry fails closed for per-100g, mismatched and ambiguous columns", () => {
  const per100Only = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25 g)", x: 300, y: 40, width: 260 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (25 g)", x: 720, y: 100 },
    { text: "Energy", x: 80, y: 160, width: 80 },
    { text: "Fat", x: 80, y: 190, width: 80 },
    { text: "Protein", x: 80, y: 220, width: 80 },
    { text: "80 g", x: 520, y: 220, width: 60 },
    { text: "Salt", x: 80, y: 250, width: 80 },
    { text: "Creatine", x: 80, y: 280, width: 90 },
    { text: "10 g", x: 520, y: 280, width: 60 },
  ]);
  const per100Facts = parseOcrFacts(per100Only.lines.map((line) => line.text).join("\n"), per100Only);
  assert.equal(per100Facts.some((fact) => fact.field_name === "protein_per_serving_g"), false);
  assert.equal(per100Facts.some((fact) => fact.field_name === "creatine_per_serving_g"), false);

  const mismatched = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25 g)", x: 300, y: 40, width: 260 },
    { text: "Per (100 g)", x: 500, y: 100 },
    { text: "Per (30 g)", x: 700, y: 100 },
    { text: "Energy", x: 80, y: 160, width: 80 },
    { text: "Fat", x: 80, y: 190, width: 80 },
    { text: "Protein", x: 80, y: 220, width: 80 },
    { text: "80 g", x: 520, y: 220, width: 60 },
    { text: "24 g", x: 720, y: 220, width: 60 },
  ]);
  assert.equal(parseOcrFacts(mismatched.lines.map((line) => line.text).join("\n"), mismatched)
    .some((fact) => fact.field_name === "protein_per_serving_g"), false);

  const ambiguous = geometryMetadata([
    { text: "Serving Size: 1 Scoop (25 g)", x: 300, y: 40, width: 260 },
    { text: "Per (25 g)", x: 600, y: 100 },
    { text: "Per Serving", x: 700, y: 100 },
    { text: "Energy", x: 80, y: 160, width: 80 },
    { text: "Fat", x: 80, y: 190, width: 80 },
    { text: "Protein", x: 80, y: 220, width: 80 },
    { text: "20 g", x: 680, y: 220, width: 60 },
  ]);
  assert.equal(parseOcrFacts(ambiguous.lines.map((line) => line.text).join("\n"), ambiguous)
    .some((fact) => fact.field_name === "protein_per_serving_g"), false);
});

test("canary requests only an explicit page and selected HIGH image", async (t) => {
  const batch = tempBatch("nutrition-ocr-canary-test");
  t.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  fs.writeFileSync(inputPath, JSON.stringify(list()));
  const requested = [];
  const pageHtml = `<main class="product type-product">
    <img src="https://cdn.gymhigh.co.uk/back.webp" alt="Product back">
    <img src="https://cdn.gymhigh.co.uk/supplement-facts.jpg" alt="Supplement Facts label">
  </main>`;
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url === page().source_page_url) return new Response(pageHtml, { status: 200, headers: { "content-type": "text/html" } });
    if (url === "https://cdn.gymhigh.co.uk/supplement-facts.jpg") return new Response(Buffer.from("raw-image"), { status: 200, headers: { "content-type": "image/jpeg" } });
    throw new Error(`Unexpected request ${url}`);
  };
  const result = await runCanary(list(), inputPath, {
    cwd: repositoryRoot,
    fetchImpl,
    delay: async () => {},
    imageNormalizer: async () => ({ bytes: Buffer.from("normalized"), width: 1000, height: 1500, sourceFormat: "jpeg" }),
    ocrRunner: (_input, textPath, metadataPath) => {
      const text = "Protein per serving: 24 g";
      const metadata = { engine: "Windows.Media.Ocr", engine_version: "test", language: "en-GB" };
      fs.writeFileSync(textPath, text);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      return { text, metadata };
    },
  });
  assert.deepEqual(requested, [page().source_page_url, "https://cdn.gymhigh.co.uk/supplement-facts.jpg"]);
  assert.equal(result.report.summary.database_writes, 0);
  assert.equal(result.report.summary.product_updates, 0);
  assert.equal(result.report.summary.verified_csv_files, 0);
  assert.equal(result.candidateArtifact.status, "CANDIDATE_REQUIRES_REVIEW");
  assert.ok(result.candidateArtifact.candidates.every((candidate) => candidate.candidate_status === "CANDIDATE_REQUIRES_REVIEW"));
  assert.match(result.report.pages[0].page_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.report.pages[0].selected_images[0].raw_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.report.pages[0].selected_images[0].ocr_text_sha256, /^[a-f0-9]{64}$/);
});

test("a rejected selected image is reported and does not destroy the canary report", async (t) => {
  const batch = tempBatch("nutrition-ocr-rejection-test");
  t.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  fs.writeFileSync(inputPath, JSON.stringify(list()));
  const html = "<main class=\"product type-product\"><img src=\"https://cdn.gymhigh.co.uk/supplement-facts.jpg\" alt=\"Supplement facts\"></main>";
  const result = await runCanary(list(), inputPath, {
    cwd: repositoryRoot,
    delay: async () => {},
    fetchImpl: async (url) => url === page().source_page_url
      ? new Response(html, { status: 200, headers: { "content-type": "text/html" } })
      : new Response(null, { status: 302, headers: { location: "https://cdn.gymhigh.co.uk/facts-final.jpg" } }),
  });
  assert.equal(result.report.pages[0].skipped_reason, "SELECTED_IMAGES_REJECTED");
  assert.equal(result.report.pages[0].rejected_images[0].rejection_stage, "DOWNLOAD");
  assert.match(result.report.pages[0].rejected_images[0].rejection_reason, /redirect rejected/i);
  assert.equal(result.report.summary.candidate_facts, 0);
  assert.ok(fs.existsSync(result.reportPath));
});

test("one page failure retries ECONNRESET once, continues the batch, and reports invalid URLs", async (t) => {
  const batch = tempBatch("nutrition-ocr-page-failure-test");
  t.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  const pages = [
    page({
      source_record_id: "per4m-whey",
      product_id: "12",
      product_name: "PER4M Whey Protein",
      brand: "PER4M",
      manufacturer: "PER4M",
      source_page_url: "https://per4m.com/products/whey-protein",
      expected_domain: "per4m.com",
      official_domains: ["per4m.com"],
    }),
    page({
      source_record_id: "strom-invalid",
      product_id: "898",
      product_name: "Strom Velosiwhey Iso",
      brand: "Strom Sports",
      manufacturer: "Strom Sports",
      source_page_url: "https://www.stromsports.com/products/velosiwhey-iso",
      expected_domain: "stromsports.com",
      official_domains: ["stromsports.com"],
    }),
    page({ source_record_id: "gym-success" }),
  ];
  fs.writeFileSync(inputPath, JSON.stringify(list(pages)));
  const calls = [];
  const result = await runCanary(list(pages), inputPath, {
    cwd: repositoryRoot,
    delay: async () => {},
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes("per4m.com")) {
        const error = new TypeError("fetch failed");
        error.cause = { code: "ECONNRESET" };
        throw error;
      }
      if (url.includes("stromsports.com")) return new Response("missing", { status: 404, headers: { "content-type": "text/html" } });
      return new Response("<main class=\"product type-product\"></main>", { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  assert.equal(calls.filter((url) => url.includes("per4m.com")).length, 2);
  assert.equal(calls.filter((url) => url.includes("stromsports.com")).length, 1);
  assert.equal(result.report.pages.length, 3);
  assert.equal(result.report.pages[0].skipped_reason, "PAGE_FETCH_FAILED_ECONNRESET");
  assert.equal(result.report.pages[0].page_fetch_attempts, 2);
  assert.equal(result.report.pages[1].skipped_reason, "INVALID_OFFICIAL_URL");
  assert.equal(result.report.pages[2].selection_status, "IMAGE_SELECTION_SKIPPED");
  assert.equal(result.report.summary.page_requests, 4);
  assert.ok(fs.existsSync(result.reportPath));
});

test("Windows OCR invocation uses fixed executable and separate arguments", (t) => {
  const batch = tempBatch("nutrition-ocr-spawn-test");
  t.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "input.png");
  const textPath = path.join(batch, "output.txt");
  const metadataPath = path.join(batch, "output.json");
  fs.writeFileSync(inputPath, "image");
  let invocation;
  const result = runWindowsOcr(inputPath, textPath, metadataPath, {
    spawnImpl: (executable, args, options) => {
      invocation = { executable, args, options };
      fs.writeFileSync(textPath, "Serving size: 30 g");
      fs.writeFileSync(metadataPath, JSON.stringify({ engine: "Windows.Media.Ocr", language: "en-GB" }));
      return { status: 0 };
    },
  });
  assert.equal(invocation.executable, "powershell.exe");
  assert.equal(invocation.options.shell, false);
  assert.ok(invocation.args.includes("-NonInteractive"));
  assert.equal(result.metadata.engine, "Windows.Media.Ocr");
});

test("CLI requires explicit canary confirmations and tmp-confined manifest", (t) => {
  assert.throws(() => parseArgs(["--canary", "--input=tmp/pages.json"]), /requires/);
  assert.throws(() => parseArgs(["--dry-plan", "--canary", "--input=tmp/pages.json"]), /exactly one/);
  assert.throws(() => parseArgs(["--dry-plan", "--input=tmp/pages.json", "--max-products=6"]), /1 to 5/);
  const batch = tempBatch("nutrition-ocr-path-test");
  t.after(() => fs.rmSync(batch, { recursive: true, force: true }));
  const inputPath = path.join(batch, "pages.json");
  fs.writeFileSync(inputPath, JSON.stringify(list()));
  assert.equal(resolveInputInsideTmp(inputPath, repositoryRoot), fs.realpathSync.native(inputPath));
  assert.throws(() => resolveInputInsideTmp(path.join(repositoryRoot, "package.json"), repositoryRoot), /inside repository tmp/);
});

test("OCR implementation contains no database, Supabase, importer, crawler or verified CSV path", () => {
  const runtime = [
    path.join(__dirname, "lib", "nutrition-ocr.js"),
    path.join(__dirname, "nutrition-ocr-canary.js"),
    path.join(__dirname, "windows-media-ocr.ps1"),
  ].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(runtime, /supabase|nutrition_candidates|import-verified|data[\\/]verified|sitemap|crawl/i);
  assert.doesNotMatch(runtime, /\b(?:insert|update|delete)\s*\(/i);
});
