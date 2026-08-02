const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  STATUS,
  applyConsistencyFlags,
  assertRealPathInsideRoot,
  decodeHtmlEntities,
  deduplicateObservations,
  fingerprint,
  htmlAttribute,
  manufacturerPrimaryProductHtml,
  parseSnapshot,
  sha256,
  validateSourceUrl,
} = require("./nutrition-candidates");
const {
  fetchOne,
  normalizeExpectedDomain,
  readBoundedBody,
} = require("../manufacturer-source-collector");

const PAGE_LIST_KIND = "nutrition-ocr-page-source-list-v1";
const REPORT_KIND = "nutrition-ocr-canary-report-v1";
const MAX_PAGES = 10;
const MAX_CANARY_PRODUCTS = 5;
const MAX_IMAGES_PER_PRODUCT = 2;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_TOTAL_IMAGE_BYTES = 40_000_000;
const MAX_IMAGE_DIMENSION = 10_000;
const MAX_IMAGE_PIXELS = 40_000_000;
const IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const PAGE_KEYS = Object.freeze([
  "source_record_id", "product_id", "product_variant_id", "product_name",
  "brand", "manufacturer", "identity_binding", "source_page_url",
  "expected_domain", "official_domains", "notes",
]);
const FORBIDDEN_SOURCE_DOMAIN_LABELS = Object.freeze([
  "amazon", "ebay", "walmart", "hollandandbarrett", "boots", "superdrug",
  "dolphinfitness", "predatornutrition", "supplementneeds",
  "bodybuildingwarehouse", "discount-supplements", "fithouse", "fit-house",
  "jonssupplements", "6pack-supplements", "wheyokay", "kior", "wheywise",
  "supplementscout", "shopify", "cloudfront", "cloudinary", "ctfassets", "imgix",
]);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function optionalPositiveId(value) {
  return value === null || positiveId(value);
}

function positiveId(value) {
  return (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) ||
    (Number.isSafeInteger(value) && value > 0);
}

function forbiddenSourceDomain(domain) {
  return FORBIDDEN_SOURCE_DOMAIN_LABELS.some((label) =>
    domain === label || domain.startsWith(`${label}.`) || domain.includes(`.${label}.`));
}

function validPageKeys(page) {
  return exactKeys(page, PAGE_KEYS) ||
    exactKeys(page, PAGE_KEYS.filter((key) => key !== "brand")) ||
    exactKeys(page, PAGE_KEYS.filter((key) => key !== "manufacturer"));
}

function validatePageList(input) {
  if (!exactKeys(input, ["schema_version", "kind", "pages"]) ||
      input.schema_version !== 1 || input.kind !== PAGE_LIST_KIND ||
      !Array.isArray(input.pages) || input.pages.length < 1 || input.pages.length > MAX_PAGES) {
    fail(`Invalid OCR page list; expected 1-${MAX_PAGES} explicit pages`);
  }
  const ids = new Set();
  const urls = new Set();
  return {
    ...input,
    pages: input.pages.map((page, index) => {
      if (!validPageKeys(page) || typeof page.source_record_id !== "string" ||
          !page.source_record_id.trim() || page.source_record_id.length > 200 ||
          !positiveId(page.product_id) || !optionalPositiveId(page.product_variant_id) ||
          typeof page.product_name !== "string" || !page.product_name.trim() || page.product_name.length > 300 ||
          !(typeof page.brand === "string" && page.brand.trim() ||
            typeof page.manufacturer === "string" && page.manufacturer.trim()) ||
          (page.brand !== undefined && (typeof page.brand !== "string" || page.brand.length > 200)) ||
          (page.manufacturer !== undefined && (typeof page.manufacturer !== "string" || page.manufacturer.length > 200)) ||
          !["EXACT_PRODUCT", "EXACT_VARIANT"].includes(page.identity_binding) ||
          (page.identity_binding === "EXACT_PRODUCT" && (!page.product_id || page.product_variant_id !== null)) ||
          (page.identity_binding === "EXACT_VARIANT" && (!page.product_id || !page.product_variant_id)) ||
          !Array.isArray(page.official_domains) || page.official_domains.length < 1 ||
          page.official_domains.length > 10 || typeof page.notes !== "string" || page.notes.length > 1000) {
        fail(`OCR page ${index + 1} has an invalid schema`);
      }
      const sourcePageUrl = validateSourceUrl(page.source_page_url);
      const expectedDomain = normalizeExpectedDomain(page.expected_domain);
      const actualDomain = new URL(sourcePageUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (actualDomain !== expectedDomain) fail(`OCR page ${index + 1} expected domain mismatch`);
      const officialDomains = [...new Set(page.official_domains.map(normalizeExpectedDomain))];
      if (!officialDomains.includes(expectedDomain)) fail(`OCR page ${index + 1} expected_domain is not in official_domains`);
      if (officialDomains.some(forbiddenSourceDomain)) fail(`OCR page ${index + 1} uses a forbidden retailer, marketplace or comparison domain`);
      if (ids.has(page.source_record_id)) fail(`Duplicate OCR source_record_id ${page.source_record_id}`);
      if (urls.has(sourcePageUrl)) fail(`Duplicate OCR source page URL ${sourcePageUrl}`);
      ids.add(page.source_record_id);
      urls.add(sourcePageUrl);
      return {
        ...page,
        source_record_id: page.source_record_id.trim(),
        product_id: String(page.product_id),
        product_variant_id: page.product_variant_id === null ? null : String(page.product_variant_id),
        product_name: page.product_name.trim(),
        brand: (page.brand || page.manufacturer).trim(),
        manufacturer: (page.manufacturer || page.brand).trim(),
        source_page_url: sourcePageUrl,
        expected_domain: expectedDomain,
        official_domains: officialDomains,
        notes: page.notes.trim(),
      };
    }),
  };
}

function safeStem(page, index) {
  const slug = page.product_name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "").toLowerCase().slice(0, 70) || "product";
  return `${String(index + 1).padStart(2, "0")}-p${page.product_id || "unmapped"}-${slug}`;
}

