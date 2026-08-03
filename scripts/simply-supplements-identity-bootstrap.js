const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { readProductionState } = require("./simply-supplements-approved-manifest");
const authorization = require("../config/retailers/simply-supplements-reviewed-change-authorization-2026-08-03.json");

const ROOT = path.resolve(__dirname, "..");

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function buildIdentityBootstrap(manifest, databaseRows, expectedCount = 120) {
  invariant(manifest?.manifest_fingerprint === authorization.manifest_fingerprint, "identity bootstrap manifest authority mismatch");
  invariant(manifest.approved_mapping_count === expectedCount && manifest.rows?.length === expectedCount, "identity bootstrap manifest coverage mismatch");
  invariant(Array.isArray(databaseRows) && databaseRows.length === expectedCount, "identity bootstrap database coverage mismatch");
  const state = new Map(databaseRows.map((row) => [String(row.mapping_id), row]));
  const rows = manifest.rows.map((approved) => {
    const current = state.get(String(approved.mapping_id));
    invariant(current && String(current.offer_id) === String(approved.offer_id), `identity bootstrap mapping/offer missing: ${approved.mapping_id}`);
    invariant(String(current.product_id) === String(approved.canonical_product_id) && String(current.product_variant_id) === String(approved.canonical_variant_id), `identity bootstrap canonical drift: ${approved.mapping_id}`);
    invariant(current.external_product_id == null && current.external_variant_id == null && current.external_sku == null, `identity bootstrap requires null legacy identity: ${approved.mapping_id}`);
    invariant(current.external_url === approved.external_url && current.url === approved.affiliate_url, `identity bootstrap URL split drift: ${approved.mapping_id}`);
    invariant(/^\d+$/.test(approved.external_product_id) && /^\d+$/.test(approved.external_variant_id) && approved.external_sku, `identity bootstrap approved source identity missing: ${approved.mapping_id}`);
    return {
      mapping_id: String(approved.mapping_id),
      offer_id: String(approved.offer_id),
      canonical_product_id: String(approved.canonical_product_id),
      canonical_variant_id: String(approved.canonical_variant_id),
      expected_mapping_updated_at: new Date(current.mapping_updated_at).toISOString(),
      expected_identity: { external_product_id: null, external_variant_id: null, external_sku: null },
      approved_identity: { external_product_id: approved.external_product_id, external_variant_id: approved.external_variant_id, external_sku: approved.external_sku },
      preserved_mapping_url: approved.external_url,
      preserved_offer_url: approved.affiliate_url,
      action: "UPDATE_MAPPING_IDENTITY_ONLY",
    };
  }).sort((left, right) => Number(left.mapping_id) - Number(right.mapping_id));
  for (const field of ["mapping_id", "offer_id"]) invariant(new Set(rows.map((row) => row[field])).size === expectedCount, `identity bootstrap duplicate ${field}`);
  for (const field of ["external_product_id", "external_variant_id", "external_sku"]) invariant(new Set(rows.map((row) => row.approved_identity[field])).size === expectedCount, `identity bootstrap duplicate ${field}`);
  const artifact = {
    schema_version: 1,
    kind: "simply-supplements-reviewed-identity-bootstrap-v1",
    state: "OWNER_APPROVAL_REQUIRED",
    retailer_id: 7,
    retailer_slug: "simply-supplements",
    target_environment: "PRODUCTION",
    target_project_ref: "aftboxmrdgyhizicfsfu",
    source_manifest_fingerprint: manifest.manifest_fingerprint,
    commercial_change_authorization: authorization.manifest_fingerprint,
    identity_update_authorized: false,
    row_count: rows.length,
    expected_deltas: {
      mapping_identity_updates: rows.length,
      mapping_updated_at_updates: rows.length,
      product_updates: 0,
      variant_updates: 0,
      mapping_url_updates: 0,
      offer_updates: 0,
      offer_url_updates: 0,
      price_history_inserts: 0,
      row_creates: 0,
      row_deletes: 0
    },
    rows,
  };
  artifact.artifact_fingerprint = sha256(artifact);
  return artifact;
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = arg.match(/^--(manifest|output)=(.+)$/);
    invariant(match && out[match[1]] === undefined, `invalid argument: ${arg}`);
    out[match[1]] = path.resolve(match[2]);
  }
  invariant(out.manifest && out.output, "required --manifest=<tmp/manifest.json> --output=<tmp/identity.json>");
  for (const file of [out.manifest, out.output]) {
    const relative = path.relative(path.join(ROOT, "tmp"), file);
    invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "identity bootstrap input/output must be inside tmp");
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  const state = await readProductionState();
  const artifact = buildIdentityBootstrap(manifest, state);
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(artifact, null, 2)}\n`);
  fs.writeFileSync(`${args.output}.sha256`, `${sha256(fs.readFileSync(args.output))}  ${path.basename(args.output)}\n`);
  console.log(JSON.stringify({ state: artifact.state, row_count: artifact.row_count, artifact_fingerprint: artifact.artifact_fingerprint, expected_deltas: artifact.expected_deltas, output: path.relative(ROOT, args.output).replaceAll("\\", "/") }));
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { buildIdentityBootstrap, parseArgs };
