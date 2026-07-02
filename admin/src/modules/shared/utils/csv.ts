export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

const escapeCsvCell = (value: string | number | boolean | null | undefined): string => {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const buildCsv = <T>(rows: T[], columns: CsvColumn<T>[]): string => {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(col.value(row))).join(","),
  );
  return [headerLine, ...lines].join("\r\n");
};

export const downloadCsv = (filename: string, csvContent: string): void => {
  const blob = new Blob([`﻿${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportRowsAsCsv = <T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void => {
  downloadCsv(filename, buildCsv(rows, columns));
};
