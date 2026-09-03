const fs = require("node:fs");
const path = require("node:path");
const { canonicalTimestamp, timestampEpochNanoseconds } = require("./lib/canonical-timestamp");
const { Client } = require("pg");
const { openPostgresClient, runRoleTransaction } = require("./lib/retailer-offer-sync/production-role-session");
const { loadDryRunArtifact } = require("./import-products");
const { loadReviewedMassOosManifest } = require("./six-pack-offer-refresh");
const {
  assertOwnerExecutionContext,
  loadReviewedBatch,
} = require("./lib/six-pack-reviewed-owner-approval");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(artifact|output|checkpoint|reviewed-mass-oos|reviewed-batch)=(.*)$/);
    if (!match || out[match[1]]) fail(`Invalid argument ${argument}`);
    out[match[1]] = ["reviewed-mass-oos", "reviewed-batch"].includes(match[1]) ? match[2] : path.resolve(match[2]);
  }
  for (const key of ["artifact", "output"]) if (!out[key]) fail(`Required --${key}=<path>`);
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  out.reviewedMassOosSelector = out["reviewed-mass-oos"] || null;
  out.reviewedBatchFingerprint = out["reviewed-batch"] || null;
  out.checkpoint = out.checkpoint || `${out.output}.checkpoint.json`;
  const checkpointRelative = path.relative(path.join(ROOT, "tmp"), out.checkpoint);
  if (!checkpointRelative || checkpointRelative.startsWith("..") || path.isAbsolute(checkpointRelative)) fail("Checkpoint must be inside repository tmp");
  if (out.reviewedMassOosSelector && out.reviewedBatchFingerprint) fail("Reviewed selectors are mutually exclusive");
  if (
    out["reviewed-mass-oos"] !== undefined &&
    out["reviewed-mass-oos"] !== config.automation.reviewed_mass_oos_selector
  ) fail("Unknown reviewed MASS_OOS selector");
  return out;
}

function loadManifest() {
  const file = path.join(ROOT, config.automation.manifest_path);
  const bytes = fs.readFileSync(file);
  const crypto = require("node:crypto");
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== config.automation.manifest_sha256) fail("Approved manifest SHA mismatch");
  return { manifest: JSON.parse(bytes), sha256: actual };
}

function hasExpectedShipping(offer) {
  const price = Number(offer?.price);
  const threshold = Number(config.shipping_policy.free_shipping_threshold);
  const expectedShipping = price < threshold
    ? Number(config.shipping_policy.below_threshold)
    : Number(config.shipping_policy.at_or_above_threshold);
  const shipping = Number(offer?.shipping_cost);
  const total = Number(offer?.total_price);
  return (
    config.shipping_policy.status === "VERIFIED" &&
    Number.isFinite(price) &&
    Number.isFinite(expectedShipping) &&
    Number.isFinite(shipping) &&
    Number.isFinite(total) &&
    shipping.toFixed(2) === expectedShipping.toFixed(2) &&
    total.toFixed(2) === (price + expectedShipping).toFixed(2)
  );
}

