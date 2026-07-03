"use client";

import {
  expertApi,
  type ExpertSession,
} from "@/modules/expert/services/expert";
import { Button } from "@/modules/shared/ui/Button";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-100",
  PAID: "bg-blue-50 text-blue-700 ring-blue-100",
  SCHEDULED: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  CANCELLED: "bg-red-50 text-red-700 ring-red-100",
};

const actionHint = (s: ExpertSession) => {
  if (s.status === "PAID") return "Schedule a time";
  if (s.status === "COMPLETED" && !s.reviewed) return "Leave a review";
  if (s.status === "SCHEDULED") return "View details";
  if (s.status === "PENDING_PAYMENT") return "Complete payment";
  return "View details";
};

export default function MyExpertSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ExpertSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await expertApi.mySessions();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/experts"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
        >
          <ArrowLeft className="h-4 w-4" /> Browse experts
        </Link>

        <h1
          className="text-2xl font-bold text-slate-900"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          My expert sessions
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Schedule paid sessions, join them, and leave a review afterwards.
        </p>

        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
              <p className="text-sm text-slate-500">Loading your sessions…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
              <p className="font-semibold text-red-600">{error}</p>
              <Button variant="secondary" className="mt-4" onClick={load}>
                Retry
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white">
              <EmptyState
                icon={CalendarClock}
                title="No sessions yet"
                description="Book a 1:1 session with a sports expert to get started."
                actionLabel="Browse experts"
                onAction={() => router.push("/experts")}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const id = String(s.id || s._id || "");
                const route = `/experts/sessions/${id}`;
                const expertName = s.expert?.name || "Expert";
                const paid = s.paymentStatus === "COMPLETED";
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(route)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(route);
                      }
                    }}
                    className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">
                          {expertName}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[s.status] || "bg-slate-100 text-slate-600 ring-slate-200"}`}
                        >
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        {s.status === "SCHEDULED" && s.scheduledAt ? (
                          <>
                            <CalendarClock className="h-3.5 w-3.5" />
                            {new Date(s.scheduledAt).toLocaleString()}
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5" />
                            Booked {new Date(s.createdAt).toLocaleDateString()}
                          </>
                        )}
                        {s.mode
                          ? ` · ${s.mode === "ONLINE" ? "Online" : "In-person"}`
                          : ""}
                      </p>
                      {s.reviewed && s.rating && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          You rated {s.rating}/5
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-semibold text-slate-900">
                        {formatInr(s.amount)}
                        {!paid && (
                          <span className="ml-1 text-xs font-normal text-amber-600">
                            (unpaid)
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-power-orange">
                        {actionHint(s)}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
