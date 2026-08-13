const { hash } = require("./retailer-snapshot/fingerprints");

const DECISIONS = Object.freeze([
  "READY_TO_PROMOTE",
  "ALREADY_PRESENT",
  "MANUAL_REVIEW",
  "BLOCKED",
]);

function normalizeGtin(value) {
  return String(value ?? "").replace(/[\s-]+/g, "");
}

function isValidGtin(value) {
  const gtin = normalizeGtin(value);
  if (![8, 12, 13, 14].includes(gtin.length) || !/^\d+$/.test(gtin)) return false;
  const digits = [...gtin].map(Number);
  const check = digits.pop();
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function text(value) {
  const result = String(value ?? "").trim();
  return result || null;
}

function canonicalOwner(snapshot, gtin) {
  const owners = [];
  for (const product of snapshot.products || []) {
    if (normalizeGtin(product.gtin) === gtin) {
      owners.push({ field: "products.gtin", product_id: String(product.id), variant_id: null });
    }
  }
  for (const variant of snapshot.variants || []) {
    if (normalizeGtin(variant.gtin) === gtin) {
      owners.push({
        field: "product_variants.gtin",
        product_id: String(variant.product_id),
        variant_id: String(variant.id),
      });
    }
  }
  return owners;
}

function chooseDestination(candidate, product, variant, activeVariants) {
  if (candidate.destination_hint === "product") {
    if (
      candidate.single_trade_item === true &&
      variant.is_default === true &&
      activeVariants.length === 1
    ) {
      return { field: "products.gtin", current: text(product.gtin) };
    }
    return null;
  }
  if (normalizeGtin(product.gtin) === candidate.gtin) {
    return { field: "products.gtin", current: text(product.gtin) };
  }
  return { field: "product_variants.gtin", current: text(variant.gtin) };
}

function planCandidate(candidate, snapshot, context = {}) {
  const gtin = normalizeGtin(candidate.gtin);
  const productId = String(candidate.product_id);
  const variantId = String(candidate.variant_id);
  const product = (snapshot.products || []).find((row) => String(row.id) === productId);
  const variant = (snapshot.variants || []).find((row) => String(row.id) === variantId);
  const activeVariants = (snapshot.variants || []).filter(
    (row) => String(row.product_id) === productId && row.is_active !== false
  );
  const blockers = [];
  let review = false;

  if (!isValidGtin(gtin)) blockers.push("INVALID_CHECKSUM");
  if (!product || product.is_active === false || product.merged_into_product_id != null) {
    blockers.push("CANONICAL_PRODUCT_NOT_ACTIVE");
  }
  if (!variant || variant.is_active === false || String(variant.product_id) !== productId) {
    blockers.push("CANONICAL_VARIANT_NOT_ACTIVE_OR_MISMATCHED");
  }
  if (candidate.ambiguous_variant === true) review = true;
  const checks = candidate.semantic_checks || {};
  for (const field of ["brand", "size", "unit_count", "flavour", "format"]) {
    if (checks[field] === false) blockers.push(`SEMANTIC_${field.toUpperCase()}_MISMATCH`);
    if (checks[field] == null) review = true;
  }
  const evidenceSources = [...new Set((candidate.evidence_sources || []).map(String))];
  if (evidenceSources.length < 2 || candidate.evidence_confirmed !== true) review = true;
  if ((context.quarantinedGtins || new Set()).has(gtin)) blockers.push("QUARANTINED_GTIN");

  const destination = product && variant
    ? chooseDestination({ ...candidate, gtin }, product, variant, activeVariants)
    : null;
  if (!destination) review = true;

  const owners = canonicalOwner(snapshot, gtin);
  const foreignOwners = owners.filter((owner) => {
    if (owner.product_id !== productId) return true;
    if (owner.field === "product_variants.gtin" && owner.variant_id !== variantId) return true;
    return false;
  });
  if (foreignOwners.length) blockers.push("GTIN_ASSIGNED_TO_OTHER_CANONICAL_IDENTITY");
  const proposedTargets = (context.gtinTargets || new Map()).get(gtin);
  if (proposedTargets && proposedTargets.size > 1) {
    blockers.push("GTIN_PROPOSED_FOR_MULTIPLE_CANONICAL_IDENTITIES");
  }

  const destinationKey = destination
    ? `${destination.field}:${destination.field === "products.gtin" ? productId : variantId}`
    : null;
  const targetConflicts = (context.targetGtins || new Map()).get(destinationKey);
  if (targetConflicts && (targetConflicts.size > 1 || !targetConflicts.has(gtin))) {
    blockers.push("MULTIPLE_GTINS_FOR_DESTINATION");
  }
  if (destination?.current && normalizeGtin(destination.current) !== gtin) {
    blockers.push("DESTINATION_VALUE_CONFLICT");
  }

  let decision = "READY_TO_PROMOTE";
  if (blockers.length) decision = "BLOCKED";
  else if (review) decision = "MANUAL_REVIEW";
  else if (destination.current && normalizeGtin(destination.current) === gtin) {
    decision = "ALREADY_PRESENT";
  }

  const row = {
    product_id: productId,
    variant_id: variantId,
    product_name: product?.name || candidate.product_name || null,
    variant: variant?.display_name || variant?.flavour_label || candidate.variant || null,
    gtin,
    destination_field: destination?.field || null,
    current_value: destination?.current || null,
    proposed_value: gtin,
    evidence_count: evidenceSources.length,
    evidence_sources: evidenceSources,
    blockers: [...new Set(blockers)].sort(),
    decision,
    candidate_source: candidate.candidate_source,
  };
  row.candidate_fingerprint = hash("GTIN-PROMOTION-CANDIDATE:1", row);
  return row;
}

function buildPromotionPreview(candidates, snapshot, options = {}) {
  const targetGtins = new Map();
  const gtinTargets = new Map();
  for (const candidate of candidates) {
    const product = (snapshot.products || []).find((row) => String(row.id) === String(candidate.product_id));
    const variant = (snapshot.variants || []).find((row) => String(row.id) === String(candidate.variant_id));
    if (!product || !variant) continue;
    const destination = chooseDestination(
      { ...candidate, gtin: normalizeGtin(candidate.gtin) },
      product,
      variant,
      (snapshot.variants || []).filter(
        (row) => String(row.product_id) === String(candidate.product_id) && row.is_active !== false
      )
    );
    if (!destination) continue;
    const key = `${destination.field}:${destination.field === "products.gtin" ? candidate.product_id : candidate.variant_id}`;
    if (!targetGtins.has(key)) targetGtins.set(key, new Set());
    targetGtins.get(key).add(normalizeGtin(candidate.gtin));
    const gtin = normalizeGtin(candidate.gtin);
    if (!gtinTargets.has(gtin)) gtinTargets.set(gtin, new Set());
    gtinTargets.get(gtin).add(key);
  }

  const rows = candidates.map((candidate) =>
    planCandidate(candidate, snapshot, {
      targetGtins,
      gtinTargets,
      quarantinedGtins: new Set((options.quarantinedGtins || []).map(normalizeGtin)),
    })
  );
  const createdAt = options.createdAt || new Date().toISOString();
  const expiresAt = options.expiresAt || new Date(Date.parse(createdAt) + 15 * 60 * 1000).toISOString();
  const summary = Object.fromEntries(DECISIONS.map((decision) => [decision, rows.filter((row) => row.decision === decision).length]));
  const preview = {
    schema_version: 1,
    operation_type: "GTIN_PROMOTION",
    write_enabled: false,
    safe_update_enabled: false,
    created_at: createdAt,
    expires_at: expiresAt,
    canonical_snapshot_fingerprint: snapshot.fingerprint,
    source_fingerprint: options.sourceFingerprint || null,
    candidate_count: rows.length,
    summary,
    rows,
    preview_fingerprint: null,
  };
  preview.preview_fingerprint = hash("GTIN-PROMOTION-PREVIEW:1", preview);
  return preview;
}

function assertFreshPreview(preview, snapshotFingerprint, now = new Date()) {
  if (preview.write_enabled !== false || preview.operation_type !== "GTIN_PROMOTION") {
    throw new Error("Invalid GTIN promotion preview");
  }
  if (Date.parse(preview.expires_at) <= now.getTime()) throw new Error("GTIN promotion preview expired");
  if (preview.canonical_snapshot_fingerprint !== snapshotFingerprint) {
    throw new Error("GTIN promotion preview is stale");
  }
  const supplied = preview.preview_fingerprint;
  const expected = hash("GTIN-PROMOTION-PREVIEW:1", { ...preview, preview_fingerprint: null });
  if (supplied !== expected) throw new Error("GTIN promotion preview fingerprint mismatch");
  return true;
}

module.exports = {
  DECISIONS,
  assertFreshPreview,
  buildPromotionPreview,
  isValidGtin,
  normalizeGtin,
  planCandidate,
};
