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
  "20260911130000_add_nutrition_candidate_preworkout_facts.sql",
  "20260911150000_add_nutrition_candidate_structured_creatine.sql",
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
function insertLegacyCandidate(fingerprint) {
  return `
    insert into public.nutrition_candidates(
      product_id,retailer_id,source_type,source_url,source_file_sha256,
      source_snapshot_ref,source_domain,product_name,brand,proposed_field,
      proposed_value,proposed_unit,confidence,evidence_snippet,source_locator,
      warning_flags,status,run_id,candidate_fingerprint
    ) values (
      38,null,'owner_transcribed_official_page','https://appliednutrition.uk/products/pump-3g-375g',
      '${"b".repeat(64)}','tmp/legacy-source.html','appliednutrition.uk',
      'Applied Nutrition Pump 3G','Applied Nutrition','serving_size_g',1,'g','LOW',
      'TEST ONLY: legacy product review path','legacy:line:1','{TEST_ONLY}'::text[],
      'pending','NUT-02-legacy-compatibility-test','${fingerprint}'
    );
  `;
}
function insertStructuredCandidate({ fingerprint, field = "caffeine_per_serving_mg", state = "present_with_amount", value = 200, sourceValue = 0.2, sourceUnit = "g", form = null, ratio = null }) {
  const quantified = state === "present_with_amount";
  const literal = (input) => input == null ? "null" : `'${input}'`;
  return `
    insert into public.nutrition_candidates(
      product_id,product_variant_id,retailer_id,source_type,source_url,
      source_file_sha256,source_snapshot_ref,source_archive_uri,source_domain,
      product_name,brand,proposed_field,proposed_value,proposed_unit,
      information_state,source_quantity_value,source_quantity_unit,quantity_basis,
      serving_basis_value,serving_basis_unit,serving_basis_text,ingredient_form,ingredient_ratio,
      confidence,evidence_snippet,source_locator,warning_flags,status,run_id,candidate_fingerprint
    ) values (
      38,726,null,'owner_transcribed_official_page','https://appliednutrition.uk/products/pump-3g-375g',
      '${hash}','db:nutrition_candidate_batch_items/1','${archive}','appliednutrition.uk',
      'Applied Nutrition Pump 3G','Applied Nutrition','${field}',${quantified ? value : "null"},${quantified ? "'mg'" : "null"},
      '${state}',${quantified ? sourceValue : "null"},${quantified ? literal(sourceUnit) : "null"},${quantified ? "'per_serving'" : "null"},
      ${quantified ? "15" : "null"},${quantified ? "'g'" : "null"},${quantified ? "'Per 15 g serving'" : "null"},${literal(form)},${literal(ratio)},
      'LOW','TEST ONLY: structured ingredient path','image:test-only','{TEST_ONLY}'::text[],
      'pending','NUT-02B-structured-test','${fingerprint}'
    );
  `;
}
function directFactFingerprint(name) {
  return crypto.createHash("sha256").update(`NUT-02B-CHECK-${name}`).digest("hex");
}
function insertDirectFact({
  name,
  field = "caffeine_per_serving_mg",
  proposedValue = 200,
  proposedUnit = "mg",
  informationState = "present_with_amount",
  sourceValue = 0.2,
  sourceUnit = "g",
  quantityBasis = "per_serving",
  servingValue = 15,
  servingUnit = "g",
  servingText = "Per 15 g serving",
  form = null,
  ratio = null,
  productVariantId = 726,
  sourceArchiveUri = archive,
  status = "pending",
  approvedValue = null,
}) {
  const literal = (value) => {
    if (value === null) return "null";
    if (typeof value === "number") return String(value);
    return `'${String(value).replaceAll("'", "''")}'`;
  };
  const fingerprint = directFactFingerprint(name);
  const reviewed = status === "approved";
  return `
    insert into public.nutrition_candidates(
      product_id,product_variant_id,retailer_id,source_type,source_url,
      source_file_sha256,source_snapshot_ref,source_archive_uri,source_domain,
      product_name,brand,proposed_field,proposed_value,proposed_unit,
      information_state,source_quantity_value,source_quantity_unit,quantity_basis,
      serving_basis_value,serving_basis_unit,serving_basis_text,ingredient_form,ingredient_ratio,
      confidence,evidence_snippet,source_locator,warning_flags,status,reviewed_at,reviewed_by,
      approved_value,run_id,candidate_fingerprint
    ) values (
      38,${literal(productVariantId)},null,'owner_transcribed_official_page',
      'https://appliednutrition.uk/products/pump-3g-375g','${hash}',
      'db:nutrition_candidate_batch_items/1',${literal(sourceArchiveUri)},'appliednutrition.uk',
      'Applied Nutrition Pump 3G','Applied Nutrition',${literal(field)},${literal(proposedValue)},
      ${literal(proposedUnit)},${literal(informationState)},${literal(sourceValue)},${literal(sourceUnit)},
      ${literal(quantityBasis)},${literal(servingValue)},${literal(servingUnit)},${literal(servingText)},
      ${literal(form)},${literal(ratio)},'LOW','TEST ONLY: direct SQL constraint regression',
      'sql:direct-check','{TEST_ONLY}'::text[],${literal(status)},
      ${reviewed ? "now()" : "null"},${reviewed ? "'integration-test'" : "null"},
      ${literal(approvedValue)},'NUT-02B-direct-check','${fingerprint}'
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
    for (const migration of migrations.slice(0, 3)) {
      ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/supabase/migrations/${migration}`]), migration);
    }

    const legacyFingerprint = "a".repeat(64);
    ok(sql(container, insertLegacyCandidate(legacyFingerprint)), "pre-migration legacy product candidate");
    const currentShapeBeforeMigration = sql(container, "select id,product_variant_id,source_archive_uri from public.nutrition_candidates;");
    assert.notEqual(currentShapeBeforeMigration.status, 0);
    assert.match(output(currentShapeBeforeMigration), /column .*product_variant_id.* does not exist/);
    assert.equal(ok(sql(container, `
      select id::text||'|'||product_id::text||'|'||status::text
      from public.nutrition_candidates where candidate_fingerprint='${legacyFingerprint}';
    `), "pre-migration legacy queue read").stdout.trim(), "1|38|pending");
    ok(sql(container, `
      update public.nutrition_candidates
      set status='approved',reviewed_at=now(),reviewed_by='integration-test',approved_value=proposed_value
      where candidate_fingerprint='${legacyFingerprint}';
    `), "pre-migration legacy review");
    const unavailableVariantInsert = sql(container, insertCandidate({ fingerprint: "9".repeat(64) }));
    assert.notEqual(unavailableVariantInsert.status, 0);
    assert.match(output(unavailableVariantInsert), /column "product_variant_id" of relation "nutrition_candidates" does not exist/);

    const provenanceMigration = migrations[3];
    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/supabase/migrations/${provenanceMigration}`]), provenanceMigration);
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

    const beforeNut02b = sql(container, insertStructuredCandidate({ fingerprint: "1".repeat(64) }));
    assert.notEqual(beforeNut02b.status, 0);
    assert.match(output(beforeNut02b), /column "information_state" of relation "nutrition_candidates" does not exist/);

    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/supabase/migrations/${migrations[4]}`]), migrations[4]);
    const malformedFacts = [
      ["quantified-missing-value", { proposedValue: null }],
      ["quantified-missing-unit", { proposedUnit: null }],
      ["quantified-missing-source-value", { sourceValue: null }],
      ["quantified-missing-source-unit", { sourceUnit: null }],
      ["quantified-missing-serving-text", { servingText: null }],
      ["citrulline-missing-form", { field: "citrulline_per_serving_mg", proposedValue: 6000, sourceValue: 6 }],
      ["structured-missing-information-state", {
        proposedValue: null, proposedUnit: null, informationState: null,
        sourceValue: null, sourceUnit: null, quantityBasis: null,
        servingValue: null, servingUnit: null, servingText: null,
      }],
      ["partial-serving-basis-pair", { servingUnit: null }],
      ["legacy-missing-value", {
        field: "serving_size_g", proposedValue: null, proposedUnit: "g",
        informationState: null, sourceValue: null, sourceUnit: null, quantityBasis: null,
        servingValue: null, servingUnit: null, servingText: null,
        productVariantId: null, sourceArchiveUri: null,
      }],
      ["legacy-missing-unit", {
        field: "serving_size_g", proposedValue: 15, proposedUnit: null,
        informationState: null, sourceValue: null, sourceUnit: null, quantityBasis: null,
        servingValue: null, servingUnit: null, servingText: null,
        productVariantId: null, sourceArchiveUri: null,
      }],
      ["approved-legacy-missing-approved-value", {
        field: "serving_size_g", proposedValue: 15, proposedUnit: "g",
        informationState: null, sourceValue: null, sourceUnit: null, quantityBasis: null,
        servingValue: null, servingUnit: null, servingText: null,
        productVariantId: null, sourceArchiveUri: null, status: "approved",
      }],
    ];
    const acceptedMalformedFacts = [];
    for (const [name, values] of malformedFacts) {
      const result = sql(container, insertDirectFact({ name, ...values }));
      if (result.status === 0) acceptedMalformedFacts.push(name);
      else assert.match(output(result), /nutrition_candidates_(?:fact_shape_check|proposed_unit_check|approved_value_review_state)/);
    }
    assert.deepEqual(acceptedMalformedFacts, [], "direct SQL must reject every incomplete candidate fact");
    const validLegacyName = "valid-legacy-product-path";
    ok(sql(container, insertDirectFact({
      name: validLegacyName,
      field: "serving_size_g", proposedValue: 15, proposedUnit: "g",
      informationState: null, sourceValue: null, sourceUnit: null, quantityBasis: null,
      servingValue: null, servingUnit: null, servingText: null,
      productVariantId: null, sourceArchiveUri: null,
    })), "post-NUT-02B legacy product candidate");
    ok(sql(container, `
      update public.nutrition_candidates
      set status='approved',reviewed_at=now(),reviewed_by='integration-test'
      where candidate_fingerprint='${directFactFingerprint(validLegacyName)}';
    `), "post-NUT-02B legacy product review");
    assert.equal(ok(sql(container, `
      select approved_value from public.nutrition_candidates
      where candidate_fingerprint='${directFactFingerprint(validLegacyName)}';
    `), "post-NUT-02B legacy approved value").stdout.trim(), "15");
    const facts = [
      { fingerprint: "1".repeat(64) },
      { fingerprint: "2".repeat(64), field: "citrulline_per_serving_mg", value: 6000, sourceValue: 6, form: "citrulline_malate", ratio: "2:1" },
      { fingerprint: "3".repeat(64), field: "beta_alanine_per_serving_mg", state: "present_amount_not_disclosed" },
      { fingerprint: "4".repeat(64), state: "confirmed_absent" },
      { fingerprint: "5".repeat(64), state: "no_information" },
      { fingerprint: "6".repeat(64), state: "conflicting_information" },
    ];
    for (const fact of facts) ok(sql(container, insertStructuredCandidate(fact)), `structured ${fact.state || "present_with_amount"}`);
    ok(sql(container, `
      update public.nutrition_candidates
      set status='approved',reviewed_at=now(),reviewed_by='integration-test'
      where run_id='NUT-02B-structured-test';
    `), "approve structured candidates");
    const stateReadback = ok(sql(container, `
      select jsonb_agg(jsonb_build_object(
        'state',information_state,'value',proposed_value,'approved',approved_value,
        'source_value',source_quantity_value,'source_unit',source_quantity_unit,
        'basis',quantity_basis,'serving',serving_basis_text,'form',ingredient_form,'ratio',ingredient_ratio
      ) order by id)::text from public.nutrition_candidates
      where run_id='NUT-02B-structured-test';
    `), "structured readback").stdout.trim();
    const parsed = JSON.parse(stateReadback);
    assert.equal(parsed.length, 6);
    assert.deepEqual(parsed[0], {
      state: "present_with_amount", value: 200, approved: 200, source_value: 0.2,
      source_unit: "g", basis: "per_serving", serving: "Per 15 g serving", form: null, ratio: null,
    });
    assert.equal(parsed[1].form, "citrulline_malate");
    assert.equal(parsed[1].ratio, "2:1");
    assert.equal(parsed[1].value, 6000);
    for (const row of parsed.slice(2)) assert.equal(row.approved, null);

    const changedFact = sql(container, `
      update public.nutrition_candidates set serving_basis_text='Per guessed scoop'
      where candidate_fingerprint='${"1".repeat(64)}';
    `);
    assert.notEqual(changedFact.status, 0);
    assert.match(output(changedFact), /already been reviewed|evidence is immutable/);
    const invalidCitrulline = sql(container, insertStructuredCandidate({
      fingerprint: "7".repeat(64), field: "citrulline_per_serving_mg", value: 3000,
      sourceValue: 3, form: "citrulline_malate", ratio: "0:1",
    }));
    assert.notEqual(invalidCitrulline.status, 0);
    assert.match(output(invalidCitrulline), /nutrition_candidates_fact_shape_check/);
    ok(sql(container, `
      ${insertStructuredCandidate({ fingerprint: "1".repeat(64) }).replace(/;\s*$/, " on conflict(candidate_fingerprint) do nothing;")}
    `), "structured idempotent retry");
    assert.equal(ok(sql(container, `select count(*) from public.nutrition_candidates where candidate_fingerprint='${"1".repeat(64)}';`), "structured duplicate count").stdout.trim(), "1");

    const beforeNut03b = sql(container, insertStructuredCandidate({
      fingerprint: "8".repeat(64),
      field: "creatine_declared_form_per_serving_mg",
      value: 3000,
      sourceValue: 3,
      form: "creatine_monohydrate",
    }));
    assert.notEqual(beforeNut03b.status, 0);
    assert.match(output(beforeNut03b), /nutrition_candidates_(?:proposed_field_check|fact_shape_check)/);
    assert.equal(ok(sql(container, `
      select count(*) from public.nutrition_candidates
      where run_id in ('NUT-02-legacy-compatibility-test','NUT-02B-structured-test');
    `), "pre-NUT-03B existing queue read").stdout.trim(), "7");

    ok(exec(container, ["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", `/workspace/supabase/migrations/${migrations[5]}`]), migrations[5]);
    const malformedCreatineFacts = [
      ["creatine-present-missing-value", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: null,
        form: "creatine_monohydrate",
      }],
      ["creatine-present-missing-source-unit", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: 3000,
        sourceValue: 3, sourceUnit: null, form: "creatine_monohydrate",
      }],
      ["creatine-present-missing-form", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: 3000,
        sourceValue: 3,
      }],
      ["creatine-present-invalid-form", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: 3000,
        sourceValue: 3, form: "monohydrate",
      }],
      ["creatine-new-field-missing-state", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: null,
        proposedUnit: null, informationState: null, sourceValue: null,
        sourceUnit: null, quantityBasis: null, servingValue: null,
        servingUnit: null, servingText: null,
      }],
      ["creatine-partial-serving-pair", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: 3000,
        sourceValue: 3, form: "creatine_monohydrate", servingUnit: null,
      }],
      ["creatine-non-present-carries-form", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: null,
        proposedUnit: null, informationState: "confirmed_absent", sourceValue: null,
        sourceUnit: null, quantityBasis: null, servingValue: null,
        servingUnit: null, servingText: null, form: "creatine_monohydrate",
      }],
      ["creatine-ratio-forbidden", {
        field: "creatine_declared_form_per_serving_mg", proposedValue: 3000,
        sourceValue: 3, form: "creatine_monohydrate", ratio: "1:1",
      }],
    ];
    for (const [name, values] of malformedCreatineFacts) {
      const result = sql(container, insertDirectFact({ name, ...values }));
      assert.notEqual(result.status, 0, `${name} must be rejected directly by PostgreSQL`);
      assert.match(output(result), /nutrition_candidates_(?:fact_shape_check|proposed_unit_check)/);
    }

    const creatineFacts = [
      { fingerprint: "8".repeat(64), field: "creatine_declared_form_per_serving_mg", value: 3000, sourceValue: 3, form: "creatine_monohydrate" },
      { fingerprint: "9".repeat(64), field: "creatine_declared_form_per_serving_mg", state: "present_amount_not_disclosed", form: "creatine_form_not_disclosed" },
      { fingerprint: "d".repeat(64), field: "creatine_declared_form_per_serving_mg", state: "confirmed_absent" },
      { fingerprint: "e".repeat(64), field: "creatine_declared_form_per_serving_mg", state: "no_information" },
      { fingerprint: "f".repeat(64), field: "creatine_declared_form_per_serving_mg", state: "conflicting_information" },
    ];
    for (const fact of creatineFacts) ok(sql(container, insertStructuredCandidate(fact)), `structured creatine ${fact.state || "present_with_amount"}`);
    ok(sql(container, `
      update public.nutrition_candidates
      set status='approved',reviewed_at=now(),reviewed_by='integration-test'
      where proposed_field='creatine_declared_form_per_serving_mg';
    `), "approve structured creatine candidates");
    const creatineReadback = JSON.parse(ok(sql(container, `
      select jsonb_agg(jsonb_build_object(
        'state',information_state,'value',proposed_value,'approved',approved_value,
        'source_value',source_quantity_value,'source_unit',source_quantity_unit,
        'basis',quantity_basis,'serving',serving_basis_text,'form',ingredient_form
      ) order by id)::text from public.nutrition_candidates
      where proposed_field='creatine_declared_form_per_serving_mg';
    `), "structured creatine readback").stdout.trim());
    assert.equal(creatineReadback.length, 5);
    assert.deepEqual(creatineReadback[0], {
      state: "present_with_amount", value: 3000, approved: 3000,
      source_value: 3, source_unit: "g", basis: "per_serving",
      serving: "Per 15 g serving", form: "creatine_monohydrate",
    });
    assert.equal(creatineReadback[1].form, "creatine_form_not_disclosed");
    for (const row of creatineReadback.slice(1)) assert.equal(row.approved, null);

    const changedCreatineEvidence = sql(container, `
      update public.nutrition_candidates set source_file_sha256='${"0".repeat(64)}'
      where candidate_fingerprint='${"8".repeat(64)}';
    `);
    assert.notEqual(changedCreatineEvidence.status, 0);
    assert.match(output(changedCreatineEvidence), /already been reviewed|evidence is immutable/);
    ok(sql(container, `
      ${insertStructuredCandidate({
        fingerprint: "8".repeat(64), field: "creatine_declared_form_per_serving_mg",
        value: 3000, sourceValue: 3, form: "creatine_monohydrate",
      }).replace(/;\s*$/, " on conflict(candidate_fingerprint) do nothing;")}
    `), "structured creatine idempotent retry");
    assert.equal(ok(sql(container, `
      select count(*) from public.nutrition_candidates
      where candidate_fingerprint='${"8".repeat(64)}';
    `), "structured creatine duplicate count").stdout.trim(), "1");

    const postNut03bLegacyName = "post-nut03b-legacy-product-path";
    ok(sql(container, insertDirectFact({
      name: postNut03bLegacyName,
      field: "creatine_per_serving_g", proposedValue: 3, proposedUnit: "g",
      informationState: null, sourceValue: null, sourceUnit: null,
      quantityBasis: null, servingValue: null, servingUnit: null,
      servingText: null, productVariantId: null, sourceArchiveUri: null,
    })), "post-NUT-03B legacy creatine candidate");
  } finally {
    run("docker", ["rm", "-f", container], { timeout: 30_000 });
  }
});
