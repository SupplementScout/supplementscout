# Six Pack identity normalization evidence - 8 November 2026

Implementation/review evidence only. No production capture, refresh, write or merge is authorized.

## Scope and provenance

Current main: `6c99cd7fd1aa13ddcd6e557ff4fb27ddf6f4efc9`; approved manifest SHA256 `62f88fabc33e339d1106e597091217eabbbfaa4c5015b5625fb5257eacf0e7ff`: **506 mappings / 279 parents**. All 506 have an exact external-parent/variation join to retained historical names (native snapshot plus existing sealed CSV feeds). No name-based joins or mapping changes were used.

The 576-record native snapshot is dated `2026-07-27T12:00:00.000Z`, file SHA256 `ea5afeaf582a48980b6b471d0fda098481b0b30eb6812dd4be559c2fdf31a34f`. The later parent-3980 diagnosis is dated `2026-11-08T17:26:31.004Z`, raw HTML SHA256 `c1c128c4ce35c2fe7449705ddc0dcb279a962c844e01cd46524a1a9324e37aba`. Neither is a new catalogue capture in this task.

The audit found **8 safe-equivalence evidence pairs**, **4 commercial-unit conflicts**, and **105 pairs requiring further evidence**. These are evidence-pair categories, not a disjoint mapping partition: parent 3980 has a reordered historical title requiring proof and a later retained title proving the exact 1kg/1000g comparison. No contradictory physical mass was proved in the retained name pairs.

## Comparison boundary

`commercialIdentityTokens` / `liveIdentityDrift` retain one owner in the existing canary-builder module, already reused by refresh and other Six Pack builders. The existing `feed-variant-guards.parseSize` supplies exact kg/g mass normalization using `normalizeDecimalString`; it is not used as a fuzzy name matcher, full product-identity resolver, or dose/count conversion. Decimal point/comma and whitespace are accepted without binary float tolerance. Newly admitted unit-equivalent names must agree after replacing measure tokens, case and whitespace normalization. Different brand/flavour wording remains BLOCK for that new admission. Parent/variation bindings, SKU/source parser evidence, mapping IDs, approvals and guarded executor are not relaxed.

Multipacks retain count plus per-unit amount (`2x500g`), rather than collapsing into total mass. Box/pack counts remain separate. Unknown units, absent live measure evidence, name-order differences accompanying unit conversion, different masses/doses/counts and commercial-unit ambiguity cannot be waived. This intentionally does not approve historical reordered names or convert 12 single bars into one box.

## Every retained candidate group

`SAFE_UNIT_EQUIVALENCE` below means the comparison is proved from retained evidence, not that an apply is approved or source is fresh now. `COMMERCIAL_UNIT_CONFLICT` means the compared selling units differ; it does not prove the current merchant changed its product. `FURTHER_EVIDENCE_REQUIRED` remains BLOCK if that same unresolved input is presented.

