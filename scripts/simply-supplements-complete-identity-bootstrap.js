const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const priorAuthorization = require("../config/retailers/simply-supplements-identity-bootstrap-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");
function invariant(value, message) { if (!value) throw new Error(message); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value)).digest("hex"); }
function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(identity|options|output)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument: ${argument}`);
    out[match[1]] = path.resolve(match[2]);
  }
  invariant(out.identity && out.options && out.output, "required --identity --options --output");
  for (const value of Object.values(out)) {
    const relative = path.relative(path.join(ROOT, "tmp"), value);
    invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "complete identity paths must be inside tmp");
  }
  return out;
}
function buildCompleteIdentity(identity, options) {
  invariant(identity.artifact_fingerprint === priorAuthorization.artifact_fingerprint && identity.row_count === 120, "prior identity artifact mismatch");
  invariant(options.kind === "simply-supplements-reviewed-options-audit-v1" && options.result === "PASS" && options.database_writes === 0 && options.row_count === 120 && options.source_identity_artifact_fingerprint === identity.artifact_fingerprint, "options audit authority mismatch");
  const byMapping = new Map(options.rows.map((row) => [String(row.mapping_id), row]));
  const rows = identity.rows.map((row) => {
    const option = byMapping.get(String(row.mapping_id));
    invariant(option && option.external_product_id === row.approved_identity.external_product_id && option.external_variant_id === row.approved_identity.external_variant_id && option.external_sku === row.approved_identity.external_sku, `complete identity drift ${row.mapping_id}`);
    return {
      ...row,
      expected_identity: { ...row.expected_identity, external_options: null },
      approved_identity: { ...row.approved_identity, external_options: option.external_options },
      action: "UPDATE_MAPPING_COMPLETE_EXTERNAL_IDENTITY_ONLY",
    };
  });
  const artifact = {
    schema_version: 2,
    kind: "simply-supplements-reviewed-complete-identity-bootstrap-v2",
    state: "OWNER_APPROVAL_REQUIRED",
    retailer_id: 7,
    retailer_slug: "simply-supplements",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    supersedes_artifact_fingerprint: identity.artifact_fingerprint,
    source_manifest_fingerprint: identity.source_manifest_fingerprint,
    source_options_audit_fingerprint: options.audit_fingerprint,
    identity_update_authorized: false,
    row_count: rows.length,
    expected_deltas: {
      mapping_identity_updates: 120,
      mapping_external_options_updates: 120,
      mapping_updated_at_updates: 120,
      product_updates: 0,
      variant_updates: 0,
      mapping_url_updates: 0,
      offer_updates: 0,
      offer_url_updates: 0,
      price_history_inserts: 0,
      row_creates: 0,
      row_deletes: 0,
    },
    rows,
  };
  artifact.artifact_fingerprint = sha256(artifact);
  return artifact;
}
function run(options) {
  const identity = JSON.parse(fs.readFileSync(options.identity, "utf8"));
  const optionAudit = JSON.parse(fs.readFileSync(options.options, "utf8"));
  const artifact = buildCompleteIdentity(identity, optionAudit);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  const fileSha256 = sha256(fs.readFileSync(options.output));
  fs.writeFileSync(`${options.output}.sha256`, `${fileSha256}\n`, { flag: "wx" });
  return { artifact, fileSha256 };
}
if (require.main === module) {
  try {
    const result = run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ state: result.artifact.state, rows: result.artifact.row_count, artifact_fingerprint: result.artifact.artifact_fingerprint, artifact_file_sha256: result.fileSha256, expected_deltas: result.artifact.expected_deltas }, null, 2));
  } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { buildCompleteIdentity, parseArgs };
