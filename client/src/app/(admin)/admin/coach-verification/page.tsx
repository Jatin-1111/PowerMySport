"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, CoachVerificationStatus } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type StatusFilter = CoachVerificationStatus | "ALL";

export default function AdminCoachVerificationPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const PAGE_SIZE = 10;

  const loadVerifications = useCallback(async () => {
    setLoading(true);
    try {
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
      }
    } catch (error) {
      console.error("Failed to load coach verifications:", error);
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

  const handleApprove = async (coach: Coach) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    try {
      await adminApi.approveCoachVerification(coachId);
      await loadVerifications();
    } catch (error) {
      console.error("Failed to approve coach:", error);
    }
  };

  const handleReject = async (coach: Coach) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    const reason = window.prompt("Enter rejection reason");
    if (!reason) return;

    try {
      await adminApi.rejectCoachVerification(coachId, reason);
      await loadVerifications();
    } catch (error) {
      console.error("Failed to reject coach:", error);
    }
  };

  const handleReview = async (coach: Coach) => {
    const coachId = getCoachId(coach);
    if (!coachId) return;

    const notes = window.prompt("Add review notes (optional)") || undefined;

    try {
      await adminApi.markCoachVerificationForReview(coachId, notes);
      await loadVerifications();
    } catch (error) {
      console.error("Failed to mark coach for review:", error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">Loading coach verifications...</div>
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

            return (
              <Card key={coachId} className="bg-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {userInfo?.name || "Coach"}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          coach.verificationStatus,
                        )}`}
                      >
                        {coach.verificationStatus || "UNVERIFIED"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {userInfo?.email || "No email"}
                    </p>
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
                    <button
                      onClick={() => handleApprove(coach)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(coach)}
                      className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Mark Review
                    </button>
                    <button
                      onClick={() => handleReject(coach)}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>

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
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                {pagination.total}
              </p>
              <div className="flex items-center gap-2">
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
    </div>
  );
}
