# RA-001 — pakiet decyzji o architekturze automatyzacji retailerów

**Status:** `READY_FOR_VERIFICATION`

**Baseline analizy:** `941ae30654e1135b192729fb4666106cfa461cac`

**Charakter dokumentu:** propozycja do decyzji właściciela; bez uprawnienia do
implementacji, migracji danych, uruchomienia workflow ani zapisu produkcyjnego.

## 1. Podsumowanie prostym językiem

Nie potrzebujemy nowego systemu. Najbezpieczniej rozwinąć używany produkcyjnie
`retailer-offer-sync` w jeden wspólny pipeline, przenieść do niego lepsze
kontrakty snapshot/replay i grup zależności z `retailer-snapshot`, a jako jedyny
prymityw zapisu zachować istniejący atomic importer oraz mixed-batch executor.
Connector ma tylko pobrać i opisać źródło. Wspólny rdzeń ma normalizować,
porównywać, klasyfikować, izolować rekordy i przygotowywać zamknięte plany.
Zapis może nastąpić wyłącznie po jawnej, wcześniej zatwierdzonej polityce albo
manualnym zatwierdzeniu konkretnego manifestu.

Rekomendowany pierwszy pilot to 10 Reps wyłącznie w shadow mode. Aktualny dowód
935 wykonanych i 15 odizolowanych rekordów pokazuje dużą, bezpośrednią próbkę
CSV oraz działającą izolację; jednocześnie właśnie skala i backlog review
wykluczają natychmiastowe przełączenie produkcji.

## 2. Indeks dowodów

Poniższe identyfikatory wskazują konkretne istniejące mechanizmy. Numery wymiarów
w profilach odpowiadają wymaganej liście 1–20.

| ID | Dowód |
|---|---|
| E01 | `scripts/lib/retailer-offer-sync/classifier.js`: `classifyExistingOffers`, `buildGuardEvidence`; `scripts/retailer-offer-sync.test.js`, `scripts/retailer-offer-sync-matrix.test.js`. |
| E02 | `scripts/lib/retailer-offer-sync/existing-offer-plan.js`: `buildExistingOfferUpdatePlan`, `normalizeState`; `scripts/retailer-offer-sync.js`: `buildDryRun`, `buildExecutionArtifact`, `executeApprovedBatch`. |
| E03 | `scripts/lib/retailer-offer-sync/action-contract.js`: `actionForChanges`, `deltasForChanges`, `sumDeltas`; `scripts/lib/retailer-offer-sync/state-machine.js`. |
| E04 | `supabase/migrations/20260718160000_add_retailer_offer_mixed_batch_executor.sql`: `execute_retailer_offer_sync_batch`; commit `69f63f7`. |
| E05 | `scripts/lib/retailer-snapshot/source-snapshot.js`: `inspectSourceSnapshot`; `canonical-snapshot.js`: `buildCanonicalCatalogueSnapshot`; `classifier.js`: `classifyRecord`, `buildClassificationArtifact`. |
| E06 | `scripts/lib/retailer-snapshot/{row-plan-builder,parent-plan-builder,child-plan-builder,partitioner,review-queue}.js`; `planning.test.js`, `review-queue.test.js`. |
| E07 | `scripts/lib/retailer-snapshot/contracts/{schemas.json,reason-codes.json,staging-execution.schema.json,staging-recovery.schema.json}`; `schemas.test.js`, `reason-codes.test.js`, `fingerprints.test.js`. |
| E08 | `scripts/lib/retailer-snapshot/staging-execution-contract.js`: `validatePackage`, `validateRequest`, `validateRecoveryRequest`; frozen Jon's fixture and phase 1–3/staging executor tests. |
| E09 | `scripts/import-products.js`: `buildDryRunArtifact`, `loadDryRunArtifact`, `selectArtifactPlan`, `planFingerprint`, `approvalFingerprint`; `scripts/atomic-product-import-integration.test.js`. |
| E10 | `supabase/migrations/20260713180000_atomic_product_import_rpc.sql`: `approve_product_import_plan`, `apply_approved_product_import_plan`; commit `c5040b9`. |
| E11 | `scripts/fit-house-offer-refresh.js`: `readSourceSnapshot`, `sourceHealth`, `reconcileMissingMappedVariants`, `balancedExecutionBatches`; shared profiles under `config/retailers/`; commit `d8b7ad4`. |
| E12 | `scripts/retailer-offer-refresh-postflight.js`: `capture`, `verifyPostflight`; commit `209bae5`; shared retailer refresh tests. |
| E13 | `scripts/automation-reliability-watchdog.js`: `correlateEvidence`, `evaluateRetailer`, `applyMonitoredBacklog`, `summarizeWatchdogResult`; commit `f8206f2`. |
| E14 | `supabase/migrations/20260717120000_create_retailer_catalogue_control_ledger.sql`; production enablement and registration migrations; commit `94d1bf5`. |
| E15 | `scripts/automation-review-queue-worker.js`: `checkpoint`, `run`; `.github/workflows/automation-review-queue-worker.yml`; `scripts/publish-automation-review-queue.js`; commit `b55d4aa`. |
| E16 | `scripts/ebay-offer-refresh.js`, `ebay-artifact-bound-verifier.js`, `automation-review-ebay-worker.js`, `.github/workflows/ebay-offer-refresh.yml`, `ebay-browse-pilot.test.js`; commit `9856a55`. |
| E17 | `scripts/six-pack-offer-refresh.js`, `six-pack-offer-refresh-executor.js`, `six-pack-reviewed-postflight.js`, `.github/workflows/six-pack-offer-refresh.yml`, `six-pack-offer-refresh.test.js`; commit `51acfdb`. |
| E18 | `scripts/whey-okay-offer-refresh.js`, `whey-okay-workflow-router.js`, `.github/workflows/whey-okay-offer-refresh.yml`, `whey-okay-offer-refresh.test.js`; commit `942ac64`. |
| E19 | `scripts/gym-high-full-catalogue-executor.js`, `gym-high-full-catalogue-feed-builder.js`, `gym-high-source-monitor.js`, dwa workflowy GYM HIGH i ich testy; commit `6e9bd36`. |
| E20 | `scripts/jons-offer-refresh.js`, `jons-reviewed-stock-change-builder.js`, `.github/workflows/jons-offer-refresh.yml`, `jons-offer-refresh.test.js`, przerwanie/recovery i snapshot fixtures; commit `3f57a5b`. |
| E21 | `scripts/import-products.js` i reviewed manifests/builders dla 10 Reps, 6 Pack, eBay, Predators Gear, GYM HIGH; `scripts/10reps-bootstrap-reviewed-artifacts.test.js`. |
| E22 | `docs/retailer-automation/evidence/README.md`: runy 23 września — 10 Reps 935/15, Jon's 502/4, Simply 119/1, eBay 159/78, Discount 109/0, KIOR 11/0, Whey zero writes. |
| E23 | `docs/retailer-automation/AUDIT.md`, sekcje 3–9: inventory, validator/executor, flow map, leakage, incidents i luki testowe. |
| E24 | `scripts/lib/retailer-offer-sync/production-role-session.js`, commit `72ceb25`; oddzielne role, target attestation i serializacja połączeń. |

