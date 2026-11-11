# H&B: bezpieczeństwo URL i weryfikacja wspólnego kontraktu

## Aktualny checkpoint: 11 listopada 2026

**Lokalna weryfikacja zakończona: PASS. Feature jest gotowy do kontrolowanego
Draft PR; publikacja PR, wdrożenie i onboarding nie zostały wykonane ani
autoryzowane tym zadaniem.** Poniższy checkpoint zastępuje statusy starszego
raportu zachowanego dalej jako historia.

### Rekonsyliacja istniejącej pracy

- Aktualny `origin/main` i HEAD feature:
  `772c608574fff2aa88c99a7a6f2952da58f105fd`, zawierający PR #522.
- Zachowano gałąź `fix/reviewed-catalogue-affiliate-url-contract` i worktree
  `C:/Projects/supplementscout/.worktrees/holland-barrett-url-contract-20261110`.
- Przed aktualizacją zachowano bajtowe kopie wszystkich 11 lokalnych plików,
  patch oraz stash `09530ecc39f3e76a7ddc9cba96bff07fab24c6b3`. Stash nie został
  usunięty. Wykonano tylko fast-forward do main i odtworzenie istniejącej pracy;
  nie utworzono commita gałęzi ani merge commita, niczego nie opublikowano.
- Poprawka `scripts/retailer-active-historical-reconciliation.test.js` była
  identyczna z main po normalizacji końców linii. Po aktualizacji jej diff jest
  pusty. Runtime Six Pack również nie ma zmian względem main.
- Pozostałe oryginalne pliki H&B zostały najpierw odtworzone bajtowo. W tym
  zadaniu zmieniono następnie wyłącznie dwa dokumenty rollout i dwa komentarze
  w `scripts/lib/environment-migrations.js`; żadnej logiki wykonawczej.

### PostgreSQL i dawny błąd readiness

Niezmieniony `scripts/reviewed-catalogue-state.integration.test.js` przeszedł
pięć kolejnych pojedynczych prób oraz szóstą próbę w pełnym zestawie SQL:
**6/6 PASS, 0 FAIL, 0 SKIP**. Nie zmieniono tego harnessu.

Zachowane stare wyjście potwierdza błąd socketu podczas `prepare fixture`, ale
nie zawiera logów usuniętego kontenera. Nowe logi pokazują normalny cykl
tymczasowego serwera PostgreSQL, jego shutdown i start serwera końcowego.
Pojedynczy `SELECT 1` w obecnym wait może teoretycznie trafić na serwer
tymczasowy; atomic harness ma już istniejący warunek zakończenia inicjalizacji.
Nie udowodniono jednak, że ta możliwość spowodowała historyczny błąd. Nie
odtworzono błędu, nie stwierdzono awarii Docker ani kolizji kontenerów w obecnych
próbach. Przyczyna historyczna pozostaje **UNKNOWN**, a nowa poprawka harnessu
nie ma obecnie uzasadnienia w wynikach.

Pełne bieżące polecenie SQL:

```text
node --test --test-concurrency=1 --test-reporter=tap scripts/atomic-product-import-integration.test.js scripts/reviewed-catalogue-state.integration.test.js scripts/reviewed-catalogue-v3.integration.test.js
```

Wynik: **6 PASS, 0 FAIL, 0 SKIP**, w tym **3 rzeczywiste testy bazodanowe**:
atomic/affiliate URL, bounded state i V3. Pozostałe 3 są statyczne. V3 wykonał
obie lokalne linie fixture STAGING/PRODUCTION. Wszystkie cztery kontenery
używały `postgres:17-alpine`, bez sieci i z repo mounted read-only; harnessy
usunęły je po testach. Nie łączono się ze współdzielonymi bazami.

Rzeczywiste SQL potwierdziło rozdzielone i równe URL-e, zgodność Awin/eBay/
Partnerize/sca_ref, powtórne zastosowanie migracji, exact-plan approvals,
fingerprints, single-use/replay, konflikty GTIN, identity oraz zachowanie ACL
approvera/executora. Osadzony destination jest sprawdzany przez wspólny loader
przed approval; SQL wiąże dokładny plan i surowe URL-e, bez drugiego dekodera.

### Aktualne bramki

