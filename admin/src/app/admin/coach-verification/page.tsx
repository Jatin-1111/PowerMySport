"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { Pagination } from "@/modules/shared/ui/Pagination";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { Coach, CoachVerificationStatus } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type StatusFilter = CoachVerificationStatus | "ALL";
type ActionMode = "REJECT" | "REVIEW";
type PendingApproveCoach = Pick<Coach, "id" | "_id"> & {
  displayName: string;
};

export default function AdminCoachVerificationPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [actionCoachId, setActionCoachId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingApproveCoach, setPendingApproveCoach] = useState<PendingApproveCoach | null>(null);
  const PAGE_SIZE = 10;

  const loadVerifications = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await adminApi.getCoachVerifications({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page: currentPage,
        limit: PAGE_SIZE,
      });

      if (response.success && response.data) {
        setCoaches(response.data);
        if (response.pagination) {
          setPagination({
            total: response.pagination.total || 0,
            page: response.pagination.page || 1,
            totalPages: response.pagination.totalPages || 1,
          });
        }
        return;
      }

      setError(response.message || "Failed to load coach verifications.");
    } catch (error) {
      console.error("Failed to load coach verifications:", error);
      setError("Failed to load coach verifications.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  const getCoachId = (coach: Coach) => coach.id || coach._id || "";

  const confirmApprove = async () => {
    if (!pendingApproveCoach) {
      return;
    }

    const coachId = pendingApproveCoach.id || pendingApproveCoach._id || "";
    if (!coachId) return;

    try {
      setActionCoachId(null);
      setActionMode(null);
      setActionText("");
      setActionLoading(true);
      await adminApi.approveCoachVerification(coachId);
      toast.success("Coach approved successfully.");
      await loadVerifications();
      setPendingApproveCoach(null);
    } catch (error) {
      console.error("Failed to approve coach:", error);
      toast.error("Failed to approve coach.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (coach: Coach) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    const userInfo =
      typeof coach.userId === "object" && coach.userId !== null
        ? (coach.userId as Record<string, string>)
        : null;
    setPendingApproveCoach({
      id: coach.id,
      _id: coach._id,
      displayName: userInfo?.name || "this coach",
    });
  };

  const startAction = (coach: Coach, mode: ActionMode) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    setActionCoachId(coachId);
    setActionMode(mode);
    setActionText("");
  };

  const handleNotify = async (coach: Coach) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    try {
      setActionLoading(true);
      const response = await adminApi.notifyCoachVerification(coachId);
      toast.success(response.message || "Verification reminder email sent.");
    } catch (error) {
      console.error("Failed to send verification reminder:", error);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send verification reminder.";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelAction = () => {
    setActionCoachId(null);
    setActionMode(null);
    setActionText("");
  };

  const submitAction = async () => {
    if (!actionCoachId || !actionMode) return;

    if (actionMode === "REJECT" && !actionText.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setActionLoading(true);
    try {
      if (actionMode === "REJECT") {
        await adminApi.rejectCoachVerification(actionCoachId, actionText.trim());
        toast.success("Coach rejected successfully.");
      } else {
        await adminApi.markCoachVerificationForReview(
          actionCoachId,
          actionText.trim() || undefined
        );
        toast.success("Coach moved to review.");
      }

      cancelAction();
      await loadVerifications();
    } catch (error) {
      console.error("Failed to update coach verification:", error);
      toast.error("Failed to update coach verification.");
    } finally {
      setActionLoading(false);
    }
  };

  const header = (
    <AdminPageHeader
      badge="People"
      title="Coach verification"
      subtitle="Check each coach's documents, then approve, ask for changes or reject."
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock rows={6} label="Loading coach verifications" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorNotice message={error} onRetry={loadVerifications} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-slate-600">
          {pagination.total} coach{pagination.total === 1 ? "" : "es"} in this view
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="verification-status" className="text-sm text-slate-600">
            Status
          </label>
          <select
            id="verification-status"
            value={statusFilter}
            onChange={(e) => {
              setCurrentPage(1);
              setStatusFilter(e.target.value as StatusFilter);
            }}
            className={`${fieldClass} !w-auto`}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEW">In review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>
        </div>
      </div>

      {coaches.length === 0 ? (
        <EmptyState
          title="No verification requests"
          description="Coaches who submit documents will appear here."
        />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {coaches.map((coach) => {
              const userInfo =
                typeof coach.userId === "object" && coach.userId !== null
                  ? (coach.userId as Record<string, string>)
                  : null;
              const coachId = getCoachId(coach);
              const coachDetailsHref = `/admin/coach-verification/${coachId}`;
              const isVerified = coach.verificationStatus === "VERIFIED";

              return (
                <li key={coachId} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-3">
                        {coachId ? (
                          <Link
                            href={coachDetailsHref}
                            className="text-base font-semibold text-slate-900 hover:text-orange-800 hover:underline"
                          >
                            {userInfo?.name || "Coach"}
                          </Link>
                        ) : (
                          <h3 className="text-base font-semibold text-slate-900">
                            {userInfo?.name || "Coach"}
                          </h3>
                        )}
                        <StatusBadge status={coach.verificationStatus || "UNVERIFIED"} size="sm" />
                      </div>
                      <p className="text-sm text-slate-600">{userInfo?.email || "No email"}</p>
                      <p className="text-sm text-slate-500">
                        {coach.sports.length ? coach.sports.join(", ") : "No sports listed"}
                      </p>
                      {coach.verificationNotes && (
                        <p className="text-sm text-red-700">Notes: {coach.verificationNotes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link href={coachDetailsHref} className={btn("outline")}>
                        Review details
                      </Link>
                      {!isVerified && (
                        <button
                          type="button"
                          onClick={() => handleApprove(coach)}
                          disabled={actionLoading}
                          className={btn("primary")}
                        >
                          Approve
                        </button>
                      )}
                      {!isVerified && (
                        <button
                          type="button"
                          onClick={() => handleNotify(coach)}
                          disabled={actionLoading}
                          className={btn("quiet")}
                        >
                          Send reminder
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startAction(coach, "REVIEW")}
                        disabled={actionLoading}
                        className={btn("quiet")}
                      >
                        Move to review
                      </button>
                      <button
                        type="button"
                        onClick={() => startAction(coach, "REJECT")}
                        disabled={actionLoading}
                        className={btn("dangerOutline")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {actionCoachId === coachId && actionMode && (
                    <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                      <label
                        htmlFor={`action-${coachId}`}
                        className="text-sm font-semibold text-slate-800"
                      >
                        {actionMode === "REJECT"
                          ? "Reason for rejecting"
                          : "Review notes (optional)"}
                      </label>
                      <textarea
                        id={`action-${coachId}`}
                        rows={3}
                        value={actionText}
                        onChange={(event) => setActionText(event.target.value)}
                        placeholder={
                          actionMode === "REJECT"
                            ? "Say what is missing or wrong, so the coach can fix it"
                            : "Add notes for the review queue"
                        }
                        className={fieldClass}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={submitAction}
                          disabled={
                            actionLoading || (actionMode === "REJECT" && !actionText.trim())
                          }
                          className={btn(actionMode === "REJECT" ? "danger" : "primary")}
                        >
                          {actionLoading
                            ? "Saving…"
                            : actionMode === "REJECT"
                              ? "Reject coach"
                              : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelAction}
                          disabled={actionLoading}
                          className={btn("outline")}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="text-sm font-medium text-slate-700">Documents</span>
                    {coach.verificationDocuments?.length ? (
                      coach.verificationDocuments.map((doc, index) => (
                        <a
                          key={`${doc.fileName}-${index}`}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        >
                          {doc.type}: {doc.fileName}
                        </a>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">None uploaded</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={currentPage}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingApproveCoach)}
        title="Approve coach verification?"
        description={
          pendingApproveCoach
            ? `This marks ${pendingApproveCoach.displayName} as verified and shows the verified badge on their profile.`
            : undefined
        }
        confirmLabel="Approve"
        onConfirm={confirmApprove}
        onCancel={() => setPendingApproveCoach(null)}
        loading={actionLoading}
      />
    </div>
  );
}
