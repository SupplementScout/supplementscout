# Wycofanie właścicielskie katalogu — implementacja 9 listopada 2026

Status: **kod do review w DRAFT PR #510; DEPLOYMENT_BLOCKED**.
Produkcja nadal ma stare stany i ledger261. Bez merge, migracji, retailer dry-run/apply,
approvals i zmian harmonogramów. Six Pack pozostaje PAUSED. Uzupełniamy ten sam PR;
RA-004 nie jest wznawiane.

## Przyczyna i minimalny kontrakt

Dotychczasowy CHECK products_merge_state_consistent wymagał rzeczywistego merge
każdego nieaktywnego produktu. Nie istniała bezpieczna operacja owner withdrawal.
Jedna migracja forward dodaje trzy nullable pola products:
owner_withdrawal_state text, owner_withdrawal_reason text, owner_withdrawn_at timestamptz.
Istniejące is_active pozostaje przełącznikiem publikacji.

| Stan | is_active | Merge | Metadane withdrawal |
| --- | --- | --- | --- |
| ACTIVE | true | oba pola NULL | wszystkie NULL |
| MERGED | false | rzeczywisty target i merged_at; dotychczasowe FK/semantyka | wszystkie NULL |
| OWNER_EXCLUDED | false | oba pola NULL | stan, niepusty powód 1–1000 znaków i czas |
| OWNER_DEFERRED | false | oba pola NULL | stan, niepusty powód 1–1000 znaków i czas |

CHECK odrzuca brak powodu/czasu, częściowy merge, aktywne withdrawal i fałszywy merge.
Trigger products opiera właścicielską zmianę na session_user i właścicielu tabeli:
SECURITY DEFINER zwykłego refresh nie może wyzerować decyzji. Triggery
ofert/mappingów/wariantów/historii blokują INSERT/UPDATE/DELETE wycofanego rodzica;
FOR SHARE na rodzicu serializuje zapis z withdrawal. Właściciel może tylko
zdezaktywować wariant bez zmiany tożsamości. Odroczone constraint triggers wymagają
braku aktywnych wariantów pod wycofanym rodzicem. Brak nowego RPC executora/queue.

## Dokładny zakres i historia

| Decyzja | Produkt | Warianty | Retailer / mapping / oferta |
| --- | --- | --- | --- |
| EXCLUDE | 951 — 7Nutrition Melatonin 1mg | 1853 | Fit House /2082 /1896; Six Pack4110 /2170 /1984 |
| EXCLUDE | 999 — Soma Melatonin 4mg | 1960 | Fit House /2151 /1965 |
| DEFER | 1114 — Ultra Nutrio Limitless Nootropic | 2414,2415 | Six Pack29928 /2582 /2396; wariant2414 bez oferty |

Fizycznie pozostają 3 produkty,4 warianty,4 mappingi,4 oferty i5 całych price_history.
Powód: owner-catalogue-decision-2026-11-08. Produkty/warianty zmieniają wyłącznie
aktywność/metadane lifecycle. Ceny, stock, freshness, URL, identyfikatory i historia
ofert pozostają identyczne. Wariant1853 jest wspólny dla obu retailerów; wycofanie
obejmuje oba bindingi. Brak produktów zmergowanych do tych trzech rodziców;
identity_series ma0 zależnych wpisów. Historyczne outbound clicks i decyzje
pozostają. Nie wykonujemy produkcyjnego GET /go, który mógłby utworzyć kliknięcie.

EXCLUDE obejmuje wszystkie dawki melatoniny, SARMs i peptydy farmakologiczne/badawcze.
Przegląd całego istniejącego katalogu pod kwalifikowanymi wzorcami nie znalazł
obecnych SARMs ani tych peptydów; nie jest to gwarancja rozpoznania przyszłych aliasów.
Zwykłe peptydy żywieniowe, aminokwasy, adaptogeny i pre-workouty pozostają dozwolone.
Niejasny opis to DEFER do review. Limitless zachowuje wcześniejsze DEFER pomimo
późniejszego approved manifest. Runtime używa ogólnej polityki nazw/statusów,
bez wyjątków po ID. ID ograniczone są do zatwierdzonego pakietu danych migracji,
manifestów i dowodów/testów.

## Scope i istniejące kontrakty

