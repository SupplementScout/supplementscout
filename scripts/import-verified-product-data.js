const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const UPDATE_FIELDS = [
  "net_weight_g",
  "serving_count_verified",
  "serving_size_g",
  "protein_per_serving_g",
  "creatine_per_serving_g",
  "unit_count",
  "unit_type",
  "product_format",
  "unit_pricing_verified",
  "nutrition_verified",
];

const REQUIRED_COLUMNS = new Set(["id"]);
const REVIEW_COLUMNS = new Set(["expected_name", "source", "notes"]);
const ALLOWED_COLUMNS = new Set([...REQUIRED_COLUMNS, ...UPDATE_FIELDS, ...REVIEW_COLUMNS]);
const PRODUCT_FORMATS = new Set([
  "powder",
  "capsule",
  "tablet",
  "gummy",
  "liquid",
  "food",
  "bar",
  "sachet",
  "accessory",
  "clothing",
  "other",
]);
const UNIT_TYPES = new Set(["capsule", "tablet", "gummy", "sachet", "serving", "scoop"]);
const PRODUCT_SELECT = [
  "id",
  "name",
  ...UPDATE_FIELDS,
].join(",");

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function hasOwn(row, field) {
  return Object.prototype.hasOwnProperty.call(row, field);
}

function parseCsvContent(content) {
  const columns = headerColumns(content);
  const fileErrors = validateColumns(columns);

  if (fileErrors.length > 0) {
    return { rows: [], fileErrors };
  }

  const rows = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return {
    rows: rows.map((row, index) => ({
      rowNumber: index + 2,
      raw: row,
      id: String(row.id || "").trim(),
    })),
    fileErrors: [],
  };
}

function validateColumns(columns) {
  if (columns.length === 0) {
    return ["CSV header is required"];
  }

  const seenColumns = new Set();
  const duplicateColumns = new Set();

  for (const column of columns) {
    if (seenColumns.has(column)) {
      duplicateColumns.add(column);
    }

    seenColumns.add(column);
  }

  const errors = [];
  const unknownColumns = columns.filter((column) => !ALLOWED_COLUMNS.has(column));

  if (unknownColumns.length > 0) {
    errors.push(`Unknown CSV column(s): ${unknownColumns.join(", ")}`);
  }

  if (duplicateColumns.size > 0) {
    errors.push(`Duplicate CSV header(s): ${Array.from(duplicateColumns).join(", ")}`);
  }

  for (const requiredColumn of REQUIRED_COLUMNS) {
    if (!seenColumns.has(requiredColumn)) {
      errors.push(`Missing required CSV column: ${requiredColumn}`);
    }
  }

  return errors;
}

function headerColumns(content) {
  if (String(content || "").trim().length === 0) {
    return [];
  }

  return (
    parse(content, {
      bom: true,
      to_line: 1,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    })[0] || []
  );
}

function validateId(id, rowNumber) {
  if (isBlank(id)) {
    return `Row ${rowNumber}: id is required`;
  }

  if (!/^[1-9][0-9]*$/.test(id)) {
    return `Row ${rowNumber}: id must be a valid positive integer string`;
  }

  return null;
}

