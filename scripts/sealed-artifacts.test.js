const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  MAX_ARTIFACT_BYTES,
  buildDurableUri,
  createSealedArtifactsService,
  createSupabaseStorageAdapter,
  parseDurableUri,
  sanitizeFilename,
  sha256,
} = require("./lib/sealed-artifacts");
const { createInMemorySealedArtifactAdapters } = require("./lib/sealed-artifacts/testing");

const GIT_SHA = "a".repeat(40);

function input(overrides = {}) {
  return {
    bytes: Buffer.from('{"phase":"A","exact":true}\n'),
    artifactKind: "CONTROL_EVIDENCE",
    schemaVersion: 1,
    filename: "phase-a-evidence.json",
    contentType: "application/json",
    producer: "sealed-artifacts-test",
    environment: "test",
    gitSha: GIT_SHA,
    containsSecrets: false,
    runId: "phase-a-run-1",
    ...overrides,
  };
}

function fixture(options) {
  const adapters = createInMemorySealedArtifactAdapters(options);
  return { ...adapters, service: createSealedArtifactsService(adapters) };
}

async function rejectsCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "supplementscout-sealed-artifacts-"));
}

test("content-addressed publish returns DURABLY_SEALED only after two exact readbacks", async () => {
  const base = createInMemorySealedArtifactAdapters();
  let reads = 0;
  const storage = { ...base.storage, async read(objectPath) { reads += 1; return base.storage.read(objectPath); } };
  const service = createSealedArtifactsService({ storage, registry: base.registry });
  const result = await service.seal(input());
  assert.equal(result.status, "DURABLY_SEALED");
  assert.equal(result.idempotent, false);
  assert.equal(reads, 2);
  assert.match(result.artifact.durable_uri, /^supabase-storage:\/\/sealed-artifacts\/test\/control_evidence\/[0-9a-f]{64}\/phase-a-evidence\.json$/);
  assert.equal(base.controls.objectCount(), 1);
  assert.equal(base.controls.registryCount(), 1);
});

test("same bytes and immutable context are idempotent", async () => {
  const { service, controls } = fixture();
  const first = await service.seal(input());
  const second = await service.seal(input());
  assert.equal(second.status, "DURABLY_SEALED");
  assert.equal(second.idempotent, true);
  assert.equal(second.artifact.durable_uri, first.artifact.durable_uri);
  assert.equal(controls.objectCount(), 1);
  assert.equal(controls.registryCount(), 1);
});

test("same-byte publication with contradictory registry metadata is rejected", async () => {
  const { service } = fixture();
  await service.seal(input());
  await rejectsCode(() => service.seal(input({ producer: "different-producer" })), "REGISTRY_IDENTITY_CONFLICT");
});

test("different bytes found at the content-addressed destination are never adopted", async () => {
  const { service, controls } = fixture();
  const proposed = input({ bytes: Buffer.from('{"collision":true}\n') });
  const digest = sha256(proposed.bytes);
  const uri = buildDurableUri({
    environment: proposed.environment,
    artifactKind: proposed.artifactKind,
    sha256: digest,
    filename: proposed.filename,
  });
  controls.injectObject(parseDurableUri(uri).objectPath, Buffer.from("different bytes"));
  await rejectsCode(() => service.seal(proposed), "OBJECT_WITHOUT_REGISTRY");
});

test("verify by durable URI performs exact-byte SHA readback", async () => {
  const { service } = fixture();
  const sealed = await service.seal(input());
  const verified = await service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" });
  assert.equal(verified.status, "DURABLY_SEALED");
  assert.equal(verified.artifact.sha256, sealed.artifact.sha256);
});

test("verify and restore by run ID perform exact-byte readback", async (context) => {
  const root = temporaryDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { service } = fixture();
  const sealed = await service.seal(input());
  const reference = { runId: "phase-a-run-1", artifactKind: "CONTROL_EVIDENCE", environment: "test" };
  const verified = await service.verify(reference);
  assert.equal(verified.artifact.sha256, sealed.artifact.sha256);
  const restored = await service.restore({
    ...reference,
    allowedRoot: root,
    destinationPath: path.join(root, "by-run-id.json"),
  });
  assert.equal(restored.sha256, sealed.artifact.sha256);
});

test("restore writes exact bytes and independently hashes the local copy", async (context) => {
  const root = temporaryDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { service } = fixture();
  const sealed = await service.seal(input());
  const destinationPath = path.join(root, "restored", "evidence.json");
  const restored = await service.restore({
    durableUri: sealed.artifact.durable_uri,
    environment: "test",
    allowedRoot: root,
    destinationPath,
  });
  assert.equal(restored.status, "RESTORED_VERIFIED");
  assert.equal(restored.sha256, sealed.artifact.sha256);
  assert.equal(sha256(fs.readFileSync(destinationPath)), sealed.artifact.sha256);
});

