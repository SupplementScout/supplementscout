const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  SealedArtifactError,
  assertArtifactBytes,
  assertArtifactKind,
  assertContext,
  assertEnvironment,
  assertSha256,
  fail,
  objectMetadataFromRecord,
  parseDurableUri,
  recordFromValidatedInput,
  sameImmutableRecord,
  sha256,
  validateRegistryRecord,
  validateSealInput,
} = require("./contract");

function requireAdapter(adapter, name, methods) {
  if (!adapter || methods.some((method) => typeof adapter[method] !== "function")) {
    fail("INVALID_SEALED_ARTIFACT_ADAPTER", `${name} adapter is incomplete`);
  }
  return adapter;
}

function objectMetadata(record) {
  return objectMetadataFromRecord(validateRegistryRecord(record));
}

function assertObjectMetadata(actual, record) {
  if (!actual || typeof actual !== "object") fail("OBJECT_METADATA_MISMATCH", "stored object metadata is missing");
  const expected = objectMetadata(record);
  for (const [key, value] of Object.entries(expected)) {
    if (String(actual[key] ?? "") !== value) fail("OBJECT_METADATA_MISMATCH", `stored object metadata field ${key} differs`);
  }
}

function assertRequestedRecord(record, expected) {
  const valid = validateRegistryRecord(record);
  if (valid.environment !== expected.environment) fail("CROSS_ENVIRONMENT_ARTIFACT", "artifact environment differs from requested environment");
  if (expected.artifactKind && valid.artifact_kind !== expected.artifactKind) fail("ARTIFACT_KIND_MISMATCH", "artifact kind differs from requested kind");
  if (expected.sha256 && valid.sha256 !== expected.sha256) fail("ARTIFACT_SHA_MISMATCH", "artifact SHA differs from requested SHA");
  return valid;
}

function registryCandidate(input) {
  return validateRegistryRecord({
    ...recordFromValidatedInput(input),
    created_at: new Date(0).toISOString(),
  });
}

function prefixFor(input) {
  return `${input.environment}/${input.artifactKind.toLowerCase()}/${input.sha256}`;
}

function assertStoredBytes(stored, record) {
  if (!stored) fail("STORAGE_OBJECT_MISSING", "registry exists but storage object is missing");
  const valid = validateRegistryRecord(record);
  const bytes = Buffer.from(stored.bytes || []);
  if (bytes.length !== valid.byte_size) fail("OBJECT_SIZE_MISMATCH", "stored object byte size differs from registry");
  assertObjectMetadata(stored.metadata, valid);
  const digest = sha256(bytes);
  if (digest !== valid.sha256) fail("OBJECT_SHA_MISMATCH", "stored object SHA-256 differs from registry");
  assertArtifactBytes(bytes, valid.content_type, false);
  return bytes;
}

function assertRestorePath(destinationPath, allowedRoot) {
  if (typeof destinationPath !== "string" || typeof allowedRoot !== "string") {
    fail("RESTORE_PATH_REQUIRED", "restore requires an explicit destination and allowed temporary root");
  }
  const root = path.resolve(allowedRoot);
  const destination = path.resolve(destinationPath);
  const relative = path.relative(root, destination);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("RESTORE_PATH_BLOCKED", "restore destination must be below the allowed temporary root");
  }
  if (fs.existsSync(root)) {
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) fail("RESTORE_PATH_BLOCKED", "restore root must be a real directory");
    const realRoot = fs.realpathSync.native(root);
    if (path.resolve(realRoot) !== root) fail("RESTORE_PATH_BLOCKED", "restore root cannot resolve through a link or junction");
  } else {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  }
  let current = root;
  for (const component of path.dirname(relative).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    const stats = fs.lstatSync(current);
    if (!stats.isDirectory() || stats.isSymbolicLink()) fail("RESTORE_PATH_BLOCKED", "restore path cannot traverse a link");
    const realRelative = path.relative(root, fs.realpathSync.native(current));
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) fail("RESTORE_PATH_BLOCKED", "restore path escapes its root");
  }
  if (fs.existsSync(destination)) fail("RESTORE_DESTINATION_EXISTS", "restore never overwrites an existing file");
  return { root, destination };
}

