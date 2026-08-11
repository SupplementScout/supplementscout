const crypto = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const { catalogueCounts, loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const CONTRACT = CONTRACTS.PRODUCTION;
const PLAN = Object.freeze({
  canonicalId: 1040,
  canonicalName: "7Nutrition Creatine Hydrochloride Hcl 350caps",
  candidateId: 84,
  candidateName: "7Nutrition Creatine HCL 350 caps",
  targetVariantId: 2176,
  targetVariantKey: "unflavoured-350capsule",
  candidateVariantId: 53,
  candidateMappingId: 151,
  candidateOfferId: 88,
  candidateRetailerId: 3,
  candidateExternalGtin: "5903111089412",
  officialProductUrl: "https://7nutrition.eu/en/products/7nutrition-hcl-creatine-350-vege-caps-466.html?selected_size=onesize",
});

function invariant(value, message) { if (!value) throw new Error(message); }
function confirmation() {
  return crypto.createHash("sha256").update(JSON.stringify({ project: CONTRACT.projectRef, plan: PLAN })).digest("hex").slice(0, 16);
}

function parseArgs(argv) {
  const options = { mode: "rehearse", confirm: null };
  const seen = new Set();
  for (const argument of argv) {
    const match = argument.match(/^--(mode|confirm)=(.*)$/);
    invariant(match && !seen.has(match[1]), `Invalid argument ${argument}`);
    seen.add(match[1]); options[match[1]] = match[2];
  }
  invariant(["rehearse", "apply", "verify"].includes(options.mode), "mode must be rehearse, apply or verify");
  if (options.mode === "apply") invariant(options.confirm === confirmation(), `apply requires --confirm=${confirmation()}`);
  else invariant(!options.confirm, "confirmation is accepted only for apply mode");
  return options;
}

async function assertTarget(client) {
  const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
  validateDatabaseOwner(CONTRACT, identity);
  invariant(!identity.safe_update, "database SAFE_UPDATE must be unset");
  const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
  invariant(target.target_environment === "PRODUCTION" && target.project_ref === CONTRACT.projectRef && target.database_identity === CONTRACT.databaseIdentity, "production database identity mismatch");
}

async function preconditions(client) {
  const products = (await client.query("select id,name,brand,category,is_active,merged_into_product_id,merged_at from public.products where id=any($1::bigint[]) order by id for update", [[PLAN.candidateId, PLAN.canonicalId]])).rows;
  const byId = new Map(products.map((row) => [String(row.id), row]));
  const canonical = byId.get(String(PLAN.canonicalId));
  const candidate = byId.get(String(PLAN.candidateId));
  invariant(canonical?.name === PLAN.canonicalName && canonical.is_active === true && canonical.merged_into_product_id == null && canonical.merged_at == null, "canonical product drift");
  invariant(candidate?.name === PLAN.candidateName && candidate.is_active === true && candidate.merged_into_product_id == null && candidate.merged_at == null, "candidate product drift");
  invariant(String(canonical.brand).toLowerCase() === String(candidate.brand).toLowerCase() && canonical.category === candidate.category && canonical.category === "Creatine", "brand/category identity mismatch");

  const variants = (await client.query("select id,product_id,variant_key,display_name,pack_count,product_format,is_active,is_default from public.product_variants where product_id=any($1::bigint[]) order by id for update", [[PLAN.candidateId, PLAN.canonicalId]])).rows;
  const candidateActive = variants.filter((row) => String(row.product_id) === String(PLAN.candidateId) && row.is_active === true);
  const source = candidateActive[0];
  const target = variants.find((row) => String(row.id) === String(PLAN.targetVariantId));
  invariant(candidateActive.length === 1 && String(source.id) === String(PLAN.candidateVariantId) && source.is_default === true, "candidate default variant drift");
  invariant(target && String(target.product_id) === String(PLAN.canonicalId) && target.variant_key === PLAN.targetVariantKey && target.is_active === true && target.product_format === "capsule" && Number(target.pack_count) === 1, "target variant drift");

  const mappings = (await client.query("select id,product_id,product_variant_id,retailer_id,external_gtin,external_url from public.retailer_products where product_id=any($1::bigint[]) order by id for update", [[PLAN.candidateId, PLAN.canonicalId]])).rows;
  const candidateMappings = mappings.filter((row) => String(row.product_id) === String(PLAN.candidateId));
  const candidateMapping = candidateMappings[0];
  invariant(candidateMappings.length === 1 && String(candidateMapping.id) === String(PLAN.candidateMappingId) && String(candidateMapping.product_variant_id) === String(PLAN.candidateVariantId) && String(candidateMapping.retailer_id) === String(PLAN.candidateRetailerId) && candidateMapping.external_gtin === PLAN.candidateExternalGtin && candidateMapping.external_url, "candidate mapping drift");
  invariant(!mappings.some((row) => String(row.product_id) === String(PLAN.canonicalId) && String(row.retailer_id) === String(PLAN.candidateRetailerId)), "canonical already has candidate retailer mapping");

  const offers = (await client.query("select id,product_id,product_variant_id,retailer_id,retailer_product_id,url from public.offers where product_id=any($1::bigint[]) order by id for update", [[PLAN.candidateId, PLAN.canonicalId]])).rows;
  const candidateOffers = offers.filter((row) => String(row.product_id) === String(PLAN.candidateId));
  const candidateOffer = candidateOffers[0];
  invariant(candidateOffers.length === 1 && String(candidateOffer.id) === String(PLAN.candidateOfferId) && String(candidateOffer.product_variant_id) === String(PLAN.candidateVariantId) && String(candidateOffer.retailer_product_id) === String(PLAN.candidateMappingId) && String(candidateOffer.retailer_id) === String(PLAN.candidateRetailerId) && candidateOffer.url, "candidate offer drift");
  invariant(!offers.some((row) => String(row.product_id) === String(PLAN.canonicalId) && String(row.retailer_id) === String(PLAN.candidateRetailerId)), "canonical already has candidate retailer offer");

  const histories = Number((await client.query("select count(*)::int count from public.product_merge_history where candidate_product_id=$1", [PLAN.candidateId])).rows[0].count);
  invariant(histories === 0, "candidate already has merge history");
  const priceHistory = Number((await client.query("select count(*)::int count from public.price_history where offer_id=$1", [PLAN.candidateOfferId])).rows[0].count);
  const clicks = (await client.query("select id,product_id from public.outbound_clicks where offer_id=$1 order by id", [PLAN.candidateOfferId])).rows;
  return { priceHistory, clickIds: clicks.map((row) => String(row.id)) };
}

async function verifyMerged(client, evidence, mergeHistoryId = null) {
  const candidate = (await client.query("select is_active,merged_into_product_id,merged_at from public.products where id=$1", [PLAN.candidateId])).rows[0];
  invariant(candidate?.is_active === false && String(candidate.merged_into_product_id) === String(PLAN.canonicalId) && candidate.merged_at, "candidate merge state mismatch");
  const mapping = (await client.query("select product_id,product_variant_id,external_gtin from public.retailer_products where id=$1", [PLAN.candidateMappingId])).rows[0];
  invariant(String(mapping?.product_id) === String(PLAN.canonicalId) && String(mapping?.product_variant_id) === String(PLAN.targetVariantId) && mapping.external_gtin === PLAN.candidateExternalGtin, "mapping preservation mismatch");
  const offer = (await client.query("select product_id,product_variant_id,retailer_product_id from public.offers where id=$1", [PLAN.candidateOfferId])).rows[0];
  invariant(String(offer?.product_id) === String(PLAN.canonicalId) && String(offer?.product_variant_id) === String(PLAN.targetVariantId) && String(offer?.retailer_product_id) === String(PLAN.candidateMappingId), "offer preservation mismatch");
  const priceHistory = Number((await client.query("select count(*)::int count from public.price_history where offer_id=$1", [PLAN.candidateOfferId])).rows[0].count);
  invariant(priceHistory === evidence.priceHistory, "price history count changed");
  const clicks = (await client.query("select id,product_id from public.outbound_clicks where offer_id=$1 order by id", [PLAN.candidateOfferId])).rows;
  invariant(JSON.stringify(clicks.map((row) => String(row.id))) === JSON.stringify(evidence.clickIds) && clicks.every((row) => String(row.product_id) === String(PLAN.canonicalId)), "outbound click preservation mismatch");
  const history = (await client.query("select id,canonical_product_id,candidate_product_id,offers_moved,retailer_products_moved,price_history_preserved,source from public.product_merge_history where candidate_product_id=$1", [PLAN.candidateId])).rows[0];
  invariant(history && (!mergeHistoryId || String(history.id) === String(mergeHistoryId)) && String(history.canonical_product_id) === String(PLAN.canonicalId) && Number(history.offers_moved) === 1 && Number(history.retailer_products_moved) === 1 && Number(history.price_history_preserved) === evidence.priceHistory && history.source === "admin_family_variant_merge_rpc", "merge history mismatch");
  return String(history.id);
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const env = loadEnvFile(path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env"));
  invariant(env[CONTRACT.projectRefEnvironmentKey] === CONTRACT.projectRef, "production environment file mismatch");
  const client = new Client({ connectionString: env[CONTRACT.databaseUrlEnvironmentKey], ssl: { rejectUnauthorized: false }, application_name: "supplementscout-creatine-84-1040-merge" });
  await client.connect(); let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("set local lock_timeout='10s'"); await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:creatine-84-1040-merge-v1',0))");
    await assertTarget(client);
    if (options.mode === "verify") {
      const history = (await client.query("select price_history_preserved,snapshot from public.product_merge_history where candidate_product_id=$1", [PLAN.candidateId])).rows[0];
      invariant(history, "merge history missing");
      const evidence = { priceHistory: Number(history.price_history_preserved), clickIds: (history.snapshot?.candidate_outbound_clicks_before || []).map((row) => String(row.id)) };
      const mergeHistoryId = await verifyMerged(client, evidence);
      await client.query("rollback"); open = false;
      console.log(JSON.stringify({ result: "PASS", mode: "verify", merge_history_id: mergeHistoryId, committed: true }, null, 2)); return;
    }
    const before = await catalogueCounts(client);
    const evidence = await preconditions(client);
    const result = (await client.query("select public.merge_product_into_existing_variant($1,$2,$3) result", [PLAN.canonicalId, PLAN.candidateId, PLAN.targetVariantId])).rows[0].result;
    invariant(Number(result.offers_moved) === 1 && Number(result.retailer_products_moved) === 1 && Number(result.price_history_preserved) === evidence.priceHistory, "merge RPC preservation result mismatch");
    const mergeHistoryId = await verifyMerged(client, evidence, result.merge_history_id);
    const after = await catalogueCounts(client);
    for (const key of ["products", "product_variants", "retailer_products", "offers", "price_history"]) invariant(Number(after[key]) === Number(before[key]), `${key} catalogue count changed`);
    if (options.mode === "apply") await client.query("commit"); else await client.query("rollback");
    open = false;
    console.log(JSON.stringify({ result: "PASS", mode: options.mode, confirmation: confirmation(), merge_history_id: mergeHistoryId, canonical_product_id: String(PLAN.canonicalId), candidate_product_id: String(PLAN.candidateId), target_variant_id: String(PLAN.targetVariantId), offers_moved: 1, retailer_products_moved: 1, price_history_preserved: evidence.priceHistory, outbound_clicks_preserved: evidence.clickIds.length, catalogue_counts_before: before, catalogue_counts_after: after, committed: options.mode === "apply" }, null, 2));
  } catch (error) { if (open) await client.query("rollback").catch(() => {}); throw error; }
  finally { await client.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { PLAN, confirmation, parseArgs };