| Parent | Variations | Classification | Approved name | Compared retained name |
|---|---|---|---|---|
| 3980 | 3989, 3992, 3995, 5962, 5963, 3988, 3994, 3991 | FURTHER_EVIDENCE_REQUIRED | 7Nutrition Whey Isolate 90 1kg | Whey Isolate 90 1000g 7nutrition |
| 2814 | 2814 | FURTHER_EVIDENCE_REQUIRED | BioTech USA 100% L-Glutamine 500g | 100% L-Glutamine BiotechUsa |
| 8556 | 8556 | FURTHER_EVIDENCE_REQUIRED | 5% Nutrition Rich Piana 5150 375g | 5% Rich Piana 5150 Legendary Series Pre-Workout - Blue Ice |
| 8626 | 8626 | FURTHER_EVIDENCE_REQUIRED | 5% Nutrition Rich Piana 5150 375g | 5% Rich Piana 5150 Legendary Series Pre-Workout - Wild Berry |
| 8630 | 8630 | FURTHER_EVIDENCE_REQUIRED | 5% Nutrition Rich Piana 5150 375g | 5% Rich Piana 5150 Legendary Series Pre-Workout - Tropical Rage |
| 3019 | 28846, 28849, 28855, 28858, 28861, 28864, 28870, 28873, 28876, 28879 | FURTHER_EVIDENCE_REQUIRED | Applied Nutrition ABE Ultimate Pre-Workout 315g | ABE All Black Everything Pre-Workout Applied Nutrition |
| 3582 | 28920, 28923, 28929, 28932, 28935, 28938, 28941, 35036, 35039, 35042, 35045, 35048, 35051 | FURTHER_EVIDENCE_REQUIRED | 7Nutrition Whey Protein 80 2kg | WHEY PROTEIN 80 2000g 7nutrition |
| 3835 | 3836, 3842, 3843, 3844, 3845, 3846, 3847, 3848, 3849 | FURTHER_EVIDENCE_REQUIRED | BioTech USA 100% Pure Whey 2.27kg | 100% PURE WHEY 2270g BioTechUSA |
| 2767 | 28798, 28801, 28804, 28807, 28810, 28813, 28816, 28819, 28822 | FURTHER_EVIDENCE_REQUIRED | 7Nutrition Whey Isolate 90 2kg | Whey Isolate 90 2000g 7Nutrition |
| 2850 | 28890, 28891, 28893, 28896, 28897 | FURTHER_EVIDENCE_REQUIRED | BioTech USA Iso Whey Zero 2.27kg | BioTechUSA ISO WHEY ZERO 2270g |
| 3851 | 28690, 28693, 28714, 28735 | FURTHER_EVIDENCE_REQUIRED | BioTech USA 100% Pure Whey 1kg | 100% PURE WHEY 1000g BioTechUSA |
| 8363 | 8363 | FURTHER_EVIDENCE_REQUIRED | CNP Loaded EAA 300g | Cnp Loaded EAA Pink Pigs 300 |
| 5086 | 5086 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Red velvet high protein bar - battle bites |
| 5088 | 5088 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | White chocolate toasted marshmallow high protein bar - battle bites |
| 5090 | 5090 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Carrot cake high protein bar - battle bites |
| 5091 | 5091 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Chocolate caramel high protein bar - battle bites |
| 5092 | 5092 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Cookies & cream high protein bar - battle bites |
| 8189 | 8189 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Sticky toffee pudding high protein bar - battle bites |
| 8191 | 8191 | FURTHER_EVIDENCE_REQUIRED | Battle Snacks Battle Bites Protein Bar 62g | Mississippi mud pie high protein bar - battle bites |
| 2769 | 3290, 3291, 3292, 3293, 3294, 3295, 3297 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Warrior high protein crunch - protein bars |
| 5193 | 5193 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Key lime pie low sugar high protein bar Warrior |
| 5195 | 5195 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Dark chocolate peanut low sugar  high protein bar Warrior |
| 5197 | 5197 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Salted caramel low sugar high protein bar Warrior |
| 8278 | 8278 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Banoffee pie low sugar high protein bar Warrior |
| 8280 | 8280 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | White chocolate crisp low sugar high protein bar Warrior |
| 8282 | 8282 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Chocolate chip cookie dough low sugar high protein bar Warrior |
| 8285 | 8285 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Milk chocolate coconut low sugar high protein bar Warrior |
| 8287 | 8287 | FURTHER_EVIDENCE_REQUIRED | Warrior Crunch Protein Bar 64g | Raspberry lemon cheescake low sugar high protein bar Warrior |
| 5226 | 5226 | FURTHER_EVIDENCE_REQUIRED | USN Trust Crunch Protein Bar 60g | Cherry chocolate trust crunch protein bar |
| 5228 | 5228 | FURTHER_EVIDENCE_REQUIRED | USN Trust Crunch Protein Bar 60g | White chocolate trust crunch proten bar |
| 5230 | 5230 | FURTHER_EVIDENCE_REQUIRED | USN Trust Crunch Protein Bar 60g | Salted caramel trust crunch proten bar |
| 8373 | 8373 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar chocolate brownie |
| 8375 | 8375 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar salted caramel |
| 8377 | 8377 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar chocolate peanut butter |
| 8379 | 8379 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar red velvet cake |
| 8381 | 8381 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar white chocolate cranberry |
| 8383 | 8383 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar honey berry |
| 8385 | 8385 | FURTHER_EVIDENCE_REQUIRED | Warrior RAW Protein Flapjack 75g | Warrior RAW Protein Flapjack bar rainbow cupcake |
| 30999 | 31005, 31008 | FURTHER_EVIDENCE_REQUIRED | BioTechUSA Peanut Butter 1kg | Peanut Butter 1000g - BioTechUSA |
| 4588 | 4590, 4589 | FURTHER_EVIDENCE_REQUIRED | BioTech USA Protein Pancake 1kg | BioTechUSA Protein Pancake 1000 grams |
| 32547 | 32571 | FURTHER_EVIDENCE_REQUIRED | Per4m Isolate Zero 900g | Isolate Zero 100% Whey Protein Isolate Powder - Per4m |
| 69760 | 69811, 69814, 69817 | FURTHER_EVIDENCE_REQUIRED | Creatine Gummies 400g 80 Gummies  Applied Nutrition | Applied Nutrition Creatine Monohydrate Gummies |
| 7565 | 7567 | FURTHER_EVIDENCE_REQUIRED | Trec Sleep-er 225g | Trec Nutrition SLEEPer night regeneration formula |
| 8628 | 8628 | FURTHER_EVIDENCE_REQUIRED | 5% Nutrition Rich Piana 5150 375g | 5% Rich Piana 5150 Legendary Series Pre-Workout - Green Apple |
| 3980 | 3989, 3992, 3995, 5962, 5963, 3988, 3994, 3991 | SAFE_UNIT_EQUIVALENCE | 7Nutrition Whey Isolate 90 1kg | 7Nutrition Whey Isolate 90 1000g |
| 4566 | 4568, 4570, 4572, 4580 | COMMERCIAL_UNIT_CONFLICT | CNP Protein Flapjack Box of 12 x 75g | Cnp protein flapjack 75g |

