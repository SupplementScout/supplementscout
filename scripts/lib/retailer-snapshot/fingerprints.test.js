const assert = require("node:assert/strict");
const test = require("node:test");
const fingerprints = require("./fingerprints");

const vector = { id: "9007199254740993", price: "10.00", nullable: null, tags: ["b", "a"] };
const GOLDEN = Object.freeze({ source: "7a66c3412622f1d5df0dd26f8e96c2e23a450c39bf5229b00cb230ca7ddd217b", canonical: "7d4611ea0b34c14dbb1b55818d32eed34a032e337bccc85aa6d43c897ac009f7", classification: "c78ce0f3338f03b9fe3974255d58e6b2790733d2eae535079f7047eb18e645db", row: "71ab6daed617c8b584b84d45e857c764b6a8a7186d0492a0b07da8a535b51a5d", child: "6b05f2e7018b41b176995f2040e39c0ed5a74b965cc4d5ea799a674df60a5904", parent: "ccfc0ef3c5ab95f02fd509283582df80bac2a2b0848cb9cd9f61f335f12d2fef" });
test("RSBI-CJ1 golden hashes are exact", () => {
  assert.equal(fingerprints.VERSION, "RSBI-CJ1"); assert.equal(fingerprints.fingerprintSourceRecord(vector), GOLDEN.source); assert.equal(fingerprints.fingerprintCanonicalSnapshot(vector), GOLDEN.canonical); assert.equal(fingerprints.fingerprintClassificationRecord(vector), GOLDEN.classification); assert.equal(fingerprints.fingerprintRowPlan(vector), GOLDEN.row); assert.equal(fingerprints.fingerprintChildPlan(vector), GOLDEN.child); assert.equal(fingerprints.fingerprintParentPlan(vector), GOLDEN.parent);
});
test("key ordering is stable, semantic arrays stay ordered and tampering changes hashes", () => {
  assert.equal(fingerprints.hash("TEST", { a: 1, b: 2 }), fingerprints.hash("TEST", { b: 2, a: 1 }));
  assert.notEqual(fingerprints.hash("TEST", { values: [1,2] }), fingerprints.hash("TEST", { values: [2,1] }));
  assert.notEqual(fingerprints.fingerprintSourceRecord(vector), fingerprints.fingerprintSourceRecord({ ...vector, price: "11" }));
  assert.throws(() => fingerprints.hash("TEST", { id: 9007199254740993 }), /IDs must remain strings/);
});
