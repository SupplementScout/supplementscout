const crypto = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const {
  catalogueCounts,
  loadEnvFile,
} = require("./apply-selected-migrations");
const {
  CONTRACTS,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

const CONTRACT = CONTRACTS.PRODUCTION;
const SNAPSHOT_ID =
  "3da223519802bf0a786c20936d027fadb3be86b51954fc3fa11416127c3c3ae2";
const RETAILER = "6 Pack Supplements";
const REVIEWER = "admin-six-pack-final-closeout-v1";

const PLAN = Object.freeze([
  family("29091", "DEFER_POLICY", "29091", "Skull Labs Angel Dust PUMP Pre-Workout", "Watermelon Explosion"),
  family("29094", "REJECT_IDENTITY", "29091", "Skull Labs Angel Dust PUMP Pre-Workout", "Blue Raspberry Attack"),
  family("29097", "REJECT_IDENTITY", "29091", "Skull Labs Angel Dust PUMP Pre-Workout", "Crazy Lychee"),
  family("29475", "APPROVE_NEW_VARIANT_SEED", "29496", "Applied Nutition High Protein Shake 500ml", "Double Chocolate / 1 Bottle"),
  family("29478", "DEFER_POLICY", "29496", "Applied Nutition High Protein Shake 500ml", "Double Chocolate / 8-Pack"),
  family("29481", "APPROVE_NEW_VARIANT_SEED", "29496", "Applied Nutition High Protein Shake 500ml", "Strawberries & Cream / 1 Bottle"),
  family("29484", "DEFER_POLICY", "29496", "Applied Nutition High Protein Shake 500ml", "Strawberries & Cream / 8-Pack"),
  family("29496", "APPROVE_NEW_FAMILY_SEED", "29496", "Applied Nutition High Protein Shake 500ml", "Vanilla Ice Cream / 1 Bottle"),
  family("29499", "DEFER_POLICY", "29496", "Applied Nutition High Protein Shake 500ml", "Vanilla Ice Cream / 8-Pack"),
  family("29505", "APPROVE_NEW_VARIANT_SEED", "29496", "Applied Nutition High Protein Shake 500ml", "Banana Delight / 1 Bottle"),
  family("29508", "APPROVE_NEW_VARIANT_SEED", "29496", "Applied Nutition High Protein Shake 500ml", "Banana Delight / 8-Pack"),
  classification("29820", "DEFER_POLICY", "REJECT_IDENTITY", "Source-corrupt flavour alias of the already automated unflavoured Vegan Multivitamin."),
  classification("29823", "DEFER_POLICY", "REJECT_IDENTITY", "Source-corrupt flavour alias of the already automated unflavoured Vegan Multivitamin."),
  classification("29826", "REJECT_IDENTITY", "REJECT_IDENTITY", "Source-corrupt flavour alias of the already automated unflavoured Vegan Multivitamin."),
  existingVariant("30078", "DEFER_POLICY", 364, "Blueberry"),
  existingVariant("30084", "DEFER_POLICY", 364, "Mango"),
  classification("31152", "REJECT_IDENTITY", "DEFER_POLICY", "Owner-confirmed deferred Vitamin D3 8000 IU product."),
  existingVariant("31389", "APPROVE_EXISTING_VARIANT", 181, "1 Bottle"),
  existingVariant("31392", "DEFER_POLICY", 181, "3 Bottles"),
  existingVariant("31395", "DEFER_POLICY", 181, "6 Bottles"),
  exact("32571", "DEFER_POLICY", 328, 1970),
  exact("4642", "APPROVE_EXISTING_VARIANT", 1094, 2375),
  existingVariant("5247", "APPROVE_NEW_VARIANT_SEED", 1120, "Fancy Garlic"),
  existingVariant("5253", "APPROVE_NEW_VARIANT_SEED", 1120, "Honey Mustard"),
  existingVariant("5259", "APPROVE_NEW_VARIANT_SEED", 1120, "Sweet Chilli"),
  existingVariant("5263", "APPROVE_NEW_VARIANT_SEED", 1120, "Tomato Ketchup"),
  existingVariant("5273", "APPROVE_NEW_VARIANT_SEED", 1120, "Salty Caramel"),
  existingVariant("5278", "APPROVE_NEW_VARIANT_SEED", 1120, "Raspberry"),
  existingVariant("6005", "APPROVE_NEW_VARIANT_SEED", 1120, "Vanilla Style"),
  existingVariant("6008", "APPROVE_NEW_VARIANT_SEED", 1120, "Cesar Style Dressing"),
  exact("6286", "APPROVE_NEW_VARIANT_SEED", 1076, 2308),
  exact("6301", "APPROVE_NEW_VARIANT_SEED", 1076, 2306),
  newProduct("6740", "APPROVE_NEW_VARIANT_SEED"),
  existingVariant("69814", "DEFER_POLICY", 506, "Cola Blast"),
  existingVariant("7191", "DEFER_POLICY", 364, "Cherry"),
]);

function family(sourceRecordId, expectedDecision, seedSourceRecordId, familyName, variantName) {
  return { sourceRecordId, expectedDecision, kind: sourceRecordId === seedSourceRecordId ? "family-seed" : "family-variant", seedSourceRecordId, familyName, variantName };
}

function existingVariant(sourceRecordId, expectedDecision, productId, variantName) {
  return { sourceRecordId, expectedDecision, kind: "existing-product-variant", productId, variantName };
}

function exact(sourceRecordId, expectedDecision, productId, variantId) {
  return { sourceRecordId, expectedDecision, kind: "existing-variant", productId, variantId };
}

function classification(sourceRecordId, expectedDecision, decision, note) {
  return { sourceRecordId, expectedDecision, kind: "classification", decision, note };
}

function newProduct(sourceRecordId, expectedDecision) {
  return { sourceRecordId, expectedDecision, kind: "new-product" };
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function targetDecision(row) {
  if (row.kind === "family-seed") return "APPROVE_NEW_FAMILY_SEED";
  if (row.kind === "family-variant" || row.kind === "existing-product-variant") {
    return "APPROVE_NEW_VARIANT_SEED";
  }
  if (row.kind === "existing-variant") return "APPROVE_EXISTING_VARIANT";
  if (row.kind === "new-product") return "APPROVE_NEW_PRODUCT";
  return row.decision;
}

function confirmation() {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ snapshot: SNAPSHOT_ID, retailer: RETAILER, plan: PLAN }))
    .digest("hex")
    .slice(0, 16);
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(mode|target|confirm)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(values.target === "production", "target must be production");
  invariant(["rehearse", "apply"].includes(values.mode), "mode must be rehearse or apply");
  if (values.mode === "apply") {
    invariant(values.confirm === confirmation(), `apply confirmation must equal ${confirmation()}`);
  } else {
    invariant(values.confirm === undefined, "rehearsal does not accept confirmation");
  }
  return values;
}

