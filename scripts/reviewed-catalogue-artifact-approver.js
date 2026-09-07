const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadReviewedPackage } = require("./lib/reviewed-catalogue-package");

const ROOT = path.resolve(__dirname, "..");
const CREDENTIAL_PATH = path.join(
  process.env.USERPROFILE || "",
  ".supplementscout/credentials/production-approver.env",
);
const APPROVER_ROLE = "retailer_catalogue_production_approver";
const APPROVER_LOGIN = "supplementscout_production_approver_login";
const PROJECT_REF = "aftboxmrdgyhizicfsfu";
const APPROVAL_SQL = "select public.approve_reviewed_catalogue_import_plan($1::jsonb,$2,$3,$4,$5,now()+interval '15 minutes') result";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    const match = arg.match(/^--(manifest|manifest-sha256|profile|plan-fingerprint)=(.+)$/);
    invariant(match, "Unknown or incomplete reviewed catalogue argument");
    const key = match[1].replaceAll("-", "");
    invariant(values[key] === undefined, "Duplicate reviewed catalogue argument");
    values[key] = match[2];
  }
  invariant(Object.keys(values).length === 4, "Manifest, manifest SHA-256, profile and plan fingerprint are required");
  return {
    manifestPath: values.manifest.replaceAll("\\", "/"),
    manifestSha256: values.manifestsha256.toLowerCase(),
    profileId: values.profile,
    planFingerprint: values.planfingerprint.toLowerCase(),
  };
}

function parseCredential(text) {
  const entries = text.split(/\r?\n/).map(line => line.match(/^([A-Z0-9_]+_DATABASE_URL)=(.*)$/)).filter(Boolean);
  invariant(entries.length === 1, "Protected credential must contain exactly one database URL");
  let url;
  try { url = new URL(entries[0][2].trim().replace(/^(['"])(.*)\1$/, "$2")); } catch { throw new Error("Invalid protected credential"); }
  invariant(["postgres:", "postgresql:"].includes(url.protocol), "Direct PostgreSQL credential required");
  const login = decodeURIComponent(url.username);
  invariant((url.hostname === `db.${PROJECT_REF}.supabase.co` && login === APPROVER_LOGIN) || (/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && login === `${APPROVER_LOGIN}.${PROJECT_REF}` && url.port === "5432"), "Protected production approver endpoint/login required");
  invariant(url.pathname === "/postgres" && Boolean(url.password), "Protected approver database/password required");
  for (const key of url.searchParams.keys()) invariant(key === "sslmode", "Unexpected credential option");
  url.searchParams.delete("sslmode");
  return url.href;
}

function verifyReceipt(receipt, prepared, now = Date.now()) {
  invariant(receipt && /^[0-9a-f-]{36}$/i.test(receipt.approval_id || ""), "Invalid approval receipt");
  const expected = {
    status: "approved",
    artifact_sha256: prepared.profile.artifact_sha256,
    run_id: prepared.artifact.run_id,
    plan_fingerprint: prepared.entry.plan_fingerprint,
    source_row_fingerprint: prepared.entry.source_row_fingerprint,
    retailer_id: String(prepared.manifest.retailer.id),
    plan_kind: "feed",
  };
  for (const [key, value] of Object.entries(expected)) invariant(String(receipt[key]) === value, `Approval receipt ${key} mismatch`);
  const expiry = Date.parse(receipt.expires_at);
  invariant(expiry > now && expiry <= now + 16 * 60_000, "Invalid approval expiry");
}

async function approveWithClient(prepared, client) {
  let began = false;
  try {
    await client.connect();
    await client.query("begin");
    began = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`SET LOCAL ROLE ${APPROVER_ROLE}`);
    const identity = (await client.query("select current_user,session_user")).rows[0];
    invariant(identity.current_user === APPROVER_ROLE && identity.session_user === APPROVER_LOGIN, "Protected approver identity mismatch");
    const response = await client.query(APPROVAL_SQL, [prepared.entry.resolved_plan, prepared.profile.artifact_sha256, prepared.artifact.run_id, prepared.manifestSha256, prepared.profile.id]);
    const receipt = response.rows[0]?.result;
    verifyReceipt(receipt, prepared);
    await client.query("commit");
    began = false;
    return {
      approval_id: receipt.approval_id,
      expires_at: receipt.expires_at,
      plan_fingerprint: receipt.plan_fingerprint,
      product_id: prepared.entry.resolved_plan.product.id == null ? null : Number(prepared.entry.resolved_plan.product.id),
      product_variant_id: prepared.entry.resolved_plan.product_variant.id == null ? null : Number(prepared.entry.resolved_plan.product_variant.id),
      retailer_id: prepared.manifest.retailer.id,
      approval_only: true,
    };
  } catch (error) {
    if (began) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

async function runApproval(options) {
  const prepared = loadReviewedPackage({ root: ROOT, ...options });
  prepared.manifestSha256 = options.manifestSha256;
  const connectionString = parseCredential(fs.readFileSync(CREDENTIAL_PATH, "utf8"));
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, application_name: "reviewed-catalogue-artifact-approver", options: "-c statement_timeout=120000" });
  return approveWithClient(prepared, client);
}

if (require.main === module) {
  Promise.resolve().then(() => runApproval(parseArgs(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => { console.error("Reviewed catalogue approval failed; credentials and database diagnostics suppressed."); process.exitCode = 1; });
}

module.exports = { APPROVAL_SQL, APPROVER_LOGIN, APPROVER_ROLE, CREDENTIAL_PATH, approveWithClient, parseArgs, parseCredential, runApproval, verifyReceipt };