| Retailer | Fizyczne mappingi/oferty | ACTIVE_APPROVED_SCOPE | HISTORY | Aktywne source parents |
| --- | --- | --- | --- | --- |
| Six Pack | 506 | 504 | 2 | 279 → 277 |
| Fit House | 286 | 284 | 2 | 174 → 172 |

Stare manifesty są bajtowo niezmienione. V2 zachowuje wszystkie pełne bindingi
w rozłącznych rows/historical_withdrawn_rows, physical count/fingerprint i SHA
poprzednika. Reader weryfikuje wszystkie fizyczne wiersze przed wydzieleniem
active. Brak/duplikat/obcy binding lub niewdrożona decyzja = BLOCK przed HTTP.
Nie filtrujemy błędu kompletności ani nie obniżamy niezależnych limitów.

- Six manifest SHA: a038f86f98057c5edde505ec5c07f262066dbc53001157a933ebee6c468ae77e.
- Fit manifest SHA: b25aaafadecb848e08507ba488f34a4b4a84871f67d993d93538eff50600e3b5.
- Fit runtime policy SHA: bd01649903badb820d3595ea5c9776311370c2c97341783078e39d64e867c5da.

Ta sama migracja uzgadnia istniejącą rejestrację Fit: approved284 + full physical
fingerprint286. Zmienia dokładnie pięć istniejących definicji SQL: registration,
dwa validatory, istniejący six-OOS exception i baseline guard. Każdy stary/nowy
MD5 i liczba kotwic są związane; owner/ACL/proconfig muszą pozostać. Drift = rollback.
Shared classifier, executor i dispatcher nie są modyfikowane. Fit producer zmienia
wyłącznie approved_scope approved-286 → approved-284; enabled/capability/terms
pozostają. Six producer nadal disabled/incapable.

Source readers przekazują active do tego samego classifiera. Stary sealed artifact506
jest odrzucany przez istniejącą kontrolę scope504. Review Queue i approvals nadal
wymagają tych samych fingerprintów; SQL trigger blokuje także stary approved RPC.
Postflight liczy wszystkie physical mappings/offers i porównuje oddzielnie cały
snapshot historical i historię. Watchdog mierzy freshness aktywnych produktów/
wariantów, jawnie rozliczając physical/historical counts. Brak drugiej ścieżki.

### Fit House stable OOS

Świeże dane ujawniły istniejącą rozbieżność: SQL guard nie uwzględniał durable
Review Queue UPDATE_STOCK, które obecny JS już uwzględnia. OOS fizycznie111;
4 wykonane przejścia dają netto+2: oferty1982,983,1859 true→false,697 false→true.
Test odtwarza stary SQL=false i naprawiony=true na tym samym stanie.
Migracja uzupełnia ten sam guard o istniejące executed/current-stock/fingerprint/
postflight/idempotency proofs, deduplikację per offer i wyłączenie legacy baseline.
Uszkodzony proof daje false. Baseline104, physical286, source207/325, limit35%
i pozostałe limity są zachowane. Historyczne OOS wycofanych ofert nadal liczy się
w physical baseline; nie udajemy zmiany stock.

## Publikacja i cache

Wykazany brak dotyczył generateMetadata strony produktu: czytało nieaktywny produkt.
Teraz sprawdza is_active/merge przed zbudowaniem metadata. Inactive unmerged daje
notFound; prawidłowy merge zachowuje permanentRedirect. Rendering już miał tę kontrolę.

PostgreSQL i rzeczywiste moduły aplikacji sprawdzają detail/metadata, search,
category loader, sitemap, saved references i /go. Wycofane oferty nie mają redirect
ani nowego click. Saved zachowuje odniesienia z UNVERIFIED i bez bieżącej ceny.
Przegląd comparison/home/category/brand/deals potwierdza wspólny active scope;
nie dodano filtrów ID ani zmiany zasad rankingu. Dla tych pozostałych powierzchni
dowodem jest kontrakt wspólnego loadera i regresje, nie wdrożony publiczny E2E.
Schema/metadata pochodzą z odfiltrowanych danych; lifecycle indeksowania hubów nie zmienia się.