function writeRestoredFile(destination, bytes) {
  const directory = path.dirname(destination);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${path.basename(destination)}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporary, destination);
    fs.unlinkSync(temporary);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function createSealedArtifactsService(options) {
  const storage = requireAdapter(options?.storage, "storage", ["list", "read", "write"]);
  const registry = requireAdapter(options?.registry, "registry", [
    "findIdentity",
    "findByUri",
    "findBySha",
    "findByRunId",
    "insert",
  ]);

  async function readAndVerifyRecord(record, expected) {
    const valid = assertRequestedRecord(record, expected);
    const uri = parseDurableUri(valid.durable_uri);
    const stored = await storage.read(uri.objectPath);
    const bytes = assertStoredBytes(stored, valid);
    return { record: valid, bytes };
  }

  async function resolveRecord(reference) {
    if (!reference || typeof reference !== "object") fail("ARTIFACT_REFERENCE_REQUIRED", "artifact reference is required");
    const environment = assertEnvironment(reference.environment);
    if (reference.durableUri) {
      const uri = parseDurableUri(reference.durableUri);
      if (uri.environment !== environment) fail("CROSS_ENVIRONMENT_ARTIFACT", "durable URI belongs to another environment");
      if (reference.artifactKind && assertArtifactKind(reference.artifactKind) !== uri.artifactKind) {
        fail("ARTIFACT_KIND_MISMATCH", "durable URI belongs to another artifact kind");
      }
      const record = await registry.findByUri(reference.durableUri);
      if (!record) fail("REGISTRY_RECORD_MISSING", "storage identity is not registered as sealed");
      return assertRequestedRecord(record, { environment, artifactKind: uri.artifactKind, sha256: uri.sha256 });
    }
    if (reference.runId) {
      const runId = assertContext(reference.runId, "runId");
      const artifactKind = reference.artifactKind ? assertArtifactKind(reference.artifactKind) : null;
      const matches = (await registry.findByRunId(runId)).map(validateRegistryRecord);
      const sameEnvironment = matches.filter((row) => row.environment === environment);
      if (!sameEnvironment.length && matches.length) fail("CROSS_ENVIRONMENT_ARTIFACT", "run ID exists only in another environment");
      const exact = artifactKind ? sameEnvironment.filter((row) => row.artifact_kind === artifactKind) : sameEnvironment;
      if (!exact.length) fail("REGISTRY_RECORD_MISSING", "no sealed registry identity matches the run ID");
      if (exact.length !== 1) fail("AMBIGUOUS_ARTIFACT_REFERENCE", "run ID matches multiple artifacts; use artifactKind, SHA, or durable URI");
      return exact[0];
    }
    const digest = assertSha256(reference.sha256);
    const artifactKind = reference.artifactKind ? assertArtifactKind(reference.artifactKind) : null;
    const matches = (await registry.findBySha(digest)).map(validateRegistryRecord);
    const sameEnvironment = matches.filter((row) => row.environment === environment);
    if (!sameEnvironment.length && matches.length) fail("CROSS_ENVIRONMENT_ARTIFACT", "SHA exists only in another environment");
    const exact = artifactKind ? sameEnvironment.filter((row) => row.artifact_kind === artifactKind) : sameEnvironment;
    if (!exact.length) fail("REGISTRY_RECORD_MISSING", "no sealed registry identity matches the reference");
    if (exact.length !== 1) fail("AMBIGUOUS_ARTIFACT_REFERENCE", "SHA matches multiple artifact kinds; artifactKind is required");
    return exact[0];
  }

  async function seal(rawInput) {
    const input = validateSealInput(rawInput);
    const candidate = registryCandidate(input);
    const existing = await registry.findIdentity({
      environment: input.environment,
      artifactKind: input.artifactKind,
      sha256: input.sha256,
    });
    if (existing) {
      if (!sameImmutableRecord(existing, candidate)) fail("REGISTRY_IDENTITY_CONFLICT", "same immutable identity has contradictory metadata");
      const verified = await readAndVerifyRecord(existing, {
        environment: input.environment,
        artifactKind: input.artifactKind,
        sha256: input.sha256,
      });
      return Object.freeze({ status: "DURABLY_SEALED", idempotent: true, artifact: verified.record });
    }

    const objectsAtIdentity = await storage.list(prefixFor(input));
    if (!Array.isArray(objectsAtIdentity)) fail("STORAGE_READ_FAILED", "storage list response is invalid");
    if (objectsAtIdentity.length) fail("OBJECT_WITHOUT_REGISTRY", "object exists without a registry row; explicit reconciliation is required");

    await storage.write(input.objectPath, input.bytes, objectMetadata(candidate));
    const firstReadback = await storage.read(input.objectPath);
    assertStoredBytes(firstReadback, candidate);

    let inserted;
    try {
      inserted = await registry.insert(recordFromValidatedInput(input));
    } catch (error) {
      if (!(error instanceof SealedArtifactError) || error.code !== "REGISTRY_IDENTITY_EXISTS") throw error;
      inserted = await registry.findIdentity({
        environment: input.environment,
        artifactKind: input.artifactKind,
        sha256: input.sha256,
      });
      if (!inserted || !sameImmutableRecord(inserted, candidate)) {
        fail("REGISTRY_IDENTITY_CONFLICT", "concurrent registry identity differs from uploaded object", { cause: error });
      }
    }

    if (!sameImmutableRecord(inserted, candidate)) fail("REGISTRY_INSERT_MISMATCH", "created registry row differs from sealed input");
    const verified = await readAndVerifyRecord(inserted, {
      environment: input.environment,
      artifactKind: input.artifactKind,
      sha256: input.sha256,
    });
    return Object.freeze({ status: "DURABLY_SEALED", idempotent: false, artifact: verified.record });
  }

  async function verify(reference) {
    const record = await resolveRecord(reference);
    const verified = await readAndVerifyRecord(record, {
      environment: reference.environment,
      artifactKind: reference.artifactKind || record.artifact_kind,
      sha256: record.sha256,
    });
    return Object.freeze({ status: "DURABLY_SEALED", artifact: verified.record });
  }

  async function restore(reference) {
    const checkedPath = assertRestorePath(reference?.destinationPath, reference?.allowedRoot);
    const record = await resolveRecord(reference);
    const verified = await readAndVerifyRecord(record, {
      environment: reference.environment,
      artifactKind: reference.artifactKind || record.artifact_kind,
      sha256: record.sha256,
    });
    writeRestoredFile(checkedPath.destination, verified.bytes);
    const restoredBytes = fs.readFileSync(checkedPath.destination);
    const restoredSha256 = sha256(restoredBytes);
    if (restoredSha256 !== verified.record.sha256) fail("RESTORED_SHA_MISMATCH", "restored local bytes differ from sealed artifact");
    return Object.freeze({
      status: "RESTORED_VERIFIED",
      path: checkedPath.destination,
      sha256: restoredSha256,
      artifact: verified.record,
    });
  }

  async function lookupByRunId(query) {
    const environment = assertEnvironment(query?.environment);
    const artifactKind = query?.artifactKind ? assertArtifactKind(query.artifactKind) : null;
    const runId = assertContext(query?.runId, "runId");
    const rows = (await registry.findByRunId(runId)).map(validateRegistryRecord)
      .filter((row) => row.environment === environment && (!artifactKind || row.artifact_kind === artifactKind));
    return Object.freeze(rows);
  }

  async function lookupBySha(query) {
    const environment = assertEnvironment(query?.environment);
    const digest = assertSha256(query?.sha256);
    const artifactKind = query?.artifactKind ? assertArtifactKind(query.artifactKind) : null;
    const rows = (await registry.findBySha(digest)).map(validateRegistryRecord)
      .filter((row) => row.environment === environment && (!artifactKind || row.artifact_kind === artifactKind));
    return Object.freeze(rows);
  }

  return Object.freeze({ lookupByRunId, lookupBySha, restore, seal, verify });
}

module.exports = {
  assertObjectMetadata,
  assertRestorePath,
  createSealedArtifactsService,
  objectMetadata,
};
