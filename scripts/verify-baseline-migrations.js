const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const legacyDir = path.join(root, "supabase", "legacy-migrations");
const candidatePath = path.join(
  root,
  "tmp",
  "schema-baseline",
  "candidate",
  "baseline-candidate.sql",
);
const approvedBaselineSha256 =
  "A604C181255CC49E6DFA527145EAA8B3BA30767B6860A5B09FD43A32A2E08C95";

const expectedLegacy = new Map([
  ["20260630_add_duplicate_protections.sql", "383265B5E9551044F787AD59434F3212AEB031EE09EA42E0C601D4B045AFA664"],
  ["20260630_create_retailer_products.sql", "116A32B830D0FEED99F9B0D9991C297F2A79B8EE057AC3754DCEADF977A8CEF7"],
  ["20260701_add_product_merge_rpc.sql", "9D6AFFB1FFC32FFD988D2EC9E36AE3A8798AE1448154B9273896A5A8D396AA0B"],
  ["20260701_create_ignored_duplicate_product_pairs.sql", "4241583C9E1D57C3716155C4D048EBED051D9FADED0499D8B12620C52433D8B1"],
  ["20260702_add_product_merge_with_decisions_rpc.sql", "119350CA572D46CEC42DAA5D54824DB0B9B6D4D939F56A426BA49B46AED0D91B"],
  ["20260704_add_product_unit_pricing_fields.sql", "5B5056D370CC5B446234E307C2F86F7AAE1DC350083961843C76AFCC7A4E4900"],
  ["20260706_add_product_liquid_unit_pricing_fields.sql", "B7AF6D30933507B413DB2981BE0F3447DA1BF00F6B21CE54138B1BE1F7CAEDD6"],
  ["20260706_create_outbound_clicks.sql", "C8CB38A001353978E4A15253DDA3829A014A1C5389C1C5F71C070D6F3ED7613B"],
  ["20260709_create_search_events.sql", "6327F3C5628DF6A51C0068E49505B3E3A3E3AC453AC73D97CD78764945827A9E"],
  ["20260709120000_allow_goal_mapped_search_mode.sql", "EB7F553961D9954EE4BD719872F56359C2615AFDF388AC926F612B30C28F06EA"],
  ["20260712_add_product_variants_stage1.sql", "9B1C6A41978BDA2D5790AFE2CB2E46196AF359BD1F269E315A239E3505C89025"],
]);

function sha256(filePath) {
  const normalized = fs.readFileSync(filePath, "utf8").replace(/\r\n?/g, "\n");
  return crypto.createHash("sha256").update(normalized).digest("hex").toUpperCase();
}

function sqlFiles(directory) {
  return fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
}

const active = sqlFiles(migrationsDir);
assert.equal(active.length, 1, "exactly one active SQL migration is required");

const baselineMatch = active[0].match(/^(\d{14})_baseline_current_public_schema\.sql$/);
assert.ok(baselineMatch, "the active baseline must use a unique 14-digit timestamp");
const activeVersion = baselineMatch[1];

const timestampParts = activeVersion.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
const timestampDate = new Date(`${timestampParts[1]}-${timestampParts[2]}-${timestampParts[3]}T${timestampParts[4]}:${timestampParts[5]}:${timestampParts[6]}Z`);
assert.equal(
  timestampDate.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14),
  activeVersion,
  "the active baseline timestamp is not a valid calendar timestamp",
);

const legacy = sqlFiles(legacyDir);
assert.deepEqual(legacy, [...expectedLegacy.keys()].sort(), "legacy migration inventory changed");
assert.ok(
  legacy.every((name) => !name.startsWith(`${activeVersion}_`)),
  "the active baseline version collides with a legacy migration",
);
const fourteenDigitVersions = [...active, ...legacy]
  .map((name) => name.match(/^(\d{14})_/))
  .filter(Boolean)
  .map((match) => match[1]);
assert.equal(
  new Set(fourteenDigitVersions).size,
  fourteenDigitVersions.length,
  "14-digit migration versions must be unique",
);

for (const [name, expectedHash] of expectedLegacy) {
  assert.equal(sha256(path.join(legacyDir, name)), expectedHash, `${name} content changed`);
}

