const {
  assertArtifactKind,
  assertContext,
  assertEnvironment,
  assertSha256,
  fail,
  sanitizeFilename,
  sha256,
} = require("./contract");
const { isDeepStrictEqual } = require("node:util");

const ROLLOUT_CONTROL = "DURABLE_SEALED_ARTIFACTS_ENFORCEMENT";
const CONTRACT_FIELD = "durable_sealed_artifact_contract";
const CONTRACT_VERSION = 1;
const DURABLE_REQUIRED = new Set([
  "SOURCE_EVIDENCE",
  "REVIEW_REGISTRATION",
  "APPROVED_PLAN",
  "APPLY_AUDIT",
  "PRODUCTION_CLOSEOUT",
  "CONTROL_EVIDENCE",
  "RECOVERY_MANIFEST",
]);
const DURABLE_RECOMMENDED = new Set([
  "PREPARED_SCOPE",
  "AUTOMATION_DIAGNOSTIC",
  "HISTORICAL_DOC",
]);

function rolloutState(env = process.env) {
  const raw = String(env?.[ROLLOUT_CONTROL] || "").trim();
  if (!raw || raw === "OFF") return Object.freeze({ enabled: false, value: "OFF" });
  if (raw === "ON") return Object.freeze({ enabled: true, value: "ON" });
  fail("INVALID_DURABLE_ROLLOUT_CONTROL", `${ROLLOUT_CONTROL} must be ON, OFF, or absent`);
}

function policyFor(artifactKind) {
  const kind = assertArtifactKind(artifactKind);
  if (DURABLE_REQUIRED.has(kind)) return "DURABLE_REQUIRED";
  if (DURABLE_RECOMMENDED.has(kind)) return "DURABLE_RECOMMENDED";
  fail("DURABLE_POLICY_MISSING", `artifact kind ${kind} has no Phase B rollout policy`);
}

function exactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, "durable artifact contract must be an object");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(code, "durable artifact contract fields are invalid");
}

function validateContract(raw) {
  exactKeys(raw, [
    "artifact_fingerprint",
    "artifact_kind",
    "contains_secrets",
    "content_type",
    "environment",
    "filename",
    "git_sha",
    "producer",
    "requirement",
    "run_id",
    "schema_version",
    "version",
  ], "INVALID_DURABLE_ARTIFACT_CONTRACT");
  if (raw.version !== CONTRACT_VERSION) fail("UNSUPPORTED_DURABLE_ARTIFACT_CONTRACT", "durable artifact contract version is unsupported");
  const artifactKind = assertArtifactKind(raw.artifact_kind);
  if (policyFor(artifactKind) !== "DURABLE_REQUIRED" || raw.requirement !== "DURABLE_REQUIRED") {
    fail("INVALID_DURABLE_ARTIFACT_REQUIREMENT", "only durable-required artifacts may use the enforcement contract");
  }
  if (raw.contains_secrets !== false) fail("SECRET_DECLARATION_REQUIRED", "durable contract must explicitly declare no secrets");
  if (!Number.isInteger(raw.schema_version) || raw.schema_version < 1 || raw.schema_version > 999) {
    fail("INVALID_SCHEMA_VERSION", "durable artifact schema version is invalid");
  }
  if (!/^[0-9a-f]{40}$/.test(raw.git_sha || "")) fail("INVALID_GIT_SHA", "durable contract git SHA is invalid");
  if (raw.content_type !== "application/json") fail("UNSUPPORTED_CONTENT_TYPE", "Phase B integrated artifacts must be exact JSON bytes");
  return Object.freeze({
    version: CONTRACT_VERSION,
    requirement: "DURABLE_REQUIRED",
    artifact_kind: artifactKind,
    environment: assertEnvironment(raw.environment),
    filename: sanitizeFilename(raw.filename),
    content_type: raw.content_type,
    schema_version: raw.schema_version,
    producer: assertContext(raw.producer, "producer"),
    git_sha: raw.git_sha,
    run_id: raw.run_id === null ? null : assertContext(raw.run_id, "run_id"),
    artifact_fingerprint: raw.artifact_fingerprint === null ? null : assertSha256(raw.artifact_fingerprint, "artifact_fingerprint"),
    contains_secrets: false,
  });
}

function contractFor(metadata) {
  if (!metadata || typeof metadata !== "object") fail("DURABLE_CONTRACT_METADATA_REQUIRED", "durable contract metadata is required");
  const artifactKind = assertArtifactKind(metadata.artifactKind);
  if (policyFor(artifactKind) !== "DURABLE_REQUIRED") return null;
  return validateContract({
    version: CONTRACT_VERSION,
    requirement: "DURABLE_REQUIRED",
    artifact_kind: artifactKind,
    environment: metadata.environment,
    filename: metadata.filename,
    content_type: "application/json",
    schema_version: metadata.schemaVersion,
    producer: metadata.producer,
    git_sha: metadata.gitSha,
    run_id: metadata.runId ?? null,
    artifact_fingerprint: metadata.artifactFingerprint ?? null,
    contains_secrets: false,
  });
}

