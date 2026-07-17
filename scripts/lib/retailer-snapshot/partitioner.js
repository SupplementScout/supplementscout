const { fingerprintChildPlan } = require("./fingerprints");
const { fail } = require("./errors");

const PHASE = Object.freeze({ CREATE_CANONICAL_FAMILY: 0, CREATE_CANONICAL_PRODUCT: 0, CREATE_CANONICAL_VARIANT: 0, CREATE_MAPPING_AND_OFFER: 1, UPDATE_OFFER: 2, NOOP: 2 });
const compare = (a, b) => (PHASE[a.proposed_action] ?? 9) - (PHASE[b.proposed_action] ?? 9) || String(a.normalized_brand || "").localeCompare(String(b.normalized_brand || "")) || String(a.normalized_product_family || "").localeCompare(String(b.normalized_product_family || "")) || String(a.dependency_group).localeCompare(String(b.dependency_group), "en", { numeric: true }) || String(a.source_record_id).localeCompare(String(b.source_record_id), "en", { numeric: true });

function partitionRecords(records, { preferred = 50, maximum = 100 } = {}) {
  if (!Number.isInteger(preferred) || !Number.isInteger(maximum) || preferred < 1 || maximum > 100 || preferred > maximum) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "Invalid partition limits");
  const groups = new Map();
  for (const record of records) { const key = record.dependency_group; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); }
  const orderedGroups = [...groups.values()].map((group) => group.sort(compare)).sort((a, b) => compare(a[0], b[0]));
  for (const group of orderedGroups) if (group.length > maximum) fail("RSBI_GUARDRAIL_EXCEEDED", `Dependency group exceeds ${maximum}`, "$.records", { dependency_group: group[0].dependency_group, size: group.length });
  const children = []; let current = [];
  for (const group of orderedGroups) {
    if (current.length && current.length + group.length > preferred) { children.push(current); current = []; }
    if (group.length > preferred) children.push(group); else current.push(...group);
  }
  if (current.length) children.push(current);
  const assigned = children.flat().map((record) => record.source_record_id);
  if (assigned.length !== records.length || new Set(assigned).size !== records.length) fail("RSBI_DUPLICATE_IDENTITY", "Partition coverage is not exact");
  return children;
}

function stableChildLocator(parentCoreFingerprint, index, records) { return `child-${index + 1}-${fingerprintChildPlan({ parent_core_fingerprint: parentCoreFingerprint, record_ids: records.map((record) => record.source_record_id) }).slice(0, 16)}`; }
module.exports = { compare, partitionRecords, stableChildLocator };
