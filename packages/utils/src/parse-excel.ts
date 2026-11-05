import * as XLSX from 'xlsx';

/**
 * Parses an Excel file into an array of row objects.
 *
 * The first row is treated as the header row. Returns an empty array if the
 * file has no sheets or no data.
 */
export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
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
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: true,
  });

  return json;
}
