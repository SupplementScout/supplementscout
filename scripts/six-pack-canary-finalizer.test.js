const assert = require("node:assert/strict");
const test = require("node:test");
const { selectDryRunApprovedRows } = require("./six-pack-canary-finalizer");

const header = "external_product_id,external_variant_id,product_id,product_variant_id,price\n";
const rows = Array.from({ length: 6 }, (_, index) =>
  `${index + 10},${index + 20},${index + 30},${index + 40},${index + 1}.99`
).join("\n");
const csv = `${header}${rows}\n`;

test("finalizer selects only rows accepted by the importer dry-run", () => {
  const report = {
    rowLevelOffers: [2, 4, 5, 6, 7].map((rowNumber) => ({ rowNumber, offerAction: "create" })),
    successfulRows: [],
    failedRows: [],
    blockedRows: [{ rowNumber: 3, reasons: ["format conflict"] }],
  };
  const result = selectDryRunApprovedRows(csv, report);
  assert.deepEqual(result.rowNumbers, [2, 4, 5, 6, 7]);
  assert.deepEqual(result.selected.map((row) => row.external_product_id), ["10", "12", "13", "14", "15"]);
});

test("finalizer rejects applied reports, duplicate rows and undersized canaries", () => {
  assert.throws(
    () => selectDryRunApprovedRows(csv, { rowLevelOffers: [2, 3, 4, 5, 6].map((rowNumber) => ({ rowNumber })), successfulRows: [{}] }),
    /not a dry-run-only/
  );
  assert.throws(
    () => selectDryRunApprovedRows(csv, { rowLevelOffers: [2, 2, 3, 4, 5].map((rowNumber) => ({ rowNumber })), successfulRows: [], failedRows: [] }),
    /invalid or duplicate/
  );
  assert.throws(
    () => selectDryRunApprovedRows(csv, { rowLevelOffers: [2, 3, 4, 5].map((rowNumber) => ({ rowNumber })), successfulRows: [], failedRows: [] }),
    /5..20/
  );
});
