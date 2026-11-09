# Decyzja właściciela: wykluczenie produktów z katalogu

Data decyzji i odczytów: **8 listopada 2026**.
Status: **PR do review; DEPLOYMENT_BLOCKED; produkty jeszcze niewycofane**.

## Obowiązująca polityka

EXCLUDE obejmuje melatoninę we wszystkich dawkach, SARMs oraz peptydy
farmakologiczne i badawcze. Wcześniejszy wyjątek dla melatoniny 1 mg został
odwołany. Nie jest to zgoda na zmianę tożsamości, parsera ani stock tych produktów.
Limitless Nootropic pozostaje DEFER. Niejasna tożsamość peptydu lub wzmianka
wyłącznie w opisie oznacza DEFER do review, nie automatyczne wykluczenie zwykłych
aminokwasów, nootropików, adaptogenów czy pre-workoutów.

RA-001, istniejący classifier, executor, Review Queue i approval pozostają
obowiązujące. Scheduled apply 6 Pack pozostaje wstrzymany bez terminu wznowienia.
Nie uruchomiono nowego pełnego dry-run, apply ani źródłowego odświeżenia.

## Ustalenia z produkcji

Odczyt REPEATABLE READ READ ONLY, zweryfikowany TLS, 21:23:46 UTC:
1399 produktów, 4070 wariantów, 4361 mappingów i 4361 ofert, 13 retailerów.
Ledger ma 261 pozycji, kanoniczny CURRENT i fingerprint
`755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a`.
Przejrzano nazwy/opisy produktów, nazwy wariantów i zewnętrzne nazwy mappingów
całego katalogu; kwalifikowane wzorce dotychczasowej polityki oraz szerszy przegląd
melatoniny/peptydów/Limitless wskazały poniższy zakres. Nie jest to gwarancja
rozpoznania każdego przyszłego aliasu farmakologicznego.

| Decyzja | Produkt kanoniczny | Warianty | Stan |
| --- | --- | --- | --- |
| EXCLUDE | 951 — 7Nutrition Melatonin 1mg 60 Capsules | 1853 Default | aktywny; wymaga wycofania |
| EXCLUDE | 999 — Soma Melatonin 4 mg - 100 Tablets | 1960 Default | aktywny; wymaga wycofania |
| DEFER | 1114 — Ultra Nutrio Limitless Nootropic 100 Capsules | 2414 Default; 2415 Unflavoured / 100 capsules | oba aktywne; wymaga wycofania do review |

| Retailer | Produkt źródłowy | Wariant źródłowy | Mapping | Oferta | Produkt / wariant kanoniczny | Stock przy odczycie |
| --- | --- | --- | --- | --- | --- | --- |
| Fit House | 8291615637744 | 44147305251056 | 2082 | 1896 | 951 / 1853 | false |
| 6 Pack | **4110** | 4110 | **2170** | **1984** | 951 / 1853 | true |
| Fit House | 9623362011376 | 47984607690992 | 2151 | 1965 | 999 / 1960 | false |
| 6 Pack | **29928** | 29928 | **2582** | **2396** | 1114 / 2415 | true |

EXCLUDE: 2 produkty, 2 warianty, 3 mappingi i 3 oferty.
DEFER: 1 produkt, 2 warianty, 1 mapping i 1 oferta; wariant 2414 nie ma oferty.
Razem do wycofania z publikacji: **3 produkty, 4 warianty, 4 mappingi, 4 oferty**.
Znalezione SARMs i farmakologiczne/badawcze peptydy: **0** w obecnym katalogu.

Odczyt zależności o 21:42:08 UTC potwierdził brak dotyczących tych ofert wierszy
Review Queue, execution requests i aktywnych niezużytych approvals. Brak blokujących
parentów dla retailerów 9 i 11. Jest **5 wpisów price_history**: oferta 1896 — 1,
1965 — 1, 1984 — 2, 2396 — 1. Wszystkie należy zachować. Produkt 951 i wariant
1853 są wspólne dla dwóch retailerów; wycofanie tylko oferty 1984 pozostawiłoby
publikację tego samego produktu przez Fit House.

Publiczny odczyt HTTPS o 21:38:43 UTC potwierdził HTTP 200 i właściwy tytuł na
wszystkich trzech kanonicznych stronach produktów. Dane publiczne nie zostały
wycofane przez ten PR. OOS dwóch ofert Fit House nie usuwa ich stron z katalogu.

