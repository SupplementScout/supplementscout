# Automation Reliability — Owner Decision Pack

**Stan dowodów:** 30 sierpnia 2026, 06:20 UTC

**Źródło prawdy:** [Automation-Reliability-Roadmap.md](./Automation-Reliability-Roadmap.md)

**Zasada wykonania:** ten dokument nie jest artefaktem apply. Zatwierdzenie pozycji nadal wymaga fresh capture, niezmienionego fingerprintu, approval per row, stale-state guardu, chronionego RPC i read-only postflightu.

## Jedna tabela pozostałych decyzji

| Grupa | Decyzja | Pełny kontekst i dowód | Pewność | Rekomendacja | Dokładny wpływ zatwierdzenia |
| --- | --- | --- | --- | --- | --- |
| A | 6 Pack: rebind offer `2006`, mapping `2192` | **Nordic Labs Long Jack Tongkat Ali 60 Capsules**, Nordic Labs, Health Supplements; URL `https://6pack-supplements.co.uk/product/tongkat-ali-long-jack-60-capsules/`; external `16448:16448`, SKU `5060803380070`, GTIN brak, flavour brak, rozmiar źródłowy 60 kapsułek/porcji. Product `982`; obecny variant `1922` **Default**; proponowany istniejący variant `3126` **60 Servings**. Fresh source potwierdza tę samą stronę i rozmiar, a atomowy importer blokuje default przy aktywnym exact variant. | HIGH | APPROVE | Zmiana wyłącznie `retailer_products.product_variant_id` i `offers.product_variant_id` z `1922` na `3126` istniejącą chronioną ścieżką; bez zmiany ceny, stocku, URL lub historii. Dopiero późniejszy nowy reviewed batch może rozpatrzyć stock `true → false`. |
| A | eBay UK: rebind offer `2581`, mapping `2766` | **Time 4 Collagen+ 45 Servings**, Time 4, Health Supplements; URL `https://www.ebay.co.uk/itm/313270204105`; external product `313270204105`, variant `v1\|313270204105\|0`, GTIN brak, flavour brak, source option **45 Servings - 405g Tub**. Product `831`; obecny variant `1178` **Default**; proponowany `2920` **405g**. Exact eBay evidence i istniejący exact canonical variant zgadzają się co do 405 g. | HIGH | APPROVE | Rebind mappingu i oferty do wariantu `2920`; cena £29.99, stock, shipping, URL i `price_history` bez zmian. Odblokowuje zwykły refresh eBay bez osłabienia variant guardu. |
| A | GYM HIGH: promotion immutable binding `4623:4623` | **GYM HIGH Creatine Monohydrate 400g**, GYM HIGH, Creatine; mapping `387`, offer `554`, URL `https://gymhigh.co.uk/product/gym-high-creatine-monohydrate-400g/`; external `4623:4623`, GTIN `0691057494883`, flavour brak, 400 g. Product `529`; stary control variant `507` **Default**; live mapping i offer już wskazują variant `2973` **400g**. Audyt Store API: 26 parents/71 rows, exact 400 g, zero writes. | HIGH | APPROVE | Aktualizuje tylko immutable approval/control evidence z `507` na `2973`; nie przepisuje live mappingu ani oferty i nie zmienia pól handlowych. |
| A | KIOR: 11 identity promotions | Jedenaście pełnych wierszy w tabeli KIOR poniżej. Każdy ma stabilny product/variant, cenę i stock oraz exact Shopify product/variant ID z zatwierdzonej konfiguracji. Read-only capture `fc13a04e-fba0-49ae-9e85-0d80f3263ca5`, scope hash `71e5d7d8dc62e15c1822e86f77d35f68d5e9e2e571aabf8a50e1d7439a9f4afb`, zero commercial drift i zero writes. | HIGH | APPROVE | Uzupełnia wyłącznie external product/variant identity i potwierdza freshness przez istniejący atomic importer; canonical product/variant, ceny, stock i historia pozostają bez zmian. |
| B | Whey Okay: 10 `SOURCE_VARIANT_MISSING` | Wszystkie dotyczą **Per4m Whey Protein 2kg**, Per4m, Whey Protein, URL `https://wheyokay.com/per4m-whey-protein-2kg-24-p.asp`, source product `24`. Szczegóły flavour/GTIN/mapping w tabeli poniżej. Healthy full feed ma 523 produkty/1,705 rows, lecz dokładnie te variant IDs są nieobecne. | MEDIUM | NEEDS_MANUAL_CHECK | Wybrać jedną politykę: potwierdzona trwała delistacja może zatwierdzić OOS per row; błąd/zmiana feedu wymaga korekty source identity. Do decyzji wszystkie 10 ofert pozostaje bez zmian. |
| B | Whey Okay: legacy 284 | 284 oferty poza nowym zakresem 586; wszystkie mappingi nie mają external product i variant ID, ale audyt nie wykazał konfliktu canonical mapping/offer. Pełny kontekst nazw, URL-i, źródłowych kandydatów, flavour/size/GTIN i ryzyk jest w lokalnym audycie `tmp/retailer-feeds/whey-okay/reconciliation/whey-okay-legacy-mappings-audit.csv`; zamknięty scope hash `d44049ef4256164520fc3a777a73dcb0d6db8203b8720851dcebaa8d06a64cd5`. | MEDIUM | NEEDS_MANUAL_CHECK | Najpierw zbudować reviewed identity manifest z jednoznacznymi kandydatami; dopiero potem grouped identity promotion. Nie wolno traktować tych 284 jako freshness-only. |
| B | Discount Supplements: 137 executable + 5 review | Read-only run `33292337530`, exact old scope 142, hash `0827d1041303ddf7daff8ac757625c81e2b6cd86e1d794f9883ca70f5ad40d7a`: 95 no-change, 29 safe update, 13 OOS; trzy missing-from-source i dwa bez source IDs pozostają review. Pełne zmiany są poniżej. | MEDIUM | NEEDS_MANUAL_CHECK | Zgoda na oddzielny protected 137-row manifest potwierdzi 95 freshness rows i zastosuje 42 sklasyfikowane commercial rows (40 realnych field mutations; dwa już-OOS confirmations); pięć anomalii bez zmian. |
| B | Dolphin Fitness: 2 legacy identity promotions | Offer `8`/mapping `7`: **Ghost Legend V4 Pre-Workout 660g**, Ghost, Pre Workout, product `6`, variant `8` **Default**, URL kończy się `/440574`; external IDs i GTIN brak. Offer `9`/mapping `9`: **Optimum Nutrition Gold Standard 100% Whey 2.27kg**, Optimum Nutrition, Whey Protein, product `7`, variant `7` **Default**, URL kończy się `/16825/`; external IDs i GTIN brak. Scope hash `65dbb2164937f56c6c78c80fe7353b4d84807947cc1400065289eff681681a7d`. | MEDIUM | NEEDS_MANUAL_CHECK | Potwierdzić, czy stabilne page IDs `440574` i `16825` są właściwymi source identities i czy wariant ma pozostać Default; dopiero potem uzupełnić mapping metadata bez zmian ceny/stocku/historii. |
| B | KIOR autonomous apply scope | Proponowany zakres: wyłącznie 11 zatwierdzonych mappingów z tabeli poniżej, bez creates. Guardy: exact config SHA, 11/11 source identities, kompletna paginacja, source ratio, price/stock/URL/identity drift, per-row approval, mass-price/OOS, stale-state, atomic apply, DB postflight i idempotency. Cron: raz dziennie po owner-approved identity promotion. | MEDIUM | NEEDS_MANUAL_CHECK | Doda jeden istniejący scheduled producer dla zamkniętych 11 rows; nie daje prawa do nowych produktów/wariantów ani rozszerzenia katalogu. Ryzyko: mały Shopify scope może zniknąć lub zmienić handle — wtedy global fail-closed. |
| B | Predators Gear autonomous apply scope | Proponowany zakres: istniejące 47 mappings/offers, bez creates i bez nowych identity decisions; source reader musi najpierw produkować kompletny snapshot i exact manifest. Guardy jak wyżej plus istniejące Predators reviewed exclusions, source-page/variation identity, no-SARMs/peptides policy i zero shipping contract. | MEDIUM | NEEDS_MANUAL_CHECK | Po osobnej implementacji i dry-runie pozwala codziennie potwierdzać tylko zatwierdzone 47 rows. Ryzyko: obecnie brak jednego zarejestrowanego end-to-end workflow i dowodu bounded retry, więc approval dotyczy zakresu projektu, nie natychmiastowego apply. |
| B | Dashboard workflow/review/cron | Minimalny projekt: czytać istniejący DB control ledger jako wspólne źródło parent/child planów, statusów, executed/executable/review/blocked i ostatniego DB postflightu; watchdog nadal dopina GitHub run URL. Bez nowej tabeli i bez drugiego checkpoint systemu. | MEDIUM | NEEDS_MANUAL_CHECK | Jedna read-only projekcja/RPC dla `/admin/catalog-health`; żadnych uprawnień zapisu z aplikacji. Wymaga osobnej decyzji o zakresie pól i retencji, potem testów kontraktowych. |
| C | 6 Pack: osobny batch 13 z pominięciem `2006` w obecnym mechanizmie | Obecny reviewed builder bierze wszystkie `review_rows` z zamkniętego fresh reportu; nie ma zatwierdzonego selektora wykluczającego jeden wiersz. | HIGH | REJECT | Nie tworzyć bypassu. Trzynaście zmian pozostaje bez wykonania do czasu rebindu `2006` i nowego pełnego reviewed capture/batchu. |

