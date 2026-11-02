import XLSX from 'xlsx';

/**
 * Exports data to an Excel (.xlsx) file.
 *
 * In browser environments this triggers a file download. In Node.js it writes
 * to the filesystem using the provided filename.
 */
export async function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string
): Promise<void> {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data ?? []);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  if (
    typeof window !== 'undefined' &&
    typeof window.Blob !== 'undefined' &&
    typeof window.URL !== 'undefined'
  ) {
    // Browser: trigger download
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
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js: write to filesystem
    const { writeFileSync } = await import('node:fs');
    writeFileSync(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, buffer);
  } else {
    throw new Error('Unsupported environment for Excel export');
  }
}

/**
 * Parses an Excel file into an array of row objects.
 *
 * The first row is treated as the header row. Returns an empty array if the
 * file has no sheets or no data.
 */
export async function parseExcel(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (workbook.SheetNames.length === 0) {
    return [];
  }

  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return [];
  }
  const worksheet = workbook.Sheets[firstSheet];
  if (!worksheet) {
    return [];
  }
  const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

  return json;
}
