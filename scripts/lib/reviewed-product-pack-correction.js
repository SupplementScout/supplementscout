const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson, normalizeDecimalString } = require("./canonical-json");
const { TARGETS } = require("./reviewed-catalogue-target");

const CONTRACT_KIND = "reviewed-catalogue-product-pack-correction-v1";
const STATUSES = new Set(["PREPARED", "OWNER_APPROVED"]);
const HEX64 = /^[0-9a-f]{64}$/;
const PACKAGE_KEYS = Object.freeze([
  "schema_version", "kind", "status", "authorized_by", "authorized_at",
  "target_environment", "target_project_ref", "operation", "evidence", "policy",
  "package_fingerprint",
]);
const OPERATION_KEYS = Object.freeze([
  "table", "product_id", "field", "expected_before", "reviewed_after",
]);
const EVIDENCE_KEYS = Object.freeze(["preparation_artifact", "source_evidence"]);
const EVIDENCE_ITEM_KEYS = Object.freeze(["relative_path", "sha256"]);
const PREPARATION_KEYS = Object.freeze([...EVIDENCE_ITEM_KEYS, "artifact_fingerprint"]);
const POLICY_KEYS = Object.freeze([
  "single_product_row", "single_field_only", "exact_before_required",
  "strict_post_write_readback", "row_count_delta_must_be_zero",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  invariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} keys mismatch`,
  );
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function packageFingerprint(value) {
  const copy = structuredClone(value);
  copy.package_fingerprint = null;
  return sha256(Buffer.from(canonicalJson(copy), "utf8"));
}

function preparationFingerprint(value) {
  const copy = structuredClone(value);
  delete copy.artifact_fingerprint;
  return sha256(Buffer.from(canonicalJson(copy), "utf8"));
}

function repositoryFile(root, relativePath, label) {
  invariant(typeof relativePath === "string" && relativePath.replaceAll("\\", "/").startsWith("tmp/"), `${label} must be under tmp/`);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `${label} escapes repository`);
  invariant(fs.statSync(resolved).isFile(), `${label} must name a file`);
  return resolved;
}

function validatePackage(value, options = {}) {
  exactKeys(value, PACKAGE_KEYS, "Product pack correction package");
  invariant(value.schema_version === 1 && value.kind === CONTRACT_KIND, "Product pack correction package identity mismatch");
  invariant(STATUSES.has(value.status), "Product pack correction package status invalid");
  if (value.status === "OWNER_APPROVED") {
    invariant(typeof value.authorized_by === "string" && value.authorized_by.trim(), "Owner-approved package authorizer missing");
    invariant(typeof value.authorized_at === "string" && !Number.isNaN(Date.parse(value.authorized_at)), "Owner-approved package authorization time invalid");
  } else {
    invariant(value.authorized_by === null && value.authorized_at === null, "Prepared package cannot claim owner authorization");
  }
  const target = Object.values(TARGETS).find(candidate => candidate.environment === value.target_environment);
  invariant(target && value.target_project_ref === target.projectRef, "Product pack correction target mismatch");
  if (options.target) {
    invariant(TARGETS[options.target], "Product pack correction target must be staging or production");
    invariant(value.target_environment === TARGETS[options.target].environment && value.target_project_ref === TARGETS[options.target].projectRef, "Product pack correction requested target mismatch");
  }

  exactKeys(value.operation, OPERATION_KEYS, "Product pack correction operation");
  invariant(value.operation.table === "products", "Product pack correction table must be products");
  invariant(/^[1-9][0-9]*$/.test(String(value.operation.product_id)), "Product pack correction product ID invalid");
  invariant(value.operation.field === "net_weight_g", "Product pack correction field must be net_weight_g");
  const before = normalizeDecimalString(value.operation.expected_before, "expected_before");
  const after = normalizeDecimalString(value.operation.reviewed_after, "reviewed_after");
  invariant(!before.startsWith("-") && before !== "0", "Product pack correction expected_before must be positive");
  invariant(!after.startsWith("-") && after !== "0", "Product pack correction reviewed_after must be positive");
  invariant(before !== after, "Product pack correction must change net_weight_g");
  invariant(before === value.operation.expected_before && after === value.operation.reviewed_after, "Product pack correction decimals must be canonical strings");

  exactKeys(value.evidence, EVIDENCE_KEYS, "Product pack correction evidence");
  exactKeys(value.evidence.preparation_artifact, PREPARATION_KEYS, "Product pack correction preparation evidence");
  exactKeys(value.evidence.source_evidence, EVIDENCE_ITEM_KEYS, "Product pack correction source evidence");
  for (const evidence of Object.values(value.evidence)) {
    invariant(typeof evidence.relative_path === "string" && evidence.relative_path.startsWith("tmp/"), "Product pack correction evidence path invalid");
    invariant(HEX64.test(evidence.sha256), "Product pack correction evidence SHA-256 invalid");
  }
  invariant(HEX64.test(value.evidence.preparation_artifact.artifact_fingerprint), "Preparation artifact fingerprint invalid");

  exactKeys(value.policy, POLICY_KEYS, "Product pack correction policy");
  for (const key of POLICY_KEYS) invariant(value.policy[key] === true, `Product pack correction policy ${key} must be true`);
  invariant(HEX64.test(value.package_fingerprint), "Product pack correction package fingerprint invalid");
  invariant(packageFingerprint(value) === value.package_fingerprint, "Product pack correction package fingerprint mismatch");
  return value;
}

function loadPackage({ root, packagePath, packageSha256, target, verifyEvidence = true }) {
  invariant(HEX64.test(String(packageSha256 || "").toLowerCase()), "Exact product pack correction package SHA-256 required");
  const absolutePackage = repositoryFile(root, packagePath, "Product pack correction package");
  const bytes = fs.readFileSync(absolutePackage);
  invariant(sha256(bytes) === packageSha256.toLowerCase(), "Product pack correction package SHA-256 mismatch");
  const value = validatePackage(JSON.parse(bytes), { target });
  if (verifyEvidence) {
    for (const [label, evidence] of Object.entries(value.evidence)) {
      const absolute = repositoryFile(root, evidence.relative_path, `Product pack correction ${label}`);
      invariant(sha256(fs.readFileSync(absolute)) === evidence.sha256, `Product pack correction ${label} SHA-256 mismatch`);
    }
    const preparation = JSON.parse(fs.readFileSync(repositoryFile(root, value.evidence.preparation_artifact.relative_path, "Preparation artifact")));
    invariant(preparationFingerprint(preparation) === value.evidence.preparation_artifact.artifact_fingerprint, "Preparation artifact internal fingerprint mismatch");
    const correction = preparation.required_actions?.exact_product_pack_correction;
    invariant(String(preparation.target?.product_id) === value.operation.product_id, "Preparation artifact product binding mismatch");
    invariant(correction?.field === "products.net_weight_g", "Preparation artifact field binding mismatch");
    invariant(normalizeDecimalString(correction.before, "preparation before") === value.operation.expected_before, "Preparation artifact before binding mismatch");
    invariant(normalizeDecimalString(correction.after, "preparation after") === value.operation.reviewed_after, "Preparation artifact after binding mismatch");
  }
  return { value, bytes, packageSha256: packageSha256.toLowerCase(), absolutePackage };
}

function buildPreparedPackage({ root, sourceArtifactPath, sourceArtifactSha256, sourceArtifactFingerprint, evidenceSha256, target }) {
  invariant(TARGETS[target], "Product pack correction target must be staging or production");
  invariant(HEX64.test(sourceArtifactSha256) && HEX64.test(sourceArtifactFingerprint) && HEX64.test(evidenceSha256), "Product pack correction source digest invalid");
  const artifactFile = repositoryFile(root, sourceArtifactPath, "Preparation artifact");
  const artifactBytes = fs.readFileSync(artifactFile);
  invariant(sha256(artifactBytes) === sourceArtifactSha256, "Preparation artifact SHA-256 mismatch");
  const artifact = JSON.parse(artifactBytes);
  invariant(preparationFingerprint(artifact) === sourceArtifactFingerprint && artifact.artifact_fingerprint === sourceArtifactFingerprint, "Preparation artifact fingerprint mismatch");
  const correction = artifact.required_actions?.exact_product_pack_correction;
  invariant(artifact.required_actions?.pack_correction_required === true && correction?.field === "products.net_weight_g", "Preparation artifact has no supported product pack correction");
  const source = artifact.authoritative_evidence?.sources?.find(candidate => candidate.sha256 === evidenceSha256);
  invariant(source && typeof source.local_raw_path === "string", "Exact source evidence is not bound by the preparation artifact");
  const evidenceFile = repositoryFile(root, source.local_raw_path, "Source evidence");
  invariant(sha256(fs.readFileSync(evidenceFile)) === evidenceSha256, "Source evidence SHA-256 mismatch");
  const expectedBefore = normalizeDecimalString(correction.before, "prepared expected_before");
  const reviewedAfter = normalizeDecimalString(correction.after, "prepared reviewed_after");
  invariant(normalizeDecimalString(artifact.production_readback?.product?.net_weight_g, "production readback net_weight_g") === expectedBefore, "Preparation artifact current product state mismatch");
  const value = {
    schema_version: 1,
    kind: CONTRACT_KIND,
    status: "PREPARED",
    authorized_by: null,
    authorized_at: null,
    target_environment: TARGETS[target].environment,
    target_project_ref: TARGETS[target].projectRef,
    operation: {
      table: "products",
      product_id: String(artifact.target?.product_id),
      field: "net_weight_g",
      expected_before: expectedBefore,
      reviewed_after: reviewedAfter,
    },
    evidence: {
      preparation_artifact: {
        relative_path: sourceArtifactPath.replaceAll("\\", "/"),
        sha256: sourceArtifactSha256,
        artifact_fingerprint: sourceArtifactFingerprint,
      },
      source_evidence: {
        relative_path: source.local_raw_path.replaceAll("\\", "/"),
        sha256: evidenceSha256,
      },
    },
    policy: {
      single_product_row: true,
      single_field_only: true,
      exact_before_required: true,
      strict_post_write_readback: true,
      row_count_delta_must_be_zero: true,
    },
    package_fingerprint: null,
  };
  value.package_fingerprint = packageFingerprint(value);
  validatePackage(value, { target });
  return value;
}

function buildOwnerApprovedPackage(prepared, { authorizedBy, authorizedAt }) {
  validatePackage(prepared);
  invariant(prepared.status === "PREPARED", "Owner approval requires a PREPARED product pack correction package");
  invariant(
    typeof authorizedBy === "string" && /^[a-z][a-z0-9._-]{2,63}$/.test(authorizedBy),
    "Owner approval requires an explicit valid authorizer identity",
  );
  invariant(
    typeof authorizedAt === "string" && !Number.isNaN(Date.parse(authorizedAt)) && new Date(authorizedAt).toISOString() === authorizedAt,
    "Owner approval requires an exact UTC ISO authorization time",
  );
  const approved = structuredClone(prepared);
  approved.status = "OWNER_APPROVED";
  approved.authorized_by = authorizedBy;
  approved.authorized_at = authorizedAt;
  approved.package_fingerprint = packageFingerprint(approved);
  validatePackage(approved);
  return approved;
}

module.exports = {
  CONTRACT_KIND,
  buildOwnerApprovedPackage,
  buildPreparedPackage,
  exactKeys,
  loadPackage,
  packageFingerprint,
  preparationFingerprint,
  sha256,
  validatePackage,
};
