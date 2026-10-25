const { canonicalJson, normalizeNumbersToDecimalStrings } = require("./canonical-json");
const { validateCanonicalIdentityEvidence } = require("./reviewed-catalogue-canonical-evidence");

const CONTRACT_KIND = "reviewed-catalogue-package-v3";
const ENVELOPE_KIND = "reviewed-catalogue-authorization-v3";
const FLAVOUR_ALIASES = new Set(["flavour", "flavor", "flavours", "flavors"]);
const PHYSICAL_KEYS = new Set(["weight", "size"]);
const COUNT_KEYS = new Set(["size", "servings", "serving count", "count", "quantity"]);
const COMMERCIAL_EXCLUSION_PATTERN = /\b(bundle|stack|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\b/i;
const DESCRIPTION_EXCLUSION_PATTERN = /\b(bundle|with\s+free|plus\s+free|free\s+item|bbe|dated|best\s+before|short\s+date|short\s+dated)\b/i;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  invariant(canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()), `${label} keys mismatch`);
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function decimalString(value) {
  const number = Number(value);
  invariant(Number.isFinite(number) && number > 0, "V3 option numeric value invalid");
  return String(number).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function parseCompositeSize(value) {
  const match = String(value || "").trim().match(
    /^([1-9]\d*)\s*([a-z]+)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(mcg|mg|kg|g|ml|cl|l)\s*\)$/i,
  );
  if (!match) return null;
  const countUnit = normalizeCountUnit(match[2]);
  if (!countUnit) return null;
  let amount = Number(match[3].replace(",", "."));
  let unit = match[4].toLowerCase();
  if (unit === "kg") { amount *= 1000; unit = "g"; }
  if (unit === "l") { amount *= 1000; unit = "ml"; }
  if (unit === "cl") { amount *= 10; unit = "ml"; }
  return {
    count: { count_value: match[1], count_unit: countUnit },
    physical_size: { size_value: decimalString(amount), size_unit: unit },
  };
}

function parsePhysicalSize(value) {
  const match = String(value || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(mcg|mg|kg|g|ml|cl|l)$/i);
  if (!match) return parseCompositeSize(value)?.physical_size || null;
  let amount = Number(match[1].replace(",", "."));
  let unit = match[2].toLowerCase();
  if (unit === "kg") { amount *= 1000; unit = "g"; }
  if (unit === "l") { amount *= 1000; unit = "ml"; }
  if (unit === "cl") { amount *= 10; unit = "ml"; }
  return { size_value: decimalString(amount), size_unit: unit };
}

function normalizeCountUnit(value) {
  const compact = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  const aliases = new Map([
    ["serving", "servings"], ["servings", "servings"],
    ["capsule", "capsules"], ["capsules", "capsules"], ["cap", "capsules"], ["caps", "capsules"],
    ["tablet", "tablets"], ["tablets", "tablets"], ["tab", "tablets"], ["tabs", "tablets"],
    ["softgel", "softgels"], ["softgels", "softgels"],
    ["sachet", "sachets"], ["sachets", "sachets"],
    ["shot", "shots"], ["shots", "shots"],
    ["piece", "pieces"], ["pieces", "pieces"],
    ["gummy", "gummies"], ["gummies", "gummies"],
  ]);
  return aliases.get(compact) || null;
}

function parseCount(value) {
  const match = String(value || "").trim().match(/^([1-9]\d*(?:\s*\/\s*[1-9]\d*)?)\s*([a-z]+)$/i);
  if (!match) return parseCompositeSize(value)?.count || null;
  const countUnit = normalizeCountUnit(match[2]);
  if (!countUnit) return null;
  return { count_value: match[1].replace(/\s+/g, ""), count_unit: countUnit };
}

function oneRole(candidates, label) {
  invariant(candidates.length <= 1, `V3 ${label} option role is ambiguous`);
  return candidates[0] || null;
}

