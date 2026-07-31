const crypto = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const plan = require("../config/catalogue-reviewed-family-consolidation-v1.json");
const { catalogueCounts, loadEnvFile } = require("./apply-selected-migrations");
const { CONTRACTS, validateDatabaseOwner } = require("./supabase-migration-selector");

const CONTRACT = CONTRACTS.PRODUCTION;
const SOURCE = "admin_reviewed_family_batch_v1";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slugify(value) {
  return String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function flavourCode(value) {
  return value == null ? null : slugify(value);
}

function parseArgs(argv) {
  const out = { mode: "rehearse", confirm: null };
  const seen = new Set();
  for (const arg of argv) {
    const match = arg.match(/^--(mode|confirm)=(.*)$/);
    invariant(match && !seen.has(match[1]), `Invalid argument ${arg}`);
    seen.add(match[1]);
    out[match[1]] = match[2];
  }
  invariant(["rehearse", "apply", "verify"].includes(out.mode), "mode must be rehearse, apply or verify");
  invariant(out.mode === "apply" || !out.confirm, "confirmation is accepted only for apply mode");
  return out;
}

function confirmation() {
  return sha256(canonicalJson({ project: CONTRACT.projectRef, plan })).slice(0, 16);
}

function validatePlan() {
  const families = plan.families || [];
  const productIds = [];
  const candidateIds = [];
  const sourceVariantIds = [];
  let createdVariants = 0;
  invariant(plan.approved === true && plan.target_project_ref === CONTRACT.projectRef, "plan approval or target mismatch");
  invariant(families.length === plan.expected_family_count, "family count mismatch");
  for (const family of families) {
    invariant(family.products.some((row) => row.id === family.canonical_id), `canonical ${family.canonical_id} missing from family`);
    invariant(family.products.length >= 2 && family.variants.length >= 1, `family ${family.canonical_id} is incomplete`);
    invariant(new Set(family.products.map((row) => row.brand)).size === 1, `family ${family.canonical_id} brand mismatch`);
    const familySourceIds = new Set();
    for (const product of family.products) {
      productIds.push(product.id);
      if (product.id !== family.canonical_id) candidateIds.push(product.id);
    }
    for (const variant of family.variants) {
      invariant(variant.variant_key && variant.display_name && variant.flavour && variant.product_format, `family ${family.canonical_id} variant identity missing`);
      invariant(Array.isArray(variant.source_variant_ids) && variant.source_variant_ids.length > 0, `family ${family.canonical_id} source variants missing`);
      if (!variant.existing_variant_id) createdVariants += 1;
      for (const id of variant.source_variant_ids) {
        invariant(!familySourceIds.has(id), `source variant ${id} is assigned twice`);
        familySourceIds.add(id);
        sourceVariantIds.push(id);
      }
    }
  }
  invariant(new Set(productIds).size === productIds.length, "a product appears in multiple families");
  invariant(new Set(sourceVariantIds).size === sourceVariantIds.length, "a source variant appears in multiple families");
  invariant(candidateIds.length === plan.expected_candidate_count, "candidate count mismatch");
  invariant(createdVariants === plan.expected_created_variant_count, "created variant count mismatch");
  return { productIds, candidateIds, sourceVariantIds };
}

async function assertTarget(client) {
  const identity = (await client.query("select current_user,current_setting('app.safe_update',true) safe_update")).rows[0];
  validateDatabaseOwner(CONTRACT, identity);
  invariant(!identity.safe_update, "database SAFE_UPDATE must be unset");
  const target = (await client.query("select public.retailer_catalogue_actual_database_target() target")).rows[0].target;
  invariant(target.target_environment === "PRODUCTION" && target.project_ref === CONTRACT.projectRef && target.database_identity === CONTRACT.databaseIdentity, "production database identity mismatch");
}

async function rows(client, sql, values = []) {
  return (await client.query(sql, values)).rows;
}

async function loadState(client, ids, lock = false) {
  const products = await rows(client, `select * from public.products where id=any($1::bigint[]) order by id${lock ? " for update" : ""}`, [ids.productIds]);
  const variants = await rows(client, "select * from public.product_variants where product_id=any($1::bigint[]) order by product_id,id", [ids.productIds]);
  const mappings = await rows(client, "select * from public.retailer_products where product_id=any($1::bigint[]) order by id", [ids.productIds]);
  const offers = await rows(client, "select * from public.offers where product_id=any($1::bigint[]) order by id", [ids.productIds]);
  const offerIds = offers.map((row) => row.id);
  const histories = offerIds.length ? await rows(client, "select * from public.price_history where offer_id=any($1::bigint[]) order by id", [offerIds]) : [];
  const clicks = offerIds.length ? await rows(client, "select * from public.outbound_clicks where offer_id=any($1::bigint[]) order by id", [offerIds]) : [];
  return { products, variants, mappings, offers, histories, clicks };
}

function mapBy(rowsValue, key = "id") {
  return new Map(rowsValue.map((row) => [String(row[key]), row]));
}

function withoutProductId(row) {
  const copy = { ...row };
  delete copy.product_id;
  return copy;
}

async function validateInitialState(client, ids, state) {
  invariant(state.products.length === ids.productIds.length, "reviewed product count changed");
  invariant(state.mappings.length === plan.expected_mapping_count, "reviewed mapping count changed");
  invariant(state.offers.length === plan.expected_offer_count, "reviewed offer count changed");
  const productById = mapBy(state.products);
  const variantById = mapBy(state.variants);
  const sourceTargets = new Map();
  const familyByProduct = new Map();
  for (const family of plan.families) {
    const canonical = productById.get(String(family.canonical_id));
    for (const expected of family.products) {
      const actual = productById.get(String(expected.id));
      invariant(actual && actual.name === expected.name && actual.brand === expected.brand && actual.category === expected.category, `product ${expected.id} identity drift`);
      invariant(actual.is_active === true && actual.merged_into_product_id == null && actual.merged_at == null, `product ${expected.id} is no longer active and unmerged`);
      familyByProduct.set(String(expected.id), family);
    }
    invariant(canonical, `canonical ${family.canonical_id} missing`);
    for (const target of family.variants) {
      if (target.existing_variant_id) {
        const actual = variantById.get(String(target.existing_variant_id));
        invariant(actual && String(actual.product_id) === String(family.canonical_id) && actual.is_active === true, `target variant ${target.existing_variant_id} drift`);
        invariant(actual.variant_key === target.variant_key && actual.display_name === target.display_name, `target variant ${target.existing_variant_id} identity drift`);
      } else {
        invariant(!state.variants.some((row) => String(row.product_id) === String(family.canonical_id) && row.variant_key === target.variant_key), `new target ${family.canonical_id}:${target.variant_key} already exists`);
      }
      for (const sourceId of target.source_variant_ids) {
        const source = variantById.get(String(sourceId));
        invariant(source && family.products.some((row) => String(row.id) === String(source.product_id)) && source.is_active === true, `source variant ${sourceId} drift`);
        sourceTargets.set(String(sourceId), { family, target });
      }
    }
  }
  for (const row of [...state.mappings, ...state.offers]) {
    const assignment = sourceTargets.get(String(row.product_variant_id));
    invariant(assignment, `${row.id} points to unassigned source variant ${row.product_variant_id}`);
    invariant(String(assignment.family.canonical_id) === String(familyByProduct.get(String(row.product_id)).canonical_id), `${row.id} crosses family boundaries`);
  }
  const offerByMapping = new Map(state.offers.map((row) => [String(row.retailer_product_id), row]));
  invariant(state.mappings.every((mapping) => {
    const offer = offerByMapping.get(String(mapping.id));
    return offer && String(offer.product_id) === String(mapping.product_id) && String(offer.product_variant_id) === String(mapping.product_variant_id) && String(offer.retailer_id) === String(mapping.retailer_id);
  }), "mapping and offer identities are inconsistent");
  const targetRetailers = new Set();
  for (const mapping of state.mappings) {
    const assignment = sourceTargets.get(String(mapping.product_variant_id));
    const key = `${assignment.family.canonical_id}:${assignment.target.variant_key}:${mapping.retailer_id}`;
    invariant(!targetRetailers.has(key), `target would contain duplicate retailer offer ${key}`);
    targetRetailers.add(key);
    invariant(String(mapping.external_url || "").trim(), `mapping ${mapping.id} source URL missing`);
  }
  invariant(state.offers.every((offer) => String(offer.url || "").trim()), "offer URL missing");
  const decisions = await rows(client, `select id,product_a_id,product_b_id,decision,note from public.ignored_duplicate_product_pairs where decision='deferred' and note=$1 order by id for update`, [plan.decision_meaning.deferred]);
  invariant(decisions.length === plan.expected_review_decision_count, "MERGE FAMILY decision count changed");
  for (const decision of decisions) {
    const left = familyByProduct.get(String(decision.product_a_id));
    const right = familyByProduct.get(String(decision.product_b_id));
    invariant(left && right && left === right, `decision ${decision.id} is not covered by exactly one planned family`);
  }
  const histories = await rows(client, "select candidate_product_id from public.product_merge_history where candidate_product_id=any($1::bigint[])", [ids.candidateIds]);
  invariant(histories.length === 0, "a candidate already has merge history");
  const slugs = plan.families.map((family) => slugify(family.canonical_name));
  invariant(new Set(slugs).size === slugs.length, "planned canonical slugs collide");
  const collisions = await rows(client, "select id,slug from public.products where slug=any($1::text[]) and not(id=any($2::bigint[]))", [slugs, ids.productIds]);
  invariant(collisions.length === 0, "planned canonical slug collides outside reviewed scope");
  return { sourceTargets };
}

async function insertTargets(client, sourceTargets) {
  const targetIds = new Map();
  for (const family of plan.families) {
    for (const target of family.variants) {
      let id = target.existing_variant_id;
      if (!id) {
        const inserted = await rows(client, `insert into public.product_variants
          (product_id,variant_key,display_name,flavour_code,flavour_label,size_value,size_unit,pack_count,product_format,gtin,image,nutrition_override,is_default,is_active)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,null,null,'{}'::jsonb,false,true) returning id`,
          [family.canonical_id, target.variant_key, target.display_name, flavourCode(target.flavour), target.flavour, target.size_value ?? null, target.size_unit ?? null, target.pack_count, target.product_format]);
        id = inserted[0].id;
      }
      targetIds.set(`${family.canonical_id}:${target.variant_key}`, id);
    }
  }
  for (const assignment of sourceTargets.values()) assignment.targetId = targetIds.get(`${assignment.family.canonical_id}:${assignment.target.variant_key}`);
  return targetIds;
}

async function applyFamilies(client, ids, before, sourceTargets) {
  const productById = mapBy(before.products);
  const variantsByProduct = new Map();
  for (const variant of before.variants) {
    const key = String(variant.product_id);
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(variant);
  }
  const mappingsByProduct = new Map();
  const offersByProduct = new Map();
  for (const [rowsValue, destination] of [[before.mappings, mappingsByProduct], [before.offers, offersByProduct]]) {
    for (const row of rowsValue) {
      const key = String(row.product_id);
      if (!destination.has(key)) destination.set(key, []);
      destination.get(key).push(row);
    }
  }
  const historiesByOffer = new Map();
  for (const row of before.histories) historiesByOffer.set(String(row.offer_id), (historiesByOffer.get(String(row.offer_id)) || 0) + 1);
  const mergedAt = new Date().toISOString();
  // Shared parent URLs are protected by a row trigger. Give every reviewed
  // mapping a reversible transaction-local URL identity while its whole family
  // is moved, then restore the exact source URL after all product IDs agree.
  for (const mapping of before.mappings) {
    const separator = String(mapping.external_url).includes("#") ? "&" : "#";
    await client.query("update public.retailer_products set external_url=$1 where id=$2", [`${mapping.external_url}${separator}supplementscout-family-merge=${mapping.id}`, mapping.id]);
  }
  for (const family of plan.families) {
    for (const target of family.variants) {
      const assignment = sourceTargets.get(String(target.source_variant_ids[0]));
      for (const sourceVariantId of target.source_variant_ids) {
        const source = sourceTargets.get(String(sourceVariantId));
        invariant(source.targetId === assignment.targetId, "target assignment drift");
        await client.query("update public.retailer_products set product_id=$1,product_variant_id=$2 where product_variant_id=$3", [family.canonical_id, source.targetId, sourceVariantId]);
        await client.query("update public.offers set product_id=$1,product_variant_id=$2 where product_variant_id=$3", [family.canonical_id, source.targetId, sourceVariantId]);
      }
    }
    for (const candidate of family.products.filter((row) => row.id !== family.canonical_id)) {
      const candidateMappings = mappingsByProduct.get(String(candidate.id)) || [];
      const candidateOffers = offersByProduct.get(String(candidate.id)) || [];
      const offerIds = candidateOffers.map((row) => row.id);
      if (offerIds.length) await client.query("update public.outbound_clicks set product_id=$1 where offer_id=any($2::bigint[])", [family.canonical_id, offerIds]);
      await client.query(`update public.products set slug=slug||'-merged-'||id::text,merged_into_product_id=$1,merged_at=$2,is_active=false where id=$3`, [family.canonical_id, mergedAt, candidate.id]);
      const priceCount = offerIds.reduce((sum, id) => sum + (historiesByOffer.get(String(id)) || 0), 0);
      const snapshot = {
        canonical_before_merge: productById.get(String(family.canonical_id)),
        candidate_before_merge: productById.get(String(candidate.id)),
        candidate_variants_before: variantsByProduct.get(String(candidate.id)) || [],
        candidate_offers_before: candidateOffers,
        candidate_retailer_products_before: candidateMappings,
        candidate_outbound_clicks_before: before.clicks.filter((row) => offerIds.some((id) => String(id) === String(row.offer_id))),
        reviewed_family: family,
        merged_at: mergedAt,
        source: SOURCE,
      };
      await client.query(`insert into public.product_merge_history
        (canonical_product_id,candidate_product_id,merged_at,offers_moved,retailer_products_moved,price_history_preserved,moved_offer_ids,moved_retailer_product_ids,candidate_offer_ids,price_history_offer_ids,snapshot,source)
        values($1,$2,$3,$4,$5,$6,$7::bigint[],$8::bigint[],$7::bigint[],$7::bigint[],$9::jsonb,$10)`,
        [family.canonical_id, candidate.id, mergedAt, candidateOffers.length, candidateMappings.length, priceCount, offerIds, candidateMappings.map((row) => row.id), JSON.stringify(snapshot), SOURCE]);
    }
    await client.query("update public.products set name=$1,slug=$2,category=$3,product_format=$4 where id=$5", [family.canonical_name, slugify(family.canonical_name), family.canonical_category, family.canonical_product_format, family.canonical_id]);
  }
  for (const mapping of before.mappings) {
    await client.query("update public.retailer_products set external_url=$1 where id=$2", [mapping.external_url, mapping.id]);
  }
  for (const remap of plan.separate_decision_remaps) {
    const original = (await rows(client, `select * from public.ignored_duplicate_product_pairs where product_a_id=$1 and product_b_id=$2 and decision='separate' for update`, [remap.from_product_a_id, remap.from_product_b_id]))[0];
    invariant(original, `separate decision ${remap.from_product_a_id}:${remap.from_product_b_id} missing`);
    await client.query(`insert into public.ignored_duplicate_product_pairs(product_a_id,product_b_id,decision,note,ignored_at,updated_at)
      values($1,$2,'separate',$3,coalesce($4,now()),now()) on conflict(product_a_id,product_b_id) do update set decision='separate',note=excluded.note,updated_at=excluded.updated_at`,
      [remap.product_a_id, remap.product_b_id, original.note || `Preserved from separate decision ${original.id} after family consolidation`, original.ignored_at]);
  }
  return { mergedAt };
}

async function validateFinalState(client, ids, before, targetIds) {
  const after = await loadState(client, ids, false);
  const productById = mapBy(after.products);
  for (const family of plan.families) {
    const canonical = productById.get(String(family.canonical_id));
    invariant(canonical?.is_active === true && canonical.merged_into_product_id == null && canonical.name === family.canonical_name && canonical.slug === slugify(family.canonical_name) && canonical.category === family.canonical_category, `canonical ${family.canonical_id} final state mismatch`);
    for (const candidate of family.products.filter((row) => row.id !== family.canonical_id)) {
      const actual = productById.get(String(candidate.id));
      invariant(actual?.is_active === false && String(actual.merged_into_product_id) === String(family.canonical_id), `candidate ${candidate.id} final state mismatch`);
    }
    for (const target of family.variants) {
      const targetId = targetIds.get(`${family.canonical_id}:${target.variant_key}`);
      for (const sourceId of target.source_variant_ids) {
        const mappingRows = before.mappings.filter((row) => String(row.product_variant_id) === String(sourceId));
        const offerRows = before.offers.filter((row) => String(row.product_variant_id) === String(sourceId));
        for (const row of mappingRows) {
          const actual = after.mappings.find((item) => String(item.id) === String(row.id));
          invariant(actual && String(actual.product_id) === String(family.canonical_id) && String(actual.product_variant_id) === String(targetId), `mapping ${row.id} final target mismatch`);
        }
        for (const row of offerRows) {
          const actual = after.offers.find((item) => String(item.id) === String(row.id));
          invariant(actual && String(actual.product_id) === String(family.canonical_id) && String(actual.product_variant_id) === String(targetId), `offer ${row.id} final target mismatch`);
        }
      }
    }
  }
  invariant(after.mappings.length === before.mappings.length && after.offers.length === before.offers.length && after.histories.length === before.histories.length && after.clicks.length === before.clicks.length, "evidence row counts changed");
  const clickBefore = new Map(before.clicks.map((row) => [String(row.id), withoutProductId(row)]));
  invariant(after.clicks.every((row) => canonicalJson(withoutProductId(row)) === canonicalJson(clickBefore.get(String(row.id)))), "outbound click evidence changed unexpectedly");
  const historyBefore = new Map(before.histories.map((row) => [String(row.id), row]));
  invariant(after.histories.every((row) => canonicalJson(row) === canonicalJson(historyBefore.get(String(row.id)))), "price history evidence changed unexpectedly");
  const mergeRows = await rows(client, "select candidate_product_id from public.product_merge_history where candidate_product_id=any($1::bigint[]) and source=$2", [ids.candidateIds, SOURCE]);
  invariant(mergeRows.length === ids.candidateIds.length, "merge history coverage mismatch");
  for (const remap of plan.separate_decision_remaps) {
    const result = await rows(client, "select decision from public.ignored_duplicate_product_pairs where product_a_id=$1 and product_b_id=$2", [remap.product_a_id, remap.product_b_id]);
    invariant(result[0]?.decision === "separate", "separate decision remap missing");
  }
  return after;
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const ids = validatePlan();
  if (options.mode === "apply") invariant(options.confirm === confirmation(), `apply requires --confirm=${confirmation()}`);
  const env = loadEnvFile(path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env"));
  invariant(env[CONTRACT.projectRefEnvironmentKey] === CONTRACT.projectRef, "production environment file mismatch");
  const client = new Client({ connectionString: env[CONTRACT.databaseUrlEnvironmentKey], ssl: { rejectUnauthorized: false }, application_name: "supplementscout-reviewed-family-consolidation-v1" });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query("set constraints all deferred");
    await client.query("select pg_advisory_xact_lock(hashtextextended('supplementscout:reviewed-family-consolidation-v1',0))");
    await assertTarget(client);
    const countsBefore = await catalogueCounts(client);
    const before = await loadState(client, ids, true);
    if (options.mode === "verify") {
      invariant(before.products.filter((row) => row.is_active).length === plan.expected_family_count, "verification active family count mismatch");
      console.log(JSON.stringify({ result: "PASS", mode: options.mode, confirmation: confirmation(), family_count: plan.expected_family_count, candidate_count: plan.expected_candidate_count }, null, 2));
      await client.query("rollback");
      open = false;
      return;
    }
    const { sourceTargets } = await validateInitialState(client, ids, before);
    const targetIds = await insertTargets(client, sourceTargets);
    await applyFamilies(client, ids, before, sourceTargets);
    await validateFinalState(client, ids, before, targetIds);
    const countsAfter = await catalogueCounts(client);
    invariant(Number(countsAfter.products) === Number(countsBefore.products), "product count changed");
    invariant(Number(countsAfter.product_variants) === Number(countsBefore.product_variants) + plan.expected_created_variant_count, "variant count delta mismatch");
    invariant(Number(countsAfter.retailer_products) === Number(countsBefore.retailer_products) && Number(countsAfter.offers) === Number(countsBefore.offers) && Number(countsAfter.price_history) === Number(countsBefore.price_history), "catalogue evidence counts changed");
    if (options.mode === "apply") await client.query("commit"); else await client.query("rollback");
    open = false;
    console.log(JSON.stringify({ result: "PASS", mode: options.mode, confirmation: confirmation(), family_count: plan.expected_family_count, merged_product_count: plan.expected_candidate_count, created_variant_count: plan.expected_created_variant_count, preserved_mapping_count: plan.expected_mapping_count, preserved_offer_count: plan.expected_offer_count, target_variant_ids: Object.fromEntries(targetIds), catalogue_counts_before: countsBefore, catalogue_counts_after: countsAfter, committed: options.mode === "apply" }, null, 2));
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { canonicalJson, confirmation, parseArgs, slugify, validatePlan };