## 3. Porównanie 14 istniejących ścieżek w 20 wymiarach

Legenda: **Z** — zachować, **K** — skonsolidować/przenieść do wspólnego rdzenia,
**W** — wycofać po udowodnionej migracji. Ocena nie daje uprawnienia do zmiany.

### 3.1 `retailer-offer-sync`

1. Źródła: niezależny od platformy po projekcji adaptera [E01–E02]. 2. Normalizacja:
oczekuje już znormalizowanych wariantów; brak pełnego raw contract [E01]. 3. Identity:
dokładny external variant/mapping, konflikt blokuje [E01–E02]. 4. Diff: cena,
stock, URL i freshness [E01–E03]. 5. Cena/stock: jawne akcje i aggregate guards
[E01,E03]. 6. Izolacja: `quarantineUnsafeRows`, lecz aggregate block zatrzymuje
retailera [E01]. 7. Approval: sealed artifact + osobne approval ID [E02]. 8. Atomic:
mixed-batch RPC [E04]. 9. Price history: tylko przy zmianie ceny w planie atomowym
[E02,E04]. 10. Idempotency: fingerprints i fresh no-op, domykane postflightem
[E02,E12]. 11. Stale state: expected state w atomic planie [E02,E04]. 12.
Fingerprint: source/adapter/policy/code/state/action/plan [E02]. 13. Replay: sealed
artifacts, ale słabszy raw snapshot harness [E02]. 14. Postflight: wspólny [E12]. 15.
Monitoring: watchdog [E13]. 16. Testy: unit, matrix, integration/recovery [E01,E04].
17. Wyjątki: core jest ogólny, przeciekają wrappery [E11,E23]. 18. Rozszerzalność:
wysoka dla istniejących ofert, średnia dla onboardingu [E02]. 19. Migracja: najniższy
koszt, bo jest produkcyjny [E22,E23]. 20. Los: **Z/K** — kręgosłup docelowy;
uzupełnić o kontrakty snapshot, nie usuwać.

### 3.2 `retailer-snapshot`

1. Źródła i 2. normalizacja: wersjonowany raw oraz canonical snapshot [E05,E07].
3. Identity: exact/candidate/review reason codes [E05,E07]. 4. Diff i 5. cena/stock:
klasyfikacje oraz row plans obejmują szerszy onboarding, lecz nie wszystkie live
policies [E05–E06]. 6. Izolacja: dependency/rollback groups i partitioner [E06].
7. Approval: parent/child/manual levels [E05–E08]. 8. Atomic: staging contract wiąże
plany, produkcyjnie nie jest wspólnym executorem [E08,E23]. 9. Price history:
modelowane w planach, finalnie zależne od atomic apply [E06,E10]. 10. Idempotency,
11. stale state, 12. fingerprint i 13. replay: najmocniejsza część — canonical
fingerprints, frozen fixtures, exact contracts [E05–E08]. 14. Postflight i 15.
monitoring: kontrakty istnieją, ale brak wspólnej adopcji produkcyjnej [E08,E23].
16. Testy: rozbudowane unit/schema/planning/staging [E05–E08]. 17. Wyjątki: Jon's
fixture i stałe stagingowe; nie jest pełnym registry retailera [E08]. 18.
Rozszerzalność: wysoka kontraktowo. 19. Migracja: średnio-wysoka przy przejęciu
runtime, niska przy przeniesieniu kontraktów. 20. Los: **K**, potem **W** dla
równoległych phase/staging entry points po parity.

### 3.3 Atomic importer

