"use client";

import { useCallback, useEffect, useState } from "react";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { communityService } from "@/modules/community/services/community";
import { toast } from "@/lib/toast";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { getCommunitySocket } from "@/lib/realtime/socket";

type ReportItem = {
  id: string;
  targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER" | "EXPERIENCE";
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
  const [, setIsLoading] = useState(true);

  const loadReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }

      const data = await communityService.listMyReports(1, 50);
      const list = data?.items ?? [];
      setReports(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    const socket = getCommunitySocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleUpdate = () => {
      void loadReports();
    };

    socket.on("community:reportUpdated", handleUpdate);

    return () => {
      socket.off("community:reportUpdated", handleUpdate);
    };
  }, [loadReports]);

  const statusLabel = (status: string) =>
    status === "RESOLVED"
      ? "Resolved"
      : status === "OPEN"
        ? "Open"
        : status === "UNDER_REVIEW"
          ? "Under review"
          : status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="My reports"
          subtitle="Track what moderators decided on the reports you submitted."
          badge="Safety"
        />

        <div className="mt-12">
          {reports === null ? (
            <div
              aria-busy="true"
              aria-label="Loading your reports"
              className="border-hairline border-t"
            >
              {[1, 2].map((i) => (
                <div key={i} className="border-hairline space-y-3 border-b py-6">
                  <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                  <div className="bg-ink/10 h-5 w-2/3 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-paper-deep rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">No reports yet.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                If you report a message, question or group, the outcome is tracked here.
              </p>
            </div>
          ) : (
            <ul className="border-hairline border-t">
              {reports.map((report) => (
                <li key={report.id} className="border-hairline border-b py-6">
                  <p className="text-ink-muted flex flex-wrap items-center gap-x-2 text-sm">
                    <span>
                      {report.targetType.charAt(0) + report.targetType.slice(1).toLowerCase()}
                    </span>
                    <span aria-hidden>·</span>
                    <span
                      className={`font-semibold ${
                        report.status === "RESOLVED" ? "text-green-700" : "text-ink"
                      }`}
                    >
                      {statusLabel(report.status)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                  </p>
                  <p className="font-editorial text-ink mt-2 text-2xl font-normal leading-tight">
                    {report.reason}
                  </p>
                  {report.details && (
                    <p className="text-ink-body mt-2 max-w-[60ch] text-base leading-relaxed">
                      {report.details}
                    </p>
                  )}
                  {report.targetType === "MESSAGE" && report.messageAudit && (
                    <p className="text-ink-muted mt-2 text-sm">
                      Message snapshot kept
                      {report.messageAudit.wasEdited ? " · was edited" : ""}
                      {report.messageAudit.wasDeleted ? " · was deleted" : ""}
                    </p>
                  )}
                  {report.resolutionNote && (
                    <blockquote className="border-ink mt-4 border-l-2 pl-4">
                      <p className="text-ink-muted text-sm">Moderator note</p>
                      <p className="text-ink mt-1 text-base leading-relaxed">
                        {report.resolutionNote}
                      </p>
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
