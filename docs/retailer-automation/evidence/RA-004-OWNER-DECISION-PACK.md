# RA-004 — Owner Decision Pack

**Prepared:** 24 September 2026

**Repository baseline:** `29b57ffe98c174e0f7364d65f25bdcdc2b5cceb5`

**Status:** `VERIFIED_COMPLETE — OWNER DECISIONS APPROVED — EXECUTION NOT_AUTHORIZED`

**Scope:** approved policies and future-preparation parameters only

**Manifest fingerprint:** `030c9d7cb12b46ab0b2bca2311ffbe1456e1c579e9e3acd570a4c0766ead119c`

## Owner decision record

- Owner: `Marek`.
- Decision date: `2026-09-24`.
- Source: explicit owner instruction.
- Recorded statement: “Zatwierdzam wszystkie pięć rekomendowanych decyzji RA-004.”
- Owner-decision status: `OWNER_APPROVED`.

This approval selects the five recommended policies and future-preparation
parameters in this pack. It does not authorize staging execution, migration
application, credential issuance or use, live capture, live control-state
export, shadow execution or any business/control write. Every execution action
requires a new exact owner authorization.

## Evidence boundary and known facts

The recommendations use only tracked repository documentation, fixtures,
configuration and retained evidence. No protected URL or credential was read;
no live feed, database, staging, production or current control state was
accessed.

- The tracked refresh scope contains 950 approved mappings. The retained run
  produced 935 executable and 15 review results. These are historical results,
  not a current feed count or a permitted review allowance.
- The last tracked source guard baseline is 473 product IDs and 1,663 variant
  IDs. It is historical configuration context, not an approved current
  snapshot.
- There is no approved current raw or semantic snapshot fingerprint. Therefore
  the first future capture cannot be `PASS`: it may only become a quarantined
  baseline candidate, and processing stops as `BLOCKED_SOURCE` until Marek
  separately approves its exact raw and semantic fingerprints as the baseline.
- The exact 17-column CSV contract, validation behavior and zero-tolerance
  record-by-record parity contract are already tracked. Record-count tolerance
  never weakens them.

The numeric thresholds below are **owner-approved temporary conservative
policy**.
Tracked evidence is insufficient for a statistically derived distribution of
normal feed movement. After three owner-approved captures, they must be reviewed
using only comparable, complete snapshots; they do not expire, relax or change
automatically.

### Number provenance

| Number | Classification | Reproducible source or calculation |
|---|---|---|
| 950 mappings | proved by tracked evidence | `approved_mapping_count` in `config/retailers/10reps-offer-sync.json` and the tracked approved mapping scope; it is not a raw-row count |
| 935 executable / 15 review | proved by tracked historical evidence | retained run `35834479612`, recorded in `RA-004-PREFLIGHT.md` and `AUDIT.md`; neither value is current feed state or a permitted future allowance |
| 473 products / 1,663 variants | proved as historical configured guard values | `source_baseline.product_count` and `source_baseline.variant_count` in the tracked 10 Reps configuration; they are not a current approved snapshot |
| 1,497–1,996 candidate variants | calculated from stated values | owner-approved temporary candidate envelope `round_half_up(1,663 × 0.90)` through `round_half_up(1,663 × 1.20)`: `1,497` through `1,996` |
| 426–568 candidate products | calculated from stated values | owner-approved temporary candidate envelope `round_half_up(473 × 0.90)` through `round_half_up(473 × 1.20)`: `426` through `568` |
| Every percentage, absolute threshold, retention period, 60-minute window, 30-minute credential TTL and one-call limit | owner-approved temporary safety policy or future-preparation parameter | not derived from historical frequency or presented as fact; execution remains separately unauthorized |
| 10,000,000-byte capture cap | proved as tracked preflight/configured cap | tracked preflight and source-reader configuration; retaining it in a future authorization is still an owner decision |
| Migration SHA-256 | proved by tracked bytes | independently reproducible from the named migration; selector contracts bind the same value |

The measures are not interchangeable. A raw row is one physical CSV data row.
A unique variant/product count is the number of distinct validated source IDs.
Under the exact 17-column contract, a valid capture requires one unique variant
ID per data row, so total rows and unique variants must be equal, but both are
still checked independently. A mapping is an approved link from an external
variant to catalogue state; it need not cover every feed row. Executable and
review are historical classifier outcomes over mapped scope, not source counts.

