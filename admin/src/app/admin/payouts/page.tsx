"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi, PayoutSummary } from "@/modules/admin/services/admin";
import { btn } from "@/modules/shared/ui/buttonStyles";
import { ConfirmModal } from "@/modules/shared/ui/ConfirmModal";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { MetricStrip, Panel } from "@/modules/shared/ui/Panel";
import { EmptyState, SkeletonBlock } from "@/modules/shared/ui/States";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { AlertCircle, Landmark, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const VENDOR_LABEL: Record<PayoutSummary["vendorRole"], string> = {
  Coach: "Coach",
  CoachSession: "Coach, classes",
  VenueLister: "Venue owner",
  Expert: "Expert",
};

const inr = (value: number) => {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const payoutKey = (payout: PayoutSummary) => `${payout.vendorId}-${payout.vendorRole}`;

type PendingConfirm = { kind: "one"; payout: PayoutSummary } | { kind: "bulk" } | null;

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPendingPayouts();
      if (response.success && response.data) {
        setPayouts(response.data);
      } else {
        toast.error(response.message || "Failed to load payouts");
      }
    } catch (error) {
      toast.error("Failed to fetch pending payouts");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const payOneVendor = async (payout: PayoutSummary) => {
    const response = await adminApi.markPayoutsAsPaid({
      vendorId: payout.vendorId,
      vendorRole: payout.vendorRole,
      bookingIds: payout.bookingIds,
    });
    if (!response.success) {
      throw new Error(response.message || `Failed to pay ${payout.vendorName}`);
    }
  };

  const handleMarkAsPaid = async (payout: PayoutSummary) => {
    setProcessingId(payout.vendorId);
    try {
      await payOneVendor(payout);
      toast.success(`${payout.vendorName} marked as paid`);
      await loadPayouts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payout");
      console.error(error);
    } finally {
      setProcessingId(null);
      setConfirm(null);
    }
  };

  const toggleSelected = (payout: PayoutSummary) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = payoutKey(payout);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const payableSelectedPayouts = payouts.filter(
    (p) => selected.has(payoutKey(p)) && p.payoutMethod
  );
  const selectedTotal = payableSelectedPayouts.reduce((sum, p) => sum + p.totalPendingAmount, 0);

  const handleBulkPay = async () => {
    if (payableSelectedPayouts.length === 0) return;

    setBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        payableSelectedPayouts.map((payout) => payOneVendor(payout))
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        toast.error(`${payableSelectedPayouts.length - failedCount} paid, ${failedCount} failed.`);
      } else {
        toast.success(`${payableSelectedPayouts.length} vendor(s) paid.`);
      }
      setSelected(new Set());
      await loadPayouts();
    } finally {
      setBulkProcessing(false);
      setConfirm(null);
    }
  };

  const totalAmountOwed = payouts.reduce((sum, p) => sum + p.totalPendingAmount, 0);
  const withoutMethod = payouts.filter((p) => !p.payoutMethod).length;
  const payableAll = payouts.filter((p) => p.payoutMethod);
  const allSelected = payableAll.length > 0 && payableAll.every((p) => selected.has(payoutKey(p)));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(payableAll.map(payoutKey)));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Commerce"
        title="Pending payouts"
        subtitle="Earnings owed to venue owners, coaches and experts for completed sessions."
        action={
          payouts.length > 0 ? (
            <ExportCsvButton
              filename="pending-payouts.csv"
              rows={payouts}
              columns={[
                { header: "Vendor Name", value: (p) => p.vendorName },
                { header: "Vendor Role", value: (p) => p.vendorRole },
                { header: "Email", value: (p) => p.vendorEmail },
                { header: "Phone", value: (p) => p.vendorPhone },
                { header: "Completed Sessions", value: (p) => p.bookingIds.length },
                { header: "Amount Owed (INR)", value: (p) => p.totalPendingAmount },
                { header: "Payout Method", value: (p) => p.payoutMethod?.type || "NOT CONFIGURED" },
              ]}
            />
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonBlock rows={8} label="Loading pending payouts" />
      ) : payouts.length === 0 ? (
        <EmptyState
          title="Nothing to pay out"
          description="Every completed booking has been settled."
        />
      ) : (
        <>
          <MetricStrip
            items={[
              { label: "Vendors waiting", value: String(payouts.length) },
              { label: "Total owed", value: inr(totalAmountOwed) },
              {
                label: "Missing payout details",
                value: String(withoutMethod),
                detail: withoutMethod > 0 ? "Can't be paid until they add them" : undefined,
              },
            ]}
          />

          {selected.size > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3"
            >
              <p className="text-sm font-medium text-slate-900">
                {selected.size} selected, {inr(selectedTotal)} to pay
                {payableSelectedPayouts.length !== selected.size &&
                  ` (${selected.size - payableSelectedPayouts.length} without payout details will be skipped)`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className={btn("quiet")}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "bulk" })}
                  disabled={bulkProcessing || payableSelectedPayouts.length === 0}
                  className={btn("primary")}
                >
                  Mark {payableSelectedPayouts.length} as paid
                </button>
              </div>
            </div>
          )}

          <Panel flush>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all vendors that can be paid"
                        checked={allSelected}
                        disabled={payableAll.length === 0}
                        onChange={toggleAll}
                        className="size-4 rounded accent-orange-700"
                      />
                    </th>
                    <th>Vendor</th>
                    <th>Payout details</th>
                    <th className="text-right">Owed</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => {
                    const method = payout.payoutMethod;
                    return (
                      <tr key={payoutKey(payout)} className="align-top">
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${payout.vendorName}`}
                            checked={selected.has(payoutKey(payout))}
                            onChange={() => toggleSelected(payout)}
                            disabled={!method}
                            title={method ? undefined : "No payout details yet"}
                            className="size-4 rounded accent-orange-700"
                          />
                        </td>
                        <td>
                          <p className="font-semibold text-slate-900">{payout.vendorName}</p>
                          <p className="text-xs text-slate-500">
                            {VENDOR_LABEL[payout.vendorRole]}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{payout.vendorEmail}</p>
                          <p className="text-xs text-slate-600">{payout.vendorPhone}</p>
                        </td>
                        <td className="min-w-48">
                          {!method ? (
                            <p className="flex items-start gap-1.5 text-sm text-amber-800">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                              Not added yet. They set it up in their dashboard.
                            </p>
                          ) : method.type === "BANK_TRANSFER" ? (
                            <div className="space-y-0.5 text-sm">
                              <p className="flex items-center gap-1.5 font-medium text-slate-900">
                                <Landmark size={14} className="text-slate-500" aria-hidden />
                                Bank transfer
                              </p>
                              <p className="text-slate-600">
                                {method.accountHolderName}, {method.bankName}
                              </p>
                              <p className="font-mono text-xs text-slate-700">
                                {method.accountNumber} · {method.ifscCode}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-0.5 text-sm">
                              <p className="flex items-center gap-1.5 font-medium text-slate-900">
                                <Smartphone size={14} className="text-slate-500" aria-hidden />
                                UPI
                              </p>
                              <p className="font-mono text-xs text-slate-700">{method.upiId}</p>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <p className="text-base font-semibold tabular-nums text-slate-900">
                            {inr(payout.totalPendingAmount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {payout.bookingIds.length} session
                            {payout.bookingIds.length === 1 ? "" : "s"}
                          </p>
                        </td>
                        <td className="text-right">
                          {method ? (
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: "one", payout })}
                              disabled={processingId === payout.vendorId}
                              className={btn("outline", "sm")}
                            >
                              {processingId === payout.vendorId ? "Saving…" : "Mark as paid"}
                            </button>
                          ) : (
                            <StatusBadge status="No details" tone="amber" dot={false} size="sm" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <ConfirmModal
        open={confirm !== null}
        title={
          confirm?.kind === "one"
            ? `Mark ${inr(confirm.payout.totalPendingAmount)} as paid?`
            : `Mark ${inr(selectedTotal)} as paid?`
        }
        description={
          confirm?.kind === "one"
            ? `This records ${confirm.payout.vendorName}'s ${confirm.payout.bookingIds.length} completed session${confirm.payout.bookingIds.length === 1 ? "" : "s"} as settled. Do it only after the money has been sent.`
            : `This records ${payableSelectedPayouts.length} vendor${payableSelectedPayouts.length === 1 ? "" : "s"} as settled. Do it only after the money has been sent.`
        }
        confirmLabel="Mark as paid"
        loading={processingId !== null || bulkProcessing}
        onConfirm={() => {
          if (confirm?.kind === "one") void handleMarkAsPaid(confirm.payout);
          else void handleBulkPay();
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