1–2. Przyjmuje manual/feed CSV i normalizuje szeroki katalog [E09,E21]. 3. Identity:
silne guardy wariantu, ale wiele reviewed wyjątków w jednym pliku [E09,E21]. 4–5.
Buduje product/variant/mapping/offer diff z ceną i stockiem [E09]. 6. Izolacja:
plan per row, zakres batcha zależy od caller [E09]. 7. Approval: osobne register/
approve z fingerprintem [E09–E10]. 8. Atomic: dojrzałe RPC [E10]. 9. Price history:
w tej samej transakcji [E10]. 10–13. Idempotency, stale state, fingerprints i replay:
sealed artifact, source/plan/approval fingerprints, exact plan selection [E09–E10].
14–15. Postflight/monitoring: zależne od dedykowanego wrappera [E19,E23]. 16.
Testy: integracyjne RPC oraz wiele migration tests [E09–E10]. 17. Wyjątki:
znaczący leakage Simply/Whey/eBay/Predators/10 Reps [E21,E23]. 18. Rozszerzalność:
wysoka jako prymityw, niska jako monolityczny orchestrator. 19. Migracja: wysoki
koszt zastąpienia, niski koszt zachowania. 20. Los: **Z** jako jedyny prymityw
business-write; **K/W** retailer branches do typed policies/exception registry.

### 3.4 Wspólny silnik Fit House

1. Shopify, CSV, WooCommerce pages i exact product page [E11]. 2. Normalizacja:
shared readers plus profile shipping [E11]. 3–5. Exact manifests, shared classifier,
cena/stock/URL [E01,E11]. 6. Izolacja: unsafe rows i balanced child batches [E11].
7–13. Rejestracja, approvals, mixed executor, expected state i wielowarstwowe
fingerprints [E04,E11,E14]. 14–15. Shared postflight/watchdog [E12–E13]. 16.
Testy retailerów i rejestracji [E11,E23]. 17. Wyjątki: Fit House stable-OOS,
offer 697 i exact absence są zakodowane w silniku [E11,E23]. 18. Rozszerzalność:
dowiedziona na 10 Reps, Discount, Dolphin, Simply, KIOR, Predators; ograniczona
przez leakage [E22,E23]. 19. Migracja: niski koszt funkcjonalny, średni koszt
wydzielenia policies. 20. Los: **K** do docelowego core; po parity **W** dla nazwy/
entry pointu Fit House i retailer branches.

### 3.5 Dedykowana ścieżka eBay

1. Browse API/OAuth [E16]. 2. Normalizacja custom scope [E16]. 3. Identity: 237
zamrożonych scopes, seller/continuity rules. 4–5. Custom diff ceny/stock i dry-run
[E16,E23]. 6. Izolacja: 159/78 potwierdza partition [E22]. 7. Approval: artifact-
bound manual i Review Queue [E15–E16]. 8–9. Guarded atomic plans i price history
[E09,E16]. 10–13. Independent no-op, stale/source drift, liczne hashes i replay
guards [E13,E16]. 14. Dedykowany sealer plus shared postflight. 15. Watchdog ma
specjalną korelację split-run [E13]. 16. Rozbudowane browse/reconciliation/admin
tests [E16]. 17. Najwięcej wyjątków i historycznych batchy H–S [E16,E23]. 18.
Rozszerzalność: niska poza eBay. 19. Migracja: bardzo wysoka, API i drift. 20.
Los: **Z** connector/OAuth/policies; **K** klasyfikację/queue/execution evidence;
**W** batch workflows i custom orchestrator dopiero po długim parity.

### 3.6 Dedykowana ścieżka 6 Pack

1. WooCommerce [E17]. 2. Dedykowana projekcja i reviewed family builders. 3.
Identity: liczne rodzinne manifesty. 4–5. Offer refresh z ceną/stockiem. 6.
Izolacja: aktualny wynik 495/11 w audycie [E17,E23]. 7. Własne approval builders.
8–9. Dedicated executor korzystający z guarded planów i historii. 10–13. Sealed
rollouty, fingerprints i canary/replay tests [E17]. 14. Dedicated reviewed
postflight. 15. Workflow + watchdog. 16. Szeroki zestaw family/canary tests [E17].
17. Wiele rodzinnych wyjątków w skryptach/config. 18. Rozszerzalność: średnia dla
WooCommerce, niska jako shared core. 19. Migracja: wysoka. 20. Los: **Z** connector
i reviewed identity evidence; **K** do core; **W** dedicated executor/postflight/
builders po przeniesieniu manifestów do registry.

### 3.7 Dedykowana ścieżka Whey Okay

1. EKM Google feed [E18]. 2. Dedykowany parser/projection. 3. Exact manifest;
obecnie missing mapped-source fingerprint blokuje run [E18,E22]. 4–5. Shared
classifier/plans, cena/stock. 6. Izolacja istnieje po klasyfikacji, lecz błąd
fingerprintu przed partition blokuje retailera [E18,E23]. 7–13. Shared validator,
registration, approval, mixed executor, expected state i fingerprints [E04,E18].
14–15. Shared postflight/watchdog. 16. Refresh, registration, remediation tests
[E18]. 17. Offer 73 exclusion, product formats i rebindy. 18. Rozszerzalność:
średnia. 19. Migracja: średnia po ustaleniu root cause; teraz zablokowana. 20.
Los: **Z** EKM connector; **K** resztę; **W** wrapper/router po parity.

### 3.8 Dedykowana ścieżka GYM HIGH

1. WooCommerce catalogue [E19]. 2. Feed builder do canonical CSV. 3. Reviewed
identity/legacy/no-SKU/null-option rules. 4–5. Pełny catalogue plan obejmuje
produkty, warianty, oferty, cenę i stock [E09,E19]. 6. Izolacja przez artifact
rows, ale dowód wspólnego core jest niepełny [E23]. 7–13. Importer approval,
atomic RPC, exact artifact/fingerprints [E09–E10,E19]. 14. Dedicated recognized
DB postcondition, nie wspólny contract. 15. Dwa workflowy; watchdog `INCOMPLETE_CORE`
[E19,E23]. 16. Builder/executor/audit tests [E19]. 17. Liczne legacy migrations.
18. Rozszerzalność: pełny onboarding, lecz retailer-specific. 19. Migracja: wysoka
i owner-deferred. 20. Los: **Z** connector/reviewed evidence; **K** catalogue mode;
**W** dedicated executor tylko po osobnej decyzji właściciela.