test("deleting the original temporary artifact after seal does not block exact restore", async (context) => {
  const root = temporaryDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = path.join(root, "original.json");
  fs.writeFileSync(original, input().bytes, { flag: "wx" });
  const { service } = fixture();
  const sealed = await service.seal(input({ bytes: fs.readFileSync(original) }));
  fs.unlinkSync(original);
  const destinationPath = path.join(root, "restore", "original.json");
  await service.restore({ durableUri: sealed.artifact.durable_uri, environment: "test", allowedRoot: root, destinationPath });
  assert.deepEqual(fs.readFileSync(destinationPath), input().bytes);
});

test("cross-environment durable URI use fails closed", async () => {
  const { service } = fixture();
  const sealed = await service.seal(input({ environment: "staging" }));
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "production" }),
    "CROSS_ENVIRONMENT_ARTIFACT",
  );
});

test("cross-environment SHA use fails closed", async () => {
  const { service } = fixture();
  const sealed = await service.seal(input({ environment: "staging" }));
  await rejectsCode(
    () => service.verify({ sha256: sealed.artifact.sha256, artifactKind: "CONTROL_EVIDENCE", environment: "production" }),
    "CROSS_ENVIRONMENT_ARTIFACT",
  );
});

test("registry without storage object fails closed", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.deleteObject(parseDurableUri(sealed.artifact.durable_uri).objectPath);
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "STORAGE_OBJECT_MISSING",
  );
});

test("storage object without registry is not automatically sealed", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.deleteRegistry(sealed.artifact.durable_uri);
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "REGISTRY_RECORD_MISSING",
  );
  await rejectsCode(() => service.seal(input()), "OBJECT_WITHOUT_REGISTRY");
});

test("tampered stored bytes are rejected", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.tamperObjectBytes(parseDurableUri(sealed.artifact.durable_uri).objectPath, Buffer.from('{"tampered":true}\n'));
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "OBJECT_SIZE_MISMATCH",
  );
});

test("same-size tampered stored bytes fail SHA verification", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  const original = input().bytes;
  const replacement = Buffer.from(original.map((value, index) => index === 1 ? value ^ 1 : value));
  controls.tamperObjectBytes(parseDurableUri(sealed.artifact.durable_uri).objectPath, replacement);
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "OBJECT_SHA_MISMATCH",
  );
});

test("lookup by SHA is environment and kind bound", async () => {
  const { service } = fixture();
  const sealed = await service.seal(input());
  const rows = await service.lookupBySha({ sha256: sealed.artifact.sha256, environment: "test", artifactKind: "CONTROL_EVIDENCE" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].durable_uri, sealed.artifact.durable_uri);
  assert.equal((await service.lookupBySha({ sha256: sealed.artifact.sha256, environment: "staging" })).length, 0);
});

test("lookup by run ID and artifact kind returns exact rows", async () => {
  const { service } = fixture();
  await service.seal(input());
  await service.seal(input({ artifactKind: "APPLY_AUDIT", filename: "apply.json" }));
  assert.equal((await service.lookupByRunId({ runId: "phase-a-run-1", environment: "test" })).length, 2);
  const controls = await service.lookupByRunId({ runId: "phase-a-run-1", environment: "test", artifactKind: "CONTROL_EVIDENCE" });
  assert.equal(controls.length, 1);
  assert.equal(controls[0].artifact_kind, "CONTROL_EVIDENCE");
});

test("ambiguous run ID readback fails closed until one immutable artifact is selected", async () => {
  const { service } = fixture();
  const first = await service.seal(input());
  await service.seal(input({ artifactKind: "APPLY_AUDIT", filename: "apply.json" }));
  await rejectsCode(
    () => service.verify({ runId: "phase-a-run-1", environment: "test" }),
    "AMBIGUOUS_ARTIFACT_REFERENCE",
  );
  const verified = await service.verify({ runId: "phase-a-run-1", artifactKind: "CONTROL_EVIDENCE", environment: "test" });
  assert.equal(verified.artifact.sha256, first.artifact.sha256);
});

test("path traversal in filename is rejected", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ filename: "../evidence.json" })), "PATH_TRAVERSAL_BLOCKED");
  await rejectsCode(() => service.seal(input({ filename: "folder\\evidence.json" })), "PATH_TRAVERSAL_BLOCKED");
});

test("oversized artifact is rejected before storage access", async () => {
  const { service, controls } = fixture();
  await rejectsCode(
    () => service.seal(input({ bytes: Buffer.alloc(MAX_ARTIFACT_BYTES + 1, 0x61), contentType: "text/plain", filename: "large.txt" })),
    "ARTIFACT_TOO_LARGE",
  );
  assert.equal(controls.objectCount(), 0);
});

