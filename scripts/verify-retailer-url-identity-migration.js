const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { canonicalJson } = require("./lib/canonical-json");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = {
  staging: {
    ref: "hxnrsyyqffztlvcrtgbf",
    envFile: path.join(ROOT, ".env.staging.audit.local"),
    prefix: "SUPPLEMENTSCOUT_STAGING",
  },
  production: {
    ref: "aftboxmrdgyhizicfsfu",
    envFile: path.join(
      process.env.USERPROFILE,
      ".supplementscout",
      "credentials",
      "production-validator.env",
    ),
    prefix: "SUPPLEMENTSCOUT_PRODUCTION_VALIDATOR",
  },
};
const BUSINESS_TABLES = [
  "retailers",
  "products",
  "product_variants",
  "retailer_products",
  "offers",
  "price_history",
];

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function loadConnection(spec) {
  const values = {};
  for (const line of fs.readFileSync(spec.envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  assert.equal(values[`${spec.prefix}_PROJECT_REF`], spec.ref, "project ref mismatch");
  const parsed = new URL(values[`${spec.prefix}_DATABASE_URL`]);
  parsed.searchParams.delete("sslmode");
  return parsed.href;
}
async function queryRows(client, table) {
  return (
    await client.query(`select to_jsonb(t) row from public.${table} t order by id`)
  ).rows.map(({ row }) => row);
}
function duplicateGroups(rows, key, include = () => true) {
  const groups = new Map();
  for (const row of rows) {
    if (!include(row)) continue;
    const value = key(row);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, values]) => ({ key: value, count: values.length, rows: values }));
}
function text(value) {
  return value == null ? "" : String(value).trim();
}
function analyze(data) {
  const mappings = data.retailer_products;
  const offers = data.offers;
  const exactSourceDuplicates = duplicateGroups(
    mappings,
    (row) => `${row.retailer_id}|${text(row.external_variant_id)}`,
    (row) => Boolean(text(row.external_variant_id)),
  );
  const exactCanonicalDuplicates = duplicateGroups(
    mappings,
    (row) => `${row.retailer_id}|${row.product_variant_id}`,
    (row) => Boolean(text(row.external_variant_id)),
  );
  const legacyUrlDuplicates = duplicateGroups(
    mappings,
    (row) => `${row.retailer_id}|${row.external_url}`,
    (row) => !text(row.external_variant_id),
  );
  const offerDuplicates = duplicateGroups(
    offers,
    (row) => String(row.retailer_product_id),
  );
  const sharedMappingUrls = duplicateGroups(
    mappings,
    (row) => `${row.retailer_id}|${row.external_url}`,
  );
  const sharedOfferUrls = duplicateGroups(
    offers,
    (row) => `${row.retailer_id}|${row.url}`,
  );
  const unsafeSharedMappingUrls = sharedMappingUrls.filter(({ rows }) => {
    const exactRows = rows.filter((row) => text(row.external_variant_id));
    const legacyRows = rows.filter((row) => !text(row.external_variant_id));
    const variants = new Set(exactRows.map((row) => text(row.external_variant_id)));
    const parents = new Set(exactRows.map((row) => text(row.external_product_id)));
    const products = new Set(rows.map((row) => String(row.product_id)));
    return (
      legacyRows.length > 1 ||
      variants.size !== exactRows.length ||
      (exactRows.length > 0 && (parents.size !== 1 || parents.has(""))) ||
      products.size !== 1
    );
  });
  const grandfatheredLegacySharedUrls = sharedMappingUrls.filter(
    ({ rows }) =>
      rows.filter((row) => !text(row.external_variant_id)).length === 1 &&
      rows.some((row) => text(row.external_variant_id)),
  );
  return {
    counts: Object.fromEntries(
      BUSINESS_TABLES.map((table) => [table, data[table].length]),
    ),
    fingerprints: Object.fromEntries(
      BUSINESS_TABLES.map((table) => [table, sha256(canonicalJson(data[table]))]),
    ),
    exact_identity_mappings: mappings.filter(
      (row) => text(row.external_product_id) && text(row.external_variant_id),
    ).length,
    legacy_mappings: mappings.filter((row) => !text(row.external_variant_id)).length,
    duplicate_exact_source_identities: exactSourceDuplicates,
    duplicate_exact_canonical_targets: exactCanonicalDuplicates,
    duplicate_legacy_url_identities: legacyUrlDuplicates,
    duplicate_offers_per_mapping: offerDuplicates,
    shared_mapping_url_groups: sharedMappingUrls,
    shared_offer_url_groups: sharedOfferUrls,
    grandfathered_legacy_shared_url_groups: grandfatheredLegacySharedUrls,
    unsafe_shared_mapping_url_groups: unsafeSharedMappingUrls,
  };
}
async function schema(client) {
  const constraints = (
    await client.query(`
      select t.relname table_name,c.conname,c.contype,c.convalidated,
             pg_get_constraintdef(c.oid,true) definition
      from pg_constraint c
      join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname=any($1::text[])
      order by t.relname,c.conname
    `, [["retailer_products", "offers", "price_history"]])
  ).rows;
  const indexes = (
    await client.query(`
      select tablename,indexname,indexdef
      from pg_indexes
      where schemaname='public' and tablename=any($1::text[])
      order by tablename,indexname
    `, [["retailer_products", "offers", "price_history"]])
  ).rows;
  const triggers = (
    await client.query(`
      select t.relname table_name,tr.tgname,tr.tgenabled,
             pg_get_triggerdef(tr.oid,true) definition,
             p.oid::regprocedure::text function_signature
      from pg_trigger tr
      join pg_class t on t.oid=tr.tgrelid
      join pg_namespace n on n.oid=t.relnamespace
      join pg_proc p on p.oid=tr.tgfoid
      where n.nspname='public' and t.relname=any($1::text[]) and not tr.tgisinternal
      order by t.relname,tr.tgname
    `, [["retailer_products", "offers", "price_history"]])
  ).rows;
  return { constraints, indexes, triggers };
}
function hasNamed(list, name) {
  return list.some((row) => row.conname === name || row.indexname === name);
}

