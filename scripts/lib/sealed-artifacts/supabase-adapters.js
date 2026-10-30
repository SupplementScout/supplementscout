const { BUCKET, SealedArtifactError, fail, validateRegistryRecord } = require("./contract");

function safeStorageError(error, code) {
  const message = typeof error?.message === "string" ? error.message : "Supabase Storage operation failed";
  return new SealedArtifactError(code, message, { cause: error });
}

function isMissingStorageError(error) {
  const status = Number(error?.statusCode ?? error?.status ?? 0);
  return [400, 404].includes(status) && /not found|does not exist|missing/i.test(error?.message || "");
}

function assertObjectPath(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.endsWith("/") || value.includes("\\") || value.split("/").some((part) => !part || part === "." || part === "..")) {
    fail("INVALID_STORAGE_PATH", "storage object path is not canonical");
  }
  return value;
}

function normalizeStorageMetadata(info) {
  const metadata = info?.metadata && typeof info.metadata === "object" ? info.metadata : {};
  const canonical = {
    sha256: metadata.sha256,
    environment: metadata.environment,
    artifact_kind: metadata.artifact_kind ?? metadata.artifactKind,
    schema_version: metadata.schema_version ?? metadata.schemaVersion,
    filename: metadata.filename,
    producer: metadata.producer,
    git_sha: metadata.git_sha ?? metadata.gitSha,
    retention_class: metadata.retention_class ?? metadata.retentionClass,
    artifact_fingerprint: metadata.artifact_fingerprint ?? metadata.artifactFingerprint,
    run_id: metadata.run_id ?? metadata.runId,
    parent_artifact_sha: metadata.parent_artifact_sha ?? metadata.parentArtifactSha,
    target_scope_fingerprint: metadata.target_scope_fingerprint ?? metadata.targetScopeFingerprint,
    immutable: metadata.immutable,
  };
  return {
    ...metadata,
    ...Object.fromEntries(Object.entries(canonical).filter(([, value]) => value !== undefined && value !== null)),
    byte_size: String(info?.size ?? metadata.size ?? metadata.contentLength ?? metadata.content_length ?? metadata.byte_size ?? metadata.byteSize ?? ""),
    content_type: info?.contentType ?? metadata.mimetype ?? metadata.contentType ?? metadata.content_type ?? "",
  };
}

function createSupabaseStorageAdapter(client) {
  if (!client?.storage?.from) fail("INVALID_SEALED_ARTIFACT_ADAPTER", "Supabase client has no Storage API");
  const bucket = client.storage.from(BUCKET);
  return Object.freeze({
    async list(prefix) {
      assertObjectPath(`${prefix}/placeholder`);
      const { data, error } = await bucket.list(prefix, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
      if (error) throw safeStorageError(error, "STORAGE_LIST_FAILED");
      return (data || []).filter((item) => item?.id && item?.name).map((item) => `${prefix}/${item.name}`);
    },

    async read(objectPath) {
      assertObjectPath(objectPath);
      const infoResult = await bucket.info(objectPath);
      if (infoResult.error) {
        if (isMissingStorageError(infoResult.error)) return null;
        throw safeStorageError(infoResult.error, "STORAGE_INFO_FAILED");
      }
      const downloadResult = await bucket.download(objectPath);
      if (downloadResult.error) {
        if (isMissingStorageError(downloadResult.error)) return null;
        throw safeStorageError(downloadResult.error, "STORAGE_READ_FAILED");
      }
      const bytes = Buffer.from(await downloadResult.data.arrayBuffer());
      return Object.freeze({ bytes, metadata: normalizeStorageMetadata(infoResult.data) });
    },

    async write(objectPath, bytes, metadata) {
      assertObjectPath(objectPath);
      const result = await bucket.upload(objectPath, Buffer.from(bytes), {
        cacheControl: "31536000",
        contentType: metadata.content_type,
        upsert: false,
        metadata,
      });
      if (result.error) throw safeStorageError(result.error, "STORAGE_WRITE_FAILED");
      return Object.freeze({ path: result.data?.path || objectPath });
    },
  });
}

function safeRegistryError(error, code) {
  return new SealedArtifactError(code, error?.message || "sealed_artifacts registry operation failed", { cause: error });
}

function rows(result, code = "REGISTRY_READ_FAILED") {
  if (result.error) throw safeRegistryError(result.error, code);
  return (result.data || []).map(validateRegistryRecord);
}

function createSupabaseRegistryAdapter(client) {
  if (typeof client?.from !== "function") fail("INVALID_SEALED_ARTIFACT_ADAPTER", "Supabase client has no database API");
  return Object.freeze({
    async findIdentity({ environment, artifactKind, sha256 }) {
      const result = await client.from("sealed_artifacts").select("*")
        .eq("environment", environment).eq("artifact_kind", artifactKind).eq("sha256", sha256).limit(2);
      const matches = rows(result);
      if (matches.length > 1) fail("REGISTRY_IDENTITY_CONFLICT", "registry contains duplicate immutable identities");
      return matches[0] || null;
    },

    async findByUri(durableUri) {
      const result = await client.from("sealed_artifacts").select("*").eq("durable_uri", durableUri).limit(2);
      const matches = rows(result);
      if (matches.length > 1) fail("REGISTRY_IDENTITY_CONFLICT", "registry contains duplicate durable URIs");
      return matches[0] || null;
    },

    async findBySha(sha256) {
      return rows(await client.from("sealed_artifacts").select("*").eq("sha256", sha256).order("created_at", { ascending: true }));
    },

    async findByRunId(runId) {
      return rows(await client.from("sealed_artifacts").select("*").eq("run_id", runId).order("created_at", { ascending: true }));
    },

    async insert(record) {
      const result = await client.from("sealed_artifacts").insert(record).select("*").single();
      if (result.error) {
        if (result.error.code === "23505") throw safeRegistryError(result.error, "REGISTRY_IDENTITY_EXISTS");
        throw safeRegistryError(result.error, "REGISTRY_WRITE_FAILED");
      }
      return validateRegistryRecord(result.data);
    },
  });
}

function createSupabaseSealedArtifactAdapters(client) {
  return Object.freeze({
    storage: createSupabaseStorageAdapter(client),
    registry: createSupabaseRegistryAdapter(client),
  });
}

module.exports = {
  createSupabaseRegistryAdapter,
  createSupabaseSealedArtifactAdapters,
  createSupabaseStorageAdapter,
  isMissingStorageError,
  normalizeStorageMetadata,
};
