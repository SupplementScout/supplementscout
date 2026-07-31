const crypto = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const { catalogueCounts, loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const CONTRACT = CONTRACTS.PRODUCTION;
const NOTE = "MERGE FAMILY – ten sam produkt, różne smaki/rozmiary/kolory";
const PLAN = Object.freeze([
  Object.freeze({ canonical: 261, candidate: 262, expectedName: "Dreadlift Oldschool Bodybuilding Tee - Military Green", expectedCategory: "Accessories", sourceVariant: 249, key: "military-green", label: "Military Green", format: "apparel", size: null, unit: null, pack: 1 }),
  Object.freeze({ canonical: 280, candidate: 279, expectedName: "GASP Thermal Shorts - Asphalt", expectedCategory: "Health Supplements", sourceVariant: 273, key: "asphalt", label: "Asphalt", format: "apparel", size: null, unit: null, pack: 1 }),
  Object.freeze({ canonical: 280, candidate: 281, expectedName: "GASP Thermal Shorts - Tactical Camo", expectedCategory: "Health Supplements", sourceVariant: 236, key: "tactical-camo", label: "Tactical Camo", format: "apparel", size: null, unit: null, pack: 1 }),
  Object.freeze({ canonical: 468, candidate: 474, expectedName: "Critical Cookie Salted Caramel - 12 x 85g", expectedCategory: "Protein Bars", sourceVariant: 446, key: "salted-caramel-85g-12-pack", label: "Salted Caramel", display: "Salted Caramel Box of 12 / 85g", format: "snack", size: 85, unit: "g", pack: 12 }),
]);

function invariant(value, message) { if (!value) throw new Error(message); }
function confirmation() { return crypto.createHash("sha256").update(JSON.stringify({ project: CONTRACT.projectRef, plan: PLAN })).digest("hex").slice(0, 16); }
function parseArgs(argv) {
  const out = { mode: "rehearse", confirm: null };
  const seen = new Set();
  for (const arg of argv) { const match = arg.match(/^--(mode|confirm)=(.*)$/); invariant(match && !seen.has(match[1]), `Invalid argument ${arg}`); seen.add(match[1]); out[match[1]] = match[2]; }
  invariant(["rehearse", "apply", "verify"].includes(out.mode), "mode must be rehearse, apply or verify");
  if (out.mode === "apply") invariant(out.confirm === confirmation(), `apply requires --confirm=${confirmation()}`);
  else invariant(!out.confirm, "confirmation is accepted only for apply mode");
  return out;
}

async function assertTarget(client) {
  const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
  validateDatabaseOwner(CONTRACT, identity);
  invariant(!identity.safe_update, "database SAFE_UPDATE must be unset");
  const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
  invariant(target.target_environment === "PRODUCTION" && target.project_ref === CONTRACT.projectRef && target.database_identity === CONTRACT.databaseIdentity, "production database identity mismatch");
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const env = loadEnvFile(path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env"));
  invariant(env[CONTRACT.projectRefEnvironmentKey] === CONTRACT.projectRef, "production environment file mismatch");
  const client = new Client({ connectionString: env[CONTRACT.databaseUrlEnvironmentKey], ssl: { rejectUnauthorized: false }, application_name: "supplementscout-family-cleanup-followup" });
  await client.connect();
  let open = false;
  try {
    await client.query("begin"); open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:family-cleanup-followup-v1',0))");
    await assertTarget(client);
    const before = await catalogueCounts(client);
    const ids = [...new Set(PLAN.flatMap((row) => [row.canonical, row.candidate]))];
    const products = (await client.query("select id,name,category,is_active,merged_into_product_id from public.products where id=any($1::bigint[]) order by id for update", [ids])).rows;
    const byId = new Map(products.map((row) => [String(row.id), row]));
    if (options.mode === "verify") {
      for (const row of PLAN) invariant(byId.get(String(row.candidate))?.is_active === false && String(byId.get(String(row.candidate))?.merged_into_product_id) === String(row.canonical), `candidate ${row.candidate} verification failed`);
      console.log(JSON.stringify({ result: "PASS", mode: options.mode, family_additions: PLAN.length }, null, 2));
      await client.query("rollback"); open = false; return;
    }
    for (const row of PLAN) {
      const canonical = byId.get(String(row.canonical));
      const candidate = byId.get(String(row.candidate));
      invariant(canonical?.is_active === true && canonical.merged_into_product_id == null, `canonical ${row.canonical} drift`);
      invariant(candidate?.is_active === true && candidate.merged_into_product_id == null && candidate.name === row.expectedName && candidate.category === row.expectedCategory, `candidate ${row.candidate} drift`);
      const source = (await client.query("select id,is_active,is_default from public.product_variants where id=$1 and product_id=$2 for update", [row.sourceVariant, row.candidate])).rows[0];
      invariant(source?.is_active === true && source.is_default === true, `source variant ${row.sourceVariant} drift`);
      const existing = await client.query("select id from public.product_variants where product_id=$1 and variant_key=$2", [row.canonical, row.key]);
      invariant(existing.rows.length === 0, `target ${row.canonical}:${row.key} already exists`);
    }
    const targets = {};
    for (const row of PLAN) {
      if (row.expectedCategory !== "Accessories" && row.format === "apparel") await client.query("update public.products set category='Accessories',product_format='apparel' where id=$1", [row.candidate]);
      const target = (await client.query(`insert into public.product_variants(product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
        values($1,$2,$3,$2,$4,$5,$6,$7,$8,null,null,'{}'::jsonb,false,true) returning id`, [row.canonical, row.key, row.display || row.label, row.label, row.size, row.unit, row.pack, row.format])).rows[0];
      targets[`${row.canonical}:${row.key}`] = String(target.id);
      const pair = [row.canonical, row.candidate].sort((a, b) => a - b);
      await client.query(`insert into public.ignored_duplicate_product_pairs(product_a_id,product_b_id,decision,note,updated_at) values($1,$2,'deferred',$3,now()) on conflict(product_a_id,product_b_id) do update set decision='deferred',note=excluded.note,updated_at=excluded.updated_at`, [pair[0], pair[1], NOTE]);
      const result = (await client.query("select public.merge_product_into_existing_variant($1,$2,$3) result", [row.canonical, row.candidate, target.id])).rows[0].result;
      invariant(Number(result.offers_moved) === 1 && Number(result.retailer_products_moved) === 1, `candidate ${row.candidate} evidence move mismatch`);
    }
    await client.query(`insert into public.ignored_duplicate_product_pairs(product_a_id,product_b_id,decision,note,updated_at) values(468,469,'separate','Different commercial pack: box of 12 versus single 85g cookie',now()) on conflict(product_a_id,product_b_id) do update set decision='separate',note=excluded.note,updated_at=excluded.updated_at`);
    const after = await catalogueCounts(client);
    invariant(Number(after.products) === Number(before.products) && Number(after.product_variants) === Number(before.product_variants) + PLAN.length && Number(after.retailer_products) === Number(before.retailer_products) && Number(after.offers) === Number(before.offers) && Number(after.price_history) === Number(before.price_history), "follow-up catalogue count mismatch");
    if (options.mode === "apply") await client.query("commit"); else await client.query("rollback");
    open = false;
    console.log(JSON.stringify({ result: "PASS", mode: options.mode, confirmation: confirmation(), family_additions: PLAN.length, target_variant_ids: targets, catalogue_counts_before: before, catalogue_counts_after: after, committed: options.mode === "apply" }, null, 2));
  } catch (error) { if (open) await client.query("rollback").catch(() => {}); throw error; }
  finally { await client.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { PLAN, confirmation, parseArgs };
