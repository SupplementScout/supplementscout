// Closed audit data only. Provenance:
// docs/rollouts/category-coverage-integrity-testosterone-boosters-audit-2026-11-03.md
// Product IDs are fixture labels and must never become runtime conditions.
const fixtures = [
  { id: 183, name: "BioTech USA Tribooster 60 Tablets", category: "Vitamins", description: "A strong testosterone booster formula." },
  { id: 184, name: "7Nutrition Volcano Testosterone 150 Capsules", category: "Vitamins", description: "Natural testosterone booster." },
  { id: 217, name: "Mutant Test 90 Capsules", category: "Vitamins", description: "Testosterone capsules and support formula." },
  { id: 225, name: "Olimp T-100 Ultimate Testosterone 120 Capsules", category: "Health Supplements", description: null },
  { id: 237, name: "TWP PCT Aftermath 2.0 120 Capsules", category: "Vitamins", description: "Post-cycle testosterone recovery support." },
  { id: 285, name: "USN 19-Anabol Testo 90 Capsules", category: "Health Supplements", description: "Support for low testosterone." },
  { id: 413, name: "GYM HIGH ZMB 60 Capsules", category: "Health Supplements", description: "Zinc and magnesium with testosterone support claims." },
  { id: 420, name: "Long Jack Tongkat Ali 60 caps", category: "Health Supplements", description: "Single botanical extract." },
  { id: 429, name: "GYM HIGH Testo Pro 180 Capsules", category: "Health Supplements", description: "Natural hormone support formula." },
  { id: 431, name: "Black Mamba Fadogia Agrestis 60 Capsules", category: "Health Supplements", description: "Supports healthy testosterone levels." },
  { id: 446, name: "Extreme Labs TT4 Tribulus Terrestris 90 Caps", category: "Health Supplements", description: "Tribulus supplement." },
  { id: 459, name: "Applied Nutrition Turk-X Turkesterone Plus", category: "Health Supplements", description: "Muscle growth and body recomposition support." },
  { id: 485, name: "Applied Nutrition Tongkat Ali 600mg 60 Capsules", category: "Health Supplements", description: "Vitality support." },
  { id: 499, name: "Olimp DAA Xtreme Prolact-Block 60 Tablets", category: "Health Supplements", description: "An advanced testosterone booster." },
  { id: 514, name: "Animal Stak 21 Packs", category: "Health Supplements", description: "Complete natural hormone support." },
  { id: 596, name: "Simply Supplements Super Zinc Plus", category: "Vitamins", description: "Zinc contributes to normal testosterone synthesis." },
  { id: 982, name: "Nordic Labs Long Jack Tongkat Ali 60 Capsules", category: "Health Supplements", description: null },
  { id: 983, name: "Nordic Labs TestX Pro Turkesterone 60 Capsules", category: "Health Supplements", description: null },
  { id: 992, name: "Osavi Tribulus Terrestris Saponins 200mg 180 Capsules", category: "Health Supplements", description: null },
  { id: 1111, name: "Ultra Nutrio Mr Test 100 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1124, name: "Nordic Labs Fadogia Agrestis 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1218, name: "Refined Nutrition Tribulus 60 Capsules", category: "Health Supplements", description: null },
  { id: 1363, name: "Chaos Crew Turk 10% Turkesterone 500mg", category: "Testosterone Boosters", description: null },
  { id: 1364, name: "Swole Lifestyle Fadogia Agrestis 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1365, name: "Swole Lifestyle Tongkat Ali 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1366, name: "USN Anabolic Turk Test 1200 60 Capsules", category: "Testosterone Boosters", description: null },
  { id: 1387, name: "TWP Ashwagandha", category: "Health Supplements", description: "May provide testosterone benefits." },
  { id: 1436, name: "TWP Tongkat Ali", category: "Health Supplements", description: null },
];

const expectedIds = {
  INCLUDE_STRONG: [183, 184, 217, 225, 285, 429, 499, 514, 983, 1111, 1366],
  EXCLUDE_STRONG: [237, 413, 459, 596, 1363, 1387],
  REVIEW_REQUIRED: [420, 431, 446, 485, 982, 992, 1124, 1218, 1364, 1365, 1436],
};

module.exports = { fixtures, expectedIds };