### 3.9 Jon's Supplements

1. Shopify JSON plus CSV enrichment [E20]. 2. Dedykowana projekcja. 3. Exact
manifest i reviewed missing variants. 4–5. Shared classifier/plans z reviewed
stock/price. 6. 502/4 potwierdza izolację [E22]. 7–13. Registration/child approvals,
mixed executor, expected state, fingerprints i interrupted recovery [E20]. 14–15.
Shared postflight/watchdog [E12–E13]. 16. Refresh, sequential renewal, metadata,
cleanup tests plus snapshot fixtures [E08,E20]. 17. Stock-only, price i variant
exceptions. 18. Rozszerzalność: dobry most do snapshot harness. 19. Migracja:
średnia. 20. Los: **K** produkcyjny wrapper i snapshot harness do jednego core;
**W** podwójne entry points po parity.

### 3.10 Catalogue onboarding

1. CSV/reviewed packages wielu retailerów [E09,E21]. 2. Rozbudowana normalizacja
w importerze. 3. Strong reviewed identity, ale wyjątki są splątane. 4–5. Tworzy
pełny catalogue/offer diff. 6. Plan per row i reviewed batches. 7–13. Fingerprinted
manual approval, atomic RPC, history, stale/replay guards [E09–E10]. 14–15.
Postflight/monitoring różnią się per wrapper [E19,E23]. 16. Wiele artifact/migration
tests [E21]. 17. Największy obszar hard-coded wyjątków. 18. Rozszerzalność:
funkcjonalnie wysoka, operacyjnie kosztowna. 19. Migracja: wysoka, etapowa. 20.
Los: **Z** modele pełnego katalogu i atomic primitive; **K** do trybu tego samego
pipeline; **W** retailer branches/builders po registry i fixtures.

### 3.11 Validator, approver i executor

1–5. Są źródłowo neutralne po otrzymaniu planu [E02,E04,E09–E10,E14]. 6.
Izolacja child/dependency scope. 7. Approval jest oddzielony od wykonania. 8–9.
Atomic apply wraz z price history. 10–13. Idempotency, expected-state, migration/
artifact fingerprint i replay protection. 14–15. Receipts trafiają do postflight/
watchdog [E12–E13]. 16. Integration/recovery tests [E04,E09–E10]. 17. Retailer
registration RPCs są powielone. 18. Rozszerzalność: wysoka po jednym contract.
19. Migracja: niski koszt zachowania, średni konsolidacji registration. 20. Los:
**Z** role i prymitywy; **K** contracts/registration; nie budować alternatywy.

### 3.12 Review Queue

1–5. Przyjmuje znormalizowany problem i proponowaną zmianę, nie pobiera źródła
[E15]. 6. Izoluje rekord przez stable identity. 7. Decyzja review jest osobna od
execution request. 8–9. Worker deleguje do guarded executor; nie zapisuje ofert
sam [E15–E16]. 10–13. Fingerprint/idempotency/status checkpoints [E15]. 14–15.
Queue reconciliation i workflow monitoring. 16. Publication/worker/reconciliation
tests [E15]. 17. Worker wykonawczy jest dziś głównie eBay. 18. Rozszerzalność:
wysoka po generycznym contract. 19. Migracja: średnia. 20. Los: **Z/K** jako jedna
kolejka; usunąć eBay-only branching po wspólnym executorze.

### 3.13 Control ledger

1–6. Nie interpretuje źródła; przechowuje lifecycle planów i child scopes [E14].
7. Stanowi trwałą granicę register/approve/consume/supersede. 8–9. Wiąże atomic
execution i oczekiwane delty. 10–13. Idempotency, active-plan exclusion,
fingerprints, expiry i replay control [E04,E14]. 14–15. Dostarcza dowody dla
postflight/watchdog. 16. Registration/enablement/integration tests [E14,E23]. 17.
Powielone retailer-specific registration migrations. 18. Rozszerzalność wysoka,
gdy registration stanie się data-driven. 19. Migracja niska przy zachowaniu.
20. Los: **Z** ledger semantics; **K** schema/status i registration; nie usuwać.

### 3.14 Postflight i watchdog

1–5. Czytają DB/artifacts, nie normalizują źródła ani nie proponują zmian
[E12–E13]. 6. Weryfikują executable vs review scopes. 7–9. Sprawdzają consumed
execution i price-history deltas. 10–13. Fresh no-op, hashes, same-run correlation
i artifact digests [E12–E13]. 14. Shared postflight jest dojrzały. 15. Watchdog
rozróżnia core failure i monitored backlog, lecz statusy są nadal niespójne.
16. Postflight/watchdog tests oraz retailer refresh tests. 17. Specjalna korelacja
eBay, brak pełnego GYM/Predators [E13,E23]. 18. Rozszerzalność średnia przez
profile. 19. Migracja niska przy ujednoliceniu evidence bundle. 20. Los: **Z/K**;
wycofać dedicated sealers i statyczne backlog baselines po parity.

## 4. Warianty architektury

### Wariant A — rekomendowany: konwergencja na produkcyjnym kręgosłupie

