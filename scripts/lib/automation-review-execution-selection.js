function invariant(condition, code, message = code) {
  if (!condition) {
    const error = new Error(`${message} [${code}]`);
    error.code = code;
    throw error;
  }
}

function selectReviewQueueExecutionRows(classification, selection) {
  invariant(selection.maximumCommercialChanges === 1 && Number.isInteger(selection.freshnessConfirmationCount) && selection.freshnessConfirmationCount > 0, "REVIEW_EXECUTION_SCOPE_MISSING", "review execution scope missing");
  const offerId = String(selection.offerId);
  const selected = classification.rows.filter((row) => String(row.offer_id) === offerId);
  invariant(selected.length === 1 && selected[0].action === selection.operation, "REVIEW_EXECUTION_SOURCE_OPERATION_DRIFT", "review execution source no longer matches the approved operation");
  invariant(selected[0].changed_fields?.stock === true && !selected[0].changed_fields?.price && !selected[0].changed_fields?.url && !selected[0].changed_fields?.blocked, "REVIEW_EXECUTION_NOT_ISOLATED_STOCK_CHANGE", "review execution is not an isolated stock change");
  const changedOfferIds = new Set(classification.rows.filter((row) => row.action !== "VERIFY_NO_CHANGE").map((row) => String(row.offer_id)));
  const confirmations = classification.rows
    .filter((row) => !changedOfferIds.has(String(row.offer_id)) && row.action === "VERIFY_NO_CHANGE" && row.target.in_stock === true && row.source.in_stock === true && !row.changed_fields?.price && !row.changed_fields?.stock && !row.changed_fields?.url && !row.changed_fields?.blocked)
    .sort((left, right) => Number(left.offer_id) - Number(right.offer_id))
    .slice(0, selection.freshnessConfirmationCount);
  invariant(confirmations.length === selection.freshnessConfirmationCount && new Set([selected[0], ...confirmations].map((row) => String(row.offer_id))).size === 1 + selection.freshnessConfirmationCount, "REVIEW_EXECUTION_CONFIRMATION_SCOPE_DRIFT", "review execution confirmation scope mismatch");
  return [selected[0], ...confirmations];
}

module.exports = { selectReviewQueueExecutionRows };
