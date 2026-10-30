const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createSealedArtifactsService, sha256 } = require("./lib/sealed-artifacts");
const { createInMemorySealedArtifactAdapters } = require("./lib/sealed-artifacts/testing");

test("isolated seal, registry lookup, local-loss recovery, and repeated verification lifecycle", async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sealed-artifact-integration-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const localArtifact = path.join(temporaryRoot, "operation.json");
  const exactBytes = Buffer.from('{"kind":"phase-a-isolated-fixture","rows":[1,2,3]}\n');
  fs.writeFileSync(localArtifact, exactBytes, { flag: "wx", mode: 0o600 });

  const adapters = createInMemorySealedArtifactAdapters();
  const service = createSealedArtifactsService(adapters);
  const sealed = await service.seal({
    bytes: fs.readFileSync(localArtifact),
    artifactKind: "RECOVERY_MANIFEST",
    schemaVersion: 1,
    filename: "operation.json",
    contentType: "application/json",
    producer: "phase-a-isolated-integration",
    environment: "test",
    gitSha: "b".repeat(40),
    containsSecrets: false,
    runId: "phase-a-isolated-run",
  });
  fs.unlinkSync(localArtifact);

  const bySha = await service.lookupBySha({
    sha256: sealed.artifact.sha256,
    environment: "test",
    artifactKind: "RECOVERY_MANIFEST",
  });
  const byRun = await service.lookupByRunId({
    runId: "phase-a-isolated-run",
    environment: "test",
    artifactKind: "RECOVERY_MANIFEST",
  });
  assert.equal(bySha.length, 1);
  assert.equal(byRun.length, 1);
  assert.equal(byRun[0].durable_uri, bySha[0].durable_uri);

  const restoredPath = path.join(temporaryRoot, "recovered", "operation.json");
  const restored = await service.restore({
    sha256: sealed.artifact.sha256,
    artifactKind: "RECOVERY_MANIFEST",
    environment: "test",
    allowedRoot: temporaryRoot,
    destinationPath: restoredPath,
  });
  assert.equal(restored.sha256, sha256(exactBytes));
  assert.deepEqual(fs.readFileSync(restoredPath), exactBytes);
  assert.equal((await service.verify({ durableUri: sealed.artifact.durable_uri, environment: "test" })).status, "DURABLY_SEALED");
  assert.equal(adapters.controls.objectCount(), 1);
  assert.equal(adapters.controls.registryCount(), 1);
});
