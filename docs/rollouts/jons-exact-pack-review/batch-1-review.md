# Jon's exact-pack review — Batch 1

Status: `REVIEWED_NOT_AUTHORIZED_FOR_APPLY`

This is a read-only owner review sheet for ten exact Jon's offer identities. It
does not approve or apply any catalogue change. The bound machine-readable
evidence is in `batch-1-evidence.json`; its file SHA-256 is recorded below after
validation.

## Review rules

- Review the exact Jon's URL, not only the canonical product name.
- Approve only when the page represents one commercial pack and the displayed
  size matches the candidate.
- Do not infer `pack_count = 1` from a default Shopify variant or a singular
  product title.
- Manufacturer/product-level values are corroboration only until the exact
  retailer identity is confirmed.
- `Approve`, `Reject` and `Defer` decisions will be stored later in a separate
  immutable decision artifact. This evidence file remains unchanged.

## Rows

| # | Offer / mapping / product / variant | Candidate | Evidence summary | Recommendation | Decision |
|---:|---|---|---|---|---|
| 1 | `992 / 1178 / 786 / 1070` | `1 × 30 servings` | [Jon's page](https://jonssupplements.co.uk/products/per4m-mult-vita-min-multivitamins-30-capsules?variant=53896427798866): SKU `PFMMULT010`, 30 servings; same GTIN is pack 1 in reviewed eBay evidence | Review | **Approved** |
| 2 | `1066 / 1252 / 791 / 1138` | `1 × 30 servings` | [Jon's page](https://jonssupplements.co.uk/products/per4m-creatine-capsules-30-servings?variant=53899052319058): SKU `PFCREACAP0`, 90 capsules/30 servings; approved manufacturer facts | Review | **Approved** |
| 3 | `1071 / 1257 / 796 / 1143` | `1 × 60 servings` | [Jon's page](https://jonssupplements.co.uk/products/per4m-advanced-curcumin-60-capsules?variant=53898992058706): SKU `PFCURCAP00`, body explicitly states 60 servings | Review | **Approved** |
| 4 | `1074 / 1260 / 799 / 1146` | `1 × 90 servings` | [Jon's page](https://jonssupplements.co.uk/products/per4m-advanced-omega-3-90-softgels?variant=53896520597842): SKU `PFOMEGA002`, 90 softgels/90 servings, one per day | Review | **Approved** |
| 5 | `1463 / 1649 / 927 / 1535` | `1 × 375 g` | [Jon's page](https://jonssupplements.co.uk/products/per4m-relax-hot-chocolate-stress-support-375g?variant=52637027303762): SKU `PFM20001`, structured 375g, 25 servings per tub | Review | **Approved** |
| 6 | `1024 / 1210 / 86 / 23` | `1 × 60 servings` | [Jon's page](https://jonssupplements.co.uk/products/time-4-creatine-blend-240-capsules?variant=50613569028434): manufacturer facts say 60; Jon's says 240 capsules and 8/day but no explicit serving count | Warning retained; owner resolved | **Approved** |
| 7 | `1067 / 1253 / 792 / 1139` | `1 × 80 servings` | [Jon's page](https://jonssupplements.co.uk/products/strom-sports-creatine-hcl-80-servings?variant=51000436326738): SKU `STM45001`, one tub/80 servings; approved manufacturer facts | Review | **Approved** |
| 8 | `1068 / 1254 / 793 / 1140` | `1 × 1000 g` | [Jon's page](https://jonssupplements.co.uk/products/conteh-sports-creatine-monohydrate-1kg?variant=53951719768402): SKU `CYH091002`, structured 1000g/200 servings; approved manufacturer facts | Review | **Approved** |
| 9 | `1185 / 1371 / 852 / 1257` | `1 × 500 g` | [Jon's page](https://jonssupplements.co.uk/products/trained-by-jp-creatine-monohydrate-500g?variant=53633148485970): structured 500g and 100 servings per tub; no SKU/GTIN | Reviewed without SKU/GTIN | **Approved** |
| 10 | `1190 / 1376 / 857 / 1262` | `1 × 250 g` | [Jon's page](https://jonssupplements.co.uk/products/ehp-labs-crea-8-creatine-monohydrate-50-servings?variant=52718590263634): structured 250g and 50 servings; no SKU/GTIN | Reviewed without SKU/GTIN | **Approved** |

## Recorded decision

The owner answered `TAK` for all ten exact offer questions. The decisions are
stored separately in `batch-1-decisions.json`, bound to the unchanged evidence
file hash. The warning for offer `1024` remains visible and was explicitly
resolved by the owner's answer. These decisions do not authorise a production
write, migration, backfill or workflow run.

## Evidence integrity

- Fresh source captured: `2026-08-25T14:21:10.740Z`
- Source semantic fingerprint:
  `a1a05e85acf2af80e5eacb9bd446134b1f54320a0bab2cd8dcd47556eb55bc6c`
- Evidence file SHA-256:
  `7e6fff71972a922dfe3471d952d9634f0f2afba6129fe24f0f56521f86d10934`
- Decision file SHA-256:
  `2abfad9eea3928dc83eb5edc98b3b403940d25121e22716cc34b2d2cbff6d90d`
