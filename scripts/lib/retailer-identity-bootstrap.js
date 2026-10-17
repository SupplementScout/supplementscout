const crypto = require("node:crypto");
const { canonicalJson } = require("./canonical-json");

const EXPECTED_DELTA = Object.freeze({
  retailers: 1,
  products: 0,
  product_variants: 0,
  retailer_products: 0,
  offers: 0,
  price_history: 0,
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  invariant(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys are invalid`);
}

function normalizeRetailerName(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeRetailerSlug(value) {
  const slug = String(value || "").normalize("NFKC").trim().toLowerCase().replaceAll("_", "-");
  invariant(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), "Retailer slug must be normalized lowercase kebab-case");
  return slug;
}

function canonicalWebsiteOrigin(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Retailer website must be a valid URL"); }
  invariant(parsed.protocol === "https:", "Retailer website must use HTTPS");
  invariant(!parsed.username && !parsed.password, "Retailer website may not contain credentials");
  invariant(parsed.pathname === "/" && !parsed.search && !parsed.hash, "Retailer website must be an origin without path, query or fragment");
  return parsed.origin.toLowerCase();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function planFingerprint(plan) {
  const candidate = structuredClone(plan);
  candidate.meta.plan_fingerprint = null;
  return crypto.createHash("md5").update(canonicalJson(candidate)).digest("hex");
}

function sourceFingerprint({ environment, retailer }) {
  return sha256(canonicalJson({ environment, retailer }));
}

function buildRetailerIdentityBootstrapPlan(input) {
  const expiresAt = new Date(input.expiresAt).toISOString();
  const environment = {
    target_environment: String(input.environment.target_environment),
    project_ref: String(input.environment.project_ref),
    database_identity: String(input.environment.database_identity),
  };
  const retailer = {
    name: String(input.name).normalize("NFKC").trim().replace(/\s+/g, " "),
    normalized_name: normalizeRetailerName(input.name),
    slug: normalizeRetailerSlug(input.slug),
    website_origin: canonicalWebsiteOrigin(input.website),
  };
  invariant(retailer.name.length > 0 && retailer.name.length <= 200, "Retailer name is invalid");
  invariant(/^[0-9a-f]{64}$/.test(input.sourceArtifactSha256), "Source artifact SHA-256 is invalid");
  invariant(/^[0-9a-f-]{36}$/i.test(input.authorizationId), "Authorization ID is invalid");
  const plan = {
    meta: {
      version: 1,
      plan_kind: "retailer_identity_bootstrap",
      source_artifact_sha256: input.sourceArtifactSha256,
      source_fingerprint: sourceFingerprint({ environment, retailer }),
      plan_fingerprint: null,
      authorization_id: input.authorizationId.toLowerCase(),
      expires_at: expiresAt,
    },
    environment,
    retailer,
    expected_absent: {
      normalized_slug_matches: 0,
      normalized_name_matches: 0,
      canonical_website_origin_matches: 0,
    },
    expected_delta: { ...EXPECTED_DELTA },
  };
  plan.meta.plan_fingerprint = planFingerprint(plan);
  return validateRetailerIdentityBootstrapPlan(plan);
}

function validateRetailerIdentityBootstrapPlan(plan) {
  exactKeys(plan, ["meta", "environment", "retailer", "expected_absent", "expected_delta"], "Bootstrap plan");
  exactKeys(plan.meta, ["version", "plan_kind", "source_artifact_sha256", "source_fingerprint", "plan_fingerprint", "authorization_id", "expires_at"], "Bootstrap metadata");
  exactKeys(plan.environment, ["target_environment", "project_ref", "database_identity"], "Bootstrap environment");
  exactKeys(plan.retailer, ["name", "normalized_name", "slug", "website_origin"], "Bootstrap retailer");
  exactKeys(plan.expected_absent, ["normalized_slug_matches", "normalized_name_matches", "canonical_website_origin_matches"], "Bootstrap expected absent state");
  exactKeys(plan.expected_delta, Object.keys(EXPECTED_DELTA), "Bootstrap expected delta");
  invariant(plan.meta.version === 1 && plan.meta.plan_kind === "retailer_identity_bootstrap", "Bootstrap plan version or kind is invalid");
  invariant(/^[0-9a-f]{64}$/.test(plan.meta.source_artifact_sha256) && /^[0-9a-f]{64}$/.test(plan.meta.source_fingerprint), "Bootstrap source fingerprints are invalid");
  invariant(/^[0-9a-f]{32}$/.test(plan.meta.plan_fingerprint) && plan.meta.plan_fingerprint === planFingerprint(plan), "Bootstrap plan fingerprint is invalid");
  invariant(normalizeRetailerName(plan.retailer.name) === plan.retailer.normalized_name, "Bootstrap normalized name is invalid");
  invariant(normalizeRetailerSlug(plan.retailer.slug) === plan.retailer.slug, "Bootstrap normalized slug is invalid");
  invariant(canonicalWebsiteOrigin(plan.retailer.website_origin) === plan.retailer.website_origin, "Bootstrap website origin is invalid");
  invariant(Object.values(plan.expected_absent).every((value) => value === 0), "Bootstrap expected absent state must be zero");
  invariant(canonicalJson(plan.expected_delta) === canonicalJson(EXPECTED_DELTA), "Bootstrap expected delta is invalid");
  invariant(Number.isFinite(Date.parse(plan.meta.expires_at)), "Bootstrap expiry is invalid");
  return plan;
}

module.exports = {
  EXPECTED_DELTA,
  buildRetailerIdentityBootstrapPlan,
  canonicalWebsiteOrigin,
  normalizeRetailerName,
  normalizeRetailerSlug,
  planFingerprint,
  sourceFingerprint,
  validateRetailerIdentityBootstrapPlan,
};
