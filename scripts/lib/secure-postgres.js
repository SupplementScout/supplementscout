const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { X509Certificate } = require("node:crypto");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeVerifiedConnectionString(value, label = "database") {
  invariant(value, `Missing protected ${label} database credential`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`Invalid protected ${label} database credential`); }
  invariant(["postgres:", "postgresql:"].includes(parsed.protocol), `Direct PostgreSQL ${label} credential required`);
  const modes = parsed.searchParams.getAll("sslmode");
  invariant(modes.length <= 1, "Duplicate sslmode is forbidden");
  if (modes.length === 1) invariant(modes[0].toLowerCase() === "verify-full", "PostgreSQL sslmode must be verify-full");
  parsed.searchParams.delete("sslmode");
  return parsed.href;
}

function loadTrustedRootCa(options = {}) {
  const env = options.env || process.env;
  const readFile = options.readFile || fs.readFileSync;
  const stat = options.stat || fs.statSync;
  const Certificate = options.X509CertificateClass || X509Certificate;
  const now = options.now || new Date();
  const caPath = env.PGSSLROOTCERT || env.SUPPLEMENTSCOUT_DATABASE_CA_CERT || env.NODE_EXTRA_CA_CERTS;
  invariant(typeof caPath === "string" && path.isAbsolute(caPath), "A trusted absolute PostgreSQL root CA path is required");
  invariant(stat(caPath).isFile(), "PostgreSQL root CA path must name a file");
  const ca = readFile(caPath);
  const certificate = new Certificate(ca);
  invariant(Date.parse(certificate.validFrom) <= now.getTime() && Date.parse(certificate.validTo) > now.getTime(), "PostgreSQL root CA is not currently valid");
  return { ca, caPath, fingerprint256: certificate.fingerprint256, validTo: certificate.validTo };
}

function verifiedTlsOptions(options = {}) {
  const trusted = loadTrustedRootCa(options);
  return { ca: trusted.ca, rejectUnauthorized: true, checkServerIdentity: tls.checkServerIdentity };
}

function postgresClientConfig(options) {
  const { connectionString, applicationName, defaultReadOnly = false, statementTimeoutMs = 120000,
    connectionTimeoutMillis = 15000, queryTimeoutMs = 120000, keepAlive = true, tlsOptions } = options;
  invariant(!options.ssl, "Callers may not override verified PostgreSQL TLS settings");
  return {
    connectionString: normalizeVerifiedConnectionString(connectionString),
    ssl: verifiedTlsOptions(tlsOptions),
    application_name: applicationName,
    connectionTimeoutMillis,
    query_timeout: queryTimeoutMs,
    keepAlive,
    options: `${defaultReadOnly ? "-c default_transaction_read_only=on " : ""}-c statement_timeout=${statementTimeoutMs}`,
  };
}

module.exports = { loadTrustedRootCa, normalizeVerifiedConnectionString, postgresClientConfig, verifiedTlsOptions };
