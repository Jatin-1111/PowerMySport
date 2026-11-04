"use client";

import { ChevronsUpDown, ChevronUp, ChevronDown, Inbox, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { Pagination } from "./Pagination";

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
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

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

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {search && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder || "Search..."}
                aria-label={search.placeholder || "Search"}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 hover:border-slate-400"
              />
            </div>
          )}
          {toolbarExtra && <div className="flex items-center gap-2">{toolbarExtra}</div>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((col) => {
                const isSorted = sort?.column === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      col.sortable && sort
                        ? isSorted
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-xs font-semibold tracking-wide text-slate-500",
                      alignClass(col.align),
                      col.className
                    )}
                  >
                    {col.sortable && sort ? (
                      <button
                        type="button"
                        onClick={() => sort.onChange(col.key)}
                        className={cn(
                          "-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-slate-800",
                          isSorted && "text-slate-900"
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={`skeleton-${i}`} aria-hidden>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div
                        className="skeleton h-4"
                        style={{ width: `${55 + ((i * 17 + col.key.length * 11) % 40)}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Inbox className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{emptyMessage}</p>
                    {search?.value && (
                      <button
                        type="button"
                        onClick={() => search.onChange("")}
                        className="text-power-orange-solid mt-2 text-sm font-semibold hover:underline"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (
                            e.target === e.currentTarget &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    "transition-colors",
                    onRowClick &&
                      "cursor-pointer hover:bg-orange-50/50 focus-visible:bg-orange-50/50"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-slate-700", alignClass(col.align))}
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

      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
