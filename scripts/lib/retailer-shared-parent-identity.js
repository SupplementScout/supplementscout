const crypto = require("node:crypto");
const {
  canonicalJson,
  normalizeDecimalString,
} = require("./canonical-json");

const CONTRACT_VERSION = "1";

function identifier(value) {
  return String(value ?? "").trim() || null;
}

function normalizeOptions(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("shared parent external_options must be an object");
  }
  return JSON.parse(canonicalJson(parsed));
}

function decimalOrNull(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  return normalizeDecimalString(value, fieldName);
}

function canonicalVariantSignature(variant) {
  if (!variant) return null;
  return {
    variant_key: identifier(variant.variant_key),
    display_name: identifier(variant.display_name),
    flavour_code: identifier(variant.flavour_code),
    flavour_label: identifier(variant.flavour_label),
    size_value: decimalOrNull(variant.size_value, "shared parent size_value"),
    size_unit: identifier(variant.size_unit)?.toLowerCase() || null,
    pack_count: decimalOrNull(
      variant.pack_count ?? 1,
      "shared parent pack_count"
    ),
    product_format: identifier(variant.product_format)?.toLowerCase() || null,
  };
}

function canonicalTargetKey(peer) {
  if (peer.legacy) return null;
  if (peer.product_variant_id) return `id:${peer.product_variant_id}`;
  if (!peer.canonical_variant) {
    throw new Error("shared parent exact peer requires a canonical variant identity");
  }
  return `planned:${canonicalJson(peer.canonical_variant)}`;
}

function normalizeSharedParentPeer(peer) {
  const normalized = {
    retailer_id: identifier(peer.retailer_id),
    external_product_id: identifier(peer.external_product_id),
    external_variant_id: identifier(peer.external_variant_id),
    product_id: identifier(peer.product_id),
    product_variant_id: identifier(peer.product_variant_id),
    canonical_variant: canonicalVariantSignature(peer.canonical_variant),
    external_sku: identifier(peer.external_sku),
    external_gtin: identifier(peer.external_gtin),
    external_options: normalizeOptions(peer.external_options),
    external_url: identifier(peer.external_url),
    legacy: Boolean(peer.legacy),
  };
  if (!normalized.retailer_id || !normalized.product_id || !normalized.external_url) {
    throw new Error("shared parent peer is missing retailer, product or URL identity");
  }
  if (normalized.legacy) {
    if (normalized.external_variant_id || normalized.external_product_id) {
      throw new Error("shared parent legacy peer cannot carry exact source identity");
    }
    if (!normalized.product_variant_id || normalized.canonical_variant) {
      throw new Error("shared parent legacy peer requires an existing canonical variant");
    }
  } else if (!normalized.external_product_id || !normalized.external_variant_id) {
    throw new Error("shared parent exact peer requires product and variant source identity");
  }
  return normalized;
}

function peerSortKey(peer) {
  return [
    peer.legacy ? "0" : "1",
    peer.external_variant_id || "",
    peer.product_variant_id || "",
    canonicalTargetKey(peer) || "",
  ].join("|");
}

function assertUnique(peers, field, label, predicate = () => true) {
  const seen = new Set();
  for (const peer of peers) {
    if (!predicate(peer) || !peer[field]) continue;
    if (seen.has(peer[field])) {
      throw new Error(`shared parent ${label} collision`);
    }
    seen.add(peer[field]);
  }
}

