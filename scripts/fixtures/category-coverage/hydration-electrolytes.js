// Closed semantic regression evidence only. Provenance:
// docs/rollouts/hydration-electrolytes-category-coverage-audit-2026-11-04.md
// Names are fixture evidence and must never become runtime conditions.
const fixture = (
  id,
  name,
  category,
  product_format,
  hydration,
  electrolytes,
  description = ""
) => ({
  product: { id, name, category, product_format, description },
  expected: { hydration, electrolytes },
});

module.exports = [
  fixture(1, "Example Hydration Powder", "Health Supplements", "powder", "INCLUDE_STRONG", "REVIEW_REQUIRED"),
  fixture(2, "Example Electrolytes Powder", "Health Supplements", "powder", "INCLUDE_STRONG", "INCLUDE_STRONG"),
  fixture(3, "Example Isotonic Sports Powder", "Carbohydrates", "powder", "INCLUDE_STRONG", "INCLUDE_STRONG"),
  fixture(4, "BCAA Amino Hydrate", "Amino Acids", "powder", "INCLUDE_STRONG", "REVIEW_REQUIRED"),
  fixture(5, "Creatine + Hydration", "Creatine", "powder", "INCLUDE_STRONG", "REVIEW_REQUIRED"),
  fixture(6, "Whey + Hydration", "Whey Protein", "powder", "INCLUDE_STRONG", "REVIEW_REQUIRED"),
  fixture(7, "Carbohydrate + Electrolytes", "Carbohydrates", "powder", "INCLUDE_STRONG", "INCLUDE_STRONG"),
  fixture(8, "Energy Drink + Electrolytes", "Energy Drinks", "liquid", "INCLUDE_STRONG", "INCLUDE_STRONG"),
  fixture(9, "Reviewed Hydration Formula", "Hydration", "powder", "INCLUDE_STRONG", "REVIEW_REQUIRED"),
  fixture(10, "Reviewed Mineral Formula", "Electrolytes", "powder", "INCLUDE_STRONG", "INCLUDE_STRONG"),
  fixture(11, "Sparkling Vitamin Water", "Hydration", "liquid", "REVIEW_REQUIRED", "EXCLUDE_STRONG"),
  fixture(12, "Energy Gel Electrolyte", "Electrolytes", "sachet", "REVIEW_REQUIRED", "REVIEW_REQUIRED"),
  fixture(13, "Generic Fuel Drink", "Health Supplements", null, "REVIEW_REQUIRED", "EXCLUDE_STRONG", "A drink developed for hydration during sport."),
  fixture(14, "Amino Bundle 2-Pack", "Amino Acids", null, "REVIEW_REQUIRED", "EXCLUDE_STRONG", "A hydration supplement and amino formula."),
  fixture(15, "Generic Fuel", "Health Supplements", null, "REVIEW_REQUIRED", "EXCLUDE_STRONG", "An all-in-one sports drink."),
  fixture(16, "Alkaline Water", "Hydration", "liquid", "EXCLUDE_STRONG", "EXCLUDE_STRONG"),
  fixture(17, "Magnesium Citrate", "Vitamins", "capsule", "EXCLUDE_STRONG", "EXCLUDE_STRONG"),
  fixture(18, "Potassium Tablets", "Vitamins", "tablet", "EXCLUDE_STRONG", "EXCLUDE_STRONG"),
  fixture(19, "Daily Mineral Complex", "Vitamins", "capsule", "EXCLUDE_STRONG", "EXCLUDE_STRONG"),
  fixture(20, "Daily Vitamin Formula", "Vitamins", "capsule", "EXCLUDE_STRONG", "EXCLUDE_STRONG", "Supports normal hydration."),
  fixture(21, "Pre Workout Formula", "Pre Workout", "powder", "EXCLUDE_STRONG", "EXCLUDE_STRONG", "Contains sodium, magnesium and potassium electrolytes."),
];
