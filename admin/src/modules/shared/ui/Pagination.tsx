import { cn } from "@/utils/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  className?: string;
}

const pageButton =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-semibold transition-colors";

/** Previous / numbered / next control. Renders nothing for a single page. */
export function Pagination({ page, totalPages, onPageChange, total, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Window of up to five pages around the current one, with first and last kept.
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);
  if (end - start + 1 < 5) {
    if (start === 1) end = Math.min(totalPages, start + 4);
    else if (end === totalPages) start = Math.max(1, end - 4);
  }

  const items: React.ReactNode[] = [];
  const numbered = (p: number) => (
    <button
      key={p}
      type="button"
      onClick={() => onPageChange(p)}
      aria-label={`Page ${p}`}
      aria-current={page === p ? "page" : undefined}
      className={cn(
        pageButton,
        page === p
          ? "bg-power-orange-solid text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {p}
    </button>
  );

  if (start > 1) {
    items.push(numbered(1));
    if (start > 2)
      items.push(
        <span key="gap-start" className="px-1 text-slate-500" aria-hidden>
          …
        </span>
      );
  }
  for (let p = start; p <= end; p++) items.push(numbered(p));
  if (end < totalPages) {
    if (end < totalPages - 1)
      items.push(
        <span key="gap-end" className="px-1 text-slate-500" aria-hidden>
          …
        </span>
      );
    items.push(numbered(totalPages));
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-center text-sm tabular-nums text-slate-500 sm:text-left">
        Page {page} of {totalPages}
        {typeof total === "number" && ` · ${total.toLocaleString("en-IN")} total`}
      </p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className={cn(
            pageButton,
            "border border-slate-300 bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {items}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className={cn(
            pageButton,
            "border border-slate-300 bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
