"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  adminApi,
  AcademyAdminQueueRecord,
  AcademyAdminReviewDetails,
} from "@/modules/admin/services/admin";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { btn, fieldClass } from "@/modules/shared/ui/buttonStyles";
import { Pagination } from "@/modules/shared/ui/Pagination";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge, type StatusTone } from "@/modules/shared/ui/StatusBadge";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { toast } from "sonner";
import { Eye, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type QueueFilter = "pending" | "approved" | "rejected";
type ActionMode = "APPROVE" | "KYC" | "REJECT" | "SUSPEND";

const PAGE_SIZE = 10;

const academyStatus = (academy: AcademyAdminQueueRecord): { label: string; tone: StatusTone } => {
  if (academy.rejectionReason) return { label: "Rejected", tone: "red" };
  if (academy.isActive) return { label: "Live", tone: "green" };
  if (academy.isApproved) return { label: "Approved", tone: "blue" };
  return { label: "Pending", tone: "amber" };
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
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [selectedAcademy, setSelectedAcademy] = useState<AcademyAdminReviewDetails | null>(null);
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
        await adminApi.suspendAcademy(selectedAcademyId, suspendReason.trim() || undefined);
        toast.success("Academy suspended successfully.");
      }

      closeAction();
      await Promise.all([loadAcademies(), loadSelectedAcademy(selectedAcademyId)]);
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
      prev.size === academies.length ? new Set() : new Set(academies.map((a) => a.id))
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
            : adminApi.rejectAcademy(id, bulkRejectReason.trim())
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = ids.length - failed;

      if (succeeded > 0) {
        toast.success(
          `${mode === "APPROVE" ? "Approved" : "Rejected"} ${succeeded} ${succeeded === 1 ? "academy" : "academies"}.`
        );
      }
      if (failed > 0) {
        toast.error(`Failed to process ${failed} ${failed === 1 ? "academy" : "academies"}.`);
      }

      setShowBulkRejectInput(false);
      setBulkRejectReason("");
      setSelectedIds(new Set());
      await loadAcademies();
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="People"
        title="Academies"
        subtitle="Review academy submissions, verify KYC and manage live status."
        action={
          <Link href="/admin/academies/add" className={btn("accent")}>
            <Plus size={16} aria-hidden />
            Create academy
          </Link>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          className="min-w-0 flex-1"
          label="Academy queue"
          value={filter}
          tabs={[
            { id: "pending" as const, label: "Pending" },
            { id: "approved" as const, label: "Approved" },
            { id: "rejected" as const, label: "Rejected" },
          ]}
          onChange={(next) => {
            setCurrentPage(1);
            setSelectedAcademyId(null);
            setSelectedAcademy(null);
            setFilter(next);
          }}
        />
        <p className="pb-2 text-sm tabular-nums text-slate-600">
          {pagination.total} academ{pagination.total === 1 ? "y" : "ies"}
        </p>
      </div>

      {filter === "pending" && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-orange-800">
              {selectedIds.size} selected
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => runBulkAction("APPROVE")}
              className={btn("primary", "sm")}
            >
              Approve selected
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
              className={btn("dangerOutline", "sm")}
            >
              Reject selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => {
                setSelectedIds(new Set());
                setShowBulkRejectInput(false);
                setBulkRejectReason("");
              }}
              className={btn("outline", "sm")}
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
                className={`${fieldClass} flex-1`}
              />
              <button
                disabled={bulkBusy}
                onClick={() => runBulkAction("REJECT")}
                className={btn("danger", "sm")}
              >
                Reject all selected
              </button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <ErrorNotice message={error} onRetry={loadAcademies} />
      ) : loading ? (
        <SkeletonBlock rows={6} label="Loading academies" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Submissions</h2>
                <p className="text-sm text-slate-600">Pick a row to review the full submission.</p>
              </div>
              <div className="flex items-center gap-3">
                {filter === "pending" && academies.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === academies.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Select all
                  </label>
                )}
              </div>
            </div>

            {academies.length === 0 ? (
              <EmptyState
                title="No academies here"
                description="Nothing matches this queue right now."
              />
            ) : (
              <div className="space-y-3">
                {academies.map((academy) => {
                  const isSelected = academy.id === selectedAcademyId;
                  return (
                    <div
                      key={academy.id}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 transition-colors ${
                        isSelected
                          ? "border-power-orange-solid ring-power-orange-solid bg-orange-50 ring-1"
                          : "border-slate-200 bg-white hover:border-slate-300"
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
                              <StatusBadge
                                size="sm"
                                status={academyStatus(academy).label}
                                tone={academyStatus(academy).tone}
                              />
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

            <Pagination
              className="mt-5"
              page={currentPage}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setCurrentPage}
            />
          </Panel>

          <Panel>
            {!selectedAcademyId ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-14 text-center text-slate-600">
                <ShieldAlert size={28} className="text-slate-500" />
                <p className="font-semibold text-slate-900">Select an academy</p>
                <p className="max-w-sm text-sm">
                  Review details, verify KYC, and approve or reject the submission.
                </p>
              </div>
            ) : selectedLoading ? (
              <SkeletonBlock rows={6} label="Loading review details" />
            ) : selectedAcademy ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedAcademy.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedAcademy.legalName || selectedAcademy.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge
                      status={academyStatus(selectedAcademy).label}
                      tone={academyStatus(selectedAcademy).tone}
                    />
                    <StatusBadge
                      status={`Step ${selectedAcademy.onboardingStep || 1}`}
                      tone="slate"
                      dot={false}
                    />
                    <StatusBadge
                      status={selectedAcademy.city || "No city"}
                      tone="slate"
                      dot={false}
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Owner:</span>{" "}
                    {selectedAcademy.ownerId?.name || selectedAcademy.ownerEmail || "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Phone:</span>{" "}
                    {selectedAcademy.ownerId?.phone || selectedAcademy.ownerPhone || "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Submitted:</span>{" "}
                    {formatDate(selectedAcademy.submittedAt || "N/A")}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Last reviewed:</span>{" "}
                    {formatDate(
                      selectedAcademy.lastReviewedAt || selectedAcademy.submittedAt || "N/A"
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Sports</p>
                    <p className="mt-1">{selectedAcademy.sports?.join(", ") || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Description</p>
                    <p className="mt-1 leading-relaxed">
                      {selectedAcademy.description || "No description provided."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Compliance</p>
                    <p className="mt-1">
                      PAN: {selectedAcademy.panNumber || "N/A"} • GST:{" "}
                      {selectedAcademy.gstNumber || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-900">Notes for the decision</p>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    placeholder="Use this field for rejection reasons or review notes."
                    className={fieldClass}
                  />
                  <textarea
                    value={suspendReason}
                    onChange={(event) => setSuspendReason(event.target.value)}
                    rows={3}
                    placeholder="Optional suspend reason."
                    className={fieldClass}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openAction("APPROVE")}
                    className={btn("primary")}
                  >
                    Approve academy
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction("KYC")}
                    className={btn("outline")}
                  >
                    Mark KYC verified
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction("SUSPEND")}
                    className={btn("outline")}
                  >
                    Suspend academy
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction("REJECT")}
                    className={btn("dangerOutline")}
                  >
                    Reject academy
                  </button>
                </div>
              </div>
            ) : (
              <ErrorNotice message="We couldn't load this academy's details." />
            )}
          </Panel>
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
        variant={actionMode === "REJECT" || actionMode === "SUSPEND" ? "danger" : "default"}
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={closeAction}
      />
    </div>
  );
}
