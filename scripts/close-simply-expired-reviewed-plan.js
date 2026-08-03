const path = require("node:path");
const { Client } = require("pg");
const { loadEnvFile, catalogueCounts } = require("./apply-selected-migrations");
process.env.RETAILER_REFRESH_PROFILE = "simply-supplements";
const { canonicalHash } = require("./fit-house-offer-refresh");

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function credential(kind) {
  const file = path.join(
    process.env.USERPROFILE || "",
    ".supplementscout",
    "credentials",
    `production-${kind}.env`,
  );
  const values = loadEnvFile(file);
  const raw = Object.entries(values).find(([name]) => name.endsWith("_DATABASE_URL"))?.[1];
  invariant(raw, `missing production ${kind} database URL`);
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  invariant(url.href.includes("aftboxmrdgyhizicfsfu"), `production ${kind} target mismatch`);
  return url.href;
}

async function readActive() {
  const client = new Client({
    connectionString: credential("owner"),
    ssl: { rejectUnauthorized: false },
    application_name: "simply-expired-plan-owner-audit",
    options: "-c default_transaction_read_only=on",
  });
  await client.connect();
  try {
    await client.query("begin read only");
    const before = await catalogueCounts(client);
    const result = await client.query(`
      select p.id::text parent_plan_id,p.parent_plan_fingerprint,p.status parent_status,
             c.id::text child_plan_id,c.child_plan_fingerprint,c.status child_status,
             a.id::text approval_id,a.artifact_fingerprint,a.execution_fingerprint,
             a.expected_migration_versions,a.expected_migration_fingerprint,
             a.expires_at,a.consumed_at,a.closed_at
      from public.retailer_catalogue_parent_plans p
      join public.retailer_catalogue_child_plans c on c.parent_plan_id=p.id
      join public.retailer_offer_sync_batch_approvals a on a.child_plan_id=c.id
      where p.retailer_id=7 and a.consumed_at is null and a.closed_at is null
      order by p.created_at desc
    `);
    await client.query("rollback");
    invariant(result.rows.length === 1, `expected one active Simply approval, found ${result.rows.length}`);
    return { row: result.rows[0], before };
  } finally {
    await client.end();
  }
}

async function verifyClosed(before, approvalId) {
  const client = new Client({
    connectionString: credential("owner"),
    ssl: { rejectUnauthorized: false },
    application_name: "simply-expired-plan-post-audit",
    options: "-c default_transaction_read_only=on",
  });
  await client.connect();
  try {
    await client.query("begin read only");
    const after = await catalogueCounts(client);
    const state = (await client.query(`
      select p.status parent_status,c.status child_status,a.closed_at,a.consumed_at
      from public.retailer_offer_sync_batch_approvals a
      join public.retailer_catalogue_child_plans c on c.id=a.child_plan_id
      join public.retailer_catalogue_parent_plans p on p.id=c.parent_plan_id
      where a.id=$1::uuid
    `, [approvalId])).rows[0];
    await client.query("rollback");
    invariant(JSON.stringify(after) === JSON.stringify(before), "business counts changed while closing plan");
    invariant(state?.parent_status === "EXPIRED" && state?.child_status === "EXPIRED" && state.closed_at && !state.consumed_at, "expired plan close verification failed");
    return { after, state };
  } finally {
    await client.end();
  }
}

async function main() {
  invariant(!process.env.SAFE_UPDATE, "SAFE_UPDATE must be unset");
  const { row, before } = await readActive();
  invariant(row.parent_status === "APPROVED" && row.child_status === "APPROVED", "Simply plan is not an approved unexecuted plan");
  invariant(!row.consumed_at && !row.closed_at, "Simply approval is already consumed or closed");
  invariant(Date.parse(row.expires_at) <= Date.now(), `Simply approval has not expired: ${row.expires_at}`);
  const request = {
    schema_version: 1,
    approval_id: row.approval_id,
    parent_plan_id: row.parent_plan_id,
    child_plan_id: row.child_plan_id,
    parent_plan_fingerprint: row.parent_plan_fingerprint,
    child_plan_fingerprint: row.child_plan_fingerprint,
    artifact_fingerprint: row.artifact_fingerprint,
    execution_fingerprint: row.execution_fingerprint,
    approval_expected_migration_fingerprint: row.expected_migration_fingerprint,
    expected_migration_versions: row.expected_migration_versions,
    expected_migration_fingerprint: row.expected_migration_fingerprint,
    migration_fingerprint_algorithm: "SHA-256",
    migration_fingerprint_version: "RSBI-CJ1",
    target_environment: "PRODUCTION",
    production_project_ref: "aftboxmrdgyhizicfsfu",
    production_database_identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
    reason: "Exact reviewed Simply execution failed before business writes; close expired unconsumed control plan",
    closed_by: "supplementscout-owner-approved-maintenance",
    requested_at: new Date().toISOString(),
    request_fingerprint: null,
  };
  request.request_fingerprint = canonicalHash(request);

  const client = new Client({
    connectionString: credential("approver"),
    ssl: { rejectUnauthorized: false },
    application_name: "simply-expired-plan-close",
  });
  await client.connect();
  let open = false;
  try {
    await client.query("begin");
    open = true;
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query("set role retailer_catalogue_production_approver");
    const result = (await client.query(
      "select public.close_expired_retailer_offer_sync_approval($1::jsonb) result",
      [request],
    )).rows[0].result;
    invariant(result.status === "EXPIRED" && Number(result.business_writes) === 0 && Number(result.price_history_writes) === 0, "expired plan close result mismatch");
    await client.query("commit");
    open = false;
    const verified = await verifyClosed(before, row.approval_id);
    console.log(JSON.stringify({ result: "PASS", close: result, verified }));
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