async function assertTarget(client) {
  const identity = (await client.query(
    "select current_user,current_setting('app.safe_update',true) safe_update"
  )).rows[0];
  validateDatabaseOwner(CONTRACT, identity);
  invariant(!identity.safe_update, "database SAFE_UPDATE must be unset");
  const target = (await client.query(
    "select public.retailer_catalogue_actual_database_target() target"
  )).rows[0].target;
  invariant(
    target.target_environment === "PRODUCTION" &&
      target.project_ref === CONTRACT.projectRef &&
      target.database_identity === CONTRACT.databaseIdentity,
    "production database identity mismatch"
  );
}

async function lockAndValidateRows(client) {
  const sourceIds = PLAN.map((row) => row.sourceRecordId);
  const rows = (await client.query(
    `select id,snapshot_id,source_record_id,retailer,decision,consumed_at
       from public.product_match_review_queue
      where snapshot_id=$1 and source_record_id=any($2::text[])
      order by id for update`,
    [SNAPSHOT_ID, sourceIds]
  )).rows;
  invariant(rows.length === PLAN.length, "review row count changed");
  const bySource = new Map(rows.map((row) => [String(row.source_record_id), row]));
  for (const planned of PLAN) {
    const row = bySource.get(planned.sourceRecordId);
    invariant(row, `review row ${planned.sourceRecordId} is missing`);
    invariant(row.retailer === RETAILER, `retailer changed for ${planned.sourceRecordId}`);
    invariant(
      [planned.expectedDecision, targetDecision(planned)].includes(row.decision),
      `decision changed for ${planned.sourceRecordId}`
    );
    invariant(row.consumed_at === null, `review row ${planned.sourceRecordId} was consumed`);
  }
  return bySource;
}