| Kontrola | Wynik |
| --- | --- |
| Affiliate focused, 4 istniejące pliki | 422 PASS / 0 FAIL / 0 SKIP |
| Negatywne osadzone destination | 32 PASS w powyższym focused run |
| `npm run verify:quick` | 1158 PASS / 0 FAIL / 3 SKIP |
| `npm run verify:full` | 3864 PASS / 0 FAIL / 3 SKIP |
| Project Guardian | PASS przed aktualizacją raportu i w obu bramkach |
| TypeScript, ESLint | PASS w standardowych quick/full |
| Baseline migrations i izolowany build Next.js | PASS w standardowym full |
| Inventory | PASS; 361 istniejących plików testowych, bez zmiany seal |

Trzy SKIP w bramkach dotyczą istniejących zamkniętych profili 10 Reps v8;
żaden test SQL nie został pominięty. Szczegółowe nazwy pozostają w logach.

### Kompletny pozostały diff H&B

| Plik | Istniejąca zmiana |
| --- | --- |
| `scripts/lib/reviewed-catalogue-package.js` | Wspólna walidacja URL V2/V3 |
| `supabase/migrations/20261110170000_align_reviewed_catalogue_affiliate_url_contract.sql` | Wąska migracja istniejącego validatora |
| `scripts/lib/environment-migrations.js` | Wykluczenie migracji z obu środowisk |
| `scripts/supabase-migration-selector.js` | Przypięte wykluczenia i seal |
| `scripts/supabase-migration-selector.test.js` | Regresja wykluczeń |
| `scripts/import-products.test.js` | Zachowane kontrakty size/flavour/format |
| `scripts/reviewed-catalogue-artifact-approver.test.js` | Regresje bezpieczeństwa i kompatybilności URL |
| `scripts/atomic-product-import-integration.test.js` | Rzeczywisty SQL URL i wcześniejsza naprawa kontraktu wyjścia psql |
| `docs/rollouts/reviewed-catalogue-package-workflow.md` | Opis wspólnej granicy URL |
| `docs/rollouts/reviewed-catalogue-affiliate-url-contract-local-2026-11-10.md` | Niniejszy raport |

Migracja zachowała SHA-256
`97940786dca72e5176b359a2d3811c8fb382320463b0f14664b126005f9af5d0`.
Pozostaje wykluczona z domyślnej selekcji STAGING i PRODUCTION. Kontrolowane
wdrożenie wymaga osobnej zgody i sprawdzenia prerequisite/lineage; lokalne PASS
nie oznacza instalacji w którymkolwiek środowisku.

Diff zachowuje istniejące bootstrap sprzedawcy, pakiet V2/V3, manifest, atomic
importer, sealed artifacts, approval ledger, executor, identity/GTIN, Review
Queue i history/freshness. Nie dodaje importera, pipeline afiliacji, warunku
H&B w runtime/SQL, kolejki, approval engine, zależności ani schedulera. Walidacja
URL ma najwyżej trzy lokalne parsowania na wiersz, bez sieci i kosztu klienta.

### Canary i następny krok

Historyczne 44 pary YES / 33 produkty są kandydatami do przygotowania, nie zgodą
na zapisy. Zachowany feed ma 4652 wiersze oraz SHA-256
`6a5f9ba24d949385b0918a292df4754b99506cbb6773972c53b185970a8167bb`.
Nie potwierdza dzisiejszej ceny, stock, shipping ani czasu capture.

Pierwszy kandydat pozostaje `065972` → product `742` / variant `795`, Applied
Nutrition Creatine Monohydrate 250g Cherry & Apple, GTIN `5056555202128`.
Direct URL i Partnerize URL są oddzielne. Nie przenosi się zgody na pozostałe
43 kandydatury; historyczne 14 blokad GTIN nie zostało poluzowanych.

Najmniejszy następny etap kodu to osobno autoryzowana publikacja tego istniejącego
diffu do kontrolowanego Draft PR. Przed przyszłym canary wymagane są kontrolowany
rollout kontraktu, świeży source/commercial capture, read-only potwierdzenie
kanonicznego wariantu i stanu sprzedawcy, ewentualny istniejący bootstrap za
osobną zgodą oraz dokładny reviewed package i nowe single-use approval.

