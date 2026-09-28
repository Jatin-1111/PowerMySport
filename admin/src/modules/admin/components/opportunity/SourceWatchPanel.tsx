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
  opportunityWatchApi,
  type SourceWatchRow,
  type SourceWatchStatus,
} from "@/modules/admin/services/opportunities";
import { Card } from "@/modules/shared/ui/Card";
import { Loader2, RefreshCw } from "lucide-react";
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

function WatchRow({ watch, onDismiss }: { watch: SourceWatchRow; onDismiss?: () => void }) {
  const status = STATUS[watch.status];
  const changed = watch.status === "ok" && watch.needsAttention;
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

  const attention = watches.filter((w) => w.needsAttention);
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

      {loading ? null : attention.length > 0 ? (
        <>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">
            Needs a look ({attention.length})
          </h3>
          <ul className="divide-y divide-slate-100">
            {attention.map((watch) => (
              <WatchRow key={watch._id} watch={watch} onDismiss={() => void dismiss(watch._id)} />
            ))}
          </ul>
        </>
      ) : (
        watches.length > 0 && (
          <p className="mt-3 text-sm text-slate-600">
            Nothing has changed since it was last looked at.
          </p>
        )
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
