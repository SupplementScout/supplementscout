const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { parse } = require("csv-parse/sync");
const runner = require("./10reps-bootstrap-artifact-approver");
const { NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE, NEW_PRODUCTS_V9_REMAINING_PROFILE, CATALOGUE_V10_EXISTING_PROFILE, CATALOGUE_V10_BOOTSTRAP_PROFILE, CATALOGUE_V10_REMAINING_PROFILE } = runner;
const newProductsV9Manifest = require("../config/retailers/10reps-reviewed-new-products-v9-large-101.json");
const catalogueV10Manifest = require("../config/retailers/10reps-reviewed-catalogue-v10-93.json");
const newProductsV9Options = { artifact: NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.artifact, csv: NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.csv, planFingerprint: NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.fingerprint };
const newProductsV9RemainingOptions = { artifact: NEW_PRODUCTS_V9_REMAINING_PROFILE.artifact, csv: NEW_PRODUCTS_V9_REMAINING_PROFILE.csv, planFingerprint: NEW_PRODUCTS_V9_REMAINING_PROFILE.fingerprint };
const catalogueV10ExistingOptions = { artifact: CATALOGUE_V10_EXISTING_PROFILE.artifact, csv: CATALOGUE_V10_EXISTING_PROFILE.csv, planFingerprint: CATALOGUE_V10_EXISTING_PROFILE.fingerprint };
const catalogueV10BootstrapOptions = { artifact: CATALOGUE_V10_BOOTSTRAP_PROFILE.artifact, csv: CATALOGUE_V10_BOOTSTRAP_PROFILE.csv, planFingerprint: CATALOGUE_V10_BOOTSTRAP_PROFILE.fingerprint };
const catalogueV10RemainingOptions = { artifact: CATALOGUE_V10_REMAINING_PROFILE.artifact, csv: CATALOGUE_V10_REMAINING_PROFILE.csv, planFingerprint: CATALOGUE_V10_REMAINING_PROFILE.fingerprint };

