const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { databaseState, loadEnvFile, unwrapTransaction } = require("./apply-selected-migrations");
const { CONTRACTS, validateSelection } = require("./supabase-migration-selector");

process.env.RETAILER_REFRESH_PROFILE = "simply-supplements";
const engine = require("./fit-house-offer-refresh");
const { loadReviewedSale } = require("./simply-supplements-reviewed-sale-offer-635");

const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "20260810160000_authorize_simply_offer_635_reviewed_sale.sql";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}

async function scopedState(client) {
  const result = await client.query(`
    select o.id::text offer_id,o.price,o.shipping_cost,o.total_price,o.in_stock,o.url,
           o.last_checked_at,rp.id::text mapping_id,rp.external_url,rp.updated_at,
           rp.product_id::text product_id,rp.product_variant_id::text product_variant_id,
           (select count(*)::integer from public.price_history) price_history_count,
           exists(
             select 1 from public.retailer_offer_sync_reviewed_mixed_change_definitions
             where authorization_id='simply-offer635-sale-20260810-production'
           ) authorization_exists
    from public.offers o
    join public.retailer_products rp on rp.id=o.retailer_product_id
    where o.id=635 and rp.id=627
  `);
  invariant(result.rows.length === 1, "Simply offer 635 rehearsal state is missing");
  return result.rows[0];
}

async function main() {
  const reviewed = loadReviewedSale();
  const beforeRead = await engine.readState("production");
  const run = await engine.buildRun("production", beforeRead, null, reviewed);
  invariant(run.artifacts.length === 1 && run.artifacts[0].rows.length === 1, "Simply sale rehearsal scope mismatch");

  const contract = CONTRACTS.PRODUCTION;
  invariant(contract.pending.length === 1 && contract.pending[0].filename === MIGRATION, "Simply sale pending migration contract mismatch");
  const migrationFile = path.join(ROOT, "supabase", "migrations", MIGRATION);
  const migrationBody = unwrapTransaction(fs.readFileSync(migrationFile, "utf8"), MIGRATION);
  const env = loadEnvFile(path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env"));
  const client = new Client({
    connectionString: env[contract.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "simply-offer635-reviewed-sale-rollback-rehearsal",
  });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    const database = await databaseState(client);
    validateSelection({
      environment: "PRODUCTION",
      projectRef: contract.projectRef,
      databaseTarget: database.databaseTarget,
      remoteLedger: database.remoteLedger,
      sourceDir: path.join(ROOT, "supabase", "migrations"),
    });
    const before = await scopedState(client);
    invariant(before.authorization_exists === false, "Simply sale authorization already exists in production");
    await client.query(migrationBody);
    const authorized = await scopedState(client);
    invariant(authorized.authorization_exists === true, "Simply sale rehearsal did not install authorization");

    const plan = run.artifacts[0].rows[0].atomic_plan;
    const result = (await client.query("select public.apply_product_import_plan($1::jsonb) result", [plan])).rows[0].result;
    invariant(String(result.offer_id) === "635", "Simply sale rehearsal offer result mismatch");
    const after = await scopedState(client);
    invariant(money(after.price) === "2.13", "Simply sale rehearsal price mismatch");
    invariant(money(after.shipping_cost) === "1.99" && money(after.total_price) === "4.12", "Simply sale rehearsal delivered total mismatch");
    invariant(after.in_stock === true && after.url === before.url, "Simply sale rehearsal stock or offer URL drift");
    invariant(after.mapping_id === before.mapping_id && after.product_id === before.product_id && after.product_variant_id === before.product_variant_id, "Simply sale rehearsal identity drift");
    invariant(after.external_url === before.external_url && String(after.updated_at) === String(before.updated_at), "Simply sale rehearsal mapping drift");
    invariant(after.price_history_count - before.price_history_count === 1, "Simply sale rehearsal price-history delta mismatch");

    await client.query("rollback");
    open = false;
    const rolledBack = await scopedState(client);
    invariant(JSON.stringify(rolledBack) === JSON.stringify(before), "Simply sale rehearsal rollback state mismatch");
    console.log(JSON.stringify({
      result: "PASS",
      mode: "PRODUCTION_TRANSACTION_ROLLBACK_REHEARSAL",
      offer_id: "635",
      mapping_id: "627",
      price: { before: "6.41", after: "2.13" },
      total_price: { before: "8.40", after: "4.12" },
      price_history_delta_inside_transaction: 1,
      committed: false,
      rollback_verified: true,
    }, null, 2));
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

module.exports = { main, money, scopedState };
