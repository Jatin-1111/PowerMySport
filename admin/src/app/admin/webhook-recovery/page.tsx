"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WifiOff,
  Zap,
} from "lucide-react";

interface WebhookError {
  key: string;
  timestamp: string;
  eventType: string;
  reference: string;
  errorMessage: string;
  retryCount: number;
  payloadSummary: {
    event?: string;
    created_at?: string;
    entityId?: string;
  };
}

const EVENT_COLORS: Record<string, string> = {
  "payment.captured": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "payment.failed": "bg-red-100 text-red-700 border-red-200",
  "refund.created": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "refund.failed": "bg-orange-100 text-orange-700 border-orange-200",
};

interface ReconcileFormState {
  orderId: string;
  type: "payment" | "refund";
  loading: boolean;
  result: string | null;
}

export default function AdminWebhookRecoveryPage() {
  const [errors, setErrors] = useState<WebhookError[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileFormState>({
    orderId: "",
    type: "payment",
    loading: false,
    result: null,
  });

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getWebhookErrors();
      if (response.success && response.data) {
        setErrors(response.data);
      } else {
        setErrors([]);
      }
    } catch {
      toast.error("Failed to load webhook errors");
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (errorKey: string) => {
    setRetrying(errorKey);
    try {
      const response = await adminApi.retryWebhookError(errorKey);
      if (response.success) {
        toast.success("Webhook event retried successfully");
        setErrors((prev) => prev.filter((e) => e.key !== errorKey));
      } else {
        throw new Error("Retry failed");
      }
    } catch {
      toast.error("Retry failed — event may need manual processing");
      setErrors((prev) =>
        prev.map((e) =>
          e.key === errorKey ? { ...e, retryCount: e.retryCount + 1 } : e,
        ),
      );
    } finally {
      setRetrying(null);
    }
  };

  const handleReconcile = async () => {
    if (!reconcile.orderId.trim()) {
      toast.error("Please enter an order ID");
      return;
    }

    setReconcile((r) => ({ ...r, loading: true, result: null }));
    try {
      const response = await adminApi.reconcileOrder(
        reconcile.type,
        reconcile.orderId,
      );
      if (response.success) {
        const isConsistent = response.data?.isConsistent ?? true;
        const msg = isConsistent
          ? `✅ ${reconcile.type === "payment" ? "Payment" : "Refund"} status is consistent for order ${reconcile.orderId}`
          : `⚠️ Discrepancy found and fixed for order ${reconcile.orderId}`;
        setReconcile((r) => ({ ...r, result: msg }));
        toast.success("Reconciliation complete");
      } else {
        throw new Error(response.message || "Failed");
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to reconcile order";
      toast.error(errorMsg);
      setReconcile((r) => ({ ...r, result: `❌ ${errorMsg}` }));
    } finally {
      setReconcile((r) => ({ ...r, loading: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!"));
  };

  const stats = {
    total: errors.length,
    paymentEvents: errors.filter((e) => e.eventType.startsWith("payment"))
      .length,
    refundEvents: errors.filter((e) => e.eventType.startsWith("refund")).length,
    maxRetries: Math.max(0, ...errors.map((e) => e.retryCount)),
  };

  return (
    <div>
      <AdminPageHeader
        title="Webhook Recovery"
        subtitle="Monitor failed webhook events, retry processing, and reconcile payment state"
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Failed Events",
            value: stats.total,
            color: "text-red-600",
            bg: "bg-red-50 border-red-100",
            icon: AlertOctagon,
          },
          {
            label: "Payment Events",
            value: stats.paymentEvents,
            color: "text-indigo-600",
            bg: "bg-indigo-50 border-indigo-100",
            icon: Zap,
          },
          {
            label: "Refund Events",
            value: stats.refundEvents,
            color: "text-amber-600",
            bg: "bg-amber-50 border-amber-100",
            icon: RotateCcw,
          },
          {
            label: "Max Retries",
            value: stats.maxRetries,
            color: "text-slate-600",
            bg: "bg-slate-50 border-slate-100",
            icon: Activity,
          },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`rounded-2xl border p-5 ${bg}`}>
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <p className="text-sm font-medium text-slate-500">{label}</p>
            </div>
            <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Error Log — takes 3 cols */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Failed Webhook Events
                </h2>
                {errors.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                    {errors.length}
                  </span>
                )}
              </div>
              <button
                onClick={loadErrors}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              </div>
            ) : errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck className="mb-3 h-14 w-14 text-emerald-300" />
                <p className="text-base font-semibold text-slate-600">
                  No failed webhook events
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  All events processed successfully
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {errors.map((error) => {
                  const isExpanded = expandedKey === error.key;
                  const colorClass =
                    EVENT_COLORS[error.eventType] ||
                    "bg-slate-100 text-slate-700 border-slate-200";
                  const age = Math.round(
                    (Date.now() - new Date(error.timestamp).getTime()) /
                      3600000,
                  );
                  return (
                    <div key={error.key} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {error.eventType.endsWith("failed") ? (
                            <WifiOff className="h-4 w-4 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
                            >
                              {error.eventType}
                            </span>
                            {error.retryCount > 0 && (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                {error.retryCount}{" "}
                                {error.retryCount === 1 ? "retry" : "retries"}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {age < 1 ? "< 1h ago" : `${age}h ago`}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {error.errorMessage}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                            {error.reference}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => handleRetry(error.key)}
                            disabled={!!retrying}
                            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {retrying === error.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Retry
                          </button>
                          <button
                            onClick={() =>
                              setExpandedKey(isExpanded ? null : error.key)
                            }
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Payload Summary
                          </p>
                          <div className="font-mono text-xs text-slate-700 space-y-1">
                            {Object.entries(error.payloadSummary).map(
                              ([k, v]) => (
                                <div
                                  key={k}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-slate-400">{k}:</span>
                                  <span className="text-slate-800">
                                    {String(v)}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                            <span className="font-mono text-[10px] text-slate-400 truncate flex-1">
                              {error.key}
                            </span>
                            <button
                              onClick={() => copyToClipboard(error.key)}
                              className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                            >
                              <Copy className="h-3.5 w-3.5" />
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

        {/* Reconciliation tool — takes 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-bold text-slate-900">
                Reconciliation
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">
                Verify that the payment or refund state in the database matches
                what PhonePe reports. Any discrepancies will be auto-corrected.
              </p>

              {/* Type selector */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Check Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["payment", "refund"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setReconcile((r) => ({ ...r, type: t, result: null }))
                      }
                      className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                        reconcile.type === t
                          ? "border-indigo-300 bg-indigo-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order ID */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Order ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 64f8c9a2e3b4a5d6c7e8f901"
                  value={reconcile.orderId}
                  onChange={(e) =>
                    setReconcile((r) => ({
                      ...r,
                      orderId: e.target.value,
                      result: null,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                onClick={handleReconcile}
                disabled={reconcile.loading || !reconcile.orderId.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reconcile.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                Run Reconciliation
              </button>

              {reconcile.result && (
                <div
                  className={`rounded-xl border p-3 text-sm font-medium ${
                    reconcile.result.startsWith("✅")
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : reconcile.result.startsWith("⚠️")
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {reconcile.result}
                </div>
              )}
            </div>
          </div>

          {/* Guide */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              Recovery Guide
            </p>
            <ul className="space-y-2.5 text-xs text-slate-600">
              {[
                {
                  icon: RotateCcw,
                  text: "Use Retry when a webhook failed due to a transient error (timeout, DB down)",
                },
                {
                  icon: Activity,
                  text: "Use Reconciliation when you suspect a DB/gateway status mismatch",
                },
                {
                  icon: AlertOctagon,
                  text: "Events with 3+ retries should be manually investigated",
                },
                {
                  icon: ShieldCheck,
                  text: "Successfully retried events are removed from this list automatically",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