Istniejący lifecycleDataCache ma bucket3600s i tagi lifecycle-hub:<path>.
DB commit/deploy nie daje natychmiastowej zgodności wszystkich publicznych cache.
Plan używa istniejącego [Vercel cache purge](https://vercel.com/docs/cli/cache)
(CDN i Data Cache projektu), po potwierdzeniu projektu/uprawnień i osobnej zgodzie.
Invalidate-tag może zwrócić STALE i rewalidować w tle; sam nie dowodzi withdrawal.
Nie wykonano purge, nie dodano endpointu/service. Zdolność operatora do purge
nie została potwierdzona w tej sesji. To bramka przed produkcyjnym zapisem;
brak tej zdolności lub niezgodny publiczny readback oznacza STOP.

Granica: nie istnieje transakcja obejmująca DB, Git i rozproszony cache. Guardy
zapisu fail closed przy częściowym rollout; publiczne snapshoty mogą pozostać stare
do purge. Sam kod nie dowodzi natychmiastowego publicznego wycofania. Produkcyjna
aktywacja pozostaje BLOCKED, dopóki operator nie potwierdzi kontrolowanego purge /
publicznego postflight. Nie obiecujemy usunięcia danych z już otwartych kart użytkownika.

## Świeże dowody produkcyjne

Udany snapshot 2026-11-09 08:27:17 UTC: verified TLS/owner/project_ref/database_identity,
REPEATABLE READ READ ONLY, ledger261 / canonical CURRENT:
755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a.
1399 produktów,4070 wariantów,4361 mappingów,4361 ofert,13 retailerów.
Hashe wszystkich affected rows i5 historii identyczne z odczytem07:18.
Pending affected approvals0; parents9/11:76COMPLETED,1EXPIRED,3SUPERSEDED;
execution requests42EXPIRED, bez aktywnego zapisu. GitHub in_progress0/queued0
przy kontroli08:27. Udane odczyty zastępują błąd08006 z poprzedniego etapu;
świeży preflight bezpośrednio przed rollout pozostaje obowiązkowy.
Produkty nadal nie zostały wycofane z produkcji. Publiczny HTTPS readback08:38:47 UTC potwierdził HTTP200 i prawidłowe tytuły wszystkich trzech stron; bez żądań /go.

## Testy i ograniczenia dowodów

Prawdziwy izolowany PostgreSQL17.11: **20 PASS /0 FAIL /0 SKIP**. Pokrywa A–S:
ACTIVE/MERGED, oba withdrawal, powód/czas, reactivation,4 mappings/offers i5 history,
detail/go/search/category/sitemap,504+2/284+2, shared1853, OOS, stary prawdziwy
approved RPC, rollback wczesny/późny, idempotentny bounded activation bez zmiany
xmin oraz prawdziwy RPC innego retailera. Serwer lokalny słuchał127.0.0.1;
test odrzuca zdalne credentials i usuwa wyłącznie własne fixture DB. Serwer zatrzymano.
Nie jest to produkcyjny apply ani pełny source run. CI używa istniejącej izolowanej
bramki integration z Docker PostgreSQL; SKIP nie jest zaliczeniem integracji.

Quick:1020 PASS /0 FAIL /3 wcześniejsze SKIP. Full:3681 PASS /0 FAIL /3 wcześniejsze
SKIP. TypeScript/lint/build/Guardian/baseline PASS. Lokalny pełny build wymagał
systemowego magazynu certyfikatów do pobrania Google Fonts (weryfikacja TLS zachowana).
Aktualne CI ma własny receipt w PR510; starego CI nie zaliczamy nowemu head.

Historyczne testy rebind/OOS/source mają zamrożone stare manifesty506/286, bez
zmiany starych migracji i dowodów. Nowy zakres testuje rzeczywisty PostgreSQL i
odrzucenie starego artefaktu. Inventory356 / integration57 jest ponownie sealed;
integracja nie otrzymuje produkcyjnych writer credentials.

## Sekwencja wdrożenia — wymaga odrębnej zgody

1. Review finalnego head DRAFT510, wymagane CI i Guardian. Potwierdzić dostęp do
   właściwego projektu Vercel i istniejącego purge Data/CDN cache. Bez dostępu
   STOP przed aktywacją. Nie merge samej polityki i nie obiecywać atomowości cache.
2. Przed merge/deploy/DB tymczasowo wstrzymać wyłącznie job fit-house-offer-refresh
   w istniejącym fit-house-offer-refresh.yml (job-level if, obecna linia76).
   Wymaga osobno zatwierdzonej małej zmiany workflow; obecnie nieprzygotowana i
   niewykonana. Nie disable całego workflow:10Reps/Gladiator i cron pozostają.
   Six job-level pause pozostaje. Poczekać na koniec writerów/queue work;
   nie kasować locków i nie uruchamiać recovery.
3. Standardowy zatwierdzony merge/deploy kompletnego pakietu. Przy starym DB nowe
   Fit/Six readers dają BLOCK przed source. Inne profile zachowują kontrakty.
   Bez retailer dispatch. Sprawdzić nowe metadata na deployment przed DB activation.
4. Świeży preflight TLS/owner/target/CURRENT261, exact affected hashes/history,
   physical fingerprints, SQL definitions/ACL, producer rows, brak aktywnych
   plans/approvals/jobs. Drift = STOP, bez zmiany oczekiwań ad hoc. Zaplanować
   okres bez writerów wszystkich retailerów na DBcommit→closeout; nie wyłączać
   cudzych harmonogramów. Istniejące ledger guards odrzucają drift.
5. Jeden zatwierdzony selected apply jedynego pending pliku:
   supabase/migrations/20261109100000_add_owner_catalogue_withdrawal_lifecycle.sql.
   SHA a9cb6d18c60dda40dbc10322e23971f929e929a4344761e8f97328677b04e29b.
   Istniejący apply-selected-migrations.js --environment=PRODUCTION
   --project-ref=aftboxmrdgyhizicfsfu --mode=apply --confirm=527587a55780f61f.
   Bez db push, osobnego UPDATE, replay i produkcyjnego rehearsal. Schema,
   3products,4variants,Fit producer scope,5SQL bindings i1ledger entry są w jednej
   transakcji applicatora z istniejącym global write lock. Timeout/błąd/nieznany
   commit = STOP i wyłącznie odczyt faktycznego stanu.
6. Post-commit readback i istniejący selected-migration-repository-closeout-v1
   receipt. Oczekiwany ledger262 i fingerprint:
   e19d8c8960651ff6f8deca27e518be222a191320234053a34a13d9223a975362.
   Tylko receipt-based techniczny closeout CURRENT/pending przez istniejący PR/merge.
   Nie ustawiać CURRENT262 przed commit. Git/DB nie są atomowe; między commit a
   closeout także inne retailery mogą blokować refresh na ledger drift.
   Nie obchodzimy tego zamkniętego okresu i nie wyłączamy innych harmonogramów.
7. Zatwierdzony operator wykonuje istniejący project-scoped Vercel cache purge
   Data+CDN na właściwym projekcie/deployment. Zweryfikować cache i origin:
   3detail bez bieżącej sprzedaży/metadata/schema,4go bez redirect/click, brak
   produktów w search/comparison/home/category/brand/deals/sitemap, saved bez
   live price; poprawny merge redirect zachowany. Sam purge lub upływ godziny
   nie zastępuje postflight. Bez tego nie wolno ogłosić publicznej aktywacji.
8. Readback4mappings/offers i5history identyczny, active504/284+historical2/2,
   full fingerprints,Fit registration/runtime/OOS,producerflags,watchdog.
   Idempotency potwierdzić read-only; nie wykonywać drugi raz SQL/source/apply.
   Przy błędzie publicznego odczytu nie reaktywować produktów jako rollback.
9. Dopiero odrębnie zatwierdzone wznowienie Fit job po pełnym postflight.
   Six nadal PAUSED. Brak zgody na commercial apply i nowy pełny dry-run.

Przed commit błąd wycofuje całą transakcję; nowe refresh blokują się na starym DB.
Po commit nie cofamy automatycznie decyzji, nie odtwarzamy historycznych approvals
ani starego kodu nierozumiejącego scope. Zachowujemy dowody i diagnozujemy read-only.

## Gotowość i wymagane upoważnienie

**DEPLOYMENT_BLOCKED** do osobnego zatwierdzenia finalnego head, standardowego
merge/deploy,Fit-only pause,dokładnej migracji/SHA/target/expected-state,canonical
receipt closeout i project-scoped cache purge/read-only postflight.
Kod jest pakietem do review. Produkcyjnej aktywacji nie wykonano; brak RESTORED.

[Dowody i hashe](evidence/OWNER-CATALOGUE-WITHDRAWAL-2026-11-09.json).
[Poprzedni audyt i konflikt decyzji](OWNER-CATALOGUE-EXCLUSION-2026-11-08.md).