function validateReviewedOwnerArtifact(artifact, reviewed) {
  if (!reviewed) return false;
  const batch = reviewed.batch;
  if (!String(artifact.run_id || "").startsWith(`six-pack-reviewed-owner-${batch.reviewed_batch_fingerprint}-`)) fail("Reviewed owner artifact fingerprint binding mismatch");
  const actual = artifact.plans.map((entry) => {
    const plan = entry.resolved_plan;
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number)?.normalized_source_row?.source;
    const before = plan.expected_state.offer;
    const after = plan.offer.values;
    return {
      offer_id: String(plan.offer.id), product_id: String(plan.product.id), product_variant_id: String(plan.product_variant.id),
      retailer_product_id: String(plan.retailer_product.id), external_product_id: String(source.external_product_id), external_variant_id: String(source.external_variant_id),
      operation_type: Number(before.price) !== Number(after.price) && before.in_stock !== after.in_stock ? "UPDATE_PRICE_AND_STOCK" : Number(before.price) !== Number(after.price) ? "UPDATE_PRICE" : "UPDATE_STOCK",
      before: { price: Number(before.price).toFixed(2), shipping_cost: Number(before.shipping_cost).toFixed(2), total_price: Number(before.total_price).toFixed(2), in_stock: before.in_stock, url: before.url, last_checked_at: before.last_checked_at },
      after: { price: Number(after.price).toFixed(2), shipping_cost: Number(after.shipping_cost).toFixed(2), total_price: Number(after.total_price).toFixed(2), in_stock: after.in_stock, url: after.url, last_checked_at: after.last_checked_at },
    };
  }).sort((a, b) => Number(a.offer_id) - Number(b.offer_id));
  const expected = batch.rows.map((row) => ({
    offer_id: String(row.offer_id), product_id: String(row.product_id), product_variant_id: String(row.product_variant_id), retailer_product_id: String(row.retailer_product_id),
    external_product_id: String(row.external_product_id), external_variant_id: String(row.external_variant_id), operation_type: row.operation_type,
    before: row.before, after: { ...row.after, last_checked_at: artifact.created_at },
  }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("Reviewed owner artifact differs from the exact approved rows and values");
  return true;
}

function sameCommercialOfferState(before, after) {
  const sameDecimal = (left, right) => {
    if (left === null || left === undefined || right === null || right === undefined) {
      return left === right;
    }
    return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right);
  };
  return (
    sameDecimal(before?.price, after?.price) &&
    sameDecimal(before?.shipping_cost, after?.shipping_cost) &&
    sameDecimal(before?.total_price, after?.total_price) &&
    before?.in_stock === after?.in_stock &&
    before?.url === after?.url
  );
}

function validateOperationContract(plan) {
  const before = plan.expected_state?.offer;
  const after = plan.offer?.values;
  const verifiedNoChange = plan.meta?.operation_type === "verify_offer_no_change";
  const standardUpdate = plan.meta?.operation_type === "standard_import";
  let validTimestampTransition = false;
  try {
    validTimestampTransition = canonicalTimestamp(after?.last_checked_at) === canonicalTimestamp(plan.meta?.source_captured_at)
      && timestampEpochNanoseconds(after.last_checked_at) > timestampEpochNanoseconds(before?.last_checked_at);
  } catch {}

  if (verifiedNoChange !== (plan.offer?.action === "verify_no_change")) {
    fail("Refresh operation type and offer action mismatch");
  }
  if (verifiedNoChange) {
    if (
      plan.retailer_product?.action !== "noop" ||
      plan.price_history?.action !== "noop" ||
      !sameCommercialOfferState(before, after) ||
      !validTimestampTransition
    ) fail("Verified no-change plan may update only last_checked_at");
    return;
  }
  if (!standardUpdate) fail("Unsupported refresh operation type");
  const priceChanged = Number(before?.price) !== Number(after?.price);
  const stockChanged = before?.in_stock !== after?.in_stock;
  const urlChanged = before?.url !== after?.url;
  if (
    plan.offer?.action !== "update" ||
    (!priceChanged && !stockChanged && !urlChanged) ||
    plan.price_history?.action !== (priceChanged ? "create" : "noop") ||
    plan.retailer_product?.action !== (urlChanged ? "update" : "noop") ||
    (urlChanged && plan.retailer_product?.values?.external_url !== after.url) ||
    !validTimestampTransition ||
    plan.approval?.approved !== false
  ) fail("Standard refresh update contract mismatch");
}