The 50 historical kg/g-equivalent pairs across parents 3980, 3582, 3835, 2767, 2850, 3851 and 30999 have equivalent mass but reordered/otherwise different names. They are included in the 105 further-evidence pairs, not automatically admitted by this change. Parent 4588 uses historical `grams` wording; no unsupported interpretation is silently added. The other unresolved groups lack explicit comparable size in retained titles.

## Error and safety boundary

Only explicit post-capture checks create typed `WooCommerceSourceError` instances. Forged textual `Error.code`, unknown exceptions, transport errors, timeout, HTTP 429/5xx and write uncertainty are not promoted. The existing CLI and Bash exit-2 contract stop known deterministic post-capture failures. No retry framework or executor change is introduced.

Before throwing a deterministic normalization BLOCK, every approved binding is checked against the same in-memory capture. Existing `--report` retains all proven conflicts, exact codes/IDs, manifest SHA, capture time, parsed page/variant counts, existing HTML hashes/byte lengths and qualified source-isolation evidence. Partial evidence is explicitly not a complete source snapshot. Classifier and sealed apply artifact creation remain unreachable on this BLOCK. Unknown normalization failures retain bounded context and remain untrusted; an unknown-only failure is retryable. An independent proved conflict still stops refetch when another row has an unknown exception, without hiding later conflicts or reclassifying the unknown exception. No arbitrary exception message is published. Full raw HTML retention remains a separate retailer-snapshot decision.

All tests use offline fixtures and the existing isolated PostgreSQL workflow. Warrior seven and Angel three review offers retain null commercial proposals; the 506 = 496 + 10 scenario, artifact/executor scope, postflight and idempotency remain mandatory. No schedule or production workflow is run by this task.