function bindDurableArtifactContract(artifact, metadata, env = process.env) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    fail("INVALID_DURABLE_ARTIFACT", "durable artifact must be a JSON object");
  }
  if (Object.hasOwn(artifact, CONTRACT_FIELD)) {
    validateContract(artifact[CONTRACT_FIELD]);
    return artifact;
  }
  if (!rolloutState(env).enabled) return artifact;
  const contract = contractFor(metadata);
  if (!contract) return artifact;
  return { ...artifact, [CONTRACT_FIELD]: contract };
}

function durableContractOf(artifact) {
  if (!artifact || typeof artifact !== "object" || !Object.hasOwn(artifact, CONTRACT_FIELD)) return null;
  return validateContract(artifact[CONTRACT_FIELD]);
}

function assertVerifiedIdentity(sealed, verified, contract, expectedSha256) {
  if (sealed?.status !== "DURABLY_SEALED" || verified?.status !== "DURABLY_SEALED") {
    fail("DURABLE_VERIFICATION_FAILED", "seal and fresh verification must both report DURABLY_SEALED");
  }
  const first = sealed.artifact;
  const fresh = verified.artifact;
  if (!first || !fresh || first.durable_uri !== fresh.durable_uri || first.sha256 !== fresh.sha256 || fresh.sha256 !== expectedSha256) {
    fail("DURABLE_VERIFICATION_FAILED", "fresh durable identity differs from sealed identity");
  }
  if (fresh.environment !== contract.environment || fresh.artifact_kind !== contract.artifact_kind) {
    fail("DURABLE_VERIFICATION_FAILED", "fresh durable identity differs from the artifact contract");
  }
  return Object.freeze({ status: "DURABLY_SEALED", artifact: fresh });
}

async function guardDependentMutation(options) {
  if (!options || typeof options.mutation !== "function") fail("DEPENDENT_MUTATION_REQUIRED", "dependent mutation callback is required");
  const contract = durableContractOf(options.artifact);
  if (!contract) return options.mutation(Object.freeze({ legacy: true, durableIdentity: null }));
  if (options.expectedArtifactKind && contract.artifact_kind !== options.expectedArtifactKind) {
    fail("ARTIFACT_KIND_MISMATCH", "durable contract kind differs from the mutation boundary");
  }
  if (options.expectedEnvironment && contract.environment !== options.expectedEnvironment) {
    fail("CROSS_ENVIRONMENT_ARTIFACT", "durable contract belongs to another environment");
  }
  if (!Buffer.isBuffer(options.exactBytes)) {
    fail("DURABLE_ARTIFACT_BYTES_REQUIRED", "bound artifacts require their exact original bytes");
  }
  let parsedExactArtifact;
  try {
    parsedExactArtifact = JSON.parse(options.exactBytes.toString("utf8"));
  } catch {
    fail("DURABLE_ARTIFACT_BYTES_INVALID", "bound artifact bytes must contain exact JSON");
  }
  if (!isDeepStrictEqual(parsedExactArtifact, options.artifact)) {
    fail("DURABLE_ARTIFACT_BYTES_MISMATCH", "bound artifact object differs from its exact original bytes");
  }
  if (typeof options.serviceFactory !== "function") {
    fail("DURABLE_SERVICE_REQUIRED", "bound artifacts require a sealed-artifacts service");
  }
  const service = await options.serviceFactory();
  if (!service || typeof service.seal !== "function" || typeof service.verify !== "function") {
    fail("DURABLE_SERVICE_REQUIRED", "sealed-artifacts service is incomplete");
  }
  const sealed = await service.seal({
    environment: contract.environment,
    artifactKind: contract.artifact_kind,
    filename: contract.filename,
    contentType: contract.content_type,
    bytes: options.exactBytes,
    containsSecrets: false,
    schemaVersion: contract.schema_version,
    producer: contract.producer,
    gitSha: contract.git_sha,
    runId: contract.run_id,
    artifactFingerprint: contract.artifact_fingerprint,
  });
  const verified = await service.verify({
    environment: contract.environment,
    artifactKind: contract.artifact_kind,
    durableUri: sealed?.artifact?.durable_uri,
  });
  const durableIdentity = assertVerifiedIdentity(sealed, verified, contract, sha256(options.exactBytes));
  return options.mutation(Object.freeze({ legacy: false, durableIdentity }));
}

module.exports = {
  CONTRACT_FIELD,
  CONTRACT_VERSION,
  ROLLOUT_CONTROL,
  bindDurableArtifactContract,
  durableContractOf,
  guardDependentMutation,
  policyFor,
  rolloutState,
  validateContract,
};
