const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const manifest = require("../config/retailers/10reps-reviewed-bindings-v1.json");
const runner = require("./10reps-bootstrap-artifact-approver");
const { PROFILE } = runner;
const options = { artifact: PROFILE.artifact, csv: PROFILE.csv, planFingerprint: PROFILE.fingerprint };

// Synthetic package built entirely from committed reviewed identities. No
// ignored artifact, credential file, network or real database is used by tests.
function fixture() {
  const reviewed = structuredClone(manifest);
  const csvRows = reviewed.rows.map(r => ({
    retailer_name: "10 Reps", retailer_website: "https://www.10reps.co.uk/", external_product_id: r.external_product_id, external_variant_id: r.external_variant_id,
    product_name: r.external_name, variant_name: r.variant_name, brand: r.brand, category: r.category, description: "", image: r.image_url, slug: r.canonical_slug,
    external_url: r.source_url, affiliate_url: r.source_url, external_gtin: r.external_gtin || "", price: r.price.toFixed(2), shipping_known: "true", shipping_cost: "3.99",
    in_stock: "true", is_for_sale: "true", size: String(r.size), size_unit: r.size_unit, flavour: r.flavour, product_format: r.product_format, pack_count: "",
    source_updated_at: r.source_updated_at, external_sku: r.external_sku || "", external_options: JSON.stringify({ Flavour: r.flavour, Size: r.source_size }), product_id: String(r.product_id), product_variant_id: String(r.product_variant_id),
  }));
  const artifact = { artifact_version: "1", row_count: "20", run_id: reviewed.dry_run.run_id, source_file_sha256: PROFILE.csvSha256, blocked_rows: [], plans: [], source_rows: [], summary: { blocked_row_count: "0", plan_count: "20", skipped_row_count: "0" } };
  for (let i = 0; i < 20; i++) {
    const r = reviewed.rows[i], csv = csvRows[i];
    const source = { ...csv, variant: r.variant_name, size: `${r.size} ${r.size_unit}` };
    const sourceHash = runner.sourceFingerprint(source);
    const flavour = r.flavour.toLowerCase().replace(/&/g, "and");
    const plan = {
      approval: { approval_type: "none", approved: false },
      expected_state: { offer: null, retailer: null, retailer_product: null,
        product: { id: String(r.product_id), is_active: true, merged_into_product_id: null, name: r.canonical_product, product_format: r.product_format },
        product_variant: { display_name: r.canonical_variant, flavour_code: flavour, flavour_label: r.canonical_flavour, id: String(r.product_variant_id), is_active: true, is_default: false, pack_count: String(r.pack_count), product_format: r.product_format, product_id: String(r.product_id), size_unit: r.size_unit, size_value: String(r.size), variant_key: `${flavour.replace(/\s+/g, "-")}-${r.size}${r.size_unit}` },
      },
      meta: { operation_type: "standard_import", plan_fingerprint: null, plan_kind: "feed", source_row_fingerprint: sourceHash, version: "2" },
      offer: { action: "create", values: { in_stock: true, last_checked_at: "2026-09-06T05:06:33.201Z", price: r.price.toFixed(2), shipping_cost: "3.99", total_price: r.delivered_price.toFixed(2), url: r.source_url } },
      price_history: { action: "create" }, product: { action: "existing", id: String(r.product_id) },
      product_variant: { action: "existing", evidence: { approved_mapping_id: null, external_options: { Flavour: r.flavour, Size: r.source_size }, flavour, pack_count: null, product_format: r.product_format, size_unit: r.size_unit, size_value: String(r.size) }, id: String(r.product_variant_id) },
      retailer: { action: "create", values: { name: "10 Reps", slug: "10-reps", website: "https://www.10reps.co.uk/" } },
      retailer_product: { action: "create", values: { external_gtin: r.external_gtin, external_name: r.external_name, external_options: { Flavour: r.flavour, Size: r.source_size }, external_product_id: r.external_product_id, external_sku: r.external_sku, external_slug: r.canonical_slug, external_url: r.source_url, external_variant_id: r.external_variant_id, match_confidence: "90", match_method: "slug", product_variant_id: String(r.product_variant_id) } },
    };
    const fingerprint = runner.planFingerprint(plan); plan.meta.plan_fingerprint = fingerprint; r.plan_fingerprint = fingerprint;
    artifact.plans.push({ operation_type: "standard_import", plan_fingerprint: fingerprint, plan_kind: "feed", resolved_plan: plan, retailer_id: null, row_number: String(i + 2), source_row_fingerprint: sourceHash });
    artifact.source_rows.push({ normalized_source_row: source, plan_fingerprint: fingerprint, row_number: String(i + 2), source_row_fingerprint: sourceHash, status: "planned" });
  }
  assert.equal(artifact.plans[0].plan_fingerprint, PROFILE.fingerprint);
  return { manifest: reviewed, artifact, csvRows };
}
function validate(f) { return runner.validatePackage(f.manifest, f.artifact, f.csvRows); }
test("closed CLI accepts only the exact paths and bootstrap fingerprint", () => {
  assert.deepEqual(runner.parseArgs([`--artifact=${PROFILE.artifact}`, `--csv=${PROFILE.csv}`, `--plan-fingerprint=${PROFILE.fingerprint}`]), options);
  for (const args of [[], [`--artifact=${PROFILE.artifact}`, `--artifact=${PROFILE.artifact}`], ["--apply"], ["--pilot-apply"], ["--profile=other"]]) assert.throws(() => runner.parseArgs(args));
  for (const key of ["artifact", "csv", "planFingerprint"]) assert.throws(() => runner.prepareApproval({ ...options, [key]: "wrong" }, () => { throw new Error("Must not read files"); }), /Invalid/);
  for (const row of manifest.rows.slice(1)) assert.throws(() => runner.prepareApproval({ ...options, planFingerprint: row.plan_fingerprint }), /bootstrap fingerprint/);
});
test("wrong artifact and CSV SHA are rejected by the package digest guard", () => {
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt artifact"), PROFILE.artifactSha256, "artifact"), /artifact SHA/);
  assert.throws(() => runner.checkDigest(Buffer.from("corrupt CSV"), PROFILE.csvSha256, "CSV"), /CSV SHA/);
  let reads = 0;
  assert.throws(() => runner.prepareApproval(options, file => { reads++; return file === PROFILE.manifest ? fs.readFileSync(file) : Buffer.from("corrupt artifact"); }), /artifact SHA/);
  assert.equal(reads, 2);
  assert.throws(() => runner.prepareApproval(options, () => Buffer.from("{}")), /manifest SHA/);
});
test("all 20 synthetic plans are checked and only the exact bootstrap is selected", () => {
  const f = fixture(), selected = validate(f);
  assert.equal(selected.entry.row_number, "2");
  assert.equal(selected.entry.resolved_plan.product.id, "788");
  assert.equal(selected.entry.resolved_plan.product_variant.id, "1080");
});
for (const [label, mutate, message] of [
  ["product creation", p => { p.product.action = "create"; }, /existing product/],
  ["variant creation", p => { p.product_variant.action = "create_variant"; }, /existing variant/],
  ["wrong product", p => { p.product.id = "1"; }, /existing product/],
  ["wrong variant", p => { p.product_variant.id = "1"; }, /existing variant/],
  ["shipping other than 3.99", p => { p.offer.values.shipping_cost = "0"; }, /shipping/],
  ["wrong delivered total", p => { p.offer.values.total_price = "24.99"; }, /delivered price/],
  ["changed price", p => { p.offer.values.price = "1.00"; }, /effective price/],
  ["out of stock", p => { p.offer.values.in_stock = false; }, /in-stock/],
  ["SKU promoted into GTIN", p => { p.retailer_product.values.external_gtin = "PER406"; }, /external_gtin/],
  ["source URL substitution", p => { p.offer.values.url = "https://example.test/"; }, /offer URL/],
  ["wrong variant parent", p => { p.expected_state.product_variant.product_id = "1"; }, /variant product_id/],
]) test(`${label} rejected even in an unselected plan`, () => {
  const f = fixture(); mutate(f.artifact.plans[19].resolved_plan); assert.throws(() => validate(f), message);
});
test("held rows, duplicate targets, extra plans and source/category tampering fail closed", () => {
  for (const mutate of [f => f.manifest.held_rows.push(1), f => { f.manifest.rows[19].product_variant_id = 1080; }, f => f.artifact.plans.pop(), f => f.artifact.blocked_rows.push({}), f => { f.csvRows[0].category = "Creatine"; }, f => { f.artifact.source_rows[0].normalized_source_row.image = "https://example.test/image.png"; }, f => { f.artifact.plans[0].plan_fingerprint = "0".repeat(32); }]) {
    const f = fixture(); mutate(f); assert.throws(() => validate(f));
  }
});
test("direct PG credential must target the production approver login", () => {
  const valid = `APPROVER_DATABASE_URL=postgresql://${PROFILE.login}:test-only@db.${PROFILE.project}.supabase.co:5432/postgres?sslmode=require`;
  assert.ok(runner.parseCredential(valid).startsWith("postgresql:"));
  for (const value of [valid.replace(PROFILE.login, "postgres"), valid.replace(PROFILE.project, "staging"), valid.replace("postgresql:", "https:"), valid + "\nSECOND_DATABASE_URL=postgresql://other", valid + "&options=unsafe", "MISSING=true"]) assert.throws(() => runner.parseCredential(value));
});
function fakeClient(prepared, changes = {}) {
  const calls = [];
  return { calls, async connect() { calls.push("CONNECT"); }, async end() { calls.push("END"); }, async query(sql, args) {
    calls.push({ sql, args });
    if (sql === "select current_user,session_user") return { rows: [{ current_user: changes.role || PROFILE.role, session_user: changes.login || PROFILE.login }] };
    if (sql.includes("approve_product_import_plan")) return { rows: [{ result: { approval_id: "11111111-1111-4111-8111-111111111111", status: "approved", artifact_sha256: PROFILE.artifactSha256, run_id: prepared.artifact.run_id, plan_fingerprint: PROFILE.fingerprint, source_row_fingerprint: prepared.entry.source_row_fingerprint, retailer_id: null, plan_kind: "feed", expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), ...changes.receipt } }] };
    return { rows: [] };
  } };
}
test("direct PG transaction checks role and login and submits exactly one approval", async () => {
  const prepared = validate(fixture()), client = fakeClient(prepared);
  const result = await runner.approveWithClient(prepared, client);
  assert.equal(result.approval_only, true);
  const queries = client.calls.filter(c => c.sql);
  assert.deepEqual(queries.map(c => c.sql), ["begin", "select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)", "SET LOCAL ROLE retailer_catalogue_production_approver", "select current_user,session_user", "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result", "commit"]);
  const approval = queries[4];
  assert.equal(approval.args[0].product_variant.id, "1080");
  assert.equal(approval.args[1], PROFILE.artifactSha256);
  assert.equal(client.calls.at(-1), "END");
});
test("wrong role/login never reaches approval; wrong receipt rolls back", async () => {
  for (const changes of [{ role: "postgres" }, { login: "wrong_login" }, { receipt: { plan_fingerprint: "wrong" } }, { receipt: { expires_at: new Date(0).toISOString() } }]) {
    const prepared = validate(fixture()), client = fakeClient(prepared, changes);
    await assert.rejects(runner.approveWithClient(prepared, client));
    assert.ok(client.calls.some(c => c.sql === "rollback"));
    assert.ok(!client.calls.some(c => c.sql === "commit"));
    if (changes.role || changes.login) assert.ok(!client.calls.some(c => c.sql?.includes("approve_product_import_plan")));
  }
});
test("runner has no elevated backend token, HTTP approval, execution RPC or business DML", () => {
  const code = fs.readFileSync(require.resolve("./10reps-bootstrap-artifact-approver"), "utf8");
  assert.doesNotMatch(code, /service_role|SERVICE_ROLE|createClient|PostgREST|supabase-js|fetch\s*\(|apply_approved|apply_product|pilot-apply|\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|grant\s+execute)\b/i);
  assert.match(code, /require\("pg"\)/);
  assert.match(code, /SET LOCAL ROLE retailer_catalogue_production_approver/);
  assert.match(code, /credentials\/production-approver\.env/);
});