- Rdzeń: `retailer-offer-sync` + obecny control ledger/mixed executor/atomic RPC.
- Z innych ścieżek: raw/canonical snapshots, reason registry, dependency groups,
  schemas, frozen fixtures i replay z `retailer-snapshot`; pełny catalogue plan z
  atomic importera; wspólna Review Queue, postflight i watchdog.
- Później wycofane: phase-specific snapshot entry points, Fit-House-named shared
  entry point, dedykowane executory/sealery/batch workflows po parity.
- Zalety: produkcyjnie sprawdzona droga zapisu, brak big-bang rewrite, jeden
  pipeline i przyrostowa migracja.
- Ryzyka: przenoszenie bogatszych kontraktów bez zmiany semantyki; trzeba wykryć
  każde zachowanie ukryte we wrapperach.
- Koszt: średni; najwyższy dla eBay, 6 Pack i GYM HIGH.
- Wpływ: obecne ścieżki pozostają podczas shadow; bezpieczeństwo rośnie przez
  replay i jednolity status; nowy retailer dodaje connector/config/fixtures.

### Wariant B — `retailer-snapshot` przejmuje runtime

- Rdzeń: snapshot phases i ich parent/child planner; reuse atomic RPC/executor.
- Wycofane: `retailer-offer-sync` classifier/orchestration i wrappers.
- Zalety: najczystszy model kontraktów od początku.
- Ryzyka/koszt: wysoki; snapshot harness nie ma udowodnionej wspólnej adopcji
  produkcyjnej, więc migracja zmieniałaby jednocześnie contract i orchestration.
- Wpływ: długa podwójna obsługa, większe ryzyko regresji; docelowe onboarding
  jest eleganckie, ale ścieżka dojścia słabsza.

### Wariant C — cienka fasada nad obecnymi ścieżkami

- Rdzeń: wspólny scheduler/status facade; executory pozostają oddzielne.
- Zalety: niski koszt początkowy i mały wpływ na retailerów.
- Ryzyka: utrwala wiele approval/write paths, wyjątki i różne dowody; tworzy
  faktycznie trzecią warstwę bez konsolidacji.
- Koszt długoterminowy: wysoki; bezpieczeństwo i onboarding pozostają nierówne.

**Rekomendacja: Wariant A.** To jedyny wariant jednocześnie zachowujący dojrzałe
mechanizmy produkcyjne, dający jeden pipeline i pozwalający na shadow migration.

## 5. Jeden docelowy pipeline

| Etap | Odpowiedzialność i kontrakt I/O | Retailer-specific | Błędy / zapis DB | Test i reuse |
|---|---|---|---|---|
| Source | Zewnętrzna odpowiedź i metadata; bez interpretacji biznesowej. | Tak, poza repo/core. | unavailable/rate-limit/auth; bez DB. | Recorded fixtures, obecne źródła [E11,E16–E20]. |
| Connector | Bounded fetch -> immutable bytes + capture metadata. | Tak. | source unavailable/incomplete/redirect; wyłącznie artifact storage, bez business DB. | Failure fixtures; readers z obecnych wrapperów. |
| Raw snapshot | Exact bytes/hash/pages/timestamps -> sealed snapshot. | Nie poza source metadata. | fingerprint/schema mismatch; bez DB. | `inspectSourceSnapshot`, frozen replay [E05,E07]. |
| Parser | Raw snapshot -> source-native typed records. | Tak, wyłącznie parser. | malformed/unsupported/incomplete; bez DB. | Connector golden fixtures. |
| Canonical normalization | Typed records -> canonical source records. | Reguły tylko w typed config. | invalid money/stock/identity/unknown state; bez DB. | Schemas/fingerprints [E05,E07]. |
| Identity reconciliation | Canonical source + read-only catalogue -> exact/candidates/review. Nigdy nie zgaduje. | Nie; manual override jako dane. | missing/ambiguous/conflict/stale; bez DB. | Snapshot scenarios + importer identity regressions [E05,E09]. |
| Diff | Exact identity + expected DB -> field deltas/no-change. | Nie. | expected-state malformed; bez DB. | Offer-sync matrix [E01–E03]. |
| Policy classification | Diff + versioned policy -> proposed action/reason/dependency/approval class. | Konfiguracja tak, branching nie. | row quarantine/retailer guard/source collapse; bez DB. | Classifier/reason matrix [E01,E05,E07]. |
| Review lub execution planning | Ryzyko -> immutable review item albo sealed child/parent plan. | Nie. | approval missing/expired/scope mismatch/concurrent equivalent; tylko control DB. | Partitioner/queue/control ledger [E06,E14–E15]. |
| Atomic DB apply | Approved sealed child + exact expected state -> receipt/deltas. | Nie. | stale/replay/lock/transaction/integrity; jedyny business DB writer. | Existing executor + atomic integration/recovery [E04,E10,E24]. |
| Price history | Część tej samej transakcji; wpis tylko dla rzeczywistej zmiany ceny. | Nie. | delta/integrity mismatch; zapis atomowy, nie osobny. | RPC tests i postflight [E04,E10,E12]. |
| Postflight | Receipt + fresh readback -> verified deltas/hash/no-op contract. | Profile danych, bez kodu biznesowego. | mismatch/drift/incomplete evidence; read-only. | `verifyPostflight` [E12]. |
| Monitoring | Evidence bundle -> run status, alert, next action. | Profile/SLO jako config. | correlation/freshness/backlog/system alert; control evidence only. | Watchdog [E13]. |

Connector nie może tworzyć approval, klasyfikować bezpieczeństwa ani zapisywać
ofert. Shared core nie może zawierać nazw/domen/ID retailerów ani biznesowych
rozgałęzień per retailer.

