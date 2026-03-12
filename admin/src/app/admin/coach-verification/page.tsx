"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, CoachVerificationStatus } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  const [pendingApproveCoach, setPendingApproveCoach] =
    useState<PendingApproveCoach | null>(null);
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

  const getStatusBadge = (status?: CoachVerificationStatus) => {
    switch (status) {
      case "VERIFIED":
        return "bg-green-100 text-green-700 border border-green-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border border-yellow-200";
      case "REVIEW":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "REJECTED":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

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
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Failed to send verification reminder.";
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
        await adminApi.rejectCoachVerification(
          actionCoachId,
          actionText.trim(),
        );
        toast.success("Coach rejected successfully.");
      } else {
        await adminApi.markCoachVerificationForReview(
          actionCoachId,
          actionText.trim() || undefined,
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

  if (loading) {
    return (
      <div className="text-center py-12">Loading coach verifications...</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="Coach Verification"
          subtitle="Review and verify coach documents to ensure trust on the platform."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadVerifications}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Coach Verification"
        subtitle="Review and verify coach documents to ensure trust on the platform."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {pagination.total} coach{pagination.total === 1 ? "" : "es"} in queue
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setCurrentPage(1);
            setStatusFilter(e.target.value as StatusFilter);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="REVIEW">In Review</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {coaches.length === 0 ? (
        <Card className="bg-white">
          <div className="py-12 text-center text-slate-600">
            No coach verification requests found.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {coaches.map((coach) => {
            const userInfo =
              typeof coach.userId === "object" && coach.userId !== null
                ? (coach.userId as Record<string, string>)
                : null;
            const coachId = getCoachId(coach);
            const coachDetailsHref = `/admin/coach-verification/${coachId}`;

            return (
              <Card key={coachId} className="bg-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {coachId ? (
                        <Link
                          href={coachDetailsHref}
                          className="text-lg font-semibold text-slate-900 transition-colors hover:text-power-orange"
                        >
                          {userInfo?.name || "Coach"}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-semibold text-slate-900">
                          {userInfo?.name || "Coach"}
                        </h3>
                      )}
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          coach.verificationStatus,
                        )}`}
                      >
                        {coach.verificationStatus || "UNVERIFIED"}
                      </span>
                    </div>
                    {coachId ? (
                      <Link
                        href={coachDetailsHref}
                        className="block text-sm text-slate-600 transition-colors hover:text-power-orange"
                      >
                        {userInfo?.email || "No email"}
                      </Link>
                    ) : (
                      <p className="text-sm text-slate-600">
                        {userInfo?.email || "No email"}
                      </p>
                    )}
                    <p className="text-sm text-slate-500">
                      Sports: {coach.sports.join(", ")}
                    </p>
                    {coach.verificationNotes && (
                      <p className="text-sm text-red-600">
                        Notes: {coach.verificationNotes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/coach-verification/${coachId}`}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </Link>
                    {coach.verificationStatus !== "VERIFIED" && (
                      <button
                        onClick={() => handleNotify(coach)}
                        disabled={actionLoading}
                        className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Notify
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(coach)}
                      disabled={actionLoading}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => startAction(coach, "REVIEW")}
                      disabled={actionLoading}
                      className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Mark Review
                    </button>
                    <button
                      onClick={() => startAction(coach, "REJECT")}
                      disabled={actionLoading}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {actionCoachId === coachId && actionMode && (
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {actionMode === "REJECT"
                        ? "Rejection reason"
                        : "Review notes (optional)"}
                    </p>
                    <textarea
                      rows={3}
                      value={actionText}
                      onChange={(event) => setActionText(event.target.value)}
                      placeholder={
                        actionMode === "REJECT"
                          ? "Explain why this verification is rejected"
                          : "Add notes for the review queue"
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={submitAction}
                        disabled={
                          actionLoading ||
                          (actionMode === "REJECT" && !actionText.trim())
                        }
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? "Saving..." : "Submit"}
                      </button>
                      <button
                        onClick={cancelAction}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Documents
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coach.verificationDocuments?.length ? (
                      coach.verificationDocuments.map((doc, index) => (
                        <a
                          key={`${doc.fileName}-${index}`}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-power-orange hover:text-power-orange transition-colors"
                        >
                          {doc.type}: {doc.fileName}
                        </a>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        No documents uploaded.
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm text-slate-600 sm:text-left">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, currentPage - 2),
                    Math.min(pagination.totalPages, currentPage + 1),
                  )
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                        currentPage === page
                          ? "bg-power-orange text-white"
                          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    setCurrentPage(
                      Math.min(pagination.totalPages, currentPage + 1),
                    )
                  }
                  disabled={currentPage === pagination.totalPages}
                  className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingApproveCoach)}
        title="Approve coach verification?"
        description={
          pendingApproveCoach
            ? `This will mark ${pendingApproveCoach.displayName} as verified.`
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
