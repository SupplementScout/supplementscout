# NUT-01 official-source preparation package

**Status date:** 11 September 2026

**Stage:** NUT-01 `LIVE VERIFIED` with explicit gaps

**Scope:** frozen 25 canonical variants across 21 canonical products

This package passed the existing collector's planning gate. The collector has not
downloaded any page or image. A later owner handoff supplied four Applied Nutrition
label images; they are retained only in the private archive and represented here
by a hash/source review report. No OCR output or nutrition value is recorded. The
authoritative frozen denominator remains
[`nutrition-pre-workout-pilot-scope-2026-09-11.json`](../nutrition-pre-workout-pilot-scope-2026-09-11.json).

## Contents and result

- [`variant-source-verification.json`](variant-source-verification.json) binds
  all 25 frozen variants to an official source or an explicit unresolved reason.
  All canonical IDs and counts in this package are strings.
- [`nut-01-closeout-2026-09-11.json`](nut-01-closeout-2026-09-11.json) gives all
  25 variants a final NUT-01 label/source disposition, concrete missing reason
  and required action. It records one confirmed exact label binding and 24
  unresolved positions without changing the denominator.
- [`batch-01/sources.json`](batch-01/sources.json) contains 7 unique official
  product URLs in the collector's existing
  `nutrition-manufacturer-source-list-v1` format.
- [`batch-01/collection-gate-2026-09-11.json`](batch-01/collection-gate-2026-09-11.json)
  records the final three-domain terms decision, zero-fetch result and private
  archive readback for Batch 01's 10 variants.
- [`batch-01/owner-handoff-archive-2026-09-11.json`](batch-01/owner-handoff-archive-2026-09-11.json)
  records the four owner-supplied Applied Nutrition images, official page/image
  URLs, canonical string IDs, hashes, private object paths, readback and exact
  applicability gaps. The raw JPEGs and handoff manifest are outside Git.
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
| `optimumnutrition.com` | Product path not disallowed | [General Terms of Use](https://www.optimumnutrition.com/en-us/pages/terms-of-use) | `BLOCKED_WRITTEN_PERMISSION_REQUIRED`; the terms cover `www.optimumnutrition.com` and associated sites and require prior written consent for the planned commercial copy/private storage |
| `appliednutrition.uk` | `/products/` allowed | [Terms and conditions](https://appliednutrition.uk/pages/terms-conditions) | `NO_DETERMINATIVE_INFORMATION`; the footer-linked sale terms neither permit nor prohibit the planned collection, so clarification is required |
| `bulk.com` | Product path not disallowed | [Terms and conditions](https://help.bulk.com/hc/en-gb/articles/208192485-Terms-Conditions) | `NO_DETERMINATIVE_INFORMATION`; the footer-linked sale terms neither permit nor prohibit the planned collection, so clarification is required |
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

A fresh administrative `storage.listBuckets()` call against production project
`aftboxmrdgyhizicfsfu` again returned zero buckets and no equivalent candidate.
The authorized session then created private bucket `nutrition-sources` with a
10 MB per-object limit and the HTML, JSON, text, JPEG, PNG and WebP types used by
the existing process. No public access, browser credential or automatic object
expiration was added.

A 334-byte content-addressed canary and the 7-source Batch 01 manifest were
uploaded with SHA-256 metadata and no upsert. New Node processes downloaded both
objects and reproduced hashes
`b5a66d9664f2401065eecf455dca650ba8154415960e53f11e6271a2b7330d24`
and `33c1eb1edbf18a44058d91794a915b43b561baca10b0722ea8b14015b44c459c`.
Anonymous SDK download and an unauthenticated public URL both returned HTTP 400.
The objects have no automatic expiration.

A later duplicate scan found only those two objects and no hash/path match for the
owner handoff. Four JPEGs and manifest SHA-256
`e82828601e1b379bb2d4e77aabe4f5c11a55b09c7140bbf5b3b9922515fde645`
were uploaded without upsert. A fresh process reproduced all five hashes and sizes;
anonymous SDK access to a new image returned HTTP 404 and its unauthenticated public
URL returned HTTP 400. This storage result is **not a backup**.

## Batch 01 collection result

No collector run occurred. Optimum Nutrition isolates 1 URL/1 variant pending
manufacturer written permission. Applied Nutrition and Bulk isolate 6 URLs/9
variants pending a decisive site-use policy or manufacturer clarification. Actual
collector result remains 0 page requests and 0 collected pages.

The separate owner handoff preserved four readable Applied Nutrition labels for
four product pages and seven candidate variants. All four images confirm the
product family and package; only product `38` visibly confirms the selected Fruit
Burst flavour for variant `726`. Its exact label binding is accepted for later
review, while its ingredient values remain untranscribed and unapproved.

For variants `760`, `761`, `815` and `816`, a flavour listed on the product page
does not establish that the one flavour-neutral table applies across flavours.
For `1383` and `1384`, the same shared-table gap remains and the image wording
`ABE Ultimate` versus page/catalogue wording `ABE All Black Everything` is an
unresolved alias/version question. The name difference alone does not prove a
formula change. The required evidence is a flavour-specific official label or an
explicit manufacturer statement covering both the common table and, for product
`881`, the name/version relationship.

Across the full frozen pilot, 18 variants have no archived label. Together with
the six unresolved shared-table candidates, this leaves 24 explicit gaps. Each
gap has a reason and required action in the closeout file; no formula or nutrition
value is approved by NUT-01.

## Required decisions before collection

1. Obtain and record Optimum Nutrition written permission and an Applied Nutrition/
   Bulk clarification or applicable site-use policy. The owner's operational
   authorization is not manufacturer permission. Batch 02 remains unchanged and
   requires its separately recorded written permissions.
2. Resolve the 10 `NEEDS_REVIEW` entries without changing the frozen denominator:
   product/formula version conflicts for products `58`, `215`, `295`, `899` and
   `961`; duplicate canonical identity for `957`; package evidence for `1249` and
   `1275`; official source for `1252`; flavour/package evidence for `1283`.

These missing-source and rights decisions remain open but are fully recorded, so
the NUT-01 completion criterion is met without claiming complete source coverage.
NUT-01 is closed with explicit gaps. The next planned step is to extend the existing
candidate/review/apply path for exact variant ID and durable source URI/hash, using
product `38` / variant `726` as the bounded NUT-02 compatibility canary. This
package does not implement NUT-02 or authorize a nutrition catalogue write.
