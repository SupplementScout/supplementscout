const assert = require("node:assert/strict");
const test = require("node:test");
const policy = require("../../config/retailers/jons-supplements");
const { evaluateGuardrails } = require("./guardrails");
const { partitionRecords } = require("./partitioner");
const { buildParentPlan } = require("./parent-plan-builder");
const { validateParentPlan, validateResumeState } = require("./validators");

const record = (id, group = id, action = "NOOP") => ({ source_record_id: String(id), dependency_group: `group:${group}`, rollback_group: `group:${group}`, proposed_action: action, primary_status: action === "CREATE_CANONICAL_PRODUCT" ? "SAFE_NEW_CANONICAL_PRODUCT" : "SAFE_EXISTING_VARIANT", approval_level: "PARENT_APPROVAL", quarantine_required: false, record_fingerprint: String(id).padStart(64, "0"), normalized_brand: "brand", normalized_product_family: String(group) });
test("partitioner is deterministic at 0/1/49/50/51/99/100 and rejects a family of 101", () => {
  for (const size of [0,1,49,50,51,99,100]) { const rows=Array.from({length:size},(_,i)=>record(i+1)); const a=partitionRecords(rows); const b=partitionRecords([...rows].reverse()); assert.deepEqual(a.map((x)=>x.map((r)=>r.source_record_id)),b.map((x)=>x.map((r)=>r.source_record_id))); assert.equal(a.flat().length,size); assert.ok(a.every((child)=>child.length<=100)); }
  assert.equal(partitionRecords(Array.from({length:100},(_,i)=>record(i+1,"family","CREATE_CANONICAL_PRODUCT"))).length,1);
  assert.throws(()=>partitionRecords(Array.from({length:101},(_,i)=>record(i+1,"family","CREATE_CANONICAL_PRODUCT"))),/exceeds 100/);
});
test("parent and child plans cover exactly 96 safe rows in deterministic 50/46 batches", () => {
  const records=Array.from({length:96},(_,i)=>record(i+1)); const sourceSnapshot={snapshot_id:"00000000-0000-4000-8000-000000000001",source_sha256:"a".repeat(64),records:records.map((r)=>({source_record_id:r.source_record_id,raw:{}}))}; const classification={classification_id:"00000000-0000-4000-8000-000000000002",totals:{SAFE_EXISTING_VARIANT:96},records}; const canonical={fingerprint:"b".repeat(64)};
  const result=buildParentPlan({classification,sourceSnapshot,canonicalSnapshot:canonical,policy}); assert.deepEqual(result.children.map((child)=>child.record_ids.length),[50,46]); assert.equal(result.parent.safe_record_ids.length,96); assert.equal(validateParentPlan(result.parent,result.children),true);
});
test("guardrail boundaries and partial child state fail closed", () => {
  const base={source_count_ratio:.9,oos_ratio:.35,oos_increase:.15,changed_record_ratio:.25,new_category_ratio:.02,missing_sku_ratio:.3,duplicate_external_id_ratio:0,mass_price_change_ratio:.19}; assert.equal(evaluateGuardrails(base,policy).passed,true); assert.equal(evaluateGuardrails({...base,source_count_ratio:.74},policy).results.find((r)=>r.name==="source_count").code,"RSBI_SOURCE_COLLAPSE"); assert.equal(evaluateGuardrails({...base,oos_ratio:.36},policy).results.find((r)=>r.name==="oos_ratio").code,"RSBI_MASS_OOS"); assert.equal(validateResumeState([{status:"APPLIED"},{status:"FAILED"},{status:"PLANNED"}]).code,"RSBI_PARTIAL_BATCH_STATE");
});
