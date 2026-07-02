"use client";

import { Download } from "lucide-react";
import { CsvColumn, exportRowsAsCsv } from "@/modules/shared/utils/csv";

interface ExportCsvButtonProps<T> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
  label?: string;
}

/**
 * Exports the rows currently passed in (typically "all filtered rows the
 * page has loaded", not just the visible page of a paginated table).
 */
export function ExportCsvButton<T>({
  filename,
  rows,
  columns,
  disabled = false,
  label = "Export CSV",
}: ExportCsvButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => exportRowsAsCsv(filename, rows, columns)}
      disabled={disabled || rows.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