test("unsupported and temporary-only artifact kinds are rejected", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ artifactKind: "WAVE04_SPECIAL" })), "UNSUPPORTED_ARTIFACT_KIND");
  await rejectsCode(() => service.seal(input({ artifactKind: "TEMPORARY_DEBUG" })), "TEMPORARY_ARTIFACT_NOT_SEALABLE");
});

test("unsupported content types and mismatched extensions are rejected", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ contentType: "application/octet-stream" })), "UNSUPPORTED_CONTENT_TYPE");
  await rejectsCode(() => service.seal(input({ filename: "evidence.txt" })), "CONTENT_TYPE_FILENAME_MISMATCH");
});

test("unsafe filename characters are deterministically sanitized", async () => {
  assert.equal(sanitizeFilename(" Phase A: closeout?.json "), "Phase-A-closeout-.json");
  const { service } = fixture();
  const sealed = await service.seal(input({ filename: " Phase A: closeout?.json " }));
  assert.equal(sealed.artifact.filename, "Phase-A-closeout-.json");
});

test("registry and object metadata mismatch fails closed", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.tamperObjectMetadata(parseDurableUri(sealed.artifact.durable_uri).objectPath, { environment: "production" });
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "OBJECT_METADATA_MISMATCH",
  );
});

test("object content type metadata mismatch fails closed", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.tamperObjectMetadata(parseDurableUri(sealed.artifact.durable_uri).objectPath, { content_type: "text/plain" });
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "OBJECT_METADATA_MISMATCH",
  );
});

test("object producer metadata mismatch fails closed", async () => {
  const { service, controls } = fixture();
  const sealed = await service.seal(input());
  controls.tamperObjectMetadata(parseDurableUri(sealed.artifact.durable_uri).objectPath, { producer: "different-producer" });
  await rejectsCode(
    () => service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" }),
    "OBJECT_METADATA_MISMATCH",
  );
});

test("production and staging identifiers produce distinct immutable identities", async () => {
  const { service, controls } = fixture();
  const staging = await service.seal(input({ environment: "staging" }));
  const production = await service.seal(input({ environment: "production" }));
  assert.notEqual(staging.artifact.durable_uri, production.artifact.durable_uri);
  assert.match(staging.artifact.durable_uri, /\/staging\//);
  assert.match(production.artifact.durable_uri, /\/production\//);
  assert.equal(controls.registryCount(), 2);
});

test("empty artifact and malformed JSON are rejected deterministically", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ bytes: Buffer.alloc(0) })), "EMPTY_ARTIFACT_REJECTED");
  await rejectsCode(() => service.seal(input({ bytes: Buffer.from("{not-json") })), "MALFORMED_ARTIFACT");
});

test("invalid SHA reference is rejected before registry lookup", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.verify({ sha256: "xyz", environment: "test" }), "INVALID_SHA256");
});

test("secret declaration is mandatory and credential-like material is blocked", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ containsSecrets: undefined })), "SECRET_DECLARATION_REQUIRED");
  await rejectsCode(
    () => service.seal(input({
      bytes: Buffer.from('{"api_key":"secret-value-123456"}\n'),
      filename: "credential.json",
    })),
    "CREDENTIAL_MATERIAL_DETECTED",
  );
});

test("declared secret artifact is rejected", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ containsSecrets: true })), "SECRET_ARTIFACT_REJECTED");
});

test("malformed schema version and git SHA are rejected", async () => {
  const { service } = fixture();
  await rejectsCode(() => service.seal(input({ schemaVersion: 0 })), "INVALID_SCHEMA_VERSION");
  await rejectsCode(() => service.seal(input({ gitSha: "main" })), "INVALID_GIT_SHA");
});

test("ambiguous same-byte SHA across artifact kinds requires explicit kind", async () => {
  const { service } = fixture();
  const first = await service.seal(input());
  await service.seal(input({ artifactKind: "APPLY_AUDIT", filename: "apply-audit.json" }));
  await rejectsCode(
    () => service.verify({ sha256: first.artifact.sha256, environment: "test" }),
    "AMBIGUOUS_ARTIFACT_REFERENCE",
  );
  const verified = await service.verify({ sha256: first.artifact.sha256, artifactKind: "CONTROL_EVIDENCE", environment: "test" });
  assert.equal(verified.artifact.artifact_kind, "CONTROL_EVIDENCE");
});

test("upload followed by registry failure remains unsealed and requires reconciliation", async () => {
  const { service, controls } = fixture({ failRegistryInsert: true });
  await rejectsCode(() => service.seal(input()), "REGISTRY_WRITE_FAILED");
  assert.equal(controls.objectCount(), 1);
  assert.equal(controls.registryCount(), 0);
  await rejectsCode(() => service.seal(input()), "OBJECT_WITHOUT_REGISTRY");
});