Próba odświeżenia odczytu DB przed PR 9 listopada zakończyła się błędem połączenia
`08006`; nie uzyskano nowego snapshotu i nie ponawiano tej próby. Powyższe dane
pozostają datowanym dowodem z 8 listopada, a nie nowym potwierdzeniem stanu live.
Świeży, udany odczyt jest obowiązkową bramką przed jakimkolwiek wdrożeniem.

Kontrole zwykłych peptydów żywieniowych pozostają dozwolone: produkty
422 Vital Proteins Collagen, 681 Doctor's Best Collagen, 720 Now Foods Collagen,
865 CNP Peptide Whey, 1002 Swanson Collagen, 1221 Applied Nutrition Collagen,
1343 Swanson Marine Collagen. Ich 11 ofert pozostaje poza zakresem wycofania.
Nie utożsamiamy smaków ani rozmiarów; audit zachowuje dokładne bindingi wariantów.

## Konflikt Limitless i historycznych zgód

`six-pack-reviewed-catalogue-decisions-v11.json` z 28 lipca zawiera DEFER dla
`Limitlesss Nootropic Brain Booster`. Późniejszy
`six-pack-reviewed-decision-execution-builder.js` zawiera zatwierdzającą specyfikację
29928 z nazwą `Ultra Nutrio Limitless Nootropic 100 Capsules`; aktywny manifest
obejmuje mapping 2582 / ofertę 2396. To potwierdzony konflikt kolejnych decyzji.
Obecny właściciel utrzymuje DEFER, więc późniejszy manifest nie daje aktualnej
zgody na monitorowanie ani publikację tej pozycji.

Historyczne dokumenty, manifesty i artefakty pozostają nienaruszone. Bieżąca
reguła polityki rozpoznaje obie pisownie nazwy, ale nie ustanawia aliasu tożsamości,
nie akceptuje różnicy nazw w source identity i nie zawiera wyjątku po ID.
Analogicznie historyczny approval 1 mg nie uchyla obecnego EXCLUDE melatoniny.

## Rozliczenie zakresów

Poniższe zmiany są **propozycją**, bez zatwierdzenia/aktywacji nowego scope.
Fizyczna liczba rekordów mappingów i ofert ma pozostać niezmieniona.

| Retailer | Mappingi obecnie | Dotknięte | Proponowany aktywny scope |
| --- | --- | --- | --- |
| GYM HIGH | 66 | 0 | bez zmian |
| Whey Okay | 870 | 0 | bez zmian |
| Discount Supplements | 156 | 0 | bez zmian |
| Dolphin Fitness | 3 | 0 | bez zmian |
| Simply Supplements | 120 | 0 | bez zmian |
| KIOR Health | 11 | 0 | bez zmian |
| Fit House | 286 | 2 EXCLUDE | **284** |
| Jon's Supplements | 506 | 0 | bez zmian |
| 6 Pack Supplements | 506 | 1 EXCLUDE + 1 DEFER | **504** |
| eBay UK | 237 | 0 | bez zmian |
| Predators Gear | 47 | 0 | bez zmian |
| 10 Reps | 950 | 0 | bez zmian |
| Gladiator Nutrition | 603 | 0 | bez zmian |

6 Pack: 506 = 504 zachowane + mapping 2170 EXCLUDE + mapping 2582 DEFER;
liczba zatwierdzonych parentów źródłowych 279 → **277**.
Fit House: 286 = 284 zachowane + mappingi 2082/2151 EXCLUDE;
unikalne parenty w zatwierdzonym manifeście 174 → **172**.
Nie są to całkowite liczby produktów całego sklepu źródłowego.

Aktywne manifesty zachowują dokładnie dotychczasowe bajty i SHA:

- 6 Pack: `62f88fabc33e339d1106e597091217eabbbfaa4c5015b5625fb5257eacf0e7ff`.
- Fit House: `a1e596f7707c851534e04e30d13f4289439449556787c572736e77b279c75292`.

JSON dowodowy zawiera osobne fingerprinty proponowanych zachowanych rows,
pełne bindingi wycofywanych pozycji, hashe oczekiwanych rekordów produktów i
wariantów oraz flagi `candidate_approved=false`. Nie jest nowym approved manifestem.

