"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi } from "@/modules/admin/services/admin";
import { Card } from "@/modules/shared/ui/Card";
import { CoachPlan, CoachSubscriptionRecord } from "@/types";
import { useCallback, useEffect, useState } from "react";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const getPlanName = (plan: CoachSubscriptionRecord["planId"]) => {
  if (!plan) return "-";
  if (typeof plan === "string") return plan;
  return plan.name || plan.code || plan.id || plan._id || "-";
};

const getCoachIdentifier = (coach: CoachSubscriptionRecord["coachId"]) => {
  if (!coach) return "-";
  if (typeof coach === "string") return coach;
  return coach.id || coach._id || coach.userId || "-";
};

export default function AdminCoachSubscriptionsPage() {
  const [records, setRecords] = useState<CoachSubscriptionRecord[]>([]);
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [planId, setPlanId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadPlans = useCallback(async () => {
    try {
      const response = await adminApi.listCoachPlans();
      setPlans(response.data?.plans || []);
    } catch (error) {
      console.error(error);
      setPlans([]);
    }
  }, []);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.listCoachSubscriptions({
        status: status || undefined,
        planId: planId || undefined,
        page,
        limit: 15,
      });

      setRecords(response.data?.subscriptions || []);
      setTotalPages(response.data?.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
      setRecords([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, planId, status]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Coach Billing"
        title="Coach Subscriptions"
        subtitle="Track subscription status, billing cycle dates, and renewal health."
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAST_DUE">Past due</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>

        <select
          value={planId}
          onChange={(event) => {
            setPage(1);
            setPlanId(event.target.value);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All plans</option>
          {plans.map((plan) => {
            const value = plan.id || plan._id || "";
            return (
              <option key={value || plan.code} value={value}>
                {plan.name} ({plan.code})
              </option>
            );
          })}
        </select>
      </div>

      <Card className="overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Coach
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Plan
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Billing Cycle
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Current Period End
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Next Billing
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading subscriptions...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={item.id || item._id}>
                    <td className="px-4 py-3 text-slate-700">
                      {getCoachIdentifier(item.coachId)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {getPlanName(item.planId)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.billingCycle}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(item.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(item.nextBillingDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
