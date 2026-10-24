"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { CommunityReportRecord, adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { Tabs } from "@/modules/shared/ui/Tabs";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";

const STATUS_TONE: Record<string, "amber" | "blue" | "green" | "slate"> = {
  OPEN: "amber",
  UNDER_REVIEW: "blue",
  RESOLVED: "green",
  REJECTED: "slate",
};

export default function AdminCommunityReportsPage() {
  const [reports, setReports] = useState<CommunityReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED"
  >("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getCommunityReports({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        limit: 100,
      });
      if (response.success && response.data) {
        setReports(response.data);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleReview = async (
    reportId: string,
    status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED"
  ) => {
    setBusyId(reportId);
    try {
      const resolutionNote = noteInputs[reportId]?.trim() || undefined;
      await adminApi.reviewCommunityReport(reportId, {
        status,
        ...(resolutionNote ? { resolutionNote } : {}),
      });
      setExpandedId(null);
      await loadReports();
    } finally {
      setBusyId(null);
    }
  };

  const actionableReports = reports.filter(
    (r) => r.status === "OPEN" || r.status === "UNDER_REVIEW"
  );

  const toggleSelected = (reportId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === actionableReports.length
        ? new Set()
        : new Set(actionableReports.map((r) => r.id))
    );
  };

  const handleBulkReview = async (status: "RESOLVED" | "REJECTED") => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const response = await adminApi.bulkReviewCommunityReports({
        reportIds: Array.from(selectedIds),
        status,
      });
      if (response.success) {
        setSelectedIds(new Set());
        await loadReports();
      }
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Trust & Support"
        title="Community reports"
        subtitle="Messages and groups that members have reported. Review each one, then resolve or reject it."
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs
            className="min-w-0 flex-1"
            label="Report status"
            value={statusFilter}
            onChange={setStatusFilter}
            tabs={[
              { id: "ALL" as const, label: "All" },
              { id: "OPEN" as const, label: "Open" },
              { id: "UNDER_REVIEW" as const, label: "Under review" },
              { id: "RESOLVED" as const, label: "Resolved" },
              { id: "REJECTED" as const, label: "Rejected" },
            ]}
          />

          {actionableReports.length > 0 && (
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === actionableReports.length}
                onChange={toggleSelectAll}
                className="size-4 rounded accent-orange-700"
              />
              Select all that need action
            </label>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <span className="text-sm font-semibold text-orange-800">
              {selectedIds.size} selected
            </span>
            <button
              disabled={bulkBusy}
              onClick={() => handleBulkReview("RESOLVED")}
              className={btn("primary", "sm")}
            >
              Resolve selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => handleBulkReview("REJECTED")}
              className={btn("dangerOutline", "sm")}
            >
              Reject selected
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => setSelectedIds(new Set())}
              className={btn("outline", "sm")}
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonBlock rows={6} label="Loading reports" />
        ) : reports.length === 0 ? (
          <EmptyState title="No reports here" description="Nothing matches this status." />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;

              return (
                <div key={report.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {(report.status === "OPEN" || report.status === "UNDER_REVIEW") && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(report.id)}
                            onChange={() => toggleSelected(report.id)}
                            className="size-4 rounded accent-orange-700"
                          />
                        )}
                        <StatusBadge
                          status={report.status}
                          tone={STATUS_TONE[report.status] ?? "slate"}
                          size="sm"
                        />
                        <StatusBadge
                          status={report.targetType}
                          tone="slate"
                          dot={false}
                          size="sm"
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{report.reason}</p>
                      {report.details && (
                        <p className="mt-1 text-sm text-slate-600">{report.details}</p>
                      )}
                      <p
                        className={`mt-2 text-sm italic ${report.targetDeleted ? "text-slate-500" : "text-slate-600"}`}
                      >
                        &ldquo;{report.targetPreview}&rdquo;
                      </p>
                      {report.reportedContent && report.targetDeleted ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          <span className="font-semibold">As reported:</span> &ldquo;
                          {report.reportedContent}&rdquo;
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        Reported by {report.reporterUserId.name}
                        {report.reporterUserId.email && ` (${report.reporterUserId.email})`} •{" "}
                        {new Date(report.createdAt).toLocaleDateString()}
                        {report.resolutionNote && <> • Note: {report.resolutionNote}</>}
                        {report.reviewedBy && <> • Reviewed by {report.reviewedBy.name}</>}
                      </p>
                    </div>

                    {(report.status === "OPEN" || report.status === "UNDER_REVIEW") && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        className={btn("outline", "sm")}
                      >
                        {isExpanded ? "Cancel" : "Review"}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      <div>
                        <label className={labelClass} htmlFor={`note-${report.id}`}>
                          Resolution note (optional)
                        </label>
                        <textarea
                          id={`note-${report.id}`}
                          rows={2}
                          className={fieldClass}
                          placeholder="Anything worth remembering about this decision"
                          value={noteInputs[report.id] ?? ""}
                          onChange={(e) =>
                            setNoteInputs((prev) => ({
                              ...prev,
                              [report.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {report.status === "OPEN" && (
                          <button
                            disabled={busyId === report.id}
                            onClick={() => handleReview(report.id, "UNDER_REVIEW")}
                            className={btn("outline", "sm")}
                          >
                            Mark under review
                          </button>
                        )}
                        <button
                          disabled={busyId === report.id}
                          onClick={() => handleReview(report.id, "RESOLVED")}
                          className={btn("primary", "sm")}
                        >
                          Resolve
                        </button>
                        <button
                          disabled={busyId === report.id}
                          onClick={() => handleReview(report.id, "REJECTED")}
                          className={btn("dangerOutline", "sm")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
