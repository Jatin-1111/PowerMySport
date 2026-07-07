"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { cn } from "@/utils/cn";

export interface AdminDataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface AdminDataTableSort {
  column: string | null;
  direction: "asc" | "desc";
  onChange: (column: string) => void;
}

export interface AdminDataTableSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface AdminDataTablePagination {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
}

interface AdminDataTableProps<T> {
  columns: AdminDataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  search?: AdminDataTableSearch;
  sort?: AdminDataTableSort;
  pagination?: AdminDataTablePagination;
  toolbarExtra?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

const alignClass = (align?: "left" | "right" | "center") =>
  align === "right"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : "text-left";

/**
 * Generic, presentational admin list table: search input, sortable column
 * headers, and a pagination footer. Pages own their own data-fetching and
 * filtering logic — this component only renders what it's given.
 */
export function AdminDataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyMessage = "No records found.",
  search,
  sort,
  pagination,
  toolbarExtra,
  onRowClick,
}: AdminDataTableProps<T>) {
  const hasToolbar = Boolean(search || toolbarExtra);

  const renderPageButtons = () => {
    if (!pagination) return null;
    const total = pagination.totalPages;
    const current = pagination.page;

    // Calculate visible range (up to 5 pages)
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);

    // Adjust range if we have fewer than 5 pages but more are available
    if (end - start + 1 < 5) {
      if (start === 1) {
        end = Math.min(total, start + 4);
      } else if (end === total) {
        start = Math.max(1, end - 4);
      }
    }

    const buttons = [];

    // Always show page 1
    if (start > 1) {
      buttons.push(
        <button
          key={1}
          type="button"
          onClick={() => pagination.onPageChange(1)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          1
        </button>,
      );
      if (start > 2) {
        buttons.push(
          <span key="dots-start" className="px-1 text-slate-400 self-center">
            ...
          </span>,
        );
      }
    }

    // Show middle range
    for (let p = start; p <= end; p++) {
      buttons.push(
        <button
          key={p}
          type="button"
          onClick={() => pagination.onPageChange(p)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
            current === p
              ? "bg-power-orange text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50",
          )}
        >
          {p}
        </button>,
      );
    }

    // Always show last page
    if (end < total) {
      if (end < total - 1) {
        buttons.push(
          <span key="dots-end" className="px-1 text-slate-400 self-center">
            ...
          </span>,
        );
      }
      buttons.push(
        <button
          key={total}
          type="button"
          onClick={() => pagination.onPageChange(total)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {total}
        </button>,
      );
    }

    return buttons;
  };

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {search && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder || "Search..."}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange/40"
              />
            </div>
          )}
          {toolbarExtra && (
            <div className="flex items-center gap-2">{toolbarExtra}</div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.column === col.key;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase text-slate-500",
                      alignClass(col.align),
                      col.sortable &&
                        "cursor-pointer select-none hover:text-slate-700",
                      col.className,
                    )}
                    onClick={
                      col.sortable && sort
                        ? () => sort.onChange(col.key)
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable &&
                        sort &&
                        (isSorted ? (
                          sort.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer hover:bg-slate-50",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-slate-700",
                        alignClass(col.align),
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Page {pagination.page} of {pagination.totalPages}
            {typeof pagination.total === "number" &&
              ` · ${pagination.total} total`}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                pagination.onPageChange(Math.max(1, pagination.page - 1))
              }
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {renderPageButtons()}

            <button
              type="button"
              onClick={() =>
                pagination.onPageChange(
                  Math.min(pagination.totalPages, pagination.page + 1),
                )
              }
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
