# Gladiator Nutrition — handoff przygotowania

Status: `PREPARATION_ONLY`. Ten dokument ani powiązany manifest nie zezwalają na zapis do bazy, approval ani apply.

## Ukończone dzisiaj

- Źródło Shopify zostało odczytane neutralnym shared readerem i zamrożone fingerprintem.
- Do danych dołączono zatwierdzone przez właściciela decyzje dla 20 rodzin i 194 wariantów.
- Przygotowano mapping source-side dla 19 rodzin i 187 wariantów; cała rodzina MVPRE pozostaje odseparowana.
- Stage 1 ma 26 wierszy: 18 anchorów nowych rodzin oraz 8 wariantów Applied Nutrition Clear Whey.
- Stage 2 ma 161 wariantów sibling i wymaga readbacku po Stage 1.
- Bezpośrednie URL-e, affiliate URL-e, ceny, stock i koszt wysyłki zostały przygotowane zgodnie z aktualną polityką sklepu.

## Wymagane jutro — dokładna kolejność

1. Zweryfikować naturalne harmonogramy retailerów i status recovery.
2. Zastosować na **STAGING wyłącznie** migrację `20261017130000_add_reviewed_catalogue_bounded_state.sql`.
3. Zweryfikować ACL, bezpieczeństwo i read-only contract bounded-state RPC.
4. Wykonać świeży odczyt źródła Gladiator przez istniejący neutralny Shopify reader.
5. Udowodnić, że source identity odpowiada dzisiejszemu zamrożonemu przygotowaniu.
6. Wykonać oficjalny reviewed-catalogue V2 target readback dla staging.
7. Wygenerować oficjalny atomic dry-run dla dokładnie 26 wierszy Stage 1.
8. Przekazać właścicielowi finalne executable deltas do przeglądu.
9. Dopiero po osobnej, jawnej zgodzie zatwierdzić i wykonać Stage 1.
10. Wykonać świeży database readback po Stage 1.
11. Na podstawie tego readbacku zbudować Stage 2 dla 161 sibling variants.
12. Uzyskać osobną zgodę właściciela przed jakimkolwiek Stage 2 apply.
13. Pozostawić całą rodzinę MVPRE poza zakresem jako `STAGING_CANONICAL_PARITY_BLOCKED`.

Trwały manifest danych: `config/retailers/gladiator-nutrition-reviewed-preparation-v1.json`.
