# RA-004 — Owner Decision Pack

**Prepared:** 24 September 2026

**Repository baseline:** `29b57ffe98c174e0f7364d65f25bdcdc2b5cceb5`

**Status:** `PROPOSED — NOT_AUTHORIZED`

**Scope:** documentation and recommendations only

This pack asks Marek for five bounded decisions. It does not record approval.
Until explicit answers are recorded, staging, production, live capture and the
10 Reps shadow run all remain `NOT_AUTHORIZED`.

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

The numeric thresholds below are **temporary and conservative proposals**.
Tracked evidence is insufficient for a statistically derived distribution of
normal feed movement. After three owner-approved captures, they must be reviewed
using only comparable, complete snapshots; they do not relax automatically.

## How record-count status is calculated

For every percentage threshold, calculate the percentage and absolute delta
classifiers independently and take the stricter status. For example, a decline
that reaches either 1% or 10 rows reaches review in the recommended policy. A
boundary is inclusive. `PASS_WITH_REVIEW` never authorizes a write, stock
change, mapping change or conversion of `SOURCE_MISSING` to out of stock.

The comparison baseline is the most recent snapshot explicitly approved by
fingerprint for this policy version. If it is absent, expired, from a different
contract/policy, or cannot be verified, the result is `BLOCKED_SOURCE`.

### Recommended option R — balanced conservative

| Measure | `PASS` | `PASS_WITH_REVIEW` | `BLOCKED_SOURCE` |
|---|---|---|---|
| Total rows | below the review boundary | decline: at least 1% **or** 10; growth: at least 5% **or** 50 | decline: at least 5% **or** 50; growth: at least 20% **or** 250 |
| Unique variant IDs | same thresholds as total rows; count must also equal total rows | same | any row/variant mismatch, or the total-row block boundary |
| Unique product IDs | below the review boundary | decline: at least 1% **or** 3; growth: at least 5% **or** 15 | decline: at least 5% **or** 15; growth: at least 20% **or** 60 |
| Valid records | exactly all input rows | not applicable | fewer than all input rows |
| Invalid price, unknown stock, duplicate stable identity, missing required row field | zero | not applicable | one or more |
| Approved mapped records absent from source | zero | 1–9 | at least 1% of 950 **or** 10; stricter classifier wins |
| New, previously unseen variant IDs | zero | 1–49 | at least 5% of baseline variants **or** 50; stricter classifier wins |
| Relative change from approved snapshot | covered independently above | any review boundary in any dimension | any block boundary in any dimension |

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

All validity rules remain zero-tolerance. Benefit: earliest warning and lowest
chance of accepting a partial feed. Risk: more false-positive stops and more
owner review during normal catalogue churn.

### Option F — more flexible

| Measure | Review boundary (`PASS_WITH_REVIEW`) | Block boundary (`BLOCKED_SOURCE`) |
|---|---|---|
| Total rows / unique variants, decline | 2% or 25 | 10% or 150 |
| Total rows / unique variants, growth | 10% or 150 | 30% or 500 |
| Unique products, decline | 2% or 5 | 10% or 30 |
| Unique products, growth | 10% or 30 | 30% or 100 |
| Missing approved mappings | first missing row | 2.5% of 950 or 25 |
| New variant IDs | first new row | 10% of baseline or 100 |

All validity rules remain zero-tolerance. Benefit: fewer operational stops from
legitimate assortment change. Risk: a materially incomplete or polluted feed
can travel farther before the aggregate guard blocks it. This is not
recommended for the first pilot.

### First future capture and absolute stops

Because no approved snapshot exists, the first owner-authorized capture is a
baseline-candidate collection only. Historical context gives a provisional
eligibility envelope of 1,497–1,996 total rows/unique variants and 426–568
unique products (90%–120% of 1,663/473). Inside the envelope it is still
`BLOCKED_SOURCE_BASELINE_APPROVAL_REQUIRED`, not `PASS`; outside it is
`BLOCKED_SOURCE_COUNT_DRIFT`. Marek must review the capture metadata, counts,
raw SHA-256 and semantic SHA-256 and explicitly approve or reject that exact
candidate before any replay. The envelope is not evidence of current feed size.

