"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
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
      toast.error(error instanceof Error ? error.message : "Failed to load safety center");
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
      setBlockedUsers((current) => current.filter((item) => item.id !== userId));
      toast.success("User unblocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not unblock that user");
    }
  };

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="Safety centre"
          subtitle="Who you have blocked, and what happened to the reports you made."
          badge="Safety"
        />

        {isLoading ? (
          <div aria-busy="true" aria-label="Loading safety data" className="mt-12 space-y-4">
            <div className="bg-ink/10 h-8 w-48 animate-pulse rounded-sm" />
            <div className="bg-ink/10 h-16 animate-pulse rounded-sm" />
          </div>
        ) : (
          <div className="mt-12 space-y-14">
            <section aria-labelledby="safety-blocked">
              <h2 id="safety-blocked" className="font-editorial text-ink text-3xl font-light">
                Blocked users
              </h2>
              <p className="text-ink-body mt-2 text-base">People you blocked cannot message you.</p>
              <ul className="border-hairline mt-4 border-t">
                {blockedUsers.length === 0 ? (
                  <li className="border-hairline text-ink-body border-b py-4 text-base">
                    You have not blocked anyone.
                  </li>
                ) : (
                  blockedUsers.map((user) => (
                    <li
                      key={user.id}
                      className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b py-4"
                    >
                      <p className="text-ink text-lg font-medium">{user.name}</p>
                      <button
                        type="button"
                        onClick={() => unblock(user.id)}
                        className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white"
                      >
                        Unblock
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section aria-labelledby="safety-reports">
              <h2 id="safety-reports" className="font-editorial text-ink text-3xl font-light">
                Your reports
              </h2>
              <p className="text-ink-body mt-2 text-base">
                Outcomes from moderation.{" "}
                <Link
                  href="/reports"
                  className="text-ink decoration-ink/30 hover:decoration-ink text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                >
                  See full details
                </Link>
              </p>
              <ul className="border-hairline mt-4 border-t">
                {reports.length === 0 ? (
                  <li className="border-hairline text-ink-body border-b py-4 text-base">
                    You have not submitted any reports.
                  </li>
                ) : (
                  reports.map((report) => (
                    <li key={report.id} className="border-hairline border-b py-5">
                      <p className="text-ink-muted text-sm">
                        {report.targetType.charAt(0) + report.targetType.slice(1).toLowerCase()}
                        <span aria-hidden> · </span>
                        <span
                          className={`font-semibold ${
                            report.status === "RESOLVED" ? "text-green-700" : "text-ink"
                          }`}
                        >
                          {report.status === "RESOLVED" ? "Resolved" : "Being reviewed"}
                        </span>
                      </p>
                      <p className="text-ink mt-1 text-lg leading-snug">{report.reason}</p>
                      {report.resolutionNote && (
                        <p className="text-ink-body mt-2 max-w-[60ch] text-base leading-relaxed">
                          {report.resolutionNote}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section aria-labelledby="safety-how" className="bg-paper-deep rounded-2xl p-6 sm:p-8">
              <h2 id="safety-how" className="font-editorial text-ink text-2xl font-normal">
                How safety actions work
              </h2>
              <ul className="text-ink-body mt-4 space-y-2 text-base leading-relaxed">
                <li>Blocked users cannot message you directly.</li>
                <li>Moderators review reports and add a note to the outcome.</li>
                <li>Resolved reports stay visible so decisions can be checked.</li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