## Zakres kodu w tym PR

Istniejący `feed-variant-guards` otrzymuje jedną wspólną decyzję EXCLUDE/DEFER,
wykorzystywaną przez dotychczasowy czytnik Woo CSV i istniejące plan builders.
Blokowane są także rebuild starego reviewed importu, plan ceny/stock/URL oraz
sam freshness. Kontrola obejmuje nazwę kanoniczną, zewnętrzną i wariantu.
Brak identyfikatorów produktów w warunkach runtime, nowego executora lub nowej
Review Queue. Nie zmieniono parsera HTML ani obsługi źródła.

6 Pack i współdzielony refresh Fit House sprawdzają policy przed pobraniem źródła.
Konflikt z obecnym approved scope kończy się `CATALOGUE_POLICY_SCOPE_BLOCKED`,
bez automatycznego filtrowania czy produkcyjnej publikacji review. CLI 6 Pack
zwraca deterministyczne exit 2, więc workflow nie ponawia całego capture.
**Wdrożenie samych guards z obecnymi manifestami zablokuje cały refresh 6 Pack
506 i Fit House 286**, a nie tylko cztery oferty. Pozostałe profile używają tej
samej kontroli, ale w odczytanym katalogu nie mają dotkniętych mappingów.

Dwa testy przypinające bieżące pliki importera i współdzielonego refreshu
otrzymują nowe hashe po dodaniu kontroli. Seale classifiera, executora, migracji,
workflow i historycznych pakietów nie są luzowane. Nowe regresje sprawdzają
niezmienność manifestów, kompletność partycji 506/286 i brak aktywacji propozycji.

## Rzeczywisty blocker wdrożenia

Constraint produkcyjny `products_merge_state_consistent` dopuszcza wyłącznie:
aktywny produkt bez merge albo nieaktywny produkt z niepustym celem i datą merge.
Nie dopuszcza poprawnego wycofania produktu bez scalenia. Nie znaleziono
dedykowanej bezpiecznej operacji wycofania. Obecne refresh actions dotyczą
VERIFY_NO_CHANGE, ceny, stock i URL; product action importera to existing/create.

Istniejące publiczne loadery filtrują aktywne produkty, a strona produktu zwraca
notFound dla nieaktywnego niescalonego produktu. To można wykorzystać po
kontrolowanym rozszerzeniu cyklu życia produktu; dzisiejszy constraint blokuje
uzyskanie takiego stanu. Nie wolno symulować scalenia, ustawić fikcyjnego OOS,
usuwać rekordów ani zdejmować constraintu bez zachowania jego invariants.

Z tego powodu PR pozostaje **DRAFT / DEPLOYMENT_BLOCKED**. Nie zawiera migracji,
SQL do ręcznego uruchomienia ani nowej ścieżki zapisu. Nie twierdzi, że publiczne
wycofanie jest gotowe albo zostało wykonane. Minimalna brakująca zmiana ogólna
to audytowalne wycofanie niescalonego produktu w istniejącym cyklu życia i
kontrolowane uzgodnienie scope, nie kolejne naprawy parserów produktów.

## Wymagany plan bezpiecznego wdrożenia

1. Review decyzji, listy bindingów i skutków blokady całego Fit House. Nie łączyć
   tego PR jako samodzielnego, gotowego wycofania. Utrzymać pause 6 Pack.
2. Osobno zrecenzować brakujące ogólne rozszerzenie istniejącego lifecycle:
   jawny audytowalny stan/reason EXCLUDE albo DEFER dla nieaktywnego produktu
   bez merge, zachowujący invariants prawdziwych merge. Użyć istniejącego
   `supabase-migration-selector.js` i `apply-selected-migrations.js` z izolowaną
   próbą oraz nową selekcją/fingerprintem; nie nowego executora lub endpointu.
   Ten PR i decyzja katalogowa nie stanowią zgody na wykonanie migracji.
3. Przed jakimkolwiek zapisem wykonać świeży read-only inventory: ledger/CURRENT,
   aktywne workflow, locks, plany i approvals; porównać pełne oczekiwane rekordy,
   hashe oraz wszystkie zależności czterech ofert. W razie drift STOP.