## 6. Status taxonomy

Statusy są sześcioma niezależnymi polami; nie wolno zastępować ich jednym
`PASS/FAIL`.

### 6.1 Rekord źródłowy

| Status | Znaczenie / terminalność / blokada | Człowiek / alert | Mapowanie obecne |
|---|---|---|---|
| `SOURCE_VALID` | poprawnie znormalizowany; terminalny dla etapu; nie blokuje | nie / brak | normalized source row |
| `SOURCE_MISSING` | zatwierdzone mapping nieobecne; terminalny dla capture, blokuje rekord, **nie oznacza OOS** | zwykle tak / warning | missing mapped variant, review row |
| `SOURCE_INVALID` | rekord malformed/incomplete; terminalny, blokuje dependency group | tak / warning | `INVALID_PRICE`, schema mismatch |
| `SOURCE_IDENTITY_CONFLICT` | duplicate/ambiguous/conflicting identity; terminalny, blokuje grupę | tak / warning | `IDENTITY_DRIFT`, `AMBIGUOUS` |
| `SOURCE_SUSPECT` | collapse/pagination/schema problem całego źródła; terminalny, blokuje retailera | tak / critical retailer | source health/aggregate block |

### 6.2 Proponowana zmiana

| Status | Znaczenie / terminalność / blokada | Człowiek / alert | Mapowanie obecne |
|---|---|---|---|
| `NO_CHANGE` | stan równy; terminalny planowo | nie / brak | `VERIFY_NO_CHANGE` |
| `SAFE_CHANGE` | mieści się w zatwierdzonej policy; nie terminalny przed execution | nie / info | executable price/stock/url action |
| `REVIEW_CHANGE` | poprawna biznesowo możliwość, brak auto-authority | tak / warning | quarantined/review row |
| `REJECTED_CHANGE` | jawnie odrzucona decyzja; terminalny | nie po zapisie decyzji / brak | reviewed rejection |
| `STALE_PROPOSAL` | DB/source/policy zmieniły się; terminalny, blokuje rekord do replan | nie, chyba że powtarzalny / warning | expected-state/fingerprint mismatch |
| `EQUIVALENT_ACTIVE` | równoważny plan/run trwa; terminalny jako bezpieczne pominięcie | nie / info | active-plan/concurrency guard |

### 6.3 Wykonanie

| Status | Znaczenie / terminalność / blokada | Człowiek / alert | Mapowanie obecne |
|---|---|---|---|
| `NOT_REQUIRED` | no-change/rejected/superseded; terminalny | nie / brak | no-op |
| `AWAITING_APPROVAL` | sealed plan oczekuje; nieterminalny | tak / warning wg wieku | pending approval |
| `AUTHORIZED` | policy lub manual approval związane z planem; nieterminalny | nie / brak | approved control plan |
| `APPLIED_VERIFIED` | atomic apply i postflight zgodne; terminalny | nie / brak | executed + postflight PASS |
| `SKIPPED_EQUIVALENT_ACTIVE` | istnieje równoważne wykonanie; terminalny dla runu | nie / info | concurrency/active plan skip |
| `SUPERSEDED` | nowszy artifact zastąpił plan; terminalny | nie / brak | superseded plan/review |
| `BLOCKED_GUARDRAIL` | poprawny guard zatrzymał rekord/retailera; terminalny dla próby | tak / warning/critical wg scope | block/review |
| `FAILED_SYSTEM` | kod/infra/DB/integrity uniemożliwiły trwały wynik; terminalny | tak / critical | rzeczywisty workflow failure |

### 6.4 Run retailera

| Status | Znaczenie / zakres | Następne działanie / alert | Mapowanie obecne |
|---|---|---|---|
| `PASS` | wszystkie rekordy potwierdzone lub zastosowane | none / none | PASS |
| `PASS_WITH_REVIEW` | safe scope zakończony, review artifact trwały | `REVIEW_QUEUE` / warning wg SLA; scheduler może być green | częściowe PASS/review, dziś niespójne |
| `SKIPPED_EQUIVALENT_ACTIVE` | równoważny run trwa; brak błędu | `WAIT` / info | concurrency skip |
| `NO_AUTHORIZED_SCOPE` | capture poprawny, brak scope do zapisu | `OWNER_DECISION` albo none / info | read-only/deferred |
| `BLOCKED_SOURCE` | źródło retailera niewiarygodne | `RETRY_SOURCE` / critical retailer | source failure |
| `BLOCKED_GUARDRAIL` | aggregate/policy poprawnie zatrzymały retailera | `REVIEW_GUARDRAIL` / warning | mass block |
| `FAILED_SYSTEM` | błąd kodu/infra/DB/integrity | `ENGINEERING_RESPONSE` / critical | prawdziwy red failure |

Platforma agreguje niezależnie: `HEALTHY`, `DEGRADED_RETAILER`, `FAILED_SHARED`.
Awaria jednego retailera daje co najwyżej `DEGRADED_RETAILER`; `FAILED_SHARED`
wymaga wspólnej awarii infrastruktury/integralności.

### 6.5 Alert i następne działanie

- Alert: `NONE`, `INFO`, `WARNING`, `CRITICAL_RETAILER`, `CRITICAL_PLATFORM`.
- Następne działanie: `NONE`, `WAIT`, `RETRY_SOURCE`, `REPLAY_READ_ONLY`,
  `REVIEW_QUEUE`, `REVIEW_GUARDRAIL`, `OWNER_DECISION`, `ENGINEERING_RESPONSE`.
- Alert wynika z zakresu, wieku i powtarzalności, nie z samej normalnej zmiany ceny.

