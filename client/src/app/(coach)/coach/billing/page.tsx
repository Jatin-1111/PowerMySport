"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  CoachPlan,
  CoachPlanBillingCycle,
  CoachSubscription,
  CoachSubscriptionOverrideRequest,
  CoachSubscriptionOverrideStatus,
} from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatInr = (value?: number) => {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

const getPlanId = (plan: CoachPlan) => plan.id || plan._id || "";

const getSubscriptionPlanId = (subscription: CoachSubscription | null) => {
  if (!subscription?.planId) return "";
  if (typeof subscription.planId === "string") return subscription.planId;
  return subscription.planId.id || subscription.planId._id || "";
};

const getSubscriptionPlanName = (subscription: CoachSubscription | null) => {
  if (!subscription?.planId) return "-";
  if (typeof subscription.planId === "string") return subscription.planId;
  return subscription.planId.name || subscription.planId.code || "-";
};

const getOverridePlanName = (
  plan?: CoachSubscriptionOverrideRequest["requestedPlanId"],
) => {
  if (!plan) return "-";
  if (typeof plan === "string") return plan;
  return plan.name || plan.code || plan.id || plan._id || "-";
};

const getOverrideStatusClasses = (status: CoachSubscriptionOverrideStatus) => {
  if (status === "APPROVED") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-amber-50 text-amber-700";
};

const MAX_PENDING_OVERRIDE_REQUESTS = 1;

export default function CoachBillingPage() {
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [subscription, setSubscription] = useState<CoachSubscription | null>(
    null,
  );
  const [billingCycle, setBillingCycle] =
    useState<CoachPlanBillingCycle>("MONTHLY");
  const [overrideNote, setOverrideNote] = useState("");
  const [requestedOverridePlanId, setRequestedOverridePlanId] = useState("");
  const [overrideRequests, setOverrideRequests] = useState<
    CoachSubscriptionOverrideRequest[]
  >([]);
  const [pendingOverrideCount, setPendingOverrideCount] = useState(0);
  const [pendingCountLoading, setPendingCountLoading] = useState(true);
  const [overrideFilter, setOverrideFilter] = useState<
    "" | CoachSubscriptionOverrideStatus
  >("");
  const [overridePage, setOverridePage] = useState(1);
  const [overrideTotalPages, setOverrideTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansResponse, subscriptionResponse] = await Promise.all([
        coachApi.listSubscriptionPlans(),
        coachApi.getMySubscription(),
      ]);

      setPlans(plansResponse.data?.plans || []);
      setSubscription(subscriptionResponse.data?.subscription || null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load billing details.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverrideHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await coachApi.listMyOverrideRequests({
        status: overrideFilter || undefined,
        page: overridePage,
        limit: 5,
      });

      setOverrideRequests(response.data?.requests || []);
      setOverrideTotalPages(response.data?.pagination?.totalPages || 1);
    } catch (error) {
      console.error(error);
      setOverrideRequests([]);
      setOverrideTotalPages(1);
    } finally {
      setHistoryLoading(false);
    }
  }, [overrideFilter, overridePage]);

  const loadPendingOverrideCount = useCallback(async () => {
    setPendingCountLoading(true);
    try {
      const response = await coachApi.listMyOverrideRequests({
        status: "PENDING",
        page: 1,
        limit: 1,
      });

      setPendingOverrideCount(response.data?.pagination?.total || 0);
    } catch (error) {
      console.error(error);
      setPendingOverrideCount(0);
    } finally {
      setPendingCountLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadOverrideHistory();
  }, [loadOverrideHistory]);

  useEffect(() => {
    void loadPendingOverrideCount();
  }, [loadPendingOverrideCount]);

  const currentPlanId = useMemo(
    () => getSubscriptionPlanId(subscription),
    [subscription],
  );

  const pendingLimitReached =
    pendingOverrideCount >= MAX_PENDING_OVERRIDE_REQUESTS;

  const subscribeToPlan = async (plan: CoachPlan) => {
    const planId = getPlanId(plan);
    if (!planId) {
      toast.error("Invalid plan selected.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await coachApi.subscribeToPlan({
        planId,
        billingCycle,
      });

      if (!response.success || !response.data?.subscription) {
        throw new Error(response.message || "Unable to update subscription");
      }

      setSubscription(response.data.subscription);
      toast.success("Subscription updated successfully.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSubscription = async () => {
    setSubmitting(true);
    try {
      const response = await coachApi.cancelSubscription({
        reason: "Cancelled by coach from dashboard",
      });

      if (!response.success || !response.data?.subscription) {
        throw new Error(response.message || "Unable to cancel subscription");
      }

      setSubscription(response.data.subscription);
      toast.success("Subscription cancelled.");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to cancel subscription",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitOverrideRequest = async () => {
    if (pendingLimitReached) {
      toast.error(
        "You already have a pending override request. Wait for review before submitting another.",
      );
      return;
    }

    if (!overrideNote.trim()) {
      toast.error("Please explain your override request.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await coachApi.requestSubscriptionOverride({
        note: overrideNote.trim(),
        requestedPlanId: requestedOverridePlanId || undefined,
      });

      if (!response.success) {
        throw new Error(
          response.message || "Unable to submit override request",
        );
      }

      toast.success("Override request submitted.");
      setOverrideNote("");
      setRequestedOverridePlanId("");
      setOverridePage(1);
      await Promise.all([loadOverrideHistory(), loadPendingOverrideCount()]);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit override request",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-2 p-5">
          <h1 className="text-xl font-semibold text-slate-900">
            Billing & Plan
          </h1>
          <p className="text-sm text-slate-600">
            Manage your subscription, billing cycle, and plan upgrade requests.
          </p>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="text-lg font-semibold text-slate-900">
              {getSubscriptionPlanName(subscription)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="text-lg font-semibold text-slate-900">
              {subscription?.status || "NONE"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Current period end</p>
            <p className="text-sm font-medium text-slate-800">
              {subscription?.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleString()
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Next billing date</p>
            <p className="text-sm font-medium text-slate-800">
              {subscription?.nextBillingDate
                ? new Date(subscription.nextBillingDate).toLocaleString()
                : "-"}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-700">Billing cycle</label>
            <select
              value={billingCycle}
              onChange={(event) =>
                setBillingCycle(event.target.value as CoachPlanBillingCycle)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading plans...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-slate-500">
              No plans available right now.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {plans.map((plan) => {
                const planId = getPlanId(plan);
                const isCurrent = currentPlanId && currentPlanId === planId;
                return (
                  <div
                    key={planId || plan.code}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {plan.name}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          {plan.code}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          plan.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-slate-700">
                      <p>Monthly: {formatInr(plan.pricing?.monthly)}</p>
                      <p>Yearly: {formatInr(plan.pricing?.yearly)}</p>
                    </div>

                    {(plan.features || []).length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm text-slate-700">
                        {plan.features.slice(0, 4).map((feature) => (
                          <li key={feature}>• {feature}</li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-4">
                      <Button
                        onClick={() => subscribeToPlan(plan)}
                        disabled={
                          submitting || !plan.isActive || Boolean(isCurrent)
                        }
                      >
                        {isCurrent ? "Current plan" : "Choose plan"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Plan Override Request
          </h2>
          <p className="text-sm text-slate-600">
            Need an exception or custom commercial terms? Send a request for
            admin review.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Pending requests:{" "}
              {pendingCountLoading ? "..." : pendingOverrideCount}/
              {MAX_PENDING_OVERRIDE_REQUESTS}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                pendingLimitReached
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {pendingLimitReached ? "Limit reached" : "Can submit"}
            </span>
          </div>
          {pendingLimitReached ? (
            <p className="text-xs text-rose-600">
              Only one pending override request is allowed at a time.
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm text-slate-700">
              Requested plan (optional)
            </label>
            <select
              value={requestedOverridePlanId}
              onChange={(event) =>
                setRequestedOverridePlanId(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">No specific plan</option>
              {plans
                .filter((plan) => {
                  const planId = getPlanId(plan);
                  return planId && planId !== currentPlanId;
                })
                .map((plan) => {
                  const planId = getPlanId(plan);
                  return (
                    <option key={planId} value={planId}>
                      {plan.name} ({plan.code})
                    </option>
                  );
                })}
            </select>
          </div>
          <textarea
            value={overrideNote}
            onChange={(event) => setOverrideNote(event.target.value)}
            rows={4}
            placeholder="Explain your request"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={submitOverrideRequest}
              disabled={submitting || pendingLimitReached}
            >
              Submit override request
            </Button>
            <Button
              variant="secondary"
              onClick={cancelSubscription}
              disabled={submitting || !subscription}
            >
              Cancel current subscription
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Override Request History
            </h2>
            <select
              value={overrideFilter}
              onChange={(event) => {
                setOverridePage(1);
                setOverrideFilter(
                  event.target.value as "" | CoachSubscriptionOverrideStatus,
                );
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {historyLoading ? (
            <p className="text-sm text-slate-500">
              Loading override history...
            </p>
          ) : overrideRequests.length === 0 ? (
            <p className="text-sm text-slate-500">
              No override requests found for this filter.
            </p>
          ) : (
            <div className="space-y-3">
              {overrideRequests.map((request) => {
                const requestId = request.id || request._id || "";
                const submittedAt = request.createdAt
                  ? new Date(request.createdAt).toLocaleString()
                  : "-";

                return (
                  <div
                    key={requestId}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Requested plan:{" "}
                        {getOverridePlanName(request.requestedPlanId)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getOverrideStatusClasses(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Submitted: {submittedAt}
                    </p>
                    <p className="mt-2 text-sm text-slate-800">
                      {request.note}
                    </p>
                    {request.reviewNote ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Admin note: {request.reviewNote}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setOverridePage((prev) => Math.max(1, prev - 1))}
              disabled={overridePage <= 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {overridePage} of {overrideTotalPages}
            </span>
            <button
              onClick={() =>
                setOverridePage((prev) =>
                  Math.min(overrideTotalPages, prev + 1),
                )
              }
              disabled={overridePage >= overrideTotalPages}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