function relative(cwd, value) {
  return path.relative(cwd, value).replaceAll("\\", "/");
}

function buildDryPlan(input, inputPath, cwd = process.cwd()) {
  const validated = validatePageList(input);
  const directory = path.dirname(path.resolve(inputPath));
  return {
    schema_version: 1,
    kind: "nutrition-ocr-dry-plan-v1",
    mode: "DRY_PLAN_NO_NETWORK",
    source_list: relative(cwd, path.resolve(inputPath)),
    page_count: validated.pages.length,
    network_requests: 0,
    image_downloads: 0,
    ocr_runs: 0,
    files_written: 0,
    stop_reason: "OFFICIAL_PAGE_AND_AUTO_SELECTION_CANARY_CONFIRMATION_REQUIRED",
    pages: validated.pages.map((page, index) => {
      const stem = safeStem(page, index);
      return {
        source_record_id: page.source_record_id,
        product_id: page.product_id,
        product_name: page.product_name,
        source_page_url: page.source_page_url,
        expected_domain: page.expected_domain,
        official_domains: page.official_domains,
        expected_page_snapshot: relative(cwd, path.join(directory, "pages", `${stem}.html`)),
        expected_raw_image_directory: relative(cwd, path.join(directory, "raw", stem)),
        expected_ocr_directory: relative(cwd, path.join(directory, "ocr", stem)),
        basic_checks: "PASS",
        image_selection: "NOT_RUN_DRY_PLAN",
      };
    }),
  };
}

function srcsetUrls(value) {
  return String(value || "").split(",").map((part) => {
    const match = part.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)(w|x))?$/i);
    return match ? { rawUrl: match[1], descriptor: Number(match[2] || 0), descriptorUnit: match[3] || null } : null;
  }).filter(Boolean);
}

function imageDomain(urlValue) {
  const domain = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
  normalizeExpectedDomain(domain);
  return domain;
}

function imageDomainAcceptance(urlValue, page, directlyReferenced) {
  let domain;
  try {
    domain = imageDomain(urlValue);
  } catch {
    return null;
  }
  if (domain === page.expected_domain) return { domain, reason: "SOURCE_PAGE_DOMAIN" };
  const firstLabel = domain.split(".")[0];
  const knownCdnHost = domain === "cdn.shopify.com" ||
    /^(?:cdn|images?|media|assets?|static|uploads?)\d*$/.test(firstLabel) ||
    /(?:cloudfront\.net|cloudinary\.com|ctfassets\.net|imgix\.net)$/.test(domain);
  return directlyReferenced && knownCdnHost
    ? { domain, reason: "DIRECT_OFFICIAL_PAGE_CDN_REFERENCE" }
    : null;
}

function imageAssetKey(urlValue) {
  let decoded;
  try {
    decoded = decodeURIComponent(new URL(urlValue).pathname);
  } catch {
    decoded = new URL(urlValue).pathname;
  }
  const nested = decoded.lastIndexOf("https://");
  const target = nested >= 0 ? decoded.slice(nested) : decoded;
  try {
    return new URL(target).pathname.split("/").pop().toLowerCase();
  } catch {
    return target.split("/").pop().toLowerCase();
  }
}

