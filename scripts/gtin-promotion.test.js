const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertFreshPreview,
  buildPromotionPreview,
  isValidGtin,
} = require("./lib/gtin-promotion");
const { OWNER_REVIEWED_36_IDENTITIES, parseArgs, parseConfirmedCandidates, parseOwnerReviewed36Candidates } = require("./gtin-promotion-dry-run");
const fs = require("node:fs");
const path = require("node:path");

const VALID_GTIN = "5999076228171";

function snapshot(overrides = {}) {
  return {
    fingerprint: overrides.fingerprint || "canonical-v1",
    products: overrides.products || [
      { id: "1", name: "Example", gtin: null, is_active: true, merged_into_product_id: null },
    ],
    variants: overrides.variants || [
      { id: "10", product_id: "1", display_name: "300 g", gtin: null, is_active: true, is_default: false },
    ],
  };
}

function candidate(overrides = {}) {
  return {
    product_id: "1",
    variant_id: "10",
    gtin: VALID_GTIN,
    candidate_source: "TEST",
    evidence_confirmed: true,
    evidence_sources: ["retailer:a", "manufacturer:b"],
    semantic_checks: { brand: true, size: true, unit_count: true, flavour: true, format: true },
    ...overrides,
  };
}

function row(candidateOverrides = {}, snapshotOverrides = {}, options = {}) {
  return buildPromotionPreview(
    [candidate(candidateOverrides)],
    snapshot(snapshotOverrides),
    { createdAt: "2026-08-13T10:00:00.000Z", ...options }
  ).rows[0];
}

test("accepts GTIN-8/12/13/14 with valid checksum", () => {
  for (const gtin of ["96385074", "040232661082", VALID_GTIN, "05999076228171"]) {
    assert.equal(isValidGtin(gtin), true, gtin);
  }
});

test("blocks invalid checksum", () => {
  assert.deepEqual(row({ gtin: "5999076228172" }).blockers, ["INVALID_CHECKSUM"]);
});

