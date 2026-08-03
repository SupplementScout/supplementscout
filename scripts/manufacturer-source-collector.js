const fs = require("node:fs");
const path = require("node:path");
const {
  INPUT_KIND_V2,
  assertRealPathInsideRoot,
  sha256,
  validateSourceUrl,
} = require("./lib/nutrition-candidates");

const SOURCE_KIND = "nutrition-manufacturer-source-list-v1";
const SOURCE_TYPE = "manufacturer_product_page";
const MAX_SOURCES = 10;
const MAX_HTML_BYTES = 2_000_000;
const MAX_APPROVED_HTML_BYTES = 5_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const RATE_LIMIT_MS = 1_500;
const SOURCE_KEYS = Object.freeze([
  "product_id", "product_name", "brand", "manufacturer", "source_url",
  "expected_domain", "source_type", "notes",
]);
const LIST_KEYS = Object.freeze(["schema_version", "kind", "sources"]);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function nonEmptyText(value, maximum = 300) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function normalizeExpectedDomain(value) {
  if (typeof value !== "string" || value !== value.trim().toLowerCase() ||
      value.length > 253 || !/^[a-z0-9.-]+$/.test(value) ||
      value.startsWith(".") || value.endsWith(".") || value.includes("..")) {
    fail("expected_domain must be a lowercase DNS hostname");
  }
  const labels = value.split(".");
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63 ||
      label.startsWith("-") || label.endsWith("-"))) {
    fail("expected_domain must be a public DNS hostname");
  }
  if (value === "localhost" || /^\d+(?:\.\d+){3}$/.test(value)) {
    fail("expected_domain cannot be localhost or an IP address");
  }
  return value.replace(/^www\./, "");
}

function validateSourceList(list) {
  if (!exactKeys(list, LIST_KEYS) || list.schema_version !== 1 ||
      list.kind !== SOURCE_KIND || !Array.isArray(list.sources) ||
      list.sources.length < 1 || list.sources.length > MAX_SOURCES) {
    fail(`Invalid manufacturer source list; expected 1-${MAX_SOURCES} explicit sources`);
  }
  const urls = new Set();
  return {
    ...list,
    sources: list.sources.map((source, index) => {
      const label = `source ${index + 1}`;
      if (!exactKeys(source, SOURCE_KEYS) ||
          !(source.product_id === null || (typeof source.product_id === "string" && /^[1-9][0-9]*$/.test(source.product_id))) ||
          !nonEmptyText(source.product_name) || !nonEmptyText(source.brand, 200) ||
          !nonEmptyText(source.manufacturer, 200) || source.source_type !== SOURCE_TYPE ||
          typeof source.notes !== "string" || source.notes.length > 1000) {
        fail(`${label} has an invalid schema`);
      }
      const sourceUrl = validateSourceUrl(source.source_url);
      const expectedDomain = normalizeExpectedDomain(source.expected_domain);
      const actualDomain = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (actualDomain !== expectedDomain) {
        fail(`${label} domain ${actualDomain} does not match expected_domain ${expectedDomain}`);
      }
      if (urls.has(sourceUrl)) fail(`${label} duplicates source_url ${sourceUrl}`);
      urls.add(sourceUrl);
      return {
        ...source,
        product_name: source.product_name.trim(),
        brand: source.brand.trim(),
        manufacturer: source.manufacturer.trim(),
        source_url: sourceUrl,
        expected_domain: expectedDomain,
        notes: source.notes.trim(),
      };
    }),
  };
}

function safeFileName(source, index) {
  const slug = source.product_name.normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")
    .toLowerCase().slice(0, 80) || "manufacturer-product";
  const identity = source.product_id ? `p${source.product_id}` : "unmapped";
  return `${String(index + 1).padStart(2, "0")}-${identity}-${slug}-${sha256(source.source_url).slice(0, 12)}.html`;
}

function relativePath(cwd, value) {
  return path.relative(cwd, value).replaceAll("\\", "/");
}

function batchPaths(inputPath, cwd) {
  const batchDirectory = path.dirname(path.resolve(inputPath));
  return {
    batchDirectory,
    manifestPath: path.join(batchDirectory, "manifest.json"),
    rawDirectory: path.join(batchDirectory, "raw"),
    manifestRef: relativePath(cwd, path.join(batchDirectory, "manifest.json")),
  };
}

function buildDryPlan(sourceList, inputPath, cwd = process.cwd()) {
  const validated = validateSourceList(sourceList);
  const paths = batchPaths(inputPath, cwd);
  const sources = validated.sources.map((source, index) => ({
    sequence: index + 1,
    product_id: source.product_id,
    product_name: source.product_name,
    brand: source.brand,
    manufacturer: source.manufacturer,
    source_type: source.source_type,
    source_url: source.source_url,
    domain: source.expected_domain,
    robots_url: `https://${source.expected_domain}/robots.txt`,
    expected_output_path: relativePath(cwd, path.join(paths.rawDirectory, safeFileName(source, index))),
    basic_checks: "PASS",
    robots_review: "PENDING_MANUAL_REVIEW",
    terms_review: "PENDING_MANUAL_REVIEW",
    fetch_approval: "NOT_APPROVED",
    ready_to_fetch: false,
    notes: source.notes,
  }));
  return {
    schema_version: 1,
    kind: "nutrition-manufacturer-source-dry-plan-v1",
    mode: "DRY_PLAN_NO_NETWORK",
    source_list: relativePath(cwd, path.resolve(inputPath)),
    expected_manifest_path: paths.manifestRef,
    expected_raw_directory: relativePath(cwd, paths.rawDirectory),
    source_count: sources.length,
    network_requests: 0,
    files_written: 0,
    stop_reason: "ROBOTS_TERMS_AND_FETCH_APPROVAL_REQUIRED",
    sources,
  };
}

