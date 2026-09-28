# RA-004 consolidated staging attempt closeout

Status: `BLOCKED_PLATFORM_LIMITATION`.

Activation `ra004-staging-1790580130471` consumed the single authorized
attempt. The exact consolidated migration applied successfully, advancing the
staging ledger from 96 to 97 rows. The post-migration business-row equality
guard passed, so no product, variant, retailer-product, offer or price-history
count changed during migration.

The only preflight attempt stopped on
`RA004_PREFLIGHT_LEDGER_UNKNOWN: count or fingerprint mismatch`. The bounded
runtime supplied the verified 97-row selector fingerprint, while the newly
installed PostgreSQL RPC derived a different fingerprint for the same ledger.
Q1-Q8 therefore did not complete, and the gated canary was not started. This is
the terminal platform/contract blocker; no retry or implementation patch is
authorized in this closeout.

The evidence-store session and 30-minute window closed. The automatic revoke
reported a separate cleanup failure without hiding the primary failure. One
bounded cleanup action then disabled and removed the exact temporary preflight
role and verified that both the role and every membership were absent. No
canary credential was created. The staging activation is terminal and
non-replayable, the ordinary staging selector records the migration as already
applied, and the production selector remains closed and unchanged.
