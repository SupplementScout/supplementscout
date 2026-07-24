const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Client } = require("pg");
const {
  readEkmGoogleProductFeed,
  sha256,
} = require("./lib/ekm-google-product-feed-reader");
const {
  classifyExistingOffers,
} = require("./lib/retailer-offer-sync/classifier");
const { sealArtifact } = require("./lib/retailer-offer-sync/artifacts");
const {
  buildExistingOfferUpdatePlan,
} = require("./lib/retailer-offer-sync/existing-offer-plan");
const {
  buildVerifiedNoChangePlan,
} = require("./verified-no-change-offer-refresh");
const {
  canonicalHash,
  executionRow,
  migrationBinding,
  sumDeltas,
  verificationRecord,
} = require("./jons-offer-refresh");
const config = require("../config/retailers/whey-okay-offer-sync.json");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "tmp", "whey-okay-offer-refresh");
const TARGETS = {
  staging: {
    environment: "STAGING",
    ref: "hxnrsyyqffztlvcrtgbf",
    identity: "supplementscout-staging:hxnrsyyqffztlvcrtgbf",
  },
  production: {
    environment: "PRODUCTION",
    ref: "aftboxmrdgyhizicfsfu",
    identity: "supplementscout-production:aftboxmrdgyhizicfsfu",
  },
};

class RefreshError extends Error {
  constructor(code, message, stage, detail = {}) {
    super(message);
    this.name = "RefreshError";
    this.code = code;
    this.stage = stage;
    this.detail = detail;
  }
}

