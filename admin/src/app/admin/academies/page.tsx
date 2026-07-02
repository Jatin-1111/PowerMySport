"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  adminApi,
  AcademyAdminQueueRecord,
  AcademyAdminReviewDetails,
} from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { Card } from "@/modules/shared/ui/Card";
import { toast } from "sonner";
import {
  BadgeCheck,
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  ShieldAlert,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type QueueFilter = "pending" | "approved" | "rejected";
type ActionMode = "APPROVE" | "KYC" | "REJECT" | "SUSPEND";

const PAGE_SIZE = 10;

const statusBadge = (academy: AcademyAdminQueueRecord) => {
  if (academy.isActive) {
    return "bg-green-100 text-green-700 border border-green-200";
  }
  if (academy.isApproved) {
    return "bg-blue-100 text-blue-700 border border-blue-200";
  }
  if (academy.rejectionReason) {
    return "bg-red-100 text-red-700 border border-red-200";
  }
  return "bg-yellow-100 text-yellow-700 border border-yellow-200";
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export default function AdminAcademiesPage() {
  const [academies, setAcademies] = useState<AcademyAdminQueueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(
    null,
  );
  const [selectedAcademy, setSelectedAcademy] =
    useState<AcademyAdminReviewDetails | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [showBulkRejectInput, setShowBulkRejectInput] = useState(false);

  const loadAcademies = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await adminApi.getPendingAcademies({
        page: currentPage,
        limit: PAGE_SIZE,
        filter,
      });

      if (response.success && response.data) {
        setAcademies(response.data.academies || []);
        setPagination({
          total: response.data.total || 0,
          page: response.data.page || 1,
          totalPages: response.data.totalPages || 1,
        });
        return;
      }

      setError(response.message || "Failed to load academies.");
    } catch (err) {
      console.error("Failed to load academies:", err);
      setError("Failed to load academies.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter]);

  const loadSelectedAcademy = useCallback(async (academyId: string) => {
    setSelectedLoading(true);
    try {
      const response = await adminApi.getAcademyReviewDetails(academyId);
      if (response.success && response.data) {
        setSelectedAcademy(response.data);
        setRejectionReason(response.data.rejectionReason || "");
      } else {
        setSelectedAcademy(null);
      }
    } catch (err) {
      console.error("Failed to load academy review details:", err);
      toast.error("Failed to load academy details.");
      setSelectedAcademy(null);
    } finally {
      setSelectedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcademies();
    setSelectedIds(new Set());
  }, [loadAcademies]);

  useEffect(() => {
    if (selectedAcademyId) {
      void loadSelectedAcademy(selectedAcademyId);
    }
  }, [selectedAcademyId, loadSelectedAcademy]);

  const currentSelection = useMemo(() => {
    if (!selectedAcademyId) return null;
    return (
      academies.find((academy) => academy.id === selectedAcademyId) || null
    );
  }, [academies, selectedAcademyId]);

  const openAction = (mode: ActionMode) => {
    if (!selectedAcademyId) return;
    setActionMode(mode);
  };

  const closeAction = () => {
    setActionMode(null);
  };

  const runAction = async () => {
    if (!selectedAcademyId || !actionMode) return;

    setActionLoading(true);
    try {
      if (actionMode === "APPROVE") {
        await adminApi.approveAcademy(selectedAcademyId);
        toast.success("Academy approved successfully.");
      } else if (actionMode === "KYC") {
        await adminApi.markAcademyKycVerified(selectedAcademyId);
        toast.success("KYC verification updated.");
      } else if (actionMode === "REJECT") {
        if (!rejectionReason.trim()) {
          toast.error("Please enter a rejection reason.");
          return;
        }
        await adminApi.rejectAcademy(selectedAcademyId, rejectionReason.trim());
        toast.success("Academy rejected successfully.");
      } else if (actionMode === "SUSPEND") {
        await adminApi.suspendAcademy(
          selectedAcademyId,
          suspendReason.trim() || undefined,
        );
        toast.success("Academy suspended successfully.");
      }

      closeAction();
      await Promise.all([
        loadAcademies(),
        loadSelectedAcademy(selectedAcademyId),
      ]);
    } catch (err) {
      console.error("Failed to process academy action:", err);
      toast.error("Failed to process academy action.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelected = (academyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(academyId)) {
        next.delete(academyId);
      } else {
        next.add(academyId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === academies.length
        ? new Set()
        : new Set(academies.map((a) => a.id)),
    );
  };

  const runBulkAction = async (mode: "APPROVE" | "REJECT") => {
    if (selectedIds.size === 0) return;
    if (mode === "REJECT" && !bulkRejectReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) =>
          mode === "APPROVE"
            ? adminApi.approveAcademy(id)
            : adminApi.rejectAcademy(id, bulkRejectReason.trim()),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = ids.length - failed;

      if (succeeded > 0) {
        toast.success(
          `${mode === "APPROVE" ? "Approved" : "Rejected"} ${succeeded} ${succeeded === 1 ? "academy" : "academies"}.`,
        );
      }
      if (failed > 0) {
        toast.error(
          `Failed to process ${failed} ${failed === 1 ? "academy" : "academies"}.`,
        );
      }

      setShowBulkRejectInput(false);
      setBulkRejectReason("");
      setSelectedIds(new Set());
      await loadAcademies();
    } finally {
      setBulkBusy(false);
    }
  };

  const selectedQueueItem = currentSelection;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminPageHeader
          badge="Admin"
          title="Academy Management"
          subtitle="Review academy submissions, verify KYC, and manage live status from one place."
        />
        <Link
          href="/admin/academies/add"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <Plus size={16} />
          Create Academy
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {pagination.total} academy{submissionCountLabel(pagination.total)} in
          queue
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Filter size={16} />
            <select
              value={filter}
              onChange={(event) => {
                setCurrentPage(1);
                setSelectedAcademyId(null);
                setSelectedAcademy(null);
                setFilter(event.target.value as QueueFilter);
              }}
              className="bg-transparent outline-none"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {filter === "pending" && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-orange-800">
              {selectedIds.size} selected
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => runBulkAction("APPROVE")}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve Selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() =>
                setShowBulkRejectInput((prev) => {
                  const next = !prev;
                  if (!next) setBulkRejectReason("");
                  return next;
                })
              }
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Reject Selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => {
                setSelectedIds(new Set());
                setShowBulkRejectInput(false);
                setBulkRejectReason("");
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          {showBulkRejectInput && (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <textarea
                rows={1}
                value={bulkRejectReason}
                onChange={(event) => setBulkRejectReason(event.target.value)}
                placeholder="Rejection reason applied to all selected academies..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/40"
              />
              <button
                disabled={bulkBusy}
                onClick={() => runBulkAction("REJECT")}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadAcademies}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : loading ? (
        <div className="py-12 text-center">Loading academies...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="bg-white">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Queue</h2>
                <p className="text-sm text-slate-600">
                  Click a row to review full submission details.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {filter === "pending" && academies.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size === academies.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Select all
                  </label>
                )}
                <div className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
              </div>
            </div>

            {academies.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center text-slate-600">
                <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
                  No academies found
                </div>
                <p className="max-w-md">
                  There are no records for the selected filter right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {academies.map((academy) => {
                  const isSelected = academy.id === selectedAcademyId;
                  return (
                    <div
                      key={academy.id}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 transition ${
                        isSelected
                          ? "border-power-orange bg-orange-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      {filter === "pending" && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(academy.id)}
                          onChange={() => toggleSelected(academy.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedAcademyId(academy.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-900">
                                {academy.name}
                              </h3>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(academy)}`}
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
                            <p className="mt-1 text-sm text-slate-600">
                              {academy.city || "Location unavailable"} •{" "}
                              {academy.sports.join(", ") || "No sports listed"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Owner: {academy.ownerEmail || "N/A"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Eye size={16} />
                            Review
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-slate-600 sm:text-left">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                  {pagination.total}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage(
                        Math.min(pagination.totalPages, currentPage + 1),
                      )
                    }
                    disabled={currentPage === pagination.totalPages}
                    className="rounded-lg border border-slate-300 p-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-white">
            {!selectedAcademyId ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-14 text-center text-slate-600">
                <ShieldAlert size={28} className="text-slate-400" />
                <p className="font-semibold text-slate-900">
                  Select an academy
                </p>
                <p className="max-w-sm text-sm">
                  Review details, verify KYC, and approve or reject the
                  submission.
                </p>
              </div>
            ) : selectedLoading ? (
              <div className="py-12 text-center">Loading review details...</div>
            ) : selectedAcademy ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {selectedAcademy.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedAcademy.legalName || selectedAcademy.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(selectedAcademy)}`}
                    >
                      {selectedAcademy.rejectionReason
                        ? "Rejected"
                        : selectedAcademy.isActive
                          ? "Live"
                          : selectedAcademy.isApproved
                            ? "Approved"
                            : "Pending"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Step {selectedAcademy.onboardingStep || 1}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {selectedAcademy.city || "No city"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Owner:</span>{" "}
                    {selectedAcademy.ownerId?.name ||
                      selectedAcademy.ownerEmail ||
                      "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Phone:</span>{" "}
                    {selectedAcademy.ownerId?.phone ||
                      selectedAcademy.ownerPhone ||
                      "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Submitted:
                    </span>{" "}
                    {formatDate(selectedAcademy.submittedAt || "N/A")}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Last reviewed:
                    </span>{" "}
                    {formatDate(
                      selectedAcademy.lastReviewedAt ||
                        selectedAcademy.submittedAt ||
                        "N/A",
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Sports
                    </p>
                    <p className="mt-1">
                      {selectedAcademy.sports?.join(", ") || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </p>
                    <p className="mt-1 leading-relaxed">
                      {selectedAcademy.description ||
                        "No description provided."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Compliance
                    </p>
                    <p className="mt-1">
                      PAN: {selectedAcademy.panNumber || "N/A"} • GST:{" "}
                      {selectedAcademy.gstNumber || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-900">Notes</p>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    placeholder="Use this field for rejection reasons or review notes."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                  />
                  <textarea
                    value={suspendReason}
                    onChange={(event) => setSuspendReason(event.target.value)}
                    rows={3}
                    placeholder="Optional suspend reason."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => openAction("APPROVE")}
                    className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    Approve Academy
                  </button>
                  <button
                    onClick={() => openAction("KYC")}
                    className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                  >
                    Mark KYC Verified
                  </button>
                  <button
                    onClick={() => openAction("REJECT")}
                    className="rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                  >
                    Reject Academy
                  </button>
                  <button
                    onClick={() => openAction("SUSPEND")}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Suspend Academy
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-600">
                Failed to load academy details.
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmModal
        open={actionMode !== null}
        title={
          actionMode === "APPROVE"
            ? "Approve academy?"
            : actionMode === "KYC"
              ? "Mark KYC verified?"
              : actionMode === "REJECT"
                ? "Reject academy?"
                : "Suspend academy?"
        }
        description={
          actionMode === "REJECT"
            ? "Enter or confirm the rejection reason in the notes field before rejecting."
            : actionMode === "SUSPEND"
              ? "You can optionally include a reason in the notes field."
              : "This will update the academy status immediately."
        }
        confirmLabel={
          actionMode === "APPROVE"
            ? "Approve"
            : actionMode === "KYC"
              ? "Verify KYC"
              : actionMode === "REJECT"
                ? "Reject"
                : "Suspend"
        }
        cancelLabel="Cancel"
        variant={
          actionMode === "REJECT" || actionMode === "SUSPEND"
            ? "danger"
            : "default"
        }
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={closeAction}
      />
    </div>
  );
}

function submissionCountLabel(total: number) {
  return total === 1 ? "" : "s";
}
