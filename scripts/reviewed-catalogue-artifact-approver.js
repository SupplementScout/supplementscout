const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadReviewedPackage } = require("./lib/reviewed-catalogue-package");
const {
  TARGETS,
  assertManifestTarget,
  clientConfig,
  parseCredential,
  roleTransaction,
  targetContract,
} = require("./lib/reviewed-catalogue-target");

const ROOT = path.resolve(__dirname, "..");
const APPROVAL_SQL = "select public.approve_reviewed_catalogue_import_plan($1::jsonb,$2,$3,$4,$5,now()+interval '15 minutes') result";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    const match = arg.match(/^--(target|manifest|manifest-sha256|profile|plan-fingerprint)=(.+)$/);
    invariant(match, "Unknown or incomplete reviewed catalogue argument");
    const key = match[1].replaceAll("-", "");
    invariant(values[key] === undefined, "Duplicate reviewed catalogue argument");
    values[key] = match[2];
  }
  invariant(Object.keys(values).length === 5, "Target, manifest, manifest SHA-256, profile and plan fingerprint are required");
  invariant(TARGETS[values.target], "Target must be staging or production");
  return {
    target: values.target,
    manifestPath: values.manifest.replaceAll("\\", "/"),
    manifestSha256: values.manifestsha256.toLowerCase(),
    profileId: values.profile,
    planFingerprint: values.planfingerprint.toLowerCase(),
  };
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

async function approveWithClient(prepared, client, target) {
  try {
    await client.connect();
    return await roleTransaction(client, target, "approver", async connection => {
      const response = await connection.query(APPROVAL_SQL, [prepared.entry.resolved_plan, prepared.profile.artifact_sha256, prepared.artifact.run_id, prepared.manifestSha256, prepared.profile.id]);
      const receipt = response.rows[0]?.result;
      verifyReceipt(receipt, prepared);
      return {
        approval_id: receipt.approval_id,
        expires_at: receipt.expires_at,
        plan_fingerprint: receipt.plan_fingerprint,
        product_id: prepared.entry.resolved_plan.product.id == null ? null : Number(prepared.entry.resolved_plan.product.id),
        product_variant_id: prepared.entry.resolved_plan.product_variant.id == null ? null : Number(prepared.entry.resolved_plan.product_variant.id),
        retailer_id: prepared.manifest.retailer.id,
        approval_only: true,
      };
    });
  } finally {
    await client.end().catch(() => {});
  }
}

async function runApproval(options) {
  const prepared = loadReviewedPackage({ root: ROOT, ...options });
  assertManifestTarget(prepared.manifest, options.target);
  prepared.manifestSha256 = options.manifestSha256;
  const contract = targetContract(options.target, "approver");
  const connectionString = parseCredential(options.target, "approver", fs.readFileSync(contract.credentialPath, "utf8"));
  const client = new Client(clientConfig(options.target, "approver", connectionString, { applicationName: `reviewed-catalogue-artifact-approver-${options.target}` }));
  return approveWithClient(prepared, client, options.target);
}

if (require.main === module) {
  Promise.resolve().then(() => runApproval(parseArgs(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => { console.error("Reviewed catalogue approval failed; credentials and database diagnostics suppressed."); process.exitCode = 1; });
}

module.exports = { APPROVAL_SQL, TARGETS, approveWithClient, parseArgs, parseCredential, runApproval, targetContract, verifyReceipt };
