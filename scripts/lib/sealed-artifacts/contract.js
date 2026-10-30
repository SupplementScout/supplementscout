const crypto = require("node:crypto");

const BUCKET = "sealed-artifacts";
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const SAFE_CONTEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

const ARTIFACT_POLICIES = Object.freeze({
  SOURCE_EVIDENCE: "PERMANENT",
  PREPARED_SCOPE: "LONG_TERM",
  REVIEW_REGISTRATION: "PERMANENT",
  APPROVED_PLAN: "PERMANENT",
  APPLY_AUDIT: "PERMANENT",
  PRODUCTION_CLOSEOUT: "PERMANENT",
  CONTROL_EVIDENCE: "PERMANENT",
  RECOVERY_MANIFEST: "PERMANENT",
  AUTOMATION_DIAGNOSTIC: "LONG_TERM",
  HISTORICAL_DOC: "LONG_TERM",
});

const TEMPORARY_ARTIFACT_KINDS = new Set(["TEMPORARY_DEBUG"]);
const ENVIRONMENTS = new Set(["staging", "production", "test"]);
const CONTENT_TYPES = Object.freeze({
  "application/json": new Set([".json"]),
  "application/x-ndjson": new Set([".ndjson"]),
  "application/sql": new Set([".sql"]),
  "text/csv": new Set([".csv"]),
  "text/markdown": new Set([".md"]),
  "text/plain": new Set([".txt", ".log"]),
});

class SealedArtifactError extends Error {
  constructor(code, message = code, options = {}) {
    super(message, options);
    this.name = "SealedArtifactError";
    this.code = code;
  }
}

function fail(code, message = code, options) {
  throw new SealedArtifactError(code, message, options);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertSha256(value, field = "sha256") {
  if (!SHA256_PATTERN.test(value || "")) fail("INVALID_SHA256", `${field} must be a lowercase SHA-256 digest`);
  return value;
}

function assertEnvironment(value) {
  if (!ENVIRONMENTS.has(value)) fail("UNSUPPORTED_ENVIRONMENT", "environment must be staging, production, or test");
  return value;
}

function assertArtifactKind(value) {
  if (TEMPORARY_ARTIFACT_KINDS.has(value)) {
    fail("TEMPORARY_ARTIFACT_NOT_SEALABLE", "temporary-only artifacts cannot be durably sealed");
  }
  if (!Object.hasOwn(ARTIFACT_POLICIES, value)) fail("UNSUPPORTED_ARTIFACT_KIND", "artifact kind is not allowlisted");
  return value;
}

function artifactKindSegment(artifactKind) {
  return assertArtifactKind(artifactKind).toLowerCase();
}

function artifactKindFromSegment(segment) {
  const artifactKind = String(segment || "").toUpperCase();
  if (artifactKindSegment(artifactKind) !== segment) fail("INVALID_DURABLE_URI", "durable URI artifact kind is invalid");
  return artifactKind;
}

function sanitizeFilename(value) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    fail("UNSAFE_FILENAME", "filename is required");
  }
  const trimmed = value.trim();
  if (trimmed === "." || trimmed === ".." || /[\\/]/.test(trimmed)) {
    fail("PATH_TRAVERSAL_BLOCKED", "filename must not contain a path");
  }
  const sanitized = trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
  if (!SAFE_FILENAME_PATTERN.test(sanitized)) {
    fail("UNSAFE_FILENAME", "filename cannot be represented by the sealed artifact path contract");
  }
  return sanitized;
}

function extensionOf(filename) {
  const index = filename.lastIndexOf(".");
  return index > 0 ? filename.slice(index).toLowerCase() : "";
}

function assertContentType(value, filename) {
  const extensions = CONTENT_TYPES[value];
  if (!extensions) fail("UNSUPPORTED_CONTENT_TYPE", "content type is not allowlisted");
  if (!extensions.has(extensionOf(filename))) {
    fail("CONTENT_TYPE_FILENAME_MISMATCH", "filename extension does not match content type");
  }
  return value;
}

function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("INVALID_TEXT_ENCODING", "text artifacts must contain valid UTF-8");
  }
}

