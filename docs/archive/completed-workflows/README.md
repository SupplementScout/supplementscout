# Completed one-time workflows

These GitHub Actions definitions are retained as implementation and audit
evidence, but are intentionally stored outside `.github/workflows/` so GitHub
cannot offer or execute them again.

Archived on 11 August 2026:

- `gym-high-reviewed-catalogue-bootstrap.yml` — the exact 34-variant bootstrap
  completed successfully in run `30709443758`; current postflight requires zero
  further variant creates.
- `gym-high-legacy-identity-upgrade.yml` — the exact 21-mapping identity repair
  completed successfully in run `30711898188`; production verification found
  zero remaining upgrades.
- `seo13-vegan-protein-pilot.yml` — the two-record Vegan Protein pilot completed
  successfully in run `30707297893`; the public page was subsequently marked
  live verified. SEO-13 itself remains active and continues through its normal
  page roadmap, not through this consumed pilot workflow.

The associated scripts, immutable rollout evidence and tests remain in place.
Tests assert that these files stay archived and that their original guards are
preserved.
