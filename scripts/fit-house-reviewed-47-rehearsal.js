// HISTORICAL ONE-TIME REHEARSAL: retained as audit evidence, never scheduled.
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { databaseState, loadEnvFile, unwrapTransaction } = require("./apply-selected-migrations");
const { CONTRACTS, validateSelection } = require("./supabase-migration-selector");
const engine = require("./fit-house-offer-refresh");
const { loadReviewedFitHouse47 } = require("./fit-house-reviewed-47-apply");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "20260811000000_authorize_reviewed_fit_house_47_changes.sql";

function invariant(value, message) { if (!value) throw new Error(message); }
function money(value) { return value == null ? null : Number(value).toFixed(2); }

async function counts(client) {
  return (await client.query(`select
    (select count(*)::integer from public.products) products,
    (select count(*)::integer from public.product_variants) product_variants,
    (select count(*)::integer from public.retailer_products) retailer_products,
    (select count(*)::integer from public.offers) offers,
    (select count(*)::integer from public.price_history) price_history`)).rows[0];
}

async function scopedState(client, offerIds) {
  return (await client.query(`select o.id::text offer_id,o.price,o.shipping_cost,o.total_price,o.in_stock,o.url,
    o.last_checked_at,rp.id::text mapping_id,rp.external_url,rp.updated_at,
    rp.product_id::text product_id,rp.product_variant_id::text product_variant_id
    from public.offers o join public.retailer_products rp on rp.id=o.retailer_product_id
    where o.id=any($1::bigint[]) order by o.id`, [offerIds])).rows;
}

async function rehearsal(args, diagnostic) {
  invariant(args.target === "production" && args.mode === "dry-run", "rehearsal is production dry-run only");
  const reviewed = loadReviewedFitHouse47();
  const state = await engine.readState("production");
  const run = await engine.buildRun("production", state, diagnostic, reviewed);
  invariant(run.artifacts.length === 1 && run.artifacts[0].rows.length === 47, "reviewed rehearsal scope mismatch");
  const contract = CONTRACTS.PRODUCTION;
  invariant(contract.pending.length === 1 && contract.pending[0].filename === MIGRATION,
    "reviewed rehearsal migration selector mismatch");
  const migrationBody = unwrapTransaction(fs.readFileSync(path.join(ROOT, "supabase", "migrations", MIGRATION), "utf8"), MIGRATION);
  const env = loadEnvFile(path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env"));
  const client = new Client({ connectionString: env[contract.databaseUrlEnvironmentKey], ssl: { rejectUnauthorized: false }, application_name: "fit-house-reviewed-47-rollback-rehearsal" });
  await client.connect();
  let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    const database = await databaseState(client);
    validateSelection({ environment: "PRODUCTION", projectRef: contract.projectRef,
      databaseTarget: database.databaseTarget, remoteLedger: database.remoteLedger,
      sourceDir: path.join(ROOT, "supabase", "migrations") });
    await client.query(migrationBody);
    const beforeCounts = await counts(client);
    const rows = run.artifacts[0].rows;
    const offerIds = rows.map((row) => row.offer_id);
    const before = await scopedState(client, offerIds);
    const beforeById = new Map(before.map((row) => [row.offer_id, row]));
    for (const row of rows) {
      const result = (await client.query("select public.apply_product_import_plan($1::jsonb) result", [row.atomic_plan])).rows[0].result;
      invariant(String(result.offer_id) === String(row.offer_id), `rehearsal result mismatch ${row.offer_id}`);
    }
    const afterCounts = await counts(client);
    invariant(afterCounts.products === beforeCounts.products && afterCounts.product_variants === beforeCounts.product_variants
      && afterCounts.retailer_products === beforeCounts.retailer_products && afterCounts.offers === beforeCounts.offers,
    "rehearsal changed catalogue identity counts");
    invariant(afterCounts.price_history - beforeCounts.price_history === 3, "rehearsal price-history delta mismatch");
    const after = await scopedState(client, offerIds);
    const planById = new Map(rows.map((row) => [String(row.offer_id), row.atomic_plan]));
    for (const actual of after) {
      const prior = beforeById.get(actual.offer_id), plan = planById.get(actual.offer_id), expected = plan.offer.values;
      invariant(prior && plan, `rehearsal state missing ${actual.offer_id}`);
      invariant(money(actual.price) === money(expected.price) && money(actual.shipping_cost) === money(expected.shipping_cost)
        && money(actual.total_price) === money(expected.total_price) && Boolean(actual.in_stock) === Boolean(expected.in_stock),
      `rehearsal commercial mismatch ${actual.offer_id}`);
      invariant(actual.url === prior.url && actual.external_url === prior.external_url
        && actual.mapping_id === prior.mapping_id && actual.product_id === prior.product_id
        && actual.product_variant_id === prior.product_variant_id && String(actual.updated_at) === String(prior.updated_at),
      `rehearsal identity or URL drift ${actual.offer_id}`);
    }
    await client.query("rollback"); open = false;
    invariant(JSON.stringify(await counts(client)) === JSON.stringify(beforeCounts), "rehearsal rollback count mismatch");
    invariant(JSON.stringify(await scopedState(client, offerIds)) === JSON.stringify(before), "rehearsal rollback state mismatch");
    return { result: "PASS", mode: "END_TO_END_ROLLBACK_REHEARSAL", rows_executed: 47,
      stock_updates: 45, price_updates: 3, expected_price_history_inserts: 3,
      mapping_updates: 0, url_updates: 0, committed: false, rollback_verified: true };
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

async function main() {
  const completed = await engine.runWithDiagnostic(["--target=production", "--mode=dry-run"], { operation: rehearsal });
  console.log(JSON.stringify(completed.result));
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { counts, money, rehearsal, scopedState };
