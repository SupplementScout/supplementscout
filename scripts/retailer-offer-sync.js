const fs = require("node:fs");
const path = require("node:path");
const { classifyExistingOffers } = require("./lib/retailer-offer-sync/classifier");
const { sealArtifact } = require("./lib/retailer-offer-sync/artifacts");
const { projectShopifyVariants } = require("./lib/shopify-snapshot-reader");

const MIGRATION_FINGERPRINT_ALGORITHM = "SHA-256";
const MIGRATION_FINGERPRINT_VERSION = "RSBI-CJ1";

function migrationBinding(input) {
  const versions = input.expectedMigrationVersions;
  const fingerprint = input.expectedMigrationFingerprint;
  if (!Array.isArray(versions) || versions.length < 1 || new Set(versions).size !== versions.length || versions.some((value) => !/^\d+_[a-z0-9_]+$/.test(value))) throw new Error("Expected migration versions are required and must be exact unique identifiers");
  if (!/^[0-9a-f]{64}$/.test(String(fingerprint || ""))) throw new Error("Expected migration fingerprint is required");
  if (input.migrationFingerprintAlgorithm !== MIGRATION_FINGERPRINT_ALGORITHM || input.migrationFingerprintVersion !== MIGRATION_FINGERPRINT_VERSION) throw new Error("Migration fingerprint algorithm/version mismatch");
  return { expected_migration_versions: [...versions], expected_migration_fingerprint: fingerprint, migration_fingerprint_algorithm: MIGRATION_FINGERPRINT_ALGORITHM, migration_fingerprint_version: MIGRATION_FINGERPRINT_VERSION };
}

function buildDryRun(input) {
  if (!input.sourceVariants && input.shopifySnapshot) input = { ...input, sourceVariants: projectShopifyVariants(input.shopifySnapshot, { shippingCost: input.shippingCost }) };
  const ledger = migrationBinding(input);
  const classification = classifyExistingOffers(input);
  return sealArtifact({
    kind: "retailer-existing-offer-mixed-batch", retailer_slug: input.retailerSlug, retailer_id: String(input.retailerId),
    target_environment: input.targetEnvironment, target_project_ref: input.targetProjectRef, target_database_identity: input.targetDatabaseIdentity,
    ...ledger,
    source_snapshot_fingerprint: input.sourceSnapshotFingerprint, adapter_fingerprint: input.adapterFingerprint,
    policy_fingerprint: input.policyFingerprint, code_commit: input.codeCommit, expected_state_fingerprint: input.expectedStateFingerprint,
    source_captured_at: input.sourceCapturedAt, state: classification.state, block: classification.state === "BLOCKED" ? classification : null,
    action_manifest_fingerprint: classification.action_manifest_fingerprint || null,
    expected_deltas: classification.expected_deltas || null, rows: classification.rows || [],
  });
}

function buildExecutionArtifact(dryRun, atomicPlansByOfferId) {
  if (dryRun.state !== "DRY_RUN_READY" || !atomicPlansByOfferId) throw new Error("Execution artifact requires a ready dry-run and exact atomic plans");
  return sealArtifact({
    ...Object.fromEntries(Object.entries(dryRun).filter(([key]) => !["artifact_fingerprint", "rows"].includes(key))),
    kind: "retailer-existing-offer-mixed-batch-execution",
    rows: dryRun.rows.map((row) => {
      const atomic_plan = atomicPlansByOfferId[String(row.offer_id)];
      if (!atomic_plan) throw new Error(`Missing atomic plan for offer ${row.offer_id}`);
      return { offer_id: row.offer_id, retailer_product_id: row.retailer_product_id, external_product_id: row.external_product_id, external_variant_id: row.external_variant_id, action: row.action, changed_fields: row.changed_fields, source_captured_at: row.source_captured_at, expected_deltas: row.expected_deltas, atomic_plan };
    }),
  });
}

async function executeApprovedBatch({ rpc, approvalId, executionFingerprint, artifact, requestedAt = new Date().toISOString() }) {
  if (typeof rpc !== "function") throw new Error("Approved apply requires an injected RPC transport");
  if (!approvalId || !/^[0-9a-f]{64}$/.test(String(executionFingerprint || "")) || artifact.kind !== "retailer-existing-offer-mixed-batch-execution" || artifact.state !== "DRY_RUN_READY" || !artifact.artifact_fingerprint || artifact.rows.some((row) => !row.atomic_plan)) throw new Error("Apply requires a sealed ready execution artifact, execution fingerprint and separate approval ID");
  return rpc("execute_retailer_offer_sync_batch", { p_request: { schema_version: 1, approval_id: approvalId, execution_fingerprint: executionFingerprint, staging_project_ref: artifact.target_project_ref, staging_database_identity: artifact.target_database_identity, expected_migration_versions: artifact.expected_migration_versions, expected_migration_fingerprint: artifact.expected_migration_fingerprint, migration_fingerprint_algorithm: artifact.migration_fingerprint_algorithm, migration_fingerprint_version: artifact.migration_fingerprint_version, requested_at: requestedAt, explicit_allow: true } });
}

function parseArgs(args) {
  const out = {};
  for (const arg of args) {
    if (arg.startsWith("--input=")) out.input = path.resolve(arg.slice(8));
    else if (arg.startsWith("--output=")) out.output = path.resolve(arg.slice(9));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.input || !out.output) throw new Error("Read-only dry-run requires --input and --output");
  const relative = path.relative(path.resolve("tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside tmp");
  return out;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const input = JSON.parse(fs.readFileSync(options.input, "utf8"));
    const artifact = buildDryRun(input);
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(JSON.stringify({ state: artifact.state, rows: artifact.rows.length, artifact_fingerprint: artifact.artifact_fingerprint }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { MIGRATION_FINGERPRINT_ALGORITHM, MIGRATION_FINGERPRINT_VERSION, buildDryRun, buildExecutionArtifact, executeApprovedBatch, migrationBinding, parseArgs };
