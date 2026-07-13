const MAX_DECIMAL_PRECISION = 38;
const MAX_DECIMAL_SCALE = 18;

function normalizeDecimalString(value, fieldName = "decimal") {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`${fieldName} must be a decimal string or finite number`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be finite`);
  }

  const input = String(value).trim();
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new Error(`${fieldName} must be a valid decimal`);

  const negative = match[1] === "-";
  const integer = match[2];
  const fraction = match[3] || "";
  const exponent = Number(match[4] || "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
    throw new Error(`${fieldName} exponent is outside the supported range`);
  }

  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  let plain;
  if (decimalIndex <= 0) {
    plain = `0.${"0".repeat(-decimalIndex)}${digits}`;
  } else if (decimalIndex >= digits.length) {
    plain = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    plain = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  let [whole, decimal = ""] = plain.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  decimal = decimal.replace(/0+$/, "");
  const significant = `${whole}${decimal}`.replace(/^0+/, "");
  if ((significant || "0").length > MAX_DECIMAL_PRECISION) {
    throw new Error(`${fieldName} exceeds ${MAX_DECIMAL_PRECISION} digits of precision`);
  }
  if (decimal.length > MAX_DECIMAL_SCALE) {
    throw new Error(`${fieldName} exceeds ${MAX_DECIMAL_SCALE} decimal places`);
  }

  const normalized = decimal ? `${whole}.${decimal}` : whole;
  if (/^0(?:\.0*)?$/.test(normalized)) return "0";
  return negative ? `-${normalized}` : normalized;
}

function decimalParts(value, fieldName) {
  const normalized = normalizeDecimalString(value, fieldName);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  return { normalized, negative, whole, fraction };
}

function addDecimalStrings(left, right, fieldName = "decimal sum") {
  const a = decimalParts(left, fieldName);
  const b = decimalParts(right, fieldName);
  const scale = Math.max(a.fraction.length, b.fraction.length);
  const toScaledInteger = (parts) => {
    const digits = `${parts.whole}${parts.fraction.padEnd(scale, "0")}`;
    const amount = BigInt(digits || "0");
    return parts.negative ? -amount : amount;
  };
  const total = toScaledInteger(a) + toScaledInteger(b);
  const negative = total < 0n;
  const digits = (negative ? -total : total).toString().padStart(scale + 1, "0");
  const raw = scale
    ? `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    : `${negative ? "-" : ""}${digits}`;
  return normalizeDecimalString(raw, fieldName);
}

function assertNoUndefined(value, location = "$") {
  if (value === undefined) throw new Error(`undefined is not allowed at ${location}`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefined(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertNoUndefined(item, `${location}.${key}`);
    }
  }
}

function omitUndefinedObjectFields(value, location = "$") {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined) throw new Error(`undefined is not allowed at ${location}[${index}]`);
      return omitUndefinedObjectFields(item, `${location}[${index}]`);
    });
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, omitUndefinedObjectFields(item, `${location}.${key}`)])
    );
  }
  return value;
}

function normalizeNumbersToDecimalStrings(value, location = "$") {
  if (value === undefined) throw new Error(`undefined is not allowed at ${location}`);
  if (typeof value === "number" || typeof value === "bigint") {
    return normalizeDecimalString(value, location);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeNumbersToDecimalStrings(item, `${location}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeNumbersToDecimalStrings(item, `${location}.${key}`),
      ])
    );
  }
  return value;
}

function canonicalJson(value) {
  assertNoUndefined(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  if (typeof value === "number") return normalizeDecimalString(value);
  return JSON.stringify(value);
}

module.exports = {
  MAX_DECIMAL_PRECISION,
  MAX_DECIMAL_SCALE,
  addDecimalStrings,
  assertNoUndefined,
  canonicalJson,
  normalizeDecimalString,
  normalizeNumbersToDecimalStrings,
  omitUndefinedObjectFields,
};