function detectCredentialMaterial(text) {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\bsb_secret_[A-Za-z0-9_-]+\b/,
    /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@/i,
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    /["']?(?:password|api[_-]?key|secret[_-]?key|service[_-]?role[_-]?key)["']?\s*[:=]\s*["'][^"']{8,}["']/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function assertArtifactBytes(bytes, contentType, containsSecrets) {
  if (containsSecrets !== false) {
    fail(
      containsSecrets === true ? "SECRET_ARTIFACT_REJECTED" : "SECRET_DECLARATION_REQUIRED",
      "callers must explicitly declare that the artifact contains no secrets",
    );
  }
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) fail("INVALID_ARTIFACT_BYTES", "bytes must be binary data");
  const exactBytes = Buffer.from(bytes);
  if (exactBytes.length === 0) fail("EMPTY_ARTIFACT_REJECTED", "empty artifacts cannot be sealed");
  if (exactBytes.length > MAX_ARTIFACT_BYTES) fail("ARTIFACT_TOO_LARGE", `artifact exceeds ${MAX_ARTIFACT_BYTES} bytes`);
  const text = decodeUtf8(exactBytes);
  if (detectCredentialMaterial(text)) fail("CREDENTIAL_MATERIAL_DETECTED", "artifact resembles credential material");
  if (contentType === "application/json") {
    try {
      JSON.parse(text);
    } catch {
      fail("MALFORMED_ARTIFACT", "application/json artifact is invalid JSON");
    }
  }
  if (contentType === "application/x-ndjson") {
    try {
      for (const line of text.split(/\r?\n/).filter(Boolean)) JSON.parse(line);
    } catch {
      fail("MALFORMED_ARTIFACT", "application/x-ndjson artifact contains an invalid line");
    }
  }
  return exactBytes;
}

function assertSchemaVersion(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) fail("INVALID_SCHEMA_VERSION", "schema version must be an integer from 1 to 999");
  return value;
}

function assertContext(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== "string" || !SAFE_CONTEXT_PATTERN.test(value)) fail("INVALID_ARTIFACT_METADATA", `${field} is invalid`);
  return value;
}

function assertOptionalDigest(value, field) {
  if (value === null || value === undefined) return null;
  return assertSha256(value, field);
}

function buildObjectPath({ environment, artifactKind, sha256: digest, filename }) {
  return `${assertEnvironment(environment)}/${artifactKindSegment(artifactKind)}/${assertSha256(digest)}/${sanitizeFilename(filename)}`;
}

function buildDurableUri(identity) {
  return `supabase-storage://${BUCKET}/${buildObjectPath(identity)}`;
}

function parseDurableUri(value) {
  const prefix = `supabase-storage://${BUCKET}/`;
  if (typeof value !== "string" || !value.startsWith(prefix)) fail("INVALID_DURABLE_URI", "durable URI must reference the private sealed-artifacts bucket");
  const path = value.slice(prefix.length);
  const segments = path.split("/");
  if (segments.length !== 4 || segments.some((segment) => !segment)) fail("INVALID_DURABLE_URI", "durable URI path is malformed");
  const [environment, artifactKindPath, digest, rawFilename] = segments;
  const artifactKind = artifactKindFromSegment(artifactKindPath);
  const filename = sanitizeFilename(rawFilename);
  const parsed = {
    bucket: BUCKET,
    environment: assertEnvironment(environment),
    artifactKind,
    sha256: assertSha256(digest),
    filename,
    objectPath: path,
  };
  if (buildDurableUri(parsed) !== value) fail("INVALID_DURABLE_URI", "durable URI is not canonical");
  return Object.freeze(parsed);
}

function validateSealInput(input) {
  if (!input || typeof input !== "object") fail("INVALID_ARTIFACT_METADATA", "seal input is required");
  const environment = assertEnvironment(input.environment);
  const artifactKind = assertArtifactKind(input.artifactKind);
  const filename = sanitizeFilename(input.filename);
  const contentType = assertContentType(input.contentType, filename);
  const bytes = assertArtifactBytes(input.bytes, contentType, input.containsSecrets);
  const schemaVersion = assertSchemaVersion(input.schemaVersion);
  const producer = assertContext(input.producer, "producer");
  if (!GIT_SHA_PATTERN.test(input.gitSha || "")) fail("INVALID_GIT_SHA", "gitSha must be a lowercase 40-character commit SHA");
  const digest = sha256(bytes);
  const retentionClass = ARTIFACT_POLICIES[artifactKind];
  const identity = {
    environment,
    artifactKind,
    sha256: digest,
    filename,
  };
  return Object.freeze({
    bytes,
    artifactKind,
    schemaVersion,
    sha256: digest,
    durableUri: buildDurableUri(identity),
    objectPath: buildObjectPath(identity),
    filename,
    byteSize: bytes.length,
    contentType,
    producer,
    environment,
    gitSha: input.gitSha,
    retentionClass,
    artifactFingerprint: assertOptionalDigest(input.artifactFingerprint, "artifactFingerprint"),
    runId: assertContext(input.runId, "runId", { optional: true }),
    parentArtifactSha: assertOptionalDigest(input.parentArtifactSha, "parentArtifactSha"),
    targetScopeFingerprint: assertOptionalDigest(input.targetScopeFingerprint, "targetScopeFingerprint"),
  });
}

function recordFromValidatedInput(input) {
  return {
    artifact_kind: input.artifactKind,
    schema_version: input.schemaVersion,
    sha256: input.sha256,
    durable_uri: input.durableUri,
    filename: input.filename,
    byte_size: input.byteSize,
    content_type: input.contentType,
    producer: input.producer,
    environment: input.environment,
    git_sha: input.gitSha,
    retention_class: input.retentionClass,
    artifact_fingerprint: input.artifactFingerprint,
    run_id: input.runId,
    parent_artifact_sha: input.parentArtifactSha,
    target_scope_fingerprint: input.targetScopeFingerprint,
  };
}