## Szczegóły pozycji grupy A

### KIOR — 11 exact identity promotions

W każdym wierszu proponowany canonical variant jest taki sam jak obecny; zmieniają się wyłącznie brakujące external IDs. `60 Capsules`/`Powder` jest dowodem źródłowym, nie żądaniem utworzenia nowego wariantu.

| Offer / mapping | Produkt; brand; kategoria | Obecny i proponowany variant | Shopify product / variant; GTIN | URL; flavour/size | Różnica i wpływ |
| --- | --- | --- | --- | --- | --- |
| `678` / `670` | KIOR Health Astragalus+ 60 Caps; KIOR Health; Health Supplements | `422` Default → `422` Default | `6717613539421` / `39821206192221`; `0-754590-525916` | `https://kior.uk/products/astragalus?variant=39821206192221`; 60 capsules | external IDs null → exact IDs; commercial state unchanged |
| `679` / `671` | KIOR Health Green Tea+ 60 Caps; KIOR Health; Health Supplements | `424` Default → `424` Default | `6825718546525` / `40172613533789`; brak | `https://kior.uk/products/green-tea?variant=40172613533789`; 60 capsules | jw. |
| `680` / `672` | KIOR Health Super Beets 60 Caps; KIOR Health; Health Supplements | `418` Default → `418` Default | `6717636903005` / `39821296009309`; brak | `https://kior.uk/products/super-beets?variant=39821296009309`; 60 capsules | jw. |
| `681` / `673` | KIOR Health Clear Mind+ 60 Caps; KIOR Health; Health Supplements | `416` Default → `416` Default | `6717637328989` / `39821296992349`; brak | `https://kior.uk/products/clear-mind-clear-focus?variant=39821296992349`; 60 capsules | jw. |
| `682` / `674` | KIOR Health Brain Wave 60 Caps; KIOR Health; Health Supplements | `415` Default → `415` Default | `6825707929693` / `40172596068445`; brak | `https://kior.uk/products/brain-wave?variant=40172596068445`; 60 capsules | jw. |
| `683` / `675` | KIOR Health Collagen Probio 60 Caps; KIOR Health; Health Supplements | `414` Default → `414` Default | `6758522355805` / `39962446921821`; `0-754590-525954` | `https://kior.uk/products/collagen-probio?variant=39962446921821`; 60 capsules | jw. |
| `684` / `676` | KIOR Health Turmeric & Ginger 60 Caps; KIOR Health; Health Supplements | `413` Default → `413` Default | `6758548078685` / `39962495746141`; brak | `https://kior.uk/products/tumeric-ginger?variant=39962495746141`; 60 capsules | jw. |
| `685` / `677` | KIOR Health KSM-66 Ashwaganda+ 60 Caps; KIOR Health; Health Supplements | `419` Default → `419` Default | `6766403551325` / `39984169058397`; brak | `https://kior.uk/products/ksm-66-ashwaganda?variant=39984169058397`; 60 capsules | jw. |
| `686` / `678` | KIOR Health Collagen Glow; KIOR Health; Health Supplements | `427` Default → `427` Default | `7067692138589` / `40939513741405`; brak | `https://kior.uk/products/collagen-yellow?variant=40939513741405`; Powder | jw. |
| `687` / `679` | KIOR Health Collagen Super; KIOR Health; Health Supplements | `492` Default → `492` Default | `7067692531805` / `40939514232925`; brak | `https://kior.uk/products/collagen-blue?variant=40939514232925`; Powder | jw. |
| `688` / `680` | KIOR Health Digestive Enzyme+; KIOR Health; Health Supplements | `457` Default → `457` Default | `6758526025821` / `39962452426845`; brak | `https://kior.uk/products/digestive-enzyme?variant=39962452426845`; 60 capsules | jw.; zachowuje obecny OOS |

