const fs = require("node:fs");
const path = require("node:path");
const { ROOT, RPC_NAME, fail } = require("./contract");

class LocalFixtureTransport {
  constructor(fixturePath) {
    const resolved = path.resolve(fixturePath);
    const fixtureRoot = path.join(ROOT, "scripts", "test-fixtures", "ra004-staging-preflight-v1");
    const relative = path.relative(fixtureRoot, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("RA004_PREFLIGHT_FIXTURE_BLOCKED", "fixture must be tracked below the RA-004 test-fixture directory");
    this.fixture = JSON.parse(fs.readFileSync(resolved, "utf8"));
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