test("failed first readback never creates a registry row", async () => {
  const base = createInMemorySealedArtifactAdapters();
  const storage = { ...base.storage, async read() { return null; } };
  const service = createSealedArtifactsService({ storage, registry: base.registry });
  await rejectsCode(() => service.seal(input()), "STORAGE_OBJECT_MISSING");
  assert.equal(base.controls.objectCount(), 1);
  assert.equal(base.controls.registryCount(), 0);
});

test("failed final readback never returns DURABLY_SEALED", async () => {
  const base = createInMemorySealedArtifactAdapters();
  let reads = 0;
  const storage = {
    ...base.storage,
    async read(objectPath) {
      reads += 1;
      return reads === 1 ? base.storage.read(objectPath) : null;
    },
  };
  const service = createSealedArtifactsService({ storage, registry: base.registry });
  await rejectsCode(() => service.seal(input()), "STORAGE_OBJECT_MISSING");
  assert.equal(base.controls.registryCount(), 1);
});

test("restore refuses traversal and overwrite attempts", async (context) => {
  const root = temporaryDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { service } = fixture();
  const sealed = await service.seal(input());
  await rejectsCode(
    () => service.restore({ durableUri: sealed.artifact.durable_uri, environment: "test", allowedRoot: root, destinationPath: path.join(root, "..", "escape.json") }),
    "RESTORE_PATH_BLOCKED",
  );
  const existing = path.join(root, "existing.json");
  fs.writeFileSync(existing, "existing", { flag: "wx" });
  await rejectsCode(
    () => service.restore({ durableUri: sealed.artifact.durable_uri, environment: "test", allowedRoot: root, destinationPath: existing }),
    "RESTORE_DESTINATION_EXISTS",
  );
});

test("non-canonical or wrong-bucket durable URIs are rejected", () => {
  assert.throws(() => parseDurableUri("supabase-storage://nutrition-sources/test/control_evidence/" + "a".repeat(64) + "/x.json"), { code: "INVALID_DURABLE_URI" });
  assert.throws(() => parseDurableUri("supabase-storage://sealed-artifacts/test/control_evidence/" + "A".repeat(64) + "/x.json"), { code: "INVALID_SHA256" });
});

test("Supabase Storage adapter pins the private bucket and disables upsert", async () => {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "sealed-artifacts");
        return {
          async upload(objectPath, bytes, options) {
            calls.push({ objectPath, bytes: Buffer.from(bytes), options });
            return { data: { path: objectPath }, error: null };
          },
        };
      },
    },
  };
  const adapter = createSupabaseStorageAdapter(client);
  const metadata = {
    sha256: "b".repeat(64),
    environment: "staging",
    artifact_kind: "CONTROL_EVIDENCE",
    schema_version: "1",
    byte_size: "3",
    content_type: "text/plain",
    immutable: "true",
  };
  await adapter.write(`staging/control_evidence/${"b".repeat(64)}/x.txt`, Buffer.from("abc"), metadata);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.upsert, false);
  assert.equal(calls[0].options.contentType, "text/plain");
  assert.deepEqual(calls[0].options.metadata, metadata);
});

test("Supabase Storage adapter reads exact bytes plus object metadata", async () => {
  const objectPath = `staging/control_evidence/${"c".repeat(64)}/readback.txt`;
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "sealed-artifacts");
        return {
          async info(received) {
            assert.equal(received, objectPath);
            return {
              data: {
                size: 3,
                contentType: "text/plain",
                metadata: {
                  sha256: "c".repeat(64),
                  environment: "staging",
                  artifactKind: "CONTROL_EVIDENCE",
                  schemaVersion: "1",
                  gitSha: "d".repeat(40),
                  retentionClass: "PERMANENT",
                  runId: "sdk-camelized-run",
                },
              },
              error: null,
            };
          },
          async download(received) {
            assert.equal(received, objectPath);
            return { data: new Blob([Buffer.from("abc")]), error: null };
          },
        };
      },
    },
  };
  const readback = await createSupabaseStorageAdapter(client).read(objectPath);
  assert.deepEqual(readback.bytes, Buffer.from("abc"));
  assert.equal(readback.metadata.sha256, "c".repeat(64));
  assert.equal(readback.metadata.artifact_kind, "CONTROL_EVIDENCE");
  assert.equal(readback.metadata.schema_version, "1");
  assert.equal(readback.metadata.git_sha, "d".repeat(40));
  assert.equal(readback.metadata.retention_class, "PERMANENT");
  assert.equal(readback.metadata.run_id, "sdk-camelized-run");
  assert.equal(readback.metadata.byte_size, "3");
  assert.equal(readback.metadata.content_type, "text/plain");
});
