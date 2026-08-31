const TIMESTAMP_KEYS = new Set([
  "captured_at",
  "checked_at",
  "created_at",
  "decision_at",
  "expires_at",
  "last_checked_at",
  "source_captured_at",
  "updated_at",
]);

function fail(label, message) {
  throw new Error(`${label} ${message}`);
}

function floorDiv(value, divisor) {
  let quotient = value / divisor;
  if (value < 0n && value % divisor !== 0n) quotient -= 1n;
  return quotient;
}

function timestampEpochNanoseconds(value, label = "timestamp", { allowNull = false } = {}) {
  if (value === null) {
    if (allowNull) return null;
    return fail(label, "must not be null");
  }
  if (value === undefined) return fail(label, "is required");
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return fail(label, "must be valid");
    return BigInt(value.getTime()) * 1_000_000n;
  }
  if (typeof value !== "string") return fail(label, "must be an RFC3339 string or Date");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) return fail(label, "must be an RFC3339 timestamp with at most nanosecond precision");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = "", zone] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  if (hour > 23 || minute > 59 || second > 59) return fail(label, "contains an invalid time");
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, 0);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day
      || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second) {
    return fail(label, "contains an invalid calendar date");
  }
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const sign = zone[0] === "+" ? 1 : -1;
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return fail(label, "contains an invalid UTC offset");
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }
  return BigInt(local.getTime() - offsetMinutes * 60_000) * 1_000_000n
    + BigInt(fraction.padEnd(9, "0") || "0");
}

function canonicalTimestamp(value, label = "timestamp", options = {}) {
  const nanoseconds = timestampEpochNanoseconds(value, label, options);
  if (nanoseconds === null) return null;
  const second = floorDiv(nanoseconds, 1_000_000_000n);
  const fraction = nanoseconds - second * 1_000_000_000n;
  const milliseconds = Number(second * 1_000n);
  if (!Number.isSafeInteger(milliseconds)) return fail(label, "is outside the supported JavaScript calendar range");
  const base = new Date(milliseconds).toISOString().slice(0, 19);
  const significantFraction = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  return `${base}${significantFraction ? `.${significantFraction}` : ""}Z`;
}

function compareTimestamps(left, right, label = "timestamp") {
  const leftNanoseconds = timestampEpochNanoseconds(left, `${label} left`);
  const rightNanoseconds = timestampEpochNanoseconds(right, `${label} right`);
  const leftCanonical = canonicalTimestamp(left, `${label} left`);
  const rightCanonical = canonicalTimestamp(right, `${label} right`);
  return {
    leftCanonical,
    rightCanonical,
    equal: leftCanonical === rightCanonical,
    order: leftNanoseconds < rightNanoseconds ? -1 : leftNanoseconds === rightNanoseconds ? 0 : 1,
  };
}

function canonicalizeTimestamps(value, keys = TIMESTAMP_KEYS, key = "") {
  if (value instanceof Date) return keys.has(key) ? canonicalTimestamp(value, key) : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => canonicalizeTimestamps(item, keys, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [
      childKey,
      keys.has(childKey) && item !== null ? canonicalTimestamp(item, childKey) : canonicalizeTimestamps(item, keys, childKey),
    ]));
  }
  return value;
}

module.exports = {
  TIMESTAMP_KEYS,
  canonicalTimestamp,
  canonicalizeTimestamps,
  compareTimestamps,
  timestampEpochNanoseconds,
};
