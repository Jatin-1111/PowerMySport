"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import {
  CommunityReportRecord,
  adminApi,
} from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { useCallback, useEffect, useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  REJECTED: "bg-slate-100 text-slate-500",
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
    status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED",
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="Community Reports"
        subtitle="Review user-submitted reports for messages and groups."
      />

      <Card className="bg-white space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No reports found.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;

              return (
                <div
                  key={report.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[report.status] ?? "bg-slate-100 text-slate-500"}`}
                        >
                          {report.status.replace("_", " ")}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {report.targetType}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {report.reason}
                      </p>
                      {report.details && (
                        <p className="mt-1 text-sm text-slate-600">
                          {report.details}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        Reported by {report.reporterUserId.slice(-6)} •{" "}
                        {new Date(report.createdAt).toLocaleDateString()}
                        {report.resolutionNote && (
                          <> • Note: {report.resolutionNote}</>
                        )}
                      </p>
                    </div>

                    {(report.status === "OPEN" ||
                      report.status === "UNDER_REVIEW") && (
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : report.id)
                        }
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {isExpanded ? "Cancel" : "Review"}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Resolution Note (optional)
                        </label>
                        <textarea
                          rows={2}
                          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          placeholder="Optional note for your records..."
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
                            onClick={() =>
                              handleReview(report.id, "UNDER_REVIEW")
                            }
                            className="rounded bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                          >
                            Mark Under Review
                          </button>
                        )}
                        <button
                          disabled={busyId === report.id}
                          onClick={() => handleReview(report.id, "RESOLVED")}
                          className="rounded bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          disabled={busyId === report.id}
                          onClick={() => handleReview(report.id, "REJECTED")}
                          className="rounded bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
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
      </Card>
    </div>
  );
}
