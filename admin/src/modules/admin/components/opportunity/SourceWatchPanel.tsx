"use client";

// ─── The weekly source check, on the entries page ───────────────────────────
//
// What needs a person first: a source that changed, or one that cannot be
// read. Each links straight into "Check against a source" with the link
// filled in, which is the next step for a change. Everything else is behind
// "All watched sources", which is also the readability report: it shows what
// our own server can and cannot read.

import { toast } from "@/lib/toast";
import {
  MANUAL_CHECK_EVERY_DAYS,
  opportunityWatchApi,
  type SourceWatchRow,
  type SourceWatchStatus,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { readApiErrors } from "./apiErrors";

const STATUS: Record<SourceWatchStatus, { label: string; tone: string }> = {
  ok: { label: "Readable", tone: "bg-emerald-50 text-emerald-800" },
  blocked: { label: "Blocked", tone: "bg-red-50 text-red-700" },
  moved: { label: "Moved", tone: "bg-amber-50 text-amber-800" },
  gone: { label: "Gone", tone: "bg-red-50 text-red-700" },
  disallowed: { label: "robots.txt", tone: "bg-slate-100 text-slate-700" },
  error: { label: "Failed", tone: "bg-red-50 text-red-700" },
};

const CHANGE: Record<string, string> = {
  documents: "New or removed documents linked from this page",
  text: "The page's text changed",
  file: "The document itself changed",
};

const day = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "never";

const addDays = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();

/** When a source our server cannot read was last looked at, and when it is due again. */
function LookedAt({ watch }: { watch: SourceWatchRow }) {
  if (!watch.lastLookedAt) {
    return <p className="text-xs font-semibold text-amber-800">Nobody has looked at this yet.</p>;
  }
  return (
    <p
      className={`text-xs ${watch.needsAttention ? "font-semibold text-amber-800" : "text-slate-500"}`}
    >
      Last looked at {day(watch.lastLookedAt)}
      {watch.lastManualCheckNote ? `: ${watch.lastManualCheckNote}` : "."}{" "}
      {watch.needsAttention
        ? "Due a look again."
        : `Next look due ${day(addDays(watch.lastLookedAt, MANUAL_CHECK_EVERY_DAYS))}.`}
    </p>
  );
}

function WatchRow({
  watch,
  onDismiss,
  onManualCheck,
}: {
  watch: SourceWatchRow;
  onDismiss?: () => void;
  /** For a source our server cannot read: "I opened it myself", with an optional note. */
  onManualCheck?: (note?: string) => void;
}) {
  const status = STATUS[watch.status];
  const changed = watch.status === "ok" && watch.needsAttention;
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${status.tone}`}>
          {changed ? "Changed" : status.label}
        </span>
        <a
          href={watch.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate text-sm font-semibold text-slate-900 hover:underline"
        >
          {watch.url}
        </a>
      </div>
      <p className="text-xs text-slate-600">
        {changed ? (CHANGE[watch.changeKind ?? ""] ?? "Changed") : watch.note}
        {watch.status === "ok" && !changed && ` Checked ${day(watch.lastCheckedAt)}.`}
      </p>
      {onManualCheck && <LookedAt watch={watch} />}
      {onManualCheck && noting && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
          <input
            type="text"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onManualCheck(note.trim() || undefined);
            }}
            placeholder="What you found (optional), e.g. no new circular"
            aria-label={`Note on checking ${watch.url}`}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => onManualCheck(note.trim() || undefined)}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
          >
            Record
          </button>
          <button
            type="button"
            onClick={() => setNoting(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {watch.entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/admin/opportunities/${entry.id}?check=${encodeURIComponent(watch.url)}`}
            className="rounded-md border border-slate-200 px-2 py-0.5 font-semibold text-slate-700 hover:border-slate-400"
          >
            {changed ? "Check" : "Open"} {entry.title}
          </Link>
        ))}
        {onManualCheck && (
          <button
            type="button"
            onClick={() => setNoting((v) => !v)}
            className="ml-auto rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:border-slate-400"
          >
            I checked it
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto font-semibold text-slate-500 hover:text-slate-900"
          >
            Dismiss
          </button>
        )}
      </div>
    </li>
  );
}