function resolveOptionRoles(rawOptions) {
  exactKeys(rawOptions, Object.keys(rawOptions || {}), "V3 raw external options");
  const entries = Object.entries(rawOptions);
  const flavours = [];
  const physical = [];
  const counts = [];
  for (const [sourceKey, sourceValue] of entries) {
    const key = normalizedKey(sourceKey);
    const value = String(sourceValue ?? "").trim();
    invariant(value, "V3 raw external option value missing");
    if (FLAVOUR_ALIASES.has(key)) {
      flavours.push({ source_key: sourceKey, source_value: value });
    }
    const physicalValue = PHYSICAL_KEYS.has(key) ? parsePhysicalSize(value) : null;
    if (physicalValue) physical.push({ source_key: sourceKey, source_value: value, ...physicalValue });
    const countValue = COUNT_KEYS.has(key) ? parseCount(value) : null;
    if (countValue) counts.push({ source_key: sourceKey, source_value: value, ...countValue });
  }
  return {
    flavour: oneRole(flavours, "flavour"),
    physical_size: oneRole(physical, "physical size"),
    count: oneRole(counts, "count"),
  };
}

function validateOptionRoles(rawOptions, roles) {
  exactKeys(roles, ["flavour", "physical_size", "count"], "V3 option roles");
  const resolved = resolveOptionRoles(rawOptions);
  invariant(canonicalJson(roles) === canonicalJson(resolved), "V3 option roles do not match raw external options");
  return roles;
}

function validateSourceStructure(structure) {
  exactKeys(structure, ["product_variant_count", "meaningful_variant_axes"], "V3 source structure");
  invariant(Number.isSafeInteger(structure.product_variant_count) && structure.product_variant_count > 0, "V3 source variant count invalid");
  invariant(Array.isArray(structure.meaningful_variant_axes), "V3 meaningful variant axes invalid");
  const axes = structure.meaningful_variant_axes.map(normalizedKey);
  invariant(axes.every(Boolean) && new Set(axes).size === axes.length, "V3 meaningful variant axes invalid or duplicated");
  return { product_variant_count: structure.product_variant_count, meaningful_variant_axes: axes };
}

function evidenceContext(reviewed, context = {}) {
  return {
    retailer_id: context.retailer_id, authorized_at: context.authorized_at,
    external_product_id: reviewed.external_product_id, external_variant_id: reviewed.external_variant_id,
    source_row_fingerprint: reviewed.source_row_fingerprint, brand: reviewed.brand,
    product_identity: reviewed.product_name, external_gtin: reviewed.external_gtin, external_sku: reviewed.external_sku,
  };
}

function assertV3ActionSemantics(reviewed, context = {}) {
  const structure = validateSourceStructure(reviewed.source_structure);
  const roles = validateOptionRoles(reviewed.external_options, reviewed.option_roles);
  if (reviewed.action === "create_product_with_default_variant") {
    invariant(structure.product_variant_count === 1 && structure.meaningful_variant_axes.length === 0, "V3 default variant requires one source variant without a meaningful variant axis");
    invariant(roles.flavour === null && reviewed.flavour === null, "V3 default variant cannot manufacture flavour evidence");
  }
  if (["create_product_with_variant", "create_variant_on_existing_product"].includes(reviewed.action)) {
    invariant(roles.flavour && structure.meaningful_variant_axes.includes("flavour"), "V3 explicit variant requires a reviewed flavour axis");
  }
  const projection = validateCanonicalIdentityEvidence(reviewed.canonical_identity_evidence, evidenceContext(reviewed, context));
  const selectedPhysical = projection?.selected_facts.physical_size;
  const selectedCount = projection?.selected_facts.container_count;
  const selectedPackCount = projection?.selected_facts.pack_count;
  const selectedFormat = projection?.selected_facts.product_format;
  if (reviewed.size_value != null || reviewed.size_unit != null) {
    invariant(
      roles.physical_size && roles.physical_size.size_value === String(reviewed.size_value) && roles.physical_size.size_unit === reviewed.size_unit ||
      selectedPhysical && selectedPhysical.normalized_value === String(reviewed.size_value) && selectedPhysical.unit === reviewed.size_unit,
      "V3 physical size role mismatch",
    );
  }
  if (reviewed.unit_count != null || reviewed.unit_type != null) {
    invariant(
      roles.count && roles.count.count_value === String(reviewed.unit_count) && roles.count.count_unit === reviewed.unit_type ||
      selectedCount && selectedCount.normalized_value === String(reviewed.unit_count) && selectedCount.unit === reviewed.unit_type,
      "V3 count role mismatch",
    );
  }
  if (selectedPackCount) {
    invariant(selectedPackCount.normalized_value === String(reviewed.pack_count) && selectedPackCount.unit === "packs", "V3 pack count projection mismatch");
  }
  if (selectedFormat) {
    invariant(selectedFormat.normalized_value === reviewed.product_format && selectedFormat.unit === "format", "V3 product format projection mismatch");
  }
}

