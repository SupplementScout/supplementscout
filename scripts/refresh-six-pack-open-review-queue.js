const crypto = require("node:crypto");
const path = require("node:path");
const { Client } = require("pg");
const {
  catalogueCounts,
  loadEnvFile,
} = require("./apply-selected-migrations");
const {
  databaseRow,
  readArtifact,
} = require("./publish-product-match-review-queue");
const {
  CONTRACTS,
  validateDatabaseOwner,
} = require("./supabase-migration-selector");

const CONTRACT = CONTRACTS.PRODUCTION;
const RETAILER = "6 Pack Supplements";
const ANIMAL_FLEX = Object.freeze({
  reviewItemId: 2,
  sourceRecordId: "3087",
  expectedDecision: "DEFER_POLICY",
  productId: 956,
  variantId: 1863,
});

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(input|mode|target|confirm)=(.+)$/);
    invariant(match && values[match[1]] === undefined, `invalid argument ${argument}`);
    values[match[1]] = match[2];
  }
  invariant(values.target === "production", "target must be production");
  invariant(["rehearse", "apply"].includes(values.mode), "mode must be rehearse or apply");
  invariant(values.input, "input review artifact is required");
  const input = path.resolve(values.input);
  const root = path.resolve(__dirname, "..", "tmp");
  invariant(
    input.startsWith(`${root}${path.sep}`),
    "input review artifact must remain inside tmp"
  );
  return { ...values, input };
}

function confirmation(artifact) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      artifact_fingerprint: artifact.artifact_fingerprint,
      animal_flex: ANIMAL_FLEX,
      operation: "refresh-open-only-and-correct-animal-flex-v1",
    }))
    .digest("hex")
    .slice(0, 16);
}

