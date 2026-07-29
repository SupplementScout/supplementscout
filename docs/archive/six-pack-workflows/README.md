# Retired Six Pack workflow archive

Archived on 29 July 2026 after the Six Pack catalogue rollout was completed.

These 27 workflow definitions were one-time bootstrap, mapping, shipping,
canary or production-expansion packages. They are preserved here as historical
execution evidence but are outside `.github/workflows`, so GitHub Actions cannot
run them.

The only active Six Pack automation is:

- `.github/workflows/six-pack-offer-refresh.yml`

That active workflow performs the guarded ongoing offer refresh. Archiving these
rollout packages does not remove or change catalogue products, variants,
retailer mappings, offers, price history, source manifests, approval manifests,
adapter code or the active refresh workflow.

## Audit result

- 28 Six Pack workflow files existed in the active directory.
- 27 were completed one-time rollout packages.
- 1 was the ongoing offer refresh and remains active.
- Every retired package had at least one successful GitHub Actions run.
- Repeated failures after the successful run were fail-closed preflight
  rejections; apply/write steps were skipped.
- V12 and V13 contained a malformed retirement trigger that caused continued
  push runs. The syntax was corrected and every retired job received an
  unconditional false guard before archival.
- The guard commit produced only skipped historical jobs and no failed or
  writing jobs.

## Archived groups

- large-family bootstrap V7 through V15;
- production canary;
- production expansion base, V2 and V4 through V15;
- production family V3;
- production family V6 bootstrap;
- production shipping.

Restoring any archived workflow to `.github/workflows` requires a separate
reviewed task, a current production preflight and explicit approval. Historical
workflow definitions must never be restored merely to rerun an old rollout.
