const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { loadDryRunArtifact } = require("./import-products");
const { loadReviewedMassOosManifest } = require("./six-pack-offer-refresh");
const config = require("../config/retailers/six-pack-supplements-woocommerce.json");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_REF = "aftboxmrdgyhizicfsfu";

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const out = {};
  for (const argument of argv) {
    const match = argument.match(/^--(artifact|output|reviewed-mass-oos)=(.*)$/);
    if (!match || out[match[1]]) fail(`Invalid argument ${argument}`);
    out[match[1]] = match[1] === "reviewed-mass-oos" ? match[2] : path.resolve(match[2]);
  }
  for (const key of ["artifact", "output"]) if (!out[key]) fail(`Required --${key}=<path>`);
  const relative = path.relative(path.join(ROOT, "tmp"), out.output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Output must be inside repository tmp");
  out.reviewedMassOosSelector = out["reviewed-mass-oos"] || null;
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

function validateArtifactScope(artifact, manifest, reviewed = null) {
  if (
    artifact.environment_marker !== "production" ||
    artifact.plans.length !== manifest.rows.length ||
    artifact.source_rows.length !== manifest.rows.length ||
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
    seen.add(binding.external_variant_id);
  }
  const total = manifest.rows.length;
  const reviewedMassOos = validateReviewedMassOosArtifact(artifact, reviewed);
  if (
    seen.size !== total ||
    snapshots.size !== 1 ||
    changedRows / total > config.guardrails.maximum_changed_record_ratio ||
    priceChangedRows / total >= config.guardrails.mass_price_change_block_ratio ||
    (newOosRows >= config.guardrails.mass_oos_block_count && !reviewedMassOos) ||
    currentOosRows / total > config.guardrails.maximum_total_oos_ratio ||
    (currentOosRows - previousOosRows) / total > config.guardrails.maximum_oos_increase_percentage_points
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
  const client = new Client({
    connectionString: credential(kind),
    ssl: { rejectUnauthorized: false },
    application_name: `six-pack-offer-refresh-${kind}`,
    options: "-c statement_timeout=120000",
  });
  await client.connect();
  return client;
}

async function roleTransaction(client, kind, callback) {
  try {
    await client.query("begin");
    await client.query("select set_config('app.retailer_catalogue_production_marker','1',true),set_config('app.retailer_catalogue_allow','1',true)");
    await client.query(`set role retailer_catalogue_production_${kind}`);
    const identity = (await client.query("select current_user,session_user")).rows[0];
    if (identity.current_user !== `retailer_catalogue_production_${kind}`) fail(`${kind} role mismatch`);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  }
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
  const loaded = loadDryRunArtifact(options.artifact);
  const plans = validateArtifactScope(loaded.artifact, approved.manifest, reviewed);
  const clients = {};
  try {
    clients.approver = await openRoleClient("approver");
    clients.executor = await openRoleClient("executor");
    const rows = [];
    const approvalReason = reviewed ? "six-pack-reviewed-mass-oos" : "six-pack-scheduled-offer-refresh";
    for (const entry of plans) rows.push(await executeEntry(entry, loaded.artifactSha256, loaded.artifact.run_id, clients, approvalReason));
    const report = {
      schema_version: 1,
      kind: "six-pack-approved-offer-refresh-execution",
      result: "PASS",
      target_project_ref: PROJECT_REF,
      manifest_sha256: approved.sha256,
      artifact_sha256: loaded.artifactSha256,
      executed_plan_count: rows.length,
      reviewed_mass_oos: reviewed ? {
        selector: reviewed.manifest.selector,
        manifest_sha256: reviewed.sha256,
        row_count: reviewed.manifest.row_count,
      } : null,
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
  hasExpectedShipping,
  parseArgs,
  reviewedPlanRows,
  validateArtifactScope,
  validateReviewedMassOosArtifact,
};
