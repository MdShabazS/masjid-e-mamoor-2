/** Use the last row of a descending keyset page as the next database cursor. */
export function financePageCursor(rows, idField, timeField) {
  const last = rows[rows.length - 1];
  if (!last?.[idField] || !last?.[timeField]) throw new Error('finance_page_cursor_missing');
  return { p_before_at: last[timeField], p_before_id: last[idField] };
}

/** Keep rows already shown if a retry returns the same page. */
export function appendFinancePage(previous, page, idField) {
  const seen = new Set(previous.map((row) => row[idField]));
  return [...previous, ...page.filter((row) => !seen.has(row[idField]))];
}
