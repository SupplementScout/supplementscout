const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyInventory,
  inventorySha256,
  relativeTestFiles,
  sanitizedEnvironment
} = require("./quality-gate");
const manifest = require("./quality-gate-manifest.json");

test("the complete test inventory is explicitly sealed", () => {
  const files = relativeTestFiles();
  const classification = classifyInventory(manifest, files);
  assert.equal(files.length, manifest.inventory.count);
  assert.equal(inventorySha256(files), manifest.inventory.sha256);
  assert.equal(
    classification.safe.length + classification.integration.length + classification.artifact.length,
    files.length,
  );
});

test("an unreviewed test inventory change fails closed", () => {
  const files = relativeTestFiles();
  assert.throws(
    () => classifyInventory(manifest, [...files, "scripts/unreviewed.test.js"].sort()),
    /Test inventory changed/
  );
});

test("quick tests exist and never overlap integration tests", () => {
  const classification = classifyInventory(manifest, relativeTestFiles());
  const integration = new Set(classification.integration);
  assert.ok(classification.quick.length > 0);
  for (const file of classification.quick) assert.equal(integration.has(file), false, file);
});

test("quality-gate child processes cannot inherit production write credentials", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
  try {
    const environment = sanitizedEnvironment();
    assert.equal(environment.SUPABASE_SERVICE_ROLE_KEY, "");
    assert.equal(environment.QUALITY_GATE, "1");
    assert.equal(environment.CI, "true");
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});

test("isolated builds override local Supabase configuration with loopback placeholders", () => {
  const environment = sanitizedEnvironment("production", true);
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(environment.SUPABASE_URL, "http://127.0.0.1:54321");
  assert.equal(environment.SUPABASE_SERVICE_ROLE_KEY, "quality-gate-local-only-key");
});
