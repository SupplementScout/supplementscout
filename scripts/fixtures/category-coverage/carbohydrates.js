// Closed audit evidence only. Provenance:
// docs/rollouts/final-p1-category-coverage-sweep-2026-11-04.md
// Product IDs and names are fixture evidence and must never become runtime conditions.
const fixture = (
  id,
  name,
  category,
  product_format = null,
  description = ""
) => ({ id, name, category, product_format, description });

const fixtures = [
  fixture(423, "Applied Nutrition Cream Of Rice 2kg", "Health Supplements"),
  fixture(424, "NXT Nutrition Cream Of Rice 2kg", "Health Supplements"),
  fixture(450, "Trec Vitargo Electro Energy 1050g", "Health Supplements"),
  fixture(495, "GYM HIGH Cream Of Rice 2kg", "Health Supplements", "powder"),
  fixture(766, "OstroVit Carbo 1000g", "Carbohydrates", "powder"),
  fixture(838, "Strom Sports Cream of Rice 2kg", "Health Supplements", "powder"),
  fixture(858, "CNP Professional Cream of Rice 2kg", "Health Supplements", "powder"),
  fixture(861, "Trained By JP Cream Of Rice 2kg", "Health Supplements", "powder"),
  fixture(904, "Strom Sports CarbMax 1.5kg", "Health Supplements", "powder"),
  fixture(922, "CNP Professional Cyclic Dextrin 20 Servings", "Health Supplements", "powder"),
  fixture(932, "Time 4 Carbs 1.8kg", "Health Supplements", "powder"),
  fixture(949, "7Nutrition Dextrose Gold 1000g", "Health Supplements", "powder"),
  fixture(968, "GYM HIGH Cream Of Rice 2.1kg", "Health Supplements", "powder"),
  fixture(1012, "7Nutrition Carbo Gold 1000g", "Health Supplements", "powder"),
  fixture(1288, "MyProtein HYROX Electrofuel Carbohydrate & Electrolyte Powder", "Electrolytes", "powder"),
  fixture(1289, "Alpha Neon Cream of Rice 2kg", "Carbohydrates", "powder"),
  fixture(1390, "Applied Nutrition Carb X Carb Powder 125g", "Pre Workout", "powder"),
  fixture(1391, "TWP Replenish Carb/Electrolyte Powder", "Health Supplements", "powder"),
  fixture(1392, "TBJP Nutrition Cream Of Rice", "Health Supplements", "powder"),
  fixture(1406, "TWP Anytime COR+ Cream Of Rice", "Health Supplements", "powder"),
  fixture(1409, "HR Labs Carb Up Carb Powder", "Health Supplements", "powder"),
  fixture(1416, "Applied Nutrition Carb-X Carb Powder 1.2kg", "Pre Workout", "powder"),

  fixture(331, "High5 Energy Drink Powder 1kg", "Health Supplements", null, "A carbohydrate drink powder for sport."),
  fixture(332, "High5 Energy Gels 20 x 40g", "Health Supplements", null, "A carbohydrate source in gel format."),
  fixture(333, "High5 Energy Gel 40g", "Health Supplements", null, "A carbohydrate source in gel format."),
  fixture(1273, "NutriSport Protein & Complex Carbs 700g", "Protein Powder", "powder"),
  fixture(1373, "Naughty Boy Whey Protein 2kg", "Whey Protein", "powder", "A protein and carbohydrate blend."),
  fixture(1374, "Naughty Boy Whey 900g", "Whey Protein", "powder", "A protein and carbohydrate blend."),

  fixture(106, "Grenade Carb Killa Bars", "Protein Bars"),
  fixture(107, "Grenade Carb Killa Protein Shake 330ml", "Protein Bars"),
  fixture(213, "Uncle Jack's Low Carb High Protein Croissant 65g", "Protein Bars"),
  fixture(271, "Grenade Carb Killa Protein Bar 60g", "Protein Bars", "snack"),
  fixture(320, "Uncle Jack's Low Carb High Protein Croissant Box of 6", "Protein Bars"),
  fixture(322, "Grenade Carb Killa Protein Spread 360g", "Protein Bars", "spread"),
];

const expectedIds = {
  INCLUDE_STRONG: [
    423, 424, 450, 495, 766, 838, 858, 861, 904, 922, 932, 949, 968,
    1012, 1288, 1289, 1390, 1391, 1392, 1406, 1409, 1416,
  ],
  REVIEW_REQUIRED: [331, 332, 333, 1273, 1373, 1374],
  EXCLUDE_STRONG: [106, 107, 213, 271, 320, 322],
};

module.exports = { fixtures, expectedIds };