function embeddedApprovedImageUrl(urlValue, page) {
  let decoded;
  try {
    decoded = decodeURIComponent(new URL(urlValue).pathname);
  } catch {
    return null;
  }
  const start = decoded.lastIndexOf("https://");
  if (start < 0) return null;
  try {
    const embedded = validateSourceUrl(decoded.slice(start));
    return imageDomainAcceptance(embedded, page, false) && /\.(?:jpe?g|png|webp)$/i.test(new URL(embedded).pathname)
      ? embedded
      : null;
  } catch {
    return null;
  }
}

function productJsonImageEntries(scoped) {
  const entries = [];
  const scripts = scoped.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const attributes = match[1];
    const body = decodeHtmlEntities(match[2].trim());
    const type = String(htmlAttribute(`<script ${attributes}>`, "type") || "").toLowerCase();
    if (!body || body.length > 750_000 || !["application/ld+json", "application/json"].includes(type)) continue;
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    const jsonLd = type === "application/ld+json";
    const visit = (value, pathParts = [], inheritedContext = "", inProduct = false) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const child of value) visit(child, pathParts, inheritedContext, inProduct);
        return;
      }
      const typeValue = String(value["@type"] || "");
      const productContext = inProduct || /\bProduct\b/i.test(typeValue) ||
        pathParts.some((part) => /^(?:product|products|media|images?|featured_media|featured_image)$/i.test(part));
      const context = [value.alt, value.name, value.title, value.media_type, inheritedContext]
        .filter((item) => typeof item === "string").join(" ").slice(0, 600);
      for (const [key, child] of Object.entries(value)) {
        const nextPath = [...pathParts, key];
        const imageKey = /^(?:image|images|src|url|contentUrl|preview_image|featured_image)$/i.test(key);
        const imageValues = typeof child === "string" ? [child]
          : Array.isArray(child) ? child.filter((item) => typeof item === "string") : [];
        if (productContext && imageKey) {
          for (const imageValue of imageValues) {
            if (!/^https:\/\//i.test(imageValue) ||
                !/\.(?:jpe?g|png|webp)(?:[?#]|$)|\/cdn\/shop\/files\//i.test(imageValue)) continue;
            entries.push({
              rawUrl: imageValue,
              descriptor: 0,
              attribute: nextPath.join("."),
              context,
              discoverySource: jsonLd ? "JSON_LD_PRODUCT_IMAGE" : "EMBEDDED_PRODUCT_MEDIA_JSON",
            });
          }
        }
        if (typeof child === "object") visit(child, nextPath, context, productContext);
      }
    };
    visit(data);
  }
  return entries;
}

function imageResolutionHint(urlValue, descriptor = 0) {
  const width = new URL(urlValue).pathname.match(/\/w:(\d+)(?:\/|$)/i);
  return Math.max(Number(descriptor || 0), Number(width?.[1] || 0));
}

function scoreImageCandidate(candidate) {
  const text = `${candidate.url} ${candidate.context}`.toLowerCase()
    .replace(/[_+%-]+/g, " ").replace(/\s+/g, " ");
  const rejectSignals = [
    "logo", "icon", "banner", "payment", "trust badge", "social", "facebook",
    "instagram", "tracking", "pixel", "spinner", "placeholder", "avatar", "flag",
  ].filter((signal) => text.includes(signal));
  if (rejectSignals.length) {
    return { ...candidate, score: -100, confidence: "REJECTED", reasons: rejectSignals.map((s) => `REJECT_${s.toUpperCase().replace(/\s+/g, "_")}`) };
  }
  const reasons = [];
  let score = 0;
  const high = [
    [/supplement\s*facts?/, 120, "SUPPLEMENT_FACTS"],
    [/nutrition(?:al)?\s*(?:facts?|information|panel)/, 120, "NUTRITION_PANEL"],
    [/back\s*label|label\s*back/, 105, "BACK_LABEL"],
    [/\bingredients?\b/, 90, "INGREDIENTS"],
    [/\bdirections?\b/, 85, "DIRECTIONS"],
    [/\bservings?\b/, 55, "SERVING"],
    [/\bpanel\b/, 85, "PANEL"],
    [/\blabel\b/, 80, "LABEL"],
    [/\bfacts?\b/, 80, "FACTS"],
  ];
  for (const [pattern, points, reason] of high) {
    if (pattern.test(text)) {
      score += points;
      reasons.push(reason);
    }
  }
  const medium = [
    [/\bback\b/, 40, "BACK"],
    [/\brear\b/, 40, "REAR"],
    [/(?:tub|pack|product)\s*back|back\s*(?:tub|pack|product)/, 45, "PRODUCT_BACK"],
    [/label\s*image/, 45, "LABEL_IMAGE"],
  ];
  for (const [pattern, points, reason] of medium) {
    if (pattern.test(text)) {
      score += points;
      reasons.push(reason);
    }
  }
  if (/\bfront\b|packshot|hero|lifestyle/.test(text)) {
    score -= 35;
    reasons.push("FRONT_OR_LIFESTYLE");
  }
  return {
    ...candidate,
    score,
    confidence: reasons.some((reason) => high.some((entry) => entry[2] === reason)) && score >= 80
      ? "HIGH"
      : score >= 35 ? "MEDIUM" : "LOW",
    reasons: [...new Set(reasons)],
  };
}

