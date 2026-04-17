"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Shield, UserX } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { BlockedUser } from "@/modules/community/types";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";

type ReportItem = {
  id: string;
  targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
  reason: string;
  status: string;
  resolutionNote?: string;
  createdAt: string;
};

export default function SafetyPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }

      const [blocked, reportData] = await Promise.all([
        communityService.getBlockedUsers(),
        communityService.listMyReports(1, 30),
      ]);

      setBlockedUsers(blocked || []);
      setReports((reportData.items || []) as ReportItem[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load safety center",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (userId: string) => {
    try {
      await communityService.unblockUser(userId);
      setBlockedUsers((current) =>
        current.filter((item) => item.id !== userId),
      );
      toast.success("User unblocked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unblock user",
      );
    }
  };

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap space-y-4">
        <Link href="/" className="community-back-link">
          <ChevronLeft size={14} />
          Back to Community
        </Link>

        <section className="community-card">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-power-orange" />
            <h1 className="community-section-title">Safety Center</h1>
          </div>
          <p className="community-section-copy">
            Moderation status visibility and personal safety controls in one
            place.
          </p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading safety data...
            </p>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  Blocked Users
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Manage users you blocked from direct interactions.
                </p>
                <div className="mt-3 space-y-2">
                  {blockedUsers.length === 0 ? (
                    <p className="text-xs text-slate-500">No blocked users.</p>
                  ) : (
                    blockedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {user.name}
                        </p>
                        <button
                          onClick={() => unblock(user.id)}
                          className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-power-orange/40 px-3 py-2 text-xs font-semibold text-power-orange transition hover:bg-power-orange/10"
                        >
                          Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">
                  My Report Status
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Track moderation outcomes and resolutions.
                </p>
                <div className="mt-3 space-y-2">
                  {reports.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No reports submitted.
                    </p>
                  ) : (
                    reports.map((report) => (
                      <div
                        key={report.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-xs"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-semibold text-slate-700">
                            {report.targetType}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${report.status === "RESOLVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            {report.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-800">
                          {report.reason}
                        </p>
                        {report.resolutionNote && (
                          <p className="mt-1 text-xs leading-6 text-slate-500">
                            {report.resolutionNote}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="community-card">
          <div className="flex items-center gap-2">
            <UserX size={18} className="text-rose-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              How Safety Actions Work
            </h2>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
            <li>Blocked users cannot message you directly.</li>
            <li>
              Reports are reviewed by moderation and updated with status notes.
            </li>
            <li>Resolved reports remain visible for accountability.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
