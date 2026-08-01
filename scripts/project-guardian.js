const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PATHS = Object.freeze({
  agents: "AGENTS.md",
  operating: "docs/SupplementScout-Operating-Plan-2026-07-15.md",
  seo: "docs/SEO-Execution-Plan.md",
  agentModel: "docs/Agent-Operating-Model.md",
  competitor: "docs/Competitive-Intelligence/WheyWise-Analysis-2026-07.md",
});
const ALLOWED_STATUSES = new Set([
  "PLANNED",
  "IN PROGRESS",
  "CODE COMPLETE",
  "LIVE VERIFIED",
  "BLOCKED",
  "DEFERRED",
]);

function normalize(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function loadDocuments(root = ROOT) {
  return Object.fromEntries(
    Object.entries(PATHS).map(([key, relative]) => [
      key,
      normalize(fs.readFileSync(path.join(root, relative), "utf8")),
    ]),
  );
}

function section(text, heading, nextLevelPattern) {
  const start = text.indexOf(heading);
  if (start === -1) return "";
  const bodyStart = start + heading.length;
  const tail = text.slice(bodyStart);
  const match = tail.match(nextLevelPattern);
  return match ? tail.slice(0, match.index) : tail;
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseSeoLedger(seo, errors) {
  const rows = [];
  for (const line of seo.split("\n")) {
    if (!/^\|\s*SEO-\d+[A-Z]?\s*\|/i.test(line)) continue;
    const cells = tableCells(line);
    if (cells.length < 5) {
      errors.push(`SEO ledger row is malformed: ${line}`);
      continue;
    }
    rows.push({
      id: cells[0].toUpperCase(),
      priority: cells[1],
      task: cells[2],
      status: cells[3].replace(/`/g, "").toUpperCase(),
      done: cells.slice(4).join(" | "),
    });
  }
  if (rows.length === 0) errors.push("SEO ledger contains no task rows.");
  const ids = rows.map((row) => row.id);
  if (new Set(ids).size !== ids.length) errors.push("SEO ledger contains duplicate task IDs.");
  for (const row of rows) {
    if (!ALLOWED_STATUSES.has(row.status)) {
      errors.push(`${row.id} has unsupported status ${row.status || "<empty>"}.`);
    }
  }
  return rows;
}

function evidenceBlocksFor(evidence, id) {
  return evidence
    .split(/\n(?=###\s+)/)
    .filter((block) => block.includes(id));
}

function parseEnglishDate(value) {
  const date = new Date(`${value} 12:00:00 UTC`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(older, newer) {
  return Math.floor((newer.getTime() - older.getTime()) / 86_400_000);
}

function latestDatedHeading(text) {
  const dates = [];
  for (const match of text.matchAll(/^###\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*$/gm)) {
    const date = parseEnglishDate(match[1]);
    if (date) dates.push(date);
  }
  return dates.sort((a, b) => b - a)[0] || null;
}

function latestWeeklyMeasurement(text) {
  const dates = [];
  for (const match of text.matchAll(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*Weekly GSC\/GA4\s*\|/gim)) {
    const date = new Date(`${match[1]}T12:00:00Z`);
    if (!Number.isNaN(date.getTime())) dates.push(date);
  }
  for (const match of text.matchAll(/^###\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(?:-|\u2014)\s+weekly measurement/gim)) {
    const date = parseEnglishDate(match[1]);
    if (date) dates.push(date);
  }
  return dates.sort((a, b) => b - a)[0] || null;
}

function statusDate(text) {
  const match = text.match(/\*\*Status date:\*\*\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  return match ? parseEnglishDate(match[1]) : null;
}

function validateDocuments(docs, now = new Date()) {
  const errors = [];
  const warnings = [];
  const rows = parseSeoLedger(docs.seo, errors);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const weeklyMeasurement = latestWeeklyMeasurement(docs.seo);
  const currentSeoTask = section(
    docs.seo,
    "## 6. Current active task",
    /\n##\s+/,
  );
  if (
    weeklyMeasurement &&
    /(?:first authenticated[^.\n]*not yet configured|awaits an authenticated report view)/i.test(
      `${byId.get("SEO-07")?.done || ""}\n${currentSeoTask}`
    )
  ) {
    errors.push(
      "SEO-07 still claims authenticated measurement is unavailable after a dated weekly GSC/GA4 record."
    );
  }
  const inProgress = rows.filter((row) => row.status === "IN PROGRESS");
  if (inProgress.length > 1) {
    errors.push(`More than one SEO task is IN PROGRESS: ${inProgress.map((row) => row.id).join(", ")}.`);
  }

  const nextMatch = docs.seo.match(/\*\*Next executable task:\*\*\s*(SEO-\d+[A-Z]?)/i);
  const nextId = nextMatch ? nextMatch[1].toUpperCase() : null;
  if (!nextId) errors.push("SEO plan does not declare a Next executable task.");
  const nextRow = nextId ? byId.get(nextId) : null;
  if (nextId && !nextRow) errors.push(`Next executable task ${nextId} is missing from the SEO ledger.`);
  if (nextRow && !["PLANNED", "IN PROGRESS", "CODE COMPLETE"].includes(nextRow.status)) {
    errors.push(`Next executable task ${nextId} cannot have status ${nextRow.status}.`);
  }
  if (inProgress.length === 1 && nextId !== inProgress[0].id) {
    errors.push(`IN PROGRESS task ${inProgress[0].id} does not match next executable task ${nextId}.`);
  }

  const immediate = section(
    docs.operating,
    "### Current active task",
    /\n###\s+/,
  );
  const operatingMatch = immediate.match(/\b(SEO-\d+[A-Z]?)\b/i);
  const operatingId = operatingMatch ? operatingMatch[1].toUpperCase() : null;
  if (!operatingId) errors.push("Operating Plan current active task does not name an SEO task.");
  if (nextId && operatingId && nextId !== operatingId) {
    errors.push(`Operating Plan active task ${operatingId} does not match SEO next task ${nextId}.`);
  }

  const growth = section(
    docs.operating,
    "### 0.0.7 Competitive growth sequence - 31 July 2026",
    /\n###\s+/,
  );
  const growthMatch = growth.match(/\n1\.\s+(?:complete\s+)?`?(SEO-\d+[A-Z]?)/i);
  const growthId = growthMatch ? growthMatch[1].toUpperCase() : null;
  if (!growthId) errors.push("Binding competitive growth sequence has no first SEO task.");
  if (nextId && growthId && nextId !== growthId) {
    errors.push(`Binding growth task ${growthId} does not match SEO next task ${nextId}.`);
  }

  const competitive = section(
    docs.competitor,
    "## Binding competitive-response sequence",
    /\n##\s+/,
  );
  const competitiveMatch = competitive.match(/\n1\.\s+(?:complete\s+)?`?(SEO-\d+[A-Z]?)/i);
  const competitiveId = competitiveMatch ? competitiveMatch[1].toUpperCase() : null;
  if (!competitiveId) errors.push("WheyWise competitive-response sequence has no first SEO task.");
  if (nextId && competitiveId && nextId !== competitiveId) {
    errors.push(`WheyWise response task ${competitiveId} does not match SEO next task ${nextId}.`);
  }

  const evidence = section(docs.seo, "## 11. Execution evidence", /\n##\s+/);
  for (const row of rows) {
    const blocks = evidenceBlocksFor(evidence, row.id);
    if (row.status === "LIVE VERIFIED") {
      const combined = blocks.join("\n");
      if (!/LIVE VERIFIED/i.test(combined)) {
        errors.push(`${row.id} is LIVE VERIFIED but has no matching live evidence entry.`);
      } else {
        if (!/\b(?:public|production|live)\b/i.test(combined)) {
          errors.push(`${row.id} is LIVE VERIFIED but has no public/production verification evidence.`);
        }
        if (!/\b(?:test|tests|build|lint|local)\b/i.test(combined)) {
          errors.push(`${row.id} is LIVE VERIFIED but has no local verification evidence.`);
        }
      }
    }
    if (row.status === "CODE COMPLETE" && blocks.length === 0) {
      errors.push(`${row.id} is CODE COMPLETE but has no execution evidence entry.`);
    }
    if (row.status === "BLOCKED" && !/blocker|blocked/i.test(row.done)) {
      errors.push(`${row.id} is BLOCKED but its ledger row does not name the blocker.`);
    }
  }

  for (const required of [PATHS.operating, PATHS.seo, PATHS.agentModel]) {
    if (!docs.agents.includes(required)) errors.push(`AGENTS.md does not bind ${required}.`);
  }
  if (!docs.operating.includes(PATHS.agentModel)) {
    errors.push("Operating Plan does not reference the Agent Operating Model.");
  }
  if (!docs.seo.includes(PATHS.agentModel)) {
    errors.push("SEO plan does not reference the Agent Operating Model.");
  }

  for (const [label, text] of [["Operating Plan", docs.operating], ["SEO plan", docs.seo]]) {
    const date = statusDate(text);
    if (!date) errors.push(`${label} has no valid Status date.`);
    else if (daysBetween(date, now) > 14) warnings.push(`${label} status date is more than 14 days old.`);
  }

  const competitorReview = latestDatedHeading(docs.competitor);
  if (!competitorReview) errors.push("WheyWise analysis has no dated review entry.");
  else if (daysBetween(competitorReview, now) > 35) {
    warnings.push("WheyWise comparison review is more than 35 days old.");
  }

  if (!weeklyMeasurement) {
    warnings.push("Weekly GSC/GA4 measurement evidence is not yet recorded; SEO-07 remains the evidence gate.");
  } else if (daysBetween(weeklyMeasurement, now) > 8) {
    warnings.push("Weekly GSC/GA4 measurement evidence is more than 8 days old.");
  }

  return {
    ok: errors.length === 0,
    nextTask: nextId,
    inProgress: inProgress.map((row) => row.id),
    checkedTasks: rows.length,
    errors,
    warnings,
  };
}

function formatReport(report) {
  const lines = [
    report.ok ? "PROJECT GUARDIAN: PASS" : "PROJECT GUARDIAN: BLOCKED",
    `SEO tasks checked: ${report.checkedTasks}`,
    `Next task: ${report.nextTask || "not found"}`,
    `In progress: ${report.inProgress.length ? report.inProgress.join(", ") : "none"}`,
  ];
  for (const warning of report.warnings) lines.push(`REMINDER: ${warning}`);
  for (const error of report.errors) lines.push(`ERROR: ${error}`);
  return lines.join("\n");
}

function main() {
  if (process.argv.length !== 2) throw new Error("project guardian accepts no runtime arguments");
  const report = validateDocuments(loadDocuments(), new Date());
  console.log(formatReport(report));
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  ALLOWED_STATUSES,
  PATHS,
  formatReport,
  loadDocuments,
  parseSeoLedger,
  validateDocuments,
};