function discoverImageCandidates(html, page) {
  const scoped = manufacturerPrimaryProductHtml(html);
  const found = [];
  const tagPattern = /<(?:img|source|a|div)\b[^>]*>/gi;
  for (const match of scoped.matchAll(tagPattern)) {
    const tag = match[0];
    const tagName = tag.match(/^<([a-z]+)/i)?.[1]?.toLowerCase();
    const context = [
      "alt", "title", "aria-label", "data-caption", "class", "id",
    ].map((name) => htmlAttribute(tag, name)).filter(Boolean).join(" ");
    const entries = [];
    for (const name of [
      "src", "data-src", "data-opt-src", "data-zoom", "data-zoom-image",
      "data-large_image", "data-large-image", "data-full-src", "data-thumb",
    ]) {
      const value = htmlAttribute(tag, name);
      if (value) entries.push({ rawUrl: value, descriptor: 0, attribute: name, context, discoverySource: "HTML_ATTRIBUTE" });
    }
    for (const name of ["srcset", "data-srcset"]) {
      const value = htmlAttribute(tag, name);
      if (value) entries.push(...srcsetUrls(value).map((entry) => ({ ...entry, attribute: name, context, discoverySource: "HTML_SRCSET" })));
    }
    const href = tagName === "a" ? htmlAttribute(tag, "href") : null;
    if (href && /\.(?:jpe?g|png|webp)(?:[?#]|$)|\/f:(?:best|webp)\//i.test(href)) {
      entries.push({ rawUrl: href, descriptor: 0, attribute: "href", context, discoverySource: "HTML_IMAGE_LINK" });
    }
    found.push(...normalizeDiscoveredEntries(entries, page));
  }
  found.push(...normalizeDiscoveredEntries(productJsonImageEntries(scoped), page));
  const byAsset = new Map();
  for (const candidate of found.map(scoreImageCandidate)) {
    const current = byAsset.get(candidate.asset_key);
    if (!current || candidate.score > current.score ||
        (candidate.score === current.score && candidate.descriptor > current.descriptor)) {
      byAsset.set(candidate.asset_key, candidate);
    }
  }
  return [...byAsset.values()].sort((left, right) =>
    right.score - left.score || right.descriptor - left.descriptor || left.url.localeCompare(right.url));
}

function normalizeDiscoveredEntries(entries, page) {
  const found = [];
    for (const entry of entries) {
      if (/^data:/i.test(entry.rawUrl)) continue;
      let url;
      try {
        url = validateSourceUrl(new URL(decodeHtmlEntities(entry.rawUrl), page.source_page_url).href);
      } catch {
        continue;
      }
      const acceptance = imageDomainAcceptance(url, page, true);
      if (!acceptance || /\.svg(?:[?#]|$)/i.test(url)) continue;
      const discoveryUrl = url;
      const embedded = embeddedApprovedImageUrl(url, page);
      if (embedded) url = embedded;
      const selectedAcceptance = imageDomainAcceptance(url, page, embedded ? false : true);
      if (!selectedAcceptance) continue;
      found.push({
        url,
        discovery_url: discoveryUrl === url ? null : discoveryUrl,
        domain: selectedAcceptance.domain,
        source_page_domain: page.expected_domain,
        image_domain: selectedAcceptance.domain,
        image_domain_acceptance: embedded ? selectedAcceptance.reason : acceptance.reason,
        context: String(entry.context || "").slice(0, 600),
        attribute: entry.attribute,
        discovery_source: entry.discoverySource,
        descriptor: imageResolutionHint(discoveryUrl, entry.descriptor),
        asset_key: imageAssetKey(url),
      });
    }
  return found;
}

function selectImages(candidates) {
  const high = candidates.filter((candidate) => candidate.confidence === "HIGH");
  if (high.length) {
    return { selected: high.slice(0, MAX_IMAGES_PER_PRODUCT), status: "IMAGE_SELECTION_HIGH_CONFIDENCE" };
  }
  if (candidates.some((candidate) => candidate.confidence === "MEDIUM")) {
    return { selected: [], status: "IMAGE_SELECTION_UNCERTAIN" };
  }
  return { selected: [], status: "IMAGE_SELECTION_SKIPPED" };
}

async function fetchImage(
  url,
  expectedDomain,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000,
  maximumBytes = MAX_IMAGE_BYTES,
) {
  const byteLimit = Math.min(MAX_IMAGE_BYTES, maximumBytes);
  if (!Number.isInteger(byteLimit) || byteLimit < 1) fail("OCR canary image byte budget is exhausted");
  const domain = new URL(validateSourceUrl(url)).hostname.toLowerCase().replace(/^www\./, "");
  if (domain !== expectedDomain) fail("Selected image domain changed before fetch");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "image/jpeg,image/png,image/webp" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) fail("Image redirect rejected");
    if (!response.ok) fail(`Image HTTP ${response.status}`);
    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(contentType)) fail(`Unsupported image content type ${contentType || "unknown"}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > byteLimit) {
      fail(byteLimit === MAX_IMAGE_BYTES ? "Image exceeds 8 MB" : "Image exceeds remaining OCR canary byte budget");
    }
    const bytes = await readBoundedBody(response, byteLimit);
    return { bytes, contentType, extension: IMAGE_TYPES.get(contentType) };
  } finally {
    clearTimeout(timer);
  }
}

async function normalizeImage(bytes, sharpImpl) {
  const sharp = sharpImpl || require("sharp");
  const source = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    fail("Image dimensions exceed OCR safety limits");
  }
  const normalized = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" })
    .rotate().grayscale().normalize().png().toBuffer();
  return { bytes: normalized, width: metadata.width, height: metadata.height, sourceFormat: metadata.format };
}

function runWindowsOcr(inputPath, textPath, metadataPath, options = {}) {
  const tmpRoot = path.resolve(__dirname, "..", "..", "tmp");
  for (const target of [inputPath, textPath, metadataPath]) {
    assertRealPathInsideRoot(tmpRoot, path.dirname(path.resolve(target)));
  }
  const realInput = fs.realpathSync.native(path.resolve(inputPath));
  const realTmp = fs.realpathSync.native(tmpRoot);
  const inputRelative = path.relative(realTmp, realInput);
  if (inputRelative.startsWith("..") || path.isAbsolute(inputRelative) || !fs.statSync(realInput).isFile()) {
    fail("OCR input must be a real file inside repository tmp");
  }
  if (fs.existsSync(textPath) || fs.existsSync(metadataPath)) fail("OCR output already exists");
  const spawn = options.spawnImpl || spawnSync;
  const scriptPath = options.scriptPath || path.resolve(__dirname, "..", "windows-media-ocr.ps1");
  const executable = options.executable || "powershell.exe";
  const args = [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    "-InputPath", inputPath, "-TextOutputPath", textPath, "-MetadataOutputPath", metadataPath,
  ];
  const result = spawn(executable, args, {
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 1_000_000,
  });
  if (result.error || result.status !== 0) fail(`Windows OCR failed${result.status == null ? "" : ` (${result.status})`}`);
  const text = fs.readFileSync(textPath, "utf8");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  return { text, metadata };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseOcrFacts(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const html = `<div class="product type-product">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
  return applyConsistencyFlags(deduplicateObservations(
    parseSnapshot(html, "text/html", { sourceType: "manufacturer_product_page" })
      .map((item) => ({ ...item, parser: "OCR_TEXT", evidence_locator: item.evidence_locator.replace(/^(?:text|manufacturer):/, "ocr:") })),
  ));
}

function buildOcrCandidates({ page, pageHtml, image, ocr, capturedAt }) {
  const htmlFacts = applyConsistencyFlags(deduplicateObservations(
    parseSnapshot(pageHtml, "text/html", { sourceType: "manufacturer_product_page" }),
  ));
  const ocrFacts = parseOcrFacts(ocr.text);
  const compactOcrText = String(ocr.text).replace(/\s+/g, " ").trim();
  const suspiciousCharacterCount = (compactOcrText.match(/[\uFFFD]|[^\x20-\x7E\u00A0-\u024F]/g) || []).length;
  const lowOcrQuality = compactOcrText.length < 20 ||
    (compactOcrText.length > 0 && suspiciousCharacterCount / compactOcrText.length > 0.1);
  return ocrFacts.map((fact) => {
    const comparable = htmlFacts.filter((item) => item.field_name === fact.field_name);
    const matching = comparable.some((item) => item.value_numeric === fact.value_numeric && item.unit === fact.unit);
    const conflicting = comparable.some((item) => item.value_numeric !== fact.value_numeric || item.unit !== fact.unit);
    const ambiguousLayout = fact.flags.some((flag) => [
      "CONFLICTING_SOURCE_VALUES", "NUTRIENT_EXCEEDS_SERVING_SIZE", "PACKAGE_SERVING_MISMATCH",
    ].includes(flag));
    const flags = new Set([
      ...fact.flags,
      "OCR_IMAGE_NORMALIZED",
      "IMAGE_SELECTION_HIGH_CONFIDENCE",
      ...(matching ? ["OCR_HTML_MATCH"] : ["OCR_ONLY"]),
      ...(conflicting ? ["OCR_HTML_CONFLICT"] : []),
      ...(lowOcrQuality ? ["OCR_LOW_QUALITY"] : []),
      ...(ambiguousLayout ? ["OCR_AMBIGUOUS_LAYOUT"] : []),
      ...(/per\s*100\s*g/i.test(fact.evidence_text) ? ["OCR_PER_100G_BASIS_UNCLEAR"] : []),
    ]);
    const confidence = matching && !conflicting && !lowOcrQuality && !ambiguousLayout &&
      !flags.has("OCR_PER_100G_BASIS_UNCLEAR") ? "MEDIUM" : "LOW";
    const core = {
      product_id: page.product_id,
      product_variant_id: page.product_variant_id,
      product_name: page.product_name,
      brand: page.brand,
      manufacturer: page.manufacturer,
      source_page_url: page.source_page_url,
      source_page_domain: image.source_page_domain,
      image_url: image.url,
      image_domain: image.image_domain,
      image_domain_acceptance: image.image_domain_acceptance,
      image_file: image.raw_file,
      image_sha256: image.raw_sha256,
      normalized_image_file: image.normalized_file,
      normalized_image_sha256: image.normalized_sha256,
      ocr_text_file: ocr.text_file,
      ocr_text_sha256: ocr.text_sha256,
      ocr_metadata_file: ocr.metadata_file,
      ocr_engine: ocr.metadata.engine,
      ocr_engine_version: ocr.metadata.engine_version || null,
      ocr_language: ocr.metadata.language,
      selected_image_score: image.score,
      selection_reasons: image.reasons,
      field_name: fact.field_name,
      value_numeric: fact.value_numeric,
      unit: fact.unit,
      basis: fact.basis,
      evidence_text: fact.evidence_text.slice(0, 160),
      evidence_locator: fact.evidence_locator,
      confidence,
      warning_flags: [...flags].sort(),
      candidate_status: STATUS,
      review_status: "PENDING",
      captured_at: capturedAt,
    };
    return { ...core, candidate_fingerprint: fingerprint("OCR_CANDIDATE", core) };
  });
}

function isConnectionReset(error) {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current.code === "ECONNRESET" || /ECONNRESET/i.test(String(current.message || ""))) return true;
    current = current.cause;
  }
  return false;
}

async function fetchOfficialPage(page, fetchImpl, delay, timeoutMs) {
  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      const fetched = await fetchOne({
        source_url: page.source_page_url,
        expected_domain: page.expected_domain,
      }, fetchImpl, timeoutMs, { allowedRedirectDomains: page.official_domains });
      const finalDomain = imageDomain(fetched.finalUrl);
      if (!page.official_domains.includes(finalDomain) || forbiddenSourceDomain(finalDomain)) {
        fail("Official page redirect left approved manufacturer domains");
      }
      return { ...fetched, attempts };
    } catch (error) {
      if (attempts === 1 && isConnectionReset(error)) {
        await delay(350);
        continue;
      }
      error.pageFetchAttempts = attempts;
      throw error;
    }
  }
  fail("Official page fetch retry handling failed");
}