## How record-count status is calculated

For baseline count `B`, observed count `C`, percentage `p` and absolute limit
`A`, calculate the integer trigger as `min(ceil(B × p / 100), A)`. This is the
exact meaning of “p% or A”: **either** condition triggers, the stricter/smaller
integer delta wins, and both boundaries use `>=`. It is not `max`, and the two
conditions do not both have to be true. Let `D = abs(C - B)` and select the
decline thresholds when `C < B`, otherwise the growth thresholds. The status is
`BLOCKED_SOURCE` when `D >= block_trigger`; otherwise `PASS_WITH_REVIEW` when
`D >= review_trigger`; otherwise `PASS`. Percentage multiplication is exact
decimal arithmetic and `ceil` is applied before `min`.

`PASS_WITH_REVIEW` never authorizes a write, stock change, mapping change or
conversion of `SOURCE_MISSING` to out of stock.

The comparison baseline is the most recent snapshot explicitly approved by
fingerprint for this policy version. If it is absent, expired, from a different
contract/policy, or cannot be verified, the result is `BLOCKED_SOURCE`.

### Approved option R — balanced conservative

| Measure | `PASS` | `PASS_WITH_REVIEW` | `BLOCKED_SOURCE` |
|---|---|---|---|
| Total rows | below the review boundary | decline: at least 1% **or** 10; growth: at least 5% **or** 50 | decline: at least 5% **or** 50; growth: at least 20% **or** 250 |
| Unique variant IDs | same thresholds as total rows; count must also equal total rows | same | any row/variant mismatch, or the total-row block boundary |
| Unique product IDs | below the review boundary | decline: at least 1% **or** 3; growth: at least 5% **or** 15 | decline: at least 5% **or** 15; growth: at least 20% **or** 60 |
| Valid records | exactly all input rows | fewer than all rows only when every invalid row/group is durably isolated and aggregate/source structure remains trustworthy | source structure or defect scope cannot be isolated safely |
| Invalid price, unknown stock, duplicate stable identity, missing required row field | zero affected rows | one or more affected rows/groups, all excluded from execution and durably reviewed | source-wide/systemic defect or an ambiguity that prevents complete isolation |
| Approved mapped records absent from source | zero | 1–9 | at least 1% of 950 **or** 10; stricter classifier wins |
| New, previously unseen variant IDs | zero | 1–49 | at least 5% of baseline variants **or** 50; stricter classifier wins |
| Relative change from approved snapshot | covered independently above | any review boundary in any dimension | any block boundary in any dimension |

### Executable boundary examples for approved option R

Counts in the last two columns are observed counts immediately below, exactly
on and immediately above the delta boundary. “Above” always means one more
unit of drift, not a numerically larger count for a decline.