test("blocks GTIN already assigned to another canonical variant", () => {
  const result = row({}, {
    products: [
      { id: "1", name: "Example", gtin: null, is_active: true, merged_into_product_id: null },
      { id: "2", name: "Other", gtin: null, is_active: true, merged_into_product_id: null },
    ],
    variants: [
      { id: "10", product_id: "1", display_name: "300 g", gtin: null, is_active: true, is_default: false },
      { id: "20", product_id: "2", display_name: "Other", gtin: VALID_GTIN, is_active: true, is_default: true },
    ],
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("GTIN_ASSIGNED_TO_OTHER_CANONICAL_IDENTITY"));
});

test("blocks one proposed GTIN targeting two canonical identities", () => {
  const preview = buildPromotionPreview(
    [candidate(), candidate({ product_id: "2", variant_id: "20" })],
    snapshot({
      products: [
        { id: "1", name: "Example", gtin: null, is_active: true, merged_into_product_id: null },
        { id: "2", name: "Other", gtin: null, is_active: true, merged_into_product_id: null },
      ],
      variants: [
        { id: "10", product_id: "1", gtin: null, is_active: true, is_default: false },
        { id: "20", product_id: "2", gtin: null, is_active: true, is_default: false },
      ],
    }),
    { createdAt: "2026-08-13T10:00:00.000Z" }
  );
  assert.ok(preview.rows.every((item) => item.blockers.includes("GTIN_PROPOSED_FOR_MULTIPLE_CANONICAL_IDENTITIES")));
});

test("blocks a conflicting value in the destination field", () => {
  const result = row({}, { variants: [{ id: "10", product_id: "1", gtin: "040232661082", is_active: true, is_default: false }] });
  assert.ok(result.blockers.includes("DESTINATION_VALUE_CONFLICT"));
});

test("classifies an existing identical GTIN as idempotent ALREADY_PRESENT", () => {
  const result = row({}, { variants: [{ id: "10", product_id: "1", gtin: VALID_GTIN, is_active: true, is_default: false }] });
  assert.equal(result.decision, "ALREADY_PRESENT");
  assert.equal(result.current_value, VALID_GTIN);
});

test("uses product_variants.gtin as the default destination", () => {
  assert.equal(row().destination_field, "product_variants.gtin");
});

test("permits products.gtin only for an explicitly single default trade item", () => {
  const result = row(
    { destination_hint: "product", single_trade_item: true },
    { variants: [{ id: "10", product_id: "1", gtin: null, is_active: true, is_default: true }] }
  );
  assert.equal(result.destination_field, "products.gtin");
  assert.equal(result.decision, "READY_TO_PROMOTE");
});

test("sends an ambiguous variant to manual review", () => {
  assert.equal(row({ ambiguous_variant: true }).decision, "MANUAL_REVIEW");
});

test("blocks wrong size", () => {
  assert.ok(row({ semantic_checks: { brand: true, size: false, unit_count: true, flavour: true, format: true } }).blockers.includes("SEMANTIC_SIZE_MISMATCH"));
});

test("blocks wrong flavour", () => {
  assert.ok(row({ semantic_checks: { brand: true, size: true, unit_count: true, flavour: false, format: true } }).blockers.includes("SEMANTIC_FLAVOUR_MISMATCH"));
});

test("blocks quarantined GTIN", () => {
  const result = row({}, {}, { quarantinedGtins: [VALID_GTIN] });
  assert.ok(result.blockers.includes("QUARANTINED_GTIN"));
});

test("rejects stale, expired and modified previews", () => {
  const preview = buildPromotionPreview([candidate()], snapshot(), {
    createdAt: "2026-08-13T10:00:00.000Z",
    expiresAt: "2026-08-13T10:15:00.000Z",
  });
  assert.equal(assertFreshPreview(preview, "canonical-v1", new Date("2026-08-13T10:10:00.000Z")), true);
  assert.throws(() => assertFreshPreview(preview, "canonical-v2", new Date("2026-08-13T10:10:00.000Z")), /stale/);
  assert.throws(() => assertFreshPreview(preview, "canonical-v1", new Date("2026-08-13T10:16:00.000Z")), /expired/);
  assert.throws(() => assertFreshPreview({ ...preview, candidate_count: 2 }, "canonical-v1", new Date("2026-08-13T10:10:00.000Z")), /fingerprint/);
});

test("preview contains immutable row and audit fingerprints and never enables writes", () => {
  const first = buildPromotionPreview([candidate()], snapshot(), { createdAt: "2026-08-13T10:00:00.000Z" });
  const second = buildPromotionPreview([candidate()], snapshot(), { createdAt: "2026-08-13T10:00:00.000Z" });
  assert.match(first.preview_fingerprint, /^[0-9a-f]{64}$/);
  assert.match(first.rows[0].candidate_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(first.preview_fingerprint, second.preview_fingerprint);
  assert.equal(first.write_enabled, false);
  assert.equal(first.safe_update_enabled, false);
});

test("durable confirmation ledger still yields exactly 40 safe candidates", () => {
  const markdown = fs.readFileSync(path.resolve(__dirname, "..", "docs", "EBAY-UK-COVERAGE-PLAN.md"), "utf8");
  const candidates = parseConfirmedCandidates(markdown);
  assert.equal(candidates.length, 40);
  assert.equal(new Set(candidates.map((item) => `${item.product_id}:${item.variant_id}:${item.gtin}`)).size, 40);
});

test("exact owner-reviewed 36 scope is immutable and only available as a read-only dry-run scope", () => {
  const markdown = fs.readFileSync(path.resolve(__dirname, "..", "docs", "EBAY-UK-COVERAGE-PLAN.md"), "utf8");
  const candidates = parseOwnerReviewed36Candidates(markdown);
  assert.equal(candidates.length, 36);
  assert.deepEqual(candidates.map(({ product_id, variant_id, gtin }) => ({ product_id, variant_id, gtin })), OWNER_REVIEWED_36_IDENTITIES);
  assert.ok(candidates.every((row) => row.destination_hint === "variant" && row.evidence_confirmed === true && row.evidence_sources.length === 2));
  assert.equal(parseArgs(["--target=production", "--scope=owner-reviewed-36"]).scope, "owner-reviewed-36");
  assert.throws(() => parseArgs(["--target=production", "--scope=anything-else"]), /Unsupported GTIN promotion scope/);
});

test("owner-reviewed 36 parser fails closed if documentation scope changes", () => {
  const markdown = fs.readFileSync(path.resolve(__dirname, "..", "docs", "EBAY-UK-COVERAGE-PLAN.md"), "utf8");
  assert.throws(() => parseOwnerReviewed36Candidates(markdown.replace("769/2014=5903111089085", "769/2014=5903111089086")), /scope drift/);
});