function reviewedPlanRows(artifact) {
  return artifact.plans
    .filter((entry) => {
      const plan = entry.resolved_plan;
      const before = plan.expected_state?.offer;
      const after = plan.offer?.values;
      return before && after && (
        Number(before.price) !== Number(after.price) ||
        before.in_stock !== after.in_stock ||
        before.url !== after.url
      );
    })
    .map((entry) => {
      const plan = entry.resolved_plan;
      const source = artifact.source_rows.find((row) => row.row_number === entry.row_number)?.normalized_source_row?.source;
      const before = plan.expected_state.offer;
      const after = plan.offer.values;
      const priceChanged = Number(before.price) !== Number(after.price);
      const stockChanged = before.in_stock !== after.in_stock;
      const urlChanged = before.url !== after.url;
      const action = priceChanged && stockChanged && urlChanged
        ? "UPDATE_PRICE_STOCK_URL"
        : priceChanged && stockChanged
          ? "UPDATE_PRICE_AND_STOCK"
          : priceChanged
            ? "UPDATE_PRICE"
            : stockChanged
              ? "UPDATE_STOCK"
              : "UPDATE_URL";
      return {
        offer_id: String(plan.offer.id),
        mapping_id: String(plan.retailer_product.id),
        external_product_id: String(source.external_product_id),
        external_variant_id: String(source.external_variant_id),
        action,
        old_price: Number(before.price).toFixed(2),
        new_price: Number(after.price).toFixed(2),
        old_stock: Boolean(before.in_stock),
        new_stock: Boolean(after.in_stock),
      };
    })
    .sort((left, right) => Number(left.offer_id) - Number(right.offer_id));
}

function validateReviewedMassOosArtifact(artifact, reviewed) {
  if (!reviewed) return false;
  if (!String(artifact.run_id || "").startsWith(`six-pack-reviewed-mass-oos-${reviewed.sha256}-`)) {
    fail("Reviewed MASS_OOS artifact selector or manifest binding mismatch");
  }
  const expected = reviewed.manifest.rows.map((row) => ({
    offer_id: row.offer_id,
    mapping_id: row.mapping_id,
    external_product_id: row.external_product_id,
    external_variant_id: row.external_variant_id,
    action: row.action,
    old_price: row.old_price,
    new_price: row.new_price,
    old_stock: row.old_stock,
    new_stock: row.new_stock,
  }));
  if (JSON.stringify(reviewedPlanRows(artifact)) !== JSON.stringify(expected)) {
    fail("Reviewed MASS_OOS artifact changed row scope drift");
  }
  return true;
}

