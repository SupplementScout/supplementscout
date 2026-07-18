const TRANSITIONS = Object.freeze({
  SNAPSHOT_CAPTURED: new Set(["CLASSIFIED", "BLOCKED"]), CLASSIFIED: new Set(["DRY_RUN_READY", "BLOCKED"]),
  DRY_RUN_READY: new Set(["APPROVED", "SUPERSEDED"]), APPROVED: new Set(["APPLYING", "SUPERSEDED"]),
  APPLYING: new Set(["APPLIED", "FAILED"]), FAILED: new Set(["SUPERSEDED"]), APPLIED: new Set(), BLOCKED: new Set(), SUPERSEDED: new Set(),
});
function canTransition(from, to) { return Boolean(TRANSITIONS[from]?.has(to)); }
function transition(from, to) { if (!canTransition(from, to)) throw new Error(`Forbidden mixed-batch transition: ${from} -> ${to}`); return to; }
module.exports = { TRANSITIONS, canTransition, transition };
