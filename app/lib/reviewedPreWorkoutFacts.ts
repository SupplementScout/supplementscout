export type PreWorkoutInformationState =
  | "present_with_amount"
  | "present_amount_not_disclosed"
  | "confirmed_absent"
  | "no_information"
  | "conflicting_information";

export type PublicNutritionSourceKind =
  | "product_label"
  | "brand_owner_statement"
  | "retailer_source"
  | "manufacturer_source";

export type AppliedPreWorkoutFactKey =
  | "serving_size_g"
  | "caffeine"
  | "beta_alanine"
  | "citrulline"
  | "citrulline_component"
  | "creatine_component"
  | "creatine";

export type AppliedPreWorkoutFact = {
  key: AppliedPreWorkoutFactKey;
  informationState: PreWorkoutInformationState | null;
  amountPerServingMg: number | null;
  servingSizeG: number | null;
  servingBasisText: string | null;
  ingredientForm: string | null;
  ingredientRatio: string | null;
  sourceKinds: PublicNutritionSourceKind[];
};

export type AppliedPreWorkoutFacts = {
  productId: string;
  productVariantId: string;
  facts: AppliedPreWorkoutFact[];
  caffeineFreeConfirmed: boolean;
};

export type ReviewedNutritionCandidate = {
  product_id: number | string | null;
  product_variant_id: number | string | null;
  proposed_field: string;
  proposed_value: number | string | null;
  proposed_unit: string | null;
  approved_value: number | string | null;
  status: string;
  information_state: string | null;
  source_quantity_value: number | string | null;
  source_quantity_unit: string | null;
  quantity_basis: string | null;
  serving_basis_value: number | string | null;
  serving_basis_unit: string | null;
  serving_basis_text: string | null;
  ingredient_form: string | null;
  ingredient_ratio: string | null;
  warning_flags: unknown;
  source_locator: string | null;
  source_type?: string | null;
  source_url?: string | null;
  source_file_sha256?: string | null;
  source_archive_uri?: string | null;
};

const STRUCTURED_FIELDS = {
  caffeine_per_serving_mg: "caffeine",
  beta_alanine_per_serving_mg: "beta_alanine",
  citrulline_per_serving_mg: "citrulline",
  creatine_declared_form_per_serving_mg: "creatine",
} as const;