function validateArtifactScope(artifact, manifest, reviewed = null, reviewedOwner = null) {
  if (
    artifact.environment_marker !== "production" ||
    artifact.plans.length !== artifact.source_rows.length ||
    artifact.plans.length > manifest.rows.length ||
    artifact.blocked_rows.length !== 0 ||
    Date.now() - Date.parse(artifact.created_at) > config.guardrails.source_freshness_hours * 3600000
  ) fail("Refresh artifact environment, coverage or freshness mismatch");
  const bindingByVariant = new Map(manifest.rows.map((row) => [row.external_variant_id, row]));
  const seen = new Set();
  const snapshots = new Set();
  let changedRows = 0;
  let priceChangedRows = 0;
  let newOosRows = 0;
  let currentOosRows = 0;
  let previousOosRows = 0;
  for (const entry of artifact.plans) {
    const plan = entry.resolved_plan;
    const source = artifact.source_rows.find((row) => row.row_number === entry.row_number)?.normalized_source_row?.source;
    const binding = bindingByVariant.get(String(source?.external_variant_id));
    const before = plan.expected_state?.offer;
    const after = plan.offer?.values;
    if (
      !binding ||
      seen.has(binding.external_variant_id) ||
      String(source.external_product_id) !== binding.external_product_id ||
      plan.product?.action !== "existing" ||
      String(plan.product.id) !== binding.canonical_product_id ||
      plan.product_variant?.action !== "existing" ||
      String(plan.product_variant.id) !== binding.canonical_variant_id ||
      plan.retailer?.action !== "existing" ||
      String(plan.retailer.id) !== String(manifest.retailer.id) ||
      !["noop", "update"].includes(plan.retailer_product?.action) ||
      String(plan.retailer_product.id) !== binding.mapping_id ||
      !["verify_no_change", "update"].includes(plan.offer?.action) ||
      String(plan.offer.id) !== binding.offer_id ||
      !["noop", "create"].includes(plan.price_history?.action) ||
      !["verify_offer_no_change", "standard_import"].includes(plan.meta?.operation_type) ||
      plan.meta?.source_captured_at !== artifact.created_at ||
      !/^[0-9a-f]{64}$/.test(plan.meta?.source_snapshot_sha256 || "") ||
      !before || !after ||
      !hasExpectedShipping(before) ||
      !hasExpectedShipping(after)
    ) fail(`Unsafe or mismatched refresh plan for ${source?.external_variant_id || "unknown"}`);
    snapshots.add(plan.meta.source_snapshot_sha256);
    let url;
    try { url = new URL(after.url); } catch { fail("Refresh plan contains an invalid offer URL"); }
    if (url.protocol !== "https:" || url.hostname !== "6pack-supplements.co.uk") fail("Refresh plan URL escaped the approved retailer");
    const priceChanged = Number(before.price) !== Number(after.price);
    const stockChanged = before.in_stock !== after.in_stock;
    const urlChanged = before.url !== after.url;
    const changed = priceChanged || stockChanged || urlChanged;
    if (changed) changedRows += 1;
    if (priceChanged) {
      priceChangedRows += 1;
      const absolute = Math.abs(Number(after.price) - Number(before.price));
      const ratio = absolute / Math.max(0.01, Number(before.price));
      if (
        ratio >= config.guardrails.per_row_price_hard_block_ratio ||
        absolute >= Number(config.guardrails.per_row_price_hard_block_absolute_gbp)
      ) fail("Refresh plan contains a hard price anomaly");
    }
    if (before.in_stock === true && after.in_stock === false) newOosRows += 1;
    if (before.in_stock === false) previousOosRows += 1;
    if (after.in_stock === false) currentOosRows += 1;
    if (plan.offer.action === "verify_no_change" && plan.price_history.action !== "noop") {
      fail("No-change plan cannot create price history");
    }
    if (plan.offer.action === "verify_no_change" && changed) fail("No-change plan contains a business-field change");
    if (plan.offer.action === "update" && !changed) fail("Update plan does not contain a business-field change");
    validateOperationContract(plan);
    seen.add(binding.external_variant_id);
  }
  const total = artifact.plans.length;
  const reviewedMassOos = validateReviewedMassOosArtifact(artifact, reviewed);
  const reviewedOwnerApproved = validateReviewedOwnerArtifact(artifact, reviewedOwner);
  const aggregateTotal = reviewedOwnerApproved ? manifest.rows.length : total;
  if (
    seen.size !== total ||
    snapshots.size !== (total === 0 ? 0 : 1) ||
    (aggregateTotal > 0 && changedRows / aggregateTotal > config.guardrails.maximum_changed_record_ratio) ||
    (aggregateTotal > 0 && priceChangedRows / aggregateTotal >= config.guardrails.mass_price_change_block_ratio) ||
    (newOosRows >= config.guardrails.mass_oos_block_count && !reviewedMassOos && !reviewedOwnerApproved) ||
    (!reviewedOwnerApproved && total > 0 && currentOosRows / total > config.guardrails.maximum_total_oos_ratio) ||
    (!reviewedOwnerApproved && total > 0 && (currentOosRows - previousOosRows) / total > config.guardrails.maximum_oos_increase_percentage_points)
  ) fail("Refresh artifact violates independent execution guardrails");
  return [...artifact.plans].sort((left, right) => Number(left.row_number) - Number(right.row_number));
}

function credential(kind) {
  const value = process.env[`SIX_PACK_SYNC_${kind.toUpperCase()}_DATABASE_URL`];
  if (!value) fail(`Missing SIX_PACK_SYNC_${kind.toUpperCase()}_DATABASE_URL`);
  const parsed = new URL(value);
  parsed.searchParams.delete("sslmode");
  if (parsed.href.includes("hxnrsyyqffztlvcrtgbf")) fail(`${kind} credential points to staging`);
  return parsed.href;
}

async function openRoleClient(kind) {
  return openPostgresClient({
    connectionString: credential(kind),
    applicationName: `six-pack-offer-refresh-${kind}`,
    ClientClass: Client,
    defaultReadOnly: kind === "validator",
  });
}

