import "server-only";

import type { DuplicateMatch, DuplicateProduct } from "./duplicates";

export type DuplicateDecision = "separate" | "deferred";
export type DuplicatePreflightStatus = "blocked" | "review" | "candidate";

export type DuplicateVariantEvidence = {
  id: number | string;
  product_id: number | string;
  variant_key: string;
  display_name: string | null;
  flavour_label: string | null;
  size_value: number | string | null;
  size_unit: string | null;
  pack_count: number | string | null;
  product_format: string | null;
  is_active: boolean | null;
  is_default: boolean | null;
};

export type DuplicateMappingEvidence = {
  id: number | string;
  product_id: number | string;
  retailer_id: number | string;
  external_product_id: string | null;
  external_variant_id: string | null;
  external_sku: string | null;
  external_gtin: string | null;
  match_method: string | null;
  retailer: { name: string } | { name: string }[] | null;
};

export type ProductReviewEvidence = {
  activeVariants: DuplicateVariantEvidence[];
  mappingCount: number;
  retailerNames: string[];
  hasActiveNonDefaultVariants: boolean;
};

export type DuplicateReview = DuplicateMatch & {
  productAEvidence: ProductReviewEvidence;
  productBEvidence: ProductReviewEvidence;
  positiveSignals: string[];
  cautions: string[];
  blockers: string[];
  preflightStatus: DuplicatePreflightStatus;
};

function idValue(value: number | string) {
  return String(value);
}

function nonEmpty(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizedValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function retailerName(
  retailer: DuplicateMappingEvidence["retailer"],
  retailerId: number | string
) {
  const value = Array.isArray(retailer) ? retailer[0] : retailer;
  return value?.name || `Retailer ${retailerId}`;
}

function evidenceForProduct(
  product: DuplicateProduct,
  variants: DuplicateVariantEvidence[],
  mappings: DuplicateMappingEvidence[]
): ProductReviewEvidence {
  const productId = idValue(product.id);
  const activeVariants = variants.filter(
    (variant) =>
      idValue(variant.product_id) === productId && variant.is_active === true
  );
  const productMappings = mappings.filter(
    (mapping) => idValue(mapping.product_id) === productId
  );

  return {
    activeVariants,
    mappingCount: productMappings.length,
    retailerNames: Array.from(
      new Set(
        productMappings.map((mapping) =>
          retailerName(mapping.retailer, mapping.retailer_id)
        )
      )
    ).sort(),
    hasActiveNonDefaultVariants: activeVariants.some(
      (variant) => variant.is_default !== true
    ),
  };
}

function structuredDifference(
  productA: DuplicateProduct,
  productB: DuplicateProduct,
  key:
    | "net_weight_g"
    | "net_volume_ml"
    | "unit_count"
    | "product_format"
    | "unit_type"
) {
  const valueA = productA[key];
  const valueB = productB[key];

  if (valueA === null || valueA === undefined || valueB === null || valueB === undefined) {
    return false;
  }

  return normalizedValue(String(valueA)) !== normalizedValue(String(valueB));
}

export function buildDuplicateReviews(
  matches: DuplicateMatch[],
  variants: DuplicateVariantEvidence[],
  mappings: DuplicateMappingEvidence[],
  evidenceComplete = true
): DuplicateReview[] {
  return matches.map((match) => {
    const productAEvidence = evidenceForProduct(
      match.productA,
      variants,
      mappings
    );
    const productBEvidence = evidenceForProduct(
      match.productB,
      variants,
      mappings
    );
    const positiveSignals: string[] = [
      `Name similarity ${Math.round(match.score * 100)}%`,
      "Same normalized brand",
    ];
    const cautions: string[] = [];
    const blockers: string[] = [];
    const gtinA = nonEmpty(match.productA.gtin);
    const gtinB = nonEmpty(match.productB.gtin);

    if (!evidenceComplete) {
      blockers.push(
        "Safety evidence could not be loaded; merge remains fail-closed"
      );
    }

    if (gtinA && gtinB) {
      if (gtinA === gtinB) {
        positiveSignals.push("Exact same GTIN");
      } else {
        blockers.push("Different non-empty GTIN values");
      }
    } else {
      cautions.push("Exact GTIN evidence is incomplete");
    }

    if (structuredDifference(match.productA, match.productB, "net_weight_g")) {
      blockers.push("Different structured net weights");
    }
    if (structuredDifference(match.productA, match.productB, "net_volume_ml")) {
      blockers.push("Different structured net volumes");
    }
    if (structuredDifference(match.productA, match.productB, "unit_count")) {
      blockers.push("Different structured unit counts");
    }
    if (structuredDifference(match.productA, match.productB, "product_format")) {
      blockers.push("Different product formats");
    }
    if (structuredDifference(match.productA, match.productB, "unit_type")) {
      blockers.push("Different unit types");
    }

    if (
      productAEvidence.hasActiveNonDefaultVariants ||
      productBEvidence.hasActiveNonDefaultVariants
    ) {
      blockers.push(
        "Active non-default variants require variant-to-variant review"
      );
    }

    if (productBEvidence.mappingCount > 0) {
      blockers.push(
        "Candidate has retailer mappings; automation reconciliation is required before merge"
      );
    }

    if (
      productAEvidence.activeVariants.length === 0 ||
      productBEvidence.activeVariants.length === 0
    ) {
      cautions.push("One or both products have no active variant record");
    }

    const hasStrongIdentity =
      (gtinA !== null && gtinA === gtinB) || match.score >= 0.85;
    if (!hasStrongIdentity) {
      cautions.push("No strong identity signal; administrator review required");
    }

    const preflightStatus: DuplicatePreflightStatus =
      blockers.length > 0
        ? "blocked"
        : cautions.length > 0
          ? "review"
          : "candidate";

    return {
      ...match,
      productAEvidence,
      productBEvidence,
      positiveSignals,
      cautions,
      blockers: Array.from(new Set(blockers)),
      preflightStatus,
    };
  });
}
