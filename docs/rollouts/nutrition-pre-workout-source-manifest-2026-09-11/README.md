# NUT-01 official-source preparation package

**Status date:** 11 September 2026

**Stage:** NUT-01 `IN PROGRESS`

**Scope:** frozen 25 canonical variants across 21 canonical products

This package is ready for the existing collector's planning gate. It does not
authorize collection. It contains no downloaded page, label, image or OCR output
and records no nutrition value. The authoritative frozen denominator remains
[`nutrition-pre-workout-pilot-scope-2026-09-11.json`](../nutrition-pre-workout-pilot-scope-2026-09-11.json).

## Contents and result

- [`variant-source-verification.json`](variant-source-verification.json) binds
  all 25 frozen variants to an official source or an explicit unresolved reason.
  All canonical IDs and counts in this package are strings.
- [`batch-01/sources.json`](batch-01/sources.json) contains 7 unique official
  product URLs in the collector's existing
  `nutrition-manufacturer-source-list-v1` format.
- [`batch-02/sources.json`](batch-02/sources.json) contains 4 unique official
  product URLs in the same format. Collection of this batch is blocked pending
  written permission from BioTech USA and 10X Athletic.
- The 11 product URLs cover 15 variants because four official pages explicitly
  list more than one selected flavour. The remaining 10 variants stay in the
  frozen denominator with `NEEDS_REVIEW`; none was replaced.

`SOURCE_BINDING_CONFIRMED` means that the current official page establishes the
selected product, flavour and package identity. It does not confirm ingredients,
nutrition values or the formula on a future downloaded label. A shared product
page applies only to the flavours that the page explicitly lists.

## Robots and terms review

Public `robots.txt` and terms pages were read only on 11 September 2026. Robots
rules did not prohibit the recorded product paths, but that does not grant content
reuse rights or satisfy the collector's owner-confirmation gate.

| Domain | robots.txt result for product path | Terms source | Collection decision |
|---|---|---|---|
| `optimumnutrition.com` | Product path not disallowed | [UK terms and conditions](https://www.optimumnutrition.com/en-gb/pages/terms-and-conditions) | `OWNER_REVIEW_REQUIRED`; no UK collection permission established |
| `appliednutrition.uk` | `/products/` allowed | [Terms and conditions](https://appliednutrition.uk/pages/terms-conditions) | `OWNER_REVIEW_REQUIRED`; sale terms do not establish collection permission |
| `bulk.com` | Product path not disallowed | [Terms and conditions](https://help.bulk.com/hc/en-gb/articles/208192485-Terms-Conditions) | `OWNER_REVIEW_REQUIRED`; sale terms do not establish collection permission |
| `shop.biotechusa.com` | `/products/` allowed | [Terms of purchase](https://shop.biotechusa.com/pages/terms-of-purchase) | `BLOCKED_WRITTEN_PERMISSION_REQUIRED`; terms prohibit download/electronic storage or processing without consent |
| `10xathletic.com` | `/products/` allowed | [Terms of service](https://www.10xathletic.com/policies/terms-of-service) | `BLOCKED_WRITTEN_PERMISSION_REQUIRED`; terms prohibit spider/crawl/scrape without written permission |

The unresolved official candidates were also checked so the remaining decisions
are explicit. Their URLs are not collector inputs until identity is resolved:

| Domain | robots.txt result for product path | Terms source | Remaining gate |
|---|---|---|---|
| `5percentnutrition.com` | Product path not disallowed | [Terms of service](https://5percentnutrition.com/policies/terms-of-service) | Owner/legal review plus 387 g version evidence |
| `shop.biotechusa.com` | `/products/` allowed | [Terms of purchase](https://shop.biotechusa.com/pages/terms-of-purchase) | Written permission plus 330 g versus 340 g version decision |
| `cnpprofessional.co.uk` | `/products/` allowed | [Terms of service](https://cnpprofessional.co.uk/policies/terms-of-service) | Written permission/legal decision plus Full Tilt V2 identity evidence |
| `cellucor.com` | `/products/` allowed | [Terms of service](https://cellucor.com/policies/terms-of-service) | Written authorization plus Millions Cola/version evidence |
| `animalpak.com` | `/products/` allowed | [Terms](https://www.animalpak.com/pages/terms) | Owner/legal review plus 491 g package evidence |
| `darkstims.com` | `/products/` allowed | [Terms of service](https://www.darkstims.com/policies/terms-of-service) | Owner/legal review plus 520 g package evidence |
| `apexformulas.co.uk` | `/products/` allowed | No terms URL found in the bounded official-site review | Locate/review applicable terms plus flavour and 625 g evidence |

No official Adapt Nutrition manufacturer page was found in the bounded public
search. Distributor listings were deliberately not substituted. The required
resolution is an official manufacturer URL or written source that establishes
PreTRAIN X, Iced Raspberry, 350 g and its formula version.

## Storage readback

An administrative, read-only `storage.listBuckets()` call against production
project `aftboxmrdgyhizicfsfu` returned `bucket_count: 0`. It used the existing
service-role credential loaded from local project configuration. There were no
writes, bucket creations, permission changes or credential changes. Therefore no
existing private bucket can be designated today. Before collection, an authorized
owner must provision the private Supabase Storage bucket already specified in the
execution ledger, including retention and access rules; this package does not do so.

## Required decisions before collection

1. Record the existing owner decision for robots/terms on each batch. Batch 02
   requires written manufacturer permission; the current evidence does not permit
   collection.
2. Provision or designate the private production Storage bucket and record its
   service-role-only access, retention and backup rules.
3. Resolve the 10 `NEEDS_REVIEW` entries without changing the frozen denominator:
   product/formula version conflicts for products `58`, `215`, `295`, `899` and
   `961`; duplicate canonical identity for `957`; package evidence for `1249` and
   `1275`; official source for `1252`; flavour/package evidence for `1283`.

Only after the applicable rights decision and storage gate may an owner run the
existing collector with its explicit approvals. This package does not mark NUT-01
complete and does not authorize NUT-02.