async function main() {
  assert.equal(process.env.SAFE_UPDATE, undefined, "SAFE_UPDATE must remain unset");
  const target = argument("target");
  const phase = argument("phase");
  assert.ok(TARGETS[target], "--target must be staging or production");
  assert.ok(["pre", "post"].includes(phase), "--phase must be pre or post");
  const baselineFile = argument("baseline");
  const outFile =
    argument("out") ||
    path.join(ROOT, "tmp", "whey-okay-closeout", `url-identity-${target}-${phase}.json`);
  const client = new Client({
    connectionString: loadConnection(TARGETS[target]),
    ssl: { rejectUnauthorized: false },
    application_name: `retailer_url_identity_${target}_${phase}_verification`,
    options: "-c default_transaction_read_only=on -c statement_timeout=120000",
  });
  await client.connect();
  try {
    await client.query("begin read only");
    const [schemaState, entries] = await Promise.all([
      schema(client),
      Promise.all(BUSINESS_TABLES.map(async (table) => [table, await queryRows(client, table)])),
    ]);
    const data = Object.fromEntries(entries);
    const audit = analyze(data);
    const legacyConstraints = [
      "retailer_products_retailer_url_unique",
      "offers_retailer_url_unique",
    ];
    const replacementIndexes = [
      "retailer_products_retailer_external_variant_unique_idx",
      "retailer_products_retailer_exact_canonical_variant_unique_idx",
      "retailer_products_retailer_legacy_url_unique_idx",
    ];
    if (phase === "pre") {
      for (const name of legacyConstraints) {
        assert.ok(hasNamed(schemaState.constraints, name), `${name} must exist before migration`);
      }
      assert.ok(
        hasNamed(schemaState.indexes, replacementIndexes[0]),
        "exact external variant uniqueness must exist before migration",
      );
    } else {
      for (const name of legacyConstraints) {
        assert.equal(hasNamed(schemaState.constraints, name), false, `${name} must be absent`);
      }
      for (const name of replacementIndexes) {
        assert.ok(hasNamed(schemaState.indexes, name), `${name} must exist`);
      }
      assert.ok(
        schemaState.triggers.some(
          (row) =>
            row.tgname === "retailer_products_url_identity_partition_guard" &&
            row.tgenabled === "O" &&
            row.function_signature ===
              "retailer_products_enforce_url_identity_partition()",
        ),
        "URL identity partition guard must be enabled",
      );
    }
    assert.equal(audit.duplicate_exact_source_identities.length, 0);
    assert.equal(audit.duplicate_exact_canonical_targets.length, 0);
    assert.equal(audit.duplicate_legacy_url_identities.length, 0);
    assert.equal(audit.duplicate_offers_per_mapping.length, 0);
    assert.equal(audit.unsafe_shared_mapping_url_groups.length, 0);

    let baselineComparison = null;
    if (baselineFile) {
      const baseline = JSON.parse(fs.readFileSync(path.resolve(baselineFile), "utf8"));
      baselineComparison = {
        counts_equal: canonicalJson(audit.counts) === canonicalJson(baseline.audit.counts),
        fingerprints_equal:
          canonicalJson(audit.fingerprints) === canonicalJson(baseline.audit.fingerprints),
      };
      assert.equal(baselineComparison.counts_equal, true, "business row counts changed");
      assert.equal(baselineComparison.fingerprints_equal, true, "business row contents changed");
    }
    await client.query("rollback");
    const report = {
      result: "PASS",
      captured_at: new Date().toISOString(),
      target,
      project_ref: TARGETS[target].ref,
      phase,
      safe_update: "unset",
      schema: schemaState,
      audit,
      baseline_comparison: baselineComparison,
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      result: report.result,
      target,
      phase,
      counts: audit.counts,
      exact_identity_mappings: audit.exact_identity_mappings,
      legacy_mappings: audit.legacy_mappings,
      shared_mapping_url_groups: audit.shared_mapping_url_groups.length,
      shared_offer_url_groups: audit.shared_offer_url_groups.length,
      baseline_comparison: baselineComparison,
      output: path.relative(ROOT, outFile),
    }, null, 2));
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "FAIL", error: error.message }, null, 2));
  process.exitCode = 1;
});
