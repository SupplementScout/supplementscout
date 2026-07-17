const CONTRACT = require("./contracts/schemas.json");
const { fail } = require("./errors");

const SCHEMA_VERSION = 1;
const getEnum = (name) => Object.freeze([...CONTRACT.$defs[name].enum]);
const PRIMARY_STATUSES = getEnum("PrimaryStatus");
const PROPOSED_ACTIONS = getEnum("ProposedAction");
const APPROVAL_LEVELS = getEnum("ApprovalLevel");
const CONFIDENCE_LEVELS = getEnum("Confidence");
const ROW_ACTIONS = getEnum("RowAction");
const CHILD_STATUSES = getEnum("ChildStatus");
const CONTRACT_NAMES = Object.freeze([
  "RetailerSourceSnapshot", "EnrichedRetailerRecord", "RetailerSnapshotClassificationArtifact",
  "CanonicalCatalogueSnapshot", "RetailerCatalogueParentPlan", "RetailerCatalogueChildPlan",
  "RetailerRowExecutionPlan", "RetailerCatalogueRollbackManifest", "RetailerCatalogueApplyRun",
  "RetailerBulkImportPolicyConfig",
]);

function resolve(schema) {
  if (!schema?.$ref) return schema;
  const name = schema.$ref.replace("#/$defs/", "");
  return CONTRACT.$defs[name] || fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown schema ref ${schema.$ref}`);
}

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validateNode(value, inputSchema, path, errors) {
  const schema = resolve(inputSchema);
  if (schema.anyOf) {
    const valid = schema.anyOf.some((candidate) => validateNode(value, candidate, path, []).length === 0);
    if (!valid) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "No anyOf schema matched" });
    return errors;
  }
  if (schema.const !== undefined && value !== schema.const) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: `Expected constant ${schema.const}` });
  if (schema.enum && !schema.enum.includes(value)) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: `Unknown enum value ${value}` });
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: `Expected ${types.join("|")}` });
    return errors;
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "String is too short" });
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "String is too long" });
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "String does not match pattern" });
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Invalid date-time" });
    if (schema.format === "uri") { try { new URL(value); } catch { errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Invalid URI" }); } }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Number below minimum" });
    if (schema.maximum !== undefined && value > schema.maximum) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Number above maximum" });
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Too few items" });
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Too many items" });
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path, message: "Duplicate items" });
    if (schema.items) value.forEach((item, index) => validateNode(item, schema.items, `${path}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path: `${path}.${key}`, message: "Required property is missing" });
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties || {}, key)) errors.push({ code: "RSBI_SOURCE_SCHEMA_MISMATCH", path: `${path}.${key}`, message: "Unknown property" });
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) validateNode(value[key], child, `${path}.${key}`, errors);
  }
  return errors;
}

function validateContract(name, value, { throwOnError = true } = {}) {
  if (!CONTRACT_NAMES.includes(name)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", `Unknown contract ${name}`);
  const errors = validateNode(value, CONTRACT.$defs[name], "$", []);
  if (throwOnError && errors.length) fail(errors[0].code, errors[0].message, errors[0].path, { errors });
  return { valid: errors.length === 0, errors };
}

function assertIdString(value, path = "$") {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) fail("RSBI_SOURCE_SCHEMA_MISMATCH", "ID must be a decimal string", path);
  return value;
}

module.exports = { APPROVAL_LEVELS, CHILD_STATUSES, CONFIDENCE_LEVELS, CONTRACT, CONTRACT_NAMES, PRIMARY_STATUSES, PROPOSED_ACTIONS, ROW_ACTIONS, SCHEMA_VERSION, assertIdString, validateContract };
