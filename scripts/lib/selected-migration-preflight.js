const fs = require("node:fs");
const path = require("node:path");
const { sha256File } = require("./environment-migrations");

// The sealed migration owns the predicate. The verifier and applicator execute
// exactly that SELECT; the activation transaction repeats it under its lock.
function selectedMigrationPreflightSql(pending, sourceDir) {
  if (pending.preflight_required !== true) return null;
  const file = path.join(sourceDir, pending.filename);
  if (sha256File(file) !== pending.sha256) throw new Error("selected preflight migration hash mismatch");
  const sql = fs.readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const begin = "-- SELECTED_MIGRATION_PREFLIGHT_BEGIN";
  const end = "-- SELECTED_MIGRATION_PREFLIGHT_END";
  if (sql.split(begin).length !== 2 || sql.split(end).length !== 2
      || sql.indexOf(end) <= sql.indexOf(begin)) throw new Error("selected preflight markers missing or ambiguous");
  const query = sql.slice(sql.indexOf(begin) + begin.length, sql.indexOf(end)).trim();
  const statement = query.replace(/--[^\n]*/g, "");
  const into = /\binto v_selected_preflight_blockers\b/g;
  if ((query.match(into) || []).length !== 1 || !/^with\s/.test(query)
      || !/;\s*$/.test(statement) || statement.split(";").length !== 2) {
    throw new Error("selected preflight must be one sealed SELECT INTO");
  }
  return query.replace(into, "");
}

async function verifySelectedMigrationPreflight(client, pending, sourceDir) {
  const checks = [];
  for (const migration of pending) {
    const sql = selectedMigrationPreflightSql(migration, sourceDir);
    if (sql === null) continue;
    const result = await client.query(sql);
    const blockers = result.rows?.length === 1 ? result.rows[0].blockers : null;
    if (!Array.isArray(blockers)) throw new Error("selected preflight evidence missing");
    if (blockers.length) {
      const error = new Error("OWNER_WITHDRAWAL_PENDING_CONTROL: " + JSON.stringify(blockers));
      error.code = "OWNER_WITHDRAWAL_PENDING_CONTROL";
      error.blockers = blockers;
      throw error;
    }
    checks.push({ filename: migration.filename, result: "PASS", blockers });
  }
  return checks;
}

module.exports = { selectedMigrationPreflightSql, verifySelectedMigrationPreflight };