Dowody tego wznowienia: `tmp/hb-url-security-20261110/resume-2026-11-11T14-06-28-145Z/`.
Zero zapisów staging/production, rejestracji sprzedawcy, importów, mappingów,
ofert, approvals, publikacji Review Queue, dispatchy, commitów, pushów, PR i
deploymentów w tym zadaniu. Nie zmieniano bieżącej aktywności review Six Pack.

## Raport historyczny sprzed powyższej rekonsyliacji

**Stan: JavaScript i rzeczywisty PostgreSQL zweryfikowane lokalnie; SQL PASS.**
`verify:quick` i `verify:full` pozostają czerwone przez niezależną fixture Six Pack.
Zmiana nie jest gotowa do wdrożenia. Nie rozpoczęto onboardingu H&B.

1. **Aktualny main.** `git fetch origin main` potwierdził
   `f6804e2c152d53fc23fdbbce53fc9b24ca8b5e15`. Jest to również baza feature.
   Main nie wyprzedził worktree; nie wykonywano merge ani rebase.

2. **Branch i miejsce pracy.**
   `fix/reviewed-catalogue-affiliate-url-contract`, worktree
   `C:/Projects/supplementscout/.worktrees/holland-barrett-url-contract-20261110`.
   Na początku sprawdzono wszystkie dziewięć wcześniejszych sealów, w tym osiem
   plików implementacji: bez nieoczekiwanego driftu. Główny katalog użytkownika
   i wcześniejsze worktree pozostawiono bez zmian.

3. **Potwierdzona luka.** Przed poprawką pięć znanych błędnych celów Partnerize
   przechodziło przez rzeczywisty loader zarówno na main, jak i feature:
   inny sprzedawca, inny produkt, HTTP, javascript oraz credentials wewnątrz
   `destination:`. Manifest i sealed plan były ze sobą spójne, więc same hashe
   nie wykrywały błędnej treści. Zachowano wyniki przed i po poprawce.
   Nie znaleziono istniejącej zaufanej funkcji weryfikującej osadzony cel;
   eBay `stableAffiliateUrl()` dotyczy innej operacji porównania tracking URL-i.

4. **Dokładna poprawiona granica.** Istniejący
   `scripts/lib/reviewed-catalogue-package.js#validateManifest()` sprawdza teraz
   V2/V3 w jednym miejscu, przy użyciu standardowego `URL` i dekoderów URI.
   Nie dodano parsera/modułu URL, importera ani warunków H&B w shared core.
   Lista dwóch adresów obejmuje najwyżej jeden dodatkowy osadzony cel.

   Direct i affiliate są sprawdzane oddzielnie jako HTTPS bez credentials,
   niedozwolonych znaków i błędnego kodowania. Direct nadal musi spełnić
   istniejącą politykę hostname sprzedawcy. Rozpoznawane jawne nośniki to
   segment ścieżki `/<nazwa>:` i parametry query o nazwach `destination`, `dest`,
   `url`, `redirect`, `redirect_url`, `redirect_uri`, `target`.
   Po jednym dekodowaniu cel musi mieć ten sam origin, port, ścieżkę produktu
   i query co zatwierdzony direct URL, zgodnie ze standardowym parsowaniem URL.
   Duplikaty, sprzeczne nośniki, zagnieżdżenia i kolejne warstwy kodowania
   są odrzucane. Nie wybiera się zapasowego celu po błędzie.

   Surowe adresy i canonical identity pozostają niezmienione. Walidacja nie
   wykonuje zapytań sieciowych i nie potwierdza rzeczywistego końcowego redirectu.
   Rozpoznawane formaty i ograniczenia opisano w istniejącym dokumencie
   `reviewed-catalogue-package-workflow.md`.

5. **Odrzucane przypadki.** 5/5 pierwotnych przypadków jest teraz odrzucanych.
   Dodano łącznie 32 indywidualne regresje ujemne: błędny sprzedawca/produkt,
   wariant w query, niebezpieczne schematy, credentials, puste i względne cele,
   uszkodzone percent-encoding/UTF-8, podszywające się domeny, subdomeny i porty,
   mieszane/duplikowane nośniki, zagnieżdżenia, wielokrotne kodowanie oraz
   kodowane znaki sterujące i backslash. Wszystkie 32 przechodzą. Odrzucenie
   nie modyfikuje wiersza tożsamości ani oryginalnych adresów.
   Powtórzenie wcześniejszego probe daje feature13/13 spełnionych wymagań;
   main nadal ma pięć błędów celu i wcześniejszy brak kontroli outer credentials.