const baselinePath = path.join(migrationsDir, active[0]);
assert.equal(sha256(baselinePath), approvedBaselineSha256, "baseline hash differs from the approved candidate");
const baseline = fs.readFileSync(baselinePath, "utf8");
if (fs.existsSync(candidatePath)) {
  assert.notEqual(
    sha256(candidatePath),
    approvedBaselineSha256,
    "the guarded final migration must not be confused with the source candidate",
  );
}

function topLevelStatements(sql) {
  const statements = [];
  let current = "";
  let index = 0;

  while (index < sql.length) {
    if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index + 2);
      index = end === -1 ? sql.length : end + 1;
      current += " ";
      continue;
    }

    if (sql.startsWith("/*", index)) {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (sql.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      assert.equal(depth, 0, "unterminated SQL block comment");
      current += " ";
      continue;
    }

    const char = sql[index];
    if (char === "'" || char === '"') {
      const quote = char;
      current += char;
      index += 1;
      let closed = false;
      while (index < sql.length) {
        current += sql[index];
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            current += sql[index + 1];
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      assert.ok(closed, "unterminated SQL quoted value or identifier");
      continue;
    }

    if (char === "$") {
      const dollarMatch = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        const end = sql.indexOf(tag, index + tag.length);
        assert.notEqual(end, -1, `unterminated SQL dollar quote ${tag}`);
        current += " $dollar$ ";
        index = end + tag.length;
        continue;
      }
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  assert.equal(current.trim(), "", "SQL contains an unterminated top-level statement");
  return statements;
}

function normalizeStatement(statement) {
  return statement
    .replace(/"([a-z_][a-z0-9_]*)"/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const statements = topLevelStatements(baseline);
for (const statement of statements) {
  const normalized = normalizeStatement(statement);
  assert.doesNotMatch(
    normalized,
    /\b(?:INSERT\s+INTO|COPY\s+)\b/i,
    "baseline contains a top-level INSERT or COPY statement",
  );

  if (/^(?:CREATE|ALTER)\b/i.test(normalized)) {
    assert.doesNotMatch(
      normalized,
      /\b(?:auth|storage|realtime|extensions|stage1_validation)\s*\./i,
      "baseline creates or alters an object in a managed schema",
    );
    assert.doesNotMatch(
      normalized,
      /\bSCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:auth|storage|realtime|extensions|stage1_validation)\b/i,
      "baseline creates or targets a managed schema",
    );
  }
}

assert.doesNotMatch(baseline, /stage1_validation/i, "baseline contains stage1_validation");
assert.doesNotMatch(
  baseline,
  /^CREATE\s+SCHEMA.*\b(?:auth|storage|realtime|extensions)\b/im,
  "baseline creates a managed Supabase schema",
);
assert.doesNotMatch(
  baseline,
  /(?:postgres(?:ql)?:\/\/\S+|\b(?:password|api[_-]?key|secret[_-]?key)\s*[=:]\s*\S+|\bsb_secret_[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)/i,
  "baseline contains a potential secret",
);

assert.match(
  normalizeStatement(statements[0]),
  /^DO\s+\$dollar\$$/i,
  "the preflight guard must be the first executable SQL statement",
);
const guardEnd = baseline.search(/^CREATE\s+SCHEMA\b/im);
assert.ok(guardEnd > 0, "baseline is missing CREATE SCHEMA public after its guard");
const guard = baseline.slice(0, guardEnd);
for (const table of [
  "products",
  "retailers",
  "offers",
  "price_history",
  "retailer_products",
  "product_variants",
  "product_merge_history",
  "ignored_duplicate_product_pairs",
  "outbound_clicks",
  "search_events",
]) {
  assert.match(guard, new RegExp(`['\"]${table}['\"]`), `preflight guard does not cover ${table}`);
}
assert.match(
  guard,
  /baseline cannot be executed on an existing environment/i,
  "preflight guard has no clear existing-environment error",
);
assert.match(
  guard,
  /migration-history reconciliation is required/i,
  "preflight guard does not require migration-history reconciliation",
);

console.log(`PASS baseline migration ${active[0]}`);
console.log(`SHA-256 ${approvedBaselineSha256}`);
console.log(`Legacy migrations preserved: ${legacy.length}`);
