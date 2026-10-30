function waitForStablePostgres(probe, options = {}) {
  if (typeof probe !== "function") throw new TypeError("PostgreSQL readiness probe is required");
  const attempts = options.attempts ?? 100;
  const intervalMs = options.intervalMs ?? 250;
  const requiredConsecutive = options.requiredConsecutive ?? 3;
  let consecutive = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = probe();
    consecutive = result?.status === 0 && String(result.stdout || "").trim() === "1"
      ? consecutive + 1
      : 0;
    if (consecutive >= requiredConsecutive) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  throw new Error(options.message || "disposable PostgreSQL did not reach a stable ready state");
}

module.exports = { waitForStablePostgres };