6. **Zgodność istniejących afiliacji.**

   | Przypadek | Wynik lokalny |
   | --- | --- |
   | H&B, rzeczywisty format Partnerize canary065972 | PASS, jawny cel odpowiada direct URL |
   | Simply Supplements, Awin `pclick.php?p=...&a=...&m=...` | PASS, opaque tracking zachowany |
   | eBay, item/variant i istniejące parametry tracking | PASS, wartości zachowane |
   | Gladiator, direct Shopify i `sca_ref` | PASS, wartości zachowane |
   | Różne direct/affiliate oraz poprawne równe URL-e | PASS |
   | V1 bez osobnego pola affiliate | PASS, dotychczasowy kontrakt |
   | V3 z niezgodnym jawnym celem | Odrzucony przed istniejącymi kontrolami Shopify |

   Brak jawnego nośnika pozostaje dozwolony w dotychczasowym kontrakcie pakietu.
   Z wartości opaque nie wywnioskowano końcowego miejsca przekierowania.
   Dodatnie testy zachowują bajty URL, w tym parametry zewnętrznego trackera.
   Nie zmieniano routingu outbound-click w aplikacji.

7. **Pełna lista plików feature.**

   - `scripts/lib/reviewed-catalogue-package.js` — wspólna walidacja URL i jawnego celu.
   - `scripts/reviewed-catalogue-artifact-approver.test.js` — regresje bezpieczeństwa i kompatybilności.
   - `scripts/atomic-product-import-integration.test.js` — istniejący harness SQL; przechowywanie dwóch URL-i i replay sprawdzane teraz na dodatnim linku Partnerize.
   - `scripts/import-products.test.js` — wcześniejsza regresja zgodności źródła, rozmiaru/smaku/formatu.
   - `scripts/lib/environment-migrations.js` — wcześniejsze wykluczenie niewdrożonego SQL.
   - `scripts/supabase-migration-selector.js` — wcześniejszy seal wykluczonej migracji.
   - `scripts/supabase-migration-selector.test.js` — wcześniejszy test braku automatycznej selekcji.
   - `supabase/migrations/20261110170000_align_reviewed_catalogue_affiliate_url_contract.sql` — wcześniejsza migracja forward-only.
   - `docs/rollouts/reviewed-catalogue-package-workflow.md` — polityka wspólnej granicy URL.
   - `docs/rollouts/reviewed-catalogue-affiliate-url-contract-local-2026-11-10.md` — niniejszy aktualny raport.

   W poprzednim etapie zmieniono pierwsze trzy pliki i oba dokumenty. Bieżąca
   naprawa zmienia tylko harness i niniejszy raport. Pozostałe osiem plików,
   w tym migracja i logika aplikacji, zachowało hashe z poprzedniego checkpointu.
   Nie zmieniono nazw ani liczby testów; manifest inventory pozostaje bez zmian.

8. **Wyniki focused i quality.** Bieżący focused run: 422/422 PASS, 0 FAIL,
   0 SKIP w czterech istniejących plikach: apply-selected-migrations,
   import-products, reviewed-catalogue-artifact-approver i supabase-migration-selector.
   Wcześniejszy szerszy focused run pozostaje historycznym dowodem 519/519 PASS.
   Obejmują 32 regresje celu, rzeczywiste formaty czterech afiliacji, non-affiliate,
   zgodność źródła, fingerprints, sealing i dotychczasowe approval/executor checks.
   TypeScript i ESLint: PASS. `verify:quick` i `verify:full`: FAIL wyłącznie na
   dotychczasowym teście Six Pack w `retailer-active-historical-reconciliation.test.js:156`.
   Bieżący Full zatrzymał się na batchu181–210/300. Pozostałych90 plików safe
   i buildu nie uruchamiano ponownie po tym zatrzymaniu. Ich wcześniejsze wyniki
   nie zmieniają czerwonego wyniku pełnej bramki. Wcześniejszy `verify:baseline`
   był PASS struktury/hashów migracji, nie wykonania SQL.
   Inventory przejrzany i ponownie zweryfikowany: 361 plików,
   `63492f2432d517294317b1649e7d4f4d2c9830ee9fabe7bfc2b0ec002417ad44`.
   Naprawa nie zmienia inventory; obie bieżące bramki potwierdziły jego PASS.

