const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const image = "postgres:17-alpine";
const migrations = [
  "20260802100000_create_nutrition_candidates.sql",
  "20260809120000_add_nutrition_candidate_approved_value.sql",
  "20260809130000_add_nutrition_candidate_batch_items.sql",
  "20260911120000_add_nutrition_candidate_variant_provenance.sql",
];
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: options.timeout || 180_000, input: options.input });
}
function output(result) { return `${result.stdout || ""}\n${result.stderr || ""}`; }
function ok(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.status, 0, `${label}:\n${output(result)}`);
  return result;
}
function dockerAvailable() {
  return run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10_000 }).status === 0;
}
function exec(container, args, options = {}) {
  return run("docker", ["exec", ...(options.stdin ? ["-i"] : []), container, ...args], options);
}
function sql(container, source) {
  return exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-f", "-"], { stdin: true, input: source });
}
function wait(container) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (exec(container, ["pg_isready", "-U", "postgres"]).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  assert.fail("PostgreSQL unavailable");
}
const hash = "1182c1aeab46a72ff38709e349d692ab18d45355d87549574d30bb04f3067842";
const archive = `supabase-storage://nutrition-sources/labels/nut-01/batch-01/applied-nutrition/38/${hash}/38-Applied-Pump-3G-375g.jpg`;
function insertCandidate({ fingerprint, product = 38, variant = "726", uri = archive, sourceHash = hash }) {
  return `
    insert into public.nutrition_candidates(
      product_id,product_variant_id,retailer_id,source_type,source_url,
      source_file_sha256,source_snapshot_ref,source_archive_uri,source_domain,
      product_name,brand,proposed_field,proposed_value,proposed_unit,confidence,
      evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint
    ) values (
      ${product},${variant === null ? "null" : variant},null,'owner_transcribed_official_page',
      'https://appliednutrition.uk/products/pump-3g-375g','${sourceHash}',
      'db:nutrition_candidate_batch_items/1',${uri === null ? "null" : `'${uri}'`},
      'appliednutrition.uk','Applied Nutrition Pump 3G','Applied Nutrition',
      'serving_size_g',1,'g','LOW',
      'TEST ONLY: transport-path value; not approved catalogue nutrition',
      'image:manual-test-path','{TEST_ONLY}'::text[],'pending','NUT-02-variant-path-test','${fingerprint}'
    );
  `;
}

test("variant candidate migration preserves legacy rows and enforces exact immutable private provenance", {
  skip: !dockerAvailable() && "Docker unavailable",
}, () => {
  const container = `nutrition-variant-provenance-${crypto.randomBytes(5).toString("hex")}`;
  try {
    ok(run("docker", ["run", "--detach", "--rm", "--name", container, "--network", "none",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-v", `${root}:/workspace:ro`, image]), "start");
    wait(container);
    ok(sql(container, `
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create table public.products(id bigint primary key);
      create table public.retailers(id bigint primary key);
      create table public.product_variants(
        id bigint primary key,
        product_id bigint not null references public.products(id),
        name text,
        nutrition_override jsonb not null default '{}'::jsonb
      );
      insert into public.products(id) values (38),(39);
      insert into public.product_variants(id,product_id,name) values (726,38,'Default / 375g'),(727,39,'Other');
    `), "setup");
    for (const migration of migrations) {
      ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/supabase/migrations/${migration}`]), migration);
    }

    const legacyFingerprint = "a".repeat(64);
    ok(sql(container, insertCandidate({ fingerprint: legacyFingerprint, variant: null, uri: null, sourceHash: "b".repeat(64) })), "legacy product candidate");
    const exactFingerprint = "c".repeat(64);
    ok(sql(container, insertCandidate({ fingerprint: exactFingerprint })), "exact variant candidate");

    const rows = ok(sql(container, `
      select jsonb_agg(jsonb_build_object(
        'product_id',product_id::text,
        'product_variant_id',case when product_variant_id is null then null else product_variant_id::text end,
        'source_archive_uri',source_archive_uri,
        'source_file_sha256',source_file_sha256
      ) order by id)::text from public.nutrition_candidates;
    `), "readback").stdout.trim();
    assert.deepEqual(JSON.parse(rows), [
      { product_id: "38", product_variant_id: null, source_archive_uri: null, source_file_sha256: "b".repeat(64) },
      { product_id: "38", product_variant_id: "726", source_archive_uri: archive, source_file_sha256: hash },
    ]);

    const mismatch = sql(container, insertCandidate({ fingerprint: "d".repeat(64), product: 38, variant: "727" }));
    assert.notEqual(mismatch.status, 0);
    assert.match(output(mismatch), /variant does not belong to product/);

    const signed = sql(container, insertCandidate({ fingerprint: "e".repeat(64), uri: `${archive}?token=secret` }));
    assert.notEqual(signed.status, 0);
    assert.match(output(signed), /source_archive_uri_private/);

    ok(sql(container, `
      update public.nutrition_candidates
      set status='approved',reviewed_at=now(),reviewed_by='integration-test',approved_value=proposed_value
      where candidate_fingerprint='${exactFingerprint}';
    `), "approve exact candidate");
    const stale = sql(container, `
      update public.nutrition_candidates set source_file_sha256='${"f".repeat(64)}'
      where candidate_fingerprint='${exactFingerprint}';
    `);
    assert.notEqual(stale.status, 0);
    assert.match(output(stale), /already been reviewed|evidence is immutable/);

    ok(sql(container, `
      ${insertCandidate({ fingerprint: exactFingerprint }).replace(/;\s*$/, " on conflict(candidate_fingerprint) do nothing;")}
      ${insertCandidate({ fingerprint: exactFingerprint }).replace(/;\s*$/, " on conflict(candidate_fingerprint) do nothing;")}
    `), "idempotent retry");
    assert.equal(ok(sql(container, `select count(*) from public.nutrition_candidates where candidate_fingerprint='${exactFingerprint}';`), "duplicate count").stdout.trim(), "1");
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});