function invariant(value, message) {
  if (!value) throw new Error(message);
}
function git(...args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  }).trim();
}
function parseArgs(argv) {
  const result = {};
  for (const argument of argv) {
    const match = argument.match(/^--([^=]+)=(.*)$/);
    if (!match || result[match[1]] !== undefined) {
      throw new Error(`invalid argument ${argument}`);
    }
    result[match[1]] = match[2];
  }
  if (
    !TARGETS[result.target] ||
    !["dry-run", "apply"].includes(result.mode)
  ) {
    throw new Error(
      "required --target=staging|production --mode=dry-run|apply",
    );
  }
  return result;
}
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      values[match[1]] = match[2]
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return values;
}
function roleCredential(target, kind) {
  const direct = process.env[`WHEY_OKAY_SYNC_${kind.toUpperCase()}_DATABASE_URL`];
  let url = direct;
  if (!url) {
    const file =
      target === "production"
        ? path.join(
            process.env.USERPROFILE || "",
            ".supplementscout",
            "credentials",
            `production-${kind}.env`,
          )
        : path.join(ROOT, `.env.staging.${kind}.local`);
    url = Object.entries(loadEnvFile(file)).find(([key]) =>
      key.endsWith("_DATABASE_URL"),
    )?.[1];
  }
  invariant(url, `missing ${kind} database URL`);
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  const opposite =
    TARGETS[target === "production" ? "staging" : "production"].ref;
  invariant(!parsed.href.includes(opposite), `${kind} opposite target`);
  return parsed.href;
}
async function roleCall(target, kind, readOnly, body) {
  const client = new Client({
    connectionString: roleCredential(target, kind),
    ssl: { rejectUnauthorized: false },
    application_name: `whey-okay-offer-refresh-${kind}`,
    options: "-c statement_timeout=180000 -c lock_timeout=15000",
  });
  await client.connect();
  try {
    const safeUpdate = (
      await client.query("select current_setting('app.safe_update',true) value")
    ).rows[0].value;
    invariant(safeUpdate == null, "SAFE_UPDATE must remain unset");
    await client.query(readOnly ? "begin read only" : "begin");
    if (!readOnly) {
      await client.query(
        `select set_config('app.retailer_catalogue_${target}_marker','1',true),
                set_config('app.retailer_catalogue_allow','1',true)`,
      );
    }
    await client.query(`set role retailer_catalogue_${target}_${kind}`);
    const identity = (
      await client.query(
        "select current_user,session_user,current_setting('transaction_read_only') ro,current_setting('app.safe_update',true) safe_update",
      )
    ).rows[0];
    invariant(
      identity.current_user === `retailer_catalogue_${target}_${kind}`,
      `${kind} role mismatch`,
    );
    invariant(identity.safe_update == null, "SAFE_UPDATE became set");
    if (readOnly) invariant(identity.ro === "on", "read transaction required");
    const result = await body(client, TARGETS[target]);
    await client.query(readOnly ? "rollback" : "commit");
    return { result, identity };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}
function manifestPath() {
  return path.join(ROOT, config.manifest_path);
}
function loadManifest() {
  const bytes = fs.readFileSync(manifestPath());
  const actual = sha256(bytes).toUpperCase();
  invariant(actual === config.manifest_sha256, "approved manifest SHA mismatch");
  const manifest = JSON.parse(bytes);
  invariant(
    manifest.retailer.id === config.retailer_id &&
      manifest.approved_mapping_count === config.approved_mapping_count &&
      manifest.rows.length === config.approved_mapping_count,
    "approved manifest scope mismatch",
  );
  invariant(
    new Set(manifest.rows.map((row) => row.source_key)).size ===
      config.approved_mapping_count,
    "approved manifest duplicate source identity",
  );
  for (const id of config.reviewed_exception_mapping_ids) {
    invariant(
      manifest.rows.every(
        (row) =>
          row.environment_bindings.staging.mapping_id !== id &&
          row.environment_bindings.production.mapping_id !== id,
      ),
      `reviewed exception ${id} entered manifest`,
    );
  }
  return { manifest, sha256: actual };
}
function normalizeStatePayload(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}
async function readState(target) {
  const call = await roleCall(target, "validator", true, (client) =>
    client.query(
      "select public.read_retailer_offer_sync_approved_state($1::bigint) state",
      [config.retailer_id],
    ),
  );
  const state = normalizeStatePayload(call.result.rows[0].state);
  const { manifest } = loadManifest();
  invariant(state.retailer.id === config.retailer_id, "retailer identity drift");
  invariant(
    state.counts.approved_mappings === config.approved_mapping_count &&
      state.counts.approved_offers === config.approved_mapping_count &&
      state.counts.legacy_mappings === config.legacy_mapping_count,
    "Whey Okay approved/legacy scope drift",
  );
  invariant(
    Object.values(state.controls).every((value) => Number(value) === 0),
    "active approval, workflow or conflicting session exists",
  );
  const manifestBySource = new Map(
    manifest.rows.map((row) => [row.source_key, row]),
  );
  const records = state.records
    .map((record) => {
      const sourceKey = `${record.mapping.external_product_id}:${record.mapping.external_variant_id}`;
      const approved = manifestBySource.get(sourceKey);
      invariant(approved, `database source outside manifest ${sourceKey}`);
      const binding = approved.environment_bindings[target];
      invariant(
        Number(record.mapping.id) === binding.mapping_id &&
          Number(record.offer.id) === binding.offer_id &&
          Number(record.product.id) === binding.canonical_product_id &&
          Number(record.variant.id) === binding.canonical_variant_id,
        `environment binding drift ${sourceKey}`,
      );
      invariant(
        Number(record.offer.retailer_product_id) === Number(record.mapping.id) &&
          Number(record.offer.product_id) === Number(record.product.id) &&
          Number(record.offer.product_variant_id) === Number(record.variant.id),
        `offer target drift ${sourceKey}`,
      );
      return { ...record, approved, source_key: sourceKey };
    })
    .sort((left, right) => Number(left.offer.id) - Number(right.offer.id));
  invariant(records.length === config.approved_mapping_count, "record count drift");
  return { ...state, records, identity: call.identity };
}
function money(value) {
  return value == null ? null : Number(value).toFixed(2);
}
function targetFor(record) {
  return {
    offer_id: String(record.offer.id),
    retailer_product_id: String(record.mapping.id),
    external_product_id: String(record.mapping.external_product_id),
    external_variant_id: String(record.mapping.external_variant_id),
    external_sku: record.mapping.external_sku || null,
    price: money(record.offer.price),
    shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price),
    in_stock: Boolean(record.offer.in_stock),
    url: record.offer.url,
    external_url: record.mapping.external_url,
    last_checked_at: record.offer.last_checked_at,
  };
}
function sourceFor(record, sourceByKey) {
  const source = sourceByKey.get(record.source_key);
  invariant(source, `missing approved feed identity ${record.source_key}`);
  return {
    ...source,
    external_sku: null,
    product_handle: null,
    shipping_cost: money(record.offer.shipping_cost),
    total_price: money(record.offer.total_price),
  };
}
function sourceHealth(feed) {
  const baseline = config.source_baseline;
  const productRatio = feed.product_count / baseline.product_count;
  const rowRatio = feed.row_count / baseline.row_count;
  const ratio = Math.min(productRatio, rowRatio);
  const evidence = {
    baseline_products: baseline.product_count,
    baseline_rows: baseline.row_count,
    product_count: feed.product_count,
    row_count: feed.row_count,
    product_ratio: productRatio,
    row_ratio: rowRatio,
    observed_ratio: ratio,
    minimum_ratio: baseline.minimum_count_ratio,
    genuine_collapse_ratio: baseline.genuine_collapse_ratio,
  };
  if (feed.product_count === 0 || feed.row_count === 0) {
    return { result: "BLOCK", code: "SOURCE_INCOMPLETE", ...evidence };
  }
  if (ratio < baseline.genuine_collapse_ratio) {
    return { result: "BLOCK", code: "GENUINE_SOURCE_COLLAPSE", ...evidence };
  }
  if (ratio < baseline.minimum_count_ratio) {
    return { result: "BLOCK", code: "SOURCE_DEGRADED", ...evidence };
  }
  return { result: "PASS", code: null, ...evidence };
}
function guardrailsFor(rows, sourceProducts, policyFingerprint) {
  const changed = rows.filter((row) => row.action !== "VERIFY_NO_CHANGE");
  const newOos = rows.filter(
    (row) =>
      row.atomic_plan.expected_state.offer.in_stock &&
      !row.atomic_plan.offer.values.in_stock,
  );
  const currentOos = rows.filter(
    (row) => !row.atomic_plan.offer.values.in_stock,
  );
  const previousOos = rows.filter(
    (row) => !row.atomic_plan.expected_state.offer.in_stock,
  );
  const price = rows.filter((row) => row.changed_fields.price);
  return {
    schema_version: 1,
    policy_fingerprint: policyFingerprint,
    source_product_count: sourceProducts,
    previous_source_product_count: config.source_baseline.product_count,
    required_source_rows: rows.length,
    matched_source_rows: rows.length,
    new_oos_count: newOos.length,
    total_oos_count: currentOos.length,
    previous_oos_count: previousOos.length,
    changed_row_count: changed.length,
    price_changed_row_count: price.length,
    price_anomaly_count: 0,
    limits: {
      minimum_source_count_ratio: String(
        config.guardrails.full_snapshot_minimum_source_count_ratio,
      ),
      maximum_new_oos_count: String(
        config.guardrails.mass_oos_block_count - 1,
      ),
      maximum_oos_increase_ratio: String(
        config.guardrails.maximum_oos_increase_percentage_points,
      ),
      maximum_total_oos_ratio: String(
        config.guardrails.maximum_total_oos_ratio,
      ),
      maximum_changed_record_ratio: String(
        config.guardrails.maximum_changed_record_ratio,
      ),
      mass_price_change_ratio: String(
        config.guardrails.mass_price_change_block_ratio,
      ),
      price_anomaly_ratio: String(
        config.guardrails.per_row_price_hard_block_ratio,
      ),
      price_anomaly_absolute_gbp: String(
        config.guardrails.per_row_price_hard_block_absolute_gbp,
      ),
    },
    result: "PASS",
  };
}
function artifactPrefix(target, mode, env = process.env) {
  const phase = String(env.WHEY_OKAY_REFRESH_PHASE || mode)
    .replace(/[^a-z0-9_-]+/gi, "-")
    .toLowerCase();
  return `${target}-${phase}`;
}
function write(name, value, outDir = OUT) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
function diagnosticTemplate(argv, env = process.env) {
  const target =
    argv.find((value) => value.startsWith("--target="))?.slice(9) || "unknown";
  const mode =
    argv.find((value) => value.startsWith("--mode="))?.slice(7) || "startup";
  return {
    schema_version: 1,
    timestamp: new Date().toISOString(),
    result: "STARTED",
    target,
    mode,
    trigger_type:
      env.WHEY_OKAY_REFRESH_TRIGGER_TYPE || env.GITHUB_EVENT_NAME || "local",
    commit: env.GITHUB_SHA || null,
    manifest_sha256: config.manifest_sha256,
    approved_mapping_count: 0,
    mappings_matched: 0,
    mappings_missing: 0,
    source: null,
    guard_results: [],
    validator_result: "NOT_RUN",
    approver_result: "NOT_RUN",
    executor_result: "NOT_RUN",
    failure_stage: null,
    error_code: null,
    error_message: null,
    database_writes_attempted: 0,
    database_writes_completed: 0,
    business_writes_completed: 0,
    control_writes_completed: 0,
    approvals_created: 0,
    approvals_consumed: 0,
    recovery_calls: 0,
    safe_update: "unset",
  };
}
async function buildRun(target, state, diagnostic = null, options = {}) {
  const spec = TARGETS[target];
  const capturedAt = new Date().toISOString();
  let feed;
  try {
    feed = await (options.reader || readEkmGoogleProductFeed)({
      url: config.source_url,
      capturedAt,
      maximumAttempts: config.source_fetch.maximum_attempts,
      retryBaseDelayMs: config.source_fetch.retry_base_delay_ms,
      timeoutMs: config.source_fetch.timeout_ms,
      maximumRedirects: config.source_fetch.maximum_redirects,
      freshnessHours: config.guardrails.source_freshness_hours,
      futureClockSkewMinutes: config.guardrails.future_clock_skew_minutes,
      userAgent: config.source_fetch.user_agent,
    });
  } catch (error) {
    throw new RefreshError(
      error.code || "SOURCE_UNAVAILABLE",
      error.message,
      "SOURCE_FETCH",
      { source_diagnostic: error.diagnostic || null },
    );
  }
  const health = sourceHealth(feed);
  if (diagnostic) {
    diagnostic.source = feed.diagnostic;
    diagnostic.guard_results.push({
      guard: "SOURCE_HEALTH",
      result: health.result,
      code: health.code,
      evidence: health,
    });
  }
  if (health.result !== "PASS") {
    throw new RefreshError(
      health.code,
      `Whey Okay source guard blocked: ${health.code}`,
      "SOURCE_GUARD",
      health,
    );
  }
  invariant(
    new Set(feed.rows.map((row) => row.source_key)).size === feed.rows.length,
    "duplicate source identity",
  );
  const targets = state.records.map(targetFor);
  const targetByKey = new Map(
    state.records.map((record) => [record.source_key, targetFor(record)]),
  );
  const sourceVariants = feed.rows.map((row) => ({
    ...row,
    external_sku: null,
    product_handle: null,
    shipping_cost:
      targetByKey.get(row.source_key)?.shipping_cost || row.feed_shipping_cost,
    total_price: targetByKey.get(row.source_key)?.total_price ?? null,
  }));
  const policy = {
    ...config.guardrails,
    required_matched_offers: config.approved_mapping_count,
    store_url: config.store_url,
  };
  const classification = classifyExistingOffers({
    targets,
    sourceVariants,
    policy,
    sourceCapturedAt: capturedAt,
    now: new Date(capturedAt),
    sourceProductCount: feed.product_count,
    previousSourceProductCount: config.source_baseline.product_count,
  });
  if (
    classification.state !== "DRY_RUN_READY" ||
    classification.rows.length !== config.approved_mapping_count
  ) {
    throw new RefreshError(
      classification.reason || "CLASSIFIER_BLOCKED",
      "full Whey Okay classifier blocked",
      "CLASSIFIER",
      classification.detail || {},
    );
  }
  const sourceByKey = new Map(feed.rows.map((row) => [row.source_key, row]));
  const recordByOffer = new Map(
    state.records.map((row) => [String(row.offer.id), row]),
  );
  const binding = migrationBinding(spec.environment);
  const head = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
  const policyFingerprint = sha256(JSON.stringify(config));
  const adapterFingerprint = sha256(
    JSON.stringify({
      reader: fs.readFileSync(
        path.join(ROOT, "scripts/lib/ekm-google-product-feed-reader.js"),
        "utf8",
      ),
      classifier: fs.readFileSync(
        path.join(ROOT, "scripts/lib/retailer-offer-sync/classifier.js"),
        "utf8",
      ),
      manifest_sha256: config.manifest_sha256,
      config,
    }),
  );
  const expectedStateFingerprint = canonicalHash(
    state.records.map((row) => ({
      product: row.product,
      variant: row.variant,
      mapping: row.mapping,
      offer: row.offer,
    })),
  );
  const rows = [];
  for (const classified of classification.rows) {
    const record = recordByOffer.get(String(classified.offer_id));
    const source = sourceFor(record, sourceByKey);
    let plan;
    if (classified.action === "VERIFY_NO_CHANGE") {
      plan = buildVerifiedNoChangePlan(
        verificationRecord(
          record,
          source,
          feed.semantic_fingerprint,
          capturedAt,
        ),
        {
          targetEnvironment: spec.environment,
          targetProjectRef: spec.ref,
          sourceSnapshotSha256s: new Set([feed.semantic_fingerprint]),
          now: new Date(capturedAt),
        },
      ).plan;
    } else {
      const built = buildExistingOfferUpdatePlan({
        product: record.product,
        variant: record.variant,
        retailer: record.retailer,
        mapping: record.mapping,
        offer: record.offer,
        source,
        sourceCapturedAt: capturedAt,
        sourceSnapshotFingerprint: feed.semantic_fingerprint,
      });
      invariant(
        built.changed.price === classified.changed_fields.price &&
          built.changed.stock === classified.changed_fields.stock &&
          built.changed.url === classified.changed_fields.url,
        "classifier/plan changed-field mismatch",
      );
      plan = built.plan;
    }
    rows.push({
      ...classified,
      atomic_plan: plan,
      policy_fingerprint: policyFingerprint,
    });
  }
  const artifacts = [];
  for (let offset = 0; offset < rows.length; offset += 50) {
    const part = rows.slice(offset, offset + 50).map(executionRow);
    const expected = sumDeltas(part);
    const actionManifestFingerprint = canonicalHash({
      state: "DRY_RUN_READY",
      rows: part,
      expected_deltas: expected,
    });
    artifacts.push(
      sealArtifact({
        kind: "retailer-existing-offer-mixed-batch-execution",
        retailer_slug: config.retailer_slug,
        retailer_id: String(config.retailer_id),
        target_environment: spec.environment,
        target_project_ref: spec.ref,
        target_database_identity: spec.identity,
        expected_migration_versions: binding.versions,
        expected_migration_fingerprint: binding.fingerprint,
        migration_fingerprint_algorithm: "SHA-256",
        migration_fingerprint_version: "RSBI-CJ1",
        source_snapshot_fingerprint: feed.semantic_fingerprint,
        adapter_fingerprint: adapterFingerprint,
        policy_fingerprint: policyFingerprint,
        code_commit: head,
        expected_state_fingerprint: expectedStateFingerprint,
        source_captured_at: capturedAt,
        state: "DRY_RUN_READY",
        block: null,
        rows: part,
        expected_deltas: expected,
        action_manifest_fingerprint: actionManifestFingerprint,
      }),
    );
  }
  const approved = loadManifest();
  const manifest = state.records
    .map((row) => ({
      mapping_id: String(row.mapping.id),
      offer_id: String(row.offer.id),
      external_product_id: String(row.mapping.external_product_id),
      external_variant_id: String(row.mapping.external_variant_id),
      canonical_product_id: String(row.product.id),
      canonical_variant_id: String(row.variant.id),
    }))
    .sort((left, right) => Number(left.mapping_id) - Number(right.mapping_id));
  const sourceKeys = new Set(feed.rows.map((row) => row.source_key));
  const mappedKeys = new Set(state.records.map((row) => row.source_key));
  const discovery = {
    new_rows: feed.rows
      .filter((row) => !mappedKeys.has(row.source_key))
      .map((row) => ({
        source_key: row.source_key,
        title: row.title,
        price: row.price,
        in_stock: row.in_stock,
        url: row.url,
      })),
    missing_rows: state.records
      .filter((row) => !sourceKeys.has(row.source_key))
      .map((row) => ({
        source_key: row.source_key,
        mapping_id: row.mapping.id,
        offer_id: row.offer.id,
      })),
  };
  const shippingDifferences = state.records.flatMap((record) => {
    const source = sourceByKey.get(record.source_key);
    return source &&
      money(source.feed_shipping_cost) !== money(record.offer.shipping_cost)
      ? [
          {
            source_key: record.source_key,
            mapping_id: record.mapping.id,
            offer_id: record.offer.id,
            stored_shipping_cost: money(record.offer.shipping_cost),
            feed_shipping_cost: money(source.feed_shipping_cost),
            preserved: true,
          },
        ]
      : [];
  });
  if (diagnostic) {
    diagnostic.approved_mapping_count = config.approved_mapping_count;
    diagnostic.mappings_matched =
      config.approved_mapping_count - discovery.missing_rows.length;
    diagnostic.mappings_missing = discovery.missing_rows.length;
    diagnostic.guard_results.push({
      guard: "APPROVED_MANIFEST_COVERAGE",
      result: discovery.missing_rows.length === 0 ? "PASS" : "BLOCK",
      expected: config.approved_mapping_count,
      matched: diagnostic.mappings_matched,
      missing: discovery.missing_rows.length,
    });
  }
  return {
    target,
    spec,
    capturedAt,
    feed,
    sourceVariants,
    classification,
    artifacts,
    manifest,
    manifestFingerprint: canonicalHash({
      approved_manifest_sha256: approved.sha256,
      environment: spec.environment,
      rows: manifest,
    }),
    approvedManifestSha256: approved.sha256,
    binding,
    head,
    discovery,
    shippingDifferences,
  };
}
function validationRequest(run, artifact) {
  const expires = new Date(Date.now() + 14 * 60_000).toISOString();
  const guard = guardrailsFor(
    artifact.rows,
    run.feed.product_count,
    artifact.policy_fingerprint,
  );
  const request = {
    schema_version: 1,
    kind: "retailer-existing-offer-mixed-batch-read-only-validation",
    artifact,
    validation_expires_at: expires,
    [`${run.target}_project_ref`]: run.spec.ref,
    [`${run.target}_database_identity`]: run.spec.identity,
    expected_migration_versions: run.binding.versions,
    expected_migration_fingerprint: run.binding.fingerprint,
    migration_fingerprint_algorithm: "SHA-256",
    migration_fingerprint_version: "RSBI-CJ1",
    code_commit: run.head,
    source_snapshot_fingerprint: artifact.source_snapshot_fingerprint,
    policy_fingerprint: artifact.policy_fingerprint,
    action_manifest_fingerprint: artifact.action_manifest_fingerprint,
    artifact_fingerprint: artifact.artifact_fingerprint,
    guardrails: guard,
    batch_fingerprint: canonicalHash({
      artifact_fingerprint: artifact.artifact_fingerprint,
      action_manifest_fingerprint: artifact.action_manifest_fingerprint,
      policy_fingerprint: artifact.policy_fingerprint,
      source_snapshot_fingerprint: artifact.source_snapshot_fingerprint,
      row_count: artifact.rows.length,
      rows: artifact.rows,
    }),
    package_fingerprint: null,
  };
  request.package_fingerprint = canonicalHash(request);
  return request;
}
async function validate(run) {
  const outputs = [];
  for (const artifact of run.artifacts) {
    const request = validationRequest(run, artifact);
    const call = await roleCall(run.target, "validator", true, (client) =>
      client.query(
        "select public.validate_retailer_offer_sync_batch_read_only($1::jsonb) result",
        [request],
      ),
    );
    const result = call.result.rows[0].result;
    invariant(
      result.valid &&
        result.status === "DRY_RUN_VALIDATED" &&
        Number(result.row_count) === artifact.rows.length,
      "validator rejected child",
    );
    outputs.push({ request, result, identity: call.identity });
  }
  return outputs;
}
function registrationRequest(run) {
  const parentId = crypto.randomUUID();
  const children = run.artifacts.map((artifact) => ({
    child_plan_id: crypto.randomUUID(),
    artifact,
  }));
  const workflow = {
    repository:
      process.env.GITHUB_REPOSITORY || "SupplementScout/supplementscout",
    run_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT || "1",
    actor: process.env.GITHUB_ACTOR || "local-authorised-operator",
  };
  const expiresAt = new Date(Date.now() + 14 * 60_000).toISOString();
  const parentHashInput = {
    schema_version: 1,
    kind: "retailer-existing-offer-sync-parent",
    parent_plan_id: parentId,
    target_environment: run.spec.environment,
    target_project_ref: run.spec.ref,
    target_database_identity: run.spec.identity,
    retailer_id: String(config.retailer_id),
    source_country: "GB",
    source_snapshot_fingerprint: run.feed.semantic_fingerprint,
    source_captured_at: run.capturedAt,
    manifest_fingerprint: run.manifestFingerprint,
    approved_manifest_sha256: run.approvedManifestSha256,
    child_plan_ids: children.map((row) => row.child_plan_id),
    child_fingerprints: children.map(
      (row) => row.artifact.artifact_fingerprint,
    ),
    code_commit: run.head,
    expires_at: expiresAt,
    workflow,
  };
  const request = {
    schema_version: 1,
    kind: "retailer-existing-offer-sync-control-plan-registration",
    target_environment: run.spec.environment,
    target_project_ref: run.spec.ref,
    target_database_identity: run.spec.identity,
    retailer_id: String(config.retailer_id),
    retailer_slug: config.retailer_slug,
    source_platform: "EKM_GOOGLE_PRODUCT_FEED",
    source_domain: "wheyokay.com",
    source_country: "GB",
    source_snapshot_fingerprint: run.feed.semantic_fingerprint,
    source_captured_at: run.capturedAt,
    approved_manifest_sha256: run.approvedManifestSha256,
    manifest: run.manifest,
    manifest_fingerprint: run.manifestFingerprint,
    parent_plan_id: parentId,
    parent_plan_fingerprint: canonicalHash(parentHashInput),
    children,
    code_commit: run.head,
    expires_at: expiresAt,
    workflow,
    request_fingerprint: null,
  };
  request.request_fingerprint = canonicalHash(request);
  return request;
}
async function register(run, request) {
  const call = await roleCall(run.target, "validator", false, (client) =>
    client.query(
      "select public.register_retailer_offer_sync_control_plan($1::jsonb) result",
      [request],
    ),
  );
  const result = call.result.rows[0].result;
  invariant(
    result.status === "REGISTERED" &&
      Number(result.mapping_count) === config.approved_mapping_count &&
      Number(result.child_count) === run.artifacts.length &&
      Number(result.business_writes) === 0,
    "registration failed",
  );
  return { result, identity: call.identity };
}
async function approveAndExecute(run, registration, validations) {
  const results = [];
  const expiresAt = registration.expires_at;
  invariant(
    Date.parse(expiresAt) > Date.now() &&
      Date.parse(expiresAt) <= Date.now() + 15 * 60_000,
    "registered approval expiry is invalid",
  );
  for (let index = 0; index < registration.children.length; index += 1) {
    const child = registration.children[index];
    const artifact = child.artifact;
    const executionFingerprint = canonicalHash({
      child_plan_id: child.child_plan_id,
      artifact_fingerprint: artifact.artifact_fingerprint,
      target_environment: run.spec.environment,
      project_ref: run.spec.ref,
      database_identity: run.spec.identity,
      expected_migration_versions: run.binding.versions,
      expected_migration_fingerprint: run.binding.fingerprint,
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
    });
    const approvalRequest = {
      schema_version: 1,
      child_plan_id: child.child_plan_id,
      parent_plan_fingerprint: registration.parent_plan_fingerprint,
      child_plan_fingerprint: artifact.artifact_fingerprint,
      artifact,
      execution_fingerprint: executionFingerprint,
      expected_migration_versions: run.binding.versions,
      expected_migration_fingerprint: run.binding.fingerprint,
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      approved_by: `github-whey-okay-sync:${registration.workflow.run_id}`,
      expires_at: expiresAt,
      [`${run.target}_project_ref`]: run.spec.ref,
      [`${run.target}_database_identity`]: run.spec.identity,
    };
    const approved = await roleCall(run.target, "approver", false, (client) =>
      client.query(
        "select public.approve_retailer_offer_sync_batch($1::jsonb) result",
        [approvalRequest],
      ),
    );
    const approval = approved.result.rows[0].result;
    invariant(approval.status === "APPROVED", "approval failed");
    const executeRequest = {
      schema_version: 1,
      approval_id: approval.approval_id,
      execution_fingerprint: executionFingerprint,
      expected_migration_versions: run.binding.versions,
      expected_migration_fingerprint: run.binding.fingerprint,
      migration_fingerprint_algorithm: "SHA-256",
      migration_fingerprint_version: "RSBI-CJ1",
      [`${run.target}_project_ref`]: run.spec.ref,
      [`${run.target}_database_identity`]: run.spec.identity,
      requested_at: new Date().toISOString(),
      explicit_allow: true,
    };
    const executed = await roleCall(run.target, "executor", false, (client) =>
      client.query(
        "select public.execute_retailer_offer_sync_batch($1::jsonb) result",
        [executeRequest],
      ),
    );
    const result = executed.result.rows[0].result;
    invariant(
      result.status === "APPLIED" &&
        Number(result.row_approvals_created) === artifact.rows.length,
      "executor failed",
    );
    results.push({ validation: validations[index].result, approval, result });
  }
  return results;
}
function classificationCounts(rows) {
  const result = {};
  for (const row of rows) result[row.action] = (result[row.action] || 0) + 1;
  return result;
}
function changeSummary(rows) {
  return rows
    .filter((row) => row.action !== "VERIFY_NO_CHANGE")
    .map((row) => ({
      source_key: `${row.external_product_id}:${row.external_variant_id}`,
      mapping_id: row.retailer_product_id,
      offer_id: row.offer_id,
      action: row.action,
      changed_fields: row.changed_fields,
      before: row.atomic_plan.expected_state.offer,
      after: row.atomic_plan.offer.values,
    }));
}
function writeRunReports(args, run, base) {
  const prefix = artifactPrefix(args.target, args.mode);
  write(`${prefix}-discovery-report.json`, {
    result: "PASS",
    discovery_only: true,
    new_feed_rows: run.discovery.new_rows,
  });
  write(`${prefix}-missing-row-report.json`, {
    result: run.discovery.missing_rows.length === 0 ? "PASS" : "BLOCK",
    missing_approved_rows: run.discovery.missing_rows,
  });
  write(`${prefix}-shipping-differences.json`, {
    result: "REPORT_ONLY",
    expected_previous_count:
      config.shipping_policy.previously_expected_difference_count,
    actual_count: run.shippingDifferences.length,
    shipping_mutations: 0,
    rows: run.shippingDifferences,
  });
  write(`${prefix}-change-summary.json`, {
    result: "PASS",
    classification: base.classification,
    changes: changeSummary(run.classification.rows),
  });
}
async function executeRefresh(args, diagnostic) {
  invariant(process.env.SAFE_UPDATE === undefined, "SAFE_UPDATE must be unset");
  invariant(git("branch", "--show-current") === "main", "main required");
  if (!process.env.GITHUB_ACTIONS) {
    invariant(
      git("status", "--porcelain", "--untracked-files=no") === "",
      "tracked worktree must be clean",
    );
  }
  const before = await readState(args.target);
  diagnostic.database_before = before.counts;
  const run = await buildRun(args.target, before, diagnostic);
  if (run.discovery.missing_rows.length !== 0) {
    throw new RefreshError(
      "SOURCE_INCOMPLETE",
      "missing approved source identity",
      "SOURCE_GUARD",
      { missing_rows: run.discovery.missing_rows },
    );
  }
  const validations = await validate(run);
  diagnostic.validator_result = "PASS";
  diagnostic.guard_results.push({
    guard: "VALIDATOR",
    result: "PASS",
    batches: validations.length,
  });
  const classification = classificationCounts(run.classification.rows);
  const base = {
    result: "PASS",
    mode: args.mode,
    target: args.target,
    project_ref: run.spec.ref,
    source: run.feed.diagnostic,
    manifest: {
      sha256: run.approvedManifestSha256,
      rows: config.approved_mapping_count,
    },
    scope: {
      mappings: config.approved_mapping_count,
      offers: config.approved_mapping_count,
      legacy_excluded: config.legacy_mapping_count,
      children: run.artifacts.length,
    },
    classification,
    expected_deltas: run.classification.expected_deltas,
    discovery: {
      new_rows: run.discovery.new_rows.length,
      missing_rows: 0,
    },
    shipping_differences: {
      expected_previous: config.shipping_policy.previously_expected_difference_count,
      actual: run.shippingDifferences.length,
      mutations: 0,
    },
    validator_batches: validations.length,
    safe_update: "unset",
  };
  writeRunReports(args, run, base);
  if (args.mode === "dry-run") {
    write(`${artifactPrefix(args.target, args.mode)}-dry-run.json`, base);
    return base;
  }
  diagnostic.database_writes_attempted = 1;
  const registration = registrationRequest(run);
  const registered = await register(run, registration);
  diagnostic.control_writes_completed = 1 + run.artifacts.length;
  const executions = await approveAndExecute(run, registration, validations);
  diagnostic.approver_result = "PASS";
  diagnostic.executor_result = "PASS";
  diagnostic.approvals_created = executions.length;
  diagnostic.approvals_consumed = executions.length;
  const after = await readState(args.target);
  for (const key of [
    "products",
    "active_products",
    "product_variants",
    "retailer_products",
    "offers",
    "retailers",
  ]) {
    invariant(
      Number(after.counts[key]) === Number(before.counts[key]),
      `forbidden ${key} row-count delta`,
    );
  }
  invariant(
    JSON.stringify(after.reviewed_exceptions) ===
      JSON.stringify(before.reviewed_exceptions),
    "reviewed exception changed",
  );
  const historyDelta =
    Number(after.counts.price_history) - Number(before.counts.price_history);
  const expectedHistory = Number(
    run.classification.expected_deltas.row_count_deltas.price_history,
  );
  invariant(historyDelta === expectedHistory, "price-history delta mismatch");
  diagnostic.database_after = after.counts;
  diagnostic.database_writes_completed = executions.length;
  diagnostic.business_writes_completed = config.approved_mapping_count;
  const output = {
    ...base,
    registration: registered.result,
    executions: executions.map((row) => row.result),
    business: {
      products_delta: 0,
      active_products_delta: 0,
      variants_delta: 0,
      mappings_delta: 0,
      offers_delta: 0,
      retailers_delta: 0,
      price_history_delta: historyDelta,
      offers_refreshed: config.approved_mapping_count,
      shipping_mutations: 0,
      reviewed_exception_mutations: 0,
    },
    approvals: {
      created: executions.length,
      consumed: executions.length,
    },
    recovery_calls: 0,
  };
  write(`${artifactPrefix(args.target, args.mode)}-apply.json`, output);
  return output;
}
async function runWithDiagnostic(
  argv = process.argv.slice(2),
  { operation = executeRefresh, outDir = OUT, env = process.env } = {},
) {
  fs.mkdirSync(outDir, { recursive: true });
  const diagnostic = diagnosticTemplate(argv, env);
  const target = diagnostic.target;
  const mode = diagnostic.mode;
  const name = `${artifactPrefix(target, mode, env)}-diagnostic.json`;
  write(name, diagnostic, outDir);
  try {
    const args = parseArgs(argv);
    const result = await operation(args, diagnostic);
    Object.assign(diagnostic, {
      result: "PASS",
      completed_at: new Date().toISOString(),
      failure_stage: null,
      error_code: null,
      error_message: null,
    });
    write(name, diagnostic, outDir);
    return { result, diagnostic, diagnostic_path: path.join(outDir, name) };
  } catch (error) {
    Object.assign(diagnostic, {
      result: "FAIL",
      completed_at: new Date().toISOString(),
      failure_stage: error.stage || "STARTUP_OR_INTERNAL",
      error_code: error.code || "INTERNAL_ERROR",
      error_message: error.message,
    });
    if (error.detail && Object.keys(error.detail).length) {
      diagnostic.error_detail = error.detail;
    }
    write(name, diagnostic, outDir);
    throw error;
  }
}
async function main(argv = process.argv.slice(2)) {
  const completed = await runWithDiagnostic(argv);
  console.log(JSON.stringify(completed.result));
  return completed.result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  RefreshError,
  artifactPrefix,
  buildRun,
  changeSummary,
  diagnosticTemplate,
  guardrailsFor,
  loadManifest,
  parseArgs,
  readState,
  registrationRequest,
  runWithDiagnostic,
  sourceHealth,
  targetFor,
};
