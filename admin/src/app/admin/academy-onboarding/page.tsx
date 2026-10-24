"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AcademyAdminQueueRecord, adminApi } from "@/modules/admin/services/admin";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AcademyStats = {
  pending: number;
  approved: number;
  rejected: number;
};

const formatDate = (value?: string) => {
  if (!value) return "Not yet";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Academy onboarding"
        subtitle="New academy submissions waiting for review. Full queue and decisions are under Academies."
        action={
          <Link href="/admin/academies/add" className={btn("accent")}>
            <Plus size={16} aria-hidden />
            Create academy
          </Link>
        }
      />

      <MetricStrip
        items={[
          { label: "Pending review", value: String(stats.pending) },
          { label: "Approved", value: String(stats.approved) },
          { label: "Rejected", value: String(stats.rejected) },
        ]}
      />

      <Panel
        title="Pending submissions"
        description="The six most recent."
        action={
          <Link href="/admin/academies" className={btn("outline", "sm")}>
            Open full queue
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        }
      >
        {loading ? (
          <SkeletonBlock rows={6} label="Loading academy submissions" />
        ) : error ? (
          <ErrorNotice message={error} onRetry={loadBoard} />
        ) : pendingAcademies.length === 0 ? (
          <EmptyState
            title="No pending submissions"
            description="The queue is clear. New academies appear here as they submit."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingAcademies.map((academy) => (
              <li
                key={academy.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{academy.name}</h3>
                    <StatusBadge
                      size="sm"
                      status={
                        academy.rejectionReason
                          ? "Rejected"
                          : academy.isActive
                            ? "Live"
                            : academy.isApproved
                              ? "Approved"
                              : "Pending"
                      }
                      tone={
                        academy.rejectionReason
                          ? "red"
                          : academy.isActive
                            ? "green"
                            : academy.isApproved
                              ? "blue"
                              : "amber"
                      }
                    />
                  </div>
                  <p className="text-sm text-slate-600">
                    {academy.city || "Location unavailable"} ·{" "}
                    {academy.sports?.join(", ") || "No sports listed"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {academy.ownerEmail || "No owner email"} · Submitted{" "}
                    {formatDate(academy.submittedAt)}
                  </p>
                </div>
                <Link href="/admin/academies" className={btn("outline", "sm")}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