function objectMetadataFromRecord(record) {
  const metadata = {
    sha256: record.sha256,
    environment: record.environment,
    artifact_kind: record.artifact_kind,
    schema_version: String(record.schema_version),
    byte_size: String(record.byte_size),
    content_type: record.content_type,
    filename: record.filename,
    producer: record.producer,
    git_sha: record.git_sha,
    retention_class: record.retention_class,
    immutable: "true",
  };
  for (const field of ["artifact_fingerprint", "run_id", "parent_artifact_sha", "target_scope_fingerprint"]) {
    if (record[field] !== null && record[field] !== undefined) metadata[field] = String(record[field]);
  }
  return Object.freeze(metadata);
}

function normalizeOptional(value) {
  return value === undefined ? null : value;
}

function validateRegistryRecord(record) {
  if (!record || typeof record !== "object") fail("REGISTRY_RECORD_INVALID", "sealed artifact registry row is missing");
  const artifactKind = assertArtifactKind(record.artifact_kind);
  const environment = assertEnvironment(record.environment);
  const filename = sanitizeFilename(record.filename);
  const contentType = assertContentType(record.content_type, filename);
  const schemaVersion = assertSchemaVersion(record.schema_version);
  const digest = assertSha256(record.sha256);
  if (!Number.isInteger(Number(record.byte_size)) || Number(record.byte_size) < 1 || Number(record.byte_size) > MAX_ARTIFACT_BYTES) {
    fail("REGISTRY_RECORD_INVALID", "registry byte size is invalid");
  }
  const producer = assertContext(record.producer, "producer");
  if (!GIT_SHA_PATTERN.test(record.git_sha || "")) fail("REGISTRY_RECORD_INVALID", "registry git SHA is invalid");
  if (record.retention_class !== ARTIFACT_POLICIES[artifactKind]) fail("REGISTRY_RECORD_INVALID", "registry retention class conflicts with artifact kind");
  const uri = parseDurableUri(record.durable_uri);
  if (uri.environment !== environment || uri.artifactKind !== artifactKind || uri.sha256 !== digest || uri.filename !== filename) {
    fail("REGISTRY_URI_MISMATCH", "registry durable URI conflicts with immutable identity fields");
  }
  if (record.created_at !== undefined && Number.isNaN(Date.parse(record.created_at))) {
    fail("REGISTRY_RECORD_INVALID", "registry created_at is invalid");
  }
  return Object.freeze({
    ...record,
    artifact_kind: artifactKind,
    schema_version: schemaVersion,
    sha256: digest,
    durable_uri: record.durable_uri,
    filename,
    byte_size: Number(record.byte_size),
    content_type: contentType,
    producer,
    environment,
    git_sha: record.git_sha,
    retention_class: record.retention_class,
    artifact_fingerprint: assertOptionalDigest(normalizeOptional(record.artifact_fingerprint), "artifact_fingerprint"),
    run_id: assertContext(normalizeOptional(record.run_id), "run_id", { optional: true }),
    parent_artifact_sha: assertOptionalDigest(normalizeOptional(record.parent_artifact_sha), "parent_artifact_sha"),
    target_scope_fingerprint: assertOptionalDigest(normalizeOptional(record.target_scope_fingerprint), "target_scope_fingerprint"),
  });
}

function immutableRecordProjection(record) {
  const valid = validateRegistryRecord(record);
  return {
    artifact_kind: valid.artifact_kind,
    schema_version: valid.schema_version,
    sha256: valid.sha256,
    durable_uri: valid.durable_uri,
    filename: valid.filename,
    byte_size: valid.byte_size,
    content_type: valid.content_type,
    producer: valid.producer,
    environment: valid.environment,
    git_sha: valid.git_sha,
    retention_class: valid.retention_class,
    artifact_fingerprint: valid.artifact_fingerprint,
    run_id: valid.run_id,
    parent_artifact_sha: valid.parent_artifact_sha,
    target_scope_fingerprint: valid.target_scope_fingerprint,
  };
}

function sameImmutableRecord(left, right) {
  return JSON.stringify(immutableRecordProjection(left)) === JSON.stringify(immutableRecordProjection(right));
}

module.exports = {
  ARTIFACT_POLICIES,
  BUCKET,
  CONTENT_TYPES,
  ENVIRONMENTS,
  MAX_ARTIFACT_BYTES,
  SealedArtifactError,
  artifactKindSegment,
  assertArtifactBytes,
  assertArtifactKind,
  assertContext,
  assertEnvironment,
  assertSha256,
  buildDurableUri,
  buildObjectPath,
  fail,
  immutableRecordProjection,
  objectMetadataFromRecord,
  parseDurableUri,
  recordFromValidatedInput,
  sameImmutableRecord,
  sanitizeFilename,
  sha256,
  validateRegistryRecord,
  validateSealInput,
};