9. **Rzeczywisty PostgreSQL: SQL PASS.** Uruchomiono istniejące harnessy
   atomic import, reviewed state i reviewed V3 bez credentials środowisk.
   Wynik node:test: 3 testy bazodanowe PASS, 0 FAIL, 0 SKIP. V3 wykonał obie
   lokalne linie fixture STAGING/PRODUCTION, bez połączeń z tymi środowiskami.
   Dokładny wcześniej zawodzący test atomic/URL przeszedł w 50,5 s; bounded
   state w 5,2 s, a V3 w 313,0 s. Nie powtarzano trzech kontroli statycznych.
   Rzeczywista migracja URL została zastosowana i powtórzona idempotentnie.
   Przeszły rozdzielone i równe URL-e, Awin/eBay/sca_ref/Partnerize,
   błędne outer URL-e i direct hostname, zgodność wariantu, approval/fingerprints,
   zapis obu URL-i, replay, duplicate identity i zachowane konflikty GTIN.
   Test sprawdził też niezmienione bindings, definicje i ACL approvera/executora.

   Zweryfikowany kontrakt SQL sprawdza HTTPS/hostname oraz wiąże
   dokładny plan, fingerprints i oba surowe URL-e z żywym approval.
   Interpretacja jawnego nośnika jest wspólną kontrolą loadera pakietu przed
   chronionymi wywołaniami approval/apply. Nie dodawano drugiego dekodera w SQL.
   Bezpośredni privileged RPC nie ma samodzielnej analizy `destination:`;
   nie twierdzimy, że odrzuca pięć przypadków osadzonego celu bez loadera.

   Migracja nadal dotyczy tylko
   `public.validate_reviewed_catalogue_import_plan(jsonb)`, z przypiętym przed:
   `9459d0032dcd1c9eaafe59e5a5cac2b128cd722e8e977388a497cad0ff1df2c4`.
   Proponowany po zmianie SHA, wyliczony lokalnie:
   `40f59521fbaa2d062225ed1419e5a17ff11bc92feaece20765ab10632daf3a7c`.
   Seal migracji: `97940786dca72e5176b359a2d3811c8fb382320463b0f14664b126005f9af5d0`.
   Migracja jest wykluczona z selekcji STAGING i PRODUCTION. Nie zmieniano
   historycznych migracji, SQL approvera/executora, ACL ani guardu GTIN.
   SQL PASS dotyczy wyłącznie lokalnej weryfikacji, nie instalacji na środowisku
   współdzielonym ani zgody na onboarding.

10. **Naprawa istniejącego harnessu.** Blokada WSL została rozwiązana przed
    bieżącym zadaniem; Docker Linux działa. Powtórzono dokładny `DO ...; SELECT true`
    w osobnym jednorazowym PostgreSQL: exit0, stdout `t\n` (hex740a).
    `SELECT false` zwraca `f\n`, a `SELECT to_jsonb(false)` zwraca `false\n`.
    Przyczyną błędu JSON były niewłaściwe kontrakty wyjścia siedmiu wywołań.
    Pięć poleceń bez wyniku używa teraz istniejącego `exec()` + `requireSuccess()`
    przez mały lokalny helper `execute`; dwa wyniki boolean jawnie używają
    `to_jsonb`. Globalny `psqlJson()` nadal rygorystycznie parsuje JSON, a wszystkie
    polecenia zachowują `ON_ERROR_STOP=1`. Nie zmieniono produkcyjnego SQL.

    Właściwy harness już istnieje: własny losowy kontener `postgres:17-alpine`,
    `--network none`, repo mounted read-only, baza i cleanup w `finally`,
    bez connection arguments i produkcyjnych danych/credentials.
    Cleanup zakończony: brak kontenerów atomic, reviewed state, reviewed V3
    i próby odtwarzającej błąd. Nie instalowano oprogramowania, nie zmieniano
    systemu i nie uruchamiano niczego zdalnie.