## Szczegóły pozycji wymagających sprawdzenia

### Whey Okay — dziesięć nieobecnych source variants

Każdy wiersz pozostaje na obecnym canonical variant; „proponowany variant” jest celowo `brak`, ponieważ problemem jest nieobecność source identity, a nie znaleziony bezpieczny rebind.

| Offer / mapping | Obecny variant (pełna nazwa) | External variant; GTIN; flavour | Rekomendacja / dokładny wpływ |
| --- | --- | --- | --- |
| `16` / `12` | `1003` Strawberry Cream / 2kg | `25`; `5060660080021`; Strawberry Cream | MANUAL: sprawdzić delistację; bez decyzji zero zmian |
| `1506` / `1692` | `1117` Double Chocolate / 2kg | `27`; `5060660080007`; Double Chocolate | jw. |
| `1507` / `1693` | `1110` Chocolate Peanut Butter / 2kg | `29`; `5060660080069`; Chocolate Peanut Butter | jw. |
| `1508` / `1694` | `1102` Blueberry Muffin / 2kg | `1498`; `5060660080342`; Blueberry Muffin | jw. |
| `1509` / `1695` | `1114` Cinnamon Donut / 2kg | `1499`; `5060660080328`; Cinnamon Donut | jw. |
| `1510` / `1696` | `1121` Lemon Cheesecake / 2kg | `1500`; `5060660080083`; Lemon Cheesecake | jw. |
| `1511` / `1697` | `1126` Salted Caramel / 2kg | `1501`; `5060660080106`; Salted Caramel | jw. |
| `1512` / `1698` | `1129` White Chocolate / 2kg | `1502`; `5060660080366`; White Chocolate | jw. |
| `1568` / `1754` | `1100` Banana Cream / 2kg | `26`; `5060660080144`; Banana Cream | jw.; oferta już OOS |
| `1584` / `1770` | `1578` White Chocolate Raspberry / 2kg | `1503`; `5060660080120`; White Chocolate Raspberry | jw. |

