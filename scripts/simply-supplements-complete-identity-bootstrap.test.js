const assert = require("node:assert/strict");
const test = require("node:test");
const { parseArgs } = require("./simply-supplements-complete-identity-bootstrap");

test("complete identity bootstrap CLI is restricted to tmp", () => {
  assert.equal(parseArgs(["--identity=tmp/i.json", "--options=tmp/p.json", "--output=tmp/o.json"]).output.endsWith("o.json"), true);
  assert.throws(() => parseArgs(["--identity=tmp/i.json", "--options=tmp/p.json", "--output=../o.json"]), /inside tmp/);
});
