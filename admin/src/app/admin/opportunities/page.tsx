"use client";

// ─── Admissions & scholarships (index) ──────────────────────────────────────
//
// Every entry, drafts included, with what needs attention: a draft nobody has
// verified, a live entry not checked in over a year, a window that has closed.
// Creating one makes an empty draft and opens the editor.
//
// Layout: a "needs you" strip (sources to review, source changes, new leads)
// that opens the matching panel, then one list with a tab per track.

import { toast } from "@/lib/toast";
import { readApiErrors } from "@/modules/admin/components/opportunity/apiErrors";
import { SourceSubmitForm } from "@/modules/admin/components/opportunity/SourceSubmitForm";
import { SourceWatchPanel } from "@/modules/admin/components/opportunity/SourceWatchPanel";
import { LeadsPanel } from "@/modules/admin/components/opportunity/LeadsPanel";
import { CATEGORY_OPTIONS } from "@/modules/admin/components/opportunity/opportunityForm";
import { ErrorList, Field, TextInput } from "@/modules/admin/components/pathway/fields";
import {
  opportunityAdminApi,
  opportunitySourceApi,
  type AdminOpportunityRow,
  type OpportunityQueueSummary,
  type OpportunitySourceRow,
  type OpportunityTrack,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const CYCLE_TEXT: Record<AdminOpportunityRow["cycleState"], string> = {
  open: "Window open",
  upcoming: "Opens soon",
  closed: "Window closed",
  rolling: "No window",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const todayInIndia = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const daysFromToday = (iso: string) =>
  Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayInIndia()}T00:00:00Z`)) / DAY_MS);
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const inDays = (days: number) =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

/** The window as a date and how near it is, so a closing deadline is visible in the list. */
function windowText(row: AdminOpportunityRow): string {
  const { opensOn, closesOn } = row.cycle ?? {};
  if (row.cycleState === "open" && closesOn) {
    return `Closes ${shortDate(closesOn)} (${inDays(daysFromToday(closesOn))})`;
  }
  if (row.cycleState === "upcoming" && opensOn) {
    return `Opens ${shortDate(opensOn)} (${inDays(daysFromToday(opensOn))})`;
  }
  if (row.cycleState === "closed" && closesOn) return `Closed ${shortDate(closesOn)}`;
  return CYCLE_TEXT[row.cycleState];
}

const SECTIONS: Array<{ track: OpportunityTrack; label: string }> = [
  { track: "admission", label: "Admissions" },
  { track: "scholarship", label: "Scholarships" },
];

type QueueKey = "sources" | "changes" | "leads";
type StatusFilter = "all" | "live" | "draft" | "closed";
type SortKey = "title" | "checked";

const STATUS_CHIPS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "closed", label: "Window closed" },
];

const matchesStatus = (row: AdminOpportunityRow, filter: StatusFilter) =>
  filter === "all" ||
  (filter === "live" && row.status === "published") ||
  (filter === "draft" && row.status !== "published") ||
  (filter === "closed" && row.cycleState === "closed");

const byTitle = (a: AdminOpportunityRow, b: AdminOpportunityRow) => a.title.localeCompare(b.title);

// Ascending puts never-checked entries first, then the longest since a check.
const byLastChecked = (a: AdminOpportunityRow, b: AdminOpportunityRow) =>
  (a.lastVerifiedOn ?? "").localeCompare(b.lastVerifiedOn ?? "");

const needsAttention = (row: AdminOpportunityRow) => !row.lastVerifiedOn || row.stale;

function LastChecked({ row }: { row: AdminOpportunityRow }) {
  if (!row.lastVerifiedOn) {
    return <span className="font-semibold text-amber-700">Never</span>;
  }
  return (
    <span className={row.stale ? "font-semibold text-red-700" : "text-slate-600"}>
      {row.lastVerifiedOn}
    </span>
  );
}

// One status per row: where the entry is, with the live-but-overdue case called out.
function StatusTag({ row }: { row: AdminOpportunityRow }) {
  const live = row.status === "published";
  const label = !live ? "Draft" : row.stale ? "Live, check due" : "Live";
  const tone = !live
    ? "bg-slate-100 text-slate-600"
    : row.stale
      ? "bg-amber-50 text-amber-800"
      : "bg-emerald-50 text-emerald-800";
  return (
    <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${tone}`}>
      {label}
    </span>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  className = "",
}: {
  label: string;
  active: "asc" | "desc" | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={`px-2 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-semibold hover:text-slate-900"
      >
        {label}
        {active === "asc" && <ArrowUp className="h-3 w-3" />}
        {active === "desc" && <ArrowDown className="h-3 w-3" />}
      </button>
    </th>
  );
}

const DRAWER_TITLE: Record<QueueKey, string> = {
  sources: "Sources to review",
  changes: "Source changes",
  leads: "New leads",
};

const shortDay = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function changesHint(summary: OpportunityQueueSummary): string {
  const checked = summary.lastCheckedAt
    ? `Checked ${shortDay(summary.lastCheckedAt)}`
    : "Checked every Monday";
  return summary.unreadable > 0 ? `${checked} · ${summary.unreadable} to check by hand` : checked;
}

// The web search runs on the 1st of each month.
const nextSearch = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

// A zero count goes quiet; anything waiting turns amber.
function QueueTile({
  count,
  label,
  hint,
  onClick,
}: {
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg border p-4 text-left transition-colors ${
        count > 0
          ? "border-amber-200 bg-amber-50 hover:border-amber-400"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-2xl font-bold ${count > 0 ? "text-slate-900" : "text-slate-400"}`}
        >
          {count}
        </span>
        <span className="block text-xs font-semibold text-slate-700">{label}</span>
        <span className="block truncate text-xs text-slate-500">{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

// Sources still needing a person: waiting for review, or failed to read.
function SourcesQueue() {
  const [sources, setSources] = useState<OpportunitySourceRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    opportunitySourceApi
      .list({ status: ["PENDING_REVIEW", "EXTRACTION_FAILED"] })
      .then((res) => {
        if (!cancelled) setSources(res.data ?? []);
      })
      .catch(() => toast.error("Could not load the sources."))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (sources.length === 0)
    return <p className="text-sm text-slate-600">No sources are waiting.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-lg bg-white px-4">
      {sources.map((source) => (
        <li key={source._id}>
          <Link
            href={`/admin/opportunities/sources/${source._id}`}
            className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {source.sourceLabel || source.sourceUrl || "Source"}
              </span>
              <span className="text-xs text-slate-500">
                {source.opportunitySlug ? `Checking ${source.opportunitySlug}` : "New entry"}
                {source.autoDetected && " · the weekly check found it changed"}
              </span>
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                source.status === "PENDING_REVIEW"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {source.status === "PENDING_REVIEW" ? "Review" : "Could not read"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Side panel for a queue, so opening one never pushes the list off screen.
function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portalled to <body>: an ancestor with a transform would otherwise trap `fixed`
  // inside the layout and leave a gap at the bottom of the overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={title}
        className="relative flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>,
    document.body
  );
}

export default function AdminOpportunitiesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminOpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<OpportunityTrack>("admission");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<OpportunityQueueSummary>({
    sources: 0,
    changes: 0,
    unreadable: 0,
    leads: 0,
    lastCheckedAt: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState<QueueKey | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newMode, setNewMode] = useState<"link" | "typed">("link");
  const [tab, setTab] = useState<OpportunityTrack>("admission");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    opportunityAdminApi
      .list()
      .then((res) => {
        if (!cancelled) setRows(res.data ?? []);
      })
      .catch(() => toast.error("Could not load admissions and scholarships."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Counts for the strip: one small request. Each queue's list loads when its
  // drawer opens, and the counts are refreshed when it closes.
  const loadSummary = () => {
    opportunityAdminApi
      .queueSummary()
      .then((res) => {
        if (res.data) setSummary(res.data);
      })
      .catch(() => undefined);
  };

  useEffect(loadSummary, []);

  const closeDrawer = () => {
    setOpen(null);
    loadSummary();
  };

  const create = async () => {
    setCreating(true);
    setErrors([]);
    try {
      const res = await opportunityAdminApi.create({
        track,
        category: CATEGORY_OPTIONS[track][0]!.value,
        title: title.trim(),
        slug: slugify(title),
      });
      if (res.data?._id) router.push(`/admin/opportunities/${res.data._id}`);
    } catch (error) {
      setErrors(readApiErrors(error));
    } finally {
      setCreating(false);
    }
  };

  const needle = query.trim().toLowerCase();
  const list = rows
    .filter((row) => row.track === tab)
    .filter((row) => !onlyAttention || needsAttention(row))
    .filter((row) => matchesStatus(row, statusFilter))
    .filter((row) => !needle || row.title.toLowerCase().includes(needle));
  if (sort) {
    const compare = sort.key === "title" ? byTitle : byLastChecked;
    list.sort((a, b) => (sort.dir === "asc" ? compare(a, b) : compare(b, a)));
  }
  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  const filtered = needle !== "" || onlyAttention || statusFilter !== "all";
  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (onlyAttention ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Admissions & Scholarships</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Nothing reaches parents until someone has checked its sources, marked it verified and
            published it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="bg-power-orange-solid inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
        >
          {showNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showNew ? "Close" : "New entry"}
        </button>
      </div>

      {showNew && (
        <Card variant="elevated">
          <div className="flex gap-2 text-sm font-semibold">
            {(
              [
                ["link", "From a link or PDF"],
                ["typed", "Type it in"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setNewMode(mode)}
                className={`rounded-lg px-3 py-1.5 ${
                  newMode === mode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {newMode === "link" ? (
            <div className="mt-3">
              <p className="mb-3 text-xs text-slate-500">
                The document is read for you; you then keep or drop each field, checked against its
                quote.
              </p>
              <SourceSubmitForm />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
              <Field label="Page">
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value as OpportunityTrack)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="admission">Admissions</option>
                  <option value="scholarship">Scholarships</option>
                </select>
              </Field>
              <Field label="Title">
                <TextInput
                  value={title}
                  onChange={setTitle}
                  placeholder="e.g. Punjab sports scholarship"
                />
              </Field>
              <button
                type="button"
                onClick={() => void create()}
                disabled={creating || title.trim().length < 3}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create draft
              </button>
            </div>
          )}
          <div className="mt-3">
            <ErrorList errors={errors} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QueueTile
          count={summary.sources}
          label="Sources to review"
          hint="Read from a link or PDF"
          onClick={() => setOpen("sources")}
        />
        <QueueTile
          count={summary.changes}
          label="Source changes"
          hint={changesHint(summary)}
          onClick={() => setOpen("changes")}
        />
        <QueueTile
          count={summary.leads}
          label="New leads"
          hint={`Next search ${shortDay(nextSearch())}`}
          onClick={() => setOpen("leads")}
        />
      </div>

      {open && (
        <Drawer title={DRAWER_TITLE[open]} onClose={closeDrawer}>
          {open === "sources" && <SourcesQueue />}
          {open === "changes" && <SourceWatchPanel />}
          {open === "leads" && <LeadsPanel />}
        </Drawer>
      )}

      <Card variant="elevated">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex gap-4 text-sm font-semibold">
            {SECTIONS.map((section) => {
              const total = rows.filter((row) => row.track === section.track).length;
              return (
                <button
                  key={section.track}
                  type="button"
                  onClick={() => setTab(section.track)}
                  className={`border-b-2 pb-1 ${
                    tab === section.track
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {section.label} <span className="font-normal text-slate-400">{total}</span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title"
              aria-label="Search by title"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm sm:w-56 sm:flex-none"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilters > 0 && (
                  <span className="rounded-full bg-slate-900 px-1.5 text-xs text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_CHIPS.map((chip) => (
                          <button
                            key={chip.key}
                            type="button"
                            onClick={() => setStatusFilter(chip.key)}
                            aria-pressed={statusFilter === chip.key}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              statusFilter === chip.key
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-600 hover:border-slate-400"
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={onlyAttention}
                        onChange={(e) => setOnlyAttention(e.target.checked)}
                      />
                      Needs attention only
                    </label>
                    {activeFilters > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter("all");
                          setOnlyAttention(false);
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {filtered ? "Nothing matches these filters." : "None yet."}
          </p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <SortHeader
                  label="Title"
                  active={sort?.key === "title" ? sort.dir : null}
                  onClick={() => toggleSort("title")}
                />
                <th className="hidden px-2 py-2 sm:table-cell">Window</th>
                <SortHeader
                  label="Last checked"
                  className="hidden sm:table-cell"
                  active={sort?.key === "checked" ? sort.dir : null}
                  onClick={() => toggleSort("checked")}
                />
                <th className="px-2 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => router.push(`/admin/opportunities/${row._id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="min-w-0 px-2 py-3">
                    <Link
                      href={`/admin/opportunities/${row._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-sm font-semibold text-slate-900"
                    >
                      {row.title}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {CATEGORY_OPTIONS[row.track].find((c) => c.value === row.category)?.label ??
                        row.category}
                      <span className="sm:hidden"> · {windowText(row)}</span>
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-3 text-xs text-slate-600 sm:table-cell">
                    {windowText(row)}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-3 text-xs sm:table-cell">
                    <LastChecked row={row} />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <StatusTag row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