### Discount Supplements — pełne zmiany handlowe

Exact 42 sklasyfikowane commercial rows obejmują 40 realnych zmian pól oraz dwa już-OOS confirmations. Shipping, URL, mapping i identity delta wynoszą zero. Price changes = 22; stock changes = 20.

| Delta | Oferty i pełny kontekst wariantu |
| --- | --- |
| £44.99 → £49.99; stock bez zmian | Applied Nutrition Critical Whey 2kg: `848` Banana, `849` Banana Strawberry, `850` Caramel Latte, `851` Choco Hazelnut, `853` Cookies & Cream, `854` Frappuccino, `855` Salted Caramel, `856` Strawberry, `857` Vanilla, `858` Vanilla Matcha, `859` White Choco Hazelnut, `860` White Chocolate Pistachio — wszystkie 2kg |
| £44.99 → £49.99; stock false → true | `852` Applied Nutrition Critical Whey 2kg — Chocolate / 2kg |
| £69.99 → £74.99; stock bez zmian | Applied Nutrition ISO-XP 1.8kg: `768` Chocolate, `769` Strawberry, `770` Vanilla |
| £69.99 → £74.99; stock true → false | `767` Applied Nutrition ISO-XP 1.8kg — Banana |
| £42.99 → £44.99; stock bez zmian | Applied Nutrition Critical Mass Gainer 6kg: `817` Banana, `818` Chocolate, `819` Strawberry, `820` Vanilla, `821` White Chocolate Bueno |
| stock false → true | `773` Applied Nutrition Pump 375g Rainbow Unicorn; `872` CNP Loaded EAA 300g Pink Lemonade; `878`/`879`/`881`/`886` XL Nutrition XTRA Whey 2kg Chocolate/Chocolate Bueno/Coconut Cream/Vanilla; `891`/`893` DY Nutrition Shadowhey 2kg Cookies & Cream/Vanilla |
| stock true → false | `835` ON Gold Standard BCAA 266g Peach & Passionfruit; `838` BSN NO-Xplode 390g Green Burst; `865` Efectiv Whey Isolate 2kg Chocolate; `870` CNP Loaded EAA 300g Cherry Cola Bottles; `823`–`826` USN Muscle Fuel Anabolic 4kg Chocolate/Cookies & Cream/Strawberry/Vanilla; `899`/`901` Applied Nutrition Beef Mass Gainer 3.13kg Blackcurrant Millions/Frozen Berries |
| już OOS, bez field delta | `822` USN Muscle Fuel Anabolic 4kg Banana; `1502` Trained By JP EAA + Hydration 300g Sour Watermelon |

