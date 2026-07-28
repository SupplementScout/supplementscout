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
const REVIEWER = "admin-family-correction-v1";
const PLAN = Object.freeze([
  family(18, "5017", "APPROVE_NEW_PRODUCT", 18, "Applied Nutrition Flavo Drops 38ml", "Chocolate"),
  family(20, "5024", "APPROVE_NEW_PRODUCT", 18, "Applied Nutrition Flavo Drops 38ml", "Raspberry"),
  family(21, "5025", "APPROVE_NEW_PRODUCT", 18, "Applied Nutrition Flavo Drops 38ml", "Strawberry"),
  family(23, "5129", "APPROVE_NEW_PRODUCT", 23, "BioTechUSA Zero Syrup", "Chocolate"),
  family(25, "5133", "APPROVE_NEW_PRODUCT", 23, "BioTechUSA Zero Syrup", "Strawberry"),
  exact(27, "5232", "APPROVE_NEW_PRODUCT", 1076, 2307),
  family(29, "5251", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Mayo"),
  family(31, "5256", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Curry Mango"),
  family(33, "5261", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Peri-Peri"),
  family(35, "5264", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Curry Ketchup"),
  family(37, "5276", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Strawberry"),
  family(39, "5280", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Chocolate"),
  family(42, "6011", "APPROVE_NEW_PRODUCT", 29, "Callowfit Sauce 300ml", "Cookies & Cream"),
  existingVariant(52, "7194", "DEFER_POLICY", 364, "Raspberry"),
  existingVariant(53, "7196", "DEFER_POLICY", 364, "Strawberry"),
  existingVariant(75, "30081", "DEFER_POLICY", 364, "Gooseberry & Kiwi"),
  family(77, "31014", "DEFER_POLICY", 77, "ALLNUTRITION Nutlove Sauce 280g", "White Chocolate with Peanuts"),
  family(78, "31023", "DEFER_POLICY", 77, "ALLNUTRITION Nutlove Sauce 280g", "Cinnamon Cookie"),
  family(80, "31035", "DEFER_POLICY", 77, "ALLNUTRITION Nutlove Sauce 280g", "Crunchy Chocolate & Peanuts"),
  existingVariant(99, "6583", "DEFER_POLICY", 424, "Chocolate Coconut"),
  existingVariant(101, "6585", "DEFER_POLICY", 424, "Cinnamon Cereal"),
  existingVariant(103, "6587", "DEFER_POLICY", 424, "Strawberry Cheesecake"),
]);

function family(id, sourceRecordId, expectedDecision, seedId, familyName, variantName) {
  return {
    id,
    sourceRecordId,
    expectedDecision,
    kind: id === seedId ? "family-seed" : "family-variant",
    seedId,
    familyName,
    variantName,
  };
}

function existingVariant(
  id,
  sourceRecordId,
  expectedDecision,
  productId,
  variantName
) {
  return {
    id,
    sourceRecordId,
    expectedDecision,
    kind: "existing-product-variant",
    productId,
    variantName,
  };
}

function exact(
  id,
  sourceRecordId,
  expectedDecision,
  productId,
  variantId
) {
  return {
    id,
    sourceRecordId,
    expectedDecision,
    kind: "existing-variant",
    productId,
    variantId,
  };
}

function invariant(value, message) {
  if (!value) throw new Error(message);
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
  const identity = (await client.query(`
    select current_user,current_setting('app.safe_update',true) safe_update
  `)).rows[0];
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
  const ids = PLAN.map(({ id }) => id);
  const { rows } = await client.query(
    `select id,snapshot_id,source_record_id,retailer,decision,consumed_at
       from public.product_match_review_queue
      where id = any($1::bigint[])
      order by id
      for update`,
    [ids]
  );
  invariant(rows.length === PLAN.length, "review row count changed");
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  for (const planned of PLAN) {
    const row = byId.get(String(planned.id));
    invariant(row, `review row ${planned.id} is missing`);
    invariant(row.snapshot_id === SNAPSHOT_ID, `snapshot changed for row ${planned.id}`);
    invariant(row.retailer === RETAILER, `retailer changed for row ${planned.id}`);
    invariant(
      row.source_record_id === planned.sourceRecordId,
      `source identity changed for row ${planned.id}`
    );
    invariant(
      row.decision === planned.expectedDecision,
      `decision changed for row ${planned.id}`
    );
    invariant(row.consumed_at === null, `row ${planned.id} was already consumed`);
  }
}

async function validateCanonicalTargets(client) {
  const productIds = [...new Set(
    PLAN.filter((row) => row.productId).map((row) => row.productId)
  )];
  const variantIds = PLAN.filter((row) => row.variantId).map((row) => row.variantId);
  const products = (await client.query(
    `select id from public.products
      where id = any($1::bigint[])
        and is_active is true
        and merged_into_product_id is null`,
    [productIds]
  )).rows;
  invariant(products.length === productIds.length, "canonical product target changed");
  const variants = variantIds.length
    ? (await client.query(
        `select id,product_id from public.product_variants
          where id = any($1::bigint[]) and is_active is true`,
        [variantIds]
      )).rows
    : [];
  for (const planned of PLAN.filter((row) => row.variantId)) {
    invariant(
      variants.some(
        (variant) =>
          String(variant.id) === String(planned.variantId) &&
          String(variant.product_id) === String(planned.productId)
      ),
      `canonical variant target changed for row ${planned.id}`
    );
  }
}

async function applyPlan(client) {
  const now = new Date().toISOString();
  for (const row of PLAN.filter(({ kind }) => kind === "family-seed")) {
    await client.query(
      `update public.product_match_review_queue
          set decision='APPROVE_NEW_FAMILY_SEED',
              selected_canonical_product_id=null,
              selected_canonical_variant_id=null,
              selected_family_seed_review_item_id=id,
              proposed_family_name=$2,
              proposed_variant_name=$3,
              reviewer_notes='Corrected from separate product to reviewed flavour family.',
              reviewed_by=$4,reviewed_at=$5,updated_at=$5
        where id=$1`,
      [row.id, row.familyName, row.variantName, REVIEWER, now]
    );
  }
  for (const row of PLAN.filter(({ kind }) => kind === "family-variant")) {
    await client.query(
      `update public.product_match_review_queue
          set decision='APPROVE_NEW_VARIANT_SEED',
              selected_canonical_product_id=null,
              selected_canonical_variant_id=null,
              selected_family_seed_review_item_id=$2,
              proposed_family_name=$3,
              proposed_variant_name=$4,
              reviewer_notes='Corrected from separate product to reviewed flavour variant.',
              reviewed_by=$5,reviewed_at=$6,updated_at=$6
        where id=$1`,
      [row.id, row.seedId, row.familyName, row.variantName, REVIEWER, now]
    );
  }
  for (const row of PLAN.filter(({ kind }) => kind === "existing-product-variant")) {
    await client.query(
      `update public.product_match_review_queue
          set decision='APPROVE_NEW_VARIANT_SEED',
              selected_canonical_product_id=$2,
              selected_canonical_variant_id=null,
              selected_family_seed_review_item_id=null,
              proposed_family_name=null,
              proposed_variant_name=$3,
              reviewer_notes='Corrected to a new flavour under the reviewed existing product.',
              reviewed_by=$4,reviewed_at=$5,updated_at=$5
        where id=$1`,
      [row.id, row.productId, row.variantName, REVIEWER, now]
    );
  }
  for (const row of PLAN.filter(({ kind }) => kind === "existing-variant")) {
    await client.query(
      `update public.product_match_review_queue
          set decision='APPROVE_EXISTING_VARIANT',
              selected_canonical_product_id=$2,
              selected_canonical_variant_id=$3,
              selected_family_seed_review_item_id=null,
              proposed_family_name=null,
              proposed_variant_name=null,
              reviewer_notes='Corrected to the exact existing canonical flavour variant.',
              reviewed_by=$4,reviewed_at=$5,updated_at=$5
        where id=$1`,
      [row.id, row.productId, row.variantId, REVIEWER, now]
    );
  }
}

async function validateResult(client) {
  const { rows } = await client.query(
    `select id,decision,selected_canonical_product_id,
            selected_canonical_variant_id,selected_family_seed_review_item_id,
            proposed_family_name,proposed_variant_name
       from public.product_match_review_queue
      where id = any($1::bigint[])`,
    [PLAN.map(({ id }) => id)]
  );
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  for (const planned of PLAN) {
    const row = byId.get(String(planned.id));
    const expectedDecision =
      planned.kind === "family-seed"
        ? "APPROVE_NEW_FAMILY_SEED"
        : planned.kind === "existing-variant"
          ? "APPROVE_EXISTING_VARIANT"
          : "APPROVE_NEW_VARIANT_SEED";
    invariant(row?.decision === expectedDecision, `result mismatch for row ${planned.id}`);
  }
  return {
    corrected_rows: rows.length,
    new_family_seeds: rows.filter(
      (row) => row.decision === "APPROVE_NEW_FAMILY_SEED"
    ).length,
    new_family_variants: rows.filter(
      (row) =>
        row.decision === "APPROVE_NEW_VARIANT_SEED" &&
        row.selected_family_seed_review_item_id !== null
    ).length,
    existing_product_variants: rows.filter(
      (row) =>
        row.decision === "APPROVE_NEW_VARIANT_SEED" &&
        row.selected_canonical_product_id !== null
    ).length,
    exact_existing_variants: rows.filter(
      (row) => row.decision === "APPROVE_EXISTING_VARIANT"
    ).length,
  };
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const envFile = path.join(
    process.env.USERPROFILE || "",
    ".supplementscout",
    "credentials",
    "production-owner.env"
  );
  const env = loadEnvFile(envFile);
  invariant(
    env[CONTRACT.projectRefEnvironmentKey] === CONTRACT.projectRef,
    "production environment file mismatch"
  );
  const client = new Client({
    connectionString: env[CONTRACT.databaseUrlEnvironmentKey],
    ssl: { rejectUnauthorized: false },
    application_name: "supplementscout-six-pack-family-correction",
  });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('supplementscout:six-pack-family-correction-v1',0))"
    );
    await assertTarget(client);
    await lockAndValidateRows(client);
    await validateCanonicalTargets(client);
    const beforeCounts = await catalogueCounts(client);
    await applyPlan(client);
    const reviewResult = await validateResult(client);
    const afterCounts = await catalogueCounts(client);
    invariant(
      JSON.stringify(beforeCounts) === JSON.stringify(afterCounts),
      "catalogue counts changed during review correction"
    );
    if (options.mode === "apply") {
      await client.query("commit");
    } else {
      await client.query("rollback");
    }
    open = false;
    console.log(JSON.stringify({
      result: "PASS",
      mode: options.mode,
      confirmation: confirmation(),
      ...reviewResult,
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