| Baseline / measure / direction | First review delta and observed below/on/above | Result below/on/above | First block delta and observed below/on/above | Result below/on/above |
|---|---|---|---|---|
| 950 variants, decline | `min(ceil(9.5),10)=10`; `941/940/939` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(47.5),50)=48`; `903/902/901` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |
| 950 variants, growth | `min(ceil(47.5),50)=48`; `997/998/999` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(190),250)=190`; `1139/1140/1141` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |
| 1,500 variants, decline | `min(ceil(15),10)=10`; `1491/1490/1489` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(75),50)=50`; `1451/1450/1449` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |
| 1,500 variants, growth | `min(ceil(75),50)=50`; `1549/1550/1551` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(300),250)=250`; `1749/1750/1751` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |
| 500 products, decline | `min(ceil(5),3)=3`; `498/497/496` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(25),15)=15`; `486/485/484` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |
| 500 products, growth | `min(ceil(25),15)=15`; `514/515/516` | `PASS/PASS_WITH_REVIEW/PASS_WITH_REVIEW` | `min(ceil(100),60)=60`; `559/560/561` | `PASS_WITH_REVIEW/BLOCKED_SOURCE/BLOCKED_SOURCE` |

Benefit: it notices small losses early, tolerates bounded catalogue growth for
manual inspection, and makes a material source collapse a retailer-wide stop.
Risk: ordinary product retirement may cause review, while a coordinated bad feed
below all boundaries could still pass count checks; content, schema, identity,
fingerprint and parity guards remain mandatory for that reason.

### Option S — more restrictive

| Measure | Review boundary (`PASS_WITH_REVIEW`) | Block boundary (`BLOCKED_SOURCE`) |
|---|---|---|
| Total rows / unique variants, decline | 0.5% or 5 | 2% or 20 |
| Total rows / unique variants, growth | 2% or 20 | 10% or 100 |
| Unique products, decline | 0.5% or 1 | 2% or 5 |
| Unique products, growth | 2% or 5 | 10% or 25 |
| Missing approved mappings | first missing row | 0.5% of 950 or 5 |
| New variant IDs | first new row | 2% of baseline or 20 |

All validity rules retain the per-row zero-execution rule below. Benefit:
earliest warning and lowest chance of accepting a partial feed. Risk: more
false-positive stops and more owner review during normal catalogue churn.

### Option F — more flexible

| Measure | Review boundary (`PASS_WITH_REVIEW`) | Block boundary (`BLOCKED_SOURCE`) |
|---|---|---|
| Total rows / unique variants, decline | 2% or 25 | 10% or 150 |
| Total rows / unique variants, growth | 10% or 150 | 30% or 500 |
| Unique products, decline | 2% or 5 | 10% or 30 |
| Unique products, growth | 10% or 30 | 30% or 100 |
| Missing approved mappings | first missing row | 2.5% of 950 or 25 |
| New variant IDs | first new row | 10% of baseline or 100 |

All validity rules retain the per-row zero-execution rule below. Benefit: fewer
operational stops from legitimate assortment change. Risk: a materially
incomplete or polluted feed can travel farther before the aggregate guard
blocks it. This is not recommended for the first pilot.

### First future capture and absolute stops

Because no approved snapshot exists, the first owner-authorized capture is a
baseline-candidate collection only. Historical context gives a provisional
eligibility envelope of 1,497–1,996 total rows/unique variants and 426–568
unique products (90%–120% of 1,663/473). Inside the envelope it is still
`BLOCKED_SOURCE_BASELINE_APPROVAL_REQUIRED`, not `PASS`; outside it is
`BLOCKED_SOURCE_COUNT_DRIFT`. Marek must review the capture metadata, counts,
raw SHA-256 and semantic SHA-256 and explicitly approve or reject that exact
candidate before any replay. The envelope is not evidence of current feed size,
does not approve its own fingerprints and cannot lead directly to shadow. It
changes no price or stock and creates no control plan, approval or apply.

### Zero tolerance, per-row isolation and run status

“Zero tolerance” means zero automatic execution for every affected record, not
automatic `FAILED_SYSTEM` and not automatically a whole-source failure. An
invalid price, unknown stock or missing required row value becomes
`SOURCE_INVALID`; duplicate stable identity becomes
`SOURCE_IDENTITY_CONFLICT`. The affected record or complete identity/dependency
group is excluded and retained for review. If row boundaries, unaffected
identity groups and the complete audit trail remain provable, the run may be
`PASS_WITH_REVIEW` and unaffected rows remain independently classifiable.

The whole run is `BLOCKED_SOURCE` only when source trust is lost: empty/HTML or
wrong content, header/order/delimiter/quoting/encoding drift, oversize input,
feed-wide currency drift, systemic duplicates, count-collapse block threshold,
or any malformed/ambiguous condition that the current parser cannot isolate
without risking another dependency group. A parser that fails before safe
isolation must block the source rather than pretend it isolated a row.

An unclassified row is excluded with zero execution. It permits
`PASS_WITH_REVIEW` only when its raw row and dependency boundary are durably
isolated; otherwise it is `BLOCKED_SOURCE`. `SOURCE_MISSING` always remains a
review state and never implies OOS. `FAILED_SYSTEM` is reserved for a real
code, infrastructure, database or process-integrity failure, never an ordinary
bad source row or correctly fired guardrail.

Capability/integrity conditions stop the whole attempt: raw fingerprint change,
a second read, unexpected network/database/write attempt, missing approved
baseline, incomplete audit trail, non-deterministic replay, canonical defect or
unexplained parity difference. Parity remains exact row by row, with zero
percentage error budget. These stops create no execution authority.

## Snapshot and evidence retention options

Rules common to all options:

- Raw CSV may exist only in a private, UK-region, encrypted-at-rest evidence
  store approved for SupplementScout operational data; transport must use TLS.
  A local encrypted volume is permitted only for the bounded run and upload/
  verification window. Git, PR attachments, logs and public GitHub artifacts
  are forbidden.
- Access is least-privilege for the named operator and independent verifier;
  no application, scheduler, production executor or broad service role receives
  access. Every read and deletion is audited.
- Store an immutable/write-once object, detached SHA-256, byte count, media type
  and redacted metadata. Source URLs, query strings, credentials, tokens and
  connection strings are removed before any derived evidence is retained.
- Expiry creates a deletion request followed by read-after-delete verification.
  Retain a non-sensitive deletion receipt containing object identifier,
  SHA-256, policy version, deletion time and actor; never retain the deleted
  content in the receipt.
- A declared incident, legal hold or audit hold pauses deletion only for the
  exact evidence set, records authority/reason/review date, and preserves the
  original expiry. Release resumes deletion. Holds cannot make data public.

| Evidence class | Approved R | Short S | Long L |
|---|---:|---:|---:|
| Raw CSV after capture | 90 days | 30 days | 365 days |
| First pilot raw CSV | 365 days or 90 days after signed pilot closeout, whichever is later | 90 days or 30 days after closeout | 730 days or 365 days after closeout |
| Redacted capture metadata | 13 months | 6 months | 24 months |
| Canonical output | 13 months | 6 months | 24 months |
| Parity report and zero-side-effect attestation | 24 months | 13 months | 36 months |
| Operational audit logs | 13 months | 6 months | 24 months |
| Fingerprints, evidence index and deletion receipts | 7 years | 24 months | 7 years |
| Redacted control-state export | 90 days | 30 days | 365 days |

For approved R the retention lifecycle is exact:

| Evidence | Purpose | Clock starts / deletion due | Deletion owner and proof |
|---|---|---|---|
| Raw CSV | reproduce source parsing and investigate the capture | successful capture completion / `+90 days` | future named evidence custodian; deletion request, read-after-delete and receipt |
| First-pilot raw CSV | preserve the first pilot through review and closeout | capture completion / later of `capture +365 days` and signed closeout `+90 days` | same custodian and proof |
| Redacted capture metadata | prove capture scope, time, size and source hash without source URL | capture completion / `+13 calendar months` | same custodian and proof |
| Canonical output | reproduce normalization and matching | canonical replay completion / `+13 calendar months` | same custodian and proof |
| Parity report and zero-side-effect attestation | prove comparison and denied capabilities | report sealing / `+24 calendar months` | same custodian and proof |
| Operational audit logs | prove named access and lifecycle actions | event timestamp per immutable entry / `+13 calendar months` | same custodian and proof |
| Fingerprints, evidence index and deletion receipts | long-horizon integrity and deletion accountability without raw content | evidence sealing or receipt creation / `+7 years` | same custodian and a terminal deletion receipt; seven years is an operational proposal, not a claimed legal or tax requirement |
| Redacted control-state export | support bounded canary verification | export sealing / `+90 days` | same custodian and proof |

The custodian, storage location and automation must be named before capture;
none exists by assumption in this pack. Automatic deletion may issue a deletion
request at expiry, but success is recorded only after read-after-delete. A true
WORM/retention lock must be configured to end no later than the approved
retention deadline; while the lock is active, deletion cannot be claimed. An
authorized incident/audit/legal hold suspends deletion for the exact evidence,
records its owner, reason and review date, and deletion resumes after release.

Approved R balances reproducibility of the first pilot with data minimization.
Short S reduces exposure but may remove raw evidence before a delayed audit.
Long L improves long-horizon incident reconstruction but increases breach,
governance and deletion burden. Derived evidence must not contain reconstructable
raw feed data; if it does, it inherits the raw CSV retention and access class.

## Approved future-preparation parameters — execution still `NOT_AUTHORIZED`

Marek approved preparation of a separate implementation plan, runbook and Draft
PR for the bounded staging canary below, with a maximum 60-minute window. This is
`OWNER_APPROVED_FOR_FUTURE_PREPARATION`, not permission to change a selector,
apply a migration, issue or use a credential, call the RPC or create an export.

Exact candidate migration:
`supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql`,
SHA-256 `cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa`.
The hash is bound in `scripts/supabase-migration-selector.js`. The migration ID
is currently excluded by `scripts/supabase-migration-selector.js` from both
`STAGING` and `PRODUCTION`; selector tests fail closed on hash drift. A separate
reviewed change and owner decision are required before staging selection can
change. This pack does not make that change.

The approved future-preparation parameter set is:

1. Before an authorization window, a staging owner verifies the exact project
   identity, migration ledger, required source tables/functions/roles, absence
   of the target migration, and the list of available staging retailers using
   an existing approved read-only administrative preflight. Select exactly one
   retailer by unique name/slug and record the returned numeric ID; never infer
   or copy an ID from production. Stop if 10 Reps is absent or non-unique.
2. Independently review a staging-only selector change that admits only the
   exact migration filename/hash for one application. Production exclusion,
   production selector contract and production ledger must remain unchanged.
   Bind the application to the attested staging project and expected preflight
   ledger. Do not load or make available production credentials.
3. Apply the migration once through the SHA-bound staging selector. Do not use
   direct migration tooling or an unselected directory. Re-run schema, ACL,
   RLS, role-attribute and migration-ledger checks.
4. Provision outside Git one staging login with membership only in
   `retailer_control_state_exporter`: schema `USAGE` plus `EXECUTE` on
   `public.read_retailer_control_state_v1(...)`, no table access, no other RPC,
   no `BYPASSRLS`, and no write/approval/apply authority. Maximum validity is
   30 minutes. Revoke it immediately after the call, sooner on any failure.
5. Make at most one exporter RPC call for the one resolved retailer and create
   exactly one read-only, redacted export. No pagination, retry or second call.
   Store it and its detached hash in the same private encrypted write-once
   evidence store under the redacted control-state retention policy. No public
   artifact or raw payload enters Git.
6. Confirm complete schema/version, all eleven requested sources, coherent
   transactional timestamps/fingerprints, retailer scope, caps, redaction,
   zero mutation authority and zero side effects. Then revoke `LOGIN`, revoke
   caller `EXECUTE` from the canary login/membership, remove the secret, and
   verify inability to reconnect or execute.

There is no scheduler wiring, evidence producer, live feed capture, control-plan
creation, approval, apply, import, production migration or production read in
this canary. Rollback begins with revoking `LOGIN` and `EXECUTE`; next disable
the secret, preserve the redacted evidence and ledger record, and only under a
separate reviewed rollback decision remove the function/roles/table. Append-only
evidence is not silently deleted.

Stop on project/ledger/hash/schema mismatch; missing or ambiguous retailer;
unexpected selected migration; any production endpoint or credential present;
credential privileges beyond the allowlist; expiry above 30 minutes; more than
one RPC attempt; incomplete source set; cap, redaction, fingerprint or snapshot
failure; any network destination beyond staging; any mutation/write/approval/
apply capability or attempt; inability to revoke; or incomplete audit trail.

Canary success requires one exact migration ledger entry with the approved hash,
all post-migration security checks, one complete redacted export for the resolved
retailer, one RPC attempt, zero prohibited capability attempts, a verified
revocation and complete private evidence. Success proves only the staging
interface boundary. Production remains prohibited if any result is not exact,
if revocation is unproved, if evidence producers are still absent, if a separate
production review/credential/migration authorization is absent, or if a later
shadow authorization and current baseline are absent. Canary success never
creates production authority.

To prevent accidental production application, the future PR must demonstrate:
the production exclusion and its bound hash are unchanged; production selector
tests still expect the migration excluded; only the attested staging project is
accepted; no production secret is available to the job/operator; the selected
directory contains only reviewed staging migrations; and the generated plan is
checked before apply. The existing generic selector, verifier and apply paths
remain the only allowed deployment path; Supabase direct push and manual SQL are
forbidden.

Tracked workflow and script inspection found no active automatic path that
applies the complete migration directory: remote application is routed through
the explicit selector/verifier/apply mechanism, while direct `psql` migration
loops are isolated integration tests. This is repository evidence, not a claim
about an untracked operator machine. A future canary must recheck it.

Revoking `LOGIN` and `EXECUTE` is an access rollback only. It immediately
disables the canary credential but does **not** remove the function, roles,
policies, ledger row or evidence table created by the migration and must not be
described as a full migration rollback. Removing those DDL objects requires a
separate reviewed migration and retention decision.

## Recorded owner decisions

| ID | Recorded selection and status | Approval authorizes | Approval does **not** authorize |
|---|---|---|---|
| D1 | Balanced conservative record-count policy R — `OWNER_APPROVED` | Registering the exact threshold policy for a separately authorized future capture | Capture, replay, shadow or writes |
| D2 | Raw retention R — `OWNER_APPROVED` | Registering 90-day raw retention and the later-of-365-days-or-closeout-plus-90-days first-pilot rule | Storage creation, upload or capture |
| D3 | Derived retention R — `OWNER_APPROVED` | Registering the approved 13-month, 24-month, 90-day and seven-year operational periods | Evidence collection, export or publication |
| D4 | Bounded staging canary parameters — `OWNER_APPROVED_FOR_FUTURE_PREPARATION` | Preparing a separate implementation plan, runbook and Draft PR | Selector change, migration application, canary execution, production, live capture or shadow |
| D5 | Staging-only credential design — `OWNER_APPROVED_FOR_FUTURE_PREPARATION` | Preparing the one-RPC, no-retry, maximum-30-minute credential design | Credential issuance or use, table/mutation rights or production access |

The approved threshold and retention policies do not expire automatically.
Review after three approved captures does not relax or replace them. A separate
exact authorization remains mandatory for every selector change and execution
action.

### Authorization matrix after owner approval

| Surface | Status |
|---|---|
| Staging-canary preparation | `AUTHORIZED` |
| Staging-canary execution | `NOT_AUTHORIZED` |
| Staging migration application | `NOT_AUTHORIZED` |
| Staging credential design | `AUTHORIZED` |
| Staging credential issuance and use | `NOT_AUTHORIZED` |
| Production migration and credential | `NOT_AUTHORIZED` |
| Live feed capture and live control-state export | `NOT_AUTHORIZED` |
| Shadow run, control plan, approval, import and apply | `NOT_AUTHORIZED` |
| Model B execution and cutover | `NOT_AUTHORIZED` |
| Auto-safe classes | `NONE_APPROVED` |

Plain-language owner summary:

1. Marek approved how much feed-count movement causes review or a source block.
2. Marek approved how long the protected raw CSV is kept, including the first
   pilot.
3. Marek approved how long redacted reports, logs and fingerprints are kept.
4. Marek approved preparation of a tightly bounded staging canary; he did not
   approve running it.
5. Marek approved preparation of a staging-only, 30-minute, one-call credential
   design; he did not approve issuing or using a credential.

## Required evidence before any later authorization

- this recorded owner decision bound to the manifest fingerprint and policy
  versions;
- exact fresh baseline/branch/commit and clean-worktree verification;
- independently reviewed staging-selector diff retaining production exclusion;
- staging identity, schema, ledger and retailer-inventory preflight;
- named operator, UTC start/end, private evidence destination and deletion rule;
- credential privilege/expiry/revocation plan;
- exact migration and manifest hashes; and
- independent verification of this decision pack before it is presented for
  approval.

## Remaining unknowns

There is no current approved feed baseline, raw/semantic fingerprint, retailer
count or control-state export. Normal count variance is not statistically
characterized. Staging's current schema, migration ledger, available retailers
and exact 10 Reps ID have not been read. No approved private evidence-store path,
named operators, canary time window, selector-change implementation, credential
issuer or incident/legal retention authority has been selected. These unknowns
do not invalidate the approved conservative policies; they block execution.

Machine-readable owner-decision record:
[`RA-004-owner-decisions.json`](RA-004-owner-decisions.json).

The manifest includes a SHA-256 of this Markdown after normalizing CRLF to LF
and replacing only the self-referential value on the `Manifest fingerprint`
line with the literal `SELF`. Its canonical JSON fingerprint excludes only
`manifest_fingerprint` itself and covers that normalized document hash. Any
other Markdown or manifest change requires updating the document hash and
recalculating both recorded fingerprint values.
