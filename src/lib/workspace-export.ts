// Collects every record in a workspace for the owner's "Export your data"
// download (Settings). Reads go through the normal client, so row-level
// security applies: an owner gets exactly what they can already see.
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;

/** Tables keyed by the workspace owner's id, in the order they're exported. */
const OWNER_TABLES = [
  "clients",
  "client_contacts",
  "projects",
  "project_notes",
  "proposals",
  "proposal_status_history",
  "contracts",
  "contract_status_history",
  "invoices",
  "invoice_items",
  "recurring_invoices",
  "expenses",
  "recurring_expenses",
  "timesheets",
  "templates",
  "briefs",
  "document_comments",
  "weekly_reviews",
  "invoice_settings",
  "branding_settings",
] as const;

/** Tables without their own owner id, read through their parent's ids. */
const CHILD_TABLES = [
  { table: "invoice_payments", key: "invoice_id", parent: "invoices" },
  { table: "expense_projects", key: "expense_id", parent: "expenses" },
  { table: "recurring_expense_projects", key: "recurring_expense_id", parent: "recurring_expenses" },
  { table: "project_note_attachments", key: "note_id", parent: "project_notes" },
] as const;

// Access tokens and password hashes for client links are deliberately left out.

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

// The generated client types don't allow a table name chosen at run time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function fetchAll(table: string, column: string, values: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < values.length; i += ID_CHUNK) {
    const chunk = values.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .in(column, chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data as Row[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

export interface WorkspaceExport {
  exported_at: string;
  workspace_owner_id: string;
  tables: Record<string, Row[]>;
}

export async function collectWorkspaceData(
  ownerId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<WorkspaceExport> {
  const tables: Record<string, Row[]> = {};
  const total = OWNER_TABLES.length + CHILD_TABLES.length;
  let done = 0;

  for (const table of OWNER_TABLES) {
    tables[table] = await fetchAll(table, "user_id", [ownerId]);
    onProgress?.(++done, total);
  }
  for (const { table, key, parent } of CHILD_TABLES) {
    const ids = (tables[parent] ?? []).map((row) => String(row.id));
    tables[table] = ids.length ? await fetchAll(table, key, ids) : [];
    onProgress?.(++done, total);
  }

  return { exported_at: new Date().toISOString(), workspace_owner_id: ownerId, tables };
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFileName(extension: string) {
  return `clientra-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function downloadJson(data: WorkspaceExport) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), exportFileName("json"));
}

// Excel refuses to open a file with a cell over 32,767 characters.
const MAX_CELL = 32000;

function toCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL)}… (truncated; see the JSON export)` : text;
}

/** One sheet per table, with a header row of column names. Empty tables are skipped. */
export async function downloadExcel(data: WorkspaceExport) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheets = Object.entries(data.tables)
    .filter(([, rows]) => rows.length > 0)
    .map(([table, rows]) => {
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      return {
        sheet: table.slice(0, 31),
        stickyRowsCount: 1,
        data: [columns, ...rows.map((row) => columns.map((column) => toCell(row[column])))],
      };
    });
  if (sheets.length === 0) {
    sheets.push({ sheet: "clients", stickyRowsCount: 1, data: [["No records yet"]] });
  }
  await writeXlsxFile(sheets).toFile(exportFileName("xlsx"));
}