function strictShopifyUrl(url, retailerWebsite, externalVariantId) {
  try {
    const parsed = new URL(url);
    const retailer = new URL(retailerWebsite);
    return parsed.protocol === "https:" && parsed.hostname.replace(/^www\./, "") === retailer.hostname.replace(/^www\./, "") &&
      parsed.pathname.includes("/products/") && parsed.searchParams.get("variant") === String(externalVariantId);
  } catch {
    return false;
  }
}

function isV3SourceExcluded(row) {
  const commercialIdentity = [row.product_name, row.external_name, row.variant_name, row.external_url]
    .filter(Boolean).join(" ");
  const description = String(row.description || "");
  return COMMERCIAL_EXCLUSION_PATTERN.test(commercialIdentity) || DESCRIPTION_EXCLUSION_PATTERN.test(description);
}

function buildV3Envelope({ manifest, profile, reviewed, entry, artifact, manifestSha256 }) {
  invariant(manifest?.kind === CONTRACT_KIND && manifest.schema_version === 3, "Reviewed V3 manifest required");
  assertV3ActionSemantics(reviewed, { retailer_id: manifest.retailer.id, authorized_at: manifest.authorized_at });
  const plan = entry.resolved_plan || entry.importPlan;
  invariant(plan, "Reviewed V3 plan missing");
  return {
    schema_version: 3,
    kind: ENVELOPE_KIND,
    source_platform: manifest.source_platform,
    target_environment: manifest.target_environment,
    target_project_ref: manifest.target_project_ref,
    retailer: {
      id: String(manifest.retailer.id),
      name: manifest.retailer.name,
      slug: manifest.retailer.slug,
      website: manifest.retailer.website,
    },
    profile_id: profile.id,
    manifest_sha256: manifestSha256,
    artifact_sha256: profile.artifact_sha256,
    run_id: artifact.run_id,
    review_row: String(reviewed.review_row),
    reviewed_action: reviewed.action,
    external_product_id: reviewed.external_product_id,
    external_variant_id: reviewed.external_variant_id,
    direct_source_url: reviewed.external_url,
    affiliate_url: reviewed.affiliate_url,
    external_options: reviewed.external_options,
    option_roles: reviewed.option_roles,
    source_structure: reviewed.source_structure,
    source_row_fingerprint: reviewed.source_row_fingerprint,
    ...(reviewed.canonical_identity_evidence == null ? {} : {
      canonical_identity_evidence: normalizeNumbersToDecimalStrings(reviewed.canonical_identity_evidence),
    }),
    plan_fingerprint: reviewed.plan_fingerprint,
  };
}

module.exports = {
  CONTRACT_KIND,
  ENVELOPE_KIND,
  assertV3ActionSemantics,
  buildV3Envelope,
  isV3SourceExcluded,
  parseCount,
  parseCompositeSize,
  parsePhysicalSize,
  resolveOptionRoles,
  strictShopifyUrl,
  validateOptionRoles,
  validateSourceStructure,
};
