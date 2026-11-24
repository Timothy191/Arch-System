/** Leading characters that spreadsheet apps interpret as formulas (CSV injection). */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Neutralizes CSV/formula injection and RFC-4180 quotes a single cell. */
export function sanitizeCsvCell(cellText: string): string {
  const sanitized = CSV_FORMULA_PREFIX.test(cellText) ? `'${cellText}` : cellText;
  return `"${sanitized.replace(/"/g, '""')}"`;
}
