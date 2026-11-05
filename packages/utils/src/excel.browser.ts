import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel (.xlsx) file via a browser Blob download.
 *
 * This module is the browser-only entry point and must never import Node.js
 * APIs such as `node:fs`; the server-side filesystem variant lives in
 * `excel.server.ts` (exposed via the `@repo/utils/server` subpath).
 */
export async function exportToExcel(
  data: readonly Record<string, unknown>[],
  filename: string,
  sheetName: string
): Promise<void> {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([...(data ?? [])]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.style.display = 'none';
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