async function roleTransaction(client, kind, callback) {
  const session = await runRoleTransaction(client, {
    role: `retailer_catalogue_production_${kind}`,
    kind,
    localSettings: {
      "app.retailer_catalogue_production_marker": "1",
      "app.retailer_catalogue_allow": "1",
    },
    readOnly: kind === "validator",
  }, callback);
  return session.result;
}

async function validatePlansReadOnly(plans, client) {
  return roleTransaction(client, "validator", async (transaction) => {
    const rows = [];
    for (const entry of plans) {
      const response = await transaction.query(
        "select public.validate_product_import_plan_read_only($1::jsonb) result",
        [entry.resolved_plan]
      );
      if (!response.rows[0]?.result) fail(`Read-only validation returned no result for row ${entry.row_number}`);
      rows.push({ row_number: entry.row_number, result: response.rows[0].result });
    }
    if (rows.length !== plans.length) fail("Not every refresh plan passed read-only validation");
    return rows;
  });
}

async function executeEntry(entry, artifactSha256, runId, clients, approvalReason) {
  const approval = await roleTransaction(clients.approver, "approver", async (client) => {
    const response = await client.query(
      "select public.approve_product_import_plan($1::jsonb,$2,$3,$4,now()+interval '15 minutes') result",
      [entry.resolved_plan, artifactSha256, runId, approvalReason]
    );
    return response.rows[0].result;
  });
  if (
    approval.status !== "approved" ||
    approval.artifact_sha256 !== artifactSha256 ||
    approval.plan_fingerprint !== entry.plan_fingerprint ||
    approval.source_row_fingerprint !== entry.source_row_fingerprint ||
    approval.run_id !== runId
  ) fail(`Approval metadata mismatch for row ${entry.row_number}`);
  const result = await roleTransaction(clients.executor, "executor", async (client) => {
    const response = await client.query(
      "select public.apply_approved_product_import_plan($1::uuid,$2,$3,$4,$5::bigint,$6,$7) result",
      [approval.approval_id, artifactSha256, entry.plan_fingerprint, entry.source_row_fingerprint, entry.retailer_id, entry.plan_kind, runId]
    );
    return response.rows[0].result;
  });
  if (
    result.approval_status !== "consumed" ||
    result.plan_fingerprint !== entry.plan_fingerprint ||
    result.source_row_fingerprint !== entry.source_row_fingerprint
  ) fail(`Execution metadata mismatch for row ${entry.row_number}`);
  return {
    row_number: entry.row_number,
    operation_type: entry.operation_type,
    plan_fingerprint: entry.plan_fingerprint,
    approval_id: approval.approval_id,
    consumed_at: result.consumed_at,
    retailer_product_id: result.retailer_product_id,
    offer_id: result.offer_id,
    price_history_id: result.price_history_id,
  };
}

async function executeApprovedPlans(plans, execute) {
  const rows = [];
  for (const entry of plans) rows.push(await execute(entry));
  if (rows.length !== plans.length) fail("Not every verified refresh plan was executed");
  return rows;
}

async function executeApprovedPlansWithCheckpoint(plans, execute, writeCheckpoint) {
  const rows = [];
  const write = (result, blocked = []) => writeCheckpoint({
    schema_version: 1,
    kind: "six-pack-reviewed-owner-apply-checkpoint",
    result,
    approved_reviewed_plan_count: plans.length,
    executed_plan_count: rows.length,
    executed_offer_ids: rows.map((row) => String(row.offer_id)),
    remaining_offer_ids: plans.slice(rows.length).map((entry) => String(entry.resolved_plan.offer.id)),
    blocked_rows: blocked,
    updated_at: new Date().toISOString(),
  });
  write("IN_PROGRESS");
  for (const entry of plans) {
    try {
      rows.push(await execute(entry));
      write("IN_PROGRESS");
    } catch (error) {
      write("BLOCK", [{ offer_id: String(entry.resolved_plan.offer.id), error: error.message }]);
      throw error;
    }
  }
  write("PASS");
  if (rows.length !== plans.length) fail("Not every reviewed plan was executed");
  return rows;
}