## 7. Automatyczne uprawnienia wykonawcze

W każdym modelu: one-time approval contract, manual approval manifestu,
policy authorization, execution i Review Queue są odrębnymi zdarzeniami.
Scheduled run nigdy nie tworzy sobie one-time approval dla nieprzejrzanego
manifestu.

| Model | Scheduled run może / nie może | Contracts i guardraile | Ryzyko poprawnej/błędnej ceny; praca; audyt |
|---|---|---|---|
| **B — rekomendowany**: auto tylko dla wcześniej zatwierdzonych klas | Może wykonać exact no-change freshness i klasy zmian jawnie wymienione w wersjonowanej policy; nie może zmieniać identity, tworzyć produktu/wariantu ani przekraczać limitów. | Policy ma ownera, wersję, zakres, limity, expiry/review date i fingerprint; source health, row/aggregate limits, expected state, locks, atomic apply, postflight. Manual approvals pozostają immutable dla exceptional manifests. | Średnio-niskie ryzyko pominięcia i niskie ryzyko złej ceny; umiarkowana praca; pełny audit. Bezpieczny default: nieznana klasa -> review. |
| A — manualne wszystkie zmiany | Scheduled run tylko capture/diff/queue; żadnego commercial apply. | One-time approval dla każdego manifestu; te same guardraile. | Najwyższe ryzyko opóźnienia poprawnej ceny, najniższe auto-write risk; bardzo duża praca; świetny audit. |
| C — szersze policy auto-apply | Może wykonywać więcej price/stock deltas do progów i auto-stop. | Bardziej złożone limity trendu, wolumenu, częstotliwości, rollback i SLO. | Najniższe ryzyko opóźnienia, najwyższe ryzyko błędnej ceny; mało pracy po wdrożeniu; audit dobry, policy trudniejsza do oceny. |

Model B nie przesądza dziś, które price/stock classes są bezpieczne. RA-002 ma
zakodować dopiero klasy zatwierdzone decyzją właściciela; brak decyzji oznacza
manual review.

## 8. Konfiguracja i wyjątki

1. **Standardowa konfiguracja:** retailer identity, connector type, schedule,
   source health thresholds, shipping mode i scope reference; schema-versioned.
2. **Trwałe reguły źródła:** pagination, stock semantics, currency, field mapping;
   należą do connector/parser policy i mają fixtures.
3. **Tymczasowe wyjątki:** osobny immutable registry, nigdy `if retailer_id` w
   core; wymagają zakresu, powodu, daty, authority, testu, review date/condition
   i removal condition.
4. **Manual mapping overrides:** exact external evidence -> canonical ID,
   reviewer, before/after, fingerprint i expiry/revalidation condition.
5. **Nierozstrzygnięte konflikty:** Review Queue; nie są configuration i nie
   wpływają na niezależne dependency groups.

Każdy config/exception jest częścią policy fingerprint. Zmiana unieważnia plan,
nie może działać wstecz na aktywnym approval.

## 9. Proponowana migracja

Każdy etap ma ten sam gate: recorded read-only replay -> incident fixtures ->
shadow na tym samym snapshotcie -> porównanie statusów/delt -> manualna próbka
różnic -> owner-approved cutover -> atomic postflight -> observation -> retire
legacy -> rollback przez powrót schedulera do starej ścieżki, bez cofania historii.

Observation nie ma arbitralnej liczby dni. Minimalny dowód to trzy kolejne pełne
interwały harmonogramu bez niewyjaśnionego driftu **oraz** wystąpienie wszystkich
klas zdarzeń objętych auto-policy. Jeśli dana klasa nie wystąpiła, używa się
recorded replay i observation trwa dalej. Dla źródeł/API o wysokim ryzyku,
catalogue create i custom recovery wymagany jest dodatkowo pełny cykl rotacji/
expiry approval oraz przećwiczony guardrail/rollback; owner zatwierdza finalny
gate na podstawie zdarzeń, nie kalendarza.

| Kolejność | Retailer / powód | Warunek przed cutover i legacy removal |
|---|---|---|
| 0 | **10 Reps — shadow pilot**, bez cutover w RA-004. Direct CSV, 950 scope, 935/15 i istniejące manifests/tests dają najlepszą dużą próbkę [E21–E22]. | Wyjaśnić 15 review/baseline, parity wszystkich 950, brak pominięć; zachować stary run przez observation. |
| 1 | KIOR — 11/11, mały czysty Shopify golden path. | Registration-hash regression, trzy pełne daily intervals i price/stock replay. |
| 2 | Discount — 109/109 shared path, lecz 47 residual. | Jawna granica 109/47 i nazwa workflow; residual nie może zniknąć. |
| 3 | Dolphin — jeden exact offer, dwa legacy poza scope. | Jednoznacznie utrzymać dwa konflikty w review, nie rozszerzać automatycznie. |
| 4 | Simply — 119/1, threshold shipping i aggregate price guard. | Parity shipping/aggregate sale i review row. |
| 5 | Jon's — 502/4 oraz oba istniejące modele dają dobry parity bridge. | Wszystkie snapshot/production fixtures zgodne; interruption/recovery replay. |
| 6 | Fit House — shared engine, ale największy leakage i 10 deferred. | Wyprowadzić policies bez zmiany sześciu approvals; naprawić status-only failure. |
| 7 | Whey Okay — wspólne primitives, osobny EKM edge. | Najpierw ustalić root cause missing fingerprint; do tego `BLOCKED`, zero cutover. |
| 8 | 6 Pack — dojrzały, lecz wiele family manifests i custom executors. | Parity rodzin, canary, approvals i dedicated postflight. |
| 9 | eBay — API, 237 scope, 78 reviews, same-run drift i custom queue. | Split-run correlation, OAuth/source drift/review execution/recovery event coverage. |
| 10 | GYM HIGH — pełny catalogue i legacy identity; owner-deferred. | Osobna zgoda właściciela, wspólny postflight, create/rollback replay. |
| 11 | Predators Gear — source-blocked/read-only, 47 stale. | Wiarygodne świeże źródło i osobna decyzja ownera; bez tego pozostaje deferred. |

