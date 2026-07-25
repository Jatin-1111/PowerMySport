"use client";

import {
    expertApi,
    type Expert,
    type ExpertSession,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import {
    StaggerContainer,
    StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { cn } from "@/utils/cn";
import {
    ArrowLeft,
    ArrowRight,
    CalendarClock,
    Clock,
    ServerCrash,
    Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  SCHEDULED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
};

const actionHint = (s: ExpertSession) => {
  if (s.status === "PAID") return "Schedule a time";
  if (s.status === "COMPLETED" && !s.reviewed) return "Leave a review";
  if (s.status === "SCHEDULED") return "View details";
  if (s.status === "PENDING_PAYMENT") return "Complete payment";
  return "View details";
};

function ExpertAvatar({ expert, name }: { expert?: Expert; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "E").charAt(0).toUpperCase();
  if (!expert?.photoUrl || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-base font-bold text-slate-400">
        {initial}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={expert.photoUrl}
      alt={name}
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-100"
    />
  );
}

function SessionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

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
    <div className="min-h-screen bg-[#F4F3F0]">
      {/* Hero */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <Link
            href="/experts"
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-power-orange"
          >
            <ArrowLeft className="h-4 w-4" /> Browse experts
          </Link>
          <FadeIn>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-orange-700">
              Your Bookings
            </p>
            <h1 className="font-title text-3xl font-black tracking-tight text-slate-900">
              My expert sessions
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-500">
              Schedule paid sessions, join them, and leave a review afterwards.
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SessionRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
            <EmptyState
              icon={ServerCrash}
              title="Couldn't load your sessions"
              description={error}
              actionLabel="Retry"
              onAction={load}
            />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
            <EmptyState
              icon={CalendarClock}
              title="No sessions yet"
              description="Book a 1:1 session with a sports expert to get started."
              actionLabel="Browse experts"
              onAction={() => router.push("/experts")}
            />
          </div>
        ) : (
          <StaggerContainer className="space-y-3">
            {sessions.map((s) => {
              const id = String(s.id || s._id || "");
              const route = `/experts/sessions/${id}`;
              const expertName = s.expert?.name || "Expert";
              const paid = s.paymentStatus === "COMPLETED";
              return (
                <StaggerItem key={id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(route)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(route);
                      }
                    }}
                    className="group flex cursor-pointer flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <ExpertAvatar expert={s.expert} name={expertName} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold tracking-tight text-slate-900">
                            {expertName}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                              STATUS_STYLES[s.status] ||
                                "bg-slate-100 text-slate-600 ring-slate-200",
                            )}
                          >
                            {s.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                          {s.status === "SCHEDULED" && s.scheduledAt ? (
                            <>
                              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {formatSessionTimeWithZone(
                                  s.scheduledAt,
                                  s.expertTimezone,
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              Booked{" "}
                              {new Date(s.createdAt).toLocaleDateString()}
                            </>
                          )}
                          {s.mode
                            ? ` · ${s.mode === "ONLINE" ? "Online" : "In-person"}`
                            : ""}
                        </p>
                        {s.reviewed && s.rating && (
                          <p className="mt-1 flex items-center gap-1 text-sm font-medium text-amber-600">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            You rated {s.rating}/5
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-50 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                      <span className="font-bold text-slate-900">
                        {formatInr(s.amount)}
                        {!paid && (
                          <span className="ml-1 text-xs font-medium text-amber-600">
                            (unpaid)
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-power-orange">
                        {actionHint(s)}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}
      </div>
    </div>
  );
}