const INFORMATION_STATES = new Set<PreWorkoutInformationState>([
  "present_with_amount",
  "present_amount_not_disclosed",
  "confirmed_absent",
  "no_information",
  "conflicting_information",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finitePositive(value: unknown) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sourceKind(candidate: ReviewedNutritionCandidate): PublicNutritionSourceKind {
  const flags = Array.isArray(candidate.warning_flags)
    ? candidate.warning_flags.map(String)
    : [];
  if (
    flags.includes("BRAND_OWNER_ATTESTATION_REQUIRES_REVIEW") ||
    candidate.source_locator?.startsWith("json:brand-owner-attestation")
  ) {
    return "brand_owner_statement";
  }
  if (candidate.source_locator?.startsWith("image:")) return "product_label";
  if (["retailer_product_page", "retailer_feed"].includes(candidate.source_type || "")) {
    return "retailer_source";
  }
  return "manufacturer_source";
}

function candidateInformationState(candidate: ReviewedNutritionCandidate) {
  return INFORMATION_STATES.has(candidate.information_state as PreWorkoutInformationState)
    ? candidate.information_state as PreWorkoutInformationState
    : null;
}

function structuredFact(candidate: ReviewedNutritionCandidate) {
  const state = candidateInformationState(candidate);
  if (!state) return null;
  const fact: Record<string, unknown> = { information_state: state };
  const present = state === "present_with_amount" || state === "present_amount_not_disclosed";

  if (state === "present_with_amount") {
    const approved = finitePositive(candidate.approved_value);
    const proposed = finitePositive(candidate.proposed_value);
    const sourceQuantity = finitePositive(candidate.source_quantity_value);
    const servingValue = candidate.serving_basis_value == null
      ? null
      : finitePositive(candidate.serving_basis_value);
    if (
      approved === null || proposed === null || approved !== proposed ||
      sourceQuantity === null || !["mg", "g"].includes(candidate.source_quantity_unit || "") ||
      candidate.proposed_unit !== "mg" || candidate.quantity_basis !== "per_serving" ||
      !candidate.serving_basis_text?.trim() ||
      ((candidate.serving_basis_value == null) !== (candidate.serving_basis_unit == null)) ||
      (servingValue !== null && !["g", "ml", "count"].includes(candidate.serving_basis_unit || ""))
    ) return null;
    const normalized = candidate.source_quantity_unit === "g"
      ? sourceQuantity * 1000
      : sourceQuantity;
    if (normalized !== approved) return null;
    Object.assign(fact, {
      amount_per_serving_mg: approved,
      source_quantity_value: sourceQuantity,
      source_quantity_unit: candidate.source_quantity_unit,
      quantity_basis: "per_serving",
      serving_basis_text: candidate.serving_basis_text,
    });
    if (["creatine_declared_form_per_serving_mg", "creatine_component_per_serving_mg"].includes(candidate.proposed_field)) {
      fact.amount_subject = "declared_ingredient_form";
    }
    if (servingValue !== null) {
      fact.serving_basis_value = servingValue;
      fact.serving_basis_unit = candidate.serving_basis_unit;
    }
  } else if (
    candidate.proposed_value !== null || candidate.proposed_unit !== null ||
    candidate.approved_value !== null || candidate.source_quantity_value !== null ||
    candidate.source_quantity_unit !== null || candidate.quantity_basis !== null ||
    candidate.serving_basis_value !== null || candidate.serving_basis_unit !== null ||
    candidate.serving_basis_text !== null
  ) return null;

  if (["citrulline_per_serving_mg", "citrulline_component_per_serving_mg"].includes(candidate.proposed_field)) {
    if (candidate.proposed_field === "citrulline_component_per_serving_mg" && state !== "present_with_amount") {
      return null;
    }
    if (present) {
      if (!["l_citrulline", "citrulline_malate", "citrulline_nitrate"].includes(candidate.ingredient_form || "")) {
        return null;
      }
      if (
        candidate.ingredient_ratio !== null &&
        (
          candidate.ingredient_form !== "citrulline_malate" ||
          !/^[1-9][0-9]*(\.[0-9]+)?:[1-9][0-9]*(\.[0-9]+)?$/.test(candidate.ingredient_ratio)
        )
      ) return null;
      fact.ingredient_form = candidate.ingredient_form;
      if (candidate.ingredient_ratio !== null) fact.ingredient_ratio = candidate.ingredient_ratio;
    } else if (candidate.ingredient_form !== null || candidate.ingredient_ratio !== null) {
      return null;
    }
  } else if (["creatine_declared_form_per_serving_mg", "creatine_component_per_serving_mg"].includes(candidate.proposed_field)) {
    if (candidate.proposed_field === "creatine_component_per_serving_mg" && state !== "present_with_amount") return null;
    if (present) {
      if (!/^creatine_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(candidate.ingredient_form || "")) {
        return null;
      }
      if (candidate.ingredient_ratio !== null) return null;
      fact.ingredient_form = candidate.ingredient_form;
    } else if (candidate.ingredient_form !== null || candidate.ingredient_ratio !== null) {
      return null;
    }
  } else if (candidate.ingredient_form !== null || candidate.ingredient_ratio !== null) {
    return null;
  }

  return fact;
}

function matchingCandidates(
  candidates: ReviewedNutritionCandidate[],
  productId: string,
  productVariantId: string,
  proposedField: string
) {
  return candidates.filter((candidate) =>
    candidate.status === "approved" &&
    String(candidate.product_id) === productId &&
    String(candidate.product_variant_id) === productVariantId &&
    candidate.proposed_field === proposedField
  );
}

function uniqueSources(candidates: ReviewedNutritionCandidate[]) {
  return [...new Set(candidates.map(sourceKind))];
}

function componentSourceContext(candidate: ReviewedNutritionCandidate) {
  if (
    !candidate.source_url?.startsWith("https://") ||
    !/^[0-9a-f]{64}$/.test(candidate.source_file_sha256 || "") ||
    !candidate.source_archive_uri?.startsWith("supabase-storage://nutrition-sources/")
  ) return null;
  return canonical({
    source_url: candidate.source_url,
    source_file_sha256: candidate.source_file_sha256,
    source_archive_uri: candidate.source_archive_uri,
    serving_basis_text: candidate.serving_basis_text,
    serving_basis_value: finitePositive(candidate.serving_basis_value),
    serving_basis_unit: candidate.serving_basis_unit,
  });
}

function componentIdentity(fact: Record<string, unknown>) {
  return `${String(fact.ingredient_form || "")}|${String(fact.ingredient_ratio || "")}`;
}

export function resolveAppliedPreWorkoutFacts(
  productId: number | string,
  productVariantId: number | string,
  nutritionOverride: unknown,
  candidates: ReviewedNutritionCandidate[]
): AppliedPreWorkoutFacts {
  const exactProductId = String(productId);
  const exactVariantId = String(productVariantId);
  const override = isRecord(nutritionOverride) ? nutritionOverride : {};
  const facts: AppliedPreWorkoutFact[] = [];
  const hasSingularCitrulline = isRecord(override.citrulline);
  const hasCitrullineComponents = Array.isArray(override.citrulline_components);
  const citrullineRepresentationConflict = hasSingularCitrulline && hasCitrullineComponents;
  const hasSingularCreatine = isRecord(override.creatine);
  const hasCreatineComponents = Array.isArray(override.creatine_components);
  const creatineRepresentationConflict = hasSingularCreatine && hasCreatineComponents;

  const servingSize = finitePositive(override.serving_size_g);
  const servingCandidates = matchingCandidates(
    candidates,
    exactProductId,
    exactVariantId,
    "serving_size_g"
  ).filter((candidate) =>
    candidate.proposed_unit === "g" &&
    finitePositive(candidate.proposed_value) === servingSize &&
    finitePositive(candidate.approved_value) === servingSize
  );

  const structuredMatches = new Map<AppliedPreWorkoutFactKey, ReviewedNutritionCandidate[]>();
  for (const [candidateField, targetField] of Object.entries(STRUCTURED_FIELDS)) {
    if ((targetField === "citrulline" && citrullineRepresentationConflict) ||
        (targetField === "creatine" && creatineRepresentationConflict)) continue;
    const applied = override[targetField];
    if (!isRecord(applied)) continue;
    const matches = matchingCandidates(
      candidates,
      exactProductId,
      exactVariantId,
      candidateField
    ).filter((candidate) => {
      const expected = structuredFact(candidate);
      return expected !== null && canonical(expected) === canonical(applied);
    });
    if (matches.length > 0) structuredMatches.set(targetField, matches);
  }

  const creatineComponentMatches: Array<{ applied: Record<string, unknown>; candidate: ReviewedNutritionCandidate }> = [];
  if (!creatineRepresentationConflict && hasCreatineComponents) {
    const appliedComponents = (override.creatine_components as unknown[]).filter(isRecord);
    const candidatePool = matchingCandidates(candidates, exactProductId, exactVariantId, "creatine_component_per_serving_mg");
    const used = new Set<number>();
    for (const applied of appliedComponents) {
      const index = candidatePool.findIndex((candidate, candidateIndex) =>
        !used.has(candidateIndex) && canonical(structuredFact(candidate)) === canonical(applied));
      if (index >= 0) { used.add(index); creatineComponentMatches.push({ applied, candidate: candidatePool[index] }); }
    }
    const contexts = new Set(creatineComponentMatches.map(({ candidate }) => componentSourceContext(candidate)));
    const identities = new Set(creatineComponentMatches.map(({ applied }) => componentIdentity(applied)));
    if (appliedComponents.length < 2 || appliedComponents.length !== (override.creatine_components as unknown[]).length ||
        creatineComponentMatches.length !== appliedComponents.length || contexts.size !== 1 || contexts.has(null) ||
        identities.size !== appliedComponents.length) creatineComponentMatches.length = 0;
  }

  const componentMatches: Array<{
    applied: Record<string, unknown>;
    candidate: ReviewedNutritionCandidate;
  }> = [];
  if (!citrullineRepresentationConflict && hasCitrullineComponents) {
    const appliedComponents = (override.citrulline_components as unknown[])
      .filter(isRecord);
    const candidatePool = matchingCandidates(
      candidates,
      exactProductId,
      exactVariantId,
      "citrulline_component_per_serving_mg"
    );
    const used = new Set<number>();
    for (const applied of appliedComponents) {
      const index = candidatePool.findIndex((candidate, candidateIndex) =>
        !used.has(candidateIndex) &&
        canonical(structuredFact(candidate)) === canonical(applied)
      );
      if (index >= 0) {
        used.add(index);
        componentMatches.push({ applied, candidate: candidatePool[index] });
      }
    }
    const contexts = new Set(componentMatches.map(({ candidate }) => componentSourceContext(candidate)));
    const identities = new Set(componentMatches.map(({ applied }) => componentIdentity(applied)));
    if (
      appliedComponents.length < 2 ||
      appliedComponents.length !== (override.citrulline_components as unknown[]).length ||
      componentMatches.length !== appliedComponents.length ||
      contexts.size !== 1 || contexts.has(null) ||
      identities.size !== appliedComponents.length
    ) componentMatches.length = 0;
  }

  if (servingSize !== null && servingCandidates.length > 0) {
    const servingBasisText = [
      ...structuredMatches.values(),
      componentMatches.map(({ candidate }) => candidate),
      creatineComponentMatches.map(({ candidate }) => candidate),
    ]
      .flat()
      .find((candidate) => finitePositive(candidate.serving_basis_value) === servingSize)
      ?.serving_basis_text || null;
    facts.push({
      key: "serving_size_g",
      informationState: null,
      amountPerServingMg: null,
      servingSizeG: servingSize,
      servingBasisText,
      ingredientForm: null,
      ingredientRatio: null,
      sourceKinds: uniqueSources(servingCandidates),
    });
  }

  for (const key of ["caffeine", "beta_alanine", "citrulline", "creatine"] as const) {
    const matches = structuredMatches.get(key);
    const applied = override[key];
    if (!matches?.length || !isRecord(applied)) continue;
    const state = applied.information_state as PreWorkoutInformationState;
    facts.push({
      key,
      informationState: state,
      amountPerServingMg: finitePositive(applied.amount_per_serving_mg),
      servingSizeG: finitePositive(applied.serving_basis_value),
      servingBasisText: typeof applied.serving_basis_text === "string" ? applied.serving_basis_text : null,
      ingredientForm: typeof applied.ingredient_form === "string" ? applied.ingredient_form : null,
      ingredientRatio: typeof applied.ingredient_ratio === "string" ? applied.ingredient_ratio : null,
      sourceKinds: uniqueSources(matches),
    });
  }

  for (const { applied, candidate } of componentMatches) {
    facts.push({
      key: "citrulline_component",
      informationState: "present_with_amount",
      amountPerServingMg: finitePositive(applied.amount_per_serving_mg),
      servingSizeG: finitePositive(applied.serving_basis_value),
      servingBasisText: typeof applied.serving_basis_text === "string" ? applied.serving_basis_text : null,
      ingredientForm: typeof applied.ingredient_form === "string" ? applied.ingredient_form : null,
      ingredientRatio: typeof applied.ingredient_ratio === "string" ? applied.ingredient_ratio : null,
      sourceKinds: uniqueSources([candidate]),
    });
  }
  for (const { applied, candidate } of creatineComponentMatches) {
    facts.push({
      key: "creatine_component", informationState: "present_with_amount",
      amountPerServingMg: finitePositive(applied.amount_per_serving_mg),
      servingSizeG: finitePositive(applied.serving_basis_value),
      servingBasisText: typeof applied.serving_basis_text === "string" ? applied.serving_basis_text : null,
      ingredientForm: typeof applied.ingredient_form === "string" ? applied.ingredient_form : null,
      ingredientRatio: null, sourceKinds: uniqueSources([candidate]),
    });
  }

  return {
    productId: exactProductId,
    productVariantId: exactVariantId,
    facts,
    caffeineFreeConfirmed: facts.some(
      (fact) => fact.key === "caffeine" && fact.informationState === "confirmed_absent"
    ),
  };
}

export function nutritionSourceKindLabel(kind: PublicNutritionSourceKind) {
  if (kind === "product_label") return "Product label";
  if (kind === "brand_owner_statement") return "Brand owner statement";
  if (kind === "retailer_source") return "Retailer source";
  return "Manufacturer source";
}

export function ingredientFormLabel(form: string | null) {
  if (form === "l_citrulline") return "L-citrulline (free form)";
  if (form === "citrulline_malate") return "Citrulline malate";
  if (form === "citrulline_nitrate") return "Citrulline nitrate";
  if (form === "creatine_monohydrate") return "Creatine monohydrate";
  if (form === "creatine_form_not_disclosed") return "Form not disclosed";
  return form ? form.replaceAll("_", " ") : null;
}