async function validateCanonicalTargets(client) {
  const productIds = [...new Set(PLAN.filter((row) => row.productId).map((row) => row.productId))];
  const variantIds = PLAN.filter((row) => row.variantId).map((row) => row.variantId);
  const products = (await client.query(
    `select id from public.products where id=any($1::bigint[])
      and is_active is true and merged_into_product_id is null`,
    [productIds]
  )).rows;
  invariant(products.length === productIds.length, "canonical product target changed");
  const variants = variantIds.length
    ? (await client.query(
        "select id,product_id from public.product_variants where id=any($1::bigint[]) and is_active is true",
        [variantIds]
      )).rows
    : [];
  for (const planned of PLAN.filter((row) => row.variantId)) {
    invariant(
      variants.some((row) => String(row.id) === String(planned.variantId) && String(row.product_id) === String(planned.productId)),
      `canonical variant target changed for ${planned.sourceRecordId}`
    );
  }
}

async function applyPlan(client, rowsBySource) {
  const now = new Date().toISOString();
  const seedIds = new Map(
    PLAN.filter((row) => row.kind === "family-seed").map((row) => [
      row.sourceRecordId,
      rowsBySource.get(row.sourceRecordId).id,
    ])
  );
  for (const row of PLAN) {
    const id = rowsBySource.get(row.sourceRecordId).id;
    try {
      if (row.kind === "family-seed" || row.kind === "family-variant") {
      const seedId = seedIds.get(row.seedSourceRecordId);
      invariant(seedId, `family seed missing for ${row.sourceRecordId}`);
      await client.query(
        `update public.product_match_review_queue
            set decision=$2,selected_canonical_product_id=null,
                selected_canonical_variant_id=null,
                selected_family_seed_review_item_id=$3,
                proposed_family_name=$4,proposed_variant_name=$5,
                reviewer_notes='Corrected during final Six Pack catalogue closeout.',
                reviewed_by=$6,reviewed_at=$7,updated_at=$7
          where id=$1`,
        [id, row.kind === "family-seed" ? "APPROVE_NEW_FAMILY_SEED" : "APPROVE_NEW_VARIANT_SEED", seedId, row.familyName, row.variantName, REVIEWER, now]
      );
      } else if (row.kind === "existing-product-variant") {
      await client.query(
        `update public.product_match_review_queue
            set decision='APPROVE_NEW_VARIANT_SEED',
                selected_canonical_product_id=$2,selected_canonical_variant_id=null,
                selected_family_seed_review_item_id=null,
                proposed_family_name=null,proposed_variant_name=$3,
                reviewer_notes='Corrected to a reviewed variant of the existing canonical product.',
                reviewed_by=$4,reviewed_at=$5,updated_at=$5
          where id=$1`,
        [id, row.productId, row.variantName, REVIEWER, now]
      );
      } else if (row.kind === "existing-variant") {
      await client.query(
        `update public.product_match_review_queue
            set decision='APPROVE_EXISTING_VARIANT',
                selected_canonical_product_id=$2,selected_canonical_variant_id=$3,
                selected_family_seed_review_item_id=null,
                proposed_family_name=null,proposed_variant_name=null,
                reviewer_notes='Corrected to the exact existing canonical variant.',
                reviewed_by=$4,reviewed_at=$5,updated_at=$5
          where id=$1`,
        [id, row.productId, row.variantId, REVIEWER, now]
      );
      } else if (row.kind === "new-product") {
        await client.query(
          `update public.product_match_review_queue
              set decision='APPROVE_NEW_PRODUCT',
                  selected_canonical_product_id=null,
                  selected_canonical_variant_id=null,
                  selected_family_seed_review_item_id=null,
                  proposed_family_name=null,proposed_variant_name=null,
                  reviewer_notes='Confirmed as a separate canonical pack-size product.',
                  reviewed_by=$2,reviewed_at=$3,updated_at=$3
            where id=$1`,
          [id, REVIEWER, now]
        );
      } else {
      await client.query(
        `update public.product_match_review_queue
            set decision=$2,selected_canonical_product_id=null,
                selected_canonical_variant_id=null,
                selected_family_seed_review_item_id=null,
                proposed_family_name=null,proposed_variant_name=null,
                reviewer_notes=$3,reviewed_by=$4,reviewed_at=$5,updated_at=$5
          where id=$1`,
        [id, row.decision, row.note, REVIEWER, now]
      );
      }
    } catch (error) {
      throw new Error(`correction failed for source ${row.sourceRecordId}: ${error.message}`);
    }
  }
}