Every option stops absolutely on: empty response; HTML/challenge instead of
CSV; wrong content type; missing, reordered or additional required headers;
delimiter, quoting or encoding drift; size above 10,000,000 bytes; duplicate
stable identity; invalid/non-GBP currency; invalid price; unknown stock;
missing required identity, URL, price or stock field; unclassified record;
raw fingerprint change during processing; a second read; any unexpected
network, database or write attempt; missing approved baseline; incomplete audit
trail; non-deterministic replay; canonical defect; or unexplained parity
difference. Parity remains exact, row by row, with a zero percentage error
budget.

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

| Evidence class | Recommended R | Short S | Long L |
|---|---:|---:|---:|
| Raw CSV after capture | 90 days | 30 days | 365 days |
| First pilot raw CSV | 365 days or 90 days after signed pilot closeout, whichever is later | 90 days or 30 days after closeout | 730 days or 365 days after closeout |
| Redacted capture metadata | 13 months | 6 months | 24 months |
| Canonical output | 13 months | 6 months | 24 months |
| Parity report and zero-side-effect attestation | 24 months | 13 months | 36 months |
| Operational audit logs | 13 months | 6 months | 24 months |
| Fingerprints, evidence index and deletion receipts | 7 years | 24 months | 7 years |
| Redacted control-state export | 90 days | 30 days | 365 days |

Recommended R balances reproducibility of the first pilot with data minimization.
Short S reduces exposure but may remove raw evidence before a delayed audit.
Long L improves long-horizon incident reconstruction but increases breach,
governance and deletion burden. Derived evidence must not contain reconstructable
raw feed data; if it does, it inherits the raw CSV retention and access class.

## Proposed single staging canary — still `NOT_AUTHORIZED`

Exact candidate migration:
`supabase/migrations/20260924100000_add_transactional_retailer_control_state_interface.sql`,
SHA-256 `cfd7a93cb20845832b696183f5eb8a500f0474b4173829b85f6ac6bc73d4baaa`.
The hash is bound in `scripts/supabase-migration-selector.js`. The migration ID
is currently excluded by `scripts/lib/environment-migrations.js` from both
`STAGING` and `PRODUCTION`; selector tests fail closed on hash drift. A separate
reviewed change and owner decision are required before staging selection can
change. This pack does not make that change.

The one-canary proposal is:

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

## Five decisions for Marek

No response means `NOT_AUTHORIZED`.

| ID | Question and recommended answer | Alternatives | Approval authorizes | Approval does **not** authorize / no-decision effect |
|---|---|---|---|---|
| D1 | Approve record-count policy R, including first-capture quarantine and review after three approved captures? **Recommend: yes.** | S, F, or amendments | Recording policy/version and using it in a separately authorized future capture | No capture or replay now; no answer leaves all count-dependent work blocked |
| D2 | Approve raw retention R: 90 days, with first-pilot raw retained 365 days or 90 days after closeout? **Recommend: yes.** | Short or Long option | Creating the retention rule for a later separately authorized snapshot | No storage creation or capture now; no answer blocks capture |
| D3 | Approve derived-evidence retention R in the table? **Recommend: yes.** | Short or Long option | Applying those periods to later redacted capture metadata, canonical/parity/audit/fingerprint/control-state evidence | No evidence collection now; no answer blocks durable pilot evidence |
| D4 | Approve the staging-canary scope and one future window of at most 60 minutes for migration plus validation, with one resolved 10 Reps scope and one export? **Recommend: yes, only after a separately reviewed staging-selector change.** | Amend scope/window or keep blocked | A later task may prepare an exact time-bound staging authorization after every preflight gate passes | Does not apply migration now, change selector now, or authorize production/live capture/shadow; no answer keeps staging blocked |
| D5 | Approve a separate staging exporter credential valid at most 30 minutes and at most one RPC attempt, revoked immediately? **Recommend: yes, conditional on D4.** | 15-minute credential or no credential | Later out-of-Git provisioning for the exact canary window after D4 and preflight | No credential now; no production credential; no answer keeps exporter access blocked |

Even if all five proposals are approved, a separate exact authorization is still
required for the selector change and canary execution. Separate later decisions
are also mandatory for production migration/credential, live 10 Reps capture,
shadow run, import, apply, Model B, auto-safe policy and cutover. None is
authorized by this pack.

## Required evidence before any later authorization

- owner answers bound to this manifest fingerprint and policy versions;
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
do not prevent proposing conservative decisions; they block execution.

Machine-readable proposal:
[`RA-004-owner-decisions.json`](RA-004-owner-decisions.json).
