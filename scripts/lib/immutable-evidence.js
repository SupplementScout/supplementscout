const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalJson } = require("./canonical-json");

const ROOT = path.resolve(__dirname, "..", "..");
function invariant(value, code) { if (!value) throw new Error(code); }

function assertOutputPath(outputPath) {
  const resolved = path.resolve(outputPath), root = path.join(ROOT, "tmp");
  const relative = path.relative(root, resolved);
  invariant(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "IMMUTABLE_EVIDENCE_OUTPUT_BLOCKED");
  let current = root;
  for (const part of path.dirname(relative).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    invariant(!fs.existsSync(current) || !fs.lstatSync(current).isSymbolicLink(), "IMMUTABLE_EVIDENCE_OUTPUT_LINK_BLOCKED");
  }
  return resolved;
}

function writeOnce(outputPath, value, options = {}) {
  const resolved = assertOutputPath(outputPath), directory = path.dirname(resolved);
  fs.mkdirSync(directory, { recursive: true });
  invariant(!fs.existsSync(resolved) && !fs.existsSync(`${resolved}.sha256`), "IMMUTABLE_EVIDENCE_OUTPUT_EXISTS");
  const bytes = Buffer.from(`${canonicalJson(value)}\n`, "utf8");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const temporary = path.join(directory, `.${path.basename(resolved)}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
    fs.linkSync(temporary, resolved); fs.unlinkSync(temporary);
    fs.writeFileSync(`${resolved}.sha256`, `${digest}  ${path.basename(resolved)}\n`, { flag: "wx", mode: 0o600 });
    const readback = fs.readFileSync(resolved);
    const readbackDigest = options.forceReadbackFailure ? "0".repeat(64)
      : crypto.createHash("sha256").update(readback).digest("hex");
    invariant(readbackDigest === digest, "IMMUTABLE_EVIDENCE_READBACK_FAILED");
    return Object.freeze({ path: resolved, sha256: digest, bytes: bytes.length, readback_sha256: readbackDigest });
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { assertOutputPath, writeOnce };
