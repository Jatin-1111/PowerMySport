"use client";

import { toast } from "@/lib/toast";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import {
  CoachSubscriptionOverrideRequestRecord,
  CoachSubscriptionOverrideStatus,
} from "@/types";
import { useCallback, useEffect, useState } from "react";

const getCoachIdentifier = (
  coach: CoachSubscriptionOverrideRequestRecord["coachId"],
) => {
  if (!coach) return "-";
  if (typeof coach === "string") return coach;
  return coach.id || coach._id || coach.userId || "-";
};

const getPlanName = (
  plan: CoachSubscriptionOverrideRequestRecord["requestedPlanId"],
) => {
  if (!plan) return "-";
  if (typeof plan === "string") return plan;
  return plan.name || plan.code || plan.id || plan._id || "-";
};

export default function AdminCoachSubscriptionOverridesPage() {
  const [requests, setRequests] = useState<
    CoachSubscriptionOverrideRequestRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | CoachSubscriptionOverrideStatus>(
    "",
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.listCoachSubscriptionOverrides({
        status: status || undefined,
        page,
        limit: 20,
      });

      setRequests(response.data?.requests || []);
      setTotalPages(response.data?.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
      setRequests([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const reviewRequest = async (
    item: CoachSubscriptionOverrideRequestRecord,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const requestId = item.id || item._id;
    if (!requestId) {
      toast.error("Request id missing.");
      return;
    }

    setActingId(requestId);
    try {
      const reviewNote = (reviewNotes[requestId] || "").trim();
      const response = await adminApi.reviewCoachSubscriptionOverride(
        requestId,
        {
          status: decision,
          reviewNote: reviewNote || undefined,
        },
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to update request");
      }

      toast.success(
        `Override request ${decision === "APPROVED" ? "approved" : "rejected"}.`,
      );
      setReviewNotes((prev) => ({ ...prev, [requestId]: "" }));
      await loadRequests();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to review request",
      );
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Coach Billing"
        title="Override Reviews"
        subtitle="Review coach requests for subscription exceptions."
      />

      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(
              event.target.value as "" | CoachSubscriptionOverrideStatus,
            );
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card className="bg-white p-5 text-center text-slate-500">
            Loading override requests...
          </Card>
        ) : requests.length === 0 ? (
          <Card className="bg-white p-5 text-center text-slate-500">
            No override requests found.
          </Card>
        ) : (
          requests.map((item) => {
            const requestId = item.id || item._id || "";
            const isPending = item.status === "PENDING";

            return (
              <Card key={requestId} className="bg-white">
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">Coach</p>
                      <p className="font-semibold text-slate-900">
                        {getCoachIdentifier(item.coachId)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {item.status}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Current Plan
                      </p>
                      <p className="text-sm text-slate-900">
                        {getPlanName(item.currentPlanId)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Requested Plan
                      </p>
                      <p className="text-sm text-slate-900">
                        {getPlanName(item.requestedPlanId)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Submitted At
                      </p>
                      <p className="text-sm text-slate-900">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Note
                    </p>
                    <p className="text-sm text-slate-800">{item.note}</p>
                  </div>

                  {isPending ? (
                    <div className="flex gap-2">
                      <textarea
                        value={reviewNotes[requestId] || ""}
                        onChange={(event) =>
                          setReviewNotes((prev) => ({
                            ...prev,
                            [requestId]: event.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Optional review note"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ) : item.reviewNote ? (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Review Note
                      </p>
                      <p className="text-sm text-slate-800">
                        {item.reviewNote}
                      </p>
                    </div>
                  ) : null}

                  {isPending ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewRequest(item, "APPROVED")}
                        disabled={actingId === requestId}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reviewRequest(item, "REJECTED")}
                        disabled={actingId === requestId}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