function sameExpectedDomain(urlValue, expectedDomain) {
  return new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "") === expectedDomain;
}

const COMMON_MULTIPART_PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au",
  "co.nz", "com.br", "com.mx", "co.jp", "co.za",
]);

function registrableDomain(value) {
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  normalizeExpectedDomain(hostname);
  const labels = hostname.split(".");
  const suffix = labels.slice(-2).join(".");
  const count = COMMON_MULTIPART_PUBLIC_SUFFIXES.has(suffix) ? 3 : 2;
  return labels.length <= count ? hostname : labels.slice(-count).join(".");
}

function sameRegistrableDomain(urlValue, expectedDomain) {
  return registrableDomain(urlValue) === registrableDomain(`https://${expectedDomain}/`);
}

async function readBoundedBody(response, maximum) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximum) fail(`HTML exceeds ${maximum} bytes`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    length += chunk.length;
    if (length > maximum) {
      await reader.cancel();
      fail(`HTML exceeds ${maximum} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

async function fetchOne(source, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS, options = {}) {
  const maximumHtmlBytes = options.maximumHtmlBytes === undefined
    ? MAX_HTML_BYTES
    : options.maximumHtmlBytes;
  if (!Number.isInteger(maximumHtmlBytes) || maximumHtmlBytes < 1 || maximumHtmlBytes > MAX_APPROVED_HTML_BYTES) {
    fail(`HTML byte limit must be an integer from 1 to ${MAX_APPROVED_HTML_BYTES}`);
  }
  let url = source.source_url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) fail(`Unsafe or excessive redirect for ${source.source_url}`);
        const nextUrl = validateSourceUrl(new URL(location, url).href);
        const nextDomain = new URL(nextUrl).hostname.toLowerCase().replace(/^www\./, "");
        const explicitRedirectDomains = Array.isArray(options.allowedRedirectDomains)
          ? new Set(options.allowedRedirectDomains.map(normalizeExpectedDomain))
          : null;
        const allowedRedirect = explicitRedirectDomains
          ? explicitRedirectDomains.has(nextDomain)
          : sameExpectedDomain(nextUrl, source.expected_domain) ||
            (options.allowSameRegistrableDomain === true && sameRegistrableDomain(nextUrl, source.expected_domain));
        if (!allowedRedirect) {
          fail(`Cross-domain redirect blocked for ${source.source_url}`);
        }
        url = nextUrl;
        continue;
      }
      if (!response.ok) fail(`HTTP ${response.status} for ${source.source_url}`);
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!new Set(["text/html", "application/xhtml+xml"]).has(contentType)) {
        fail(`Non-HTML response blocked for ${source.source_url}`);
      }
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maximumHtmlBytes) {
        fail(`HTML exceeds ${maximumHtmlBytes} bytes for ${source.source_url}`);
      }
      let bytes;
      try {
        bytes = await readBoundedBody(response, maximumHtmlBytes);
      } catch (error) {
        fail(`${error.message} for ${source.source_url}`);
      }
      return { bytes, finalUrl: url };
    } finally {
      clearTimeout(timer);
    }
  }
  fail(`Redirect handling failed for ${source.source_url}`);
}

function buildManifestRecord(source, index, fileName, fileRef, finalUrl, bytes) {
  return {
    source_record_id: `manufacturer-${String(index + 1).padStart(2, "0")}-${sha256(finalUrl).slice(0, 20)}`,
    product_id: source.product_id,
    product_variant_id: null,
    retailer_id: null,
    retailer_product_id: null,
    product_name: source.product_name,
    brand: source.brand,
    manufacturer: source.manufacturer,
    source_url: finalUrl,
    source_type: SOURCE_TYPE,
    identity_binding: source.product_id ? "EXACT_PRODUCT" : "UNMAPPED_SOURCE",
    snapshot_file: `raw/${fileName}`,
    source_snapshot_ref: fileRef,
    snapshot_sha256: sha256(bytes),
    content_type: "text/html",
    current_values: Object.fromEntries([
      "net_weight_g", "net_volume_ml", "serving_count_verified", "serving_size_g",
      "serving_size_ml", "protein_per_serving_g", "creatine_per_serving_g",
    ].map((field) => [field, null])),
  };
}

async function collectApproved(sourceList, inputPath, options = {}) {
  const validated = validateSourceList(sourceList);
  const cwd = options.cwd || process.cwd();
  const paths = batchPaths(inputPath, cwd);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") fail("A fetch implementation is required");
  if (fs.existsSync(paths.manifestPath)) fail("manifest.json already exists; refusing to overwrite provenance");
  const fetched = [];
  for (const [index, source] of validated.sources.entries()) {
    if (index > 0) await (options.delay || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(RATE_LIMIT_MS);
    fetched.push({ source, ...(await fetchOne(source, fetchImpl, options.timeoutMs)) });
  }
  assertRealPathInsideRoot(path.resolve(cwd, "tmp"), paths.rawDirectory);
  const plannedRawPaths = fetched.map((item, index) =>
    path.join(paths.rawDirectory, safeFileName(item.source, index)));
  if (plannedRawPaths.some((file) => fs.existsSync(file))) {
    fail("Raw snapshot already exists; refusing to overwrite provenance");
  }
  fs.mkdirSync(paths.rawDirectory, { recursive: true });
  const records = fetched.map((item, index) => {
    const fileName = safeFileName(item.source, index);
    const rawPath = path.join(paths.rawDirectory, fileName);
    const fileRef = relativePath(cwd, rawPath);
    if (!fileRef.startsWith("tmp/")) fail("Raw snapshots must remain under repository tmp/");
    fs.writeFileSync(rawPath, item.bytes, { flag: "wx" });
    return buildManifestRecord(item.source, index, fileName, fileRef, item.finalUrl, item.bytes);
  });
  const manifest = {
    schema_version: 2,
    kind: INPUT_KIND_V2,
    mode: "OFFLINE",
    captured_at: new Date(options.now || Date.now()).toISOString(),
    records,
  };
  fs.writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return {
    mode: "EXPLICIT_APPROVED_URLS_ONLY",
    network_requests: fetched.length,
    manifest: paths.manifestRef,
    raw_snapshots: records.map((record) => record.source_snapshot_ref),
    records,
  };
}

function resolveInputInsideTmp(file, cwd = process.cwd()) {
  const root = path.resolve(cwd, "tmp");
  const resolved = path.resolve(cwd, file);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("Manufacturer source list must remain inside repository tmp/");
  const realRoot = fs.realpathSync.native(root);
  const realFile = fs.realpathSync.native(resolved);
  const realRelative = path.relative(realRoot, realFile);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) fail("Manufacturer source list resolves outside repository tmp/");
  if (!fs.statSync(realFile).isFile()) fail("Manufacturer source list must be a file");
  return realFile;
}

function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    if (argument === "--dry-plan") result.dryPlan = true;
    else if (argument === "--collect-approved") result.collectApproved = true;
    else if (argument === "--confirm-explicit-urls-only=true") result.explicitUrlsOnly = true;
    else if (argument === "--confirm-robots-terms-reviewed=true") result.robotsTermsReviewed = true;
    else if (argument === "--help") result.help = true;
    else if (argument.startsWith("--input=")) result.input = argument.slice("--input=".length);
    else fail(`Unknown option: ${argument}`);
  }
  if (result.help) return result;
  if (Boolean(result.dryPlan) === Boolean(result.collectApproved)) fail("Choose exactly one of --dry-plan or --collect-approved");
  if (result.collectApproved && (!result.explicitUrlsOnly || !result.robotsTermsReviewed)) {
    fail("Collection requires --confirm-explicit-urls-only=true and --confirm-robots-terms-reviewed=true");
  }
  if (!result.input) fail("Required option: --input=<tmp/.../sources.json>");
  return result;
}

function usage() {
  return [
    "Manufacturer Nutrition Source Collector",
    "",
    "Dry plan (zero network):",
    "  node scripts/manufacturer-source-collector.js --dry-plan --input=tmp/manufacturer-source-batch-1/sources.json",
    "",
    "Approved collection (only after manual robots/terms and URL approval):",
    "  node scripts/manufacturer-source-collector.js --collect-approved --confirm-explicit-urls-only=true --confirm-robots-terms-reviewed=true --input=tmp/manufacturer-source-batch-1/sources.json",
  ].join("\n");
}

async function runCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, output: usage() };
  const cwd = dependencies.cwd || process.cwd();
  const inputPath = resolveInputInsideTmp(options.input, cwd);
  let sourceList;
  try {
    sourceList = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch {
    fail("Manufacturer source list is not valid JSON");
  }
  if (options.dryPlan) return { help: false, plan: buildDryPlan(sourceList, inputPath, cwd) };
  return {
    help: false,
    result: await collectApproved(sourceList, inputPath, { ...dependencies, cwd }),
  };
}

if (require.main === module) {
  runCli().then((result) => {
    console.log(result.help ? result.output : JSON.stringify(result.plan || result.result, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MAX_APPROVED_HTML_BYTES,
  MAX_HTML_BYTES,
  SOURCE_KIND,
  buildDryPlan,
  collectApproved,
  fetchOne,
  normalizeExpectedDomain,
  parseArgs,
  readBoundedBody,
  sameRegistrableDomain,
  resolveInputInsideTmp,
  runCli,
  safeFileName,
  usage,
  validateSourceList,
};
