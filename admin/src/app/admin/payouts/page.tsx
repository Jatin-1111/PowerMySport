"use client";

import { useEffect, useState } from "react";
import { Card } from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { ExportCsvButton } from "@/modules/shared/ui/ExportCsvButton";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { adminApi, PayoutSummary } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  UserCircle2,
  GraduationCap,
  Landmark,
  Smartphone,
  Loader2,
} from "lucide-react";

const VENDOR_LABEL: Record<PayoutSummary["vendorRole"], string> = {
  Coach: "Coach",
  VenueLister: "Venue Owner",
  Expert: "Expert",
};

const VENDOR_ICON: Record<PayoutSummary["vendorRole"], typeof UserCircle2> = {
  Coach: UserCircle2,
  VenueLister: Building2,
  Expert: GraduationCap,
};

const VENDOR_ICON_CLASSES: Record<PayoutSummary["vendorRole"], string> = {
  Coach: "bg-blue-100 text-blue-600",
  VenueLister: "bg-purple-100 text-purple-600",
  Expert: "bg-amber-100 text-amber-600",
};

const payoutKey = (payout: PayoutSummary) => `${payout.vendorId}-${payout.vendorRole}`;

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
    const confirmMessage = `Are you sure you want to mark ₹${payout.totalPendingAmount} as PAID for ${payout.vendorName}?`;
    if (!window.confirm(confirmMessage)) return;

    setProcessingId(payout.vendorId);
    try {
      await payOneVendor(payout);
      toast.success("Payout marked as paid!");
      await loadPayouts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payout");
      console.error(error);
    } finally {
      setProcessingId(null);
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
    (p) => selected.has(payoutKey(p)) && p.payoutMethod,
  );

  const handleBulkPay = async () => {
    if (payableSelectedPayouts.length === 0) return;
    const totalAmount = payableSelectedPayouts.reduce(
      (sum, p) => sum + p.totalPendingAmount,
      0,
    );
    if (
      !window.confirm(
        `Mark ₹${totalAmount.toLocaleString()} as PAID across ${payableSelectedPayouts.length} vendor(s)?`,
      )
    ) {
      return;
    }

    setBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        payableSelectedPayouts.map((payout) => payOneVendor(payout)),
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        toast.error(
          `${payableSelectedPayouts.length - failedCount} paid, ${failedCount} failed.`,
        );
      } else {
        toast.success(`${payableSelectedPayouts.length} vendor(s) paid.`);
      }
      setSelected(new Set());
      await loadPayouts();
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Finance"
          title="Pending Payouts"
          subtitle="Manage and settle pending earnings for Venue Listers, Coaches, and Experts."
        />
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-3" />
          <p className="text-sm">Loading pending payouts...</p>
        </div>
      </div>
    );
  }

  const totalAmountOwed = payouts.reduce(
    (sum, p) => sum + p.totalPendingAmount,
    0,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Finance"
        title="Pending Payouts"
        subtitle="Manage and settle pending earnings for Venue Listers, Coaches, and Experts."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white p-6 border-l-4 border-l-power-orange">
          <p className="text-sm font-semibold text-slate-500">
            Total Pending Vendors
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {payouts.length}
          </p>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-l-emerald-500">
          <p className="text-sm font-semibold text-slate-500">
            Total Amount Owed
          </p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            ₹{totalAmountOwed.toLocaleString()}
          </p>
        </Card>
      </div>

      {payouts.length > 0 && (
        <div className="flex justify-end">
          <ExportCsvButton
            filename="pending-payouts.csv"
            rows={payouts}
            columns={[
              { header: "Vendor Name", value: (p) => p.vendorName },
              { header: "Vendor Role", value: (p) => p.vendorRole },
              { header: "Email", value: (p) => p.vendorEmail },
              { header: "Phone", value: (p) => p.vendorPhone },
              {
                header: "Completed Sessions",
                value: (p) => p.bookingIds.length,
              },
              {
                header: "Amount Owed (INR)",
                value: (p) => p.totalPendingAmount,
              },
              {
                header: "Payout Method",
                value: (p) => p.payoutMethod?.type || "NOT CONFIGURED",
              },
            ]}
          />
        </div>
      )}

      {payouts.length === 0 ? (
        <Card className="bg-white py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">
            All caught up!
          </h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">
            There are currently no pending payouts. All completed bookings have
            been successfully settled.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {selected.size > 0 && (
            <Card className="bg-orange-50 border border-power-orange/30 flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm font-semibold text-slate-800">
                {selected.size} vendor{selected.size === 1 ? "" : "s"} selected
                {payableSelectedPayouts.length !== selected.size &&
                  ` (${selected.size - payableSelectedPayouts.length} missing a payout method, will be skipped)`}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setSelected(new Set())}
                  variant="ghost"
                  size="sm"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleBulkPay}
                  disabled={bulkProcessing || payableSelectedPayouts.length === 0}
                  variant="success"
                  size="sm"
                >
                  {bulkProcessing
                    ? "Processing..."
                    : `Pay Selected (${payableSelectedPayouts.length})`}
                </Button>
              </div>
            </Card>
          )}
          {payouts.map((payout) => (
            <Card
              key={`${payout.vendorId}-${payout.vendorRole}`}
              className="bg-white overflow-hidden transition-all hover:shadow-md border border-slate-200"
            >
              <div className="flex flex-col md:flex-row md:items-stretch">
                {/* Left side: Vendor Info */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      checked={selected.has(payoutKey(payout))}
                      onChange={() => toggleSelected(payout)}
                      disabled={!payout.payoutMethod}
                      className="h-4 w-4 rounded"
                      title={
                        payout.payoutMethod
                          ? "Select for bulk payout"
                          : "No payout method configured"
                      }
                    />
                    <div
                      className={`p-2 rounded-lg ${VENDOR_ICON_CLASSES[payout.vendorRole]}`}
                    >
                      {(() => {
                        const VendorIcon = VENDOR_ICON[payout.vendorRole];
                        return <VendorIcon size={24} />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {payout.vendorName}
                      </h3>
                      <p className="text-sm font-semibold text-slate-500">
                        {VENDOR_LABEL[payout.vendorRole]}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Contact</p>
                      <p className="font-medium text-slate-900">
                        {payout.vendorEmail}
                      </p>
                      <p className="text-slate-600">{payout.vendorPhone}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Bookings</p>
                      <p className="font-medium text-slate-900">
                        {payout.bookingIds.length} completed sessions
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle: Payout Method */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-slate-100 flex-1 bg-slate-50/50">
                  <p className="text-sm font-semibold text-slate-500 mb-3">
                    Preferred Payout Method
                  </p>

                  {!payout.payoutMethod ? (
                    <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        This user has not configured a payout method yet. They
                        need to set it up in their dashboard.
                      </p>
                    </div>
                  ) : payout.payoutMethod.type === "BANK_TRANSFER" ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                        <Landmark size={18} className="text-slate-500" /> Bank
                        Transfer
                      </div>
                      <p>
                        <span className="text-slate-500">Bank:</span>{" "}
                        {payout.payoutMethod.bankName}
                      </p>
                      <p>
                        <span className="text-slate-500">Name:</span>{" "}
                        {payout.payoutMethod.accountHolderName}
                      </p>
                      <p>
                        <span className="text-slate-500">A/C No:</span>{" "}
                        <span className="font-mono text-slate-900 font-medium">
                          {payout.payoutMethod.accountNumber}
                        </span>
                      </p>
                      <p>
                        <span className="text-slate-500">IFSC:</span>{" "}
                        <span className="font-mono text-slate-900 font-medium">
                          {payout.payoutMethod.ifscCode}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                        <Smartphone size={18} className="text-slate-500" /> UPI
                        Transfer
                      </div>
                      <p>
                        <span className="text-slate-500">UPI ID:</span>{" "}
                        <span className="font-mono text-slate-900 font-medium">
                          {payout.payoutMethod.upiId}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side: Action */}
                <div className="p-6 flex flex-col justify-center items-center text-center w-full md:w-64 bg-slate-50/50">
                  <p className="text-sm font-semibold text-slate-500 mb-2">
                    Amount Owed
                  </p>
                  <p className="text-3xl font-bold text-power-orange mb-6">
                    ₹{payout.totalPendingAmount.toLocaleString()}
                  </p>

                  <Button
                    onClick={() => handleMarkAsPaid(payout)}
                    disabled={
                      !payout.payoutMethod || processingId === payout.vendorId
                    }
                    variant={!payout.payoutMethod ? "ghost" : "success"}
                    size="md"
                    fullWidth
                  >
                    {processingId === payout.vendorId ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Mark as Paid
                      </>
                    )}
                  </Button>
                  {!payout.payoutMethod && (
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Cannot pay without payout details
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