test("10 Reps v9 large bootstrap validates only the seven owner-approved product anchors", () => {
  const prepared = runner.prepareApproval(newProductsV9Options);
  assert.equal(prepared.profile, NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE);
  assert.equal(prepared.entry.plan_fingerprint, NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.fingerprint);
  const artifact = JSON.parse(fs.readFileSync(NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.artifact));
  const csvRows = parse(fs.readFileSync(NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.csv), { columns: true, skip_empty_lines: true });
  for (const fingerprint of NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.allowedFingerprints) {
    assert.doesNotThrow(() => runner.validatePackage(structuredClone(newProductsV9Manifest), structuredClone(artifact), structuredClone(csvRows), NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE, fingerprint));
  }
  const changed = structuredClone(artifact);
  changed.plans[0].resolved_plan.offer.values.shipping_cost = "0.00";
  assert.throws(() => runner.validatePackage(structuredClone(newProductsV9Manifest), changed, structuredClone(csvRows), NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE, NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.fingerprint), /shipping|fingerprint/i);
});
test("10 Reps v9 remaining profile validates only the 94 owner-approved sibling variants", () => {
  const prepared = runner.prepareApproval(newProductsV9RemainingOptions);
  assert.equal(prepared.profile, NEW_PRODUCTS_V9_REMAINING_PROFILE);
  const artifact = JSON.parse(fs.readFileSync(NEW_PRODUCTS_V9_REMAINING_PROFILE.artifact));
  const csvRows = parse(fs.readFileSync(NEW_PRODUCTS_V9_REMAINING_PROFILE.csv), { columns: true, skip_empty_lines: true });
  assert.equal(NEW_PRODUCTS_V9_REMAINING_PROFILE.allowedFingerprints.length, 94);
  for (const fingerprint of NEW_PRODUCTS_V9_REMAINING_PROFILE.allowedFingerprints) {
    assert.doesNotThrow(() => runner.validatePackage(structuredClone(newProductsV9Manifest), structuredClone(artifact), structuredClone(csvRows), NEW_PRODUCTS_V9_REMAINING_PROFILE, fingerprint));
  }
  assert.throws(() => runner.parseArgs([`--artifact=${NEW_PRODUCTS_V9_REMAINING_PROFILE.artifact}`, `--csv=${NEW_PRODUCTS_V9_REMAINING_PROFILE.csv}`, `--plan-fingerprint=${NEW_PRODUCTS_V9_BOOTSTRAP_PROFILE.fingerprint}`]), /remaining-94 fingerprint/);
  const changed = structuredClone(artifact);
  changed.plans[0].resolved_plan.offer.values.shipping_cost = "0.00";
  assert.throws(() => runner.validatePackage(structuredClone(newProductsV9Manifest), changed, structuredClone(csvRows), NEW_PRODUCTS_V9_REMAINING_PROFILE, NEW_PRODUCTS_V9_REMAINING_PROFILE.fingerprint), /shipping|fingerprint/i);
});
test("10 Reps catalogue v10 remaining profile validates only the 71 owner-approved sibling variants", () => {
  const prepared = runner.prepareApproval(catalogueV10RemainingOptions);
  assert.equal(prepared.profile, CATALOGUE_V10_REMAINING_PROFILE);
  const artifact = JSON.parse(fs.readFileSync(CATALOGUE_V10_REMAINING_PROFILE.artifact));
  const csvRows = parse(fs.readFileSync(CATALOGUE_V10_REMAINING_PROFILE.csv), { columns: true, skip_empty_lines: true });
  assert.equal(CATALOGUE_V10_REMAINING_PROFILE.allowedFingerprints.length, 71);
  for (const fingerprint of CATALOGUE_V10_REMAINING_PROFILE.allowedFingerprints) {
    assert.doesNotThrow(() => runner.validatePackage(structuredClone(catalogueV10Manifest), structuredClone(artifact), structuredClone(csvRows), CATALOGUE_V10_REMAINING_PROFILE, fingerprint));
  }
  assert.throws(() => runner.parseArgs([`--artifact=${CATALOGUE_V10_REMAINING_PROFILE.artifact}`, `--csv=${CATALOGUE_V10_REMAINING_PROFILE.csv}`, `--plan-fingerprint=${CATALOGUE_V10_BOOTSTRAP_PROFILE.fingerprint}`]), /remaining-71 fingerprint/);
  const changed = structuredClone(artifact);
  changed.plans[0].resolved_plan.offer.values.shipping_cost = "0.00";
  assert.throws(() => runner.validatePackage(structuredClone(catalogueV10Manifest), changed, structuredClone(csvRows), CATALOGUE_V10_REMAINING_PROFILE, CATALOGUE_V10_REMAINING_PROFILE.fingerprint), /shipping|fingerprint/i);
});
test("10 Reps catalogue v10 existing profile validates only the 14 approved existing-product plans", () => {
  const prepared = runner.prepareApproval(catalogueV10ExistingOptions);
  assert.equal(prepared.profile, CATALOGUE_V10_EXISTING_PROFILE);
  assert.equal(prepared.artifact.plans.length, 14);
  const artifact = JSON.parse(fs.readFileSync(CATALOGUE_V10_EXISTING_PROFILE.artifact));
  const csvRows = parse(fs.readFileSync(CATALOGUE_V10_EXISTING_PROFILE.csv), { columns: true, skip_empty_lines: true });
  for (const fingerprint of CATALOGUE_V10_EXISTING_PROFILE.allowedFingerprints) {
    assert.doesNotThrow(() => runner.validatePackage(structuredClone(catalogueV10Manifest), structuredClone(artifact), structuredClone(csvRows), CATALOGUE_V10_EXISTING_PROFILE, fingerprint));
  }
  for (const mutate of [
    value => { value.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "4.99"; },
    value => { value.artifact.plans[0].resolved_plan.product.id = "758"; },
    value => { value.artifact.plans[0].resolved_plan.product.action = "create"; },
    value => { value.artifact.plans[0].resolved_plan.retailer.id = "13"; },
    value => { value.artifact.plans.pop(); },
    value => { value.manifest.policy.allow_canonical_variant_updates = true; },
  ]) {
    const value = { manifest: structuredClone(catalogueV10Manifest), artifact: structuredClone(artifact), csvRows: structuredClone(csvRows) };
    mutate(value);
    assert.throws(() => runner.validatePackage(value.manifest, value.artifact, value.csvRows, CATALOGUE_V10_EXISTING_PROFILE));
  }
  assert.throws(() => runner.parseArgs([`--artifact=${CATALOGUE_V10_EXISTING_PROFILE.artifact}`, `--csv=${CATALOGUE_V10_EXISTING_PROFILE.csv}`, `--plan-fingerprint=${CATALOGUE_V10_BOOTSTRAP_PROFILE.fingerprint}`]), /catalogue-v10-existing-14 fingerprint/);
});
test("10 Reps catalogue v10 bootstrap validates only the eight approved product anchors", () => {
  const prepared = runner.prepareApproval(catalogueV10BootstrapOptions);
  assert.equal(prepared.profile, CATALOGUE_V10_BOOTSTRAP_PROFILE);
  assert.equal(prepared.artifact.plans.length, 8);
  const artifact = JSON.parse(fs.readFileSync(CATALOGUE_V10_BOOTSTRAP_PROFILE.artifact));
  const csvRows = parse(fs.readFileSync(CATALOGUE_V10_BOOTSTRAP_PROFILE.csv), { columns: true, skip_empty_lines: true });
  for (const fingerprint of CATALOGUE_V10_BOOTSTRAP_PROFILE.allowedFingerprints) {
    assert.doesNotThrow(() => runner.validatePackage(structuredClone(catalogueV10Manifest), structuredClone(artifact), structuredClone(csvRows), CATALOGUE_V10_BOOTSTRAP_PROFILE, fingerprint));
  }
  for (const mutate of [
    value => { value.artifact.plans[0].resolved_plan.offer.values.shipping_cost = "0.00"; },
    value => { value.artifact.plans[0].resolved_plan.product.values.category = "Pre Workout"; },
    value => { value.artifact.plans[0].resolved_plan.product.action = "existing"; },
    value => { value.artifact.plans[0].resolved_plan.retailer.id = "13"; },
    value => { value.artifact.plans.pop(); },
    value => { value.manifest.policy.allow_canonical_gtin_updates = true; },
  ]) {
    const value = { manifest: structuredClone(catalogueV10Manifest), artifact: structuredClone(artifact), csvRows: structuredClone(csvRows) };
    mutate(value);
    assert.throws(() => runner.validatePackage(value.manifest, value.artifact, value.csvRows, CATALOGUE_V10_BOOTSTRAP_PROFILE));
  }
  assert.throws(() => runner.parseArgs([`--artifact=${CATALOGUE_V10_BOOTSTRAP_PROFILE.artifact}`, `--csv=${CATALOGUE_V10_BOOTSTRAP_PROFILE.csv}`, `--plan-fingerprint=${CATALOGUE_V10_EXISTING_PROFILE.fingerprint}`]), /catalogue-v10-bootstrap-8 fingerprint/);
});
