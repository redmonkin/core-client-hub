// Reads an uploaded .csv or .xlsx file into one object per data row, keyed by
// the header row. Empty cells are omitted and blank rows are skipped. Date
// cells in .xlsx files become "YYYY-MM-DD" strings.
//
// The parsers are loaded on demand so they stay out of the main bundle.

export type SpreadsheetRow = Record<string, string | number | boolean>;

type Cell = string | number | boolean | Date | null | undefined;

const isBlank = (cell: Cell) => cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '');

const toIsoDate = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/** Converts sheet rows (first non-blank row = headers) into keyed objects. */
export function sheetRowsToObjects(rows: Cell[][]): SpreadsheetRow[] {
  const nonBlank = rows.filter((row) => row.some((cell) => !isBlank(cell)));
  if (nonBlank.length === 0) return [];

  const [headerRow, ...dataRows] = nonBlank;
  const headers = headerRow.map((cell, i) => (isBlank(cell) ? `Column ${i + 1}` : String(cell).trim()));

  return dataRows.map((row) => {
    const obj: SpreadsheetRow = {};
    headers.forEach((header, i) => {
      const cell = row[i];
      if (isBlank(cell)) return;
      obj[header] = cell instanceof Date ? toIsoDate(cell) : (cell as string | number | boolean);
    });
    return obj;
  });
}

export async function readSpreadsheetFile(file: File): Promise<SpreadsheetRow[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const { default: Papa } = await import('papaparse');
    const result = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
    return sheetRowsToObjects(result.data);
  }

  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    const rows = await readSheet(file);
    return sheetRowsToObjects(rows as unknown as Cell[][]);
  }

  throw new Error('Unsupported file type. Please upload a .csv or .xlsx file (save older .xls files as .xlsx first).');
}
