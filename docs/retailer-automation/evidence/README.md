# Retailer automation audit evidence — 23 September 2026

[RA-001 architecture decision pack](../RA-001-DECISION-PACK.md)

[RA-002 canonical contract and zero-write harness evidence](RA-002.md)

[RA-003 historical incident and legacy compatibility evidence](RA-003.md)

RA-002 was independently verified on 23 September 2026 in PR #86. Its local
contract/harness remains unwired from production. RA-003 is
`READY_FOR_VERIFICATION` and remains test/evidence-only; no RA task is in
implementation and RA-004 is not started.

## RA-001 owner approval

Marek approved all five decisions in the linked pack on 23 September 2026.
The approval closes RA-001 as `VERIFIED_COMPLETE` and changes the architecture
status to `OWNER APPROVED FOR RA-002 PLANNING`. It does not start RA-002,
authorize an auto-safe class or production apply, start 10 Reps shadow mode, or
permit removal of any legacy code or workflow. The six recorded unknowns remain
blocking dependencies for their affected later tasks, not for RA-001 closeout.

This directory indexes evidence; it does not contain credentials, raw private
feeds or production-write authority. GitHub artifacts were downloaded read-only
to ignored `tmp/retailer-automation-audit-2026-09-23/` for the audit and are not
committed.

## Baselines

- original dirty checkout: `main` at
  `1add3449096cbc3f988d0e5f6db8b9baf89f0349`;
- original and current fetched `origin/main` / production-run code:
  `121fc5ce909c925e7234aef3a249661c8e7d0826`;
- closeout branch: `docs/retailer-automation-ra-000`, created in a separate
  clean worktree from that exact remote SHA;
- original-to-current merge base:
  `1add3449096cbc3f988d0e5f6db8b9baf89f0349`, ahead/behind `0/104`;
- prior remote SHA to current remote SHA: identical, with no commits or file
  diff;
- pre-edit Project Guardian: PASS on 23 September 2026 in both the original
  audit and the clean closeout worktree.

The 104 commits between the original local audit baseline and current
`origin/main` contain the already-inspected retailer reliability work, including
eBay manual-dry-run queue isolation, Simply aggregate guards, Discount/Dolphin/
KIOR approval-window recovery, and Fit House's exact six-offer closeout. The
retailer-relevant changed paths are recorded in `AUDIT.md` section 1.1. No
retailer-automation code changed between the original remote baseline recorded
by the audit and this closeout.

## Current runs and artifacts

| Retailer/system | Run | Artifact ID | GitHub digest | Result used by audit |
|---|---:|---:|---|---|
| Watchdog | `35854459443` | `10746529264` | `cb4d2c6eed613ec6374e52b80de88a8c681ef9504ad1827b72830264c308b5dc` | FAIL, zero writes, no global failure; Jon's/eBay/10 Reps outside backlog baseline |
| Whey Okay | `35833574845` | `10738356307` | `fecb22fe8353f59154e637ea0f1f0aa8fb945e1fb5cfc5e95d56ff19ab6a7441` | preflight FAIL, missing mapped-source fingerprint row, zero writes |
| Shared Fit House / 10 Reps | `35834479612` | `10737749736` / `10739107735` | `8c1c3a65dcee156492c550bc950cf639122d702adaab4161d631865db85a1a40` / `83fdc78caf6dc0e9bcb4bd57ebf09f9cea9b0b43093b0983b99d88f81d3347ce` | Fit House technical stages PASS but summary failed; 10 Reps 935 executed + 15 review |
| 6 Pack | `35837546779` | `10741272299` | `31c643e60a2b8f63dcee1199cdf55540356a37f6a3b61ea5355f13b17e1d20a3` | 495 executed + 11 review; postflight/idempotency PASS |
| Jon's | `35843668515` | `10742317947` | `3d0e909f37c9d7f80f65c608623ff0bce276fe463abe6fc3d4df2402c75bffd0` | 502 executed + 4 review; postflight/idempotency PASS |
| Simply | `35845685589` | `10743496837` | `56f0579d9bc52ec1371c3fb77d8bc6f9064c9a7febfa7e59116291a545dcf889` | 119 executed + 1 review; postflight/idempotency PASS |
| eBay | `35847919079` | `10744242887` | `dd904d5b50ad5b7229aea3bfb64dec29a0495e94c71fd1d5cb86151e3c2fae64` | 159 executed + 78 review, postflight PASS; fresh no-op drifted to 158/79 and failed closed |
| Discount | `35859020829` | `10748876392` | `e0256d16b71b2acf542d27f6dacceac2e20c87a4e4e29a7deca5f4faa25a311e` | 109/109 PASS; postflight/idempotency PASS |
| KIOR | `35863935105` | `10752050475` | `a3e1d524c95c79700061590b357b92bf2c048ad03b59b4ed0aaf9224cc2400da` | 11/11 PASS; postflight/idempotency PASS |

Additional current scheduled successes inspected: Dolphin `35846844175`, GYM
HIGH source monitor `35839267850`, GYM HIGH full catalogue `35841920640`,
Automation Review Queue Worker `35855417269`, and Retailer Dry Run
`35856400281`.

## Historical evidence anchors

- shared automation closeout:
  `docs/rollouts/shared-retailer-automation-closeout-2026-09-09.json`;
- shared evidence:
  `docs/rollouts/shared-retailer-automation-evidence-2026-09-09.json`;
- remaining-scope incident pack:
  `docs/rollouts/automation-reliability-remaining-scope-2026-08-31.json`;
- remote latest triage:
  `docs/rollouts/retailer-reliability-triage-2026-09-22.md` at
  `121fc5ce909c925e7234aef3a249661c8e7d0826`;
- Git history inspected through 23 September, including September recovery,
  approval-window, source-drift and queue-publication fixes.

## Evidence limitations

The artifacts do not provide a complete current export of all parent plans,
child plans, approvals, apply sessions and locks. Direct SQL was prohibited, so
the exact active/conflicting session inventory is a recorded blocker.
