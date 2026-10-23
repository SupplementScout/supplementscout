const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const tls = require("node:tls");
const { X509Certificate } = require("node:crypto");
const {
  BUNDLED_SUPABASE_CA,
  DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
  DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
  DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
  SUPABASE_ROOT_CA_FINGERPRINT,
  isApprovedSupabaseHostname,
  normalizeVerifiedConnectionString,
  postgresClientConfig,
} = require("./lib/secure-postgres");

const ROOT = path.resolve(__dirname, "..");
const SUPABASE_URL = "postgresql://user:secret@db.abcdefghijklmnopqrst.supabase.co/postgres";
const LIVE_POSTGRES_SURFACES = [
  "scripts/lib/retailer-offer-sync/production-role-session.js",
  "scripts/fit-house-offer-refresh.js",
  "scripts/jons-offer-refresh.js",
  "scripts/whey-okay-offer-refresh.js",
  "scripts/ebay-offer-canary-executor.js",
  "scripts/gym-high-full-catalogue-executor.js",
  "scripts/six-pack-offer-refresh-executor.js",
  "scripts/verify-selected-migrations.js",
];

test("verify-full, legacy require and absent sslmode all become the same verified TLS configuration", () => {
  for (const suffix of ["?sslmode=verify-full", "?sslmode=require", ""]) {
    const config = postgresClientConfig({ connectionString: `${SUPABASE_URL}${suffix}`, applicationName: "contract-test" });
    assert.doesNotMatch(config.connectionString, /sslmode/i);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.checkServerIdentity, tls.checkServerIdentity);
    const certificate = new X509Certificate(config.ssl.ca);
    assert.equal(certificate.fingerprint256, SUPABASE_ROOT_CA_FINGERPRINT);
    assert.match(certificate.subject, /CN=Supabase Root 2021 CA/);
    assert.equal(certificate.issuer, certificate.subject);
  }
});

test("shared PostgreSQL timeout defaults remain exact and observable", () => {
  assert.equal(DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS, 15000);
  assert.equal(DEFAULT_POSTGRES_QUERY_TIMEOUT_MS, 120000);
  assert.equal(DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS, 120000);
  const config = postgresClientConfig({ connectionString: SUPABASE_URL, applicationName: "timeout-contract-test" });
  assert.equal(config.connectionTimeoutMillis, DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS);
  assert.equal(config.query_timeout, DEFAULT_POSTGRES_QUERY_TIMEOUT_MS);
  assert.match(config.options, new RegExp(`statement_timeout=${DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS}`));
});

test("insecure, hostname-weaker and unknown sslmode inputs fail closed", () => {
  for (const mode of ["disable", "allow", "prefer", "no-verify", "verify-ca", "unknown"]) {
    assert.throws(() => normalizeVerifiedConnectionString(`${SUPABASE_URL}?sslmode=${mode}`), /insecure or unsupported/);
  }
  assert.throws(() => normalizeVerifiedConnectionString(`${SUPABASE_URL}?sslmode=require&sslmode=verify-full`), /Duplicate/);
});

test("bundled CA is limited to generic Supabase database and pooler hostnames", () => {
  assert.equal(isApprovedSupabaseHostname("db.abcdefghijklmnopqrst.supabase.co"), true);
  assert.equal(isApprovedSupabaseHostname("aws-0-eu-west-2.pooler.supabase.com"), true);
  for (const host of ["example.com", "supabase.com", "db.example.supabase.co", "evil-supabase.co"]) {
    assert.equal(isApprovedSupabaseHostname(host), false);
    assert.throws(() => postgresClientConfig({ connectionString: `postgresql://user:secret@${host}/postgres`, applicationName: "contract-test", tlsOptions: { env: {} } }), /trusted absolute PostgreSQL root CA/);
  }
  assert.equal(path.resolve(BUNDLED_SUPABASE_CA), path.resolve(ROOT, "config/certs/supabase-root-ca.crt"));
});

test("wrong Supabase CA and wrong hostname both fail closed", () => {
  const tlsOptions = {
    env: { PGSSLROOTCERT: path.resolve("wrong", "root.crt") },
    stat: () => ({ isFile: () => true }),
    readFile: () => Buffer.from("wrong-ca"),
    X509CertificateClass: class {
      constructor() {
        this.validFrom = "2020-01-01T00:00:00Z";
        this.validTo = "2035-01-01T00:00:00Z";
        this.fingerprint256 = "WRONG";
        this.subject = "CN=Wrong CA";
        this.issuer = this.subject;
      }
    },
    now: new Date("2030-01-01T00:00:00Z"),
  };
  assert.throws(() => postgresClientConfig({ connectionString: SUPABASE_URL, applicationName: "contract-test", tlsOptions }), /fingerprint mismatch/);
  assert.ok(tls.checkServerIdentity("wrong.example", { subjectaltname: "DNS:db.example" }) instanceof Error);
  assert.equal(tls.checkServerIdentity("db.example", { subjectaltname: "DNS:db.example" }), undefined);
});

test("bundled public CA is current, pinned and contains no private key", () => {
  const bytes = fs.readFileSync(BUNDLED_SUPABASE_CA);
  const text = bytes.toString("utf8");
  const certificate = new X509Certificate(bytes);
  assert.equal(certificate.fingerprint256, SUPABASE_ROOT_CA_FINGERPRINT);
  assert.ok(Date.parse(certificate.validFrom) <= Date.now());
  assert.ok(Date.parse(certificate.validTo) > Date.now());
  assert.doesNotMatch(text, /PRIVATE KEY|DATABASE_URL|PASSWORD/i);
});

test("all live scheduled PostgreSQL surfaces delegate TLS policy to the shared helper", () => {
  for (const relative of LIVE_POSTGRES_SURFACES) {
    const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/, relative);
    assert.doesNotMatch(source, /\bssl\s*:/, relative);
    if (relative.endsWith("production-role-session.js")) assert.match(source, /postgresClientConfig/, relative);
    else assert.match(source, /secure-postgres|production-role-session/, relative);
  }
});
