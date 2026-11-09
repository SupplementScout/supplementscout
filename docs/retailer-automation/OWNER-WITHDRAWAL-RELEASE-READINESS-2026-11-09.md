# PR #510 — końcowa gotowość wydania, 9 listopada 2026

Status: **TECHNICALLY_READY_FOR_OWNER_AUTHORIZATION**, pod warunkiem zielonych
kontroli osobnego PR pauzy i kontroli końcowego drzewa scalenia. Produkcja jest
**NOT_AUTHORIZED / NOT_APPLIED**. Nie wykonano merge, migration apply, cache purge,
retailer dispatch, odzyskiwania planów ani zmian harmonogramów. Six Pack nadal PAUSED.
To dowód bieżącej czynności release readiness w istniejącym programie RA-001.

## Zatwierdzony zakres i finalne review

PR510 pozostaje DRAFT, branch fix/owner-catalogue-exclusion, head
3a1a98cda305a265d48d60e918fc891f15efcce1. Main podczas przeglądu:
1dce913d28fb727bac9989b49a470cb7ad4bf4af. PR510 nie zmieniono w tym zadaniu.
[Przeglądany pakiet](https://github.com/SupplementScout/supplementscout/pull/510).

EXCLUDE:951/1853 — Fit mapping2082/offer1896 i Six2170/1984;999/1960 — Fit2151/1965.
DEFER:1114/2414,2415 — Six2582/2396;2414 nie ma oferty. Zakres zachowuje3 produkty,
4 warianty,4 mappingi,4 oferty i5 całych price_history. Wspólny1853 obejmuje oba sklepy.

Przegląd constraintu i triggerów nie wykazał nowej luki bezpieczeństwa:
- is_active jest NOT NULL; CHECK rozdziela ACTIVE/MERGED od obu owner withdrawals,
  wymagając niepustego powodu/czasu i wykluczając fikcyjny merge.
- session_user w guardzie lifecycle chroni również przy SECURITY DEFINER.
  Triggery descendants blokują stare zatwierdzone zapisy; deferred constraint
  zabrania aktywnego wariantu pod wycofanym rodzicem. Nie dodano grantów executora.
- pięć patchy SQL jest związanych z dokładnym starym/nowym MD5 i liczbą kotwic.
  CREATE OR REPLACE zachowuje owner/ACL/proconfig; migracja weryfikuje tę zgodność.
- Fit stable-OOS pozostawia baseline104 i niezależne limity. Dodaje wyłącznie
  już istniejące durable executed/stock/fingerprint/postflight/idempotency proofs.
- postflight weryfikuje active i całe historical rows/history; idempotency activation
  jest sprawdzone w izolowanym PostgreSQL. Nie zalecamy ponowienia migracji.

Nie dodano drugiego executora, classifiera, Review Queue, registry ani recovery.
Istnieje natomiast niezależny scheduled **Automation Review Queue Worker**.
To drugi punkt wejścia do tego samego istniejącego executora, nie nowa ścieżka
wprowadzona przez510. Pauza source job nie unieważnia wcześniej QUEUED żądań.
Dlatego pusty inventory Fit QUEUED/DISPATCHED/EXECUTING/aktywnych approvals i brak
aktywnego workflow są obowiązkową bramką rollout. Nie wolno deklarować globalnej
blokady wszystkich zapisów wyłącznie na podstawie if joba. Nie zmieniamy workera,
nie anulujemy jego żądań ani nie zatrzymujemy pozostałych retailerów.

## Osobny minimalny PR pauzy

Zmiana wykonywalna to wyłącznie prefix github.event_name != 'schedule' w
istniejącym job-level if fit-house-offer-refresh i dwa komentarze z warunkiem
usunięcia blokady. Oryginalny routing pod spodem pozostaje; scheduled branch staje
się nieosiągalny dla tego jednego joba. Brak zmiany cron, executora, sekretów,
control recovery, 10 Reps i Gladiator.

Ręczny workflow_dispatch dry-run Fit pozostaje dostępny na main. Sama dostępność
ręcznego apply nie jest jego autoryzacją; nie uruchomiono żadnego dispatchu retailera.
Manual validation_context nie może służyć jako obejście release preflight.

Siedem regresji dopisano do istniejącego pliku wspólnych kontraktów workflow
scripts/gladiator-nutrition-offer-refresh.test.js, bez nowego runtime ani pliku testu.
Sprawdzają macierz schedule/manual/ref/retailer, oba inne cron, read-only control
inspection i recovery, brak Fit queue publication bez outputs oraz hash całego
workflow po zdjęciu dokładnie tej pauzy. Istniejący worker z pustą QUEUED inventory
ma zero writes; test jawnie zachowuje tę osobną przesłankę zamiast udawać globalny pause.
Inventory pozostaje355 z dotychczasowym hashem; ten istniejący plik włączono do
quick (54 pliki). Focused21 PASS/0 FAIL/0 SKIP; quick1041 PASS/0 FAIL/3 wcześniejsze
SKIP; full3676 PASS/0 FAIL/3 wcześniejsze SKIP. TypeScript/lint/build/Guardian/baseline PASS.

## Testy nowych i historycznych zakresów

W510 stare testy506/286 jawnie zamrażają historyczne kontrakty. Node test runner
uruchamia pliki w osobnych procesach; lokalne require.cache i mutacje config nie
przechodzą do innego pliku. Test PostgreSQL owner withdrawal nie importuje tych
historycznych testów i sprawdza nowe manifesty504+2 i284+2, zachowanie historii,
SQL, stale RPC, postflight, rollback i idempotency.

Dodatkowo świeży proces Node przy09:37:55 UTC wczytał rzeczywiste moduły i pliki510,
bez preload, config override i przypisania require.cache: Six504/physical506,
Fit284/physical286, historical2/2, guard required284 i policy
bd01649903badb820d3595ea5c9776311370c2c97341783078e39d64e867c5da.
Oba manifest SHA i selected migration unwrap są zgodne. Nie wywołano source ani DB.

CI510 na zatwierdzonym head:full42587580429 —3681 PASS/0 FAIL/3 wcześniejsze SKIP;
Guardian42587580403 PASS. Osobny rzeczywiście wykonany integration42587631196,
job129061163481 —169 PASS/0 FAIL/0 SKIP, w tym lifecycle20 PASS w prawdziwym PG.
Pominięty companion job w zwykłym PR CI nie jest zaliczeniem integracji.

Sprawdzono zwykłe scalenie trójstronne rzeczywistych Git blobs obu zmian, bez
zapisu do gałęzi: zero konfliktów; inventory356,quick54,integration57. Dwa wspólnie
zmienione pliki łączą się automatycznie; nie trzeba osłabiać seals ani usuwać testu.
Połączone drzewo: focused40 PASS/0 FAIL/0 SKIP i inventory PASS.
Końcowe wyniki lokalnych bramek i CI pauzy oraz testów połączonego drzewa są
w receipt osobnego PR. Nie zaliczamy ich do nieistniejącego jeszcze produkcyjnego SHA.

## Vercel — capability potwierdzone bez purge

Projekt:prj_nvEdQJHTuwd1QA2KhLCshs7a9p7c, nazwa supplementscout.
Team:team_1RQu0vdcBjVpCZcW3JqGdZcz, scope supplement-scout.
Istniejący operator CLI supplementscout ma potwierdzone członkostwo OWNER.
Istniejąca sesja CLI została odświeżona przez whoami; tokenów nie kopiowano do repo
ani nie ujawniono. Nie zmieniono konfiguracji projektu ani uprawnień.

Produkcja:dpl_4St5nSmFrm6HxULdPbyCsvHzQnXe, READY, target production,
supplementscout-m2zkg82v5-supplement-scout.vercel.app, commit main1dce913d… .
Z API projektu potwierdzono domeny www.supplementscout.co.uk i supplementscout.co.uk.
Odczyt publiczny trzech canonical product URLs zwrócił200, bez wywołań /go.
Postflight HTTPS jest dostępny; komercyjne dane nadal nie są wycofane.

Oficjalny istniejący CLI65.9.0, cache purge --help, potwierdza typy data/cdn/all
oraz jawne --project. Po osobnej zgodzie operator użyje:

    vercel cache purge --project prj_nvEdQJHTuwd1QA2KhLCshs7a9p7c --scope supplement-scout --type all --yes

To nie jest komenda wykonana w tym zadaniu. Potwierdzono rolę i dostęp, nie wynik
purge. [Oficjalna metoda](https://vercel.com/docs/cli/cache),
[uprawnienia ról](https://vercel.com/docs/rbac/access-roles/team-level-roles).
Nie ma potrzeby nowego endpointu ani rozszerzenia uprawnień operatora.

## Selected migration — gotowa do osobnego zatwierdzenia

Plik:20261109100000_add_owner_catalogue_withdrawal_lifecycle.sql.
SHA:a9cb6d18c60dda40dbc10322e23971f929e929a4344761e8f97328677b04e29b.
Target:aftboxmrdgyhizicfsfu. Canonical pending w przygotowanym kodzie510 zawiera
wyłącznie ten plik; produkcyjny main nie ma jeszcze tej pending migracji.
Existing unwrapTransaction przyjmuje dokładne bajty; nie uruchomiono applicatora.

Świeży DB snapshot09:36:37 UTC:verified TLS/target/owner, REPEATABLE READ READ ONLY,
ledger261 / CURRENT755319fa4f9636e50cf8606e7a0b143945aa8bdd92c2183681e5285aecb4660a;
wszystkie affected hashes i5history identyczne z poprzednim poprawnym odczytem.
Pięć istniejących definicji ma dokładne oczekiwane stare MD5, owner postgres i
zachowane restrykcyjne ACL. Fit queued inventory0; affected pending approvals0.
DB nadal nie ma nowych pól/triggerów withdrawal — zgodnie z zakazem wdrożenia.

Applicator rozpoczyna jedną transakcję, waliduje target/owner/ledger i serializuje
selected migrations. SQL body bierze istniejący global retailer write lock.
Schema,3products,4variants,Fit producer scope,5SQL definitions i wpis ledger
commitują razem. Expected-state/dependency/ACL/definition/postflight drift albo
błąd przed COMMIT wycofuje całość, w tym DDL i ledger. Połączenie utracone podczas
COMMIT oznacza UNKNOWN_OUTCOME: STOP i tylko readback; brak replay/recovery.
Po commit receipt closeout dotyczy262 i fingerprint:
e19d8c8960651ff6f8deca27e518be222a191320234053a34a13d9223a975362.

## Dokładna kolejność po osobnej zgodzie właściciela

1. Standardowo scalić osobny PR Fit-only pause po CI. Potwierdzić jego obecność
   na main i brak nowego scheduled Fit job; nie dispatchować retailera. Zaczekać
   na koniec aktywnych writerów i sprawdzić również istniejący Review Queue worker.
   Nie cancelować/close/replay żądań. Przy pending inventory STOP.
2. Ponownie sprawdzić head510 i nowy main, zwykłe końcowe drzewo scalenia i wymagane
   CI. Jeżeli ochrona wymaga standardowego uaktualnienia bazy, zachować zatwierdzony
   runtime i sprawdzić nowe SHA/CI; bez bypass. Scalić510 dopiero w zatwierdzonym scope.
3. Poczekać na production deployment i zweryfikować READY, SHA, projekt i aliasy.
   Kod publiczny rozumie inactive unmerged przed aktywacją DB. Nowe Fit/Six scope
   przy starym DB fail closed przed source. Six pozostaje paused.
4. Bezpośrednio przed DB fresh preflight TLS/owner/target/CURRENT261, affected rows,
   history, SQL/ACL, physical fingerprints, producer scope, plans/approvals/queued
   requests, aktywne GitHub jobs i write locks. Nie dopuszczać nowych ręcznych
   approvals/apply w oknie. Drift lub kolizja = STOP, bez aktualizacji hashy ad hoc.
   Zaplanować DBcommit→closeout w oknie bez innych writerów; nie wyłączać ich cron.
5. Jeden existing selected apply z dokładnym SHA wyżej, project-ref aftboxmrdgyhizicfsfu,
   --environment=PRODUCTION --mode=apply --confirm=527587a55780f61f.
   Bez db push, rehearsal na produkcji, dodatkowego SQL ani ponowienia.
6. Zweryfikować commit/262, zachować wygenerowany selected-migration-repository-closeout-v1
   receipt. Przeprowadzić wyłącznie canonical receipt closeout pending/CURRENT przez
   standardowy techniczny PR/merge. Nie ustawiać262 przed DB commit. Między commit
   i closeout także inne guarded refresh mogą blokować się na ledger drift;
   nie obchodzimy guardów. Closeout może spowodować następny automatyczny deploy:
   przed purge ponownie potwierdzić finalny production deployment/SHA i READY.
7. Wykonać wyłącznie zatwierdzony purge all Data+CDN właściwego projektu poleceniem
   wyżej i zachować rezultat. Nie zmieniać konfiguracji cache/protection.
8. Public postflight z origin/cache:3detail bez live ofert/metadata/schema,
   search/comparison/home/categories/brands/deals/sitemap bez tych produktów,
   saved bez bieżącej ceny i prawidłowe merged redirect. /go sprawdzać dopiero po
   DB potwierdzającym inactive:4oferty bez redirect i nowych clicks. Sam purge
   ani upływ bucket3600s nie wystarcza do ogłoszenia publicznej aktywacji.
9. Database postflight:3produkty/4warianty inactive z owner reason/time;4mappingi,
   4oferty i5history identyczne;504+2/284+2/full fingerprints,Fit producer scope284
   i dotychczasowe flags,Six disabled,5SQL seals/OOS/ledger262/watchdog.
10. Idempotency read-only: zgodność tego samego expected after-state/historii i
    brak dodatkowych zapisów. Bez ponawiania SQL/source/apply. Fit nie wznawia się
    automatycznie; zdjęcie pauzy wymaga odrębnej zgody po postflight. Six nadal PAUSED.

Git/DB/Vercel/cache nie tworzą jednej transakcji. Publiczny snapshot może pozostać
stary pomiędzy commit a purge; przed końcowym public postflight nie ogłaszamy withdrawal.
Nie cofamy owner decision ani nie przywracamy starego scope w automatycznym rollback.

## Decyzja do przekazania właścicielowi

Można przedstawić bounded prośbę o zgodę po zielonym CI osobnego PR: dwa standardowe
merge/deploy, jeden dokładny selected migration, canonical receipt closeout,
project-scoped purge i read-only public/database/idempotency postflight, przy wszystkich
opisanych STOP gates. Nie obejmuje to commercial apply, retailer dry-run, recovery
ani wznowienia Fit/Six. Bieżące upoważnienie nadal nie pozwala wykonać żadnego z tych
kroków produkcyjnych. Żadna luka bezpieczeństwa nie jest świadomie akceptowana.