function validateSharedParentPeerCohort(rawPeers) {
  const peers = rawPeers.map(normalizeSharedParentPeer);
  if (peers.length === 0) {
    throw new Error("shared parent cohort cannot be empty");
  }
  const retailerIds = new Set(peers.map((peer) => peer.retailer_id));
  const productIds = new Set(peers.map((peer) => peer.product_id));
  const urls = new Set(peers.map((peer) => peer.external_url));
  if (retailerIds.size !== 1) throw new Error("shared parent retailer identity conflict");
  if (productIds.size !== 1) throw new Error("shared parent canonical product conflict");
  if (urls.size !== 1) throw new Error("shared parent URL cohort mismatch");

  const exactPeers = peers.filter((peer) => !peer.legacy);
  const legacyPeers = peers.filter((peer) => peer.legacy);
  if (legacyPeers.length > 1) {
    throw new Error("shared parent contains multiple legacy URL peers");
  }
  const parentIds = new Set(exactPeers.map((peer) => peer.external_product_id));
  if (parentIds.size !== 1) {
    throw new Error("shared parent external product ID drift");
  }

  assertUnique(exactPeers, "external_variant_id", "external variant ID");
  assertUnique(exactPeers, "external_sku", "external SKU");
  assertUnique(exactPeers, "external_gtin", "external GTIN");

  const canonicalTargets = new Set();
  const optionTuples = new Set();
  for (const peer of exactPeers) {
    const canonicalTarget = canonicalTargetKey(peer);
    if (canonicalTargets.has(canonicalTarget)) {
      throw new Error("shared parent canonical variant collision");
    }
    canonicalTargets.add(canonicalTarget);
    if (peer.external_options) {
      const optionKey = canonicalJson(peer.external_options);
      if (optionTuples.has(optionKey)) {
        throw new Error("shared parent exact option tuple collision");
      }
      optionTuples.add(optionKey);
    }
  }

  return peers.sort((left, right) =>
    peerSortKey(left).localeCompare(peerSortKey(right))
  );
}

function peerFromMapping(mapping) {
  return normalizeSharedParentPeer({
    ...mapping,
    legacy: !identifier(mapping.external_variant_id),
    canonical_variant: null,
  });
}

function peerFromResolvedItem(item) {
  const variant = item.productVariant;
  return normalizeSharedParentPeer({
    retailer_id: item.retailer?.id,
    external_product_id: item.row.external_product_id,
    external_variant_id: item.row.external_variant_id,
    product_id: item.product?.id,
    product_variant_id: variant?.planned_create ? null : variant?.id,
    canonical_variant: variant?.planned_create ? variant : null,
    external_sku: item.row.external_sku,
    external_gtin: item.externalGtin,
    external_options: item.row.external_options,
    external_url:
      item.row.merchant_deep_link ||
      item.row.external_url ||
      item.row.direct_url ||
      item.row.url,
    legacy: false,
  });
}

function sha256Canonical(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function attachSharedParentIdentityContracts(items) {
  const groups = new Map();
  for (const item of items) {
    if (
      item.mapping ||
      !item.sharedParentIdentityRequired ||
      !item.retailer?.id ||
      !item.product?.id ||
      !item.productVariant?.planned_create
    ) {
      continue;
    }
    const incoming = peerFromResolvedItem(item);
    const key = `${incoming.retailer_id}|${incoming.external_url}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ item, incoming });
  }

  for (const members of groups.values()) {
    const existingById = new Map();
    for (const { item } of members) {
      for (const peer of item.sharedParentUrlPeers || []) {
        existingById.set(String(peer.id), peerFromMapping(peer));
      }
    }
    const cohort = validateSharedParentPeerCohort([
      ...existingById.values(),
      ...members.map(({ incoming }) => incoming),
    ]);
    const peerSetFingerprint = sha256Canonical(cohort);
    for (const { item, incoming } of members) {
      item.sharedParentIdentityContract = {
        version: CONTRACT_VERSION,
        incoming,
        approved_url_peers: cohort,
        peer_set_fingerprint: peerSetFingerprint,
      };
    }
  }
}

module.exports = {
  CONTRACT_VERSION,
  attachSharedParentIdentityContracts,
  canonicalVariantSignature,
  normalizeSharedParentPeer,
  peerFromMapping,
  peerFromResolvedItem,
  sha256Canonical,
  validateSharedParentPeerCohort,
};
