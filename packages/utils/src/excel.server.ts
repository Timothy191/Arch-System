import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

/**
 * Server-side Excel export implementation using Node.js filesystem.
 *
 * This module is exclusively imported via the `@repo/utils/server` subpath
 * (see package.json exports mapping) and should never be imported from client
 * code or browser bundles.
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

  writeFileSync(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, buffer);
}
