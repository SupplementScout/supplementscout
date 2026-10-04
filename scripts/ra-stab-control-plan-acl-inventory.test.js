const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const inventory = require("./ra-stab-control-plan-acl-inventory");

test("classifies inherited PUBLIC reachability without guessing the V3 trigger", () => {
  const result = inventory.classifyInventory({
    schema_public_acl: [{ schema_name: "public", privilege_type: "USAGE" }],
    relation_public_acl: [{ object_kind: "S" }, { object_kind: "r" }],
    function_public_acl: [
      { schema_name: "public", object_name: "danger", identity_arguments: "", privilege_type: "EXECUTE", security_definer: true },
      { schema_name: "public", object_name: "safe", identity_arguments: "text", privilege_type: "EXECUTE", security_definer: false },
    ],
    default_public_acl: [{ object_kind: "f", privilege_type: "EXECUTE" }],
  });
  assert.deepEqual(result, {
    public_schema_usage_inherited: true,
    public_relation_privilege_count: 2,
    public_sequence_privilege_count: 1,
    public_security_definer_execute_count: 1,
    public_security_definer_signatures: ["public.danger()"],
    public_function_default_execute: true,
  });
});

test("output is restricted to the ignored control-plan directory", () => {
  assert.equal(inventory.parseArgs([`--output=${path.join(inventory.OUTPUT_ROOT, "acl.json")}`]).output,
    path.join(inventory.OUTPUT_ROOT, "acl.json"));
  assert.throws(() => inventory.parseArgs(["--output=outside.json"]), /RA_STAB_ACL_OUTPUT_INVALID/);
  assert.throws(() => inventory.parseArgs([]), /RA_STAB_ACL_ARGUMENTS_INVALID/);
});

test("writeOnce creates an immutable artifact and digest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ra-stab-acl-"));
  const output = path.join(root, "report.json");
  const result = inventory.writeOnce(output, { status: "READ_ONLY_COMPLETE" });
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.match(fs.readFileSync(result.digest_path, "utf8"), new RegExp(`^${result.sha256}  report\\.json`));
  assert.throws(() => inventory.writeOnce(output, {}), /RA_STAB_ACL_OUTPUT_EXISTS/);
});

test("inventory SQL separates schemas, relations, sequences, functions and default ACLs", () => {
  assert.match(inventory.ACL_INVENTORY_SQL, /public_database_acl/);
  assert.match(inventory.ACL_INVENTORY_SQL, /public_schema_acl/);
  assert.match(inventory.ACL_INVENTORY_SQL, /public_relation_acl/);
  assert.match(inventory.ACL_INVENTORY_SQL, /public_function_acl/);
  assert.match(inventory.ACL_INVENTORY_SQL, /public_default_acl/);
  assert.match(inventory.ACL_INVENTORY_SQL, /a\.grantee=0/g);
});