4. Przygotować ograniczoną transakcję wycofania przez zrecenzowaną istniejącą
   ścieżkę kontrolną z nową selekcją migracji i receipt: dokładnie 3 produkty /
   4 warianty; zachować 4 mappingi, 4 oferty, 5 rekordów historii, ceny, stock,
   last_checked_at i stare approvals jako historię. Nie wystawiać nowych
   approvals komercyjnych i nie wykonywać refresh/apply w tej transakcji.
5. Jednocześnie uzgodnić nową wersję approved scope: 6 Pack 504/277 i Fit House
   284/172, rejestrację DB, manifest SHA, fingerprinty, profile, czytniki oraz
   postflight/idempotency. Rozróżnić zachowane fizyczne rekordy nieaktywne od
   aktywnego scope. Dziś czytniki nadal oczekują pełnych 506/286 rekordów;
   samo usunięcie rows spowodowałoby scope mismatch i nie jest wdrożeniem.
   Uzgodnić także Fit House stable-OOS baseline (obie wycofywane oferty są OOS).
   Nie zmniejszać niezależnych progów kompletności całego feedu ani limitów
   pobierania źródła. Nie przepisywać historycznych sealed artefacts.
6. Dla konkretnej finalnej wersji kodu/SQL/scope uzyskać osobne zatwierdzenie
   wdrożenia i produkcyjnego zapisu. Standardowy PR/CI/Guardian i selected
   migration rehearse/receipt pozostają wymagane; żadnego bypassu. To nie
   zatwierdza automatycznie późniejszego ofertowego apply ani wznowienia schedule.
7. Postflight: brak aktywnej publikacji wszystkich 3 produktów i 4 wariantów;
   wszystkie mappingi/oferty/history zachowane i komercyjnie identyczne;
   kompletny rozkład aktywne/wycofane 506 i 286; poprawne bindingi/CURRENT;
   idempotentny drugi odczyt bez ponownego zapisu. Użyć istniejących kontraktów
   cache i publikacji. Po propagacji wspólnego cache (obecnie TTL 3600 s)
   sprawdzić faktyczny brak w wyszukiwaniu, porównaniach, hubach, sitemapie,
   detail i `/go` ofert. Zachować SEO lifecycle hubów live_verified; spadek
   coverage nie jest powodem ich deindeksacji. Bez nowego lokalnego noindex.
8. Dopiero osobna decyzja może dopuścić dalszy normalny dry-run/apply nowego
   scope lub przywrócenie schedule. Żadna z tych operacji nie należy do tego zadania.

## Dowody i walidacja

Trwałe rozliczenie: [JSON decyzji i propozycji scope](evidence/OWNER-CATALOGUE-EXCLUSION-2026-11-08.json).
Pełne odczyty lokalne: `tmp/owner-catalogue-exclusion-20261108/`
(`catalogue-readback.json`, `dependencies.json`, `policy-matched-mappings.json`,
`affected-mappings.csv`, `public-verified-readback.json`). Bez sekretów w PR.

Regresje lokalne: 481 PASS / 0 FAIL / 0 SKIP w ośmiu istniejących plikach;
dodatkowa granica retry/policy 27 PASS, finalne policy/scope/import 267 PASS.
Quick: 469 PASS / 0 FAIL / 0 SKIP. Full: **3680 PASS / 0 FAIL / 3 wcześniejsze
SKIP**, TypeScript, lint, build i Guardian PASS. Offline sprawdzenie wszystkich
4361 mappingów snapshotu wskazuje dokładnie cztery powyższe bindingi i 4357
nieobjętych wycofaniem. PR CI jest raportowane w opisie PR po wykonaniu;
pominiętych testów integracyjnych nie uznaje się za wykonane. W tym zadaniu
nie zmieniano SQL i nie uruchamiano osobnej integracji PostgreSQL.
Nie dodano ani nie usunięto pliku testowego: inventory 355, seal
`7c2d270f8b1bc713d3921bf108f34611a4d4c941bd53e461d18824fe2c6037c4`.

Business writes **0**, control writes **0**, approvals **0**,
price_history writes **0**, usunięcia **0**, migracje zastosowane **0**,
retailer workflow dispatches **0**. Wykonane HTTP to wyłącznie odczyt istniejących
publicznych stron SupplementScout. Produkcyjne wycofanie pozostaje niewykonane.