export function SourceWatchPanel() {
  const [watches, setWatches] = useState<SourceWatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showUnreadable, setShowUnreadable] = useState(false);

  const load = async () => {
    const res = await opportunityWatchApi.list();
    setWatches(res.data?.watches ?? []);
    setRunning(res.data?.running ?? false);
  };

  useEffect(() => {
    let cancelled = false;
    opportunityWatchApi
      .list()
      .then((res) => {
        if (cancelled) return;
        setWatches(res.data?.watches ?? []);
        setRunning(res.data?.running ?? false);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runNow = async () => {
    try {
      const res = await opportunityWatchApi.run();
      toast.success(res.message ?? "Checking every source now.");
      setRunning(true);
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not start the check.");
    }
  };

  const dismiss = async (id: string) => {
    try {
      await opportunityWatchApi.dismiss(id);
      await load();
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not dismiss that.");
    }
  };

  const manualCheck = async (id: string, note?: string) => {
    try {
      const res = await opportunityWatchApi.manualCheck(id, note);
      toast.success(res.message ?? "Recorded.");
      await load();
    } catch (error) {
      toast.error(readApiErrors(error)[0] ?? "Could not record that.");
    }
  };

  // A readable source that changed is news. One that cannot be read at all is a
  // standing condition, listed apart so it does not bury the changes, with every
  // such source shown (due ones first) so a quiet one is still visibly checked.
  const changed = watches.filter((w) => w.needsAttention && w.status === "ok");
  const unreadable = watches
    .filter((w) => w.status !== "ok")
    .sort(
      (a, b) =>
        Number(b.needsAttention) - Number(a.needsAttention) ||
        (a.lastLookedAt ?? "").localeCompare(b.lastLookedAt ?? "")
    );
  const dueByHand = unreadable.filter((w) => w.needsAttention).length;
  const readable = watches.filter((w) => w.status === "ok").length;
  const lastRun = watches.reduce<string | undefined>(
    (latest, w) => (!latest || w.lastCheckedAt > latest ? w.lastCheckedAt : latest),
    undefined
  );

  return (
    <Card variant="elevated">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Weekly source check</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {watches.length === 0
              ? "No check has run yet. It runs every Monday morning, or now."
              : `Last checked ${day(lastRun)}: our server can read ${readable} of ${watches.length} sources.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {running ? "Checking…" : "Check now"}
          </button>
        </div>
      </div>

      {loading ? null : (
        <>
          {changed.length > 0 ? (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                Changed ({changed.length})
              </h3>
              <ul className="divide-y divide-slate-100">
                {changed.map((watch) => (
                  <WatchRow
                    key={watch._id}
                    watch={watch}
                    onDismiss={() => void dismiss(watch._id)}
                  />
                ))}
              </ul>
            </>
          ) : (
            watches.length > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                No readable source has changed since it was last looked at.
              </p>
            )
          )}

          {unreadable.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() => setShowUnreadable((v) => !v)}
                aria-expanded={showUnreadable}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Check by hand ({dueByHand} due of {unreadable.length})
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showUnreadable ? "rotate-180" : ""}`}
                />
              </button>
              <p className="mt-1 text-xs text-slate-500">
                These sites turn automated visitors away, so we cannot tell whether they changed.
                Open each one yourself and press &ldquo;I checked it&rdquo;. A source you have
                checked stays quiet for {MANUAL_CHECK_EVERY_DAYS} days. A link you submit by hand is
                still read.
              </p>
              {showUnreadable && (
                <ul className="divide-y divide-slate-100">
                  {unreadable.map((watch) => (
                    <WatchRow
                      key={watch._id}
                      watch={watch}
                      onManualCheck={(note) => void manualCheck(watch._id, note)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {watches.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            {showAll ? "Hide" : "Show"} all watched sources ({watches.length})
          </button>
          {showAll && (
            <ul className="divide-y divide-slate-100">
              {watches.map((watch) => (
                <WatchRow key={watch._id} watch={watch} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