function stableSource(row) {
  return {
    source_record_id: String(row.source_record_id),
    retailer: String(row.retailer),
    product_title: String(row.product_title),
    variant_title: row.variant_title == null ? "" : String(row.variant_title),
    source_sku: row.source_sku == null ? "" : String(row.source_sku),
    source_gtin: row.source_gtin == null ? "" : String(row.source_gtin),
    source_weight: row.source_weight == null ? "" : String(row.source_weight),
    source_price:
      row.source_price == null || row.source_price === ""
        ? ""
        : Number(row.source_price).toFixed(2),
    source_url: row.source_url == null ? "" : String(row.source_url),
  };
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

async function mappedSourceIds(client) {
  const retailer = (await client.query(
    "select id from public.retailers where name=$1",
    [RETAILER]
  )).rows;
  invariant(retailer.length === 1, "expected one 6 Pack retailer");
  const mappings = (await client.query(
    `select external_product_id,external_variant_id
       from public.retailer_products
      where retailer_id=$1`,
    [retailer[0].id]
  )).rows;
  const ids = new Set();
  for (const mapping of mappings) {
    if (mapping.external_product_id) ids.add(String(mapping.external_product_id));
    if (mapping.external_variant_id) ids.add(String(mapping.external_variant_id));
  }
  return ids;
}

function verifyStoredSourceFingerprint(row) {
  const prepared = databaseRow(
    {
      review_item_id: row.review_item_id,
      snapshot_id: row.snapshot_id,
      source_record_id: row.source_record_id,
      retailer: row.retailer,
      product_title: row.product_title,
      variant_title: row.variant_title,
      primary_status: row.primary_status,
      reason_codes: row.reason_codes,
      confidence: row.confidence,
      canonical_candidates: row.canonical_candidates,
      source_sku: row.source_sku,
      source_gtin: row.source_gtin,
      source_weight: row.source_weight,
      source_price: row.source_price,
      source_url: row.source_url,
      suggested_action: row.suggested_action,
    },
    row.artifact_fingerprint
  );
  invariant(
    prepared.source_row_fingerprint === row.source_row_fingerprint,
    `stored source fingerprint drift: ${row.review_item_id}`
  );
}

async function refreshOpenRows(client, artifact) {
  const mapped = await mappedSourceIds(client);
  const prepared = artifact.rows
    .map((row) => databaseRow(row, artifact.artifact_fingerprint))
    .filter((row) => !mapped.has(String(row.source_record_id)));
  const current = (await client.query(
    `select *
       from public.product_match_review_queue
      where snapshot_id=$1
      order by id
      for update`,
    [artifact.snapshot_id]
  )).rows;
  invariant(current.length === prepared.length, "review queue scope changed");
  const currentByItem = new Map(
    current.map((row) => [String(row.review_item_id), row])
  );
  const preparedByItem = new Map(
    prepared.map((row) => [String(row.review_item_id), row])
  );
  let refreshed = 0;
  let preserved = 0;
  for (const row of current) {
    verifyStoredSourceFingerprint(row);
    const next = preparedByItem.get(String(row.review_item_id));
    invariant(next, `refreshed review item missing: ${row.review_item_id}`);
    invariant(
      JSON.stringify(stableSource(row)) === JSON.stringify(stableSource(next)),
      `source identity changed: ${row.review_item_id}`
    );
    if (row.decision !== "PENDING") {
      preserved += 1;
      continue;
    }
    const result = await client.query(
      `update public.product_match_review_queue
          set primary_status=$2,reason_codes=$3,confidence=$4,
              canonical_candidates=$5::jsonb,suggested_action=$6,
              source_row_fingerprint=$7,artifact_fingerprint=$8,
              updated_at=now()
        where id=$1 and decision='PENDING' and consumed_at is null`,
      [
        row.id,
        next.primary_status,
        next.reason_codes,
        next.confidence,
        JSON.stringify(next.canonical_candidates),
        next.suggested_action,
        next.source_row_fingerprint,
        next.artifact_fingerprint,
      ]
    );
    invariant(result.rowCount === 1, `open review row changed: ${row.review_item_id}`);
    refreshed += 1;
  }
  invariant(currentByItem.size === preparedByItem.size, "review identity set changed");
  return { refreshed, preserved, total: current.length };
}

async function correctAnimalFlex(client) {
  const row = (await client.query(
    `select id,source_record_id,decision,consumed_at
       from public.product_match_review_queue
      where id=$1
      for update`,
    [ANIMAL_FLEX.reviewItemId]
  )).rows[0];
  invariant(row, "Animal Flex review row missing");
  invariant(
    String(row.source_record_id) === ANIMAL_FLEX.sourceRecordId &&
      row.decision === ANIMAL_FLEX.expectedDecision &&
      row.consumed_at === null,
    "Animal Flex review decision changed"
  );
  const target = (await client.query(
    `select p.id product_id,v.id variant_id
       from public.products p
       join public.product_variants v on v.product_id=p.id
      where p.id=$1 and v.id=$2
        and p.is_active is true
        and p.merged_into_product_id is null
        and v.is_active is true`,
    [ANIMAL_FLEX.productId, ANIMAL_FLEX.variantId]
  )).rows;
  invariant(target.length === 1, "Animal Flex canonical target changed");
  const update = await client.query(
    `update public.product_match_review_queue
        set decision='APPROVE_EXISTING_VARIANT',
            selected_canonical_product_id=$2,
            selected_canonical_variant_id=$3,
            selected_family_seed_review_item_id=null,
            proposed_family_name=null,proposed_variant_name=null,
            reviewer_notes='Matched through Universal Nutrition / Animal brand family and existing Fit House offer.',
            reviewed_by='admin-alias-refresh-v1',
            reviewed_at=now(),updated_at=now()
      where id=$1 and decision=$4 and consumed_at is null`,
    [
      ANIMAL_FLEX.reviewItemId,
      ANIMAL_FLEX.productId,
      ANIMAL_FLEX.variantId,
      ANIMAL_FLEX.expectedDecision,
    ]
  );
  invariant(update.rowCount === 1, "Animal Flex correction was not applied");
}

async function main(argv = process.argv.slice(2)) {
  invariant(!process.env.SAFE_UPDATE, "process SAFE_UPDATE must be unset");
  const options = parseArgs(argv);
  const artifact = readArtifact(options.input);
  const expectedConfirmation = confirmation(artifact);
  if (options.mode === "apply") {
    invariant(
      options.confirm === expectedConfirmation,
      `apply confirmation must equal ${expectedConfirmation}`
    );
  } else {
    invariant(options.confirm === undefined, "rehearsal does not accept confirmation");
  }
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
    application_name: "supplementscout-open-review-alias-refresh",
  });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("set local lock_timeout='10s'");
    await client.query("set local statement_timeout='120s'");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('supplementscout:open-review-alias-refresh-v1',0))"
    );
    await assertTarget(client);
    const beforeCounts = await catalogueCounts(client);
    const refresh = await refreshOpenRows(client, artifact);
    invariant(refresh.refreshed === 83, "expected exactly 83 open review rows");
    invariant(refresh.preserved === 58, "expected exactly 58 preserved decisions");
    await correctAnimalFlex(client);
    const afterCounts = await catalogueCounts(client);
    invariant(
      JSON.stringify(beforeCounts) === JSON.stringify(afterCounts),
      "catalogue counts changed during review refresh"
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
      confirmation: expectedConfirmation,
      refreshed_open_rows: refresh.refreshed,
      preserved_decisions: refresh.preserved,
      animal_flex_product_id: ANIMAL_FLEX.productId,
      animal_flex_variant_id: ANIMAL_FLEX.variantId,
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

module.exports = {
  ANIMAL_FLEX,
  confirmation,
  parseArgs,
  stableSource,
};
