"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AcademyAdminQueueRecord, adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AcademyStats = {
  pending: number;
  approved: number;
  rejected: number;
};

const queueBadge = (academy: AcademyAdminQueueRecord) => {
  if (academy.rejectionReason) {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (academy.isActive) {
    return "border border-green-200 bg-green-50 text-green-700";
  }

  if (academy.isApproved) {
    return "border border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border border-amber-200 bg-amber-50 text-amber-700";
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function AdminAcademyOnboardingPage() {
  const [stats, setStats] = useState<AcademyStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [pendingAcademies, setPendingAcademies] = useState<AcademyAdminQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [pendingResponse, approvedResponse, rejectedResponse] = await Promise.all([
        adminApi.getPendingAcademies({
          page: 1,
          limit: 6,
          filter: "pending",
        }),
        adminApi.getPendingAcademies({
          page: 1,
          limit: 1,
          filter: "approved",
        }),
        adminApi.getPendingAcademies({
          page: 1,
          limit: 1,
          filter: "rejected",
        }),
      ]);

      if (pendingResponse.success && pendingResponse.data) {
        setPendingAcademies(pendingResponse.data.academies || []);
        setStats({
          pending: pendingResponse.data.total || 0,
          approved: approvedResponse.success ? approvedResponse.data?.total || 0 : 0,
          rejected: rejectedResponse.success ? rejectedResponse.data?.total || 0 : 0,
        });
        return;
      }

      setError(pendingResponse.message || "Failed to load academy onboarding.");
    } catch (loadError) {
      console.error("Failed to load academy onboarding board:", loadError);
      setError("Failed to load academy onboarding.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const overviewCards = useMemo(
    () => [
      {
        label: "Pending review",
        value: stats.pending,
        icon: Clock3,
        accent: "text-amber-600",
      },
      {
        label: "Approved",
        value: stats.approved,
        icon: BadgeCheck,
        accent: "text-green-600",
      },
      {
        label: "Rejected",
        value: stats.rejected,
        icon: ShieldCheck,
        accent: "text-red-600",
      },
    ],
    [stats]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminPageHeader
          badge="Admin"
          title="Academy Onboarding"
          subtitle="Academy onboarding is now admin-managed. Track submissions, review details, and push approved academies into the public directory."
        />
        <Link
          href="/admin/academies/add"
          className="bg-power-orange inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Create Academy
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {overviewCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-600">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
                </div>
                <div className={`rounded-2xl bg-slate-50 p-3 ${card.accent}`}>
                  <Icon size={20} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="space-y-5 bg-white">
          <div className="flex items-start gap-3">
            <div className="bg-power-orange/10 text-power-orange rounded-2xl p-3">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Onboarding flow</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use this page as the admin entry point for academy onboarding requests and move
                qualified accounts into the review queue.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              "Collect academy identity, contact details, and sports list.",
              "Verify legal, payout, and KYC details before publishing.",
              "Approve the profile and monitor it from Academy Management.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/academies"
              className="bg-power-orange inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Open academy queue
              <ChevronRight size={16} />
            </Link>
            <Link
              href="/admin/support-tickets"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              View support tickets
            </Link>
          </div>
        </Card>

        <Card className="space-y-4 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending submissions</h2>
              <p className="text-sm text-slate-600">Fresh academy requests awaiting review.</p>
            </div>
            <Sparkles size={18} className="text-power-orange" />
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading academy submissions...</div>
          ) : error ? (
            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
              <p className="font-semibold text-red-700">{error}</p>
              <button
                type="button"
                onClick={loadBoard}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : pendingAcademies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={28} />
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No pending academy submissions
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                The queue is clear right now. Check academy management for approved or rejected
                profiles.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAcademies.map((academy) => (
                <div
                  key={academy.id}
                  className="rounded-2xl border border-slate-200 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{academy.name}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${queueBadge(academy)}`}
                        >
                          {academy.rejectionReason
                            ? "Rejected"
                            : academy.isActive
                              ? "Live"
                              : academy.isApproved
                                ? "Approved"
                                : "Pending"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {academy.city || "Location unavailable"} •{" "}
                        {academy.sports?.join(", ") || "No sports listed"}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Owner: {academy.ownerEmail || "N/A"}</span>
                        <span>Submitted: {formatDate(academy.submittedAt)}</span>
                        <span>Reviewed: {formatDate(academy.lastReviewedAt)}</span>
                      </div>
                    </div>
                    <Link
                      href="/admin/academies"
                      className="hover:border-power-orange hover:text-power-orange inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors"
                    >
                      Review
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
