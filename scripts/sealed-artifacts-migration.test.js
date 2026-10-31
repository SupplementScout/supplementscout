const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { EXCLUSIONS } = require("./lib/environment-migrations");
const { CONTRACTS } = require("./supabase-migration-selector");

const ROOT = path.resolve(__dirname, "..");
const migration = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261030120000_create_sealed_artifacts_registry.sql"), "utf8");
const bucket = fs.readFileSync(path.join(ROOT, "supabase/manual/20261030121000_create_private_sealed_artifacts_bucket.sql"), "utf8");
const rollback = fs.readFileSync(path.join(ROOT, "supabase/rollbacks/20261030120000_create_sealed_artifacts_registry_rollback.sql"), "utf8");
const REGISTRY_MIGRATION = "20261030120000_create_sealed_artifacts_registry.sql";
const REGISTRY_SHA256 = "23ebd020e712074719f7e2a35930ec061f1d7e019b35a3e302e7b8e5f8a676cc";

test("registry migration is generic, immutable, environment-bound, and service-role-only", () => {
  assert.match(migration, /create table public\.sealed_artifacts/i);
  assert.match(migration, /unique \(environment, artifact_kind, sha256\)/i);
  assert.match(migration, /unique \(durable_uri\)/i);
  assert.match(migration, /environment in \('staging', 'production', 'test'\)/i);
  assert.ok(migration.includes("producer text not null check (producer ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')"));
  assert.ok(migration.includes("run_id text null check (run_id is null or run_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$')"));
  assert.match(migration, /before update or delete on public\.sealed_artifacts/i);
  assert.match(migration, /SEALED_ARTIFACT_WRITE_ONCE_VIOLATION/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.sealed_artifacts from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant select, insert on table public\.sealed_artifacts to service_role/i);
  assert.doesNotMatch(migration, /grant\s+(?:update|delete|all)/i);
  assert.doesNotMatch(migration, /nutrition|retailer|product_id|variant_id|run_id\s*=/i);
});

test("registry URI, size, kind, MIME, and retention constraints match the shared contract", () => {
  assert.match(migration, /supabase-storage:\/\/sealed-artifacts\/.*lower\(artifact_kind\).*sha256.*filename/is);
  assert.match(migration, /byte_size between 1 and 10485760/i);
  for (const kind of [
    "SOURCE_EVIDENCE", "PREPARED_SCOPE", "REVIEW_REGISTRATION", "APPROVED_PLAN", "APPLY_AUDIT",
    "PRODUCTION_CLOSEOUT", "CONTROL_EVIDENCE", "RECOVERY_MANIFEST", "AUTOMATION_DIAGNOSTIC", "HISTORICAL_DOC",
  ]) assert.match(migration, new RegExp(`'${kind}'`));
  assert.doesNotMatch(migration, /TEMPORARY_DEBUG/);
  for (const type of ["application/json", "application/x-ndjson", "application/sql", "text/csv", "text/markdown", "text/plain"]) {
    assert.match(migration, new RegExp(`'${type.replace("/", "\\/")}'`));
  }
  assert.match(migration, /artifact_kind in \([\s\S]*SOURCE_EVIDENCE[\s\S]*RECOVERY_MANIFEST[\s\S]*retention_class = 'PERMANENT'/i);
});

test("bucket setup is private, bounded, idempotent, and creates no public policy", () => {
  assert.match(bucket, /from storage\.buckets/i);
  assert.match(bucket, /where id = 'sealed-artifacts'/i);
  assert.match(bucket, /v_bucket\.public is distinct from false/i);
  assert.match(bucket, /SEALED_ARTIFACT_BUCKET_CONTRACT_MISMATCH/);
  assert.match(bucket, /insert into storage\.buckets/i);
  assert.match(bucket, /'sealed-artifacts'[\s\S]*false[\s\S]*10485760/i);
  assert.doesNotMatch(bucket, /create policy/i);
  assert.doesNotMatch(bucket, /public\s+select|public url|getPublicUrl/i);
  assert.doesNotMatch(bucket, /update\s+storage\.buckets/i);
});

test("managed Storage setup remains outside the automatic migration chain", () => {
  assert.doesNotMatch(migration, /storage\.(?:buckets|objects)/i);
  assert.match(bucket, /intentionally outside migrations/i);
});

test("registry activation remains excluded from automatic apply and is recorded as applied only in production", () => {
  const identifier = REGISTRY_MIGRATION.slice(0, -4);
  for (const environment of ["STAGING", "PRODUCTION"]) {
    assert.ok(EXCLUSIONS[environment].includes(identifier));
    assert.equal(CONTRACTS[environment].excluded[REGISTRY_MIGRATION], REGISTRY_SHA256);
    assert.ok(!CONTRACTS[environment].pending.some(({ filename }) => filename === REGISTRY_MIGRATION));
  }
  assert.ok(!CONTRACTS.STAGING.appliedExcluded.includes(REGISTRY_MIGRATION));
  assert.equal(
    CONTRACTS.PRODUCTION.appliedExcluded.filter((filename) => filename === REGISTRY_MIGRATION).length,
    1,
  );
});

test("rollback refuses to remove durable bytes and only drops an empty registry", () => {
  assert.match(rollback, /execute 'select exists \(select 1 from public\.sealed_artifacts\)'/i);
  assert.match(rollback, /SEALED_ARTIFACT_REGISTRY_NOT_EMPTY/i);
  assert.doesNotMatch(rollback, /delete from storage\.objects|storage\.empty_bucket|remove\(/i);
  assert.match(rollback, /private bucket is intentionally not deleted/i);
});