function pageFetchFailureReason(error) {
  if (/HTTP 404\b/i.test(String(error.message || ""))) return "INVALID_OFFICIAL_URL";
  if (isConnectionReset(error)) return "PAGE_FETCH_FAILED_ECONNRESET";
  return "PAGE_FETCH_FAILED";
}

async function runCanary(input, inputPath, options = {}) {
  const validated = validatePageList(input);
  const productLimit = options.maximumAllowedProducts || MAX_CANARY_PRODUCTS;
  if (!Number.isInteger(productLimit) || productLimit < 1 || productLimit > MAX_PAGES) {
    fail(`OCR product limit must be an integer from 1 to ${MAX_PAGES}`);
  }
  const maximumProducts = Math.min(options.maxProducts || productLimit, productLimit);
  const selectedPages = validated.pages.slice(0, maximumProducts);
  const cwd = options.cwd || process.cwd();
  const tmpRoot = path.resolve(cwd, "tmp");
  const batchDirectory = path.dirname(path.resolve(inputPath));
  assertRealPathInsideRoot(tmpRoot, batchDirectory);
  const reportPath = path.join(batchDirectory, "ocr-canary-report.json");
  const candidatesPath = path.join(batchDirectory, "ocr-candidates.json");
  if (fs.existsSync(reportPath) || fs.existsSync(candidatesPath)) fail("OCR canary output already exists; refusing to overwrite provenance");
  for (const directory of ["pages", "raw", "normalized", "ocr"].map((name) => path.join(batchDirectory, name))) {
    assertRealPathInsideRoot(tmpRoot, directory);
    fs.mkdirSync(directory, { recursive: true });
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const delay = options.delay || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const ocrRunner = options.ocrRunner || runWindowsOcr;
  const imageNormalizer = options.imageNormalizer || ((bytes) => normalizeImage(bytes, options.sharpImpl));
  const capturedAt = new Date().toISOString();
  const pages = [];
  const candidates = [];
  let totalImageBytes = 0;
  let imageDownloads = 0;
  let ocrRuns = 0;
  let pageRequests = 0;
  for (const [pageIndex, page] of selectedPages.entries()) {
    if (pageIndex > 0) await delay(1_500);
    const stem = safeStem(page, pageIndex);
    let fetchedPage;
    try {
      fetchedPage = await fetchOfficialPage(page, fetchImpl, delay, options.timeoutMs);
      pageRequests += fetchedPage.attempts;
    } catch (error) {
      pageRequests += Number(error.pageFetchAttempts || 1);
      pages.push({
        source_record_id: page.source_record_id,
        product_id: page.product_id,
        product_name: page.product_name,
        requested_source_page_url: page.source_page_url,
        source_page_url: null,
        canonical_source_page_url: null,
        source_page_domain: page.expected_domain,
        page_file: null,
        page_sha256: null,
        page_fetch_attempts: Number(error.pageFetchAttempts || 1),
        discovered_image_count: 0,
        selection_status: "PAGE_FETCH_FAILED",
        selected_images: [],
        rejected_images: [],
        skipped_reason: pageFetchFailureReason(error),
        page_error: String(error.message || "Unknown page fetch error").slice(0, 200),
      });
      continue;
    }
    const canonicalDomain = imageDomain(fetchedPage.finalUrl);
    const effectivePage = {
      ...page,
      source_page_url: fetchedPage.finalUrl,
      expected_domain: canonicalDomain,
    };
    const pageFile = path.join(batchDirectory, "pages", `${stem}.html`);
    try {
      fs.writeFileSync(pageFile, fetchedPage.bytes, { flag: "wx" });
    } catch (error) {
      pages.push({
        source_record_id: page.source_record_id,
        product_id: page.product_id,
        product_name: page.product_name,
        requested_source_page_url: page.source_page_url,
        source_page_url: fetchedPage.finalUrl,
        canonical_source_page_url: fetchedPage.finalUrl,
        source_page_domain: canonicalDomain,
        page_file: null,
        page_sha256: null,
        page_fetch_attempts: fetchedPage.attempts,
        discovered_image_count: 0,
        selection_status: "PAGE_SNAPSHOT_WRITE_FAILED",
        selected_images: [],
        rejected_images: [],
        skipped_reason: "PAGE_SNAPSHOT_WRITE_FAILED",
        page_error: String(error.message || "Unknown page snapshot error").slice(0, 200),
      });
      continue;
    }
    const pageHtml = fetchedPage.bytes.toString("utf8");
    const discovered = discoverImageCandidates(pageHtml, effectivePage);
    const selection = selectImages(discovered);
    const pageReport = {
      source_record_id: page.source_record_id,
      product_id: page.product_id,
      product_name: page.product_name,
      requested_source_page_url: page.source_page_url,
      source_page_url: fetchedPage.finalUrl,
      canonical_source_page_url: fetchedPage.finalUrl,
      source_page_domain: canonicalDomain,
      page_file: relative(cwd, pageFile),
      page_sha256: sha256(fetchedPage.bytes),
      page_fetch_attempts: fetchedPage.attempts,
      discovered_image_count: discovered.length,
      selection_status: selection.status,
      selected_images: [],
      rejected_images: [],
      skipped_reason: selection.selected.length ? null : selection.status,
    };
    for (const [imageIndex, selected] of selection.selected.entries()) {
      await delay(1_500);
      let stage = "DOWNLOAD";
      const rejected = {
        image_url: selected.url,
        discovery_url: selected.discovery_url,
        image_domain: selected.image_domain,
        image_domain_acceptance: selected.image_domain_acceptance,
        discovery_source: selected.discovery_source,
        score: selected.score,
        reasons: selected.reasons,
      };
      try {
        const fetchedImage = await fetchImage(
          selected.url,
          selected.domain,
          fetchImpl,
          15_000,
          MAX_TOTAL_IMAGE_BYTES - totalImageBytes,
        );
        totalImageBytes += fetchedImage.bytes.length;
        if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) fail("OCR canary images exceed 40 MB total");
        imageDownloads += 1;
        const imageBase = `${stem}-${String(imageIndex + 1).padStart(2, "0")}-${sha256(selected.url).slice(0, 12)}`;
        const rawPath = path.join(batchDirectory, "raw", `${imageBase}${fetchedImage.extension}`);
        fs.writeFileSync(rawPath, fetchedImage.bytes, { flag: "wx" });
        Object.assign(rejected, { raw_file: relative(cwd, rawPath), raw_sha256: sha256(fetchedImage.bytes) });
        stage = "NORMALIZE";
        const normalized = await imageNormalizer(fetchedImage.bytes);
        const normalizedPath = path.join(batchDirectory, "normalized", `${imageBase}.png`);
        fs.writeFileSync(normalizedPath, normalized.bytes, { flag: "wx" });
        const textPath = path.join(batchDirectory, "ocr", `${imageBase}.txt`);
        const metadataPath = path.join(batchDirectory, "ocr", `${imageBase}.json`);
        stage = "OCR";
        const result = ocrRunner(normalizedPath, textPath, metadataPath, options.ocrOptions || {});
        ocrRuns += 1;
        const imageEvidence = {
          url: selected.url,
          source_page_domain: canonicalDomain,
          image_domain: selected.image_domain,
          image_domain_acceptance: selected.image_domain_acceptance,
          score: selected.score,
          reasons: selected.reasons,
          raw_file: relative(cwd, rawPath),
          raw_sha256: sha256(fetchedImage.bytes),
          normalized_file: relative(cwd, normalizedPath),
          normalized_sha256: sha256(normalized.bytes),
          width: normalized.width,
          height: normalized.height,
        };
        const ocrEvidence = {
          text: result.text,
          metadata: result.metadata,
          text_file: relative(cwd, textPath),
          text_sha256: sha256(Buffer.from(result.text)),
          metadata_file: relative(cwd, metadataPath),
        };
        const imageCandidates = buildOcrCandidates({ page: effectivePage, pageHtml, image: imageEvidence, ocr: ocrEvidence, capturedAt });
        candidates.push(...imageCandidates);
        pageReport.selected_images.push({
          image_url: selected.url,
          discovery_url: selected.discovery_url,
          image_domain: selected.image_domain,
          image_domain_acceptance: selected.image_domain_acceptance,
          discovery_source: selected.discovery_source,
          score: selected.score,
          reasons: selected.reasons,
          raw_file: imageEvidence.raw_file,
          raw_sha256: imageEvidence.raw_sha256,
          normalized_file: imageEvidence.normalized_file,
          normalized_sha256: imageEvidence.normalized_sha256,
          ocr_text_file: ocrEvidence.text_file,
          ocr_text_sha256: ocrEvidence.text_sha256,
          ocr_metadata_file: ocrEvidence.metadata_file,
          candidate_count: imageCandidates.length,
        });
      } catch (error) {
        pageReport.rejected_images.push({
          ...rejected,
          rejection_stage: stage,
          rejection_reason: String(error.message || "Unknown image processing error").slice(0, 200),
        });
      }
    }
    if (!pageReport.selected_images.length && pageReport.rejected_images.length) {
      pageReport.skipped_reason = "SELECTED_IMAGES_REJECTED";
    }
    pages.push(pageReport);
  }
  const report = {
    schema_version: 1,
    kind: REPORT_KIND,
    status: STATUS,
    mode: "LOCAL_OCR_CANARY_NO_DATABASE",
    generated_at: capturedAt,
    summary: {
      selected_products: selectedPages.length,
      page_requests: pageRequests,
      image_downloads: imageDownloads,
      ocr_runs: ocrRuns,
      candidate_facts: candidates.length,
      skipped_products: pages.filter((page) => page.skipped_reason).length,
      database_writes: 0,
      product_updates: 0,
      verified_csv_files: 0,
    },
    pages,
  };
  const candidateArtifact = {
    schema_version: 1,
    kind: "nutrition-ocr-candidate-artifact-v1",
    status: STATUS,
    mode: "LOCAL_OCR_CANARY_NO_DATABASE",
    generated_at: capturedAt,
    candidate_count: candidates.length,
    candidates,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(candidatesPath, `${JSON.stringify(candidateArtifact, null, 2)}\n`, { flag: "wx" });
  return { report, candidateArtifact, reportPath, candidatesPath };
}

module.exports = {
  MAX_CANARY_PRODUCTS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_IMAGES_PER_PRODUCT,
  MAX_PAGES,
  MAX_TOTAL_IMAGE_BYTES,
  PAGE_LIST_KIND,
  REPORT_KIND,
  buildDryPlan,
  buildOcrCandidates,
  discoverImageCandidates,
  fetchImage,
  imageDomainAcceptance,
  normalizeImage,
  parseOcrFacts,
  runCanary,
  runWindowsOcr,
  scoreImageCandidate,
  selectImages,
  validatePageList,
};
