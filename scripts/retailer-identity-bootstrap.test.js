const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const tls = require("node:tls");
const {
  EXPECTED_DELTA,
  buildRetailerIdentityBootstrapPlan,
  canonicalWebsiteOrigin,
  normalizeRetailerName,
  normalizeRetailerSlug,
  validateRetailerIdentityBootstrapPlan,
} = require("./lib/retailer-identity-bootstrap");
const {
  normalizeVerifiedConnectionString,
  postgresClientConfig,
  verifiedTlsOptions,
} = require("./lib/secure-postgres");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(ROOT, "supabase/migrations/20261017120000_add_retailer_identity_bootstrap.sql");
const ROLLBACK = path.join(ROOT, "supabase/manual/20261017120000_add_retailer_identity_bootstrap_rollback.sql");

function input(overrides = {}) {
  return {
    name: "  Example   Nutrition  ",
    slug: "example-nutrition",
    website: "https://EXAMPLE.test",
    sourceArtifactSha256: "a".repeat(64),
    authorizationId: "123e4567-e89b-42d3-a456-426614174000",
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    environment: {
      target_environment: "STAGING",
      project_ref: "abcdefghijklmnopqrst",
      database_identity: "supplementscout-staging:abcdefghijklmnopqrst",
    },
    ...overrides,
  };
}

test("identity plan is platform-neutral, normalized, immutable and identity-only", () => {
  const plan = buildRetailerIdentityBootstrapPlan(input());
  assert.equal(plan.retailer.name, "Example Nutrition");
  assert.equal(plan.retailer.normalized_name, "example nutrition");
  assert.equal(plan.retailer.slug, "example-nutrition");
  assert.equal(plan.retailer.website_origin, "https://example.test");
  assert.deepEqual(plan.expected_delta, EXPECTED_DELTA);
  assert.deepEqual(plan.expected_absent, {
    normalized_slug_matches: 0,
    normalized_name_matches: 0,
    canonical_website_origin_matches: 0,
  });
  assert.deepEqual(Object.keys(plan).sort(), ["environment", "expected_absent", "expected_delta", "meta", "retailer"]);
  assert.doesNotMatch(JSON.stringify({ retailer: plan.retailer, meta: plan.meta }), /shopify|woocommerce|\bekm\b|shipping|affiliate|automation/i);
});

test("identity normalization rejects non-origin websites and malformed slugs", () => {
  assert.equal(normalizeRetailerName("  ACME\tNutrition "), "acme nutrition");
  assert.equal(normalizeRetailerSlug("acme_nutrition"), "acme-nutrition");
  assert.equal(canonicalWebsiteOrigin("https://ACME.test"), "https://acme.test");
  assert.throws(() => canonicalWebsiteOrigin("http://acme.test"), /HTTPS/);
  assert.throws(() => canonicalWebsiteOrigin("https://acme.test/products"), /origin/);
  assert.throws(() => normalizeRetailerSlug("Acme Nutrition"), /kebab-case/);
});

test("changed plan fields or fingerprints are rejected", () => {
  const plan = buildRetailerIdentityBootstrapPlan(input());
  const changed = structuredClone(plan);
  changed.retailer.name = "Changed";
  assert.throws(() => validateRetailerIdentityBootstrapPlan(changed), /normalized name|fingerprint/);
  const fingerprint = structuredClone(plan);
  fingerprint.meta.plan_fingerprint = "b".repeat(32);
  assert.throws(() => validateRetailerIdentityBootstrapPlan(fingerprint), /fingerprint/);
});

test("verified PostgreSQL TLS requires verify-full, a CA and hostname verification", () => {
  assert.match(normalizeVerifiedConnectionString("postgresql://user:secret@db.example.test/postgres?sslmode=verify-full"), /^postgresql:/);
  for (const mode of ["disable", "allow", "prefer", "require", "no-verify"]) {
    assert.throws(() => normalizeVerifiedConnectionString(`postgresql://user:secret@db.example.test/postgres?sslmode=${mode}`), /verify-full/);
  }
  const rootCaPath = path.resolve("private", "root.crt");
  const tlsOptions = {
    env: { PGSSLROOTCERT: rootCaPath },
    stat: () => ({ isFile: () => true }),
    readFile: () => Buffer.from("test-ca"),
    X509CertificateClass: class {
      constructor() {
        this.validFrom = "2020-01-01T00:00:00Z";
        this.validTo = "2035-01-01T00:00:00Z";
        this.fingerprint256 = "TEST";
      }
    },
    now: new Date("2030-01-01T00:00:00Z"),
  };
  const ssl = verifiedTlsOptions(tlsOptions);
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.checkServerIdentity, tls.checkServerIdentity);
  assert.deepEqual(ssl.ca, Buffer.from("test-ca"));
  const config = postgresClientConfig({
    connectionString: "postgresql://user:secret@db.example.test/postgres?sslmode=verify-full",
    applicationName: "test",
    tlsOptions,
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.ok(!config.connectionString.includes("sslmode"));
  assert.throws(() => postgresClientConfig({ connectionString: config.connectionString, applicationName: "test", ssl: { rejectUnauthorized: false }, tlsOptions }), /may not override/);
});

test("migration reuses the approval ledger and permits only one retailer insert", () => {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  assert.match(sql, /alter table public\.approved_import_plans/);
  assert.match(sql, /validate_retailer_identity_bootstrap_plan/);
  assert.match(sql, /approve_retailer_identity_bootstrap/);
  assert.match(sql, /apply_approved_retailer_identity_bootstrap/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /create unique index retailers_normalized_slug_unique_idx/);
  assert.match(sql, /normalize\(p_value, NFKC\)/);
  assert.match(sql, /plan_kind in \('feed','manual','gtin_promotion','retailer_identity_bootstrap'\)/);
  assert.match(sql, /insert into public\.retailers\(name,slug,website\)/);
  const businessDml = [...sql.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+public\.([a-z_]+)/gi)].map((match) => match[1]);
  assert.deepEqual([...new Set(businessDml)].sort(), ["approved_import_plans", "retailers"]);
  assert.doesNotMatch(sql, /gladiator|shopify|woocommerce|\bekm\b/i);
});

test("rollback preserves evidence by blocking after any bootstrap approval", () => {
  const sql = fs.readFileSync(ROLLBACK, "utf8");
  assert.match(sql, /approval evidence exists/);
  assert.match(sql, /where plan_kind='retailer_identity_bootstrap'/);
  assert.match(sql, /plan_kind in \('feed','manual','gtin_promotion'\)/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.approved_import_plans/i);
});
