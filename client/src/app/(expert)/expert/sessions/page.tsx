"use client";

import { ExpertSessionsList } from "@/modules/expert/components/ExpertSessionsList";
import { expertApi, type ExpertSession } from "@/modules/expert/services/expert";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "SCHEDULED", label: "Upcoming" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function ExpertSessionsPage() {
  const [sessions, setSessions] = useState<ExpertSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await expertApi.expertSessions();
      if (res.success && res.data) setSessions(res.data);
      else setError(res.message || "Failed to load your sessions.");
    } catch {
      setError("Failed to load your sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateOne = (updated: ExpertSession) =>
    setSessions((list) =>
      list.map((s) =>
        (s.id || s._id) === (updated.id || updated._id)
          ? { ...s, ...updated }
          : s,
      ),
    );

  const filteredSessions = useMemo(() => {
    if (filter === "ALL") return sessions;
    if (filter === "SCHEDULED") {
      return sessions.filter((s) => s.status === "SCHEDULED" || s.status === "PAID");
    }
    return sessions.filter((s) => s.status === filter);
  }, [sessions, filter]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/expert/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            All Sessions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"} total`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all ${
              filter === f.key
                ? "border-power-orange bg-power-orange/10 text-power-orange"
                : "border-slate-200 bg-white text-slate-600 hover:border-power-orange/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <ExpertSessionsList
          sessions={filteredSessions}
          loading={loading}
          error={error}
          onRetry={load}
          onChange={updateOne}
          emptyMessage={
            filter === "ALL"
              ? "No sessions booked yet."
              : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} sessions.`
          }
        />
      </div>
    </div>
  );
}
