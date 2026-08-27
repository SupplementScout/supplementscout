# Predators Gear first live import closeout - 27 August 2026

Predators Gear is live as retailer `13` with seven offers (`2776` to `2782`). All offers use `shipping_cost=0` and target existing catalogue identities only:

- offer `2776`: product `1`, variant `2965`
- offer `2777`: product `412`, variant `2969`
- offer `2778`: product `510`, variant `1068`
- offer `2779`: product `510`, variant `1971`
- offer `2780`: product `414`, variant `2741`
- offer `2781`: product `411`, variant `1047`
- offer `2782`: product `1067`, variant `2250`

The import created zero products and zero variants. Product and variant fields remained unchanged. The Whey Pro Synergy Dynamic rows #6 and #7 are confirmed against product `510`; old/non-Dynamic product `337` has no Predators Gear offer.

Production QA passed for offer identity, price, free shipping, delivered total, stock, source URL, product-page visibility and price history. Live `/go` bot QA returned the expected protected response for every offer without creating click rows.

Any next Predators Gear batch must use a fresh canonical CSV and fresh dry-run artifact. Mass Gainer rows #3 to #5 remain excluded until flavour-alias and GTIN confirmation is complete.
