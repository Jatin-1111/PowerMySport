"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import {
  Activity,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
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

const EVENT_TONE: Record<string, "green" | "red" | "blue" | "orange"> = {
  "payment.captured": "green",
  "payment.failed": "red",
  "refund.created": "blue",
  "refund.failed": "orange",
};

interface ReconcileFormState {
  orderId: string;
  type: "payment" | "refund";
  loading: boolean;
  result: { kind: "ok" | "fixed" | "error"; text: string } | null;
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
      toast.error("Retry failed. This event may need manual processing.");
      setErrors((prev) =>
        prev.map((e) => (e.key === errorKey ? { ...e, retryCount: e.retryCount + 1 } : e))
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
      const response = await adminApi.reconcileOrder(reconcile.type, reconcile.orderId);
      if (response.success) {
        const isConsistent = response.data?.isConsistent ?? true;
        const result: ReconcileFormState["result"] = isConsistent
          ? {
              kind: "ok",
              text: `${reconcile.type === "payment" ? "Payment" : "Refund"} status is consistent for order ${reconcile.orderId}.`,
            }
          : {
              kind: "fixed",
              text: `A mismatch was found and corrected for order ${reconcile.orderId}.`,
            };
        setReconcile((r) => ({ ...r, result }));
        toast.success("Reconciliation complete");
      } else {
        throw new Error(response.message || "Failed");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || "Failed to reconcile order";
      toast.error(errorMsg);
      setReconcile((r) => ({ ...r, result: { kind: "error", text: errorMsg } }));
    } finally {
      setReconcile((r) => ({ ...r, loading: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  };

  const stats = {
    total: errors.length,
    paymentEvents: errors.filter((e) => e.eventType.startsWith("payment")).length,
    refundEvents: errors.filter((e) => e.eventType.startsWith("refund")).length,
    maxRetries: Math.max(0, ...errors.map((e) => e.retryCount)),
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Trust & Support"
        title="Webhook recovery"
        subtitle="Payment events that failed to process. Retry them, or check an order against what PhonePe reports."
      />

      <MetricStrip
        items={[
          { label: "Failed events", value: String(stats.total) },
          { label: "Payment events", value: String(stats.paymentEvents) },
          { label: "Refund events", value: String(stats.refundEvents) },
          { label: "Most retries on one event", value: String(stats.maxRetries) },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          flush
          title="Failed events"
          description="Events with 3 or more retries need a manual look."
          action={
            <button
              type="button"
              onClick={loadErrors}
              disabled={loading}
              className={btn("outline", "sm")}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          }
        >
          {loading ? (
            <div className="px-5 pb-5">
              <SkeletonBlock rows={5} label="Loading failed webhook events" />
            </div>
          ) : errors.length === 0 ? (
            <EmptyState title="No failed events" description="Every webhook event was processed." />
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {errors.map((error) => {
                const isExpanded = expandedKey === error.key;
                const age = Math.round(
                  (Date.now() - new Date(error.timestamp).getTime()) / 3600000
                );
                return (
                  <li key={error.key} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={error.eventType}
                            tone={EVENT_TONE[error.eventType] ?? "slate"}
                            dot={false}
                            size="sm"
                          />
                          {error.retryCount > 0 && (
                            <StatusBadge
                              status={`${error.retryCount} ${error.retryCount === 1 ? "retry" : "retries"}`}
                              tone={error.retryCount >= 3 ? "red" : "slate"}
                              dot={false}
                              size="sm"
                            />
                          )}
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="size-3" aria-hidden />
                            {age < 1 ? "Under 1 hour ago" : `${age} hours ago`}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {error.errorMessage}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
                          {error.reference}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRetry(error.key)}
                          disabled={!!retrying}
                          className={btn("primary", "sm")}
                        >
                          {retrying === error.key ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <RotateCcw className="size-3.5" aria-hidden />
                          )}
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isExpanded ? null : error.key)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Hide details" : "Show details"}
                          className={btn("outline", "sm", "!px-2")}
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="size-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-700">Payload summary</p>
                        <div className="space-y-1 font-mono text-xs text-slate-700">
                          {Object.entries(error.payloadSummary).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-slate-500">{k}:</span>
                              <span className="text-slate-800">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-200 pt-2">
                          <span className="flex-1 truncate font-mono text-xs text-slate-500">
                            {error.key}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(error.key)}
                            aria-label="Copy event key"
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                          >
                            <Copy className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Check an order"
            description="Compares the payment or refund state in our database with what PhonePe reports, and corrects any mismatch."
          >
            <div className="space-y-4">
              <div>
                <p className={labelClass}>What to check</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="What to check">
                  {(["payment", "refund"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={reconcile.type === t}
                      onClick={() => setReconcile((r) => ({ ...r, type: t, result: null }))}
                      className={btn(reconcile.type === t ? "primary" : "outline")}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="reconcile-order" className={labelClass}>
                  Order ID
                </label>
                <input
                  id="reconcile-order"
                  type="text"
                  placeholder="64f8c9a2e3b4a5d6c7e8f901"
                  value={reconcile.orderId}
                  onChange={(e) =>
                    setReconcile((r) => ({ ...r, orderId: e.target.value, result: null }))
                  }
                  className={`${fieldClass} font-mono`}
                />
              </div>

              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconcile.loading || !reconcile.orderId.trim()}
                className={btn("primary", "md", "w-full")}
              >
                {reconcile.loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Activity className="size-4" aria-hidden />
                )}
                Run check
              </button>

              {reconcile.result && (
                <div
                  role="status"
                  className={`rounded-lg border p-3 text-sm font-medium ${
                    reconcile.result.kind === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : reconcile.result.kind === "fixed"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {reconcile.result.text}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="When to use which">
            <ul className="space-y-3 text-sm text-slate-600">
              {[
                {
                  icon: RotateCcw,
                  text: "Retry: the webhook failed for a temporary reason, like a timeout or the database being down.",
                },
                {
                  icon: Activity,
                  text: "Check an order: you suspect our status and PhonePe's don't match.",
                },
                {
                  icon: AlertOctagon,
                  text: "Three or more retries: stop retrying and investigate by hand.",
                },
                {
                  icon: ShieldCheck,
                  text: "A retry that succeeds removes the event from this list.",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
