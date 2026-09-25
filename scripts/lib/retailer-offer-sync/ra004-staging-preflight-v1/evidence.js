const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ROOT, fail } = require("./contract");
const { canonical } = require("../../stable-json-hash");

function assertOutputPath(outputPath) {
  const resolved = path.resolve(outputPath);
  const root = path.join(ROOT, "tmp");
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("RA004_PREFLIGHT_OUTPUT_BLOCKED", "evidence must be a new file below tmp");
  let current = root;
  for (const part of path.dirname(relative).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail("RA004_PREFLIGHT_OUTPUT_BLOCKED", "evidence path cannot traverse a link");
  }
  return resolved;
}

function writeOnce(outputPath, value, options = {}) {
  const resolved = assertOutputPath(outputPath);
  const directory = path.dirname(resolved);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(resolved) || fs.existsSync(`${resolved}.sha256`)) fail("RA004_PREFLIGHT_OUTPUT_EXISTS", "evidence is write-once");
  const bytes = Buffer.from(`${canonical(value)}\n`, "utf8");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const temporary = path.join(directory, `.${path.basename(resolved)}.${crypto.randomBytes(8).toString("hex")}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
    fs.linkSync(temporary, resolved); fs.unlinkSync(temporary);
    fs.writeFileSync(`${resolved}.sha256`, `${digest}  ${path.basename(resolved)}\n`, { flag: "wx", mode: 0o600 });
    const readback = fs.readFileSync(resolved);
    const readbackDigest = options.forceReadbackFailure ? "0".repeat(64) : crypto.createHash("sha256").update(readback).digest("hex");
    if (readbackDigest !== digest) fail("RA004_PREFLIGHT_READBACK_FAILED", "evidence readback digest mismatch");
    return Object.freeze({ path: resolved, sha256: digest, bytes: bytes.length, readback_sha256: readbackDigest });
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { assertOutputPath, writeOnce };
