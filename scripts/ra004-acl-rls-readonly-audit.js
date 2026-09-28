#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { runAclRlsMetadataAudit } = require("./lib/retailer-offer-sync/ra004-bounded-live-transport-v1");

const PROJECT_REFERENCE = "hxnrsyyqffztlvcrtgbf";
const EXPECTED_CA_FINGERPRINT = "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function validateLocalCa(caPath) {
  if (!caPath || !path.isAbsolute(caPath) || !fs.statSync(caPath).isFile()) {
    fail("RA004_CA_CONFIGURATION_MISSING", "NODE_EXTRA_CA_CERTS must name the downloaded official CA file");
  }
  const certificate = new crypto.X509Certificate(fs.readFileSync(caPath));
  if (certificate.fingerprint256 !== EXPECTED_CA_FINGERPRINT
      || certificate.subject !== "C=US\nST=Delware\nL=New Castle\nO=Supabase Inc\nCN=Supabase Root 2021 CA") {
    fail("RA004_CA_CONFIGURATION_MISMATCH", "official Supabase Root 2021 CA fingerprint or subject differs");
  }
  return { fingerprint256: certificate.fingerprint256, valid_to: certificate.validTo };
}

async function main() {
  const outputFlag = process.argv.indexOf("--output");
  const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : "";
  if (!outputPath || !path.isAbsolute(outputPath)) fail("RA004_AUDIT_OUTPUT_BLOCKED", "absolute output path required");
  const ca = validateLocalCa(process.env.NODE_EXTRA_CA_CERTS);
  const databaseUrl = process.env.RA004_STAGING_DATABASE_URL;
  delete process.env.RA004_STAGING_DATABASE_URL;
  if (!databaseUrl) fail("RA004_AUDIT_CREDENTIAL_MISSING", "masked staging database URL was not supplied");
  const result = await runAclRlsMetadataAudit({
    databaseUrl,
    projectReference: PROJECT_REFERENCE,
    expectedSessionUser: "postgres",
  });
  const report = {
    schema_version: "ra004-acl-rls-readonly-audit-v1",
    status: "RA004_ACL_RLS_READONLY_AUDIT_COMPLETE",
    project_reference: PROJECT_REFERENCE,
    transaction: "REPEATABLE READ READ ONLY",
    connection_attempts: 1,
    retries: 0,
    ca,
    metadata: result.data,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: report.status, output: outputPath, connection_attempts: 1, retries: 0 })}\n`);
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error.code || "RA004_ACL_RLS_AUDIT_FAILED"}: ${String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")}\n`);
  process.exitCode = 1;
});

module.exports = { EXPECTED_CA_FINGERPRINT, validateLocalCa };