async function validateResult(client) {
  const rows = (await client.query(
    `select source_record_id,decision,selected_canonical_product_id,
            selected_canonical_variant_id,selected_family_seed_review_item_id,
            proposed_variant_name
       from public.product_match_review_queue
      where snapshot_id=$1 and source_record_id=any($2::text[])`,
    [SNAPSHOT_ID, PLAN.map((row) => row.sourceRecordId)]
  )).rows;
  invariant(rows.length === PLAN.length, "corrected result scope changed");
  return {
    corrected_rows: rows.length,
    family_rows: rows.filter((row) => row.selected_family_seed_review_item_id !== null).length,
    existing_product_variant_rows: rows.filter((row) => row.decision === "APPROVE_NEW_VARIANT_SEED" && row.selected_canonical_product_id !== null).length,
    exact_existing_variant_rows: rows.filter((row) => row.decision === "APPROVE_EXISTING_VARIANT").length,
    source_alias_rows: rows.filter((row) => row.decision === "REJECT_IDENTITY" && ["29820", "29823", "29826"].includes(String(row.source_record_id))).length,
    deferred_rows: rows.filter((row) => row.decision === "DEFER_POLICY").length,
  };
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const env = loadEnvFile(
    path.join(process.env.USERPROFILE || "", ".supplementscout", "credentials", "production-owner.env")
  );
  invariant(
    env[CONTRACT.projectRefEnvironmentKey] === CONTRACT.projectRef,
    "production environment file mismatch"
  );
  const client = new Client({
    connectionString: env[CONTRACT.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-six-pack-final-closeout-decisions",
  });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('supplementscout:six-pack-final-closeout-v1',0))"
    );
    await assertTarget(client);
    const rowsBySource = await lockAndValidateRows(client);
    await validateCanonicalTargets(client);
    const beforeCounts = await catalogueCounts(client);
    await applyPlan(client, rowsBySource);
    const result = await validateResult(client);
    const afterCounts = await catalogueCounts(client);
    invariant(JSON.stringify(beforeCounts) === JSON.stringify(afterCounts), "catalogue counts changed");
    if (options.mode === "apply") await client.query("commit");
    else await client.query("rollback");
    open = false;
    console.log(JSON.stringify({
      result: "PASS",
      mode: options.mode,
      confirmation: confirmation(),
      ...result,
      catalogue_counts_before: beforeCounts,
      catalogue_counts_after: afterCounts,
      catalogue_writes: 0,
      committed: options.mode === "apply",
    }, null, 2));
  } catch (error) {
    if (open) await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { PLAN, confirmation, parseArgs };
