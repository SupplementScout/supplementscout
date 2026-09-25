const fs = require("node:fs");
const path = require("node:path");
const { ROOT, RPC_NAME, fail } = require("./contract");

class LocalFixtureTransport {
  constructor(fixturePath) {
    const resolved = path.resolve(fixturePath);
    const fixtureRoot = path.join(ROOT, "scripts", "test-fixtures", "ra004-staging-preflight-v1");
    const realRoot = fs.realpathSync(fixtureRoot);
    let realFixture;
    try { realFixture = fs.realpathSync(resolved); }
    catch { fail("RA004_PREFLIGHT_FIXTURE_BLOCKED", "fixture must exist below the RA-004 test-fixture directory"); }
    const relative = path.relative(realRoot, realFixture);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(realFixture) !== ".json" || !fs.statSync(realFixture).isFile()) fail("RA004_PREFLIGHT_FIXTURE_BLOCKED", "fixture must be a real tracked JSON file below the RA-004 test-fixture directory");
    this.fixture = JSON.parse(fs.readFileSync(realFixture, "utf8"));
  }
  async readProjectIdentity() { return structuredClone(this.fixture.project_identity); }
  async readEvidenceStoreMetadata() { return structuredClone(this.fixture.evidence_store); }
  async callMetadataRpc(request) {
    if (request.function_name !== RPC_NAME) fail("RA004_PREFLIGHT_RPC_BLOCKED", "arbitrary RPC names are forbidden");
    return { function_name: RPC_NAME, session_user: request.parameters.p_expected_session_user, transaction_read_only: true, data: structuredClone(this.fixture.metadata) };
  }
  async revoke() { return { access_revoked: true }; }
  async close() { return { connection_closed: true }; }
}

module.exports = { LocalFixtureTransport };