function executionCounts(plans, rows, approvedMappingCount) {
  if (rows.length !== plans.length) fail("Verified and executed plan counts differ");
  if (!Number.isInteger(approvedMappingCount) || approvedMappingCount < plans.length) {
    fail("Approved and executable plan counts differ from the manifest scope");
  }
  return {
    approved_mapping_count: approvedMappingCount,
    executable_plan_count: plans.length,
    verified_plan_count: plans.length,
    executed_plan_count: rows.length,
    review_row_count: approvedMappingCount - plans.length,
    blocked_row_count: 0,
  };
}

async function run(options) {
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/main" ||
    process.env.GITHUB_REPOSITORY !== "SupplementScout/supplementscout"
  ) fail("Production refresh execution is restricted to GitHub Actions on main");
  const approved = loadManifest();
  if (
    approved.manifest.approved !== true ||
    approved.manifest.retailer?.id !== 11 ||
    approved.manifest.approved_mapping_count !== config.automation.approved_mapping_count
  ) fail("Approved manifest is invalid");
  const reviewed = loadReviewedMassOosManifest(options.reviewedMassOosSelector, approved.manifest);
  const reviewedOwner = options.reviewedBatchFingerprint ? loadReviewedBatch(options.reviewedBatchFingerprint) : null;
  const ownerContext = reviewedOwner ? await assertOwnerExecutionContext(reviewedOwner.batch) : null;
  const loaded = loadDryRunArtifact(options.artifact);
  const plans = validateArtifactScope(loaded.artifact, approved.manifest, reviewed, reviewedOwner);
  const clients = {};
  try {
    clients.validator = await openRoleClient("validator");
    await validatePlansReadOnly(plans, clients.validator);
    await clients.validator.end();
    delete clients.validator;
    clients.approver = await openRoleClient("approver");
    clients.executor = await openRoleClient("executor");
    const approvalReason = reviewedOwner ? `six-pack-reviewed-owner:${reviewedOwner.batch.reviewed_batch_fingerprint}` : reviewed ? "six-pack-reviewed-mass-oos" : "six-pack-scheduled-offer-refresh";
    const execute = (entry) => executeEntry(entry, loaded.artifactSha256, loaded.artifact.run_id, clients, approvalReason);
    const rows = reviewedOwner
      ? await executeApprovedPlansWithCheckpoint(plans, execute, (checkpoint) => {
        fs.mkdirSync(path.dirname(options.checkpoint), { recursive: true });
        fs.writeFileSync(options.checkpoint, `${JSON.stringify(checkpoint, null, 2)}\n`);
      })
      : await executeApprovedPlans(plans, execute);
    const counts = executionCounts(plans, rows, approved.manifest.approved_mapping_count);
    const report = {
      schema_version: 1,
      kind: "six-pack-approved-offer-refresh-execution",
      result: "PASS",
      target_project_ref: PROJECT_REF,
      manifest_sha256: approved.sha256,
      artifact_sha256: loaded.artifactSha256,
      ...counts,
      reviewed_mass_oos: reviewed ? {
        selector: reviewed.manifest.selector,
        manifest_sha256: reviewed.sha256,
        row_count: reviewed.manifest.row_count,
      } : null,
      reviewed_owner_approval: reviewedOwner ? {
        reviewed_batch_fingerprint: reviewedOwner.batch.reviewed_batch_fingerprint,
        approved_reviewed_plan_count: reviewedOwner.batch.rows.length,
        actor: ownerContext.actor,
        actor_permission: ownerContext.permission,
        implementation_commit_sha: ownerContext.implementation_commit_sha,
        runtime_commit_sha: ownerContext.runtime_commit_sha,
      } : null,
      execution_offer_ids: rows.map((row) => String(row.offer_id)),
      rows,
      completed_at: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await Promise.allSettled(Object.values(clients).map((client) => client.end()));
  }
}

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  executeApprovedPlans,
  executeApprovedPlansWithCheckpoint,
  executionCounts,
  hasExpectedShipping,
  parseArgs,
  reviewedPlanRows,
  sameCommercialOfferState,
  validatePlansReadOnly,
  validateArtifactScope,
  validateOperationContract,
  validateReviewedMassOosArtifact,
  validateReviewedOwnerArtifact,
};
