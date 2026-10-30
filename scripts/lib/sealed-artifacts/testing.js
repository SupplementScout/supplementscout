const { SealedArtifactError, validateRegistryRecord } = require("./contract");

function cloneRecord(record) {
  return structuredClone(record);
}

function createInMemorySealedArtifactAdapters(options = {}) {
  const objects = new Map();
  const registryRows = [];
  let nextId = 1;

  const storage = Object.freeze({
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(`${prefix}/`)).sort();
    },
    async read(objectPath) {
      const object = objects.get(objectPath);
      if (!object) return null;
      return Object.freeze({ bytes: Buffer.from(object.bytes), metadata: structuredClone(object.metadata) });
    },
    async write(objectPath, bytes, metadata) {
      if (objects.has(objectPath)) throw new SealedArtifactError("STORAGE_WRITE_FAILED", "object already exists");
      if (options.failWrite) throw new SealedArtifactError("STORAGE_WRITE_FAILED", "injected storage write failure");
      objects.set(objectPath, { bytes: Buffer.from(bytes), metadata: structuredClone(metadata) });
      return Object.freeze({ path: objectPath });
    },
  });

  const registry = Object.freeze({
    async findIdentity({ environment, artifactKind, sha256 }) {
      const row = registryRows.find((candidate) => candidate.environment === environment && candidate.artifact_kind === artifactKind && candidate.sha256 === sha256);
      return row ? cloneRecord(row) : null;
    },
    async findByUri(durableUri) {
      const row = registryRows.find((candidate) => candidate.durable_uri === durableUri);
      return row ? cloneRecord(row) : null;
    },
    async findBySha(sha256) {
      return registryRows.filter((candidate) => candidate.sha256 === sha256).map(cloneRecord);
    },
    async findByRunId(runId) {
      return registryRows.filter((candidate) => candidate.run_id === runId).map(cloneRecord);
    },
    async insert(record) {
      if (options.failRegistryInsert) throw new SealedArtifactError("REGISTRY_WRITE_FAILED", "injected registry write failure");
      if (registryRows.some((candidate) => candidate.environment === record.environment && candidate.artifact_kind === record.artifact_kind && candidate.sha256 === record.sha256)) {
        throw new SealedArtifactError("REGISTRY_IDENTITY_EXISTS", "immutable identity already exists");
      }
      if (registryRows.some((candidate) => candidate.durable_uri === record.durable_uri)) {
        throw new SealedArtifactError("REGISTRY_IDENTITY_EXISTS", "durable URI already exists");
      }
      const inserted = validateRegistryRecord({
        id: nextId++,
        created_at: new Date(Date.UTC(2026, 9, 30, 12, 0, registryRows.length)).toISOString(),
        ...cloneRecord(record),
      });
      registryRows.push(inserted);
      return cloneRecord(inserted);
    },
  });

  const controls = Object.freeze({
    deleteObject(objectPath) { objects.delete(objectPath); },
    deleteRegistry(durableUri) {
      const index = registryRows.findIndex((row) => row.durable_uri === durableUri);
      if (index >= 0) registryRows.splice(index, 1);
    },
    injectObject(objectPath, bytes, metadata = {}) {
      objects.set(objectPath, { bytes: Buffer.from(bytes), metadata: structuredClone(metadata) });
    },
    tamperObjectBytes(objectPath, bytes) {
      const object = objects.get(objectPath);
      if (!object) throw new Error("test object missing");
      object.bytes = Buffer.from(bytes);
    },
    tamperObjectMetadata(objectPath, updates) {
      const object = objects.get(objectPath);
      if (!object) throw new Error("test object missing");
      Object.assign(object.metadata, structuredClone(updates));
    },
    tamperRegistry(durableUri, updates) {
      const row = registryRows.find((candidate) => candidate.durable_uri === durableUri);
      if (!row) throw new Error("test registry row missing");
      Object.assign(row, structuredClone(updates));
    },
    objectCount() { return objects.size; },
    registryCount() { return registryRows.length; },
    registryRows() { return registryRows.map(cloneRecord); },
  });

  return Object.freeze({ controls, registry, storage });
}

module.exports = { createInMemorySealedArtifactAdapters };