11. **Six Pack pozostaje osobno.** Ponowne10 prób na czystym main i feature
    potwierdziło identyczne wyniki. Capture fixture ma datę
    `2026-11-09T14:31:53.000Z`; po `2026-11-10T14:31:53.000Z` przekracza
    limit24 h. Test oczekuje PRODUCT, a runtime prawidłowo zwraca RETAILER.
    Przy capture+1 s i dokładnie+24 h przechodzi; po+24 h+1 ms oraz dla capture
    w przyszłości jest blokowany. Zegar zmieniano wyłącznie w diagnostycznych
    procesach potomnych, nigdy dla quality gates ani systemu.

    Ta fixture powstaje w istniejącym `physicalRecords()` oraz z lokalnego
    `scripts/test-fixtures/six-pack-theme-unbuyable-parent.html`. Nie znaleziono
    dedykowanego polecenia jej refresh/regeneration; są trzy odczyty w testach.
    Projekt ma istniejący mechanizm scoped `Date.now` mock w `node:test`, który
    można wykorzystać w osobnym follow-upie testu, bez zmiany produkcyjnej
    świeżości lub tworzenia pozornie nowych dowodów źródłowych. Nie zmieniano
    Six Pack, fixture, limitu ani jego produkcyjnej automatyzacji.

12. **Project Guardian.** PASS przed zmianami i po aktualizacji dokumentacji.
    SEO-20 i statusy RA pozostają bez zmian. Guardian nie oznacza SQL PASS.

13. **Reuse i zakres bezpieczeństwa.** Wspólny loader nadal obsługuje pakiet,
    canonical CSV, sealing, dotychczasowy importer, chronione approval i atomic
    executor. Nie ma nowych zależności, runnera, parsera URL, ścieżki approval,
    warunków H&B ani modyfikacji outbound-click. Koszt walidacji to lokalne
    parsowanie najwyżej trzech URL-i i skończone sprawdzenie ich tekstu;
    nie ma crawlera ani sieci. Poprawne dane pozostają bajtowo niezmienione.

    Testy DB split-URL V2 są lokalnie PASS. Instalacja wymaga osobnej zgody;
    staging nie ma starej linii V1/V2 i wymaga osobnego
    sprawdzenia prerequisite. Rollback aplikacji zachowuje schema/signature,
    ale usuwa nową ochronę loadera, więc nie należy wtedy dopuszczać nowych
    split-URL pakietów bez tej kontroli. Rollback SQL powinien nową migracją
    przywrócić poprzednią definicję i jej SHA/ACL; przywrócona równość blokuje
    niezużyte split plans. Nie odtwarzać zużytych approvals ani usuwać danych.

14. **Canary065972 → product742 / variant795.** Lokalny dodatni test Partnerize
    przechodzi; SQL/migration/approval/replay są lokalnie PASS. Nadal potrzebne są
    osobny follow-up czerwonej fixture, kontrolowane wydanie poprawki,
    świeży odczyt stanu sprzedawcy i użycie
    istniejącego bootstrap jeśli nadal potrzebny, świeże capture/stock/cena/shipping,
    dokładny owner-reviewed pakiet i single-use approval. GTIN guard nie został
    zmieniony; wcześniejszy dowód nie wykazał peeru GTIN canary. Nie utworzono
    rzeczywistego sprzedawcy, mappingu, oferty, approval ani kolejki; syntetyczne
    fixture testowe istniały wyłącznie w usuniętych jednorazowych bazach.

15. **Jeden najmniejszy następny krok.** Osobno naprawić deterministyczność
    testu wygasłej fixture Six Pack, bez zmiany produkcyjnej polityki świeżości,
    i ponowić standardowe quick/full. Onboarding i wdrożenie nadal są zatrzymane;
    lokalny SQL PASS nie daje uprawnień do żadnej operacji środowiskowej.

Dowody bieżącej naprawy: `tmp/hb-url-security-20261110/harness-repair-20261110/`,
w tym `verification.json`, focused422/422 i logi quick/full. Poprzedni katalog
zachowuje wcześniejsze probe, focused519, trzy historycznie pominięte testy DB,
triage Six Pack i historyczny `artifact-checksums.json`; nie nadpisano tych dowodów.
Nowy checkpoint zapisuje aktualne sumy po naprawie harnessu i raportu.
Zero zapisów staging/production, deployments, dispatchy, commitów,
pushów, PR, merge i zmian GTIN. Zakończenie po lokalnej weryfikacji i raporcie.
