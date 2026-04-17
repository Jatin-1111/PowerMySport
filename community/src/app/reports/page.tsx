"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, FileText, Flag } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";

type ReportItem = {
  id: string;
  targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
  targetId: string;
  reason: string;
  details?: string;
  status: string;
  resolutionNote?: string;
  createdAt: string;
  reviewedAt?: string | null;
  messageAudit?: {
    senderId?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    editedAt?: string | null;
    deletedAt?: string | null;
    wasEdited: boolean;
    wasDeleted: boolean;
  };
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }

      const data = await communityService.listMyReports(1, 50);
      const list =
        (data as unknown as { reports?: ReportItem[] })?.reports ??
        data?.items ??
        [];
      setReports(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load reports",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow space-y-4">
        <Link href="/" className="community-back-link">
          <ChevronLeft size={14} />
          Back to Community
        </Link>

        <section className="community-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileText size={17} className="text-slate-600" />
              <h1 className="community-section-title">My Reports</h1>
            </div>
            <button
              onClick={() => void loadReports()}
              disabled={isLoading}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 sm:px-3"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <p className="community-section-copy">
            Track moderation status for reports you submitted.
          </p>

          {reports === null ? (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-slate-50 p-8 text-center">
              <Flag size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Load your reports
              </p>
            </div>
          ) : reports.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-slate-50 p-8 text-center">
              <Flag size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                No reports yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You have not reported any content yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${report.targetType === "GROUP" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {report.targetType}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${report.status === "RESOLVED" ? "bg-green-100 text-green-700" : report.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {report.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 sm:text-right">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-800">
                    {report.reason}
                  </p>
                  {report.details && (
                    <p className="mt-1 text-xs text-slate-500">
                      {report.details}
                    </p>
                  )}
                  {report.targetType === "MESSAGE" && report.messageAudit && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Message snapshot
                      </span>
                      {report.messageAudit.wasEdited && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Was edited
                        </span>
                      )}
                      {report.messageAudit.wasDeleted && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          Was deleted
                        </span>
                      )}
                    </div>
                  )}
                  {report.resolutionNote && (
                    <div className="mt-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                        Admin note
                      </p>
                      <p className="mt-0.5 text-xs text-green-900">
                        {report.resolutionNote}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