Anomalie pozostające bez zmian:

| Offer / mapping | Produkt i source identity | Powód |
| --- | --- | --- |
| `871` / `1057` | CNP Loaded EAA 300g; `6080779157700:42327028400324`; URL z tym wariantem | exact external variant absent from complete source snapshot |
| `873` / `1059` | CNP Loaded EAA 300g; `6080779157700:40636760162500` | jw. |
| `875` / `1061` | CNP Loaded EAA 300g; `6080779157700:42327028433092` | jw. |
| `10` / `10` | pełna nazwa/source candidate nieustalone | mapping nie ma external product ani variant ID |
| `764` / `950` | pełna nazwa/source candidate nieustalone | mapping nie ma external product ani variant ID |

## Skonsolidowana zgoda dla grupy A

Skopiowanie poniższego tekstu wyraża zgodę na przygotowanie chronionych artefaktów, nie na pominięcie fresh preflightu ani guardów:

```text
Zatwierdzam wszystkie pozycje grupy A z docs/Automation-Reliability-Owner-Decisions.md w stanie z 2026-08-30: rebind 6 Pack offer 2006/mapping 2192 z variant 1922 do existing variant 3126; rebind eBay offer 2581/mapping 2766 z variant 1178 do existing variant 2920; aktualizację wyłącznie immutable GYM HIGH control binding 4623:4623 z variant 507 do już-live variant 2973; oraz exact 11 KIOR external identity promotions z tabeli. Każda operacja musi mieć fresh capture, exact fingerprint, approval per row, stale-state protection, istniejący atomic apply i read-only postflight. Nie zatwierdzam innych zmian handlowych, nowych produktów/wariantów ani pozycji grup B/C.
```