function parseNumber(value, field, rowNumber, options) {
  if (isBlank(value)) {
    return undefined;
  }

  const number = Number(String(value).trim());

  if (!Number.isFinite(number)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a finite number`);
  }

  if (options.integer && !Number.isInteger(number)) {
    throw new Error(`Row ${rowNumber}: ${field} must be a positive integer`);
  }

  if (options.minExclusive !== undefined && number <= options.minExclusive) {
    throw new Error(`Row ${rowNumber}: ${field} must be greater than ${options.minExclusive}`);
  }

  if (options.minInclusive !== undefined && number < options.minInclusive) {
    throw new Error(`Row ${rowNumber}: ${field} must be ${options.minInclusive} or greater`);
  }

  return number;
}

function parseBoolean(value, field, rowNumber) {
  if (isBlank(value)) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new Error(`Row ${rowNumber}: ${field} must be a boolean`);
}

function parseEnum(value, field, rowNumber, allowed) {
  if (isBlank(value)) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!allowed.has(normalized)) {
    throw new Error(`Row ${rowNumber}: ${field} has an unknown value`);
  }

  return normalized;
}

function parseUpdates(row, rowNumber) {
  const updates = {};

  assignIfPresent(
    updates,
    row,
    "net_weight_g",
    parseNumber(row.net_weight_g, "net_weight_g", rowNumber, { minExclusive: 0 })
  );
  assignIfPresent(
    updates,
    row,
    "serving_count_verified",
    parseNumber(row.serving_count_verified, "serving_count_verified", rowNumber, {
      integer: true,
      minExclusive: 0,
    })
  );
  assignIfPresent(
    updates,
    row,
    "serving_size_g",
    parseNumber(row.serving_size_g, "serving_size_g", rowNumber, {
      minExclusive: 0,
    })
  );
  assignIfPresent(
    updates,
    row,
    "protein_per_serving_g",
    parseNumber(row.protein_per_serving_g, "protein_per_serving_g", rowNumber, {
      minInclusive: 0,
    })
  );
  assignIfPresent(
    updates,
    row,
    "creatine_per_serving_g",
    parseNumber(row.creatine_per_serving_g, "creatine_per_serving_g", rowNumber, {
      minInclusive: 0,
    })
  );
  assignIfPresent(
    updates,
    row,
    "unit_count",
    parseNumber(row.unit_count, "unit_count", rowNumber, {
      integer: true,
      minExclusive: 0,
    })
  );
  assignIfPresent(
    updates,
    row,
    "unit_type",
    parseEnum(row.unit_type, "unit_type", rowNumber, UNIT_TYPES)
  );
  assignIfPresent(
    updates,
    row,
    "product_format",
    parseEnum(row.product_format, "product_format", rowNumber, PRODUCT_FORMATS)
  );
  assignIfPresent(
    updates,
    row,
    "unit_pricing_verified",
    parseBoolean(row.unit_pricing_verified, "unit_pricing_verified", rowNumber)
  );
  assignIfPresent(
    updates,
    row,
    "nutrition_verified",
    parseBoolean(row.nutrition_verified, "nutrition_verified", rowNumber)
  );

  return updates;
}

function assignIfPresent(target, row, field, value) {
  if (hasOwn(row, field) && value !== undefined) {
    target[field] = value;
  }
}

function analyzeRows(parsedRows, currentProductsById) {
  const seenIds = new Set();

  return parsedRows.map((parsedRow) => {
    const errors = [];
    const { raw, rowNumber, id } = parsedRow;
    const idError = validateId(id, rowNumber);

    if (idError) {
      errors.push(idError);
    } else if (seenIds.has(id)) {
      errors.push(`Row ${rowNumber}: duplicate product id ${id}`);
    }

    seenIds.add(id);

    const current = currentProductsById.get(id) || null;

    if (!idError && !current) {
      errors.push(`Row ${rowNumber}: product id ${id} does not exist`);
    }

    if (current && !isBlank(raw.expected_name) && raw.expected_name.trim() !== current.name) {
      errors.push(`Row ${rowNumber}: expected_name does not match current product name`);
    }

    let updates = {};

    try {
      updates = parseUpdates(raw, rowNumber);
    } catch (error) {
      errors.push(error.message);
    }

    const effective = current ? { ...current, ...updates } : { ...updates };
    validateEffectiveValues(effective, rowNumber, errors);

    const changes = current ? buildChanges(current, updates) : [];

    return {
      rowNumber,
      id,
      currentName: current?.name || null,
      changes,
      errors,
      valid: errors.length === 0,
      updates,
    };
  });
}

function validateEffectiveValues(effective, rowNumber, errors) {
  if (
    effective.protein_per_serving_g !== null &&
    effective.protein_per_serving_g !== undefined &&
    effective.serving_size_g !== null &&
    effective.serving_size_g !== undefined &&
    Number(effective.protein_per_serving_g) > Number(effective.serving_size_g)
  ) {
    errors.push(`Row ${rowNumber}: protein_per_serving_g cannot exceed serving_size_g`);
  }

  if (
    effective.creatine_per_serving_g !== null &&
    effective.creatine_per_serving_g !== undefined &&
    effective.serving_size_g !== null &&
    effective.serving_size_g !== undefined &&
    Number(effective.creatine_per_serving_g) > Number(effective.serving_size_g)
  ) {
    errors.push(`Row ${rowNumber}: creatine_per_serving_g cannot exceed serving_size_g`);
  }

  if (
    effective.unit_pricing_verified === true &&
    isBlank(effective.serving_count_verified) &&
    isBlank(effective.net_weight_g) &&
    isBlank(effective.unit_count)
  ) {
    errors.push(
      `Row ${rowNumber}: unit_pricing_verified requires serving_count_verified, net_weight_g, or unit_count`
    );
  }

  if (
    effective.nutrition_verified === true &&
    isBlank(effective.protein_per_serving_g) &&
    isBlank(effective.creatine_per_serving_g)
  ) {
    errors.push(
      `Row ${rowNumber}: nutrition_verified requires protein_per_serving_g or creatine_per_serving_g`
    );
  }
}

function buildChanges(current, updates) {
  return Object.entries(updates)
    .filter(([field, value]) => !sameValue(current[field], value))
    .map(([field, value]) => ({
      field,
      oldValue: current[field],
      newValue: value,
    }));
}

function sameValue(left, right) {
  if (typeof left === "boolean" || typeof right === "boolean") {
    return left === right;
  }

  if (left === null || left === undefined || right === null || right === undefined) {
    return left === right;
  }

  return String(left) === String(right);
}

function summarizeResults(results, fileErrors = []) {
  const validRows = results.filter((result) => result.valid);
  const invalidRows = results.filter((result) => !result.valid);
  const changedResults = validRows.filter((result) => result.changes.length > 0);
  const fieldsToChange = Array.from(
    new Set(changedResults.flatMap((result) => result.changes.map((change) => change.field)))
  ).sort();

  return {
    totalRows: results.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length + fileErrors.length,
    productsToUpdate: changedResults.length,
    fieldsToChange,
    applyAllowed: false,
  };
}

function buildReviewSql(results) {
  const changedResults = results.filter((result) => result.valid && result.changes.length > 0);

  if (changedResults.length === 0) {
    return "";
  }

  const statements = ["begin;"];

  for (const result of changedResults) {
    const assignments = result.changes
      .map((change) => `  ${change.field} = ${sqlLiteral(change.newValue)}`)
      .join(",\n");

    statements.push(
      "",
      `-- ${result.currentName}`,
      "select id, name",
      result.changes.map((change) => `  , ${change.field}`).join("\n"),
      "from public.products",
      `where id = ${sqlLiteral(result.id)};`,
      "",
      "update public.products",
      "set",
      assignments,
      `where id = ${sqlLiteral(result.id)};`,
      "",
      "select id, name",
      result.changes.map((change) => `  , ${change.field}`).join("\n"),
      "from public.products",
      `where id = ${sqlLiteral(result.id)};`
    );
  }

  statements.push("", "-- Review row counts and changed products before replacing rollback.", "-- commit;", "rollback;");

  return statements.join("\n");
}

function sqlLiteral(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatDryRunReport(results, summary, fileErrors = []) {
  const lines = ["Verified product data import dry run", ""];

  for (const error of fileErrors) {
    lines.push(`File error: ${error}`);
  }

  for (const result of results) {
    lines.push(`Row ${result.rowNumber} product ${result.id || "(missing id)"}`);
    lines.push(`  Name: ${result.currentName || "(not found)"}`);

    if (result.changes.length > 0) {
      lines.push("  Changes:");

      for (const change of result.changes) {
        lines.push(
          `    ${change.field}: ${displayValue(change.oldValue)} -> ${displayValue(change.newValue)}`
        );
      }
    } else {
      lines.push("  Changes: none");
    }

    if (result.errors.length > 0) {
      lines.push("  Errors:");

      for (const error of result.errors) {
        lines.push(`    ${error}`);
      }
    }

    lines.push(`  Validation: ${result.valid ? "valid" : "invalid"}`, "");
  }

  lines.push("Summary");
  lines.push(`  total rows: ${summary.totalRows}`);
  lines.push(`  valid rows: ${summary.validRows}`);
  lines.push(`  invalid rows: ${summary.invalidRows}`);
  lines.push(`  products to update: ${summary.productsToUpdate}`);
  lines.push(`  fields to change: ${summary.fieldsToChange.join(", ") || "none"}`);
  lines.push(`  apply allowed: ${summary.applyAllowed ? "yes" : "no"}`);

  const sql = buildReviewSql(results);

  if (sql) {
    lines.push("", "Review SQL (manual execution only):", sql);
  }

  return lines.join("\n");
}

function displayValue(value) {
  return value === null || value === undefined ? "(blank)" : String(value);
}

async function fetchCurrentProducts(supabase, ids) {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", ids);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((product) => [String(product.id), product]));
}

async function runCli(argv = process.argv.slice(2)) {
  const { csvPath, apply } = parseArgs(argv);

  if (!csvPath) {
    throw new Error("Usage: node scripts/import-verified-product-data.js <csv-file> [--apply]");
  }

  if (apply) {
    throw new Error(
      "--apply is disabled in V1 because atomic writes require a future service-role RPC."
    );
  }

  dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }

  const content = fs.readFileSync(path.resolve(csvPath), "utf8");
  const parsed = parseCsvContent(content);
  const ids = parsed.rows
    .map((row) => row.id)
    .filter((id) => /^[1-9][0-9]*$/.test(id));
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const currentProductsById = await fetchCurrentProducts(supabase, ids);
  const results = analyzeRows(parsed.rows, currentProductsById);
  const summary = summarizeResults(results, parsed.fileErrors);
  const report = formatDryRunReport(results, summary, parsed.fileErrors);

  console.log(report);

  if (summary.invalidRows > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const allowedFlags = new Set(["--apply"]);
  const unknownFlags = argv.filter((arg) => arg.startsWith("--") && !allowedFlags.has(arg));

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown option(s): ${unknownFlags.join(", ")}`);
  }

  const csvPaths = argv.filter((arg) => !arg.startsWith("--"));

  if (csvPaths.length > 1) {
    throw new Error("Only one CSV file path may be supplied");
  }

  return {
    csvPath: csvPaths[0],
    apply: argv.includes("--apply"),
  };
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  ALLOWED_COLUMNS,
  PRODUCT_SELECT,
  analyzeRows,
  buildReviewSql,
  fetchCurrentProducts,
  formatDryRunReport,
  parseBoolean,
  parseArgs,
  parseCsvContent,
  parseUpdates,
  summarizeResults,
  validateId,
};
