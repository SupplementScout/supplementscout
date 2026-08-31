const assert = require("node:assert/strict");
const test = require("node:test");
const fingerprints = require("./fingerprints");
const { canonicalTimestamp, canonicalizeTimestamps, compareTimestamps, timestampEpochNanoseconds } = require("../canonical-timestamp");

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

test("canonical timestamps preserve exact fractional precision and normalize equivalent instants", () => {
  const equivalent = [
    "2026-08-30T14:11:22.619000Z",
    "2026-08-30T14:11:22.619Z",
    "2026-08-30T14:11:22.619+00:00",
    "2026-08-30T15:11:22.619+01:00",
    new Date("2026-08-30T14:11:22.619Z"),
  ];
  assert.deepEqual(equivalent.map((value) => canonicalTimestamp(value)), Array(equivalent.length).fill("2026-08-30T14:11:22.619Z"));
  assert.equal(canonicalTimestamp("2026-08-30T14:11:22.000000Z"), "2026-08-30T14:11:22Z");
  assert.equal(compareTimestamps(equivalent[0], equivalent[1]).equal, true);
  assert.equal(compareTimestamps("2026-08-30T14:11:22.619001Z", equivalent[0]).equal, false);
  assert.equal(timestampEpochNanoseconds("2026-08-30T14:11:22.619001Z") - timestampEpochNanoseconds(equivalent[0]), 1_000n);
  assert.notEqual(canonicalTimestamp("2026-08-30T14:11:23Z"), canonicalTimestamp("2026-08-30T14:11:22Z"));
});

test("canonical timestamps fail closed for invalid, null and missing values", () => {
  for (const value of ["not-a-date", "2026-02-30T00:00:00Z", "2026-08-30T24:00:00Z", null, undefined]) {
    assert.throws(() => canonicalTimestamp(value));
  }
  assert.equal(canonicalTimestamp(null, "nullable timestamp", { allowNull: true }), null);
});

test("timestamp-aware canonical hashing treats equivalent forms identically and retains microseconds", () => {
  const left = canonicalizeTimestamps({ last_checked_at: "2026-08-30T14:11:22.619000Z" });
  const right = canonicalizeTimestamps({ last_checked_at: "2026-08-30T14:11:22.619Z" });
  const drift = canonicalizeTimestamps({ last_checked_at: "2026-08-30T14:11:22.619001Z" });
  assert.deepEqual(left, right);
  assert.notDeepEqual(left, drift);
  assert.equal(fingerprints.fingerprintSourceRecord({ observed_at: "2026-08-30T14:11:22.619000Z" }), fingerprints.fingerprintSourceRecord({ observed_at: "2026-08-30T14:11:22.619Z" }));
  assert.notEqual(fingerprints.fingerprintSourceRecord({ observed_at: "2026-08-30T14:11:22.619001Z" }), fingerprints.fingerprintSourceRecord({ observed_at: "2026-08-30T14:11:22.619000Z" }));
});