## 10. Co zachować, połączyć i później usunąć

- **Zachować:** atomic import RPC, mixed-batch executor, separated roles/target
  attestation, control ledger, immutable manifests/fingerprints, Review Queue,
  shared postflight/watchdog, connector-specific source logic.
- **Połączyć:** oba classifiery i reason codes; snapshot/replay schemas z live
  offer-sync; onboarding i refresh jako dwa tryby jednego contract; registration,
  evidence bundle, status derivation i exception registry.
- **Usunąć dopiero po parity:** Fit-House-named shared entry point; snapshot
  phase/staging runtime duplicates; dedicated eBay batches H–S, 6 Pack executor/
  sealer/postflight, Whey/Jon's wrappers, GYM executor i retailer branches w
  `import-products.js`; stale static backlog exceptions. Connectorów, fixtures i
  historycznych dowodów nie usuwać.

## 11. Ryzyka i niewiadome

Ryzyka: semantyka ukryta w retailer wrappers; błędne uznanie source absence za
OOS; niepełna event coverage w shadow; podwójny scheduler podczas cutover;
rozjazd approval expiry i policy version; utrata korelacji apply/postflight;
zbyt szeroka auto-price policy; usunięcie ścieżki z aktywnym planem.

Niewiadome blokujące odpowiednie decyzje wykonawcze:

1. Root cause brakującego mapped-source fingerprint Whey Okay.
2. Aktualna wiarygodność i dostępność źródła Predators Gear.
3. Pełna lista aktywnych planów/sesji/niezużytych approvals per retailer nie jest
   eksportowana w dowodach RA-000; wymagany read-only pre-cutover audit.
4. Dokładne klasy zmian ceny/stock, które właściciel uzna za auto-safe w Modelu B.
5. Czy GYM HIGH zostanie odroczony nadal, czy otrzyma osobne uprawnienie migracji.
6. Event coverage nie pozwala dziś ustalić daty końca observation dla eBay/GYM;
   gate pozostaje dowodowy.

## 12. Decyzje dla Marka — maksymalnie pięć

### D1. Który kierunek architektury zatwierdzić?

1. **Rekomendowane i bezpieczny default:** produkcyjny `retailer-offer-sync` jako
   kręgosłup, wzbogacony kontraktami snapshot/replay; najmniej zmienia sprawdzony
   write path i pozwala migrować po jednym retailerze.
2. Snapshot runtime jako rdzeń; czystszy model, ale większy zakres i ryzyko.
3. Tylko fasada nad obecnymi ścieżkami; szybciej, lecz nie usuwa duplikacji.

### D2. Jak scheduled runs mogą wykonywać zmiany?

1. **Rekomendowane i bezpieczny default:** Model B — tylko jawne, wersjonowane,
   wcześniej zatwierdzone safe classes; wszystko inne do review.
2. Model A — wszystkie zmiany manualne; bezpieczniejszy zapisowo, wolniejszy.
3. Model C — szerszy auto-apply; mniej opóźnień, większe ryzyko i złożoność.

### D3. Czy przyjąć sześciowymiarową taxonomy i `PASS_WITH_REVIEW` jako poprawny run?

1. **Rekomendowane i bezpieczny default:** tak; zachowuje review artifact i nie
   myli normalnej decyzji biznesowej z awarią systemu.
2. Przyjąć model, ale nadal czerwienić scheduler dla każdego review; widoczność
   większa, lecz status nadal miesza wynik z alertem.
3. Odłożyć; blokuje RA-002, bo common contract nie ma jednoznacznych wyników.

### D4. Czy zatwierdzić 10 Reps jako pierwszy shadow pilot i podaną kolejność?

1. **Rekomendowane i bezpieczny default:** 10 Reps tylko shadow, potem KIOR;
   duża próbka sprawdza izolację, a KIOR ogranicza ryzyko pierwszego cutover.
2. KIOR jako shadow i pierwszy cutover; mniejsze ryzyko, słabsza próba skali.
3. Wstrzymać kolejność do dodatkowego read-only audit aktywnych planów; opóźnia
   start, ale nie zmienia produkcji.

### D5. Kiedy wolno usunąć legacy paths i wyjątki?

1. **Rekomendowane i bezpieczny default:** dopiero po event-based parity,
   postflight, recovery, braku aktywnych zależności i osobnym owner approval;
   GYM/Predators pozostają deferred.
2. Po trzech poprawnych scheduled intervals; szybciej, ale może nie objąć ryzyka.
3. Nigdy w tym programie; minimalizuje cutover risk, utrwala koszt i duplikację.

Brak odpowiedzi oznacza zawsze pierwszą, bezpieczną opcję wyłącznie dla dalszego
projektowania. Nie oznacza zgody na implementację ani produkcyjny zapis.

## 13. Granica RA-001

RA-001 kończy się na tej propozycji. `ARCHITECTURE.md` pozostaje
`DRAFT FOR OWNER REVIEW`; RA-002 pozostaje `NOT_STARTED`. Żaden wariant, status,
pilot, auto-policy ani removal nie jest zatwierdzony przez sam ten dokument.
